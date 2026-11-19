# extract-me

Your machine already knows what you are good at: which repos carry your commits, which folders are full of finished renders, which decks you shipped last month, which workflows you turned into skills. extract-me reads that as metadata only (no file bodies, never secrets), scores it into domains, and has Claude write an evidence-backed expertise profile: top strengths with paths and counts, signature methods, active work and working style. Other skills load the profile so their output fits what you actually do.

## Install

```sh
cp -r extract-me ~/.claude/skills/
sh ~/.claude/skills/extract-me/tests/smoke.sh   # should print: smoke OK
```

Needs `python3` (standard library only) and `git` on the PATH.

## Use

Ask Claude "extract me" or "what am I good at". It will:
1. confirm your git identities and the folders to scan,
2. run `scripts/scan.py` (read-only, a few seconds for a hundred projects),
3. settle which installed skills you wrote,
4. read the top evidence per domain, then write `PROFILE.md` and one file per strong domain,
5. lint it with `scripts/check_profile.py`.

Output goes to `~/.claude/me/expertise/` (configurable; keep it chmod 700). Nothing leaves your machine. Domain rules live in `references/domains.json`; edit them to add your own fields.

## Files
- `SKILL.md`: the steps Claude follows.
- `scripts/scan.py`: metadata scanner. `scripts/check_profile.py`: profile lint (also `--shared FILE` for public summaries).
- `references/`: synthesis rules, profile template, privacy rules, domain keyword rules.
