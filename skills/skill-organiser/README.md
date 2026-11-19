# skill-organiser

Your skills folder grows one install at a time, and nobody draws the map: two skills claim the same phrase, a
pipeline lives only in one SKILL.md, a file grows to 900 lines, a pointer leads to a file that was never written.
skill-organiser reads every installed skill with a small Python script (standard library only), builds the map
(families, handoff edges, chains, trigger collisions, overlaps, orphans, oversized files, dead references), and
proposes the smallest edits that make the skills chain. The scan is read only. Edits happen only for proposals you
pick by id, only add `Works with` lines or move one bulky section into `references/`, back up every file first,
and never delete a skill.

## Install

```bash
rsync -a --exclude __pycache__ skill-organiser ~/.claude/skills/
# or: cp -R skill-organiser ~/.claude/skills/ && rm -rf ~/.claude/skills/skill-organiser/scripts/__pycache__
```

Then ask Claude Code: "organise my skills" or "จัดระเบียบ skill".

## Run by hand

```bash
python3 ~/.claude/skills/skill-organiser/scripts/skillmap.py              # scan ~/.claude/skills
python3 ~/.claude/skills/skill-organiser/scripts/skillmap.py --plugins    # include plugin skills
python3 ~/.claude/skills/skill-organiser/scripts/apply.py \
  --proposals ~/.claude/me/skill-organiser/proposals.json --ids P001      # dry run
python3 ~/.claude/skills/skill-organiser/scripts/apply.py \
  --proposals ~/.claude/me/skill-organiser/proposals.json --restore <timestamp>  # undo a run (add --yes)
python3 ~/.claude/skills/skill-organiser/scripts/skillmap.py --public \
  --keep '*' --hide 'acme-*,*internal*' --graph ~/map-public.json            # a map you can share
```

`--public` writes `SKILLS-MAP.public.md` beside the private map. Names that do not match `--keep` (default: none
but skill-organiser itself), or that match `--hide`, become `skill-001`, `skill-002` ...; families with a hidden
member become `family-A` ...; paths, section headings, description words and reference paths are left out, and a
trigger phrase is shown only when every skill claiming it is shown. Read the file before you publish it.

Outputs go to `~/.claude/me/skill-organiser/` (`SKILLS-MAP.md`, `skills-map.json`, `proposals.json`).
Change it with `--out DIR`, or the `ME_DIR` / `SKILL_ORGANISER_OUT` environment variables.

Requires Python 3.9 or newer. No packages, no network.

## Sibling skills

skill-organiser was written alongside a small set of personal-workflow skills (a voice profile skill, a
work-profile extractor, a presentation skill, a motion-film skill, `first-principle-thinking` and `crazy-one`).
None are required. If you install any of them, run skill-organiser afterwards to wire them into your existing
pipelines.
