# How the scanner decides, and where it is wrong

The scanner reads text only. It never runs a skill. Every finding is a lead to confirm by reading the files.

## Discovery

- Walks each root for `SKILL.md`, following symlinks once (a skill reached twice through two links counts once).
- Skips `.git`, `node_modules`, dot folders and folders whose name contains `.bak`, `.old` or `.orig`
  (listed in the report as backup copies, because a stale copy can still be loaded by some hosts).
- A skill nested inside another folder (a collection folder holding many skills) gets the folder as its family.
- `managed` marks skills that will be overwritten if edited locally: anything under `synced/` (claude.ai sync),
  the plugin cache, or a symlink whose real path is outside the root.

## Frontmatter

Reads `name`, `description` (plain, quoted, or folded `>` / `|` blocks) and `disable-model-invocation`.
User invoked skills are left out of collision checks, since the agent never picks them on its own.

## Triggers

Trigger phrases are the quoted strings inside the description (`"..."` or curly quotes), lowercased.
Blind spot: a description that lists triggers without quotes yields no triggers, so its collisions are invisible.
The overlap check (below) partly covers that case.

## Edges

For every line of the description, SKILL.md and every `.md`/`.txt` file in the skill (examples folder excluded):

- Names with a hyphen or 9+ characters match as whole words.
- Short single word names are common English, so they only match as inline code, a slash command, or next to
  the word skill (for a skill named NAME: backticked NAME, /NAME, or NAME skill).
- A line that names two or more skills joined by arrows (`->`, Unicode right arrow, `=>`) is a written pipeline:
  each named skill links to the next in reading order, even when the line lives in a third skill.
- Otherwise the line is classified, with the matched name removed first so a skill whose name is itself a keyword
  (a skill named after the word hand-off, say) does not trigger the keyword:
  - routes when it says instead, not this, use X for, owned by, NOT for, route, or has a single arrow;
  - handoff reversed when it says receives from, fed by, comes after, downstream of;
  - handoff when it says hand off, handoff, pass to, then run/use/load, feeds into, next step, continue with;
  - mentions otherwise.
- When a pair is linked by several lines, the strongest kind wins (handoff > routes > mentions).

Known misses: prose like "after the script is approved, shoot it" with no skill name; links written only in a
README; pipelines described in a table. Known false hits: example commands that contain a skill name, and long
paragraphs where an arrow and two names happen to share a line.

## Chains

Depth first search over handoff edges, paths of 3 to 7 skills, keeping only maximal paths with distinct node sets.
A chain is only as good as its weakest hop; read the evidence for each hop before presenting it.

## Overlap

Jaccard similarity of content words in two descriptions (stop words removed). Pairs at 0.30 or more outside one
family are listed. 1.0 nearly always means the same skill installed twice under two names.

## Oversized

SKILL.md over 250 lines, or description over 1024 characters. The proposal picks the largest `## ` section as the
first candidate to move; a human should check it is reference material and not a step the agent needs every run.

## Dead refs

Markdown links outside code fences, and code spans starting with `references/`, `scripts/`, `templates/`,
`assets/`, `reference/`, resolved against the skill folder. URLs, absolute paths, `~` paths and placeholders are
ignored. Common false positive: a path meant for the user's project (a per-episode script file) or a sibling skill's
folder written without `../`.
