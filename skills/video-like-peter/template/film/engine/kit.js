// Building blocks: flat vector shapes (geometry, sharp at any zoom), canvas drawn sprites (cards, shadows),
// rounded photo tiles, ribbons for drawn lines, and any SVG logo cut into movable pieces.
import * as THREE from 'three';
import { FLAT, MAX_ANISO } from './core.js';

const PI = Math.PI;

// ---------------------------------------------------------------- flat shapes
export const flat = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color), opacity, ...FLAT });

export function rrShape(w, h, r = 0) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  if (r === 0) { s.moveTo(x, y); s.lineTo(x + w, y); s.lineTo(x + w, y + h); s.lineTo(x, y + h); s.closePath(); return s; }
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -PI / 2, 0, false);
  s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, PI / 2, false);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, PI / 2, PI, false);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, PI, PI * 1.5, false);
  return s;
}
const shapeMesh = (shape, color, seg = 20) => new THREE.Mesh(new THREE.ShapeGeometry(shape, seg), flat(color));

/** Rectangle centred on the origin, optional corner radius. */
export const rect = (w, h, color, r = 0) => shapeMesh(rrShape(w, h, r), color);
/** Square standing on a corner. side = edge length. */
export function diamond(side, color, r = 0) { const m = rect(side, side, color, r); m.rotation.z = PI / 4; return m; }
export function circle(radius, color, seg = 96) { return new THREE.Mesh(new THREE.CircleGeometry(radius, seg), flat(color)); }
/** Outline of a rounded rectangle, stroke drawn inside the w x h box. */
export function rrOutline(w, h, r, stroke, color) {
  const s = rrShape(w, h, r);
  s.holes.push(new THREE.Path(rrShape(w - 2 * stroke, h - 2 * stroke, Math.max(0, r - stroke)).getPoints(20).reverse()));
  return shapeMesh(s, color);
}
/** Five point star, R = outer radius, one point up. inner = inner radius / outer radius. */
export function star(R, color, inner = 0.42, points = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const a = PI / 2 + (i * PI) / points, rr = i % 2 ? R * inner : R;
    if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  s.closePath();
  return shapeMesh(s, color, 1);
}
/** Arrow pointing right, total length L, shaft thickness th (default L * 0.13). Rotate it to aim. */
export function arrow(L, color, th = L * 0.13) {
  const hw = L * 0.36, hl = L * 0.36, s = new THREE.Shape();
  const pts = [[-L / 2, -th / 2], [L / 2 - th * 0.9, -th / 2], [L / 2 - hl, -hw + th * 0.1], [L / 2 - hl + th * 0.75, -hw - th * 0.55 + th * 0.1], [L / 2 + th * 0.2, 0],
    [L / 2 - hl + th * 0.75, hw + th * 0.55 - th * 0.1], [L / 2 - hl, hw - th * 0.1], [L / 2 - th * 0.9, th / 2], [-L / 2, th / 2]];
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return shapeMesh(s, color, 1);
}
/** Check mark that fits a box of about size x size, stroke thickness th. */
export function check(size, color, th = size * 0.2) {
  return polyline([[-size * 0.42, -size * 0.02], [-size * 0.12, -size * 0.32], [size * 0.46, size * 0.34]], th, color).mesh;
}

/**
 * A real 3D slab (rounded box) for phones and thick cards: front and back faces in faceColor, the rim in
 * sideColor. It is convex and drawn with back face culling, so it looks right at any tilt without a depth
 * buffer. The front face sits at z = depth / 2: put the screen sprite there (z = depth / 2 + 0.5) with a
 * higher layer.
 */
export function slab(w, h, depth, r, faceColor, sideColor) {
  const geo = new THREE.ExtrudeGeometry(rrShape(w, h, r), { depth, bevelEnabled: false, curveSegments: 20 });
  geo.translate(0, 0, -depth / 2);
  const face = flat(faceColor), side = flat(sideColor);
  face.side = THREE.FrontSide; side.side = THREE.FrontSide;
  return new THREE.Mesh(geo, [face, side]);
}

// ---------------------------------------------------------------- ribbons (thick poly lines that can draw on)
/**
 * A thick line through points [[x, y], ...] with mitred corners and square ends.
 * Returns { mesh, length, setProgress(a, b), pointAt(p) }: setProgress(0, 0.5) shows the first half,
 * pointAt(p) gives { x, y, angle } on the centre line at fraction p of the length (use it to follow the tip).
 */
export function polyline(points, width, color) {
  const P = points.map(([x, y]) => new THREE.Vector2(x, y));
  const segLen = [], cum = [0];
  for (let i = 1; i < P.length; i++) { segLen.push(P[i].distanceTo(P[i - 1])); cum.push(cum[i - 1] + segLen[i - 1]); }
  const length = cum[cum.length - 1];
  const maxV = P.length * 2;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(maxV * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const idx = [];
  for (let i = 0; i < P.length - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, flat(color));
  mesh.material.side = THREE.DoubleSide;
  mesh.frustumCulled = false;

  const pointAt = (p) => {
    const d = Math.max(0, Math.min(1, p)) * length;
    let i = 0; while (i < segLen.length - 1 && cum[i + 1] < d) i++;
    const k = segLen[i] ? (d - cum[i]) / segLen[i] : 0;
    return { x: P[i].x + (P[i + 1].x - P[i].x) * k, y: P[i].y + (P[i + 1].y - P[i].y) * k, angle: Math.atan2(P[i + 1].y - P[i].y, P[i + 1].x - P[i].x), seg: i };
  };
  const setProgress = (a, b) => {
    a = Math.max(0, Math.min(1, a)); b = Math.max(0, Math.min(1, b));
    if (b - a < 1e-6) { geo.setDrawRange(0, 0); return; }
    const A = pointAt(a), B = pointAt(b);
    const pts = [new THREE.Vector2(A.x, A.y)];
    for (let i = A.seg + 1; i <= B.seg; i++) pts.push(P[i]);
    pts.push(new THREE.Vector2(B.x, B.y));
    const hw = width / 2;
    for (let i = 0; i < pts.length; i++) {
      const dPrev = i > 0 ? pts[i].clone().sub(pts[i - 1]).normalize() : null;
      const dNext = i < pts.length - 1 ? pts[i + 1].clone().sub(pts[i]).normalize() : null;
      let nx, ny, scale = 1;
      if (dPrev && dNext && dPrev.lengthSq() && dNext.lengthSq()) {
        const tx = dPrev.x + dNext.x, ty = dPrev.y + dNext.y, tl = Math.hypot(tx, ty) || 1;
        nx = -ty / tl; ny = tx / tl;
        scale = Math.min(4, 1 / Math.max(0.25, nx * -dNext.y + ny * dNext.x)); // mitre length, clamped for sharp turns
      } else { const d = dNext && dNext.lengthSq() ? dNext : dPrev; nx = -d.y; ny = d.x; }
      pos[i * 6] = pts[i].x + nx * hw * scale; pos[i * 6 + 1] = pts[i].y + ny * hw * scale; pos[i * 6 + 2] = 0;
      pos[i * 6 + 3] = pts[i].x - nx * hw * scale; pos[i * 6 + 4] = pts[i].y - ny * hw * scale; pos[i * 6 + 5] = 0;
    }
    geo.attributes.position.needsUpdate = true;
    geo.setDrawRange(0, (pts.length - 1) * 6);
  };
  setProgress(0, 1);
  return { mesh, length, setProgress, pointAt };
}

// ---------------------------------------------------------------- canvas sprites
const quadVert = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const PREMULT = { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor };

/** Texture from a canvas, uploaded premultiplied so soft edges never show a dark fringe. */
export function canvasTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.premultiplyAlpha = true; tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.anisotropy = MAX_ANISO;
  return tex;
}
const spriteMat = (tex) => new THREE.ShaderMaterial({
  uniforms: { map: { value: tex }, opacity: { value: 1 }, tint: { value: new THREE.Color('#ffffff') }, tintAmt: { value: 0 } },
  vertexShader: quadVert,
  fragmentShader: `uniform sampler2D map; uniform float opacity, tintAmt; uniform vec3 tint; varying vec2 vUv;
    void main() { vec4 c = texture2D(map, vUv); c.rgb = mix(c.rgb, tint * c.a, tintAmt); gl_FragColor = c * opacity; }`,
  ...FLAT, ...PREMULT,
});

/**
 * A plane of w x h design px painted by draw(ctx, w, h) (Canvas 2D, origin top left, units = design px).
 * os = oversampling of the canvas (2 is right for things shown near 1:1; use 3 for small text on cards).
 * The material has uniforms opacity, tint (colour) and tintAmt (0..1: fade the picture toward a flat colour).
 */
export function sprite(w, h, draw, { os = 2 } = {}) {
  const can = document.createElement('canvas');
  can.width = Math.ceil(w * os); can.height = Math.ceil(h * os);
  const ctx = can.getContext('2d');
  ctx.scale(os, os);
  draw(ctx, w, h);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), spriteMat(canvasTexture(can)));
  mesh.userData.canvas = can;
  return mesh;
}
/** Same, from an existing canvas or image (shown at w x h design px). */
export function spriteFrom(source, w, h) {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), spriteMat(canvasTexture(source)));
}

/** Soft drop shadow for a rounded card of w x h (the plane is larger than the card by the blur margin).
 *  Put it just under the card: shadow.position.set(card.x, card.y - dy, 0). */
export function shadow(w, h, r, { blur = 36, alpha = 0.2, color = '0,0,0', spread = 0 } = {}) {
  const m = Math.ceil(blur * 3), W2 = w + 2 * m, H2 = h + 2 * m;
  return sprite(W2, H2, (ctx) => {
    ctx.filter = `blur(${blur}px)`;
    ctx.fillStyle = `rgba(${color},${alpha})`;
    ctx.beginPath(); ctx.roundRect(m - spread, m - spread, w + 2 * spread, h + 2 * spread, r + spread); ctx.fill();
  }, { os: 1 });
}

// ---------------------------------------------------------------- rounded photo tile
/**
 * Square (or w x h) tile showing an image or canvas, cover fitted, with shader rounded corners that stay
 * sharp at any scale. uniforms: opacity, tint + tintAmt (fade toward the field colour), radius.
 * focus = [fx, fy] in 0..1 picks which part of the picture stays in view when it is cropped.
 */
export function photoTile(source, w, h = w, { radius = w * 0.22, focus = [0.5, 0.5] } = {}) {
  const tex = new THREE.Texture(source);
  tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.anisotropy = MAX_ANISO;
  tex.needsUpdate = true;
  const sw = source.naturalWidth || source.width, sh = source.naturalHeight || source.height;
  const tileAR = w / h, srcAR = sw / sh;
  const sx = srcAR > tileAR ? tileAR / srcAR : 1, sy = srcAR > tileAR ? 1 : srcAR / tileAR;
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: tex }, size: { value: new THREE.Vector2(w, h) }, radius: { value: radius }, opacity: { value: 1 },
      tint: { value: new THREE.Color('#ffffff') }, tintAmt: { value: 0 },
      uvS: { value: new THREE.Vector2(sx, sy) }, uvO: { value: new THREE.Vector2((1 - sx) * focus[0], (1 - sy) * (1 - focus[1])) },
    },
    vertexShader: quadVert,
    fragmentShader: `uniform sampler2D map; uniform vec2 size, uvS, uvO; uniform float radius, opacity, tintAmt; uniform vec3 tint; varying vec2 vUv;
      float sdRR(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
      void main() {
        float d = sdRR((vUv - 0.5) * size, size * 0.5, radius);
        float aa = max(fwidth(d), 1e-4);
        float m = 1.0 - smoothstep(-aa, aa, d);
        vec3 c = mix(texture2D(map, vUv * uvS + uvO).rgb, tint, tintAmt);
        gl_FragColor = vec4(c, m * opacity);
      }`,
    ...FLAT,
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

/** Load an image file and resolve when it is decoded. */
export function loadImage(url) {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('image failed: ' + url)); im.src = url; });
}

// ---------------------------------------------------------------- logo in pieces
/**
 * Rasterise an SVG logo so that each top level piece becomes its own plane (all planes share the logo's
 * box, so at rest they line up exactly as the official file). Gradients are kept because the browser
 * draws them.
 *   url      SVG file
 *   height   height of the whole logo in design px
 *   groups   which elements make a piece: a function (svgDoc) => Array<Array<Element>>
 *   px       raster height in pixels (default 3 x height)
 * Returns { group, pieces: [mesh], w, h, box: [{cx, cy, w, h}] } with box = each piece's own centre and size
 * relative to the logo centre (design px, y up), computed from its painted pixels.
 */
export async function svgPieces(url, height, groups, { px } = {}) {
  const text = await (await fetch(url)).text();
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const root = doc.documentElement;
  const [, , vbw, vbh] = root.getAttribute('viewBox').split(/[ ,]+/).map(Number);
  const w = (height * vbw) / vbh, h = height;
  const rh = Math.round(px || height * 3), rw = Math.round((rh * vbw) / vbh);
  const defs = root.querySelector('defs');
  const sets = groups(doc);
  const group = new THREE.Group(), pieces = [], box = [];
  for (const set of sets) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${vbw} ${vbh}" width="${rw}" height="${rh}">${defs ? new XMLSerializer().serializeToString(defs) : ''}${set.map((el) => new XMLSerializer().serializeToString(el)).join('')}</svg>`;
    const blobUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const img = await loadImage(blobUrl);
    URL.revokeObjectURL(blobUrl);
    const can = document.createElement('canvas'); can.width = rw; can.height = rh;
    const ctx = can.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, rw, rh);
    // painted bounds of this piece
    const data = ctx.getImageData(0, 0, rw, rh).data;
    let x0 = rw, y0 = rh, x1 = -1, y1 = -1;
    for (let y = 0; y < rh; y += 2) for (let x = 0; x < rw; x += 2) if (data[(y * rw + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const k = h / rh;
    box.push({ cx: ((x0 + x1) / 2) * k - w / 2, cy: h / 2 - ((y0 + y1) / 2) * k, w: (x1 - x0) * k, h: (y1 - y0) * k });
    const mesh = spriteFrom(can, w, h);
    pieces.push(mesh); group.add(mesh);
  }
  return { group, pieces, w, h, box };
}

/**
 * Generic piece selectors for svgPieces (pass one as `groups`, or write your own for a specific logo file):
 *   PIECES.whole        the whole file as one piece
 *   PIECES.children     every top level child of the root <svg> (or of its only <g>) as its own piece
 *   PIECES.select(css)  every element matching a CSS selector as its own piece
 */
export const PIECES = {
  whole: (doc) => [[...doc.documentElement.children].filter((el) => el.tagName !== 'defs')],
  children: (doc) => {
    let kids = [...doc.documentElement.children].filter((el) => el.tagName !== 'defs');
    while (kids.length === 1 && kids[0].tagName === 'g') kids = [...kids[0].children];
    return kids.map((el) => [el]);
  },
  select: (css) => (doc) => [...doc.querySelectorAll(css)].map((el) => [el]),
};
