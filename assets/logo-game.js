/* Mini gioco dell'omino VanHoly.
 * Cliccando (o toccando, o con Invio) la testa dell'omino in uno dei loghi del titolo, l'omino si stacca
 * e cade nella pagina fino al bordo superiore di un riquadro. I bordi dei riquadri sono le piattaforme:
 * ← → per muoversi, ↑ o spazio per saltare (sul telefono pulsanti sullo schermo). Se cammina oltre il bordo
 * di un riquadro (al centro, tra i due riquadri, o ai lati sul telefono) precipita; se cade fuori dalla
 * pagina precipita nel vuoto e si disintegra, poi ricompare al suo posto nel logo.
 * ↓ (o il pulsante ⤓) scende attraverso il bordo verso il piano successivo: se scendendo tocca l'icona di un
 * riquadro (🍺 💹 🎮 ⛽) entra in quella sezione, cioè apre la sua pagina.
 * Esc o ✕ per uscire: l'omino torna al suo posto. */
(() => {
  'use strict';
  const logos = [...document.querySelectorAll('.hub-logo')];
  if (!logos.length || !Element.prototype.animate) return;

  const NS = 'http://www.w3.org/2000/svg';
  const VB = { x: 240, y: 8, w: 590, h: 1050 };            // ritaglio del solo omino (antenna + corpo) nel viewBox del logo
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  let game = null;

  const css = document.createElement('style');
  css.textContent = `
    .hub-logo .vh-head { cursor: pointer; pointer-events: all; -webkit-tap-highlight-color: transparent; }
    .hub-logo .vh-head:focus { outline: none; }
    .hub-logo .vh-head:focus-visible { stroke: #fff; stroke-width: 10; stroke-dasharray: 20 16; }
    body.vh-playing .hub-logo .vh-character, body.vh-playing .hub-logo .vh-antenna-mast, body.vh-playing .hub-logo .vh-antenna-star { opacity: 0; }
    body.vh-playing .section-card:hover { transform: none; }
    .vh-player { position: absolute; left: 0; top: 0; z-index: 9000; pointer-events: none; will-change: transform; }
    .vh-player svg { display: block; width: 100%; height: 100%; overflow: visible;
      filter: drop-shadow(0 0 14px rgba(0, 212, 255, 0.55)); transform-origin: 50% 100%; }
    .vh-ui { position: fixed; inset: 0; z-index: 9500; pointer-events: none; }
    .vh-ui button { pointer-events: auto; position: absolute; border: 1px solid rgba(0, 255, 200, 0.45); border-radius: 50%;
      background: rgba(5, 10, 24, 0.55); color: #00ffc8; font: 700 26px 'Orbitron', sans-serif; width: 66px; height: 66px;
      display: flex; align-items: center; justify-content: center; touch-action: none; user-select: none; -webkit-user-select: none;
      -webkit-tap-highlight-color: transparent; backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
      box-shadow: 0 0 18px rgba(0, 212, 255, 0.25); cursor: pointer; }
    .vh-ui button.on { background: rgba(0, 255, 200, 0.25); }
    .vh-ui .vh-close { top: 14px; right: 14px; width: 46px; height: 46px; font-size: 20px; }
    .vh-ui .vh-left { left: 16px; bottom: calc(18px + env(safe-area-inset-bottom)); }
    .vh-ui .vh-right { left: 96px; bottom: calc(18px + env(safe-area-inset-bottom)); }
    .vh-ui .vh-down { left: 176px; bottom: calc(18px + env(safe-area-inset-bottom)); }
    .vh-flash { position: fixed; inset: 0; z-index: 9900; pointer-events: none; opacity: 0;
      background: radial-gradient(circle at var(--fx, 50%) var(--fy, 50%), #ffffff 0%, rgba(0, 255, 200, 0.9) 25%, rgba(5, 10, 24, 1) 70%); }
    .vh-ui .vh-jump { right: 16px; bottom: calc(18px + env(safe-area-inset-bottom)); width: 76px; height: 76px; }
    .vh-ui .vh-hint { position: absolute; left: 50%; bottom: 22px; transform: translateX(-50%); padding: 10px 18px; border-radius: 12px;
      background: rgba(5, 10, 24, 0.75); color: rgba(255, 255, 255, 0.85); font: 14px 'Roboto', sans-serif; white-space: nowrap;
      border: 1px solid rgba(0, 255, 200, 0.3); }
    .vh-void { position: fixed; inset: 0; z-index: 9800; pointer-events: none; }
    .vh-beam { position: fixed; z-index: 9100; pointer-events: none; transform: translateX(-50%);
      background: linear-gradient(to bottom, rgba(0,255,200,0), rgba(0,255,200,0.75) 40%, rgba(255,255,255,0.95) 60%, rgba(0,212,255,0));
      filter: blur(2px); border-radius: 50%; }
  `;
  document.head.appendChild(css);

  // area cliccabile sulla testa dell'omino, in ogni logo
  logos.forEach((svg, i) => {
    const hit = document.createElementNS(NS, 'ellipse');
    hit.setAttribute('cx', '511'); hit.setAttribute('cy', '370'); hit.setAttribute('rx', '175'); hit.setAttribute('ry', '170');
    hit.setAttribute('fill', 'transparent'); hit.setAttribute('class', 'vh-head');
    const tip = document.createElementNS(NS, 'title'); tip.textContent = 'Giochiamo?'; hit.appendChild(tip);
    if (i === 0) { hit.setAttribute('tabindex', '0'); hit.setAttribute('role', 'button'); hit.setAttribute('aria-label', "Fai scendere l'omino a giocare"); }
    svg.appendChild(hit);
    hit.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); start(svg); });
    hit.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); start(svg); } });
  });

  // icone dei riquadri (🍺 💹 🎮 ⛽): riquadro del solo disegno dell'emoji, in pixel della pagina, e pagina della sezione
  function icons() {
    return [...document.querySelectorAll('.section-card')].map(card => {
      const icon = card.querySelector('.section-icon'), link = card.querySelector('a.section-btn');
      if (!icon || !link) return null;
      const range = document.createRange(); range.selectNodeContents(icon);
      const r = range.getBoundingClientRect(), shrink = r.width * 0.15;
      return { icon, href: link.href, box: { x1: r.left + scrollX + shrink, x2: r.right + scrollX - shrink, y1: r.top + scrollY + shrink, y2: r.bottom + scrollY - shrink } };
    }).filter(Boolean);
  }
  function touchedIcon(x1, y1, x2, y2) {
    return icons().find(c => x1 < c.box.x2 && x2 > c.box.x1 && y1 < c.box.y2 && y2 > c.box.y1) || null;
  }

  // posizione nella pagina ignorando le trasformazioni (i riquadri si sollevano al passaggio del mouse)
  function pageBox(el) {
    let x = 0, y = 0, n = el;
    while (n) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight };
  }
  const platforms = () => [...document.querySelectorAll('.section-card')].map(pageBox).map(b => ({ x1: b.x, x2: b.x + b.w, y: b.y }));
  const docH = () => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
  const docW = () => document.documentElement.clientWidth;

  // markup dell'omino (antenna + corpo) preso dal logo, con i gradienti del titolo
  function characterMarkup(src) {
    const first = logos[0];
    const defs = first.querySelector('defs') ? first.querySelector('defs').outerHTML : '';
    const mast = src.querySelector('.vh-antenna-mast').outerHTML.replace(/class="[^"]*"/, '');
    const star = src.querySelector('.vh-antenna-star').outerHTML.replace(/class="[^"]*"/, 'class="pl-star"');
    const body = src.querySelector('.vh-character').innerHTML;
    return { defs, inner: `${mast}${star}<g class="pl-body">${body}</g>` };
  }

  function start(src) {
    if (game) return;
    document.body.classList.add('vh-playing');
    const lr = src.getBoundingClientRect();
    const s = lr.height / 1536;                              // pixel per unità del logo
    const mirrored = src.classList.contains('hub-logo--alt');
    const w = VB.w * s, h = VB.h * s;
    const x0 = lr.left + (mirrored ? (1024 - VB.x - VB.w) : VB.x) * s + scrollX;
    const y0 = lr.top + VB.y * s + scrollY;

    const mk = characterMarkup(src);
    const el = document.createElement('div');
    el.className = 'vh-player';
    el.style.width = w + 'px'; el.style.height = h + 'px';
    el.innerHTML = `<svg xmlns="${NS}" viewBox="${VB.x} ${VB.y} ${VB.w} ${VB.h}" aria-hidden="true">${mk.inner}</svg>`;
    document.body.appendChild(el);
    const svg = el.firstChild, star = svg.querySelector('.pl-star');
    star.style.transformBox = 'view-box'; star.style.transformOrigin = '516px 72px';

    // immagine dell'omino per la disintegrazione (pixel -> particelle)
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
      `<svg xmlns="${NS}" viewBox="${VB.x} ${VB.y} ${VB.w} ${VB.h}" width="${Math.round(w * 2)}" height="${Math.round(h * 2)}">${mk.defs}${mk.inner}</svg>`);

    // comandi
    const ui = document.createElement('div');
    ui.className = 'vh-ui';
    ui.innerHTML = `<button class="vh-close" aria-label="Esci dal gioco">✕</button>` +
      (coarse ? `<button class="vh-left" aria-label="Sinistra">◀</button><button class="vh-right" aria-label="Destra">▶</button><button class="vh-down" aria-label="Scendi">⤓</button><button class="vh-jump" aria-label="Salta">⤒</button>`
              : `<div class="vh-hint">← → per muoverti · ↑ o spazio per saltare · ↓ per scendere · Esc per uscire</div>`);
    document.body.appendChild(ui);
    const hint = ui.querySelector('.vh-hint');
    if (hint) hint.animate([{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }], { duration: 5000, fill: 'forwards' });

    const keys = { left: false, right: false, jump: false, down: false };
    // ogni pressione di salto o discesa viene ricordata per un attimo: anche un tocco velocissimo non va perso
    const buf = { jump: 0, down: 0 };
    const tap = k => { if (k in buf) buf[k] = 0.12; };
    const hold = (sel, k) => {
      const b = ui.querySelector(sel); if (!b) return;
      const on = e => { e.preventDefault(); keys[k] = true; tap(k); b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch (_) { /* niente */ } };
      const off = () => { keys[k] = false; b.classList.remove('on'); };
      b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', off);
    };
    hold('.vh-left', 'left'); hold('.vh-right', 'right'); hold('.vh-jump', 'jump'); hold('.vh-down', 'down');
    ui.querySelector('.vh-close').addEventListener('click', () => quit());

    const onKey = (e, down) => {
      const k = e.key;
      if (k === 'Escape' && down) { quit(); return; }
      let used = true;
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.left = down;
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.right = down;
      else if (k === 'ArrowUp' || k === ' ' || k === 'w' || k === 'W') { keys.jump = down; if (down && !e.repeat) tap('jump'); }
      else if (k === 'ArrowDown' || k === 's' || k === 'S') { keys.down = down; if (down && !e.repeat) tap('down'); }
      else used = false;
      if (used) e.preventDefault();
    };
    const kd = e => onKey(e, true), ku = e => onKey(e, false);
    addEventListener('keydown', kd); addEventListener('keyup', ku);

    // fisica (in pixel della pagina), proporzionata alla grandezza dell'omino
    const G = 2300, SPEED = coarse ? 260 : 320, JUMP = Math.sqrt(2 * G * Math.max(170, h * 2));
    const p = { x: x0, y: y0, vx: 0, vy: -420, ground: null, face: mirrored ? -1 : 1, squash: 0, walk: 0, coyote: 0, drop: null, jumpAt: 0 };
    let last = performance.now(), raf = 0, ended = false;

    const frame = now => {
      const dt = Math.min(0.033, (now - last) / 1000); last = now;
      const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      // movimento orizzontale con un po' di inerzia
      const target = dir * SPEED;
      p.vx += (target - p.vx) * Math.min(1, dt * (p.ground ? 14 : 6));
      if (dir) p.face = dir;
      // salto (anche un attimo dopo aver lasciato il bordo)
      p.coyote = p.ground ? 0.09 : Math.max(0, p.coyote - dt);
      if (buf.jump > 0 && (p.ground || p.coyote > 0)) { p.vy = -JUMP; p.ground = null; p.coyote = 0; p.squash = -0.15; buf.jump = 0; p.jumpAt = now; }
      // salto più basso se si lascia presto (un tocco rapido dà comunque un saltello)
      if (!keys.jump && now - p.jumpAt > 90 && p.vy < -JUMP * 0.45) p.vy = -JUMP * 0.45;
      // ↓: scende attraverso il bordo su cui si trova, verso il piano successivo
      if (buf.down > 0 && p.ground) { p.drop = p.ground.y; p.ground = null; p.vy = 160; p.squash = -0.12; buf.down = 0; }
      buf.jump = Math.max(0, buf.jump - dt); buf.down = Math.max(0, buf.down - dt);
      // gravità
      const prevBottom = p.y + h;
      p.vy = Math.min(p.vy + G * dt, 1500);
      p.x += p.vx * dt; p.y += p.vy * dt;
      // si può uscire un po' dai lati: così sul telefono si cade oltre i bordi dei riquadri
      p.x = clamp(p.x, -w * 0.45, docW() - w * 0.55);
      // appoggio sui bordi dei riquadri: conta il punto dei piedi (al centro dell'omino)
      const foot = p.x + w / 2;
      const plats = platforms();
      if (p.ground) {
        const g = plats.find(q => Math.abs(q.y - (p.y + h)) < 3 && foot >= q.x1 && foot <= q.x2);
        if (!g) p.ground = null; else { p.y = g.y - h; p.vy = 0; }
      }
      if (!p.ground && p.vy >= 0) {
        for (const q of plats) {
          if (p.drop !== null && Math.abs(q.y - p.drop) < 2) continue;      // il bordo da cui sta scendendo
          if (foot >= q.x1 && foot <= q.x2 && prevBottom <= q.y + 1 && p.y + h >= q.y) {
            p.y = q.y - h; p.ground = q; p.squash = Math.min(0.28, p.vy / 3000); p.vy = 0;
            break;
          }
        }
      }
      // caduto fuori dalla pagina: nel vuoto
      if (p.drop !== null && p.y + h > p.drop + 24) p.drop = null;
      if (p.y + h * 0.5 > docH()) { fallIntoVoid(); return; }
      // ha toccato l'icona di un riquadro: entra nella sezione
      const hitIcon = touchedIcon(p.x + w * 0.25, p.y + h * 0.2, p.x + w * 0.75, p.y + h * 0.95);
      if (hitIcon) { enterSection(hitIcon); return; }

      // la pagina segue l'omino
      const sy = p.y - scrollY;
      if (sy > innerHeight * 0.62) scrollTo(0, scrollY + (sy - innerHeight * 0.62) * Math.min(1, dt * 8));
      else if (sy < innerHeight * 0.22 && scrollY > 0) scrollTo(0, Math.max(0, scrollY + (sy - innerHeight * 0.22) * Math.min(1, dt * 8)));

      // aspetto: camminata, inclinazione, schiacciamento all'atterraggio, allungamento in volo
      p.squash *= Math.pow(0.0005, dt);
      const moving = p.ground && Math.abs(p.vx) > 30;
      p.walk += moving ? dt * 16 : 0;
      const bob = moving ? Math.abs(Math.sin(p.walk)) * -4 : 0;
      const tilt = p.ground ? p.vx / SPEED * 7 : clamp(p.vx / SPEED * 12, -14, 14);
      const air = p.ground ? 0 : clamp(-p.vy / 6000, -0.12, 0.12);
      const sq = p.squash;
      el.style.transform = `translate3d(${p.x}px, ${p.y + bob}px, 0)`;
      svg.style.transform = `scaleX(${p.face}) rotate(${tilt * p.face}deg) scale(${1 + sq * 0.8 - air * 0.5}, ${1 - sq + air})`;
      star.style.transform = `rotate(${clamp(-p.vx / 20 + (p.ground ? 0 : p.vy / 60), -35, 35)}deg)`;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    // ingresso nella sezione: l'icona si accende, l'omino ci viene risucchiato, lampo di luce, si apre la pagina
    function enterSection(target) {
      if (ended) return;
      cleanup();
      const { icon, href, box } = target;
      const cx = (box.x1 + box.x2) / 2, cy = (box.y1 + box.y2) / 2;            // in pixel della pagina
      const go = () => { location.href = href; };
      if (reduce) { go(); return; }
      icon.animate([
        { transform: 'scale(1) rotate(0deg)', filter: 'brightness(1)' },
        { transform: 'scale(1.35) rotate(-10deg)', filter: 'brightness(1.6) drop-shadow(0 0 30px #ffffff)', offset: 0.4 },
        { transform: 'scale(1.6) rotate(6deg)', filter: 'brightness(2.2) drop-shadow(0 0 50px #00ffc8)' },
      ], { duration: 750, fill: 'forwards', easing: 'ease-out' });
      el.animate([
        { transform: el.style.transform, opacity: 1 },
        { transform: `translate3d(${cx - w / 2}px, ${cy - h / 2}px, 0) scale(0.15) rotate(540deg)`, opacity: 0.2 },
      ], { duration: 600, fill: 'forwards', easing: 'cubic-bezier(.5,0,.8,.4)' });
      const flash = document.createElement('div');
      flash.className = 'vh-flash';
      flash.style.setProperty('--fx', (cx - scrollX) + 'px'); flash.style.setProperty('--fy', (cy - scrollY) + 'px');
      document.body.appendChild(flash);
      flash.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, delay: 560, fill: 'forwards' });
      setTimeout(go, 830);
    }

    function cleanup() {
      ended = true;
      cancelAnimationFrame(raf);
      removeEventListener('keydown', kd); removeEventListener('keyup', ku);
      ui.remove();
    }

    // ricompare al suo posto nel logo, con un raggio di teletrasporto
    function respawn() {
      el.remove();
      const r = src.getBoundingClientRect();
      const beam = document.createElement('div');
      beam.className = 'vh-beam';
      beam.style.left = (r.left + r.width / 2) + 'px'; beam.style.top = (r.top - r.height * 0.3) + 'px';
      beam.style.width = r.width * 0.5 + 'px'; beam.style.height = r.height * 1.3 + 'px';
      document.body.appendChild(beam);
      document.body.classList.remove('vh-playing');
      const parts = ['.vh-character', '.vh-antenna-mast', '.vh-antenna-star'].map(q => src.querySelector(q));
      if (!reduce) {
        beam.animate([{ opacity: 0, transform: 'translateX(-50%) scaleY(0)' }, { opacity: 1, transform: 'translateX(-50%) scaleY(1)', offset: 0.3 },
          { opacity: 1, transform: 'translateX(-50%) scaleX(0.6)', offset: 0.7 }, { opacity: 0, transform: 'translateX(-50%) scaleX(0)' }], { duration: 900, easing: 'ease-out' }).onfinish = () => beam.remove();
        parts.forEach(n => n.animate([{ opacity: 0 }, { opacity: 0.3, offset: 0.3 }, { opacity: 0 , offset: 0.4 }, { opacity: 0.7, offset: 0.55 }, { opacity: 0.2, offset: 0.65 }, { opacity: 1 }], { duration: 800, delay: 150 }));
        src.animate([{ scale: '1' }, { scale: '1.15' }, { scale: '1' }], { duration: 500, delay: 800, easing: 'ease-out' });
      } else beam.remove();
      game = null;
    }

    // uscita con Esc o ✕: l'omino si dissolve e torna al suo posto
    function quit() {
      if (ended) return;
      cleanup();
      const back = () => respawn();
      if (reduce) { back(); return; }
      el.animate([{ opacity: 1, filter: 'brightness(1)' }, { opacity: 1, filter: 'brightness(2.5)', offset: 0.4 }, { opacity: 0, filter: 'brightness(3)' }],
        { duration: 450, fill: 'forwards' });
      svg.animate([{ transform: svg.style.transform }, { transform: 'scale(0.2, 1.6)' }], { duration: 450, fill: 'forwards', easing: 'ease-in' });
      setTimeout(() => { scrollTo({ top: 0, behavior: 'smooth' }); setTimeout(back, scrollY > 40 ? 650 : 0); }, 460);
    }

    // caduto fuori dalla pagina: precipita nel vuoto girando, poi si disintegra in polvere luminosa
    function fallIntoVoid() {
      if (ended) return;
      cleanup();
      const r = el.getBoundingClientRect();
      el.remove();
      const void_ = document.createElement('div'); void_.className = 'vh-void';
      const cv = document.createElement('canvas'); void_.appendChild(cv);
      document.body.appendChild(void_);
      const dpr = Math.min(devicePixelRatio || 1, 2), W = innerWidth, H = innerHeight;
      cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
      const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const finish = () => { void_.remove(); scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); setTimeout(respawn, reduce ? 0 : 700); };
      if (reduce || !img.complete || !img.naturalWidth) { setTimeout(finish, reduce ? 300 : 0); return; }

      // fase 1: precipita nel vuoto girando; la "telecamera" lo insegue e lo ingrandisce al centro
      const T1 = 1100, T2 = 2000, ZOOM = Math.min(3, (H * 0.55) / r.height);
      const sx = r.left + r.width / 2, sy0 = r.top + r.height / 2;
      const vx = W / 2, vy = H * 0.5;                                    // centro del vuoto
      let parts = null, t0 = performance.now(), lastT = t0;
      const ease = t => 1 - Math.pow(1 - t, 3);
      const draw = now => {
        const t = now - t0, dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
        ctx.clearRect(0, 0, W, H);
        // il vuoto: buio che sale dal basso, con un vortice
        const dark = Math.min(1, t / 400) * (t > T1 + T2 - 500 ? Math.max(0, (T1 + T2 - t) / 500) : 1);
        const g = ctx.createRadialGradient(vx, vy, 10, vx, vy, Math.max(W, H) * 0.9);
        g.addColorStop(0, `rgba(0,0,0,${0.95 * dark})`); g.addColorStop(0.35, `rgba(3,6,20,${0.75 * dark})`); g.addColorStop(1, `rgba(3,6,20,${0.25 * dark})`);
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = `rgba(0,212,255,${0.18 * dark})`; ctx.lineWidth = 2;
        for (let k = 0; k < 7; k++) {
          ctx.beginPath();
          for (let a = 0; a < 6.3; a += 0.2) { const rr = (40 + k * 45) * (1 + 0.15 * Math.sin(a * 3 + t / 200 + k)); const aa = a + t / (600 + k * 90); ctx.lineTo(vx + Math.cos(aa) * rr * 1.6, vy + Math.sin(aa) * rr * 0.55); }
          ctx.closePath(); ctx.stroke();
        }
        if (t < T1) {
          const k = ease(t / T1), sc = 1 + k * (ZOOM - 1), rot = k * Math.PI * 2;
          const x = sx + (vx - sx) * k, y = sy0 + (vy - sy0) * k;
          ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
          const iw = r.width * sc, ih = r.height * sc;
          // sdoppiamento colorato (glitch) che aumenta mentre cade
          ctx.globalAlpha = 0.5 * k; ctx.globalCompositeOperation = 'lighter';
          ctx.drawImage(img, -iw / 2 - 6 * k, -ih / 2, iw, ih); ctx.drawImage(img, -iw / 2 + 6 * k, -ih / 2, iw, ih);
          ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
          ctx.drawImage(img, -iw / 2, -ih / 2, iw, ih);
          ctx.restore();
        } else {
          if (!parts) {
            // fase 2: i pixel dell'omino diventano particelle che si sfaldano verso l'alto
            const iw = Math.max(1, Math.round(r.width * ZOOM)), ih = Math.max(1, Math.round(r.height * ZOOM));
            const off = document.createElement('canvas'); off.width = iw; off.height = ih;
            const oc = off.getContext('2d'); oc.drawImage(img, 0, 0, iw, ih);
            const data = oc.getImageData(0, 0, iw, ih).data;
            parts = [];
            const step = Math.max(2, Math.round(Math.sqrt(iw * ih / 2600)));
            for (let yy = 0; yy < ih; yy += step) for (let xx = 0; xx < iw; xx += step) {
              const i4 = (yy * iw + xx) * 4;
              if (data[i4 + 3] < 120) continue;
              parts.push({ x: vx - iw / 2 + xx, y: vy - ih / 2 + yy, c: `rgb(${data[i4]},${data[i4 + 1]},${data[i4 + 2]})`,
                vx: rnd(-60, 60) + (xx - iw / 2) * 1.2, vy: rnd(-220, -60), d: rnd(0, 0.35) + yy / ih * 0.7, s: step * 1.1, life: 1 });
            }
          }
          const tt = (t - T1) / 1000;
          ctx.globalCompositeOperation = 'lighter';
          for (const q of parts) {
            if (tt < q.d) { ctx.fillStyle = q.c; ctx.fillRect(q.x, q.y, q.s, q.s); continue; }       // si sfalda dall'alto verso il basso
            q.vx += Math.sin(q.y / 18 + tt * 6) * 220 * dt; q.vy -= 60 * dt;
            q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt * 0.75;
            if (q.life <= 0) continue;
            ctx.globalAlpha = q.life; ctx.fillStyle = Math.random() < 0.06 ? '#ffffff' : q.c;
            ctx.fillRect(q.x, q.y, q.s * (0.6 + q.life * 0.6), q.s * (0.6 + q.life * 0.6));
          }
          ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        }
        if (t < T1 + T2) requestAnimationFrame(draw); else finish();
      };
      requestAnimationFrame(draw);
    }

    game = { quit };
  }

  // l'animazione della sfera non parte mentre si gioca
  window.__vhGameActive = () => !!game;

  // tornando indietro dalla sezione (pagina ripristinata dalla cache del browser) si riparte puliti
  addEventListener('pageshow', e => {
    if (!e.persisted) return;
    document.querySelectorAll('.vh-player, .vh-ui, .vh-flash, .vh-void, .vh-beam').forEach(n => n.remove());
    document.querySelectorAll('.section-icon').forEach(n => n.getAnimations().forEach(a => a.cancel()));
    document.body.classList.remove('vh-playing');
    game = null;
  });
})();
