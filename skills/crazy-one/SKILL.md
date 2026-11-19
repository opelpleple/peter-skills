---
name: crazy-one
description: Read a document (plan, brief, concept, PRD, deck outline, strategy memo) and propose crazy ideas with positive impact, each with a first step that costs under one day. Use when the user says "crazy idea", "crazy one", "moonshot", "make this bolder", "ไอเดียบ้าๆ", "ไอเดียสุดโต่ง", "คิดนอกกรอบจากเอกสารนี้", "เสนอไอเดียแหวกแนว", "ทำให้มันบ้ากว่านี้", or hands over a document and asks how to make it 10x better. Also when another skill needs divergent ideas before a plan is locked.
---

# crazy-one

You are a **provocateur with a conscience**. You read one document, find the assumptions it treats as sacred, break them on purpose with named operators, then hand back only the breaks that are both good for people and startable tomorrow morning.

The output is never "a list of ideas". It is **three crazy but doable bets plus one wildcard**, each with a first step under one day and a way to undo it.

## Settings

- **Dial**: if the user did not name one, use `bold` and state it in the first line of the hand back; switch if the user asks.
  - `sane`: crazy score 2 or more is enough. Prefer operators steal, 10x, constraint flip. Good for documents already in build.
  - `bold`: crazy score 3 or more for the top 3. All 8 operators, at least 2 ideas each.
  - `unhinged`: crazy score 4 or more for the top 3. All 8 operators, at least 3 ideas each. The wildcard must break the document's single most sacred assumption.
  The dial never relaxes the kill pass.
- **Output folder**: `$CRAZY_ONE_OUT` if set, else `~/.claude/me/crazy-one/runs/`. File name `YYYY-MM-DD-<doc-slug>.md`. If the user names a path, write there instead. Never write the run inside the skill folder: runs quote private documents.

## Steps

### 1. Frame the document

Read the whole document (for long files, read every heading, then every section that states goals, rules, audience, scope or open questions). Write a **frame** with four parts, each line pointing at the section or quote it came from:

- **Real goal**: the stated goal, then the goal behind it ("so that..."). One sentence each.
- **Audience**: who consumes the result, and who builds it, if different.
- **Constraints**: split into *hard* (law, ethics, safety, explicit "never" rules from the owner) and *soft* (choices: format, count, length, tooling, schedule).
- **Sacred assumptions**: at least 5 things the document never questions. Phrase each as "The document assumes ...". These are the targets.

Done when every part has a source pointer and there are at least 5 sacred assumptions. If you cannot find 5, read again: format, count, medium, who does the work, and how success is shown are always assumed somewhere.

### 2. Generate with operators

Run every operator in [references/operators.md](references/operators.md) against the frame. Each idea gets:

- an id (`I1`, `X2`...), a short name, one sentence of what happens
- which sacred assumption or soft constraint it breaks

Quantity first, no scoring yet. Merge duplicates and say what merged into what. Done when every operator has its quota for the dial.

### 3. Kill pass

Apply the kill list in [references/scoring.md](references/scoring.md) to every idea. A killed idea stays in the output with its reason: the user should see what was considered and why it died. Hard constraints from step 1 are kill criteria too. Done when every idea is marked `alive` or `killed: <reason>`.

### 4. Score

Score every live idea on the four axes in [references/scoring.md](references/scoring.md): Impact on the real goal, Feasibility, Reversibility, Crazy. Rank by `Impact x Feasibility`, ties broken by Crazy. Done when every live idea has four numbers and one line of reasoning for Impact.

### 5. Pick the bets

- **Top 3**: the highest ranked ideas that pass the dial's crazy gate and have Reversibility 3 or more. Ideas that only work together may be presented as one bet; say so.
- **Wildcard**: the highest Impact idea that is wildcard eligible under [references/scoring.md](references/scoring.md): it failed a top 3 gate (Crazy below the dial minimum or Reversibility below 3) or it is too big (Feasibility 2 or less). Never one that failed the kill pass, never one already in the top 3. Ties: higher Crazy first. State which condition made it eligible.
- **Runner-up**: one line for the next idea in line, so the user sees the bench.

For each bet write seven text fields plus a Scores line (eight fields in all): the move, why it serves the real goal, the assumption it breaks, the **first step under one day** (concrete, local, no spending, no publishing, no messages to anyone), what result would tell you to continue, the main risk, and how to undo it.

Done when every bet has all eight fields (seven text fields plus Scores) and every first step could start today without anyone's permission except the user's.

### 6. Write and hand back

Write the run with [references/output-template.md](references/output-template.md) to the output folder. In chat, give the three bet names, the wildcard, the path, and one sentence on which bet you would start first and why. Offer to hand the chosen bet to the next skill (see Works with).

## Rules

- Positive impact means good for the people the document serves and for third parties. Crazy that hurts someone is not crazy, it is harm. The kill pass is not optional at any dial.
- Never add facts. If an idea needs a fact the document does not have, write "needs: <fact>" and lower Feasibility.
- First steps stay inside the user's own machine and authority: prototypes, drafts, mock data, a test with three friends the user picks. Publishing, sending, buying and deploying are later steps the user decides.
- Write plainly. No hype words ("revolutionary", "game changing"); the crazy lives in the move, not the adjectives.

## Works with

Each link applies only if that skill is installed; skip it otherwise. See the README for which skills ship in the same pack.

- **first-principle-thinking** (if installed): run it first when the document's goal itself is unclear; feed its root cause into step 1 as the real goal.
- **grilling** (if installed): after the user picks a bet, grill it before building.
- **decision-mapping** or **plan-me** (if installed): turn the chosen bet into a sequenced plan.
- **present-like-peter**, **video-like-peter** (if installed): when the bet is a deck or a film, hand the bet as the brief.
- **skill-organiser** (if installed): lists crazy-one as the divergence step between understanding a document and planning it.
- **be-me** (if installed): when a bet's first step is a message the user will send, draft it in the user's voice (the user sends it).
- **extract-me** (if installed): its expertise file can tell you which bets the user is unusually well placed to pull off; raise their Feasibility.
