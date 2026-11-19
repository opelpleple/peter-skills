// scene.js: the ONE scene every style performs, as data plus pure helpers.
//
// 6 s seamless loop:
//   0.0 - 1.2  a small round character enters from the left and hops (two hops,
//              the second lands it on the platform)
//   1.2 - 2.0  squash and settle after landing
//   2.0 - 3.4  the title "Seven Skills" appears (each style in its own way)
//   3.4 - 5.0  a small celebratory move (spin hop, then a little bounce), title holds
//   5.0 - 6.0  exit to the right, title fades, stage returns to frame 0
//
// Coordinates are normalised so styles stay resolution independent:
//   x  fraction of stage WIDTH  (0 left, 1 right)
//   y  fraction of stage HEIGHT (0 top, 1 bottom)
//   r  character radius as a fraction of stage HEIGHT
// pose(t).x/y is the character's CONTACT point (bottom centre). Its body centre is
// y - r * sy. At t = 0 and t = 6 the character is off screen and the title is gone,
// so frame 0 and the frame after 5.999 are identical (seamless loop).

export const DURATION = 6;
export const TITLE = 'Seven Skills';
export const TITLE_WORDS = ['Seven', 'Skills'];

export const BEATS = Object.freeze({
  enter: 0.0,
  hop1Land: 0.55,
  hop2Start: 0.6,
  land: 1.2, // lands on the platform
  settle: 2.0, // squash finished
  titleIn: 2.0,
  titleDone: 3.4,
  celebrate: 3.4,
  spinStart: 3.5,
  spinLand: 4.1,
  bounceStart: 4.25,
  bounceLand: 4.85,
  celebrateEnd: 5.0,
  exit: 5.0,
  exitHop1: 5.15,
  exitHop1Land: 5.6,
  exitHop2Land: 6.0,
  titleOut: 5.0,
  titleGone: 5.6,
  keyFrame: 4.2, // held frame for prefers-reduced-motion and thumbnails
});

export const LAYOUT = Object.freeze({
  groundY: 0.8, // floor contact line
  charR: 0.075, // body radius / stage height
  platform: Object.freeze({ x: 0.5, y: 0.66, w: 0.24, h: 0.05 }), // x centre, y top, w width (of W), h thickness (of H)
  titleY: 0.3, // title baseline area centre
  titleSize: 0.13, // suggested cap height / stage height
  startX: -0.12,
  hop1X: 0.22,
  exitX1: 0.8,
  endX: 1.14,
});

// ---- math -------------------------------------------------------------
export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, u) => a + (b - a) * u;
export const prog = (t, a, b) => clamp((t - a) / (b - a)); // 0..1 progress of t across [a, b]
export const within = (t, a, b) => t >= a && t < b;
export const smoothstep = (a, b, v) => {
  const u = clamp((v - a) / (b - a));
  return u * u * (3 - 2 * u);
};

export const ease = Object.freeze({
  linear: (u) => u,
  inQuad: (u) => u * u,
  outQuad: (u) => 1 - (1 - u) * (1 - u),
  inOutQuad: (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2),
  inCubic: (u) => u * u * u,
  outCubic: (u) => 1 - Math.pow(1 - u, 3),
  inOutCubic: (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
  inOutSine: (u) => -(Math.cos(Math.PI * u) - 1) / 2,
  outBack: (u, s = 1.70158) => 1 + (s + 1) * Math.pow(u - 1, 3) + s * Math.pow(u - 1, 2),
  outElastic: (u) =>
    u === 0 || u === 1 ? u : Math.pow(2, -10 * u) * Math.sin((u * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
  outBounce: (u) => {
    const n = 7.5625, d = 2.75;
    if (u < 1 / d) return n * u * u;
    if (u < 2 / d) return n * (u -= 1.5 / d) * u + 0.75;
    if (u < 2.5 / d) return n * (u -= 2.25 / d) * u + 0.9375;
    return n * (u -= 2.625 / d) * u + 0.984375;
  },
});

// Seeded PRNG (mulberry32) so "random" detail is identical every frame.
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Stateless hash noise in [0,1): same (i, seed) always gives the same value.
export function hash(i, seed = 0) {
  let x = Math.imul((i | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(seed | 0, 0xc2b2ae35);
  x ^= x >>> 13;
  x = Math.imul(x, 0x27d4eb2d);
  x ^= x >>> 15;
  return (x >>> 0) / 4294967296;
}

// Parabolic hop from p0 to p1 (contact points) with apex height h (fraction of H).
export function hopArc(u, p0, p1, h) {
  const k = clamp(u);
  return { x: lerp(p0.x, p1.x, k), y: lerp(p0.y, p1.y, k) - h * 4 * k * (1 - k) };
}

// Hop segments: [t0, t1, from, to, apex]
const P = LAYOUT.platform;
const G = LAYOUT.groundY;
const HOPS = [
  { t0: BEATS.enter, t1: BEATS.hop1Land, a: { x: LAYOUT.startX, y: G }, b: { x: LAYOUT.hop1X, y: G }, h: 0.16 },
  { t0: BEATS.hop2Start, t1: BEATS.land, a: { x: LAYOUT.hop1X, y: G }, b: { x: P.x, y: P.y }, h: 0.3 },
  { t0: BEATS.spinStart, t1: BEATS.spinLand, a: { x: P.x, y: P.y }, b: { x: P.x, y: P.y }, h: 0.2, spin: 1 },
  { t0: BEATS.bounceStart, t1: BEATS.bounceLand, a: { x: P.x, y: P.y }, b: { x: P.x, y: P.y }, h: 0.09 },
  { t0: BEATS.exitHop1, t1: BEATS.exitHop1Land, a: { x: P.x, y: P.y }, b: { x: LAYOUT.exitX1, y: G }, h: 0.18 },
  { t0: BEATS.exitHop1Land, t1: BEATS.exitHop2Land, a: { x: LAYOUT.exitX1, y: G }, b: { x: LAYOUT.endX, y: G }, h: 0.14 },
];
export const HOP_SEGMENTS = HOPS;

// Impacts drive squash: [time, strength]. Positive = squash (wide, short).
const IMPACTS = [
  [BEATS.hop1Land, 0.18],
  [BEATS.land, 0.34],
  [BEATS.spinLand, 0.24],
  [BEATS.bounceLand, 0.14],
  [BEATS.exitHop1Land, 0.16],
];
// Anticipation crouches before take-offs: [takeoff time, strength, lead seconds]
const CROUCHES = [
  [BEATS.hop2Start, 0.12, 0.05],
  [BEATS.spinStart, 0.16, 0.1],
  [BEATS.bounceStart, 0.1, 0.1],
  [BEATS.exitHop1, 0.18, 0.15],
];

// Signed squash amount at time t: >0 squashed, <0 stretched. Use sx = 1 + s, sy = 1 - s.
export function squashAt(t) {
  let s = 0;
  for (const [ti, a] of IMPACTS) {
    const d = t - ti;
    if (d >= 0 && d < 0.9) s += a * Math.exp(-6.5 * d) * Math.cos(d * 22);
  }
  for (const [ti, a, lead] of CROUCHES) {
    const d = ti - t;
    if (d >= 0 && d < lead) s += a * Math.sin((1 - d / lead) * Math.PI * 0.5);
  }
  // Stretch while airborne fast (up or down).
  const hop = HOPS.find((hp) => t >= hp.t0 && t < hp.t1);
  if (hop) {
    const u = (t - hop.t0) / (hop.t1 - hop.t0);
    s -= 0.1 * Math.abs(1 - 2 * u) * Math.min(1, hop.h / 0.18);
  }
  return clamp(s, -0.3, 0.45);
}

// Phase name at t (handy for style specific flourishes).
export function phaseAt(t) {
  if (t < BEATS.land) return 'enter';
  if (t < BEATS.settle) return 'land';
  if (t < BEATS.titleDone) return 'title';
  if (t < BEATS.celebrateEnd) return 'celebrate';
  return 'exit';
}

// Full character pose at t.
export function pose(t) {
  let x = LAYOUT.startX, y = G, air = 0, rot = 0, onPlatform = false, airborne = false;
  const hop = HOPS.find((hp) => t >= hp.t0 && t < hp.t1);
  if (hop) {
    const u = (t - hop.t0) / (hop.t1 - hop.t0);
    const p = hopArc(u, hop.a, hop.b, hop.h);
    x = p.x; y = p.y; airborne = true;
    air = hop.h * 4 * u * (1 - u);
    if (hop.spin) rot = ease.inOutCubic(u) * Math.PI * 2 * hop.spin;
    else rot = (hop.b.x - hop.a.x) * 0.9 * Math.sin(u * Math.PI); // slight lean into travel
  } else if (t < HOPS[0].t0) {
    x = LAYOUT.startX;
  } else if (t >= BEATS.land && t < BEATS.exitHop1) {
    x = P.x; y = P.y; onPlatform = true;
  } else if (t >= BEATS.hop1Land && t < BEATS.hop2Start) {
    x = LAYOUT.hop1X; y = G;
  } else if (t >= BEATS.exitHop2Land) {
    x = LAYOUT.endX; y = G;
  }
  const s = squashAt(t);
  const facing = t >= BEATS.exit ? 1 : 1; // always faces travel direction (right)
  return {
    x, y, r: LAYOUT.charR,
    sx: 1 + s, sy: 1 - s, squash: s,
    rot, air, airborne, onPlatform, facing,
    visible: x > -0.2 && x < 1.2,
    phase: phaseAt(t),
  };
}

// Converts a pose to pixels for a W x H stage. Returns body centre and radii.
export function toPx(p, W, H) {
  const r = p.r * H;
  return {
    x: p.x * W,
    y: p.y * H, // contact point
    cx: p.x * W,
    cy: p.y * H - r * p.sy, // body centre
    rx: r * p.sx,
    ry: r * p.sy,
    r,
  };
}

// Title envelope. inP 0..1 across the reveal, hold while held, outP 0..1 across the fade,
// alpha = overall visibility. Styles choose HOW it appears; these numbers say WHEN.
export function titleState(t) {
  const inP = prog(t, BEATS.titleIn, BEATS.titleDone);
  const outP = prog(t, BEATS.titleOut, BEATS.titleGone);
  return {
    inP,
    outP,
    alpha: clamp(Math.min(inP * 4, 1) * (1 - outP)),
    held: t >= BEATS.titleDone && t < BEATS.titleOut,
    visible: t >= BEATS.titleIn && t < BEATS.titleGone,
  };
}

// Staggered per-unit reveal inside the title window: unit i of n gets its own 0..1.
// spread (0..1) is how much of the window the stagger occupies.
export function letterReveal(t, i, n, { spread = 0.6, a = BEATS.titleIn, b = BEATS.titleDone } = {}) {
  const win = b - a;
  const each = win * (1 - spread);
  const start = a + (n > 1 ? (i / (n - 1)) * win * spread : 0);
  return prog(t, start, start + each);
}

// Face signals: blink 0 open .. 1 shut, smile 0 neutral .. 1 grin, look -1..1 horizontal.
export function face(t) {
  const blinkAt = [1.75, 3.0, 4.6];
  let blink = 0;
  for (const b of blinkAt) {
    const d = Math.abs(t - b);
    if (d < 0.08) blink = Math.max(blink, 1 - d / 0.08);
  }
  const smile = clamp(smoothstep(2.6, 3.4, t) - smoothstep(5.0, 5.6, t)) * 0.7 +
    (t >= BEATS.celebrate && t < BEATS.celebrateEnd ? 0.3 : 0);
  // Looks up at the title while it builds, then back to camera.
  const look = t < BEATS.titleIn ? 0.6 : t < BEATS.titleDone ? 0.6 - 0.6 * prog(t, 2.0, 3.0) : 0.4 * prog(t, 5.0, 5.2);
  const lookUp = clamp(smoothstep(2.0, 2.4, t) - smoothstep(3.2, 3.6, t));
  return { blink, smile: clamp(smile), look, lookUp };
}

// A short pulse (0..1) right after each impact, for flashes, dust or confetti.
export function impactPulse(t, width = 0.25) {
  let v = 0;
  for (const [ti, a] of IMPACTS) {
    const d = t - ti;
    if (d >= 0 && d < width) v = Math.max(v, (1 - d / width) * clamp(a / 0.34));
  }
  return v;
}
export const IMPACT_TIMES = IMPACTS.map((i) => i[0]);

// Celebration burst progress (0..1) starting at the spin landing, for confetti/sparks.
export function celebrateBurst(t) {
  return prog(t, BEATS.spinLand, BEATS.celebrateEnd);
}
