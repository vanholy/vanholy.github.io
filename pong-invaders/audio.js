/* Pong Invaders — audio sintetizzato con WebAudio (nessun file da scaricare).
 * Effetti sonori posizionati a sinistra/destra e musica synthwave procedurale
 * che cresce d'intensità durante la partita. */
window.PIAudio = (() => {
  'use strict';

  const A = {
    ac: null, master: null, sfxBus: null, musicBus: null, nb: null,
    sfxOn: true, musicOn: true,
    muted: false,          // true durante la demo del menu (solo musica, niente effetti)
    pan: x => 0,           // impostata dal gioco: posizione nel campo -> stereo
  };

  try {
    const saved = JSON.parse(localStorage.getItem('pong-invaders-audio') || '{}');
    if (typeof saved.sfx === 'boolean') A.sfxOn = saved.sfx;
    if (typeof saved.music === 'boolean') A.musicOn = saved.music;
  } catch (e) { /* default */ }
  A.save = () => { try { localStorage.setItem('pong-invaders-audio', JSON.stringify({ sfx: A.sfxOn, music: A.musicOn })); } catch (e) { /* niente */ } };

  const midi = m => 440 * Math.pow(2, (m - 69) / 12);

  // ---------- avvio (deve partire da un tocco dell'utente) ----------
  A.init = () => {
    // su iPhone/iPad fa suonare il gioco anche con l'interruttore silenzioso
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* niente */ }
    if (!A.ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ac = A.ac = new AC();
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 4;
      comp.attack.value = 0.003; comp.release.value = 0.2;
      A.master = ac.createGain(); A.master.gain.value = 0.9;
      A.master.connect(comp); comp.connect(ac.destination);
      A.sfxBus = ac.createGain(); A.sfxBus.gain.value = A.sfxOn ? 0.75 : 0; A.sfxBus.connect(A.master);
      A.musicBus = ac.createGain(); A.musicBus.gain.value = 0; A.musicBus.connect(A.master);
      // riverbero leggero per la musica (delay con feedback)
      const dl = ac.createDelay(1), fb = ac.createGain(), wet = ac.createGain(), lp = ac.createBiquadFilter();
      dl.delayTime.value = 60 / BPM * 0.75; fb.gain.value = 0.32; wet.gain.value = 0.22; lp.type = 'lowpass'; lp.frequency.value = 2600;
      A.echo = ac.createGain();
      A.echo.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(wet); wet.connect(A.musicBus);
      const len = ac.sampleRate;
      A.nb = ac.createBuffer(1, len, len);
      const d = A.nb.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      // sblocco iOS: un suono muto
      const s = ac.createBufferSource(); s.buffer = ac.createBuffer(1, 1, 22050); s.connect(ac.destination); s.start(0);
    }
    if (A.ac.state === 'suspended') A.ac.resume();
  };

  const okSfx = () => A.ac && A.sfxOn && !A.muted;

  // ---------- mattoni di base ----------
  function out(bus, x) {
    if (!A.ac.createStereoPanner) return bus;
    const p = A.ac.createStereoPanner();
    p.pan.value = Math.max(-0.85, Math.min(0.85, A.pan(x)));
    p.connect(bus);
    return p;
  }

  function tone(o) {
    const ac = A.ac, t = ac.currentTime + (o.delay || 0) + (o.at || 0);
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + (o.slide || o.d));
    if (o.detune) osc.detune.value = o.detune;
    const v = o.v || 0.1, att = o.att || 0.003;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.d);
    let node = osc;
    if (o.lp) {
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(o.lp, t);
      if (o.lp2) f.frequency.exponentialRampToValueAtTime(o.lp2, t + o.d);
      f.Q.value = o.q || 1; osc.connect(f); node = f;
    }
    node.connect(g); g.connect(o.bus || out(A.sfxBus, o.x));
    osc.start(t); osc.stop(t + o.d + 0.05);
  }

  function noise(o) {
    const ac = A.ac, t = ac.currentTime + (o.delay || 0) + (o.at || 0);
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = A.nb;
    f.type = o.ft || 'bandpass'; f.frequency.setValueAtTime(o.f || 1200, t);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + o.d);
    f.Q.value = o.q || 0.8;
    g.gain.setValueAtTime(o.v || 0.2, t); g.gain.exponentialRampToValueAtTime(0.0001, t + o.d);
    src.connect(f); f.connect(g); g.connect(o.bus || out(A.sfxBus, o.x));
    src.start(t, Math.random() * 0.5); src.stop(t + o.d + 0.05);
  }

  // ---------- effetti sonori ----------
  let lastShot = [0, 0], lastWall = 0, lastCrack = 0;

  A.shoot = (i, lvl, x) => {
    if (!okSfx()) return;
    const now = A.ac.currentTime;
    if (now - lastShot[i] < 0.06) return;
    lastShot[i] = now;
    const base = (i ? 620 : 520) * (1 + (lvl - 1) * 0.06);
    tone({ f: base, f2: base * 0.45, d: 0.11, type: i ? 'sawtooth' : 'square', v: 0.07, lp: 4200, lp2: 900, x });
    tone({ f: base * 2, f2: base, d: 0.05, type: 'triangle', v: 0.04, x });
    if (lvl >= 3) noise({ f: 3000, d: 0.05, v: 0.05, x });
  };

  A.crack = x => {
    if (!okSfx()) return;
    const now = A.ac.currentTime; if (now - lastCrack < 0.03) return; lastCrack = now;
    noise({ f: rand(1800, 3200), d: 0.09, v: 0.16, q: 1.4, x });
    tone({ f: 140, f2: 60, d: 0.08, type: 'sine', v: 0.12, x });
  };

  A.wall = x => {           // il "blip" classico del Pong
    if (!okSfx()) return;
    const now = A.ac.currentTime; if (now - lastWall < 0.04) return; lastWall = now;
    tone({ f: 990, d: 0.05, type: 'square', v: 0.04, lp: 3000, x });
  };

  A.clash = x => {
    if (!okSfx()) return;
    tone({ f: 1800, f2: 700, d: 0.16, type: 'triangle', v: 0.07, x });
    tone({ f: 2650, f2: 1200, d: 0.12, type: 'sine', v: 0.04, x });
    noise({ f: 5000, d: 0.06, v: 0.08, ft: 'highpass', x });
  };

  A.score = x => {          // moneta
    if (!okSfx()) return;
    tone({ f: 1318, d: 0.08, type: 'square', v: 0.05, lp: 5000, x });
    tone({ f: 1976, d: 0.22, type: 'square', v: 0.05, lp: 5000, at: 0.07, x });
    tone({ f: 3950, d: 0.15, type: 'sine', v: 0.025, at: 0.07, x });
  };

  A.hit = x => {            // cannone colpito
    if (!okSfx()) return;
    noise({ f: 900, f2: 120, d: 0.45, v: 0.45, q: 0.6, x });
    tone({ f: 190, f2: 40, d: 0.45, type: 'sawtooth', v: 0.16, lp: 1200, lp2: 120, x });
    tone({ f: 70, f2: 35, d: 0.5, type: 'sine', v: 0.3, x });
  };

  A.alarm = x => {          // ultima vita
    if (!okSfx()) return;
    for (let k = 0; k < 3; k++) {
      tone({ f: 880, d: 0.12, type: 'square', v: 0.05, lp: 2500, at: k * 0.18, x });
      tone({ f: 660, d: 0.08, type: 'square', v: 0.04, lp: 2500, at: k * 0.18 + 0.09, x });
    }
  };

  A.boom = x => {           // cannone distrutto
    if (!okSfx()) return;
    noise({ f: 1400, f2: 60, d: 1.6, v: 0.6, q: 0.5, x });
    noise({ f: 4000, f2: 400, d: 0.5, v: 0.25, x });
    tone({ f: 140, f2: 25, d: 1.4, type: 'sawtooth', v: 0.22, lp: 900, lp2: 80, x });
    tone({ f: 55, f2: 28, d: 1.5, type: 'sine', v: 0.4, x });
  };

  A.buy = x => {            // potenziamento
    if (!okSfx()) return;
    [0, 4, 7, 12, 16].forEach((s, k) => tone({ f: midi(72 + s), d: 0.16, type: 'square', v: 0.05, lp: 3500, at: k * 0.05, x }));
    tone({ f: 200, f2: 1600, d: 0.3, type: 'sawtooth', v: 0.04, lp: 3000, x });
  };

  A.repair = x => {         // riparazione: luccichio che sale
    if (!okSfx()) return;
    [0, 3, 7, 10, 14, 19].forEach((s, k) => tone({ f: midi(67 + s), d: 0.25, type: 'triangle', v: 0.06, at: k * 0.045, x }));
    noise({ f: 6000, d: 0.4, v: 0.05, ft: 'highpass', x });
  };

  A.deny = x => { if (okSfx()) tone({ f: 220, f2: 150, d: 0.18, type: 'square', v: 0.05, lp: 1500, x }); };
  A.tick = () => { if (okSfx()) tone({ f: 660, d: 0.14, type: 'sine', v: 0.16 }); };
  A.go = () => {
    if (!okSfx()) return;
    tone({ f: 1320, d: 0.4, type: 'sine', v: 0.16 });
    tone({ f: 660, f2: 1320, d: 0.25, type: 'sawtooth', v: 0.06, lp: 3000 });
  };
  A.win = () => {           // fanfara finale
    if (!okSfx()) return;
    const seq = [[60, 0], [64, 0.12], [67, 0.24], [72, 0.36], [67, 0.6], [72, 0.72], [76, 0.84]];
    seq.forEach(([m, at]) => { tone({ f: midi(m), d: 0.3, type: 'square', v: 0.05, lp: 3000, at }); tone({ f: midi(m - 12), d: 0.3, type: 'triangle', v: 0.06, at }); });
    tone({ f: midi(79), d: 1.2, type: 'sawtooth', v: 0.05, lp: 2500, lp2: 600, at: 1.0 });
    tone({ f: midi(84), d: 1.2, type: 'square', v: 0.04, lp: 3000, lp2: 700, at: 1.0 });
  };

  function rand(a, b) { return a + Math.random() * (b - a); }

  // ---------- musica procedurale ----------
  const BPM = 116, STEP = 60 / BPM / 4;
  const ROOTS = [45, 41, 48, 43];                         // La- Fa Do Sol
  const ARP = [[69, 72, 76, 81], [65, 69, 72, 77], [64, 67, 72, 76], [62, 67, 71, 74]];
  const mus = { playing: false, step: 0, next: 0, timer: null, level: 0 };

  // level: 0 = menu (soffice), 1 = partita, 2 = tensione (qualcuno all'ultima vita)
  A.setMusicLevel = l => { mus.level = l; };

  A.musicStart = () => {
    if (!A.ac || mus.playing) return;
    mus.playing = true; mus.step = 0; mus.next = A.ac.currentTime + 0.08;
    const g = A.musicBus.gain, t = A.ac.currentTime;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(A.musicOn ? 0.5 : 0, t + 0.6);
    mus.timer = setInterval(schedule, 25);
  };
  A.musicStop = (fade = 0.4) => {
    if (!A.ac || !mus.playing) return;
    mus.playing = false; clearInterval(mus.timer);
    const g = A.musicBus.gain, t = A.ac.currentTime;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + fade);
  };

  function schedule() {
    if (A.ac.currentTime > mus.next + 0.5) mus.next = A.ac.currentTime + 0.05;    // dopo una pausa della scheda
    while (mus.next < A.ac.currentTime + 0.12) { playStep(mus.step, mus.next); mus.next += STEP; mus.step++; }
  }

  function playStep(step, t) {
    if (!A.musicOn) return;
    const s = step % 16, bar = Math.floor(step / 16) % 4, lvl = mus.level, at = t - A.ac.currentTime;
    const bus = A.musicBus;
    // pad all'inizio della battuta
    if (s === 0) {
      for (const m of ARP[bar].slice(0, 3)) {
        tone({ f: midi(m - 12), d: STEP * 16, type: 'sawtooth', v: lvl ? 0.022 : 0.03, att: 0.4, lp: 900, lp2: 500, detune: rand(-8, 8), at, bus });
      }
    }
    // basso a ottavi, pulsante
    if (s % 2 === 0) {
      const m = ROOTS[bar] + (s % 4 === 2 ? 12 : 0);
      tone({ f: midi(m), d: STEP * 1.8, type: 'sawtooth', v: lvl ? 0.09 : 0.06, lp: lvl === 2 ? 1300 : 700, lp2: 200, q: 4, at, bus });
    }
    if (lvl >= 1) {
      // cassa
      if (s % 4 === 0) {
        tone({ f: 150, f2: 42, slide: 0.12, d: 0.3, type: 'sine', v: 0.45, at, bus });
      }
      // rullante
      if (s === 4 || s === 12) {
        noise({ f: 1800, d: 0.18, v: 0.16, q: 0.7, at, bus });
        tone({ f: 220, f2: 160, d: 0.1, type: 'triangle', v: 0.08, at, bus });
      }
      // charleston (a sedicesimi quando c'è tensione)
      if (s % 4 === 2 || (lvl === 2 && s % 2 === 1)) {
        noise({ f: 8000, ft: 'highpass', d: 0.04, v: s % 4 === 2 ? 0.07 : 0.035, at, bus });
      }
      // arpeggio
      const notes = ARP[bar];
      const m = notes[(s + (lvl === 2 ? s >> 2 : 0)) % notes.length] + (lvl === 2 && s >= 8 ? 12 : 0);
      const node = A.ac.createGain(); node.gain.value = 1; node.connect(bus); node.connect(A.echo);
      tone({ f: midi(m), d: STEP * 0.9, type: 'square', v: lvl === 2 ? 0.03 : 0.022, lp: lvl === 2 ? 3200 : 2000, at, bus: node });
    } else if (s % 4 === 0) {
      // nel menu: arpeggio lento e sognante
      const node = A.ac.createGain(); node.connect(bus); node.connect(A.echo);
      tone({ f: midi(ARP[bar][(s / 4) % 4]), d: STEP * 3, type: 'triangle', v: 0.04, at, bus: node });
    }
  }

  // ---------- interruttori ----------
  A.setSfx = on => { A.sfxOn = on; A.save(); if (A.sfxBus) A.sfxBus.gain.value = on ? 0.75 : 0; };
  A.setMusic = on => {
    A.musicOn = on; A.save();
    if (!A.ac) return;
    const g = A.musicBus.gain, t = A.ac.currentTime;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(on && mus.playing ? 0.5 : 0, t + 0.3);
  };

  return A;
})();
