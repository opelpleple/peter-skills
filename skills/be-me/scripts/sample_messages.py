#!/usr/bin/env python3
"""sample_messages.py: print a spread of real messages for one contact so the
agent can read tone before writing a contact card. Output goes to the
terminal only; never paste it into the skill folder or anything public.

  python3 sample_messages.py IN.json --partner U123 [-n 20] [--max-chars 160]
  python3 sample_messages.py IN.json --channel general -n 20
  python3 sample_messages.py IN.json --grep "ขอบคุณ" -n 20

Picks messages spread evenly across time, preferring ones with words
(skips file-only and link-only lines). Links, emails, @mentions and long
digit runs are masked so ids, phone numbers and amounts do not reach the
agent's context.
"""
import argparse
import datetime as dt
import json
import re

MASKS = [
    (re.compile(r"<https?://[^>]+>|https?://\S+"), "[link]"),
    (re.compile(r"<mailto:[^>]+>|[\w.+-]+@[\w-]+\.[\w.]+"), "[email]"),
    (re.compile(r"<@[UW][A-Z0-9]+(\|[^>]*)?>"), "[@someone]"),
    (re.compile(r"<#[A-Z0-9]+(\|[^>]*)?>"), "[#channel]"),
    (re.compile(r"\d[\d,.\-]{4,}\d"), "[number]"),
]


def mask(text):
    t = text or ""
    for rx, rep in MASKS:
        t = rx.sub(rep, t)
    return t.replace("\n", " / ").strip()


def mentions(uid):
    return re.compile(r"<@" + re.escape(uid) + r"[|>]")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("inp")
    ap.add_argument("--partner")
    ap.add_argument("--channel")
    ap.add_argument("--grep")
    ap.add_argument("-n", type=int, default=20)
    ap.add_argument("--max-chars", type=int, default=160)
    ap.add_argument("--min-chars", type=int, default=6)
    a = ap.parse_args()
    ms = json.load(open(a.inp, encoding="utf-8"))["messages"]
    if a.partner:
        rx = mentions(a.partner)
        ms = [m for m in ms if m.get("partner") == a.partner or rx.search(m.get("text") or "")]
    if a.channel:
        ms = [m for m in ms if m.get("channel_name") == a.channel]
    if a.grep:
        ms = [m for m in ms if re.search(a.grep, m.get("text") or "", re.I)]
    bare = lambda m: re.sub(r"\[(link|email|@someone|#channel|number)\]", "", mask(m.get("text"))).strip()
    ms = [m for m in ms if len(bare(m)) >= a.min_chars]
    ms.sort(key=lambda m: float(m["ts"]))
    if not ms:
        raise SystemExit("no messages")
    step = max(1, len(ms) // a.n)
    for m in ms[::step][: a.n]:
        day = dt.datetime.fromtimestamp(float(m["ts"]), dt.timezone.utc).strftime("%Y-%m-%d")
        where = "DM" if m.get("is_im") else "#" + (m.get("channel_name") or "?")
        print(f"{day} {where:<14} {mask(m.get('text'))[: a.max_chars]}")


if __name__ == "__main__":
    main()
