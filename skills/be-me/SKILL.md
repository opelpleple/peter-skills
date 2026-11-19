---
name: be-me
description: This skill should be used when drafting or replying to a chat or email message to a specific person in the user's own voice, from a profile learned from their real messages ("draft a message to", "reply as me", "in my voice", "ร่างข้อความ", "ร่างอีเมล", "ตอบแทนผม", "ช่วยตอบ", "ตอบไลน์", "ตอบแชท", "เขียนแบบผม"), or building the profile ("learn how I write", "update my contacts", "อัปเดตรายชื่อ", "อัปเดตโปรไฟล์เสียง"). Not for public posts or documents.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(python3:*), Bash(chmod:*), Bash(mkdir:*)
---

A **voice profile** is the user's measured habits (length, particles, language mix, dialect, how they ask, push back, praise) plus one **contact card** per partner (closeness 1 to 5, register, address form, topics). Drafting = global voice, overlaid by the card, matched to the person. The skill only drafts. Sending is always the user's act.

Paths used below:
- `$SKILL` = this skill's folder (default `~/.claude/skills/be-me`).
- `$BE_ME_DIR` = the profile dir, default `~/.claude/me/voice`. The scripts take every path as an argument; `$BE_ME_DIR` is a convention you follow, not something the scripts read.

Profile files: `VOICE.md` (global rules), `contacts/<slug>.md` (one card each), `contacts/INDEX.md`, `stats.json` (measured), `overlay.json` (human-reviewed card fields, shape in [overlay.example.json](references/overlay.example.json)), `raw/` (exports, never leaves the machine).

## Branch A: draft a message (the common path)

1. **Load.** Read `$BE_ME_DIR/VOICE.md`. Find the recipient in `$BE_ME_DIR/contacts/INDEX.md` by name, nickname or id and read the card. No profile yet: tell the user and offer Branch B. Recipient missing: draft with the "unknown recipient" rule in [drafting.md](references/drafting.md) and say so.
2. **Pin the facts.** List what the message must carry using only what the user gave or what is in front of you. Anything unknown becomes a `[placeholder]`. Done when every claim in the draft traces to the request.
3. **Write to the card.** Length, opener, address form, self-reference, particle rate, language and dialect come from the card; everything else from `VOICE.md`. Follow [drafting.md](references/drafting.md). Done when each line passes its checklist.
4. **Show, do not send.** Present the draft (plus one alternative if closeness is uncertain or marked inferred) with a one-line note on which card rules shaped it. Wait. If the user wants it sent, that is a separate, explicitly approved action through whatever tool they choose, never this skill.

## Branch B: build or refresh the profile

1. **Export.** Ask before running any export that uses a token; it only reads, never posts. Slack: `python3 $SKILL/scripts/export_slack.py $BE_ME_DIR/raw/slack.json --token-file <file>` (or `SLACK_USER_TOKEN` in the env). Other sources: write the shape in [export-adapters.md](references/export-adapters.md). First run: `mkdir -p $BE_ME_DIR/raw && chmod 700 $BE_ME_DIR $BE_ME_DIR/raw`.
2. **Measure.** `python3 $SKILL/scripts/ingest_slack.py $BE_ME_DIR/raw/slack.json $BE_ME_DIR/stats.json` (add `--tz-offset`). Done when it prints a contact count.
3. **Read before judging.** For each top partner run `python3 $SKILL/scripts/sample_messages.py $BE_ME_DIR/raw/slack.json --partner <id> -n 12` and read the lines. Stats alone mislead (a substring match is not a habit).
4. **Judge.** Write `$BE_ME_DIR/VOICE.md` with the rubric in [voice-rubric.md](references/voice-rubric.md). Put reviewed closeness, address form, self-reference, topics, typical patterns, do and avoid per contact into `$BE_ME_DIR/overlay.json`, scored with [closeness-scale.md](references/closeness-scale.md). Count before you write a rate word: "freely", "always" and "every line" need a measured share behind them. Done when every contact in the top 40 has a reviewed closeness or is explicitly skipped (bots, deactivated, dormant).
5. **Cards.** `python3 $SKILL/scripts/build_cards.py $BE_ME_DIR/stats.json $BE_ME_DIR --overlay $BE_ME_DIR/overlay.json --raw $BE_ME_DIR/raw/slack.json --top 40`. `--raw` drops any typical line that copies a real message. Re-running rewrites measured blocks and keeps overlay judgement.
6. **Lock down.** chmod 600 every file. Typical lines are abstract patterns (`name + ครับ + one-line ask`), never real lines, and never anything with names of clients, money, IDs, credentials or URLs.

## Checking fidelity (optional)
To test a profile, keep the test blind: one agent picks a few real messages and writes only the situation ("put off a meeting time until he checks his schedule"); a second agent drafts from the situation plus `VOICE.md` and the card, without the real line; then compare. Drafting with the real line in view, or from a card that quotes it, inflates the match. Exports hold only the user's side, so the situation has to be stated, not inferred by the drafter.

## Hard edges
- The skill folder holds engine only. Real messages, names and profiles live in the profile dir.
- Raw exports can contain secrets and other people's personal data. They stay local and are never pasted into a draft, a card or anything shared.
- Messages the user sent but an AI wrote (long templated posts) are not their voice; down-weight them.
- Run `sh $SKILL/tests/smoke.sh` after installing or editing the scripts.
