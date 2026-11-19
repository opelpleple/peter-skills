---
name: video-like-peter
description: 'Reference-first pre-production for a short code-rendered motion film. Hunts and measures YouTube references, writes a steal list, storyboards on a beat grid, then builds in Three.js + Canvas, with a 17-style animation library (clay, pixel, comic, riso, chalkboard, cine 3D and more) and a depth map plus skeleton pipeline for action shots. Use for "animation style", "depth map", "skeleton", "pose extraction", or "video like Peter", "find references before a motion film", "storyboard for a motion film", "หา reference ก่อนทำ motion", "ทำ storyboard สำหรับ motion film", "ทำ frame board", "ทำวิดีโอแบบพี่ปีเตอร์". Not for AI-generated video, long voice-over films (claude-motion) or series scripts (film-script).'
---

# Video like Peter

A film is made twice: once on paper (references, steal list, storyboard on a beat grid, frame board), once in
code (`render(t)` in Three.js + Canvas, rendered frame by frame). The paper film is what makes the code film
good; skip it and you get motion without an idea. Every step ends on an artifact you can open.

`<skill>` = the folder of this file. `<film>` = the film folder. Personal notes about one person's taste live
outside the skill, in `$ME_DIR/video-like-peter/` (default `~/.claude/me/`); read `$ME_DIR/video-like-peter/taste.md`
first if it exists.

## Steps

1. **Brief.** `<skill>/scripts/new-film.sh <film> "<title>"` (run `<skill>/install.sh` once per machine first).
   Fill `<film>/docs/brief.md`. Done when every row has an answer or an open question for the requester, and the
   style words describe motion (how), not topic (what).

2. **Hunt.** `<skill>/scripts/hunt.sh "<style words>" 8 <film>/refs/candidates.tsv`, three to five queries.
   Shortlist by duration (short pieces teach more per second), craft signal (views, studio channels) and
   distance from your topic. Pick **2 or 3**. Details and query patterns: [references/hunt.md](references/hunt.md).
   Done when `refs/candidates.tsv` holds every query and the pick is written down with one line of why.

3. **Study.** For each pick: `<skill>/scripts/grab.sh <url> <film>/refs/rN --fps 2` (use `--from/--to` on long
   videos). It measures cuts and palette, keeps 320 px frames and contact sheets, and deletes the video. Open
   every `sheet_NN.jpg` (48 frames each) and look at it. For a reference worth a second-by-second read (a 30 to 60 s film you will remake
   the language of), the `watch` skill adds the transcript. Write `<film>/docs/refs.md`: per reference the
   measured numbers, then **steal** (pacing, transitions, type behaviour, colour) and **leave** (what you will
   not take). Done when each steal line names a move you can storyboard and each reference has a leave line.

4. **Storyboard.** Write `<film>/docs/storyboard.json` (shape: `<skill>/references/storyboard.example.json`):
   shots with `t0/t1` on the beat grid, copy, motion with landing times, the stolen idea it uses, sound.
   Rules: [references/storyboard.md](references/storyboard.md). Then
   `python3 -I <skill>/scripts/frameboard.py <film>/docs/storyboard.json <film>/boards/storyboard.html` and open it.
   Done when every shot has a landing time on the 0.125 s grid, readable text holds 1.5 s or more, and every
   steal line from step 3 is used by a shot or dropped on purpose.

5. **Build.** The film folder is a copy of `<skill>/template` (engine, tools, vendored three.js, Poppins and
   Libre Baskerville). Set `T`, `C` and stations in `film/engine/theme.js`, write one scene file per storyboard
   chapter, list them in `SCENE_FILES` and `MOVES` in `film/main.js`. Read `<film>/docs/engine.md` before the
   first scene: `update(t)` must be pure. Done when `tools/bin/check <times> <scene ids>` prints `DETERMINISTIC`.

6. **Look, fix, look.** `tools/bin/stills <name> 0:<total-0.25>:0.25` and open the sheet, then `--full` stills of
   the hero frames. Re-run the frameboard: placeholders become real frames (set each shot's `frame` to a still).
   Compare frames to the reference sheets, not to your memory of them. Done when the frame board reads as the
   film with the sound off.

7. **Render and QA.** `tools/bin/film full <name> [--no-audio]` (`FILM_W=1280 FILM_H=720` for a 720p master),
   open every `work/qa/full_sheet_NN.jpg`, `python3 tools/qa/dash_check.py`. QA lenses and delivery sizes:
   [references/build-qa.md](references/build-qa.md). Done when the sheets pass every lens, the file plays at
   the size and length in the brief, and the board plus the film are delivered together.

## Style library (pick in step 1, apply from step 4)

Seventeen animation styles, each built as a live recipe on one shared six second scene so they compare like
for like: Flat cartoon, Vector plano, Rubber hose, Pixel 16-bit, ASCII, Pizarra (chalkboard), Comic, Riso print,
Blueprint, Ink silhouette, Cardboard cutout, Soft clay 3D, 90s low poly, 2000s console 3D, Toy bricks, Voxel
blocks, Cine 3D. Index and one-liners: [styles/INDEX.md](styles/INDEX.md). Each `styles/<slug>.md` gives the
palette in hex, shape and line rules, frame rate stepping, the exact technique with code, how to apply it to a
storyboard, failure modes and reference queries for step 2. The shared deterministic engine (`stage.js`,
`scene.js`, `template.html`) is in `styles/_engine/`. Name the style in the brief, steal its recipe in step 4,
and check stills against its failure modes in step 6. Brand-adjacent looks (toy bricks, voxel blocks, console
3D) stay original: no brand names, logos, textures or characters.

## Depth map and skeleton (action shots)

For fights, dance or any shot with bodies in motion: extract a depth pass (Video Depth Anything) and a pose
pass (YOLO11-pose, COCO 17 keypoints) per shot, then use them as a choreography lock for regeneration, a comp
layer (fog, depth of field, 2.5D push), or QA (does the strike land on contact, are the bodies at different
depths). `scripts/vision/video_vision.py` runs prepare, depth, pose, analyze and render stages;
`contact_audit.py` separates real contact from near misses; `web_layers.py` exports a web viewer. Method,
commands, numbers and where it breaks (left/right flips, cropped bodies, motion blur, camera motion):
[references/depth-and-skeleton.md](references/depth-and-skeleton.md). Never claim a hit from proximity alone:
contact needs the limb on the other body's mask.

## Rules that hold in every step

- References are for study. Never put their footage, music, logo, photos or sentences in the film; delete the
  downloaded video after `grab.sh`, keep only your own small frames.
- Take the **language** (rhythm, how type enters and stacks, how fields change), translate it to your brand
  and your beat. Measured numbers beat impressions: a 0.57 s median shot is a fact, "fast" is not.
- Text never fades in; it streaks, drops, blurs in word by word, types or pops. One highlight word per screen.
- No em or en dash characters in copy, code or comments.

## Works with

- `claude-motion`: the engine this skill extends. Its `references/threejs-engine.md` is the deep manual for the
  Three.js route (music conform, many-agent builds, UI capture); its HTML `render(t)` route is better for long
  voice-over films and device screens. A full `claude-motion` install is not needed: `template/` is enough.
- `watch`: transcript and scene-aware frames of one reference, for a deep study in step 3.
- `present-like-peter`: when the film plays inside a keynote, build the deck there and drop the MP4 in.
- `first-principle-thinking`: when the brief is vague, ask what the last frame must make the viewer know.
- `crazy-one`: for a bolder concept before step 4.
- `be-me`, `extract-me`: their profile in `$ME_DIR` tells you the person's taste and brands.
- `skill-organiser`: keeps this skill's hand-offs consistent with the rest of the set.

Lessons from finished films (what went wrong and the fix): [references/lessons.md](references/lessons.md).
