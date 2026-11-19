# Visual system

## Tokens first

All colour, type and spacing live as custom properties on `:root` in `deck.css`. A deck has:

- **Ground** and **raised surface** (dark and light variants via `data-theme`).
- **Ink, ink2, ink3**: main type, sublines, micro labels. Check ink2 on ground for contrast 4.5:1 or better.
- **One accent** that means "look here". A second accent only for a two-sided comparison.
- **Three families at most**: a sans for structure, a serif italic for the one emphasised word, a mono for kickers, dates and numbers. Inline them as data URIs (`src/fonts/fonts.json`); subset to the scripts the deck uses (for Latin: `pyftsubset --unicodes="U+0020-007E,U+00A0-00FF,U+2018-201D,U+2022,U+2026"`). Thai and other scripts need a face with real coverage and a line height of at least 1.3 for stacked marks.

## Type scale (at 1920 x 1080)

| Role | Size | Use |
|---|---|---|
| word | 180 to 240 px | the one huge word or number |
| title | 96 to 120 px | slide headline, at most two lines |
| sub | 36 to 44 px | one quiet line under the title, ink2 |
| body / card text | 25 to 32 px | inside cards only |
| kicker | 24 to 28 px mono, uppercase, tracked | date, section, eyebrow |
| micro | 18 to 20 px mono | sources, as-of dates, axis labels |

Nothing under 20 px except micro labels. Test: the deck still reads at 1280 x 720 from two metres.

## Layout grammar

- One idea per slide, centred or on a strong left edge (140 px gutter). Massive negative space is a feature.
- Cards: up to three in a row, equal width, one line of heading and two of text.
- Numbers are the hero when they are the point: count them up, set them in the word size, put the unit in the sub.
- Charts drawn in canvas or SVG with the deck's tokens, labelled directly (no legends), one highlighted series in the accent, the rest in ink3.
- HUD zone (bottom 64 px, right 260 px) stays clear.

## Motion grammar

- Builds rise 22 px and fade over 0.6 to 0.9 s with one easing curve for the whole deck.
- A set piece gets its own motion; everything else stays calm so the set piece lands.
- Name the transition idea in `STORY.md` (a seam, a pour, a wipe, a camera flight) and keep it consistent; change it only when the story changes it.
- Every motion has a reduced version: a crossfade of 200 ms or less, or the final frame.

## Techniques, from light to heavy

1. Type only (most slides).
2. Card or list build.
3. Counter (`data-count`).
4. Canvas 2D scene: particles, race bars, dot fields, maps, 1-bit retro renderings, procedural textures.
5. three.js world: a continuous 3D space the camera flies through between slides, glass or extruded type, a logo drawn by light. One renderer per deck, DPR capped at 2, paused when hidden.

Pick the lightest technique that does the job; spend the heavy ones on the signature.

## Brand marks and the logo lab

When a real mark appears (the user's own brand, or a brand discussed as commentary with the user's approval):
- Redraw it in code from vector data (SVG path, `Path2D`, three.js `Shape`), never as a pasted bitmap, so it can be animated, lit and rebuilt.
- **Pixel test**: render your mark and the reference at the same size (for example 600 px wide), threshold both to ink and background, and count ink pixels that differ. Target under 1 percent; record the number in `STORY.md`. A side-by-side test page with the difference image makes misses obvious.
- Use the mark as a subject, not wallpaper: absent from some slides on purpose, never a sign-off lockup in commentary decks.
- For third-party brands in a style study: a visible "unofficial, not affiliated" line on the title and last slide, open-licence fonts only, no product photos or footage, and `<meta name="robots" content="noindex">`.

## CI fidelity checklist

Before step 7, compare against the brand's own materials: ground and accent hex sampled from a still match the tokens; type feel matches (weight, tracking, case); layout grammar matches (where the headline sits, how much space); tone of copy matches (short declaratives, the brand's spelling). Write the tells you checked into `STORY.md`.
