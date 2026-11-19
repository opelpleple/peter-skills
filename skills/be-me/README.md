# be-me

A Claude Code skill that drafts messages the way you write them, adjusted to who is receiving them.

It learns from messages you actually sent: length, particles (ครับ, นะ, หน่อย ...), Thai and English mixing, regional dialect, laughter, how you ask, agree, push back and praise. Then it keeps one card per person you talk to, with a closeness level from 1 (formal) to 5 (intimate), how you address them and how you refer to yourself with them. When you ask for a draft, it loads your global voice, overlays that person's card, and shows you the draft. It never sends.

## Install
Get the `be-me` folder from https://github.com/opelpleple/peter-skills (it is `skills/be-me`), then from the `skills/` folder:
```
cp -r be-me ~/.claude/skills/
sh ~/.claude/skills/be-me/tests/smoke.sh        # prints "be-me smoke test: ok"
mkdir -p ~/.claude/me/voice/raw && chmod 700 ~/.claude/me/voice ~/.claude/me/voice/raw
```
Python 3 standard library only. Only `export_slack.py` touches the network, and only to read from Slack.

## Build your profile
1. Export your own messages. Slack (needs a user token with `search:read` and `users:read`):
   ```
   SLACK_USER_TOKEN=xoxp-... python3 ~/.claude/skills/be-me/scripts/export_slack.py ~/.claude/me/voice/raw/slack.json --since 2025-01-01
   ```
   LINE and email: see `references/export-adapters.md` for the shape to write.
2. Measure:
   ```
   python3 ~/.claude/skills/be-me/scripts/ingest_slack.py ~/.claude/me/voice/raw/slack.json ~/.claude/me/voice/stats.json
   ```
3. Ask Claude: "learn how I write from my Slack export". It reads samples, writes `VOICE.md`, scores contacts into `overlay.json` and runs `build_cards.py`.

`BE_ME_DIR` is a convention the agent follows if you keep the profile elsewhere; the scripts themselves take every path as an argument.

## Use
"draft a message to Alex asking for the weekly status", "ตอบแทนผมหน่อย", "reply as me".

## Files
- `SKILL.md` the two branches: draft, build profile
- `scripts/export_slack.py` read-only Slack export into the input shape
- `scripts/ingest_slack.py` stats per contact and global
- `scripts/sample_messages.py` read real lines for one contact before judging (ids, emails and numbers masked)
- `scripts/build_cards.py` cards and index from stats plus your reviewed overlay
- `references/` voice rubric, closeness scale, drafting rules, export adapters, example input and overlay JSON
- `tests/` fictional fixture and `smoke.sh`

## Privacy
The skill folder contains no personal data. Your profile lives in `~/.claude/me/voice/`, files are chmod 600, and raw exports never leave your machine. Exports can contain other people's data and secrets you once pasted; do not share `raw/`, `stats.json` or the cards. Cards hold abstract patterns, not your messages.
