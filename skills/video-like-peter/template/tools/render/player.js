// Real-time preview harness for MV pages, used only when a person opens the page in a normal browser
// (it does nothing under the renderer, which adds ?render=1). It plays the sound track and calls
// MV.renderFrame(floor(audio.currentTime * fps)), skipping frames when a frame takes longer than real time.
// Without a sound track (file missing) it plays on the wall clock instead.
//   import { attachPlayer } from '/tools/render/player.js';
//   attachPlayer(window.MV, { audio: '/audio/mix.wav', stage: optionalRootElement });
// URL: ?t=42.5 or ?f=1275 opens at that time/frame.  Keys: space play/pause, left/right 1 frame
// (shift: 1 s), home/end, [ ] = 1 beat-ish (0.5 s). The bar shows time, frame and preview fps.
export function attachPlayer(MV, { audio = '/audio/mix.wav', stage = null } = {}) {
  const P = new URLSearchParams(location.search);
  if (P.has('render')) return null;
  const fps = MV.fps, frames = MV.frames;
  const root = stage || MV.canvas;
  const style = document.createElement('style');
  style.textContent = `
    .mvp-bar { position: fixed; left: 0; right: 0; bottom: 0; height: 44px; display: flex; gap: 12px; align-items: center;
      padding: 0 12px; background: rgba(12,10,18,0.92); color: #ddd; font: 13px ui-monospace, monospace; z-index: 99999; }
    .mvp-bar button { font: inherit; background: #2a2340; color: #fff; border: 1px solid #554; border-radius: 4px; padding: 4px 10px; cursor: pointer; }
    .mvp-bar input[type=range] { flex: 1; }
    .mvp-fit { position: fixed; left: 0; top: 0; width: 100vw; height: calc(100vh - 44px); object-fit: contain; background: #000; }`;
  document.head.appendChild(style);
  if (root && root.tagName === 'CANVAS') root.classList.add('mvp-fit');
  else if (root) {
    const fit = () => { const s = Math.min(innerWidth / MV.width, (innerHeight - 44) / MV.height); root.style.transformOrigin = '0 0'; root.style.transform = `scale(${s})`; };
    addEventListener('resize', fit); fit();
  }
  const bar = document.createElement('div');
  bar.className = 'mvp-bar';
  bar.innerHTML = '<button data-k="play">play</button><span data-k="tc">00:00.000</span><input data-k="seek" type="range" min="0" step="1"><span data-k="info"></span>';
  document.body.appendChild(bar);
  const $ = (k) => bar.querySelector(`[data-k="${k}"]`);
  const seek = $('seek');
  seek.max = String(frames - 1);
  const au = new Audio(audio);
  au.preload = 'auto';
  let silent = false, wall0 = 0, wallF = 0;           // wall clock fallback when the sound track is missing
  au.addEventListener('error', () => { silent = true; });
  const nowF = () => (silent ? wallF + ((performance.now() - wall0) / 1000) * fps : au.currentTime * fps);
  let shown = -1, want = 0, busy = false, playing = false, rendered = 0, t0 = performance.now();
  const clampF = (f) => Math.max(0, Math.min(frames - 1, Math.round(f)));
  const label = () => {
    const t = shown / fps;
    $('tc').textContent = `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(3).padStart(6, '0')}`;
    $('info').textContent = `f ${shown} / ${frames - 1}`;
    seek.value = String(shown);
  };
  async function show(f) {
    want = clampF(f);
    if (busy) return;
    busy = true;
    try {
      while (shown !== want) { const g = want; await MV.renderFrame(g); shown = g; rendered++; label(); }
    } catch (e) { console.error(e); } finally { busy = false; }
  }
  function setPlaying(p) {
    playing = p;
    $('play').textContent = p ? 'pause' : 'play';
    if (p) { wallF = Math.max(0, shown); wall0 = performance.now(); if (!silent) { au.currentTime = wallF / fps; au.play().catch(() => { silent = true; }); } rendered = 0; t0 = performance.now(); }
    else au.pause();
  }
  function tick() {
    if (playing) {
      show(Math.floor(nowF()));
      const el = (performance.now() - t0) / 1000;
      if (el > 1) $('info').textContent = `f ${shown} / ${frames - 1}   preview ${(rendered / el).toFixed(1)} fps`;
      if (silent ? nowF() >= frames - 1 : au.ended) setPlaying(false);
    }
    requestAnimationFrame(tick);
  }
  $('play').onclick = () => setPlaying(!playing);
  seek.oninput = () => { if (playing) setPlaying(false); show(Number(seek.value)); };
  addEventListener('keydown', (e) => {
    const step = e.shiftKey ? fps : 1;
    if (e.code === 'Space') { e.preventDefault(); setPlaying(!playing); }
    // step from the last requested frame, so quick presses during a slow render are not lost
    else if (e.code === 'ArrowRight') { setPlaying(false); show(want + step); }
    else if (e.code === 'ArrowLeft') { setPlaying(false); show(want - step); }
    else if (e.code === 'BracketRight') { setPlaying(false); show(want + fps / 2); }
    else if (e.code === 'BracketLeft') { setPlaying(false); show(want - fps / 2); }
    else if (e.code === 'Home') { setPlaying(false); show(0); }
    else if (e.code === 'End') { setPlaying(false); show(frames - 1); }
  });
  const start = P.has('f') ? Number(P.get('f')) : P.has('t') ? Number(P.get('t')) * fps : 0;
  Promise.resolve().then(() => Promise.resolve(MV.ready)).then(() => { show(start); requestAnimationFrame(tick); });
  return { show, play: () => setPlaying(true), pause: () => setPlaying(false) };
}
