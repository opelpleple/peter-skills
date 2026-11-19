// Type system: Canvas 2D rasterises each glyph once into an atlas, Three.js stages one quad per glyph.
// That gives exact browser kerning and font rendering, and lets a scene move, scale or recolour single letters.
//
// Markup: text between asterisks is set in the highlight face (Libre Baskerville Italic by default), scaled so
// its x height matches the main face:  makeText('Where investors *check*')
import * as THREE from 'three';
import { FLAT, MAX_ANISO } from './core.js';

export const SANS = 'Poppins';
export const SERIF = 'Libre Baskerville';

const mcan = document.createElement('canvas');
const mctx = mcan.getContext('2d');
export const fontStr = (f, px) => `${f.italic ? 'italic ' : ''}${f.weight} ${px}px "${f.family}"`;

const metricCache = new Map();
/** Vertical metrics of a face as fractions of the font size: cap, xh (x height), asc, desc. */
export function metrics(f) {
  const key = fontStr(f, 1000);
  if (!metricCache.has(key)) {
    mctx.font = key;
    metricCache.set(key, {
      cap: mctx.measureText('H').actualBoundingBoxAscent / 1000,
      xh: mctx.measureText('x').actualBoundingBoxAscent / 1000,
      asc: mctx.measureText('bdfhkl').actualBoundingBoxAscent / 1000,
      desc: mctx.measureText('gjpqy').actualBoundingBoxDescent / 1000,
    });
  }
  return metricCache.get(key);
}

/** Load the film's faces. Call once and await before any text is made. */
export async function loadFonts(base = './fonts/') {
  const faces = [
    [SANS, 'Poppins-Regular.ttf', { weight: '400' }], [SANS, 'Poppins-Medium.ttf', { weight: '500' }],
    [SANS, 'Poppins-SemiBold.ttf', { weight: '600' }], [SANS, 'Poppins-Bold.ttf', { weight: '700' }],
    [SANS, 'Poppins-ExtraBold.ttf', { weight: '800' }],
    [SERIF, 'LibreBaskerville-wght.ttf', { weight: '400 700', style: 'normal' }],
    [SERIF, 'LibreBaskerville-Italic-wght.ttf', { weight: '400 700', style: 'italic' }],
  ];
  await Promise.all(faces.map(async ([family, file, desc]) => {
    const ff = new FontFace(family, `url(${base}${file})`, desc);
    await ff.load();
    document.fonts.add(ff);
  }));
  // a face that failed to load would silently fall back to a system font: check each one draws differently
  for (const probe of ['400 40px "Poppins"', '600 40px "Poppins"', '700 40px "Poppins"', 'italic 500 40px "Libre Baskerville"', '500 40px "Libre Baskerville"']) {
    if (!document.fonts.check(probe)) throw new Error('font not loaded: ' + probe);
  }
}

const glyphVert = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const glyphFrag = `uniform sampler2D map; uniform vec3 color; uniform float opacity; varying vec2 vUv;
  void main() { float a = texture2D(map, vUv).a * opacity; if (a < 0.003) discard; gl_FragColor = vec4(color, a); }`;

function parseRuns(str) {
  const runs = [];
  str.split('*').forEach((part, i) => { if (part.length) runs.push({ text: part, hi: i % 2 === 1 }); });
  return runs;
}

function styleOf(o) {
  const size = o.size ?? 96;
  const base = { family: o.family ?? SANS, weight: o.weight ?? 600, italic: o.italic ?? false };
  const hi = { family: o.hiFamily ?? SERIF, weight: o.hiWeight ?? 500, italic: o.hiItalic ?? true };
  const hiScale = (o.hiScale ?? metrics(base).xh / metrics(hi).xh) * (o.hiBoost ?? 1);
  return { size, base, hi, hiScale, tracking: (o.tracking ?? 0) * size, hiTracking: (o.hiTracking ?? o.tracking ?? 0) * size };
}

/** Measure a marked up string without building it. */
export function measure(str, o = {}) {
  const st = styleOf(o);
  let pen = 0;
  for (const run of parseRuns(str)) {
    const px = run.hi ? st.size * st.hiScale : st.size;
    mctx.font = fontStr(run.hi ? st.hi : st.base, px);
    pen += mctx.measureText(run.text).width + (run.hi ? st.hiTracking : st.tracking) * [...run.text].length;
  }
  return pen;
}

/** Largest size (not above `size`) at which the string is no wider than maxWidth. */
export function fitSize(str, maxWidth, o = {}) {
  const size = o.size ?? 96;
  const w = measure(str, { ...o, size });
  return w <= maxWidth ? size : Math.floor((size * maxWidth) / w);
}

/**
 * One line of text as a THREE.Group of glyph quads.
 *   o.size      font size in design px (default 96)      o.weight   main face weight (default 600)
 *   o.color     main colour (hex string or number)        o.hiColor  highlight colour (default: same)
 *   o.align     'left' | 'center' | 'right': where x = 0 sits (default 'left'). y = 0 is the baseline.
 *   o.tracking  letter spacing in em                      o.os       raster oversampling (default 2; raise it
 *                                                                    for text that will be scaled up on screen)
 * Returns { group, glyphs, width, size, cap, xh, setColor(c, which), setOpacity(a) }.
 * Each glyph: { pivot, mesh, mat, ch, i, n, word, hi, x, cx, adv, home:{x,y} }. Move or scale glyph.pivot;
 * its origin is the centre of the letter (half the advance, half the cap height).
 */
export function makeText(str, o = {}) {
  const st = styleOf(o);
  const os = o.os ?? 2;
  const color = new THREE.Color(o.color ?? '#1c1c2e');
  const hiColor = new THREE.Color(o.hiColor ?? o.color ?? '#1c1c2e');
  const capH = metrics(st.base).cap * st.size;

  // layout: origin and ink box of every glyph (kerning comes from measuring the run prefix)
  const items = [];
  let pen = 0, word = 0, lastWasSpace = false;
  for (const run of parseRuns(str)) {
    const f = run.hi ? st.hi : st.base;
    const px = run.hi ? st.size * st.hiScale : st.size;
    const tr = run.hi ? st.hiTracking : st.tracking;
    mctx.font = fontStr(f, px);
    const chars = [...run.text];
    let prefix = '';
    chars.forEach((ch, i) => {
      const x = pen + mctx.measureText(prefix).width + tr * i;
      prefix += ch;
      if (ch === ' ') { if (!lastWasSpace) word++; lastWasSpace = true; return; }
      lastWasSpace = false;
      const m = mctx.measureText(ch);
      items.push({ ch, x, adv: m.width, l: m.actualBoundingBoxLeft, r: m.actualBoundingBoxRight, a: m.actualBoundingBoxAscent, d: m.actualBoundingBoxDescent, f, px, hi: run.hi, word });
    });
    pen += mctx.measureText(run.text).width + tr * chars.length;
  }
  const width = pen;

  // atlas: one cell per glyph on shelves
  const pad = Math.ceil(st.size * os * 0.04) + 3;
  let ax = 0, ay = 0, rowH = 0, atlasW = 0;
  const MAXW = 4096;
  for (const it of items) {
    it.cw = Math.ceil((it.l + it.r) * os) + 2 * pad;
    it.chh = Math.ceil((it.a + it.d) * os) + 2 * pad;
    if (ax + it.cw > MAXW) { ax = 0; ay += rowH; rowH = 0; }
    it.ax = ax; it.ay = ay; ax += it.cw; rowH = Math.max(rowH, it.chh); atlasW = Math.max(atlasW, ax);
  }
  const atlasH = ay + rowH;
  const can = document.createElement('canvas');
  can.width = Math.max(4, atlasW); can.height = Math.max(4, atlasH);
  const g = can.getContext('2d');
  g.fillStyle = '#fff'; g.textBaseline = 'alphabetic';
  for (const it of items) {
    g.font = fontStr(it.f, it.px * os);
    g.fillText(it.ch, it.ax + pad + it.l * os, it.ay + pad + it.a * os);
  }
  const tex = new THREE.CanvasTexture(can);
  tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = MAX_ANISO;

  const group = new THREE.Group();
  const shift = o.align === 'center' ? -width / 2 : o.align === 'right' ? -width : 0;
  const glyphs = items.map((it, i) => {
    const w = it.cw / os, h = it.chh / os;
    const geo = new THREE.PlaneGeometry(w, h);
    const u0 = it.ax / can.width, u1 = (it.ax + it.cw) / can.width;
    const v1 = 1 - it.ay / can.height, v0 = 1 - (it.ay + it.chh) / can.height;
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([u0, v1, u1, v1, u0, v0, u1, v0], 2));
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, color: { value: (it.hi ? hiColor : color).clone() }, opacity: { value: 1 } },
      vertexShader: glyphVert, fragmentShader: glyphFrag, ...FLAT,
    });
    const mesh = new THREE.Mesh(geo, mat);
    const pivot = new THREE.Group();
    const px0 = shift + it.x + it.adv / 2, py0 = capH / 2;
    pivot.position.set(px0, py0, 0);
    // ink box centre relative to the glyph origin (baseline, pen position), then relative to the pivot
    mesh.position.set((it.r - it.l) / 2 - it.adv / 2, (it.a - it.d) / 2 - capH / 2, 0);
    pivot.add(mesh);
    group.add(pivot);
    return { pivot, mesh, mat, ch: it.ch, i, n: items.length, word: it.word, hi: it.hi, x: shift + it.x, cx: px0, adv: it.adv, home: { x: px0, y: py0 } };
  });

  return {
    group, glyphs, width, size: st.size, cap: capH, xh: metrics(st.base).xh * st.size, str, left: shift, texture: tex,
    /** which: 'all' | 'main' | 'hi' */
    setColor(c, which = 'all') {
      for (const gl of glyphs) if (which === 'all' || (which === 'hi') === gl.hi) gl.mat.uniforms.color.value.set(c);
    },
    setOpacity(a) { for (const gl of glyphs) gl.mat.uniforms.opacity.value = a; },
    /** put every glyph back to its home position, scale 1, no rotation */
    reset() { for (const gl of glyphs) { gl.pivot.position.set(gl.home.x, gl.home.y, 0); gl.pivot.scale.setScalar(1); gl.pivot.rotation.set(0, 0, 0); } },
  };
}

/**
 * Several lines as one block.
 *   o.leading  line pitch as a multiple of the size (default 1.16)
 *   o.align    'left' | 'center' | 'right' for the lines; x = 0 is that edge (or the centre)
 *   o.valign   'center' (default): y = 0 is the middle of the block measured from the first cap top to the
 *              last baseline; 'top': y = 0 is the first cap top; 'baseline': y = 0 is the first baseline
 * Returns { group, lines, width, height, pitch }. lines[i] is a makeText result whose group sits on its baseline.
 */
export function makeBlock(strs, o = {}) {
  const size = o.size ?? 96;
  const pitch = (o.leading ?? 1.16) * size;
  const lines = strs.map((s) => makeText(s, o));
  const cap = lines[0].cap;
  const height = cap + pitch * (lines.length - 1);
  const top = o.valign === 'top' ? 0 : o.valign === 'baseline' ? cap : height / 2;
  const group = new THREE.Group();
  lines.forEach((ln, i) => { ln.y = top - cap - i * pitch; ln.group.position.set(0, ln.y, 0); group.add(ln.group); });
  return { group, lines, width: Math.max(...lines.map((l) => l.width)), height, pitch, cap };
}

/**
 * Rasterise a marked up string into one canvas (for shaders: repeating word walls, letter masks).
 * Returns { canvas, width, height, baseline, os } where width/height are in design px and the text starts
 * at x = pad, baseline at y = baseline (design px from the top of the canvas).
 */
export function rasterText(str, o = {}) {
  const st = styleOf(o);
  const os = o.os ?? 2;
  const padX = o.padX ?? Math.ceil(st.size * 0.08), padY = o.padY ?? Math.ceil(st.size * 0.08);
  const mB = metrics(st.base), mH = metrics(st.hi);
  const asc = Math.max(mB.asc * st.size, mH.asc * st.size * st.hiScale), desc = Math.max(mB.desc * st.size, mH.desc * st.size * st.hiScale);
  const width = measure(str, o) + 2 * padX, height = asc + desc + 2 * padY;
  const can = document.createElement('canvas');
  can.width = Math.ceil(width * os); can.height = Math.ceil(height * os);
  const g = can.getContext('2d');
  g.scale(os, os); g.textBaseline = 'alphabetic'; g.fillStyle = o.fill ?? '#fff';
  let pen = padX;
  for (const run of parseRuns(str)) {
    const px = run.hi ? st.size * st.hiScale : st.size;
    const tr = run.hi ? st.hiTracking : st.tracking;
    g.font = fontStr(run.hi ? st.hi : st.base, px);
    if (o.hiFill && run.hi) g.fillStyle = o.hiFill; else g.fillStyle = o.fill ?? '#fff';
    if (tr === 0) { g.fillText(run.text, pen, padY + asc); pen += g.measureText(run.text).width; }
    else { let prefix = ''; [...run.text].forEach((ch, i) => { g.fillText(ch, pen + g.measureText(prefix).width + tr * i, padY + asc); prefix += ch; }); pen += g.measureText(run.text).width + tr * [...run.text].length; }
  }
  return { canvas: can, width, height, baseline: padY + asc, padX, os };
}
