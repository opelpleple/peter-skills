# Style recipe: Comic (halftone print, heavy ink, panel cuts, impact frames)

Live demo: `https://peterbu.com/showcase/skills/video-like-peter/styles/comic/` (`index.html` + `comic.js`, built on
the shared `_engine/stage.js` and `_engine/scene.js`). Poster: `poster.png` (t = 2.8: title stamping in letter by letter,
hero on the slab looking up, round pop-out inset of the face (upper right, opposite the title) with a "!" balloon;
captured headless at 1280x720 with `?ui=0&play=0&dpr=1` and `window.__render(2.8)`). Reduced motion holds `keyTime: 3.2`
(full title, hero, inset), passed explicitly to `mount()`.

## 1. What defines the style

A frame reads as "comic" at first glance because of five things together: **dot screens instead of gradients**,
**a heavy black key line with thick and thin weight**, **process colour primaries on cream newsprint**, **the frame is a
page of panels with gutters**, and **lettering (sound effects, captions, a stamped logo) is part of the picture**.
Time is told the comic way: held drawings, hard cuts between panel layouts, and two-drawing impact frames.

### Palette (process inks plus paper, nothing else)

| Role | Hex | Used for |
|---|---|---|
| Paper | `#f5eedb` | page, gutters, base under every dot screen |
| White | `#fffaf0` | eye whites, gloss, slab top, shine band on title letters, impact frame 1 lines and silhouette |
| Key (ink) | `#16131a` | every outline, panel borders, focus/speed lines, shadow dots, impact frame black |
| Cyan | `#1ea7e1` / dark `#0d6ea6` | hero body, sky screen, building screens, WHIRRL lettering |
| Magenta | `#e8197d` / dark `#a50f58` | cape, title extrusion, ground screen, close-up background, impact frame 2 |
| Yellow | `#ffd61f` / dark `#e9a400` | slab, title face, burst balloons, windows, caption box |
| Red (Y+M overprint) | `#e63b2e` | column, SFX letters, halftone on the title face and slab, open mouth |

Rule: a tone is never a gradient. Light to dark inside one hue is done by dot SIZE on paper (or on a flat ink).
Shadows are key-colour dots over the fill. Red is the only "mixed" colour, the way it would overprint on press;
its dots use the magenta screen angle (75 deg).

### Shape language

- Simple solids with chunky silhouettes: the hero is one round body with a tied mask band and two cape tails,
  a slab on a column, rectangle buildings with window grids. Readable at thumbnail size.
- Hero (original): round cyan kid, magenta mask band with a knot, cape tails that stream against the motion,
  big eye whites with pupils and catchlights, short ink brows that flip from "determined" to "amazed".
- Burst balloons: jagged star polygons (13 spikes, hashed radii), offset ink drop shadow, yellow or cyan fill.
- Panels: polygons, some with slanted gutters (dynamic cut), one round pop-out inset.

### Line

- Base weight `lw = max(2, H * 0.0058)` (about 4 px at 720p).
- Brush feel without a brush engine: draw the ink as a FILLED copy of the shape, grown by `0.95 lw` and offset
  down-right by `(0.22 lw, 0.3 lw)`, then the colour fill on top. The outline is thin top-left, fat bottom-right.
- Panel borders `1.25 lw`, mitered joins. Cape `2.1 lw` stroke behind its fill. Details (band edge, mouth) `0.6 to 0.75 lw`.
- Misregistration: the colour fill is printed `0.0018 H` off the ink, so a sliver of paper shows at one edge.

### Texture

- Screen-space halftone: patterns are re-aimed every fill so dots stay locked to the page like a real print
  screen, regardless of panel camera zoom. Screen angles per plate: cyan 15 deg, magenta 75 deg (red dots too), key 45 deg.
- Newsprint grain: one 256 px hashed noise tile, multiplied over the whole frame at 16% alpha.

### Lighting

Implied, top-left key. Form shadow = a crescent of key dots, lower right, clipped inside the body. Hard white gloss
shapes (a tilted sliver plus a dot), never a soft highlight. Cast shadow = a light key dot ellipse (30% coverage) under
the feet only while the hero is near the floor (it disappears in the high part of a hop); on the slab it is flattened
into the middle of the thin top face, so it never reads as a dark slot.

### Frame rate and stepping

`fps: 12` in `mount()` (drawn "on twos"). Every drawing is a held pose; speed lines and focus lines re-hash with
`ctx.frame` so they boil from drawing to drawing, which is what makes the stills feel alive.

### Timing and easing rules

- Cuts, not camera moves: each beat gets its own panel layout. In the demo:
  A wide establishing + caption (0 to 0.6, and again 5.0 to 6.0 so the loop seam is not a cut), A2 low dutch angle
  with a slanted gutter and a frozen "watching" panel (0.6 to 1.2), impact (2 drawings), B medium + face close-up
  (1.37 to 2.0), C title panel with a slight push-in (z 1.12) + round face inset upper right (2.0 to 3.5), D dutch
  spin with focus lines (3.5 to 4.1), impact (2 drawings), E sunburst celebration with confetti (4.27 to 5.0).
- A frozen panel must still tell something. The "watching" panel holds the empty slab, so it gets a narrative
  caption ("BUT WHERE / WILL HE LAND?", bottom left where the slanted gutter is widest) and a stamped "?" balloon.
  Without them it reads as an accidental zoom.
- Impact frames: exactly 2 drawings, full bleed, no border. Drawing 1 = key black + white (`#fffaf0`) focus lines +
  white silhouette; drawing 2 = magenta screen + key focus lines + key silhouette. The drawing index is
  `Math.floor((t - land) * FPS + 1e-6) % 2` so drawing 1 is always the black one, whatever the land time is relative
  to the 12 fps grid (`Math.round` flipped the order for land = 1.2 and 4.1). The silhouette is the character's
  real shape in one flat colour: body, knot bump, both cape tails, feet, slab and column stub, with two eye slits.
- Lettering stamps: drawing 1 oversized (x1.35 SFX, x1.75 title letter, rotated), drawing 2 slightly under,
  then size with a small `outBack(u, 2.4)` overshoot. SFX exit = one drawing swelled to x1.12, one drawing at x0.72,
  then gone (title letters: swell to x1.22, then collapse). Never fade. A continuous collapse sampled at 12 fps
  leaves a drawing at 0.2 scale, which reads as an illegible sliver.
- Squash and stretch from `pose(t)`; the slab dips with a damped cosine on the big landing.

### Camera

Each panel has its own camera `{x, y, z, rot}`: world point at the panel centre, zoom relative to panel height,
a dutch roll of 0.06 to 0.09 rad on action panels. The world is drawn once per panel inside the panel clip.

## 2. Technique (2D canvas, no WebGL)

Pipeline per frame: paper -> for each panel (clip polygon -> cached halftone background -> focus lines -> title
logo -> world through the panel camera -> world-anchored SFX in panel space -> caption) -> heavy border ->
inset -> grain multiply. Impact frames replace the whole page.

Screen-locked halftone pattern:

```js
function dotPattern(g, color, spacing, coverage, dpr) {      // tile in DEVICE pixels, cached
  const s = Math.round(spacing * dpr), c = document.createElement('canvas'); c.width = c.height = s;
  const x = c.getContext('2d'), r = s * Math.sqrt(coverage / Math.PI) * 0.72; x.fillStyle = color;
  for (const [px, py] of [[s/2, s/2], [0, 0], [s, 0], [0, s], [s, s]]) { x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); }
  return g.createPattern(c, 'repeat');
}
function fillDots(g, pat, angleDeg) {                        // fill the current path with a page-locked screen
  pat.setTransform(g.getTransform().inverse().rotate(angleDeg));
  g.fillStyle = pat; g.fill();
}
```

Graded halftone (sky, sunburst, close-up backdrop): built once per panel size into an offscreen canvas. Walk a
rotated grid, compute coverage `v` from a density function, dot radius `= spacing * sqrt(v / PI)` (area-true).

```js
for (i, j over the grid) { const [ox, oy] = rot2(i*s, j*s, angle); const v = dens(x, y);
  g.arc(x, y, s * Math.sqrt(v / Math.PI), 0, TAU); }
// sky: v = (1 - y/h)^1.35 * 0.62 + 0.04   burst: alternate 28 angular rays, v grows with distance
```

Panel camera:

```js
function camApply(g, cam, b, W, H) { const sc = cam.z * (b.h / H);
  g.translate(b.cx, b.cy); g.rotate(cam.rot); g.scale(sc, sc); g.translate(-cam.x * W, -cam.y * H); }
```

Title logo: each letter pre-rendered once per size into its own canvas: (1) key stroke at 9 offsets along the
extrusion = one ink silhouette, (2) magenta extrusion fills back to front, (3) thin key line at the face, (4) face on
a temp canvas: yellow fillText, then `source-atop` red dot rows denser toward the foot, plus a white shine band.
At render each letter is just `drawImage` with translate, rotate, scale. Draw the logo BEFORE the world so the hero
breaks in front of it (a classic comic cover move).

Speed lines: 9 tapered triangles behind the hero along `-velocity` (velocity = finite difference of `pose(t +- 0.02)`,
still pure). They are clipped out of the title box (an even-odd clip of panel rect minus title rect, set in panel
space then restored to the camera transform), so on the vertical spin hop they never stab through the letters, and
they stop as soon as the hero is fully out of frame. Focus lines: 64 wedges in the spin panel, 90 in impact frames,
from a clear ring to the frame edge, hashed by `frame` so they boil. Trajectory: a dashed key arc sampled from the
hop segment, lingering 0.2 s after landing; on the exit hop the tail catches up with the hero and the arc is gone
0.12 s before the end, so the last drawing matches t = 0.

SFX placement: world-anchored, drawn in panel space after the world, so place each word where the trail is not
(HOP HOP sits 0.3 H above the ground, above the exit arc) and fully inside its panel (THWUMP anchor at
platform x - 0.065). Close-up panels skip world SFX, or a burst lands in them as a giant stray spike.

## 3. Applying it to any storyboard

1. Break the board into beats and give every beat a PANEL LAYOUT, not a camera move. Big moments get full bleed,
   reactions get a close-up panel beside the action, "meanwhile" moments get a caption box.
2. Put a 2-drawing impact frame on every hard contact or reveal. Pick one SFX word per impact, original and
   onomatopoeic (THWUMP, KA-BOING, WHIRRL, HOP HOP).
3. Shade with dots only. Choose one screen per plate and keep the angles fixed for the whole film.
4. Step at 12 fps. Keep held poses readable; let lines boil, not the characters.
5. Make the first and last layout identical so a loop does not cut at the seam.

## 4. Failure modes

- Dots that scale with the camera: looks like a texture on an object, not print. Re-aim the pattern per fill.
- Gradients sneaking in (shadowBlur, linear gradients, alpha fades): instantly reads as digital, not comic.
- Lettering overlapping itself: measure each glyph and advance by at least 1.0 x width, cap the font by word length.
- Outlines drawn as strokes extending outside a clipped shape (the mask band edge first looked like antennae):
  stroke inside the clip.
- Title in front of the action covering the hero's big moment: draw the logo behind the world.
- Smooth 60 fps motion: feels like flat cartoon. The held drawings and hard cuts are the style.
- Impact frames longer than 2 drawings: stops reading as a flash and becomes a scene.
- Rebuilding graded halftone every frame: cache per panel size (only a handful of sizes exist).
- Pick `keyTime` off every impact window. The engine default 4.2 snaps to 4.1667 at 12 fps, which is the spin impact
  flash, so reduced-motion users and keyframe thumbnails saw a magenta silhouette. Pass `keyTime` to `mount()`
  (3.2 here) and check it against `floor(keyTime * fps) / fps`.
- Loop seam leftovers: trails, speed lines and SFX that outlive the hero blink out at the wrap. End them on the
  drawing before the last, so frame 5.9167 equals frame 0.
- Speed lines or other world marks crossing the title: clip them out of the lettering box.

## 5. Reference search queries

1. `comic book panel animation motion comic halftone`
2. `ben day dots animation pop art motion graphics`
3. `anime impact frame compilation sakuga`
4. `onomatopoeia sound effect animation comic lettering`
5. `limited animation on twos comic style short film`
