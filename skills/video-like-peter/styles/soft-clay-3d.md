# Style recipe: Soft Clay 3D

Hand pressed plasticine on a little tabletop set, shot one frame at a time. Reference build:
`https://peterbu.com/showcase/skills/video-like-peter/styles/soft-clay-3d/` (`index.html`, `clay.js`,
`clay.css`, `poster.png`). It runs the shared engine (`styles/_engine/stage.js` + `scene.js`) with
`context: 'none'`, `fps: 12`, and three.js r170 from `_engine/three.module.min.js`.

## 1. What defines the style

| Trait | Rule |
|---|---|
| Read at first glance | everything looks squeezed out of a warm, soft material: no hard edges, no flat colour, no perfect circles, visible thumb prints, a set that slightly "boils" each frame |
| Palette (warm pastel) | wall low `#f3b0a0` to wall high `#ec9ea6` (the gradient reaches full pink about 12 units up the wall, so it is in frame), floor `#f2c79a`; hero `#f59a7a` with cheeks `#f27c8a`, eyes `#fff8ee`, pupils `#3b2a33`, mouth `#7a3443`; greens `#8cc58a` / `#6fae74`; props mint `#93d3b6` (platform top), lilac `#c9b6e4`, butter `#ffd36e`, sky `#9cc9ee`, pink `#f7a8b8`, apricot `#f8b98a`, sage `#b8d7a6`; cloud `#fff4e6`, sun `#ffd877` |
| Shape language | balls, sausages (coils), slabs with pinched round corners. Every primitive gets low frequency lumps (3 to 12 percent of its size). Letters are rolled coils with ball end caps, never extruded fonts |
| Line | no outlines. Shape is carried by soft shadow, warm rim and silhouette |
| Texture | one tileable bump map: fine grain, faint concentric fingerprint whorls, tool drags, small dents. Bump, not colour; colour stays flat pastel |
| Lighting | one big warm soft box key from upper left front with soft shadows, a cool weak fill (0.7) from the right, a peach rim from behind, hemisphere fill 0.95 with a pink ground colour `#d9a0a0` (a brown ground colour drags every pastel toward mud). Plus a fake subsurface term (see 2.3) so edges glow like wax |
| Frame rate | 12 fps stepping (on twos). The clock is quantised by `stage.js`; per stepped frame add boil (tiny jitter) |
| Timing and easing | snappy: hops are parabolic (from `scene.js`), landings get a big squash that rings out (`squashAt`), anticipation crouch before take offs. Secondary parts lag (sprout = `squashAt(t - 0.12)`). Text drops with `inQuad`, lands with a damped cosine squash. Exits squash things flat like a thumb pressing them |
| Camera | locked off tripod on a small set: 27 degree FOV, slightly above eye level (`(0, 1.7, 19)` looking at `(0, -0.25, 0)`), sub pixel jitter per frame only. No dolly moves: stop motion cameras rarely move |

## 2. Technique

Three.js, built once in `setup`, posed in `render(t)` from `t` alone.

### 2.1 Mapping the shared layout into 3D

The character walks on the world plane `z = 0`. Convert any normalised stage point by casting its ray onto a plane,
so the floor line, platform top and title land exactly where the 2D layout says:

```js
function stageToWorld(cam, x, y, zPlane = 0) {
  const v = new THREE.Vector3(x * 2 - 1, 1 - y * 2, 0.5).unproject(cam);
  const dir = v.sub(cam.position).normalize();
  return cam.position.clone().addScaledVector(dir, (zPlane - cam.position.z) / dir.z);
}
// floor y = stageToWorld(cam, .5, LAYOUT.groundY).y ; keep an unjittered camera clone for this mapping
```

### 2.2 Lumpy clay geometry

```js
function lumpify(geo, amp, freq, seed) {        // push along normals by seeded fbm
  for each vertex: p += n * (fbm(p * freq, seed) - 0.5) * 2 * amp;
  geo.computeVertexNormals(); weldNormals(geo); // average normals of co-located verts: no seam lines
}
roundedBox(w, h, d, r)   // BoxGeometry, each vertex = clamp(p, inner) + normalize(p - inner) * r
TubeGeometry(CatmullRomCurve3(points, false, 'centripetal'), 64, coil, 14)   // coil letters + rims
```

Noise is a hashed value noise (`hash()` from `scene.js`), so the set is identical on every load.

### 2.3 Clay material: sheen + fake subsurface + vertex boil

`MeshPhysicalMaterial({ roughness: .78, sheen: .55, sheenColor: lighter tint, bumpMap: fingerprintTex,
bumpScale: 1.4 })`, then `onBeforeCompile`:

```glsl
// vertex: re-sculpt a little every stepped frame (uBoil = frame * 1.37, uBoilAmp = 0.012 world units)
transformed += normal * sin(p.x*4.1+uBoil*1.7) * sin(p.y*3.7+uBoil*2.3) * sin(p.z*4.3+uBoil*.9) * uBoilAmp;
// fragment, before #include <opaque_fragment>
vec3 vd = normalize(vViewPosition);
float ndv = clamp(dot(normal, vd), 0.0, 1.0);
outgoingLight += mix(diffuseColor.rgb, vec3(1., .55, .42), .35) * pow(1. - ndv, 2.6) * .32 * uSss; // edge glow
outgoingLight += diffuseColor.rgb * .06 * uSss;                                                     // wrap lift
```

Set `customProgramCacheKey` per uniform variant. Eyes use lower roughness (0.32 to 0.55) and a tiny unlit glint ball.

### 2.4 Fingerprint texture (canvas, once)

Grain from torus-sampled fbm (tileable), then 9 sets of faint concentric wobbly ellipses (alternating dark and
light strokes, 1 to 3 px), 26 curved tool drags, 40 soft dents. `NoColorSpace`, `RepeatWrapping`, per material
`repeat` (floor 7, props 1.5 to 3.2). The sweep carries two material groups on the same vertices: the floor rows
use repeat 7, the arc and wall rows use repeat 2.6 with the bump map rotated 0.83 rad and offset, split at the row
where the arc starts (behind the hills). One repeat over the whole sweep shows the whorls as a grid of rings on the wall.

### 2.5 Stop motion feel

- `mount({ fps: 12 })`: the engine quantises `t`; `ctx.frame` is 0..71 and wraps, so `f = frame % 72` keeps the
  boil seamless.
- Per frame jitter from `hash(f * 131 + id * 7 + k)`: props +-0.6 to 2 percent of a unit, camera +-0.008, key
  light intensity +-1.8 percent (the flicker of a real lamp).
- Soft contact blob (radial gradient plane) under the puppet besides the real shadow: shrink and fade with height.
- Debris: an `InstancedMesh` of lumpy balls, 5 per impact, radius 0.15 to 0.25 of the body radius (smaller reads
  as dust). Closed form in `d = t - impactTime` (no simulation): a short ballistic arc (`vy` 1.3 to 2.4, lands at
  `2 vy / g`), then a roll that eases out (`tl + 0.45 (1 - e^(-6 (d - tl))) / 6`), spinning with the distance rolled.
  Lifetime `min(0.8, 5.92 - impactTime)`, and each crumb shrinks to 0 over its last 0.15 s, so nothing from the
  `exitHop1Land` impact (5.6) is left at `t = 5.999`. Celebration pellets launch from the platform at `BEATS.spinLand`.

### 2.6 Rendering

`antialias: true`, `preserveDrawingBuffer: true` (clean screenshots), `NeutralToneMapping` (ACES turns the pastel
wall terracotta), exposure 1.0, `PCFShadowMap` 2048 with `radius 5`. In three r170 `shadow.radius` is ignored by
`PCFSoftShadowMap`; use `PCFShadowMap` (or `VSMShadowMap` with `blurSamples`) when you want the radius to blur.
Sweep (floor curving into wall) as one bent `PlaneGeometry` with vertex colours and `DoubleSide`.
`THREE.Fog(wallHigh, 26, 46)` softens the far wall into its own colour. A static CSS vignette sits over the canvas.
The page only needs a new picture 12 times a second. Cost depends on the GPU: a headless SwiftShader (software)
capture took 110 to 360 ms per `__render` call at 1280x720 (the call also waits for an animation frame), which is fine for frame by frame capture. No real GPU timing has been measured yet.

URL `?clean=1` hides the label bar so captures show only the stage (use with `?dpr=1` for 1280x720 stills).

## 3. Applying it to any storyboard

1. Map every 2D element to a clay object: characters = balls with eyes and nubs, panels = rounded slabs, lines and
   type = coils, icons = a few balls and sausages. Keep the count of materials small (10 to 20).
2. Put the action plane at `z = 0` and place everything with `stageToWorld`; background pieces on the wall plane,
   props in the foreground at `z > 0` for depth. Place foreground props by stage x (for example x 0.06 to 0.16 and
   0.9 on `z` 2 to 3) and reject any whose projected bounds leave a 5 percent safe area, so nothing is cut by the frame.
   Keep corner props (sun, cloud) clear of the title box: here sun at stage `(0.9, 0.12)`, cloud at `(0.1, 0.13)`,
   both scaled 0.8.
3. Time from the storyboard beats, then quantise to 12 fps: hold poses for at least 2 stepped frames, and give every
   landing a squash, every take off a crouch, every appendage a lag.
4. Type: build glyphs as point lists per letter (cap height 1), coil radius about 0.1 of cap height. Hang the title
   on the back wall: letters at `z = -9.25`, wall at `z = -10`, sized with the stage-to-world scale measured at that
   plane (here cap height `titleSize x 0.97`, letter gap 0.07, word space 0.38 of cap height). The shelf is a
   flattened coil just under the letters, pinned to the wall with two pegs whose knobs show under the ledge. Then
   every shadow falls a short way behind the letters, like a relief. Reveal by dropping each letter onto the shelf,
   exit by pressing it flat (`sy to 0.06, sx to 1.45`).
5. Verify: `?t=` freezes, `window.__render(t)` twice gives identical pixels, frames at the loop edge match.

## 4. Failure modes

| Symptom | Cause and fix |
|---|---|
| Floor invisible, only clear colour | bent plane faces away after the remap: `side: DoubleSide` (or flip the winding) |
| Looks like CG plastic | roughness too low, no sheen, no fingerprint bump, perfect spheres. Add lumps and the edge glow |
| Looks like a game render | camera moves smoothly or time is not stepped. Lock the camera, use `fps: 12`, add boil |
| Boil looks like noise or shimmer | amplitude too high (keep vertex boil near 1 percent of a body radius) or boil driven by continuous `t` instead of the stepped frame |
| Seam line down every sphere | normals recomputed after displacement split at UV seams: weld normals by position |
| Washed out, greyish pastel | too much hemisphere light or exposure. Hemisphere about 0.95, exposure about 1.0 with Neutral tone mapping, saturate the floor colour (`#f2c79a`) |
| Background props swallow the frame | big flattened spheres placed too close to the camera; push hills to `z -6` to `-8` |
| Title shadow lands on a hill or the far wall, or a thin shadow line crosses the floor | letters and shelf float in space in front of the set. Fix the shelf to the wall (letters about 0.75 units in front of it, shelf pinned by pegs) or turn off their `castShadow` and give each letter a small contact shadow |
| Specks pop out of the frame at the loop seam | crumbs from the last impact outlive the loop. Cap each lifetime at `LOOP_GUARD - impactTime` (5.92) and shrink to 0 before it ends |
| Pastels go brown or terracotta | ACES tone mapping plus a brown hemisphere ground colour. Use `NeutralToneMapping` (or AgX) and a pink ground colour such as `#d9a0a0` |
| Crumbs read as dust or noise | debris 1 to 3 px wide. Make them 0.15 to 0.25 of the body radius, fewer (5 per impact), and let them roll before they settle |
| Fingerprints repeat as a grid of rings on the wall | one high repeat over the whole sweep. Give the wall rows their own material group with a lower, rotated repeat |
| Platform rim shows as a band under the slab | rim coil placed near the slab bottom. Put it at about `-0.12` of slab height so it caps the top edge |
| Props poke in from the frame edge | foreground pieces placed by world x off screen. Place by stage x and reject anything outside the safe area |
| Shadow radius does nothing | `PCFSoftShadowMap` ignores `shadow.radius` in r170. Use `PCFShadowMap` or `VSMShadowMap` |
| Title shelf or props visible before their beat | gate them with `titleState(t)` and animate them in, like the shelf roll out |
| Loop pops | anything periodic must use `t / DURATION` or `frame % 72`; never `Date` or `Math.random` |

## 5. Reference searches (YouTube / Vimeo)

1. `claymation stop motion short film plasticine character walk cycle`
2. `stop motion clay title sequence plasticine lettering`
3. `3D clay render animation blender soft clay look squash and stretch`
4. `plasticine stop motion set lighting behind the scenes soft box`
5. `clay animation boiling effect 12 fps on twos explained`
