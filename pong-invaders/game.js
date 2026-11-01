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
  const LEVELS = [null,
    { cd: 0.55, shots: 1, speed: 760, str: 1, rad: 1.0, r: 9 },
    { cd: 0.44, shots: 1, speed: 820, str: 1, rad: 1.4, r: 10 },
    { cd: 0.46, shots: 2, speed: 860, str: 2, rad: 1.5, r: 10 },
    { cd: 0.38, shots: 2, speed: 920, str: 2, rad: 1.8, r: 11 },
    { cd: 0.36, shots: 3, speed: 980, str: 3, rad: 2.1, r: 12 },
  ];
  const powerCost = lvl => 2 + lvl * 2;        // 4, 6, 8, 10
  const REPAIR_FULL = 10;                      // monete per una riparazione completa
  const PL = [
    { name: 'BLU',  c: '#2de2ff', rgb: '45,226,255' },
    { name: 'ROSA', c: '#ff2d95', rgb: '255,45,149' },
  ];
  const GOLD = '#ffd34d';
  const FONT = '"Orbitron", "Segoe UI", sans-serif';

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
  const glow = PL.map(pl => {
    const g = document.createElement('canvas'); g.width = g.height = 128;
    const gc = g.getContext('2d');
    const gr = gc.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, `rgba(${pl.rgb},0.95)`); gr.addColorStop(0.25, `rgba(${pl.rgb},0.45)`);
    gr.addColorStop(1, `rgba(${pl.rgb},0)`);
    gc.fillStyle = gr; gc.fillRect(0, 0, 128, 128);
    return g;
  });

  // ---------- audio ----------
  const Sound = {
    ac: null, master: null, on: true, nb: null,
    init() {
      if (!this.ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ac = new AC();
        this.master = this.ac.createGain(); this.master.gain.value = 0.55;
        this.master.connect(this.ac.destination);
        const len = this.ac.sampleRate;
        this.nb = this.ac.createBuffer(1, len, len);
        const d = this.nb.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ac.state === 'suspended') this.ac.resume();
    },
    ok() { return this.on && this.ac && !demo; },
    tone(f, d, type = 'square', v = 0.1, f2 = 0, delay = 0) {
      if (!this.ok()) return;
      const t = this.ac.currentTime + delay, o = this.ac.createOscillator(), g = this.ac.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + d + 0.03);
    },
    noise(d, v = 0.2, freq = 1200, delay = 0) {
      if (!this.ok()) return;
      const t = this.ac.currentTime + delay, src = this.ac.createBufferSource(), f = this.ac.createBiquadFilter(), g = this.ac.createGain();
      src.buffer = this.nb; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      src.connect(f); f.connect(g); g.connect(this.master); src.start(t, Math.random() * 0.5); src.stop(t + d + 0.03);
    },
    shoot(i, l) { this.tone(i ? 560 : 470, 0.08, 'square', 0.035 + l * 0.004, i ? 280 : 235); },
    crack() { this.noise(0.07, 0.12, 2600); },
    wall() { this.tone(980, 0.035, 'triangle', 0.035); },
    clash() { this.tone(1500, 0.08, 'sawtooth', 0.04, 500); this.noise(0.05, 0.08, 4200); },
    score() { this.tone(880, 0.07, 'triangle', 0.08); this.tone(1320, 0.12, 'triangle', 0.08, 0, 0.06); },
    hit() { this.noise(0.35, 0.4, 500); this.tone(170, 0.35, 'sawtooth', 0.13, 50); },
    boom() { this.noise(1.2, 0.55, 280); this.tone(130, 1.0, 'sawtooth', 0.2, 28); },
    buy() { [660, 880, 1100, 1320].forEach((f, k) => this.tone(f, 0.12, 'triangle', 0.07, 0, k * 0.05)); },
    repair() { [440, 554, 660, 880].forEach((f, k) => this.tone(f, 0.14, 'sine', 0.09, 0, k * 0.06)); },
    deny() { this.tone(210, 0.16, 'square', 0.05, 140); },
    tick() { this.tone(620, 0.12, 'sine', 0.14); },
    go() { this.tone(1240, 0.35, 'sine', 0.15, 620); },
  };

  // ---------- stato ----------
  let state = 'menu';            // menu | countdown | play | paused | over
  let pausedFrom = 'play';
  let players = [], balls = [], parts = [], pops = [];
  let countdown = 0, goT = 0, overT = 0, winner = -1, shake = 0, time = 0;
  let maxHp = 3, fireMode = 'auto', demo = true, firstMatch = true;
  try {
    const saved = JSON.parse(localStorage.getItem('pong-invaders-opts') || '{}');
    if ([3, 5, 7].includes(saved.hp)) maxHp = saved.hp;
    if (saved.fire === 'manual' || saved.fire === 'auto') fireMode = saved.fire;
  } catch (e) { /* opzioni di default */ }
  function saveOpts() { try { localStorage.setItem('pong-invaders-opts', JSON.stringify({ hp: maxHp, fire: fireMode })); } catch (e) { /* niente */ } }
  const wins = [0, 0];
  const owners = new Map();      // pointerId -> indice giocatore

  function newMatch(isDemo) {
    demo = isDemo;
    players = [0, 1].map(i => ({
      i, dir: i === 0 ? 1 : -1, y: W / 2, ty: W / 2, vy: 0, hp: maxHp, coins: 0, lvl: 1,
      cd: 0.4 + i * 0.2, recoil: 0, hitT: 0, repairFx: 0, coinFx: 0, queued: 0,
      bar: Int8Array.from(MASK, m => m * 2), fresh: new Uint8Array(MASK.length), goals: [],
      marks: makeMarks(i === 0 ? 1 : -1),
      btn: { power: 0, repair: 0 }, deny: { power: 0, repair: 0 },
      touches: new Map(), kUp: false, kDown: false, kFire: false, ai: { t: 0, tgt: W / 2 },
    }));
    balls = []; parts = []; pops = []; winner = -1; owners.clear();
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

  const cannonX = p => p.i === 0 ? PX0 + CANNON_OFF : PX1 - CANNON_OFF;
  const barrierX0 = p => p.i === 0 ? PX0 + BARRIER_OFF : PX1 - BARRIER_OFF - DEPTH * CELL_X;
  const colToD = (p, c) => p.i === 0 ? c : DEPTH - 1 - c;          // c = colonna in ordine di x
  function barrierRatio(p) { let s = 0; for (const h of p.bar) s += h; return s / MASK_HP; }

  // ---------- effetti ----------
  function burst(x, y, color, n, speed, dirx = 0, size = 5) {
    for (let k = 0; k < n && parts.length < 900; k++) {
      const a = Math.random() * Math.PI * 2, v = rnd(0.2, 1) * speed;
      parts.push({ x, y, vx: Math.cos(a) * v + dirx * speed * 0.6, vy: Math.sin(a) * v,
        life: rnd(0.35, 0.8), max: 0.8, c: color, s: rnd(size * 0.5, size * 1.3) });
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
    const spin = clamp(p.vy * 0.42, -L.speed * 0.55, L.speed * 0.55);
    const base = Math.asin(spin / L.speed);
    const list = L.shots === 1 ? [[base, 0]] : L.shots === 2 ? [[base, -17], [base, 17]] : [[base - 0.14, 0], [base, 0], [base + 0.14, 0]];
    for (const [a, o] of list) {
      balls.push({ x, y: clamp(p.y + o, L.r, W - L.r), vx: p.dir * Math.cos(a) * L.speed, vy: Math.sin(a) * L.speed,
        r: L.r, str: L.str, rad: L.rad, o: p.i, trail: [] });
    }
    burst(x, p.y, PL[p.i].c, 5, 160, p.dir, 4);
    p.recoil = 1;
    Sound.shoot(p.i, p.lvl);
  }

  function buyPower(p) {
    if (state !== 'play' && state !== 'countdown') return;
    if (p.lvl >= MAXLVL || p.coins < powerCost(p.lvl)) { p.deny.power = 0.35; Sound.deny(); return; }
    p.coins -= powerCost(p.lvl); p.lvl++; p.btn.power = 0.4;
    addPop(cannonX(p) + p.dir * 150, p.y, `POTENZA LV ${p.lvl}`, p.i, GOLD, true);
    burst(cannonX(p), p.y, GOLD, 30, 380); Sound.buy(); vibrate(25);
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
    if (missing <= 0 || spend <= 0) { p.deny.repair = 0.35; Sound.deny(); return; }
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
    Sound.repair(); vibrate(25);
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
    Sound.crack();
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
      Sound.hit(); vibrate(80);
      if (p.hp <= 0) kill(p, shooter);
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
      shooter.coins++; shooter.coinFx = 1;
      addPop(wx - shooter.dir * 50, b.y, '+1', shooter.i, GOLD);
      Sound.score();
    }
  }

  function kill(p, shooter) {
    state = 'over'; overT = 0; winner = shooter.i; wins[winner]++;
    const cx = cannonX(p);
    for (let k = 0; k < 5; k++) burst(cx, p.y + rnd(-50, 50), k % 2 ? '#ffffff' : PL[p.i].c, 60, 700, 0, 7);
    burst(cx, p.y, GOLD, 40, 500);
    for (const b of balls) burst(b.x, b.y, PL[b.o].c, 4, 120);
    balls = [];
    shake = 34; Sound.boom(); vibrate([120, 60, 200]);
    setTimeout(showOver, 1500);
  }

  // ---------- aggiornamento ----------
  function updatePlayer(p, dt, canFire) {
    const half = CANNON_LEN / 2 + 4;
    if (demo) {
      p.ai.t -= dt;
      if (p.ai.t <= 0) { p.ai.tgt = rnd(half, W - half); p.ai.t = rnd(0.5, 1.8); }
      p.ty = p.ai.tgt;
    }
    const prevY = p.y;
    const k = (p.kDown ? 1 : 0) - (p.kUp ? 1 : 0);
    if (k) { p.y += k * 1050 * dt; p.ty = p.y; }
    else { const m = (demo ? 700 : 2400) * dt; p.y += clamp(p.ty - p.y, -m, m); }
    p.y = clamp(p.y, half, W - half); p.ty = clamp(p.ty, half, W - half);
    p.vy = lerp(p.vy, (p.y - prevY) / Math.max(dt, 1e-3), 0.35);
    p.cd -= dt;
    const manual = !demo && fireMode === 'manual';
    const firing = demo || (manual ? p.queued > 0 : p.touches.size > 0 || p.kFire);
    if (canFire && firing && p.cd <= 0) {
      fire(p);
      p.queued = 0;
      p.cd = LEVELS[p.lvl].cd * (manual ? 0.75 : 1) + (demo ? rnd(0.1, 0.6) : 0);
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

  function updateBalls(dt) {
    for (let k = balls.length - 1; k >= 0; k--) {
      const b = balls[k];
      b.trail.push(b.x, b.y); if (b.trail.length > 22) b.trail.splice(0, 2);
      const foe = players[1 - b.o];
      const n = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 7)), h = dt / n;
      let dead = false;
      for (let s = 0; s < n && !dead; s++) {
        b.x += b.vx * h; b.y += b.vy * h;
        if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy); Sound.wall(); burst(b.x, 0, '#ffffff', 3, 120); }
        else if (b.y > W - b.r) { b.y = W - b.r; b.vy = -Math.abs(b.vy); Sound.wall(); burst(b.x, W, '#ffffff', 3, 120); }
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
        const dx = a.x - c.x, dy = a.y - c.y, rr2 = a.r + c.r;
        if (dx * dx + dy * dy < rr2 * rr2) {
          const m = Math.min(a.str, c.str); a.str -= m; c.str -= m;
          const mx = (a.x + c.x) / 2, my = (a.y + c.y) / 2;
          burst(mx, my, '#ffffff', 12, 300, 0, 4); burst(mx, my, PL[0].c, 6, 240); burst(mx, my, PL[1].c, 6, 240);
          Sound.clash();
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
    updateFx(dt);
  }

  // ---------- disegno ----------
  function drawBackground() {
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
    for (let x = MID % 48; x < PX1; x += 48) if (x > PX0) { bgx.moveTo(x, 0); bgx.lineTo(x, W); }
    for (let y = (W / 2) % 48; y < W; y += 48) { bgx.moveTo(PX0, y); bgx.lineTo(PX1, y); }
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
    bgx.shadowBlur = 16 * view.dpr; bgx.shadowColor = '#a8b4ff';
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
      ctx.shadowColor = pl.c; ctx.shadowBlur = 12 * view.dpr;
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
      // il colore si spegne con i danni
      const glowA = 1 - dmg * 0.75;
      const g = ctx.createLinearGradient(-p.dir * CANNON_T / 2, 0, p.dir * CANNON_T / 2, 0);
      g.addColorStop(0, '#0b0e22'); g.addColorStop(1, `rgba(${pl.rgb},${0.35 + 0.65 * glowA})`);
      ctx.shadowColor = pl.c; ctx.shadowBlur = 22 * view.dpr * glowA;
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

  function drawParticles() {
    for (const q of parts) {
      if (!q.smoke) continue;
      ctx.fillStyle = `rgba(${q.c},${0.45 * clamp(q.life / q.max, 0, 1)})`;
      ctx.beginPath(); ctx.arc(q.x, q.y, q.s, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'lighter';
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
      ctx.shadowColor = q.c; ctx.shadowBlur = 14 * view.dpr;
      ctx.fillStyle = q.c; ctx.fillText(q.text, 0, 0);
      ctx.restore();
    }
  }

  function coin(x, y, r) {
    ctx.save();
    ctx.shadowColor = GOLD; ctx.shadowBlur = 10 * view.dpr;
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
    ctx.fillStyle = `rgba(${pl.rgb},${ok ? 0.2 : 0.05})`; ctx.fill();
    if (ok) { ctx.shadowColor = pl.c; ctx.shadowBlur = 14 * view.dpr; }
    ctx.strokeStyle = deny > 0 ? '#ff5a5a' : `rgba(${pl.rgb},${ok ? 0.95 : 0.3})`; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.shadowBlur = 0;
    if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash})`; ctx.fill(); }
    ctx.globalAlpha = ok ? 1 : 0.45;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
    ctx.font = `700 20px ${FONT}`;
    ctx.fillText(`${icon} ${title}`, r.u + 14, r.v + 28);
    ctx.font = `500 15px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(sub, r.u + 14, r.v + 58);
    if (cost !== null) {
      coin(r.u + r.w - 22, r.v + 58, 10);
      ctx.textAlign = 'right'; ctx.fillStyle = GOLD; ctx.font = `800 18px ${FONT}`;
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
    ctx.shadowColor = pl.c; ctx.shadowBlur = 10 * view.dpr;
    ctx.fillText(pl.name, 24, 30);
    ctx.shadowBlur = 0;
    ctx.font = `500 13px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText(`VITTORIE ${wins[p.i]}`, 24 + ctx.measureText(pl.name).width + 70, 31);
    // vite
    for (let k = 0; k < maxHp; k++) {
      rr(ctx, 24 + k * 27, 54, 21, 21, 5);
      if (k < p.hp) { ctx.fillStyle = pl.c; ctx.fill(); }
      else { ctx.strokeStyle = `rgba(${pl.rgb},0.4)`; ctx.lineWidth = 2; ctx.stroke(); }
    }
    ctx.font = `500 12px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(`LIVELLO FUOCO ${p.lvl}`, 24, 100);
    // monete
    const lay = hudLayout();
    const cxp = Math.max(24 + maxHp * 27 + 40, 240);
    const sc = 1 + p.coinFx * 0.35;
    ctx.save();
    ctx.translate(cxp, HUD / 2 + 2); ctx.scale(sc, sc);
    coin(0, 0, 17);
    ctx.font = `900 36px ${FONT}`; ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
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
    ctx.fillStyle = 'rgba(10,12,30,0.8)'; ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(MID, W / 2, 30, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff';
    // le barre sono parallele alla linea centrale, quindi leggibili da entrambi i lati
    ctx.fillRect(MID - 9, W / 2 - 11, 6, 22);
    ctx.fillRect(MID + 3, W / 2 - 11, 6, 22);
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
        ctx.shadowColor = pl.c; ctx.shadowBlur = 30 * view.dpr; ctx.fillStyle = '#fff';
        ctx.fillText(String(n), 0, -20);
        if (firstMatch) {
          ctx.globalAlpha = 1; ctx.shadowBlur = 0;
          ctx.font = `600 20px ${FONT}`; ctx.fillStyle = pl.c;
          ctx.fillText(fireMode === 'manual' ? 'TOCCA NELLA TUA METÀ: OGNI TOCCO UN COLPO' : 'TIENI IL DITO NELLA TUA METÀ: MUOVI E SPARA', 0, 100);
        }
      } else if (goT > 0) {
        ctx.globalAlpha = goT / 0.8;
        ctx.font = `900 ${120 + (0.8 - goT) * 80}px ${FONT}`;
        ctx.shadowColor = pl.c; ctx.shadowBlur = 30 * view.dpr; ctx.fillStyle = pl.c;
        ctx.fillText('VIA!', 0, 0);
      } else if (state === 'over' && overT > 0.5) {
        const won = p.i === winner;
        ctx.globalAlpha = clamp((overT - 0.5) * 2, 0, 1);
        ctx.font = `900 84px ${FONT}`;
        ctx.shadowColor = won ? GOLD : pl.c; ctx.shadowBlur = 30 * view.dpr;
        ctx.fillStyle = won ? GOLD : 'rgba(255,255,255,0.85)';
        ctx.fillText(won ? 'VITTORIA!' : 'SCONFITTA', 0, -150);
        ctx.shadowBlur = 0; ctx.font = `600 24px ${FONT}`; ctx.fillStyle = '#fff';
        ctx.fillText(`${PL[0].name} ${wins[0]}  –  ${wins[1]} ${PL[1].name}`, 0, -80);
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
    setField(ctx, sx, sy);
    drawGoals(); drawBarriers(); drawCannons(); drawBalls(); drawParticles(); drawPops();
    setField(ctx);
    if (!demo) {
      if (state === 'play' || state === 'countdown') drawPauseBtn();
      for (const p of players) drawHud(p);
      drawCenterTexts();
    }
  }

  // ---------- flusso di gioco ----------
  const $ = id => document.getElementById(id);
  const show = (id, on) => $(id).classList.toggle('show', on);

  function startMatch() {
    newMatch(false);
    state = 'countdown'; countdown = 3; goT = 0;
    show('menu', false); show('pause', false); show('over', false);
    keepAwake();
  }
  function toMenu() {
    newMatch(true); state = 'menu';
    show('pause', false); show('over', false); show('menu', true);
  }
  function pause() {
    if (state !== 'play' && state !== 'countdown') return;
    pausedFrom = state; state = 'paused';
    for (const p of players) p.touches.clear();
    owners.clear();
    show('pause', true);
  }
  function resume() { if (state === 'paused') { state = pausedFrom; show('pause', false); } }
  function showOver() {
    if (state !== 'over') return;
    $('over-title').textContent = `VINCE ${PL[winner].name}`;
    $('over-title').style.color = PL[winner].c;
    $('over-score').textContent = `${PL[0].name} ${wins[0]} – ${wins[1]} ${PL[1].name}`;
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
    if (Math.hypot(f.x - MID, f.y - W / 2) < 42) { pause(); return; }
    const p = players[f.x < MID ? 0 : 1];
    const l = toLocal(p, f);
    if (l.v >= 0 && l.v <= HUD) {
      const lay = hudLayout();
      if (inRect(l, lay.power)) { buyPower(p); return; }
      if (inRect(l, lay.repair)) { buyRepair(p); return; }
    }
    owners.set(e.pointerId, p.i);
    p.touches.set(e.pointerId, f.y);
    p.ty = f.y;
    if (fireMode === 'manual' && state === 'play') p.queued = 0.6;
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* niente */ }
  });
  cv.addEventListener('pointermove', e => {
    const i = owners.get(e.pointerId);
    if (i === undefined) return;
    const f = toField(e.clientX, e.clientY);
    players[i].ty = f.y;
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
  const KEYS = { KeyW: [0, 'kUp'], KeyS: [0, 'kDown'], KeyD: [0, 'kFire'], ArrowUp: [1, 'kUp'], ArrowDown: [1, 'kDown'], ArrowLeft: [1, 'kFire'] };
  window.addEventListener('keydown', e => {
    Sound.init();
    if (e.code === 'Escape' || e.code === 'Space') {
      if (state === 'paused') resume(); else pause();
      e.preventDefault(); return;
    }
    if (demo) return;
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
  function syncOpts() {
    document.querySelectorAll('#hp-seg button').forEach(x => x.classList.toggle('on', +x.dataset.hp === maxHp));
    document.querySelectorAll('#fire-seg button').forEach(x => x.classList.toggle('on', x.dataset.fire === fireMode));
    $('fire-hint').textContent = FIRE_HINT[fireMode];
  }
  document.querySelectorAll('#hp-seg button').forEach(b => b.addEventListener('click', () => { maxHp = +b.dataset.hp; saveOpts(); syncOpts(); }));
  document.querySelectorAll('#fire-seg button').forEach(b => b.addEventListener('click', () => { fireMode = b.dataset.fire; saveOpts(); syncOpts(); }));
  syncOpts();
  $('btn-start').addEventListener('click', () => { Sound.init(); wins[0] = wins[1] = 0; firstMatch = true; startMatch(); });
  $('btn-again').addEventListener('click', () => { Sound.init(); startMatch(); });
  $('btn-resume').addEventListener('click', resume);
  $('btn-restart').addEventListener('click', startMatch);
  $('btn-menu').addEventListener('click', toMenu);
  $('btn-menu2').addEventListener('click', toMenu);
  $('btn-sound').addEventListener('click', () => {
    Sound.on = !Sound.on; Sound.init();
    $('btn-sound').textContent = Sound.on ? '🔊 Audio sì' : '🔇 Audio no';
  });
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
  window.__pi = { get state() { return state; }, get players() { return players; }, get balls() { return balls; } };
})();
