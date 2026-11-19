# Style recipe: Pixel 16-bit (console-era sprite art, 320x180, fixed palette, ordered dither)

Live demo: `https://peterbu.com/showcase/skills/video-like-peter/styles/pixel-16bit/` (`index.html` + `pixel.js`, built on
the shared `_engine/stage.js` and `_engine/scene.js`). Poster: `poster.png` (t = 2.8: logo letters dropping in one by one
with a bounce, hero settled on the floating platform, HUD slid in, sunset parallax behind). Captured headless at 1280x720
with `?ui=0&play=0&dpr=1` and `window.__render(2.8)`. Add `?crt=0` to switch the scanlines off.

## 1. What defines the style

A frame reads as "16-bit game" at first glance because of five things together: **a low internal resolution scaled up
with hard square pixels**, **a small fixed palette with no blending at all**, **ordered (Bayer) dither instead of
gradients**, **layered parallax backdrops with a clear foreground tile set**, and **sprites that animate on few drawings
while positions move every frame**. Game furniture (a HUD, a stamped logo, collectibles, screen shake) finishes it.

### Palette (30 colours, every pixel of the internal 320x180 buffer is one of these)

| Role | Hex |
|---|---|
| Sky bands top to horizon (dithered into each other) | `#140c2c` `#241544` `#3b1d5c` `#5e2670` `#8e3278` `#c44a78` `#ec7468` `#ffa860` `#ffd47a` |
| Sun core, logo top | `#fff0b0` |
| Far mountains / lit rim | `#5e2670` (reuses sky band 4, one value step lighter than the mid hills) / `#a8487e` |
| Mid hills, pines, keep / their lit top pixel | `#33195a` / `#4e2468` |
| Near treeline | `#1e1238` |
| Grass light / mid / dark | `#a6e05a` `#4fa84a` `#2a6a46` |
| Dirt bricks light / mortar / deep | `#a0643a` `#6e3a2c` `#3e2028` |
| Stone platform light / mid / dark | `#c8aab4` `#7a6488` `#4a3a62` |
| Hero body highlight / light / mid | `#fff4dc` `#f6d0a8` `#dc9a8c` (shadow tone = stone mid `#7a6488`) |
| Scarf light / dark | `#3fe0c4` `#1c8c94` |
| Accent pink (cheeks, petals, gems, hearts) | `#ff6e9c` |
| Pure white (glints only) | `#ffffff` |

Rules: outline and darkest ink = `#140c2c` (the top sky colour, so the world shares one black). The logo reuses the warm
sky ramp (`#fff0b0` to `#ec7468`) so it feels lit by the same sunset. Values go dark to light from foreground silhouette
to sky (atmospheric depth), except the playfield (ground, platform, hero), which is the brightest, most saturated layer
so gameplay reads on top.

### Shape language

- Everything is built from whole pixels: ramps are stair steps, curves are hand-stepped circles, trees are stacked
  triangles with a notch every 4 rows, clouds are unions of circles with a pink lit underside.
- Hero (original): a round puff, about 27 px tall at 320x180, leaf sprout on top (sways, flops on landings), teal scarf
  band plus a fluttering 2 px tail, 2x4 px eyes with a white glint, pink cheeks when smiling.
- Tiles: 16x8 brick dirt with offset rows, a 4 px grass lip with dripping edge and blades sticking up, a floating stone
  slab with a grass top and hanging roots. The brick field picks a variant per tile from `hash(tileX * 7 + row * 131)`:
  about 11% cracked bricks (stepped diagonal crack with a lit lip), 8% buried stones (outlined oval in the stone ramp),
  6% roots (wavy dark strand). Without variants the band reads as wallpaper at 1280 px.
- Grass: flowers grow in 4 tufts (3 to 5 heads each, about 3 px apart) with bare grass between; blades are dense
  inside a tuft (hash > 0.25) and sparse elsewhere (hash > 0.68). Flowers spread evenly across the row read as noise.
- Sun: a disc with three horizontal slats cut through its visible lower half (1, 2 and 3 px tall, widening downward),
  showing the sky behind it. Place the slats where the ridge does not cover them (here y 95 to 104 with the disc
  centred at y 94); slats hidden behind a mountain do nothing.
- Logo: a 5x7 bitmap font drawn at 3x (21 px cap height), 1 px dark outline, 3 px down-right extrusion, a white top
  highlight row on each stroke, a dithered 4-step warm gradient on the face. It sits `TITLE_LIFT = 8` px above the
  shared `titleY` (raster rows 35 to 60) so the hero's silhouette never touches its baseline (see Camera / clearance).

### Line

- Selective outline: 1 px `#140c2c` drawn OUTSIDE every sprite (empty pixels with a filled 4-neighbour), never inside.
- Internal shapes have no lines; separation is done by tone (lit rims, a darker mortar row).
- Rim light pixels (`#ffa860` on the sun side of the hero, `#a8487e` on right facing mountain slopes) replace outlines on
  the lit edge.

### Texture

- Ordered dither only, 4x4 Bayer matrix, for: sky band transitions, the sun glow ring, depth darkening of the dirt,
  dithered drop shadows (checkerboard), the logo gradient. No noise, no blur, no alpha.
- Optional CRT: one dark 30% sliver per source row at 16% opacity, drawn at display resolution after the upscale.
  The palette rule applies to the internal buffer: with `?crt=0` the screen shows exactly 30 colours; with CRT on, the
  translucent scanlines make about 84 distinct display colours. CRT is a post-upscale display effect, not part of the
  art.

### Lighting

A low sun on the right: highlight upper right of the hero, a hot orange rim on its right edge, a cool `#c8aab4` sky bounce
on the left edge. Tones are banded (4 steps) with a small dither between bands. Contact shadow = a checkerboard line plus
a shorter second row, which shrinks with height above the floor.

### Frame rate and stepping

- `fps: null` in `mount()`: the clock runs smooth at 60 fps, but every position is ROUNDED to whole internal pixels, so
  movement already steps in pixel units (1 px = 4 screen px at 1280).
- Sprite pose clock `tq = floor(t * 12) / 12`: squash, spin angle, face, leaf, logo drops are read at `tq` (12 fps
  drawings). The scarf flutters at 10 fps, gems palette cycle at 8 fps, flowers sway on 2 drawings at 4 fps.
- Positions use `pose(t)`, shapes use `pose(tq)`: smooth travel, crunchy animation. That split is the console feel.

### Timing and easing rules

- Hops from `scene.js`; the shape (squash) changes in 12 fps drawings, landings add dust puff sprites (5 drawings,
  shrinking, moving out 4 px per drawing).
- Big landing (1.2) and spin landing (4.1): screen shake of whole internal pixels `[2, -2, 1, -1, 1]` at 25 Hz, the gap
  filled with the edge colour.
- Logo: letters drop from 64 px above with `outBounce`, staggered (`letterReveal` spread 0.62, window `a = 2.0`,
  `b = titleDone - 0.1 = 3.3`, so the last drop lands 0.1 s before the hold starts), sampled at 12 fps; dust
  sparkles at each letter's first contact; one white diagonal shine sweep at 3.4 to 3.85; during the hold each letter
  bobs 1 px on a sine wave (classic title screen wave).
- Exit: the logo FLICKERS (on/off at 16 Hz) while rising 10 px, then is gone at 5.6. Never alpha fade pixel art.
- HUD slides in with `outBack` at 2.0 to 2.3 and out with `inCubic` at 5.05; the HUD gem icon holds its first colour
  until the first gem lands, then palette cycles at 8 fps, so the counter moment pops.
- 7 gems burst from the spin landing, spawned at the TOP edge of the sprite (contact - 2 - 2 * r - 2), never the body
  centre. During the burst arc (0.26 s) they are drawn BEFORE the hero, so they emerge from behind it; once they start
  homing into the counter (`inCubic`) they are drawn after the HUD. The counter ticks 00 to 07 as each arrives (x03 by
  about 4.75, x07 by about 4.95, a sparkle per arrival). Gems spawned at the centre and drawn on top sit on the face
  for 0.3 s and read as broken goggles.
- Face: through the celebrate window (3.4 to 5.0) the smile is forced to 1, drawn as a wide upturned grin (raised 1 px
  corners plus an open bottom with a pink tongue), so no mid-spin drawing reads as worried.

### Camera

Locked to the playfield (the foreground never moves, so the shared layout holds). Parallax comes from a periodic camera
drift `camX = 12 * (smoothstep(0, 1.4, t) - smoothstep(4.9, 6, t))` applied to background layers with depth factors
stars 0.05, clouds 0.15, far mountains 0.3, mid hills 0.55, near treeline 0.8. Each layer is 32 px wider than the screen and drawn at
`-16 - round(camX * depth)`. Periodic drift also covers stars (twinkle on integer cycles per loop), cloud bob, fireflies,
and foreground petals that wrap exactly once per 6 s.

### Silhouette clearance (style local, shared beats unchanged)

At 320x180 the shared spin hop (apex 0.2 of H = 36 px) lifts the hero into the title. This style keeps every beat
time and endpoint but scales the spin hop height: `hpose(t)` returns `pose(t)` with
`y = top - (top - y) * SPIN_AIR`, `SPIN_AIR = 0.72` (apex about 26 px), used for every POSITION read (hero, scarf
velocity, shadow, sparkle ring). Shapes still read `pose(tq)`. With the logo 8 px higher, the body top at the apex is about
row 64 and the logo raster ends at row 60. The exit hop is not scaled; by then the logo is flickering and rising.

## 2. Technique (software raster into a Uint32 buffer, Canvas 2D only for the final upscale)

Pipeline per frame: copy sky -> stars -> clouds -> far -> mid (+ lit keep windows) -> near -> fireflies -> foreground
tiles -> flowers -> logo (behind the hero) -> shadow -> dust -> bursting gems -> hero (scarf tail, then body) ->
sparkle ring -> HUD -> homing gems -> petals -> `putImageData` -> `drawImage` scaled with smoothing off -> scanlines. About 8 ms per frame including
the rAF wait in headless Chrome; the raster itself is a few ms.

Palette as packed ints, one buffer, opaque only:

```js
const IW = 320, IH = 180, F = new Uint32Array(IW * IH);
const C = {}; for (const k in HEX) { const v = parseInt(HEX[k].slice(1), 16);
  C[k] = ((255 << 24) | ((v & 255) << 16) | (((v >> 8) & 255) << 8) | (v >> 16)) >>> 0; }   // ABGR little endian
function blit(dst, src, ox, oy) { /* copy src.u into dst.u, skipping 0 (= transparent) */ }
```

Ordered dither between two palette entries (used for every gradient):

```js
const BAYER = [0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
const bay = (x, y) => (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
const f = (y / HZ) * (SKY.length - 1), i = Math.floor(f);
px = (f - i) > bay(x, y) ? SKY[i + 1] : SKY[i];
```

Static layers (sky + sun, ridges from piecewise linear peaks with hashed jitter, hills + pines + keep, treeline from
circle unions, ground and platform tiles, logo letters, hearts, gems, clouds) are rasterised once in `setup()`.

Hero by inverse mapping, so rotation is a true pixel rotation and the face turns with the body:

```js
for (j, i in box) { const lx = i*cos + j*sin, ly = -i*sin + j*cos;          // screen -> local
  const u = lx / rx, v = ly / ry; if (u*u + v*v <= 1) {
    const nz = Math.sqrt(1 - u*u - v*v), nx = u*cos - v*sin, ny = u*sin + v*cos;  // normal back in world space
    const tone = clamp(Math.floor((dot(n, LIGHT) + 0.3) * 2.3 + (bay(i, j) - 0.5) * 0.7), 0, 3);
    col = [P2, B3, B2, B1][tone];  /* then rim, scarf band, eyes, mouth tested in local px */ } }
// then the outline pass: empty pixel with a filled 4-neighbour -> #140c2c
```

Upscale and present:

```js
bg.putImageData(img, 0, 0); g.imageSmoothingEnabled = false; g.drawImage(buf, 0, shake * sc, W, H);
```

CSS also sets `image-rendering: pixelated` on the canvas so any browser rescale stays square.

## 3. Applying it to any storyboard

1. Pick the internal resolution first (320x180 for 16:9; 256x144 for chunkier). Convert every layout fraction to
   integer pixels once (platform, floor, title box) and keep all drawing integer.
2. Write the palette before drawing anything: 24 to 32 colours, 3 to 4 step ramps per material, one shared black,
   one accent. Lock it; no colour outside it, ever.
3. Split the frame into a backdrop stack (3 to 5 depths, darker and lower contrast with distance) and a playfield (tiles,
   characters, pickups). Only backdrops get parallax.
4. Every object that changes shape gets drawings at 8 to 12 fps (`tq`), while its position uses `t` rounded to pixels.
5. Translate each beat into game language: entrances are hops and runs, emphasis is screen shake, sparkles, a sound
   effect style pop, rewards are collectibles that fly to a HUD counter, titles are logos that drop and flicker.
6. Anything cyclic must loop on integer cycles of the duration (stars, petals, palette cycles use `floor(t * k)`).

## 4. Common failure modes

- Smoothing on (blurry upscale): set `imageSmoothingEnabled = false` on EVERY draw context and `image-rendering: pixelated`.
- Drawing with Canvas paths/arcs/fillText into the low-res buffer: anti aliasing adds off-palette colours. Rasterise by
  hand into the Uint32 buffer.
- Alpha fades and soft shadows: replace with dither or flicker.
- Sub-pixel positions: round before writing; otherwise shapes shimmer differently every frame.
- Rotating a pre-drawn sprite with `ctx.rotate`: breaks the grid. Re-raster through inverse mapping (or pre-draw 8 or 16
  angle frames).
- Too many colours from per-pixel shading math: always quantise to the ramp, dither only between neighbours of a ramp.
- Heavy logo extrusion merging letters: give 2 font pixels of letter spacing and extrude mostly downward.
- Shake revealing an empty strip: fill the gap with the edge colour (sky at top, deep dirt at bottom).
- Bitmap glyph ambiguity at small sizes (a lowercase v reading as w): narrow diagonal letters early.
- Pickups spawned at the sprite centre and drawn on top of it: they cover the face. Spawn at the top edge and draw
  behind the sprite until they clear it.
- A hop apex that crosses the logo while the logo should frame the hero: check silhouettes at the apex at internal
  resolution; lift the logo and flatten that hop locally rather than letting them overlap.
- Decorative detail hidden by a nearer layer (sun slats behind the ridge): place it where it is visible.

## 5. Reference searches (YouTube / Vimeo)

1. `16-bit pixel art parallax background timelapse sunset`
2. `pixel art animation 12 fps sprite squash and stretch breakdown`
3. `ordered dithering bayer pixel art tutorial gradients`
4. `SNES era title screen logo animation compilation original indie`
5. `palette cycling pixel art animation waterfall demo`
