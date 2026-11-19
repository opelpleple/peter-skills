# Style recipe: Cardboard Cutout (corrugated card, split pins, masking tape, hand moved stop motion)

Live demo: `https://peterbu.com/showcase/skills/video-like-peter/styles/cardboard-cutout/` (`index.html` +
`cardboard.js`, on the shared `_engine/stage.js` and `_engine/scene.js`). Poster: `poster.png` (t = 2.8: the hanging
card letters dropping in on their threads, the puppet on the box pointing up at them; captured headless at 1280x720
with `?ui=0&play=0&dpr=1` and `window.__render(2.8)`). Reduced motion holds the engine key frame (t = 4.2, title up,
arms raised, confetti in the air).

## 1. What defines the style

A frame reads as "cardboard cutout" at first glance when these appear together:

1. **Every object is a flat cut sheet with a visible thickness.** A darker corrugated cut edge (2 to 9 px at 720p,
   with vertical flute stripes) shows on the side away from the lamp. That edge is the single most important cue.
   Keep one thickness language: letters about 5 px (`0.0075H`) like the box, never a 10 px plus stack (that reads as
   WordArt extrusion). The hero puppet gets the clearest edge on screen: `0.17r` thick, light kraft edge `#d2a066`,
   wide dark flutes (`fluteW: 3.4, fluteAlpha: 0.62, edgeShade: 0.12`).
2. **Layers cast soft paper shadows** on whatever sits behind them, offset down right, blurred, multiplied.
   Distance between layers is shown by shadow offset, not by perspective.
3. **Crafted joins are visible**: brass split pins at every joint, masking tape at every mount, threads for flying
   pieces, a packing tape strip on the box.
4. **Craft paint on kraft**: matte flat colours with dry brush streaks, ghost flute ridges showing through the paint and
   specks of bare kraft. Nothing glossy, nothing gradient filled except a lamp falloff.
5. **Hand moved at 12 fps**: every stepped frame each moving piece is nudged a pixel or two and a degree or so; light
   breathes a little; the film grain changes. It must look photographed one frame at a time.
6. **A tabletop set**: kraft wall, a painted sky panel taped on, a scalloped card pelmet, a floor board whose front
   edge shows the corrugated cross section (liner, wave, liner, dark hollows), and a green cutting mat with offcuts and
   a pencil in front.

### Palette

| Role | Hex | Notes |
|---|---|---|
| Kraft wall | `#b88452` | base board; light kraft `#cf9f6a` |
| Cut edge | `#a8743f` | stacked edge, flute stripes `rgba(70,40,15,0.45)` |
| Cross section hollow | `#5e3b1d` to `#3e2510` | the dark gaps of the corrugated edge |
| Sky paint | `#9ccad3` | lighter strokes `#bfe0e2` |
| Pelmet | `#c8472f` | tomato red, cream trim line, mustard dots |
| Sun | `#f0b43c` rays, `#f6c85a` disc | crayon cheeks |
| Cloud card | `#f3ecdd` | warm white, never pure white |
| Far hill / near hill / tree | `#a3b47f` / `#6e8f48` / `#4f7a3a` | torn crest on the near hill shows bare flutes |
| Floor board top | `#d4a66f` | |
| Cutting mat | `#2e5f55` | grid `rgba(120,180,160,0.22)`, every fifth line stronger |
| Puppet body | `#e86f35` | arms `#dc6630`, feet `#3d8a8a`, leaf `#7da44a`, cheeks `#ec8f86` |
| Letters | `#f4e7cb` `#eab23b` `#3f8f8b` `#d6533a` `#e09a95` `#a3b47f` | cycle with a stride so neighbours differ |
| Marker | `#241812` | eyes, mouth, hand lettering |
| Masking tape | `rgba(232,212,160,0.82)` | translucent, torn ends |
| Brass pin | `#c9a043`, light `#f3d98e`, dark `#7d5f1e` | radial gradient plus a slot line |
| Shadow | `#2a1606` at 0.3 to 0.45 alpha | blurred, never pure black |

### Shape language

Chunky, rounded, slightly wonky. Circles and rects are polygons with hash noise on the radius (1 to 2 percent plus a
low frequency wobble), so no edge is mathematically clean. Letters are a heavy rounded grotesk (Arial Black). Clouds and
bushes are unions of rough circles on a flat base. Everything faces camera flat; only the box gets a top and side face.

### Line

Almost no line work. Lines are physical objects: threads (1 to 2 px dark brown), marker strokes for mouth and closed
eyes (round caps, about 6 percent of the character radius), a stamped arrow box on the carton, hand lettering
("stage") in a marker face. A 1 px light rim on the top left of every piece is the cut catching the lamp (only that
1 px offset; small replacement pieces such as the open mouth get `rim: false`, and no pale backing or belly patch sits
behind the mouth, or it reads as a smudge).

### Texture

- Painted tile per colour (256 px): flat fill, faint vertical flute stripes, 100 to 260 dry brush strokes in plus or minus
  11 percent lightness, speckle, a few kraft coloured gaps. Applied as a pattern, offset per piece by seed.
- Cut edge: silhouette stacked step by step along the edge direction, flute stripes drawn `source-atop`, darkened.
- Cotton wool puffs for landings (hundreds of short translucent white strokes), snipped paper bits for landings; the
  celebration confetti mixes small hole punch dots (about two thirds) with bigger snipped triangles and scissor cut
  strips in the letter colours, so it looks handmade rather than uniform.
- A grey grain tile laid over the frame with `overlay` at 0.09 alpha, shifted per frame.

### Lighting

One warm key lamp top left. Shadows and cut edges fall down right (`EDGE_DIR = [0.42, 1]`, shadow offset
`[0.6, 0.8] x depth`). A radial falloff overlay brightens the top left a little and darkens the corners. Exposure flickers
by hash per frame (plus or minus 3 to 5 percent), the way a real stop motion lamp and shutter drift.

### Frame rate and stepping

`fps: 12` (on twos). Every stepped frame is a new exposure: new hand nudge per piece
(`nudge(frame, id, amp, rotAmp)` from `hash`), new grain offset, new flicker. Typical amplitudes at 720p: puppet
2 px and 0.8 degrees, letters 1.2 px and 0.7 degrees, limbs 3 degrees, background pieces nearly still.

### Timing and easing

- Keep the shared beats from `pose(t)`; card does not stretch, so scale the shared squash by 0.6 and let the limbs sell
  the impact (feet splay with squash, arms flap in the air, leaf sprout lags on the pin).
- Blinks are replacement pieces: when `face(t).blink > 0.45` the paper eyes are swapped for marker arcs. A big smile
  swaps the marker mouth for a cut paper open mouth.
- Title: each letter hangs on a thread from a small dark punched hole (no white reinforcement ring: a ring with a dark
  centre reads as a googly eye on every letter and competes with the puppet's eyes). Letters are Arial Black at
  `0.132H` with a `0.004H` gap so the row has clear sky between the sun (moved to `0.108W, 0.215H`) and the tree.
  Threads are drawn twice: once behind the pelmet with the letter, and again over the pelmet band (clipped to
  `y < 0.115H`) so a letter still being lowered is visibly hung rather than clipped.
  `letterReveal(t, i, n, {spread: 0.62})`, drop = `(1 - outBack(u, 2.4)) * 0.5H`
  so it falls past rest and bounces back, plus a damped swing `0.26 * exp(-3.2u) * sin(13u + i)` about the punched hole,
  then a small periodic sway while held (integer multiples of the loop frequency so the loop stays seamless).
- Title exit: never fade. Each letter gets a tug down then is hauled up out of frame (`inBack(e, 2.2)`), staggered
  left to right, all gone by `titleGone`.
- Confetti after the spin landing: ballistic with gravity 2.6H per second squared and launch speed capped at 1.3H,
  flutter = vertical scale by `|cos|`. Each piece is clipped (evenodd) at the floor board's back edge (`0.775H`) and
  at the box silhouette, so it drops behind the set instead of falling in front of the board, its corrugated lip and
  the mat; the slowest piece is gone by about 5.45 s. Three catchers land on the box lid, lie flat (vertical scale
  0.42) and are knocked off by the exit hop at `exitHop1`, gone by about 5.7 s.
- The exit landing at 5.6 plays its cotton puff and paper bits compressed into `min(0.5, DURATION - 0.12 - ti)`
  seconds, so they settle before the wrap. Check the seam by diffing `__render(5.95)` against `__render(0)`: it must
  be at or under a normal 12 fps step (measured 1.20 mean versus 1.88 for a step; the remainder is per frame grain,
  flicker and the cloud slide).
- Scenery that moves (sun on its pin, clouds on rods) uses `sin(2 pi t / DURATION)` so it is periodic.

### Camera

Locked off, straight on, like a tabletop rig. No zoom, no parallax moves; depth comes from shadow offsets. Composition is
a little theatre: pelmet on top, kraft margins on the sides, cutting mat at the bottom.

## 2. Technique (2D canvas, no WebGL)

Three.js is not needed: the look is flat sheets, and shadows plus stacked edges sell depth more cheaply and more
reliably than real lights. Everything heavy is built once per size, so a stepped frame costs about 2 to 8 ms.

**Piece builder** (`buildPiece(dpr, bounds, shape, opts)`): `shape(g)` fills the silhouette in local CSS units.

```js
// 1. corrugated edge: stack the silhouette along the edge direction, stripe it, darken it
for (let i = 1; i <= steps; i++) eg.drawImage(edgeSil, EDGE_DIR[0] * k(i), EDGE_DIR[1] * k(i));
eg.globalCompositeOperation = 'source-atop';
for (let x = 0; x < w; x += fl) { eg.fillStyle = 'rgba(70,40,15,0.45)'; eg.fillRect(x, 0, fl * 0.42, h); }
// 2. light rim: a pale silhouette offset up left under the face
if (o.rim !== false) og.drawImage(sil('rgba(255,240,215,0.9)'), -0.9 * dpr, -0.9 * dpr);
// 3. painted face: silhouette, then the paint tile with source-in, then decorations source-atop
fg.globalCompositeOperation = 'source-in'; fg.fillStyle = pattern(paintTile); fg.fillRect(0, 0, w, h);
// 4. shadow sprite: the silhouette through ctx.filter = 'blur(px)'
```

**Placing** (`place(g, sp, x, y, rot, sx, sy, shadowAlpha, depthMul, offY)`): draws the shadow sprite at
`SHADOW_OFF * depth` with the same transform, then the piece. `offY` lets a piece pivot about a point that is not its
origin (letters swing about their punched hole).

**Layers**: back (kraft wall, sky panel, tape) and front (hills, tree, bush, floor board with cross section, mat, box)
and the pelmet are baked to full size canvases and blitted with an identity transform. Only the sun, clouds, letters,
puppet and effects are drawn per frame.

**Stepped redraw skip**: with `fps: 12`, `ctx.frame` repeats for five rAF ticks; cache `frame + size` and return early,
the canvas keeps its pixels. Still deterministic: `__render(t)` twice gives identical pixels.

**Puppet rig**: body disc sprite drawn with `(1 + 0.6s, 1 - 0.6s)` scale; feet and leaf behind the body, arms in front
(as a real split pin puppet), each rotated about its pin in body space; brass pins drawn last at every pivot.

```js
const [jx, jy, jr] = nudge(frame, 1, 0.0022 * H, 0.014);   // hand jitter for the whole puppet
place(g, D.arm, px, py, -side * 0.62 + aj, 1, 1, 0.45, 1.4); // negative angle swings the right arm outward
splitPin(g, px, py, r * 0.075);
```

Pitfall met while building: a helper that lightens hex colours (`shade`) returns `rgb()`, and feeding that back into a
helper that parses hex produced NaN strokes, so the arm tile came out dark brown. Keep paint inputs as hex.

## 3. Applying it to any storyboard

1. List every object in the board and decide what it is made of: painted card (default), kraft, white card, tape,
   thread, brass, cotton. Give each a depth (shadow offset 2 to 9 px at 720p) by how far it hangs from the backdrop.
2. Build a set: backdrop wall, one painted panel, a pelmet or frame, a floor board with a cross section edge, a work
   surface in front. Props should look like they were made that afternoon (marker labels, offcuts, a pencil).
3. Rig characters as flat parts joined by split pins. Choose the pivots first; animate by rotating parts about pins, not
   by deforming them. Use replacement pieces for blinks, mouths and big expressions.
4. Anything that flies hangs on a thread or is pushed on a rod; show the support.
5. Step at 12 fps, add per frame nudges, flicker and grain, and keep the camera locked.
6. Text: cut card letters with thickness, hung, taped or stood up on tabs. Animate them like objects being placed.

## 4. Failure modes

- **Looks like flat vector art**: missing cut edge or shadows. Every piece needs both, including tiny ones.
- **Looks like a 3D render**: smooth 60 fps motion, glossy gradients or perspective tilts. Step the time, keep it matte.
- **Jitter too strong or too uniform**: the set must not swim. Only moved pieces jitter, each with its own seed; the
  background stays still. Above about 3 px at 720p it reads as a bug.
- **Squash and stretch on rigid card**: halve it and move the limbs instead.
- **Fades**: cutouts do not fade in or out. Pieces enter by being placed, dropped, slid or pulled off.
- **Edge direction inconsistent**: one lamp, one edge direction, one shadow direction for every piece.
- **Too clean outlines**: perfect circles and rects betray the computer; add noise to every contour.
- **Pure white and pure black**: use warm card white and brown black; the whole frame should feel warm.
- **Loop seams**: confetti, landing bits or swinging pieces still on screen at t = 6, or drift that is not periodic in
  6 s. Confetti that relies on falling out through the bottom of frame is easy to get wrong (gravity 1.9H left pieces on
  screen at 5.95); clip it at the floor line instead.
- **Confetti passing through the set**: pieces drawn over the floor board lip and the mat look like they fall through
  solid card. Clip them where they would go behind the board or the box.
- **Letters that read as creatures or WordArt**: white rings around the hang holes look like eyes; a thick stacked edge
  looks like a 3D extrusion.
- **Performance**: building sprites per frame (blur filters are slow). Build once per size, blit per frame.

## 5. Reference searches (YouTube / Vimeo)

1. `cardboard stop motion animation short film`
2. `paper cutout stop motion split pin puppet animation`
3. `corrugated cardboard diorama stop motion music video`
4. `tabletop cut out animation behind the scenes rig`
5. `handmade craft paper stop motion title sequence`
