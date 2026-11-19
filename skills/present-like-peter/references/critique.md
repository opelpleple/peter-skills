# Critique loop

The builder is the worst judge of a deck. Score it as a critic who sees only what the audience sees: `qa/contact.png`, the slide PNGs, and `STORY.md` for intent. When subagents are available, spawn one with exactly those inputs and this rubric; otherwise score in a separate pass after re-reading the brief.

## Rubric (1 to 10 each, gate: every axis 9 or higher)

| Axis | Question | 9 looks like | 6 looks like |
|---|---|---|---|
| **Story** | Is the thesis clear within the first three slides, and does every slide do one job toward it? | You can say the thesis from the contact sheet alone; the end calls back to the open | Topics in order, no claim, ends on "thank you" |
| **Wow** | Does the cold open land in five seconds, and is there one moment people will describe afterwards? | A signature set piece that could not be a bullet list | Nice type on dark grounds, nothing you would retell |
| **Accuracy** | Does every on-screen fact trace to a `RESEARCH.md` line, with as-of dates where numbers move? | Spot-check of five facts all trace; nothing marked VERIFY on screen | One number nobody can source |
| **CI fidelity** | Does it read as the brand (or the house style) before you read a word? | Sampled hex match tokens; type, spacing and tone match the brand's own materials | Generic dark template with the logo pasted on |
| **Legibility** | Can the back row read it? | Nothing under 20 px outside micro; 30 words or fewer per slide; clean at 1280 x 720 | Paragraphs on slides, low-contrast sublines |
| **Craft** | Is it finished? | Zero QA errors; alignment, rhythm and motion timing consistent; no collisions in any PNG | Off-grid elements, a clipped word, uneven build timing |

Every score cites slide numbers and the evidence ("slide 4: three cards, middle card's text sits 12 px lower than the others"). A score without evidence does not count.

## Loop

1. Score all six axes. Write the round into `CRITIQUE.md`: scores, evidence, and a ranked list of findings with the fix for each.
2. If every axis is 9 or higher, stop.
3. Otherwise fix the three findings that raise the lowest axes most, rebuild, rerun QA (both sizes), regenerate the contact sheet, and score again from fresh eyes.
4. Stop after round 3 regardless, and write what still holds the deck back and what it would take (time, data, an asset, a decision from the user).

Common fixes by axis:
- Story: cut a slide; rewrite the title as a claim; move the reveal later; make the last slide a callback.
- Wow: replace the weakest slide's layout with a set piece; make the cold open silent and visual; let history change the design.
- Accuracy: source it or cut it; add an as-of micro label.
- CI fidelity: sample and fix hex; swap to the brand's type feel; remove decoration the brand would not use.
- Legibility: move words to the notes; raise sizes; increase ink2 contrast.
- Craft: align to the 140 px gutter; one easing curve; equal card heights; fix every QA warning.

## Logo lab gate

If the deck draws a real mark, its pixel test result (under 1 percent ink difference at the test size) is part of CI fidelity. A mark that fails the test caps CI fidelity at 7.
