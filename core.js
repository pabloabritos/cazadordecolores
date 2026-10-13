const Core = (() => {
  // ---------- Conversión de color ----------
  const toLin = c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const toSrgb = c => c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  const clamp01 = v => Math.min(1, Math.max(0, v));
  const hexToLin = hex => [1, 3, 5].map(i => toLin(parseInt(hex.slice(i, i + 2), 16) / 255));
  const linToCss = rgb => 'rgb(' + rgb.map(v => Math.round(255 * toSrgb(clamp01(v)))).join(',') + ')';
  const mul = (m, v) => m.map(r => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
  function inv3(m) {
    const [a, b, c] = m[0], [d, e, f] = m[1], [g, h, i] = m[2];
    const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
    const det = a * A + b * B + c * C;
    return [
      [A / det, -(b * i - c * h) / det, (b * f - c * e) / det],
      [B / det, (a * i - c * g) / det, -(a * f - c * d) / det],
      [C / det, -(a * h - b * g) / det, (a * e - b * d) / det],
    ];
  }

  // RGB lineal -> conos LMS (Viénot, Brettel & Mollon 1999)
  const RGB2LMS = [[17.8824, 43.5161, 4.11935], [3.45565, 27.1554, 3.86714], [0.0299566, 0.184309, 1.46709]];
  const LMS2RGB = inv3(RGB2LMS);
  const AXES = ['L', 'M', 'S'];

  // Modula un solo tipo de cono: los colores resultantes caen sobre la línea de confusión
  // protán (L), deután (M) o tritán (S) del color base.
  function shiftCone(lin, axis, c) {
    const lms = mul(RGB2LMS, lin);
    lms[AXES.indexOf(axis)] *= 1 + c;
    return mul(LMS2RGB, lms);
  }

  // ---------- Juego 1: láminas ----------
  const BASES = [[0.30, 0.30, 0.30], [0.34, 0.30, 0.24], [0.26, 0.30, 0.34]];
  const NOISE = [0.72, 1.12];           // ruido de luminancia por puntito (tapa pistas de brillo)
  const CONTROL_FACTOR = 0.55;          // láminas de control: figura más oscura, la ve cualquiera
  const LEVELS = 10;
  const MIN_C = { L: 0.006, M: 0.008, S: 0.05 };
  const inGamut = v => v.every(x => x >= 0 && x <= 1);

  function maxContrast(axis) {
    let lo = 0, hi = 2;
    for (let k = 0; k < 40; k++) {
      const mid = (lo + hi) / 2;
      const ok = BASES.every(b => [1, -1].every(s => {
        const v = shiftCone(b, axis, s * mid);
        return NOISE.every(n => inGamut(v.map(x => x * n)));
      }));
      if (ok) lo = mid; else hi = mid;
    }
    return lo * 0.95;
  }
  const MAX_C = { L: maxContrast('L'), M: maxContrast('M'), S: maxContrast('S') };

  // Nivel 1 = diferencia más grande que permite la pantalla; nivel 10 = diferencia muy fina.
  const contrastFor = (axis, level) =>
    MAX_C[axis] * Math.pow(MIN_C[axis] / MAX_C[axis], (level - 1) / (LEVELS - 1));

  // Figuras en coordenadas 0..1 (la lámina es un círculo de radio 0,5 centrado en 0,5)
  function starPoints(cx, cy, ro, ri) {
    const pts = [];
    for (let k = 0; k < 10; k++) {
      const r = k % 2 ? ri : ro, a = -Math.PI / 2 + k * Math.PI / 5;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    return pts;
  }
  const STAR = starPoints(0.5, 0.53, 0.34, 0.15);
  const BOLT = [[0.57, 0.15], [0.29, 0.55], [0.47, 0.55], [0.39, 0.86], [0.72, 0.42], [0.54, 0.42], [0.66, 0.15]];
  function inPoly(pts, x, y) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  const SHAPES = {
    estrella: (x, y) => inPoly(STAR, x, y),
    anillo: (x, y) => { const d = Math.hypot(x - 0.5, y - 0.5); return d >= 0.16 && d <= 0.32; },
    rayo: (x, y) => inPoly(BOLT, x, y),
    hongo: (x, y) => {
      const cap = y <= 0.52 && ((x - 0.5) / 0.33) ** 2 + ((y - 0.52) / 0.30) ** 2 <= 1;
      const stem = x >= 0.39 && x <= 0.61 && y >= 0.5 && y <= 0.82;
      return cap || stem;
    },
  };
  const SHAPE_NAMES = Object.keys(SHAPES);

  function rng(seed) { // mulberry32
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeDots(rand) {
    const dots = [], cell = 0.05, grid = new Map(), R = 0.485, gap = 0.0025;
    const key = (i, j) => i + ',' + j;
    for (let tries = 0; tries < 30000; tries++) {
      const r = 0.006 + 0.014 * Math.pow(rand(), 1.6);
      const x = rand(), y = rand();
      if (Math.hypot(x - 0.5, y - 0.5) > R - r) continue;
      const ci = Math.floor(x / cell), cj = Math.floor(y / cell);
      let ok = true;
      for (let di = -1; di <= 1 && ok; di++) for (let dj = -1; dj <= 1 && ok; dj++) {
        for (const d of grid.get(key(ci + di, cj + dj)) || []) {
          if (Math.hypot(d.x - x, d.y - y) < d.r + r + gap) { ok = false; break; }
        }
      }
      if (!ok) continue;
      const dot = { x, y, r };
      dots.push(dot);
      const k = key(ci, cj);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(dot);
    }
    return dots;
  }

  // Devuelve los puntitos ya coloreados. trial = { kind: 'axis'|'control', axis, level, shape, seed }
  function buildPlate(trial) {
    const rand = rng(trial.seed);
    const base = BASES[Math.floor(rand() * BASES.length)];
    let fig;
    if (trial.kind === 'control') fig = base.map(v => v * CONTROL_FACTOR);
    else fig = shiftCone(base, trial.axis, (rand() < 0.5 ? 1 : -1) * contrastFor(trial.axis, trial.level));
    const inside = SHAPES[trial.shape];
    return makeDots(rand).map(d => {
      const n = NOISE[0] + (NOISE[1] - NOISE[0]) * rand();
      const col = inside(d.x, d.y) ? fig : base;
      return { x: d.x, y: d.y, r: d.r, color: linToCss(col.map(v => v * n)) };
    });
  }

  // Escalera: cada acierto sube un nivel; dos errores en el mismo nivel terminan ese eje.
  function newStairs(keys = AXES) {
    const s = {};
    for (const a of keys) s[a] = { level: 1, fails: 0, trials: 0, done: false, score: null };
    return s;
  }
  function stairUpdate(st, correct, levels = LEVELS) {
    st.trials++;
    if (correct) {
      st.fails = 0;
      if (st.level >= levels) { st.done = true; st.score = levels; } else st.level++;
    } else {
      st.fails++;
      if (st.fails >= 2) { st.done = true; st.score = st.level - 1; }
    }
    if (!st.done && st.trials >= 18) { st.done = true; st.score = st.level - 1; }
  }

  // ---------- Juego 2: colores cotidianos ----------
  const PALETTE = [
    ['Rojo', '#E02020'], ['Bordó', '#7A1C2E'], ['Naranja', '#F07F1A'], ['Salmón', '#F2917A'],
    ['Marrón', '#7B4A26'], ['Beige', '#D9C29A'], ['Mostaza', '#C49A1C'], ['Amarillo', '#F5D21F'],
    ['Verde limón', '#A6D433'], ['Verde pasto', '#4CA43A'], ['Verde oscuro', '#2F5E2A'], ['Verde agua', '#4FC3A8'],
    ['Turquesa', '#1E9AAE'], ['Celeste', '#79BDEB'], ['Azul', '#2457C5'], ['Azul marino', '#1F2A5C'],
    ['Violeta', '#7B3FB0'], ['Lila', '#B79AD9'], ['Rosa', '#F4A6C0'], ['Fucsia', '#D6338A'],
    ['Gris', '#8C8C8C'], ['Gris claro', '#C8C8C8'],
    ['Verde oliva', '#6E7B2B'], ['Terracota', '#B5532F'], ['Morado', '#4B2A7B'],
  ].map(([name, hex]) => ({ name, hex, lin: hexToLin(hex) }));

  // Simulación de dicromacia (Machado, Oliveira & Fernandes 2009, severidad 1), en RGB lineal
  const MACHADO = {
    protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
    deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
    tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
  };
  const KINDS = Object.keys(MACHADO);
  const simulate = (lin, kind) => mul(MACHADO[kind], lin).map(clamp01);

  function linToLab(lin) {
    const X = 0.4124 * lin[0] + 0.3576 * lin[1] + 0.1805 * lin[2];
    const Y = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
    const Z = 0.0193 * lin[0] + 0.1192 * lin[1] + 0.9505 * lin[2];
    const f = t => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
    const fx = f(X / 0.95047), fy = f(Y), fz = f(Z / 1.08883);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }
  const dE = (a, b) => { const p = linToLab(a), q = linToLab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
  const dESim = (a, b, kind) => dE(simulate(a, kind), simulate(b, kind));

  const MIN_NORMAL_DE = 22; // para alguien con visión típica, las opciones tienen que ser claramente distintas

  // Para un color objetivo elige 3 "trampas": la más confundible para cada tipo de daltonismo.
  function confusersFor(ti) {
    const t = PALETTE[ti], used = new Set([ti]), out = [];
    for (const kind of KINDS) {
      const ranked = PALETTE.map((c, i) => ({ i, d: dESim(t.lin, c.lin, kind) }))
        .filter(o => !used.has(o.i) && dE(t.lin, PALETTE[o.i].lin) >= MIN_NORMAL_DE)
        .sort((a, b) => a.d - b.d);
      if (!ranked.length) return null;
      used.add(ranked[0].i);
      out.push(ranked[0].i);
    }
    return out;
  }

  // Clasifica un par de colores: ¿con qué tipo de daltonismo se vuelven parecidos?
  // Cuenta como confundible si con ese tipo la diferencia es chica, o se achica a menos de un 25 %.
  function classifyConfusion(ti, ci) {
    const a = PALETTE[ti].lin, b = PALETTE[ci].lin, normal = dE(a, b);
    let best = null;
    for (const kind of KINDS) {
      const d = dESim(a, b, kind);
      if (!best || d < best.d) best = { kind, d };
    }
    return best.d < 14 || best.d / normal < 0.25 ? best.kind : 'otro';
  }

  // Solo se usan como objetivo los colores que tienen al menos una trampa rojo‑verde de verdad.
  const isGoodTarget = ti => {
    const c = confusersFor(ti);
    return !!c && c.some(ci => ['protan', 'deutan'].includes(classifyConfusion(ti, ci)));
  };

  // ---------- Misión 3: nombrar colores ----------
  // Colores "de manual" de las categorías que conoce un chico de 7 años, con 2-3 tonos cada una.
  const NAMING = [
    ['rojo', ['#D32F2F', '#B71C1C']],
    ['naranja', ['#F57C00', '#FF9800']],
    ['amarillo', ['#FBC02D', '#FFEB3B']],
    ['verde', ['#43A047', '#7CB342', '#2E6B30']],
    ['celeste', ['#4FC3F7', '#81D4FA']],
    ['azul', ['#1E50C8', '#283593']],
    ['violeta', ['#7B1FA2', '#9575CD']],
    ['rosa', ['#F48FB1', '#EC407A']],
    ['marrón', ['#795548', '#8D5A2B']],
    ['gris', ['#9E9E9E', '#616161']],
  ].map(([name, hexes]) => ({ name, shades: hexes.map(hex => ({ hex, lin: hexToLin(hex) })) }));
  const NAMING_SWATCHES = NAMING.flatMap((c, ci) => c.shades.map(s => ({ cat: ci, hex: s.hex, lin: s.lin })));

  // Qué tan parecido se ve un tono a una categoría para alguien rojo‑verde (o azul‑amarillo)
  function catDistance(lin, ci, kinds) {
    let best = Infinity;
    for (const sh of NAMING[ci].shades) for (const k of kinds) best = Math.min(best, dESim(lin, sh.lin, k));
    return best;
  }
  // Opciones: la correcta, las 2 categorías más confundibles para rojo‑verde y 1 al azar.
  function namingOptions(si, rand = Math.random) {
    const sw = NAMING_SWATCHES[si];
    const others = NAMING.map((_, ci) => ci).filter(ci => ci !== sw.cat)
      .map(ci => ({ ci, d: catDistance(sw.lin, ci, ['protan', 'deutan']) }))
      .sort((a, b) => a.d - b.d);
    const rest = others.slice(2);
    return [sw.cat, others[0].ci, others[1].ci, rest[Math.floor(rand() * rest.length)].ci];
  }
  // ¿Es una confusión típica? Compara el tono mostrado con la categoría que eligió.
  function classifyNaming(si, chosenCat) {
    const sw = NAMING_SWATCHES[si];
    let normal = Infinity;
    for (const sh of NAMING[chosenCat].shades) normal = Math.min(normal, dE(sw.lin, sh.lin));
    let best = null;
    for (const kind of KINDS) {
      const d = catDistance(sw.lin, chosenCat, [kind]);
      if (!best || d < best.d) best = { kind, d };
    }
    return best.d < 15 || best.d / normal < 0.3 ? best.kind : 'otro';
  }

  // ---------- Simulador "así ve" (Viénot, Brettel & Mollon 1999) ----------
  // Reemplaza la señal del cono que falta por una combinación de los otros dos (plano por el blanco y
  // el azul, o el rojo para tritán). Los dos conos que sí tiene no cambian, así que para un dicrómata
  // de ese tipo la imagen simulada es idéntica a la original, a cualquier intensidad.
  const CONE = { protan: 0, deutan: 1, tritan: 2 };
  function projection(kind) {
    const i = CONE[kind], [o0, o1] = [0, 1, 2].filter(x => x !== i);
    const W = mul(RGB2LMS, [1, 1, 1]), R = mul(RGB2LMS, kind === 'tritan' ? [1, 0, 0] : [0, 0, 1]);
    const det = W[o0] * R[o1] - W[o1] * R[o0];
    const a = (W[i] * R[o1] - W[o1] * R[i]) / det, b = (W[o0] * R[i] - W[i] * R[o0]) / det;
    return { i, o0, o1, a, b };
  }
  // Matriz en RGB lineal: mezcla entre visión típica (s = 0) y dicromacia completa (s = 1).
  function simMatrix(kind, s) {
    const { i, o0, o1, a, b } = projection(kind);
    const P = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    P[i] = [0, 0, 0]; P[i][i] = 1 - s; P[i][o0] = s * a; P[i][o1] = s * b;
    const mm = (A, B) => A.map(r => B[0].map((_, j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
    return mm(LMS2RGB, mm(P, RGB2LMS));
  }
  const applySim = (lin, kind, s) => mul(simMatrix(kind, s), lin);

  // ---------- Misión 4: cajas sorpresa ----------
  const M4_LEVELS = 8;
  const M4_MIN = 0.06;
  // Nivel 1 = simulación completa; nivel 8 = un cambio muy sutil.
  const m4Intensity = level => Math.pow(M4_MIN, (level - 1) / (M4_LEVELS - 1));
  // Colores que al simularlos siguen dentro de la pantalla y cambian a la vista de alguien típico.
  const M4_POOL = {};
  for (const kind of KINDS) {
    const all = [...NAMING_SWATCHES.map(s => s.lin), ...PALETTE.map(p => p.lin)];
    M4_POOL[kind] = all.filter(lin => {
      const t = applySim(lin, kind, 1);
      return t.every(v => v >= -0.002 && v <= 1.002) && dE(lin, t.map(clamp01)) >= 12;
    });
  }
  function m4Crayons(kind, rand = Math.random) {
    const pool = M4_POOL[kind].slice();
    const out = [];
    while (out.length < 6 && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
    return out;
  }

  return {
    AXES, LEVELS, MAX_C, MIN_C, SHAPE_NAMES, SHAPES, STAR, BOLT, PALETTE, KINDS,
    contrastFor, buildPlate, newStairs, stairUpdate, confusersFor, classifyConfusion, isGoodTarget,
    shiftCone, simulate, dE, dESim, hexToLin, linToCss, rng, toLin, toSrgb,
    NAMING, NAMING_SWATCHES, namingOptions, classifyNaming, simMatrix, applySim,
    M4_LEVELS, m4Intensity, m4Crayons, clamp01,
  };
})();
if (typeof module !== 'undefined') module.exports = Core;
