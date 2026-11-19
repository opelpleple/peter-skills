# Build, render, QA

## Build in the template

The film folder made by `new-film.sh` is the `threejs-kinetic` kit of `claude-motion`, trimmed and made self
contained: three.js 0.180.0 ships in `tools/vendor/three` (build files only), playwright-core is linked from
the vendor cache `install.sh` fills (outside the skill folder), fonts are OFL. Rendering never touches the network.

Order of work in a new film:
1. `film/engine/theme.js`: `C` (brand colours only), `T` (one key per storyboard chapter, `total` = length),
   `STATION` (one colour field per chapter), `TYPE`.
2. `film/main.js`: `SCENE_FILES`, `START`, `MOVES` (`[t0, dur, station, ease]`).
3. Delete the demo scenes `s01_headline.js`, `s02_card.js`; write yours. One scene can span several shots
   when they share a station (the dogfood card: 2 scene files for 5 shots).
4. `tools/bin/check <frame-exact times> <ids>` after every scene change.

Purity traps seen in practice:
- A helper that only writes colours after a start time (`if (t >= t0) shine(...)`) leaves the last colours of
  a later frame on an earlier one. Call it on every update; it writes the base colours before `t0`.
- Overwriting a rotation that a kit shape sets for you: `K.diamond` is a square turned 45 degrees, so add to
  `Math.PI / 4`, do not replace it. The first stills showed squares.
- `visible = false` while waiting hides the object from the motion probe; park it far off frame instead when
  its entrance must blur.

## Render

- Stills: `tools/bin/stills <name> <times|a:b:step> [ids] [--full] [--cols N]`, about 0.04 s per frame at 960.
- Film: `tools/bin/film preview|full <name> [--no-audio]`; `FILM_W` / `FILM_H` set the full size.
  The dogfood card (6 s, 1280x720, 180 frames) came out at 500 KB with the full settings (CRF 15).
- Sound: `tools/audio/` (music generation needs your own ElevenLabs key in `ELEVENLABS_API_KEY`; analyse,
  splice on bar lines, mix and master to -14 LUFS). A silent loop for a web page needs none of it.

## QA lenses (open every sheet)

| lens | check |
|---|---|
| viewer | each line readable at phone size, nothing important in the outer 5%, every second alive |
| reference | the stolen moves are visible and the leave list is respected |
| beat | landings on the grid (compare sheet time codes with the storyboard) |
| brand | colours from `C` only, one highlight word per screen, copy exact |
| tech | `DETERMINISTIC`, dash check clean, size, fps, frame count, file size for the destination |

## Delivery

| destination | size | target |
|---|---|---|
| web hero or card loop | 1280x720 or 1920x1080, silent, H.264 | under 3 MB for 6 s (CRF 15 gave 0.5 MB) |
| chat preview | the 720p copy `tools/bin/film full` writes for a 1080p master | under about 25 MB |
| master | 1920x1080 H.264 High 4.1, AAC, -14 LUFS, peak under -1 dBTP | |

Deliver the film with `boards/storyboard.html` and `docs/refs.md`.
