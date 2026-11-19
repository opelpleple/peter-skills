#!/usr/bin/env python3
"""apply.py: apply selected skill-organiser proposals. Dry run unless --yes.

Usage:
  python3 apply.py --proposals OUT/proposals.json --ids P001,P004          # show what would change
  python3 apply.py --proposals OUT/proposals.json --ids P001,P004 --yes    # change files, after the user said yes
  python3 apply.py --proposals OUT/proposals.json --restore 20261119-101500        # show what a restore would do
  python3 apply.py --proposals OUT/proposals.json --restore 20261119-101500 --yes  # put those backups back

Only two edits exist, both additive and reversible:
  add_works_with   append one line under a "## Works with" heading (created at the end if missing)
  move_section     cut one "## " section into references/<file>.md and leave a one line pointer
Every touched SKILL.md is copied to OUT/backups/<timestamp>/ first. Nothing is ever deleted.
Skills marked managed (synced, plugin, symlinked from elsewhere) are skipped unless --allow-managed.
Only files named SKILL.md inside a scanned skills root (from skills-map.json beside proposals.json,
else ~/.claude/skills) are ever written, and moved sections must land inside that skill's folder.
"""
import argparse
import json
import os
import re
import shutil
import sys
from datetime import datetime

sys.dont_write_bytecode = True
DASH_RE = re.compile("\\s*[\u2014\u2013]\\s*")


def add_works_with(text, line):
    if line.strip() in text:
        return text, "already present"
    lines = text.rstrip("\n").split("\n")
    idx = next((i for i, l in enumerate(lines) if l.strip().lower() in ("## works with", "## works with / hands off to")), None)
    if idx is None:
        lines += ["", "## Works with", "", line]
    else:
        j = idx + 1
        while j < len(lines) and not lines[j].startswith("## "):
            j += 1
        k = j
        while k > idx + 1 and lines[k - 1].strip() == "":
            k -= 1
        lines.insert(k, line)
    return "\n".join(lines) + "\n", "added"


def norm(h):
    # proposals are written without long dashes, so compare headings with dashes folded
    return DASH_RE.sub(", ", h).strip()


def move_section(text, heading, target_rel, skill_dir):
    lines = text.split("\n")
    start = next((i for i, l in enumerate(lines) if l.startswith("## ") and norm(l[3:]) == norm(heading)), None)
    if start is None:
        return text, None, "heading not found"
    end = start + 1
    in_fence = False
    while end < len(lines):
        if lines[end].startswith("```"):
            in_fence = not in_fence
        if not in_fence and lines[end].startswith("## "):
            break
        end += 1
    section = lines[start:end]
    target = os.path.join(skill_dir, target_rel)
    if os.path.exists(target):
        return text, None, f"{target_rel} already exists, pick another name"
    body = "# " + section[0][3:].strip() + "\n" + "\n".join(section[1:]).rstrip() + "\n"
    pointer = [section[0], "", f"Read [{target_rel}]({target_rel}) when you need this part.", ""]
    new = "\n".join(lines[:start] + pointer + lines[end:])
    return new, (target, body), "moved"


def scanned_roots(out_dir):
    """Roots the scan covered, read from skills-map.json; fall back to ~/.claude/skills."""
    roots = []
    try:
        meta = json.load(open(os.path.join(out_dir, "skills-map.json"), encoding="utf-8"))["meta"]
        roots = [os.path.expanduser(r) for r in meta.get("roots", [])]
    except (OSError, ValueError, KeyError):
        pass
    return [os.path.abspath(r) for r in (roots or [os.path.expanduser("~/.claude/skills")])]


def safe_target(path, roots):
    """True only for a SKILL.md that sits inside one of the scanned roots."""
    if os.path.basename(path) != "SKILL.md":
        return False
    ap = os.path.abspath(os.path.expanduser(path))
    return any(ap.startswith(r.rstrip(os.sep) + os.sep) for r in roots)


def inside(child, parent):
    c, p = os.path.abspath(child), os.path.abspath(parent)
    return c.startswith(p.rstrip(os.sep) + os.sep)


def restore(out_dir, stamp, roots, yes):
    bdir = os.path.join(out_dir, "backups", stamp)
    try:
        manifest = json.load(open(os.path.join(bdir, "manifest.json"), encoding="utf-8"))
    except (OSError, ValueError):
        print(f"no manifest at {bdir}/manifest.json; restore by hand with "
              f"cp {bdir}/<skill>/SKILL.md <original SKILL.md path>")
        return 1
    rc = 0
    for item in manifest:
        src = os.path.join(bdir, item["backup"])
        dst = item["file"]
        if not safe_target(dst, roots) or not os.path.isfile(src):
            print(f"{item['id']}: refused, {dst} is not a SKILL.md in a scanned root or the backup is missing")
            rc = 1
            continue
        print(f"{item['id']}: restore {dst} from {src}")
        for extra in item.get("created", []):
            print(f"   note: {extra} was created by that apply; remove it by hand if you no longer want it")
        if yes:
            shutil.copy2(src, dst)
            print("   restored.")
        else:
            print("   dry run. Re-run with --yes after the user confirms.")
    return rc


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--proposals", required=True)
    ap.add_argument("--ids", help="comma separated proposal ids, e.g. P001,P003")
    ap.add_argument("--restore", metavar="STAMP", help="put back the SKILL.md files backed up at backups/STAMP")
    ap.add_argument("--yes", action="store_true", help="really write (only after the user confirmed)")
    ap.add_argument("--allow-managed", action="store_true")
    a = ap.parse_args()

    out_dir = os.path.dirname(os.path.abspath(a.proposals))
    roots = scanned_roots(out_dir)
    if a.restore:
        return restore(out_dir, a.restore, roots, a.yes)
    if not a.ids:
        ap.error("--ids is required unless --restore is given")
    props = {p["id"]: p for p in json.load(open(a.proposals, encoding="utf-8"))}
    want = [x.strip() for x in a.ids.split(",") if x.strip()]
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    manifest = []
    rc = 0
    for pid in want:
        p = props.get(pid)
        if not p:
            print(f"{pid}: unknown id"); rc = 1; continue
        e = p["edit"]
        if e.get("op") == "manual":
            print(f"{pid}: manual proposal, nothing to apply ({p['detail']})"); continue
        if e.get("managed") and not a.allow_managed:
            print(f"{pid}: skipped, skill is managed by {e['managed']}"); continue
        path = e.get("file", "")
        if not safe_target(path, roots):
            print(f"{pid}: refused, {path!r} is not a SKILL.md inside a scanned root ({', '.join(roots)})")
            rc = 1
            continue
        text = open(path, encoding="utf-8").read()
        extra = None
        if e["op"] == "add_works_with":
            new, status = add_works_with(text, e["line"])
        elif e["op"] == "move_section":
            skill_dir = os.path.dirname(os.path.abspath(path))
            if not inside(os.path.join(skill_dir, e["target"]), skill_dir) or not e["target"].endswith(".md"):
                print(f"{pid}: refused, target {e['target']!r} is not a .md file inside the skill folder")
                rc = 1
                continue
            new, extra, status = move_section(text, e["heading"], e["target"], skill_dir)
        else:
            print(f"{pid}: unsupported op {e['op']}"); rc = 1; continue
        if new == text:
            print(f"{pid}: {status}, no change"); continue
        print(f"{pid}: {status} -> {path}" + (f" + {extra[0]}" if extra else ""))
        if not a.yes:
            print("   dry run. Re-run with --yes after the user confirms.")
            continue
        rel = os.path.join(p["skill"].replace("/", "__"), "SKILL.md")
        bdir = os.path.join(out_dir, "backups", stamp, os.path.dirname(rel))
        os.makedirs(bdir, exist_ok=True)
        if not os.path.exists(os.path.join(bdir, "SKILL.md")):      # keep the first copy if two ids touch one file
            shutil.copy2(path, os.path.join(bdir, "SKILL.md"))
        manifest.append({"id": pid, "file": os.path.abspath(path), "backup": rel,
                         "created": [extra[0]] if extra else []})
        with open(os.path.join(out_dir, "backups", stamp, "manifest.json"), "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=1)
        if extra:
            os.makedirs(os.path.dirname(extra[0]), exist_ok=True)
            with open(extra[0], "w", encoding="utf-8") as f:
                f.write(extra[1])
        with open(path, "w", encoding="utf-8") as f:
            f.write(new)
        print(f"   written. backup at {bdir}")
    if manifest:
        print(f"undo with: python3 {os.path.abspath(__file__)} --proposals {a.proposals} --restore {stamp} --yes")
    return rc


if __name__ == "__main__":
    sys.exit(main())
