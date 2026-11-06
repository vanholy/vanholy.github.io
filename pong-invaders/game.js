/* Pong Invaders — duello in due sullo stesso tablet.
 * Il campo è descritto in "coordinate di campo": l'asse x va dal giocatore BLU (x piccolo)
 * al giocatore ROSA (x grande), l'asse y è la larghezza. In orizzontale il campo è disegnato
 * così com'è (BLU a sinistra), in verticale è ruotato (BLU in basso, ROSA in alto). */
(() => {
  'use strict';

  // ---------- costanti ----------
  const T = 1840;               // lunghezza totale (HUD compresi)
  const HUD = 130;              // profondità della fascia HUD di ogni giocatore
  const PX0 = HUD, PX1 = T - HUD, MID = T / 2;
  const ROWS = 54, DEPTH = 5, CELL_X = 15, BARRIER_OFF = 150;
  const CANNON_OFF = 52, CANNON_LEN = 124, CANNON_T = 26;
  const MAXLVL = 5;
  const GRID = 48;               // lato di un quadratino della griglia di sfondo
  const VORTEX_T = 0.55;         // durata del vortice elettrico
  const PARRY = GRID;
  const PAUSE_Y = 46;            // tasto pausa in alto sulla linea centrale (il centro è del bonus)
  const FREE_SPEED = 0.8;        // modalità libera: velocità del cannone ridotta del 20%
  const FINGER_AHEAD = 70;       // modalità libera: il cannone sta davanti al dito, così il dito non lo copre
  const BONUS_EVERY = 60, BONUS_LIFE = 20, BONUS_R = 32, RAPID_T = 10;
  const BONUSES = {
    coins:   { icon: '🪙', label: '+5 MONETE',        c: '#ffd34d' },
    life:    { icon: '❤️', label: '+1 VITA',          c: '#ff5a7a' },
    barrier: { icon: '🛡️', label: 'BARRIERA COMPLETA', c: '#7dfcff' },
    power:   { icon: '⚡', label: 'POTENZA +1',       c: '#b48cff' },
    rapid:   { icon: '🔥', label: 'FUOCO RAPIDO',     c: '#ff8a3a' },
  };            // due colpi si annullano se distano meno di un quadratino in x e in y (area 2x2)
  const LEVELS = [null,
    { cd: 0.55, shots: 1, speed: 760, str: 1, rad: 1.0, r: 9 },
    { cd: 0.44, shots: 1, speed: 820, str: 1, rad: 1.4, r: 10 },
    { cd: 0.46, shots: 2, speed: 860, str: 2, rad: 1.5, r: 10 },
    { cd: 0.38, shots: 2, speed: 920, str: 2, rad: 1.8, r: 11 },
    { cd: 0.36, shots: 3, speed: 980, str: 3, rad: 2.1, r: 12 },
  ];
  const powerCost = lvl => 2 + lvl * 2;        // 4, 6, 8, 10
  const REPAIR_FULL = 10;                      // monete per una riparazione completa
  const GOAL_LOCK = 1.0;                       // dopo un colpo arrivato in fondo, chi l'ha sparato aspetta 1 s per sparare ancora
  const SLOW_FIRE = 1.6;                       // cadenza "lenta": attesa tra i colpi più lunga del 60%
  // Temi: "neon" (moderno) e "hist" (guerra dell'800, cartoon). Le regole sono identiche, cambia la grafica.
  const THEMES = {
    neon: { pl: [{ name: 'BLU', c: '#2de2ff', rgb: '45,226,255' }, { name: 'ROSA', c: '#ff2d95', rgb: '255,45,149' }],
            font: '"Orbitron", "Segoe UI", sans-serif', text: '#fff', sub: 'rgba(255,255,255,0.55)', sub2: 'rgba(255,255,255,0.75)', fs: 1 },
    hist: { pl: [{ name: 'BLU', c: '#2f5fb3', rgb: '47,95,179' }, { name: 'ROSSO', c: '#c4302b', rgb: '196,48,43' }],
            font: '"Rye", Georgia, serif', text: '#3b2a17', sub: 'rgba(59,42,23,0.65)', sub2: 'rgba(59,42,23,0.8)', fs: 0.86 },
  };
  let theme = 'neon', HIST = false, TS = THEMES.neon;
  const PL = THEMES.neon.pl.map(x => ({ ...x }));
  const GOLD = '#ffd34d';
  let FONT = THEMES.neon.font;
  const glowK = () => HIST ? 0 : view.dpr;          // niente bagliori neon nel tema storico

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const rnd = (a, b) => a + Math.random() * (b - a);

  // ---------- forma delle barriere (5 bunker) ----------
  const MASK = new Uint8Array(ROWS * DEPTH);
  (() => {
    const nb = 5, bw = Math.floor(ROWS * 0.78 / nb), gap = (ROWS - nb * bw) / (nb + 1);
    const notch = Math.floor(bw / 3);
    for (let b = 0; b < nb; b++) {
      const start = Math.round(gap * (b + 1) + bw * b);
      for (let k = 0; k < bw; k++) for (let d = 0; d < DEPTH; d++) {
        if (d === DEPTH - 1 && (k === 0 || k === bw - 1)) continue;          // angoli smussati
        if (d === 0 && k >= notch && k < bw - notch) continue;               // incavo dietro
        MASK[(start + k) * DEPTH + d] = 1;
      }
    }
  })();
  let MASK_HP = 0; for (const m of MASK) MASK_HP += m * 2;

  // ---------- canvas e vista ----------
  const cv = document.getElementById('game');
  const ctx = cv.getContext('2d');
  const bg = document.createElement('canvas');
  const bgx = bg.getContext('2d');
  let W = 900;
  const view = { s: 1, ox: 0, oy: 0, portrait: false, dpr: 1 };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = window.innerWidth, ch = window.innerHeight;
    cv.width = bg.width = Math.round(cw * dpr);
    cv.height = bg.height = Math.round(ch * dpr);
    // dimensione a schermo fissata in CSS: senza, su schermi Retina (iPad) il canvas appare grande il doppio
    cv.style.width = cw + 'px';
    cv.style.height = ch + 'px';
    const portrait = ch > cw;
    const long = portrait ? ch : cw, short = portrait ? cw : ch;
    const nW = clamp(T * short / long, 760, 1400);
    const s = Math.min(long / T, short / nW);
    if (portrait) { view.ox = (cw - nW * s) / 2; view.oy = (ch - T * s) / 2; }
    else { view.ox = (cw - T * s) / 2; view.oy = (ch - nW * s) / 2; }
    if (players.length && nW !== W) rescale(nW / W);
    W = nW; view.s = s; view.portrait = portrait; view.dpr = dpr;
    drawBackground();
  }

  function rescale(k) {
    for (const p of players) { p.y *= k; p.ty *= k; }
    for (const b of balls) { b.y *= k; for (let i = 1; i < b.trail.length; i += 2) b.trail[i] *= k; }
    for (const q of parts) q.y *= k;
    for (const q of pops) q.y *= k;
  }

  function setField(c, sx = 0, sy = 0) {
    const { s, ox, oy, dpr, portrait } = view;
    if (!portrait) c.setTransform(s * dpr, 0, 0, s * dpr, (ox + sx) * dpr, (oy + sy) * dpr);
    else c.setTransform(0, -s * dpr, s * dpr, 0, (ox + sx) * dpr, (oy + T * s + sy) * dpr);
  }

  function toField(cx, cy) {
    const { s, ox, oy, portrait } = view;
    if (!portrait) return { x: (cx - ox) / s, y: (cy - oy) / s };
    return { x: T - (cy - oy) / s, y: (cx - ox) / s };
  }

  // Sistema locale di un giocatore: u = da sinistra a destra (per lui), v = dall'alto (lato campo) verso di lui.
  function toLocal(p, f) {
    return p.i === 0 ? { u: f.y, v: HUD - f.x } : { u: W - f.y, v: f.x - (T - HUD) };
  }
  function playerFrame(p) {
    if (p.i === 0) { ctx.translate(HUD, 0); ctx.rotate(Math.PI / 2); }
    else { ctx.translate(T - HUD, W); ctx.rotate(-Math.PI / 2); }
  }
  function facing(x, y, i) { ctx.translate(x, y); ctx.rotate(i === 0 ? Math.PI / 2 : -Math.PI / 2); }

  function rr(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  // sprite di bagliore per le palle
  const makeGlow = () => PL.map(pl => {
    const g = document.createElement('canvas'); g.width = g.height = 128;
    const gc = g.getContext('2d');
    const gr = gc.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, `rgba(${pl.rgb},0.95)`); gr.addColorStop(0.25, `rgba(${pl.rgb},0.45)`);
    gr.addColorStop(1, `rgba(${pl.rgb},0)`);
    gc.fillStyle = gr; gc.fillRect(0, 0, 128, 128);
    return g;
  });
  let glow = makeGlow();

  // ---------- audio (vedi audio.js) ----------
  const Sound = window.PIAudio;
  // stereo: in orizzontale il BLU suona a sinistra e il ROSA a destra
  Sound.pan = x => (view.portrait || x === undefined) ? 0 : (x - MID) / (MID - HUD);


  // ---------- stato ----------
  let state = 'menu';            // menu | countdown | play | paused | over
  let pausedFrom = 'play';
  let players = [], balls = [], parts = [], pops = [], flashes = [];
  let bonus = null, bonusTimer = 0;
  let countdown = 0, goT = 0, overT = 0, winner = -1, shake = 0, time = 0;
  let maxHp = 3, fireMode = 'auto', moveMode = 'rail', demo = true, firstMatch = true;
  let players1 = false, cpuLevel = 'medium';   // partita contro il computer e livello
  let aimMode = 'spin', rateMode = 'normal';   // tiro con effetto o sempre dritto; cadenza normale o lenta
  try {
    const saved = JSON.parse(localStorage.getItem('pong-invaders-opts') || '{}');
    if ([3, 5, 7].includes(saved.hp)) maxHp = saved.hp;
    if (saved.fire === 'manual' || saved.fire === 'auto') fireMode = saved.fire;
    if (saved.move === 'free' || saved.move === 'rail') moveMode = saved.move;
    if (saved.theme === 'hist' || saved.theme === 'neon') theme = saved.theme;
    if (typeof saved.solo === 'boolean') players1 = saved.solo;
    if (['easy', 'medium', 'hard'].includes(saved.cpu)) cpuLevel = saved.cpu;
    if (saved.aim === 'spin' || saved.aim === 'straight') aimMode = saved.aim;
    if (saved.rate === 'normal' || saved.rate === 'slow') rateMode = saved.rate;
  } catch (e) { /* opzioni di default */ }
  function saveOpts() { try { localStorage.setItem('pong-invaders-opts', JSON.stringify({ hp: maxHp, fire: fireMode, move: moveMode, theme, solo: players1, cpu: cpuLevel, aim: aimMode, rate: rateMode })); } catch (e) { /* niente */ } }
  const wins = [0, 0];
  const owners = new Map();      // pointerId -> indice giocatore

  function newMatch(isDemo) {
    demo = isDemo;
    Sound.muted = isDemo;
    players = [0, 1].map(i => ({
      i, dir: i === 0 ? 1 : -1, x: homeX(i), tx: homeX(i), y: W / 2, ty: W / 2, vy: 0, hp: maxHp, coins: 0, lvl: 1, rapid: 0,
      cd: 0.4 + i * 0.2, recoil: 0, hitT: 0, repairFx: 0, coinFx: 0, queued: 0,
      bar: Int8Array.from(MASK, m => m * 2), fresh: new Uint8Array(MASK.length), goals: [],
      marks: makeMarks(i === 0 ? 1 : -1),
      btn: { power: 0, repair: 0 }, deny: { power: 0, repair: 0 },
      touches: new Map(), kUp: false, kDown: false, kFwd: false, kBack: false, kFire: false, ai: { t: 0, tgt: W / 2, tgx: homeX(i) },
    }));
    players[1].cpu = !isDemo && players1;
    balls = []; parts = []; pops = []; flashes = []; winner = -1; owners.clear();
    bonus = null; bonusTimer = 0;
  }

  // segni di danno del cannone: compaiono uno alla volta man mano che perde vite
  function makeMarks(dir) {
    const list = [];
    for (let k = 0; k < 10; k++) {
      const y = rnd(-CANNON_LEN / 2 + 8, CANNON_LEN / 2 - 8);
      const side = Math.random() < 0.75 ? dir : -dir;          // i colpi arrivano soprattutto davanti
      const crack = [[side * CANNON_T / 2, y]];
      let cx = side * CANNON_T / 2, cy = y;
      for (let j = 0; j < 3; j++) { cx -= side * rnd(4, 9); cy += rnd(-10, 10); crack.push([cx, cy]); }
      list.push({ y, side, r: rnd(4, 8), crack });
    }
    // ordinate in modo che i primi danni siano sparsi su tutto il cannone
    return list.sort(() => Math.random() - 0.5);
  }
  const damageOf = p => demo ? 0 : 1 - p.hp / maxHp;

  function homeX(i) { return i === 0 ? PX0 + CANNON_OFF : PX1 - CANNON_OFF; }
  const cannonX = p => p.x;
  // limiti del cannone in profondità: fisso sul binario, oppure libero in tutta la propria metà
  function xRange(p) {
    if (moveMode !== 'free') { const h = homeX(p.i); return [h, h]; }
    const back = CANNON_T / 2 + 10, front = CANNON_T / 2 + 24;
    return p.i === 0 ? [PX0 + back, MID - front] : [MID + front, PX1 - back];
  }
  const barrierX0 = p => p.i === 0 ? PX0 + BARRIER_OFF : PX1 - BARRIER_OFF - DEPTH * CELL_X;
  const colToD = (p, c) => p.i === 0 ? c : DEPTH - 1 - c;          // c = colonna in ordine di x
  function barrierRatio(p) { let s = 0; for (const h of p.bar) s += h; return s / MASK_HP; }

  // ---------- effetti ----------
  function burst(x, y, color, n, speed, dirx = 0, size = 5) {
    const remap = HIST && color !== GOLD;
    for (let k = 0; k < n && parts.length < 900; k++) {
      const a = Math.random() * Math.PI * 2, v = rnd(0.2, 1) * speed;
      parts.push({ x, y, vx: Math.cos(a) * v + dirx * speed * 0.6, vy: Math.sin(a) * v,
        life: rnd(0.35, 0.8), max: 0.8, c: remap ? histColor(color) : color, s: rnd(size * 0.5, size * 1.3) });
    }
  }
  function addPop(x, y, text, i, color, big = false) {
    pops.push({ x, y, text, i, c: color, life: 1.1, big });
  }
  function vibrate(ms) { if (!demo && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { /* niente */ } }

  // ---------- azioni ----------
  function fire(p) {
    const L = LEVELS[p.lvl];
    const x = cannonX(p) + p.dir * (CANNON_T / 2 + L.r + 6);
    // tiro dritto: nessun effetto dal movimento e colpi multipli paralleli invece che a ventaglio
    const straight = aimMode === 'straight';
    const spin = straight ? 0 : clamp(p.vy * 0.42, -L.speed * 0.55, L.speed * 0.55);
    const base = Math.asin(spin / L.speed);
    const list = L.shots === 1 ? [[base, 0]] : L.shots === 2 ? [[base, -17], [base, 17]]
      : straight ? [[0, -28], [0, 0], [0, 28]] : [[base - 0.14, 0], [base, 0], [base + 0.14, 0]];
    for (const [a, o] of list) {
      balls.push({ x, y: clamp(p.y + o, L.r, W - L.r), vx: p.dir * Math.cos(a) * L.speed, vy: Math.sin(a) * L.speed,
        r: L.r, str: L.str, rad: L.rad, o: p.i, trail: [], born: time });
    }
    burst(x, p.y, PL[p.i].c, 5, 160, p.dir, 4);
    p.recoil = 1;
    Sound.shoot(p.i, p.lvl, x);
  }

  function buyPower(p) {
    if (state !== 'play' && state !== 'countdown') return;
    if (p.lvl >= MAXLVL || p.coins < powerCost(p.lvl)) { p.deny.power = 0.35; Sound.deny(cannonX(p)); return; }
    p.coins -= powerCost(p.lvl); p.lvl++; p.btn.power = 0.4;
    addPop(cannonX(p) + p.dir * 150, p.y, `POTENZA LV ${p.lvl}`, p.i, GOLD, true);
    burst(cannonX(p), p.y, GOLD, 30, 380); Sound.buy(cannonX(p)); vibrate(25);
  }

  // Riparazione: usa le monete disponibili. REPAIR_FULL monete = barriera completa,
  // meno monete = riparazione in proporzione. Non spende mai più del necessario.
  function repairInfo(p) {
    let hp = 0; for (const h of p.bar) hp += h;
    const missing = MASK_HP - hp;
    const need = Math.ceil(missing / MASK_HP * REPAIR_FULL - 1e-9);
    return { missing, need, spend: Math.min(p.coins, need) };
  }

  function buyRepair(p) {
    if (state !== 'play' && state !== 'countdown') return;
    const { missing, spend } = repairInfo(p);
    if (missing <= 0 || spend <= 0) { p.deny.repair = 0.35; Sound.deny(cannonX(p)); return; }
    let pts = Math.min(missing, Math.round(spend / REPAIR_FULL * MASK_HP));
    const restored = pts;
    p.coins -= spend; p.btn.repair = 0.4; p.repairFx = 0.8; p.fresh.fill(0);
    // prima i mattoncini incrinati, poi quelli distrutti, in ordine casuale
    const shuffle = a => { for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; } return a; };
    const cracked = [], gone = [];
    for (let k = 0; k < p.bar.length; k++) if (MASK[k]) { if (p.bar[k] === 1) cracked.push(k); else if (p.bar[k] === 0) gone.push(k); }
    for (const k of shuffle(cracked)) { if (pts <= 0) break; p.bar[k] = 2; pts--; p.fresh[k] = 1; }
    for (const k of shuffle(gone)) { if (pts <= 0) break; const add = Math.min(2, pts); p.bar[k] = add; pts -= add; p.fresh[k] = 1; }
    const label = restored >= missing ? 'BARRIERA COMPLETA' : `+${Math.max(1, Math.round(restored / MASK_HP * 100))}% BARRIERA`;
    addPop(barrierX0(p) + DEPTH * CELL_X / 2 + p.dir * 110, W / 2, label, p.i, PL[p.i].c, true);
    Sound.repair(cannonX(p)); vibrate(25);
  }

  // ---------- collisioni ----------
  function hitBarrier(p, b) {
    const bx0 = barrierX0(p), bx1 = bx0 + DEPTH * CELL_X;
    if (b.x + b.r < bx0 || b.x - b.r > bx1) return false;
    const ch = W / ROWS;
    const r0 = Math.max(0, Math.floor((b.y - b.r) / ch)), r1 = Math.min(ROWS - 1, Math.floor((b.y + b.r) / ch));
    const c0 = Math.max(0, Math.floor((b.x - b.r - bx0) / CELL_X)), c1 = Math.min(DEPTH - 1, Math.floor((b.x + b.r - bx0) / CELL_X));
    let br = -1, bc = -1, best = Infinity;
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      if (p.bar[r * DEPTH + colToD(p, c)] <= 0) continue;
      const x0 = bx0 + c * CELL_X, y0 = r * ch;
      const nx = clamp(b.x, x0, x0 + CELL_X), ny = clamp(b.y, y0, y0 + ch);
      const d2 = (b.x - nx) ** 2 + (b.y - ny) ** 2;
      if (d2 <= b.r * b.r && d2 < best) { best = d2; br = r; bc = c; }
    }
    if (br < 0) return false;
    const R = b.rad * ch * 1.05;
    const hx = bx0 + (bc + 0.5) * CELL_X, hy = (br + 0.5) * ch;
    for (let r = Math.max(0, br - 4); r <= Math.min(ROWS - 1, br + 4); r++) for (let c = 0; c < DEPTH; c++) {
      const idx = r * DEPTH + colToD(p, c);
      if (p.bar[idx] <= 0) continue;
      if (r === br && c === bc) { p.bar[idx] = 0; continue; }
      const dist = Math.hypot(bx0 + (c + 0.5) * CELL_X - hx, (r + 0.5) * ch - hy);
      if (dist <= R) p.bar[idx] = Math.max(0, p.bar[idx] - (dist < R * 0.6 ? 2 : 1));
    }
    burst(hx, hy, PL[p.i].c, 12, 260, -p.dir, 5);
    burst(hx, hy, PL[b.o].c, 5, 200, -p.dir, 3);
    Sound.crack(hx);
    return true;
  }

  function hitCannon(p, b) {
    const cx = cannonX(p);
    const nx = clamp(b.x, cx - CANNON_T / 2, cx + CANNON_T / 2), ny = clamp(b.y, p.y - CANNON_LEN / 2, p.y + CANNON_LEN / 2);
    if ((b.x - nx) ** 2 + (b.y - ny) ** 2 > b.r * b.r) return false;
    const shooter = players[b.o];
    burst(b.x, b.y, PL[p.i].c, 30, 480); burst(b.x, b.y, '#ffffff', 14, 300);
    shake = Math.max(shake, 14); p.hitT = 0.4;
    if (!demo) {
      p.hp--; shooter.coins += 2; shooter.coinFx = 1;
      addPop(cx - p.dir * -90, p.y, '-1 VITA', p.i, '#ff5a5a', true);
      Sound.hit(cx); vibrate(80);
      if (p.hp <= 0) kill(p, shooter);
      else if (p.hp === 1) { Sound.alarm(cx); Sound.setMusicLevel(2); }
    }
    return true;
  }

  function scoreGoal(b) {
    const shooter = players[b.o], victim = players[1 - b.o];
    const wx = b.o === 0 ? PX1 : PX0;
    victim.goals.push({ y: b.y, t: 1, c: b.o });
    burst(wx, b.y, PL[b.o].c, 20, 320, -shooter.dir);
    burst(wx, b.y, GOLD, 8, 220, -shooter.dir, 4);
    if (!demo) {
      // niente raffiche di punti: chi ha segnato può sparare di nuovo solo dopo GOAL_LOCK secondi
      shooter.cd = Math.max(shooter.cd, GOAL_LOCK);
      shooter.coins++; shooter.coinFx = 1;
      addPop(wx - shooter.dir * 50, b.y, '+1', shooter.i, GOLD);
      Sound.score(wx);
    }
  }

  function kill(p, shooter) {
    state = 'over'; overT = 0; winner = shooter.i; wins[winner]++;
    const cx = cannonX(p);
    for (let k = 0; k < 5; k++) burst(cx, p.y + rnd(-50, 50), k % 2 ? '#ffffff' : PL[p.i].c, 60, 700, 0, 7);
    burst(cx, p.y, GOLD, 40, 500);
    for (const b of balls) burst(b.x, b.y, PL[b.o].c, 4, 120);
    balls = [];
    shake = 34; Sound.boom(cx); Sound.musicStop(0.3); vibrate([120, 60, 200]);
    setTimeout(() => { if (state === 'over') Sound.win(); }, 1300);
    setTimeout(showOver, 1500);
  }

  // ---------- aggiornamento ----------
  // =====================================================================
  // ---------- INTELLIGENZA ARTIFICIALE (giocatore 2 controllato dal computer) ----------
  // =====================================================================
  // Ogni "pensiero" l'IA:
  //  1. prevede la traiettoria di ogni colpo nemico (rimbalzi sulle sponde compresi) e capisce se
  //     verrà fermato dalla propria trincea, se colpirà il cannone o se finirà in fondo al campo;
  //  2. valuta tante posizioni possibili e sceglie la migliore: schiva i colpi pericolosi, si allinea
  //     per parare quelli che ha il tempo di intercettare, cerca i varchi nella trincea nemica
  //     (o scava sempre nello stesso punto per aprirne uno), mira al cannone avversario;
  //  3. gestisce le monete (potenza o riparazione) e, nel movimento libero, va a prendere il bonus.
  // I livelli cambiano reazione, precisione, velocità, attenzione e strategia; medio e difficile (parry >= 0.6) usano
  // anche le parate "ragionate" (contano i propri colpi in volo e si allineano per parare).
  // Taratura misurata con centinaia di partite simulate contro un "umano simulato" (reazione ~0,3 s, attenzione parziale):
  // il facile perde quasi sempre, il medio è alla pari, il difficile vince quasi sempre.
  const AI_LEVELS = {
    easy:   { think: 0.25, react: 0.3,  noise: 35, speed: 0.65, notice: 0.6,  duty: 1, offense: 0.7,  dig: 0.3, parry: 0.3, econ: 'easy',   bonus: 0.3, wander: 0.15 },
    medium: { think: 0.1,  react: 0.15, noise: 12, speed: 0.8,  notice: 0.9,  duty: 1, offense: 0.85, dig: 0.6, parry: 0.6, econ: 'medium', bonus: 0.7, wander: 0.05 },
    hard:   { think: 0.05, react: 0.08, noise: 5,  speed: 1.0,  notice: 1.0,  duty: 1, offense: 1.2,  dig: 1.0, parry: 1.0, econ: 'hard',   bonus: 1.0, wander: 0 },
  };

  // y dopo t secondi, con i rimbalzi sulle sponde
  function reflectY(y, vy, t, r) {
    const L = W - 2 * r;
    if (L <= 0) return y;
    let u = (y - r + vy * t) % (2 * L);
    if (u < 0) u += 2 * L;
    if (u > L) u = 2 * L - u;
    return u + r;
  }
  function yAtX(b, x) {
    if (b.vx === 0) return null;
    const t = (x - b.x) / b.vx;
    if (t < 0) return null;
    return { t, y: reflectY(b.y, b.vy, t, b.r) };
  }
  const rowAt = y => clamp(Math.floor(y / (W / ROWS)), 0, ROWS - 1);

  // il colpo b verrà fermato dalla trincea di p?
  function blockedBy(p, b) {
    const bx0 = barrierX0(p);
    for (let k = 0; k < DEPTH; k++) {
      const c = b.vx > 0 ? k : DEPTH - 1 - k;                        // colonne nell'ordine in cui le incontra
      const at = yAtX(b, bx0 + (c + 0.5) * CELL_X);
      if (!at) continue;
      for (const dy of [-b.r * 0.7, 0, b.r * 0.7]) {
        if (p.bar[rowAt(at.y + dy) * DEPTH + colToD(p, c)] > 0) return true;
      }
    }
    return false;
  }

  // quanto è libera la riga y nella trincea di p (1 = varco aperto, 0 = muro pieno)
  function openness(p, y, r) {
    let hp = 0, max = 0;
    for (const yy of [y - r * 0.7, y, y + r * 0.7]) {
      const row = rowAt(yy);
      for (let d = 0; d < DEPTH; d++) { const idx = row * DEPTH + d; if (MASK[idx]) { max += 2; hp += p.bar[idx]; } }
    }
    return { clear: hp === 0, open: max ? 1 - hp / max : 1 };
  }

  // un mio colpo già in volo incrocerà (e annullerà) il colpo nemico b prima che arrivi?
  // budget: forza residua di ogni mio colpo, così un colpo non viene "speso" due volte
  function parriedByMine(p, b, budget) {
    for (const o of balls) {
      if (o.o !== p.i) continue;
      const left = budget.has(o) ? budget.get(o) : o.str;
      if (left < b.str) continue;
      const rel = o.vx - b.vx;
      if (rel === 0) continue;
      const tm = (b.x - o.x) / rel;                                     // istante in cui hanno la stessa x
      if (tm < 0 || tm > 3) continue;
      const yo = reflectY(o.y, o.vy, tm, o.r), yb = reflectY(b.y, b.vy, tm, b.r);
      if (Math.abs(yo - yb) < PARRY * 0.8) { budget.set(o, left - b.str); return true; }
    }
    return false;
  }

  function cpuEconomy(p, L) {
    const ratio = barrierRatio(p), info = repairInfo(p);
    const pc = p.lvl < MAXLVL ? powerCost(p.lvl) : Infinity;
    if (L.econ === 'hard') {
      // ripara quando la trincea è messa male e le monete bastano per una riparazione utile;
      // altrimenti investe in potenza, ma tiene da parte qualcosa se la trincea cede
      if (ratio < 0.55 && info.spend >= Math.min(info.need, 5)) return buyRepair(p);
      if (p.coins >= pc && (ratio > 0.45 || p.lvl < 3) && p.coins - pc >= (ratio < 0.7 ? 2 : 0)) return buyPower(p);
    } else if (L.econ === 'medium') {
      if (ratio < 0.4 && p.coins >= 5) return buyRepair(p);
      if (p.lvl < 4 && p.coins >= pc) return buyPower(p);
    } else {
      if (ratio < 0.25 && p.coins >= 3 && Math.random() < 0.5) return buyRepair(p);
      if (p.coins >= pc && Math.random() < 0.15) return buyPower(p);
    }
  }

  function cpuControl(p, dt) {
    const lv = p.cpuLevel || cpuLevel, L = AI_LEVELS[lv] || AI_LEVELS.medium, ai = p.ai;
    const foe = players[1 - p.i];
    ai.think -= dt; ai.econT = (ai.econT || 0) - dt; ai.fireT = (ai.fireT || 0) - dt;
    // fuoco: raffiche più o meno continue a seconda del livello
    if (ai.fireT <= 0) { ai.fireOn = Math.random() < L.duty; ai.fireT = rnd(0.4, 1.2); }
    if (ai.econT <= 0 && state === 'play') { ai.econT = rnd(0.8, 1.4); cpuEconomy(p, L); }
    if (ai.think > 0) return;
    ai.think = L.think * rnd(0.8, 1.2);

    const half = CANNON_LEN / 2 + 4, speed = 2400 * L.speed * (moveMode === 'free' ? FREE_SPEED : 1);
    const frontX = p.x + p.dir * (CANNON_T / 2), backX = p.x - p.dir * (CANNON_T / 2);   // lati del cannone (davanti = verso il nemico)
    const myStr = LEVELS[p.lvl].str;

    // 1) minacce: colpi nemici visti (dopo il tempo di reazione) e notati (attenzione del livello)
    if (!ai.seen) ai.seen = new WeakMap();
    const threats = [], budget = new Map();
    const incoming = balls.filter(b => b.o !== p.i && b.vx * p.dir < 0).sort((u, v) => Math.abs(u.x - p.x) - Math.abs(v.x - p.x));
    for (const b of incoming) {
      // prima il conto delle parate su TUTTE le palle in arrivo (anche quelle dirette alla trincea o al fondo),
      // perché ognuna consuma i miei colpi in volo che incontra
      const parried = L.parry >= 0.6 && parriedByMine(p, b, budget);
      if (parried || (time - (b.born || 0)) < L.react) continue;
      let info = ai.seen.get(b);
      if (!info) { info = { noticed: Math.random() < L.notice, noise: rnd(-L.noise, L.noise) }; ai.seen.set(b, info); }
      if (!info.noticed) continue;
      const hit = yAtX(b, frontX);
      if (!hit || hit.t > 3) continue;
      // un colpo inclinato può entrare lungo il fianco: considera la y su tutto lo spessore del cannone
      const back = yAtX(b, backX) || hit;
      const ylo = Math.min(hit.y, back.y), yhi = Math.max(hit.y, back.y);
      // nel movimento libero il cannone può essere davanti alla propria trincea: allora non lo protegge
      const exposed = moveMode === 'free' && (p.dir > 0
        ? p.x - CANNON_T / 2 > barrierX0(p) + DEPTH * CELL_X
        : p.x + CANNON_T / 2 < barrierX0(p));
      if (!exposed && blockedBy(p, b)) continue;
      threats.push({ y: hit.y + info.noise, ylo: ylo + info.noise, yhi: yhi + info.noise, t: hit.t, r: b.r, str: b.str });
    }

    // 2) bonus (movimento libero): ci va se conviene ed è sicuro
    let goBonus = false;
    if (moveMode === 'free' && bonus && Math.random() < L.bonus + 0.2) {
      const near = threats.some(th => th.t < 0.8);
      const foeDist = Math.hypot(foe.x - bonus.x, foe.y - bonus.y), myDist = Math.hypot(p.x - bonus.x, p.y - bonus.y);
      goBonus = !near && (lv !== 'easy' || bonus.age > 5) && (lv === 'hard' ? myDist < foeDist * 1.6 + 200 : true);
    }

    // 3) valuta le posizioni candidate
    let bestY = p.y, best = -Infinity;
    const focusOk = ai.focus != null && openness(foe, ai.focus, 9).open < 1;
    for (let y = half; y <= W - half; y += 14) {
      let sc = 0;
      // pericolo e parate
      for (const th of threats) {
        const reach = Math.abs(y - p.y) / speed;
        // dove sarà il cannone quando arriva il colpo, andando verso y (conta anche il tragitto)
        const at = p.y + Math.sign(y - p.y) * Math.min(Math.abs(y - p.y), speed * Math.max(0, th.t - L.think * 0.5));
        const gapLo = th.ylo - (at + CANNON_LEN / 2), gapHi = (at - CANNON_LEN / 2) - th.yhi;
        const over = Math.max(gapLo, gapHi) < th.r + 10;
        // allinearsi per parare conviene solo se c'è il tempo di arrivare e sparare, con un colpo abbastanza forte
        // (solo se è già quasi allineato: sparando mentre corre il colpo prende effetto e manca la palla)
        const aligned = Math.abs(y - th.y) < 14 && Math.abs(p.y - th.y) < 30 && th.str <= myStr && L.parry > 0.5 && th.t > Math.max(0, p.cd) + 0.3;
        if (over) sc -= aligned ? 70 : (260 / (th.t + 0.2)) * (reach > th.t ? 1.6 : 1);
        else if (Math.abs(y - th.y) < PARRY * 0.7 && th.t > 0.35 + reach) sc += 22 * L.parry;   // paro un colpo diretto al fondo
      }
      // attacco: varchi nella trincea nemica, cannone nemico, scavo
      const op = openness(foe, y, 9);
      if (op.clear) sc += 32 * L.offense + (Math.abs(y - foe.y) < CANNON_LEN / 2 ? 45 * L.offense : 0);
      else sc += 14 * L.dig * op.open * L.offense;
      if (focusOk && Math.abs(y - ai.focus) < 20) sc += 10 * L.dig;
      // copertura della propria trincea davanti al cannone
      // movimento: meglio non spostarsi troppo
      sc -= Math.abs(y - p.y) * 0.025;
      if (goBonus) sc -= Math.abs(y - bonus.y) * 0.2;
      if (sc > best) { best = sc; bestY = y; }
    }
    // al livello facile ogni tanto vaga senza meta
    if (Math.random() < L.wander * L.think) bestY = rnd(half, W - half);
    if (best > 20 && !threats.some(th => Math.abs(bestY - th.y) < CANNON_LEN)) ai.focus = bestY;

    p.ty = clamp(bestY + rnd(-L.noise, L.noise) * 0.3, half, W - half);
    if (moveMode === 'free') {
      const [xa, xb] = xRange(p);
      p.tx = goBonus ? clamp(bonus.x, xa, xb) : homeX(p.i);
    }
    // spara se il livello lo prevede; al difficile evita di sparare mentre corre (il colpo andrebbe storto),
    // a meno che serva a parare
    const needParry = threats.some(th => th.t > 0.2 && (Math.abs(th.y - p.y) < PARRY || Math.abs(th.y - p.ty) < PARRY));
    p.cpuFire = ai.fireOn && (lv !== 'hard' || Math.abs(p.vy) < 450 || needParry);
  }

  const CPU_NAME = { easy: 'FACILE', medium: 'MEDIO', hard: 'DIFFICILE' };

  function updatePlayer(p, dt, canFire) {
    const half = CANNON_LEN / 2 + 4;
    const [xa, xb] = xRange(p);
    if (p.cpu && state === 'play') cpuControl(p, dt);
    if (demo) {
      p.ai.t -= dt;
      if (p.ai.t <= 0) { p.ai.tgt = rnd(half, W - half); p.ai.tgx = rnd(xa, xa + (xb - xa) * 0.6); p.ai.t = rnd(0.5, 1.8); }
      p.ty = p.ai.tgt; p.tx = p.ai.tgx;
    }
    const prevY = p.y;
    const k = (p.kDown ? 1 : 0) - (p.kUp ? 1 : 0);
    const kx = ((p.kFwd ? 1 : 0) - (p.kBack ? 1 : 0)) * p.dir;
    const sp = moveMode === 'free' ? FREE_SPEED : 1;
    if (k || kx) {
      p.y += k * 1050 * sp * dt; p.ty = p.y;
      p.x += kx * 900 * sp * dt; p.tx = p.x;
    } else {
      // segue il bersaglio con velocità massima (vettoriale, così in diagonale non va più veloce)
      const m = (demo ? 700 : 2400 * (p.cpu ? (AI_LEVELS[p.cpuLevel || cpuLevel] || AI_LEVELS.medium).speed : 1)) * sp * dt, dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
      if (d > m) { p.x += dx / d * m; p.y += dy / d * m; } else { p.x = p.tx; p.y = p.ty; }
    }
    p.y = clamp(p.y, half, W - half); p.ty = clamp(p.ty, half, W - half);
    p.x = clamp(p.x, xa, xb); p.tx = clamp(p.tx, xa, xb);
    p.rapid = Math.max(0, p.rapid - dt);
    p.vy = lerp(p.vy, (p.y - prevY) / Math.max(dt, 1e-3), 0.35);
    p.cd -= dt;
    const manual = !demo && fireMode === 'manual' && !p.cpu;
    const firing = demo || (p.cpu ? p.cpuFire : manual ? p.queued > 0 : p.touches.size > 0 || p.kFire);
    if (canFire && firing && p.cd <= 0) {
      fire(p);
      p.queued = 0;
      p.cd = LEVELS[p.lvl].cd * (manual ? 0.75 : 1) * (p.rapid > 0 ? 0.45 : 1) * (!demo && rateMode === 'slow' ? SLOW_FIRE : 1) + (demo ? rnd(0.1, 0.6) : 0);
    }
    p.queued = Math.max(0, p.queued - dt);
    // fumo e scintille in base ai danni
    const dmg = damageOf(p);
    if (dmg > 0 && state !== 'over' && Math.random() < dmg * dt * 16) {
      parts.push({ x: cannonX(p) + rnd(-10, 10), y: p.y + rnd(-CANNON_LEN / 2, CANNON_LEN / 2), vx: p.dir * rnd(10, 40), vy: rnd(-25, 25),
        life: rnd(0.8, 1.6), max: 1.6, c: dmg > 0.6 ? '40,40,48' : '110,110,125', s: rnd(8, 14), smoke: true });
    }
    if (!demo && p.hp === 1 && state === 'play' && Math.random() < dt * 5) {
      burst(cannonX(p) + p.dir * rnd(0, 12), p.y + rnd(-CANNON_LEN / 2, CANNON_LEN / 2), Math.random() < 0.5 ? GOLD : '#ff7a3a', 6, 220, 0, 3);
    }
    if (demo && barrierRatio(p) < 0.35) { for (let i = 0; i < p.bar.length; i++) p.bar[i] = MASK[i] * 2; p.repairFx = 0.7; }
    p.recoil = Math.max(0, p.recoil - dt * 7);
    p.hitT = Math.max(0, p.hitT - dt);
    p.repairFx = Math.max(0, p.repairFx - dt);
    if (p.repairFx === 0 && !demo) p.fresh.fill(0);
    p.coinFx = Math.max(0, p.coinFx - dt * 3);
    for (const key of ['power', 'repair']) { p.btn[key] = Math.max(0, p.btn[key] - dt); p.deny[key] = Math.max(0, p.deny[key] - dt); }
    for (const g of p.goals) g.t -= dt * 1.6;
    p.goals = p.goals.filter(g => g.t > 0);
  }

  // ---------- bonus (modalità libera) ----------
  function spawnBonus() {
    const opts = ['coins', 'rapid'];
    for (const p of players) {
      if (p.hp < maxHp) opts.push('life');
      if (p.lvl < MAXLVL) opts.push('power');
      if (barrierRatio(p) < 0.85) opts.push('barrier');
    }
    const type = opts[Math.floor(Math.random() * opts.length)];
    bonus = { x: MID, y: W / 2, type, age: 0 };
    burst(MID, W / 2, BONUSES[type].c, 40, 420); burst(MID, W / 2, '#ffffff', 16, 300);
    Sound.bonusSpawn();
  }

  function takeBonus(p) {
    const b = bonus, def = BONUSES[b.type];
    bonus = null;
    if (b.type === 'coins') { p.coins += 5; p.coinFx = 1; }
    else if (b.type === 'life') { p.hp = Math.min(maxHp, p.hp + 1); if (players.every(q => q.hp > 1)) Sound.setMusicLevel(1); }
    else if (b.type === 'barrier') { for (let k = 0; k < p.bar.length; k++) { if (MASK[k] && p.bar[k] < 2) p.fresh[k] = 1; p.bar[k] = MASK[k] * 2; } p.repairFx = 0.8; }
    else if (b.type === 'power') { if (p.lvl < MAXLVL) p.lvl++; else { p.coins += 5; p.coinFx = 1; } }
    else if (b.type === 'rapid') p.rapid = RAPID_T;
    burst(b.x, b.y, def.c, 50, 520); burst(b.x, b.y, '#ffffff', 20, 360);
    addPop(p.x + p.dir * 120, p.y, `${def.icon} ${def.label}`, p.i, def.c, true);
    shake = Math.max(shake, 8);
    Sound.bonusTake(b.x); vibrate(40);
  }

  function updateBonus(dt) {
    if (moveMode !== 'free' || demo) return;
    if (state !== 'play') return;
    bonusTimer += dt;
    if (!bonus && bonusTimer >= BONUS_EVERY) { bonusTimer = 0; spawnBonus(); }
    if (!bonus) return;
    bonus.age += dt;
    if (bonus.age > BONUS_LIFE) { burst(bonus.x, bonus.y, '#888899', 20, 200); bonus = null; return; }
    for (const p of players) {
      const nx = clamp(bonus.x, p.x - CANNON_T / 2, p.x + CANNON_T / 2), ny = clamp(bonus.y, p.y - CANNON_LEN / 2, p.y + CANNON_LEN / 2);
      if ((bonus.x - nx) ** 2 + (bonus.y - ny) ** 2 <= BONUS_R * BONUS_R) { takeBonus(p); return; }
    }
  }

  function updateBalls(dt) {
    for (let k = balls.length - 1; k >= 0; k--) {
      const b = balls[k];
      b.trail.push(b.x, b.y); if (b.trail.length > 22) b.trail.splice(0, 2);
      const foe = players[1 - b.o];
      const n = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 7)), h = dt / n;
      let dead = false;
      for (let s = 0; s < n && !dead; s++) {
        b.x += b.vx * h; b.y += b.vy * h;
        if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy); Sound.wall(b.x); burst(b.x, 0, '#ffffff', 3, 120); }
        else if (b.y > W - b.r) { b.y = W - b.r; b.vy = -Math.abs(b.vy); Sound.wall(b.x); burst(b.x, W, '#ffffff', 3, 120); }
        if (hitBarrier(foe, b) || hitCannon(foe, b)) dead = true;
        else if ((b.o === 0 && b.x > PX1 + b.r) || (b.o === 1 && b.x < PX0 - b.r)) { scoreGoal(b); dead = true; }
        if (state === 'over') return;
      }
      if (dead) balls.splice(k, 1);
    }
    // scontro tra colpi avversari: si annullano (il più forte sopravvive indebolito)
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i]; if (a.str <= 0) continue;
      for (let j = i + 1; j < balls.length; j++) {
        const c = balls[j]; if (c.o === a.o || c.str <= 0) continue;
        // parata facile: basta che i colpi passino entro un quadrato di 2x2 quadratini della griglia
        if (Math.abs(a.x - c.x) < PARRY && Math.abs(a.y - c.y) < PARRY) {
          const m = Math.min(a.str, c.str); a.str -= m; c.str -= m;
          const mx = (a.x + c.x) / 2, my = (a.y + c.y) / 2;
          flashes.push({ x: mx, y: my, x1: a.x, y1: a.y, x2: c.x, y2: c.y, t: VORTEX_T, rot: Math.random() * 6.28, spin: Math.random() < 0.5 ? -1 : 1 });
          // scintille che vorticano attorno al punto d'impatto
          for (let q = 0; q < 26 && parts.length < 900; q++) {
            const ang = Math.random() * Math.PI * 2, rad = rnd(8, 40), sp = rnd(160, 360);
            parts.push({ x: mx + Math.cos(ang) * rad, y: my + Math.sin(ang) * rad,
              vx: -Math.sin(ang) * sp + Math.cos(ang) * 60, vy: Math.cos(ang) * sp + Math.sin(ang) * 60,
              life: rnd(0.3, 0.6), max: 0.6, c: q % 3 === 0 ? '#ffffff' : PL[q % 2].c, s: rnd(2, 5) });
          }
          Sound.clash(mx);
          if (a.str <= 0) break;
        }
      }
    }
    balls = balls.filter(b => b.str > 0);
  }

  function updateFx(dt) {
    for (const q of parts) {
      q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt;
      if (q.smoke) { q.vx *= 1 - 0.8 * dt; q.vy *= 1 - 0.8 * dt; q.s += 14 * dt; }
      else { q.vx *= 1 - 3 * dt; q.vy *= 1 - 3 * dt; }
    }
    parts = parts.filter(q => q.life > 0);
    for (const q of pops) { q.x += (q.i === 0 ? 1 : -1) * 45 * dt; q.life -= dt; }
    pops = pops.filter(q => q.life > 0);
    for (const f of flashes) f.t -= dt;
    flashes = flashes.filter(f => f.t > 0);
    shake = Math.max(0, shake - shake * 7 * dt - 2 * dt);
  }

  function update(dt) {
    time += dt;
    if (state === 'paused') return;
    for (const p of players) updatePlayer(p, dt, state === 'play' || state === 'menu');
    if (state === 'countdown') {
      const prev = Math.ceil(countdown);
      countdown -= dt;
      if (countdown <= 0) { state = 'play'; goT = 0.8; Sound.go(); }
      else if (Math.ceil(countdown) !== prev) Sound.tick();
    }
    goT = Math.max(0, goT - dt);
    if (state === 'over') overT += dt;
    if (state === 'play' || state === 'menu') updateBalls(dt);
    updateBonus(dt);
    updateFx(dt);
  }

  // ---------- disegno ----------
  function drawBackground() {
    if (HIST) return drawBackgroundHist();
    bgx.setTransform(1, 0, 0, 1, 0, 0);
    bgx.fillStyle = '#05060f'; bgx.fillRect(0, 0, bg.width, bg.height);
    setField(bgx);
    // campo
    bgx.fillStyle = '#080a1c'; bgx.fillRect(PX0, 0, PX1 - PX0, W);
    const g = bgx.createLinearGradient(PX0, 0, PX1, 0);
    g.addColorStop(0, `rgba(${PL[0].rgb},0.13)`); g.addColorStop(0.42, 'rgba(0,0,0,0)');
    g.addColorStop(0.58, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(${PL[1].rgb},0.13)`);
    bgx.fillStyle = g; bgx.fillRect(PX0, 0, PX1 - PX0, W);
    // griglia
    bgx.strokeStyle = 'rgba(140,160,255,0.06)'; bgx.lineWidth = 1.5;
    bgx.beginPath();
    for (let x = MID % GRID; x < PX1; x += GRID) if (x > PX0) { bgx.moveTo(x, 0); bgx.lineTo(x, W); }
    for (let y = (W / 2) % GRID; y < W; y += GRID) { bgx.moveTo(PX0, y); bgx.lineTo(PX1, y); }
    bgx.stroke();
    // linea centrale tratteggiata e cerchio
    bgx.save();
    bgx.setLineDash([22, 18]); bgx.strokeStyle = 'rgba(255,255,255,0.2)'; bgx.lineWidth = 5;
    bgx.beginPath(); bgx.moveTo(MID, 0); bgx.lineTo(MID, W); bgx.stroke();
    bgx.setLineDash([]); bgx.strokeStyle = 'rgba(255,255,255,0.08)'; bgx.lineWidth = 3;
    bgx.beginPath(); bgx.arc(MID, W / 2, 90, 0, Math.PI * 2); bgx.stroke();
    bgx.restore();
    // sponde laterali
    bgx.save();
    bgx.shadowBlur = 16 * glowK(); bgx.shadowColor = '#a8b4ff';
    bgx.strokeStyle = 'rgba(200,210,255,0.6)'; bgx.lineWidth = 4;
    bgx.beginPath(); bgx.moveTo(PX0, 2); bgx.lineTo(PX1, 2); bgx.moveTo(PX0, W - 2); bgx.lineTo(PX1, W - 2); bgx.stroke();
    // linee di fondo
    for (const i of [0, 1]) {
      const x = i === 0 ? PX0 : PX1;
      bgx.shadowColor = PL[i].c; bgx.strokeStyle = PL[i].c; bgx.lineWidth = 5;
      bgx.beginPath(); bgx.moveTo(x, 0); bgx.lineTo(x, W); bgx.stroke();
    }
    bgx.restore();
    // fasce HUD
    for (const i of [0, 1]) {
      const x0 = i === 0 ? 0 : PX1;
      const hg = bgx.createLinearGradient(i === 0 ? 0 : T, 0, i === 0 ? HUD : PX1, 0);
      hg.addColorStop(0, `rgba(${PL[i].rgb},0.22)`); hg.addColorStop(1, `rgba(${PL[i].rgb},0.04)`);
      bgx.fillStyle = hg; bgx.fillRect(x0, 0, HUD, W);
    }
    // vignetta
    bgx.setTransform(1, 0, 0, 1, 0, 0);
    const vg = bgx.createRadialGradient(bg.width / 2, bg.height / 2, Math.min(bg.width, bg.height) * 0.3,
      bg.width / 2, bg.height / 2, Math.max(bg.width, bg.height) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)');
    bgx.fillStyle = vg; bgx.fillRect(0, 0, bg.width, bg.height);
  }

  function drawGoals() {
    if (HIST) return drawGoalsHist();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of players) for (const g of p.goals) {
      const x = p.i === 0 ? PX0 : PX1;
      ctx.globalAlpha = g.t;
      ctx.drawImage(glow[g.c], x - 70, g.y - 110, 140, 220);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  function drawBarriers() {
    const ch = W / ROWS;
    if (HIST) {   // le trincee sono nel livello in cache (updateBarLayer); qui solo il lampo della riparazione
      for (const p of players) {
        if (p.repairFx <= 0) continue;
        const bx0 = barrierX0(p);
        ctx.fillStyle = `rgba(255,250,220,${p.repairFx * 0.9})`;
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < DEPTH; c++) {
          const idx = r * DEPTH + colToD(p, c);
          if (p.bar[idx] > 0 && (demo || p.fresh[idx])) ctx.fillRect(bx0 + c * CELL_X + 1, r * ch + 1, CELL_X - 2, ch - 2);
        }
      }
      return;
    }
    for (const p of players) {
      const bx0 = barrierX0(p), pl = PL[p.i];
      const full = new Path2D(), weak = new Path2D(), fresh = new Path2D();
      const allFresh = demo;
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < DEPTH; c++) {
        const idx = r * DEPTH + colToD(p, c), hp = p.bar[idx];
        if (hp <= 0) continue;
        const x = bx0 + c * CELL_X + 1, y = r * ch + 1;
        (hp >= 2 ? full : weak).rect(x, y, CELL_X - 2, ch - 2);
        if (allFresh || p.fresh[idx]) fresh.rect(x, y, CELL_X - 2, ch - 2);
      }
      ctx.save();
      ctx.shadowColor = pl.c; ctx.shadowBlur = 12 * glowK();
      ctx.fillStyle = `rgba(${pl.rgb},0.88)`; ctx.fill(full);
      ctx.shadowBlur = 0;
      ctx.fillStyle = `rgba(${pl.rgb},0.3)`; ctx.fill(weak);
      ctx.strokeStyle = `rgba(${pl.rgb},0.7)`; ctx.lineWidth = 1; ctx.stroke(weak);
      if (p.repairFx > 0) { ctx.fillStyle = `rgba(255,255,255,${p.repairFx * 0.9})`; ctx.fill(fresh); }
      ctx.restore();
    }
  }

  function drawCannons() {
    for (const p of players) {
      if (state === 'over' && p.i !== winner && overT > 0) continue;
      if (HIST) { drawCannonHist(p); continue; }
      const pl = PL[p.i], cx = cannonX(p) - p.dir * p.recoil * 7;
      ctx.save();
      ctx.translate(cx, p.y);
      const dmg = damageOf(p);
      const last = !demo && p.hp === 1;
      // all'ultima vita il cannone pulsa di rosso
      if (last) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.35 + 0.35 * Math.sin(time * 9);
        ctx.drawImage(glow[1], -90, -CANNON_LEN, 180, CANNON_LEN * 2);
        ctx.restore();
      }
      if (p.rapid > 0) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.4 + 0.3 * Math.sin(time * 16);
        ctx.drawImage(glow[1], -70, -CANNON_LEN * 0.9, 140, CANNON_LEN * 1.8);
        ctx.drawImage(glow[0], -40, -CANNON_LEN * 0.7, 80, CANNON_LEN * 1.4);
        ctx.restore();
      }
      // il colore si spegne con i danni
      const glowA = 1 - dmg * 0.75;
      const g = ctx.createLinearGradient(-p.dir * CANNON_T / 2, 0, p.dir * CANNON_T / 2, 0);
      g.addColorStop(0, '#0b0e22'); g.addColorStop(1, `rgba(${pl.rgb},${0.35 + 0.65 * glowA})`);
      ctx.shadowColor = pl.c; ctx.shadowBlur = 22 * glowK() * glowA;
      // canna: con molti danni si storta
      ctx.save();
      if (dmg >= 0.5) ctx.rotate(p.dir * (dmg - 0.4) * 0.35);
      ctx.fillStyle = dmg >= 0.5 ? `rgba(${pl.rgb},0.6)` : pl.c;
      rr(ctx, p.dir > 0 ? CANNON_T / 2 - 4 : -CANNON_T / 2 - 14, -13, 18, 26, 6); ctx.fill();
      ctx.restore();
      // corpo
      ctx.fillStyle = '#2a2d3a'; rr(ctx, -CANNON_T / 2, -CANNON_LEN / 2, CANNON_T, CANNON_LEN, 11); ctx.fill();
      ctx.fillStyle = g; ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = `rgba(255,255,255,${0.75 - dmg * 0.4})`; ctx.lineWidth = 2; ctx.stroke();
      // nucleo luminoso: si accorcia con le vite
      if (!demo) {
        const frac = p.hp / maxHp;
        const flick = last ? 0.35 + 0.65 * Math.abs(Math.sin(time * 14)) : dmg >= 0.5 ? 0.75 + 0.25 * Math.sin(time * 9) : 1;
        ctx.fillStyle = last ? `rgba(255,90,90,${flick})` : `rgba(255,255,255,${0.85 * flick})`;
        const len = (CANNON_LEN - 26) * frac;
        rr(ctx, -3, -len / 2, 6, Math.max(len, 1), 3); ctx.fill();
      }
      // danni: pezzi mancanti e crepe, sempre di più fino al limite
      const shown = Math.round(dmg * p.marks.length);
      if (shown > 0) {
        ctx.save();
        rr(ctx, -CANNON_T / 2 - 3, -CANNON_LEN / 2 - 3, CANNON_T + 6, CANNON_LEN + 6, 12); ctx.clip();
        for (let k = 0; k < shown; k++) {
          const m = p.marks[k];
          ctx.fillStyle = '#05060f';
          ctx.beginPath(); ctx.arc(m.side * CANNON_T / 2, m.y, m.r * (0.8 + dmg * 0.6), 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = 'rgba(10,10,20,0.9)'; ctx.lineWidth = 2;
          ctx.beginPath(); m.crack.forEach(([x, y], j) => j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
          ctx.strokeStyle = `rgba(255,170,90,${0.25 + 0.5 * dmg})`; ctx.lineWidth = 0.8; ctx.stroke();
        }
        ctx.restore();
      }
      if (p.hitT > 0) {
        ctx.fillStyle = `rgba(255,255,255,${p.hitT / 0.4})`;
        rr(ctx, -CANNON_T / 2 - 4, -CANNON_LEN / 2 - 4, CANNON_T + 8, CANNON_LEN + 8, 13); ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawBalls() {
    if (HIST) return drawBallsHist();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const b of balls) {
      const t = b.trail, n = t.length / 2;
      for (let k = 1; k < n; k++) {
        const f = k / n;
        ctx.strokeStyle = `rgba(${PL[b.o].rgb},${0.45 * f})`;
        ctx.lineWidth = b.r * 1.5 * f;
        ctx.beginPath(); ctx.moveTo(t[k * 2 - 2], t[k * 2 - 1]); ctx.lineTo(t[k * 2], t[k * 2 + 1]); ctx.stroke();
      }
      const gs = b.r * (5 + b.str);
      ctx.drawImage(glow[b.o], b.x - gs / 2, b.y - gs / 2, gs, gs);
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const b of balls) {
      ctx.fillStyle = PL[b.o].c;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.55, 0, Math.PI * 2); ctx.fill();
    }
  }

  // vortice elettrico tra due colpi che si sono parati
  function jagged(x1, y1, x2, y2, amp, segs) {
    ctx.beginPath(); ctx.moveTo(x1, y1);
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
    for (let k = 1; k < segs; k++) {
      const f = k / segs, o = rnd(-amp, amp);
      ctx.lineTo(x1 + dx * f + nx * o, y1 + dy * f + ny * o);
    }
    ctx.lineTo(x2, y2);
  }

  function drawFlashes() {
    if (!flashes.length) return;
    if (HIST) return drawFlashesHist();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const f of flashes) {
      const k = f.t / VORTEX_T, age = 1 - k;              // k: 1 -> 0
      const R = 18 + 62 * (1 - Math.pow(1 - age, 3));     // il vortice si allarga
      const rot = f.rot + f.spin * age * 14;              // e gira veloce
      // alone
      ctx.globalAlpha = 0.55 * k;
      ctx.drawImage(glow[0], f.x - R * 1.6, f.y - R * 1.6, R * 3.2, R * 3.2);
      ctx.drawImage(glow[1], f.x - R * 1.3, f.y - R * 1.3, R * 2.6, R * 2.6);
      ctx.globalAlpha = 1;
      // bracci a spirale di fulmini, ridisegnati con rumore a ogni frame
      const arms = 5;
      for (let a = 0; a < arms; a++) {
        const col = a % 2 ? PL[1].rgb : PL[0].rgb;
        ctx.beginPath();
        for (let st = 0; st <= 12; st++) {
          const r = (st / 12) * R;
          const ang = rot + a * (Math.PI * 2 / arms) + f.spin * r * 0.055 + rnd(-0.18, 0.18);
          const jr = r + rnd(-4, 4);
          const px = f.x + Math.cos(ang) * jr, py = f.y + Math.sin(ang) * jr;
          st ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.strokeStyle = `rgba(${col},${0.85 * k})`; ctx.lineWidth = 2 + 4 * k; ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${0.9 * k})`; ctx.lineWidth = 1 + 1.2 * k; ctx.stroke();
      }
      // anello elettrico esterno
      ctx.beginPath();
      for (let st = 0; st <= 28; st++) {
        const ang = rot * 0.6 + (st / 28) * Math.PI * 2, r = R + rnd(-6, 6);
        const px = f.x + Math.cos(ang) * r, py = f.y + Math.sin(ang) * r;
        st ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.strokeStyle = `rgba(190,220,255,${0.5 * k})`; ctx.lineWidth = 1.5; ctx.stroke();
      // nei primi istanti: arco elettrico tra i due colpi
      if (age < 0.4) {
        const ka = 1 - age / 0.4;
        jagged(f.x1, f.y1, f.x2, f.y2, 14, 9);
        ctx.strokeStyle = `rgba(255,255,255,${ka})`; ctx.lineWidth = 2.5; ctx.stroke();
        jagged(f.x1, f.y1, f.x2, f.y2, 22, 7);
        ctx.strokeStyle = `rgba(160,140,255,${0.7 * ka})`; ctx.lineWidth = 1.5; ctx.stroke();
      }
      // fulmini che scappano verso l'esterno
      if (Math.random() < 0.7 * k) {
        const ang = Math.random() * Math.PI * 2, r2 = R + rnd(10, 45);
        jagged(f.x, f.y, f.x + Math.cos(ang) * r2, f.y + Math.sin(ang) * r2, 8, 6);
        ctx.strokeStyle = `rgba(255,255,255,${0.8 * k})`; ctx.lineWidth = 1.5; ctx.stroke();
      }
      // nucleo
      ctx.fillStyle = `rgba(255,255,255,${0.9 * k})`;
      ctx.beginPath(); ctx.arc(f.x, f.y, 4 + 6 * k, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawBonus() {
    if (moveMode !== 'free' || demo) return;
    // anello che si riempie fino al prossimo bonus
    if (!bonus && (state === 'play' || state === 'paused')) {
      const f = bonusTimer / BONUS_EVERY;
      ctx.save();
      ctx.strokeStyle = HIST ? 'rgba(59,42,23,0.15)' : 'rgba(255,211,77,0.12)'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(MID, W / 2, 90, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = `rgba(${HIST ? '120,80,30' : '255,211,77'},${0.35 + 0.4 * (f > 0.9 ? Math.abs(Math.sin(time * 8)) : 0)})`;
      ctx.beginPath(); ctx.arc(MID, W / 2, 90, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    if (!bonus) return;
    const def = BONUSES[bonus.type];
    const appear = Math.min(1, bonus.age / 0.35), leftT = BONUS_LIFE - bonus.age;
    if (leftT < 4 && Math.sin(time * 20) < 0) return;          // lampeggia prima di sparire
    const R = BONUS_R * (0.4 + 0.6 * appear) * (1 + 0.07 * Math.sin(time * 6));
    ctx.save();
    ctx.translate(bonus.x, bonus.y);
    if (HIST) {
      drawBonusCrate(def, R);
      ctx.font = `${Math.round(R * 0.85)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(def.icon, 0, 2);
      ctx.restore();
      return;
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.7;
    ctx.drawImage(glow[0], -R * 2.6, -R * 2.6, R * 5.2, R * 5.2);
    ctx.drawImage(glow[1], -R * 2, -R * 2, R * 4, R * 4);
    ctx.globalAlpha = 1;
    // particelle in orbita
    for (let k = 0; k < 8; k++) {
      const a = time * 2.2 + k * Math.PI / 4, r = R * 1.55;
      ctx.fillStyle = k % 2 ? def.c : '#ffffff';
      ctx.fillRect(Math.cos(a) * r - 2.5, Math.sin(a) * r - 2.5, 5, 5);
    }
    ctx.globalCompositeOperation = 'source-over';
    // esagono rotante
    ctx.rotate(time * 1.4);
    ctx.beginPath();
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; k ? ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R) : ctx.moveTo(Math.cos(a) * R, Math.sin(a) * R); }
    ctx.closePath();
    ctx.fillStyle = 'rgba(12,14,34,0.85)'; ctx.fill();
    ctx.shadowColor = def.c; ctx.shadowBlur = 18 * glowK();
    ctx.strokeStyle = def.c; ctx.lineWidth = 4; ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.rotate(-time * 1.4);
    ctx.font = `${Math.round(R * 1.05)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(def.icon, 0, 2);
    ctx.restore();
  }

  function drawParticles() {
    for (const q of parts) {
      if (!q.smoke) continue;
      ctx.fillStyle = `rgba(${q.c},${0.45 * clamp(q.life / q.max, 0, 1)})`;
      ctx.beginPath(); ctx.arc(q.x, q.y, q.s, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = HIST ? 'source-over' : 'lighter';
    for (const q of parts) {
      if (q.smoke) continue;
      ctx.globalAlpha = clamp(q.life / q.max, 0, 1);
      ctx.fillStyle = q.c;
      ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  function drawPops() {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const q of pops) {
      ctx.save();
      facing(q.x, q.y, q.i);
      ctx.globalAlpha = clamp(q.life * 1.6, 0, 1);
      ctx.font = `900 ${q.big ? 30 : 36}px ${FONT}`;
      ctx.shadowColor = q.c; ctx.shadowBlur = 14 * glowK();
      ctx.fillStyle = q.c; drawCenterTextOutline(q.text, 0, 0);
      ctx.restore();
    }
  }

  function coin(x, y, r) {
    ctx.save();
    ctx.shadowColor = GOLD; ctx.shadowBlur = 10 * glowK();
    ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(120,70,0,0.6)'; ctx.lineWidth = r * 0.16;
    ctx.beginPath(); ctx.arc(x, y, r * 0.62, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  function hudLayout() {
    const bw = clamp((W - 500) / 2, 150, 250), bh = 82, gap = 14, v = (HUD - bh) / 2 + 2;
    return {
      power: { u: W - 24 - bw * 2 - gap, v, w: bw, h: bh },
      repair: { u: W - 24 - bw, v, w: bw, h: bh },
    };
  }
  const inRect = (l, r) => l.u >= r.u && l.u <= r.u + r.w && l.v >= r.v && l.v <= r.v + r.h;

  function drawButton(r, icon, title, sub, cost, ok, flash, deny, pl) {
    ctx.save();
    if (deny > 0) ctx.translate(Math.sin(deny * 70) * 7 * (deny / 0.35), 0);
    rr(ctx, r.u, r.v, r.w, r.h, 16);
    ctx.fillStyle = HIST ? (ok ? '#f7ebcb' : '#e6d5ac') : `rgba(${pl.rgb},${ok ? 0.2 : 0.05})`; ctx.fill();
    if (ok) { ctx.shadowColor = pl.c; ctx.shadowBlur = 14 * glowK(); }
    ctx.strokeStyle = deny > 0 ? '#ff5a5a' : `rgba(${pl.rgb},${ok ? 0.95 : 0.3})`; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.shadowBlur = 0;
    if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash})`; ctx.fill(); }
    ctx.globalAlpha = ok ? 1 : 0.45;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = TS.text;
    ctx.font = `700 ${Math.round(20 * TS.fs)}px ${FONT}`;
    ctx.fillText(`${icon} ${title}`, r.u + 14, r.v + 28);
    ctx.font = `500 ${Math.round(15 * TS.fs)}px ${FONT}`; ctx.fillStyle = TS.sub2;
    ctx.fillText(sub, r.u + 14, r.v + 58);
    if (cost !== null) {
      coin(r.u + r.w - 22, r.v + 58, 10);
      ctx.textAlign = 'right'; ctx.fillStyle = HIST ? '#8a5a00' : GOLD; ctx.font = `800 ${Math.round(18 * TS.fs)}px ${FONT}`;
      ctx.fillText(String(cost), r.u + r.w - 38, r.v + 59);
    }
    ctx.restore();
  }

  function drawHud(p) {
    const pl = PL[p.i];
    ctx.save();
    playerFrame(p);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = `900 22px ${FONT}`; ctx.fillStyle = pl.c;
    ctx.shadowColor = pl.c; ctx.shadowBlur = 10 * glowK();
    const hudName = p.cpu ? `CPU · ${CPU_NAME[cpuLevel]}` : pl.name;
    ctx.fillText(hudName, 24, 30);
    const nameW = ctx.measureText(hudName).width;      // misurato col carattere del nome, prima di cambiarlo
    ctx.shadowBlur = 0;
    ctx.font = `500 ${Math.round(13 * TS.fs)}px ${FONT}`; ctx.fillStyle = TS.sub;
    ctx.fillText(`VITTORIE ${wins[p.i]}`, 24 + nameW + 24, 31);
    // vite
    for (let k = 0; k < maxHp; k++) {
      rr(ctx, 24 + k * 27, 54, 21, 21, 5);
      if (k < p.hp) { ctx.fillStyle = pl.c; ctx.fill(); }
      else { ctx.strokeStyle = `rgba(${pl.rgb},0.4)`; ctx.lineWidth = 2; ctx.stroke(); }
    }
    ctx.font = `500 ${Math.round(12 * TS.fs)}px ${FONT}`; ctx.fillStyle = TS.sub;
    ctx.fillText(`LIVELLO FUOCO ${p.lvl}`, 24, 100);
    if (p.rapid > 0) { ctx.fillStyle = '#ff8a3a'; ctx.font = `700 12px ${FONT}`; ctx.fillText(`🔥 RAPIDO ${Math.ceil(p.rapid)}s`, 160, 100); }
    // monete
    const lay = hudLayout();
    const cxp = Math.max(24 + maxHp * 27 + 40, 240);
    const sc = 1 + p.coinFx * 0.35;
    ctx.save();
    ctx.translate(cxp, HUD / 2 + 2); ctx.scale(sc, sc);
    coin(0, 0, 17);
    ctx.font = `900 36px ${FONT}`; ctx.fillStyle = TS.text; ctx.textAlign = 'left';
    ctx.fillText(String(p.coins), 28, 2);
    ctx.restore();
    // pulsanti
    const pc = p.lvl >= MAXLVL ? null : powerCost(p.lvl);
    drawButton(lay.power, '⚡', 'POTENZA', p.lvl >= MAXLVL ? 'LIVELLO MAX' : `LV ${p.lvl} → ${p.lvl + 1}`, pc,
      pc !== null && p.coins >= pc, p.btn.power, p.deny.power, pl);
    const ri = repairInfo(p), pct = Math.round((1 - ri.missing / MASK_HP) * 100);
    drawButton(lay.repair, '🛡', 'RIPARA', ri.missing <= 0 ? 'BARRIERA INTEGRA' : `BARRIERA ${pct}% (MAX ${ri.need})`,
      ri.missing <= 0 ? null : ri.spend, ri.spend > 0, p.btn.repair, p.deny.repair, pl);
    ctx.restore();
  }

  function drawPauseBtn() {
    ctx.save();
    ctx.globalAlpha = 0.5;
    if (HIST) ctx.globalAlpha = 0.85;
    ctx.fillStyle = HIST ? '#e9d8ae' : 'rgba(10,12,30,0.8)'; ctx.strokeStyle = HIST ? '#5a3a1c' : 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(MID, PAUSE_Y, 30, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = HIST ? '#5a3a1c' : '#fff';
    // le barre sono parallele alla linea centrale, quindi leggibili da entrambi i lati
    ctx.fillRect(MID - 9, PAUSE_Y - 11, 6, 22);
    ctx.fillRect(MID + 3, PAUSE_Y - 11, 6, 22);
    ctx.restore();
  }

  function drawCenterTexts() {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const p of players) {
      const x = p.i === 0 ? (PX0 + MID) / 2 + 60 : (MID + PX1) / 2 - 60;
      const pl = PL[p.i];
      ctx.save();
      facing(x, W / 2, p.i);
      if (state === 'countdown') {
        const n = Math.ceil(countdown), f = countdown - Math.floor(countdown);
        ctx.globalAlpha = 0.4 + f * 0.6;
        ctx.font = `900 ${150 + (1 - f) * 40}px ${FONT}`;
        ctx.shadowColor = pl.c; ctx.shadowBlur = 30 * glowK(); ctx.fillStyle = '#fff';
        drawCenterTextOutline(String(n), 0, -20);
        if (firstMatch) {
          ctx.globalAlpha = 1; ctx.shadowBlur = 0;
          ctx.font = `600 20px ${FONT}`; ctx.fillStyle = pl.c;
          drawCenterTextOutline(fireMode === 'manual' ? 'TOCCA NELLA TUA METÀ: OGNI TOCCO UN COLPO' : 'TIENI IL DITO NELLA TUA METÀ: MUOVI E SPARA', 0, 100);
        }
      } else if (goT > 0) {
        ctx.globalAlpha = goT / 0.8;
        ctx.font = `900 ${120 + (0.8 - goT) * 80}px ${FONT}`;
        ctx.shadowColor = pl.c; ctx.shadowBlur = 30 * glowK(); ctx.fillStyle = pl.c;
        drawCenterTextOutline('VIA!', 0, 0);
      } else if (state === 'over' && overT > 0.5) {
        const won = p.i === winner;
        ctx.globalAlpha = clamp((overT - 0.5) * 2, 0, 1);
        ctx.font = `900 84px ${FONT}`;
        ctx.shadowColor = won ? GOLD : pl.c; ctx.shadowBlur = 30 * glowK();
        ctx.fillStyle = won ? GOLD : 'rgba(255,255,255,0.85)';
        drawCenterTextOutline(won ? 'VITTORIA!' : 'SCONFITTA', 0, -150);
        ctx.shadowBlur = 0; ctx.font = `600 24px ${FONT}`; ctx.fillStyle = '#fff';
        drawCenterTextOutline(`${PL[0].name} ${wins[0]}  –  ${wins[1]} ${PL[1].name}`, 0, -80);
      }
      ctx.restore();
    }
  }

  function draw() {
    const dpr = view.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05060f'; ctx.fillRect(0, 0, cv.width, cv.height);
    const sx = shake ? rnd(-shake, shake) * view.s : 0, sy = shake ? rnd(-shake, shake) * view.s : 0;
    ctx.drawImage(bg, sx * dpr, sy * dpr);
    if (HIST) { updateBarLayer(); ctx.drawImage(barLayer, sx * dpr, sy * dpr); }
    setField(ctx, sx, sy);
    drawGoals(); drawBonus(); drawBarriers(); drawCannons(); drawBalls(); drawFlashes(); drawParticles(); drawPops();
    setField(ctx);
    if (!demo) {
      if (state === 'play' || state === 'countdown') drawPauseBtn();
      for (const p of players) drawHud(p);
      drawCenterTexts();
    }
  }

  // =====================================================================
  // ---------- TEMA STORICO 1800: grafica cartoon, vista dall'alto ----------
  // =====================================================================
  const H = {
    grass: '#7aa64a', dirt: '#6e5132', dirtDark: '#4e3822', wood: '#8a5a2b', woodDark: '#4a2e14',
    sand: '#d8bf86', sandDark: '#8a6a3c', sandHurt: '#b39a66', bronze1: '#7a4a1a', bronze2: '#e0a85a',
    skin: '#f1c99b', hat: '#22222c', ink: '#3b2a17', paper1: '#efe0b8', paper2: '#e2cf9f',
  };
  const HIST_DEBRIS = ['#6b4a2b', '#8b6a42', '#4a3a2a', '#5c5c5c', '#ff9a2a', '#a07a4a'];
  const histColor = c => (c === GOLD ? c : c === '#ffffff' ? '#f4ecd8' : HIST_DEBRIS[Math.floor(Math.random() * HIST_DEBRIS.length)]);

  // generatore casuale con seme: lo sfondo è sempre lo stesso a ogni ridisegno
  function seeded(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }

  function drawBackgroundHist() {
    const c = bgx, R = seeded(1815);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#2b2116'; c.fillRect(0, 0, bg.width, bg.height);
    setField(c);
    // fasce HUD: pergamena con il nastro del colore dell'esercito
    for (const i of [0, 1]) {
      const x0 = i === 0 ? 0 : PX1;
      const g = c.createLinearGradient(i === 0 ? 0 : T, 0, i === 0 ? HUD : PX1, 0);
      g.addColorStop(0, H.paper2); g.addColorStop(1, H.paper1);
      c.fillStyle = g; c.fillRect(x0, 0, HUD, W);
      for (let k = 0; k < 14; k++) { c.fillStyle = `rgba(120,90,40,${0.04 + R() * 0.06})`; c.beginPath(); c.arc(x0 + R() * HUD, R() * W, 8 + R() * 30, 0, 7); c.fill(); }
      c.fillStyle = PL[i].c; c.fillRect(i === 0 ? HUD - 7 : PX1, 0, 7, W);
    }
    // prato
    c.fillStyle = H.grass; c.fillRect(PX0, 0, PX1 - PX0, W);
    const greens = ['#86b356', '#6f9a42', '#8fbc5e', '#6a933d', '#7fae4f'];
    for (let k = 0; k < 260; k++) {
      c.fillStyle = greens[k % greens.length]; c.globalAlpha = 0.35 + R() * 0.3;
      c.beginPath(); c.ellipse(PX0 + R() * (PX1 - PX0), R() * W, 20 + R() * 60, 12 + R() * 40, R() * 3, 0, 7); c.fill();
    }
    c.globalAlpha = 1;
    // zone di terra battuta
    for (let k = 0; k < 26; k++) {
      c.fillStyle = 'rgba(139,107,62,0.35)';
      c.beginPath(); c.ellipse(PX0 + R() * (PX1 - PX0), R() * W, 20 + R() * 50, 10 + R() * 30, R() * 3, 0, 7); c.fill();
    }
    // terra smossa dietro le trincee e intorno ai cannoni
    for (const i of [0, 1]) {
      const x0 = i === 0 ? PX0 : PX1 - BARRIER_OFF - DEPTH * CELL_X - 20;
      c.fillStyle = 'rgba(110,81,50,0.28)'; c.fillRect(x0, 0, BARRIER_OFF + DEPTH * CELL_X + 20, W);
    }
    // crateri di granata nella terra di nessuno
    for (let k = 0; k < 12; k++) {
      const side = k % 2, xa = side ? MID + 60 : PX0 + BARRIER_OFF + DEPTH * CELL_X + 60, xb = side ? PX1 - BARRIER_OFF - DEPTH * CELL_X - 60 : MID - 60;
      const x = xa + R() * (xb - xa), y = 30 + R() * (W - 60), r = 12 + R() * 16;
      c.fillStyle = 'rgba(160,128,90,0.8)'; c.beginPath(); c.ellipse(x, y, r * 1.35, r * 1.2, 0, 0, 7); c.fill();
      c.fillStyle = H.dirtDark; c.beginPath(); c.ellipse(x, y, r, r * 0.85, 0, 0, 7); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(x + r * 0.2, y + r * 0.15, r * 0.6, r * 0.5, 0, 0, 7); c.fill();
    }
    // ciuffi d'erba
    c.strokeStyle = '#557f2f'; c.lineWidth = 2; c.lineCap = 'round';
    for (let k = 0; k < 420; k++) {
      const x = PX0 + R() * (PX1 - PX0), y = R() * W;
      c.beginPath(); c.moveTo(x - 4, y - 5); c.lineTo(x, y + 2); c.lineTo(x + 4, y - 5); c.stroke();
    }
    // fiori
    const flowers = ['#ffffff', '#ffd84a', '#e8475a', '#c9a0ff'];
    for (let k = 0; k < 70; k++) { c.fillStyle = flowers[k % 4]; c.beginPath(); c.arc(PX0 + R() * (PX1 - PX0), R() * W, 2.2, 0, 7); c.fill(); }
    // un leggero velo del colore di ogni esercito sulla propria metà
    c.fillStyle = `rgba(${PL[0].rgb},0.06)`; c.fillRect(PX0, 0, MID - PX0, W);
    c.fillStyle = `rgba(${PL[1].rgb},0.06)`; c.fillRect(MID, 0, PX1 - MID, W);
    // ruscello al centro
    const riverX = y => MID + Math.sin(y / 70) * 10 + Math.sin(y / 23) * 3;
    const band = (half, color) => {
      c.beginPath();
      for (let y = 0; y <= W; y += 8) c.lineTo(riverX(y) - half, y);
      for (let y = W; y >= 0; y -= 8) c.lineTo(riverX(y) + half, y);
      c.closePath(); c.fillStyle = color; c.fill();
    };
    band(30, '#c9b07a'); band(23, '#4f8fc0'); band(12, '#5fa0d0');
    c.strokeStyle = 'rgba(220,240,255,0.7)'; c.lineWidth = 2;
    for (let y = 20; y < W; y += 46) { const x = riverX(y) + (R() - 0.5) * 16; c.beginPath(); c.arc(x, y, 7, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
    // staccionate sui lati lunghi
    for (const y of [0, W]) {
      const s = y ? -1 : 1;
      c.strokeStyle = '#8a5a2b'; c.lineWidth = 4;
      c.beginPath(); c.moveTo(PX0, y + s * 5); c.lineTo(PX1, y + s * 5); c.moveTo(PX0, y + s * 12); c.lineTo(PX1, y + s * 12); c.stroke();
      for (let x = PX0 + 10; x < PX1; x += 56) { c.fillStyle = H.woodDark; c.fillRect(x - 3, y + (s > 0 ? 0 : -16), 7, 16); }
    }
    // palizzata di tronchi appuntiti in fondo a ogni campo
    for (const i of [0, 1]) {
      const d = i === 0 ? 1 : -1, x = i === 0 ? PX0 : PX1;
      for (let y = 0; y < W; y += 15) {
        c.beginPath();
        c.moveTo(x - d * 14, y + 1); c.lineTo(x + d * 2, y + 1); c.lineTo(x + d * 10, y + 7.5); c.lineTo(x + d * 2, y + 14); c.lineTo(x - d * 14, y + 14); c.closePath();
        c.fillStyle = y % 30 ? '#9a6a38' : H.wood; c.fill(); c.strokeStyle = H.woodDark; c.lineWidth = 1.5; c.stroke();
      }
    }
    // vignetta seppia
    c.setTransform(1, 0, 0, 1, 0, 0);
    const vg = c.createRadialGradient(bg.width / 2, bg.height / 2, Math.min(bg.width, bg.height) * 0.35, bg.width / 2, bg.height / 2, Math.max(bg.width, bg.height) * 0.75);
    vg.addColorStop(0, 'rgba(60,40,10,0)'); vg.addColorStop(1, 'rgba(60,40,10,0.35)');
    c.fillStyle = vg; c.fillRect(0, 0, bg.width, bg.height);
  }

  // soldatino visto dall'alto: spalle con l'uniforme e le spalline, cappello a tesa con la mostrina, fucile con baionetta
  function drawSoldier(c, x, y, dir, sw, sh, color, wounded) {
    const rx = sw * 0.4, ry = sh * 0.44;
    c.fillStyle = 'rgba(0,0,0,0.2)'; c.beginPath(); c.ellipse(x + 1.5, y + 2, rx, ry, 0, 0, 7); c.fill();
    if (!wounded) {   // fucile imbracciato verso il nemico
      c.strokeStyle = '#6b4423'; c.lineWidth = Math.max(1.5, sw * 0.11);
      c.beginPath(); c.moveTo(x, y + ry * 0.5); c.lineTo(x + dir * sw * 0.7, y + ry * 0.5); c.stroke();
      c.strokeStyle = '#d6d6de'; c.lineWidth = Math.max(1, sw * 0.06);
      c.beginPath(); c.moveTo(x + dir * sw * 0.7, y + ry * 0.5); c.lineTo(x + dir * sw * 0.95, y + ry * 0.5); c.stroke();
    }
    // spalle / giubba
    c.fillStyle = wounded ? shade(color, -0.35) : color;
    c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 7); c.fill();
    c.strokeStyle = 'rgba(30,20,10,0.85)'; c.lineWidth = 1; c.stroke();
    // bandoliere bianche incrociate
    c.strokeStyle = 'rgba(245,240,225,0.9)'; c.lineWidth = Math.max(1, sw * 0.08);
    c.beginPath(); c.moveTo(x - rx * 0.55, y - ry * 0.65); c.lineTo(x + rx * 0.55, y + ry * 0.65); c.moveTo(x + rx * 0.55, y - ry * 0.65); c.lineTo(x - rx * 0.55, y + ry * 0.65); c.stroke();
    // spalline dorate
    c.fillStyle = '#e8b830';
    c.beginPath(); c.ellipse(x, y - ry * 0.82, rx * 0.5, ry * 0.16, 0, 0, 7); c.ellipse(x, y + ry * 0.82, rx * 0.5, ry * 0.16, 0, 0, 7); c.fill();
    // cappello: tesa marrone, calotta nera, mostrina dorata davanti
    const hr = Math.min(sw, sh) * 0.3;
    c.fillStyle = '#5a3a1c'; c.beginPath(); c.ellipse(x + dir * hr * 0.15, y, hr * 1.15, hr * 1.05, 0, 0, 7); c.fill();
    c.fillStyle = wounded ? '#3a3a44' : H.hat; c.beginPath(); c.arc(x, y, hr * 0.8, 0, 7); c.fill();
    c.fillStyle = '#e8b830'; c.beginPath(); c.arc(x + dir * hr * 0.75, y, hr * 0.28, 0, 7); c.fill();
    if (wounded) {   // bendaggio
      c.strokeStyle = '#ffffff'; c.lineWidth = Math.max(1.5, sw * 0.1);
      c.beginPath(); c.moveTo(x - hr * 0.9, y - hr * 0.5); c.lineTo(x + hr * 0.9, y + hr * 0.5); c.stroke();
    }
  }

  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16), f = v => clamp(Math.round(v * (1 + k)), 0, 255);
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }

  // trincee: disegnate in un livello a parte e ridisegnate solo quando cambiano
  const barLayer = document.createElement('canvas');
  const blx = barLayer.getContext('2d');
  let barKey = '';
  function barHash(p) { let h = 0; for (let k = 0; k < p.bar.length; k++) h = (h * 31 + p.bar[k] * (k + 7)) % 1000000007; return h; }

  function updateBarLayer() {
    const key = `${cv.width}x${cv.height}|${W}|${view.s}|${players.map(barHash).join(',')}|${PL[0].c}`;
    if (key === barKey) return;
    barKey = key;
    barLayer.width = cv.width; barLayer.height = cv.height;
    const c = blx;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, barLayer.width, barLayer.height);
    setField(c);
    const ch = W / ROWS;
    for (const p of players) {
      const bx0 = barrierX0(p), col = PL[p.i].c;
      // fondo della trincea (terra scavata), anche dove i soldati sono caduti
      for (let r = 0; r < ROWS; r++) for (let cc = 0; cc < DEPTH; cc++) {
        const idx = r * DEPTH + colToD(p, cc);
        if (!MASK[idx]) continue;
        c.fillStyle = H.dirt; c.fillRect(bx0 + cc * CELL_X - 1, r * ch - 1, CELL_X + 2, ch + 2);
      }
      for (let r = 0; r < ROWS; r++) for (let cc = 0; cc < DEPTH; cc++) {
        const d = colToD(p, cc), idx = r * DEPTH + d, hp = p.bar[idx];
        const x = bx0 + cc * CELL_X, y = r * ch;
        if (!MASK[idx]) continue;
        if (hp <= 0) {   // buca
          c.fillStyle = H.dirtDark; c.beginPath(); c.ellipse(x + CELL_X / 2, y + ch / 2, CELL_X * 0.38, ch * 0.32, 0, 0, 7); c.fill();
          continue;
        }
        if (d >= DEPTH - 2) {   // sacchi di sabbia in prima linea
          rr(c, x + 1, y + 1, CELL_X - 2, ch - 2, 4);
          c.fillStyle = hp >= 2 ? H.sand : H.sandHurt; c.fill();
          c.strokeStyle = H.sandDark; c.lineWidth = 1.2; c.stroke();
          c.beginPath(); c.moveTo(x + 3, y + ch / 2); c.lineTo(x + CELL_X - 3, y + ch / 2); c.strokeStyle = 'rgba(120,90,50,0.6)'; c.stroke();
          if (hp < 2) { c.fillStyle = 'rgba(216,191,134,0.9)'; c.beginPath(); c.arc(x + CELL_X / 2 + p.dir * 6, y + ch * 0.7, 2.5, 0, 7); c.fill(); }
        } else {               // soldati in trincea
          drawSoldier(c, x + CELL_X / 2, y + ch / 2, p.dir, CELL_X, ch, col, hp < 2);
        }
      }
    }
  }

  function drawCannonHist(p) {
    const pl = PL[p.i], d = p.dir, cx = cannonX(p) - d * p.recoil * 7;
    const dmg = damageOf(p), last = !demo && p.hp === 1;
    const c = ctx;
    c.save();
    c.translate(cx, p.y);
    if (p.rapid > 0) {
      const g = c.createRadialGradient(0, 0, 10, 0, 0, 90);
      g.addColorStop(0, `rgba(255,150,40,${0.45 + 0.2 * Math.sin(time * 16)})`); g.addColorStop(1, 'rgba(255,150,40,0)');
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, 90, 0, 7); c.fill();
    }
    // ombra
    c.fillStyle = 'rgba(0,0,0,0.13)'; c.beginPath(); c.ellipse(3, 4, 30, 60, 0, 0, 7); c.fill();
    // coda dell'affusto
    c.fillStyle = H.wood; rr(c, d > 0 ? -46 : 0, -7, 46, 14, 4); c.fill();
    c.strokeStyle = H.woodDark; c.lineWidth = 2; c.stroke();
    // assale
    c.fillStyle = '#5a3a1c'; c.fillRect(-5, -52, 10, 104);
    // ruote (con molti danni una si stacca)
    for (const s of [-1, 1]) {
      c.save();
      if (dmg >= 0.5 && s === 1) { c.translate(-d * 10, 8); c.rotate(0.6); }
      c.translate(0, s * 52);
      rr(c, -19, -7, 38, 14, 6);
      c.fillStyle = dmg >= 0.5 && s === 1 ? '#4a301a' : '#7a4f2a'; c.fill();
      c.strokeStyle = '#3a2410'; c.lineWidth = 3; c.stroke();
      c.strokeStyle = 'rgba(58,36,16,0.8)'; c.lineWidth = 1.5;
      c.beginPath(); for (let k = -12; k <= 12; k += 6) { c.moveTo(k, -5); c.lineTo(k, 5); } c.stroke();
      c.fillStyle = '#c9c2b0'; c.beginPath(); c.arc(0, 0, 3, 0, 7); c.fill();
      c.restore();
    }
    // canna in bronzo
    const g = c.createLinearGradient(0, -11, 0, 11);
    g.addColorStop(0, H.bronze1); g.addColorStop(0.45, H.bronze2); g.addColorStop(1, H.bronze1);
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(-d * 16, -10); c.lineTo(d * 38, -7); c.lineTo(d * 38, 7); c.lineTo(-d * 16, 10); c.closePath(); c.fill();
    c.strokeStyle = '#5a3410'; c.lineWidth = 1.5; c.stroke();
    c.fillStyle = H.bronze1; c.beginPath(); c.arc(-d * 19, 0, 6, 0, 7); c.fill(); c.stroke();      // pomo di culatta
    for (const bx of [-6, 12]) { c.fillStyle = '#9a6428'; c.fillRect(d * bx - 2, -10, 4, 20); }
    c.fillStyle = '#a06a2c'; rr(c, d > 0 ? 35 : -43, -9, 8, 18, 3); c.fill(); c.stroke();             // bocca
    c.fillStyle = '#1a1208'; c.beginPath(); c.arc(d * 43, 0, 3.5, 0, 7); c.fill();
    // artiglieri
    for (const s of [-1, 1]) drawSoldier(c, -d * 28, s * 27, d, 20, 26, pl.c, false);
    // fuliggine e bruciature: aumentano con i danni
    const shown = Math.round(dmg * p.marks.length);
    for (let k = 0; k < shown; k++) {
      const m = p.marks[k];
      c.fillStyle = 'rgba(25,18,10,0.55)'; c.beginPath(); c.ellipse(m.side * 6, m.y * 0.8, m.r * 1.3, m.r, 0, 0, 7); c.fill();
    }
    // all'ultima vita prende fuoco
    if (last) {   // vampate che tremolano sull'affusto
      for (const [fx, fy, ph] of [[-d * 6, -30, 0], [d * 4, 18, 2], [-d * 30, 6, 4]]) {
        const r = 9 + 3 * Math.sin(time * 22 + ph);
        c.fillStyle = 'rgba(255,110,20,0.85)'; c.beginPath(); c.arc(fx, fy, r, 0, 7); c.fill();
        c.fillStyle = 'rgba(255,200,60,0.95)'; c.beginPath(); c.arc(fx + 1, fy - 1, r * 0.55, 0, 7); c.fill();
        c.fillStyle = 'rgba(255,250,210,0.9)'; c.beginPath(); c.arc(fx + 1, fy - 1, r * 0.22, 0, 7); c.fill();
      }
    }
    if (p.hitT > 0) {
      c.fillStyle = `rgba(255,250,230,${p.hitT / 0.4 * 0.85})`;
      c.beginPath(); c.ellipse(0, 0, 40, 64, 0, 0, 7); c.fill();
    }
    c.restore();
  }

  function drawBallsHist() {
    const c = ctx;
    for (const b of balls) {   // scia di fumo da polvere da sparo
      const t = b.trail, n = t.length / 2;
      for (let k = 0; k < n; k += 2) {
        const f = k / n;
        c.fillStyle = `rgba(235,230,220,${0.32 * f})`;
        c.beginPath(); c.arc(t[k * 2], t[k * 2 + 1], b.r * (0.6 + (1 - f) * 1.3), 0, 7); c.fill();
      }
    }
    for (const b of balls) {
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(b.x + 3, b.y + 4, b.r, b.r * 0.8, 0, 0, 7); c.fill();
      const g = c.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.35, 1, b.x, b.y, b.r);
      g.addColorStop(0, '#8a8a8a'); g.addColorStop(0.5, '#333'); g.addColorStop(1, '#0d0d0d');
      c.fillStyle = g; c.beginPath(); c.arc(b.x, b.y, b.r, 0, 7); c.fill();
      c.strokeStyle = PL[b.o].c; c.lineWidth = 2; c.stroke();
    }
  }

  // parata: esplosione cartoon a stella con nuvolette di fumo
  function drawFlashesHist() {
    const c = ctx;
    for (const f of flashes) {
      const k = f.t / VORTEX_T, age = 1 - k, R = 16 + 46 * (1 - Math.pow(1 - age, 3));
      for (let j = 0; j < 9; j++) {
        const a = f.rot + j * Math.PI * 2 / 9, rr2 = R * 1.15;
        c.fillStyle = `rgba(225,220,210,${0.8 * k})`;
        c.beginPath(); c.arc(f.x + Math.cos(a) * rr2, f.y + Math.sin(a) * rr2, 10 + R * 0.28, 0, 7); c.fill();
      }
      if (age < 0.6) {
        const ka = 1 - age / 0.6, Rs = R * (0.9 + 0.2 * Math.sin(time * 40));
        c.save(); c.translate(f.x, f.y); c.rotate(f.rot + age * f.spin * 2);
        c.beginPath();
        for (let j = 0; j < 24; j++) { const a = j * Math.PI / 12, r = j % 2 ? Rs * 0.48 : Rs; j ? c.lineTo(Math.cos(a) * r, Math.sin(a) * r) : c.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
        c.closePath();
        c.globalAlpha = ka; c.fillStyle = '#ffb72b'; c.fill(); c.strokeStyle = H.ink; c.lineWidth = 3; c.stroke();
        c.fillStyle = '#fff6c0'; c.beginPath(); c.arc(0, 0, Rs * 0.32, 0, 7); c.fill();
        c.restore();
      }
    }
  }

  function drawGoalsHist() {
    for (const p of players) for (const g of p.goals) {
      const x = p.i === 0 ? PX0 : PX1;
      for (let j = 0; j < 5; j++) {
        ctx.fillStyle = `rgba(150,120,80,${0.55 * g.t})`;
        ctx.beginPath(); ctx.arc(x + (j - 2) * 8 * (p.i ? -1 : 1), g.y + Math.sin(j * 2.1) * 30, 18 + (1 - g.t) * 30, 0, 7); ctx.fill();
      }
    }
  }

  // bonus: cassa di rifornimenti
  function drawBonusCrate(def, R) {
    const c = ctx;
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(5, 7, R * 1.05, R * 0.95, 0, 0, 7); c.fill();
    c.rotate(Math.sin(time * 2) * 0.12);
    rr(c, -R, -R, R * 2, R * 2, 5); c.fillStyle = '#b07a3e'; c.fill(); c.strokeStyle = '#5a3a1c'; c.lineWidth = 3; c.stroke();
    c.strokeStyle = '#7a4f22'; c.lineWidth = 2;
    c.beginPath(); for (let k = -1; k <= 1; k++) { c.moveTo(-R, k * R * 0.66); c.lineTo(R, k * R * 0.66); } c.stroke();
    c.beginPath(); c.moveTo(-R, -R); c.lineTo(R, R); c.stroke();
    c.fillStyle = 'rgba(245,232,200,0.9)'; c.beginPath(); c.arc(0, 0, R * 0.62, 0, 7); c.fill();
    c.strokeStyle = def.c; c.lineWidth = 3; c.stroke();
  }

  function drawCenterTextOutline(text, x, y) {
    if (HIST) { ctx.save(); ctx.shadowBlur = 0; ctx.globalAlpha *= 1; ctx.lineJoin = 'round'; ctx.strokeStyle = H.ink; ctx.lineWidth = 8; ctx.strokeText(text, x, y); ctx.restore(); }
    ctx.fillText(text, x, y);
  }

  function applyTheme(t) {
    theme = THEMES[t] ? t : 'neon';
    HIST = theme === 'hist'; TS = THEMES[theme]; FONT = TS.font;
    THEMES[theme].pl.forEach((x, i) => Object.assign(PL[i], x));
    glow = makeGlow(); barKey = '';
    Sound.theme = theme;
    document.body.classList.toggle('hist', HIST);
    drawBackground();
    if (document.fonts && document.fonts.load) document.fonts.load(`20px ${FONT}`).then(() => { barKey = ''; }).catch(() => {});
  }

  // ---------- flusso di gioco ----------
  const $ = id => document.getElementById(id);
  const show = (id, on) => $(id).classList.toggle('show', on);

  function startMatch() {
    newMatch(false);
    state = 'countdown'; countdown = 3; goT = 0;
    show('menu', false); show('pause', false); show('over', false);
    keepAwake();
    Sound.init(); Sound.setMusicLevel(1); Sound.musicStart();
  }
  function toMenu() {
    newMatch(true); state = 'menu';
    show('pause', false); show('over', false); show('menu', true);
    Sound.setMusicLevel(0); Sound.musicStart();
  }
  function pause() {
    if (state !== 'play' && state !== 'countdown') return;
    pausedFrom = state; state = 'paused';
    for (const p of players) p.touches.clear();
    owners.clear();
    show('pause', true);
    Sound.musicStop(0.2);
  }
  function resume() {
    if (state !== 'paused') return;
    state = pausedFrom; show('pause', false);
    Sound.init(); Sound.musicStart();
  }
  function showOver() {
    if (state !== 'over') return;
    $('over-title').textContent = players[1].cpu ? (winner === 0 ? 'HAI VINTO!' : `VINCE LA CPU (${CPU_NAME[cpuLevel]})`) : `VINCE ${PL[winner].name}`;
    $('over-title').style.color = PL[winner].c;
    $('over-score').textContent = `${PL[0].name} ${wins[0]} – ${wins[1]} ${players[1].cpu ? 'CPU' : PL[1].name}`;
    firstMatch = false;
    show('over', true);
  }

  let wakeLock = null;
  async function keepAwake() {
    try { if ('wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } }
    catch (e) { wakeLock = null; }
  }

  // ---------- input touch / mouse ----------
  cv.addEventListener('pointerdown', e => {
    Sound.init();
    if (state !== 'play' && state !== 'countdown') return;
    const f = toField(e.clientX, e.clientY);
    if (Math.hypot(f.x - MID, f.y - PAUSE_Y) < 42) { pause(); return; }
    const p = players[f.x < MID ? 0 : 1];
    if (p.cpu) return;
    const l = toLocal(p, f);
    if (l.v >= 0 && l.v <= HUD) {
      const lay = hudLayout();
      if (inRect(l, lay.power)) { buyPower(p); return; }
      if (inRect(l, lay.repair)) { buyRepair(p); return; }
    }
    owners.set(e.pointerId, p.i);
    p.touches.set(e.pointerId, f.y);
    p.ty = f.y; p.tx = f.x + p.dir * FINGER_AHEAD;
    if (fireMode === 'manual' && state === 'play') p.queued = 0.6;
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* niente */ }
  });
  cv.addEventListener('pointermove', e => {
    const i = owners.get(e.pointerId);
    if (i === undefined) return;
    const f = toField(e.clientX, e.clientY);
    players[i].ty = f.y; players[i].tx = f.x + players[i].dir * FINGER_AHEAD;
  });
  const release = e => {
    const i = owners.get(e.pointerId);
    if (i === undefined) return;
    owners.delete(e.pointerId);
    players[i].touches.delete(e.pointerId);
  };
  cv.addEventListener('pointerup', release);
  cv.addEventListener('pointercancel', release);
  cv.addEventListener('lostpointercapture', release);
  cv.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', e => e.preventDefault());
  cv.addEventListener('contextmenu', e => e.preventDefault());

  // ---------- tastiera ----------
  const KEYS = {
    KeyW: [0, 'kUp'], KeyS: [0, 'kDown'], KeyD: [0, 'kFwd'], KeyA: [0, 'kBack'], KeyF: [0, 'kFire'],
    ArrowUp: [1, 'kUp'], ArrowDown: [1, 'kDown'], ArrowLeft: [1, 'kFwd'], ArrowRight: [1, 'kBack'], KeyL: [1, 'kFire'], Enter: [1, 'kFire'],
  };
  window.addEventListener('keydown', e => {
    Sound.init();
    if (e.code === 'Escape' || e.code === 'Space') {
      if (state === 'paused') resume(); else pause();
      e.preventDefault(); return;
    }
    if (demo) return;
    const k0 = KEYS[e.code];
    if (k0 && players[k0[0]].cpu) return;
    if (players1 && ['KeyO', 'KeyP'].includes(e.code)) return;
    const k = KEYS[e.code];
    if (k) {
      players[k[0]][k[1]] = true; e.preventDefault();
      if (k[1] === 'kFire' && !e.repeat && fireMode === 'manual' && state === 'play') players[k[0]].queued = 0.6;
      return;
    }
    if (e.repeat) return;
    if (e.code === 'KeyQ') buyPower(players[0]);
    else if (e.code === 'KeyE') buyRepair(players[0]);
    else if (e.code === 'KeyO') buyPower(players[1]);
    else if (e.code === 'KeyP') buyRepair(players[1]);
  });
  window.addEventListener('keyup', e => { const k = KEYS[e.code]; if (k && players[k[0]]) players[k[0]][k[1]] = false; });

  // ---------- menu ----------
  const FIRE_HINT = {
    auto: 'Automatico: tieni il dito nella tua metà, il cannone ti segue e spara da solo.',
    manual: 'Manuale: tocca nella tua metà, il cannone va lì e spara un colpo per ogni tocco.',
  };
  const AIM_HINT = {
    spin: 'Con effetto: se ti muovi mentre spari il colpo parte inclinato e rimbalza sulle sponde.',
    straight: 'Dritto: il colpo parte sempre dritto, anche se ti stai spostando.',
  };
  const RATE_HINT = {
    normal: 'Normale: cadenza di fuoco standard.',
    slow: 'Lenta: tra un colpo e l\'altro si aspetta di più (circa il 60% in più).',
  };
  const MOVE_HINT = {
    rail: 'Su binario: il cannone scorre solo lungo il tuo fondo campo.',
    free: 'Libero: il cannone va ovunque nella tua metà. Ogni minuto compare un bonus al centro: prendilo col cannone!',
  };
  function syncOpts() {
    document.querySelectorAll('#hp-seg button').forEach(x => x.classList.toggle('on', +x.dataset.hp === maxHp));
    document.querySelectorAll('#fire-seg button').forEach(x => x.classList.toggle('on', x.dataset.fire === fireMode));
    document.querySelectorAll('#move-seg button').forEach(x => x.classList.toggle('on', x.dataset.move === moveMode));
    $('fire-hint').textContent = FIRE_HINT[fireMode];
    $('move-hint').textContent = MOVE_HINT[moveMode];
    document.querySelectorAll('#aim-seg button').forEach(x => x.classList.toggle('on', x.dataset.aim === aimMode));
    document.querySelectorAll('#rate-seg button').forEach(x => x.classList.toggle('on', x.dataset.rate === rateMode));
    $('aim-hint').textContent = AIM_HINT[aimMode];
    $('rate-hint').textContent = RATE_HINT[rateMode];
    document.querySelectorAll('#theme-seg button').forEach(x => x.classList.toggle('on', x.dataset.theme === theme));
    $('theme-hint').textContent = THEME_HINT[theme];
    document.querySelectorAll('#players-seg button').forEach(x => x.classList.toggle('on', x.dataset.players === (players1 ? '1' : '2')));
    document.querySelectorAll('#cpu-seg button').forEach(x => x.classList.toggle('on', x.dataset.cpu === cpuLevel));
    $('cpu-row').style.display = players1 ? '' : 'none';
    $('cpu-hint').style.display = players1 ? '' : 'none';
    $('cpu-hint').textContent = CPU_HINT[cpuLevel];
  }
  const CPU_HINT = {
    easy: 'Facile: la CPU reagisce lenta, si distrae e mira a caso.',
    medium: 'Medio: schiva quasi sempre, para i colpi e cerca i varchi nella tua trincea.',
    hard: 'Difficile: prevede ogni rimbalzo, para tutto quello che può, scava un varco e gestisce le monete al meglio.',
  };
  const THEME_HINT = {
    neon: 'Neon: grafica moderna con luci e scie luminose.',
    hist: 'Storico 1800: cannoni da campo, trincee di soldati e sacchi di sabbia, marcia militare.',
  };
  document.querySelectorAll('#hp-seg button').forEach(b => b.addEventListener('click', () => { maxHp = +b.dataset.hp; saveOpts(); syncOpts(); }));
  document.querySelectorAll('#fire-seg button').forEach(b => b.addEventListener('click', () => { fireMode = b.dataset.fire; saveOpts(); syncOpts(); }));
  document.querySelectorAll('#aim-seg button').forEach(b => b.addEventListener('click', () => { aimMode = b.dataset.aim; saveOpts(); syncOpts(); }));
  document.querySelectorAll('#rate-seg button').forEach(b => b.addEventListener('click', () => { rateMode = b.dataset.rate; saveOpts(); syncOpts(); }));
  document.querySelectorAll('#move-seg button').forEach(b => b.addEventListener('click', () => { moveMode = b.dataset.move; saveOpts(); syncOpts(); newMatch(true); }));
  document.querySelectorAll('#theme-seg button').forEach(b => b.addEventListener('click', () => { applyTheme(b.dataset.theme); saveOpts(); syncOpts(); newMatch(true); }));
  document.querySelectorAll('#players-seg button').forEach(b => b.addEventListener('click', () => { players1 = b.dataset.players === '1'; saveOpts(); syncOpts(); }));
  document.querySelectorAll('#cpu-seg button').forEach(b => b.addEventListener('click', () => { cpuLevel = b.dataset.cpu; saveOpts(); syncOpts(); }));
  syncOpts();
  $('btn-start').addEventListener('click', () => { Sound.init(); wins[0] = wins[1] = 0; firstMatch = true; startMatch(); });
  $('btn-again').addEventListener('click', () => { Sound.init(); startMatch(); });
  $('btn-resume').addEventListener('click', resume);
  $('btn-restart').addEventListener('click', startMatch);
  $('btn-menu').addEventListener('click', toMenu);
  $('btn-menu2').addEventListener('click', toMenu);
  // interruttori audio (nel menu e nella pausa)
  function syncAudio() {
    document.querySelectorAll('[data-audio=music]').forEach(b => { b.textContent = Sound.musicOn ? '🎵 Musica sì' : '🎵 Musica no'; b.classList.toggle('off', !Sound.musicOn); });
    document.querySelectorAll('[data-audio=sfx]').forEach(b => { b.textContent = Sound.sfxOn ? '🔊 Effetti sì' : '🔇 Effetti no'; b.classList.toggle('off', !Sound.sfxOn); });
  }
  document.querySelectorAll('[data-audio]').forEach(b => b.addEventListener('click', () => {
    Sound.init();
    if (b.dataset.audio === 'music') { Sound.setMusic(!Sound.musicOn); if (state === 'menu') Sound.musicStart(); }
    else { Sound.setSfx(!Sound.sfxOn); Sound.muted = false; Sound.score(); Sound.muted = demo; }
    syncAudio();
  }));
  syncAudio();
  // la musica del menu parte al primo tocco (i browser bloccano l'audio prima)
  const firstTouch = () => {
    Sound.init();
    if (state === 'menu') { Sound.setMusicLevel(0); Sound.musicStart(); }
    window.removeEventListener('pointerdown', firstTouch, true);
  };
  window.addEventListener('pointerdown', firstTouch, true);
  $('btn-fs').addEventListener('click', () => {
    const el = document.documentElement;
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
    } catch (e) { /* non supportato */ }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause(); else if (state !== 'menu') keepAwake();
  });

  // ---------- avvio ----------
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));
  resize();
  applyTheme(theme);
  newMatch(true);
  if (document.fonts && document.fonts.load) document.fonts.load(`700 20px ${FONT}`).catch(() => {});

  let last = performance.now();
  function frame(t) {
    const dt = Math.min(0.033, Math.max(0, (t - last) / 1000));
    last = t;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // per i test automatici
  window.__pi = { get state() { return state; }, get players() { return players; }, get balls() { return balls; }, get bonus() { return bonus; }, nextBonus() { bonusTimer = BONUS_EVERY - 0.3; },
    // test: simula la partita più veloce del tempo reale
    aiLevels: AI_LEVELS,
    sim(sec, cb) { const n = Math.round(sec * 60); for (let k = 0; k < n && state === 'play'; k++) { if (cb) cb(k / 60); update(1 / 60); } return state; } };
})();
