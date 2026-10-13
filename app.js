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
    for (const m of [1, 2, 3]) { const p = (db.progress || {})[id + ':' + m]; if (p) stars += p.stars || 0; }
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
  const MASCOT = `<svg class="mascot" viewBox="0 0 120 120" aria-hidden="true">
    <polygon points="22,58 14,22 40,38 48,6 62,32 80,4 84,36 108,20 98,58" fill="#2f6feb" stroke="#1a47a8" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="60" cy="68" r="40" fill="#ffc93c" stroke="#e08e00" stroke-width="4"/>
    <polygon points="58,34 50,50 58,50 54,62 68,44 60,44 64,34" fill="#ff8a00"/>
    <ellipse cx="45" cy="66" rx="9" ry="11" fill="#fff"/><ellipse cx="75" cy="66" rx="9" ry="11" fill="#fff"/>
    <circle cx="47" cy="68" r="5.5" fill="#1b1b2a"/><circle cx="77" cy="68" r="5.5" fill="#1b1b2a"/>
    <circle cx="49" cy="65.5" r="2" fill="#fff"/><circle cx="79" cy="65.5" r="2" fill="#fff"/>
    <circle cx="34" cy="83" r="6" fill="#ff6b6b" opacity=".85"/><circle cx="86" cy="83" r="6" fill="#ff6b6b" opacity=".85"/>
    <path d="M48 86 Q60 98 72 86" fill="none" stroke="#1b1b2a" stroke-width="4" stroke-linecap="round"/>
  </svg>`;

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
  const progressBar = (label, frac) => {
    const pct = Math.round(Math.min(1, Math.max(0, frac)) * 100);
    return `<div class="progress"><span class="plabel">${label}</span>
      <div class="ptrack"><div class="pfill" style="width:${pct}%"></div><span class="prunner" style="left:${pct}%">⭐</span></div>
      <span class="pgoal">🏁</span></div>`;
  };
  const gameTop = (label, frac, stars) => `
    <div class="gtop"><button class="quit" id="quit">✕</button>${progressBar(label, frac)}<span class="stars">⭐ ${stars}</span></div>`;
  const guide = html => `<div class="guide">${MASCOT}<div class="bubble">${html}</div></div>`;

  // ---------- Inicio ----------
  function newPlayer(first) {
    setTheme('menu');
    $app.innerHTML = `
      <div class="hero">${MASCOT}<div class="bubble"><span class="fun">${first ? '¡Hola! Soy Chispa ⚡' : 'Nuevo jugador'}</span>${first ? 'Vamos a cazar colores juntos.' : ''}</div></div>
      <h1>${first ? '¿Cómo te llamás?' : 'Nombre del jugador'}</h1>
      <input type="text" id="name" maxlength="30" autocomplete="off" placeholder="${first ? 'Tu nombre' : 'Por ejemplo: Mamá'}">
      <p style="font-size:.9rem;opacity:.9">El nombre y los resultados quedan guardados solo en este aparato.</p>
      <button class="big primary" id="ok" style="background:#1b1b3a;border-color:#ffc83d">¡Listo!</button>
      ${first ? '' : '<button class="link" id="back">Volver</button>'}
    `;
    const input = $app.querySelector('#name');
    input.focus();
    const ok = () => {
      const name = input.value.trim();
      if (!name) return input.focus();
      const p = { id: uid(), name };
      db.players.push(p); db.currentPlayer = p.id; save();
      first ? home() : parents();
    };
    $app.querySelector('#ok').onclick = ok;
    input.onkeydown = e => { if (e.key === 'Enter') ok(); };
    if (!first) $app.querySelector('#back').onclick = parents;
  }

  const MISSIONS = [
    { m: 1, icon: '🔍', bg: 'linear-gradient(145deg,#ffb020,#ff6a00)', title: 'Cazá la figura escondida', sub: 'Encontrá estrellas, anillos, rayos y hongos' },
    { m: 2, icon: '🧠', bg: 'linear-gradient(145deg,#4dabf7,#2d4fd8)', title: 'Memoria de colores', sub: 'Mirá un color… ¡y encontralo!' },
    { m: 3, icon: '🖍️', bg: 'linear-gradient(145deg,#b197fc,#7b3fe4)', title: '¿De qué color es?', sub: 'Decí el color de cada cosa' },
  ];
  const BUBBLES = ['¿Listo para cazar colores?', '¡Hoy vamos por más esferas!', '¿Qué misión jugamos?', '¡Tu poder no para de crecer!'];

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
    $app.innerHTML = `
      <div class="menu-top">
        <button class="pill-btn" id="sound">${db.sound === false ? '🔇' : '🔊'}</button>
        <button class="pill-btn" id="parents">👨‍👩‍👦 Papás</button>
      </div>
      <div class="hero">${MASCOT}<div class="bubble"><span class="fun">¡Hola, ${esc(cur.name)}!</span>${BUBBLES[Math.floor(Math.random() * BUBBLES.length)]}</div></div>
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
    $app.querySelector('#sound').onclick = () => { db.sound = db.sound === false; save(); home(); };
  }

  // La guía para el adulto se muestra una vez cada vez que se abre la app.
  let checklistShown = false;
  function startMission(m) {
    const run = { 1: mission1, 2: mission2, 3: mission3 }[m];
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
    `;
    $app.querySelector('#back').onclick = home;
    $app.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { db.currentPlayer = b.dataset.p; save(); parents(); });
    $app.querySelector('#add').onclick = () => newPlayer(false);
    $app.querySelector('#rep').onclick = () => report(db.currentPlayer);
    $app.querySelector('#sim').onclick = () => simulator(db.currentPlayer);
  }

  // ---------- Informe para la familia ----------
  const AXIS_INFO = {
    L: { title: 'Sensor del rojo' },
    M: { title: 'Sensor del verde' },
    S: { title: 'Sensor del azul' },
  };
  const MISSION_NAME = { 1: 'Figuras escondidas', 2: 'Memoria de colores', 3: 'Nombrar colores' };
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

  function interpret(sum, conf, nam) {
    const lines = [];
    let redGreen = false;
    if (sum) {
      const { L, M, S } = sum.avg;
      const rg = Math.min(L, M);
      if (L >= 7 && M >= 7 && S >= 7) {
        lines.push('En la misión de las figuras escondidas <b>no aparecieron dificultades claras</b> con ningún tipo de color.');
      } else if (Math.max(L, M, S) < 5) {
        lines.push('Le costaron <b>todos</b> los tipos de color por igual. Puede ser cansancio, falta de atención o la pantalla. Conviene repetir otro día.');
      } else if (rg < 7 && S - rg >= 2) {
        redGreen = true;
        let sub = '';
        if (M - L >= 2) sub = ' Parece más relacionado con el <b>sensor del rojo</b> (tipo "protán").';
        else if (L - M >= 2) sub = ' Parece más relacionado con el <b>sensor del verde</b> (tipo "deután", el más común).';
        else sub = ' Con este juego no se puede saber si es del tipo "rojo" o del tipo "verde"; eso lo define el oftalmólogo.';
        lines.push('Le cuesta distinguir los colores que dependen de los sensores del <b>rojo y del verde</b>. Es la forma más común de daltonismo.' + sub);
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
    const interp = interpret(sum, conf, nam);
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
              : `Acertó ${s.answers.filter(a => a.correct).length} de ${s.answers.length}`}</td>
          </tr>`).join('')}
        </table>
        <p class="muted" style="font-size:.9rem">Si los resultados se parecen entre partidas, son más confiables. Una partida sola puede estar afectada por el cansancio.</p>
        ` : ''}

        ${sum || conf.total || nam.total ? `
        <h2 class="tech">Datos técnicos (para el oftalmólogo)</h2>
        <p class="tech">${sum ? `Láminas pseudoisocromáticas generadas por modulación de un solo cono (espacio LMS de Viénot et al. 1999, sRGB sin calibrar), con ruido de luminancia por punto (×0.72–1.12). Escalera de 10 niveles logarítmicos por eje. Nivel 1 → nivel 10 en contraste de cono: L ${(Core.MAX_C.L * 100).toFixed(1)}%→${(Core.MIN_C.L * 100).toFixed(1)}%, M ${(Core.MAX_C.M * 100).toFixed(1)}%→${(Core.MIN_C.M * 100).toFixed(1)}%, S ${(Core.MAX_C.S * 100).toFixed(1)}%→${(Core.MIN_C.S * 100).toFixed(1)}%. Puntaje = último nivel superado (2 errores en un nivel terminan el eje; 4 opciones + "no veo"). Láminas de control de luminancia intercaladas: ${sum.controlsOk}/${sum.controlsTotal} correctas. ` : ''}Memoria de colores: recuerdo de color con distractores elegidos por simulación de Machado et al. 2009. Nombrar colores: 10 categorías básicas; distractores = las 2 categorías más confundibles en simulación protán/deután + 1 al azar.</p>
        ` : ''}
      </div>

      <div class="card no-print">
        <h2 style="margin-top:0">Copia de seguridad</h2>
        <p class="muted">Los datos quedan guardados solo en este aparato y en este navegador. Para no perderlos, o para pasarlos a otro aparato, descarguen una copia.</p>
        <div class="row">
          <button id="export">Descargar copia</button>
          <label class="row"><button id="importBtn">Cargar copia</button><input type="file" id="import" accept="application/json" hidden></label>
        </div>
        <h2>Empezar de cero</h2>
        <p class="muted">Borra todos los jugadores y resultados guardados en este aparato.</p>
        <button id="reset">Borrar todos los datos</button>
      </div>
    `;
    $app.querySelector('#back').onclick = parents;
    $app.querySelector('#print').onclick = () => window.print();
    const sel = $app.querySelector('#ref');
    if (sel) sel.onchange = () => report(id, sel.value || null);
    $app.querySelector('#export').onclick = () => {
      const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'cazador-de-colores-' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    const file = $app.querySelector('#import');
    $app.querySelector('#importBtn').onclick = () => file.click();
    $app.querySelector('#reset').onclick = () => {
      if (!confirm('¿Borrar todos los jugadores y resultados de este aparato? No se puede deshacer.')) return;
      db = { players: [], sessions: [], currentPlayer: null };
      save();
      home();
    };
    file.onchange = async () => {
      try {
        const data = JSON.parse(await file.files[0].text());
        if (!Array.isArray(data.players) || !Array.isArray(data.sessions)) throw new Error('formato');
        // Unir sin duplicar
        for (const pl of data.players) if (!player(pl.id)) db.players.push(pl);
        const have = new Set(db.sessions.map(s => s.id));
        for (const s of data.sessions) if (!have.has(s.id)) db.sessions.push(s);
        save();
        report(id, refId);
      } catch (e) { alert('No se pudo leer ese archivo.'); }
    };
  }

  // ---------- Simulador "Así ve…" ----------
  const SIM_KINDS = {
    deutan: 'Rojo‑verde, tipo "verde" (deután, el más común)',
    protan: 'Rojo‑verde, tipo "rojo" (protán)',
    tritan: 'Azul‑amarillo (tritán, poco común)',
  };
  // Punto de partida según los resultados de la Misión 1.
  function simDefaults(id) {
    const sum = mission1Summary(id);
    if (!sum) return { kind: 'deutan', s: 0.7, fromResults: false };
    const { L, M, S } = sum.avg;
    let kind = 'deutan', score = M;
    if (S < Math.min(L, M) - 1) { kind = 'tritan'; score = S; }
    else if (M - L >= 2) { kind = 'protan'; score = L; }
    else score = Math.min(L, M);
    return { kind, s: Math.min(1, Math.max(0.1, (9 - score) / 9)), fromResults: true };
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
        <p class="muted" style="margin:0;font-size:.9rem">${def.fromResults ? `Arranca con lo que sugieren los resultados de ${esc(p.name)} en la misión de figuras escondidas. Se puede ajustar.` : 'Todavía no hay resultados de la misión de figuras escondidas: muestra un caso típico. Se puede ajustar.'}</p>
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
