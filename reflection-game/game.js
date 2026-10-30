'use strict';

// ---------- Configurazione ----------

const SIZES = { piccola: 48, media: 72, grande: 100 }; // diametro in px
const FREQ = { lenta: [2000, 5000], media: [1000, 3000], veloce: [500, 1500] }; // attesa casuale [min, max] ms
const BAR_FULL_MS = 1000; // tempo a cui la barra è piena (senza scomparsa)
const LATE_MS = 1000; // dopo un mancato, per quanto un tocco è "troppo tardi"
const HISTORY_MAX = 500;
const LS_SETTINGS = 'reflection-game:settings';
const LS_HISTORY = 'reflection-game:history';

const DEFAULTS = {
  level: 'personalizzato', mode: 'visibili', size: 'media', targets: 5, freq: 'media',
  timeout: 0, colors: 'fissi', bg: 'fisso', distractors: 0, rounds: 20, sounds: 'no', music: 'no', players: 1,
  moving: 0, // velocità dei bersagli in px/s (0 = fermi)
};

// Combinazioni dei livelli (il numero di interazioni resta quello scelto)
const PRESETS = {
  base: { mode: 'visibili', size: 'grande', targets: 5, freq: 'lenta', timeout: 0, colors: 'fissi', bg: 'fisso', distractors: 0, moving: 0 },
  medio: { mode: 'compaiono', size: 'media', targets: 5, freq: 'media', timeout: 2000, colors: 'variabili', bg: 'fisso', distractors: 3, moving: 0 },
  avanzato: { mode: 'visibili', size: 'piccola', targets: 8, freq: 'veloce', timeout: 1000, colors: 'difficili', bg: 'variabile', distractors: 12, moving: 30 },
};
// opzioni che non fanno parte dei livelli: cambiarle non passa a "Personalizzato"
const FREE_KEYS = ['rounds', 'sounds', 'music', 'players'];

// Survival: difficoltà massima con tutto attivato, 3 vite, sempre più veloce
const SURVIVAL = {
  level: 'survival', mode: 'visibili', size: 'piccola', targets: 8, freq: 'veloce',
  timeout: 1500, colors: 'difficili', bg: 'psichedelico', distractors: 20, moving: 30, rounds: 0,
};
const SURVIVAL_LIVES = 3;
const SPEEDUP = 0.96; // a ogni bersaglio preso tempi e attese si accorciano del 4%
const MIN_SPEED = 0.3; // non scende sotto il 30% dei tempi iniziali
const LS_RECORD = 'reflection-game:survival-record';
const LS_PHOTO = 'reflection-game:bg-photo'; // { src: dataURL JPEG, avg: [r, g, b] }
const PHOTO_SIZES = [[1600, 0.8], [1024, 0.7], [720, 0.6]]; // lato massimo e qualità: si riduce finché entra nello storage

const MODE_LABEL = { visibili: 'Visibili', compaiono: 'Compaiono' };
const LEVEL_LABEL = { base: 'Base', medio: 'Medio', avanzato: 'Avanzato', personalizzato: 'Personalizzato', survival: 'Survival' };

// Colori [r, g, b]
const LIT_FIXED = [255, 210, 63];
const BG_FIXED = [15, 17, 21];
const BG_PSY = [24, 20, 32]; // base scura sotto lo sfondo psichedelico (riferimento per i contrasti)

// Forme dei disturbi (viewBox 0 0 100 100, mai cerchi)
const SHAPES = [
  '<rect x="10" y="10" width="80" height="80" rx="6"/>',
  '<polygon points="50,6 95,92 5,92"/>',
  '<polygon points="50,4 61,38 97,38 68,59 79,93 50,72 21,93 32,59 3,38 39,38"/>',
  '<polygon points="50,3 97,50 50,97 3,50"/>',
  '<polygon points="27,6 73,6 96,50 73,94 27,94 4,50"/>',
  '<polygon points="35,5 65,5 65,35 95,35 95,65 65,65 65,95 35,95 35,65 5,65 5,35 35,35"/>',
];

// ---------- Utilità ----------

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const rand = (min, max) => min + Math.random() * (max - min);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const fmt = (ms) => (ms == null ? '—' : `${Math.round(ms)} ms`);
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
const best = (a) => (a.length ? Math.min(...a) : null);
const worst = (a) => (a.length ? Math.max(...a) : null);

// durata in m:ss,d
function fmtDuration(ms) {
  const tenths = Math.floor(ms / 100);
  const m = Math.floor(tenths / 600);
  const s = Math.floor((tenths % 600) / 10);
  return `${m}:${String(s).padStart(2, '0')},${tenths % 10}`;
}

function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage non disponibile: si gioca comunque */
  }
}

function formatDate(ts) {
  return new Date(ts).toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

// ---------- Colori ----------

function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
}

function luminance(rgb) {
  const [r, g, b] = rgb.map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const rgbStr = ([r, g, b]) => `rgb(${r}, ${g}, ${b})`;
const randomHsl = (sMin, sMax, lMin, lMax) => hslToRgb(rand(0, 360), rand(sMin, sMax), rand(lMin, lMax));

// Genera colori finché uno rispetta la condizione (altrimenti tiene l'ultimo)
function pickColor(gen, ok, tries = 80) {
  let c;
  for (let i = 0; i < tries; i++) {
    c = gen();
    if (ok(c)) return c;
  }
  return c;
}

function newBackground(s) {
  if (s.bg === 'psichedelico') return BG_PSY;
  if (s.bg === 'foto') return bgPhoto ? bgPhoto.avg : BG_FIXED;
  if (s.bg !== 'variabile') return BG_FIXED;
  const gen = () => (Math.random() < 0.5 ? randomHsl(20, 60, 8, 22) : randomHsl(20, 60, 78, 92));
  // con colori fissi il giallo deve restare ben visibile
  return pickColor(gen, (c) => s.colors !== 'fissi' || contrast(c, LIT_FIXED) >= 3);
}

function newTargetColor(s, bg) {
  // sul fondo psichedelico servono colori chiari e accesi
  if (s.colors !== 'fissi' && s.bg === 'psichedelico') return randomHsl(85, 100, 62, 72);
  // anche sulla foto (la media dei colori non basta a garantire il contrasto ovunque)
  if (s.colors === 'variabili' && s.bg === 'foto') return randomHsl(85, 100, 62, 72);
  if (s.colors === 'variabili') return pickColor(() => randomHsl(70, 100, 45, 65), (c) => contrast(c, bg) >= 3);
  if (s.colors === 'difficili') {
    return pickColor(() => randomHsl(40, 90, 30, 70), (c) => {
      const k = contrast(c, bg);
      return k >= 1.3 && k <= 2;
    });
  }
  return LIT_FIXED;
}

function newDistractorColor(s, bg) {
  return pickColor(() => randomHsl(50, 90, 40, 65), (c) => s.colors === 'difficili' || contrast(c, bg) >= 2);
}

// ---------- Suoni e musica (Web Audio, nessun file) ----------

const sound = (() => {
  let ctx = null;
  let master = null;
  let noise = null;
  let sfxOn = false;
  let theme = 'arcade'; // i suoni seguono lo stile della musica scelta
  let musicGain = null;
  let musicIn = null; // ingresso della traccia (passa per l'eco nella musica ipnotica)
  let musicTimer = null;
  let track = null;
  let nextNote = 0;
  let step = 0;
  let previewTimer = null;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.6;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, start, dur, { type = 'sine', vol = 0.3, to = null, dest = master, attack = 0.01, filter = null } = {}) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    if (to) o.frequency.exponentialRampToValueAtTime(to, start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    let out = o;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filter;
      out = out.connect(f);
    }
    out.connect(g).connect(dest);
    o.start(start);
    o.stop(start + dur + 0.02);
  }

  // rumore filtrato: charleston della techno, "splat" degli insetti
  // to: frequenza del filtro a fine suono (per gli "zip" degli scatti)
  function noiseHit(start, dur, { vol = 0.2, type = 'highpass', freq = 7000, to = null, dest = master } = {}) {
    if (!noise) {
      noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ctx.createBufferSource();
    s.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, start);
    if (to) f.frequency.exponentialRampToValueAtTime(to, start + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    s.connect(f).connect(g).connect(dest);
    s.start(start);
    s.stop(start + dur + 0.02);
  }

  const kick = (t, dest) => tone(150, t, 0.28, { vol: 0.9, to: 42, dest });
  const semi = (f, n) => f * 2 ** (n / 12);

  // Ogni traccia: durata di uno step (s) e cosa suonare allo step i
  const TRACKS = {
    // arpeggio su la min, fa, do, sol a 112 bpm
    arcade: {
      step: 60 / 112 / 2,
      play(i, t, d) {
        const CHORDS = [[220, 261.6, 329.6], [174.6, 220, 261.6], [261.6, 329.6, 392], [196, 246.9, 293.7]];
        const ARP = [0, 1, 2, 1, 2, 1, 0, 2];
        const chord = CHORDS[Math.floor(i / 8) % 4];
        if (i % 4 === 0) tone(chord[0] / 2, t, this.step * 3.5, { vol: 0.25, dest: d });
        tone(chord[ARP[i % 8]] * 2, t, this.step * 0.9, { type: 'triangle', vol: 0.07, dest: d });
      },
    },
    // cassa dritta, charleston in levare e basso acido a 128 bpm
    techno: {
      step: 60 / 128 / 4,
      play(i, t, d) {
        const s = i % 16;
        const root = [55, 55, 65.4, 49][Math.floor(i / 16) % 4];
        const BASS = [0, 0, 12, 0, 0, 12, 0, 7, 0, 0, 12, 0, 3, 12, 0, 10];
        if (s % 4 === 0) kick(t, d);
        if (s % 4 === 2) noiseHit(t, 0.06, { vol: 0.18, dest: d });
        else if (s % 2 === 1) noiseHit(t, 0.025, { vol: 0.06, dest: d });
        if (s % 4 !== 0) {
          const cutoff = 500 + 400 * Math.sin(i / 24);
          tone(semi(root, BASS[s]), t, this.step * 0.85, { type: 'sawtooth', vol: 0.13, filter: cutoff, dest: d });
        }
        if (Math.floor(i / 16) % 2 === 1 && (s === 6 || s === 14)) {
          tone(semi(root * 4, 7), t, this.step * 1.5, { type: 'square', vol: 0.035, filter: 1800, dest: d });
        }
      },
    },
    // tappeto lento, campanelle pentatoniche che ruotano, eco: 70 bpm
    ipnotica: {
      step: 60 / 70 / 4,
      echo: true,
      play(i, t, d) {
        const s = i % 16;
        const bar = Math.floor(i / 16);
        const NOTES = [440, 523.3, 587.3, 659.3, 784, 880];
        const SEQ = [0, -1, 2, -1, 4, -1, 3, -1, 1, -1, 4, -1, 2, -1, 5, -1];
        if (i % 64 === 0) {
          [110, 165, 220.8].forEach((f) => tone(f, t, this.step * 66, { vol: 0.07, attack: 2.5, dest: d }));
        }
        if (s % 4 === 0) tone(55, t, 0.5, { vol: 0.18, to: 45, dest: d });
        if (SEQ[s] >= 0) tone(NOTES[(SEQ[s] + bar) % 6], t, 1.4, { vol: 0.07, dest: d });
      },
    },
  };

  const SFX = {
    arcade: {
      hit: (t) => { tone(880, t, 0.09, { type: 'triangle' }); tone(1320, t + 0.05, 0.12, { type: 'triangle', vol: 0.2 }); },
      error: (t) => tone(160, t, 0.22, { type: 'square', vol: 0.1, to: 90 }),
      miss: (t) => tone(520, t, 0.35, { type: 'sawtooth', vol: 0.08, to: 180 }),
      end: (t) => [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.1, 0.25, { type: 'triangle', vol: 0.2 })),
    },
    techno: {
      hit: (t) => tone(900, t, 0.09, { type: 'sawtooth', vol: 0.14, to: 2400, filter: 4000 }),
      error: (t) => tone(90, t, 0.25, { type: 'square', vol: 0.16, to: 50, filter: 600 }),
      miss: (t) => tone(900, t, 0.45, { type: 'sawtooth', vol: 0.1, to: 90, filter: 1500 }),
      end: (t) => { kick(t, master); kick(t + 0.23, master); [0, 3, 7, 12].forEach((n, i) => tone(semi(220, n), t + 0.46 + i * 0.12, 0.2, { type: 'sawtooth', vol: 0.1, filter: 2500 })); },
    },
    ipnotica: {
      hit: (t) => { tone(1046.5, t, 0.9, { vol: 0.16 }); tone(1568, t, 0.6, { vol: 0.05 }); },
      error: (t) => tone(110, t, 0.5, { type: 'triangle', vol: 0.22, to: 80 }),
      miss: (t) => tone(660, t, 1.1, { vol: 0.12, to: 330 }),
      end: (t) => [440, 523.3, 659.3, 880, 1046.5].forEach((f, i) => tone(f, t + i * 0.22, 1.4, { vol: 0.1 })),
    },
  };
  // Modalità gatto: passi di ogni animale, scatti, versi, animale schiacciato
  const CAT_FX = {
    rustle: (t, d) => noiseHit(t, 0.035, { vol: 0.08, type: 'bandpass', freq: rand(2500, 6000), dest: d }), // zampette
    tick: (t, d) => noiseHit(t, 0.02, { vol: 0.07, type: 'highpass', freq: 8000, dest: d }), // ragno
    patter: (t, d) => noiseHit(t, 0.05, { vol: 0.14, type: 'lowpass', freq: 600, dest: d }), // topo
    scratch: (t, d) => noiseHit(t, 0.06, { vol: 0.1, type: 'bandpass', freq: rand(1200, 2000), dest: d }), // lucertola
    flutter: (t, d) => { noiseHit(t, 0.04, { vol: 0.08, type: 'lowpass', freq: 900, dest: d }); noiseHit(t + 0.06, 0.04, { vol: 0.06, type: 'lowpass', freq: 900, dest: d }); }, // ali
    buzz: (t, d) => tone(rand(180, 210), t, 0.45, { type: 'sawtooth', vol: 0.04, to: 230, filter: 1000, dest: d }),
    squeak: (t, d) => { tone(rand(2600, 3200), t, 0.09, { vol: 0.12, to: 3800, dest: d }); tone(rand(2800, 3400), t + 0.13, 0.07, { vol: 0.1, to: 3600, dest: d }); },
    zip: (t, d) => noiseHit(t, 0.35, { vol: 0.16, type: 'bandpass', freq: 1500, to: 7000, dest: d }), // scatto
    squish: (t, d) => { noiseHit(t, 0.12, { vol: 0.35, type: 'lowpass', freq: 1200, dest: d }); tone(320, t, 0.12, { type: 'triangle', vol: 0.15, to: 90, dest: d }); },
  };

  function schedule() {
    while (nextNote < ctx.currentTime + 0.2) {
      track.play(step, nextNote, musicIn);
      nextNote += track.step;
      step++;
    }
  }

  function stopMusic() {
    clearTimeout(previewTimer);
    if (!musicTimer) return;
    clearInterval(musicTimer);
    musicTimer = null;
    const g = musicGain;
    g.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
    setTimeout(() => g.disconnect(), 600);
    musicGain = null;
  }

  function startMusic(name) {
    stopMusic();
    if (!TRACKS[name] || !ensure()) return;
    track = TRACKS[name];
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.4;
    musicGain.connect(master);
    musicIn = musicGain;
    if (track.echo) {
      // eco a tre ottavi con ritorno
      const delay = ctx.createDelay(2);
      delay.delayTime.value = track.step * 3;
      const fb = ctx.createGain();
      fb.gain.value = 0.45;
      musicIn = ctx.createGain();
      musicIn.connect(musicGain);
      musicIn.connect(delay);
      delay.connect(fb).connect(delay);
      fb.connect(musicGain);
    }
    nextNote = ctx.currentTime + 0.1;
    step = 0;
    schedule();
    musicTimer = setInterval(schedule, 50);
  }

  return {
    init(s) {
      sfxOn = s.sounds === 'si';
      theme = SFX[s.music] ? s.music : 'arcade';
      if (sfxOn || TRACKS[s.music]) ensure();
    },
    play(name) {
      if (sfxOn && ctx) SFX[theme][name](ctx.currentTime);
    },
    // rumori della modalità gatto: sempre attivi, pan = posizione da sinistra (-1) a destra (1)
    fx(name, pan = 0) {
      if (!ensure()) return;
      let dest = master;
      if (ctx.createStereoPanner) {
        dest = ctx.createStereoPanner();
        dest.pan.value = Math.max(-1, Math.min(1, pan));
        dest.connect(master);
      }
      CAT_FX[name](ctx.currentTime, dest);
    },
    // name: 'arcade' | 'techno' | 'ipnotica'; qualsiasi altro valore spegne
    music(name) {
      if (name && TRACKS[name]) startMusic(name);
      else stopMusic();
    },
    // anteprima di qualche secondo dalle opzioni
    preview(name, ms = 5000) {
      startMusic(name);
      if (musicTimer) previewTimer = setTimeout(stopMusic, ms);
    },
  };
})();

// ---------- Schermate ----------

function show(id) {
  $$('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
  if (id === 'menu') {
    sound.music(null); // ferma l'anteprima delle opzioni
    renderMenuSummary();
  }
}

document.addEventListener('click', (e) => {
  const goto = e.target.closest('[data-goto]');
  if (goto) {
    if (goto.dataset.goto === 'menu') stopGame();
    show(goto.dataset.goto);
    return;
  }
  const act = e.target.closest('[data-action]');
  if (!act) return;
  switch (act.dataset.action) {
    case 'start': startGame(false); break;
    case 'survival': startGame(true); break;
    case 'replay': startGame(session.survival); break;
    case 'cat': startCat(); break;
    case 'history': showHistory(); break;
    case 'quit': quitGame(); break;
    case 'resume': resumeGame(); break;
    case 'clear-history': clearHistory(); break;
  }
});

document.addEventListener('contextmenu', (e) => e.preventDefault());

// ---------- Opzioni ----------

let settings = { ...DEFAULTS, ...load(LS_SETTINGS, {}) };
if (settings.music === 'si') settings.music = 'arcade'; // valore della versione precedente

// Foto di sfondo scelta dal telefono, salvata sul dispositivo
let bgPhoto = load(LS_PHOTO, null);
if (settings.bg === 'foto' && !bgPhoto) settings.bg = 'fisso';

function readImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('immagine non leggibile')); };
    img.src = url;
  });
}

function averageColor(img) {
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, 1, 1);
  return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)];
}

// Ridimensiona la foto e la salva; prova dimensioni più piccole se lo storage è pieno
async function setPhoto(file) {
  const img = await readImage(file);
  const avg = averageColor(img);
  const c = document.createElement('canvas');
  for (const [max, q] of PHOTO_SIZES) {
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const photo = { src: c.toDataURL('image/jpeg', q), avg };
    try {
      localStorage.setItem(LS_PHOTO, JSON.stringify(photo));
      bgPhoto = photo;
      return;
    } catch {
      /* troppo grande: si riprova più piccola */
    }
  }
  throw new Error('spazio non sufficiente');
}

const photoInput = $('#bg-photo-input');
$('#bg-photo-pick').addEventListener('click', () => photoInput.click());
photoInput.addEventListener('change', async () => {
  const file = photoInput.files[0];
  photoInput.value = '';
  if (!file) return;
  const msg = $('#bg-photo-msg');
  msg.textContent = 'Caricamento della foto…';
  try {
    await setPhoto(file);
    msg.textContent = '';
    settings.bg = 'foto';
    settings.level = 'personalizzato';
    save(LS_SETTINGS, settings);
  } catch {
    msg.textContent = 'Non sono riuscito a usare questa foto, provane un\'altra.';
  }
  renderOptions();
  renderMenuSummary();
});

function renderOptions() {
  $$('.seg').forEach((seg) => {
    const key = seg.dataset.key;
    seg.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('on', String(settings[key]) === b.dataset.value);
    });
  });
  $('#opt-targets').classList.toggle('disabled', settings.mode !== 'visibili');
  $('#bg-photo-row').classList.toggle('show', settings.bg === 'foto');
  $('#bg-photo-thumb').style.backgroundImage = bgPhoto ? `url(${bgPhoto.src})` : '';
  document.documentElement.style.setProperty('--target', `${SIZES[settings.size]}px`);
}

$$('.seg').forEach((seg) => {
  seg.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const key = seg.dataset.key;
    const v = b.dataset.value;
    // sfondo foto senza una foto salvata: prima si sceglie la foto
    if (key === 'bg' && v === 'foto' && !bgPhoto) {
      photoInput.click();
      return;
    }
    settings[key] = /^\d+$/.test(v) ? Number(v) : v;
    if (key === 'level') {
      if (PRESETS[v]) Object.assign(settings, PRESETS[v]);
    } else if (!FREE_KEYS.includes(key)) {
      settings.level = 'personalizzato';
    }
    save(LS_SETTINGS, settings);
    renderOptions();
    if (key === 'players') renderMenuSummary();
    // anteprima: musica scelta e suono di tocco nello stesso stile
    if (key === 'music') sound.preview(v);
    if (key === 'music' || key === 'sounds') {
      sound.init(settings);
      sound.play('hit');
    }
  });
});

function settingsLabel(s) {
  if (s.level === 'survival') return 'Survival · difficoltà massima, sempre più veloce, 3 vite';
  const parts = [];
  if (s.level && s.level !== 'personalizzato') parts.push(`Livello ${LEVEL_LABEL[s.level]}`);
  parts.push(MODE_LABEL[s.mode] + (s.mode === 'visibili' ? `, ${s.targets} bersagli` : ''));
  parts.push(`dim. ${s.size}`, `freq. ${s.freq}`);
  if (s.timeout) parts.push(`scompare in ${(s.timeout / 1000).toLocaleString('it-IT')} s`);
  if (s.colors && s.colors !== 'fissi') parts.push(`colori ${s.colors}`);
  if (s.bg === 'variabile') parts.push('sfondo variabile');
  if (s.bg === 'psichedelico') parts.push('sfondo psichedelico');
  if (s.bg === 'foto') parts.push('sfondo con la tua foto');
  if (s.distractors) parts.push(`${s.distractors} disturbi`);
  if (s.moving) parts.push(`bersagli in movimento${s.moving > 30 ? ' veloce' : ''}`);
  parts.push(`${s.rounds} interazioni`);
  return parts.join(' · ');
}

function renderMenuSummary() {
  $('#menu-summary').textContent = settingsLabel(settings);
  $('#menu-players-hint').textContent = settings.players === 2
    ? 'Schermo diviso: mettetevi uno per lato'
    : '';
  const rec = load(LS_RECORD, null);
  $('#menu-record').textContent = rec ? `Record survival: ${fmtDuration(rec)}` : '';
}

// ---------- Gioco ----------

// Punti (contano nella sfida in doppia)
const HIT_POINTS = [100, 1000]; // 1000 - tempo di reazione, tra questi limiti
const ERROR_PENALTY = 200;
const MISS_PENALTY = 100;

const playersEl = $('#players');
const playerTpl = $('#player-tpl');

// Partita in corso: uno o due giocatori con le stesse impostazioni
const session = {
  phase: 'idle', // idle | running | paused | done
  settings: null,
  survival: false,
  duo: false,
  players: [],
  startAt: 0, // inizio partita (cronometro)
  pausedAt: 0,
  pausedTotal: 0,
  endAt: 0,
  chronoTimer: null,
  distRaf: null,
  distLast: null,
};

function createPlayer(idx) {
  const root = playerTpl.content.firstElementChild.cloneNode(true);
  const byData = (attr) => Object.fromEntries([...root.querySelectorAll(`[data-${attr}]`)].map((el) => [el.dataset[attr], el]));
  const p = {
    idx,
    root,
    player: root.querySelector('.player'),
    arena: root.querySelector('.arena'),
    msg: root.querySelector('.msg'),
    barFill: root.querySelector('.bar-fill'),
    barLabel: root.querySelector('.bar-label'),
    v: byData('v'), // valori dell'HUD
    s: byData('s'), // riquadri dell'HUD da mostrare o nascondere
    phase: 'idle', // idle | wait | lit | paused | done
    times: [],
    errors: 0,
    missed: 0,
    missedAt: 0,
    score: 0,
    lives: SURVIVAL_LIVES,
    targets: [], // elementi .target (modalità visibili)
    lit: null, // bersaglio acceso
    litAt: 0,
    curTimeout: 0, // tempo di scomparsa del bersaglio attuale
    bg: BG_FIXED,
    distractors: [], // { el, x, y, vx, vy, size, rot, vr }
    timer: null,
    missTimer: null,
    raf: null,
    errTimer: null,
  };
  p.arena.addEventListener('pointerdown', (e) => onPointer(p, e));
  playersEl.appendChild(root);
  return p;
}

const interactions = (p) => p.times.length + p.missed;
const barMax = (p) => p.curTimeout || BAR_FULL_MS;
const hitPoints = (rt) => Math.round(Math.min(HIT_POINTS[1], Math.max(HIT_POINTS[0], 1000 - rt)));

// Survival: fattore di velocità (1 all'inizio, poi sempre più piccolo)
const speed = (p) => (session.survival ? Math.max(MIN_SPEED, SPEEDUP ** p.times.length) : 1);

function elapsed() {
  if (!session.startAt) return 0;
  const now = session.endAt || performance.now();
  const paused = session.phase === 'paused' ? now - session.pausedAt : 0;
  return now - session.startAt - session.pausedTotal - paused;
}

// Doppia: ogni campo è girato verso il lato corto dove siede il suo giocatore
function layoutPlayers() {
  const landscape = innerWidth >= innerHeight;
  playersEl.classList.toggle('landscape', landscape);
  session.players.forEach((p, i) => {
    const st = p.player.style;
    if (!session.duo) {
      st.width = st.height = st.transform = '';
      return;
    }
    const r = p.root.getBoundingClientRect();
    const deg = landscape ? (i === 0 ? 90 : -90) : (i === 0 ? 180 : 0);
    const sideways = deg % 180 !== 0;
    st.width = `${sideways ? r.height : r.width}px`;
    st.height = `${sideways ? r.width : r.height}px`;
    st.transform = `translate(-50%, -50%) rotate(${deg}deg)`;
  });
}

function renderLives(p) {
  const lost = SURVIVAL_LIVES - Math.max(p.lives, 0);
  p.v.lives.innerHTML = '❤'.repeat(Math.max(p.lives, 0)) + `<span class="lost">${'❤'.repeat(lost)}</span>`;
}

// Posizioni casuali senza sovrapposizioni dentro l'arena (coordinate del centro)
function randomPositions(p, n, size) {
  const w = p.arena.clientWidth;
  const h = p.arena.clientHeight;
  const margin = size / 2 + 8;
  const minDist = size * 1.4;
  const out = [];
  for (let tries = 0; out.length < n && tries < n * 400; tries++) {
    const pt = { x: rand(margin, w - margin), y: rand(margin, h - margin) };
    if (out.every((q) => Math.hypot(pt.x - q.x, pt.y - q.y) >= minDist)) out.push(pt);
  }
  return out;
}

function makeTarget(p, pt) {
  const el = document.createElement('div');
  el.className = 'target';
  el.style.left = `${pt.x}px`;
  el.style.top = `${pt.y}px`;
  p.arena.appendChild(el);
  // bersagli in movimento: direzione casuale, velocità scelta nelle opzioni
  const v = session.settings.moving;
  if (v) {
    const angle = rand(0, Math.PI * 2);
    el.move = { x: pt.x, y: pt.y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v };
  }
  return el;
}

function moveTargets(p, dt) {
  const r = SIZES[session.settings.size] / 2 + 4;
  const w = p.arena.clientWidth;
  const h = p.arena.clientHeight;
  for (const el of p.arena.querySelectorAll('.target')) {
    const m = el.move;
    if (!m) continue;
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    if (m.x < r) { m.x = r; m.vx = Math.abs(m.vx); }
    if (m.x > w - r) { m.x = w - r; m.vx = -Math.abs(m.vx); }
    if (m.y < r) { m.y = r; m.vy = Math.abs(m.vy); }
    if (m.y > h - r) { m.y = h - r; m.vy = -Math.abs(m.vy); }
    el.style.left = `${m.x}px`;
    el.style.top = `${m.y}px`;
  }
}

function clearTargets(p) {
  p.arena.querySelectorAll('.target').forEach((t) => t.remove());
  p.targets = [];
  p.lit = null;
}

// Spegne un bersaglio (in modalità "compaiono" lo toglie)
function extinguish(p, el) {
  if (!el) return;
  el.classList.remove('lit');
  el.style.removeProperty('--c');
  if (session.settings.mode === 'compaiono') el.remove();
}

function applyBackground(p, c) {
  p.bg = c;
  p.arena.style.background = rgbStr(c);
  p.arena.classList.toggle('light-bg', luminance(c) > 0.3);
}

function setMsg(p, text, bad = false) {
  p.msg.textContent = text;
  p.msg.classList.toggle('bad', bad);
  p.msg.style.opacity = text ? 1 : 0;
}

function updateHud(p) {
  const s = session.settings;
  const sv = session.survival;
  p.v.ptag.textContent = `G${p.idx + 1}`;
  p.v['count-lbl'].textContent = sv ? 'Presi' : 'Interazione';
  p.v.count.textContent = sv ? p.times.length : `${interactions(p)} / ${s.rounds}`;
  p.v.last.textContent = fmt(p.times[p.times.length - 1]);
  p.v.avg.textContent = fmt(mean(p.times));
  p.v.err.textContent = p.errors;
  p.v.miss.textContent = p.missed;
  p.v.score.textContent = p.score;
  p.s.ptag.hidden = !session.duo;
  p.s.score.hidden = !session.duo;
  p.s.time.hidden = !sv;
  p.s.lives.hidden = !sv;
  p.s.err.hidden = sv;
  p.s.miss.hidden = sv || !s.timeout;
  if (sv) renderLives(p);
}

function setBar(p, ms, frozen = false) {
  const pct = Math.min(ms / barMax(p), 1) * 100;
  p.barFill.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
  p.barFill.classList.toggle('frozen', frozen);
  p.barLabel.textContent = `${Math.round(ms)} ms`;
}

function tickBar(p) {
  if (p.phase !== 'lit') return;
  setBar(p, performance.now() - p.litAt);
  p.raf = requestAnimationFrame(() => tickBar(p));
}

// ---------- Disturbi ----------

function createDistractors(p) {
  const s = session.settings;
  const w = p.arena.clientWidth;
  const h = p.arena.clientHeight;
  for (let i = 0; i < s.distractors; i++) {
    const size = SIZES[s.size] * rand(0.8, 1.3);
    const angle = rand(0, Math.PI * 2);
    const v = rand(60, 160);
    const el = document.createElement('div');
    el.className = 'distractor';
    el.style.width = el.style.height = `${size}px`;
    el.style.color = rgbStr(newDistractorColor(s, p.bg));
    el.innerHTML = `<svg viewBox="0 0 100 100" fill="currentColor">${pick(SHAPES)}</svg>`;
    p.arena.appendChild(el);
    p.distractors.push({
      el, size,
      x: rand(size / 2, w - size / 2),
      y: rand(size / 2, h - size / 2),
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      rot: rand(0, 360),
      vr: rand(-90, 90),
    });
  }
  moveDistractors(p, 0);
}

function moveDistractors(p, dt) {
  dt /= speed(p); // in survival anche i disturbi accelerano
  const w = p.arena.clientWidth;
  const h = p.arena.clientHeight;
  for (const d of p.distractors) {
    const r = d.size / 2;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.rot += d.vr * dt;
    if (d.x < r) { d.x = r; d.vx = Math.abs(d.vx); }
    if (d.x > w - r) { d.x = w - r; d.vx = -Math.abs(d.vx); }
    if (d.y < r) { d.y = r; d.vy = Math.abs(d.vy); }
    if (d.y > h - r) { d.y = h - r; d.vy = -Math.abs(d.vy); }
    d.el.style.transform = `translate(${d.x - r}px, ${d.y - r}px) rotate(${d.rot}deg)`;
  }
}

function distractorLoop(t) {
  const dt = session.distLast == null ? 0 : Math.min((t - session.distLast) / 1000, 0.05);
  session.distLast = t;
  session.players.forEach((p) => {
    moveDistractors(p, dt);
    if (session.settings.moving) moveTargets(p, dt / speed(p));
  });
  session.distRaf = requestAnimationFrame(distractorLoop);
}

// anima disturbi e bersagli in movimento
function startDistractors() {
  if (!session.settings.moving && !session.players.some((p) => p.distractors.length)) return;
  cancelAnimationFrame(session.distRaf);
  session.distLast = null;
  session.distRaf = requestAnimationFrame(distractorLoop);
}

function stopDistractors() {
  cancelAnimationFrame(session.distRaf);
  session.distLast = null;
}

function recolorDistractors(p) {
  for (const d of p.distractors) d.el.style.color = rgbStr(newDistractorColor(session.settings, p.bg));
}

// ---------- Ciclo di gioco ----------

function startGame(survival = false) {
  stopGame();
  session.survival = survival;
  session.duo = settings.players === 2;
  session.settings = survival ? { ...SURVIVAL, sounds: settings.sounds, music: settings.music } : { ...settings };
  session.startAt = 0;
  session.endAt = 0;
  session.pausedTotal = 0;
  playersEl.classList.toggle('duo', session.duo);
  session.players = Array.from({ length: session.duo ? 2 : 1 }, (_, i) => createPlayer(i));
  show('game');
  layoutPlayers();
  $('#pause').classList.remove('active');
  const s = session.settings;
  for (const p of session.players) {
    p.arena.classList.toggle('hard', s.colors === 'difficili');
    p.arena.classList.toggle('psy', s.bg === 'psichedelico');
    if (s.bg === 'psichedelico') p.arena.insertAdjacentHTML('afterbegin', '<div class="psy-layer"></div>');
    applyBackground(p, newBackground(s));
    if (s.bg === 'foto' && bgPhoto) {
      p.arena.classList.add('photo');
      p.arena.classList.remove('light-bg');
      p.arena.style.background = `${rgbStr(p.bg)} url(${bgPhoto.src}) center / cover no-repeat`;
    }
    setBar(p, 0);
    updateHud(p);
    setMsg(p, 'Tocca il bersaglio appena si illumina');
  }
  sound.init(s);
  sound.music(s.music);
  session.phase = 'running';
  // le arene hanno dimensioni solo dopo che la schermata è visibile
  requestAnimationFrame(() => {
    if (session.phase !== 'running') return;
    for (const p of session.players) {
      if (s.mode === 'visibili') buildVisibleTargets(p);
      createDistractors(p);
      scheduleNext(p);
    }
    startDistractors();
    session.startAt = performance.now();
    if (session.survival) {
      session.chronoTimer = setInterval(() => {
        const txt = fmtDuration(elapsed());
        session.players.forEach((p) => { p.v.time.textContent = txt; });
      }, 100);
    }
  });
}

function buildVisibleTargets(p) {
  clearTargets(p);
  const size = SIZES[session.settings.size];
  p.targets = randomPositions(p, session.settings.targets, size).map((pt) => makeTarget(p, pt));
}

function scheduleNext(p) {
  const s = session.settings;
  p.phase = 'wait';
  clearTimeout(p.timer);
  clearTimeout(p.missTimer);
  if (s.bg === 'variabile') {
    applyBackground(p, newBackground(s));
    recolorDistractors(p);
  }
  const [min, max] = FREQ[s.freq];
  const f = speed(p);
  p.timer = setTimeout(() => lightTarget(p), rand(Math.max(250, min * f), Math.max(400, max * f)));
}

function nextOrEnd(p) {
  if (session.survival || interactions(p) < session.settings.rounds) {
    scheduleNext(p);
    return;
  }
  p.phase = 'done';
  if (session.players.every((q) => q.phase === 'done')) endGame();
  else setMsg(p, 'Finito! Aspetta l\'avversario');
}

// Survival: toglie una vita; restituisce true se la partita è finita
function loseLife(p) {
  if (!session.survival) return false;
  p.lives--;
  renderLives(p);
  if (p.lives > 0) return false;
  endGame(p);
  return true;
}

function lightTarget(p) {
  const s = session.settings;
  const el = s.mode === 'visibili' ? pick(p.targets) : makeTarget(p, randomPositions(p, 1, SIZES[s.size])[0]);
  const color = newTargetColor(s, p.bg);
  p.lit = el;
  // 1° frame: accende il bersaglio; 2° frame: il bersaglio è a schermo, parte il cronometro
  requestAnimationFrame(() => {
    if (p.phase !== 'wait' || session.phase !== 'running') return;
    el.style.setProperty('--c', rgbStr(color));
    el.classList.add('lit');
    p.missedAt = 0;
    // colori difficili: metà dei disturbi prende il colore del bersaglio
    if (s.colors === 'difficili') {
      p.distractors.forEach((d) => { if (Math.random() < 0.5) d.el.style.color = rgbStr(color); });
    }
    setMsg(p, '');
    requestAnimationFrame(() => {
      if (p.phase !== 'wait' || session.phase !== 'running') return;
      p.litAt = performance.now();
      p.phase = 'lit';
      p.curTimeout = s.timeout ? Math.max(400, s.timeout * speed(p)) : 0;
      if (p.curTimeout) p.missTimer = setTimeout(() => missTarget(p), p.curTimeout);
      tickBar(p);
    });
  });
}

function missTarget(p) {
  if (p.phase !== 'lit') return;
  cancelAnimationFrame(p.raf);
  p.missed++;
  p.score -= MISS_PENALTY;
  p.missedAt = performance.now();
  sound.play('miss');
  setBar(p, barMax(p), true);
  p.barLabel.textContent = 'Mancato';
  extinguish(p, p.lit);
  p.lit = null;
  setMsg(p, 'Mancato!', true);
  updateHud(p);
  if (!loseLife(p)) nextOrEnd(p);
}

// Usa il timestamp dell'evento (più preciso), se è nella stessa base di performance.now()
function eventTime(e) {
  const now = performance.now();
  const t = e.timeStamp;
  return t > 0 && t <= now + 1 && t >= now - 1000 ? t : now;
}

// Segna un errore; restituisce true se in survival era l'ultima vita
function flashError(p, text) {
  p.errors++;
  p.score -= ERROR_PENALTY;
  sound.play('error');
  updateHud(p);
  setMsg(p, text, true);
  p.arena.classList.add('error');
  clearTimeout(p.errTimer);
  p.errTimer = setTimeout(() => {
    p.arena.classList.remove('error');
    if (p.phase === 'wait' || p.phase === 'lit') setMsg(p, '');
  }, 500);
  return loseLife(p);
}

function onPointer(p, e) {
  e.preventDefault();
  if (session.phase !== 'running' || (p.phase !== 'wait' && p.phase !== 'lit')) return;
  const hitEl = e.target.closest('.target');

  if (!hitEl && e.target.closest('.distractor')) {
    flashError(p, 'Elemento di disturbo');
    return;
  }

  if (p.phase === 'wait' && p.missedAt && performance.now() - p.missedAt < LATE_MS) {
    // tocco su un bersaglio appena scaduto: è già contato tra i mancati
    setMsg(p, 'Troppo tardi!', true);
    return;
  }

  if (p.phase === 'wait') {
    // tocco in anticipo: errore e l'attesa ricomincia
    extinguish(p, p.lit);
    p.lit = null;
    if (!flashError(p, 'Troppo presto!')) scheduleNext(p);
    return;
  }

  if (hitEl !== p.lit) {
    flashError(p, 'Bersaglio sbagliato');
    return;
  }

  const rt = Math.max(0, eventTime(e) - p.litAt);
  clearTimeout(p.missTimer);
  cancelAnimationFrame(p.raf);
  p.times.push(rt);
  p.score += hitPoints(rt);
  sound.play('hit');
  setBar(p, rt, true);
  updateHud(p);

  const el = p.lit;
  p.lit = null;
  extinguish(p, el);
  if (session.settings.mode === 'visibili') {
    el.classList.add('hit');
    setTimeout(() => el.classList.remove('hit'), 260);
  }

  nextOrEnd(p);
}

function stopPlayerTimers(p) {
  clearTimeout(p.timer);
  clearTimeout(p.missTimer);
  clearTimeout(p.errTimer);
  cancelAnimationFrame(p.raf);
}

function stopGame() {
  clearInterval(session.chronoTimer);
  stopDistractors();
  session.players.forEach(stopPlayerTimers);
  session.players = [];
  playersEl.innerHTML = '';
  sound.music(null);
  session.phase = 'idle';
}

function quitGame() {
  if (session.phase === 'done' || session.phase === 'idle' || confirm('Uscire dalla partita? I risultati non verranno salvati.')) {
    stopGame();
    show('menu');
  }
}

function pauseGame() {
  if (session.phase !== 'running') return;
  stopDistractors();
  sound.music(null);
  for (const p of session.players) {
    clearTimeout(p.timer);
    clearTimeout(p.missTimer);
    cancelAnimationFrame(p.raf);
    extinguish(p, p.lit);
    p.lit = null;
    setBar(p, 0);
    if (p.phase !== 'done') p.phase = 'paused';
  }
  session.pausedAt = performance.now();
  session.phase = 'paused';
  $('#pause').classList.add('active');
}

function resumeGame() {
  $('#pause').classList.remove('active');
  if (session.phase !== 'paused') return;
  session.pausedTotal += performance.now() - session.pausedAt;
  session.phase = 'running';
  startDistractors();
  sound.music(session.settings.music);
  for (const p of session.players) {
    if (p.phase === 'done') continue;
    setMsg(p, 'Tocca il bersaglio appena si illumina');
    scheduleNext(p);
  }
}

// Se l'app va in background il tempo non sarebbe valido: pausa
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseGame();
});

// Cambio di orientamento: rigira i campi e ridispone i bersagli visibili
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (session.phase !== 'running' && session.phase !== 'paused') return;
    layoutPlayers();
    if (!session.duo && session.settings.mode !== 'visibili') return;
    pauseGame();
    if (session.settings.mode === 'visibili') session.players.forEach(buildVisibleTargets);
  }, 150);
});

// loser: in survival il giocatore che ha finito le vite
function endGame(loser = null) {
  if (session.phase === 'done') return;
  session.endAt = performance.now();
  session.phase = 'done';
  clearInterval(session.chronoTimer);
  stopDistractors();
  for (const p of session.players) {
    stopPlayerTimers(p);
    p.phase = 'done';
  }
  sound.music(null);
  sound.play('end');

  const pdata = (p) => ({ times: p.times.map((t) => Math.round(t)), errors: p.errors, missed: p.missed, score: p.score });
  const record = { date: Date.now(), settings: session.settings };
  if (session.survival) {
    record.survival = true;
    record.duration = Math.round(elapsed());
    session.players.forEach((p) => { p.v.time.textContent = fmtDuration(record.duration); });
  }

  if (session.duo) {
    const [a, b] = session.players;
    const winner = loser ? 1 - loser.idx : a.score === b.score ? -1 : a.score > b.score ? 0 : 1;
    Object.assign(record, { duo: true, players: session.players.map(pdata), winner });
    session.players.forEach((p) => {
      if (winner === -1) setMsg(p, 'Pareggio!');
      else setMsg(p, winner === p.idx ? 'Hai vinto! 🏆' : 'Hai perso', winner !== p.idx);
    });
  } else {
    Object.assign(record, pdata(session.players[0]));
    if (session.survival) {
      const prev = load(LS_RECORD, 0);
      record.newRecord = record.duration > prev;
      if (record.newRecord) save(LS_RECORD, record.duration);
      setMsg(session.players[0], 'Game over', true);
    }
  }

  const history = load(LS_HISTORY, []);
  history.push(record);
  save(LS_HISTORY, history.slice(-HISTORY_MAX));
  const delay = session.duo ? 2500 : session.survival ? 1200 : 400;
  setTimeout(() => {
    if (session.phase !== 'done') return;
    stopGame();
    showResults(record);
  }, delay);
}

// ---------- Modalità gatto ----------

const CAT_BUGS = 2; // animali contemporaneamente sullo schermo
const BUG_SIZE = 90; // px (moltiplicato per la scala di ogni animale)
const CAT_EXIT_HOLD = 1200; // ms da tenere premuto per uscire (una zampata non basta)

// Insetti disegnati rivolti verso l'alto (viewBox 0 0 100 100)
const legs = (c) => `
  <g class="legs-l" stroke="${c}" stroke-width="5" stroke-linecap="round" fill="none">
    <path d="M38 42 L14 30 L10 20"/><path d="M36 56 L8 56"/><path d="M38 70 L14 84 L12 94"/>
  </g>
  <g class="legs-r" stroke="${c}" stroke-width="5" stroke-linecap="round" fill="none">
    <path d="M62 42 L86 30 L90 20"/><path d="M64 56 L92 56"/><path d="M62 70 L86 84 L88 94"/>
  </g>`;
const antennae = (c) => `<path d="M45 14 Q40 2 32 0 M55 14 Q60 2 68 0" stroke="${c}" stroke-width="3" fill="none" stroke-linecap="round"/>`;

// Ogni animale: disegno, macchia, suono dei passi (step) e ogni quanto, suono dello scatto (dash),
// verso da fermo (idle), velocità [min, max] px/s, moltiplicatore dello scatto, scala, quanto curva
const BUG_DEFAULTS = { step: 'rustle', stepEvery: [0.15, 0.3], dash: 'zip', idle: null, speed: [40, 85], dashMul: 3.5, scale: 1, turn: 3 };

const BUGS = [
  { // coccinella
    splat: '#7a1015',
    svg: legs('#111') + antennae('#111') + `
      <ellipse cx="50" cy="58" rx="28" ry="32" fill="#e3262f"/>
      <circle cx="50" cy="22" r="12" fill="#111"/>
      <path d="M50 27 V90" stroke="#111" stroke-width="3"/>
      <circle cx="38" cy="48" r="6" fill="#111"/><circle cx="62" cy="48" r="6" fill="#111"/>
      <circle cx="36" cy="70" r="5" fill="#111"/><circle cx="64" cy="70" r="5" fill="#111"/>
      <circle cx="44" cy="17" r="3" fill="#fff"/><circle cx="56" cy="17" r="3" fill="#fff"/>`,
  },
  { // scarabeo
    splat: '#2f5a1c',
    svg: legs('#1d2b14') + antennae('#1d2b14') + `
      <ellipse cx="50" cy="60" rx="22" ry="32" fill="#2fbf71"/>
      <path d="M50 30 V92" stroke="#167a45" stroke-width="3"/>
      <ellipse cx="50" cy="26" rx="14" ry="10" fill="#1f8f52"/>
      <ellipse cx="43" cy="52" rx="5" ry="12" fill="#7ff0b0" opacity=".5"/>`,
  },
  { // ape
    splat: '#8a6d00',
    step: 'buzz',
    stepEvery: [0.6, 1.1],
    dash: 'buzz',
    idle: 'buzz',
    svg: legs('#222') + antennae('#222') + `
      <g class="wings" fill="#fff" opacity=".7">
        <ellipse cx="28" cy="44" rx="18" ry="10" transform="rotate(-25 28 44)"/>
        <ellipse cx="72" cy="44" rx="18" ry="10" transform="rotate(25 72 44)"/>
      </g>
      <ellipse cx="50" cy="60" rx="20" ry="28" fill="#ffc61a"/>
      <path d="M31 52 H69 M30 64 H70 M34 76 H66" stroke="#222" stroke-width="7"/>
      <circle cx="50" cy="26" r="11" fill="#222"/>`,
  },
  { // topo
    splat: '#5a3a3a',
    step: 'patter',
    stepEvery: [0.1, 0.18],
    dash: 'squeak',
    idle: 'squeak',
    speed: [50, 100],
    scale: 1.25,
    svg: `
      <path class="tail" d="M50 86 Q38 100 54 110 Q66 118 50 128" stroke="#d9a5a5" stroke-width="3" fill="none" stroke-linecap="round"/>
      <g class="legs-l" fill="#e8b4b4"><ellipse cx="32" cy="46" rx="5" ry="4"/><ellipse cx="32" cy="74" rx="5" ry="4"/></g>
      <g class="legs-r" fill="#e8b4b4"><ellipse cx="68" cy="46" rx="5" ry="4"/><ellipse cx="68" cy="74" rx="5" ry="4"/></g>
      <ellipse cx="50" cy="60" rx="20" ry="28" fill="#9a9aa3"/>
      <ellipse cx="50" cy="28" rx="13" ry="16" fill="#a9a9b2"/>
      <circle cx="37" cy="22" r="8" fill="#a9a9b2"/><circle cx="63" cy="22" r="8" fill="#a9a9b2"/>
      <circle cx="37" cy="22" r="4.5" fill="#f0b8c4"/><circle cx="63" cy="22" r="4.5" fill="#f0b8c4"/>
      <circle cx="45" cy="22" r="2.2" fill="#111"/><circle cx="55" cy="22" r="2.2" fill="#111"/>
      <circle cx="50" cy="12" r="3" fill="#f08ca0"/>
      <path d="M44 14 L30 10 M44 15 L30 16 M56 14 L70 10 M56 15 L70 16" stroke="#555" stroke-width="1"/>`,
  },
  { // ragno
    splat: '#222',
    step: 'tick',
    stepEvery: [0.1, 0.2],
    speed: [30, 70],
    dashMul: 4.5,
    svg: `
      <g class="legs-l" stroke="#1a1a1a" stroke-width="4" stroke-linecap="round" fill="none">
        <path d="M42 34 Q20 20 14 4"/><path d="M40 40 Q16 34 6 26"/><path d="M40 46 Q16 54 6 64"/><path d="M42 52 Q22 70 16 88"/>
      </g>
      <g class="legs-r" stroke="#1a1a1a" stroke-width="4" stroke-linecap="round" fill="none">
        <path d="M58 34 Q80 20 86 4"/><path d="M60 40 Q84 34 94 26"/><path d="M60 46 Q84 54 94 64"/><path d="M58 52 Q78 70 84 88"/>
      </g>
      <ellipse cx="50" cy="64" rx="17" ry="20" fill="#1a1a1a"/>
      <circle cx="50" cy="40" r="11" fill="#2a2a2a"/>
      <path d="M46 58 L54 58 L50 64 L54 70 L46 70 L50 64Z" fill="#d22"/>
      <circle cx="46" cy="34" r="2" fill="#fff"/><circle cx="54" cy="34" r="2" fill="#fff"/>`,
  },
  { // lucertola
    splat: '#2f5a1c',
    step: 'scratch',
    stepEvery: [0.12, 0.22],
    dashMul: 4.5,
    scale: 1.4,
    svg: `
      <path class="tail" d="M50 70 Q42 90 52 104 Q60 116 50 132" stroke="#4aa82e" stroke-width="7" fill="none" stroke-linecap="round"/>
      <g class="legs-l" stroke="#4aa82e" stroke-width="5" stroke-linecap="round" fill="none"><path d="M42 38 L28 32 L24 24"/><path d="M42 62 L28 68 L24 76"/></g>
      <g class="legs-r" stroke="#4aa82e" stroke-width="5" stroke-linecap="round" fill="none"><path d="M58 38 L72 32 L76 24"/><path d="M58 62 L72 68 L76 76"/></g>
      <ellipse cx="50" cy="50" rx="11" ry="25" fill="#5fbf3a"/>
      <ellipse cx="50" cy="22" rx="9" ry="11" fill="#6bd044"/>
      <circle cx="50" cy="42" r="2.5" fill="#a6ec7c"/><circle cx="50" cy="52" r="2.5" fill="#a6ec7c"/><circle cx="50" cy="62" r="2.5" fill="#a6ec7c"/>
      <circle cx="45" cy="19" r="2" fill="#111"/><circle cx="55" cy="19" r="2" fill="#111"/>`,
  },
  { // farfalla
    splat: '#7a3a8a',
    step: 'flutter',
    stepEvery: [0.25, 0.4],
    dash: 'flutter',
    speed: [35, 70],
    dashMul: 2.2,
    turn: 5,
    svg: `
      <g class="flap">
        <ellipse cx="30" cy="40" rx="21" ry="16" fill="#ff7ad9"/><ellipse cx="70" cy="40" rx="21" ry="16" fill="#ff7ad9"/>
        <ellipse cx="34" cy="64" rx="14" ry="12" fill="#ffb347"/><ellipse cx="66" cy="64" rx="14" ry="12" fill="#ffb347"/>
        <circle cx="27" cy="38" r="5" fill="#fff" opacity=".8"/><circle cx="73" cy="38" r="5" fill="#fff" opacity=".8"/>
      </g>
      <ellipse cx="50" cy="52" rx="4" ry="22" fill="#222"/>` + antennae('#222'),
  },
  { // scarafaggio
    splat: '#4a2e14',
    speed: [50, 95],
    dashMul: 4,
    svg: legs('#3a2410') + `
      <path d="M46 22 Q30 0 18 -16 M54 22 Q70 0 82 -16" stroke="#3a2410" stroke-width="2" fill="none"/>
      <ellipse cx="50" cy="60" rx="18" ry="32" fill="#7a4a1e"/>
      <path d="M50 40 V92" stroke="#4a2e14" stroke-width="2"/>
      <ellipse cx="50" cy="30" rx="15" ry="9" fill="#8b5a2b"/>`,
  },
].map((b) => ({ ...BUG_DEFAULTS, ...b }));

const catArena = $('#cat-arena');
const catExit = $('#cat-exit');
const cat = { bugs: [], count: 0, raf: null, last: null, timers: [], holdTimer: null };

function startCat() {
  stopGame();
  stopCat();
  cat.count = 0;
  $('#cat-count').textContent = 0;
  sound.fx('rustle'); // sblocca l'audio durante il tocco sul pulsante
  show('cat');
  requestAnimationFrame(() => {
    for (let i = 0; i < CAT_BUGS; i++) spawnBug();
    cat.last = null;
    cat.raf = requestAnimationFrame(catLoop);
  });
}

function stopCat() {
  cancelAnimationFrame(cat.raf);
  cat.timers.forEach(clearTimeout);
  cat.timers = [];
  cat.bugs.forEach((b) => b.el.remove());
  cat.bugs = [];
  catArena.querySelectorAll('.splat').forEach((s) => s.remove());
}

// Un nuovo animale entra da un bordo e si dirige verso il centro
function spawnBug() {
  const w = catArena.clientWidth;
  const h = catArena.clientHeight;
  const type = pick(BUGS);
  const size = BUG_SIZE * type.scale * rand(0.85, 1.15);
  const edge = Math.floor(Math.random() * 4);
  const x = edge === 0 ? -size / 2 : edge === 1 ? w + size / 2 : rand(0, w);
  const y = edge === 2 ? -size / 2 : edge === 3 ? h + size / 2 : rand(0, h);
  const el = document.createElement('div');
  el.className = 'bug';
  el.style.width = el.style.height = `${size}px`;
  el.innerHTML = `<svg viewBox="0 0 100 100">${type.svg}</svg>`;
  catArena.appendChild(el);
  cat.bugs.push({
    el, size, x, y, type,
    heading: Math.atan2(h / 2 - y, w / 2 - x) + rand(-0.6, 0.6),
    turn: 0,
    speed: rand(...type.speed),
    pause: 0,
    dash: 0, // secondi di scatto rimasti
    noiseT: 0,
  });
}

// Camminata da animale: curve casuali, soste, ripartenze, scatti improvvisi, rientro dai bordi
function catLoop(t) {
  const dt = cat.last == null ? 0 : Math.min((t - cat.last) / 1000, 0.05);
  cat.last = t;
  const w = catArena.clientWidth;
  const h = catArena.clientHeight;
  for (const b of cat.bugs) {
    const pan = (b.x / w) * 2 - 1; // i suoni arrivano dal lato dove si trova
    const onScreen = b.x > 0 && b.x < w && b.y > 0 && b.y < h;
    if (b.pause > 0) {
      b.pause -= dt;
      // da fermo ogni tanto fa il suo verso (topo, ape)
      if (b.type.idle && onScreen && Math.random() < dt * 0.4) sound.fx(b.type.idle, pan);
      if (b.pause <= 0) b.el.classList.remove('still');
    } else {
      if (b.dash > 0) {
        b.dash -= dt;
        if (b.dash <= 0) b.el.classList.remove('dash');
      } else if (onScreen && Math.random() < dt * 0.3) {
        // scatto: parte di colpo, con il suo suono
        b.dash = rand(0.35, 0.7);
        b.turn = rand(-1, 1);
        b.el.classList.add('dash');
        sound.fx(b.type.dash, pan);
      } else if (Math.random() < dt * 0.35) {
        b.pause = rand(0.4, 1.6);
        b.el.classList.add('still');
        continue;
      }
      if (b.dash <= 0 && Math.random() < dt * 1.5) b.turn = rand(-b.type.turn, b.type.turn);
      b.heading += b.turn * dt;
      const m = b.size / 2;
      if (b.x < m || b.x > w - m || b.y < m || b.y > h - m) {
        let diff = Math.atan2(h / 2 - b.y, w / 2 - b.x) - b.heading;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        b.heading += diff * Math.min(1, dt * 5);
      }
      const v = b.speed * (b.dash > 0 ? b.type.dashMul : 1);
      b.x += Math.cos(b.heading) * v * dt;
      b.y += Math.sin(b.heading) * v * dt;
      // passi: più fitti durante lo scatto
      b.noiseT -= dt * (b.dash > 0 ? 2.5 : 1);
      if (b.noiseT <= 0 && onScreen) {
        sound.fx(b.type.step, pan);
        b.noiseT = rand(...b.type.stepEvery);
      }
    }
    b.el.style.transform = `translate(${b.x - b.size / 2}px, ${b.y - b.size / 2}px) rotate(${(b.heading * 180) / Math.PI + 90}deg)`;
  }
  cat.raf = requestAnimationFrame(catLoop);
}

function squashBug(b) {
  cat.bugs.splice(cat.bugs.indexOf(b), 1);
  b.el.remove();
  const s = document.createElement('div');
  s.className = 'splat';
  s.style.left = `${b.x}px`;
  s.style.top = `${b.y}px`;
  s.style.width = s.style.height = `${b.size * 0.9}px`;
  s.style.background = `radial-gradient(circle, ${b.type.splat} 0 45%, transparent 70%)`;
  catArena.appendChild(s);
  setTimeout(() => s.remove(), 1300);
  cat.count++;
  $('#cat-count').textContent = cat.count;
  sound.fx('squish', (b.x / catArena.clientWidth) * 2 - 1);
  cat.timers.push(setTimeout(spawnBug, rand(800, 2000)));
}

catArena.addEventListener('pointerdown', (e) => {
  if (e.target.closest('#cat-exit')) return;
  e.preventDefault();
  // una zampa è grossa: basta toccare vicino all'insetto
  const r = catArena.getBoundingClientRect();
  const px = e.clientX - r.left;
  const py = e.clientY - r.top;
  let hit = null;
  let bestD = Infinity;
  for (const b of cat.bugs) {
    const d = Math.hypot(b.x - px, b.y - py);
    if (d < b.size * 0.7 && d < bestD) {
      hit = b;
      bestD = d;
    }
  }
  if (hit) squashBug(hit);
});

// Uscita solo tenendo premuto, così il gatto non esce per sbaglio
catExit.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  catExit.classList.add('holding');
  clearTimeout(cat.holdTimer);
  cat.holdTimer = setTimeout(() => {
    catExit.classList.remove('holding');
    stopCat();
    show('menu');
  }, CAT_EXIT_HOLD);
});
['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => catExit.addEventListener(ev, () => {
  clearTimeout(cat.holdTimer);
  catExit.classList.remove('holding');
}));

// ---------- Risultati ----------

function showResults(record) {
  if (record.duo) {
    showDuoResults(record);
    return;
  }
  const t = record.times;
  let cards;
  if (record.survival) {
    $('#res-title').textContent = 'Game over';
    $('#res-record').textContent = record.newRecord ? '🏆 Nuovo record!' : '';
    cards = [
      ['Tempo resistito', fmtDuration(record.duration), ''],
      ['Record', fmtDuration(load(LS_RECORD, record.duration)), 'good'],
      ['Presi', t.length, ''],
      ['Media', fmt(mean(t)), ''],
      ['Migliore', fmt(best(t)), 'good'],
    ];
  } else {
    $('#res-title').textContent = 'Risultati';
    $('#res-record').textContent = '';
    cards = [
      ['Media', fmt(mean(t)), ''],
      ['Migliore', fmt(best(t)), 'good'],
      ['Peggiore', fmt(worst(t)), 'bad'],
      ['Errori', record.errors, ''],
      ['Mancati', record.missed || 0, ''],
    ];
  }
  renderCards(cards);
  $('#res-meta').textContent = `${formatDate(record.date)} · ${settingsLabel(record.settings)}`;
  show('results');
  drawChart($('#res-chart'), t, { avg: mean(t), xLabel: 'tocco' });
}

function renderCards(cards) {
  $('#res-cards').innerHTML = cards
    .map(([lbl, val, cls]) => `<div class="card"><span class="lbl">${lbl}</span><span class="val ${cls}">${val}</span></div>`)
    .join('');
}

// Sfida in doppia: una riga di riquadri per giocatore
function showDuoResults(record) {
  const w = record.winner;
  $('#res-title').textContent = w === -1 ? 'Pareggio!' : `Vince il Giocatore ${w + 1}! 🏆`;
  $('#res-record').textContent = record.survival ? `Tempo resistito: ${fmtDuration(record.duration)}` : '';
  renderCards(record.players.flatMap((pl, i) => [
    [`G${i + 1} · Punti`, pl.score, i === w ? 'good' : ''],
    [`G${i + 1} · Presi`, pl.times.length, ''],
    [`G${i + 1} · Media`, fmt(mean(pl.times)), ''],
    [`G${i + 1} · Migliore`, fmt(best(pl.times)), ''],
    [`G${i + 1} · Errori / mancati`, `${pl.errors} / ${pl.missed}`, ''],
  ]));
  $('#res-meta').textContent = `${formatDate(record.date)} · In due · ${settingsLabel(record.settings)}`;
  show('results');
  drawChart($('#res-chart'), record.players[0].times, { second: record.players[1].times, xLabel: 'tocco · G1 verde, G2 rosa' });
}

// ---------- Storico ----------

function showHistory() {
  const history = load(LS_HISTORY, []);
  const list = $('#hist-list');
  list.innerHTML = '';
  if (!history.length) {
    list.innerHTML = '<li class="empty">Nessuna partita salvata</li>';
  } else {
    list.insertAdjacentHTML('beforeend',
      '<li class="head"><span>Data</span><span class="opt-col">Modalità</span><span>Media</span><span>Migliore</span><span class="err-col">Errori</span><span class="miss-col">Mancati</span></li>');
    [...history].reverse().forEach((r) => {
      const s = r.settings;
      const mode = s.level && s.level !== 'personalizzato' ? LEVEL_LABEL[s.level] : MODE_LABEL[s.mode];
      const detail = r.survival ? fmtDuration(r.duration) : s.rounds;
      const li = document.createElement('li');
      if (r.duo) {
        // in doppia: punti, vincitore, errori e mancati di G1 / G2
        const [a, b] = r.players;
        li.innerHTML = `<span>${formatDate(r.date)}</span>
          <span class="opt-col">In due · ${mode} · ${detail}</span>
          <span>${a.score} – ${b.score}</span>
          <span>${r.winner === -1 ? 'Pari' : `Vince G${r.winner + 1}`}</span>
          <span class="err-col">${a.errors} / ${b.errors}</span>
          <span class="miss-col">${a.missed} / ${b.missed}</span>`;
      } else {
        li.innerHTML = `<span>${formatDate(r.date)}</span>
          <span class="opt-col">${mode} · ${detail}</span>
          <span>${fmt(mean(r.times))}</span>
          <span>${fmt(best(r.times))}</span>
          <span class="err-col">${r.errors}</span>
          <span class="miss-col">${r.missed || 0}</span>`;
      }
      li.addEventListener('click', () => showResults(r));
      list.appendChild(li);
    });
  }
  show('history');
  // il grafico segue le partite da soli
  const solo = history.filter((r) => !r.duo).map((r) => mean(r.times)).filter((v) => v != null);
  drawChart($('#hist-chart'), solo, { xLabel: 'partita (da soli)' });
}

function clearHistory() {
  if (!confirm('Cancellare tutto lo storico delle partite e il record survival?')) return;
  save(LS_HISTORY, []);
  save(LS_RECORD, null);
  showHistory();
}

// ---------- Grafico (canvas) ----------

// second: seconda serie (giocatore 2), disegnata in rosa
function drawChart(canvas, values, { avg = null, xLabel = '', second = null } = {}) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const c = canvas.getContext('2d');
  c.scale(dpr, dpr);
  c.clearRect(0, 0, w, h);
  c.font = '11px system-ui, sans-serif';

  const series = [[values, '#4ade80']];
  if (second) series.push([second, '#ff6b9a']);
  const all = series.flatMap(([vals]) => vals);
  if (!all.length) {
    c.fillStyle = '#8a91a0';
    c.textAlign = 'center';
    c.fillText('Nessun dato', w / 2, h / 2);
    return;
  }

  const pad = { l: 48, r: 14, t: 14, b: 26 };
  const max = Math.max(...all) * 1.15 || 1;
  const n = Math.max(...series.map(([vals]) => vals.length));
  const x = (i) => pad.l + (n === 1 ? (w - pad.l - pad.r) / 2 : (i * (w - pad.l - pad.r)) / (n - 1));
  const y = (v) => h - pad.b - (v / max) * (h - pad.t - pad.b);

  // griglia e asse Y (ms)
  c.strokeStyle = 'rgba(255,255,255,0.08)';
  c.fillStyle = '#8a91a0';
  c.textAlign = 'right';
  c.textBaseline = 'middle';
  for (let k = 0; k <= 4; k++) {
    const v = (max * k) / 4;
    c.beginPath();
    c.moveTo(pad.l, y(v));
    c.lineTo(w - pad.r, y(v));
    c.stroke();
    c.fillText(`${Math.round(v)}`, pad.l - 8, y(v));
  }
  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';
  c.fillText(`ms · per ${xLabel}`, w / 2, h - 6);

  // linea della media
  if (avg != null) {
    c.strokeStyle = 'rgba(255,210,63,0.7)';
    c.setLineDash([6, 5]);
    c.beginPath();
    c.moveTo(pad.l, y(avg));
    c.lineTo(w - pad.r, y(avg));
    c.stroke();
    c.setLineDash([]);
  }

  // andamento
  c.lineWidth = 2;
  for (const [vals, color] of series) {
    c.strokeStyle = color;
    c.beginPath();
    vals.forEach((v, i) => (i ? c.lineTo(x(i), y(v)) : c.moveTo(x(i), y(v))));
    c.stroke();
    c.fillStyle = color;
    vals.forEach((v, i) => {
      c.beginPath();
      c.arc(x(i), y(v), 3, 0, Math.PI * 2);
      c.fill();
    });
  }
}

// ---------- Animazione di apertura ----------

const INTRO_MS = 3000;

function playIntro() {
  const intro = $('#intro');
  const stage = intro.querySelector('.intro-stage');
  const w = innerWidth;
  const h = innerHeight;
  const add = (cls, html, vars) => {
    const el = document.createElement('div');
    el.className = cls;
    el.innerHTML = html;
    Object.entries(vars).forEach(([k, v]) => el.style.setProperty(k, v));
    stage.appendChild(el);
    return el;
  };
  // da un punto fuori da un bordo a un punto fuori dal bordo opposto
  const crossing = (size) => {
    const horizontal = Math.random() < 0.5;
    const flip = Math.random() < 0.5;
    const a = horizontal ? [-size, rand(0, h)] : [rand(0, w), -size];
    const b = horizontal ? [w + size, rand(0, h)] : [rand(0, w), h + size];
    return flip ? [b, a] : [a, b];
  };

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    intro.classList.add('calm');
  } else {
    // bersagli che si accendono a raffica
    for (let i = 0; i < 18; i++) {
      const el = add('intro-target', '', {
        '--d': `${0.1 + i * 0.08}s`,
        '--c': rgbStr(randomHsl(85, 100, 55, 65)),
      });
      el.style.left = `${rand(8, 92)}%`;
      el.style.top = `${rand(10, 85)}%`;
    }
    // disturbi che attraversano lo schermo girando
    for (let i = 0; i < 14; i++) {
      const size = rand(40, 110);
      const [[x0, y0], [x1, y1]] = crossing(size);
      const el = add('intro-shape', `<svg viewBox="0 0 100 100" fill="currentColor">${pick(SHAPES)}</svg>`, {
        '--x0': `${x0 - size / 2}px`, '--y0': `${y0 - size / 2}px`,
        '--x1': `${x1 - size / 2}px`, '--y1': `${y1 - size / 2}px`,
        '--r0': '0deg', '--r1': `${rand(-720, 720)}deg`,
        '--t': `${rand(1.1, 2)}s`, '--d': `${rand(0, 1.2)}s`,
      });
      el.style.width = el.style.height = `${size}px`;
      el.style.color = rgbStr(randomHsl(70, 100, 50, 65));
    }
    // insetti della modalità gatto che corrono via
    for (let i = 0; i < 5; i++) {
      const size = 80;
      const [[x0, y0], [x1, y1]] = crossing(size);
      const r = `${(Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI + 90}deg`;
      const el = add('bug intro-bug', `<svg viewBox="0 0 100 100">${pick(BUGS).svg}</svg>`, {
        '--x0': `${x0 - size / 2}px`, '--y0': `${y0 - size / 2}px`,
        '--x1': `${x1 - size / 2}px`, '--y1': `${y1 - size / 2}px`,
        '--r0': r, '--r1': r,
        '--t': `${rand(1.4, 2.2)}s`, '--d': `${rand(0.2, 1)}s`,
      });
      el.style.width = el.style.height = `${size}px`;
    }
  }

  // barra del tempo di reazione che corre e si ferma su un tempo
  const fill = intro.querySelector('.bar-fill');
  const label = intro.querySelector('.bar-label');
  const finalMs = Math.round(rand(160, 230));
  const t0 = performance.now();
  let raf;
  const tick = () => {
    const k = Math.min(Math.max((performance.now() - t0 - 300) / 1300, 0), 1);
    const ms = finalMs * k;
    fill.style.clipPath = `inset(0 ${100 - (ms / 300) * 100}% 0 0)`;
    label.textContent = `${Math.round(ms)} ms`;
    if (k < 1) raf = requestAnimationFrame(tick);
  };
  tick();

  let done = false;
  const end = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    intro.classList.add('out');
    setTimeout(() => intro.remove(), 450);
  };
  setTimeout(end, INTRO_MS - 400); // poi 0,4 s di dissolvenza
  intro.addEventListener('pointerdown', end);
}

// ---------- Avvio ----------

renderOptions();
renderMenuSummary();
playIntro();
