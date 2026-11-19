#!/usr/bin/env python3
"""export_slack.py: export messages YOU wrote on Slack into the be-me input shape.

Read-only. Calls auth.test, users.list and search.messages; never posts.

  SLACK_USER_TOKEN=xoxp-... python3 export_slack.py OUT.json [--since 2025-01-01]
  python3 export_slack.py OUT.json --token-file /path/to/slack-token-file

The token needs search:read and users:read. It is read from the env var or
file and never printed or written anywhere. Run this on the machine that
already holds the token; do not copy the token around.

Slack search returns at most about 100 pages per query, so the export walks
one calendar month at a time (after:/before:) and de-duplicates by channel
and timestamp. Output is written with chmod 600.
"""
import argparse
import datetime as dt
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

API = "https://slack.com/api/"


def call(token, method, **params):
    url = API + method + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"Authorization": "Bearer " + token})
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                body = json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(int(e.headers.get("Retry-After", "5")) + 1)
                continue
            raise
        if body.get("ok"):
            return body
        if body.get("error") == "ratelimited":
            time.sleep(5 * (attempt + 1))
            continue
        raise SystemExit(f"{method} failed: {body.get('error')}")
    raise SystemExit(f"{method}: rate limited too many times")


def users_map(token):
    out, cursor = {}, ""
    while True:
        b = call(token, "users.list", limit=200, cursor=cursor)
        for u in b.get("members", []):
            p = u.get("profile", {})
            out[u["id"]] = {
                "name": u.get("real_name") or p.get("real_name") or u.get("name"),
                "display": p.get("display_name") or "",
                "bot": bool(u.get("is_bot")) or u["id"] == "USLACKBOT",
                "deleted": bool(u.get("deleted")),
                "title": p.get("title") or "",
            }
        cursor = b.get("response_metadata", {}).get("next_cursor") or ""
        if not cursor:
            return out
        time.sleep(1)


def months(since, until):
    d = since.replace(day=1)
    while d <= until:
        nxt = (d.replace(day=28) + dt.timedelta(days=4)).replace(day=1)
        yield d, nxt
        d = nxt


def search_window(token, me, start, end):
    # after:/before: are exclusive, so widen by one day each side; dedupe later.
    q = f"from:<@{me}> after:{(start - dt.timedelta(days=1)).isoformat()} before:{end.isoformat()}"
    page, out = 1, []
    while True:
        b = call(token, "search.messages", query=q, count=100, sort="timestamp", sort_dir="asc", page=page)
        msgs = b.get("messages", {})
        out += msgs.get("matches", [])
        pages = msgs.get("paging", {}).get("pages", 1)
        if page >= pages or page >= 100:
            if page >= 100 and pages > 100:
                print(f"warning: window {start} hit the 100-page cap; some messages are missing", file=sys.stderr)
            return out
        page += 1
        time.sleep(1.2)


def shape(match, users):
    ch = match.get("channel") or {}
    is_im = bool(ch.get("is_im"))
    partner = ""
    if is_im:
        partner = ch.get("user") or (ch.get("name") if str(ch.get("name", "")).startswith(("U", "W")) else "")
    return {
        "ts": match.get("ts"),
        "text": match.get("text") or "",
        "channel_id": ch.get("id"),
        "channel_name": ch.get("name"),
        "is_im": is_im,
        "is_mpim": bool(ch.get("is_mpim")),
        "is_private": bool(ch.get("is_private")),
        "thread": "thread_ts" in match and match.get("thread_ts") != match.get("ts"),
        "partner": partner,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--token-file")
    ap.add_argument("--since", default="2024-01-01")
    ap.add_argument("--until", default=dt.date.today().isoformat())
    a = ap.parse_args()
    if a.token_file:
        token = open(os.path.expanduser(a.token_file), encoding="utf-8").read().strip()
    else:
        token = os.environ.get("SLACK_USER_TOKEN", "").strip()
    if not token:
        raise SystemExit("no token: set SLACK_USER_TOKEN or pass --token-file")
    me = call(token, "auth.test")["user_id"]
    users = users_map(token)
    seen, messages = set(), []
    for start, end in months(dt.date.fromisoformat(a.since), dt.date.fromisoformat(a.until)):
        for m in search_window(token, me, start, end):
            if m.get("user") not in (me, None):
                continue
            key = ((m.get("channel") or {}).get("id"), m.get("ts"))
            if key in seen:
                continue
            seen.add(key)
            messages.append(shape(m, users))
        print(f"{start:%Y-%m}: {len(messages)} total", file=sys.stderr)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), mode=0o700, exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump({"me": me, "users": users, "messages": messages}, f, ensure_ascii=False)
    os.chmod(a.out, 0o600)
    print(f"wrote {len(messages)} messages -> {a.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
