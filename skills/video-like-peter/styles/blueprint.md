# Style recipe: Blueprint (self drafting line work, measured motion)

Live demo: `https://peterbu.com/showcase/skills/video-like-peter/styles/blueprint/` (`index.html` + `blueprint.js`,
built on the shared `_engine/stage.js` and `_engine/scene.js`). Poster: `poster.png` (t = 2.8, the title half drafted with
live pen nibs; captured headless at 1280x720 with `?ui=0&play=0&dpr=1` and `window.__render(2.8)`).

## 1. What defines the style

A blueprint frame reads at first glance because of: **deep blue sheet with grain and a grid**, **white object lines plus
cyan construction lines and nothing else**, **every element arrives by being drawn** (a pen travels the stroke), and
**drafting furniture**: frame with zone marks, title block, dimensions, leaders, notes, datum. The motion feels measured
because the drawing *annotates the motion*: trajectories, time stations, apex heights, rotation angles, live readouts.

### Palette

| Role | Hex | Used for |
|---|---|---|
| Paper edge | `#062650` | outer radial stop, vignette direction |
| Paper | `#0d3c74` | sheet mid tone, knock out boxes behind dimension text |
| Paper hot spot | `#17528f` | radial centre (light through the print) |
| Part fill | `#0c3a70` | solid fill inside drawn parts so the grid does not show through |
| Ink (object line) | `#eaf4ff` | outlines, letters, frame, datum, title block values |
| Cyan (construction) | `#8fdcff` | guides, dimensions, hatching, trails, ghosts, leaders |
| Dim text | `#bfe9ff` | numbers and small labels |
| Grid | `rgba(150,200,255,0.085)` minor, `0.19` major every 5 | sheet grid |

Rule: two line colours only. Hierarchy comes from **line weight** (object 1.5 to 1.8x, construction 0.6x) and **dash
pattern** (solid object, dashed hidden/construction, chain long-short centre lines), never from new hues.

### Shape language and line

- Object lines: solid white, round caps for lettering, a soft cyan bloom underneath (same path, alpha 0.16): 3.4x width
  for normal lines, 1.6x for the heavy title strokes, 2.2x for burst symbols.
- Hidden lines: dashed `[1.2%H, 0.8%H]`. Centre lines: chain `[3%H, 0.8%H, 0.4%H, 0.8%H]`. Construction: thin cyan dashes.
- Section hatching at 45 degrees, clipped to the part (platform, lower body of the character) instead of shading.
- Character: a drafted round unit: outer contour, inner shell arc, rotating chain centre lines, waist line with hatch below,
  probe antenna, foot pads, round eyes. Volume = hatch, not gradients.
- Lettering: original single stroke glyphs (polylines in a cap height box), slant constant `SLANT = 0.12` (x shift per cap
  height, atan = 6.8 degrees, labelled "7 DEG"), word space `SPACE = 0.62`, letter gap `GAP = 0.24` (both in cap heights),
  drawn on CAP / WAIST / BASE guides with letter box ticks. Uppercase. The same glyph table, at small size and stroked into
  the paper, sets the sheet heading (`FIG. 07  HOP STUDY / SIDE ELEVATION`, cap 1.7%H) and the title block project name
  (`SEVEN SKILLS`, cap 1.9%H), so the furniture reads drafted, not typed.
- Annotation text: monospace (`Menlo, SF Mono, ui-monospace`), uppercase, small, values in H/1000 units.

### Texture and lighting

Built once per size into an offscreen canvas: radial base, 14 random exposure blotches (`rng(7)`), a 160 px binary
grain tile (`rng(19)`) at low alpha, grid, two light/dark fold creases, frame with zone numbers and letters, centring
marks, datum line with earth hatch, headings, notes, title block cells, vignette. No live lighting. The only "light"
is the pen nib: a radial glow dot at the head of every stroke that is currently drawing. Halo alpha 0.45 on thin lines,
0.3 on the title letters, burst symbols and the revision triangle, so a nib never outshines the object lines.

### Frame rate, timing, easing

- Smooth 60 fps (`fps: null`). The character uses the shared `pose(t)` unchanged.
- Every drafted element uses an envelope `env(t, a, b, c, d)` = min(inOutCubic in, 1 minus inOutCubic out): arrives with
  a mechanical ease, holds, retracts along the same path in reverse. Letters use inOutSine.
- Order of construction mirrors real drafting: centre line, outline, hatch, hidden lines, dimensions, callout text.
  Dimensions: extension lines (first 40%), dimension line grows from the middle out, arrowheads snap at 70%, value fades last.
- Title: guides 1.95 to 2.35, slant guides 2.1 to 2.4, letters staggered 2.3 to 3.35 (spread 0.72), width dimension 3.0
  to 3.45, guides dim to 42% once lettered. Out: letters erase right to left 5.0 to 5.55, guides retract 5.15 to 5.55.
- Platform, staged per element (in / out): centre line chain 0.02 to 0.2 / 5.75 to 5.98; outline 0.05 to 0.32 / 5.7 to
  5.95; pedestal hidden lines, base plate and hatch 0.22 to 0.42 / 5.6 to 5.85 (hatch lines staggered across 0.2 to 0.48);
  dimensions 0.3 to 0.6 / 5.55 to 5.85; part callout (right of the plinth) 0.42 to 0.62 / 5.5 to 5.75. Frame 0 is an empty
  sheet and the loop is seamless.
- STA 1 floor station (hop 1 landing tick + label): 0.55 to 0.8 in, 1.6 to 1.9 out, so it retracts with the hop 2
  trajectory instead of sitting orphaned on the floor.
- UNIT 07 callout (live D / SX / SY): 1.9 to 2.3 in, 3.36 to 3.52 out. It arrives after the hop 2 ghosts are gone and
  leaves before the spin hop rises into the lettering.
- Spin (3.5 to 4.1): rotation arc of radius 1.6r sweeping 0.94 of a full turn with an arrowhead, fading over 0.4 s after
  the spin lands. The `ROTATION / 000 DEG` readout is parked at a fixed point (plinth centre + 0.2W, title base + 0.1H).
- Burst (4.1 to 5.0, `celebrateBurst`): 12 rays, rays more than 20 degrees under the horizon (`sin > 0.35`) skipped. Each
  symbol (circle, cross, triangle, square, size 1.6%H) is drafted by length with a nib, staggered per ray. Its reach is
  shortened until it clears the padded title bbox, the plinth callout, the rotation readout and the title block; if it
  cannot clear them at 1.75r it is dropped.
- Revision (title block REV cell): A crossfades to B at 4.2 to 4.38 and back at 5.62 to 5.8; a revision triangle with
  "1" and the note `SPIN ADDED` drafts in 4.12 to 4.42 and retracts 5.62 to 5.9. The title block takes part in the story.
- Transients (trails, ghosts, impacts) are multiplied by `loopFade(t) = 1 - smoothstep(5.62, 5.97, t)`.
- The only thing allowed to jump at the loop point is the TIME / FRAME readout in the title block (it is a clock).

### Camera

Locked off. A drafting table does not move; the drawing does the work. No shake on impacts; impact is shown as
compression ticks and a dashed contact ring.

## 2. Technique (Canvas 2D, no WebGL)

Pure Canvas 2D. Everything is a polyline revealed by length, so "draws itself" is one helper:

```js
function partial(g, pts, u, total = polyLen(pts)) { // add first u of a polyline to the path, return pen point
  let left = clamp(u) * total; g.moveTo(...pts[0]);
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], s = Math.hypot(x1 - x0, y1 - y0);
    if (s >= left) { const k = left / s, x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k; g.lineTo(x, y); return [x, y]; }
    g.lineTo(x1, y1); left -= s;
  }
  return pts[pts.length - 1];
}
function inkStroke(g, build, lw, color, alpha, glow = true, bloom = 3.4) {
  if (glow) { g.strokeStyle = 'rgba(143,220,255,0.16)'; g.lineWidth = lw * bloom; g.beginPath(); build(); g.stroke(); }
  g.strokeStyle = color; g.lineWidth = lw; g.beginPath(); build(); g.stroke();
}
const env = (t, a, b, c = 99, d = 100) =>
  Math.min(ease.inOutCubic(prog(t, a, b)), 1 - ease.inOutCubic(prog(t, c, d)));
```

Dashes work with partial reveal because `setLineDash` applies to the sub path. Multi stroke glyphs: spend the reveal
length across strokes in order, and draw a nib at the returned pen point while `0 < u < 1`.

Single stroke glyph table (unit cap height, x scaled by glyph width, slant applied as `x += (1 - y) * SLANT * cap`):

```js
E: { w: 0.54, strokes: [[[1,0],[0,0],[0,1],[1,1]], [[0,0.5],[0.78,0.5]]] },
K: { w: 0.6,  strokes: [[[0,0],[0,1]], [[1,0],[0,0.62]], [[0.3,0.4],[1,1]]] },
S: two elliptical arcs sampled every 12 degrees, upper bowl -25 to -270, lower bowl -90 to 158
```

Dimension helper `dim(g, x1, y1, x2, y2, off, text, u, H)`: normal offset, extension lines with gap and overshoot,
dimension line grown from the midpoint, filled arrowheads, text rotated to the line and kept upright, with a paper
coloured knock out rectangle behind it so the line breaks for the number.

Motion study (the signature move): for each travelling hop, sample `hopArc` 48 times and reveal the dashed trajectory up
to the hop's progress (the trajectory fades from hop end + 0.35 to hop end + 1.0); at 5 fixed time stations per hop draw a
dashed ghost outline of `pose(tk)` with its time label (chronophotograph); each ghost holds 0.15 s after its station, then
fades linearly until `tk + 0.85`. Big hop gets an apex marker and a vertical height dimension on the left of the apex (the plinth callout lives on the
right so the two never cross). Spin gets a rotation arc with arrowhead and a parked degree readout. Celebration = 12
radial leaders ending in drafted symbols, kept off the plinth and off every text box (see the timing list). While airborne the
character drops a dashed projection line to the floor with a dashed footprint ellipse. A leader callout shows live
`SX / SY` squash values (label parked at the rest pose, leader stretches to the moving body).

Draw order: hop study, title guides + width dimension, platform, impacts, celebration, character, unit callout, then the
title letters last. The letters are knocked out of the body: under each letter stroke, clipped to the body ellipse, stroke
the same path in the part fill colour at 2.4x width, then ink it. A drafter breaks the line under lettering, so the title
always reads whole even when the spin hop carries the body into it.

Clip all dynamic drawing to the inner frame rect so things enter and leave "the sheet", not the canvas. With the gallery
UI visible the stage gets a 46 px top strip for the bar, so the frame border and zone numbers are never hidden.

## 3. Applying it to any storyboard

1. Build the sheet first: frame, zone marks, title block (project name, drawing number, live time), notes, datum. That
   alone sells the look.
2. Every new set piece enters by construction order (centre line, outline, hatch, dimensions, callout) and exits by
   retracting. Schedule construction to finish just before the beat that needs the object.
3. Turn each action beat into an annotation: a move gets a trajectory and time stations, a jump an apex dimension, a turn
   an angle arc, a size change a live readout, an impact compression ticks. Ask "what would an engineer measure here?"
4. Text beats become lettering on guides, plus a width dimension once complete. Product UI or logos: trace them as line
   art (outline only, hatch for solid areas), never paste raster.
5. Keep two colours; add emphasis with weight, bloom and the pen nib, not with a new hue. If you truly need an accent,
   one red pencil revision cloud per film, maximum.

## 4. Failure modes

- Glow too wide on thick strokes turns letters into neon tubes: lower bloom for heavy strokes (title uses 1.6x) and drop
  the nib halo to 0.3 on them. It should read as ink on a print, not a light sign.
- Labels that follow a moving body collide with the title: park labels at a rest pose, let only the leader move.
- Readouts tied to the moving body (degree label, burst symbols) must avoid the title bbox and every callout box: park the
  readout, shorten or drop burst rays whose symbol would land in a box, fade callouts before a hop that rises into text.
- A body with a solid fill that passes over the title hides letters: draw the letters after the body and knock them out.
- An annotation that outlives its subject reads as debris (a floor station tick with no trajectory): retract each mark
  with the thing it measures.
- Things popping at the loop: platform and guides must retract to zero before 6.0, transients need `loopFade`.
- Grid visible through the character: give parts a solid fill in a paper tone before outlining.
- Too many annotations at once reads as noise: each beat introduces at most 2 new annotation types; fade old ones before
  bringing in the next callout (the UNIT 07 callout waits for the hop 2 ghosts to clear).
- Using a system font for the title looks like a word processor; single stroke polylines are what make it drafting.
- Pure flat blue looks like a UI background: the grain, blotches, folds and vignette are not optional.
- Per frame `createRadialGradient` for every nib is fine (few nibs), but do not build the paper per frame.

## 5. Reference searches (YouTube / Vimeo)

1. `blueprint animation technical drawing motion graphics`
2. `self drawing line animation engineering schematic`
3. `exploded view blueprint product animation`
4. `chronophotography motion study animation`
5. `cyanotype technical illustration title sequence`
