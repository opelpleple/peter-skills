---
name: extract-me
description: Build or refresh an evidence-backed expertise profile of the user from the work on their machine (repos, project folders, deliverables, skills they wrote, memory notes), so other skills can personalise. Use when the user says "extract me", "what am I good at", "summarise my strengths", "profile my work", "what am I working on across my machine", "update my expertise profile", "สรุปความเก่งของผม", "ผมเก่งด้านไหน", "สรุปงานที่ทำอยู่ทั้งเครื่องเป็นโปรไฟล์", "ดึงตัวตนการทำงาน", "อัปเดตโปรไฟล์ความเชี่ยวชาญ". Not for daily status, standups, dashboard or task summaries. Also when another skill needs the user's strengths or active projects and `~/.claude/me/expertise/PROFILE.md` is missing or stale.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(python3:*), Bash(chmod:*), Bash(mkdir:*), Bash(git config:*), Bash(sh:*)
---

An **expertise profile** is a short list of the user's strengths, each one carrying its **evidence** (paths and counts on this machine), plus what they are working on now and how they work. A strength without evidence is a guess and does not go in. The profile is for other skills to load, so its headings are a contract.

Paths:
- `$SKILL` = this skill's folder (default `~/.claude/skills/extract-me`).
- `$ME_DIR` = the personal dir, default `~/.claude/me` (chmod 700). Output goes to `$ME_DIR/expertise/`. The scripts take every path as an argument; `$ME_DIR` is a convention you follow.

Outputs in `$ME_DIR/expertise/`: `config.json` (identities, roots, globs), `scan.json` (raw metadata, never shared), `authorship.json` (which skills the user wrote), `PROFILE.md`, one `<domain>.md` per strong domain, `CHANGELOG.md`.

## Branch A: build or refresh the profile

1. **Configure.** Read `$ME_DIR/expertise/config.json` if it exists. Otherwise collect: git identities (`git config --global user.name`, `user.email`, plus any handle the user names), roots (default `~/repo ~/code ~/projects`, plus folders the user names), loose deliverable globs (e.g. `~/*.html`, `~/*.pdf`, `~/*.pptx`), memory files. Show the list and ask once before scanning. Save it as `config.json`. Done when the user has confirmed the roots.
2. **Scan.** `mkdir -p $ME_DIR/expertise && chmod 700 $ME_DIR $ME_DIR/expertise`, then
   `python3 $SKILL/scripts/scan.py --identity <id> ... --root <dir> ... --loose-glob '<glob>' ... --memory-file <file> --out $ME_DIR/expertise/scan.json`.
   It reads metadata only and skips secret-looking files, dot-dirs, `node_modules`, build output and `*/references/*` (third-party material). Done when it prints totals and a domain table.
3. **Settle authorship.** The scanner only guesses which skills are the user's (symlinks, LICENSE files, author fields and vendor-pack prefixes count against). For every skill without a signal, read its frontmatter and first lines and decide: `authored`, `not_mine`, `unsure`. Write `authorship.json` with the three lists. Done when every skill in `scan.json` is in exactly one list.
4. **Read before judging.** Scores rank domains; they do not prove anything. For each domain scoring in the top half, open its top evidence: README first lines, manifests, folder names, memory headings and the loose deliverables. Note what was actually built and when. Commit counts undercount work an agent produced in plain folders, so a `folder` project with hundreds of renders is real evidence. Done when every domain you will claim has at least three evidence items you looked at.
5. **Write the profile.** Follow [synthesis.md](references/synthesis.md) and the shape in [profile-template.md](references/profile-template.md). `PROFILE.md` stays under 120 lines. Each domain over the threshold in synthesis.md gets its own `<domain>.md`. Done when every strength line names at least two evidence paths with counts and every active project names its last-touched date.
6. **Check and lock.** `python3 $SKILL/scripts/check_profile.py $ME_DIR/expertise` (headings, evidence paths exist, no secret-looking strings, no long dashes). Fix what it flags. `chmod 600` every file. Append one dated line to `CHANGELOG.md` saying what moved since the last run. Done when the check prints `OK`.

## Branch B: another skill loads the profile

Read `$ME_DIR/expertise/PROFILE.md`. Use `## Strengths` to pick the register and the methods the user already trusts, `## Active work` to avoid proposing what is already being built, `## Signature methods` to reuse their way of working, and the matching `<domain>.md` for depth. If `PROFILE.md` is older than 30 days (its `updated:` line), say so and offer Branch A. Never copy profile text into anything shared; it is input, not content.

## Branch C: anonymised summary for sharing

When the user wants a public version (portfolio, bio, team intro), write it from `PROFILE.md` with the rules in [privacy.md](references/privacy.md): domain names, evidence counts and project categories only. Then run `python3 $SKILL/scripts/check_profile.py --shared <file> --scan $ME_DIR/expertise/scan.json` (add `--names <file>` with any client or colleague names you know of) then fix every home path, email and URL it flags and review each flagged author or project folder name (common words can be false alarms). Show it before saving anywhere outside `$ME_DIR`.

## Works with
- **be-me**: voice for messages; extract-me gives the substance of what the user does.
- **skill-organiser**: reads `authorship.json` to know which skills are the user's own.
- **present-like-peter**, **video-like-peter**: load `decks.md` and `motion.md` for the user's proven methods before starting.
- **first-principle-thinking**, **crazy-one**: load `## Strengths` and `## Active work` so questions and ideas fit what the user can actually ship.

## Hard edges
- Read-only toward everything it scans. The scanner never opens file bodies except manifests, README first lines and frontmatter, and never touches `.env*`, keys, tokens, credentials, `~/.ssh` or secrets folders.
- `scan.json` holds real paths and project names. It stays in `$ME_DIR`, chmod 600.
- The skill folder holds the engine only. Run `sh $SKILL/tests/smoke.sh` after editing the scripts.
