// stage.js: deterministic render(t) driver shared by every style page.
//
// The whole picture must be a pure function of t (seconds, 0 <= t < duration).
// The stage owns the clock, the canvas size, pausing and capture hooks; a style
// only supplies render(t, ctx).
//
//   import { mount } from './_engine/stage.js';
//   const stage = mount({ container, duration: 6, fps: null, render(t, ctx) { ... } });
//
// URL params (read once at mount):
//   ?t=2.5      freeze at that time (no clock)
//   ?play=0     start paused (at ?t or at 0)
//   ?fps=12     override fps stepping (0 or absent = continuous)
//   ?dpr=2      override device pixel ratio (clamped 0.5..3)
//
// Globals for capture tools:
//   window.__render(t)  renders that exact time synchronously, returns a Promise
//                       that resolves after the next animation frame
//   window.__ready      Promise resolved once setup() finished and frame 0 drew
//   window.__stages     every stage mounted on the page (last one drives __render)

const KEY_TIME = 4.2;

function readParams() {
  const q = new URLSearchParams(location.search);
  const num = (k) => (q.has(k) && q.get(k) !== '' && isFinite(+q.get(k)) ? +q.get(k) : null);
  return {
    t: num('t'),
    play: q.has('play') ? q.get('play') !== '0' && q.get('play') !== 'false' : null,
    fps: num('fps'),
    dpr: num('dpr'),
  };
}

function wrap(t, d) {
  const r = t % d;
  return r < 0 ? r + d : r;
}

export function mount(opts = {}) {
  const {
    duration = 6,
    fps: fpsOpt = null,
    render,
    setup = null,
    context = '2d',
    keyTime = KEY_TIME,
    maxDpr = 2,
    onResize = null,
  } = opts;
  if (typeof render !== 'function') throw new Error('stage.mount: render(t, ctx) is required');

  const params = readParams();
  const fps = params.fps != null ? (params.fps > 0 ? params.fps : null) : fpsOpt;
  const reduced =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Canvas: given, or created inside the container, or inside document.body.
  let canvas = opts.canvas || null;
  if (!canvas) {
    const host = opts.container || document.body;
    canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    host.appendChild(canvas);
  }

  const ctx = {
    canvas,
    g: context === '2d' ? canvas.getContext('2d') : null,
    w: 0, // CSS pixels
    h: 0,
    dpr: 1,
    pw: 0, // backing store pixels
    ph: 0,
    t: 0,
    frame: 0,
    duration,
    fps,
    reduced,
    playing: false,
    resized: true,
    data: {}, // free scratch space for the style (built once in setup)
  };

  // ---- sizing ----------------------------------------------------------
  function measure() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width || canvas.clientWidth || 640));
    const h = Math.max(1, Math.round(rect.height || canvas.clientHeight || 360));
    const dpr = Math.min(3, Math.max(0.5, params.dpr != null ? params.dpr : Math.min(maxDpr, window.devicePixelRatio || 1)));
    if (w === ctx.w && h === ctx.h && dpr === ctx.dpr) return false;
    ctx.w = w;
    ctx.h = h;
    ctx.dpr = dpr;
    ctx.pw = Math.round(w * dpr);
    ctx.ph = Math.round(h * dpr);
    canvas.width = ctx.pw;
    canvas.height = ctx.ph;
    ctx.resized = true;
    if (onResize) onResize(ctx);
    return true;
  }

  // ---- drawing ---------------------------------------------------------
  function quantize(t) {
    if (!fps) return t;
    return Math.floor(t * fps + 1e-6) / fps;
  }

  function draw(t) {
    const tt = quantize(wrap(t, duration));
    ctx.t = tt;
    ctx.frame = fps ? Math.round(tt * fps) : Math.round(tt * 60);
    if (ctx.g) {
      ctx.g.setTransform(ctx.dpr, 0, 0, ctx.dpr, 0, 0);
    }
    render(tt, ctx);
    ctx.resized = false;
  }

  // ---- clock -----------------------------------------------------------
  // The clock only advances while the stage is playing, visible and on screen,
  // so pausing never jumps the picture.
  let clock = params.t != null ? params.t : reduced ? keyTime : 0;
  const frozen = params.t != null || reduced;
  let wantPlay = frozen ? false : params.play != null ? params.play : true;
  let onScreen = true;
  let tabVisible = document.visibilityState !== 'hidden';
  let raf = 0;
  let last = 0;
  let ready = false;

  function active() {
    return ready && wantPlay && onScreen && tabVisible;
  }

  function tick(now) {
    raf = 0;
    if (!active()) {
      ctx.playing = false;
      return;
    }
    if (last) clock += Math.min(0.1, (now - last) / 1000); // cap long stalls
    last = now;
    clock = wrap(clock, duration);
    ctx.playing = true;
    if (measure()) { /* size changed, ctx.resized already set */ }
    draw(clock);
    raf = requestAnimationFrame(tick);
  }

  function kick() {
    if (!raf && active()) {
      last = 0;
      raf = requestAnimationFrame(tick);
    }
  }

  function stopLoop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    ctx.playing = false;
  }

  // ---- observers -------------------------------------------------------
  const ro = typeof ResizeObserver === 'function'
    ? new ResizeObserver(() => {
        if (measure() && !active() && ready) draw(clock);
      })
    : null;
  if (ro) ro.observe(canvas);
  else window.addEventListener('resize', () => { if (measure() && ready && !active()) draw(clock); });

  const io = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver((entries) => {
        onScreen = entries.some((e) => e.isIntersecting);
        if (onScreen) kick(); else stopLoop();
      }, { threshold: 0 })
    : null;
  if (io) io.observe(canvas);

  const onVis = () => {
    tabVisible = document.visibilityState !== 'hidden';
    if (tabVisible) kick(); else stopLoop();
  };
  document.addEventListener('visibilitychange', onVis);

  // ---- public controller ----------------------------------------------
  const api = {
    canvas,
    ctx,
    duration,
    fps,
    reduced,
    get time() { return ctx.t; },
    get playing() { return ctx.playing; },
    seek(t) {
      clock = wrap(+t || 0, duration);
      measure();
      draw(clock);
      return api;
    },
    play() {
      wantPlay = true;
      kick();
      return api;
    },
    pause() {
      wantPlay = false;
      stopLoop();
      return api;
    },
    toggle() {
      return wantPlay ? api.pause() : api.play();
    },
    renderAt(t) {
      // Capture path: always exact, never advances the clock.
      wantPlay = false;
      stopLoop();
      clock = wrap(+t || 0, duration);
      measure();
      draw(clock);
      return new Promise((res) => requestAnimationFrame(() => res(ctx.t)));
    },
    destroy() {
      stopLoop();
      if (ro) ro.disconnect();
      if (io) io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    },
  };

  const readyPromise = (async () => {
    measure();
    if (setup) await setup(ctx);
    ready = true;
    measure();
    draw(clock);
    kick();
    return api;
  })();
  api.ready = readyPromise;

  window.__stages = window.__stages || [];
  window.__stages.push(api);
  window.__ready = readyPromise.then(() => true);
  window.__render = (t) => readyPromise.then(() => api.renderAt(t));

  return api;
}

export const KEY_FRAME_TIME = KEY_TIME;
