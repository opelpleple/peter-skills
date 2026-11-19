#!/usr/bin/env python3
"""build_cards.py: write one contact card per partner from stats.json.

  python3 build_cards.py STATS.json PROFILE_DIR [--overlay overlay.json] [--top 40]
                         [--raw raw/slack.json]

The measured block of each card is regenerated every run. Human-reviewed
judgement (closeness, how you address them, do/don't, topics) lives in an
optional overlay JSON keyed by contact id, so re-running never erases it:
  {"U123": {"label": "Alex", "closeness": 4, "address_as": "น้องเอ",
            "self_as": "พี่", "register": "...", "topics": ["planning"],
            "typical": ["name + ครับ + one-line ask"],
            "do": ["..."], "dont": ["..."], "note": "..."}}
"typical" holds abstract patterns, never real lines. With --raw the script
drops any typical line that copies a specific raw message (the whole message,
or a run of 14+ characters between placeholders, found in fewer than 3
messages) and prints a warning. Phrases used 3+ times count as habits.
See references/overlay.example.json.
Without an overlay entry the card carries an inferred closeness marked
"inferred" and the agent must treat it as a guess.
"""
import argparse, json, os, re, sys

STOP = set("""from with that this have will they them their there what when your about which would could should also just only into than then ครับ ครับผม นะครับ โอเคครับ ได้ครับ ได้ครับผม ขอบคุณครับ ขอบคุณครับผม 555 5555 55555 ok okay
the to and a of is i you we it in for on that this be are can will with my me na krab krub""".split())


def slug(s):
    s = re.sub(r"[^A-Za-z0-9฀-๿]+", "-", s or "").strip("-").lower()
    return s[:40] or "contact"


def infer_closeness(d, dm_n):
    """1 formal .. 5 intimate, from evidence only. Returns (score, reasons)."""
    if not d:
        return 2, ["no direct messages, only channel mentions"]
    s, why = 3.0, []
    pp, lang = d["particles_per_100_msgs"], d["language"]
    krab = pp.get("ครับ", 0)
    if lang["english_only_rate"] > 0.6:
        why.append("writes in English, register read from wording not particles")
    else:
        if krab < 40:
            s += .5; why.append(f"few polite particles ({krab} ครับ per 100 msgs)")
        if krab > 90:
            s -= 1; why.append(f"polite particle on almost every line ({krab} per 100)")
        if pp.get("ครับผม", 0) > 25:
            s -= .5; why.append("frequent deferential ครับผม")
    if d["laugh_rate"] >= .1:
        s += .5; why.append(f"laughs often ({d['laugh_rate']:.0%} of msgs)")
    if d.get("dialect_rate", {}).get("isan", 0) >= .04:
        s += .5; why.append("slips into regional dialect")
    if dm_n >= 300:
        s += .5; why.append(f"high volume ({dm_n} DMs)")
    if dm_n < 30:
        why.append(f"low volume ({dm_n} DMs): treat this card as a guess")
    if d["length_chars"]["p50"] < 12:
        why.append("very short lines")
    return max(1, min(5, round(s))), why


def register_label(c):
    if c <= 1: return "formal"
    if c == 2: return "polite"
    if c == 3: return "polite-casual"
    if c == 4: return "casual"
    return "intimate / banter"


SENSITIVE = re.compile(r"pass|token|secret|key|login|user|otp|@|\d", re.I)
PARTICLE_TAIL = re.compile(r"(ครับผม|ครับ|คับ|นะ|เลย|ไหม|มั้ย|ละ|แล้ว|ๆ)$")


def _dictionary():
    for path in ("/usr/share/dict/words", "/usr/dict/words"):
        try:
            return {w.strip().lower() for w in open(path, encoding="utf-8", errors="ignore")}
        except OSError:
            pass
    return None


WORDS = _dictionary()


def topics(d, n=8):
    """Auto topics: short English work words only. Thai chunks are whole
    phrases (no word breaks) and identifiers can leak, so both are skipped."""
    out = []
    for tok, _ in d.get("top_tokens", []):
        if tok in STOP or SENSITIVE.search(tok) or not re.fullmatch(r"[a-z]{4,14}", tok):
            continue
        if WORDS is not None and tok not in WORDS and tok.rstrip("s") not in WORDS:
            continue  # drops handles, domains and concatenated ids
        out.append(tok)
        if len(out) >= n:
            break
    return out


def nodash(t):
    return t.replace("\u2014", "-").replace("\u2013", "-")


PLACEHOLDER = re.compile(r"\.\.\.|…|\+|\bX\b|\bY\b|/|\(|\)")


def copied_from_raw(line, raw_texts, raw_counts, min_run=14, habit=3):
    """True if a 'typical' line reproduces a specific real message instead of
    a pattern. A phrase found in `habit` or more messages is a habit (stock
    acks like ขอบคุณครับ), not a quote, and is allowed."""
    t = line.strip()
    if len(t) >= 6 and 0 < raw_counts.get(t, 0) < habit:
        return True
    for seg in PLACEHOLDER.split(t):
        seg = seg.strip()
        if len(seg) >= min_run:
            hits = sum(1 for r in raw_texts if seg in r)
            if 0 < hits < habit:
                return True
    return False


def card(c, ov):
    d = c["dm"] or c["in_channels"]
    inferred, why = infer_closeness(c["dm"], c["dm_messages"])
    clos = ov.get("closeness", inferred)
    name = ov.get("label") or (c["nickname_hint"][0] if c.get("nickname_hint") else c.get("name")) or c["id"]
    L = [f"# {name}", ""]
    L += [f"- Full name: {c.get('name')}", f"- Slack id: {c['id']}", f"- Role: {c.get('title') or 'unknown'}"]
    L += [f"- Closeness: {clos}/5 ({'reviewed' if 'closeness' in ov else 'inferred'}; formula suggests {inferred})"]
    L += [f"- Register: {ov.get('register') or register_label(clos)}"]
    if ov.get("address_as"): L.append(f"- Address them as: {ov['address_as']}")
    if ov.get("self_as"): L.append(f"- Refer to yourself as: {ov['self_as']}")
    L.append(f"- Volume: {c['dm_messages']} DMs, {c['mention_messages']} channel mentions")
    if d:
        lang, pp = d["language"], d["particles_per_100_msgs"]
        L.append(f"- Language: Thai chars {lang['thai_char_ratio']:.0%}, English-only msgs {lang['english_only_rate']:.0%}, mixed {lang['mixed_msg_rate']:.0%}")
        L.append(f"- Length: median {d['length_chars']['p50']} chars, {d['length_chars']['share_under_20']:.0%} under 20 chars")
        L.append("- Particles per 100 msgs: " + ", ".join(f"{k} {v}" for k, v in list(pp.items())[:8]))
        L.append("- Line endings: " + ", ".join(f"{k} {v:.0%}" for k, v in list(d["endings"].items())[:5]))
        dr = d.get("dialect_rate") or {}
        if dr: L.append("- Dialect: " + ", ".join(f"{k} {v:.0%}" for k, v in dr.items()) + " (" + ", ".join(w for w, _ in d.get("dialect_words", [])[:5]) + ")")
        L.append(f"- Laugh {d['laugh_rate']:.0%}, emoji per msg {d['emoji_rate']}, questions {d['acts']['question']:.0%}, directives {d['acts']['directive']:.0%}")
    L += ["", "## Why this closeness"] + [f"- {w}" for w in why] + ([f"- Reviewer note: {ov['note']}"] if ov.get("note") else [])
    tp = ov.get("topics")
    label = "## Topics"
    if not tp:
        tp, label = (topics(d) if d else []), "## Topics (auto, English keywords only, review)"
    L += ["", label, "- " + ", ".join(tp) if tp else "- unknown"]
    if ov.get("typical"): L += ["", "## Typical lines (paraphrased patterns, not quotes)"] + [f"- {x}" for x in ov["typical"]]
    L += ["", "## Do"] + [f"- {x}" for x in ov.get("do", ["Match the particle rate and length above."])]
    L += ["", "## Avoid"] + [f"- {x}" for x in ov.get("dont", ["Anything more formal or more intimate than the closeness level."])]
    return nodash(name), clos, nodash("\n".join(L) + "\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("stats"); ap.add_argument("profile_dir")
    ap.add_argument("--overlay"); ap.add_argument("--top", type=int, default=40)
    ap.add_argument("--raw", help="raw export; typical lines copied from it are dropped")
    a = ap.parse_args()
    st = json.load(open(a.stats, encoding="utf-8"))
    ov = json.load(open(a.overlay, encoding="utf-8")) if a.overlay and os.path.exists(a.overlay) else {}
    if a.raw:
        raw_texts = [(m.get("text") or "").strip() for m in json.load(open(a.raw, encoding="utf-8"))["messages"]]
        raw_counts = {}
        for r in raw_texts:
            raw_counts[r] = raw_counts.get(r, 0) + 1
        for uid, o in ov.items():
            keep = []
            for x in o.get("typical", []):
                if copied_from_raw(x, raw_texts, raw_counts):
                    print(f"warning: {uid} typical line copies a raw message, dropped: {x[:20]}...", file=sys.stderr)
                else:
                    keep.append(x)
            if "typical" in o:
                o["typical"] = keep
    cdir = os.path.join(a.profile_dir, "contacts"); os.makedirs(cdir, mode=0o700, exist_ok=True)
    chosen = [c for c in st["contacts"][: a.top]] + [c for c in st["contacts"][a.top:] if c["id"] in ov]
    rows = []
    for c in chosen:
        o = ov.get(c["id"], {})
        if o.get("skip"):
            continue
        name, clos, text = card(c, o)
        fn = slug(name) + "-" + c["id"][-4:].lower() + ".md"
        p = os.path.join(cdir, fn)
        open(p, "w", encoding="utf-8").write(text); os.chmod(p, 0o600)
        rows.append((name, c["id"], clos, "reviewed" if "closeness" in o else "inferred",
                     o.get("address_as", ""), c["dm_messages"], fn))
    idx = ["# Contacts", "", "| Name | Slack id | Closeness | Source | Address as | DMs | Card |", "|---|---|---|---|---|---|---|"]
    idx += [f"| {r[0]} | {r[1]} | {r[2]} | {r[3]} | {r[4]} | {r[5]} | [{r[6]}]({r[6]}) |" for r in rows]
    p = os.path.join(cdir, "INDEX.md")
    open(p, "w", encoding="utf-8").write("\n".join(idx) + "\n"); os.chmod(p, 0o600)
    print(f"wrote {len(rows)} cards to {cdir}")


if __name__ == "__main__":
    main()
