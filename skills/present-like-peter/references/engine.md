# Engine contract (template/src/engine.js)

One engine for every deck. Fix or extend it generically; never fork it per deck.

## Files

| File | Holds |
|---|---|
| `src/index.src.html` | all slides, HUD, notes and help panels, placeholders for inlining |
| `src/deck.css` | tokens and layout (see visual-system.md) |
| `src/engine.js` | navigation, steps, scaling, modes, counters, scene loop |
| `src/scenes.js` | canvas set pieces registered with `DECK.scene(name, def)` |
| `src/fonts/fonts.json` + font files | optional, inlined as data URIs by `build.py` |
| `build.py` | inlines everything into `dist/*.html` and runs the gates |

`python3 build.py --three path/to/three.min.js` inlines a classic (non-module) three.js build for decks with a WebGL world; the vendored file is exempt from the network scan because it is added after the scan.

## Stage

A fixed 1920 by 1080 design canvas scaled to fit the window with `translate() scale()` (never flex centering: flex squeezes the stage on narrow windows and clips the right edge). `<html data-fit="fill">` lets the stage grow to 1920 by up to 1260 so a 16:10 laptop has no letterbox; lay slides out from the centre or with flex so the extra height is harmless. `?fit=contain` forces 16:9.

## Slide markup

```html
<section class="slide" data-scene="field" data-steps="2" data-hold="3,3,5" data-theme="dark" aria-label="Cold open">
  <canvas class="fx"></canvas>              <!-- optional; the engine adds it when data-scene is set -->
  <div class="layer center">
    <p class="kicker" data-step="0">1997</p>
    <p class="word" data-step="1"><span data-count="90">0</span> days</p>
    <p class="sub" data-step="2" lang="en">from going bankrupt.</p>
    <p class="sub" data-step="2" lang="th">ก่อนล้มละลาย</p>
  </div>
  <aside class="notes"><p>Say: ...</p><p>Source: https://...</p></aside>
</section>
```

- `data-steps="N"`: builds after arrival, steps run 0 to N. Elements with `data-step="k"` get `.on` when the step is at least k; `data-until="k"` hides from step k.
- `data-hold`: seconds per step for autoplay.
- `data-theme`: `dark` or `light`, sets tokens for the slide and the page ground.
- `data-count="1234"` (optional `data-decimals`, `data-dur`): counts up when revealed, shows the final value in still, print and reduced motion.
- `lang="xx"` on any element plus `<html data-langs="en,th">`: L cycles all, en, th; `?lang=th` opens in one language. Bilingual decks show both by default and the presenter picks.

## Scenes

```js
DECK.scene('name', {
  init(ctx, { w, h, slide, rng }) {},           // optional, once at boot
  frame(ctx, { t, ts, step, w, h, final }) {},  // draw the whole frame from time alone
  until: 6,                                     // optional: stop the loop 6 s after the last step change
});
```
`t` is seconds since the slide arrived, `ts` since the current step, `final` is true in still, print and reduced motion. `final` means the end state of the **current step**, not of the slide: a scene that changes at step 1 must still draw its step 0 picture when `step` is 0 and `final` is true, or step stills and `STEPS=all` QA show the wrong frame (a real bug caught this way). A frame function must be a pure function of `(t, ts, step)` so stills and PDF pages match the live end state. Use `DECK.util.rng(seed)` for anything random. Only the current slide animates; hidden tabs stop the loop.

For a three.js world, create one renderer at boot on a canvas inside the slide (or one shared canvas for a continuous world), drive it from the same `deck:change` event (`addEventListener('deck:change', e => ...)`, detail `{ slide, step }`), render a final frame when `DECK.still` or `DECK.print` is true, and keep `NoToneMapping` so brand hex values reach the screen unchanged.

## Controls

| Input | Action |
|---|---|
| ArrowRight, ArrowDown, Space, PageDown, Enter, click on the right 80% | next step or slide |
| ArrowLeft, ArrowUp, PageUp, Backspace, click on the left 20% | previous (instant, no reverse animation) |
| Home, End | first, last |
| Swipe | over 40 px horizontally |
| N / P / F / L / H or ? / Esc | notes, autoplay, full screen, language, help, close panels |

Manual input pauses autoplay for 10 s. Autoplay loops from the last slide to the first.

## URL parameters

| Parameter | Effect |
|---|---|
| `?slide=N&step=M` | deep link (1-based slide, `step=final` for the last build); kept current with `replaceState` |
| `?autoplay=1`, `?pace=0.8` | autoplay on, hold multiplier 0.5 to 2 |
| `?notes=1` | open with notes |
| `?motion=reduced` | no motion: builds and counters jump to final, scenes draw their final frame |
| `?still=1` | final state of the given slide and step, no HUD, sets `window.DECK_STILL = 'ready'` (QA, posters) |
| `?print=1` | every slide stacked as a 1920 x 1080 page in final state, sets `window.DECK_PRINT = 'ready'` (PDF) |
| `?lang=xx`, `?fit=contain`, `?dpr=1` | language, force 16:9, cap pixel ratio |

## Debug handle

`window.DECK`: `go(i, k, { instant })` (0-based slide, `k = 999` for final), `next()`, `prev()`, `play()`, `pause()`, `steps(i)`, `count`, `state`, `still(i)`. `body[data-ready="1"]` marks boot complete. The QA and export scripts use only these.

## Accessibility and robustness

Every canvas is `aria-hidden`; each slide has an `aria-label`; copy is real HTML text, never baked into a canvas, so it scales, translates and is checked by QA. Reduced motion is honoured from the OS setting. If WebGL is missing, the copy must still carry the slide.
