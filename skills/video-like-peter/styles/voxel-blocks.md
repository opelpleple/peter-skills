# Style recipe: Voxel blocks

A sunny world built only from cubes on a grid, lit like a clear midday, with the soft corner darkening that makes
a block world feel solid. Reference build:
`https://peterbu.com/showcase/skills/video-like-peter/styles/voxel-blocks/` (`index.html`, `voxel.js`,
`voxel.css`, `poster.png`). It runs the shared engine (`styles/_engine/stage.js` + `scene.js`) with
`context: 'none'`, smooth time (`fps: null`, 60 fps), and three.js r170 from `_engine/three.module.min.js`.

Originality guard: this is the voxel genre, not any particular block game. Every texture is painted from code with
its own palette (pastel mint grass over peach clay, lavender stone, terracotta brick stage with a gold inlay and gold
lip, teal and sunstone ore). The hero is an original tangerine cube critter with a two leaf sprout. Never reproduce a
known game's block textures, mobs, hotbar, crosshair, logo or font.

Textures alone are not enough: the best known block game is also recognised by its default overworld composition.
Avoid all of these signatures together, and replace each one:

| Signature to avoid | What this style uses instead |
|---|---|
| square sun with square halo | a round pixel disc sun with a warm stepped radial glow (one 64 px canvas, nearest sampled) |
| flat white cube cloud slabs | puffy cumulus: 3 voxel balls per cloud, cream tops over a lilac belly |
| grass block side = dirt with a ragged green fringe | peach clay under one smooth scalloped mint lip (a cosine wave, period 8 px) |
| log column under a leaf blob (oak) | three own species on thin stick trunks: lollipop topiary balls, stacked teal pine tiers, pink blossom domes with coral fruit |
| grey cobblestone cubes as props | honey crates, a terracotta flower pot, a cream picket fence, sandstone pavers for the path |
| saturated default green and brown | pastel grass `#9fd77c` to `#b8e692`, clay `#cf8660` to `#e8ad86`, lavender stone |

## 1. What defines the style

| Trait | Rule |
|---|---|
| Read at first glance | everything is an axis aligned cube on one grid, every surface is a 16 x 16 pixel tile sampled nearest (crisp pixels up close), and every inside corner is darker (baked ambient occlusion) |
| Palette (bright daylight, pastel ground) | sky top `#2f8cf0`, sky mid `#6bb8fb`, horizon and fog `#cdeeff`, sun disc `#fff3b0` with hot spot `#fffbe6`, glow `#fff6cc`. Grass `#9fd77c #aee088 #b8e692 #93cd70 #a6dc82`, blade light `#d8f5a8`, lip shadow `#86c467`. Clay `#e3a27a #d9926a #e8ad86 #cf8660`. Stone (lavender) `#b8b0d0 #aaa2c5 #c4bdda #a39bbf`. Sand `#f1dc9b #ead291`. Topiary `#5cc49a #68cfa4 #52b88e`, pine `#2f8f7a #3aa088 #2a8370`, blossom `#f7a8c4 #f4b6cf #fbc6d9` with fruit `#ff7a5c`. Bark `#a86a5a #9a5d50`. Crates `#e8b06a #e0a560`, pot `#e07a55` with cream rim `#fff0d8`, fence `#fff2df`, pavers `#f3dcb6 #ecd1a6`. Clouds `#fffdf6` top, `#f6f0fb` mid, `#dcd0ee` belly. Stage brick `#d2704f #c4613f` with mortar `#f0d3b0`, stage planks `#e3a865 #d9995a` framed by a 2 px gold inlay `#ffcf3f #ffe27a #ffd95a`, front lip = a 3 px gold trim band over the brick. Hero `#ff9f43`, top `#ffc46e`, shade `#e2762c`, belly `#ffe0a6`, cheeks `#ff7aa0`, pupils `#2b2140`, mouth `#6a2235`, sprout `#3f9e4d / #74d86a`. Birds slate `#4a5d86`, belly `#fbf4e6`, beak `#ffb340`. Title letters cycle `#ffcf3f #ff8a3d #ff5d73 #c46bff #4aa8ff #33d1b8` over a navy back plate `#14213f` |
| Shape language | cubes and boxes only. No smooth spheres, no bevels in geometry (bevel is painted into the texture). Round things are voxel balls (cells inside `di^2 + dj^2 + dk^2 <= r^2`). Trees are thin box sticks under voxel crowns, clouds are 3 voxel balls flattened underneath, hills are terraced steps. Thin boxes (sticks, fence posts and rails) are allowed as long as they stay axis aligned or yawed |
| Line | no outlines. Edges come from the per pixel tile borders, face lighting and AO |
| Texture | 8 x 4 canvas atlas (24 tiles), 16 px tiles. Each tile is per pixel hashed choice from 4 or 5 close shades, plus rare accent pixels (pebbles, light blades, crystals, fruit). Grass side = peach clay under a smooth scalloped mint lip `4 + round(cos((x + 0.5) / 16 * TAU * 2) * 1.2)` px deep with a one pixel clay shadow line. Title blocks use a greyscale bevel tile tinted per instance |
| Lighting | one warm sun `DirectionalLight('#fff1d6', 2.6)` from upper left front (`(-14, 30, 22)` blocks) with PCF soft shadows. The visible sun disc must sit on the key light side: here at stage `(0.085, 0.13)`, upper left, so shadows fall away from it. A sun on the opposite side contradicts every shadow in frame. a strong sky hemisphere `('#cfe8ff', '#7fb36a', 1.55)`, no tone mapping (keeps the toy colours pure), sRGB output, light blue distance fog that matches the horizon |
| Ambient occlusion | baked per vertex while meshing (section 2.3). Four levels `0.38, 0.6, 0.8, 1.0`. This is the single most important ingredient: without it the world looks like flat stickers |
| Frame rate | smooth 60 fps. The world is chunky, the motion is not. (Stepping to 12 fps makes it read as stop motion, a different style) |
| Timing and easing | everything "pops": blocks appear with `outBack` (overshoot 2.4) plus a short drop and a quarter twist, leave with `inCubic` shrink plus a gravity fall. Landings throw block chips that follow closed form ballistic arcs and stop on the floor. Character squash from `squashAt`, the sprout lags 0.1 s |
| Camera | locked off at eye level of a 2 block creature: FOV 30, `(0, 3.9, 27)` looking at `(0, 2.95, 0)`, so the horizon sits around 40 percent down and the sky has room. Only motion is a small shake on the big landing (`impactPulse`) |

## 2. Technique (Three.js, built in `setup`, posed in `render(t)`)

### 2.1 Fit the block grid to the shared layout

The character walks on the plane `z = 0`. Cast the layout points onto it, then derive the block size so the
pedestal is exactly 2 blocks tall. Everything voxel lives in one group scaled by that size, so you author in
integer block units.

```js
const G  = stageToWorld(cam, 0.5, LAYOUT.groundY, 0).y;
const PT = stageToWorld(cam, 0.5, LAYOUT.platform.y, 0).y;
const s  = (PT - G) / 2;                        // world units per block
world.position.set(0, G, 0); world.scale.setScalar(s);
const toBlock = (v) => new THREE.Vector3(v.x / s, (v.y - G) / s, v.z / s);
// per frame: ch.root.position.copy(toBlock(stageToWorld(cam0, p.x, p.y, 0)))
```

Use the unshaken camera clone (`cam0`) for mapping so the shake never moves the layout.

### 2.2 The procedural atlas

```js
// 256 x 128 canvas, 8 x 4 cells of 32 px: each 16 px tile is centred with 8 px of replicated edge
// padding so mip levels never bleed a neighbour tile in.
g.drawImage(tile, 0, 0, 1, 16, ox, oy + 8, 8, 16);   // repeat the left column into the left gutter (x4 sides, x4 corners)
g.drawImage(tile, ox + 8, oy + 8);
tex.magFilter = THREE.NearestFilter;                 // crisp pixels up close
tex.minFilter = THREE.NearestMipmapLinearFilter;     // calm in the distance
tex.colorSpace = THREE.SRGBColorSpace;
```

Pixel colour = `pick(shades, hash(x*37 + y*613, seed))`, so tiles are identical every load.

### 2.3 Mesher with baked AO

One `BufferGeometry` for the whole terrain. For every solid voxel, emit a quad only on faces whose neighbour is
air. For each of the 4 corners look at the 3 cells in front of the face: side A, side B, and the diagonal corner.

```js
const s1 = solid(front + u*su), s2 = solid(front + v*sv), c = solid(front + u*su + v*sv);
const ao = s1 && s2 ? 0 : 3 - (s1 + s2 + c);           // 0 darkest .. 3 open
col.push(L, L, L) with L = AO_LEVEL[ao] * (0.93 + 0.07 * hash(block))   // tiny per block jitter
// flip the diagonal so the gradient does not crease:
if (ao[0] + ao[2] > ao[1] + ao[3]) tri(0,1,2, 0,2,3); else tri(1,2,3, 1,3,0);
```

Material: `MeshLambertMaterial({ map: atlas, vertexColors: true })`, cast and receive shadows. Face tables keep the
side faces' v axis on +y so tiles stand upright. The 93 x 27 x 70 grid meshes in well under 100 ms. The atlas is 8 x 4 cells (256 x 128 px) for 24 tiles.

### 2.4 Everything else is instanced cubes

- Title: a 5 x 7 pixel font (I is 3 wide), one cube per lit pixel in an `InstancedMesh`, scaled
  `(s * 0.98, s * 0.98, s * 1.5)` so front cubes are 1.5x deep, plus a second `InstancedMesh` of navy cubes
  (`#14213f`, emissive 0.35) offset `(+0.45, -0.45, -0.7)` cells and scaled `1.12` so every letter gets a dark rim
  and drop shadow against the busy world. Letter material emissive 0.14 keeps the tops bright. Per instance colour
  via `setColorAt`, bevel via the greyscale tile.
- Reveal per cube: `uL = letterReveal(t, letter, 11, { spread: 0.62 })`, then
  `lin = clamp(uL * 1.6 - ((6 - row) / 6) * 0.6 - cc.seed * 0.04)` (bottom row first, like stacking, with a tiny
  per cube jitter from `hash`), scale `outBack(lin, 2.4)`, drop `(1 - outCubic(lin)) * 2.2` cells, twist
  `(1 - outCubic(lin)) * 1.4`.
- Keep the title band (stage y 0.22 to 0.38) clear: no far trees (their crowns land in the band), and a low ridge
  (`smoothstep(22, 46, d) * (1 + m * 7.5)`) so the letters sit over pale ridge and sky.
- Celebration: a wave rolls out from the middle letters at the spin landing, a smaller one at the bounce.
- Exit: `letterReveal` over `[titleOut, titleGone]`, top rows lead, shrink `1 - inCubic`, fall `lo^2 * 2.4` cells.
- Particles: slots fixed in `setup` (position, velocity, colour, life from `hash`), positions in closed form
  `p0 + v*a + 0.5*g*a^2`, clamped to the floor. Lifetimes end before the loop seam (0.38 s chips after the 5.6 s
  landing end at 5.98 s). The big landing also throws a flat dust ring: 16 cream cubes on the pedestal top, no
  gravity, closed form drag `(1 - exp(-5a)) / 5`, life 0.46 s, so the impact reads in one still frame.
- Grass and flowers: crossed quad pair with a 16 px alpha tested sprite, instanced, sway `0.12 * sin(2 * TAU * t/6 + phase)`.

### 2.5 Sky and ambience, all periodic in 6 s

- Sky dome: back side sphere, `ShaderMaterial` gradient horizon to mid to top by `normalize(pos).y`, `fog: false`,
  `#include <colorspace_fragment>` at the end.
- Sun: one 58 unit plane far behind (z -260), facing the camera, textured with a 64 px canvas: an opaque pixel disc
  (radius 9.6 px) plus a warm `#fff6cc` halo whose alpha drops in 7 quantised rings (`0.42 * (1 - step/7)^1.7`),
  sampled nearest. Stepped like everything else, round, and no flat translucent cards.
- Water: its own `RepeatWrapping` tile, `offset.x = t / 6` (one tile per loop = seamless).
- Clouds bob `sin(TAU * t/6 + phase)`; birds cross once per loop from off screen to off screen, so the wrap is invisible.
  Birds are 2.6x scale (back, belly, head, beak, tail, two wing segments), pitched 0.5 and yawed -0.75 so the back
  and both wings face the camera, light belly under slate wings; wings flap about the travel axis.

### 2.6 The hero

Box body (1.8 x 1.55 x 1.5 blocks) with face specific pixel textures (lighter top rows, darker bottom rows, belly
patch and cheek pixels on the front), eyes and mouth as separate thin boxes standing proud of the face so they can
blink (scale y) and grin (scale x and y), stubby foot cubes that tuck in the air, arm nubs on shoulder pivots that
flap with `air` and wave in the celebration, a sprout whose leaves follow `squashAt(t - 0.1)`. Hierarchy:
`root (contact point, yaw) > lean (pivot at body centre, roll and look up pitch) > squash (scale sx, sy, sx about
the contact point)`. The 3D twist: the shared spin becomes a yaw turn, the lean stays a roll; the critter faces
3/4 toward travel when hopping in and out and squares up to the camera on the pedestal. A radial blob under the
feet (shrinks with height) adds contact AO on top of the real shadow.

## 3. Applying it to any storyboard

1. Author the set in integer block units; derive the block size from one known screen distance (section 2.1).
2. Keep the action lane flat and clear (here `k >= -3` is flat), push hills, trees and mountains behind, and dress
   the foreground corners asymmetrically: here a 2 block flower bush plus a picket fence on a diagonal into depth on
   the left, a 2 high crate stack and one flower pot on the right. Keep left props low enough that the hop in is
   never hidden.
3. Big flat areas look dead: add terraces, sprites, a pond, a path, ore specks in exposed stone.
4. Text and logos become pixel fonts of cubes with a dark offset back plate.
5. Every appearance is a pop (outBack scale + small drop), every disappearance a shrink or a fall. Impacts throw
   chips coloured like the surface that was hit.
6. Mesh static geometry once with AO; animate only instanced matrices and a few group transforms per frame.

## 4. Failure modes

| Symptom | Cause and fix |
|---|---|
| World looks like flat stickers | no AO, or AO levels too subtle. Use `0.38 / 0.6 / 0.8 / 1.0` and keep sky hemisphere fill strong so AO, not shadow, carries the corners |
| Diagonal creases inside dark corners | quad diagonal not flipped by AO |
| Tile seams or colour bleed in the distance | atlas without padding; pad every tile 8 px with replicated edges |
| Shimmering far mountains | magnification nearest is right, minification must use mipmaps; fog the far ridge |
| Mountains fill the sky | camera pitched down too far or ridge too tall. Keep the camera nearly level and the ridge under ~12 blocks at 25+ blocks back |
| Title unreadable over trees | thick navy back plate (offset 0.45, scale 1.12), keep tree crowns and the ridge out of the title band, widen the title to ~74 percent of frame |
| Tiny birds read as dead pixels or lens dust | a dark 0.6 block box seen side on hides its wings. Scale up 2 to 3x, turn 3/4 to camera, light belly, flap in a plane the camera can see |
| Shadows contradict the sun | the visible sun must be on the key light side |
| Sun halo looks like pale rectangles | stacked translucent square planes; use one radial canvas with quantised rings, warm tint |
| Reads as the famous block game anyway | the composition gives it away (square sun, slab clouds, fringe grass, oak blobs, cobble props); swap all of them, see the originality table |
| Character looks like a famous block game hero | avoid a humanoid with a square head, skin and shirt colours; use a creature, single box body, painted belly and cheeks |
| Loop pops at 6 s | an ambient motion not periodic in 6 s, or particles still alive at 5.99 s |
| Pixels in stills differ between runs | any `Math.random` or time read inside render; use `hash` and `rng` from `scene.js` |

## 5. Reference searches (YouTube / Vimeo)

1. `voxel animation short film cinematic`
2. `MagicaVoxel animated diorama timelapse render`
3. `isometric voxel art animation loop`
4. `voxel ambient occlusion explained per vertex`
5. `blocky character animation squash and stretch 3d`
