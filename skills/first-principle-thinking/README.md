# first-principle-thinking

A Claude Code skill that walks any problem back to its root cause and rebuilds the answer from what is actually true. It lists every assumption behind the current approach, tags each one as physics, data, convention or habit, climbs a three rung question ladder (why, what is actually true, what would have to be true), keeps only the constraints that survive, generates at least three answers from those constraints alone, and finishes with falsifiable hypotheses ordered by the cheapest test. It runs in two modes: interactive, where it asks you one question at a time with a recommended answer, and solo, where it writes the full analysis for you.

## Install

1. Copy this folder into your skills directory: `cp -R first-principle-thinking ~/.claude/skills/`
2. Start a new Claude Code session. The skill fires on phrases such as "think from first principles", "what is the root cause of this plan", "challenge my assumptions", or the Thai "คิดแบบ first principle".
3. Optional: set where analyses are saved. By default they go to `~/.claude/me/thinking/`. Tell Claude another folder, or set `ME_DIR` in your environment (the skill checks it before saving).

## Files

- `SKILL.md`: the eight steps, each with a completion criterion.
- `references/assumption-tags.md`: the four tags and how to test them.
- `references/question-ladder.md`: the three rungs and the hypothesis format.
- `references/interactive-mode.md`: the one-question-at-a-time script.
- `references/output-template.md`: the structure of the written analysis.

No scripts, no network access, no personal data inside the folder.

Self-contained. Optional companions from the same pack, if installed: `crazy-one` (turning released assumptions into bold ideas) and any grilling-style skill for stress-testing a plan you already have.
