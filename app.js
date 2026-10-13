(() => {
  const $app = document.getElementById('app');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const fmtDate = iso => new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const fmtNum = n => n.toLocaleString('es-AR');
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const setTheme = t => {
    document.body.className = 'theme-' + t;
    window.scrollTo(0, 0);
    if (t === 'game') document.querySelectorAll('.confetti').forEach(c => c.remove()); // nada de colores encima de las pruebas
  };

  // ---------- Datos (quedan solo en este aparato) ----------
  const STORE_KEY = 'cazadores-de-colores-v1';
  // El nombre del jugador se escribe en el aparato y queda guardado solo ahí (no está en el código).
  let db = { players: [], sessions: [], currentPlayer: null };
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) db = JSON.parse(raw);
  } catch (e) { /* sin almacenamiento: la app funciona igual, sin historial */ }
  const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch (e) {} };
  const player = id => db.players.find(p => p.id === id);
  const sessionsOf = (id, mission) => db.sessions.filter(s => s.playerId === id && (!mission || s.mission === mission));
  const curName = () => (player(db.currentPlayer) || {}).name || '';

  function deviceLabel() {
    const ua = navigator.userAgent;
    if (/iPhone/.test(ua)) return 'iPhone';
    if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'iPad';
    if (/Android/.test(ua)) return 'Android';
    if (/Macintosh/.test(ua)) return 'Mac';
    if (/Windows/.test(ua)) return 'Windows';
    return 'Otro';
  }

  // ---------- Partidas sin terminar (se retoman donde quedaron) ----------
  const progressKey = m => db.currentPlayer + ':' + m;
  const getProgress = m => (db.progress || {})[progressKey(m)];
  function setProgress(m, st) {
    db.progress = db.progress || {};
    if (st) db.progress[progressKey(m)] = st; else delete db.progress[progressKey(m)];
    save();
  }

  // ---------- Premios: estrellas, poder y esferas ----------
  const ORB_GOAL = 7;
  const sessionStars = s => s.stars ?? (s.trials || s.answers || []).length;
  function powerOf(id) {
    let stars = sessionsOf(id).reduce((a, s) => a + sessionStars(s), 0);
    for (const m of [1, 2, 3, 4]) { const p = (db.progress || {})[id + ':' + m]; if (p) stars += p.stars || 0; }
    return stars * 100;
  }
  // Misión 1 da dos esferas (una por nivel); las otras, una.
  function orbsOf(id) {
    let n = sessionsOf(id).reduce((a, s) => a + (s.mission === 1 ? 2 : 1), 0);
    const p1 = (db.progress || {})[id + ':1'];
    if (p1 && p1.part === 2) n++;
    return Math.min(ORB_GOAL, n);
  }

  // ---------- Dibujos ----------
  // Compañero (mascota): cada jugador elige piel, pelo, rayo y nombre. Se guarda en el jugador.
  const DEFAULT_PET = { name: 'Chispa', skin: '#ffc93c', hair: '#2f6feb', bolt: '#ff8a00', body: 'redondo', hairStyle: 'puntas', extra: 'nada' };
  // Formas: cuerpo, peinado y extras (cada opción dibuja su parte del SVG).
  const PET_SHAPES = {
    body: {
      redondo: (f, st) => `<circle cx="60" cy="68" r="40" fill="${f}" stroke="${st}" stroke-width="4"/>`,
      cuadrado: (f, st) => `<rect x="20" y="28" width="80" height="80" rx="22" fill="${f}" stroke="${st}" stroke-width="4"/>`,
      huevo: (f, st) => `<ellipse cx="60" cy="70" rx="36" ry="42" fill="${f}" stroke="${st}" stroke-width="4"/>`,
    },
    hairStyle: {
      puntas: (f, st) => `<polygon points="22,58 14,22 40,38 48,6 62,32 80,4 84,36 108,20 98,58" fill="${f}" stroke="${st}" stroke-width="3" stroke-linejoin="round"/>`,
      cresta: (f, st) => `<polygon points="44,46 46,12 54,30 60,0 66,30 74,12 76,46" fill="${f}" stroke="${st}" stroke-width="3" stroke-linejoin="round"/>`,
      mechón: (f, st) => `<path d="M60 34 C46 8 82 2 76 20 C72 30 62 26 66 18" fill="none" stroke="${st}" stroke-width="10" stroke-linecap="round"/><path d="M60 34 C46 8 82 2 76 20 C72 30 62 26 66 18" fill="none" stroke="${f}" stroke-width="6" stroke-linecap="round"/>`,
      pelado: () => '',
    },
    extra: {
      nada: () => '',
      orejas: (pet) => `<polygon points="24,50 26,10 54,32" fill="${pet.skin}" stroke="${darken(pet.skin)}" stroke-width="3" stroke-linejoin="round"/><polygon points="96,50 94,10 66,32" fill="${pet.skin}" stroke="${darken(pet.skin)}" stroke-width="3" stroke-linejoin="round"/><polygon points="30,40 31,20 46,32" fill="#ff8fb1"/><polygon points="90,40 89,20 74,32" fill="#ff8fb1"/>`,
      antenas: (pet) => `<path d="M48 32 L36 8 M72 32 L84 8" stroke="#1b1b2a" stroke-width="3" stroke-linecap="round"/><circle cx="36" cy="8" r="6" fill="${pet.bolt}" stroke="${darken(pet.bolt, 0.6)}" stroke-width="2"/><circle cx="84" cy="8" r="6" fill="${pet.bolt}" stroke="${darken(pet.bolt, 0.6)}" stroke-width="2"/>`,
      cuernitos: () => `<polygon points="36,40 30,10 52,32" fill="#f5efe0" stroke="#a8977a" stroke-width="3" stroke-linejoin="round"/><polygon points="84,40 90,10 68,32" fill="#f5efe0" stroke="#a8977a" stroke-width="3" stroke-linejoin="round"/>`,
    },
  };
  const SHAPE_TITLES = { body: '🟢 Forma', hairStyle: '💇 Peinado', extra: '✨ Extras' };
  const PET_COLORS = {
    skin: [['amarillo', '#ffc93c'], ['naranja', '#ff9f43'], ['rosa', '#ff8fb1'], ['celeste', '#6ec6ff'], ['verde', '#7bd389'],
           ['violeta', '#b39ddb'], ['blanco', '#f5f5f5'], ['marrón', '#a47148'], ['rojo', '#f25f5c'], ['gris', '#b0b0b0']],
    hair: [['azul', '#2f6feb'], ['rojo', '#e53935'], ['negro', '#263238'], ['amarillo', '#fdd835'], ['verde', '#43a047'],
           ['violeta', '#7e57c2'], ['naranja', '#fb8c00'], ['rosa', '#ec407a'], ['blanco', '#eceff1'], ['marrón', '#6d4c41']],
    bolt: [['naranja', '#ff8a00'], ['amarillo', '#ffd600'], ['rojo', '#e53935'], ['azul', '#1e88e5'], ['verde', '#43a047'],
           ['violeta', '#8e24aa'], ['rosa', '#ec407a'], ['celeste', '#29b6f6'], ['blanco', '#ffffff'], ['negro', '#212121']],
  };
  const PET_NAMES = ['Chispa', 'Turbo', 'Rayito', 'Kiwi', 'Cometa', 'Bolita'];
  const darken = (hex, f = 0.7) => '#' + [1, 3, 5].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) * f).toString(16).padStart(2, '0')).join('');
  const curPet = () => ({ ...DEFAULT_PET, ...((player(db.currentPlayer) || {}).pet || {}) });
  const petSvg = (pet = curPet()) => {
    const pick = (k, v) => PET_SHAPES[k][v] || PET_SHAPES[k][DEFAULT_PET[k]];
    return `<svg class="mascot" viewBox="0 0 120 120" aria-hidden="true">
    ${pick('extra', pet.extra)(pet)}
    ${pick('hairStyle', pet.hairStyle)(pet.hair, darken(pet.hair))}
    ${pick('body', pet.body)(pet.skin, darken(pet.skin))}
    <polygon points="58,34 50,50 58,50 54,62 68,44 60,44 64,34" fill="${pet.bolt}" stroke="${darken(pet.bolt, 0.6)}" stroke-width="1.5" stroke-linejoin="round"/>
    <ellipse cx="45" cy="66" rx="9" ry="11" fill="#fff"/><ellipse cx="75" cy="66" rx="9" ry="11" fill="#fff"/>
    <circle cx="47" cy="68" r="5.5" fill="#1b1b2a"/><circle cx="77" cy="68" r="5.5" fill="#1b1b2a"/>
    <circle cx="49" cy="65.5" r="2" fill="#fff"/><circle cx="79" cy="65.5" r="2" fill="#fff"/>
    <circle cx="34" cy="83" r="6" fill="#ff6b6b" opacity=".85"/><circle cx="86" cy="83" r="6" fill="#ff6b6b" opacity=".85"/>
    <path d="M48 86 Q60 98 72 86" fill="none" stroke="#1b1b2a" stroke-width="4" stroke-linecap="round"/>
  </svg>`;
  };

  function starPath(cx, cy, ro, ri) {
    let d = '';
    for (let k = 0; k < 10; k++) {
      const r = k % 2 ? ri : ro, a = -Math.PI / 2 + k * Math.PI / 5;
      d += (k ? 'L' : 'M') + (cx + r * Math.cos(a)).toFixed(1) + ' ' + (cy + r * Math.sin(a)).toFixed(1);
    }
    return d + 'Z';
  }
  const ORB_STARS = {
    1: [[0, 0]], 2: [[-.24, 0], [.24, 0]], 3: [[0, -.22], [-.22, .18], [.22, .18]],
    4: [[-.2, -.2], [.2, -.2], [-.2, .2], [.2, .2]], 5: [[-.22, -.22], [.22, -.22], [0, 0], [-.22, .22], [.22, .22]],
    6: [[-.26, -.17], [0, -.17], [.26, -.17], [-.26, .19], [0, .19], [.26, .19]],
    7: [[0, 0], [0, -.3], [.26, -.15], [.26, .15], [0, .3], [-.26, .15], [-.26, -.15]],
  };
  let orbId = 0;
  function orb(n, filled) {
    if (!filled) return `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="rgba(255,255,255,.12)" stroke="rgba(255,255,255,.6)" stroke-width="4" stroke-dasharray="8 7"/></svg>`;
    const g = 'og' + (orbId++);
    const stars = ORB_STARS[n].map(([x, y]) => `<path d="${starPath(50 + x * 84, 52 + y * 84, n > 4 ? 9 : 11, n > 4 ? 3.8 : 4.6)}" fill="#e3261c"/>`).join('');
    return `<svg viewBox="0 0 100 100"><defs><radialGradient id="${g}" cx="38%" cy="32%" r="70%"><stop offset="0" stop-color="#ffe2a3"/><stop offset=".45" stop-color="#ffaa2b"/><stop offset="1" stop-color="#e5650a"/></radialGradient></defs>
      <circle cx="50" cy="50" r="44" fill="url(#${g})" stroke="#b84d00" stroke-width="3"/>${stars}
      <ellipse cx="36" cy="28" rx="13" ry="8" fill="#fff" opacity=".55" transform="rotate(-30 36 28)"/></svg>`;
  }
  const orbsRow = id => {
    const n = orbsOf(id);
    return `<div class="orbs">${Array.from({ length: ORB_GOAL }, (_, i) => orb(i + 1, i < n)).join('')}</div>
      <div class="orbs-label">${n >= ORB_GOAL ? '¡Juntaste las 7 esferas de poder! 🐉✨' : `Esferas de poder: ${n} de ${ORB_GOAL}`}</div>`;
  };

  const pts = p => p.map(([x, y]) => (x * 100).toFixed(1) + ',' + (y * 100).toFixed(1)).join(' ');
  const ICONS = {
    estrella: `<svg viewBox="0 0 100 100"><polygon points="${pts(Core.STAR)}" fill="#ffc83d" stroke="#d48a00" stroke-width="4" stroke-linejoin="round"/></svg>`,
    anillo: `<svg viewBox="0 0 100 100"><path fill="#ffd23f" stroke="#c98a00" stroke-width="3" fill-rule="evenodd" d="M50 18a32 32 0 1 0 0.01 0zM50 34a16 16 0 1 1-0.01 0z"/></svg>`,
    rayo: `<svg viewBox="0 0 100 100"><polygon points="${pts(Core.BOLT)}" fill="#ffe03d" stroke="#d49a00" stroke-width="4" stroke-linejoin="round"/></svg>`,
    hongo: `<svg viewBox="0 0 100 100"><rect x="39" y="50" width="22" height="32" rx="6" fill="#f3d9b1" stroke="#b08a5a" stroke-width="3"/><path d="M17 52a33 30 0 0 1 66 0z" fill="#e53935" stroke="#9e1c1a" stroke-width="3"/><circle cx="38" cy="38" r="6" fill="#fff"/><circle cx="62" cy="36" r="5" fill="#fff"/><circle cx="50" cy="27" r="4" fill="#fff"/></svg>`,
  };
  const SHAPE_LABEL = { estrella: 'Estrella', anillo: 'Anillo', rayo: 'Rayo', hongo: 'Hongo' };

  // Objetos de la Misión 3: la parte de color es la que se pregunta
  const OBJECTS = [
    { label: 'la pelota', svg: c => `<circle cx="100" cy="100" r="80" fill="${c}" stroke="#111" stroke-width="5"/><path d="M28 70 Q100 115 172 70 M60 28 Q95 100 60 172" fill="none" stroke="#111" stroke-width="4"/>` },
    { label: 'la remera', svg: c => `<path d="M62 30 L28 50 L8 92 L44 108 L52 92 L52 182 L148 182 L148 92 L156 108 L192 92 L172 50 L138 30 Q100 62 62 30 Z" fill="${c}" stroke="#111" stroke-width="5" stroke-linejoin="round"/>` },
    { label: 'el globo', svg: c => `<path d="M100 168 Q88 184 100 198" fill="none" stroke="#bbb" stroke-width="3"/><polygon points="91,160 109,160 100,170" fill="${c}" stroke="#111" stroke-width="3"/><ellipse cx="100" cy="86" rx="62" ry="76" fill="${c}" stroke="#111" stroke-width="5"/><ellipse cx="76" cy="54" rx="10" ry="18" fill="#fff" opacity=".35" transform="rotate(25 76 54)"/>` },
    { label: 'el auto', svg: c => `<path d="M14 138 L14 110 Q16 98 30 95 L58 92 L80 62 Q85 56 96 56 L140 56 Q151 56 157 64 L178 92 Q192 96 192 112 L192 138 Z" fill="${c}" stroke="#111" stroke-width="5" stroke-linejoin="round"/><path d="M89 66 L72 92 L117 92 L117 66 Z M126 66 L126 92 L167 92 L148 66 Z" fill="#cfd3d8" stroke="#111" stroke-width="3"/><circle cx="55" cy="140" r="19" fill="#222"/><circle cx="55" cy="140" r="7" fill="#888"/><circle cx="152" cy="140" r="19" fill="#222"/><circle cx="152" cy="140" r="7" fill="#888"/>` },
    { label: 'la gorra', svg: c => `<path d="M24 130 L188 130 Q196 150 168 150 L24 142 Z" fill="${c}" stroke="#111" stroke-width="5" stroke-linejoin="round"/><path d="M34 132 Q34 52 104 50 Q170 52 170 132 Z" fill="${c}" stroke="#111" stroke-width="5"/><circle cx="104" cy="48" r="9" fill="${c}" stroke="#111" stroke-width="4"/>` },
  ];

  // ---------- Sonidos (iguales para acierto y error: no delatan nada) ----------
  const Sfx = (() => {
    let ctx = null;
    const on = () => db.sound !== false;
    function audio() {
      if (!ctx) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ctx = new A(); }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    function tone(f, t, d, type = 'triangle', v = 0.12) {
      const a = audio(); if (!a) return;
      const o = a.createOscillator(), g = a.createGain(), t0 = a.currentTime + t;
      o.type = type; o.frequency.setValueAtTime(f, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(v, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + d + 0.05);
    }
    return {
      tap() { if (on()) { tone(660, 0, 0.12); tone(990, 0.07, 0.15); } },
      level() { if (on()) [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.25)); },
      win() { if (on()) [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.11, 0.3, 'square', 0.05)); },
    };
  })();

  function speak(text) {
    try {
      if (!window.speechSynthesis) return;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const voice = speechSynthesis.getVoices().find(v => /^es(-|_)(AR|419|MX|US)/i.test(v.lang)) || speechSynthesis.getVoices().find(v => /^es/i.test(v.lang));
      if (voice) u.voice = voice;
      u.lang = voice ? voice.lang : 'es-AR';
      u.rate = 0.95;
      speechSynthesis.speak(u);
    } catch (e) {}
  }

  // ---------- Recompensas en pantalla ----------
  const CHEERS = ['⭐', '🌟', '✨', '💫', '⚡'];
  const PHRASES = ['¡Vas muy bien, {n}!', '¡Seguí así!', '¡Sos un crack, {n}!', '¡Qué concentración!', '¡Tu poder está subiendo!', '¡Dale que podés!'];
  let answersSincePhrase = 0;
  function cheer() {
    Sfx.tap();
    const el = document.createElement('div');
    el.className = 'cheer';
    el.textContent = CHEERS[Math.floor(Math.random() * CHEERS.length)];
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 600);
  }
  // Cada 6 respuestas, una frase de ánimo en el globito de la mascota (no tapa la lámina).
  function encouragement() {
    if (++answersSincePhrase < 6) return '';
    answersSincePhrase = 0;
    return `<span class="encourage">${PHRASES[Math.floor(Math.random() * PHRASES.length)].replace('{n}', esc(curName()))}</span><br>`;
  }
  function confetti() {
    const box = document.createElement('div');
    box.className = 'confetti';
    const cols = ['#ffc83d', '#ff5e3a', '#2f6feb', '#43a047', '#e91e63', '#7b3fe4', '#fff'];
    for (let i = 0; i < 70; i++) {
      const s = document.createElement('span');
      s.style.left = Math.random() * 100 + 'vw';
      s.style.background = cols[i % cols.length];
      s.style.animationDuration = 2.2 + Math.random() * 2 + 's';
      s.style.animationDelay = Math.random() * 0.8 + 's';
      box.appendChild(s);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 5000);
  }

  // Barra de avance: una estrella que camina hasta la meta. No dice si acertó o no.
  // Arriba solo el avance: el nivel y las estrellas, y la barra de 0 a la meta.
  const gameTop = (label, frac, stars) => {
    const pct = Math.round(Math.min(1, Math.max(0, frac)) * 100);
    return `<div class="gtop"><span class="plabel">${label}</span><span class="stars">⭐ ${stars}</span></div>
      <div class="progress"><span class="pzero">0</span>
        <div class="ptrack"><div class="pfill" style="width:${pct}%"></div><span class="prunner" style="left:${pct}%">⭐</span></div>
        <span class="pgoal">🏁</span></div>`;
  };
  // Abajo de todo y separado de las respuestas, para no tocarlo sin querer.
  const BACK_BTN = '<button class="back-btn" id="quit">← Volver</button>';
  const guide = html => `<div class="guide">${petSvg()}<div class="bubble">${html}</div></div>`;

  // ---------- Inicio ----------
  function newPlayer(first) {
    setTheme('menu');
    $app.innerHTML = `
      <div class="hero">${petSvg(DEFAULT_PET)}<div class="bubble"><span class="fun">${first ? '¡Hola! Soy tu compañero ⚡' : 'Nuevo jugador'}</span>${first ? 'Vamos a cazar colores juntos.' : ''}</div></div>
      <h1>${first ? '¿Cómo te llamás?' : 'Nombre del jugador'}</h1>
      <input type="text" id="name" maxlength="30" autocomplete="off" placeholder="${first ? 'Tu nombre' : 'Por ejemplo: Mamá'}">
      <p style="font-size:.9rem;opacity:.9">El nombre y los resultados quedan guardados solo en este aparato.</p>
      <button class="big primary" id="ok" style="background:#1b1b3a;border-color:#ffc83d">¡Listo!</button>
      ${first ? `<button class="link" id="restore">¿Ya jugaba en otro aparato? Cargar una copia</button>
        <input type="file" id="restoreFile" accept=".json,application/json,text/plain" hidden>
        <p id="restoreMsg" style="font-weight:700"></p>` : '<button class="link" id="back">Volver</button>'}
    `;
    if (first) {
      const f = $app.querySelector('#restoreFile');
      $app.querySelector('#restore').onclick = () => f.click();
      f.onchange = async () => {
        try { mergeBackup(JSON.parse(await f.files[0].text())); home(); }
        catch (e) { $app.querySelector('#restoreMsg').textContent = 'No se pudo leer ese archivo. Tiene que ser la copia que se descarga desde la app (termina en .json).'; }
      };
    }
    const input = $app.querySelector('#name');
    input.focus();
    const ok = () => {
      const name = input.value.trim();
      if (!name) return input.focus();
      const p = { id: uid(), name };
      db.players.push(p); db.currentPlayer = p.id; save();
      first ? petEditor(true) : parents();
    };
    $app.querySelector('#ok').onclick = ok;
    input.onkeydown = e => { if (e.key === 'Enter') ok(); };
    if (!first) $app.querySelector('#back').onclick = parents;
  }

  const MISSIONS = [
    { m: 1, icon: '🔍', bg: 'linear-gradient(145deg,#ffb020,#ff6a00)', title: 'Cazá la figura escondida', sub: 'Encontrá estrellas, anillos, rayos y hongos' },
    { m: 2, icon: '🧠', bg: 'linear-gradient(145deg,#4dabf7,#2d4fd8)', title: 'Memoria de colores', sub: 'Mirá un color… ¡y encontralo!' },
    { m: 3, icon: '🖍️', bg: 'linear-gradient(145deg,#b197fc,#7b3fe4)', title: '¿De qué color es?', sub: 'Decí el color de cada cosa' },
    { m: 4, icon: '❓', bg: 'linear-gradient(145deg,#ffd54f,#f59e0b)', title: 'Cajas sorpresa', sub: 'Una caja tiene crayones cambiados: ¡encontrala!' },
  ];
  const BUBBLES = ['¿Listo para cazar colores?', '¡Hoy vamos por más esferas!', '¿Qué misión jugamos?', '¡Tu poder no para de crecer!', 'Soy {pet}, ¡vamos a cazar colores!'];

  // ---------- Armá a tu compañero ----------
  function petEditor(first) {
    setTheme('menu');
    const draft = curPet();
    const section = (key, title) => `
      <h2>${title}</h2>
      <div class="swatches">${PET_COLORS[key].map(([n, hex]) => `
        <button class="sw-btn ${draft[key] === hex ? 'sel' : ''}" data-k="${key}" data-c="${hex}"><span class="sw-dot" style="background:${hex}"></span>${n}</button>`).join('')}
      </div>`;
    const shapeSection = key => `
      <h2>${SHAPE_TITLES[key]}</h2>
      <div class="shape-grid" data-grid="${key}"></div>`;
    $app.innerHTML = `
      <h1>${first ? `¡Ahora armá a tu compañero, ${esc(curName())}!` : '¡Armá a tu compañero!'}</h1>
      <div class="pet-preview">${petSvg(draft)}<span class="pet-name">${esc(draft.name)}</span></div>
      ${shapeSection('body')}
      ${shapeSection('hairStyle')}
      ${shapeSection('extra')}
      ${section('skin', '🎨 Piel')}
      ${section('hair', '💇 Pelo')}
      ${section('bolt', '⚡ Rayo')}
      <h2>📛 ¿Cómo se llama?</h2>
      <input type="text" id="petName" maxlength="14" autocomplete="off" value="${esc(draft.name)}">
      <div class="row">${PET_NAMES.map(n => `<button class="chip pet-sug" data-n="${n}">${n}</button>`).join('')}</div>
      <button class="big primary" id="ok" style="background:#1b1b3a;border-color:#ffc83d;margin-top:16px">¡Listo!</button>
      ${first ? '' : '<button class="link" id="back">Volver</button>'}
    `;
    const preview = $app.querySelector('.pet-preview'), nameInput = $app.querySelector('#petName');
    // Las miniaturas muestran cada forma con los colores elegidos, así que se redibujan en cada cambio.
    const renderShapes = () => $app.querySelectorAll('[data-grid]').forEach(g => {
      const key = g.dataset.grid;
      g.innerHTML = Object.keys(PET_SHAPES[key]).map(v => `
        <button class="shape-btn ${draft[key] === v ? 'sel' : ''}" data-k="${key}" data-v="${v}">${petSvg({ ...draft, [key]: v })}<span>${v}</span></button>`).join('');
      g.querySelectorAll('.shape-btn').forEach(b => b.onclick = () => { draft[key] = b.dataset.v; Sfx.tap(); refresh(); });
    });
    const refresh = () => { preview.innerHTML = `${petSvg(draft)}<span class="pet-name">${esc(draft.name || '¿?')}</span>`; renderShapes(); };
    renderShapes();
    $app.querySelectorAll('.sw-btn').forEach(b => b.onclick = () => {
      draft[b.dataset.k] = b.dataset.c;
      $app.querySelectorAll(`.sw-btn[data-k="${b.dataset.k}"]`).forEach(x => x.classList.toggle('sel', x === b));
      Sfx.tap(); refresh();
    });
    nameInput.oninput = () => { draft.name = nameInput.value.trim(); refresh(); };
    $app.querySelectorAll('.pet-sug').forEach(b => b.onclick = () => { nameInput.value = draft.name = b.dataset.n; refresh(); });
    $app.querySelector('#ok').onclick = () => {
      if (!draft.name) { draft.name = DEFAULT_PET.name; }
      player(db.currentPlayer).pet = { ...draft };
      save(); Sfx.level();
      home();
    };
    if (!first) $app.querySelector('#back').onclick = home;
  }

  function home() {
    if (!db.players.length) return newPlayer(true);
    const cur = player(db.currentPlayer) || db.players[0];
    db.currentPlayer = cur.id;
    setTheme('menu');
    const status = m => {
      const p = getProgress(m);
      if (p) return `<span class="badge go">${m === 1 ? `Seguir en el Nivel ${p.part}` : 'Seguir'} ▶</span>`;
      const n = sessionsOf(cur.id, m).length;
      return n ? `<span class="badge">✓ Completada ${n === 1 ? '1 vez' : n + ' veces'}</span>` : '<span class="badge new">¡Nueva!</span>';
    };
    const pet = curPet();
    $app.innerHTML = `
      <div class="menu-top">
        <button class="pill-btn" id="sound">${db.sound === false ? '🔇' : '🔊'}</button>
        <button class="pill-btn" id="parents">👨‍👩‍👦 Papás</button>
      </div>
      <div class="hero"><button class="pet-btn" id="pet" aria-label="Cambiar compañero">${petSvg(pet)}<span class="pet-name">${esc(pet.name)} ✏️</span></button><div class="bubble"><span class="fun">¡Hola, ${esc(cur.name)}!</span>${BUBBLES[Math.floor(Math.random() * BUBBLES.length)].replace('{pet}', esc(pet.name))}</div></div>
      <div class="power"><span>PODER</span><b>⚡ ${fmtNum(powerOf(cur.id))}</b></div>
      ${orbsRow(cur.id)}
      ${MISSIONS.map(x => `
        <button class="mcard" data-m="${x.m}">
          <span class="micon" style="background:${x.bg}">${x.icon}</span>
          <span><span class="msub">Misión ${x.m}</span><span class="mtitle">${x.title}</span><span class="msub">${x.sub}</span>${status(x.m)}</span>
        </button>`).join('')}
      <div class="who">Juega: <b>${esc(cur.name)}</b></div>
    `;
    $app.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { Sfx.tap(); startMission(+b.dataset.m); });
    $app.querySelector('#parents').onclick = parents;
    $app.querySelector('#pet').onclick = () => petEditor(false);
    $app.querySelector('#sound').onclick = () => { db.sound = db.sound === false; save(); home(); };
  }

  // La guía para el adulto se muestra una vez cada vez que se abre la app.
  let checklistShown = false;
  function startMission(m) {
    const run = { 1: mission1, 2: mission2, 3: mission3, 4: mission4 }[m];
    if (checklistShown) return run();
    checklistShown = true;
    setTheme('parents');
    $app.innerHTML = `
      <h1>Antes de jugar (para el adulto)</h1>
      <div class="card">
        <p>Para que los resultados se puedan comparar entre partidas:</p>
        <ul>
          <li>Usen <b>siempre el mismo aparato</b>.</li>
          <li><b>Brillo de pantalla alto</b>.</li>
          <li>En iPhone o Mac: <b>Night Shift apagado</b> y, en el iPhone, <b>True Tone apagado</b> (Ajustes &gt; Pantalla y brillo).</li>
          <li>Una habitación con luz normal, sin sol directo sobre la pantalla.</li>
          <li>Sin anteojos de colores ni filtros de color.</li>
          <li>Que juegue <b>sin ayuda</b>. Si no ve nada, que toque "No veo nada": también suma estrellas.</li>
          <li>Si se cansa, puede tocar <b>✕</b>: la próxima vez sigue desde donde quedó.</li>
        </ul>
      </div>
      <button class="big primary" id="go">¡Listo, a jugar!</button>
      <button class="link" id="back">Volver</button>
    `;
    $app.querySelector('#go').onclick = run;
    $app.querySelector('#back').onclick = home;
  }

  // ---------- Misión 1: figuras escondidas ----------
  function drawPlate(canvas, trial) {
    const size = canvas.getBoundingClientRect().width;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.height = Math.round(size * dpr);
    const ctx = canvas.getContext('2d');
    const S = canvas.width;
    ctx.fillStyle = '#3a3a3f';
    ctx.fillRect(0, 0, S, S);
    for (const d of Core.buildPlate(trial)) {
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.arc(d.x * S, d.y * S, d.r * S, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Avance de 0 a 1: cuánto le falta a cada sensor para terminar.
  const m1Progress = stairs =>
    Core.AXES.reduce((a, ax) => a + (stairs[ax].done ? 1 : (stairs[ax].level - 1) / Core.LEVELS), 0) / Core.AXES.length;
  const EASY_EVERY = 5;     // cada tantas láminas, una fácil para descansar
  const PART_SPLIT = 0.5;   // a mitad de camino termina el Nivel 1

  function mission1() {
    setTheme('game');
    // st se guarda después de cada respuesta, así se puede seguir más tarde
    let st = getProgress(1);
    if (st) st.easyNext = true; // al volver, arranca con una fácil
    else st = { stairs: Core.newStairs(), log: [], stars: 0, sinceEasy: 0, lastShape: null, part: 1, part2From: PART_SPLIT, tutorial: 2, easyNext: false };
    const persist = () => setProgress(1, st);

    function nextTrial() {
      const shape = shuffle(Core.SHAPE_NAMES.filter(s => s !== st.lastShape))[0];
      st.lastShape = shape;
      const seed = Math.floor(Math.random() * 2 ** 31);
      if (st.tutorial > 0) return { kind: 'control', shape, seed, tutorial: true };
      const open = Core.AXES.filter(a => !st.stairs[a].done);
      if (!open.length) return null;
      // Láminas fáciles (las ve cualquiera): después de un error y cada EASY_EVERY láminas.
      if (st.easyNext || ++st.sinceEasy >= EASY_EVERY) { st.easyNext = false; st.sinceEasy = 0; return { kind: 'control', shape, seed }; }
      const axis = open[Math.floor(Math.random() * open.length)];
      return { kind: 'axis', axis, level: st.stairs[axis].level, shape, seed };
    }

    function partFrac() {
      const p = m1Progress(st.stairs);
      return st.part === 1 ? p / PART_SPLIT : (p - st.part2From) / (1 - st.part2From);
    }

    function show(trial) {
      if (!trial) return finish();
      $app.innerHTML = `
        ${gameTop('Nivel ' + st.part, trial.tutorial ? 0 : partFrac(), st.stars)}
        ${guide(trial.tutorial ? `${esc(curName())}, entre los puntitos se esconde una figura. ¿Cuál es?` : encouragement() + '¿Qué figura está escondida?')}
        <div class="plate-wrap"><canvas class="plate"></canvas></div>
        <div class="answers">
          ${Core.SHAPE_NAMES.map(s => `<button data-a="${s}">${ICONS[s]}<span>${SHAPE_LABEL[s]}</span></button>`).join('')}
          <button class="none" data-a="nada">🙈 No veo nada</button>
        </div>
        ${BACK_BTN}
      `;
      drawPlate($app.querySelector('canvas'), trial);
      $app.querySelector('#quit').onclick = home;
      $app.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
        $app.querySelectorAll('[data-a]').forEach(x => x.onclick = null); // evita doble toque
        const correct = b.dataset.a === trial.shape;
        st.stars++; cheer();
        if (trial.tutorial) st.tutorial--;
        else {
          st.log.push({ kind: trial.kind, axis: trial.axis || null, level: trial.level || null, shape: trial.shape, answer: b.dataset.a, correct });
          if (trial.kind === 'axis') {
            Core.stairUpdate(st.stairs[trial.axis], correct);
            if (!correct) st.easyNext = true;
          }
        }
        const p = m1Progress(st.stairs);
        if (st.part === 1 && p >= PART_SPLIT && p < 1) {
          st.part = 2; st.part2From = p; st.easyNext = true;
          persist();
          return setTimeout(intermission, 450);
        }
        persist();
        setTimeout(() => show(nextTrial()), 350);
      });
    }

    function intermission() {
      setTheme('menu');
      const n = orbsOf(db.currentPlayer);
      $app.innerHTML = `
        <div class="celebrate">
          <h1>¡Completaste el Nivel 1!</h1>
          ${n <= ORB_GOAL ? `<div class="new-orb">${orb(n, true)}<b>¡Ganaste una esfera de poder!</b></div>` : ''}
          <p class="lead">Ya juntaste ${st.stars} estrellas ⭐</p>
          ${guide(`<span class="fun">Ahora viene el Nivel 2…</span>¡Solo un verdadero campeón completa la misión! ¡Intentalo, ${esc(curName())}! 💪`)}
          <button class="big primary" id="go" style="background:#1b1b3a;border-color:#ffc83d">¡Vamos al Nivel 2!</button>
          <button class="link" id="later">Seguir más tarde</button>
        </div>
      `;
      Sfx.level(); confetti();
      $app.querySelector('#go').onclick = () => { setTheme('game'); show(nextTrial()); };
      $app.querySelector('#later').onclick = home;
    }

    function finish() {
      const scores = {};
      for (const a of Core.AXES) scores[a] = st.stairs[a].score;
      const ctrl = st.log.filter(t => t.kind === 'control');
      const before = orbsOf(db.currentPlayer);
      db.sessions.push({
        id: uid(), playerId: db.currentPlayer, mission: 1, date: new Date().toISOString(), device: deviceLabel(), stars: st.stars,
        scores, controls: { ok: ctrl.filter(t => t.correct).length, total: ctrl.length }, trials: st.log,
      });
      setProgress(1, null);
      celebrate(st.stars, before);
    }

    show(nextTrial());
  }

  // ---------- Misión 2: memoria de colores ----------
  function mission2() {
    setTheme('game');
    const ROUNDS = 14;
    let st = getProgress(2);
    if (!st) {
      const candidates = Core.PALETTE.map((_, i) => i).filter(Core.isGoodTarget);
      st = { targets: shuffle(candidates).slice(0, ROUNDS), answers: [], stars: 0, k: 0 };
    }

    function show() {
      if (st.k >= st.targets.length) return finish();
      const ti = st.targets[st.k];
      const opts = shuffle([ti, ...Core.confusersFor(ti)]);
      $app.innerHTML = `
        ${gameTop('Memoria', st.k / st.targets.length, st.stars)}
        ${guide(`${encouragement()}<span id="say">¡Mirá bien este color… después se esconde!</span>`)}
        <div class="target" style="background:${Core.PALETTE[ti].hex}"></div>
        <div class="opts" style="visibility:hidden">
          ${opts.map(i => `<button data-i="${i}" style="background:${Core.PALETTE[i].hex}" aria-label="opción"></button>`).join('')}
        </div>
        ${BACK_BTN}
      `;
      $app.querySelector('#quit').onclick = home;
      setTimeout(() => {
        const t = $app.querySelector('.target');
        if (!t) return;
        t.classList.add('hidden'); t.textContent = '?';
        $app.querySelector('#say').textContent = '¿Cuál era el color?';
        const o = $app.querySelector('.opts');
        o.style.visibility = 'visible';
        o.querySelectorAll('[data-i]').forEach(b => b.onclick = () => {
          o.querySelectorAll('[data-i]').forEach(x => x.onclick = null);
          const ci = +b.dataset.i;
          st.answers.push({ target: ti, chosen: ci, correct: ci === ti });
          st.stars++; st.k++; cheer();
          setProgress(2, st);
          setTimeout(show, 350);
        });
      }, 2200);
    }

    function finish() {
      const before = orbsOf(db.currentPlayer);
      db.sessions.push({ id: uid(), playerId: db.currentPlayer, mission: 2, date: new Date().toISOString(), device: deviceLabel(), stars: st.stars, answers: st.answers });
      setProgress(2, null);
      celebrate(st.stars, before);
    }

    show();
  }

  // ---------- Misión 3: ¿de qué color es? ----------
  function mission3() {
    setTheme('game');
    const ROUNDS = 12;
    let st = getProgress(3);
    if (!st) {
      const idx = shuffle(Core.NAMING_SWATCHES.map((_, i) => i)).slice(0, ROUNDS);
      st = { items: idx.map(si => ({ si, obj: Math.floor(Math.random() * OBJECTS.length) })), answers: [], stars: 0, k: 0 };
    }

    function show() {
      if (st.k >= st.items.length) return finish();
      const { si, obj } = st.items[st.k];
      const sw = Core.NAMING_SWATCHES[si], o = OBJECTS[obj];
      const opts = shuffle(Core.namingOptions(si));
      const question = `¿De qué color es ${o.label}?`;
      $app.innerHTML = `
        ${gameTop('Colores', st.k / st.items.length, st.stars)}
        ${guide(encouragement() + question)}
        <div class="object"><svg viewBox="0 0 200 200">${o.svg(sw.hex)}</svg></div>
        <div class="names">${opts.map(c => `<button data-c="${c}">${Core.NAMING[c].name}</button>`).join('')}</div>
        <button class="speak" id="speak">🔊 Escuchar</button>
        ${BACK_BTN}
      `;
      $app.querySelector('#quit').onclick = home;
      $app.querySelector('#speak').onclick = () => speak(question + ' ' + opts.map(c => Core.NAMING[c].name).join(', ') + '.');
      $app.querySelectorAll('[data-c]').forEach(b => b.onclick = () => {
        $app.querySelectorAll('[data-c]').forEach(x => x.onclick = null);
        const chosen = +b.dataset.c;
        st.answers.push({ si, cat: sw.cat, chosen, correct: chosen === sw.cat, object: obj });
        st.stars++; st.k++; cheer();
        setProgress(3, st);
        setTimeout(show, 350);
      });
    }

    function finish() {
      const before = orbsOf(db.currentPlayer);
      db.sessions.push({ id: uid(), playerId: db.currentPlayer, mission: 3, date: new Date().toISOString(), device: deviceLabel(), stars: st.stars, answers: st.answers });
      setProgress(3, null);
      celebrate(st.stars, before);
    }

    show();
  }

  // ---------- Misión 4: cajas sorpresa ----------
  // Tres cajas con los mismos crayones; en una, los colores pasaron por el simulador de un tipo de daltonismo.
  // Para quien tiene ese tipo, esa caja es idéntica a las otras. Cuanto más sutil el cambio que nota, mejor.
  const QBLOCK = `<svg viewBox="0 0 100 100" aria-hidden="true">
    <rect x="4" y="4" width="92" height="92" rx="12" fill="#f7b52c" stroke="#9a5200" stroke-width="6"/>
    <circle cx="17" cy="17" r="4.5" fill="#9a5200"/><circle cx="83" cy="17" r="4.5" fill="#9a5200"/>
    <circle cx="17" cy="83" r="4.5" fill="#9a5200"/><circle cx="83" cy="83" r="4.5" fill="#9a5200"/>
    <text x="53" y="76" text-anchor="middle" font-family="'Baloo 2', sans-serif" font-weight="800" font-size="70" fill="#9a5200">?</text>
    <text x="50" y="73" text-anchor="middle" font-family="'Baloo 2', sans-serif" font-weight="800" font-size="70" fill="#fff">?</text>
  </svg>`;
  const crayon = css => `<svg viewBox="0 0 30 72" aria-hidden="true"><polygon points="15,1 28,20 2,20" fill="${css}"/><rect x="2" y="20" width="26" height="51" rx="2" fill="${css}"/><rect x="2" y="31" width="26" height="5" fill="rgba(0,0,0,.2)"/><rect x="2" y="58" width="26" height="5" fill="rgba(0,0,0,.2)"/></svg>`;
  const m4Progress = stairs => Core.KINDS.reduce((a, k) => a + (stairs[k].done ? 1 : (stairs[k].level - 1) / Core.M4_LEVELS), 0) / Core.KINDS.length;

  function mission4() {
    setTheme('game');
    let st = getProgress(4);
    if (st) st.easyNext = true; // al volver, arranca con una fácil
    else st = { stairs: Core.newStairs(Core.KINDS), log: [], stars: 0, sinceEasy: 0, tutorial: 2, easyNext: false };
    const persist = () => setProgress(4, st);

    function nextTrial() {
      const seed = Math.floor(Math.random() * 2 ** 31), odd = Math.floor(Math.random() * 3);
      if (st.tutorial > 0) return { kind: 'control', odd, seed, tutorial: true };
      const open = Core.KINDS.filter(k => !st.stairs[k].done);
      if (!open.length) return null;
      if (st.easyNext || ++st.sinceEasy >= EASY_EVERY) { st.easyNext = false; st.sinceEasy = 0; return { kind: 'control', odd, seed }; }
      const sim = open[Math.floor(Math.random() * open.length)];
      return { kind: 'axis', sim, level: st.stairs[sim].level, odd, seed };
    }

    function show(trial) {
      if (!trial) return finish();
      const rand = Core.rng(trial.seed);
      const poolKind = trial.sim || Core.KINDS[Math.floor(rand() * 3)];
      const cols = Core.m4Crayons(poolKind, rand);
      const changed = trial.kind === 'control'
        ? cols.map(c => c.map(v => v * 0.55))
        : cols.map(c => Core.applySim(c, trial.sim, Core.m4Intensity(trial.level)).map(Core.clamp01));
      const box = i => (i === trial.odd ? changed : cols).map(c => crayon(Core.linToCss(c))).join('');
      $app.innerHTML = `
        ${gameTop('Cajas', trial.tutorial ? 0 : m4Progress(st.stairs), st.stars)}
        ${guide(trial.tutorial ? `${esc(curName())}, una de estas cajas tiene crayones un poquito distintos. ¿Cuál es?` : encouragement() + '¿Qué caja es distinta?')}
        <div class="qboxes">${[0, 1, 2].map(i => `<button class="qcol" data-b="${i}"><span class="qcrayons">${box(i)}</span><span class="qblock">${QBLOCK}</span></button>`).join('')}</div>
        <button class="qnone" data-b="nada">🙈 Son todas iguales</button>
        ${BACK_BTN}
      `;
      $app.querySelector('#quit').onclick = home;
      $app.querySelectorAll('[data-b]').forEach(b => b.onclick = () => {
        $app.querySelectorAll('[data-b]').forEach(x => x.onclick = null); // evita doble toque
        const correct = b.dataset.b === String(trial.odd);
        st.stars++; cheer();
        if (trial.tutorial) st.tutorial--;
        else {
          st.log.push({ kind: trial.kind, sim: trial.sim || null, level: trial.level || null, answer: b.dataset.b, correct });
          if (trial.kind === 'axis') {
            Core.stairUpdate(st.stairs[trial.sim], correct, Core.M4_LEVELS);
            if (!correct) st.easyNext = true;
          }
        }
        persist();
        setTimeout(() => show(nextTrial()), 350);
      });
    }

    function finish() {
      const scores = {};
      for (const k of Core.KINDS) scores[k] = st.stairs[k].score;
      const ctrl = st.log.filter(t => t.kind === 'control');
      const before = orbsOf(db.currentPlayer);
      db.sessions.push({
        id: uid(), playerId: db.currentPlayer, mission: 4, date: new Date().toISOString(), device: deviceLabel(), stars: st.stars,
        scores, controls: { ok: ctrl.filter(t => t.correct).length, total: ctrl.length }, trials: st.log,
      });
      setProgress(4, null);
      celebrate(st.stars, before);
    }

    show(nextTrial());
  }

  function celebrate(stars, orbsBefore) {
    setTheme('menu');
    const id = db.currentPlayer, n = orbsOf(id);
    const gained = n > orbsBefore;
    $app.innerHTML = `
      <div class="celebrate">
        <div class="big-emoji">🏆</div>
        <h1>¡Misión cumplida, ${esc(curName())}!</h1>
        <p class="lead">Juntaste ${stars} estrellas ⭐</p>
        ${gained ? `<div class="new-orb">${orb(n, true)}<b>${n >= ORB_GOAL ? '¡Juntaste las 7 esferas de poder! 🐉 ¡Pedí un deseo!' : '¡Ganaste una esfera de poder!'}</b></div>` : ''}
        <div><div class="power"><span>PODER</span><b>⚡ ${fmtNum(powerOf(id))}</b></div></div>
        ${guide('¡Sos un verdadero campeón! 🏅')}
        <button class="big primary" id="home" style="background:#1b1b3a;border-color:#ffc83d">Volver al inicio</button>
      </div>
    `;
    Sfx.win(); confetti();
    $app.querySelector('#home').onclick = home;
  }

  // ---------- Zona de papás ----------
  function parents() {
    setTheme('parents');
    const cur = player(db.currentPlayer);
    $app.innerHTML = `
      <div class="topbar"><button class="link" id="back">← Volver al juego</button></div>
      <h1>👨‍👩‍👦 Zona de papás</h1>
      <div class="card">
        <p class="muted" style="margin-top:0">¿Quién juega?</p>
        <div class="row">
          ${db.players.map(p => `<button class="chip ${p.id === db.currentPlayer ? 'sel' : ''}" data-p="${p.id}">${esc(p.name)}</button>`).join('')}
          <button class="chip" id="add">+ Agregar</button>
        </div>
        <p class="muted" style="font-size:.9rem">Tip: que también juegue un adulto con visión típica, en este mismo aparato. Así el informe tiene con qué comparar.</p>
      </div>
      <button class="big primary" id="rep">📋 Informe e historial de ${esc(cur.name)}</button>
      <button class="big" id="sim">👓 Así ve ${esc(cur.name)} (simulador)</button>
      <button class="big" id="dev">📲 Cambiar de aparato / copia de seguridad</button>
    `;
    $app.querySelector('#back').onclick = home;
    $app.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { db.currentPlayer = b.dataset.p; save(); parents(); });
    $app.querySelector('#add').onclick = () => newPlayer(false);
    $app.querySelector('#rep').onclick = () => report(db.currentPlayer);
    $app.querySelector('#sim').onclick = () => simulator(db.currentPlayer);
    $app.querySelector('#dev').onclick = devices;
  }

  // ---------- Copia de seguridad y cambio de aparato ----------
  // Une una copia con lo que hay en este aparato, sin duplicar. Trae también las misiones a medias.
  function mergeBackup(data) {
    if (!data || !Array.isArray(data.players) || !Array.isArray(data.sessions)) throw new Error('formato');
    const hasActivity = id => sessionsOf(id).length || Object.keys(db.progress || {}).some(k => k.startsWith(id + ':'));
    for (const pl of data.players) {
      if (player(pl.id)) continue;
      // Si acá ya crearon un jugador con el mismo nombre que todavía no jugó, lo reemplaza el de la copia.
      const twin = db.players.find(p => p.name.trim().toLowerCase() === pl.name.trim().toLowerCase() && !hasActivity(p.id));
      if (twin) {
        db.players = db.players.filter(p => p !== twin);
        if (db.currentPlayer === twin.id) db.currentPlayer = pl.id;
      }
      db.players.push({ ...pl });
    }
    const have = new Set(db.sessions.map(s => s.id));
    let added = 0;
    for (const s of data.sessions) if (!have.has(s.id)) { db.sessions.push(s); added++; }
    // Misiones a medias: se traen si acá no hay una en curso para ese jugador y misión.
    db.progress = db.progress || {};
    let resumed = 0;
    for (const [k, v] of Object.entries(data.progress || {})) if (!(k in db.progress)) { db.progress[k] = v; resumed++; }
    if (!player(db.currentPlayer)) db.currentPlayer = player(data.currentPlayer) ? data.currentPlayer : (db.players[0] || {}).id || null;
    save();
    return { added, resumed, names: data.players.map(p => p.name) };
  }

  // En el celular abre el menú Compartir (WhatsApp, Mail, Archivos); en la compu descarga el archivo.
  async function exportBackup() {
    const name = 'cazador-de-colores-' + new Date().toISOString().slice(0, 10) + '.json';
    const file = new File([JSON.stringify(db, null, 2)], name, { type: 'application/json' });
    if (navigator.maxTouchPoints > 0 && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Copia de Cazador de colores' }); return; }
      catch (e) { if (e.name === 'AbortError') return; }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function devices() {
    setTheme('parents');
    const url = location.origin + location.pathname;
    $app.innerHTML = `
      <div class="topbar"><button class="link" id="back">← Volver</button></div>
      <h1>📲 Cambiar de aparato</h1>
      <p class="muted">Los jugadores, las partidas y las misiones a medias se guardan <b>solo en este aparato</b>. Para pasarlos a otro (un iPhone nuevo, la notebook) o para tener un respaldo, se hace una copia:</p>
      <div class="card">
        <h2 style="margin-top:0">1. En este aparato: hacer la copia</h2>
        <button class="primary" id="export">📤 Enviar o descargar copia</button>
        <ul>
          <li><b>En el iPhone</b> se abre el menú Compartir: elijan <b>WhatsApp</b> o <b>Mail</b> y mándensela a ustedes mismos, o elijan <b>Guardar en Archivos</b>.</li>
          <li><b>En la compu</b> se descarga un archivo que termina en <b>.json</b>.</li>
        </ul>
      </div>
      <div class="card">
        <h2 style="margin-top:0">2. En el otro aparato: cargar la copia</h2>
        <ul>
          <li>Abran este link. En el iPhone, agréguenlo a la pantalla de inicio y ábranlo <b>desde el ícono</b>.
            <span class="url">${esc(url)}</span>
            <button id="copyUrl">📋 Copiar link</button></li>
          <li>Si es la primera vez, en la bienvenida toquen <b>"¿Ya jugaba en otro aparato? Cargar una copia"</b>. Si ya lo venían usando, entren a esta misma pantalla y toquen <b>Cargar copia</b>.</li>
          <li><b>En el iPhone</b> el archivo tiene que estar en la app Archivos: si llegó por WhatsApp o Mail, ábranlo, toquen <b>Compartir → Guardar en Archivos</b> y después elíjanlo desde acá.</li>
        </ul>
        <button id="importBtn">📥 Cargar copia</button>
        <input type="file" id="import" accept=".json,application/json,text/plain" hidden>
        <p id="importMsg" style="font-weight:700"></p>
      </div>
      <div class="card">
        <h2 style="margin-top:0">3. ¡Listo!</h2>
        <p>Aparecen los jugadores y todas sus partidas en el informe, y si había una misión a medias, <b>sigue desde donde quedó</b>. Cargar la misma copia dos veces no duplica nada.</p>
        <p class="muted">Consejo: hagan una copia de vez en cuando, por si se rompe o se cambia el teléfono.</p>
      </div>
      <div class="card">
        <h2 style="margin-top:0">Empezar de cero</h2>
        <p class="muted">Borra todos los jugadores y resultados guardados en este aparato.</p>
        <button id="reset">Borrar todos los datos</button>
      </div>
    `;
    $app.querySelector('#back').onclick = parents;
    $app.querySelector('#export').onclick = exportBackup;
    $app.querySelector('#copyUrl').onclick = async e => {
      try { await navigator.clipboard.writeText(url); e.target.textContent = '✅ Link copiado'; }
      catch (err) { e.target.textContent = 'Mantené apretado el link para copiarlo'; }
    };
    const file = $app.querySelector('#import'), msg = $app.querySelector('#importMsg');
    $app.querySelector('#importBtn').onclick = () => file.click();
    file.onchange = async () => {
      try {
        const r = mergeBackup(JSON.parse(await file.files[0].text()));
        msg.textContent = `✅ Copia cargada (${r.names.join(', ')}): ${r.added} partida${r.added === 1 ? '' : 's'} nueva${r.added === 1 ? '' : 's'}` +
          (r.resumed ? ` y ${r.resumed} misión${r.resumed === 1 ? '' : 'es'} a medias para seguir.` : '.');
      } catch (e) { msg.textContent = '❌ No se pudo leer ese archivo. Tiene que ser la copia que se descarga desde la app (termina en .json).'; }
      file.value = '';
    };
    $app.querySelector('#reset').onclick = () => {
      if (!confirm('¿Borrar todos los jugadores y resultados de este aparato? No se puede deshacer.')) return;
      db = { players: [], sessions: [], currentPlayer: null };
      save();
      home();
    };
  }

  // ---------- Informe para la familia ----------
  const AXIS_INFO = {
    L: { title: 'Sensor del rojo' },
    M: { title: 'Sensor del verde' },
    S: { title: 'Sensor del azul' },
  };
  const MISSION_NAME = { 1: 'Figuras escondidas', 2: 'Memoria de colores', 3: 'Nombrar colores', 4: 'Cajas sorpresa' };
  function scoreText(s) {
    if (s >= 8) return 'Ve bien incluso diferencias muy finas.';
    if (s >= 5) return 'Ve las diferencias medianas; le cuestan las más finas.';
    if (s >= 2) return 'Solo ve las diferencias grandes.';
    return 'En esta pantalla casi no distingue estas diferencias.';
  }
  const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
  const isRG = k => k === 'protan' || k === 'deutan';
  const kindNote = k => isRG(k) ? ' · típico del rojo‑verde' : k === 'tritan' ? ' · típico del azul‑amarillo' : '';

  function mission1Summary(id) {
    const ss = sessionsOf(id, 1);
    if (!ss.length) return null;
    const out = { n: ss.length, avg: {}, min: {}, max: {}, controlsOk: 0, controlsTotal: 0 };
    for (const a of Core.AXES) {
      const v = ss.map(s => s.scores[a]);
      out.avg[a] = avg(v); out.min[a] = Math.min(...v); out.max[a] = Math.max(...v);
    }
    for (const s of ss) { out.controlsOk += s.controls.ok; out.controlsTotal += s.controls.total; }
    return out;
  }

  function m4Summary(id) {
    const ss = sessionsOf(id, 4);
    if (!ss.length) return null;
    const out = { n: ss.length, avg: {}, min: {}, max: {}, controlsOk: 0, controlsTotal: 0 };
    for (const k of Core.KINDS) {
      const v = ss.map(s => s.scores[k]);
      out.avg[k] = avg(v); out.min[k] = Math.min(...v); out.max[k] = Math.max(...v);
    }
    for (const s of ss) { out.controlsOk += s.controls.ok; out.controlsTotal += s.controls.total; }
    return out;
  }
  const TYPE_SHORT = { protan: '"rojo" (protán)', deutan: '"verde" (deután)', tritan: 'azul‑amarillo (tritán)' };
  // Intensidad del primer nivel que ya no distinguió (lo que usa el simulador)
  const m4Severity = score => score >= Core.M4_LEVELS ? 0.05 : Core.m4Intensity(Math.floor(score) + 1);
  function m4Text(score) {
    if (score >= Core.M4_LEVELS) return 'notó incluso los cambios más sutiles';
    if (score < 1) return 'no notó la diferencia ni con el cambio completo (100%)';
    return `no notaba la diferencia desde un ${Math.round(m4Severity(score) * 100)}% de intensidad`;
  }

  function confusionPairs(id) {
    const pairs = new Map();
    let total = 0, wrong = 0;
    for (const s of sessionsOf(id, 2)) for (const a of s.answers) {
      total++;
      if (a.correct) continue;
      wrong++;
      const key = [a.target, a.chosen].sort((x, y) => x - y).join('-');
      const p = pairs.get(key) || { a: a.target, b: a.chosen, count: 0, kind: Core.classifyConfusion(a.target, a.chosen) };
      p.count++;
      pairs.set(key, p);
    }
    return { total, wrong, list: [...pairs.values()].sort((x, y) => y.count - x.count) };
  }

  function namingErrors(id) {
    const groups = new Map();
    let total = 0, wrong = 0;
    for (const s of sessionsOf(id, 3)) for (const a of s.answers) {
      total++;
      if (a.correct) continue;
      wrong++;
      const key = a.cat + '>' + a.chosen;
      const g = groups.get(key) || { cat: a.cat, chosen: a.chosen, count: 0, swatches: new Set(), kind: Core.classifyNaming(a.si, a.chosen) };
      g.count++; g.swatches.add(a.si);
      groups.set(key, g);
    }
    return { total, wrong, list: [...groups.values()].sort((x, y) => y.count - x.count) };
  }

  const KIND_LABEL = {
    protan: 'rojo‑verde, tipo "rojo" (protán)',
    deutan: 'rojo‑verde, tipo "verde" (deután, el más común)',
    tritan: 'azul‑amarillo (tritán, poco común)',
  };
  const sevFromScore = score => Math.min(1, Math.max(0.1, (9 - score) / 9));
  const sevWord = s => s < 0.4 ? 'leve' : s < 0.75 ? 'moderada' : 'fuerte';

  // Tipo probable combinando las tres misiones. Lo usan el informe y el simulador, así nunca se contradicen.
  // Manda la Misión 1 (mide cada sensor por separado); las Misiones 2 y 3 desempatan, o suplen si falta la 1.
  // Tipo de cada error de las Misiones 2 y 3: protán, deután, tritán u 'otro' (no típico de ningún daltonismo).
  const errorKinds = s => s.answers.filter(a => !a.correct)
    .map(a => s.mission === 2 ? Core.classifyConfusion(a.target, a.chosen) : Core.classifyNaming(a.si, a.chosen));
  // Las opciones incorrectas son a propósito confusiones típicas, así que alguien que responde al azar
  // parece daltónico. Lo que lo delata es la incoherencia: un daltónico se equivoca dentro de una sola
  // familia (rojo‑verde o azul‑amarillo); al azar se mezclan familias y aparecen errores "otro".
  function isRandomish(s) {
    const k = errorKinds(s);
    const rg = k.filter(isRG).length, tri = k.filter(x => x === 'tritan').length;
    const inconsistent = k.length - Math.max(rg, tri);
    return inconsistent >= 2 && inconsistent / k.length >= 0.25;
  }

  function likelyType(id) {
    const sum = mission1Summary(id);
    const votes = { protan: 0, deutan: 0, tritan: 0 };
    const extra = [...sessionsOf(id, 2), ...sessionsOf(id, 3)];
    const excluded = extra.filter(isRandomish);
    for (const s of extra) if (!excluded.includes(s)) for (const k of errorKinds(s)) if (k in votes) votes[k]++;
    const rgVotes = votes.protan + votes.deutan;
    const out = { family: null, kind: null, s: null, guessedSubtype: false, basis: [], clearM1: false, calibrated: false, excluded: excluded.length };
    const m4 = m4Summary(id);
    // Si no está la Misión 1, la 4 la reemplaza (llevada a la misma escala de 0 a 10).
    const toTen = v => v * 10 / Core.M4_LEVELS;
    const base = sum ? sum.avg : m4 && { L: toTen(m4.avg.protan), M: toTen(m4.avg.deutan), S: toTen(m4.avg.tritan) };
    if (base) {
      const { L, M, S } = base, rg = Math.min(L, M);
      const m1 = sum
        ? `figuras escondidas (sensor del rojo ${L.toFixed(1)}, del verde ${M.toFixed(1)} y del azul ${S.toFixed(1)}, de 10)`
        : `cajas sorpresa (tipo rojo ${m4.avg.protan.toFixed(1)}, verde ${m4.avg.deutan.toFixed(1)} y azul ${m4.avg.tritan.toFixed(1)}, de ${Core.M4_LEVELS})`;
      if (rg < 7 && S - rg >= 2) {
        out.family = 'rg'; out.s = sevFromScore(rg); out.basis.push(m1);
        if (M - L >= 2) out.kind = 'protan'; else if (L - M >= 2) out.kind = 'deutan';
      } else if (S < 7 && rg - S >= 2) {
        out.family = 'tritan'; out.kind = 'tritan'; out.s = sevFromScore(S); out.basis.push(m1);
      } else if (L >= 7 && M >= 7 && S >= 7) {
        out.clearM1 = true; // sin dificultades: no se adivina un tipo con las otras misiones
        return out;
      }
    }
    if (!out.family) {
      if (rgVotes >= 3 && rgVotes >= 2 * votes.tritan) out.family = 'rg';
      else if (votes.tritan >= 3 && votes.tritan >= 2 * rgVotes) { out.family = 'tritan'; out.kind = 'tritan'; }
    }
    const typical = out.family === 'tritan' ? votes.tritan : rgVotes;
    if (out.family && typical) out.basis.push(`${typical} confusiones típicas en memoria y nombrar colores`);
    if (out.family === 'rg' && !out.kind && m4 && sum) {
      if (m4.avg.deutan - m4.avg.protan >= 2) out.kind = 'protan';
      else if (m4.avg.protan - m4.avg.deutan >= 2) out.kind = 'deutan';
      if (out.kind) out.basis.push('cajas sorpresa');
    }
    if (out.family === 'rg' && !out.kind) {
      if (votes.protan >= 3 && votes.protan >= 2 * votes.deutan) out.kind = 'protan';
      else if (votes.deutan >= 3 && votes.deutan >= 2 * votes.protan) out.kind = 'deutan';
      else { out.kind = 'deutan'; out.guessedSubtype = true; }
    }
    // La intensidad del simulador la calibra la Misión 4: desde dónde dejó de notar el cambio.
    if (out.family && m4 && !out.guessedSubtype) { out.s = m4Severity(m4.avg[out.kind]); out.calibrated = true; }
    return out;
  }

  function interpret(sum, conf, nam, lt, m4) {
    const lines = [];
    let redGreen = lt.family === 'rg';
    if (m4) {
      const weakest = Core.KINDS.reduce((a, k) => m4.avg[k] < m4.avg[a] ? k : a);
      if (Core.KINDS.every(k => m4.avg[k] >= 6)) lines.push('En las cajas sorpresa <b>notó incluso cambios de color sutiles</b> de los tres tipos.');
      else lines.push(`En las cajas sorpresa le costó más notar los cambios del tipo <b>${TYPE_SHORT[weakest]}</b>: ${m4Text(m4.avg[weakest])}.`);
      if (m4.controlsTotal && m4.controlsOk / m4.controlsTotal < 0.75) lines.push('⚠️ En las cajas sorpresa falló algunas cajas "fáciles": puede que haya estado cansado o distraído.');
    }
    if (sum) {
      const { L, M, S } = sum.avg;
      const rg = Math.min(L, M);
      if (L >= 7 && M >= 7 && S >= 7) {
        lines.push('En la misión de las figuras escondidas <b>no aparecieron dificultades claras</b> con ningún tipo de color.');
      } else if (Math.max(L, M, S) < 5) {
        lines.push('Le costaron <b>todos</b> los tipos de color por igual. Puede ser cansancio, falta de atención o la pantalla. Conviene repetir otro día.');
      } else if (rg < 7 && S - rg >= 2) {
        lines.push('Le cuesta distinguir los colores que dependen de los sensores del <b>rojo y del verde</b>. Es la forma más común de daltonismo.');
      } else if (S < 7 && Math.min(L, M) - S >= 2) {
        lines.push('Le cuestan más las diferencias del <b>sensor del azul</b> (azul‑amarillo). Es un tipo poco común: <b>vale la pena comentarlo al oftalmólogo</b>.');
      } else {
        lines.push('Mostró algunas dificultades, pero sin un patrón claro. Conviene jugar más partidas para ver si se repite.');
      }
      if (sum.controlsTotal && sum.controlsOk / sum.controlsTotal < 0.75) {
        lines.push('⚠️ Falló algunas láminas "fáciles" que ve cualquier persona: puede que haya estado cansado o distraído. Tomar este resultado con cuidado.');
      }
    }
    if (conf.total) {
      const rgConf = conf.list.filter(p => isRG(p.kind)).reduce((a, p) => a + p.count, 0);
      if (!conf.wrong) lines.push('En la memoria de colores <b>no confundió ningún color</b>.');
      else {
        lines.push(`En la memoria de colores confundió <b>${conf.wrong} de ${conf.total}</b> colores.`);
        if (rgConf / conf.wrong >= 0.6) { redGreen = true; lines.push('La mayoría de esas confusiones son <b>típicas del daltonismo rojo‑verde</b>.'); }
      }
    }
    if (nam.total) {
      const rgNam = nam.list.filter(g => isRG(g.kind)).reduce((a, g) => a + g.count, 0);
      if (!nam.wrong) lines.push('Al <b>nombrar colores</b> acertó todos.');
      else {
        lines.push(`Al <b>nombrar colores</b> se equivocó en <b>${nam.wrong} de ${nam.total}</b>.`);
        if (rgNam / nam.wrong >= 0.6) { redGreen = true; lines.push('La mayoría de esos errores de nombre son <b>típicos del rojo‑verde</b> (por ejemplo, llamar "marrón" a un verde).'); }
      }
    }
    if (lt.excluded) {
      lines.push(`⚠️ En ${lt.excluded === 1 ? 'una partida' : lt.excluded + ' partidas'} de memoria o nombrar colores hubo varios errores que no son típicos de ningún daltonismo (parecen respuestas al azar o distracción). ${lt.excluded === 1 ? 'No se tuvo' : 'No se tuvieron'} en cuenta para el tipo probable.`);
    }
    if (lt.family) {
      const label = lt.guessedSubtype ? 'rojo‑verde (con estos juegos no se pudo distinguir si es del tipo "rojo" o del tipo "verde"; eso lo define el oftalmólogo)' : KIND_LABEL[lt.kind];
      lines.push(`<b>Tipo probable:</b> ${label}${lt.s != null ? `, intensidad <b>${sevWord(lt.s)}</b>` : ''}.`);
    }
    if (!lines.length) lines.push('Todavía no hay partidas. Jueguen al menos una vez cada misión para armar el informe.');
    return { html: lines.map(l => `<p>${l}</p>`).join(''), redGreen };
  }

  function bars(sum, ref, refName) {
    return Core.AXES.map(a => {
      const v = sum.avg[a];
      const range = sum.n > 1 ? ` · entre ${sum.min[a]} y ${sum.max[a]} en ${sum.n} partidas` : '';
      return `
        <div class="bar-row">
          <div class="bar-label"><span>${AXIS_INFO[a].title}</span><span>${v.toFixed(1)} / ${Core.LEVELS}</span></div>
          <div class="bar"><span style="width:${v / Core.LEVELS * 100}%"></span></div>
          <div class="bar-text">${scoreText(v)}${range}</div>
          ${ref ? `<div class="bar ref" style="height:10px"><span style="width:${ref.avg[a] / Core.LEVELS * 100}%"></span></div>
                   <div class="bar-text">${esc(refName)} (para comparar): ${ref.avg[a].toFixed(1)} / ${Core.LEVELS}</div>` : ''}
        </div>`;
    }).join('');
  }

  function report(id, refId) {
    setTheme('parents');
    const p = player(id);
    const others = db.players.filter(o => o.id !== id && sessionsOf(o.id, 1).length);
    if (refId === undefined && others.length) refId = others[0].id;
    const sum = mission1Summary(id);
    const ref = refId ? mission1Summary(refId) : null;
    const conf = confusionPairs(id);
    const nam = namingErrors(id);
    const m4 = m4Summary(id);
    const interp = interpret(sum, conf, nam, likelyType(id), m4);
    const all = sessionsOf(id).slice().sort((a, b) => b.date.localeCompare(a.date));
    const devices = [...new Set(all.map(s => s.device))];

    $app.innerHTML = `
      <div class="topbar no-print">
        <button class="link" id="back">← Volver</button>
        <button class="primary" id="print">Imprimir o guardar PDF</button>
      </div>
      <div class="card">
        <h1>Informe de colores: ${esc(p.name)}</h1>
        <p class="muted">Generado el ${fmtDate(new Date().toISOString())} · ${all.length} partida${all.length === 1 ? '' : 's'}${devices.length ? ' · Aparato: ' + devices.map(esc).join(', ') : ''}</p>

        <h2>En pocas palabras</h2>
        ${interp.html}

        <h2>Cómo ve los colores el ojo</h2>
        <p>El ojo tiene tres tipos de <b>"sensores" de color</b>: uno para el rojo, uno para el verde y uno para el azul. Todos los colores que vemos salen de la mezcla de lo que captan esos tres.</p>
        <p>En el daltonismo más común, el sensor del rojo o el del verde funciona distinto. Entonces algunos colores que para la mayoría son diferentes, a esa persona le parecen <b>iguales o muy parecidos</b>. No es un problema de atención, de inteligencia ni de "no saberse los colores": <b>es cómo llega la imagen al cerebro</b>. No empeora con el tiempo.</p>

        ${sum ? `
        <h2>¿Qué tan finas son las diferencias que ve?</h2>
        <p class="muted">Misión "Cazá la figura escondida": hay que encontrar una figura escondida entre puntitos. Cada lámina pone a prueba un solo sensor, y la diferencia se achica nivel a nivel. <b>Más alto = ve diferencias más finas.</b></p>
        ${others.length ? `<p class="no-print">Comparar con: <select id="ref">${others.map(o => `<option value="${o.id}" ${o.id === refId ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}<option value="" ${!refId ? 'selected' : ''}>nadie</option></select></p>` : ''}
        ${bars(sum, ref, ref ? player(refId).name : '')}
        ${!ref ? '<p class="muted" style="font-size:.9rem">Para que estos números signifiquen más, conviene que juegue un adulto con visión típica en el mismo aparato y compararlos.</p>' : ''}
        ` : ''}

        ${m4 ? `
        <h2>¿Qué cambios de color nota?</h2>
        <p class="muted">Misión "Cajas sorpresa": tres cajas con los mismos crayones; en una, los colores están "pasados" por el simulador de un tipo de daltonismo, cada vez más sutil. Si tiene ese tipo de daltonismo, esa caja le parece igual a las otras. <b>Más alto = nota cambios más sutiles.</b></p>
        ${Core.KINDS.map(k => `
          <div class="bar-row">
            <div class="bar-label"><span>Cambios del tipo ${TYPE_SHORT[k]}</span><span>${m4.avg[k].toFixed(1)} / ${Core.M4_LEVELS}</span></div>
            <div class="bar"><span style="width:${m4.avg[k] / Core.M4_LEVELS * 100}%"></span></div>
            <div class="bar-text">${cap(m4Text(m4.avg[k]))}.${m4.n > 1 ? ` Entre ${m4.min[k]} y ${m4.max[k]} en ${m4.n} partidas.` : ''}</div>
          </div>`).join('')}
        ` : ''}

        ${nam.total ? `
        <h2>Cómo nombra los colores</h2>
        <p class="muted">Misión "¿De qué color es?": se muestra un objeto pintado y tiene que elegir el nombre del color. Es lo que más se parece a lo que le pasa en la escuela ("pintá de verde").</p>
        ${nam.list.length ? nam.list.map(g => `
          <div class="pair">
            ${[...g.swatches].map(si => `<div class="sw" style="background:${Core.NAMING_SWATCHES[si].hex}"></div>`).join('')}
            <div>A un <b>${Core.NAMING[g.cat].name}</b> lo llamó <b>${Core.NAMING[g.chosen].name}</b>
              <div class="bar-text">${g.count} ${g.count === 1 ? 'vez' : 'veces'}${kindNote(g.kind)}</div></div>
          </div>`).join('') : '<p>Nombró bien todos los colores. 🎉</p>'}
        ` : ''}

        ${conf.total ? `
        <h2>Colores que se le confundieron</h2>
        <p class="muted">Misión "Memoria de colores": se muestra un color, se esconde, y hay que encontrarlo entre cuatro. Las otras tres opciones son colores que suelen confundir las personas con distintos tipos de daltonismo.</p>
        ${conf.list.length ? conf.list.map(pr => `
          <div class="pair">
            <div class="sw" style="background:${Core.PALETTE[pr.a].hex}"></div>
            <div class="sw" style="background:${Core.PALETTE[pr.b].hex}"></div>
            <div><b>${Core.PALETTE[pr.a].name}</b> con <b>${Core.PALETTE[pr.b].name}</b>
              <div class="bar-text">${pr.count} ${pr.count === 1 ? 'vez' : 'veces'}${kindNote(pr.kind)}</div></div>
          </div>`).join('') : '<p>No confundió ningún color. 🎉</p>'}
        ` : ''}
        ${conf.total || nam.total ? '<p class="muted" style="font-size:.9rem">Ojo: los colores impresos o en otra pantalla se ven un poco distintos a como los vio en el juego.</p>' : ''}

        <h2>Qué puede significar en el día a día</h2>
        ${interp.redGreen ? `
        <ul>
          <li>Puede confundir <b>verde con marrón o naranja</b>, <b>rojo con marrón o verde oscuro</b>, <b>azul con violeta</b>, <b>rosa o turquesa con gris</b>. Con poca luz o con colores apagados le cuesta más.</li>
          <li>Suele reconocer bien los colores fuertes y "puros" (rojo de semáforo, amarillo). Puede que haya aprendido a nombrarlos por cómo se ven de claros u oscuros.</li>
          <li>Puede que <b>nombre mal un color aunque lo esté viendo bien</b> en lo demás: no es que "no presta atención".</li>
        </ul>` : `
        <p>Con los resultados actuales no hay un patrón claro. Si en casa o en la escuela notan confusiones de colores, conviene anotarlas con fecha y contárselas al oftalmólogo.</p>`}

        <h2>Sugerencias para la escuela, la psicopedagoga y otros terapeutas</h2>
        <ul>
          <li><b>Que no dependa solo del color</b>: sumar formas, letras, números, rayado o posición (por ejemplo, "el grupo de los triángulos", no "el grupo verde").</li>
          <li>En evaluaciones y fichas, no penalizar errores de color si el objetivo era otro (lectura, matemática, motricidad).</li>
          <li>Evitar <b>tiza de color sobre pizarrón verde</b> (sobre todo roja o verde) y los gráficos o mapas que solo se distinguen por color.</li>
          <li>Útiles <b>etiquetados con el nombre del color</b>, siempre en el mismo orden en la cartuchera o caja.</li>
          <li>En plástica, dejar que use los colores "a su manera" o darle el nombre del color cuando la consigna lo pida.</li>
          <li>No hacerle "examen de colores" delante de otros ni festejar cuando se equivoca. Tratarlo con naturalidad y, si pregunta, explicárselo como "tus ojos ven los colores un poco distinto".</li>
          <li>En las sesiones de psicopedagogía, tener en cuenta que <b>los materiales codificados por color</b> (regletas, bloques, juegos de clasificación) pueden confundirlo: conviene chequear que distinga las piezas antes de evaluar otra cosa.</li>
        </ul>

        ${all.length ? `
        <h2>Historial de partidas</h2>
        <table>
          <tr><th>Fecha</th><th>Misión</th><th>Resultado</th></tr>
          ${all.map(s => `<tr>
            <td>${fmtDate(s.date)}</td>
            <td>${MISSION_NAME[s.mission]}</td>
            <td>${s.mission === 1
              ? `Rojo ${s.scores.L} · Verde ${s.scores.M} · Azul ${s.scores.S} <span class="muted">(de ${Core.LEVELS})</span>${s.controls.total && s.controls.ok < s.controls.total ? ` <span class="muted">· falló ${s.controls.total - s.controls.ok} lámina(s) fácil(es)</span>` : ''}`
              : s.mission === 4
              ? `Tipo rojo ${s.scores.protan} · Tipo verde ${s.scores.deutan} · Tipo azul ${s.scores.tritan} <span class="muted">(de ${Core.M4_LEVELS})</span>${s.controls.total && s.controls.ok < s.controls.total ? ` <span class="muted">· falló ${s.controls.total - s.controls.ok} caja(s) fácil(es)</span>` : ''}`
              : `Acertó ${s.answers.filter(a => a.correct).length} de ${s.answers.length}`}</td>
          </tr>`).join('')}
        </table>
        <p class="muted" style="font-size:.9rem">Si los resultados se parecen entre partidas, son más confiables. Una partida sola puede estar afectada por el cansancio.</p>
        ` : ''}

        ${sum || m4 || conf.total || nam.total ? `
        <h2 class="tech">Datos técnicos (para el oftalmólogo)</h2>
        <p class="tech">${sum ? `Láminas pseudoisocromáticas generadas por modulación de un solo cono (espacio LMS de Viénot et al. 1999, sRGB sin calibrar), con ruido de luminancia por punto (×0.72–1.12). Escalera de 10 niveles logarítmicos por eje. Nivel 1 → nivel 10 en contraste de cono: L ${(Core.MAX_C.L * 100).toFixed(1)}%→${(Core.MIN_C.L * 100).toFixed(1)}%, M ${(Core.MAX_C.M * 100).toFixed(1)}%→${(Core.MIN_C.M * 100).toFixed(1)}%, S ${(Core.MAX_C.S * 100).toFixed(1)}%→${(Core.MIN_C.S * 100).toFixed(1)}%. Puntaje = último nivel superado (2 errores en un nivel terminan el eje; 4 opciones + "no veo"). Láminas de control de luminancia intercaladas: ${sum.controlsOk}/${sum.controlsTotal} correctas. ` : ''}Memoria de colores: recuerdo de color con distractores elegidos por simulación de Machado et al. 2009. Nombrar colores: 10 categorías básicas; distractores = las 2 categorías más confundibles en simulación protán/deután + 1 al azar. Cajas sorpresa: elección forzada entre 3 (+ "son iguales"); la caja distinta es la simulación de dicromacia de Viénot, Brettel & Mollon 1999 (reemplazo del cono ausente, invisible por construcción para ese dicrómata) mezclada con el original; 8 niveles de intensidad de 100% a 6%, misma regla de escalera, con cajas de control de luminancia.</p>
        ` : ''}
      </div>
    `;
    $app.querySelector('#back').onclick = parents;
    $app.querySelector('#print').onclick = () => window.print();
    const sel = $app.querySelector('#ref');
    if (sel) sel.onchange = () => report(id, sel.value || null);
  }

  // ---------- Simulador "Así ve…" ----------
  const SIM_KINDS = {
    deutan: 'Rojo‑verde, tipo "verde" (deután, el más común)',
    protan: 'Rojo‑verde, tipo "rojo" (protán)',
    tritan: 'Azul‑amarillo (tritán, poco común)',
  };
  // Punto de partida: el tipo probable de sus resultados, explicado en una línea.
  function simDefaults(id) {
    const lt = likelyType(id), name = esc(player(id).name);
    if (!lt.family) {
      const note = lt.clearM1
        ? `Con los resultados actuales de ${name} no se detectó un tipo de daltonismo: se muestra un caso típico como ejemplo. Se puede ajustar.`
        : `Todavía no hay resultados suficientes de ${name}: se muestra un caso típico. Se puede ajustar.`;
      return { kind: 'deutan', s: 0.7, note };
    }
    let note = `<b>Preseleccionado según los resultados de ${name}</b>: ${lt.basis.join(' y ')}.`;
    if (lt.guessedSubtype) note += ' No se pudo distinguir entre el tipo "rojo" y el "verde": se muestra el "verde", que es el más común.';
    if (lt.calibrated) note += ` La intensidad la calibró ${name} en las cajas sorpresa: desde ahí dejó de notar el cambio.`;
    else if (lt.s == null) note += ' La intensidad es estimada: jugando la misión de figuras escondidas o las cajas sorpresa se afina.';
    return { kind: lt.kind, s: lt.s ?? 0.7, note: note + ' Se puede ajustar.' };
  }

  function crayonsCanvas() {
    const sw = Core.NAMING_SWATCHES, cols = 7, cw = 120, ch = 190, W = cols * cw + 20, H = Math.ceil(sw.length / cols) * ch + 20;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
    sw.forEach((s, i) => {
      const cat = Core.NAMING[s.cat], first = cat.shades[0];
      let name = cat.name;
      const Y = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      if (s.hex !== first.hex) name += Y(s.lin) > Y(first.lin) ? ' claro' : ' oscuro';
      const ox = 10 + (i % cols) * cw + 30, oy = 10 + Math.floor(i / cols) * ch + 10;
      x.fillStyle = s.hex;
      x.beginPath(); x.moveTo(ox + 30, oy); x.lineTo(ox + 52, oy + 34); x.lineTo(ox + 8, oy + 34); x.closePath(); x.fill();
      x.fillRect(ox + 8, oy + 34, 44, 100);
      x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(ox + 8, oy + 60, 44, 8); x.fillRect(ox + 8, oy + 110, 44, 8);
      x.fillStyle = '#222'; x.font = '600 17px -apple-system, sans-serif'; x.textAlign = 'center';
      x.fillText(name, ox + 30, oy + 160);
    });
    return c;
  }

  function simulator(id) {
    setTheme('parents');
    const p = player(id);
    const def = simDefaults(id);
    let source = crayonsCanvas();
    $app.innerHTML = `
      <div class="topbar"><button class="link" id="back">← Volver</button></div>
      <h1>👓 Así ve ${esc(p.name)} (aproximado)</h1>
      <p class="muted">Es una <b>simulación aproximada</b>: nadie puede ver exactamente con los ojos de otra persona. Sirve para que la familia, la maestra y los terapeutas se den una idea de qué colores se le "juntan".</p>
      <div class="card controls">
        <label>Tipo
          <select id="kind">${Object.entries(SIM_KINDS).map(([k, t]) => `<option value="${k}" ${k === def.kind ? 'selected' : ''}>${t}</option>`).join('')}</select>
        </label>
        <label>Intensidad: <span id="sval"></span>
          <input type="range" id="sev" min="10" max="100" step="5" value="${Math.round(def.s * 100)}">
        </label>
        <p class="muted" style="margin:0;font-size:.9rem">${def.note}</p>
        <div class="row">
          <label class="row" style="display:flex"><button id="photoBtn" class="primary">📷 Usar una foto</button><input type="file" id="photo" accept="image/*" hidden></label>
          <button id="crayons">🖍️ Crayones de ejemplo</button>
        </div>
        <p class="muted" style="margin:0;font-size:.85rem">La foto no sale del aparato: se procesa acá mismo.</p>
      </div>
      <div class="sim-grid">
        <figure><figcaption>Como lo ve la mayoría</figcaption><canvas id="orig"></canvas></figure>
        <figure><figcaption>Como lo vería ${esc(p.name)}</figcaption><canvas id="sim"></canvas></figure>
      </div>
    `;
    const kindSel = $app.querySelector('#kind'), sev = $app.querySelector('#sev'), sval = $app.querySelector('#sval');
    const orig = $app.querySelector('#orig'), sim = $app.querySelector('#sim');
    const LIN = new Float32Array(256).map((_, i) => Core.toLin(i / 255));
    const OUT = new Uint8ClampedArray(4096).map((_, i) => Math.round(255 * Core.toSrgb(i / 4095)));

    function render() {
      const s = +sev.value / 100;
      sval.textContent = s < 0.4 ? 'leve' : s < 0.75 ? 'moderada' : 'fuerte';
      orig.width = sim.width = source.width; orig.height = sim.height = source.height;
      const o = orig.getContext('2d'); o.drawImage(source, 0, 0);
      const img = o.getImageData(0, 0, source.width, source.height), d = img.data;
      const m = Core.simMatrix(kindSel.value, s);
      for (let i = 0; i < d.length; i += 4) {
        const r = LIN[d[i]], g = LIN[d[i + 1]], b = LIN[d[i + 2]];
        for (let k = 0; k < 3; k++) {
          const v = m[k][0] * r + m[k][1] * g + m[k][2] * b;
          d[i + k] = OUT[Math.round(Math.min(1, Math.max(0, v)) * 4095)];
        }
      }
      sim.getContext('2d').putImageData(img, 0, 0);
    }
    kindSel.onchange = render;
    sev.oninput = render;
    $app.querySelector('#crayons').onclick = () => { source = crayonsCanvas(); render(); };
    const photo = $app.querySelector('#photo');
    $app.querySelector('#photoBtn').onclick = () => photo.click();
    photo.onchange = () => {
      const f = photo.files[0]; if (!f) return;
      const url = URL.createObjectURL(f), im = new Image();
      im.onload = () => {
        const k = Math.min(1, 1200 / Math.max(im.width, im.height));
        const c = document.createElement('canvas');
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        source = c; render();
      };
      im.src = url;
    };
    $app.querySelector('#back').onclick = parents;
    render();
  }

  home();
})();
