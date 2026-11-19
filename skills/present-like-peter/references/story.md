# Story: thesis, arc, cold open, set pieces

A high-end deck is written before it is designed. Most weak decks are weak in `STORY.md`, not in CSS.

## The thesis

One sentence, under 15 words, that is a claim with tension in it. Test: could a listener repeat it at dinner and start an argument? Good: "Everything is getting cheaper except trust." "Ninety days from bankrupt to a trillion." Weak: "Our 2027 plan." "AI in finance."

Write the subline that pairs with it: what changes for this audience if the thesis is true.

## The arc menu

Pick one and name it in `STORY.md`. Every arc ends on a callback.

| Arc | Shape | Fits |
|---|---|---|
| Keynote | cold open, title, problem, reveal, proof, "one more thing", callback | product, launch, vision talk |
| History | cold open, origin, rise, turn, reinvention, climax, scale, callback | company or market story |
| Answer set | cold open, the question asked, answer 1..N each with one proof, synthesis, callback | panel or brief with set questions |
| Decision | cold open, the stakes, options, the one we pick, the cost, the ask | board, budget, investor |
| Teach | cold open, the misconception, the model, worked example, the rule, callback | training, internal explainer |

## Cold open

The first 5 to 20 seconds, before the title. One image or motion, one line at most, no logo, no agenda. It plants the image the last slide returns to.

Patterns that worked:
- **A point becomes the world**: one pixel or dot grows into the shape the whole deck lives on; the end flies back into the dot.
- **The voice before the face**: audio or a quote plays over black, then the title lands.
- **The impossible question**: "Could you recognize it in the dark?" and the deck answers it.
- **The live counter**: a number counts up while the speaker is silent.

## Slide jobs

Every slide has exactly one job, written as a verb: hook, name, prove, contrast, reveal, count, choose, ask, call back. If you need two verbs, split the slide. One big thing per slide: one word, one number, one image, or one build of three cards. Copy budget: 30 words on screen or fewer; the rest goes in the notes.

## Set pieces

A set piece is a slide where the design itself tells the story, so the audience remembers the moment, not the bullet.

- **Signature** (exactly one): the moment people describe afterwards. It should be impossible to replace with a bullet list. Examples of the pattern: a journey that turns out to have drawn the logo all along; a row of tiles where the company's own hit switches off like an old TV; a bottle that folds into the ribbon that becomes every later transition.
- **Supporting** (up to three): a race chart, a counter, a before/after split, a map that lights up, a 1-bit retro rendering for an old year.
- **History drives design**: let the visual language change with the story (type that travels through eras, transitions born at the year they appear, an interface that switches on season by season). This is what makes a deck read as authored, not templated.

For each set piece write in `STORY.md`: what the audience sees at each step, the hold time per step for autoplay, its reduced-motion version, and the fact keys it uses.

## Build steps and pacing

- A build step is one click. Reveal in the order the speaker talks.
- Hold times (`data-hold`) per step make autoplay rehearsable: 2 to 4 s for a word, 4 to 7 s for a chart.
- About one slide per 40 to 70 seconds of talk. A 15 minute keynote is 14 to 22 slides.

## Speaker notes

Each slide's notes hold: what to say (in the speaker's voice, short lines), the transition line into the next slide, and the sources for everything on screen. The notes are the script; the slides are the subtitles.

## Callback end

The last slide returns to the cold open image, changed by everything in between, then can loop to slide 1 without a jump (autoplay loops). Close on the thesis or the ask, never on "Thank you" or "Questions?".
