// The film's motion vocabulary. Every helper is a pure function of time, so a scene's update(t) can be
// called for any t in any order. Times are in seconds; use fr(n) for a number of frames.
//
// House rules (docs/engine.md):
//   text never fades in: it streaks in with motion blur (the renderer adds the blur, we only move fast)
//   objects pop: scale 0.2 to 1 in about 8 frames with one small overshoot
//   sentence lines stack from the bottom line up, 4 frames apart
//   exits are fast streaks to the left or up, or a short tint and fade into the field colour
import * as M from '/tools/lib/motion.js';
import { FR } from './theme.js';

export { M };
export const fr = (n) => n * FR;
export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Eased progress 0..1 of a move that starts at t0 and lasts dur. */
export const prog = (t, t0, dur, ease = M.linear) => M.segment(t, t0, dur, ease);

/** Pop in: 0 before t0, then from `from` to 1 with one overshoot. Use the value as a uniform scale. */
export function pop(t, t0, { dur = fr(9), over = 1.7, from = 0.2 } = {}) {
  if (t < t0) return 0;
  return from + (1 - from) * M.segment(t, t0, dur, M.outBackS(over));
}
/** Pop out: 1 before t1, shrinks to 0 by t1 + dur. */
export function popOut(t, t1, { dur = fr(6) } = {}) {
  if (t < t1) return 1;
  return 1 - M.segment(t, t1, dur, M.inBackS(1.4));
}
/** Pop in then out as one scale value. */
export const popInOut = (t, t0, t1, a = {}, b = {}) => (t < t1 ? pop(t, t0, a) : popOut(t, t1, b));

/**
 * Streak an object to its rest position and, optionally, away again. Sets obj.position.x/y and obj.visible.
 *   rest  [x, y]
 *   a     { t0, from: [dx, dy], dur = 5 frames, ease = outQuint }   arrival (omit for "already there")
 *   b     { t1, to: [dx, dy], dur = 5 frames, ease = inQuart }      departure (omit to stay)
 * A typical line arrival is from [0, 190] (falls from above) or from [-1400, 0] (shoots in from the left).
 */
export function streak(obj, t, rest, a, b) {
  let x = rest[0], y = rest[1], vis = true;
  if (a) {
    if (t < a.t0) vis = false;
    else { const k = 1 - M.segment(t, a.t0, a.dur ?? fr(5), a.ease ?? M.outQuint); x += a.from[0] * k; y += a.from[1] * k; }
  }
  if (b && t >= b.t1) {
    const d = b.dur ?? fr(5), k = M.segment(t, b.t1, d, b.ease ?? M.inQuart);
    x += b.to[0] * k; y += b.to[1] * k;
    if (t >= b.t1 + d) vis = false;
  }
  obj.position.x = x; obj.position.y = y; obj.visible = vis;
  return vis;
}

/**
 * Stack the lines of a makeBlock() result: each line falls into place, the bottom line first.
 *   t0 = when the first line starts; each = delay between lines; fall = how far above it starts.
 * Returns the time the last line has landed.
 */
export function dropLines(block, t, t0, { each = fr(4), fall = 190, dur = fr(5), bottomUp = true, ease = M.outQuint } = {}) {
  const n = block.lines.length;
  block.lines.forEach((ln, i) => {
    const j = bottomUp ? n - 1 - i : i, s = t0 + j * each;
    ln.group.visible = t >= s;
    ln.group.position.y = ln.y + fall * (1 - M.segment(t, s, dur, ease));
  });
  return t0 + (n - 1) * each + dur;
}

/** A bump of scale that runs through the letters of a line once (left to right). Call every update. */
export function wave(line, t, t0, { speed = 26, amp = 0.16, width = 1.6 } = {}) {
  const c = (t - t0) * speed - 2;
  for (const g of line.glyphs) {
    const d = (g.i - c) / width;
    g.pivot.scale.setScalar(t < t0 ? 1 : 1 + amp * Math.exp(-d * d));
  }
}

/** A highlight colour that runs through the letters of a line once. base and hot are hex strings. */
export function shine(line, t, t0, base, hot, { speed = 24, width = 2.2, hiBase = null } = {}) {
  const c = (t - t0) * speed - 3;
  for (const g of line.glyphs) {
    const d = (g.i - c) / width, k = t < t0 ? 0 : Math.exp(-d * d);
    g.mat.uniforms.color.value.set(M.mixColor(g.hi && hiBase ? hiBase : base, hot, k));
  }
}

/** Slow idle drift for cards and tiles: returns { x, y, r } in px and radians, different for every seed. */
export function drift(t, seed = 0, amp = 6, rot = 0.006) {
  const a = seed * 12.9898, b = seed * 78.233;
  return {
    x: amp * (Math.sin(t * 0.9 + a) * 0.6 + Math.sin(t * 0.53 + b) * 0.4),
    y: amp * (Math.cos(t * 0.8 + b) * 0.6 + Math.sin(t * 0.47 + a * 1.7) * 0.4),
    r: rot * Math.sin(t * 0.6 + a + b),
  };
}

/** Fade helper: 1 before t1, 0 after t1 + dur. */
export const fadeOut = (t, t1, dur = fr(6), ease = M.inOutQuad) => 1 - M.segment(t, t1, dur, ease);
export const fadeIn = (t, t0, dur = fr(6), ease = M.inOutQuad) => M.segment(t, t0, dur, ease);
