# Ink Silhouette (shadow puppet at sunset)

Reference build: `https://peterbu.com/showcase/skills/video-like-peter/styles/ink-silhouette/`
(`index.html` + `ink.js`, Canvas 2D on the shared `_engine/stage.js` + `scene.js`). Poster at t=3.4
(title finished, seal stamped, hero standing on the plinth with a small smile).

## What defines the style

Black cut-out shapes in front of a glowing sky, painted over old paper. The light is always
BEHIND everything, so nothing has interior detail: shape, edge and holes tell the whole story.
Negative space (the sun disc, the empty sky) is where the eye goes, so the hero performs in front
of the brightest area.

### Palette (hex)

| Role | Hex |
|---|---|
| Ink (all near silhouettes) | `#110b0a` warm black, never pure `#000` |
| Ink wash on the ground | `rgba(78,40,32,0.36..0.76)` dry strokes over the ink (must read at 1x) |
| Ground sheen and sun reflection | `rgba(170,82,46,0.7)` sheen, reflection dashes `rgba(255,176,100,0.1..0.34)` additive |
| Sky, top to horizon | `#2a1830` `#5a2440` `#a83c3c` `#e07038` `#f5a14a` `#fbd189` `#fde7b4` |
| Sun disc | `#fff6d6` core, `#ffe09a`, `#ffbf66`, edge `#ffad55` |
| Cloud slivers | `rgba(90,32,52,0.3..0.5)` plum ink wash |
| Ridges, far to near (aerial perspective) | `rgba(176,82,74,0.78)` `#7d3a40` `#4a2128`, then ink |
| Mist | `rgba(255,214,160,0.16..0.3)` |
| Rim light | `#ffe0a3` hot edge, glow `rgba(255,176,92,0.85)`, halo `rgba(255,170,90,0.7)` |
| Seal accent (the only saturated non-sky colour) | `#b3302a` vermilion |
| Paper | `~#f8f1e2` with grain 28, fibres `rgba(110,72,44,0.08..0.22)` (3200 at 1280 w), vignette `rgba(110,50,38,0.22)` mid to `rgba(60,24,20,0.88)` edge |
| Title wash | `rgba(255,222,186,0.34)` screen ellipse behind the title, fading in and out with it |

### Shape language
- Round, simple hero; all detail is CUTWORK: eye holes, a mouth slot, three diamonds on the belly.
  Holes are punched (`destination-out`) so the real sky shows through, like leather puppets.
- Face placement rule: eyes at about -0.12 ry, mouth at about +0.17 ry, and NOTHING else in a row
  under the mouth. A row of holes just below the eyes reads as fangs (jack-o-lantern). The belly
  diamonds are stacked vertically like buttons at 0.5, 0.65 and 0.8 ry, shrinking downward.
- The mouth is always present: a short neutral slot (about 0.075 r half width) when smile is 0,
  bending and widening into a smile arc as `face(t).smile` rises. No mouth reads as a skull.
- Props are heavy and flat-topped (a rock plinth) with a row of perforations the sun glows through.
- Nature frames the stage: reeds with cattail heads at one side, a windswept pine with flat
  cloud-pad foliage and needle fringes at the other. Keep framing elements out of the title box.
- A thin puppet rod hangs from the hero's belly. It sells "shadow puppet" instantly; keep it at
  about 0.035 r width and 0.85 alpha. It runs NEARLY VERTICAL: the bottom end is the anchor x plus
  a small lean against the motion (`clamp(-vx * 0.045, -0.55, 0.55) * r`), never a fixed point on
  the frame edge (a fixed far anchor makes a long diagonal that slices through the sun and the
  prop). It ends at the stage surface under it (`surfaceY(x)`: rock top over the plinth, ground
  elsewhere), so it reads as passing BEHIND the stage. Draw order: after the halo, before the
  hero's char canvas, so the body covers the anchor. While standing the rod is hidden, by design.

### Line and edge
- No outlines. Edges are the line: every outline is noisy (radius modulated by 3 sines for the
  body, fbm jitter for flanks and ridges, hash jitter for seals). Top surfaces the hero stands on
  stay almost flat (jitter under 0.3 percent of H) so contact reads.
- Big silhouettes need a VISIBLE dry brush edge at 1x, or the frame reads as a vector sunset.
  fbm jitter alone is not enough. The near ridge, the ground lip and both rock flanks get dry
  brush passes: 9 thin bristles per pass (each about 0.26 to 0.46 of its slot wide, so gaps show),
  long runs (dropout noise period 28 to 58 px along the edge), more dropout on the outward side
  and at the ends. They are painted INTO the shape mask, then the mask is lightly feathered
  (blur 1.2 px, threshold against bristle noise oriented along the edge normal), and only then
  tinted to ink and to the rim colour. So rim light follows the broken bristles. The rock top is
  excluded (`keep()` mask) so the hero's contact line stays clean. Short dropout runs (under
  about 12 px) or strong per pixel grain make the edge look like moss or a hedge, not a brush.
- The title is hand-built brush lettering (see Technique), not a system script font.

### Texture
- Paper fibre canvas multiplied over the whole frame, then light specks screened over it so the
  ink looks printed on paper, not a void. It has to be strong enough to see at 1x: grain 28 levels,
  3200 fibres, vignette to 0.88 at the corners. At half that it disappears.
- Ground band gets dry horizontal ink washes and a warm sheen under the sun, so the bottom
  fifth of the frame is not dead black. The plinth sits ON the ground (base at G + 0.035), so the
  band under the sun is open for a reflection: about 20 additive warm dashes in a column that
  widens and fades downward and shimmers on the loop.

### Lighting
- One source: the sun, low, centred behind the main stage. A wide additive glow, ridges get
  paler toward it, and a FEW soft god rays: 11 rays, only in the upper 100 degrees (straight up
  plus or minus 50), each a narrow wedge filled with a radial gradient that peaks just outside
  the disc and fades to 0 along its length, alpha 0.05 to 0.10 before a blur of 1.4 percent of H.
  Cloud slivers are drawn after the rays so they cut them. Low alpha alone does NOT prevent the
  starburst: 26 hard edged rays over 180 degrees stacked into a sunburst poster at 1 to 3 percent.
- Every silhouette has a 1 to 2 px rim on its top edge (shape nudged toward the light, drawn in
  rim colour, ink on top). The hero gets three layers: offset glowing rim shape, an all-round
  thin rim stroke, and an additive halo on the main canvas so it never merges with other ink
  (title, tree) when it crosses them. Halo and rim go up (about 1.6x) while the hero overlaps
  framing ink (x under 0.2 W or over 0.8 W).
- Contact on ink: when the hero stands on the plinth (ink on ink) it would fuse into one blob.
  While in contact, lift the body ink about 0.022 r (rim layers stay put, so a rim line shows
  under the body), thicken the rim stroke, and draw an additive warm contact line on the stage
  top under the body (horizontal gradient, about 1.25 rx each side).

### Frame rate, timing, easing
- Smooth (fps null). This style is about grace; no stepping.
- Only the shared beats move fast. Ambient motion is slow and periodic in the 6 s loop: grass
  `sin(2pi t/6 * 2)`, reeds `sin(2pi t/6)`, mist sway `sin(2pi t/6) * 0.04W`, sun breath
  `sin(2pi t/6 * 2)`, petals travel exactly one wrap per loop, birds cross once per loop
  (off screen at t = 0 and t = 6).
- Title: per letter brush wipe with `ease.outCubic(letterReveal(t, i, n, {spread: 0.74}))`, each
  letter clipped from its own pre-rendered canvas. Ink flicks: drops seeded just off a stroke edge
  of the letter that has just finished (about 0.28 s after that letter starts), pop with
  `outBack` over 0.12 s, then SOAK: from 0.22 s they shrink, fade and run down slightly, gone by
  0.78 s. Never leave drops at full alpha until the title out; they read as dust on the lens.
  Seal stamps 3.05 to 3.35 s (scale 1.5 to 1, `outCubic`, multiply). Out: ink dissolves in water,
  blur 0 to 7 px, alpha `1 - inQuad(outP)`, slight rise.
- Secondary motion: the head sprout lags the body (velocity from `pose(t) - pose(t - 0.05)`),
  landings throw ink droplets on a ballistic arc plus a backlit dust puff (additive).
- Celebration: warm fireflies (additive radial dots) drift up from the spin landing and die
  before 5.95 s.

### Camera
- Locked off, one gentle breathing push in: `zoom = 1 + 0.022 * (0.5 - 0.5 cos(2pi t/6))`
  around (0.5W, 0.6H). Zoom never below 1 so edges never show. No shake.

## Technique (Canvas 2D, no WebGL)

Everything heavy is pre-rendered once per backing size (rebuild when `pw x ph` changes):

| Offscreen | Contents |
|---|---|
| `back` | sky gradient, glow + god rays (`lighter`), sun disc, cloud slivers, far ridge |
| `mist` | 1.3 W wide band of stretched radial gradients, drawn with a sway offset |
| `front` | mid ridge, foot haze, near ridge |
| `ink` | one mask of ground + rock + dry brush passes, feathered, tinted to rim and ink; washes and sheen (`source-atop`), perforations, pine |
| `title.letters[i]` | one canvas per letter: hand-built bristle strokes + pores + bleed |
| `seal`, `paper`, `specks` | stamp with carved glyph, fibre/vignette texture, light specks |
| `char` | scratch canvas (5.4 r square) the hero is drawn into each frame |

Per frame order: camera push, `back`, sun breath, birds, far petals, `mist`, `front`, title wash
and title (behind the pine), `ink`, sun reflection, grass and reeds, hero (halo, rod, char canvas,
contact line), impacts, near petals, fireflies; then without camera: paper `multiply`, specks
`screen`. About 8 ms per frame in headless Chrome at DPR 1 and 2; the build is under 0.2 s.

Brush edged blob (periodic in angle, so it rotates cleanly):
```js
function brushBlob(g, rx, ry, seed = 0, n = 72) {
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    const k = 1 + 0.018 * Math.sin(5 * a + 1.3 + seed) + 0.012 * Math.sin(9 * a + 0.4 + seed * 2)
                + 0.007 * Math.sin(15 * a + 2.1 + seed * 3);
    g.lineTo(Math.cos(a) * rx * k, Math.sin(a) * ry * k);
  }
  g.closePath();
}
```

Backlit hero with cutwork (inside the scratch canvas, then `drawImage` onto the stage):
```js
cc.save(); cc.translate(dx * r * 0.07 * str, dy * r * 0.07 * str); cc.rotate(p.rot); cc.scale(1.035, 1.035);
cc.shadowColor = `rgba(255,176,92,${0.85 * str})`; cc.shadowBlur = r * 0.55 * str * dpr;
cc.fillStyle = '#ffe0a3'; brushBlob(cc, q.rx, q.ry); cc.fill(); cc.restore();   // rim toward the sun
cc.save(); cc.rotate(p.rot); cc.fillStyle = '#110b0a'; brushBlob(cc, q.rx, q.ry); cc.fill();
cc.globalCompositeOperation = 'destination-out';                                // eye holes show the sky
/* eyes (height * (1 - blink)), mouth slot bending into a smile with face(t).smile, three belly diamonds stacked vertically */
cc.restore();
```
`(dx, dy)` is the unit vector from the hero to the sun; `str = 0.45 + 0.55 * nearness`.

Hand-built brush title (build time). A system script font (Brush Script MT and friends) reads as
a 1950s diner sign, and a threshold filter over it gives uniform diagonal scratches. Instead each
letter is a few centre line strokes in em units (`GLYPHS`, slant 0.16), sampled as Catmull-Rom,
and painted like a loaded brush:
```js
// width from direction: pulled-down strokes press, up strokes are light; pressed start, dry tail
const down = smoothstep(-0.2, 0.8, ty * 0.85 - tx * 0.25);
let w = E * (0.034 + 0.098 * down);
w *= (0.5 + 0.5 * smoothstep(0, 0.1, u)) * (1 - 0.85 * smoothstep(0.72, 1, u) ** 1.3) * (0.9 + 0.22 * noise);
// paint: a solid core (0.36 w, shrinking at the tail and in rare dry patches), then 15 bristles
// across the width; each bristle drops out where vnoise(s / (0.07 em) + b * 3.17) < thr,
// thr = 0.06 + 0.62 * smoothstep(0.62, 1, u) + 0.28 * smoothstep(0.55, 1, |o|)
// so streaks always run along the stroke direction and the tail dries into hairs.
```
Then a pooled ink blot where the brush lands, a few pores punched out, and a blurred copy at
0.26 alpha under the sharp one (bleed). Em is `min(0.205 H, 0.5 W / total advance)`.
Reveal each frame by clipping each letter canvas to its own rectangle whose right edge is ragged
(`hash(i * 31 + k)` jitter on 9 points), width `(bbox width + 2 pad) * u`. A pale screen wash
ellipse behind the title box lifts the plum sky so the ink has contrast.
The seal is about 0.092 H, tucked under the end of the last letter (right edge minus 0.32 s,
baseline plus 0.5 s) and rotated about -0.13 rad, so it reads as a chop mark, not a floating badge.

Perforated prop: draw rock in ink on the `ink` canvas, then `destination-out` circles and diamonds
in a row; place the prop so the sun sits behind it (cut a valley into the ridges around x = 0.5
so the lower half of the sun stays visible).

Determinism: every random value is `hash(i, seed)` or `rng(seed)` from `scene.js`; pre-renders
use fixed seeds. Verified: same `t` twice gives identical pixels, `t = 0` equals `t = 6`.

## Applying it to any storyboard

1. Put the light source where the key action happens; stage the hero in front of it.
2. Turn every character and prop into one flat ink shape with a readable profile. Expressions
   become holes (eyes, mouth) that can blink and widen; never draw interior features in colour.
3. Build depth with 3 or 4 ridge layers getting paler and warmer with distance, plus mist bands.
4. Frame with nature silhouettes (grass, reeds, branches) on the edges; keep text areas clear.
5. Text: brush script or brush edged serif, written on with a wipe, stamped with a small
   vermilion seal, dissolved out with blur.
6. Effects are light, not colour: additive dust puffs, fireflies, embers; ink droplets for impacts.
7. Keep a puppet cue (rod, visible joints) if the brief wants "shadow play"; drop it for pure ink.

## Common failure modes

- Silhouettes merging: two inks overlap and the hero vanishes. Fix with an all-round rim plus an
  additive halo behind the hero, or keep paths apart.
- Dead black band: the ground under the horizon becomes 20 percent of empty frame. Add dry washes
  and a warm sheen; or lower the horizon.
- Prop bottoms floating: a wash drawn under a prop exposes its flat bottom edge. Put the prop's
  base a little below the ground line inside ONE ink mask with the ground, and paint the washes
  with `source-atop` below the base. (Running the prop to the frame bottom also works, but it
  hides the band under the sun where the reflection goes.)
- Rim invisible in front of the sun: rim colour equals the sky there. That is correct physically;
  rely on the halo and the darker body instead of thickening the rim to a cartoon outline.
- Dry brush overdone: regular streaks read as a "speed lines" filter. Gate streaks with a second
  low frequency noise and keep the threshold lift under 0.6. Dry brush underdone: clean edges
  with only fbm jitter read as vector art. Check the near ridge and ground lip at 1x.
- Title collides with framing art: measure the title, cap its width (52 percent of W here), and
  prune tree pads inside the title box.
- God rays as a starburst: caused by COUNT and SPAN, not only alpha. Keep to about 11 soft rays
  in the upper 100 degrees, gradient along each ray, blurred, cut by cloud slivers.
- Rod slicing the frame: a rod anchored to a fixed point off frame runs diagonally across the sun
  and in front of the prop the hero stands on. Keep it near vertical and stop it at the surface.
- Face reading as a jack-o-lantern: holes in a row just under the eyes look like teeth. Stack the
  belly cutwork vertically and give the mouth a neutral slot when not smiling.
- Hero fusing with the plinth on landing: ink on ink. Keep a 1 to 2 px lit gap or contact line.
- Drops hovering: impact droplets must land on `surfaceY(x)` (rock top or ground), not at the
  impact height, or they float in the air past the rock edge.
- Pure `#000` ink and pure white paper look digital; use warm black and cream.
- Fonts: avoid system script fonts for the title (off genre, and they vary per machine). The
  hand-built glyphs need no font at all; the seal glyph uses a serif fallback stack.

## Reference search queries (YouTube / Vimeo)

1. `shadow puppet animation short film sunset silhouette`
2. `Lotte Reiniger silhouette animation technique cut paper`
3. `sumi-e ink wash animation brush stroke motion graphics`
4. `silhouette platformer art direction backlit rim light`
5. `wayang kulit shadow play performance puppet rods`
