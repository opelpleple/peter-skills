// Product layer of the engine: UI cards (your own HTML components captured to transparent PNG with named
// anchors, see tools/ui/capture.sh), a cursor with click rings, word by word blur ins, typing with a caret,
// counters, soft lens glows and glass pills. Everything is built in build(); the update helpers are pure
// functions of t (the counter redraws its small canvas only when the shown value changes, and what it
// shows is a function of t alone).
import * as THREE from 'three';
import { FLAT, MAX_ANISO } from './core.js';
import * as K from './kit.js';
import { makeText, rasterText, measure } from './type.js';
import { M, fr, clamp01 } from './moves.js';
import { C } from './theme.js';

const quadVert = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const PREMULT = { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor };
const hex = (c) => '#' + new THREE.Color(c).getHexString();

// ---------------------------------------------------------------- UI cards
let MAN = null;
const texCache = new Map();
/** The manifest of film/assets/ui (sizes, pads, anchors). Loaded once. */
export async function uiManifest(base = './assets/ui/') {
  if (!MAN) {
    // no captured components yet (tools/ui/capture.sh writes the manifest): an empty kit, not an error
    const r = await fetch(base + 'manifest.json').catch(() => null);
    MAN = r && r.ok ? await r.json() : {};
  }
  return MAN;
}
async function uiTexture(file, base) {
  if (!texCache.has(file)) {
    texCache.set(file, K.loadImage(base + file).then((img) => {
      const tex = new THREE.Texture(img);
      tex.premultiplyAlpha = true; tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.anisotropy = MAX_ANISO;
      tex.needsUpdate = true;
      return tex;
    }));
  }
  return texCache.get(file);
}

/**
 * A UI component from ui/components.html as a textured plane, 1 CSS px = `scale` design px.
 * The group's origin is the centre of the component's own box (the PNG's transparent margin `pad` lies outside).
 *   opts.scale   default 1
 *   opts.shadow  extra lift shadow under the box: true or { blur, alpha, dy, r } (the PNG already has its own
 *                soft CSS shadow; use this when the card floats high above the page)
 * Returns { group, mesh, shadow, w, h, pad, scale, anchors, a(name), pt(x, y), clip(x0, y0, x1, y1), reveal(f0, f1),
 *           setOpacity(a), material }.
 *   a('copy-btn')  -> { x, y, w, h } centre and size of that anchor in group space (design px, y up)
 *   pt(x, y)       -> { x, y } for a point given in component CSS px (top left origin, y down)
 *   clip(...)      shows only that rectangle of the component (component CSS px); clip() with no args resets
 *   reveal(f0, f1) shows only the horizontal band f0..f1 (fractions of the box width), for wipes and line draws
 */
export async function uiCard(name, { scale = 1, shadow = false, base = './assets/ui/' } = {}) {
  const man = await uiManifest(base);
  const m = man[name];
  if (!m) throw new Error(`ui component ${name} not in ${base}manifest.json: add it to ui/components.html and run tools/ui/capture.sh`);
  const tex = await uiTexture(m.file, base);
  const PW = m.w + 2 * m.pad, PH = m.h + 2 * m.pad;
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, opacity: { value: 1 }, tint: { value: new THREE.Color('#ffffff') }, tintAmt: { value: 0 }, clip: { value: new THREE.Vector4(0, 1, 0, 1) } },
    vertexShader: quadVert,
    fragmentShader: `uniform sampler2D map; uniform float opacity, tintAmt; uniform vec3 tint; uniform vec4 clip; varying vec2 vUv;
      void main() {
        if (vUv.x < clip.x || vUv.x > clip.y || vUv.y < clip.z || vUv.y > clip.w) discard;
        vec4 c = texture2D(map, vUv); c.rgb = mix(c.rgb, tint * c.a, tintAmt); gl_FragColor = c * opacity; }`,
    ...FLAT, ...PREMULT,
  });
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(PW * scale, PH * scale), mat);
  mesh.userData.sub = 1;
  let sh = null;
  if (shadow) {
    const o = shadow === true ? {} : shadow;
    sh = K.shadow(m.w * scale, m.h * scale, (o.r ?? 20) * scale, { blur: o.blur ?? 40, alpha: o.alpha ?? 0.22, color: o.color ?? '20,22,40' });
    sh.position.set(0, -(o.dy ?? 26) * scale, 0); sh.userData.sub = 0;
    group.add(sh);
  }
  group.add(mesh);
  const toU = (x) => (m.pad + x) / PW, toV = (y) => 1 - (m.pad + y) / PH;
  const api = {
    level: 0, group, mesh, shadow: sh, material: mat, w: m.w * scale, h: m.h * scale, pad: m.pad * scale, scale, anchors: m.anchors, name,
    pt: (x, y) => ({ x: (x - m.w / 2) * scale, y: (m.h / 2 - y) * scale }),
    a(n) {
      const q = m.anchors[n];
      if (!q) throw new Error(`no anchor ${n} in ${name}`);
      return { x: (q.cx - m.w / 2) * scale, y: (m.h / 2 - q.cy) * scale, w: q.w * scale, h: q.h * scale, font: q.font ? { ...q.font, size: q.font.size * scale } : null };
    },
    clip(x0, y0, x1, y1) {
      if (x0 === undefined) mat.uniforms.clip.value.set(0, 1, 0, 1);
      else mat.uniforms.clip.value.set(toU(x0), toU(x1), toV(y1), toV(y0));
    },
    reveal(f0, f1) { mat.uniforms.clip.value.set(f0 <= 0 ? 0 : toU(f0 * m.w), f1 >= 1 ? 1 : toU(f1 * m.w), 0, 1); },
    setOpacity(a) { mat.uniforms.opacity.value = a; if (sh) sh.material.uniforms.opacity.value = a; },
  };
  return api;
}

/**
 * Put a ui card inside another one: at = an anchor name of the parent (its top left meets the child's top left,
 * or the centres meet with align 'center') or [x, y] in the parent's CSS px. The child is added to the parent's
 * group and drawn above it (its sub layers are raised), so layer(parent.group, n) orders both.
 *   placeIn(frame, body, 'content'); placeIn(body, method, 'method-slot');
 */
export function placeIn(parent, child, at, { z = 0.5, align = 'tl' } = {}) {
  let x, y;
  if (typeof at === 'string') {
    const q = parent.anchors[at];
    if (!q) throw new Error(`no anchor ${at} in ${parent.name}`);
    [x, y] = align === 'center' ? [q.cx, q.cy] : [q.x, q.y];
  } else [x, y] = at;
  const p = parent.pt(x, y);
  child.level = parent.level + 1;
  child.mesh.userData.sub = 1 + 2 * child.level;
  if (child.shadow) child.shadow.userData.sub = 2 * child.level;
  child.group.position.set(align === 'center' ? p.x : p.x + child.w / 2, align === 'center' ? p.y : p.y - child.h / 2, z);
  parent.group.add(child.group);
  return child;
}

/**
 * Where text goes in an empty text slot of a card (data-slot in ui/components.html): left edge x, baseline y
 * (group space of the card, design px), and the slot's font (size scaled, weight, colour).
 *   const s = slot(body, 'invites'); const n = counter({ size: s.size, weight: s.weight, color: s.color });
 *   n.group.position.set(s.x, s.y, 1); body.group.add(n.group);
 */
export function slot(card, name) {
  const q = card.anchors[name];
  if (!q || !q.font) throw new Error(`no text slot ${name} in ${card.name}`);
  const f = q.font, lh = f.lineHeight || f.size * 1.4;
  const top = q.y + (lh - f.size * 1.4) / 2 + f.size * 1.05;
  const p = card.pt(q.x, Math.min(top, q.y + q.h));
  const rgb = f.color.match(/[\d.]+/g).slice(0, 3).map(Number);
  return { x: p.x, y: p.y, size: f.size * card.scale, weight: f.weight, color: '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join(''), w: q.w * card.scale };
}

/** Set userData.sub (draw order inside a layer) on an object and all its children. */
export function raise(obj, sub) { obj.traverse((o) => { o.userData.sub = sub; }); return obj; }
/**
 * Put a counter, typeLine or text group into a card's text slot: positioned at the slot's left edge and
 * baseline, added to the card's group and drawn above it.  fillSlot(body, 'invites', counter({...slot(body, 'invites')}))
 */
export function fillSlot(card, name, obj, { z = 0.6, dx = 0, dy = 0 } = {}) {
  const s = slot(card, name);
  const g = obj.group || obj;
  g.position.set(s.x + dx, s.y + dy, z);
  raise(g, 2 * card.level + 3);
  card.group.add(g);
  return obj;
}

// ---------------------------------------------------------------- cursor
/**
 * The white arrow cursor with its click ring. The group origin is the arrow tip.
 *   const cur = await cursor({ scale: 1.2, ring: C.accent });  root.add(cur.group);
 *   update:  cur.update(t, { path: [[11.0, 700, -300], [11.875, 160, -40, M.inOutCubic]], clicks: [12.0], show: 10.75, hide: 14.0 });
 * path keys are [time, x, y, ease?]: before the first key the cursor waits at the first point, between keys it
 * travels on a slight arc (opts.arc, default 0.1 of the distance) with the key's ease (default inOutCubic).
 * A click at tc presses the arrow (scale 0.84) in 3 frames, releases in 8 and sends a ring out over 14 frames.
 * show/hide pop the cursor in and out. Returns the tip position { x, y }.
 * The arrow is drawn here (white with an ink rim and a soft drop shadow). To use your own captured arrow, give
 * opts.ui = the name of a ui component whose anchor 'tip' is the arrow path (its top left is the tip).
 */
export async function cursor({ scale = 1, ring = C.accent, arc = 0.1, ui = null, fill = '#FFFFFF', rim = C.ink } = {}) {
  const arrow = new THREE.Group();
  if (ui) {
    const card = await uiCard(ui, { scale });
    const tip = card.a('tip');                      // centre of the arrow path's box; the tip is its top left
    card.group.position.set(-(tip.x - tip.w / 2), -(tip.y + tip.h / 2), 0);
    arrow.add(card.group);
  } else {
    // arrow path in a 46 x 56 box, tip at (6, 4); drawn on a padded sprite so the shadow is not cut
    const P = 'M6 4 L6 44 L16 34.5 L23 50 L30.5 46.8 L23.6 31.6 L37 31.6 Z', pad = 16, w = (46 + 2 * pad) * scale, h = (56 + 2 * pad) * scale;
    const m = K.sprite(w, h, (g) => {
      g.scale(scale, scale); g.translate(pad, pad);
      const path = new Path2D(P);
      g.save(); g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 8; g.shadowOffsetY = 4; g.fillStyle = fill; g.fill(path); g.restore();
      g.lineJoin = 'round'; g.lineWidth = 2.6; g.strokeStyle = rim; g.stroke(path);
    }, { os: 3 });
    m.position.set(w / 2 - (pad + 6) * scale, -(h / 2 - (pad + 4) * scale), 0);
    m.userData.sub = 1;
    arrow.add(m);
  }
  const ringMesh = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 64), K.flat(ring));
  ringMesh.userData.sub = 0;
  const dot = K.circle(1, ring); dot.userData.sub = 0;
  const group = new THREE.Group();
  group.add(ringMesh, dot, arrow);
  const at = (t, path) => {
    if (!path || !path.length) return { x: 0, y: 0 };
    if (t <= path[0][0]) return { x: path[0][1], y: path[0][2] };
    for (let i = 1; i < path.length; i++) {
      const [t1, x1, y1, ease] = path[i];
      if (t < t1) {
        const [t0, x0, y0] = path[i - 1];
        const k = (ease || M.inOutCubic)(clamp01((t - t0) / (t1 - t0)));
        const dx = x1 - x0, dy = y1 - y0, b = Math.sin(Math.PI * k) * arc;
        return { x: x0 + dx * k - dy * b, y: y0 + dy * k + dx * b };
      }
    }
    const l = path[path.length - 1];
    return { x: l[1], y: l[2] };
  };
  return {
    group, arrow, ring: ringMesh,
    pos: at,
    update(t, { path, clicks = [], show = -Infinity, hide = Infinity } = {}) {
      const p = at(t, path);
      group.position.x = p.x; group.position.y = p.y;
      let s = t < show ? 0 : M.segment(t, show, fr(8), M.outBackS(1.6));
      if (t >= hide) s *= 1 - M.segment(t, hide, fr(6), M.inBackS(1.4));
      let press = 1, rr = 0, ra = 0;
      for (const tc of clicks) {
        if (t >= tc - fr(3) && t < tc + fr(10)) press = Math.min(press, t < tc ? 1 - 0.16 * M.segment(t, tc - fr(3), fr(3), M.outQuad) : 0.84 + 0.16 * M.segment(t, tc, fr(8), M.outBackS(2)));
        if (t >= tc && t < tc + fr(14)) { const k = M.segment(t, tc, fr(14), M.outCubic); rr = (10 + 40 * k) * scale; ra = 0.85 * (1 - k); }
      }
      arrow.scale.setScalar(Math.max(1e-4, s * press));
      group.visible = s > 0.001;
      ringMesh.visible = ra > 0.003; ringMesh.scale.setScalar(Math.max(1e-3, rr)); ringMesh.material.opacity = ra;
      const dk = ra > 0 ? ra : 0; dot.visible = dk > 0.003; dot.scale.setScalar(Math.max(1e-3, rr * 0.35)); dot.material.opacity = dk * 0.35;
      return p;
    },
  };
}

// ---------------------------------------------------------------- blur in, word by word
/** Split a marked up string into words that keep their asterisk markup. */
function markedWords(str) {
  const words = []; let cur = [], hi = false;
  const flush = () => {
    if (!cur.length) return;
    let s = '', on = false;
    for (const [ch, h] of cur) { if (h !== on) { s += '*'; on = h; } s += ch; }
    if (on) s += '*';
    words.push(s); cur = [];
  };
  for (const ch of str) {
    if (ch === '*') { hi = !hi; continue; }
    if (ch === ' ') { flush(); continue; }
    cur.push([ch, hi]);
  }
  flush();
  return words;
}
/**
 * A line of text that can blur in word by word. Same options as makeText (size, weight, color, hiColor, align,
 * tracking, os) plus maxBlur (px at the start, default 0.24 x size) and levels (blurred copies, default 3).
 * Blurred copies of every word are rasterised here once; the sharp state is the normal glyph line.
 * Returns { group, line, words: [{ glyphs, cx, cy, levels: [mesh] }], width, size, cap }.
 */
export function blurText(str, o = {}) {
  const line = makeText(str, { os: 3, ...o });
  const size = line.size, maxBlur = o.maxBlur ?? size * 0.24, nLev = o.levels ?? 3;
  const group = new THREE.Group();
  group.add(line.group);
  const tokens = markedWords(str);
  const fill = hex(o.color ?? '#1c1c2e'), hiFill = hex(o.hiColor ?? o.color ?? '#1c1c2e');
  const words = tokens.map((tok, wi) => {
    const glyphs = line.glyphs.filter((g) => g.word === wi);
    const x0 = Math.min(...glyphs.map((g) => g.x)), x1 = Math.max(...glyphs.map((g) => g.x + g.adv));
    const cx = (x0 + x1) / 2, cy = line.cap / 2;
    const pivot = new THREE.Group(); pivot.position.set(cx, cy, 0); group.add(pivot);
    const pad = Math.ceil(maxBlur * 2.6) + 4;
    const r = rasterText(tok, { ...o, os: 2, padX: pad, padY: pad, fill, hiFill });
    const levels = [];
    for (let k = 1; k <= nLev; k++) {
      const b = (maxBlur * k) / nLev;
      const can = document.createElement('canvas'); can.width = r.canvas.width; can.height = r.canvas.height;
      const g = can.getContext('2d'); g.filter = `blur(${(b * r.os).toFixed(2)}px)`; g.drawImage(r.canvas, 0, 0);
      const mesh = K.spriteFrom(can, r.width, r.height);
      // text starts at x = pad in the raster, baseline at r.baseline from its top; the line's baseline is y = 0
      mesh.position.set(x0 - pad + r.width / 2 - cx, r.baseline - r.height / 2 - cy, 0);
      mesh.visible = false; pivot.add(mesh); levels.push(mesh);
    }
    return { glyphs, cx, cy, pivot, levels };
  });
  return { group, line, words, width: line.width, size, cap: line.cap, str };
}
/**
 * Blur a blurText in: word j starts at t0 + j * perWord and goes from blurred, slightly larger and transparent
 * to sharp in `dur`. opts.out = t1 blurs it back out (same timing, reversed order unless outOrder 'same').
 * Words before their start are hidden. Returns the time the last word is sharp.
 *   blurIn(head, t, 10.25, { perWord: fr(4) })
 */
export function blurIn(bt, t, t0, { perWord = fr(4), dur = fr(12), scale = 0.14, rise = 0, out = null, outDur = fr(8), ease = M.outCubic } = {}) {
  const n = bt.words.length;
  bt.words.forEach((w, j) => {
    let p = M.segment(t, t0 + j * perWord, dur, ease);
    if (t < t0 + j * perWord) p = -1;
    if (out !== null && t >= out) { const q = M.segment(t, out + j * fr(2), outDur, M.inCubic); p = Math.min(p, 1 - q); if (q >= 1) p = -1; }
    const on = p >= 0;
    const b = on ? 1 - p : 1;                                 // blur amount 0 (sharp) .. 1 (most blurred)
    const a = on ? M.smoothstep(0, 0.45, p) : 0;              // overall presence
    const s = 1 + scale * b;
    // sharp glyphs: scale about the word centre
    const wSharp = b < 1 / w.levels.length ? 1 - b * w.levels.length : 0;
    for (const g of w.glyphs) {
      g.pivot.position.set(w.cx + (g.home.x - w.cx) * s, g.home.y + rise * b, 0);
      g.pivot.scale.setScalar(s);
      g.mat.uniforms.opacity.value = a * wSharp;
      g.pivot.visible = on && wSharp > 0.002;
    }
    // blurred copies: crossfade the two levels around b
    const f = b * w.levels.length;                            // 0..L, level k (1-based) sits at f = k
    w.pivot.scale.setScalar(s); w.pivot.position.y = w.cy + rise * b;
    w.levels.forEach((m, k) => {
      const wk = Math.max(0, 1 - Math.abs(f - (k + 1)));
      m.visible = on && wk > 0.002;
      m.material.uniforms.opacity.value = a * wk;
    });
  });
  return t0 + (n - 1) * perWord + dur;
}

/** The start of the output frame that t falls in (sub frame times collapse to it): for things that change in
 *  steps (typed characters, counter digits, blinking) and must not smear across the shutter. */
export const frameTime = (t) => Math.floor(t * 30 + 1e-6) / 30;

// ---------------------------------------------------------------- typing with a caret
/**
 * One line to type. Options as makeText plus caretColor (default: color), caretWidth (px, default
 * max(3, 0.065 x size)) and caretHeight (px, default 0.98 x size). Returns { group, line, caret, chars, xs, str, n }.
 */
export function typeLine(str, o = {}) {
  const line = makeText(str, o);
  const plain = str.replace(/\*/g, '');
  const group = new THREE.Group(); group.add(line.group);
  // map each character of the plain string to its glyph (spaces have none)
  const chars = []; let gi = 0;
  for (const ch of plain) chars.push(ch === ' ' ? null : line.glyphs[gi++]);
  const space = measure(' ', o);
  const xs = [line.left];                                     // caret x after n characters
  for (let n = 1; n <= chars.length; n++) {
    const g = chars[n - 1];
    xs.push(g ? g.x + g.adv : xs[n - 1] + space);
  }
  const cw = o.caretWidth ?? Math.max(3, line.size * 0.065), ch = o.caretHeight ?? line.size * 0.98;
  const caret = K.rect(cw, ch, o.caretColor ?? o.color ?? '#1c1c2e', cw / 2);
  caret.position.y = line.cap / 2; caret.visible = false;   // typeOn shows it
  group.add(caret);
  return { group, line, caret, chars, xs, str: plain, n: chars.length };
}
/**
 * Type a typeLine in at cps characters per second from t0. The caret shows from opts.caretFrom (default t0 - 0.5),
 * blinks (on for 0.25 s of every 0.5 s, on the beat) when idle, stays solid while typing, and goes away at
 * opts.caretUntil. Returns the time the last character appears.
 */
export function typeOn(tl, t, t0, cps = 20, { caretFrom = t0 - 0.5, caretUntil = Infinity, blink = 0.5 } = {}) {
  t = frameTime(t);                                         // a character appears for whole frames, never mid shutter
  const typed = t < t0 ? 0 : Math.min(tl.n, Math.floor((t - t0) * cps + 1e-6));
  tl.chars.forEach((g, i) => { if (g) { g.pivot.visible = i < typed; g.pivot.position.set(g.home.x, g.home.y, 0); g.pivot.scale.setScalar(1); } });
  const tEnd = t0 + tl.n / cps;
  const typing = t >= t0 && t < tEnd + 0.15;
  const on = t >= caretFrom && t < caretUntil && (typing || ((t - caretFrom) % blink) < blink / 2);
  tl.caret.visible = on;
  tl.caret.position.x = tl.xs[typed] + tl.line.size * 0.07;
  return tEnd;
}

// ---------------------------------------------------------------- counters
/**
 * A number drawn into a small canvas texture. opts: size, weight, color, align ('left' | 'center' | 'right':
 * where x = 0 is), sample (widest string it will show, sets the canvas width), format(v) -> string,
 * family ('Poppins'), tracking (em). The mesh's origin sits on the baseline at the aligned edge.
 * Returns { group, mesh, shown, set(str) }.
 */
export function counter({ size = 34, weight = 600, color = C.ink, align = 'left', sample = '000,000', format = fmtInt, os = 3, family = 'Poppins' } = {}) {
  const font = `${weight} ${size * os}px "${family}"`;
  const mc = document.createElement('canvas').getContext('2d'); mc.font = font;
  const wpx = Math.ceil(mc.measureText(sample).width / os * 1.15 + size * 0.4), hpx = Math.ceil(size * 1.5);
  const can = document.createElement('canvas'); can.width = wpx * os; can.height = hpx * os;
  const g = can.getContext('2d');
  const tex = K.canvasTexture(can); tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter;
  const mesh = K.spriteFrom(can, wpx, hpx); mesh.material.uniforms.map.value = tex;
  const base = size * 1.1;                                      // baseline from the canvas top (design px)
  const ox = align === 'left' ? wpx / 2 - size * 0.2 : align === 'right' ? -wpx / 2 + size * 0.2 : 0;
  mesh.position.set(ox, base - hpx / 2, 0);
  const group = new THREE.Group(); group.add(mesh);
  const api = {
    group, mesh, shown: null, format,
    set(str) {
      if (str === api.shown) return;
      api.shown = str;
      g.clearRect(0, 0, can.width, can.height);
      g.font = font; g.fillStyle = hex(color); g.textBaseline = 'alphabetic';
      g.textAlign = align;
      const x = align === 'left' ? size * 0.2 * os : align === 'right' ? (wpx - size * 0.2) * os : (wpx / 2) * os;
      g.fillText(str, x, base * os);
      tex.needsUpdate = true;
    },
  };
  api.set(format(0));
  return api;
}
export const fmtInt = (v) => Math.round(v).toLocaleString('en-US');
export const fmtPct = (d = 1) => (v) => v.toFixed(d) + '%';
/** Count a counter from `from` to `to` between t0 and t0 + dur (ease default outCubic). Pure in t. Returns the value. */
export function count(cnt, t, t0, dur, from, to, { ease = M.outCubic, format = cnt.format } = {}) {
  t = frameTime(t);                                         // one value per frame: digits do not smear
  const v = from + (to - from) * M.segment(t, t0, dur, ease);
  cnt.set(format(v));
  return v;
}

// ---------------------------------------------------------------- glow
/**
 * Soft round lens glow of radius r (the light falls off as a gaussian, nothing visible at r).
 * opts.blend: 'add' (default; light added to what is behind, reads as light on a dark field) or 'normal' (a tinted
 * haze, for a light page). Uniforms: opacity, color.  glow(420, C.accent)
 */
export function glow(r, colour = C.accent, { blend = 'add', opacity = 1, squash = 1 } = {}) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(colour) }, opacity: { value: opacity } },
    vertexShader: quadVert,
    fragmentShader: `uniform vec3 color; uniform float opacity; varying vec2 vUv;
      void main() { float d = length(vUv - 0.5) * 2.0; float a = exp(-d * d * 4.2) * (1.0 - smoothstep(0.85, 1.0, d)) * opacity;
        gl_FragColor = vec4(color * a, a); }`,
    ...FLAT,
    ...(blend === 'add'
      ? { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor }
      : PREMULT),
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2 * r, 2 * r * squash), mat);
  return mesh;
}

// ---------------------------------------------------------------- glass pill
/**
 * A glass pill with text: a product name, a URL, a chapter tag. The outline is a ribbon that can
 * draw itself (outline.setProgress(0, k)), the text is a typeLine (typeOn) and the fill a sprite.
 *   variant 'dark' (on a dark field: white 8% glass, white text) | 'light' (white 72% glass, ink text)
 * Returns { group, bg, outline, text, w, h }. Origin at the pill centre.
 */
export function pill(str, { size = 34, variant = 'light', padX = 0.9, h = null, weight = 500, color = null, os = 3 } = {}) {
  const dark = variant === 'dark';
  const text = typeLine(str, { size, weight, color: color ?? (dark ? C.white : C.ink), os, caretColor: dark ? C.white : C.accent });
  const H = h ?? size * 2.1, W = text.line.width + 2 * size * padX + H * 0.3;
  const m = 40;
  const bg = K.sprite(W + 2 * m, H + 2 * m, (g) => {
    g.save(); g.shadowColor = dark ? 'rgba(0,0,0,.45)' : 'rgba(20,22,40,.18)'; g.shadowBlur = 30; g.shadowOffsetY = dark ? 0 : 8;
    g.fillStyle = dark ? 'rgba(255,255,255,.09)' : 'rgba(255,255,255,.74)';
    g.beginPath(); g.roundRect(m, m, W, H, H / 2); g.fill(); g.restore();
    g.strokeStyle = dark ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.95)'; g.lineWidth = 1.5;
    g.beginPath(); g.roundRect(m + 0.75, m + 0.75, W - 1.5, H - 1.5, H / 2); g.stroke();
  }, { os: 2 });
  bg.userData.sub = 0;
  // outline path: starts at the left middle, runs clockwise
  const r = H / 2, pts = [];
  const seg = 24;
  for (let i = 0; i <= seg; i++) { pts.push([-W / 2 + r + Math.cos(Math.PI - (i / seg) * Math.PI / 2) * r, Math.sin(Math.PI - (i / seg) * Math.PI / 2) * r]); }
  pts.push([W / 2 - r, r]);
  for (let i = 0; i <= seg * 2; i++) { const a = Math.PI / 2 - (i / (seg * 2)) * Math.PI; pts.push([W / 2 - r + Math.cos(a) * r, Math.sin(a) * r]); }
  pts.push([-W / 2 + r, -r]);
  for (let i = 0; i <= seg; i++) { const a = -Math.PI / 2 - (i / seg) * Math.PI / 2; pts.push([-W / 2 + r + Math.cos(a) * r, Math.sin(a) * r]); }
  const outline = K.polyline(pts, 2.2, dark ? C.white : C.accent); outline.mesh.userData.sub = 2;
  text.group.position.set(-text.line.width / 2, -text.line.cap / 2, 0); text.group.userData.sub = 3;
  text.line.group.traverse((o) => { o.userData.sub = 3; }); text.caret.userData.sub = 3;
  const group = new THREE.Group(); group.add(bg, outline.mesh, text.group);
  return { group, bg, outline, text, w: W, h: H };
}
