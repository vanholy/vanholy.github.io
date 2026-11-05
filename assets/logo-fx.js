/* Animazione a schermo intero del logo VanHoly.
 * Si avvia cliccando (o toccando, o con Invio) la sfera di energia sotto uno dei loghi nel titolo.
 * Sequenza: la sfera si carica -> il logo salta fuori dalla pagina girando e si ingrandisce al centro,
 * con un campo di stelle in "iperspazio" -> si potenzia (salti elastici, antenna che gira e sprizza
 * scintille, occhio che si accende, onde d'energia, scritta che compare) -> torna al suo posto.
 * Un tocco o Esc la interrompono. Con "riduci movimento" attivo parte una versione calma. */
(() => {
  'use strict';
  const logos = [...document.querySelectorAll('.hub-logo')];
  if (!logos.length || !Element.prototype.animate) return;

  const NS = 'http://www.w3.org/2000/svg';
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rnd = (a, b) => a + Math.random() * (b - a);
  let running = null;

  const css = document.createElement('style');
  css.textContent = `
    .hub-logo .vh-hit { cursor: pointer; pointer-events: all; -webkit-tap-highlight-color: transparent; }
    .hub-logo .vh-hit:focus { outline: none; }
    .hub-logo .vh-hit:focus-visible { stroke: #fff; stroke-width: 10; stroke-dasharray: 20 16; }
    .vh-fx { position: fixed; inset: 0; z-index: 9999; overflow: hidden; cursor: pointer; opacity: 0;
      background: radial-gradient(circle at 50% 50%, #0b2a3a 0%, #060818 55%, #020309 100%); }
    .vh-fx canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
    .vh-fx-stage { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; }
    .vh-fx-logo { height: min(70vh, 115vw); width: auto; overflow: visible;
      filter: drop-shadow(0 0 28px rgba(0, 212, 255, 0.55)) drop-shadow(0 0 60px rgba(0, 255, 136, 0.25)); }
    .vh-fx-title { position: absolute; left: 0; right: 0; bottom: 4vh; text-align: center; pointer-events: none;
      font: 900 clamp(26px, 7vw, 84px) 'Orbitron', sans-serif; letter-spacing: 0.12em; white-space: nowrap; }
    .vh-fx-title span { display: inline-block; opacity: 0; color: #00ffc8;
      text-shadow: 0 0 18px rgba(0, 212, 255, 0.9), 0 0 42px rgba(0, 255, 136, 0.5); }
    .vh-fx-hint { position: absolute; top: 14px; right: 16px; font: 12px 'Roboto', sans-serif; color: rgba(255, 255, 255, 0.4); }
    .vh-ring { position: fixed; z-index: 10000; pointer-events: none; border-radius: 50%;
      border: 3px solid #00ffc8; box-shadow: 0 0 18px #00d4ff, inset 0 0 12px #00ff88; }
  `;
  document.head.appendChild(css);

  // area cliccabile (invisibile, più grande della sfera) su ogni logo
  logos.forEach((svg, i) => {
    const hit = document.createElementNS(NS, 'circle');
    hit.setAttribute('cx', '516'); hit.setAttribute('cy', '1210'); hit.setAttribute('r', '190');
    hit.setAttribute('fill', 'transparent'); hit.setAttribute('class', 'vh-hit');
    if (i === 0) {
      hit.setAttribute('tabindex', '0'); hit.setAttribute('role', 'button');
      hit.setAttribute('aria-label', "Avvia l'animazione del logo");
    }
    svg.appendChild(hit);
    hit.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); launch(svg); });
    hit.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); launch(svg); } });
  });

  // onda d'urto (anello che si allarga) in un punto dello schermo
  function ring(x, y, size = 260, dur = 650, color) {
    const r = document.createElement('div');
    r.className = 'vh-ring';
    if (color) r.style.borderColor = color;
    r.style.left = x + 'px'; r.style.top = y + 'px'; r.style.width = r.style.height = '10px';
    document.body.appendChild(r);
    r.animate([
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
      { transform: `translate(-50%,-50%) scale(${size / 10})`, opacity: 0 },
    ], { duration: dur, easing: 'cubic-bezier(.15,.7,.3,1)' }).onfinish = () => r.remove();
  }

  function center(el) { const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width, h: b.height }; }

  function launch(src) {
    if (running || (window.__vhGameActive && window.__vhGameActive())) return;   // non durante il gioco dell'omino
    const anims = [];
    const A = (el, kf, opt) => { const a = el.animate(kf, { fill: 'forwards', ...opt }); anims.push(a); return a; };

    // 1) la sfera si carica
    const srcCore = src.querySelector('.vh-energy-core');
    const c0 = center(srcCore);
    ring(c0.x, c0.y, 140, 500);
    srcCore.animate([{ transform: 'scale(1)' }, { transform: 'scale(2)', filter: 'brightness(2.2)' }, { transform: 'scale(1)' }], { duration: 420, easing: 'ease-out' });

    // 2) scena a schermo intero
    const fx = document.createElement('div');
    fx.className = 'vh-fx';
    const cv = document.createElement('canvas');
    const stage = document.createElement('div'); stage.className = 'vh-fx-stage';
    const hint = document.createElement('div'); hint.className = 'vh-fx-hint'; hint.textContent = 'tocca per chiudere';
    const title = document.createElement('div'); title.className = 'vh-fx-title';
    'VANHOLY HUB'.split('').forEach(ch => { const s = document.createElement('span'); s.textContent = ch === ' ' ? ' ' : ch; title.appendChild(s); });

    // copia del logo, senza le animazioni CSS: qui le guidiamo noi
    const big = src.cloneNode(true);
    const parts = {
      star: big.querySelector('.vh-antenna-star'), body: big.querySelector('.vh-character'),
      lines: big.querySelector('.vh-energy-lines'), core: big.querySelector('.vh-energy-core'),
    };
    big.querySelectorAll('defs, style, title, desc, .vh-hit').forEach(n => n.remove());
    big.querySelectorAll('[class]').forEach(n => n.removeAttribute('class'));
    big.setAttribute('class', 'vh-fx-logo');
    big.removeAttribute('aria-label'); big.setAttribute('aria-hidden', 'true'); big.removeAttribute('role');
    const origin = (el, box, o) => { el.style.transformBox = box; el.style.transformOrigin = o; };
    origin(parts.star, 'view-box', '516px 72px');
    origin(parts.body, 'view-box', '512px 960px');      // salti con schiacciamento a terra
    origin(parts.lines, 'view-box', '516px 1210px');
    origin(parts.core, 'fill-box', 'center');
    // occhio: un disco luminoso dietro l'oblò (che nel corpo è un foro)
    const eye = document.createElementNS(NS, 'circle');
    eye.setAttribute('cx', '511'); eye.setAttribute('cy', '398'); eye.setAttribute('r', '56');
    eye.setAttribute('fill', '#ffffff'); eye.style.opacity = '0';
    eye.style.filter = 'drop-shadow(0 0 30px #00ffc8)';
    parts.body.insertBefore(eye, parts.body.firstChild);

    stage.appendChild(big);
    fx.append(cv, stage, title, hint);
    document.body.appendChild(fx);

    // FLIP: dal logo nel titolo alla posizione al centro dello schermo
    const s0 = center(src), s1 = center(big);
    const k = s0.h / s1.h, dx = s0.x - s1.x, dy = s0.y - s1.y;
    const mirrored = src.classList.contains('hub-logo--alt');
    const startT = `translate(${dx}px, ${dy}px) scale(${mirrored ? -k : k}, ${k}) rotate(0deg)`;

    // ---- campo di stelle, onde e scintille su canvas ----
    const ctx = cv.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0;
    const size = () => { W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    size(); addEventListener('resize', size);
    const stars = Array.from({ length: reduce ? 120 : 380 }, () => ({ x: rnd(-1, 1), y: rnd(-1, 1), z: rnd(0.05, 1), pz: 0 }));
    stars.forEach(s => { s.pz = s.z; });
    const waves = [], sparks = [];
    const colors = ['#00d4ff', '#00ffc8', '#00ff88', '#ffffff'];
    let warp = 0.004;                                     // velocità delle stelle, cambia con le fasi
    const wave = (x, y, max, col) => waves.push({ x, y, r: 10, max, col, life: 1 });
    const burst = (x, y, n, sp) => { for (let i = 0; i < n; i++) { const a = rnd(0, Math.PI * 2), v = rnd(0.3, 1) * sp; sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(0.5, 1.1), c: colors[i % 4] }); } };

    let t0 = performance.now(), last = t0, raf = 0, shakeT = 0;
    const frame = now => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      ctx.fillStyle = 'rgba(2, 4, 12, 0.32)'; ctx.fillRect(0, 0, W, H);   // scie
      const cx = W / 2, cy = H / 2, f = Math.max(W, H) * 0.6;
      ctx.lineCap = 'round';
      for (const s of stars) {
        s.pz = s.z; s.z -= warp * (1 + dt * 60) ;
        if (s.z <= 0.02) { s.x = rnd(-1, 1); s.y = rnd(-1, 1); s.z = 1; s.pz = 1; }
        const x = cx + s.x / s.z * f * 0.5, y = cy + s.y / s.z * f * 0.5;
        const px = cx + s.x / s.pz * f * 0.5, py = cy + s.y / s.pz * f * 0.5;
        const b = 1 - s.z;
        ctx.strokeStyle = `rgba(${b > 0.7 ? '255,255,255' : '120,230,255'},${Math.min(1, b * 1.3)})`;
        ctx.lineWidth = Math.max(0.6, b * 2.6);
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke();
      }
      for (let i = waves.length - 1; i >= 0; i--) {
        const w = waves[i]; w.r += (w.max - w.r) * Math.min(1, dt * 4.5); w.life -= dt * 1.4;
        if (w.life <= 0) { waves.splice(i, 1); continue; }
        ctx.strokeStyle = w.col; ctx.globalAlpha = w.life; ctx.lineWidth = 3 + 6 * w.life;
        ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
      }
      ctx.globalCompositeOperation = 'lighter';
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; p.vx *= 0.985; p.life -= dt;
        if (p.life <= 0) { sparks.splice(i, 1); continue; }
        ctx.fillStyle = p.c; ctx.globalAlpha = Math.min(1, p.life * 1.5);
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      if (shakeT > 0) { shakeT -= dt; const m = shakeT * 22; stage.style.transform = `translate(${rnd(-m, m)}px, ${rnd(-m, m)}px)`; }
      else stage.style.transform = '';
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    // ---- timeline ----
    const timers = [];
    const at = (ms, fn) => timers.push(setTimeout(fn, ms));
    const pos = el => center(el);

    A(fx, [{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: 'ease-out' });

    if (reduce) {
      // versione calma: niente rotazioni, scie o vibrazioni
      A(big, [{ transform: startT, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 600, easing: 'ease-out' });
      A(eye, [{ opacity: 0 }, { opacity: 0.9 }], { duration: 600, delay: 500 });
      [...title.children].forEach((s, i) => A(s, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 500 + i * 30 }));
      at(2000, () => close());
    } else {
      warp = 0.012;
      // salto fuori dalla pagina: gira e cresce fino al centro, con un rimbalzo finale
      A(big, [
        { transform: startT },
        { transform: 'translate(0,0) scale(1.12) rotate(360deg)', offset: 0.78 },
        { transform: 'translate(0,0) scale(1) rotate(360deg)' },
      ], { duration: 950, easing: 'cubic-bezier(.3,.7,.2,1)' });
      at(150, () => { warp = 0.03; });
      at(900, () => { warp = 0.008; shakeT = 0.35; const p = pos(parts.core); wave(p.x, p.y, Math.max(W, H) * 0.7, '#00ffc8'); burst(p.x, p.y, 60, 650); });

      // potenziamento
      A(parts.body, [
        { transform: 'translateY(0) scale(1,1)' },
        { transform: 'translateY(0) scale(1.12,0.86)', offset: 0.1 },
        { transform: 'translateY(-90px) scale(0.92,1.1)', offset: 0.28 },
        { transform: 'translateY(0) scale(1.1,0.9)', offset: 0.46 },
        { transform: 'translateY(-55px) scale(0.95,1.06)', offset: 0.62 },
        { transform: 'translateY(0) scale(1.05,0.95)', offset: 0.78 },
        { transform: 'translateY(0) scale(1,1)' },
      ], { duration: 1500, delay: 950, easing: 'ease-in-out' });
      A(parts.star, [
        { transform: 'rotate(0deg) scale(1)' },
        { transform: 'rotate(540deg) scale(1.9)', offset: 0.55 },
        { transform: 'rotate(1080deg) scale(1)' },
      ], { duration: 1500, delay: 950, easing: 'cubic-bezier(.5,0,.3,1)' });
      A(parts.lines, [
        { transform: 'rotate(0deg) scale(1)' },
        { transform: 'rotate(-600deg) scale(1.45)', offset: 0.4 },
        { transform: 'rotate(-1200deg) scale(1)', offset: 0.7 },
        { transform: 'rotate(-1800deg) scale(1.25)' },
      ], { duration: 2400, delay: 700, easing: 'cubic-bezier(.4,0,.2,1)' });
      A(parts.core, [
        { transform: 'scale(1)', filter: 'brightness(1)' },
        { transform: 'scale(1.7)', filter: 'brightness(2)', offset: 0.2 },
        { transform: 'scale(1)', filter: 'brightness(1)', offset: 0.4 },
        { transform: 'scale(1.7)', filter: 'brightness(2)', offset: 0.6 },
        { transform: 'scale(1)', filter: 'brightness(1)', offset: 0.8 },
        { transform: 'scale(1.4)', filter: 'brightness(1.6)' },
      ], { duration: 2000, delay: 900 });
      A(eye, [
        { opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0.4, offset: 0.4 }, { opacity: 1, offset: 0.6 }, { opacity: 0.6, offset: 0.8 }, { opacity: 1 },
      ], { duration: 1600, delay: 1000 });

      // onde d'energia e scintille dall'antenna, a ritmo coi salti
      [1350, 1830, 2280].forEach((ms, i) => at(ms, () => {
        const p = pos(parts.core), s = pos(parts.star);
        wave(p.x, p.y, Math.max(W, H) * (0.45 + i * 0.12), i % 2 ? '#00ff88' : '#00d4ff');
        burst(s.x, s.y, 36, 520); shakeT = 0.18;
      }));

      // scritta che compare lettera per lettera, con un guizzo "glitch"
      [...title.children].forEach((s, i) => A(s, [
        { opacity: 0, transform: 'translateY(30px) skewX(-25deg)', filter: 'blur(6px)' },
        { opacity: 1, transform: 'translateY(-6px) skewX(12deg)', filter: 'blur(0)', offset: 0.6 },
        { opacity: 1, transform: 'translate(3px,0) skewX(0deg)', offset: 0.8 },
        { opacity: 1, transform: 'none' },
      ], { duration: 520, delay: 1250 + i * 55, easing: 'ease-out' }));

      // ritorno al suo posto
      at(2900, () => {
        warp = 0.02;
        const back = A(big, [
          { transform: 'translate(0,0) scale(1) rotate(360deg)' },
          { transform: 'translate(0,0) scale(1.08) rotate(380deg)', offset: 0.2 },
          { transform: startT },
        ], { duration: 820, easing: 'cubic-bezier(.6,0,.3,1)' });
        A(title, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(20px)' }], { duration: 400 });
        A(fx, [{ opacity: 1 }, { opacity: 0 }], { duration: 380, delay: 560 });
        back.onfinish = () => close(true);
      });
    }

    function close(landed) {
      if (!running) return;
      running = null;
      timers.forEach(clearTimeout);
      cancelAnimationFrame(raf);
      removeEventListener('resize', size);
      removeEventListener('keydown', onKey);
      anims.forEach(a => { try { a.cancel(); } catch (e) { /* niente */ } });
      fx.remove();
      // il logo "atterra" con un piccolo rimbalzo
      if (landed !== false && !reduce) {
        const p = center(src.querySelector('.vh-energy-core'));
        ring(p.x, p.y, 120, 450);
        src.animate([{ scale: '1' }, { scale: '1.22' }, { scale: '0.94' }, { scale: '1' }], { duration: 520, easing: 'ease-out' });
      }
    }
    const onKey = e => { if (e.key === 'Escape') close(); };
    addEventListener('keydown', onKey);
    fx.addEventListener('click', () => close());
    running = { close };
  }
})();
