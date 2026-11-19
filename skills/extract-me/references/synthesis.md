# Synthesis rules

How to turn `scan.json` plus what you read into `PROFILE.md` and the domain files.

## What counts as evidence

An evidence item is a path on this machine plus a count that a reader could re-check:
- a git repo with the user's commits (`~/code/app` (137 of 158 commits)),
- a folder project with outputs (`~/films/x, 540 renders`),
- a skill the user wrote (`skills/film-script`),
- a loose deliverable (`~/Plan-2027.html`),
- a memory heading that records a finished piece of work.

Ranked weakest to strongest: a keyword in a folder name < a manifest dependency < files of the domain's type < the user's commits < a finished deliverable or a skill they wrote that encodes the method. Prefer the strong end. A domain whose only evidence is keyword hits is not a strength.

## Thresholds

- **Strength**: at least 3 evidence items from at least 2 different kinds (e.g. repos plus a skill, or folders plus deliverables). Rank strengths by how much finished output they carry, not by score.
- **Domain file**: write `<domain>.md` for each strength. Domains below the bar go in `## Also seen` in one line each.
- **Active**: touched in the last 30 days (`last_mine` for repos, `last_touched` for folders, `modified` for loose files). Mention up to 8, grouped.

## Writing a strength

One line of claim, then evidence. The claim names what the user does and at what level, in plain verbs ("builds code-rendered motion films end to end", not "passionate about motion"). Evidence lists 2 to 5 items with counts. If the scan shows a method repeated across projects (same toolchain, same pipeline shape), name it as a **signature method** instead of repeating it under each strength.

## Working style

Infer only from observable patterns: how work is laid out (one repo per product, `final-cut/` per film, evidence folders), which rules recur in memory headings (for example a style rule repeated across projects), cadence (active months), how much is agent-built versus hand-committed. Each style line cites where you saw it. No personality adjectives.

## Domain file shape

`# <domain>`; `## What the user does here` (3 to 6 lines); `## Evidence` (table: path, kind, count, last touched); `## Methods and tools` (from manifests and skills); `## Open threads` (unfinished items visible in memory or folder names); `## Use this when` (one line for other skills).

## Checks before you stop

- Every number in the profile appears in `scan.json` or in a file you read.
- Nothing in the profile is a secret, a credential, a person's salary or a client's private figure. Business names may appear in the private profile; they never appear in a shared summary (see privacy.md).
- Rerunning on an unchanged machine would give the same strengths in the same order.
