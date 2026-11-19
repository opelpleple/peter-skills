# Film engine: how to write a scene

The film is one web page (`film/index.html`) drawn with Three.js. Canvas 2D paints the artwork (type, cards,
shadows), Three.js stages it in 3D, moves it and renders every frame with real motion blur by temporal
accumulation. A frame is a pure function of time, so frames can be rendered in any order, in parallel, and
twice with the same pixels.

All paths below are relative to the film folder (a copy of this kit).

```
film/index.html, film/main.js      page and director: scene list, camera path, optional CUT table, window.MV
film/engine/core.js                renderer, camera, accumulation motion blur, layer(). Rarely edited.
film/engine/theme.js               palette C, beat grid (BPM, BEAT, beat(), bar()), times T, type sizes TYPE, STATION map
film/engine/type.js                text: makeText, makeBlock, rasterText, measure, fitSize, metrics, loadFonts
film/engine/kit.js                 shapes, sprites, shadows, photo tiles, slabs, ribbons, SVG pieces (PIECES)
film/engine/moves.js               motion helpers: pop, streak, dropLines, wave, shine, drift, fadeIn/Out, M (library)
film/engine/brand.js               product layer: ui cards, placeIn, slot, fillSlot, cursor, blurText/blurIn,
                                   typeLine/typeOn, counter/count, glow, pill, frameTime, raise
film/scenes/sNN_name.js            one file per scene. This is where you work.
film/scenes/zz_ui.js               devOnly test scene for a captured ui component
film/fonts/                        Poppins + Libre Baskerville (OFL); film/assets/ui, film/assets/photos
ui/components.html, ui/tokens.css  your product UI rebuilt as HTML/CSS (source of film/assets/ui/*.png)
tools/bin/stills                   render stills and a labelled contact sheet (the command you use most)
tools/bin/check                    prove frames are a pure function of time (must print DETERMINISTIC)
tools/bin/film                     render the whole film and encode it (preview or full, --no-audio)
tools/render/render.mjs            the frame exact renderer behind all three (headless Chromium, parallel workers)
tools/render/encode.sh             encode an existing render (frames or chunks) with the sound track
tools/ui/capture.sh                capture ui components to transparent PNG + manifest.json
tools/audio/                       gen_music.py, analyze.py, envelope.py, splice.py, mix.py
tools/qa/                          contact_sheet.py, frame_stats.py, dash_check.py
tools/lib/motion.js                easing, tweens, tracks, stagger, seeded random, noise, colour mixing (imported as M)
```

## Coordinates

- A scene builds inside `root`, a group placed at the centre of its station. `(0, 0)` is the centre of the
  frame, x to the right, **y up**, units are design pixels of a 1920x1080 frame: the visible area is
  x -960..960, y -540..540, whatever the output size. z points toward the viewer; the camera is about 2015
  units away with a 30 degree lens, so z = 100 makes a thing about 5% larger and gives it parallax when the
  camera moves. Use z for depth on purpose (cards, tiles), keep text at z = 0 unless it should float.
- Draw order is `renderOrder`, set with `layer(obj, n)` from core.js (higher n is drawn later, on top). The
  depth buffer is not used. Suggested layers: 0 to 9 background shapes and glows, 10 to 19 objects and their
  shadows, 20 to 29 text, 30+ things that must cover text (the cursor at 40). Inside one layer,
  `userData.sub` orders the parts (`B.raise(obj, sub)`). Call `layer()` after every child is added; objects
  added later have renderOrder 0 and hide under the card.
- Every station is a colour field of `GX x GY` (2600 x 1500) units. Stay inside it: to follow a line or zoom,
  move YOUR content or use a small `cam()` offset, do not travel the camera out of the cell.

## The director (film/main.js)

- `SCENE_FILES` lists the scenes in story order. A missing file is skipped with a warning; a file that throws
  while building stops the page. A scene with `devOnly: true` is built only when asked for with `?only=id`,
  and the camera then parks on its station.
- `MOVES` is the camera path: `[start, duration, station, ease]`; duration 0 is a cut. Neighbouring stations
  touch, so a move sweeps a clean colour edge through the frame (the demo pans dark to light at 3.75).
- A scene's optional `cam(t)` returns `{ x, y, zoom, roll, tiltX, tiltY }`; the director adds it to the path.
- URL parameters: `?w=&h=` size, `?s=` sub frames (default auto), `?shutter=` (default 0.8), `?only=id,id`,
  `?conform=1`, `?t=` or `?f=` start of the preview player, `?audio=` sound track for the player.
- Preview in a normal browser: `node tools/render/server.mjs --port 8123`, then open
  `http://127.0.0.1:8123/film/?t=4`. Space plays (with `audio/mix.wav` if it exists, otherwise on the wall
  clock), arrows step frames, `[` `]` step half a second.

### Two clocks and the CUT table

Scenes are written against scene time (`theme.T`). If the music cannot be moved to where the scenes land,
conform the picture instead of rewriting scenes: `CUT` maps FILM time to SCENE time per scene id as break
points `[film, scene]`, straight lines between, slope 1 outside.

```js
const CUT = {
  card: [[4.0, 4.0], [5.0, 5.5]],     // between film 4.0 and 5.0 the card scene plays 1.5x, then runs 0.5 s ahead
  end:  [[7.0, 7.0], [7.5, 7.25]],    // a move played at half speed so a word stays readable
};
```

`?conform=1` plays the film clock (`tools/bin/film` always passes it; `tools/bin/stills --conform` and
`tools/bin/check --conform` too). Without it the page plays scene time, which is what scene authors look at.
Set `FILM_TOTAL` when the conform changes the length, and give `MOVES` in film time. With `CUT` empty
both clocks are the same. When planning a new film, prefer splicing the music on bar lines
(`tools/audio/splice.py`) so that scene time = film time and `CUT` stays empty; keep the CUT table for a film
whose scenes are already written.

## A scene file

```js
import * as THREE from 'three';
import { layer } from '../engine/core.js';
import { makeText } from '../engine/type.js';
import * as K from '../engine/kit.js';
import * as B from '../engine/brand.js';
import { M, fr, pop, streak, dropLines, drift } from '../engine/moves.js';
import { C, T, TYPE, BEAT } from '../engine/theme.js';

export default {
  id: 'card',               // short id, used by ?only= and by the CUT table
  station: 'light',         // key of STATION in theme.js
  t0: T.move, t1: T.end,    // visible only inside [t0, t1); T.move and T.end are the demo's keys: use yours
  async build({ root, assets }) {
    // create every object ONCE here: text, sprites (all canvas drawing happens here), shapes, ui cards
    return {
      update(t) { /* set position, scale, rotation, colour, opacity, visible from t alone */ },
      cam(t) { return { x: 0, y: 0, zoom: 1 }; },   // optional, added to the director's camera
    };
  },
};
```

Hard rules:

1. **`update(t)` must be pure.** The renderer calls it for ANY t in ANY order, 16 to 256 times per output
   frame (sub frames for motion blur; the count adapts to how far things move in that frame). No canvas
   drawing, no object creation, no stored state, no `Math.random`, no `Date`, no `performance.now`.
   Seeded randomness: `M.rand(i, seed)` gives a stable 0..1. `tools/bin/check` proves it.
2. Everything is created in `build()`. If a picture must change (a chip that flips), build each state as its
   own object and switch `visible` or scale between them. Things that change in steps (typed characters,
   counter digits, a blink) use `B.frameTime(t)` so they never smear across the shutter; `typeOn` and
   `count` already do.
3. Motion blur is automatic: move something fast and it streaks. Never fake blur with opacity trails. A thing
   that should not streak must not jump more than a few pixels per frame.
4. **Text never fades in.** It streaks in (`streak`, `dropLines`), blurs in word by word (`B.blurIn`), types
   (`B.typeOn`) or pops (`pop`). Objects pop: scale 0.2 to 1 in about 9 frames with one overshoot. Exits streak
   out or tint and fade into the field colour.
5. **Arrivals sit on the beat grid.** Times come from `T` and `BEAT` (120 BPM: a beat is 0.5 s = 15 frames).
   Land every arrival on a beat, a half beat (0.25 s) or a quarter beat (0.125 s): "lands at 5.0" means
   `t0 = 5.0 - fr(5)` for a five frame streak. Chapter changes sit on bars (2 s).
6. **Readable.** A line holds still at least 1.5 s. UI type reaches 18 px or more at its biggest on the 1080
   frame (design px). Headlines 76 to 170 px.
7. Colours only from `C`. Fonts only the loaded faces; the highlight face is written with asterisks:
   `'Make the frame *move*'` sets *move* in the serif italic, scaled to the main face's x height.
8. Copy is sentence case with typographic apostrophes, and no em or en dash characters anywhere (code,
   strings, comments). `python3 tools/qa/dash_check.py` finds them.

## type.js

`makeText(str, opts)` returns one line as `{ group, glyphs, width, size, cap, xh, str, left, texture, setColor,
setOpacity, reset }` (`str` is the text without asterisks, `left` the x of the first glyph's left edge after
alignment, `texture` the shared glyph atlas; `setColor(c, which)` takes `which` = 'all' | 'main' | 'hi').
- `opts`: `size` (font size, design px), `weight` (default 600; hero words 700), `color`, `hiColor`,
  `hiWeight` (default 500), `align` ('left' | 'center' | 'right': where x = 0 is), `tracking` (em),
  `os` (raster oversampling, default 2; use 4 or more for text that is scaled up on screen).
- y = 0 is the baseline. `cap` is the cap height in px (Poppins: about 0.70 of the size).
- `glyphs[i]`: `{ pivot, mesh, mat, ch, i, n, word, hi, x, cx, adv, home }`: `pivot` the group to move, scale
  or rotate (its origin is the centre of the letter); `mesh` the quad inside it; `mat` its material; `ch` the
  character; `i` its index and `n` the glyph count of the line; `word` the word index (spaces have no glyph);
  `hi` true for highlight face glyphs (the `*asterisk*` words); `x` the left edge of its advance; `cx` and
  `home` (`{x, y}`) its centre at rest; `adv` its advance width. Recolour with
  `mat.uniforms.color.value.set('#fff')`, fade with `mat.uniforms.opacity.value`. `reset()` puts all glyphs home.
- Moving only the highlight word: filter once in `build()`, then set positions from `home` in `update(t)`:
  ```js
  const hiGlyphs = line.glyphs.filter((g) => g.hi);                       // build()
  for (const g of hiGlyphs) g.pivot.position.set(g.home.x, g.home.y + lift(t), 0);   // update(t), lift pure in t
  ```
- When you park a glyph or a line off frame (instead of hiding it), park it far enough: more than half the
  frame width plus the line's own width from the centre of its station (more than 960 + width design px
  sideways at zoom 1). A small offset (700 px, say) leaves part of the line in the frame.
- `makeBlock([lines], opts)` stacks lines: `leading` (default 1.16), `valign` ('center' | 'top' |
  'baseline'). Returns `{ group, lines, width, height, pitch }`; `dropLines(block, t, t0)` animates them.
- `measure(str, opts)`, `fitSize(str, maxWidth, opts)`, `metrics({ family, weight, italic })`,
  `rasterText(str, opts)` (a whole string in one canvas, for textures and masks).
- Fonts: `loadFonts('./fonts/')` loads the faces listed in type.js and throws if one falls back to a system
  font. To swap fonts, put the TTF files (and their licence) in `film/fonts/`, edit the `faces` list and the
  probe strings in `loadFonts`, and change `SANS` / `SERIF`. Mirror them in `ui/tokens.css`.

## kit.js

- Flat shapes (geometry, sharp at any zoom): `rect(w, h, color, r)`, `diamond(side, color, r)`,
  `circle(radius, color)`, `rrOutline(w, h, r, stroke, color)`, `star(R, color)`, `arrow(L, color)`,
  `check(size, color, th)`. Colour: `mesh.material.color.set(...)`, fade: `mesh.material.opacity`.
- `polyline(points, width, color)` returns `{ mesh, length, setProgress(a, b), pointAt(p) }`: a thick line
  that can draw itself; `pointAt` gives the tip to follow.
- `sprite(w, h, draw(ctx, w, h), { os })`: a plane painted with Canvas 2D (origin top left, y down, units =
  design px). Uniforms: `material.uniforms.opacity`, `.tint` (colour), `.tintAmt` (0..1).
- `shadow(w, h, r, { blur, alpha, color })`: soft shadow sprite for a card; put it under the card, a bit lower.
- `photoTile(image, w, h, { radius, focus })`: rounded picture tile; get the image with
  `await assets.photo('name.jpg')` (files in `film/assets/photos`; a drawn placeholder stands in until it exists).
- `slab(w, h, depth, r, faceColor, sideColor)`: a real 3D rounded box (phone body, thick card).
- `svgPieces(url, height, groups)`: an SVG (a logo) rasterised so each piece is its own plane and all pieces
  line up exactly at rest. `groups` picks the pieces: `K.PIECES.children`, `K.PIECES.whole`,
  `K.PIECES.select('#mark > path')` or your own `(doc) => [[el, el], [el]]`. Use `assets.svg(url, height, groups)`.
  Transforms on a parent `<g>` are not carried into its children: flatten the file first if it relies on them.

## moves.js

`fr(n)`, `prog(t, t0, dur, ease)`, `pop(t, t0, { dur, over, from })`, `popOut`, `popInOut`,
`streak(obj, t, [x, y], { t0, from: [dx, dy], dur, ease }, { t1, to: [dx, dy], dur, ease })`,
`dropLines(block, t, t0, { each, fall, bottomUp })`, `wave(line, t, t0)`, `shine(line, t, t0, base, hot)`,
`drift(t, seed, amp)`, `fadeIn`, `fadeOut`, and `M` = the whole library in `tools/lib/motion.js`
(`M.outQuint`, `M.outBackS(1.7)`, `M.inOutCubic`, `M.segment`, `M.track([[t, v, ease], ...])`, `M.stagger`,
`M.rand`, `M.mixColor(a, b, k)`).

## brand.js

```js
import * as B from '../engine/brand.js';
```

**UI cards.** Rebuild the product screens you need as your own HTML and CSS in `ui/components.html`, using
your design tokens in `ui/tokens.css` (keep them equal to `theme.C`). Never paste screenshots of a live site:
they carry someone else's data, look soft when scaled and cannot be animated. Use a made up demo company and
placeholder data (placeholder names for regulators, partners, people), and leave every number that animates
as an empty `data-slot` the film fills. Never animate a score or rating up as if it could be bought.

Each `[data-name]` element is one component; `[data-anchor]` elements inside it become named points
(`data-slot` also records the slot's font), `data-pad` sets the transparent capture margin for its shadow.
`tools/ui/capture.sh` screenshots each component alone at 3x with a transparent background to
`film/assets/ui/<name>.png`, writes `film/assets/ui/manifest.json` (CSS size, pad, anchors) and, with Pillow,
`work/qa/ui-gallery.jpg`. Re-run it after editing the HTML (or `tools/ui/capture.sh <name>` for one).

- `await B.uiCard(name, { scale = 1, shadow })` (same as `assets.ui(name, opts)`) returns
  `{ group, mesh, w, h, a(anchor), pt(x, y), clip(...), reveal(f0, f1), setOpacity(a), anchors }`.
  Origin = centre of the component's own box, 1 CSS px = `scale` design px. `card.a('button')` is
  `{ x, y, w, h }` (centre, group space, y up). `card.pt(x, y)` converts component CSS px (top left, y down).
  `card.reveal(0, k)` wipes it in left to right, `card.clip(x0, y0, x1, y1)` shows a rectangle only.
- `B.placeIn(parent, child, anchorOrXY, { align: 'tl' | 'center', z })` nests a card in another at an anchor
  (an empty anchor made for it) and raises the child's draw order.
- `B.slot(card, name)` gives `{ x, y (baseline), size, weight, color, w }` of an empty text slot;
  `B.fillSlot(card, name, obj)` puts a counter or typeLine there. **Call `layer(card.group, n)` after all
  nesting and filling.** See `film/scenes/zz_ui.js`.

**Cursor.** `const cur = await B.cursor({ scale, ring })` (origin = arrow tip; drawn as vectors, or
`{ ui: 'my-cursor' }` for a captured arrow whose anchor `tip` is the arrow path). In update:
`cur.update(t, { path: [[4.25, 620, -380], [5.5, x, y, M.inOutCubic]], clicks: [6.0], show: 4.25, hide: 7.4 })`.
Path keys `[time, x, y, ease?]`, slight arc between keys; a click presses the arrow and sends a ring. To aim at
a button on a tilted card, compute its position once in build: `root.updateMatrixWorld(true)`, then
`card.group.localToWorld(v)` and `root.worldToLocal(v)`.

**Words.** `const h = B.blurText('Make the frame *move*', { size, weight, color, hiColor, align })` builds the
glyph line plus 3 blurred copies per word; `B.blurIn(h, t, t0, { perWord = fr(4), dur = fr(12), scale = 0.14, out })`
brings the words in one by one from blurred and 14% larger (returns the time the last word is sharp).

**Typing.** `const q = B.typeLine('render.mjs --all', { size, color, caretColor })`;
`B.typeOn(q, t, t0, cps, { caretFrom, caretUntil })` (characters appear on whole frames; the caret is solid
while typing and blinks on the beat when idle).

**Counters.** `const n = B.counter({ size, weight, color, align, sample: '00,000', format })`;
`B.count(n, t, t0, dur, from, to)` (one value per output frame; the canvas redraws only when the string
changes). Formats `B.fmtInt` (default, `12,480`), `B.fmtPct(1)`. `n.set('8.4%')` for a fixed value.

**Glow.** `B.glow(r, colour, { blend: 'add' | 'normal', opacity, squash })`: gaussian lens; `add` on a dark
field, `normal` (a haze) on a light page. Uniforms `opacity`, `color`.

**Pill.** `B.pill('render.mjs --all', { variant: 'dark' | 'light', size })` returns
`{ group, bg, outline, text, w, h }`: `outline.setProgress(0, k)` draws the rim, `B.typeOn(p.text, t, t0, cps)`
types the label.

`B.frameTime(t)` snaps a time to its output frame. `B.raise(obj, sub)` sets the draw order inside a layer.

## Looking at your work

```
tools/bin/stills <name> <times> [only] [--full] [--cols N] [--crop W:H:X:Y] [--conform]
tools/bin/stills card 3.75:8:0.25 card                       # contact sheet work/qa/card.jpg, 960x540 frames
tools/bin/stills card-detail 5.9,6.1 card --full --crop 900:600:500:240
```

Then open the sheet image (`work/qa/<name>.jpg`) and look at it. Use your own `<name>` so you do not
overwrite another agent's sheet. The command prints page errors (a scene that throws stops the page: fix it
first). Stills take about a second; the command waits its turn if another render holds the project lock.

Look at many frames, not one: every 2 frames (`a:b:0.0667`) through an entrance, every 0.25 s through a hold.
Check: nothing clipped unless intended, no text over objects, text large and readable, something alive in
every second, arrivals on the beat, every pop has its overshoot, no fade where a streak should be.

## Proving a scene is pure

```
tools/bin/check 0.6,3.9,6.1          # whole film
tools/bin/check 4.5,6.0 card         # one scene; must end with DETERMINISTIC
```

It renders each frame twice in one browser with another frame in between, and once in a second browser, and
compares the pixels. A NOT OK means state carried between frames, unseeded randomness, a clock read, async
loading in update, or a blank frame. Run it before you report a scene as done.

## Render contract and the film

`render.mjs` serves the folder over http, opens `film/index.html?render=1&w=&h=` in headless Chromium, waits
for `window.MV.ready`, then calls `MV.renderFrame(f)` for each frame and reads the canvas. Modes: `--info`,
`--check`, `--times`/`--frames` (stills), `--from-t/--to-t` (range), `--all` (lossless chunks). Resume is
automatic. On macOS it uses the Metal GPU and verifies it at start; elsewhere SwiftShader (`--gpu`, or env
`RENDER_GPU`). Pages are offline by construction: any request to another host fails.

```
tools/bin/film preview [name] [--no-audio]   # 960x540, work/cuts/<name>_preview.mp4 + work/qa/preview_sheet_*.jpg
tools/bin/film full [name] [--no-audio]      # 1920x1080, deliver/<name>.mp4 + deliver/<name>_720p.mp4
```

Encode settings (also in `tools/render/encode.sh` for a render already on disk): H.264 High **level 4.1**
(5.0 is refused by some phones and chat apps for 1080p30), `aq-mode=3` (keeps flat gradients and soft shadows
from banding), full range RGB converted to BT.709 limited range with accurate rounding and tagged as such,
constant 30 fps, `+faststart`. A 720p copy (about 25 MB or less for chat apps; raise its crf if larger).

### Rendering safely

A full render runs several browsers plus encoders. Run heavy jobs one at a time. `tools/bin/film` runs
commands directly; if your machine has a wrapper that serialises heavy jobs, set `HEAVY=/path/to/wrapper`
(called as `"$HEAVY" <label> -- <command ...>`). `WORKERS` sets the number of browsers (default 3 preview, 4
full; render.mjs caps it at 6). On macOS render.mjs pauses when free memory drops below 20% and stops below 12%.
`tools/bin/stills` and `tools/bin/check` share a project lock in `work/locks`, so several agents can use them.

## Sound

1. **Generate** (optional): `tools/audio/gen_music.py audio/takes/take1.mp3` with the ElevenLabs Music API
   (key in env `ELEVENLABS_API_KEY` or `--key-file`). Measured: `music_v2_5` ignores the chunk lengths you ask
   for and phrases every 8 bars (16 s at 120 BPM in one film, 8 s phrases in another). Expect the music not to
   land where the plan said.
2. **Measure**: `uv run --with librosa --with numpy --with soundfile python tools/audio/analyze.py audio/takes/take1.mp3 --marks 4.0,8.0`
   prints the fitted BPM, the phase of the 0.5 s grid (where the first beat is) and onset strength at your
   chapter times. `envelope.py` prints a fine envelope for chosen windows.
3. **Fit picture and music**, one of:
   - splice the take on bar lines so each chapter starts on a downbeat of a section that fits it:
     `uv run tools/audio/splice.py audio/takes/take1.mp3 audio/music.wav --phase 0.048 --seg 2:4,4:6 --dur 8.0`
     (two 2 bar segments of 2 s bars = 8 s; the segments should add up to `--dur`, or the tail is cut off)
     (simplest when planning fresh; scene time stays film time);
   - or keep the take and conform the picture with the CUT table in `film/main.js`.
4. **Mix and master**: `uv run tools/audio/mix.py --music audio/music.wav --dur 8.0 [--offset 0.043]` writes
   `audio/mix.wav` with the transition sounds of `audio/cues.json`. Rules learned the hard way:
   - Master with measure, ONE constant volume, `alimiter=limit=0.79:attack=1:release=60:level=disabled`, then
     one trim pass to -14 LUFS. Never finish with ffmpeg `loudnorm`: when the linear gain it needs would push
     the true peak over its target it silently falls back to dynamic mode and rides the level.
   - `--offset` removes the head of the take so its beats sit on the film's grid. MP3 and AAC carry a few
     tens of ms of encoder priming at the head; measure, do not assume zero.
   - Whooshes under a full music bed get masked: raise them a few dB from mix.py's -17 dB default until you
     hear them on laptop speakers, instead of making them brighter. Measured in the two worked examples:
     -17 to -12 dB in the brand film, -20 and -18 dB in the product commercial (a busier bed is not always
     louder; check by ear). Keep every sound soft: no piercing highs (the synthesised air stops near 2.6 kHz).
5. **Check sync** in the encoded file, not in the WAV: the AAC encoder adds priming too. Step through the
   preview at a few hits (a click ring, a cut) and compare with the waveform.

## Building a film with many agents

- One agent per scene file, owning only that file (plus its own notes). Engine, theme and main.js have one
  owner. Agents share the stills lock, so they can all render.
- A critic per scene looks at the contact sheets against the storyboard and the hard rules, and lists fixes;
  the scene agent applies them.
- Then one film wide QA with five lenses, each finding verified by a skeptic before anyone acts on it:
  viewer (is it clear and readable at speed), seams (the hand off between scenes, camera moves, colour edges),
  audio sync (hits on picture, CUT table, priming offset), brand (palette, type, copy rules, no dashes), tech
  (determinism, encode settings, level 4.1, file sizes).
- If a workflow tool caches agent results by prompt prefix, editing one prompt reruns every later call: skip
  agents whose scene is finished in code instead of editing prompts in the middle of the run.
