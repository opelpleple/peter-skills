#!/usr/bin/env python3
"""ingest_slack.py: turn messages the user wrote into voice statistics.

Input JSON shape (see references/export-adapters.md for how to produce it):
  {
    "users": {"U123": {"name": "...", "display": "...", "bot": false,
                        "deleted": false, "title": "..."}},
    "messages": [{"ts": "1700000000.0001", "text": "...", "channel_id": "D1",
                  "channel_name": "...", "is_im": true, "is_mpim": false,
                  "is_private": true, "thread": false, "partner": "U123"}]
  }
Every message must be authored by the user. "partner" is the other person
for a direct message; for channel messages the script attributes the message
to anyone @mentioned in it (weaker evidence, counted separately).

Output: stats.json with a "global" block and one block per contact.
Standard library only. Usage:
  python3 ingest_slack.py IN.json OUT/stats.json [--tz-offset 7] [--min-msgs 15]
"""
import argparse
import collections
import datetime as dt
import json
import os
import re
import statistics
import sys

PARTICLES = [
    # longest first so "นะครับ" wins over "ครับ"
    "นะครับ", "ครับผม", "ครับ", "คับ", "ค้าบ", "ครัช", "ฮะ", "ฮับ",
    "นะคะ", "ค่ะ", "คะ", "จ้า", "จ้ะ", "จ๊ะ", "น้า", "นะ", "เนอะ",
    "เลย", "หน่อย", "ด้วย", "ละ", "แล้ว", "อะ", "อ่ะ", "ป่ะ", "ป้ะ",
    "มั้ย", "ไหม", "หรอ", "เหรอ", "เด้อ", "เด้ะ", "สิ", "ซิ", "เถอะ",
    "555", "ๆ",
]
QUESTION_WORDS = ["ไหม", "มั้ย", "ป่ะ", "ป้ะ", "หรอ", "เหรอ", "อะไร", "ทำไม",
                  "ยังไง", "อย่างไร", "เมื่อไหร่", "ใคร", "ที่ไหน", "กี่", "หรือยัง",
                  "ใช่ไหม", "ใช่มั้ย", "รึเปล่า", "หรือเปล่า"]
DIRECTIVE_MARKERS = ["ช่วย", "รบกวน", "ฝาก", "ลอง", "ส่ง", "เช็ค", "เช็ก", "ทำ",
                     "ขอ", "เอา", "หน่อย", "ด้วยนะ", "please", "pls", "plz",
                     "can you", "could you", "let's", "lets ", "make sure", "send"]
GREETINGS = ["สวัสดี", "หวัดดี", "ดีครับ", "hi", "hello", "hey", "morning", "อรุณสวัสดิ์"]
THANKS = ["ขอบคุณ", "ขอบใจ", "thank", "thx", "tks", "ty"]
AGREE = ["โอเค", "ok", "okay", "ได้", "รับ", "yes", "yep", "เค", "จัดไป", "ตามนั้น"]
PRAISE = ["เยี่ยม", "เก่ง", "ดีมาก", "สุดยอด", "แจ่ม", "เจ๋ง", "great", "nice", "good job",
          "awesome", "perfect", "เทพ", "ปัง", "ขอบคุณมาก"]
PUSHBACK = ["ไม่ใช่", "ไม่เอา", "ไม่ได้", "ทำไม", "แต่", "ผิด", "อย่า", "ห้าม", "no ",
            "not ", "don't", "wrong", "why", "ยังไม่", "ไม่ต้อง"]
ADDRESS_PREFIX = ["พี่", "น้อง", "คุณ", "P'", "p'", "K.", "k.", "ท่าน"]
SELF_REF = {"ผม": "ผม", "พี่": "พี่ (self)", "เรา": "เรา", "กู": "กู", "เค้า": "เค้า",
            "ฉัน": "ฉัน", "ชั้น": "ชั้น"}
RE_SELF_I = re.compile(r"(?<![A-Za-z'])I(?![A-Za-z])")  # "I", "I'm", "I." but not "IT" or "API"

# Regional dialect and romanized-Thai markers, as regexes (Thai has no spaces
# between words, so plain substrings give false hits: "แล" inside "แล้ว").
# Extend or replace for your own dialect; keep patterns anchored.
T = "\u0E00-\u0E7F"
DIALECT = {
    "isan": [r"บ๊(?![%s])" % T, r"(?<![%s])บ่(?=ได้|ต้อง|เป็น|มี|รู้|ตอบ|\s|$)" % T, r"เด้อ", r"เด้ะ",
             r"หยัง", r"(?:อยู่|ที่)ไส", r"จั่งซี่", r"จั้ก", r"แหน่", r"เนาะ", r"เบิ่ง", r"ข่อย",
             r"หนิ(?![%s])" % T, r"(?<![%s])แท่(?![%s])" % (T, T), r"(?<![%s])คึ" % T],
    "northern": [r"(?<![%s])เจ้า(?![%s])" % (T, T), r"ก๋า", r"บ่าเดี่ยว"],
    "southern": [r"หรอย", r"(?<![%s])ม่าย(?![%s])" % (T, T), r"หลาว"],
    "romanized_thai": [r"\bkr[au]b\b", r"\bkhrap\b", r"\bna\b", r"\bchai mai\b", r"\bkub\b", r"\bka\b"],
}
DIALECT_RE = {k: [re.compile(p, re.I) for p in v] for k, v in DIALECT.items()}

RE_URL = re.compile(r"<(https?://[^>|]+)(\|[^>]*)?>")
RE_MENTION = re.compile(r"<@([UW][A-Z0-9]+)(\|[^>]*)?>")
RE_CHAN = re.compile(r"<#[A-Z0-9]+(\|[^>]*)?>")
RE_SHORTCODE = re.compile(r":([a-z0-9_+\-']+):")
RE_UNI_EMOJI = re.compile("[\U0001F300-\U0001FAFF☀-➿\U0001F000-\U0001F2FF]")
RE_THAI = re.compile(r"[฀-๿]")
RE_LATIN = re.compile(r"[A-Za-z]")
RE_TOKEN = re.compile(r"[^\s,.!?:;()\[\]\"'`*_~<>\u2013\u2014]+")
RE_LAUGH = re.compile(r"5{3,}|ha(ha)+|lol", re.I)


def clean(text):
    t = RE_URL.sub(" ", text)
    t = RE_MENTION.sub(" ", t)
    t = RE_CHAN.sub(" ", t)
    return t


def ending(text):
    t = RE_SHORTCODE.sub("", RE_UNI_EMOJI.sub("", text)).strip().rstrip("?!. ")
    for p in PARTICLES:
        if t.endswith(p):
            return p
    return None


def utcdate(ts):
    return dt.datetime.fromtimestamp(ts, dt.timezone.utc).date().isoformat()


def pct(sorted_vals, q):
    if not sorted_vals:
        return 0
    k = min(len(sorted_vals) - 1, max(0, int(round(q * (len(sorted_vals) - 1)))))
    return sorted_vals[k]


class Acc:
    """Accumulates features for one bucket (global, one contact, one channel)."""

    def __init__(self):
        self.n = 0
        self.lengths = []
        self.particles = collections.Counter()
        self.endings = collections.Counter()
        self.emoji = collections.Counter()
        self.thai_chars = 0
        self.latin_chars = 0
        self.mixed_msgs = 0
        self.hours = collections.Counter()
        self.weekdays = collections.Counter()
        self.first = collections.Counter()
        self.uni = collections.Counter()
        self.bi = collections.Counter()
        self.flags = collections.Counter()
        self.address = collections.Counter()
        self.self_ref = collections.Counter()
        self.dialect = collections.Counter()
        self.dialect_words = collections.Counter()
        self.first_ts = None
        self.last_ts = None

    def add(self, m, tz):
        raw = m.get("text") or ""
        text = clean(raw)
        stripped = text.strip()
        if not stripped and not RE_URL.search(raw):
            self.flags["empty_or_file_only"] += 1
            return
        self.n += 1
        ts = float(m["ts"])
        self.first_ts = ts if self.first_ts is None else min(self.first_ts, ts)
        self.last_ts = ts if self.last_ts is None else max(self.last_ts, ts)
        local = dt.datetime.fromtimestamp(ts, dt.timezone(dt.timedelta(hours=tz)))
        self.hours[local.hour] += 1
        self.weekdays[local.strftime("%a")] += 1
        if stripped:  # link-only messages count as messages but not as lengths
            self.lengths.append(len(stripped))
        low = stripped.lower()

        th = len(RE_THAI.findall(stripped))
        la = len(RE_LATIN.findall(stripped))
        self.thai_chars += th
        self.latin_chars += la
        if th and la:
            self.mixed_msgs += 1
        if th == 0 and la > 0:
            self.flags["english_only"] += 1
        if la == 0 and th > 0:
            self.flags["thai_only"] += 1

        for p in PARTICLES:
            c = stripped.count(p)
            if c:
                self.particles[p] += c
        e = ending(stripped)
        self.endings[e or "(none)"] += 1

        for sc in RE_SHORTCODE.findall(raw):
            self.emoji[":" + sc + ":"] += 1
        for u in RE_UNI_EMOJI.findall(raw):
            self.emoji[u] += 1
        if RE_LAUGH.search(stripped):
            self.flags["laugh"] += 1

        toks = [t for t in RE_TOKEN.findall(low) if not RE_SHORTCODE.fullmatch(t)]
        if toks:
            self.first[toks[0][:16]] += 1
        for t in toks:
            if len(t) <= 24:
                self.uni[t] += 1
        for a, b in zip(toks, toks[1:]):
            if len(a) <= 16 and len(b) <= 16:
                self.bi[a + " " + b] += 1

        # Act rates below are rough keyword signals, not classifications:
        # one message can count as several acts ("ทำไม" is both a question
        # and pushback, "not " fires on any negation). Read samples before
        # turning a rate into a rule.
        is_q = "?" in stripped or any(w in stripped for w in QUESTION_WORDS)
        is_d = any(w in low for w in DIRECTIVE_MARKERS)
        self.flags["question"] += is_q
        self.flags["directive"] += is_d
        self.flags["greeting"] += any(low.startswith(g) for g in GREETINGS)
        self.flags["thanks"] += any(w in low for w in THANKS)
        self.flags["agree_ack"] += any(low.startswith(w) for w in AGREE)
        self.flags["praise"] += any(w in low for w in PRAISE)
        self.flags["pushback"] += any(w in low for w in PUSHBACK)
        self.flags["has_link"] += bool(RE_URL.search(raw))
        self.flags["has_mention"] += bool(RE_MENTION.search(raw))
        self.flags["multiline"] += "\n" in stripped
        self.flags["code"] += "```" in raw or "`" in raw
        self.flags["thread_reply"] += bool(m.get("thread"))
        self.flags["bullets"] += bool(re.search(r"^\s*([-•*]|\d+[.)])\s", stripped, re.M))

        for pre in ADDRESS_PREFIX:
            for mm in re.finditer(r"(?<![\u0E00-\u0E7FA-Za-z])" + re.escape(pre) + r"([^\s,.!?:;()]{1,12})", stripped):
                word = mm.group(1)
                word = re.sub(r"(ครับผม|ครับ|คับ|นะ|จ้า|ค่ะ|คะ)$", "", word)
                if word and (RE_THAI.search(word) and len(word) <= 6 or RE_LATIN.match(word)):
                    self.address[pre + word] += 1
        for dname, pats in DIALECT_RE.items():
            hit = False
            for rx in pats:
                mm = rx.search(stripped)
                if mm:
                    hit = True
                    self.dialect_words[mm.group(0).lower()] += 1
            self.dialect[dname] += hit
        for k, label in SELF_REF.items():
            if k in stripped:
                self.self_ref[label] += 1
        if RE_SELF_I.search(stripped):
            self.self_ref["I"] += 1

    def summary(self, top=15):
        L = sorted(self.lengths)
        total = self.thai_chars + self.latin_chars or 1
        n = self.n or 1
        rate = lambda k: round(self.flags[k] / n, 3)
        return {
            "messages": self.n,
            "span": [
                utcdate(self.first_ts) if self.first_ts else None,
                utcdate(self.last_ts) if self.last_ts else None,
            ],
            "length_chars": {
                "mean": round(statistics.mean(L), 1) if L else 0,
                "p10": pct(L, .1), "p50": pct(L, .5), "p90": pct(L, .9),
                "share_under_20": round(sum(1 for x in L if x < 20) / (len(L) or 1), 3),
                "share_over_200": round(sum(1 for x in L if x > 200) / (len(L) or 1), 3),
            },
            "language": {
                "thai_char_ratio": round(self.thai_chars / total, 3),
                "latin_char_ratio": round(self.latin_chars / total, 3),
                "mixed_msg_rate": round(self.mixed_msgs / n, 3),
                "thai_only_rate": rate("thai_only"),
                "english_only_rate": rate("english_only"),
            },
            "particles_per_100_msgs": {k: round(v * 100 / n, 1) for k, v in self.particles.most_common(top)},
            "endings": {k: round(v / n, 3) for k, v in self.endings.most_common(10)},
            "emoji_top": self.emoji.most_common(10),
            "emoji_rate": round(sum(self.emoji.values()) / n, 3),
            "laugh_rate": rate("laugh"),
            "acts": {
                "question": rate("question"), "directive": rate("directive"),
                "greeting": rate("greeting"), "thanks": rate("thanks"),
                "agree_ack": rate("agree_ack"), "praise": rate("praise"),
                "pushback": rate("pushback"),
                "question_to_directive": round(self.flags["question"] / max(1, self.flags["directive"]), 2),
            },
            "format": {k: rate(k) for k in ["has_link", "has_mention", "multiline", "code", "bullets", "thread_reply"]},
            "hours_local": dict(sorted(self.hours.items())),
            "weekdays": dict(self.weekdays),
            "first_tokens": self.first.most_common(top),
            "top_tokens": self.uni.most_common(top * 2),
            "top_bigrams": self.bi.most_common(top),
            "address_forms": self.address.most_common(8),
            "self_reference": self.self_ref.most_common(6),
            "dialect_rate": {k: round(v / n, 3) for k, v in self.dialect.items() if v},
            "dialect_words": self.dialect_words.most_common(8),
        }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("inp")
    ap.add_argument("out")
    ap.add_argument("--tz-offset", type=float, default=7.0, help="hours from UTC for time-of-day stats")
    ap.add_argument("--min-msgs", type=int, default=15, help="minimum DM messages for a contact block")
    a = ap.parse_args()

    data = json.load(open(a.inp, encoding="utf-8"))
    users = data.get("users", {})
    msgs = data.get("messages", [])
    is_bot = lambda uid: bool(users.get(uid, {}).get("bot")) or uid == "USLACKBOT"

    glob, human_only = Acc(), Acc()
    contacts = collections.defaultdict(Acc)
    mentions = collections.defaultdict(Acc)
    channels = collections.defaultdict(Acc)
    kind = collections.Counter()

    for m in msgs:
        glob.add(m, a.tz_offset)
        p = m.get("partner")
        if m.get("is_im") and p:
            kind["dm"] += 1
            if not is_bot(p):
                contacts[p].add(m, a.tz_offset)
                human_only.add(m, a.tz_offset)
            else:
                kind["dm_to_bot"] += 1
            continue
        kind["group_dm" if m.get("is_mpim") else "channel"] += 1
        human_only.add(m, a.tz_offset)
        channels[m.get("channel_name") or m.get("channel_id")].add(m, a.tz_offset)
        for uid, _ in RE_MENTION.findall(m.get("text") or ""):
            if not is_bot(uid):
                mentions[uid].add(m, a.tz_offset)

    out_contacts = []
    ids = set(contacts) | set(mentions)
    for uid in ids:
        dm, mn = contacts.get(uid), mentions.get(uid)
        dm_n = dm.n if dm else 0
        mn_n = mn.n if mn else 0
        if dm_n < a.min_msgs and mn_n < a.min_msgs * 2:
            continue
        u = users.get(uid, {})
        out_contacts.append({
            "id": uid,
            "name": u.get("name"), "display": u.get("display"), "title": u.get("title"),
            "nickname_hint": re.findall(r"\(([^)]{1,30})\)", (u.get("display") or "") + " " + (u.get("name") or "")),
            "deleted": u.get("deleted", False),
            "dm_messages": dm_n, "mention_messages": mn_n,
            "dm": dm.summary(10) if dm else None,
            "in_channels": mn.summary(8) if mn else None,
        })
    out_contacts.sort(key=lambda c: (c["dm_messages"], c["mention_messages"]), reverse=True)

    result = {
        "generated": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "source": os.path.basename(a.inp),
        "tz_offset": a.tz_offset,
        "message_kinds": dict(kind),
        "global": glob.summary(25),
        "global_humans_only": human_only.summary(25),
        "channels_top": sorted(
            [{"channel": k, "messages": v.n, "summary": v.summary(6)} for k, v in channels.items() if v.n >= 20],
            key=lambda c: -c["messages"])[:15],
        "contacts": out_contacts,
    }
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    text = json.dumps(result, ensure_ascii=False, indent=1)
    text = text.replace("\u2014", "-").replace("\u2013", "-")  # keep outputs dash-free
    with open(a.out, "w", encoding="utf-8") as f:
        f.write(text)
    try:
        os.chmod(a.out, 0o600)
    except OSError:
        pass
    print(f"messages={len(msgs)} contacts={len(out_contacts)} -> {a.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
