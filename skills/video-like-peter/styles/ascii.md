# Style recipe: ASCII Terminal (character grid render, phosphor glow, CRT)

Live demo: `https://peterbu.com/showcase/skills/video-like-peter/styles/ascii/` (`index.html` + `ascii.js`, built on the
shared `_engine/stage.js` and `_engine/scene.js`). Poster: `poster.png` (t = 2.8: "Seven" locked in amber ASCII banner letters,
"Sk" still decoding as green noise with the block cursor riding after it, the hero settled on the green slab with white
eyes, pink cheeks and a `\_/` smile, the prompt line typed left aligned under the title start). Captured headless at 1280x720 with `?ui=0&play=0&dpr=1` and `window.__render(2.8)`.
Add `?crt=0` to switch off scanlines, grain, rolling band and vignette.

## 1. What defines the style

A frame reads as "ASCII" at first glance because the whole picture lives on **one fixed character grid**: every cell is
exactly one printable glyph (or empty) in one phosphor colour, nothing is drawn between cells, and shading is done by
**glyph density**, not by alpha. Then the tube sells it: **glow halos that bleed between neighbours, scanlines, a soft
vignette and a little flicker**. Terminal furniture (a box drawn border, status bars, a typed prompt, a block cursor)
finishes the read.

### Grid

- 200 columns x 68 rows for 16:9 (cell aspect about 1 : 1.65, close to a real monospace cell). The grid is fixed; the
  cell size in pixels follows the canvas, so the composition is identical at 720p, 1080p and 4K.
- Everything (positions, title, HUD) is computed in grid space. Motion therefore snaps to cells, which is the look: the
  hero glides in whole cell steps even at 60 fps.

### Palette (15 entries, three phosphors plus accents, on near black)

| Role | Hex |
|---|---|
| Tube background (radial, centre to edge) | `#061209` to `#010302`, base fill `#020504` |
| Green phosphor ramp (world: floor grid, slab, prompt, HUD) | `#0d3b1c` `#167a35` `#24b84d` `#46ff78` `#c4ffd2` |
| Amber phosphor ramp (hero, title) | `#5a3300` `#9a5c00` `#e08e00` `#ffb83a` `#ffe6b0` |
| Cyan phosphor ramp (far sky: stars, moon, ridge, haze) | `#123f48` `#2f8fa3` `#6fe8ff` |
| Pink accent (antenna tip, cheeks, a share of sparks) | `#ff5f8f` |
| White (glints, lock flash, glint sweep) | `#ffffff` |

Rules: hue encodes depth and role. Cyan = far, green = world and UI, amber = the subject and the words. The subject is the
only warm thing on screen, so the eye lands on it in any frame. Each ramp has a faint step used for ghosts, extrusion and
fills, so value contrast does the depth work without ever blending colours.

### Shape language

- **Density ramp for tone**: `' .:-=+*#%@'` for general shading; the hero uses a rounder ramp `'.:;+*oO%#@'` so the ball
  reads soft. Lambert plus a tight specular (power 24) on an analytic sphere decides the ramp index.
- **Edge glyphs by direction and row band**: the outline is every inside cell that has an outside 4-neighbour (exactly
  one cell thick). Its glyph comes from the screen space direction `(ca, sa)` of the cell from the body centre, split into
  row bands so the outline curves like hand drawn ASCII:
  `sa < -0.86` or `sa > 0.86` gives `_` (top and bottom lids); `-0.86..-0.34` gives `/` on the left and `\` on the right;
  `-0.34..0.34` gives `(` `)`; `0.34..0.86` gives `\` on the left and `/` on the right. The top and bottom rows taper by
  themselves because their outer cells fall into the diagonal bands, so the ball reads `/____\` over `(  )` over `\____/`.
  This one trick is what makes ASCII look drawn instead of thresholded.
- **Face as stamped cells, not carved ellipses**: eyes, cheeks and mouth are stamped after the body is shaded, at cells
  snapped from body local anchors (rotation applied), so both eyes always come out identical. Each eye is a 4 x 2 empty
  socket with a 2 x 2 white core `O'` over `@@` (the `'` is the glint) at body local x = +-0.4, y = -0.12 (unit radii).
  A blink replaces the core with `--` in mid amber. Cheeks are two pink cells (`*.`, `**` when smiling) at x = +-0.62,
  y = 0.2 in every phase. The mouth is `\_/` (`\___/` when smiling) in mid amber `#ffb83a` on its own carved row at
  y = 0.36, with one empty cell either side so it separates from the body glyphs.
- **Slope aware lines**: the far ridge picks `_` `/` `\` per column from the curve slope in rows per column; floor grid
  verticals pick `|` `/` `\` `_` from their screen slope, crossings are `+`, horizontal rails `=` near and `-` far.
- **Title as ASCII banner**: the text is rasterised once into a supersampled mask (4x4 samples per cell, squashed by the cell
  aspect), coverage becomes `@ # %` inside and `[ ] _ " / \` on edges (from the coverage gradient), plus a one cell
  down right extrusion in `:` faint amber. Vertical colour bands top to bottom: `#ffe6b0`, `#ffb83a`, `#e08e00`.
- **Terminal furniture**: a `+---+` border inset one cell from every edge (row 1, row 66, column 1, column 198) in
  `#24b84d`, with labels sitting on it in `#46ff78`: `[ tty7 :: hop.sys ]` and `[ T+02.80 ]` in the top bar,
  `[ phase: TITLE ]`, a signal meter that jumps on landings, and `frame 0168/0360` in the bottom bar. Labels clear the
  cells under their spaces so the border dashes do not run through the words. All derived from `t`.

### Line and texture

- No vector lines at all. A "line" is a run of cells with a stroke glyph.
- Phosphor halo: each glyph in the atlas is drawn twice, once with `shadowBlur = 1.1 * cellW` at 55% alpha, once crisp.
  Glyphs are stamped with `globalCompositeOperation = 'lighter'`, so halos of neighbours add up into soft light.
- Bloom: the glyph layer is downsampled 8x and drawn back additively at 0.55 alpha.
- CRT: 1 px dark scanline every 3 CSS px (drawn in backing pixels), a rolling refresh band (period 3 s, two per loop),
  2.5% grain that jumps at 24 fps, a soft radial vignette (clear to 0.4 H, 30% black at 70% of the radius, 48% at
  0.66 W) so the corner HUD stays legible, global flicker 0.93 to 1.0 from integer loop frequencies.

### Lighting

One key light from the upper left on every lit object (hero, moon, slab), so the dense `@ #` side faces the same way
everywhere. The slab's top rail is the brightest green (`#c4ffd2`) because it is the stage; the floor fades with depth.

### Frame rate and stepping

- Render at display rate (smooth clock, `fps: null`). The grid already quantises space, so extra time stepping would make
  it feel broken rather than retro.
- Glitter that should feel "digital" steps on its own clock inside the pure function: decoding scramble at 30 steps per
  second (`floor(t*30)` as the hash seed), hover beams at 12, cursor and antenna blink at 2 Hz (`floor(t*4) % 2`),
  grain at 24. All are integer rates over the 6 s loop, so the loop stays seamless.

### Timing and easing rules

- Typing is the signature move. After the landing (1.28 to 1.92 s) the prompt `> ./seven_skills --run` types at even speed
  with a block cursor at its end. It sits on row `0.418 * ROWS`, left aligned one cell after the title's first column,
  so it is clear of the spin apex at x 0.5 and the `[ OK ]` payoff is never covered.
- Title (2.0 to 3.4 s): each letter uses `letterReveal(t, i, n, { spread: 0.8 })`. While its reveal is 0..1 the letter's
  cells show random scramble glyphs in green, appearing progressively (a cell shows once `hash(cell) < r + 0.25`); at
  `r = 1` the letter locks to its banner glyphs in amber with a 90 ms white flash. A tall block cursor rides one advance
  after the last started letter, green while typing, amber and blinking once held.
- At `titleDone` the prompt prints `  [ OK ]` and a diagonal white glint sweeps the title over 0.7 s.
- Exit (5.0 to 5.6 s, `out = prog(t, titleOut, titleGone)`, ending exactly on the shared beat): title cells fall on their
  own seeded schedule (`go = (out - hash*0.5)/0.5`, drop `go^2 * 30` rows so the fall is visible) and thin out fast
  (a cell is skipped when `hash(cell + step) < go * 0.95`); the prompt backspaces to nothing by 5.6 s.
- Impacts: a `~` ring expands across the floor (ellipse flattened 0.45 for perspective) or two `~` run along the slab top;
  the hard landing at 1.2 s shakes the whole grid by one cell horizontally and half a cell vertically
  (`y` offset is `shake * 0.5`) and glitches random rows sideways for 0.12 s. Smaller
  row glitches at the title lock and at the exit.
- Phosphor persistence: two analytic ghosts of the hero at `t - 0.035` (`:` dim amber) and `t - 0.07` (`.` faintest
  amber). Each ghost draws only its trailing rim: cells with ghost distance 0.7 to 1.0, that the current body does not
  cover (current distance above 1.12), thinned to half with `hash(cell) < 0.5`. A filled ghost disk reads as a wall of
  colons, not a trail. This fakes CRT trails without keeping any state.

### Camera

Locked off, frontal, like looking at a monitor. The only "camera" moves are the one cell shake and the row glitches.
Depth comes from the perspective floor grid (vanishing line at y 0.56), the cyan far layer and the ghosting.

## 2. Technique (Canvas 2D, a cell buffer, a glyph atlas)

No WebGL. Two Uint8Arrays (`glyph`, `color`, one entry per cell) are filled every frame by layer functions in painter's
order, then stamped from a pre-rendered atlas.

```js
const COLS = 200, ROWS = 68, N = COLS * ROWS;
const glyph = new Uint8Array(N), color = new Uint8Array(N);
function put(i, j, ch, col) {
  if (i < 0 || j < 0 || i >= COLS || j >= ROWS) return;
  const k = j * COLS + i; glyph[k] = typeof ch === 'string' ? GI[ch] : ch; color[k] = col;
}
```

Layer order: sky (stars, haze, moon, ridge) > floor grid > slab > hero shadow > ripples > hero ghosts > title > hero >
sparks > prompt and cursor > HUD. Ghosts go before the words so they never overwrite title or prompt glyphs; the hero
draws over the title on purpose (its antenna passes the word gap at the spin apex); the prompt draws after the hero and
sparks so `[ OK ]` always lands clean. When the hero hovers over the slab its shadow on the top rail is `=` in
`#24b84d` (a shaded rail), never `_` in a faint colour, which reads as a hole.

Shading a sphere per cell (the hero, the moon):

```js
const ux = rx / q.rx, uy = ry / q.ry, d2 = ux*ux + uy*uy;      // body local, rotation undone
if (d2 > 1) continue;
const nz = Math.sqrt(1 - d2);
const l = clamp(nxs * -0.55 + nys * -0.62 + nz * 0.56);        // normal rotated back to screen
const spec = Math.pow(clamp(nxs * -0.4 + nys * -0.5 + nz * 0.77), 24);
const v = clamp(0.25 + l * 0.62 + spec * 0.4, 0, 0.999);
put(i, j, GI[BODY[Math.floor(v * BODY.length)]], spec > 0.4 ? A4 : l > 0.62 ? A3 : l > 0.3 ? A2 : A1);
```

Glyph atlas, rebuilt only when the cell size or DPR changes (one row per palette colour, one column per glyph; slot 0
is a solid block for cursors):

```js
g.font = `600 ${ch * 0.86 * dpr}px Menlo, "SF Mono", ui-monospace, monospace`;
g.textAlign = 'center'; g.textBaseline = 'middle';
g.shadowColor = hex; g.shadowBlur = cw * 1.1 * dpr; g.globalAlpha = 0.55; g.fillText(s, cx, cy); // halo
g.shadowBlur = 0; g.globalAlpha = 1; g.fillText(s, cx, cy);                                      // core
```

Stamping, padded so halos overlap neighbours:

```js
g.globalCompositeOperation = 'lighter';
for (let j = 0; j < ROWS; j++) {
  const off = rowShift(j, t) + shake;                       // glitch and shake, both pure functions of t
  for (let i = 0; i < COLS; i++) {
    const k = j * COLS + i; if (!glyph[k]) continue;
    g.drawImage(atlas, slot * sw, color[k] * sh, sw, sh, (i + off) * cw - PAD, j * ch - PAD, cw + 2 * PAD, ch + 2 * PAD);
  }
}
```

Title mask, once in `setup`: draw each letter alone into a `COLS*4 x ROWS*4` canvas with `setTransform(1,0,0,1/aspect,0,0)`
(aspect = cell height / cell width) so letters are not stretched by tall cells, read alpha, sum 16 samples per cell, keep
per cell coverage and which letter owns it, then precompute the edge glyph from the coverage gradient and the extrusion
cells. Per frame only reveal, scramble and colour are decided.

The title mask is nudged left by `0.45 * advance` so the block cursor after the last letter keeps breathing room from
the right border.

Cost: about 13.6k cells, roughly 6 to 9 ms per frame at 1280x720 in headless Chrome including bloom and CRT, so 60 fps on a
laptop. Determinism verified: `__render(2.8)` twice gives identical `toDataURL()`, `t = 0` matches the wrapped loop.

## 3. Applying it to any storyboard

1. Fix the grid first (about 200 columns for 16:9, 110 for 9:16 at the same cell aspect) and do all layout in cells.
   Anything smaller than about 6 cells will not read; make faces at least 14 x 9 cells.
2. Assign hue roles: one warm phosphor for the subject and the words, one for the world, one cool far layer. Never more
   than three phosphors plus one accent.
3. Build every object as a per cell function: analytic shapes (spheres, boxes, curves) shaded by a density ramp, outer
   ring by normal glyphs, details as negative space.
4. Turn every text beat into typing: prompts type, titles decode from noise and lock with a flash, exits backspace or
   fall. Give the cursor a role (it marks where attention is).
5. Turn every impact into grid events: ripples of `~`, a one cell shake, a few glitched rows, a meter in the status bar.
6. Fake persistence with analytic ghosts at `t - dt`, never with an accumulation buffer (that breaks `?t=` and capture).
7. Add the CRT pass last and check `?crt=0` still looks good; the grid must carry the image on its own.

## 4. Common failure modes

- **Thresholded blob instead of art**: no edge glyphs. Always pick stroke glyphs on silhouettes from the normal or gradient.
- **Box of brackets or lantern**: edge band too thick (`d2 > 0.8`), or one side glyph for the whole side. A one cell
  outline alone still gives straight stacked `(` `)` and a flat lid; switch the side glyph by row band (`/` upper,
  `(` middle, `\` lower, mirrored on the right) and check the diagonal orientation (upper left is `/`, not `\`; getting it
  backwards turns the top into a lid and the bottom into flared legs). Check in a 4x crop.
- **Weak face**: large carved ellipses alias into two unequal dark rectangles, and a mouth in the faintest ramp step
  vanishes. Stamp small snapped features with a white core, draw the mouth in the mid step, keep cheeks on in every phase.
- **Shadowed palette names**: a local `const W = 16` (stage width) inside the hero function silently shadowed the white
  palette index, so eye cores and glints drew with colour 16 (outside the atlas) and vanished. Keep stage size names
  (`W16`, `H9`) distinct from palette names.
- **Unreadable HUD**: labels on row 0 under a heavy vignette come out as 6 px smudges. Inset the frame one cell, use the
  bright green step for labels, and keep the vignette light in the corners.
- **Stretched title**: text rasterised without compensating for tall cells. Squash the mask by the cell aspect.
- **Ghost glyphs inside carved features**: ghosts drawn earlier show through eyes and mouth. Carved cells must write an
  explicit empty cell.
- **Antenna or thin parts two cells wide**: testing distance to a line per cell. Sample along the line and put one glyph
  per visited cell instead.
- **Muddy grey haze**: grain or background too bright under additive glyphs. Keep grain alpha under 4% and the tube
  near black; let glyph halos make the light.
- **Rectangular clouds**: smooth noise thresholded on a grid makes blocks. Dither the threshold with `hash(cell)`.
- **Broken loop**: anything blinking or scrolling must use integer cycles over the loop (`floor(t*N)` with integer N per
  6 s, `sin(TAU*k*t/DURATION)`).
- **Overlaps with the hop arc**: the hero's spin apex reaches the title band. Keep the prompt and title clear of the
  hop path (here the prompt is left aligned away from x 0.5), and decide the draw order on purpose.
- **Title exit overshooting the beat**: run the exit on `[titleOut, titleGone]`, not past it, and make the drop large
  enough (about 30 rows) that cells visibly fall instead of hanging as dust.
- **Font fallback**: Menlo exists on macOS; list `ui-monospace, "DejaVu Sans Mono", Consolas, monospace` so other systems
  still get a true monospace. Never load a web font (no runtime network).
- **Dashes**: the HUD uses `-` from ASCII; never type an em or en dash into strings or comments.

## 5. Reference searches (YouTube / Vimeo)

1. `ascii art animation real time render character grid`
2. `CRT phosphor terminal motion graphics green amber monitor`
3. `text mode demoscene effect ascii renderer`
4. `typewriter decode text animation glitch title sequence`
5. `retro terminal UI animation scanlines boot sequence`
