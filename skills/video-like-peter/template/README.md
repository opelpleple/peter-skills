# threejs-kinetic: starter kit for a code rendered kinetic film

A runnable, brand neutral film folder: Three.js engine with real motion blur by temporal accumulation (16 to 256
sub frames per frame, adaptive), glyph level typography, word by word blur ins, product UI cards captured from
your own HTML, a cursor with click rings, counters, a camera that travels a world of colour fields, a frame
exact renderer, and the audio and encode tools to deliver. The demo film is 8 seconds: a headline on a dark
field, a pan to a light field, a card with a counter and a click.

## Start a new film

```bash
cp -R <skill>/examples/threejs-kinetic ~/films/my-film     # any folder; quote paths with spaces
cd ~/films/my-film
./setup.sh                      # three 0.180.0 ships vendored; installs playwright-core 1.64.1 into tools/vendor (npm, once)
# or reuse another film's vendor folder:  ./setup.sh /path/to/other-film/tools/vendor   (LINK=1 to symlink)
tools/bin/stills first 0:7.5:0.5             # contact sheet of the demo: open work/qa/first.jpg and look at it
tools/bin/check 0.6,3.9,6.1                  # must print DETERMINISTIC
tools/bin/film preview demo --no-audio       # work/cuts/demo_preview.mp4
```

Requirements: node 18+ and npm, ffmpeg with drawtext on PATH, python3; `uv` for the audio scripts (they declare
numpy inline). setup.sh also checks that Playwright's chromium-headless-shell is in the browser cache and
installs it once if not (about 100 MB). The renderer uses the Metal GPU on macOS and SwiftShader elsewhere.

## Then

1. **Plan**: write a storyboard (scene by scene, second by second, every arrival on the 0.125 s grid of 120 BPM).
2. **Theme**: `film/engine/theme.js` holds the palette `C`, chapter times `T`, type sizes and the `STATION`
   map. Put your brand colours there and the same values in `ui/tokens.css`. Fonts: see docs/engine.md, type.js.
3. **UI** (if the film shows a product): rebuild the screens as HTML/CSS in `ui/components.html` with a demo
   company and empty slots for animated numbers, then `tools/ui/capture.sh`. Never paste screenshots of a live site.
4. **Scenes**: delete or replace `film/scenes/s01_headline.js` and `s02_card.js` and work through the new film
   checklist below. Read `docs/engine.md` first: `update(t)` must be pure.
5. **Look**: `tools/bin/stills <name> <times> <scene>`, open the sheet; `tools/bin/check <times> <scene>`.
6. **Sound**: generate or bring a take, measure it, splice it on bar lines (or conform the picture with the
   CUT table), mix and master to -14 LUFS: docs/engine.md, "Sound".
7. **Deliver**: `tools/bin/film full <name>` gives `deliver/<name>.mp4` (H.264 High 4.1) and a 720p copy.

## New film checklist

When the demo scenes go, these must change with them (the demo's own keys stop existing once you rewrite `T`):

- `film/engine/theme.js` `T`: your chapter times, and `total` = the film length in seconds (it sets the
  frame count; stills and renders stop at `total - 1/30`). Rename or drop the demo keys `intro`, `move`,
  `card`, `end`; every scene and `MOVES` that used them must use yours.
- `film/main.js` `SCENE_FILES`: your scene files in order (keep `zz_ui` only if you want its devOnly test).
- `film/main.js` `START`: the station the camera starts on. `MOVES`: one `[t0, dur, station, ease]` per camera
  move; `[]` for a film that stays on one station. Stations no scene uses (the demo's `light`) are harmless.
- `STATION` in theme.js: add, move or recolour stations for your world.
- Then `tools/bin/stills` over the whole length (`0:<total - 0.5>:0.5`) and `tools/bin/check` on a few times.

## Layout

```
setup.sh                 completes tools/vendor (three ships, build files only; playwright-core about 13 MB is installed)
film/index.html          the page (importmap points three at tools/vendor)
film/main.js             director: scene list, camera path, CUT table (empty), window.MV contract
film/engine/             core, type, kit, moves, theme, brand
film/scenes/             s01_headline.js, s02_card.js (demo), zz_ui.js (devOnly test of a captured component)
film/fonts/              Poppins and Libre Baskerville, SIL Open Font License (see the OFL files)
film/assets/ui/          captured components + manifest.json (empty until tools/ui/capture.sh runs)
ui/                      components.html + tokens.css: one neutral example component (card-demo)
tools/bin/               stills, check, film
tools/render/            render.mjs, server.mjs, encode.sh, player.js
tools/ui/                capture.sh, anchors.cjs, manifest.py
tools/audio/             gen_music.py, analyze.py, envelope.py, splice.py, mix.py
tools/qa/                contact_sheet.py, frame_stats.py, dash_check.py
tools/lib/motion.js      easing and tween library (pure functions)
docs/engine.md           the scene author manual: read before writing a scene
```

Generated folders: `work/` (renders, sheets, locks), `audio/` (takes, music, mix), `deliver/`.

## Worked examples

Two finished films were built with this engine: a 42 s brand film (a CUT table conformed to the music) and a
46 s product commercial (a captured UI kit, music spliced on bar lines). Both follow `docs/engine.md`; the kit
does not depend on them. For a longer manual of the same engine, the optional `claude-motion` skill ships
`references/threejs-engine.md` (section 9 describes both films).
