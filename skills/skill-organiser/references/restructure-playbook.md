# Restructure playbook

The goal is a library where any skill can tell the agent what came before it and what comes next, and where each
user phrase reaches exactly one skill. Prefer the smallest edit that gets there.

## Broken or one sided chains

A chain hop is healthy when both ends say it:

- the upstream skill ends its last step with `Hands off to `next-skill`` and what it hands over (file, brief, id);
- the downstream skill has `Receives from `prev-skill`` and what it expects to find.

If only a third skill (often a router or a pipeline README) writes the chain down, add the two lines.
Proposal kind `works-with`, op `add_works_with`. Put the line under a `## Works with` heading at the end.

Good line: `- Hands off to <edit skill>: the approved takes folder and shot list.`
Weak line: `- See also <edit skill>.` (says nothing about direction or payload).

## Trigger collisions and rival skills

Decide the owner by asking which skill the user would be disappointed not to get. Then:

1. keep the phrase in the owner's description;
2. in the other skill, replace it with its distinct branch, and add a routing line in the body:
   `For X use `owner-skill` instead.`

If two skills are the same skill installed twice (overlap 1.0, or same `name:`), recommend the user keeps one and
uninstalls the other themselves. This skill never deletes.

Family pairs that look alike on purpose (a move library and the scene skill that uses it, a planner and a doer)
only need the routing line, not a rename.

## Oversized SKILL.md

Move reference, keep steps. Good candidates: catalogues, long examples, provider tables, idea banks, troubleshooting.
Poor candidates: the ordered steps, gates, and anything the agent must do on every run.
The move leaves the heading and a pointer line, so the agent still knows the material exists. Reword the pointer
to say when to read it (`Read references/x.md before choosing a provider`) after applying.

## Orphans

Three possible answers, in order of preference:

1. It belongs in a chain: add `Works with` lines on both sides (the proposal names the closest skills by description).
2. It is a standalone tool by design: leave it, note it in the report.
3. It duplicates a better skill: report it for the user to retire.

## Dead references

Fix the path if the file moved, create the file if the pointer was a promise never kept, or reword the line if the
path is meant for the user's project (write "in your project, ...").

## Managed skills

Skills synced from claude.ai, installed by a plugin, or symlinked from another repo get overwritten. Propose the
change, but the edit belongs in the source (claude.ai skill editor, the plugin repo, the linked repo).

## Order of work

Dead refs and broken chains first (they make the agent fail), collisions next (they make it pick wrong), then
size and orphans (they make it slow or unaware). Re-scan after each batch.
