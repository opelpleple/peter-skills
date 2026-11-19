# Style recipe: Toy bricks

A tabletop build of glossy snap together plastic bricks, photographed like a miniature and animated stop motion
(a "brickfilm"). Label it "Toy bricks". Never use a toy brand's name, logo, stud lettering or its minifigure
design: the hero here is an original 2x2 brick buddy. Reference build:
`https://peterbu.com/showcase/skills/video-like-peter/styles/toy-bricks/` (`index.html`, `bricks.js`,
`bricks.css`, `poster.png`). It runs the shared engine (`styles/_engine/stage.js` + `scene.js`) with
`context: 'none'`, `fps: 12`, `maxDpr: 1.5`, and three.js r170 from `_engine/three.module.min.js`.

## 1. What defines the style

| Trait | Rule |
|---|---|
| Read at first glance | everything is made of studded bricks on a green baseplate: the ground, the props, the hero, even the title. Hard plastic, glossy, saturated, shallow focus |
| Palette (toy primaries, warm lit) | red `#d8322b`, yellow `#f6c21a`, blue `#1e5fc2`, green `#3f9a46`, orange `#f2852a`, azure `#36a9e0`, lime `#9ccb3b`, magenta `#d6418f`, white `#f3efe4`, black `#1c1d21`, tan `#d8bd8a`, brown `#7a4a2a`, grey `#a3a8ad`, dark grey `#4a4f57`, baseplate `#4c9f50`, darker tree green `#2f7d3a`; backdrop sky `#6fb6e6` to `#9ccdec` to warm cream `#ecd6ac` at the horizon (kept a little deeper so the backdrop does not bleach) |
| Shape language | strict stud grid: 1 unit = stud pitch, brick height 1.2, plate 0.4, stud radius 0.3, stud height 0.18, 0.03 gap between neighbours. Boxes with a tiny rounded bevel (0.05), cylinders, round 1x1 plates. Stepped silhouettes: trees are stacked 3x3, 2x2, 1x1 bricks; a roof is plates shrinking 6x5, 4x3, 2x1; clouds are white bricks on the backdrop |
| Character | an original buddy: 2x2 orange brick body, 2x2 yellow plate on top with studs, two dark 1x2 plate feet, round white tile eyes with black pupils, pink cheek dots, a black half torus smile (the face is a child of the body brick, printed on it), an antenna (round plate, 0.72 grey rod, red ball) that lags behind the body |
| Title | a mosaic standing upright: 7 row pixel font, each run of pixels becomes a 1xN plate (N <= 4; a 5 run splits 3 + 2 on even rows and 2 + 3 on odd rows; a run over 5 splits 4 + rest), studs facing the camera, one colour per letter with a tiny per plate lightness wobble. Glyphs must read at a glance: the `S` has no corner pixels at row 1 right or row 5 left (those make it read as 6 or G), and the `n` has a rounded shoulder (`#.##.`, `##..#`), not a flat top that reads like a Cyrillic letter. The title plane sits 0.9 units above the layout title band so the antenna clears its bottom row at the top of the bounce |
| Line | none. Edges come from the bevel highlight and contact shadows |
| Texture | none. The material does the work: smooth ABS, a sharp clearcoat and studio softbox reflections. No noise maps, no scratches (it should look new out of the box) |
| Lighting | photo studio: one warm key `#ffeed4` 2.9 from upper left front with soft PCF shadows (`shadow.radius = 2`), warm rim `#ffd9b0` from behind right, weak cool fill, hemisphere sky `#dceeff` / ground `#4f8a46` (deeper green so the baseplate does not go milky), plus an environment map made of softbox panels so every brick has a window shaped highlight. The hero also gets a contact shadow disc (see 2.6) |
| Frame rate / stepping | 12 fps (stop motion on twos at 24). Per stepped frame: camera bumped by a hair, key light flickers 3.5 percent, new grain pattern. All three come from `hash(frame)` so they repeat every 72 frames |
| Timing and easing | bricks never slide in smoothly: they fall from above and toward the lens in 1 to 2 frames, tumbling, then click flat with a 1 frame overshoot. Squash is softened to 55 percent (rigid plastic, springy toy). Impacts bump the camera (`impactPulse`). Removal is the build in reverse: pieces pop off toward the lens, spin and shrink |
| Camera | locked off tripod, long lens: FOV 21, at `(0, 8.2, 33)` looking at `(0, 1.6, 0)` so the baseplate recedes and the horizon sits about a third down. Depth of field plus a forced tilt shift falloff at the bottom and top of frame sells the miniature |

## 2. Technique

Three.js, built once in `setup`, posed in `render(t)` from `t` alone. Render the scene into a HalfFloat MSAA
target with a depth texture, then one full screen pass does DOF, ACES, grade, vignette and grain.

### 2.1 Map the shared 2D layout into 3D

Cast a stage point onto the action plane (`z = 0`, or `z = -2.5` for the title) with an unjittered camera clone.
Baseplate surface = floor contact minus stud height, so feet rest on stud tops exactly at `LAYOUT.groundY`.

```js
function stageToWorld(cam, x, y, zPlane = 0) {
  const v = new THREE.Vector3(x * 2 - 1, 1 - y * 2, 0.5).unproject(cam);
  const dir = v.sub(cam.position).normalize();
  return cam.position.clone().addScaledVector(dir, (zPlane - cam.position.z) / dir.z);
}
const w = stageToWorld(ref, p.x, p.y); hero.position.set(w.x, w.y, 0);   // contact point every frame
```

The platform is a 3 layer stack (brick, plate, plate) scaled vertically so its stud tops land on `LAYOUT.platform.y`.

### 2.2 Brick geometry

```js
// rounded box: BoxGeometry(1,1,1,6,6,6), remap grid lines to [0, half - r, half - .32r, half] so vertices crowd
// at the edges, then push the shell onto radius r around the inner box with radial normals (smooth bevel)
function brickGeo(w, d, h, u = 1, studs = true) {
  const box = roundedBox(w*u - GAP*u, h*u, d*u - GAP*u, BEVEL*u).translate(0, h*u/2, 0);
  const parts = [box];
  for (i < w) for (j < d) parts.push(...stud((i + .5 - w/2)*u, h*u, (j + .5 - d/2)*u, u)); // cylinder + bevel cap
  return merge(parts);   // concat non indexed position/normal arrays, cache by key
}
```

Title plates: `brickGeo(L, 1, 0.4, u).rotateX(Math.PI / 2)` so studs point at the camera; one `InstancedMesh`
per length L = 1..4 with `setColorAt`. Baseplate studs are one `InstancedMesh` (62 x 44).

### 2.3 Glossy ABS

```js
new THREE.MeshPhysicalMaterial({ color, roughness: .3, metalness: 0, clearcoat: 1, clearcoatRoughness: .09,
  specularIntensity: .6 });
// studio env map: BackSide grey room box + bright emissive panels (big warm key, tall cool strip, warm rim,
// sky bounce), then new THREE.PMREMGenerator(renderer).fromScene(env, 0.035); scene.environmentIntensity = .75
```

### 2.4 Brick by brick snap (title)

```js
const lr = letterReveal(t, letterIndex, nLetters, { spread: 0.72 });   // letter window from scene.js
const q = clamp((lr * (m + 3) - k) / 3);                                // plate k of m in build order (bottom row first)
const fall = 1 - ease.inQuad(q);                                         // q = 1: clicked in place
y += fall * 4.5 * u; z += fall * 3.5 * u; x += fall * side * 2.2 * u;  rx = fall * (0.9 + r1);
// out: r = clamp(outP * 1.6 - order * 0.6), pop toward the lens, spin, scale 1 - inCubic(r)
```

The hero assembles the same way while it hops in: feet (t 0.34), body with its printed face (0.42), top plate
(0.50), antenna (0.56). Each piece has a 0.14 s window: the first 75 percent is the 2.4 unit drop (`inQuad`), the
last 25 percent a 0.06 dip (one stepped frame of overshoot). The timing matters: the hero enters from x = -0.12 and
only clears the left edge near t 0.4, so an earlier build happens off frame. Starting at 0.34 puts the body drop on
screen and the antenna click right on the hop 1 landing (0.55). Stepping at 12 fps turns each drop into a 1 to 2
frame pop, which is the look.

### 2.5 Post pass (miniature lens)

```glsl
float coc(float d, vec2 uv){                       // depth CoC + forced tilt shift band
  float c = clamp((abs(viewZ(d) - uFocus) - uRange) / uScale, 0., 1.);   // uFocus = distance from the camera to (0, gY + 1, -1), range 2.6, scale 10
  float tilt = smoothstep(.2, 0., uv.y) * .75 + smoothstep(.86, 1., uv.y) * .45;
  return max(c, tilt);
}
// centre sample plus 39 golden angle taps (i = 1..39 of N = 40), radius sqrt(i/N) * c0 * maxR (maxR = 16.8 px at 1080p);
// weight = clamp(sampleCoc - r + 1) so sharp foreground never smears into the blur
col = aces(col * uExposure); col = pow(col, vec3(1/2.2)); // uExposure uniform = 1.05; target is linear HDR: tone map yourself
col = mix(vec3(luma), col, 1.14);                     // a little extra saturation, toy photo grade
col = mix(col, col*col*(3.-2.*col), 0.24);            // extra contrast S curve so the primaries pop
col *= 1. - .32 * smoothstep(.42, 1.05, length(q));   // vignette; grain = hash(pixel + frame*17) * .025
```

Set `renderer.outputColorSpace = LinearSRGBColorSpace` and `NoToneMapping`; the pass does both. Performance is
not measured here (no timing was recorded); `maxDpr: 1.5` caps the render size on high density screens.

### 2.6 Contact shadow and set dressing

A miniature sells height through the shadow under it. The key light's PCF shadow alone is too faint and too far to
the side, so the hero carries a soft dark disc: a horizontal plane with a radial alpha shader, placed 0.07 above
the stud tops of whatever surface is below (platform top when the hero is over the platform and at or above its
level, otherwise the baseplate), scaled `2.6 * (1 + h * 0.16)` and faded to about half at 7 units of height.

```js
const onPlat = Math.abs(w.x - platX) < platHalf + 0.6 && w.y >= pY - 0.05;
const surf = onPlat ? pY : gY, h = Math.max(0, w.y - surf);
blob.position.set(w.x + 0.15, surf + 0.07, 0.1);                    // above the stud caps, or studs poke through
blob.material.uniforms.uOpacity.value = 0.95 * (0.5 + 0.5 * clamp(1 - h / 7));
// frag: a = 1 - smoothstep(0.05, 1, length(uv - .5) * 2); gl_FragColor = vec4(.01, .035, .015, a * uOpacity)
```

Set dressing keeps the title band clean and the frame edges uncluttered: back trees are short (trunk 0 or 1) and
sit beside or below the title, the house is two courses high at x = -9.6, z = -15 so its red roof stays under the
red `S`, the tan fence starts at x = 7.6, z = -3.5, the sun is a round plate at (17.6, +7.1, -36.5) in front of
the clouds, and four loose bricks sit at x of about +-5 to 6.6, z 7.3 to 8.4 so they read as soft shapes in the
bottom corners.

## 3. Applying it to any storyboard

1. Build the set as a baseplate world: every prop is stacked `brickGeo` calls on the stud grid. Put the action
   plane at `z = 0`, backgrounds at `z = -8` to `-40` (they melt in the lens), and one or two loose bricks near the
   camera for foreground depth.
2. Characters are 2x2 or 2x3 brick bodies with tile faces. Animate them rigidly (squash at most 55 percent), and
   give one dangling part (antenna, tail, flag) a lagged motion from `squashAt(t - 0.12)`.
3. Any text becomes a plate mosaic from a pixel font; any appearance is "built", any disappearance is "taken
   apart". Order builds bottom row first, removals top first and last first.
4. Celebration = round plates flying off sideways in ballistic arcs (keep them off the face).
5. Keep `fps: 12` and drive every per frame wobble from `hash(frame)` with `frame % (DURATION * 12)`.

## 4. Common failure modes

| Symptom | Fix |
|---|---|
| looks like CG blocks, not toys | missing env map reflections or clearcoat; flat grey reflections read as rubber |
| looks like a real toy brand | do not print a word on studs, do not build the classic cylinder head minifigure, do not use the brand's exact logo red on a white wordmark |
| image washed out, colours pale | rendering to a target skips three's tone mapping: apply ACES and gamma in the post shader |
| sky is grey | the backdrop plane is mostly outside frame; only about 11 units show between baseplate edge and frame top, size the gradient to that band |
| bottom of frame sharp, no miniature feel | depth CoC alone is too weak near the camera; add the screen space tilt band |
| title unreadable | keep the title plane inside the focus range (within 2.6 units of the hero plane) and give each letter one colour |
| a glyph is missing, setup crashes | the font must contain every character of the title, including lowercase `s` |
| smooth sliding motion | not stepped: pass `fps: 12`, and make pieces fall in 1 to 2 frames instead of tweening |
| confetti covers the hero | spawn from the platform edges and throw sideways |
| loop pops | every stepped jitter must use `frame % 72`, and all pieces must be gone before `t = 5.6` |
| the signature "built brick by brick" beat is not seen | the hero enters off frame; start the assembly once it clears the edge (about t 0.34) and land the last piece on hop 1. Keep the face on the body piece so no face floats on its own |
| the jumps float | add the contact shadow disc under the airborne hero (2.6); the directional shadow alone does not read |
| title letters vanish into the trees or roof | same hue letters on same hue props lose their shape: keep back props out of the title band, or lower them |
| a stray white plate sits at the origin | an InstancedMesh created for a plate length with zero plates keeps one identity instance; set `count = 0` (or skip it) when the font has no run of that length |

## 5. Reference searches (YouTube / Vimeo)

1. `brickfilm stop motion 12 fps short`
2. `brick build stop motion title sequence`
3. `tilt shift miniature photography toy bricks`
4. `stop motion brick animation building time lapse`
5. `toy photography macro shallow depth of field bricks`
