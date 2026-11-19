#!/usr/bin/env python3
"""Lint an extract-me profile dir.
Usage: check_profile.py <expertise_dir>
       check_profile.py --shared FILE [--names NAMES_FILE] [--scan SCAN_JSON]

Checks PROFILE.md has the contract headings, every backticked path that looks
like a home path exists, no long dashes, no secret-looking strings, and each
strength line cites at least two evidence items. With --shared FILE, checks a
public summary instead: no home paths, emails or URLs. --names gives a file of
person or client names (one per line) that must not appear; --scan adds the git
author names and project folder names found in scan.json to that list.
"""
import os, re, sys

HEADINGS = ["## Summary", "## Strengths", "## Signature methods", "## Active work",
            "## Working style", "## Also seen", "## Gaps and blind spots"]
SECRET_RE = re.compile(r"(xox[abp]-|sk-[A-Za-z0-9]{8,}|sk-or-|AKIA[0-9A-Z]{12}|-----BEGIN|ghp_[A-Za-z0-9]{10,}|"
                       r"xkeysib-|eyJ[A-Za-z0-9_-]{20,}\.|password\s*[:=])", re.I)
DASH_RE = re.compile("[\\u2013\\u2014]")


def lint_text(name, txt, problems):
    for i, line in enumerate(txt.splitlines(), 1):
        if DASH_RE.search(line):
            problems.append(f"{name}:{i}: long dash")
        if SECRET_RE.search(line):
            problems.append(f"{name}:{i}: secret-looking string")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    problems = []
    if "--shared" in sys.argv:
        f = sys.argv[sys.argv.index("--shared") + 1]
        txt = open(f, encoding="utf-8").read()
        lint_text(f, txt, problems)
        for pat, why in [(r"~/|/Users/|/home/", "home path"), (r"[\w.+-]+@[\w-]+\.[\w.]+", "email"),
                         (r"https?://", "url")]:
            for m in re.finditer(pat, txt):
                problems.append(f"{f}: {why}: {m.group(0)[:40]}")
        names = set()
        if "--names" in sys.argv:
            nf = sys.argv[sys.argv.index("--names") + 1]
            names.update(l.strip() for l in open(nf, encoding="utf-8") if l.strip())
        if "--scan" in sys.argv:
            import json
            sc = json.load(open(sys.argv[sys.argv.index("--scan") + 1], encoding="utf-8"))
            for p in sc.get("projects", []):
                names.add(os.path.basename(p.get("path", "").rstrip("/")))
                names.update((p.get("git") or {}).get("author_names", []))
        low = txt.lower()
        for n in sorted(names):
            if len(n) >= 4 and re.search(r"(?<![\w-])" + re.escape(n.lower()) + r"(?![\w-])", low):
                problems.append(f"{f}: listed name appears: {n}")
    else:
        d = sys.argv[1]
        prof = os.path.join(d, "PROFILE.md")
        if not os.path.isfile(prof):
            print("PROFILE.md missing")
            sys.exit(1)
        txt = open(prof, encoding="utf-8").read()
        for h in HEADINGS:
            if not re.search(r"^" + re.escape(h), txt, re.M):
                problems.append(f"PROFILE.md: missing heading {h}")
        if not re.search(r"^updated: \d{4}-\d{2}-\d{2}", txt, re.M):
            problems.append("PROFILE.md: missing 'updated: YYYY-MM-DD' line")
        if len(txt.splitlines()) > 120:
            problems.append("PROFILE.md: over 120 lines")
        sec = re.search(r"## Strengths\n(.*?)\n## ", txt, re.S)
        if sec:
            for line in sec.group(1).splitlines():
                if re.match(r"\d+\.", line.strip()):
                    n = len(re.findall(r"`[^`]+`", line))
                    if n < 2:
                        problems.append(f"PROFILE.md: strength cites {n} evidence item(s): {line[:60]}")
        for f in sorted(os.listdir(d)):
            if f.endswith(".md"):
                t = open(os.path.join(d, f), encoding="utf-8").read()
                lint_text(f, t, problems)
                for m in re.finditer(r"`(~/[^`]+)`", t):
                    p = os.path.expanduser(m.group(1).split(" (")[0].rstrip("/"))
                    if not os.path.exists(p):
                        problems.append(f"{f}: path not found: {m.group(1)}")
    if problems:
        print("\n".join(problems))
        sys.exit(1)
    print("OK")


if __name__ == "__main__":
    main()
