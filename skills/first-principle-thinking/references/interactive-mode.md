# Interactive mode

The same eight steps as solo mode, but each decision goes to the user, in the style of a grilling skill if you have one: one question at a time, a recommended answer with every question, and facts looked up rather than asked. This file is self-contained; no other skill is needed.

## Rules

1. One question per message. Never stack questions.
2. Every question carries your recommended answer and one line of reasoning, so the user can reply "yes" and move on.
3. Look facts up yourself (files, data, the web). Ask only for decisions, preferences and things only the user knows.
4. Keep a running ledger in your head and show it every 5 questions or when the user asks: assumptions so far with tags, released items, constraints.
5. Do not jump to solutions before step 5 is agreed. If the user proposes one early, park it: "Parked as answer candidate A. We will test it against the constraints at step 6."
6. End when the user agrees with the constraint list and picks a first hypothesis to test. Then offer to write the full analysis (step 8).

## Question script (adapt the wording)

Step 1, restate:
- "In one sentence, what outcome do you want, without naming a tool or format? My draft: ..."
- "What decision will this thinking feed? My guess: ..."

Step 2, evidence (no question until it is done):
- Before asking about assumptions, read what the user pointed at and list each source by file or URL, plus anything you could not open. Then ask only: "Is there anything else I should read? I found: ..."

Step 3, assumptions (one per message, until you have at least 8):
- "The current approach assumes ... . I would tag it convention because ... . Agree?"

Step 4, ladder (only for convention and habit):
- "Why is ... done this way? My guess is it came from ... ."
- "Which part of it is actually true? I think the true part is ... and the rest is packaging."
- "What would have to be true for ... to be right here? I do not think that holds, because ... . Release it?"

Step 5, constraints:
- "Here are the constraints that survived: ... . Anything missing or wrong?"

Step 6, rebuild:
- "Three answers built only from those constraints: A ..., B ..., C (the one convention would reject) ... . I would pick ... . Which do you want to test?"

Step 7, hypotheses:
- "The cheapest way to prove this wrong is ... , cost ... . If ... happens we drop it. Run that first?"

Step 8, write and save:
- "Want me to write this up? It goes to `$ME_DIR/thinking/<date>-<slug>.md` (default `~/.claude/me/`). I will give you the path, the root cause in one sentence and the first test." If yes, follow step 8 in SKILL.md.

## When the user pushes back

If the user wants to keep a convention, keep it and tag it `habit (kept by choice)`. Their reason goes in the ledger. Do not reopen it unless new evidence appears.
