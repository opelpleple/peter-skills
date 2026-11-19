# Style recipe: Rubber Hose (1930s cartoon genre, made original)

Live demo: `https://peterbu.com/showcase/skills/video-like-peter/styles/rubber-hose/` (`index.html` + `hose.js`, built on
the shared `_engine/stage.js` and `_engine/scene.js`). Poster: `poster.png` (t = 2.8: the title letters dropping in one by
one, the hero on the bench pointing at the letter that is landing; captured headless at 1280x720 with
`?ui=0&play=0&dpr=1` and `window.__render(2.8)`). Reduced motion holds `keyTime: 4.2` (full title; the hero stands on
the bench in the ta-da pose, between the spin landing at 4.1 and the bounce at 4.25).

## 1. What defines the style

A frame reads as "early sound cartoon" at first glance because of six things together:

1. **Noodle limbs.** Arms and legs are constant width tubes with round caps. They bend in one smooth C curve and never have
   an elbow or a knee. The more a limb is compressed, the more it bows.
2. **Pie-cut eyes.** Tall white ovals with a black pupil that sits low, with a wedge of white bitten out of the pupil.
3. **White gloves and big boots.** Gloves that read as hands at thumbnail size: a big palm oval (0.35 r), three
   separate finger sausages, a thumb set apart at an angle, three stitch lines and a flared cuff wider than the arm.
   Fat oval boots with one shine.
4. **Everything breathes on the beat.** One tempo (here 120 bpm, beat = 0.5 s). Trees sway and pump, clouds swell,
   flowers bob, fence pickets pulse, the bench stands on its own little legs and boots, the title letters dance in
   alternation. Nothing in the world is ever fully still.
5. **Drawn on twos, projected at 24.** The hero changes drawing 12 times a second while the film (grain, weave, flicker)
   changes 24 times a second. Outlines boil slightly with every new drawing.
6. **It is old film.** Sepia tones only, grain, dust, hair, vertical scratches, exposure flicker, gate weave, a strong
   vignette and the rounded corners of a projector gate.

### Palette (sepia only, no hue)

| Role | Hex | Notes |
|---|---|---|
| Ink | `#1b140e` | every outline, the hero's body, boots, pupils; warm black, never `#000` |
| Gate / letterbox | `#0d0a07` | outside the rounded gate |
| Paper | `#f1e6cd` | sky low, face mask |
| Sky top | `#efe2c4` | gentle gradient to paper |
| Paper 2 | `#e5d4b0` | ground |
| Tone | `#c9b38a` | hills, bench plank, sunburst wedges at 22% alpha |
| Mid | `#9a8160` | tree crowns, leaves, tongue |
| Deep | `#5a4632` | title drop shadow |
| White | `#fbf6ea` | gloves, eye whites, clouds, title fill, petals |

Rule: five tones plus ink. Shading is flat tone or hatching, never soft gradients (the only gradients are the sky and
the vignette).

### Shape language

Circles and ovals first: the hero is one round ink drop (body and head in one) with a paper face mask notched for two
eyes, a single hair curl on top, a small oval nose and a wide grin with a tongue. Clouds, tree crowns, gloves and dust
puffs are clusters of circles with ONE shared outline. Ground objects are rounded and a little alive (the bench has
legs and boots). Title: a heavy slab or soft serif (Cooper Black if present, else Rockwell, Bodoni 72, Georgia), white
fill, fat round black outline, fat offset deep brown drop shadow, a thin tone pinstripe inside, small scroll ribbon.

### Set details

- Hills: three bezier segments, light from the left. Hatching only on the far (right) side of each crest: each line
  starts just under the curve (`hillAt(seg, u)`), runs down to the right, and its length tapers with
  `sin(pi v) ** 0.7` across the run, so the first and last lines are short.
- Fence: nine pickets between `u = 0.47` and `0.93` on the left hill segment (right of the tree crown), standing on
  the curve, with two rails that sample the same bezier (ink stroke `3.2 lw`, white `1.5 lw`).
- Bench: a soft ground shadow ellipse under it and a small one under each of its boots.
- Ground: a tone strip (55% then 30% alpha) under the horizon line, ten short dashes, nine pebbles with a tiny shadow
  and one shine, kept away from the bench.
- Tree crowns carry three leaf curls; in a triangle they read as a closed-eye smile. That is intended: in this genre
  the scenery is half alive.
- Notes in the celebration fade by scale (`outBack`), never by alpha.

### Line

- Outline weight about `H / 300` (2.4 px at 720p). Limbs are much heavier: legs 13% of body radius, arms 12%.
- Round caps and joins everywhere. Ink only.
- Line boil: every new drawing (12 per second) nudges outlines by up to 0.2% of H via `hash(drawingIndex, seed)`.
  The world boils (cloud and crown blob radii, hill control points, the pie-cut wedge angle) and so does the hero,
  with its own seed per part: body rx and ry, the sag of each leg and arm, and each glove's palm radius. The star must
  boil too, or "on twos" reads weaker on exactly the thing people watch.

### Texture and lighting

Flat, frontal, no light direction except one crescent highlight on the ink drop and one shine on each boot. The light
comes from the projector: flicker (exposure up or down by a few percent every frame) and a heavy vignette.

### Frame rate and stepping

- Stage runs at `fps: 24` (film frames). Grain, weave, flicker, dust and the world are evaluated at the stepped time.
- Hero, dust puffs, notes and the boil index use `tc = floor(t * 12) / 12` (on twos).
- Do not step the title; it moves at 24 so its squash reads smoothly.

### Timing and easing rules

- **Beat thump** `thump(t) = (0.5 + 0.5 cos(2 pi t / 0.5))^3`: 1 on the beat, drops fast. Use it for pumps and swells.
- **Two beat sway** `sin(2 pi t / 1.0)`: for leans and bobs. Both periods divide the 6 s loop, so the loop is seamless.
- Give each element its own phase offset so the world ripples instead of pulsing in unison.
- Squash and stretch are huge (body takes 55% of the shared `squashAt`, legs take 110%). The hero's contacts use the
  shared `squashAt` (it already snaps and rings); the title letters land with their own wobble `exp(-5v) cos(13v)`.
- Letters fall stretched (sx 0.82, sy 1.25), land, squash, wobble, then dance on alternate beats.
- Anticipation and overshoot on every hand pose (`inOutSine` between keyed poses: down, balance, up, point, ta-da).
- Gestures aim at something real. During the title build the hero points at the letter that is landing: the
  continuous index `kf = ((t - titleIn - 0.85 * fall) / (win * 0.6)) * (n - 1)` (fall = `win * 0.4 * 0.45`, the
  `letterReveal` fall time) picks the glyph, the arm on that side aims at it (the other rests on the hip), the glove
  extends its index finger, the pupils look there, and the hand jabs a little on every beat. The glove stops just
  short of the letter.
- Hands stay clear of the title: on the small ta-da bounce (4.25 to 4.85) the hands hold the wide, low ta-da pose
  (`+-2.0 r, -0.7 r`) and flap down as the body rises, instead of going to the airborne "up" pose.

### Camera

Locked off, frontal, stage-like. The only camera motion is the gate weave (a pixel or two of drift plus a tiny rotation
per film frame). No zooms, no pans.

## 2. Technique (exactly what the demo does)

Canvas 2D, `mount({ fps: 24, render, setup })`. No WebGL. Everything is vector paths redrawn each frame; about 8 ms a
frame at 1280x720 in headless Chrome.

Render order: `gate black > [weave transform: sky, sunburst, clouds, hills + hatching (clipped to the hill path),
fence rails + pickets, trees, ground + tone strip, pebbles, flowers, bench (with its ground shadow), title, speed lines,
hero, dust, notes] > grain > flicker > dust/hair/scratches > vignette > rounded gate`. Exception: from 4.15 to 4.95 the
title is drawn after the hero, so it covers the head on the ta-da bounce. The hero stands on the bench at both switch
points, so the layer change never shows. On the spin (3.5 to 4.1) the hero passes in front of the title on purpose.

### Hero scale and set

The hero is drawn 1.2x the shared radius (`HERO_SCALE`) around the same contact point, so the pose contract holds.
At the shared size (about 50 px radius at 720p) the eyes, gloves and limbs got lost against two trees, a fence,
hatching, a sunburst and four flowers. The title baseline is nudged up 3% of H to give the bigger hero room. Keep the
area behind the bench calm (no pebbles within 0.15 W of the bench).

### Noodle limb (the heart of the style)

```js
function hose(g, a, b, rest, side, w, sag = 0, bowK = 0.18) {
  const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
  const nx = (-dy / d) * side, ny = (dx / d) * side;          // outward normal
  const bow = rest * bowK + Math.max(0, rest - d) * 0.85;      // compress = bow more
  const c1 = [a[0] + dx * 0.3 + nx * bow, a[1] + dy * 0.3 + ny * bow + sag];
  const c2 = [a[0] + dx * 0.7 + nx * bow, a[1] + dy * 0.7 + ny * bow + sag];
  g.lineWidth = w; g.lineCap = 'round';
  g.beginPath(); g.moveTo(...a); g.bezierCurveTo(...c1, ...c2, ...b); g.stroke();
}
```

Legs are the style. Rest length is about 1.05 r (`leg = r * 1.05 * clamp(1 - s * 1.1, 0.4, 1.35)`), the rest bow is
`bowK = 0.3` (arms keep 0.18), feet stand about 0.72 r either side of the centre, and each leg bows outward like a
pair of brackets `( )` (left leg `side = +1`, right leg `side = -1` for a downward limb). Short legs with a small bow
read as two straight stubs; long, visibly bowed legs read as rubber hose even when standing still.

Hips and shoulders live in body space (rotated with the spin). Grounded feet are planted in world space at the contact
point, so a squash bows the legs out. Airborne feet hang in body space, tucked while rising, reaching while falling
(sign of `pose(t + 1/48).y - pose(t).y`). The body is raised above the contact point by the leg length, so the shared
contact contract still holds.

### Glove (reads as a hand, not a cloud)

In glove space (+x from the wrist to the fingers): three finger sausages (`ellipse` rotated to `-0.5, 0, 0.52` rad,
length about 0.27 r, half thickness 0.115 r) drawn bottom to top, each with its own fill and outline so the gaps
show; a thumb at about `-1.42` rad, set apart; then the palm oval (radius 0.35 r) on top of the finger roots; three
stitch lines on the back; and a flared cuff (half height 0.24 r at the arm end, 0.16 r at the hand) with a rolled lip,
wider than the 0.12 r arm. The left glove is mirrored (`scale(1, -1)`) so both thumbs face up. A `point` amount
straightens and lengthens the index finger (to 0.5 r) and curls the other two. Merging all of it into one `blobs()`
outline, or a palm under 0.35 r, turns the glove into popcorn.

### One outline for a cluster of circles (clouds, crowns, puffs, petals)

```js
function blobs(g, circles, fill, lw) {
  g.lineWidth = lw * 2; g.strokeStyle = INK; g.beginPath();
  for (const [x, y, r] of circles) { g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU); }
  g.stroke();            // fat outline of every circle
  g.fillStyle = fill; g.fill();   // fill covers the inner half of every stroke
}
```

### Pie-cut eye

Clip to the eye oval, draw the pupil low and toward the look direction, then fill a white wedge
`arc(px, py, prx * 1.3, a0, a0 + 0.95)` out of it. Blink is an ink rect rolling down inside the same clip.

### Film layer

- Grain: three 256 px tiles built once in `setup` from `rng(seed)` (9% warm-ink specks, 7% paper-white specks, random
  alpha), used as `createPattern`, chosen by `frame % 3` and offset by `hash(frame)`; drawn at 60% alpha.
- Flicker: full-frame fill, paper white or ink. `fl = hash(frame) - 0.5 + 0.15 sin(0.9 frame)`; white at `fl * 0.07`
  (at most about 4.6%) or ink at `-fl * 0.1` (at most about 6.5%).
- Dust: 0 to 3 specks per frame from `hash`, about 1 in 5.5 frames a hair (one bezier). Scratches: a thin vertical line chosen
  per 9-frame segment, drifting a little.
- Weave: `x = (sin(2 pi t / 3) * 0.5 + jitter) * 0.003 H`, `y = (sin(2 pi t / 2 + 1) * 0.6 + jitter) * 0.004 H`, with
  `jitter = hash(frame) - 0.5`, plus `rotate(+-0.00075)`.
- Vignette: radial gradient baked once into a 480x270 canvas, stretched over the frame.
- Gate: `rect` plus inner `roundRect` filled with `evenodd`.
- All of it keyed on `frame = floor(t * 24) % 144`, so frame 0 equals the frame after 5.999.

## 3. Applying it to any storyboard

1. Pick one tempo (100 to 130 bpm) whose beat divides the shot length. Put every background element on it with its
   own phase. Hit important actions on beats.
2. Design characters as circles: round head or body, pie-cut eyes, gloves, boots, a single silhouette accessory (curl,
   hat, tail). Every limb is a `hose()`.
3. Animate the character on twos at 24 fps film; stepped hand poses with anticipation and overshoot; big squash.
4. Give props a little life (legs, a bob, a breath) but keep them faceless or simple so the hero stays the star.
5. Titles: heavy serif, white fill, fat outline, fat drop shadow, letters that fall and dance.
6. Finish every shot with the same film layer. Keep the palette to the sepia ramp above.
7. Transitions in this genre: iris in or out (a circle mask), or a hard cut on a beat. If the loop must be seamless,
   keep the iris fully open at both ends.

## 4. Common failure modes

- **Elbows sneak in.** Polylines or two-segment arms instantly kill the look. One bezier per limb, constant width.
- **Pure black and grey.** Use the warm ink and paper; neutral greys look like a desaturated modern cartoon.
- **Too much grain or flicker.** Above about 0.6 alpha grain or 10% flicker the drawing turns to mush and strobes.
- **Stepping everything.** Stepping the title or the film layer at 12 looks laggy; only the character goes on twos.
- **Unison breathing.** All props pumping in phase reads as a screen pulse. Offset phases.
- **Dead holds.** Any element fully still for more than a beat breaks the genre. Add a bob or a toe tap.
- **Boil too strong.** More than about 0.3% of H of jitter looks like a bug, not hand drawing.
- **Copying a real character.** Avoid round black ears, a specific cat, a specific mouse, a cup head, red shorts,
  specific studio title cards. Build the hero from your own silhouette idea (here: an ink drop with a curl).
- **Seam breaks.** Background drift that is not periodic in the loop length, or grain keyed on wall time.
- **Gloves too small or merged.** Palm radius about 0.35 r, fingers and thumb as separate outlined shapes, cuff wider
  than the arm. One merged blob of small circles reads as popcorn or a chef hat.
- **Stubby legs.** Legs under about 1 r with a small bow read as straight stubs. Long and visibly bowed.
- **Gestures at nothing.** A point into empty sky reads as a pose, not a beat. Aim it at the thing that is happening.
- **Hands in the title.** Raised hands and a bouncing head cover the letters. Keep the ta-da wide and low, and layer
  the title over the hero for that beat.
- **Stamped textures.** Hatching that starts on a straight edge reads as a texture block. Start every line on the
  curve it shades, on the far side of the crest, and taper the first and last lines.
- **Floating props.** A fence needs rails that follow the hill and pickets standing on the curve; a bench needs a
  ground shadow under it and under each boot; a tree trunk should flare into roots, not end in a lump.
- **Flat empty ground.** Give the ground band a soft tone strip under the horizon and a few rounded pebbles rather
  than random dashes.
- **Fading by alpha.** Faint ink over sepia goes neutral grey. Fade small things (notes, puffs) with scale.

## 5. Reference searches (YouTube / Vimeo)

1. `1930s rubber hose animation walk cycle breakdown`
2. `early sound cartoon "on the beat" background animation dancing trees`
3. `pie cut eyes cartoon character design tutorial vintage`
4. `old film grain gate weave flicker after effects tutorial sepia`
5. `rubber hose style modern indie animation short vimeo`
