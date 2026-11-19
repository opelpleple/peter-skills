/* present-like-peter deck engine. Generic, offline, no dependencies.
   Contract: see references/engine.md in the skill. Exposes window.DECK. */
(() => {
'use strict';
const Q = new URLSearchParams(location.search);
const root = document.documentElement;
const W = 1920, BASE_H = 1080;
const reduced = Q.get('motion') === 'reduced' || matchMedia('(prefers-reduced-motion: reduce)').matches;
const still = Q.get('still') === '1';
const print = Q.get('print') === '1';
const pace = Math.min(2, Math.max(0.5, +Q.get('pace') || 1));
const dpr = Math.min(+Q.get('dpr') || 2, window.devicePixelRatio || 1);

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => { t = clamp(t, 0, 1); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const easeOut = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

const scenes = {};
const DECK = window.DECK = {
  scene(name, def) { scenes[name] = def; },
  util: { clamp, lerp, ease, easeOut, rng },
  reduced, still, print,
};

let stage, slides = [], n = 0, H = BASE_H, cur = 0, step = 0, stepAt = 0, slideAt = 0;
let playing = false, holdTimer = 0, raf = 0, lang = 'all';
const langs = (root.dataset.langs || '').split(',').map(s => s.trim()).filter(Boolean);
const steps = i => +slides[i].dataset.steps || 0;
const holds = i => (slides[i].dataset.hold || '').split(',').map(Number);
const sceneOf = i => scenes[slides[i].dataset.scene];

/* ---------------------------------------------------------------- canvases */
function sizeCanvas(sl) {
  const c = sl.querySelector(':scope > canvas.fx'); if (!c) return;
  c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
  const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  sl._ctx = ctx;
}
function drawScene(i, final) {
  const sl = slides[i], sc = sceneOf(i); if (!sc || !sl._ctx) return;
  const now = performance.now();
  const t = final ? 99 : (now - slideAt) / 1000, ts = final ? 99 : (now - stepAt) / 1000;
  sl._ctx.clearRect(0, 0, W, H);
  sc.frame(sl._ctx, { t, ts, step: i === cur ? step : steps(i), w: W, h: H, final, slide: sl });
}
function loop() {
  raf = 0;
  if (document.hidden || still || reduced || print) return;
  drawScene(cur, false);
  const sc = sceneOf(cur);
  if (sc && !(sc.until && (performance.now() - stepAt) / 1000 > sc.until)) raf = requestAnimationFrame(loop);
}
function kick() { if (!raf && !still && !reduced && !print) raf = requestAnimationFrame(loop); }

/* -------------------------------------------------------------------- fit */
function fit() {
  if (print) return;
  const vw = innerWidth, vh = innerHeight;
  const fill = root.dataset.fit === 'fill' && Q.get('fit') !== 'contain';
  const h = fill ? Math.round(clamp(W * vh / vw, BASE_H, 1260)) : BASE_H;
  if (h !== H) { H = h; root.style.setProperty('--H', H + 'px'); slides.forEach(sizeCanvas); drawScene(cur, still || reduced); }
  const s = Math.min(vw / W, vh / H);
  stage.style.transform = `translate(${(vw - W * s) / 2}px,${(vh - H * s) / 2}px) scale(${s})`;
}

/* ------------------------------------------------------------- counters */
function runCount(el, final) {
  const to = +el.dataset.count, dec = +(el.dataset.decimals || 0);
  const fmt = v => v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  if (final) { el.textContent = fmt(to); return; }
  const t0 = performance.now(), dur = +(el.dataset.dur || 1.4) * 1000;
  const tick = now => { const k = easeOut((now - t0) / dur); el.textContent = fmt(to * k); if (k < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}

/* -------------------------------------------------------------- navigate */
function apply(sl, k, instant) {
  sl.classList.toggle('instant', !!instant);
  sl.querySelectorAll('[data-step]').forEach(e => {
    const on = +e.dataset.step <= k, was = e.classList.contains('on');
    e.classList.toggle('on', on);
    if (on && !was) e.querySelectorAll('[data-count]').forEach(c => runCount(c, instant || still || reduced));
    if (on && !was && e.hasAttribute('data-count')) runCount(e, instant || still || reduced);
  });
  sl.querySelectorAll('[data-until]').forEach(e => e.classList.toggle('gone', k >= +e.dataset.until));
  sl.querySelectorAll(':scope [data-count]:not([data-step] [data-count]):not([data-step])').forEach(c => runCount(c, true));
  if (instant) requestAnimationFrame(() => requestAnimationFrame(() => sl.classList.remove('instant')));
}
function go(i, k = 0, o = {}) {
  i = clamp(i | 0, 0, n - 1);
  k = k >= 999 ? steps(i) : clamp(k | 0, 0, steps(i));
  const newSlide = i !== cur || !slides[i].classList.contains('active');
  if (newSlide) { slides[cur].classList.remove('active'); slides[i].classList.add('active'); slideAt = performance.now(); }
  cur = i; step = k; stepAt = performance.now();
  apply(slides[i], k, o.instant || still || reduced);
  root.dataset.theme = slides[i].dataset.theme || 'dark';
  hud(); showNotes();
  if (!still && !print) { const u = new URL(location); u.searchParams.set('slide', i + 1); u.searchParams.set('step', k); history.replaceState(null, '', u); }
  if (still || reduced || o.instant) drawScene(i, true); else kick();
  schedule();
  dispatchEvent(new CustomEvent('deck:change', { detail: { slide: i + 1, step: k } }));
}
function next() {
  if (step < steps(cur)) go(cur, step + 1);
  else if (cur < n - 1) go(cur + 1, 0);
  else if (playing) go(0, 0);
}
function prev() {
  if (step > 0) go(cur, step - 1, { instant: true });
  else if (cur > 0) go(cur - 1, 999, { instant: true });
}
function schedule() {
  clearTimeout(holdTimer);
  if (!playing) return;
  const h = (holds(cur)[step] || 4) * pace;
  holdTimer = setTimeout(next, h * 1000);
}
function setPlay(v) { playing = v; root.classList.toggle('playing', v); schedule(); hud(); }

/* ------------------------------------------------------- hud, notes, lang */
function hud() {
  const c = document.getElementById('counter'), p = document.getElementById('progress');
  if (c) c.textContent = `${cur + 1} / ${n}${playing ? '  ▶' : ''}`;
  if (p) p.style.width = `${((cur + (steps(cur) ? step / (steps(cur) + 1) : 0)) / Math.max(1, n - 1)) * 100}%`;
}
function showNotes() {
  const box = document.querySelector('#notes .body'); if (!box) return;
  const a = slides[cur].querySelector('aside.notes');
  box.innerHTML = a ? a.innerHTML : '<p>No notes on this slide.</p>';
}
function setLang(l) {
  lang = l; root.dataset.lang = l;
  const tag = document.getElementById('deck-lang') || Object.assign(document.head.appendChild(document.createElement('style')), { id: 'deck-lang' });
  tag.textContent = l === 'all' ? '' : langs.filter(x => x !== l).map(x => `#stage [lang="${x}"]`).join(',') + '{display:none!important}';
}

/* ---------------------------------------------------------------- input */
function bind() {
  addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter'].includes(k)) { e.preventDefault(); pauseByHand(); next(); }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) { e.preventDefault(); pauseByHand(); prev(); }
    else if (k === 'Home') go(0, 0, { instant: true });
    else if (k === 'End') go(n - 1, 999, { instant: true });
    else if (k === 'n' || k === 'N') document.getElementById('notes')?.classList.toggle('show');
    else if (k === 'p' || k === 'P') setPlay(!playing);
    else if (k === 'f' || k === 'F') { (document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen?.())?.catch?.(() => {}); }
    else if (k === 'h' || k === 'H' || k === '?') document.getElementById('help')?.classList.toggle('show');
    else if ((k === 'l' || k === 'L') && langs.length) { const all = ['all', ...langs]; setLang(all[(all.indexOf(lang) + 1) % all.length]); }
    else if (k === 'Escape') document.querySelectorAll('#notes,#help').forEach(x => x.classList.remove('show'));
  });
  let tx = 0, ty = 0;
  addEventListener('touchstart', e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
  addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { pauseByHand(); dx < 0 ? next() : prev(); e.preventDefault(); }
  });
  stage.addEventListener('click', e => {
    if (e.target.closest('a,button,input,[data-noclick]')) return;
    pauseByHand(); e.clientX < innerWidth * 0.2 ? prev() : next();
  });
  addEventListener('resize', fit);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
}
let resumeTimer = 0;
function pauseByHand() {
  if (!playing) return;
  setPlay(false); clearTimeout(resumeTimer);
  resumeTimer = setTimeout(() => setPlay(true), 10000);
}

/* ----------------------------------------------------------------- boot */
async function boot() {
  stage = document.getElementById('stage');
  slides = [...stage.querySelectorAll('.slide')]; n = slides.length;
  DECK.count = n;
  root.classList.toggle('reduced', reduced);
  document.body.classList.toggle('still', still);
  document.body.classList.toggle('print', print);
  setLang(Q.get('lang') && (Q.get('lang') === 'all' || langs.includes(Q.get('lang'))) ? Q.get('lang') : 'all');
  try { await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]); } catch (e) {}
  slides.forEach(sl => {
    if (sl.dataset.scene && !sl.querySelector(':scope > canvas.fx')) {
      const c = document.createElement('canvas'); c.className = 'fx'; c.setAttribute('aria-hidden', 'true'); sl.prepend(c);
    }
    sizeCanvas(sl);
    const sc = scenes[sl.dataset.scene]; if (sc?.init) sc.init(sl._ctx, { w: W, h: H, slide: sl, rng });
  });
  if (print) {
    slides.forEach((sl, i) => { sl.classList.add('active'); apply(sl, steps(i), true); });
    cur = 0; slides.forEach((_, i) => { step = steps(i); drawScene(i, true); });
    window.DECK_PRINT = 'ready'; document.body.dataset.ready = '1'; return;
  }
  bind(); fit();
  const s0 = clamp((+Q.get('slide') || 1) - 1, 0, n - 1);
  const k0 = Q.get('step') === 'final' ? 999 : +Q.get('step') || 0;
  go(s0, k0, { instant: true });
  if (!still && !reduced) { slideAt = stepAt = performance.now(); kick(); }
  if (Q.get('notes') === '1') document.getElementById('notes')?.classList.add('show');
  if (Q.get('autoplay') === '1' && !still) setPlay(true);
  if (!still && !Q.get('slide')) { const hl = document.getElementById('hint'); if (hl) { hl.classList.add('show'); setTimeout(() => hl.classList.remove('show'), 4000); } }
  Object.assign(DECK, { go, next, prev, play: () => setPlay(true), pause: () => setPlay(false), still: i => drawScene(i ?? cur, true), steps });
  Object.defineProperty(DECK, 'state', { get: () => ({ slide: cur + 1, step, playing, lang }), configurable: true });
  if (still) window.DECK_STILL = 'ready';
  document.body.dataset.ready = '1';
}
Object.assign(DECK, { go: (...a) => go(...a) });
addEventListener('load', boot);
})();
