# Research: every fact has a source line

## RESEARCH.md format

One fact per line, grouped by topic. Each line: a short key, the fact exactly as it will appear on screen, the source (URL, or file path plus query for the user's own data), the date you checked it, and a status.

```
## Market
- [M1] 2.2 billion servings a day | https://example.org/annual-report-2025 p.12 | checked 2026-11-19 | OK
- [M2] 74 days from launch to 1 million | https://example.org/press/123 | checked 2026-11-19 | VERIFY (two sources disagree: 74 vs 76)
## Own data
- [D1] 1,240 search clicks from one market, 28 days | data/country_split.json via a search console export | checked 2026-11-19 | OK
```

`STORY.md` cites keys (`M1`, `D1`) next to every on-screen number. The slide's notes carry the same sources in full.

## Rules

- **A number on screen needs a line here.** No line, no number. Round only in the direction the source allows and say "about" when rounded.
- **VERIFY stays off screen.** Either resolve it with a second source or cut it. Write what you cut and why at the bottom of the file.
- **Quotes**: exact words, speaker, where it was said, URL. Keep at most one or two direct quotes per deck; paraphrase in the notes otherwise.
- **Private data**: when the deck uses the user's internal numbers, keep the raw extract next to the deck (for example `data/*.json`) and add asserts in `build.py` that the on-screen numbers equal the extract, so a rebuild catches drift. Anonymize anything the audience should not see (client names, exact scores) and assert the real name is absent from the built HTML.
- **Dates**: write the as-of date on any slide whose number changes over time, small, in the sub colour.
- **Brand and CI facts** (hex values, typefaces, logo history) are facts too: source them like the rest, mark community-sourced values `VERIFY`, and prefer what the brand's own site renders.

## When the user supplies a document

Extract its claims into `RESEARCH.md` first with the document as the source, then flag anything that looks stale or unsourced inside it. Do not upgrade a claim's status because it came from the user; ask when it matters.
