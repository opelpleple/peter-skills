# Style recipe: Vector Plano (flat editorial vector, grid, long shadows)

Live demo: `https://peterbu.com/showcase/skills/video-like-peter/styles/vector-plano/` (`index.html` + `plano.js`,
built on the shared `_engine/stage.js` and `_engine/scene.js`, plus the bundled font `montserrat-600-800.woff2` with
`MONTSERRAT-OFL.txt`). Poster: `poster.png` (t = 4.2, the engine key frame: title held on the highlighter, chart complete
with the coral end dot and "+7", hero squashing on the pedestal under the confetti burst, the trio cheering in a narrow V;
captured headless at 1280x720 with `?ui=0&play=0&dpr=1` and `window.__render(4.2)`). `?font=bundled` previews the type
as it looks on systems without Avenir Next.

## 1. What defines the style

Vector plano is the look of a modern magazine infographic or corporate explainer: a **warm paper wall on a visible
editorial grid**, **a 4 to 5 colour corporate palette in flat fills**, **no outlines anywhere**, **geometric
everything** (people, charts, icons are circles, rectangles, trapezoids, triangles) and **45 degree long shadows** in one
soft tone. It differs from flat cartoon: no ink line, no rubbery squash on the props, no gags; it reads as designed
information. Characters are faceless or near faceless and built from primitives. Motion is shapes sliding on rails,
wiping in behind clips and morphing between primitives, never wobbling.

### Palette (5 core colours on paper, plus derived steps)

| Role | Hex | Used for |
|---|---|---|
| Paper | `#f3eee6` | the wall |
| Grid | `#e3dbce` | 12 column grid and row lines (1 px at 720p) |
| Navy (ink) | `#1f2a44` | floor band, "Seven", eyes, legs, axes, rule, kicker |
| Navy light / mid | `#4a5778` / `#76829f` | floor ticks, captions, registration crosses, dimension label, the dashed trail |
| Coral / tint | `#f25c54` / `#f78a82` | hero body, "Skills", donut wedge, shirt, final chart dot and "+7"; the tint only for the hero's cheek dots |
| Teal / dark / tint | `#2a9d8f` / `#23887c` / `#cfe3dc` | pedestal column, quarter circle bands, beanie, chart line and area |
| Mustard / dark | `#f4b942` / `#dfa02f` | highlighter bar, sun, pedestal slab, chart dots, pompom |
| Cream | `#fbf8f2` | "07" on the pedestal, eye catchlights |
| Skin set | `#f0c4a0` `#c78a62` `#8b5a3c` | the three people (diverse, flat) |
| Shadow ink | `#0e1424` | the ONLY shadow colour, composited at 12% on the wall and 42% on the floor |

Rules: every hue has at most one darker step (used as a flat band, never a gradient) and at most one lighter tint.
Shading inside a shape is one flat half plane, not a ramp. Text uses the same palette (navy plus one accent word).
Translucency is never used to make a new colour: the only alpha in the piece is the shared shadow composite (12% and
42%) and the hero's 16% shade plane. A trail or arc that should "fade" gets shorter instead.

### Shape language

- Primitives only: circles, rings, wedges, rectangles, trapezoids, equilateral triangles, capsules. No curves drawn by
  hand, no texture, no noise, no grain, no outline.
- Big anchoring shapes bleed off the frame edges (a teal bullseye quarter circle at bottom left, a mustard sun with an
  inner half disc at top right). They give the 16:9 frame its corporate poster balance.
- Infographic furniture on the grid: a donut chart with a percent label, a line chart with axis, dotted gridlines,
  area fill and pop dots, an icon row (circle, square, triangle) that morphs, a dimension marker next to the pedestal,
  "FIG. A / FIG. B" captions, a "VOL. 07 THE SKILLS ISSUE" kicker, an axis with tick numbers along the floor, and a 3
  colour bar at the bottom edge. The dimension marker is a full annotation: pole, a tick at both ends and a small
  "H 0.14" label. Registration crosses sit only in grid cells nothing ever passes through (cols/rows 3/1, 8/1, 9/7, 2/6).
  Caption pairs ("FIG. A" + "SKILL SHARE") are spaced by measuring the first word, so they survive a font fallback.
- People: faceless. Head circle, neck rectangle, hair as one clipped shape (cap, bun, flat top), trapezoid torso
  (shoulders wider than hips), two rectangle legs, capsule arms with a skin circle hand. Hair shifts toward the hero so
  they seem to watch him (continuously, never by a sign flip), and eases to the same rest value (looking at the middle
  of the page) at both ends of the loop. They stand 0.056 W apart. Cheering is a pictogram pose swap: the arm retracts
  into the shoulder pointing down, then extends into a narrow V (158 to 171 degrees from straight down) that waves
  inward only, so no half raised arm ever sweeps sideways through a neighbour. When the exiting hero hops past in front
  of them they duck (legs shorten up to 62%) and lean back 0.2 rad about the feet, both driven by the hero's distance,
  so the overlap reads as an interaction, not a collision.
- Hero: coral ellipse, teal beanie band clipped by the body silhouette, mustard pompom, navy oval eyes with a cream
  catchlight, flat cheek dots, navy feet. One world fixed shade half plane (bottom right, 16% shadow ink) that stays put
  while the body spins.

### Line, texture, lighting

- Line: none. The only "lines" are filled rectangles (rules, axes, ticks) and the dashed trajectory.
- Texture: none. Crisp edges are the texture.
- Light: one direction, top left. Every solid object casts a 45 degree long shadow toward bottom right. Lengths: big
  backdrop shapes (bullseye quarter circle, sun) 0.2H, donut 0.16H, pedestal slab and column 0.14H, people 0.12H, hero
  0.11H, icon tiles 0.08H, letters 0.07H, highlighter 0.05H, confetti 0.04H. Shadows stop at the floor line for wall
  objects and continue on the floor for standing objects (pedestal, people, hero, confetti).
- A ring casts a ring's shadow: the donut hole shows paper except a thin crescent inside its top left rim (the ring's
  own shadow on the wall behind the hole).

### Frame rate, timing, easing

- Smooth 60 fps (`fps: null`). Flat vector motion is clean tweens, not stepped.
- Entrances: `outCubic` wipes (highlighter, rule from the centre, caption clip), `outBack` letter rises (letters come
  up out of the rule like type in a slot), `outBack` pops for chart dots.
- Exits: `inCubic` (letters drop back into the rule, the highlighter wipes away left to right, the rule closes).
- Morphs: `inOutCubic`, 0.3 s, with a 0.28 scale pop at the midpoint and a 60 degree turn; triggered on landings.
- Chart dots pop on their own clock: each dot starts its 0.25 s `outBack` exactly when the growing line reaches it
  (the inverse of the line's `inOutCubic`, solved once), the last one ending at 3.55 s; all of them shrink with the
  line's 5.0 to 5.5 s exit. Never derive a pop from the line's own progress, or the last dot (reached at progress 1.0)
  never gets past radius 0.
- Data motion is slow and periodic: donut wedges breathe with `sin(TAU t / DURATION + phase)` so the loop closes.
- Camera: locked off. Editorial infographics do not move the camera; the layout is the camera.

## 2. Technique (canvas 2D, no WebGL)

Plain canvas 2D through `mount({ render, setup })`. Everything is a pure function of `t`.

### Long shadows from one offscreen layer

Long shadow of a convex shape = convex hull of the shape and the shape shifted along (1, 1). Circles are cheaper: a
round capped stroke from the centre to the shifted centre with width 2r.

```js
function longPoly(c, pts, L) {
  const d = L * Math.SQRT1_2;
  fillPts(c, hull(pts.concat(pts.map((p) => [p[0] + d, p[1] + d]))));
}
function longCircle(c, x, y, r, L) {
  const d = L * Math.SQRT1_2;
  c.lineWidth = 2 * r; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x, y); c.lineTo(x + d, y + d); c.stroke();
}
```

All shadows of one depth layer are painted SOLID into one offscreen canvas, then composited once with alpha. Overlaps
never double darken, and the same shadow tints whatever it lands on (paper, mustard bar, pedestal) correctly:

```js
function shadowPass(ctx, zones, draw) {
  s.clearRect(...); s.fillStyle = s.strokeStyle = SHADOW_INK; draw(s);
  g.save(); g.rect(0, 0, W, groundY); g.clip(); g.globalAlpha = 0.12; g.drawImage(S, 0, 0, W, H); g.restore();
  if (zones === 'both') { /* floor rect clip, globalAlpha 0.42, same drawImage */ }
}
```

Layer order (each pass composites over everything drawn before it): paper, grid, floor, then
1. shadows of the backdrop shapes, donut (with its hole reopened), icon tiles and highlighter, 2. backdrop shapes,
donut, tiles, chart, highlighter and caption, 3. letter shadows, 4. letters and rule, 5. shadows of pedestal and people
(wall and floor), 6. pedestal and people, 7. trail and dust, 8. hero shadow, 9. spin arcs, then the hero over them,
10. confetti shadows (wall and floor), 11. confetti.

The donut hole is reopened inside the wall pass with a clipped `destination-out`:

```js
longCircle(s, cx, cy, R, L);                       // whole disc shadow
s.save();
s.beginPath(); s.arc(cx + hd, cy + hd, ri, 0, TAU); s.clip();   // hd = 0.03H * SQRT1_2
s.globalCompositeOperation = 'destination-out';
s.beginPath(); s.arc(cx, cy, ri, 0, TAU); s.fill();  // leaves only the crescent at the hole's top left
s.restore();
```

### Letter long shadows as prebaked sprites

Per glyph, once per resize: stamp the glyph along the diagonal every 0.6 device px into a small canvas. At render time
each letter's sprite is drawn at the letter's animated position inside the letter shadow pass:

```js
for (let k = 0; k <= L; k += 0.6 / dpr) sc.fillText(c, pad + k * R2, pad + fs + k * R2);
```

Letters and their sprites share one clip `rect(0, 0, W, ruleY)`, so type rises out of the rule and the shadows end on it.

### Morphing primitives point by point

Do NOT sample the shapes on shared polar rays: rays from one origin give uneven point density along the edges (worse
when a shape is off centre), and the in-between frames bulge into lumpy leaves. Instead give every shape 4 matched
corners and 15 points per edge, sampled by arc length inside each edge. The square's corners TL, TR, BR, BL pair with
the circle at -135, -45, 45 and 135 degrees and with the triangle as apex, apex (the collapsing 4th corner), BR, BL.
Every in-between frame is then a crisp near-polygon.

```js
// circle: 60 points from -135 degrees, so points 0, 15, 30, 45 sit where the square's corners are
// square: corners [[-h,-h],[h,-h],[h,h],[-h,h]], h = 0.86
// triangle: circumradius 1.12, drop 0.08 (optical centring only), corners [apex, apex, v(30), v(150)]
for (let c = 0; c < 4; c++) for (let k = 0; k < 15; k++) out.push(lerpPt(cs[c], cs[(c + 1) % 4], k / 15));
```

Seamless loop: the icon row morphs on 3 events (land, spin land, exit land), 3 shapes, so after one loop each tile is
back to its starting shape (`(i + count) % 3`).

### World fixed shading on a rotating body

Clip to the body, undo the body rotation, rotate 45 degrees, fill everything past a line at 0.12r with shadow ink at 16%:

```js
g.save(); body(); g.clip(); g.rotate(-p.rot); g.rotate(Math.PI / 4);
g.globalAlpha = 0.16; g.fillStyle = SHADOW_INK; g.fillRect(r * 0.12, -r * 2, r * 2, r * 4); g.restore();
```

### Infographic trajectory

The hero leaves a dashed trail in solid navy mid `#76829f` (alpha 1): only the last 0.34 s of the current hop (0.2 s on
the spin hop), with a marching dash offset. On the last exit hop that window shrinks to zero between 5.72 and 5.94 s,
so the trail disappears by getting shorter and frame 0 is clean. The two spin arcs are solid mustard and teal and grow
and shrink by sweep length (`1.1 * sin(PI u)`), never by alpha.

### Fonts

`"Avenir Next", "Plano Sans", "Futura", "Montserrat", sans-serif`. Avenir Next Heavy renders on macOS. Everywhere else
"Plano Sans" takes over: a vendored Montserrat (SIL OFL 1.1) cut to weights 600 to 800 and Latin only, 15 KB woff2,
declared with `@font-face` in `index.html` (`font-weight: 600 800; font-display: block`) and loaded in `setup()` before
the title is measured. Never let it fall back to Arial.

## 3. Applying it to any storyboard

1. Lay a 12 column grid with a margin of 3.5% W and 8 rows on the wall, and keep two helpers, `colX(k)` and
   `rowY(k)`, so placement is written in grid units. Snap edges and centres to lines (half columns are fine). In the
   demo: the highlighter and rule run exactly columns 2 to 10 and the title is fitted inside them; the chart axes span
   columns 7 to 9 and rows 4 to 6; the pedestal slab runs columns 4.5 to 7.5; the donut centre sits on column 1 and row
   3; the icon tiles are centred on columns 3, 3.5 and 4 on row 7. If the grid is drawn, misalignment is visible.
2. Pick the palette: one dark ink, three accents, one paper. Assign each story object one accent and keep it.
3. Rebuild every object from primitives. If it needs a face, two ovals and a mouth shape at most; side characters are
   faceless.
4. Add 2 or 3 pieces of infographic furniture that relate to the story (a chart that grows on the key beat, a counter,
   an icon row, a callout with a dimension line). They animate on the beats, not continuously.
5. Give every solid object a 45 degree long shadow in the shared shadow pass for its depth layer.
6. Animate with wipes, rises from clips, slides on straight rails and morphs between primitives. Overshoot only on
   pops (`outBack`), never on positions of large blocks.
7. Lock the camera. If a beat needs emphasis, move a block or wipe a highlighter, not the view.

## 4. Common failure modes

- Gradients or soft drop shadows creep in: it turns into generic UI art. Shadows must be hard edged and 45 degrees.
- Drawing each shadow with rgba directly: overlapping shadows (adjacent letters, legs) double darken into stripes. Use
  the solid offscreen pass.
- Outlines on the hero: that is flat cartoon, not plano.
- Too many colours: more than 5 hues reads as clip art. Use a darker step of an existing hue instead.
- Off-grid placement: elements that do not snap to the grid look accidental. Captions and charts must align to columns.
- Wall shadows leaking onto the floor: clip wall passes to the wall.
- Morph targets sampled differently (different point counts or start angles): the shape twists through itself.
- Loop pops: anything that grows on a beat (chart, trail, highlighter) must be back to zero at 6 s, and periodic data
  motion must use integer cycles of `DURATION`. State that follows the hero (the people's look-at, hair offset, bun
  side) must return to the same value at 0 and 6 s: the hero is off screen LEFT at 0 and off screen RIGHT at 6, so a
  raw look-at snaps the hair across the head at the wrap. Ease it to one rest value near both ends.
- Neighbours that interact: raised arms that sweep sideways through a neighbour's head, or an exit hop that cuts
  through a crowd, read as collisions. Use pose swaps and an explicit reaction (duck, lean).
- Translucent strokes (a 55% alpha trail, fading arcs) create off palette greys. Shorten instead of fading.
- Every solid object casts a shadow, including confetti. Navy confetti over a caption reads as a typo; keep confetti to
  the accent hues.
- Fonts: use a geometric sans (Avenir Next Heavy, Futura, Montserrat). A humanist or system UI fallback weakens the look.

## 5. Reference searches (YouTube, Vimeo)

1. `flat design infographic animation long shadow motion graphics`
2. `editorial flat vector illustration explainer video corporate`
3. `flat 2D explainer animation grid layout after effects`
4. `geometric shape morph motion design infographic transition`
5. `annual report animated infographic flat vector data visualization`
