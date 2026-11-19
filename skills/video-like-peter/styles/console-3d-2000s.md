# Style recipe: 2000s console 3D

The look of an early-2000s home console game intro: smooth-ish mid-poly models with hard glossy specular,
lighting that feels baked into the textures and vertex colours, a chrome extruded logo that slams in from deep
space, a dusk sky with a sun that blooms over everything, faint lens ghosts, and a 480-line frame upscaled
through a soft composite-cable pass with interlace scanlines. The camera does the thing every intro of that era
did: a crane that dives, banks and sweeps around the hero. Label it "2000s console 3D" and never name a console.

Reference build: `https://peterbu.com/showcase/skills/video-like-peter/styles/console-3d-2000s/`
(`index.html`, `console.js`, `console.css`, `poster.png`). It runs the shared engine
(`styles/_engine/stage.js` + `scene.js`) with `context: 'none'`, smooth time (`fps: null`) and three.js r170
from `_engine/three.module.min.js`. Everything is original: an orange ball mascot with a glowing antenna, a
floating sky arena, a seven-point star emblem. No existing game, mascot, logo or level is referenced.

## 1. What defines the style

| Trait | Rule |
|---|---|
| Read at first glance | glossy plastic highlights on everything round; a chrome logo with gold outline and a dark blue extruded side; a blown-out sun with soft bloom bleeding onto the floor; slightly soft, slightly smeared picture with fine horizontal lines; a sweeping camera |
| Palette (dusk arena) | sky top `#0a1a5c`, high `#28308f`, mid `#a23c8e`, horizon `#ff9a4a`, below horizon `#2a1550`; fog `#6a3f8e`; floor tiles `#252a78` / `#3543a6`, grout `#121644`; gold trim `#ffcc33`, deep gold `#b8741a`; platform teal `#18c2c9`, deep `#0b5e86`; rock `#5a3a7a` to `#1c0f33`; hero `#ff7d1f`, belly `#ffe0b0`, feet `#2b4cff`, cheeks `#ff5a7a`, mouth `#5a0f22`, antenna glow RGB (1.4, 2.0, 2.3) (over 1 on purpose, so it blooms); gems `#ff3fa8` `#33e6ff` `#ffd23a` `#8f6bff` `#4dff9a`; logo chrome ramp `#ffffff` `#a8ecff` `#3a7dff` / hard horizon `#0b1f6b` `#5d7dff` `#ffd9a0`, outline navy `#0a1550` inside gold, extrusion `#4f73ff` to `#1a2678` (kept mid blue, never near black) with the chrome face repeated on the back |
| Shape language | mid-poly: spheres 16 to 24 segments, 8-sided pedestals, 9 to 14 sided cones for rock, octahedron gems with `flatShading`. Round, friendly, chunky proportions. A mascot is a ball with big oval eyes (white, pupil, a pure white highlight dot of radius 0.072 r plus a 0.032 r second dot, sized so it survives 480p in wide shots), blush, an arc mouth, two stubby glossy feet and an antenna |
| Line | none on models. The logo has a thick double outline (navy inside gold), the way game logos of the era were painted |
| Texture | canvas-painted, bilinear filtered, mipmapped. Tiles carry painted bevels (light top-left edge, dark bottom-right) and painted AO; inlay rings, sun rays and a thin gold detail ring at 0.55 of the radius studded with 28 alternating gold and cyan diamond tiles are drawn into the floor texture, not modelled. Each pillar gets an additive light-pool decal (4.2 unit radial plane, its crystal colour times 0.85) so the big floor stops reading flat |
| Lighting | gamma-space Phong: colour management off, so the maths runs on display values like the hardware did. Warm key from front left, orange rim from the sun behind, cool hemisphere fill. Hard, small specular (`shininess` 70 to 140). Baked look via vertex colour ramps (top colour to bottom colour) on columns and rock, plus painted AO in textures. Blob shadow decal instead of shadow maps |
| Glow | two kinds. Pure light sources (antenna tip, platform glow band, eye highlights, impact rings and sparks) are `MeshBasicMaterial` / `SpriteMaterial` colours above 1.0 in a HalfFloat target, so the bloom bright pass picks them up. Faceted gems and pillar crystals are `MeshPhongMaterial` with `emissive` set to their own colour, `flatShading`, and `emissiveIntensity` 0.55 (floating gems) or 0.9 pulsing between 0.85 and 1.2 on a 1.5 s period (crystals), so they still catch the key light and specular. No emissive maps |
| Frame rate | smooth 60 (the era's flagship intros ran 60). Only the interlace field flips per 1/60 s frame |
| Timing and easing | gameplay physics from `scene.js` (parabolic hops, squash). Logo letters: `letterReveal(spread 0.55, b 3.25)` so the last letter has landed by 3.25 s (before the 3.4 s beat) and the word never reads uneven at the hold. Per letter, with `e = outCubic(u)`: x travels from 2.6 x its final centre to the centre, y from +5.5 above the title line to 0, scale from 0.4 to 1, all on `e`; z travels from -34 to 0 with `outBack(u, 1.6)` so each letter overshoots toward the camera and settles (the "slam"); exactly 1.0 spin about Y and a 0.6 rad tilt unwind on `e` (1.25 spins left letters edge-on for too long); a short white flash `exp(-((u - 0.88) / 0.05)^2) * 0.45` as it locks. A specular glint band (gaussian, width 0.45 world units, `band * vec3(1.1, 1.05, 0.9) * (0.3 + bright)`; at 1.5 it clips into a white blob) sweeps the whole word from x -10 to +10 twice while it holds (3.35 to 4.05 s, 4.45 to 4.95 s). Pick posters between sweeps (the reference poster is t = 4.3). Exit: letters spin a half turn, rise and shrink with `inCubic`, staggered. Impacts: additive gold shock ring (life 0.5 s) that grows with `outCubic` and fades with `(1 - u)^2`, eight star sprites under gravity (life 0.6 s) born on a ring of 1.1 r at the feet and grown in over 0.06 s, so they never stack into a white blob on the face. Lifetimes are clipped to `min(life, 6 - ti)`, so the 5.6 s landing sparks and ring fade out in 0.4 s and nothing is alive at the wrap; the 6.0 s landing is deliberately not in `IMPACT_TIMES`, its effects would only exist at the cut. Celebration: 26 star sprites fling sideways in two cones (left and right, plus or minus 50 degrees, speed 3.0 to 5.8, up 3.2 to 5.6, `y = up d - 6.5 d^2`), born on a 1.3 r ring and grown in over 0.1 s, and dimmed by 70 percent while they cross the title band, so the fountain frames the logo instead of smearing across it. Bloom kick: `uBloom = 0.85 + 0.35 * max(1 - d / 0.3)` over impacts, so up to +0.35 for 0.3 s after each landing |
| Camera | the defining move. A closed cardinal spline through 9 keyframes `[time, position, target, fov, roll]`: high narrow crane over the arena (pos 0, 6.6, 17.5, target y 2.5, fov 28) at 0 s, diving left and banking -0.11 rad to catch the first hop (0.6 s), a hold key at 0.95 s (pos -1.4, 1.95, 10.2, target -1.6, 3.0, fov 41) that keeps the hero and antenna in frame at the top of the big hop, low hero angle (fov 41) on the platform landing (1.25 s), target y raised to 2.8 to 3.0 in the mid shots so the floor stops eating 60 percent of the frame, pulling back to frame logo and hero together while the title builds (3.2 s key aimed at x +0.3, because the word lands right-heavy), a slow orbit through the spin, then swinging right with the exit and rising back to the opening crane at 6 s. Tangents are scaled by 0.85 so the dive does not overshoot |
| Post | internal frame 854 x 480. Bloom: threshold 0.86 bright pass at 1/2 res, separable 5-tap Gaussian, a second level at 1/4 res. Final: 3-tap horizontal smear with red pulled right and blue pulled left (composite bleed), bloom add (gains 0.8 and 1.2, eased down to 0.6 and 0.7 by the sun's on-screen visibility so the sun halo keeps a gradient), lens ghosts on the sun line, soft highlight shoulder, saturation 1.12, 480-line field dimming that flips each 1/60 s, a soft line profile, vignette, black lift, faint noise seeded by frame time |
| Overlay | "PRESS START" blinking at 2 Hz in gold italic while the logo holds, rendered inside the 480p frame so it gets the same scanlines |

## 2. Technique

Three.js, everything built once in `setup(ctx)`, posed in `render(t, ctx)` from `t` alone. `context: 'none'`.

```js
THREE.ColorManagement.enabled = false;           // gamma-space lighting, hex in = value out
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;      // the final shader does its own soft shoulder
// every CanvasTexture: tex.colorSpace = THREE.NoColorSpace
```

r155+ lights are physical: Phong divides diffuse by pi, so classic-looking intensities are about pi times the
old numbers (hemisphere 1.5, key 2.7, rim 2.8 here). Too low reads as brown mud, too high blows the floor out
through the bloom.

### 2.1 The 480p chain

```js
const LOW_W = 854, LOW_H = 480;
const rt = (w, h, depth) => new THREE.WebGLRenderTarget(w, h, {
  type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: depth });
// render(): scene (+ HUD) into rtScene, bright pass to rtA1 (1/2), blur H to rtB1, V back to rtA1,
// copy to rtA2 (1/4), blur H/V, then the final full-screen quad to the canvas at device size.
```

The upscale is just bilinear sampling of the 854 x 480 texture by the final pass. That is the "480p on an HD
screen" softness; do not render the scene at canvas resolution.

Final pass essentials:

```glsl
vec3 a = texture2D(tScene, vUv - vec2(px.x, 0.)).rgb, b = texture2D(tScene, vUv).rgb,
     d = texture2D(tScene, vUv + vec2(px.x, 0.)).rgb;
vec3 c = b * 0.5 + (a + d) * 0.25;  c.r = mix(c.r, d.r, 0.3);  c.b = mix(c.b, a.b, 0.3);
c += (texture2D(tB1, vUv).rgb * mix(0.8, 0.6, uSunVis) + texture2D(tB2, vUv).rgb * mix(1.2, 0.7, uSunVis)) * uBloom;
float odd = mod(floor(vUv.y * 480.) + uField, 2.);       // uField = floor(t * 60) % 2
c *= 1. - 0.085 * odd;
c *= 0.955 + 0.045 * cos(vUv.y * 480. * 6.28318);
```

Lens ghosts: project `camera.position + sunDir * 300` each frame, pass its screen uv, and draw 4 tinted discs
at `sun + (0.5 - sun) * k` for k in 0.55, 0.9, 1.3, 1.75 (radii 0.035, 0.06, 0.022, 0.09), plus one faint ring at k = 1.0 with radius 0.22, all scaled by 0.35 and faded by the sun's distance to the screen edge.

### 2.2 Sky

A 400 radius BackSide sphere that follows the camera, `ShaderMaterial` with `fog: false`: a 5-colour vertical
ramp from the view direction's y, sun glow `pow(sd, 10) * 0.36 + pow(sd, 90) * 0.5`, a disc at
`smoothstep(0.9988, 0.9993, sd) * vec3(1.4, 1.15, 0.85)` (over 1 for bloom, but not so far over that the halo
clips into a flat white area and swallows the pillars), and hashed stars in the upper part.
Fog colour sits between the horizon and the high band so distant islands melt into the dusk.

### 2.3 Chrome extruded logo without a font loader

Per letter, paint two canvases with the same glyph (heavy italic): the face (gold stroke 40, gold 30, navy 16,
then a chrome gradient fill with a hard horizon line at 50 percent and a white specular stripe) and a white mask
(same strokes, all white). Stack one face plane, 10 mask planes 0.032 apart tinted from bright blue to a mid
navy, and at the 11th slot (z = -11 x 0.032) the face again, turned around with `rotation.y = PI` and sharing the
face material. Letters spinning in show chrome from behind and mid-blue edges, never the black slabs and dark
bars that a near-black rear slice gives. From any camera angle that reads as a bevelled extruded logo.

```js
const face = new THREE.ShaderMaterial({ uniforms: { map, uGlint, uFlash, uX, uW }, ... });
// fragment: discard below alpha 0.5, add a gaussian glint band along world x + uv.y slant, add uFlash
for (let s = 1; s < 11; s++) {
  const m = new THREE.MeshBasicMaterial({ map: mask, alphaTest: 0.5, side: THREE.DoubleSide,
    color: new THREE.Color('#4f73ff').lerp(new THREE.Color('#1a2678'), Math.pow(s / 11, 0.7)) });
  const slice = new THREE.Mesh(geo, m); slice.position.z = -s * 0.032; group.add(slice);
}
const back = new THREE.Mesh(geo, faceMat); back.position.z = -11 * 0.032; back.rotation.y = Math.PI; group.add(back);
```

Measure the advances with `measureText`, scale the whole word to a target world width (12.6 units at a 16 x 9
stage) and give each letter its own group so it can fly, spin and flash independently.

### 2.4 Camera spline (seamless)

```js
// KEYS: [t, px, py, pz, tx, ty, tz, fov, roll]; index wraps, time of key j = KEYS[j % n][0] + 6 * floor(j / n)
m1 = (v(i+1) - v(i-1)) / (t(i+1) - t(i-1)) * 0.85;   // cardinal tangents on uneven times
v  = h00 * v(i) + h10 * dt * m1 + h01 * v(i+1) + h11 * dt * m2;
cam.position.set(...); cam.up.set(0, 1, 0); cam.lookAt(...); cam.rotateZ(roll); cam.fov = fov;
```

The key at 0 s is also the key at 6 s, so position, aim and velocity are continuous across the loop. Choose that
key so both off-screen ends of the walk (x = -9.9 and x = +10.2 world, hero half width about 0.7) are outside the
frustum, and check it by projecting the hero's inner edge (x = -9.2, y 0 to 1.8, z 0 to 0.8) with
`Vector3.project(cam)`: it must land beyond NDC -1 with margin for the bloom and smear. The hero sits low and
close, where the frustum is wider, so fov 32 still showed a sliver of the ball at t = 0; fov 28 puts the inner
edge at NDC -1.12 (about 50 px of the 854 frame). Verify the seam with captures at 0, 5.99 and 5.999.

### 2.5 Mapping the shared scene

`wx = (x - 0.5) * 16`, `wy = (0.8 - y) * 9`: the floor is y = 0, the platform top is 1.26, the hero radius is
0.675. The hero rig is `root (contact point) > squash (sx, sy, sx) > turn (yaw, lean, spin) > parts`, so
squash happens about the feet. `face(t)` drives blink (eye y scale), look (pupil offset and a small yaw),
lookUp (pupils up plus a 0.22 rad tilt back toward the logo) and smile (mouth arc scale). Blob shadow: sits on
the platform when |x| is under the platform half width and the hero is at or above its top, otherwise on the
floor; it shrinks and fades with height.

## 3. Applying it to any storyboard

1. Build the set as a small "level": one hero platform, a floor with a painted texture, a ring of props in the
   background half only (keep the camera's foreground clear), a sky shader, floating background pieces.
2. Give every hero object glossy Phong and every glowing object a basic colour over 1.
3. Turn each beat into a camera key first. The camera tells the story in this style: wide establishing crane,
   dive to the action, low angle on the hero moment, pull back for the title, orbit on celebration.
4. Titles and logos: chrome stacked-slice letters, slam in with an overshoot, a glint sweep on hold. Supers and
   UI text: gold italic with a navy outline, rendered into the 480p frame.
5. Keep all background motion periodic in the loop (bobs and spins with periods 1, 1.5, 2, 3 or 6 s).

## 4. Common failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Hero looks brown and muddy | r155+ physical light units with old intensities | multiply light intensities by about pi |
| Floor and pedestal blow out to white smears | specular too strong on large surfaces feeding the bloom | low, tinted specular on floors and columns (`#2a3060`, shininess about 30), bloom threshold 0.86 |
| Logo looks like a flat sticker | too few slices or slices the same colour | 10 to 12 slices, darken toward the back |
| White blob on landings | additive sparks stacked and too big at birth | start small, shrink with `(1 - u)^2`, fling faster |
| Loop pops at 6 s | camera keys not closed, the hero visible in the loop frame, or impact sprites still alive at the wrap | closed spline; opening key (fov 28) verified by projection to frame out both walk ends; clip effect lifetimes to `6 - ti` |
| Letters read as black slabs or dark bars mid-flight | rear slice near black, seen from behind or edge-on | mid-blue rear slices, chrome face repeated (turned around) on the back, 1.0 spin instead of 1.25 |
| Sun bloom washes a third of the frame flat white | sun disc too far over 1 plus full wide-bloom gain | disc (1.4, 1.15, 0.85), glow 0.36 / 0.5, bloom gains eased down by `uSunVis` |
| White smear across the logo on the celebration | confetti fountains straight up through the title, born at one point | sideways cones, ring-born and grown in, dimmed in the title band |
| Hero's head cut off at the top of a big hop | camera aims at the landing, not the apex | add a hold key near the apex with target y at the hero's height |
| Picture too crisp, reads modern | scene rendered at canvas size | render at 854 x 480 and let the final pass upscale bilinearly |
| Flicker looks broken | field flip too strong | keep field dimming under 0.1 |
| Inverted cone islands read as weird triangles | too tall and too close | short cones (height 1.3 x radius), lighter top colour, push them 70 to 100 units out |
| Captures differ from playback | field parity or noise read from a frame counter | derive both from `floor(t * 60)` |

## 5. Reference searches (YouTube / Vimeo)

1. `early 2000s console game intro cinematic opening logo`
2. `2001 3D platformer attract mode title screen`
3. `sixth generation console game opening camera flythrough`
4. `chrome 3D logo animation 2002 game title screen press start`
5. `Y2K mascot platformer intro bloom lens flare 480i`
