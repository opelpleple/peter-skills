---
name: present-like-peter
description: Build a high-end keynote as one offline HTML file with code-drawn set pieces, sourced notes, layout QA and a scored critique loop, exported to PDF and PPTX. Use for a deck, keynote, pitch, talk or board presentation ("make a deck", "keynote for my talk", "ทำสไลด์", "ทำพรีเซนต์", "ทำ deck", "ทำ keynote", "งาน masterpiece"), or to make a deck more wow, fact-checked or bilingual. Not for a one-page doc, a video (video-like-peter) or an editable native PPTX (use pptx skill).
---

# present-like-peter

Act as a **keynote director**, not a slide filler. A deck is a short film the speaker drives with a clicker: one thesis, a cold open, a few set pieces the audience remembers, every fact sourced in the notes, and a last frame that calls back to the first.

The deliverable is one self-contained `.html` file that opens offline by double-click, plus a PDF, a PPTX and a contact sheet, and a scorecard where every axis is 9 or higher.

## Settings

- **Output folder**: `$PRESENT_LIKE_PETER_OUT` if set, else `~/.claude/me/present-like-peter/decks/<deck-slug>/`. If the user names a path, use it. Never write a deck inside the skill folder.
- **House style**: if `~/.claude/me/present-like-peter/STYLE.md` exists, read it before step 4 and treat it as the default visual system (tokens, fonts, languages, CI rules). The user's request overrides it.
- **Profiles** (optional): `~/.claude/me/expertise/PROFILE.md` (from extract-me) tells you what the speaker is credible on; `~/.claude/me/voice/` (from be-me) tells you how they talk. Use them for the notes and the tone of copy.
- **Tooling**: Python 3 for `build.py`; Node plus Playwright for `scripts/check.cjs` and `scripts/export.cjs` (`PLAYWRIGHT=/path/to/node_modules/playwright` if it is not resolvable, `CHROME=` for a system Chrome); python-pptx and Pillow for `scripts/to_pptx.py`. If a tool is missing, say which step you could not run.

## Steps

### 1. Brief

Get, from the request or by asking once: audience, the room (stage screen, laptop share, sent as PDF), length in minutes, language(s), brand or CI, what the audience should do after. Then write the **thesis**: one sentence, under 15 words, that the audience could repeat tomorrow. Done when `brief.md` in the output folder holds those fields and the thesis, and the thesis passes the "repeat it tomorrow" test (a claim, not a topic: "Trust is the only thing getting more expensive" beats "AI and trust").

### 2. Research

Collect every fact the deck will show into `RESEARCH.md`: one line per fact with its source URL or file, date checked, and `VERIFY` when not confirmed. Use the user's own data when it exists; use web research only for public facts. Rules and format: [references/research.md](references/research.md). Done when every number, date, name and quote you plan to put on screen is a line in `RESEARCH.md`, and nothing marked `VERIFY` is planned for a slide.

### 3. Story

Write `STORY.md`: the arc (cold open, title, rise, turn, payoff, callback end), one line per slide with its job, the copy, its build steps and the fact keys it uses. Pick one **signature set piece** (the moment people describe afterwards) and at most three supporting ones. Patterns and the arc menu: [references/story.md](references/story.md). Done when: the slide count fits the length (about one slide per 40 to 70 seconds of talk), every slide has exactly one job, the cold open has no title on it, the last slide calls back to the first image, and every on-screen fact points to a `RESEARCH.md` line.

### 4. Visual system

Set the tokens in `src/deck.css` (ground, ink, sublines, one accent, type families, scale) and write down the rules the deck keeps: one idea per slide, one accent, what the motion grammar is, how history or the story changes the design. If a real brand mark appears, redraw it in code and pass the logo lab. Rules: [references/visual-system.md](references/visual-system.md). Done when the tokens are set, `STORY.md` names which technique (type only, card build, counter, canvas scene, three.js world) each slide uses, and any logo passes the pixel test.

### 5. Build

Copy `template/` from this skill into the output folder, then write the slides in `src/index.src.html` and the set pieces in `src/scenes.js`. Do not fork `engine.js` per deck; if the engine lacks something, add it generically. The engine contract (stage scaling, steps, keys, `?slide=N&step=M`, notes, autoplay, reduced motion, still and print modes, languages, counters, scenes): [references/engine.md](references/engine.md). Every slide gets `<aside class="notes">` with what to say and the sources for what is on screen. Build with `python3 build.py --out dist/<deck-slug>.html`. Done when `build.py` passes its gates (no em or en dash in sources or deck `*.md`, no network references outside notes, notes on every slide, steps consistent) and the file opens offline.

### 6. QA

Run `node <skill>/scripts/check.cjs dist/<deck-slug>.html qa/` at 1920 x 1080, then again with `VW=1280 VH=720` into `qa-720/`. Fix every error (text beyond the stage, overflow, text or box overlap, console errors, network requests) and rebuild until both runs exit 0. Then open `qa/contact.png` and every slide PNG with the Read tool and look: the script cannot see collisions between canvas drawings and text, low contrast, or a slide that reads wrong. Details and the manual control checklist: [references/qa.md](references/qa.md). Done when both runs report 0 errors, every warning is fixed or written down with a reason, and you have looked at every slide image.

### 7. Critique loop

Score the deck as a fresh critic who sees only the contact sheet, the slide PNGs and `STORY.md` (a subagent is ideal). Six axes, 1 to 10: **story, wow, accuracy, CI fidelity, legibility, craft**. Each score cites the slide and the evidence. If any axis is below 9, fix the three weakest findings, rebuild, rerun step 6, and score again. Stop after the round where every axis is 9 or higher, or after three rounds, and report what still holds it back. Rubric and anchors: [references/critique.md](references/critique.md). Done when `CRITIQUE.md` holds every round's scores with evidence and the final round is all 9 or higher, or the stop reason is written down.

### 8. Export and hand back

Run `node <skill>/scripts/export.cjs dist/<deck-slug>.html export/` (`export/<deck-slug>.pdf` with every slide in final state, PNG per slide, `notes.json`), then `python3 <skill>/scripts/to_pptx.py export/ export/<deck-slug>.pptx` (image slides with notes). Details: [references/export.md](references/export.md). Hand back the HTML path, PDF, PPTX, contact sheet, final scores, the keys the speaker needs (arrows, N notes, P autoplay, F full screen, L language) and an honest list of what was not verified. Done when all four files exist and you opened the PDF page count against the slide count.

## Hard rules

- No em dash or en dash in any copy, code, comment or note, including the working files (`brief.md`, `RESEARCH.md`, `STORY.md`, `CRITIQUE.md`). `build.py` checks the sources and every `*.md` in the deck folder; rewrite the sentence instead of swapping the symbol.
- No invented facts. A number without a `RESEARCH.md` line does not go on screen.
- Fully offline at runtime: fonts inlined as data URIs, three.js inlined if used, no CDN, no remote images, no fetch.
- Nothing is published, uploaded or sent by this skill. Sharing is the user's call.

## Works with

- **be-me**: speaker voice for notes and copy.
- **extract-me**: what the speaker is credible on, for the thesis and examples.
- **first-principle-thinking**: when the thesis is weak, rebuild it from root causes before step 3.
- **crazy-one**: run on `STORY.md` to find a bolder signature set piece.
- **video-like-peter**: a cold open or set piece that should also live as a film; shares the Three.js and canvas craft.
- **skill-organiser**: keeps this skill's hand offs to the others mapped.
- Existing skills: `claude-motion` for a motion video of the same story, `frontend-design` for a web page instead of a deck, `anthropic-skills:pptx` only when the user wants an editable native PPTX rather than the image PPTX.
