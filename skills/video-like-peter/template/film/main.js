// Director: loads fonts and shared assets, builds every scene at its station on the world map, moves the
// camera between stations and exposes the frame renderer as window.MV (the contract tools/render/render.mjs
// drives: MV.ready, MV.fps, MV.frames, MV.width, MV.height, MV.canvas, MV.renderFrame(f)).
//
// URL parameters
//   ?w=&h=        output size (the renderer passes them; default 1920x1080)
//   ?s=           sub frames per frame (default auto: 16 to 256, as many as the motion needs)
//   ?shutter=     shutter as a fraction of a frame (default 0.8)
//   ?only=id,id   build only these scenes (also the way to see a devOnly test scene)
//   ?conform=1    play the film clock through the CUT table below (no effect while CUT is empty)
//   ?t= or ?f=    start time (seconds) or frame for the preview player
//   ?audio=path   sound track for the preview player (default /audio/mix.wav; silent if missing)
import * as THREE from 'three';
import { W, H, FPS, Q, renderer, scene, renderAt, setCamera } from './engine/core.js';
import { loadFonts } from './engine/type.js';
import * as K from './engine/kit.js';
import { M, fr } from './engine/moves.js';
import { C, T, STATION, GX, GY } from './engine/theme.js';
import { uiManifest, uiCard } from './engine/brand.js';
import { attachPlayer } from '/tools/render/player.js';

// ---------------------------------------------------------------- two clocks (optional)
// Scenes are written against scene time (theme.T). If the music cannot be made to land where the scenes
// land (for example the generator phrased every 8 bars and ignored the requested section lengths), conform
// the picture instead of rewriting scenes: CUT maps FILM time to SCENE time per scene id as break points
// [film, scene], straight lines between them, slope 1 before the first and after the last point.
//   CUT = { card: [[4.0, 4.0], [5.0, 5.5]] }   card plays 0.5 s faster between film 4.0 and 5.0, then +0.5 s
// ?conform=1 plays the film clock (tools/bin/film passes it); without it the page plays scene time, which is
// what scene authors look at. With CUT empty both clocks are the same. The simpler path when planning fresh:
// splice the music on bar lines (tools/audio/splice.py) so that scene time = film time and CUT stays empty.
const CONFORM = Q.get('conform') === '1';
const CUT = {};
const FILM_TOTAL = T.total;     // set to the conformed length if CUT changes it
const TOTAL = CONFORM ? FILM_TOTAL : T.total;
function sceneTime(id, t) {
  const pts = CONFORM && CUT[id];
  if (!pts) return t;
  if (t <= pts[0][0]) return pts[0][1] + (t - pts[0][0]);
  for (let i = 1; i < pts.length; i++) {
    if (t <= pts[i][0]) { const [f0, s0] = pts[i - 1], [f1, s1] = pts[i]; return s0 + ((s1 - s0) * (t - f0)) / (f1 - f0); }
  }
  const [fl, sl] = pts[pts.length - 1];
  return sl + (t - fl);
}
const FRAMES = Math.round(TOTAL * FPS);
const SAMPLES = Number(Q.get('s')) || 'auto';
const SHUTTER = Number(Q.get('shutter')) || 0.8;
const ONLY = Q.get('only') ? Q.get('only').split(',') : null;

// Scene files in story order. A file that is missing is skipped, so the rest of the film still renders while
// scenes are being written; a file that throws while building stops the page (fix it first).
const SCENE_FILES = ['s01_headline', 's02_card', 'zz_ui'];   // zz_ui is devOnly: built only with ?only=ui

// ---------------------------------------------------------------- camera path
// [start, duration, station, ease]: the camera travels from where it was to that station. duration 0 = cut.
// Times are on the film clock (if you conform with CUT, give the film times here).
const START = 'dark';
const MOVES = [
  [T.move, T.card - T.move, 'light', M.inOutCubic],
];
let PARK = null;   // set when a devOnly test scene is built alone: the camera stays on its station
function cameraAt(t) {
  if (PARK) return { x: PARK.x, y: PARK.y };
  let from = STATION[START], x = from.x, y = from.y;
  for (const [t0, dur, name, ease] of MOVES) {
    if (t < t0) break;
    const to = STATION[name], k = dur > 0 ? ease(Math.min(1, (t - t0) / dur)) : 1;
    x = from.x + (to.x - from.x) * k; y = from.y + (to.y - from.y) * k;
    from = to;
  }
  return { x, y };
}

// ---------------------------------------------------------------- shared assets
const imgCache = new Map();
const assets = {
  /** A captured ui component (film/assets/ui) as a card: see brand.uiCard. */
  ui: (name, opts) => uiCard(name, opts),
  /** An SVG cut into pieces (see kit.svgPieces and kit.PIECES). Each call returns fresh meshes. */
  svg: (url, height, groups, opt) => K.svgPieces(url, height, groups, opt),
  /** Photo for a tile (film/assets/photos/<name>). Falls back to a drawn placeholder when the file is missing. */
  async photo(name) {
    if (!imgCache.has(name)) imgCache.set(name, K.loadImage(`./assets/photos/${name}`).catch(() => placeholderPhoto(name)));
    return imgCache.get(name);
  },
};
function placeholderPhoto(name) {
  const can = document.createElement('canvas'); can.width = can.height = 512;
  const g = can.getContext('2d');
  let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  const gr = g.createLinearGradient(0, 0, 512, 512);
  gr.addColorStop(0, `hsl(${h} 30% 72%)`); gr.addColorStop(1, `hsl(${(h + 40) % 360} 25% 48%)`);
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.arc(256, 200, 84, 0, 7); g.fill();
  g.beginPath(); g.ellipse(256, 470, 170, 150, 0, 0, 7); g.fill();
  return can;
}

// ---------------------------------------------------------------- build
const scenes = [];
async function init() {
  await loadFonts('./fonts/');
  await uiManifest('./assets/ui/');
  // colour fields: one cell per station
  for (const s of Object.values(STATION)) {
    const m = K.rect(GX, GY, s.color);
    m.position.set(s.x, s.y, 0); m.renderOrder = -1000;
    scene.add(m);
  }
  for (const file of SCENE_FILES) {
    let mod;
    try { mod = (await import(`./scenes/${file}.js`)).default; } catch (e) {
      if (!/Failed to fetch|404|Cannot find/i.test(String(e))) { console.error(`scene ${file} failed to load:`, e); throw e; }
      console.warn(`scene ${file} missing, skipped`);
      continue;
    }
    if (ONLY && !ONLY.includes(mod.id)) continue;
    if (mod.devOnly && !(ONLY && ONLY.includes(mod.id))) continue;   // test scenes show only when asked for
    const st = STATION[mod.station];
    if (!st) throw new Error(`scene ${mod.id}: unknown station ${mod.station}`);
    const root = new THREE.Group();
    root.position.set(st.x, st.y, 0);
    scene.add(root);
    try {
      const api = await mod.build({ root, assets, station: st });
      scenes.push({ id: mod.id, t0: mod.t0, t1: mod.t1, root, api });
      if (mod.devOnly) PARK = st;
    } catch (e) { console.error(`scene ${mod.id} failed to build:`, e); throw e; }
  }
  update(0);
  renderAt(0, 0, update, { samples: 2, shutter: SHUTTER }); // compile shaders before the first real frame
}

// Pure function of t: sets every scene and the camera. Called 16 to 256 times per output frame.
function update(t) {
  const cam = cameraAt(t);
  let zoom = 1, roll = 0, tiltX = 0, tiltY = 0;
  for (const s of scenes) {
    const st = sceneTime(s.id, t);
    const on = st >= s.t0 && st < s.t1;
    s.root.visible = on;
    if (!on) continue;
    s.api.update(st);
    if (s.api.cam) {
      const c = s.api.cam(st);
      cam.x += c.x || 0; cam.y += c.y || 0; zoom *= c.zoom || 1; roll += c.roll || 0; tiltX += c.tiltX || 0; tiltY += c.tiltY || 0;
    }
  }
  setCamera({ x: cam.x, y: cam.y, zoom, roll, tiltX, tiltY });
}

window.MV = {
  fps: FPS, frames: FRAMES, width: W, height: H, canvas: renderer.domElement,
  ready: null,
  renderFrame(f) { this.lastSamples = renderAt(f / FPS, f, update, { samples: SAMPLES, shutter: SHUTTER, clear: C.dark }); },
  lastSamples: 0,
  scenes,
  fr,
};
document.body.appendChild(renderer.domElement);
window.MV.ready = init().then(() => {
  if (!Q.has('render')) {
    const start = Q.has('f') ? Number(Q.get('f')) : Math.round((Number(Q.get('t')) || 0) * FPS);
    window.MV.renderFrame(start);
    attachPlayer(window.MV, { audio: Q.get('audio') || '/audio/mix.wav' });
  }
});
