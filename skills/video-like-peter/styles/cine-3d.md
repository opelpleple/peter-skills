# Style recipe: Cine 3D (cinematic 3D)

The look of a live action feature: a dark, hazy room cut by warm volumetric light, physically based materials,
ACES tone mapping, a shallow depth of field that racks focus between planes, oval anamorphic bokeh and thin blue
streak flares, a 2.39:1 letterbox inside the 16:9 frame, 24 fps cadence with per-frame film grain and gate weave,
a slow dolly, and the title set as a quiet serif movie title card. Label it "Cine 3D". Never name a film, studio,
camera brand or cinematographer.

Reference build: `https://peterbu.com/showcase/skills/video-like-peter/styles/cine-3d/`
(`index.html`, `cine.js`, `cine.css`, `poster.png`). It runs the shared engine (`styles/_engine/stage.js` +
`scene.js`) with `context: 'none'`, `fps: 24` and three.js r170 from `_engine/three.module.min.js`. Everything is
original: a small orange ceramic hero with a two leaf sprout, an empty hall with one tall arched window (its round
head visible in frame, the whole window inside the 2.39 picture at about 0.08 to 0.25 of the width), a dark verde
marble plinth with a polished brass band, a string of 11 practical bulbs right of the plinth, a red velvet curtain
edge in the foreground.

## 1. What defines the style

| Trait | Rule |
|---|---|
| Read at first glance | black bars top and bottom (2.39:1), a blown out window with light beams slanting through haze, a pool of window light on the floor, the hero sharp while the background melts into oval bokeh, a thin blue horizontal flare across a highlight, fine moving grain, a serif title with wide tracking |
| Palette | shadows teal `#0d1b1f`, fog `#0e1a1e`, wall plaster `#24343a`, stone `#2b2f30`, floor concrete `#3f4747`, marble `#2e4a3d`, brass `#c49a5c`, key light (low sun) `#ffbe7a`, beam colour RGB (1.0, 0.66, 0.36), ambient haze RGB (0.05, 0.15, 0.22), cool fill `#5d8fa8`, warm bounce card `#ffd6b0`, practical bulbs `#ffb067` (sprite colour RGB 1.0, 0.62, 0.30 x 24), hero `#e27a26` (orange, not tomato red: keep the halation tint low in red) with sheen `#ffb38a`, sprout `#6f9440`, velvet `#7a1a28` sheen `#f08a8a`, title ivory `#f1e3c8`, credit line `#d6c4a6`, letterbox `#000000`. Grade pushes everything toward teal and orange (section 2.6). Targets on the active picture: mean luminance about 60/255, about half the pixels below 45/255, and those dark pixels read teal (about RGB 23, 37, 42), never olive |
| Shape language | real objects at real scale, rounded where hands touch (bevelled plinth slab, 64 x 48 segment sphere). Nothing flat shaded, nothing outlined. One hero, one plinth, one source of light, a lot of empty dark space |
| Line | none. Edges come from light: rim from the backlight, shadow edges from the window mullions |
| Texture | plaster, concrete with slab joints and roughness blotches (canvas roughness map), clearcoat on ceramic and marble, sheen on velvet and leaves. Haze density from a tileable 2 channel value noise texture |
| Lighting | motivated, single source. A spot far behind the window wall projects the window itself (spot `map` = gobo canvas) so the floor pool shows the panes; the wall does not cast shadows so the light passes it; the hero and plinth cast PCF soft shadows. Cool hemisphere + teal fill from front right, a warm "bounce card" directional from camera left for the face, a warm floor bounce as a directional aimed straight up (from `(0, -6, 1.2)` at the origin, 0.9) so it lights only down or lens facing surfaces (the hero's belly) and can never paint the floor. A short range warm point light `(-1.2, 6.4, 9.6)`, 120, range 9, rakes across the foreground velvet so its folds show red sheen. A low spot from behind the plinth `(2.6, top + 0.75, -7)` skims the slab top at the camera's own elevation: the clearcoat mirrors it into a bright edge line and it rims the hero. Practical bulbs are motivated background lights |
| Frame rate | 24 fps stepping (`fps: 24`). Grain, gate weave and the haze march jitter change once per film frame (`frame = round(t * 24)`) |
| Timing and easing | camera and focus use `inOutSine` / `inOutCubic`, never bounce or back. Rack focus: far plane until 0.55 s, rack to the hero over 0.55 to 1.3 s (it lands at 1.2 s), hold, rack back to the window over 5.3 to 5.95 s (late, so the exiting hero does not balloon into a big soft disc). Title letters fade and un-blur from the centre outwards (`letterReveal` on a centre-out rank, `spread 0.55`, `b 3.0`, `inOutSine`, blur 9 px to 0, a 6 percent rise), credit line fades in 2.55 to 3.25 s, a hairline rule grows from the centre 2.35 to 3.4 s (`outCubic`), tracking breathes out from 0.34 to 0.50 em across the whole life of the card, the card fades and re-blurs 5.0 to 5.6 s |
| Camera | fixed long lens (vertical fov 2 atan(4.5 / 20.5), about 24.8 degrees). Slow periodic dolly so the loop closes: `push = 0.5 - 0.5 cos(2 pi t / 6)`, `z = 20.5 - 1.1 push`, `x = 0.55 sin(2 pi t / 6)`, `y = 3.0 - 0.15 push`, target x `0.32 sin`, a 0.004 rad roll wobble at twice the loop rate. A small extra push rides the rack: with `k` the rack amount (0 far, 1 on the hero), `z -= 0.9 k`, `y -= 0.12 k`, so the rack lands a touch tighter. Composition uses depth layers: foreground curtain (z +9, 4.6 wide, right edge near x -3.4 so a red band stays in frame through the dolly), hero and plinth (z 0), bulbs (x 3.6 to 10.6, y about 3.15 with a 0.45 sag, z -11 to -12.4: they sit at 0.42 to 0.48 of the frame height, right of the plinth, below the title rule and inside the right edge), window wall (z -14) |

## 2. Technique

Three.js, built once in `setup(ctx)`, posed in `render(t, ctx)` from `t` alone. All frames go through HalfFloat
render targets, the last pass encodes ACES + sRGB itself:

```js
renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // final shader does sRGB
renderer.toneMapping = THREE.NoToneMapping;             // final shader does ACES
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// internal resolution: supersample small canvases, cap big ones
const iw = Math.min(1920, Math.round(ctx.pw * 1.5)), ih = Math.round(iw * ctx.ph / ctx.pw);
// 24 fps: the stage already quantises t, so skip identical frames (preserveDrawingBuffer: true)
if (D.lastT === t) return; D.lastT = t;
```

Pass order per frame: scene (with `DepthTexture`) -> volumetric beams (half res) -> beam blur -> DOF prefilter
(half res, colour + CoC) -> bokeh gather (half res) -> DOF composite (full) -> dust, puffs and bulbs as point
sprites -> bright pass and blur pyramid (1/4, 1/8, 1/16) -> anamorphic streak (1/4) -> title canvas -> final.
At 1280 x 720 the whole chain costs about 3 ms per frame on an M-series laptop GPU.

### 2.1 The window light is one projected texture used three times

A gobo canvas (arched window 0.50 x 0.84 of the texture, 4 x 6 panes, mullions 3.4 percent, panes 0.78 to 1.0 grey) is
the spot `map`. A `PerspectiveCamera` with the same fov as the spot shadow camera gives `uLightVP`, and the
same projection is sampled in the wall material (emissive window), the haze march and the dust motes, so the
window, the beams and the floor pool always line up.

```js
// window centre on the wall (-9.0, 4.9, -14); the spot half angle sets the window size on the wall
const spot = new THREE.SpotLight('#ffbe7a', 30, 0, 0.066, 0, 0); // decay 0: a sun, not a bulb
spot.position.copy(winC).addScaledVector(dir, -40); spot.map = gobo; spot.castShadow = true;
const lcam = new THREE.PerspectiveCamera(0.066 * 2 * 180 / Math.PI, 1, 30, 90);
lcam.position.copy(spot.position); lcam.lookAt(target); lcam.updateMatrixWorld();
D.lightVP = new THREE.Matrix4().multiplyMatrices(lcam.projectionMatrix, lcam.matrixWorldInverse);
// wall: MeshStandardMaterial.onBeforeCompile adds
//   totalEmissiveRadiance += vec3(1.0,0.70,0.42) * textureLod(tGobo, luv, 0.0).r * 9.0;
```

Use `textureLod(..., 0.0)` and no mipmaps on the gobo: sampling it inside branches with `texture()` produced
bright dashed lines on GPU (Metal) that the software rasteriser never shows.

### 2.2 Volumetric beams: ray march with analytic occluders

Full screen pass at half resolution. Rebuild the world position from the depth texture, march 30 steps from
the camera to the surface with a per-film-frame jitter, accumulate haze density, and add key light where the
gobo is lit and the path to the light is not blocked by the hero (sphere) or the plinth (box):

```glsl
vec4 v = uInvProj * vec4(vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0); v /= v.w;
vec3 wp = (uCamWorld * v).xyz;                       // march uCamPos -> wp
float dens = (0.16 + 0.85 * smoothstep(0.05, 0.75, n1 * n2 * 1.6)) * exp(-p.y * 0.06); // low contrast: no banding
dens *= smoothstep(5.0, 16.0, distanceFromCamera); // no haze in front of the lens: clean blacks, no milky veil
vec4 lc = uLightVP * vec4(p, 1.0); vec2 luv = lc.xy / lc.w * 0.5 + 0.5;
float g = textureLod(tGobo, luv, 0.0).r;
if (hitSphere(p, normalize(uLightPos - p), uHero) || hitBox(p, normalize(uLightPos - p))) continue;
lit += g * dens * dt;  amb += dens * dt;
gl_FragColor = vec4(uKey * lit + uAmb * amb, 1.0);  // uKey ~0.1 x beam colour, uAmb ~0.0006 x teal
```

Blur the result once (separable 5 tap) to remove the dither, then add it to the scene in the DOF passes so the
beams go soft with the focus. The hero's shadow cutting through the beams comes free from `hitSphere`.

### 2.3 Thin lens depth of field with a rack focus

CoC in half res pixels: `coc = clamp(K * |1/F - 1/z|, 0, maxR)` with `K = 0.85 * halfH`, `maxR = 0.036 * halfH`,
`z` linear view depth, `F` the focus distance from `focusAt(t)` (31 units for the window plane, the hero's view
depth when racked in). Gather: one pass, 56 samples on a golden angle spiral, radius `maxR * sqrt(i / N)`,
**oval aperture** (`x *= 0.62`, taller than wide = anamorphic), **spiral rotated per pixel** by a hash (a fixed
spiral prints a dotted pattern into small dark details), background samples clamped to the centre CoC so sharp
edges do not bleed, foreground samples allowed to bleed (stored as alpha and used in the composite):

```glsl
vec2 tc = vUv + vec2(cos(a) * 0.62, sin(a)) * r * uTexel;
if (zs > zc) sz = min(sz, cc * 2.0);          // behind: cannot spill over a sharper centre
float m = smoothstep(r - 0.6, r + 0.6, sz);
if (zs < zc) fg = max(fg, m * sz);             // in front: remember the bleed
acc += mix(acc / tot, s.rgb, m); tot += 1.0;
// composite: mix(sharp, bokeh, smoothstep(0.3, 1.3, max(cocFull, fg)))
```

In the prefilter clamp each pixel to 3.5 (`c *= min(1, 3.5 / max(c))`) so specular sparkles do not turn into
spiky discs.

### 2.4 Small bright things are scattered, not gathered

Practical bulbs, dust motes and landing puffs are `THREE.Points` drawn after the DOF composite. Each sprite
computes its own CoC in the vertex shader, grows to it and divides its energy by the area, and the fragment draws
an oval disc with a slightly brighter rim. Depth is tested by hand against the scene depth texture. Motes and
puffs read the gobo, so they sparkle only inside the beams.

```glsl
float coc = clamp(uK * abs(1.0 / uFocus - 1.0 / z), 0.0, uMaxR) * 2.0;  // full res px
vSize = max(base, coc * 2.0);  vA = energy * pow(base / vSize, 1.75);   // bulbs 1.75, dust 2.0
// frag: q = gl_PointCoord * 2.0 - 1.0; q.x /= 0.62; edge = smoothstep(1.0, 0.8, r2) * (0.78 + 0.32 * r2);
```

### 2.5 Bloom, halation, anamorphic streak

Bright pass (threshold 1.4) at 1/4 res, blur pyramid 1/4, 1/8, 1/16 added at 0.10, 0.16, 0.22. Halation: the
1/4 level again tinted RGB (0.55, 0.22, 0.06) x 0.42, a warm fringe hugging highlights (a redder or stronger tint
turns the orange hero tomato red). Streak: a second bright
pass (threshold 2.2) then three 13 tap horizontal-only blurs with steps 1.5, 5 and 15 texels, tinted
RGB (0.30, 0.55, 1.0) x 0.9.

### 2.6 Final pass (display space)

```glsl
if (uv.y < uBar || uv.y > 1.0 - uBar) black;        // uBar = (1 - (16/9) / 2.39) / 2 = 0.128
suv = uv + weave(frame) * vec2(0.0007, 0.0011);     // gate weave
chromatic aberration 0.0022 * r^2 * 4 on R and B; + bloom + halation + streak
col *= 1.3;  col = ACESfitted(col);                 // Hill's RRT + ODT fit with the in/out matrices
shadows: mix(col, col * vec3(0.62, 0.98, 1.18) + vec3(0, 0.010, 0.016), (1 - smoothstep(0, 0.5, l)) * 0.9)
highlights: mix(col, col * vec3(1.08, 1.0, 0.86), smoothstep(0.35, 1.0, l) * 0.6)
saturation 1.05, gentle S curve (35 percent smoothstep), col * 0.975 + print black lift (0.004, 0.011, 0.014), sRGB encode
title card over (premultiplied canvas texture), oval vignette to 0.62, grain:
g = hash(px + frame) + hash(px * 1.37 + frame) - 1;  col += g * (0.03 + 0.04 * midtone)
```

### 2.7 Title card

A 2048 px wide canvas covering the band 0.135 to 0.385 of the frame height, redrawn once per film frame, uploaded
with `premultiplyAlpha = true`, composited in display space before grain (so the type gets grain like a real
optical title). Font stack `"Didot", "Bodoni 72", "Hoefler Text", "Baskerville", Georgia, serif`, weight 400,
uppercase, size 7.8 percent of frame height, tracking 0.34 to 0.50 em, faint warm glow (`shadowBlur` 14 to 30,
`rgba(255,190,120,0.32)`), soft focus in per letter with `ctx.filter = blur(px)`. Above it a tiny tracked credit
line, below it a hairline rule that fades at both ends. Keep the card above the hero's highest point and inside
the letterbox, and keep the hairline rule clear of the bulb string (the bulbs sit at 0.42 to 0.48 of the frame
height, the rule at about 0.32).

## 3. Applying it to any storyboard

1. Find the one motivated light source of each scene (window, doorway, headlights, a lamp) and turn it into the
   gobo spot. Everything else is fill at a quarter of its strength or less.
2. Stage in depth: something dark and soft in the foreground, the subject in the middle, small bright practicals
   far behind. Without far practicals the DOF has nothing to show.
3. Write the focus plan with the story beats: the plane that matters is sharp. Rack on a motivated beat (a
   landing, a look, an entrance) over 0.6 to 0.9 s with `inOutCubic`; never rack during a title reveal.
4. Move the camera slowly and continuously (a dolly or truck of 5 to 10 percent of the frame per shot). For loops,
   make every camera channel a sine of the loop period.
5. Set titles as cards: centred, thin serif, wide tracking, slow fades, no bounce, no 3D extrusion.
6. Grade last: teal shadows, warm highlights, black slightly lifted, then grain. Check that skin or hero colour
   stays warm and readable against the teal.

## 4. Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| The whole frame is milky beige | ambient haze and fog too strong, the march accumulates over 60 units | ambient haze 10 to 20 times weaker than the beam term, `FogExp2` density under 0.01, let the beams carry the haze |
| Beams read as horizontal bands, not shafts | light travels toward the camera | put the source high and to the side so the beam direction has a large screen-space component; the window here sits at x -9.0, y 4.9 on the back wall aiming at the plinth |
| Bright dashed lines on the wall, only in real GPUs | `texture()` on the gobo inside a branch, mip selection breaks at quad edges | `textureLod(..., 0.0)`, gobo without mipmaps |
| Bokeh of small lights is star shaped or spiky | too few gather samples hitting a 2 px source | scatter small lights as sprites (2.4); clamp highlights in the prefilter |
| Dotted pattern in defocused eyes or text | fixed sample spiral | rotate the spiral per pixel with a hash |
| Haze looks dithered when the background is in focus | per-frame march jitter shows when composited sharp | blur the beam buffer once before compositing |
| Title glows into a white blob | canvas texture uploaded as straight alpha but composited as premultiplied | `tex.premultiplyAlpha = true`, keep the glow alpha near 0.3 |
| Title upside down | `CanvasTexture.flipY` already flips, the shader flipped again | sample with plain `uv` |
| Captures differ from playback | grain or jitter seeded from a counter or the clock | seed from `round(t * 24)` only |
| Hero face black in the backlight | key is behind the subject | warm bounce card from camera left at about 1.0, and a warm floor bounce for the belly |
| A bright candle-like slit on the floor in front of the plinth in every frame, even with no hero | the floor bounce was a static point light near the floor | make the under light follow the subject, or (as here) use a directional aimed straight up, which cannot light up-facing surfaces |
| The window reads as a plain rectangle jammed into the corner | the arch head sits above the top letterbox bar, the window is cropped by the frame edge | size the window with the spot angle and place it so the whole window, arch included, is inside the 2.39 picture (about 0.08 to 0.25 of the width) at every camera position |
| Frame reads olive, sepia and milky, no real shadow | haze accumulates in front of the camera, wall too light, shadow grade too weak | fade the haze in from 5 to 16 units off the lens, darken the plaster, shadow tint (0.62, 0.98, 1.18); check the dark pixel average is teal |
| Big diagonal dark streaks on the wall behind the title | high contrast haze noise (`n1 * n2` with a large gain) | low contrast density through a smoothstep, as in 2.2 |
| Foreground curtain is a near black band | dark velvet in the vignette, shadow grade cuts red | lighter velvet, a short range warm rake across the folds, wide enough to stay in frame through the dolly |
| Plinth is a muddy dark block | no light grazes the slab, brass sees nothing to reflect | a low kicker from behind at the camera's elevation for a clearcoat line, a warm card behind the lens in the environment for a brass glint |
| Bulb bokeh discs crowd the title | bulb string too high and running off the frame edge | keep the string below the rule and ending before 0.95 of the width |

## 5. Reference search queries (YouTube / Vimeo)

1. `cinematic volumetric light shafts dusty room golden hour B roll`
2. `anamorphic lens test oval bokeh blue streak flare night`
3. `rack focus shot examples film grammar foreground background`
4. `elegant serif movie title card sequence minimal opening credits`
5. `teal and orange color grading film look tutorial ACES`
