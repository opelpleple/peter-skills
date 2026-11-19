# Style recipe: Lowpoly 90s

A late 90s console look: a dusk level made of a few hundred flat shaded triangles, chunky nearest neighbour
textures, vertices that jitter on a coarse screen grid, textures that swim across big polygons, thick
distance fog, and a 225 line frame (400 x 225 at 16:9, width follows the stage aspect) blown up with hard pixels and squeezed to 16 levels per channel through
an ordered dither. Reference build:
`https://peterbu.com/showcase/skills/video-like-peter/styles/lowpoly-90s/` (`index.html`, `lowpoly.js`,
`lowpoly.css`, `poster.png`). It runs the shared engine (`styles/_engine/stage.js` + `scene.js`) with
`context: 'none'`, `fps: 30`, and three.js r170 from `_engine/three.module.min.js`. Everything is original:
no existing game, mascot, logo or level is referenced.

## 1. What defines the style

| Trait | Rule |
|---|---|
| Read at first glance | you can count the triangles; colour sits flat per face; pixels are big and square; the sky shows dither crosshatch; distant things melt into a coloured fog; edges crawl slightly as the camera drifts |
| Palette (dusk) | sky top `#150f38`, mid `#4a2470`, low `#c2507a`, horizon `#ff9a5e`, glow `#ffd27a`; fog `#d97a7c` (fog colour = horizon band, so mountains dissolve into the sky); sun `#ffe08a` with ring `#ff8a52`; mountains `#6a3f8e` with caps `#f4c3d4`; hills `#2f6b5c` / `#3f8a64`; grass `#4f9a52` / `#3c7f48`; dirt path `#c99a62`; stone `#9a8cb8` / `#5e5284`; moss `#6cbf5a`; pines `#1f5656` / `#2a6f5e`, trunks `#6a3b3a`; hero `#ffb43c`, belly `#ffe7a6`, cheeks `#ff6f8a`, eyes `#1a1030`, feet `#e0702e`; gems `#6ef0ff` / `#ff6ae0`; title gold `#fff3a6` to `#ffb63a` to `#ff5f3c`, title sides `#7a2a5e`; key light `#ffdcb0`, ambient `#8a6aa4` |
| Shape language | primitives at their lowest useful detail: icosahedron detail 1 (80 faces) for anything round, 5 to 7 sided cones and cylinders, boxes. Jag a ring of vertices with seeded noise for rocks. Letters are 5 x 7 bitmap glyphs meshed as one welded voxel solid per glyph, never a smooth font. Diagonal strokes must taper to a one cell point (a V whose walls run straight down reads as U) |
| Line | none. Silhouettes and per face colour do all the drawing |
| Texture | tiny canvas textures (8, 16 or 32 px) with `NearestFilter`, no mipmaps, repeated: grass speckle with blades and two pixel flowers, bricks with a lit top lip, pebbly dirt, a 16 px gold glint for the title whose UVs span the whole glyph box (one diagonal shine band per letter; per cell UVs would stripe every cell into slats). Texture is greyscale-ish detail multiplied by vertex colour, so palette lives in the geometry |
| Lighting | per vertex (Gouraud) on non indexed geometry with face normals, so every triangle gets one value: one warm key from upper left front plus a purple ambient. Gems and the title get an emissive add so they pop through the dusk. No shadow maps: a blob shadow disc under the hero |
| Transparency | screen door only: discard fragments against a 4 x 4 Bayer matrix when `alpha <= bayer`. Used for the sun halo rings and the blob shadow; it reads as stippled dots, which is the era look. Screen door meshes are opaque, so they keep `depthWrite` on like everything else |
| Frame rate and stepping | game logic at 30 fps (`fps: 30` in `mount`); the page still presents at display rate. The vertex snap adds its own jitter on top |
| Timing and easing | gameplay snappy: shared parabolic hops and squash from `scene.js`, feet tuck in the air, the antenna lags by velocity and `squashAt(t - 0.1)`. Title letters fly in from deep inside the fog with three half turns (`outCubic` travel, `outBack(u, 2.2)` scale pop, an emissive flash as each locks), bob on a 1.5 s sine while held, then tip backward and shrink left to right on the way out. Celebration confetti = 30 tetrahedra under fake gravity (`y = up d - 9.5 d^2`, `up` 4.2 to 7.2, sideways `out` 3.2 to 7), launched low so the arc peaks below the title's lower edge; gone by 1.5 s. Landing dust = 6 octahedra per impact, spreading `charR * (0.9 + 1.6 outCubic(u))` over 0.45 s. Background life: the star field tint breathes `0.85 + 0.15 sin(3 ph)`; three crystals bob `0.35 sin(2 ph + 2.1 i)` and turn whole turns per loop (`ph * 2` or `-ph`), where `ph = 2 pi t / 6` |
| Camera | an "attract mode" drift with `ph = 2 pi t / 6`: position offset `x = 0.9 sin(ph)`, `y = 0.18 sin(2 ph) - kick`, `z = 0.4 cos(ph)`, look at `(0.25 sin(ph), 1.1 - kick / 2, 0)`, where `kick = 0.12 * impactPulse(t, 0.2)` dips on each landing. 38 degree FOV, base camera at (0, 2.1, 17) looking at (0, 1.1, 0). All motion periodic in the 6 s loop |

## 2. Technique

Three.js, built once in `setup`, posed in `render(t)` from `t` alone. Turn colour management off so hex values
go to the GPU raw: `THREE.ColorManagement.enabled = false; renderer.outputColorSpace = THREE.LinearSRGBColorSpace;`
and textures `colorSpace = THREE.NoColorSpace`.

### 2.1 One custom material for everything

A `ShaderMaterial` with shared uniforms (resolution, light, fog) and per mesh ones (map, tint, lit, emit,
fog on or off, alpha, uv scale). The three era tricks live in it:

```glsl
// vertex
vec4 cp = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
vec2 grid = uRes * 0.5 / uSnap;                       // uRes = internal frame (225 high, width follows aspect), uSnap = 1 px
cp.xy = floor(cp.xy / cp.w * grid + 0.5) / grid * cp.w;   // 1) vertex snap = wobble
gl_Position = cp;
float d = max(dot(normalize(normalMatrix * normal), uLightDir), 0.0);
vCol = color * uTint * mix(vec3(1.0), uAmb + uLightCol * d, uLit) + color * uTint * uEmit; // 2) per vertex light
vUvw = vec3(uv * uUvScale * cp.w, cp.w);              // 3) affine UVs, part one
vFog = uFogOn * smoothstep(uFogNear, uFogFar, -mv.z);
// fragment
if (uAlpha < 0.999 && uAlpha <= bayer4(gl_FragCoord.xy)) discard;   // screen door alpha
vec3 c = texture2D(map, vUvw.xy / vUvw.z).rgb * vCol;               // affine UVs, part two
gl_FragColor = vec4(mix(c, uFogCol, vFog), 1.0);
```

Why the affine trick works: three interpolates varyings perspective correctly, so `uv * w` and `w` both get
divided by the same 1/w weights; their ratio cancels the correction and you get plain screen space (affine)
interpolation, which makes textures swim and bend on large triangles. The light direction uniform is the
world key light transformed into view space each frame (`dir.transformDirection(cam.matrixWorldInverse)`).

### 2.2 Flat geometry and per face colour

```js
const flat = (geo) => { const g = geo.toNonIndexed(); g.computeVertexNormals(); return g; };   // face normals
paint(geo, (centroid, normal, faceIndex) => color)   // writes one colour to all 3 verts of each triangle
const vary = (hex, f, amt, seed) => new THREE.Color(hex).multiplyScalar(1 - amt + hash(f, seed) * amt * 2);
merge([...])   // concatenate non indexed position/normal/uv/color into one mesh per prop group
```

Per face `vary` (plus or minus 4 to 14 percent) is what makes a cone look hand modelled instead of CG grey.
Big surfaces (the ground) must be subdivided (60 x 44 over 220 x 150 units here, about 3.5 units a cell) or
affine warping turns into heavy swimming patches in the foreground.

The sky is the one exception to the flat material: a back side sphere whose 5 stop gradient is computed per
pixel from `normalize(position).y` in its own tiny shader, so dome face edges never show as tone steps. The
dither in the frame pass is what bands it.

Title glyphs are meshed directly, not merged boxes: for each filled cell emit the front and back quad, and a
side quad only where the neighbouring cell is empty. Merged per cell boxes leave inner faces that z fight under
the vertex snap and show the side colour as glitchy slats. A second copy of the solid, dark (`#2a0f3a`), offset
0.35 cell down right and 0.9 depth back, is the drop slab that separates the title from a busy treeline.

### 2.3 Low res frame and the video out pass

```js
rt = new THREE.WebGLRenderTarget(400, 225, { minFilter: NearestFilter, magFilter: NearestFilter }); // resized to (225 * aspect) x 225
renderer.setRenderTarget(rt); renderer.render(scene, cam);
renderer.setRenderTarget(null); renderer.render(postScene, orthoCam);  // full screen quad
```

```glsl
vec2 px = floor(vUv * uRes);
vec3 c = texture2D(tDiffuse, (px + 0.5) / uRes).rgb;
c = floor(c * 15.0 + bayer4(px)) / 15.0;     // 16 levels per channel, ordered dither in internal pixels
vec2 d = vUv - 0.5; c *= 1.0 - dot(d, d) * 0.55;   // tube falloff
c *= mod(px.y, 2.0) < 1.0 ? 1.0 : 0.93;     // faint line structure
```

The internal height is fixed at 225 and the width follows the stage aspect, so the pixel size never changes
with window size. Add `image-rendering: pixelated` on the canvas as a belt and braces. Keep `antialias: false`.

### 2.4 Mapping the shared 2D layout into the 3D set

Cast the normalised stage point through an unjittered base camera onto the plane `z = 0` (or `z = -2.2` for
the title, scaled from that plane's stage height), then build the floor at `groundY`, an octagonal brick pedestal
from the floor up to `platform.y` under a mossy octagon cap (same 8 sided prism: rotate by pi/8 first, then
scale, or the octagon shears off centre; cap 1.06 x the body width and 1.14 x its depth; body stops 0.04 below
the cap), and size the hero from `charR * stageHeight`. The
drifting render camera is a clone; the mapping always uses the base one, so layout stays stable.

```js
function stageToWorld(cam, x, y, zPlane = 0) {
  const v = new THREE.Vector3(x * 2 - 1, 1 - y * 2, 0.5).unproject(cam);
  const dir = v.sub(cam.position).normalize();
  return cam.position.clone().addScaledVector(dir, (zPlane - cam.position.z) / dir.z);
}
```

The shared spin hop (`rot` from `pose`) is applied around Y in 3D so the back of the ball shows; other leans
go on Z as `-rot`. Squash is `scale.set(sx, sy, sx)` with the group placed at contact `+ R * sy`.
The blob shadow is a 10 sided disc of radius 1.3 R, scaled 0.9 in depth (it is seen almost edge on from this
camera), lifted 0.08 above the surface below, alpha `0.35 + 0.5 s` where `s` shrinks with height.

Keep the title band (stage y 0.23 to 0.37 here) clear: floating props are placed in stage space below it, and
background props near the centre stay short enough that their tops end under it.

## 3. Applying it to any storyboard

1. Block each storyboard location as a small "level": one hero prop, a clearing for the action, a ring of
   background props (trees, ruins, rocks), far mountains and a sky dome. Keep the action area clear of tall
   props; frame with them on the sides.
2. Pick a time of day and derive the palette from it: sky gradient 4 to 5 stops, fog = horizon stop, a
   warm or cool key light, an ambient that is the sky mid colour lightened.
3. Build every asset from low detail primitives, `flat` + `paint` + `vary`, merged per group.
4. Give characters few parts: faceted body, block eyes that squash to blink, two bar mouth that bends into a
   grin, boxy feet, one lagging appendage (antenna, tail, ear).
5. Text: bitmap glyphs (5 x 7 or 7 x 9) extruded as merged boxes with a vertical gold gradient on the front
   faces and a dark side colour; animate letters like a title screen (fly, spin, lock with a flash).
6. Render through the 225 line target (400 x 225 at 16:9) and the dither pass. Check every shot at 1x and on a phone.

## 4. Common failure modes

| Symptom | Cause and fix |
|---|---|
| Looks like a modern low poly render (clean, smooth gradients) | missing the frame pass: render to a fixed 225 line target, nearest upscale, 15 to 16 levels with Bayer dither, no antialias |
| Everything a flat pastel sheet in the distance | fog too short. Fog near about 18, far about 175 units here; let mountains keep some of their colour |
| Textures swim wildly or tear | the plane is two giant triangles; subdivide large surfaces |
| A sprite or ring vanishes | `depthWrite: false` mesh drawn before an opaque sky that then paints over it. Screen door meshes are opaque; keep depthWrite on (the blob shadow included) |
| Blob shadow reads as a dashed line | disc too small and too flat at a grazing angle, buried by the snap. About 1.3 R, depth scale about 0.9, lift 0.06 to 0.1, denser alpha |
| Title letters break into slats or flicker at the edges | merged per cell boxes (inner faces z fight) and per cell UVs. Weld each glyph into one outer surface and span UVs over the glyph box |
| Sky shows rectangular tone steps | per vertex sky colour on a coarse dome. Compute the gradient per pixel from the view direction |
| Props sit inside the title, or confetti covers it | keep floating props out of the title band, launch the burst low and wide so its peak stays below the title |
| Pedestal corner pokes through its cap, or the cap sits off centre | cap scaled before rotating, or a box body under an octagon cap. Share one prism shape, rotate then scale, cap wider, body shorter |
| Thin flicker between floor and path or a cap and its box | coplanar faces plus vertex snap. Lift decals 0.05 to 0.1 units and shorten the box under a cap |
| Text looks washed out or ghostly | fog applied to the title. Set `fog: 0` on UI like meshes |
| Faces look muddy grey | dark ambient times a light belly colour on faces that point away from the key. Warm the ambient and add a small emissive term (0.15 to 0.2) to the hero |
| Loop pops at 6 s | something not periodic: every drift, bob and spin must use whole cycles of `2 pi t / 6`; particles must be gone before 5.9 |
| Two renders of the same t differ | reading time or keeping state. Everything from `t`, `hash()` and `pose()`; set `preserveDrawingBuffer: true` so captures read the drawn frame |
| Copying a famous game | avoid recognisable mascots, logos, HUDs and level layouts. Original creature, original palette, original glyphs |

## 5. Reference search queries (YouTube / Vimeo)

1. `PS1 style graphics shader tutorial vertex snapping affine texture mapping`
2. `low poly 90s 3D platformer aesthetic dither fog indie`
3. `retro 3D render low resolution dithering three.js shader`
4. `late 90s console attract mode title screen 3D letters`
5. `low poly flat shaded landscape sunset Blender PSX style`
