# Style recipe: Pizarra (chalk on slate, drawn by hand, wiped by felt)

Live demo: `https://peterbu.com/showcase/skills/video-like-peter/styles/pizarra/` (`index.html` + `pizarra.js`, built on
the shared `_engine/stage.js` and `_engine/scene.js`). Poster: `poster.png` (t = 3.9, title written and underlined, spin
arrows drawn, the chalk stick writing "360"; captured headless at 1280x720 with `?ui=0&play=0&dpr=1` and `window.__render(3.9)`).

## 1. What defines the style

A chalkboard frame reads at first glance because of four things together: **a dark green slate that has been erased many
times** (soft white clouds, swipe arcs, a blurred ghost of last week's lesson), **a wooden frame with a chalk tray**,
**every mark is chalk with broken, powdery edges**, and **the tools are physically in the scene and make every mark**: one chalk
stick leaves the tray and draws everything (the plan, the list ticks, the title, the spin notes, a gold star) before going
back; a felt eraser leaves the tray, wipes the title, makes a second pass up the tick column and goes back. Small notes leave
by a thumb smudge. Nothing appears or disappears by itself. The board is a lesson: a "Lesson 7" heading and a three item
list ("1. hop", "2. land", "3. spin") in the top corners, a dashed "plan" arc with a "jump!" note before the jump, ticks as
each item is done, spin arrows with "360°", and a gold star when the list is complete.

### Palette

| Role | Hex | Used for |
|---|---|---|
| Slate light | `#26362d` | radial centre (classroom light on the board) |
| Slate | `#1c2822` | board mid tone |
| Slate edge | `#0f1712` | radial edge, then a 42% black vignette |
| White chalk | `#f1eee4` | outlines, lettering, floor, ticks, speed lines |
| Yellow chalk | `#f3d36b` | character fill hatch, checkmarks, the gold star, notes |
| Pink chalk | `#f2a0b5` | title underline, spin arrows, cheeks |
| Blue chalk | `#9fd3e6` | hatching on the bench (secondary volumes) |
| Wood light / mid / dark | `#b07a46` / `#8a5a33` / `#5c3a1f` | frame rails, tray, eraser back |
| Felt / felt dark | `#7a7871` / `#55534d` | eraser pad (gradient to `#a3a199` at the working face, caked chalk patches) |

Rule: chalk colours are always light, never saturated, never dark. Nothing on the board is filled solid except the eyes;
volume is hatching. Three chalk colours plus white is the maximum.

### Shape language and line

- Teacher sketch: overshooting lines (each bench edge extends 0.6%H past its corners), circles that overshoot their start
  (1.1 turns) plus a lighter second loop that does not quite agree with the first.
- Chalk line weights (nominal): title 1.35%H, character outline 0.72%H, floor 0.65%H, hatch 0.32 to 0.42%H, small text
  8.5% of its size.
- Hand lettering: one original single stroke glyph set (cubic and line segments in em units, cap 1, x height about 0.6,
  descender 0.36) used for ALL text: title, "Lesson 7", the list, "jump!", "360°" and the ghost writing on the slate. No
  fonts, so nothing falls back to Comic Sans on another machine. `layoutText()` sets slant 0.1, per letter rotation, scale
  and baseline jitter from `hash(letterIndex, seed)`, plus a low frequency wobble along every stroke. Glyphs: S e v n h m
  k i j l L o a d b p c u x s ! . ° + = ? 0 1 2 3 4 6 7.
- Pressure: every lettering stroke is resampled once (step 0.28 w) and drawn as one filled outline per run whose width
  follows a pressure factor: `0.8 + 0.3 sin(heading)` (downstrokes thick, upstrokes thin), minus up to 32% on tight joins,
  a touch down taper over 1.3 w and a lift off taper over 2.2 w, a slow 0.88 to 1.12 hand wobble, and on long strokes
  (over 7 w, width over 4 px) small dry gaps where a value noise along the stroke crosses 0.8 to 0.9. Bristles ride the
  same pressure (offset scales with local width) so thin parts stay thin.
- Character: chalk circle with a cowlick curl, yellow diagonal hatch (alpha 0.62) clipped analytically to the ellipse, a
  sparser cross hatch on the shade side, a rubbed out face patch (soft destination-out ellipse) so the eyes, pink cheeks
  and smile read clearly, and two small oval feet under the body that dangle 10% of ry while airborne. The body knocks out
  the chalk behind it (destination-out at 0.92) so chalk never crosses chalk inside it, which matters when the spin apex
  passes the title underline.
- Shadows are scribbles: 7 short slanted strokes under the contact point that shrink with height.

### Texture and lighting

- Slate (built once per size): radial base, 34 rotated elliptical radial clouds (alpha 0.018 to 0.058), 9 wide swipe arcs
  with 22 thin streaks each, blurred ghost writing in the glyph hand at alpha 0.06, a 160 px binary grain tile at alpha 6 to 18, vignette,
  then the wooden rails and tray (wood gradient + bezier grain lines), dust specks in the tray, three unused chalk stubs.
- Chalk grain: a 256 px alpha mask of speckle holes plus streaks along a slope of 1/3, punched out of the chalk layer with
  `destination-out`. The streak key is `(3y + x) mod S`, so the tile repeats with no seam.
- Lighting is only the slate radial and the props' own shadows (blurred, offset grows with lift).

### Frame rate, timing, easing

- Motion is smooth 60 fps (`fps: null`), but the character outline **boils at 12 fps** (`boil = floor(t * 12)` seeds the
  wobble phases and hatch jitter), so it feels redrawn by hand. The title, floor and bench do not boil: real chalk on a
  board is still, only the "animated" thing is redrawn.
- Writing: one pen moves through all title strokes in order, `s = total * (0.72u + 0.28 inOutSine(u))` over 2.05 to 3.32,
  with a pen lift of 0.32 cap between strokes (the stick lifts in an arc, its shadow grows). The pink underline swoosh is
  the last stroke.
- The chalk stick's day is one schedule of draw windows; the moves between them are generated (quadratic bezier with
  the control point raised by max(0.03H, 0.32 x distance), inOutCubic). Every draw uses the same pen curve as the title
  and the stick tip follows the pen head, lifting in an arc between strokes:

  | Draws | Window (s) | Removed by |
  |---|---|---|
  | dashed plan arc + arrow head | 0.30 to 0.58 | thumb smudge 1.30 to 1.85 |
  | "jump!" (above the arc peak, clear of the head) | 0.64 to 0.88 | thumb smudge 1.36 to 1.85 |
  | tick "1. hop" | 1.06 to 1.15 | eraser tick column pass |
  | tick "2. land" | 1.24 to 1.33 | eraser tick column pass |
  | title + pink underline | 2.05 to 3.32 | eraser wipe |
  | right spin arrow, left spin arrow | 3.38 to 3.50, 3.57 to 3.69 | thumb smudge 4.45 to 4.85 |
  | "360°" | 3.78 to 3.98 | thumb smudge 4.50 to 4.85 |
  | tick "3. spin" | 4.12 to 4.21 | eraser wipe (end of band) |
  | gold star under the ticks | 4.27 to 4.40 | eraser wipe (end of band) |

  The stick leaves the tray at 0.05 (angle 0 to -0.95 rad) and is back at 4.66. While lifted it sheds a faint powder
  trail (7 dots sampled from its own past positions).
- Eraser: tray to title 4.55 to 5.0 (turning from the lying view to the held view), wipes 5.0 to 5.5 (inOutSine, a 3 hump
  vertical wiggle), slides up the tick column along its own length 5.5 to 5.64 (to 0.813W, 0.11H), returns over the top
  5.64 to 5.97. Both props rest in the tray at t = 0, so the loop closes on physical props.
- Thumb smudge: the mark fades over the first 80% of the window while three copies of its strokes are pushed 3.5%H along
  the rub direction, widened 1.6 to 4.6x and blurred; a 0.06 residual smear stays until the loop end.
- Everything transient left at the end (smudge residue, eraser haze, ghost title, exit speed lines) is multiplied by
  `1 - smoothstep(5.62, 5.97, t)`. Dust particles use `wrap(t - emitTime)` so particles born late in the loop are still
  falling at t = 0 (periodic, no pop at the seam).

### Camera

Locked off, straight on, like standing in front of the board. No shake; impact is told by dust puffs and six short action ticks that spring out of each landing for 0.34 s. These are motion marks of the animated character (boiled like the outline), not lesson marks, so they are the one chalk element no tool draws.

## 2. Technique (Canvas 2D, no WebGL)

Three canvases: slate (static), static chalk (floor, bench, heading, list; grain already punched), and one dynamic chalk
layer cleared every frame. Draw order on the main canvas: slate, eraser smear, static chalk, dynamic chalk layer, dust
dots, eraser, chalk stick.

Dry brush chalk stroke = core line + four bristle lines at a fixed offset (the chalk is held at one angle):

```js
const BRISTLES = [[-0.34, 0.24], [0.32, -0.2], [0.14, 0.42], [-0.18, -0.44]];
function chalk(g, build, w, color, alpha = 1) {
  g.lineCap = g.lineJoin = 'round'; g.strokeStyle = color;
  g.globalAlpha = alpha * 0.88; g.lineWidth = w; g.beginPath(); build(0, 0); g.stroke();
  g.globalAlpha = alpha * 0.5; g.lineWidth = w * 0.42;
  for (const [bx, by] of BRISTLES) { g.beginPath(); build(bx * w, by * w); g.stroke(); }
  g.globalAlpha = 1;
}
// build = (dx, dy) => partial(g, pts, u, dx, dy)   // draw-on by length
```

Grain punch (after everything is drawn into the layer, before compositing):

```js
lc.setTransform(1, 0, 0, 1, 0, 0);
lc.globalCompositeOperation = 'destination-out';
lc.fillStyle = grainPattern;          // alpha mask: speckles + 1/3 slope streaks
lc.fillRect(0, 0, pw, ph);
```

Eraser wipe = the same layer, `destination-out`, stroking the wipe path up to the eraser's progress with
`lineWidth = band height` and `lineCap = 'butt'` (the leading edge is the felt edge), plus 8 thin half-alpha streaks just
past the band for ragged edges; the tick column pass is a second butt stroke 0.085H wide. Title, ticks and star are drawn
before the wipe and the character after it, so the eraser never removes the character. On the slate underneath, the
smear follows the wavy pass up to the eraser: a 7 px blurred haze band at alpha 0.085 (plus a narrower 0.05 band), 48
long streaks that follow the wiggle, 12 brighter short streaks piled at the band edge at each turn of the pass (u = 1/6,
1/2, 5/6, 1), and a ghost of "Seven Skills" (title strokes, blurred, alpha 0.05) where the felt has been.

The eraser is a prop, not chalk: a wooden block on a thick grey felt pad (felt sticks out 0.004H past the wood, a dark seam,
caked chalk patches, fuzzy fibres along the working face). A `view` parameter blends two looks: 0 = lying felt down in
the tray, seen from the front (thin top face, tall wooden side, felt band at the bottom); 1 = held to the board, three
quarters from behind (wide wooden back with finger groove and chalky prints, narrow side, felt edge showing).

Speed lines are two long tapered fills (0.9%H to 0.15%H) with two thin bristles, laid along the direction the body came
from (sampled from `pose(t - 0.09)`) with a slight droop, so they never break into dashes.

Deterministic particles (no state):

```js
const d = wrap(t - te);                           // age, wraps across the loop seam
if (d < life) dot(x0 + vx * (1 - Math.exp(-k * d)) / k, y0 + vy * d + 0.5 * grav * d * d, 1 - d / life);
```

## 3. Applying it to any storyboard

1. Decide what is chalk (on the board) and what is a prop (in front of it). Characters, set, text, arrows are chalk. Only
   tools are props (chalk stick, eraser, maybe a ruler or a pointer stick).
2. Every new element arrives by being drawn (partial polyline by length, a pen moving through it) or by a quick reveal for
   small notes. Every exit is an eraser wipe, a thumb smudge (fade + smear), or the character walking off the board edge
   (clip to the board rect so it disappears behind the frame).
3. Turn the action into a lesson: draw the plan before the move (dashed arc, target X), mark the result after it (ticks,
   check, a note like "360 deg"), keep a checklist that gets ticked.
4. Scene changes = a full board wipe: the eraser crosses the frame in 2 to 3 overlapping bands, the next scene is drawn on
   the smeared board.
5. Keep the props' rest positions identical at the start and end of a loop.

## 4. Common failure modes

- Clean vector lines with a white glow: reads as neon or whiteboard, not chalk. Needs bristles plus grain holes.
- Grain that moves every frame on static writing: looks like TV noise. Only boil the animated character.
- Saturated or dark chalk colours, or solid fills: chalk is pale and powdery; use hatching.
- A pristine black board: the history of erasing (clouds, swipe arcs, ghost text) is half of the look.
- Writing appearing without a tool, or the tool not matching the stroke being drawn: sync the stick tip to the pen head.
  Marks also must not vanish by an alpha fade: use a thumb smudge or an eraser pass.
- A font for small notes next to custom glyphs: it reads as type and falls back to Comic Sans elsewhere. One glyph hand.
- Monoline lettering: chalk needs pressure (thick downstrokes, thin joins and lift offs, dry gaps on long strokes).
- An eraser drawn as a flat bar reads as a ruler or nameplate: show the thick dusty felt pad and the wooden block.
- Chalk crossing chalk at overlaps (label under the hop apex, spin through the title): move notes clear of the motion
  path and let the body knock out the chalk behind it.
- Short constant width speed lines get chopped by the grain into barcodes: use few, long, tapered strokes.
- Eraser removing the character: draw order matters (wipe the layer before drawing the character).
- Seam pops: particles born after 5 s must use the wrapped age; transient marks must fade before 5.97.
- Grain tile seams: build the streak key so it wraps with the tile.
- A 5-point star drawn with a 72 degree step comes out as a pentagon. Step 144 degrees.

## 5. Reference searches (YouTube / Vimeo)

1. `chalkboard animation hand drawn chalk motion graphics`
2. `chalk stop motion blackboard animation short film`
3. `blackboard explainer video chalk drawing timelapse`
4. `chalk art lettering timelapse chalkboard typography`
5. `eraser wipe transition chalkboard animation`
