// motion.js: a small anime.js-style toolkit for frame-by-frame rendering.
// Every function here is pure: the same inputs always give the same output, nothing reads the
// clock, nothing keeps hidden state between calls (the PRNG objects only advance when you call
// them). Works in the browser (ES module) and in Node 22 (import from 'tools/lib/motion.js').
//
// Contents
//   math       clamp lerp invLerp remap fract mod pingpong smoothstep smootherstep segment window01
//   easing     linear, quad/cubic/quart/quint/sine/expo/circ/back/elastic/bounce in/out/inOut,
//              cubicBezier(x1,y1,x2,y2), steps(n), spring({...}), getEase('outCubic' | 'cubic-bezier(...)')
//   tweens     tween(t, start, dur, from, to, ease), track(keys) keyframe tracks, timeline({...})
//   stagger    stagger(i, n, opts) anime.js-style delays (from first/last/center/edges/index, grid)
//   random     mulberry32(seed), rng(seed) helpers, hash32(...), rand(i, seed) stateless random
//   noise      valueNoise1/2/3, simplex2/3 (seeded), fbm(fn, ...)
//   music      frameTime, timeFrame, lastIndex(times, t), beatAt(t, beats), envelope(t, times, ...)
//   colour     hexToRgb, rgbToHex, mixColor(a, b, t, space) in srgb, linear or oklab
//
// Conventions: t is time in seconds unless a function says otherwise; easing functions map
// [0,1] to [0,1] (back/elastic overshoot inside the range); frame f of a 30 fps film shows time f/30.

// ---------------------------------------------------------------- math
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, x) => (b === a ? 0 : (x - a) / (b - a));
export const remap = (x, a0, a1, b0, b1, clamped = false) => {
  let t = invLerp(a0, a1, x);
  if (clamped) t = clamp(t);
  return lerp(b0, b1, t);
};
export const fract = (x) => x - Math.floor(x);
export const mod = (x, m) => ((x % m) + m) % m;
export const pingpong = (x, len = 1) => { const m = mod(x, 2 * len); return m <= len ? m : 2 * len - m; };
export const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
export const smootherstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * t * (t * (t * 6 - 15) + 10); };
/** 0 before start, 1 after start+dur, linear in between (optionally eased). */
export const segment = (t, start, dur, ease = linear) => ease(clamp(dur <= 0 ? (t >= start ? 1 : 0) : (t - start) / dur));
/** 0 outside [t0, t1], ramps up over fadeIn and down over fadeOut, 1 in the middle. */
export const window01 = (t, t0, t1, fadeIn = 0, fadeOut = 0) => {
  if (t < t0 || t > t1) return 0;
  const a = fadeIn > 0 ? clamp((t - t0) / fadeIn) : 1;
  const b = fadeOut > 0 ? clamp((t1 - t) / fadeOut) : 1;
  return Math.min(a, b);
};

// ---------------------------------------------------------------- easing
export const linear = (t) => t;
const inOutFrom = (fin) => (t) => (t < 0.5 ? fin(2 * t) / 2 : 1 - fin(2 - 2 * t) / 2);
const outFrom = (fin) => (t) => 1 - fin(1 - t);
const power = (p) => (t) => Math.pow(t, p);

export const inQuad = power(2), outQuad = outFrom(inQuad), inOutQuad = inOutFrom(inQuad);
export const inCubic = power(3), outCubic = outFrom(inCubic), inOutCubic = inOutFrom(inCubic);
export const inQuart = power(4), outQuart = outFrom(inQuart), inOutQuart = inOutFrom(inQuart);
export const inQuint = power(5), outQuint = outFrom(inQuint), inOutQuint = inOutFrom(inQuint);
export const inSine = (t) => 1 - Math.cos((t * Math.PI) / 2);
export const outSine = (t) => Math.sin((t * Math.PI) / 2);
export const inOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
export const inExpo = (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10));
export const outExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const inOutExpo = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2);
export const inCirc = (t) => 1 - Math.sqrt(1 - clamp(t) * clamp(t));
export const outCirc = outFrom(inCirc);
export const inOutCirc = inOutFrom(inCirc);

/** back: overshoot s (1.70158 is the classic ~10% overshoot). */
export const inBackS = (s = 1.70158) => (t) => (s + 1) * t * t * t - s * t * t;
export const outBackS = (s = 1.70158) => outFrom(inBackS(s));
export const inOutBackS = (s = 1.70158) => inOutFrom(inBackS(s * 1.525));
export const inBack = inBackS(), outBack = outBackS(), inOutBack = inOutBackS();

/** elastic: amplitude >= 1, period in units of the tween length (0.3 = classic). */
export const outElasticAP = (amplitude = 1, period = 0.3) => {
  const a = Math.max(1, amplitude);
  const s = (period / (2 * Math.PI)) * Math.asin(1 / a);
  return (t) => (t <= 0 ? 0 : t >= 1 ? 1 : a * Math.pow(2, -10 * t) * Math.sin(((t - s) * 2 * Math.PI) / period) + 1);
};
export const inElasticAP = (amplitude = 1, period = 0.3) => outFrom(outElasticAP(amplitude, period));
export const inOutElasticAP = (amplitude = 1, period = 0.45) => inOutFrom(inElasticAP(amplitude, period));
export const outElastic = outElasticAP(), inElastic = inElasticAP(), inOutElastic = inOutElasticAP();

export const outBounce = (t) => {
  const n1 = 7.5625, d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) { t -= 1.5 / d1; return n1 * t * t + 0.75; }
  if (t < 2.5 / d1) { t -= 2.25 / d1; return n1 * t * t + 0.9375; }
  t -= 2.625 / d1; return n1 * t * t + 0.984375;
};
export const inBounce = outFrom(outBounce);
export const inOutBounce = inOutFrom(inBounce);

/** CSS cubic-bezier(x1, y1, x2, y2): same curve as the browser's, solved per call (no state). */
export function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (u) => ((ax * u + bx) * u + cx) * u;
  const sy = (u) => ((ay * u + by) * u + cy) * u;
  const dsx = (u) => (3 * ax * u + 2 * bx) * u + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let u = x;
    for (let i = 0; i < 8; i++) { // Newton
      const e = sx(u) - x;
      if (Math.abs(e) < 1e-7) return sy(u);
      const d = dsx(u);
      if (Math.abs(d) < 1e-6) break;
      u -= e / d;
    }
    let lo = 0, hi = 1; u = x; // bisection fallback
    for (let i = 0; i < 40; i++) {
      const v = sx(u);
      if (Math.abs(v - x) < 1e-7) break;
      if (v < x) lo = u; else hi = u;
      u = (lo + hi) / 2;
    }
    return sy(u);
  };
}

/** steps(n, 'end' | 'start'): CSS step timing. */
export const steps = (n, jump = 'end') => (t) => {
  if (t >= 1) return 1;
  if (t <= 0) return jump === 'start' ? 1 / n : 0;
  return jump === 'start' ? Math.min(1, Math.ceil(t * n) / n) : Math.floor(t * n) / n;
};

/**
 * Damped spring from 0 to 1 (closed form, no integration, so any t can be asked directly).
 * spring({stiffness, damping, mass, velocity}) returns f(seconds) -> position, with f.duration =
 * the time after which it stays within 0.1% of 1. springEase(opts) maps [0,1] over that duration.
 */
export function spring({ stiffness = 100, damping = 10, mass = 1, velocity = 0 } = {}) {
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  let y; // displacement from target as a function of time; y(0) = -1, y'(0) = velocity
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    const c2 = (velocity - zeta * w0) / wd;
    y = (t) => Math.exp(-zeta * w0 * t) * (-Math.cos(wd * t) + c2 * Math.sin(wd * t));
  } else if (zeta === 1) {
    const c2 = velocity - w0;
    y = (t) => (-1 + c2 * t) * Math.exp(-w0 * t);
  } else {
    const s = Math.sqrt(zeta * zeta - 1);
    const r1 = -w0 * (zeta - s), r2 = -w0 * (zeta + s);
    const c2 = (velocity + r1) / (r2 - r1), c1 = -1 - c2;
    y = (t) => c1 * Math.exp(r1 * t) + c2 * Math.exp(r2 * t);
  }
  const f = (t) => (t <= 0 ? 0 : 1 + y(t));
  let settle = 10; // search the settle time on a 1/120 s grid, up to 10 s
  for (let t = 10; t >= 0; t -= 1 / 120) { if (Math.abs(y(t)) > 0.001) { settle = Math.min(10, t + 1 / 120); break; } }
  f.duration = settle;
  return f;
}
export const springEase = (opts) => { const s = spring(opts); return (t) => (t >= 1 ? 1 : s(t * s.duration)); };

const EASES = {
  linear, inQuad, outQuad, inOutQuad, inCubic, outCubic, inOutCubic, inQuart, outQuart, inOutQuart,
  inQuint, outQuint, inOutQuint, inSine, outSine, inOutSine, inExpo, outExpo, inOutExpo, inCirc, outCirc,
  inOutCirc, inBack, outBack, inOutBack, inElastic, outElastic, inOutElastic, inBounce, outBounce, inOutBounce,
};
export const easeNames = Object.keys(EASES);
/**
 * getEase accepts a function, 'outCubic', 'easeOutCubic', 'out-cubic', 'cubic-bezier(.2,.8,.2,1)',
 * 'steps(4)', 'spring(100,10,1,0)' (stiffness, damping, mass, velocity), 'outBack(2.5)', 'outElastic(1,0.4)', 'hold'.
 */
export function getEase(e) {
  if (!e) return linear;
  if (typeof e === 'function') return e;
  let s = String(e).trim();
  if (s === 'hold') return (t) => (t >= 1 ? 1 : 0);
  const m = s.match(/^([a-zA-Z-]+)\s*\(([^)]*)\)$/);
  const args = m ? m[2].split(',').map((x) => parseFloat(x)) : [];
  if (m) s = m[1];
  if (s === 'cubic-bezier' || s === 'cubicBezier') return cubicBezier(...args);
  if (s === 'steps') return steps(args[0] || 1);
  if (s === 'spring') return springEase({ stiffness: args[0] ?? 100, damping: args[1] ?? 10, mass: args[2] ?? 1, velocity: args[3] ?? 0 });
  s = s.replace(/^ease/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  s = s.charAt(0).toLowerCase() + s.slice(1);
  if (m && args.length) {
    if (s === 'inBack') return inBackS(args[0]);
    if (s === 'outBack') return outBackS(args[0]);
    if (s === 'inOutBack') return inOutBackS(args[0]);
    if (s === 'outElastic') return outElasticAP(args[0], args[1]);
    if (s === 'inElastic') return inElasticAP(args[0], args[1]);
    if (s === 'inOutElastic') return inOutElasticAP(args[0], args[1]);
  }
  const fn = EASES[s];
  if (!fn) throw new Error('unknown ease: ' + e);
  return fn;
}

// ---------------------------------------------------------------- interpolation, tweens, tracks
/** Interpolate numbers, arrays of numbers, '#rrggbb' colours or plain objects of those. */
export function interp(a, b, t) {
  if (typeof a === 'number') return a + (b - a) * t;
  if (typeof a === 'string' && a[0] === '#') return mixColor(a, b, t);
  if (Array.isArray(a)) return a.map((v, i) => interp(v, b[i], t));
  if (a && typeof a === 'object') { const o = {}; for (const k in a) o[k] = interp(a[k], b[k], t); return o; }
  return t < 1 ? a : b; // strings, booleans: hold until the end
}
/** One tween: value at time t for a move from `from` to `to` starting at `start` lasting `dur`. */
export const tween = (t, start, dur, from, to, ease = linear) => interp(from, to, segment(t, start, dur, getEase(ease)));

/**
 * Keyframe track. keys = [[t, value], [t, value, ease], ...] or [{t, v, ease}], sorted by t.
 * The ease written on a key shapes the segment that ARRIVES at that key. Before the first key the
 * first value holds, after the last key the last value holds.
 */
export function track(keys) {
  const k = keys.map((x) => (Array.isArray(x) ? { t: x[0], v: x[1], ease: getEase(x[2]) } : { t: x.t, v: x.v, ease: getEase(x.ease) }));
  for (let i = 1; i < k.length; i++) if (k[i].t < k[i - 1].t) throw new Error('track keys must be sorted by time');
  const fn = (t) => {
    if (t <= k[0].t) return k[0].v;
    if (t >= k[k.length - 1].t) return k[k.length - 1].v;
    let lo = 0, hi = k.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (k[mid].t <= t) lo = mid; else hi = mid; }
    const a = k[lo], b = k[hi];
    return interp(a.v, b.v, b.ease(b.t === a.t ? 1 : (t - a.t) / (b.t - a.t)));
  };
  fn.keys = k;
  fn.start = k[0].t;
  fn.end = k[k.length - 1].t;
  return fn;
}
/** timeline({x: [[0,0],[1,100,'outExpo']], opacity: [...]}) -> t => ({x, opacity}) */
export function timeline(props) {
  const tracks = Object.fromEntries(Object.entries(props).map(([name, keys]) => [name, track(keys)]));
  const fn = (t) => { const o = {}; for (const n in tracks) o[n] = tracks[n](t); return o; };
  fn.tracks = tracks;
  return fn;
}

// ---------------------------------------------------------------- stagger
/**
 * anime.js-style stagger: delay for item i of n.
 * opts: each (seconds between items), start (offset), from ('first'|'last'|'center'|'edges'|index),
 * grid ([cols, rows]) with axis ('x'|'y'|undefined for radial distance), ease (shapes the spread
 * across the total range), reverse (bool).
 */
export function stagger(i, n, { each = 0.05, start = 0, from = 'first', grid = null, axis = null, ease = null, reverse = false } = {}) {
  let d, max;
  if (grid) {
    const [cols, rows] = grid;
    const x = i % cols, y = Math.floor(i / cols);
    let fx, fy;
    if (from === 'center') { fx = (cols - 1) / 2; fy = (rows - 1) / 2; }
    else if (from === 'last') { fx = cols - 1; fy = rows - 1; }
    else if (typeof from === 'number') { fx = from % cols; fy = Math.floor(from / cols); }
    else { fx = 0; fy = 0; }
    const dist = (px, py) => (axis === 'x' ? Math.abs(px - fx) : axis === 'y' ? Math.abs(py - fy) : Math.hypot(px - fx, py - fy));
    d = dist(x, y);
    max = Math.max(dist(0, 0), dist(cols - 1, 0), dist(0, rows - 1), dist(cols - 1, rows - 1));
  } else {
    const c = (n - 1) / 2;
    if (from === 'last') { d = n - 1 - i; max = n - 1; }
    else if (from === 'center') { d = Math.abs(i - c); max = c; }
    else if (from === 'edges') { d = c - Math.abs(i - c); max = c; }
    else if (typeof from === 'number') { d = Math.abs(i - from); max = Math.max(from, n - 1 - from); }
    else { d = i; max = n - 1; }
  }
  if (reverse) d = max - d;
  if (ease && max > 0) d = getEase(ease)(d / max) * max;
  return start + d * each;
}

// ---------------------------------------------------------------- random (seeded, stateless where possible)
/** Mulberry32: tiny seeded PRNG. Returns a function giving floats in [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Convenience wrapper: r.float(), r.range(a,b), r.int(a,b) inclusive, r.pick(arr), r.gauss(), r.shuffle(arr). */
export function rng(seed) {
  const next = mulberry32(seed);
  const r = {
    float: next,
    range: (a, b) => a + (b - a) * next(),
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    gauss: () => { let u = 0, v = 0; while (u === 0) u = next(); v = next(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); },
    shuffle: (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
  };
  return r;
}
/** Integer hash of any number of 32-bit ints (lowbias32 chain). Same inputs, same output, no state. */
export function hash32(...xs) {
  let h = 0x9e3779b9;
  for (const x0 of xs) {
    let x = (x0 | 0) ^ h;
    x ^= x >>> 16; x = Math.imul(x, 0x7feb352d);
    x ^= x >>> 15; x = Math.imul(x, 0x846ca68b);
    x ^= x >>> 16;
    h = x >>> 0;
  }
  return h >>> 0;
}
/** Stateless random float in [0, 1) for item i (and optional seed / extra ints). Use this inside renderFrame. */
export const rand = (i, seed = 0, k = 0) => hash32(i, seed, k) / 4294967296;
export const randRange = (i, a, b, seed = 0, k = 0) => a + (b - a) * rand(i, seed, k);

// ---------------------------------------------------------------- noise
const sstep = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lattice1 = (i, seed) => rand(i, seed) * 2 - 1;
const lattice2 = (i, j, seed) => rand(i, j, seed * 7919 + 1) * 2 - 1;
const lattice3 = (i, j, k, seed) => (hash32(i, j, k, seed) / 4294967296) * 2 - 1;
/** Value noise in [-1, 1], smooth (C2), seeded. */
export function valueNoise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  return lerp(lattice1(i, seed), lattice1(i + 1, seed), sstep(f));
}
export function valueNoise2(x, y, seed = 0) {
  const i = Math.floor(x), j = Math.floor(y), fx = sstep(x - i), fy = sstep(y - j);
  return lerp(lerp(lattice2(i, j, seed), lattice2(i + 1, j, seed), fx), lerp(lattice2(i, j + 1, seed), lattice2(i + 1, j + 1, seed), fx), fy);
}
export function valueNoise3(x, y, z, seed = 0) {
  const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z);
  const fx = sstep(x - i), fy = sstep(y - j), fz = sstep(z - k);
  const L = (a, b, c) => lattice3(i + a, j + b, k + c, seed);
  return lerp(
    lerp(lerp(L(0, 0, 0), L(1, 0, 0), fx), lerp(L(0, 1, 0), L(1, 1, 0), fx), fy),
    lerp(lerp(L(0, 0, 1), L(1, 0, 1), fx), lerp(L(0, 1, 1), L(1, 1, 1), fx), fy), fz);
}

// Simplex noise (Gustavson's public-domain algorithm), seeded permutation, range about [-1, 1].
const GRAD3 = [[1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1], [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]];
const permCache = new Map();
function perm(seed) {
  let p = permCache.get(seed);
  if (p) return p;
  const r = mulberry32(seed * 2654435761 + 1);
  const base = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [base[i], base[j]] = [base[j], base[i]]; }
  p = new Uint8Array(512);
  for (let i = 0; i < 512; i++) p[i] = base[i & 255];
  permCache.set(seed, p); // a cache of a pure function of seed: does not change results
  return p;
}
export function simplex2(xin, yin, seed = 0) {
  const p = perm(seed);
  const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  const s = (xin + yin) * F2, i = Math.floor(xin + s), j = Math.floor(yin + s);
  const t = (i + j) * G2, x0 = xin - (i - t), y0 = yin - (j - t);
  const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
  const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
  const ii = i & 255, jj = j & 255;
  const c = (x, y, g) => { let tt = 0.5 - x * x - y * y; if (tt < 0) return 0; tt *= tt; const gr = GRAD3[g % 12]; return tt * tt * (gr[0] * x + gr[1] * y); };
  return 70 * (c(x0, y0, p[ii + p[jj]]) + c(x1, y1, p[ii + i1 + p[jj + j1]]) + c(x2, y2, p[ii + 1 + p[jj + 1]]));
}
export function simplex3(xin, yin, zin, seed = 0) {
  const p = perm(seed);
  const F3 = 1 / 3, G3 = 1 / 6;
  const s = (xin + yin + zin) * F3;
  const i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s);
  const t = (i + j + k) * G3;
  const x0 = xin - (i - t), y0 = yin - (j - t), z0 = zin - (k - t);
  let i1, j1, k1, i2, j2, k2;
  if (x0 >= y0) {
    if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
    else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
  } else {
    if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
    else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
    else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
  }
  const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
  const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
  const x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;
  const ii = i & 255, jj = j & 255, kk = k & 255;
  const c = (x, y, z, g) => { let tt = 0.6 - x * x - y * y - z * z; if (tt < 0) return 0; tt *= tt; const gr = GRAD3[g % 12]; return tt * tt * (gr[0] * x + gr[1] * y + gr[2] * z); };
  return 32 * (c(x0, y0, z0, p[ii + p[jj + p[kk]]]) + c(x1, y1, z1, p[ii + i1 + p[jj + j1 + p[kk + k1]]]) +
    c(x2, y2, z2, p[ii + i2 + p[jj + j2 + p[kk + k2]]]) + c(x3, y3, z3, p[ii + 1 + p[jj + 1 + p[kk + 1]]]));
}
/** Fractal sum: fbm((x,y)=>simplex2(x,y,3), x, y, {octaves:5}) */
export function fbm(noise, x, y = 0, z = 0, { octaves = 5, lacunarity = 2, gain = 0.5 } = {}) {
  let sum = 0, amp = 1, freq = 1, norm = 0;
  for (let o = 0; o < octaves; o++) { sum += amp * noise(x * freq, y * freq, z * freq); norm += amp; amp *= gain; freq *= lacunarity; }
  return sum / norm;
}

// ---------------------------------------------------------------- music time
export const frameTime = (f, fps = 30) => f / fps;
/** The frame on screen at time t: floor, so an event at t is visible from the first frame at or after it is reached. */
export const timeFrame = (t, fps = 30) => Math.floor(t * fps + 1e-9);
/** Index of the last element of sorted `times` that is <= t, or -1. Binary search. */
export function lastIndex(times, t) {
  let lo = 0, hi = times.length - 1, ans = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (times[mid] <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
  return ans;
}
/** Where t sits in a beat grid: {i, t0, t1, phase} (i = -1 before the first beat; phase in [0,1)). */
export function beatAt(t, beats) {
  const i = lastIndex(beats, t);
  if (i < 0) { const t1 = beats[0] ?? Infinity; return { i: -1, t0: -Infinity, t1, phase: 0 }; }
  const t0 = beats[i];
  const t1 = i + 1 < beats.length ? beats[i + 1] : t0 + (i > 0 ? t0 - beats[i - 1] : 0.5);
  return { i, t0, t1, phase: clamp((t - t0) / (t1 - t0), 0, 0.999999) };
}
/**
 * Impulse envelope driven by event times (drum hits, onsets): 0..1. Each event rises over
 * `attack` seconds (ending at the event time) and decays exponentially with half-life `decay`.
 * The strongest of the last event and the next event (attack) wins. `weights` optional (same length).
 */
export function envelope(t, times, { attack = 0, decay = 0.12, weights = null } = {}) {
  const i = lastIndex(times, t);
  let v = 0;
  if (i >= 0) v = Math.pow(0.5, (t - times[i]) / decay) * (weights ? weights[i] : 1);
  if (attack > 0 && i + 1 < times.length) {
    const dt = times[i + 1] - t;
    if (dt < attack) v = Math.max(v, (1 - dt / attack) * (weights ? weights[i + 1] : 1));
  }
  return v;
}

// ---------------------------------------------------------------- colour
export function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgbToHex = (rgb) => '#' + rgb.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
const toLin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const toSrgb = (c) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
export function rgbToOklab([r, g, b]) {
  const R = toLin(r), G = toLin(g), B = toLin(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
export function oklabToRgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [toSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), toSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), toSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)];
}
/** Mix two '#rrggbb' colours. space: 'srgb' (default), 'linear' (light-correct) or 'oklab' (even perceptual steps). */
export function mixColor(a, b, t, space = 'srgb') {
  const A = hexToRgb(a), B = hexToRgb(b);
  if (space === 'linear') return rgbToHex(A.map((v, i) => toSrgb(lerp(toLin(v), toLin(B[i]), t))));
  if (space === 'oklab') { const la = rgbToOklab(A), lb = rgbToOklab(B); return rgbToHex(oklabToRgb(la.map((v, i) => lerp(v, lb[i], t)))); }
  return rgbToHex(A.map((v, i) => lerp(v, B[i], t)));
}
