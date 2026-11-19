# Style engine: contract

Every style page in `styles/<name>/index.html` performs the same 6 second scene, drawn its own way.
The engine gives it a deterministic clock (`stage.js`) and the shared choreography (`scene.js`).
Plain static files: no build step, no network at runtime. `three.module.min.js` (r170, MIT, see
`THREE-LICENSE.txt`) is vendored here for styles that need WebGL.

## Files

| File | What it is |
|---|---|
| `stage.js` | `mount()`: canvas sizing, DPR, clock, pause rules, URL params, capture hooks |
| `scene.js` | beat times, layout, easing, `pose(t)`, `titleState(t)`, `letterReveal()`, `face(t)`, helpers |
| `template.html` | minimal working style (2D canvas). Copy it to `styles/<name>/index.html` to start |
| `three.module.min.js` | three.js r170 ES module, import as `../_engine/three.module.min.js` |

## The one rule

The picture is a pure function of `t`. `render(t, ctx)` must not read `Date`, `performance.now()`,
`Math.random()` or keep state that changes per frame. Use `rng(seed)` or `hash(i, seed)` from `scene.js`
for random detail, and build heavy things once in `setup(ctx)`. Then `?t=`, `window.__render(t)` and
frame by frame capture always agree with live playback.

## stage.js

```js
import { mount } from '../_engine/stage.js';

const stage = mount({
  container,            // element to append a canvas to (or pass canvas: existingCanvas)
  duration: 6,          // loop length in seconds
  fps: null,            // number = step time to that rate (stop motion 12, pixel art 8); null = smooth
  context: '2d',        // '2d' gives ctx.g; 'none' leaves the canvas free for WebGL
  setup: async (ctx) => {},   // optional, awaited once before the first frame
  render(t, ctx) {},    // required
  onResize: (ctx) => {},      // optional, after the backing store changes size
  keyTime: 4.2,         // held frame under prefers-reduced-motion
  maxDpr: 2,            // DPR cap (URL ?dpr= overrides)
});
```

`ctx` passed to `render` and `setup`:

| Field | Meaning |
|---|---|
| `canvas` | the canvas |
| `g` | 2D context (already scaled by DPR, draw in CSS pixels) or `null` when `context: 'none'` |
| `w`, `h` | size in CSS pixels |
| `pw`, `ph`, `dpr` | backing store pixels and the ratio (WebGL: `renderer.setPixelRatio(ctx.dpr); renderer.setSize(ctx.w, ctx.h, false)`) |
| `t`, `frame` | current time and frame index (frame counts at `fps`, or at 60 when smooth) |
| `duration`, `fps`, `reduced` | settings; `reduced` is true under prefers-reduced-motion |
| `resized` | true on the first frame after a size change |
| `playing` | clock is running |
| `data` | scratch object for things built in `setup` |

Returned controller: `seek(t)`, `play()`, `pause()`, `toggle()`, `renderAt(t)` (Promise), `destroy()`,
`time`, `playing`, `ready` (Promise), `canvas`, `ctx`.

Behaviour:

- Loops seamlessly at `duration` (time wraps, never resets with a jump).
- Clock advances only while playing, on screen (IntersectionObserver) and the tab is visible; it resumes
  where it stopped. Long stalls are capped at 0.1 s per frame.
- `prefers-reduced-motion: reduce` shows a held key frame at `t = 4.2` and does not play.
- Resizes follow the canvas box (ResizeObserver) at `min(devicePixelRatio, maxDpr)`.

URL params:

| Param | Effect |
|---|---|
| `?t=2.5` | freeze at that time (clock does not run) |
| `?play=0` | start paused (at `?t` or 0) |
| `?fps=12` | override fps stepping (`?fps=0` forces smooth) |
| `?dpr=2` | override pixel ratio (0.5 to 3) |

Capture hooks (the last mounted stage drives them):

- `await window.__ready` resolves after `setup` and the first frame.
- `await window.__render(t)` renders exactly `t`, pauses the clock, resolves after the next animation frame
  (so a screenshot taken afterwards shows that frame).
- `window.__stages` lists every stage on the page.

## scene.js: the shared choreography

Normalised coordinates: `x` is a fraction of the stage width, `y` a fraction of the height (0 top),
radius `r` a fraction of the height. `pose(t)` gives the CONTACT point (bottom centre); the body centre is
`y - r * sy`. `toPx(pose, W, H)` converts to pixels (`cx, cy, rx, ry, r`, contact `x, y`).

| Time (s) | Beat (`BEATS`) | What happens |
|---|---|---|
| 0.00 to 0.55 | `enter` to `hop1Land` | character hops in from off screen left onto the floor |
| 0.60 to 1.20 | `hop2Start` to `land` | big hop onto the platform |
| 1.20 to 2.00 | `land` to `settle` | squash and settle (damped wobble) |
| 2.00 to 3.40 | `titleIn` to `titleDone` | title "Seven Skills" appears, each style its own way |
| 3.50 to 4.10 | `spinStart` to `spinLand` | celebration: spin hop (full turn) |
| 4.25 to 4.85 | `bounceStart` to `bounceLand` | small second bounce, title holds |
| 5.00 to 5.60 | `titleOut` to `titleGone` | title fades out |
| 5.15 to 6.00 | `exitHop1` to `exitHop2Land` | two hops off screen right |
| 4.20 | `keyFrame` | held frame (reduced motion, thumbnails) |

At `t = 0` and just before `t = 6` the character is off screen and the title is gone, so the loop is seamless.
Styles must keep anything else they draw (background drift, particles) periodic in `DURATION`.

`LAYOUT`: `groundY 0.8`, `charR 0.075`, `platform {x 0.5, y 0.66 (top), w 0.24 (of W), h 0.05 (of H)}`,
`titleY 0.3`, `titleSize 0.13`, plus hop x stations.

Exports:

| Export | Returns |
|---|---|
| `DURATION`, `TITLE`, `TITLE_WORDS`, `BEATS`, `LAYOUT`, `HOP_SEGMENTS`, `IMPACT_TIMES` | data |
| `pose(t)` | `{x, y, r, sx, sy, squash, rot, air, airborne, onPlatform, facing, visible, phase}` |
| `toPx(pose, W, H)` | `{x, y, cx, cy, rx, ry, r}` in pixels |
| `squashAt(t)` | signed squash (> 0 wide and short, < 0 stretched); `sx = 1 + s`, `sy = 1 - s` |
| `hopArc(u, p0, p1, h)` | point on a parabolic hop |
| `titleState(t)` | `{inP, outP, alpha, held, visible}` |
| `letterReveal(t, i, n, {spread, a, b})` | staggered 0..1 for unit `i` of `n` inside the title window |
| `face(t)` | `{blink, smile, look, lookUp}` |
| `impactPulse(t, width)` | 0..1 pulse after each landing (dust, flash, shake) |
| `celebrateBurst(t)` | 0..1 from the spin landing to 5.0 (confetti, sparks) |
| `phaseAt(t)` | `'enter' | 'land' | 'title' | 'celebrate' | 'exit'` |
| `ease.*` | `linear, inQuad, outQuad, inOutQuad, inCubic, outCubic, inOutCubic, inOutSine, outBack, outElastic, outBounce` |
| `clamp, lerp, prog, within, smoothstep, rng, hash` | math helpers |

## Making a new style

1. Copy `template.html` to `styles/<name>/index.html` (imports use `../_engine/...`, so they work unchanged).
2. Change the label and `render`. Keep every beat from `scene.js`; restyle freely.
3. Stepped styles (stop motion, pixel, toy brick): pass `fps`. WebGL styles: `context: 'none'`, build the
   renderer and scene in `setup`, render the frame in `render`.
4. Original designs only: no existing characters, games, shows or brand looks.
5. No em dash or en dash characters in any file.
6. Check: open with `?t=0`, `?t=4.2`, `?t=5.999`, and run `window.__render(t)` twice on the same `t`
   to confirm identical pixels.

Serve the folder over HTTP to test (ES modules do not load from `file://`), for example
`python3 -m http.server 4471 --directory styles`.
