# video-like-peter

A Claude Code skill for short motion films (title cards, brand films, kinetic typography, product
commercials) made the way a motion designer works: hunt references on YouTube, measure them (cuts, shot
length, palette), write what to steal and what to leave, storyboard on a beat grid, review a frame board, then
build the film in Three.js + Canvas with a deterministic `render(t)` and real motion blur, rendered frame by
frame with headless Chromium and encoded with ffmpeg. No video model, so type stays sharp and every frame lands
where the storyboard says.

## Install

Get the `video-like-peter` folder from https://github.com/opelpleple/peter-skills (it is `skills/video-like-peter`), then from the `skills/` folder:

```bash
cp -R video-like-peter ~/.claude/skills/        # the whole folder (about 4 MB)
~/.claude/skills/video-like-peter/install.sh     # checks node 18+, ffmpeg (drawtext), python3, yt-dlp, uv;
                                                 # installs playwright-core + headless Chromium once
```

`install.sh` puts playwright-core (about 13 MB) in a cache outside the skill, `$VLP_CACHE` (default
`${XDG_CACHE_HOME:-~/.cache}/video-like-peter/vendor`), and films link to it. So the skill folder stays small
and holds no third-party code: share the folder itself, and the other person runs `install.sh` on their machine.
An older install that left `template/tools/vendor/playwright-core` inside the skill is moved to the cache by the
next `install.sh`. Tools that walk skill trees (`skill-organiser`, indexers) should skip `template/tools/vendor/`.

three.js 0.180.0 is vendored in `template/tools/vendor/three`; after `install.sh` nothing needs the network
except the reference hunt. Optional: set `ME_DIR` (default `~/.claude/me`) to keep personal taste notes in
`$ME_DIR/video-like-peter/taste.md`.

## Use

Ask Claude for a motion film, a title card, references or a storyboard, or follow `SKILL.md` by hand:

```bash
S=~/.claude/skills/video-like-peter
$S/scripts/new-film.sh ~/films/my-card "My card"
$S/scripts/hunt.sh "kinetic typography title card" 8 ~/films/my-card/refs/candidates.tsv
$S/scripts/grab.sh "<url>" ~/films/my-card/refs/r1 --fps 2
python3 -I $S/scripts/frameboard.py ~/films/my-card/docs/storyboard.json ~/films/my-card/boards/storyboard.html
cd ~/films/my-card && tools/bin/stills first 0:5.75:0.25 && tools/bin/film full card --no-audio
```

## Contents

| path | what |
|---|---|
| `SKILL.md` | the 7 steps with completion checks |
| `scripts/` | `hunt.sh`, `grab.sh`, `frameboard.py`, `new-film.sh` |
| `references/` | hunt, storyboard, build and QA, lessons, brief template, storyboard example |
| `template/` | the film kit: engine, render, QA and audio tools, OFL fonts, vendored three.js |

Fonts: Poppins and Libre Baskerville, SIL Open Font License (files in `template/film/fonts`). three.js: MIT.
