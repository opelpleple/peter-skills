# Style recipe: Flat Cartoon (vector, flat fills, snappy overshoot)

Live demo: `https://peterbu.com/showcase/skills/video-like-peter/styles/flat-cartoon/` (`index.html` + `flat.js`,
built on the shared `_engine/stage.js` and `_engine/scene.js`). Poster: `poster.png` (t = 3.45: full title with its sparkles, hero settled on the slab; captured
headless at 1280x720 with `?ui=0&play=0&dpr=1` and `window.__render(3.45)`).

## 1. What defines the style

A flat cartoon frame reads at first glance because of four things: **solid colour shapes with no gradients**,
**one consistent ink outline on the foreground only**, **a small bold palette**, and **timing that snaps and
overshoots**. Everything else (smears, dust puffs, confetti) is a consequence of those rules.

### Palette (14 swatches, nothing else on screen)

| Role | Hex | Used for |
|---|---|---|
| Ink | `#22203a` | every foreground outline, pupils, title plate shadow, speed lines, the ground lip |
| Cream | `#fff4e0` | clouds, eye whites, highlights, dust puffs, sparkles, title sticker plate |
| Sky | `#ffd8a8` | base sky |
| Ray | `#ffcb91` | alternate sunburst wedges (a 2-tone of the sky) |
| Sun | `#ff8c5a` / ring `#ffa66e` | sun disc and its ring |
| Coral | `#f2545b` / dark `#c23b4a` | platform slab, cheeks, mouth, title letters |
| Yellow | `#ffc93c` / dark `#e99a2c` | hero character, column, title letters |
| Teal | `#2bb3a3` / light `#7fd1b9` / dark `#1f7a7a` | hills, trees, leaf, title letters, grass field and edge, pebbles |
| Deep | `#18505a` | thin scalloped soil strip at the bottom, cast shadows on the ground |

That is 14 swatches: ink, cream, 2 sky tones, 2 sun tones, and 3 hue families (coral 2, yellow 2, teal 3) plus
deep. Rule: each hue family is a short ramp of flat steps (2 or 3), and every swatch belongs to exactly one family.
Shading is done by stepping to the next swatch in the family, never by alpha, multiply or gradient. Cast shadows are a flat ellipse in the partner colour of the surface they fall on
(coral dark on the slab, deep on the ground).

### Shape language

- Circles, ellipses, rounded rectangles, sine-built hills, 4-point stars, triangles. No textures, no noise, no grain.
- Hero character: a squashy ellipse with a sprout, nub arms, bean feet, big eyes with a single catchlight.
  Volume comes from one flat shade crescent clipped inside the body plus one flat highlight sliver.
- Background is outline-free (depth cue), with one exception: a single ink band at the ground line (`groundY`).
  It is the contact line the foreground stands on, so it belongs to both layers. Foreground (character, platform,
  title, dust, confetti, smear) is outlined.
- Ground reads as grass, not road: a scalloped lighter edge hanging from the lip, irregular 2 to 3 stone pebble
  clusters, a few two-blade tufts, and only a thin scalloped strip of the darkest value at the very bottom. Rows
  of evenly spaced rounded dashes read as lane markings, and a tall dark band weighs the bottom of the frame.

### Line

- One base weight: `lw = max(2, H * 0.0062)` (about 4.5 px at 720p). Body, arms, feet, leaf, slab, column,
  smear, spin arcs, impact ticks and dust all use `lw`. The full set of multiples in the demo:

  | Element | Weight |
  |---|---|
  | body, limbs, leaf, slab, smear, dust, spin arcs, impact ticks | `1.0 lw` |
  | sprout stem | `1.2 lw` (a stroke with no fill, so slightly heavier to match filled shapes) |
  | speed lines | `0.9 lw` |
  | eyes, mouth, title sparkles | `0.8 lw` |
  | confetti | `0.6 lw` (tiny shapes; full weight would turn them into ink blobs) |
  | title letter outline | `1.8 lw`, inside a cream plate of `4.6 lw` with an ink plate outline of `6.4 lw` |
- `lineJoin = 'round'`, `lineCap = 'round'`. Ink colour is a very dark desaturated indigo, never pure black.

### Lighting

Implied only. A big sun disc plus sunburst behind the action, flat shade crescents bottom right on every
volume, highlights top left. No light falloff, no glow.

### Frame rate and stepping

Smooth 60 fps (`fps: null`). The cartoon feel comes from easing, not from stepping. If a storyboard asks for a
"TV animation on twos" variant, pass `fps: 12` to `mount()` and keep everything else identical.

### Timing and easing rules

- Pops use `ease.outBack(u, 2.6)` (strong overshoot) for scale; rotations settle with a softer `outBack(u, 1.6)`.
- Exits use an anticipation `inBack(u, 1.9)` (grows slightly, then collapses to zero). Never a plain fade:
  flat cartoon objects pop out of existence, they do not dissolve.
- Squash and stretch on every contact: read `pose(t).squash` (the engine computes it with `squashAt(t)`, and
  `pose` exposes it with `sx = 1 + s`, `sy = 1 - s`). Letters squash as they land with
  `sq = 0.18 * sin(min(1, 1.4 u) * pi)`, `sx = 1 + sq`, `sy = 1 - sq` (the `1.4` makes the squash finish before the
  pop settles).
- Secondary action: the sprout lags vertical speed, arms flail on falls and wave while celebrating, the
  platform dips with a damped cosine when the character lands.
- Holds are alive: title letters bob on a loop-periodic sine, sunburst turns exactly one wedge pair per loop.
- Make room instead of overlapping: when the hero spins up toward the title (3.5 to 4.1), the letters "dodge" up
  by `0.06 H` with an `outBack` rise and an `outBack` drop, most in the middle where the hero is. Together with
  a style-local `titleY - 0.03` and a `1.1x` title scale, the spin apex never crosses a letter.

### Camera

Locked off, centred, theatrical. The only camera move is a 0.22 s deterministic shake on the biggest landing
(`translate(sin(t*90)*k, cos(t*77)*k)` with `k` decaying to zero).

## 2. Technique (Canvas 2D, no Three.js)

Everything is Canvas 2D paths drawn back to front each frame from `render(t, ctx)`. Draw order:
sky, sunburst, sun, clouds, far hills + trees, near hills, ground, confetti, title, platform, cast shadow,
dust, smear, character. Confetti sits behind the title on purpose so pieces never land on letters.

Inked fill helper, used for every foreground shape:

```js
function inked(g, fill, lw) {
  g.fillStyle = fill; g.fill();
  g.lineWidth = lw; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke();
}
```

Flat shading by clipping (no gradient):

```js
ellipse(g, 0, 0, rx, ry); g.fillStyle = YELLOW; g.fill();
g.save(); ellipse(g, 0, 0, rx, ry); g.clip();
g.fillStyle = YELLOW_DK; ellipse(g, rx*0.35, ry*0.42, rx*1.05, ry*0.95); g.fill(); // shade
g.fillStyle = YELLOW;    ellipse(g, -rx*0.08, -ry*0.1, rx*0.96, ry*0.9); g.fill(); // carve back -> crescent
g.restore();
ellipse(g, 0, 0, rx, ry); g.stroke();  // outline last so it stays crisp
```

Outlined smear (the signature fast-move trick). Sample the pose a few hundredths of a second in the past and
build ONE tapered polygon from the body centre back along that path: half widths `0.78, 0.55, 0.3` of `r`, then a
point. Fill it yellow and ink it with `lw`, then draw the body on top. The wide end sits inside the body, so the
body hides the near outline and the smear fuses with the silhouette. (Fat round-capped strokes nearly as wide as
the body read as a second, bumpy body with a double outline crescent; taper hard.) It is a pure function of `t`.

```js
const prev = centre(t - 0.016);
const speed = dist(now, prev) / 0.016 / H;                    // stage heights per second
const edge = smoothstep(-0.07, 0, p.x) * (1 - smoothstep(0.98, 1.05, p.x)); // fade at stage edges
const amt = smoothstep(0.5, 1.5, speed) * edge;
const pts = [now, ...[0.04, 0.08, 0.12].map(d => centre(t - d * amt))];
const half = [0.78, 0.55, 0.3, 0.04].map(k => k * r);
// offset each point by +/- half[k] perpendicular to the local path direction,
// walk left side forward, right side back, closePath, fill YELLOW, stroke INK.
```

The `edge` factor matters for loops: the trail and speed lines reach back behind the body, so without it they
stay on screen for a frame after the body has left (a stub at the right edge at t = 5.999 that pops at the
wrap). Also clip the speed lines to the stage rect as a second guard.

Add three ink speed lines behind the velocity vector with length `~1.8 r * amt` (so they fade with `edge` too), and for spins draw two ink arcs
around the body whose angular span is proportional to angular velocity.

Merging dust puffs: draw all ink discs (radius + lw) first, then all cream discs. Overlapping puffs fuse into
one outlined cloud instead of a stack of rings.

Cast shadow on the slab: clip the flat ellipse to the slab's rounded rect, then restroke the slab outline.
Unclipped, the shadow hangs past the rounded end into the sky when the hero hops off the edge and covers the ink
top line. On the ground no clip is needed.

Title as a sticker. Compute every letter's transform first, then draw in passes across ALL letters (a per-letter
loop lets a later letter's plate cover the previous letter's outline):

1. ink `strokeText` at width `plateW + inkW`, once at a `0.06 size` offset (solid drop shadow) and once in place
   (plate outline);
2. cream `strokeText` at `plateW = 4.6 lw` (the plate; neighbouring plates merge into one word sticker);
3. ink `strokeText` at `inkW = 1.8 lw`, then `fillText` in the letter colour cycling coral, yellow, teal.

Tracking `0.085 * size` keeps neighbouring letter outlines apart (at `0.03` with a `2.2 lw` stroke they touched and
merged in "ven" and "ills"). The cream plate is what keeps coral letters readable over the orange sun; an ink
stroke alone is not enough contrast there. Font stack `"Arial Rounded MT Bold", "Arial Black", system-ui`
(installed locally on macOS, no web font fetch). Letters pop with `letterReveal()` stagger, drop slightly from
above, rotate from an alternating -/+ 0.7 rad to a resting tilt of +/- 0.07 rad.

Confetti: coral, teal and yellow only (cream pieces vanish against cream clouds), launched `0.5` to `1.25` rad off
vertical alternating left and right, so the burst frames the title rather than raining on it.

Character face: it rotates fully with the body. A full spin takes 0.6 s, so the few upside-down frames read as the
spin itself; counter-rotating the face drifts it off the body or flips it at the apex.

Determinism and loop: no `Math.random`; scattered detail uses `hash(i, seed)`. Background motion is periodic
in `DURATION` (sunburst turns `TAU / (N/2)` per loop with N = 16 wedges, clouds bob on `sin(TAU t / 6)`).

## 3. Applying it to any storyboard

1. Pick 3 hero hues plus their dark partners, a cream and an ink. Assign the warmest hue to the hero.
2. Sort every element into background (no outline, calmer colours) or foreground (inked, saturated).
3. Build each object from at most 5 primitives. If it needs more, simplify the silhouette.
4. For every appearance write a pop (`outBack` scale, overshoot 2 to 3); for every disappearance an `inBack`
   collapse. Replace fades with pops; reserve alpha for nothing.
5. For every move faster than ~0.5 stage heights per second, add the outlined smear and speed lines.
6. For every contact add squash, a dust puff pair and, on the main beat, impact ticks plus a short shake.
7. Keep a "live hold": something periodic (sunburst, bob, blink) so still beats never freeze.

## 4. Common failure modes

- **Gradients creeping in** (canvas `createLinearGradient`, CSS shadows, soft glows): kills the look instantly.
- **Mixed outline weights**: thin lines on small props next to thick lines on the hero reads as clip art. One `lw`.
- **Outlining the background**: flattens depth; the scene becomes a colouring book.
- **Alpha for shadows**: semi-transparent black over colours produces muddy off-palette tones. Use partner colours.
- **Smear without outline**: a plain yellow streak reads as motion blur (a different style). The ink pass matters.
- **Smear threshold too high**: compute speed in stage heights per second; this scene peaks around 1 to 2.
- **Dust as separate rings**: draw ink pass then fill pass so puffs merge.
- **Linear or ease-in-out pops**: flat cartoon needs overshoot; without it the motion feels corporate.
- **Speed lines leaking**: they extend far behind the body, so the last frame before the wrap can show a stub at
  the frame edge after the body has left. Fix with the `edge` fade on `amt` (body centre past `x > 1.05` or
  `x < -0.07` gives zero) plus a stage clip, then diff frame `5.999` against frame `0`.
- **Smear as a second body**: trail width near the body width with an ink pass everywhere gives a double outline.
  Taper to `0.78 r` at the body and let the body cover the near edge.
- **Unclipped contact shadows**: shadows on a raised surface must be clipped to that surface.
- **Hero crossing the title**: a shared arc can carry the hero through the word. Move or dodge the title in the
  style; do not draw the hero over unreadable letters.
- **Too many hue families**: the demo uses 14 swatches but only 3 hue families (plus ink, cream, sky, sun, deep).
  Adding a 4th hue family, or ramps longer than 3 steps, starts reading as an illustration, not a cartoon.

## 5. Reference search queries (YouTube / Vimeo)

1. `flat 2D character animation squash and stretch smear frames motion graphics`
2. `vector cartoon explainer animation bold limited palette outline style`
3. `animated smear frames tutorial after effects flat design character`
4. `kinetic typography pop overshoot cartoon title animation`
5. `2D motion design loop sunburst retro flat illustration animation`
