---
name: first-principle-thinking
description: Walk a strategy, plan, process or design back to its root causes and rebuild the answer from fundamental constraints, by questioning every assumption and ending on cheap, testable hypotheses. Use for "first principles", "root cause of this plan or design", "challenge my assumptions", "what is actually true", "คิดแบบ first principle", "ย้อนกลับไปที่ต้นเหตุ", "ตั้งสมมติฐาน". Not for debugging failing code or tests; use systematic-debugging for that.
---

# First Principle Thinking

Strip a problem down to what is actually true, then build the answer back up from only that. The output is never "an opinion". It is a chain: assumptions, tagged; the few constraints that survive questioning; solutions rebuilt from those constraints; and hypotheses with the cheapest test first.

## Choose the mode first

- **Interactive** (default when the user is present and the problem is theirs): ask one question at a time, give your recommended answer with each, wait. Read [references/interactive-mode.md](references/interactive-mode.md) before the first question. This mode runs the same steps as solo, it just puts each decision to the user. It needs no other skill.
- **Solo** (when the user says "write it up", "just analyse it", "วิเคราะห์ให้เลย", or hands over a document and leaves): do every step yourself and write the analysis with [references/output-template.md](references/output-template.md).

If unsure, ask once: "Do you want to think it through with me, one question at a time, or should I write the full analysis?"

## Where outputs go

Save the written analysis to `$ME_DIR/thinking/<YYYY-MM-DD>-<slug>.md`. Check `echo $ME_DIR` first; if it is empty, use `~/.claude/me/`. The user can change it. Create the folder with `chmod 700` if it is missing. If the user names another path, use theirs. The skill folder itself never holds anyone's analyses.

## The steps

Each step ends on a completion criterion. Do not start the next step until the current one is met.

### 1. Restate the problem

Write the problem as one sentence that names the outcome wanted, with every solution word removed ("we need a dashboard" becomes "the team cannot see X in time to act on it"). Add one line naming the decision this thinking will inform.

Done when: the sentence contains no tool, format or product name that the problem itself does not require, and the decision line exists.

### 2. Collect the evidence

Gather what already exists: the documents, data, code or past work the user pointed at. A fact that can be looked up gets looked up, never asked. Note each source by file or URL.

Done when: every piece of evidence you will cite later is listed with its source, and anything you could not open is listed as unread.

### 3. List and tag every assumption

Write down everything the current approach takes for granted: the unit of work, the format, the order, who it is for, what "good" looks like, what it must contain, how long it takes. Aim for at least 8. Tag each one with exactly one of the four tags, with a one-line reason. The tags and their tests are in [references/assumption-tags.md](references/assumption-tags.md).

| Tag | Meaning | Survives into the rebuild? |
|---|---|---|
| **physics** | a law of nature, mathematics, human perception or the medium | yes |
| **data** | supported by evidence you can point to | yes, if the evidence holds |
| **convention** | inherited from an industry, tool or template | no, unless step 4 grounds it |
| **habit** | what this person, team or model does by default | no, unless step 4 grounds it |

Done when: the list has at least 8 assumptions (or you state why fewer exist), every one has one tag and a reason, and every **data** tag names its source.

### 4. Run the question ladder

For every **convention** and **habit**, and every **data** item with thin evidence, climb the three rungs in [references/question-ladder.md](references/question-ladder.md):

1. **Why?** Where did this come from? Keep asking until the answer is a person, a tool or an accident of history.
2. **What is actually true?** Which part of it, if any, rests on physics or data?
3. **What would have to be true** for this assumption to be the right choice here?

Each rung either grounds the assumption (it gets re-tagged physics or data and survives) or releases it (it is dropped from the rebuild, with one line saying what it was protecting).

Done when: every non-physics assumption is marked grounded or released, with the rung where that happened.

### 5. Reduce to fundamental constraints

From the survivors, write the constraints: short, true statements that any good answer must respect. They describe the world, never a solution. Merge duplicates. Usually 4 to 8.

Done when: each constraint traces to at least one grounded assumption or source, none contains a solution word, and you could hand the list to a stranger who has never seen the current approach.

### 6. Rebuild from the constraints only

Generate at least three different answers using nothing but the constraints. One of them must be an answer the old convention would reject. For each answer, show which constraint each of its main parts serves. A part that serves no constraint is decoration: cut it or name it as a taste choice.

Done when: three or more answers exist, each part of each answer is traced to a constraint or marked as taste, and you name which answer you would pick and why.

### 7. Turn the best into testable hypotheses

Write each claim the chosen answer depends on as a falsifiable hypothesis: "If we do X, then Y will happen, measured by Z." Give each one the cheapest test that could prove it wrong, its rough cost in time or money, and a kill criterion (the result that means you were wrong). Order the list by cost, cheapest first.

Done when: there are at least 3 hypotheses, every one has a test, a cost and a kill criterion, and the first one can be run today.

### 8. Write and save

Assemble the output with [references/output-template.md](references/output-template.md), save it to the path above, and tell the user the path, the root cause in one sentence, and the first test to run.

Done when: the file exists at the stated path and the summary names the root cause and the first test.

## Working rules

- Physics means physics. "Users hate change" is not physics. "Working memory holds a handful of items" is close enough, and say so.
- Keep the user's decisions theirs. In either mode you may recommend, but a convention the user wants to keep for a stated reason is kept, tagged **habit (kept by choice)**.
- When evidence contradicts your rebuild, say so in the output instead of smoothing it over. A first principles answer that ignores data is just a fresh assumption.
- Write the output in the user's language. Tags stay in English so outputs stay comparable.

## Works with

All of these are optional companions from the same skill pack. Use them only if they are installed; this skill works fully on its own.

- A grilling-style skill, if you have one: use it when the user already has a plan and wants it stress-tested; use this skill when they want to know whether the plan should exist.
- `crazy-one`: after step 6, hand the released assumptions to `crazy-one`. Every dropped convention is a seed for an idea nobody else will try.
- `present-like-peter` and `video-like-peter` (deck and film skills in the same pack, if installed): run this skill on the brief first, so the work starts from constraints instead of a template.
- `skill-organiser` (if installed): can chain this skill as the "why" step ahead of any build skill.
- `extract-me` and `be-me` (if installed): their outputs in `ME_DIR` are good evidence for step 2 when the problem is about how a person works or writes.
