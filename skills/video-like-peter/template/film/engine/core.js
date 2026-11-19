// Core of the film engine: one WebGL renderer, a camera that maps the z = 0 plane 1:1 to a 1920x1080
// design frame, and a temporal accumulation buffer that gives every moving thing real motion blur.
//
// Colour: colour management is switched off on purpose. Every hex value in theme.js is a display value
// and reaches the screen unchanged, so brand colours stay exact and blur is averaged in display space
// like a motion graphics package does.
import * as THREE from 'three';

THREE.ColorManagement.enabled = false;

export const Q = new URLSearchParams(location.search);
export const W = Number(Q.get('w')) || 1920;          // output size (the renderer passes ?w=&h=)
export const H = Number(Q.get('h')) || 1080;
export const DW = 1920, DH = 1080;                     // design frame, in world units at z = 0
export const FPS = 30;
export const FOV = 30;                                 // degrees, vertical
export const CAM_D = DH / 2 / Math.tan((FOV * Math.PI) / 360); // distance at which the design frame fills the view

export const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;   // pass through (see note on colour above)
renderer.toneMapping = THREE.NoToneMapping;
renderer.autoClear = false;
renderer.sortObjects = true;
export const MAX_ANISO = renderer.capabilities.getMaxAnisotropy();

export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(FOV, DW / DH, 10, 40000);
camera.position.set(0, 0, CAM_D);

// ---------------------------------------------------------------- accumulation motion blur
const rtScene = new THREE.WebGLRenderTarget(W, H, { samples: 4, depthBuffer: true, type: THREE.UnsignedByteType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
// 32 bit float: up to 256 sub frames are summed with weights of 1/256, which half floats would round badly
const gl = renderer.getContext();
const canFloat = !!gl.getExtension('EXT_color_buffer_float') && !!gl.getExtension('EXT_float_blend');
const rtAccum = new THREE.WebGLRenderTarget(W, H, { depthBuffer: false, type: canFloat ? THREE.FloatType : THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const fsVert = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const accMat = new THREE.ShaderMaterial({
  uniforms: { tex: { value: rtScene.texture }, w: { value: 1 } },
  vertexShader: fsVert,
  fragmentShader: 'uniform sampler2D tex; uniform float w; varying vec2 vUv; void main() { gl_FragColor = vec4(texture2D(tex, vUv).rgb * w, w); }',
  blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor, depthTest: false, depthWrite: false, transparent: true,
});
const outMat = new THREE.ShaderMaterial({
  uniforms: { tex: { value: rtAccum.texture }, uFrame: { value: 0 } },
  vertexShader: fsVert,
  // a quarter of an 8 bit step of ordered noise hides banding in soft shadows; it is a pure function of pixel and frame
  fragmentShader: `uniform sampler2D tex; uniform float uFrame; varying vec2 vUv;
    float hash(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
    void main() { vec3 c = texture2D(tex, vUv).rgb; c += (hash(vec3(gl_FragCoord.xy, mod(uFrame, 251.0))) - 0.5) / 510.0; gl_FragColor = vec4(c, 1.0); }`,
  depthTest: false, depthWrite: false,
});
const fsGeo = new THREE.PlaneGeometry(2, 2);
const accScene = new THREE.Scene(); accScene.add(new THREE.Mesh(fsGeo, accMat));
const outScene = new THREE.Scene(); outScene.add(new THREE.Mesh(fsGeo, outMat));

const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };

// ---- how far does anything move on screen while the shutter is open? (decides the number of sub frames)
const _p = new THREE.Vector3();
function probe() {
  scene.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  const out = new Map();
  scene.traverseVisible((o) => {
    if (!o.isMesh) return;
    if (o.material && o.material.opacity !== undefined && o.material.opacity <= 0.001) return;
    const g = o.geometry;
    if (g.drawRange.count === 0) return;
    if (!g.boundingBox) g.computeBoundingBox();
    const b = g.boundingBox, pts = new Float32Array(8);
    let on = false, i = 0;
    for (const [x, y] of [[b.min.x, b.min.y], [b.max.x, b.min.y], [b.max.x, b.max.y], [b.min.x, b.max.y]]) {
      _p.set(x, y, 0).applyMatrix4(o.matrixWorld).project(camera);
      const sx = (_p.x * 0.5 + 0.5) * W, sy = (_p.y * 0.5 + 0.5) * H;
      pts[i++] = sx; pts[i++] = sy;
    }
    const minX = Math.min(pts[0], pts[2], pts[4], pts[6]), maxX = Math.max(pts[0], pts[2], pts[4], pts[6]);
    const minY = Math.min(pts[1], pts[3], pts[5], pts[7]), maxY = Math.max(pts[1], pts[3], pts[5], pts[7]);
    on = maxX > 0 && minX < W && maxY > 0 && minY < H;
    out.set(o.id, { pts, on });
  });
  return out;
}
/** Largest on screen travel (output px) of any visible mesh corner between times tA and tB. */
export function motionBetween(update, tA, tB) {
  update(tA); const A = probe();
  update(tB); const B = probe();
  let max = 0;
  for (const [id, a] of A) {
    const b = B.get(id);
    if (!b || !(a.on || b.on)) continue;
    for (let i = 0; i < 8; i += 2) {
      // a corner that is far outside the frame at both ends says little about what the viewer sees
      const d = Math.hypot(Math.min(Math.abs(b.pts[i] - a.pts[i]), W), Math.min(Math.abs(b.pts[i + 1] - a.pts[i + 1]), H));
      if (d > max) max = d;
    }
  }
  return max;
}

/**
 * Render one output frame at time t (seconds).
 *   update(tk)  sets the whole scene and the camera for sub frame time tk (must be a pure function of tk)
 *   samples     sub frames averaged into the frame, or 'auto': enough that no moving edge steps more than
 *               about 1.2 px between sub frames (between minSamples and maxSamples). Each sub frame also
 *               carries a sub pixel jitter, so still frames get supersampled edges for free.
 *   shutter     open time as a fraction of the frame (0.5 = 180 degrees). Forward shutter: the frame covers
 *               [t, t + shutter / FPS), so a hard cut placed on a frame boundary stays a clean cut.
 * Returns the number of sub frames used.
 */
export function renderAt(t, frame, update, { samples = 'auto', shutter = 0.8, clear = 0xffffff, minSamples = 16, maxSamples = 256 } = {}) {
  if (samples === 'auto') {
    const travel = motionBetween(update, t, t + shutter / FPS);
    samples = Math.max(minSamples, Math.min(maxSamples, Math.ceil(travel / 1.2 / 8) * 8));
  }
  renderer.setRenderTarget(rtAccum);
  renderer.setClearColor(0x000000, 0);
  renderer.clear(true, false, false);
  for (let k = 0; k < samples; k++) {
    const tk = t + ((k + 0.5) / samples) * (shutter / FPS);
    update(tk);
    camera.setViewOffset(W, H, halton(k + 1, 2) - 0.5, halton(k + 1, 3) - 0.5, W, H);
    renderer.setRenderTarget(rtScene);
    renderer.setClearColor(clear, 1);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);
    accMat.uniforms.w.value = 1 / samples;
    renderer.setRenderTarget(rtAccum);
    renderer.render(accScene, fsCam);
  }
  camera.clearViewOffset();
  outMat.uniforms.uFrame.value = frame;
  renderer.setRenderTarget(null);
  renderer.render(outScene, fsCam);
  return samples;
}

// ---------------------------------------------------------------- camera
/** Place the camera: (x, y) is the world point at the centre of the frame, zoom 1 shows the design frame 1:1.
 *  roll in radians (positive turns the picture clockwise), tiltX / tiltY orbit the camera around the look point. */
export function setCamera({ x = 0, y = 0, zoom = 1, roll = 0, tiltX = 0, tiltY = 0 } = {}) {
  const d = CAM_D / zoom;
  const cx = Math.cos(tiltX), sx = Math.sin(tiltX), cy = Math.cos(tiltY), sy = Math.sin(tiltY);
  camera.position.set(x + d * sy * cx, y + d * sx, d * cy * cx);
  camera.up.set(Math.sin(roll), Math.cos(roll), 0);
  camera.lookAt(x, y, 0);
}

// ---------------------------------------------------------------- draw order
/** Everything is drawn back to front by renderOrder (materials do not use the depth buffer), so z is free
 *  to be used for true parallax. layer(obj, n) sets the order for an object and all its children. */
export function layer(obj, n) {
  obj.traverse((o) => { o.renderOrder = n + (o.userData.sub || 0); });
  return obj;
}

/** Materials in this film: no depth test, alpha blended. */
export const FLAT = { depthTest: false, depthWrite: false, transparent: true };

export { THREE };
