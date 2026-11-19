# Export adapters

`ingest_slack.py` reads one JSON shape. Any source works if an adapter writes it:

```json
{
  "users": {"U123": {"name": "Full Name", "display": "Nick (Nickname)", "bot": false, "deleted": false, "title": "Role"}},
  "messages": [
    {"ts": "1700000000.000100", "text": "message text", "channel_id": "D123", "channel_name": "U123",
     "is_im": true, "is_mpim": false, "is_private": true, "thread": false, "partner": "U123"}
  ]
}
```
Rules: every message is written by the user. `partner` is set for one-to-one conversations. Group messages leave it empty; people @mentioned as `<@U123>` are counted as weaker evidence. `ts` is Unix seconds as a string. Put nicknames in parentheses in `display`; cards use them as labels.

Full examples: [input.example.json](input.example.json) for this shape, [overlay.example.json](overlay.example.json) for the reviewed overlay that `build_cards.py` reads. `stats.json` is whatever `ingest_slack.py` writes; do not hand-edit it.

## Slack (ready: `scripts/export_slack.py`)
`python3 scripts/export_slack.py OUT.json --token-file <file>` (or `SLACK_USER_TOKEN`). Read-only, paginated, month by month, chmod 600. What it does, in case you need to adapt it:
1. `users.list` (paginate) to build `users` (`real_name`, `profile.display_name`, `is_bot`, `deleted`, `profile.title`).
2. `search.messages` with `query=from:<@YOUR_ID>`, `count=100`, `sort=timestamp`, paginate `page` (Slack caps search at about 100 pages; split by `after:`/`before:` dates to go past 10,000).
3. For each match: `channel.id`, `channel.name`, `channel.is_im`, `channel.is_mpim`, `channel.is_private`; for DMs `partner = channel.user` (or look up `conversations.info`). `thread` = `"thread_ts" in match and match["thread_ts"] != match["ts"]`.
4. Write the file under `<profile>/raw/slack.json`, chmod 600.
Run the export on the machine that already holds the token; do not move the token.

## LINE (adapter to write)
LINE chat export (`Chat with X.txt`) is per conversation: date header lines, then `HH:MM<TAB>Sender<TAB>Text`.
- Keep lines where Sender is the user. One file = one partner; use a stable slug of the file name as the partner id and fill `users` with the name.
- Join multi-line messages (lines without a leading time) to the previous message.
- `is_im` true for one-to-one exports, false for groups (`partner` empty).

## Email (adapter to write)
From an mbox or a mail API, take messages in Sent.
- `partner` = the single To address (skip mail with many recipients or mark it group).
- `text` = the body before the quoted reply (`On ... wrote:` / `-----Original Message-----`), signature stripped.
- Email runs longer and more formal than chat; profile it separately (`raw/email.json`, separate stats) rather than mixing with chat.

## Privacy
Exports contain other people's messages only as context you should drop, plus possible secrets the user pasted. Keep `raw/` local, never commit it, never paste from it into a draft.
