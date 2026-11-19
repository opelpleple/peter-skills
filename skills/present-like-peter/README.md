# present-like-peter

A Claude Code skill that builds keynote-grade presentations the way a director makes a short film: a one-line thesis, a cold open, one signature set piece drawn in code, every fact sourced in the speaker notes, then automated layout QA, a scored critique loop that does not stop until story, wow, accuracy, CI fidelity, legibility and craft all score 9 or higher, and export to PDF and PPTX. The deck itself is one self-contained HTML file that opens offline by double-click, with keyboard control, deep links (`?slide=N&step=M`), speaker notes, autoplay, a language toggle, reduced motion and print modes.

## Install

Get the skill from https://github.com/opelpleple/peter-skills (`git clone` it, the folder is `skills/present-like-peter`), then from the `skills/` folder:

```sh
cp -r present-like-peter ~/.claude/skills/
npm i -D playwright            # in any folder; set PLAYWRIGHT=/that/folder/node_modules/playwright if it is not resolvable
pip install python-pptx pillow
```

If you have no system Chrome (Linux, Windows, or a Mac without Chrome), run `npx playwright install chromium` so QA and export have a browser. On a Mac with Chrome in `/Applications` it is used automatically; set `CHROME=/path/to/chrome` to use another one.

Then ask Claude Code for a deck ("make a keynote for my talk on ...", "ทำ deck นำเสนอ ...").

Requirements: Python 3 (build), Node with Playwright and a Chromium (QA and export), python-pptx and Pillow (PPTX).

## Configure

- `PRESENT_LIKE_PETER_OUT`: where decks are written (default `~/.claude/me/present-like-peter/decks/`).
- `~/.claude/me/present-like-peter/STYLE.md`: optional house style (tokens, fonts, languages, CI rules) applied by default.

## What is inside

```
SKILL.md                 the eight steps
references/              story, research, engine, visual system, qa, critique, export
template/                starter deck: build.py + src/ (engine, tokens, scenes, sample slides)
scripts/check.cjs        layout QA: overflow, overlap, off-stage text, console and network errors, contact sheet
scripts/export.cjs       <deck-slug>.pdf (print mode), PNG per slide, notes.json
scripts/to_pptx.py       image PPTX with presenter notes
```

No personal data ships with the skill. Everything a run produces goes to the output folder.
