# crazy-one

A Claude Code skill that reads any document (a plan, a brief, a concept, a PRD) and comes back with three crazy but doable ideas plus one wildcard. It does not brainstorm at random: it first finds the goal behind the document and the assumptions the document never questions, then breaks those assumptions on purpose with eight named operators (invert, 10x, delete the core, steal from another industry, make it free, make the customer do it, time travel 10 years, constraint flip). Every idea goes through a kill pass for harm, deception, law and invented facts, then gets scored for impact, feasibility, reversibility and craziness. Each surviving bet ships with a first step that one person can do in under a day, without spending money or publishing anything. A dial sets how far it goes: `sane`, `bold` (default) or `unhinged`.

## Install

1. Copy this folder to `~/.claude/skills/crazy-one/` (keep `SKILL.md` and `references/` together).
2. Restart Claude Code, or start a new session.
3. Optional: set `CRAZY_ONE_OUT` to the folder where runs should be saved. The default is `~/.claude/me/crazy-one/runs/`, which keeps runs (they quote your documents) outside the skill folder.

## Use

- "crazy-one this: path/to/plan.md"
- "Give me unhinged ideas for this brief"
- "ไอเดียบ้าๆ สำหรับเอกสารนี้หน่อย"

## Files

- `SKILL.md`: the six steps and the rules.
- `references/operators.md`: the eight operators, with prompts and quotas per dial.
- `references/scoring.md`: the kill list, the four scoring axes, ranking and the first step test.
- `references/output-template.md`: the shape of the saved run.

## Companion skills (optional)

crazy-one works alone. It hands off to other skills only when they are installed:

- Same pack (Peter's skill set, copy each folder into `~/.claude/skills/` the same way): `first-principle-thinking`, `be-me`, `extract-me`, `skill-organiser`, `present-like-peter`, `video-like-peter`.
- Not in this pack, use only if you already have them: `grilling`, `decision-mapping`, `plan-me`. Without them, ask Claude directly to question the chosen bet or to turn it into a plan.
