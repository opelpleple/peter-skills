#!/usr/bin/env python3
"""skillmap.py: read every installed skill and map how they chain.

Read only. Python 3.9+ standard library only.

Usage:
  python3 skillmap.py                       # scan ~/.claude/skills
  python3 skillmap.py --plugins             # also scan ~/.claude/plugins/cache
  python3 skillmap.py --root DIR --root DIR2 --out OUTDIR --graph graph.json
  python3 skillmap.py --public --hide 'acme-*,*private*' --graph public-graph.json
                                            # also write SKILLS-MAP.public.md with names hidden

Writes into OUTDIR (default ~/.claude/me/skill-organiser/):
  skills-map.json   every skill, edge, finding and proposal
  SKILLS-MAP.md     human report with the proposed restructure
  proposals.json    numbered proposals that apply.py can act on
  SKILLS-MAP.public.md  only with --public: the same map, safe to share (see --keep / --hide)
"""
import argparse
import fnmatch
import json
import os
import re
import sys
from collections import defaultdict
from datetime import date

sys.dont_write_bytecode = True

HOME = os.path.expanduser("~")
DEFAULT_ROOT = os.path.join(HOME, ".claude", "skills")
PLUGIN_ROOT = os.path.join(HOME, ".claude", "plugins", "cache")
DEFAULT_OUT = os.environ.get("SKILL_ORGANISER_OUT",
                             os.path.join(os.environ.get("ME_DIR", os.path.join(HOME, ".claude", "me")), "skill-organiser"))

SKIP_DIRS = {".git", "node_modules", "__pycache__", ".venv", "venv", "dist", "build", ".next"}
MAX_LINES = 250            # SKILL.md body budget
MAX_DESC = 1024            # description budget (characters)
REF_EXT = (".md", ".txt")
HANDOFF_WORDS = re.compile(
    r"hand(s|ed)?[ -]?off|handoff|hand it to|feeds? (into|to)|next step|then (run|use|load|invoke|call)|"
    r"pass(es)? (it )?to|continue(s)? (in|with)|ส่งต่อ|ต่อด้วย",
    re.I)
REVERSE_WORDS = re.compile(r"receives? from|fed by|is fed by|comes after|downstream of|รับต่อจาก", re.I)
ARROW = re.compile(r"->|\u2192|=>")
ROUTE_WORDS = re.compile(r"instead|not this skill|, not\b|\bnot a\b|use `?[\w-]+`? for|belongs to|owned by|NOT for|route", re.I)
STOP = set("""a an the and or of to for in on with by is are be this that it as at from use used using when
user users wants want skill skills any into your you their them via not do does also only make makes making
like eg e.g etc whenever every each all can should will via over its it's than then so such these those""".split())

GENERIC_PREFIX = {"claude", "first", "the", "my", "ask", "new", "use", "get", "make"}
DASH_RE = re.compile("\\s*[\u2014\u2013]\\s*")


def clean(s):
    """Fold long dashes into a comma: 'Phase 6 \u2014 Review' becomes 'Phase 6, Review'."""
    if not isinstance(s, str):
        return s
    return DASH_RE.sub(", ", s)


def deep_clean(o):
    if isinstance(o, dict):
        return {clean(k): deep_clean(v) for k, v in o.items()}
    if isinstance(o, list):
        return [deep_clean(v) for v in o]
    return clean(o)


# ---------------------------------------------------------------- discovery

def discover(roots):
    """Yield (source, skill_dir) for every SKILL.md, following symlinks once."""
    seen_real = set()
    found = []
    backups = []
    for source, root in roots:
        if not os.path.isdir(root):
            continue
        for dirpath, dirnames, filenames in os.walk(root, followlinks=True):
            dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".")]
            if "SKILL.md" not in filenames:
                continue
            real = os.path.realpath(dirpath)
            base = os.path.basename(dirpath)
            if base.endswith((".bak", ".old", ".orig")) or ".bak" in base:
                backups.append(dirpath)
                continue
            if real in seen_real:
                continue
            seen_real.add(real)
            found.append((source, dirpath))
    # the plugin cache keeps every old version: <market>/<plugin>/<version>/.../<skill>; keep the newest per skill
    newest = {}
    stale = []
    for source, d in found:
        if source != "plugin":
            continue
        rel = os.path.relpath(d, PLUGIN_ROOT).split(os.sep)
        if len(rel) < 3:
            continue
        key = (rel[0], rel[1], os.sep.join(rel[3:]))
        m = os.path.getmtime(os.path.join(d, "SKILL.md"))
        if key not in newest or m > newest[key][0]:
            if key in newest:
                stale.append(newest[key][1])
            newest[key] = (m, d)
        else:
            stale.append(d)
    stale = set(stale)
    found = [(s, d) for s, d in found if d not in stale]
    return found, backups


def parse_frontmatter(text):
    fm = {}
    if not text.startswith("---"):
        return fm, text
    end = text.find("\n---", 3)
    if end < 0:
        return fm, text
    block = text[3:end].strip("\n")
    body = text[end + 4:]
    lines = block.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i]
        m = re.match(r"^([A-Za-z0-9_-]+):\s*(.*)$", line)
        if not m:
            i += 1
            continue
        key, val = m.group(1), m.group(2).strip()
        if val in (">", "|", ">-", "|-", ">+", "|+"):
            buf = []
            i += 1
            while i < len(lines) and (lines[i].startswith(" ") or lines[i].strip() == ""):
                buf.append(lines[i].strip())
                i += 1
            fm[key] = " ".join(x for x in buf if x)
            continue
        if len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
            val = val[1:-1]
        # plain scalar continued on indented lines
        i += 1
        while i < len(lines) and lines[i].startswith("  ") and not re.match(r"^\s*[A-Za-z0-9_-]+:\s", lines[i]):
            val += " " + lines[i].strip()
            i += 1
        fm[key] = val
    return fm, body


TRIGGER_RE = re.compile(r"[\"“”]([^\"“”]{2,60})[\"“”]")


def triggers_of(desc):
    out = []
    for t in TRIGGER_RE.findall(desc or ""):
        t = re.sub(r"\s+", " ", t.strip().lower())
        if t and t not in out:
            out.append(t)
    return out


def words_of(desc):
    toks = re.findall(r"[a-z][a-z0-9]+|[฀-๿]+", (desc or "").lower())
    return {t for t in toks if t not in STOP and len(t) > 2}


def list_files(skill_dir, nested_dirs):
    files = []
    for dirpath, dirnames, filenames in os.walk(skill_dir, followlinks=False):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".")
                       and os.path.join(dirpath, d) not in nested_dirs]
        for f in filenames:
            p = os.path.join(dirpath, f)
            try:
                size = os.path.getsize(p)
            except OSError:
                size = 0
            files.append((os.path.relpath(p, skill_dir), size))
    return files


LINK_RE = re.compile(r"\]\(([^)#\s]+)(?:#[^)]*)?\)")
TICK_RE = re.compile(r"`((?:\.\./)?(?:references|scripts|templates|assets|reference)/[^`\s*<>{}]+)`")


def dead_refs(skill_dir, body):
    dead = []
    prose = FENCE.sub("", body)
    cands = set(LINK_RE.findall(prose)) | set(TICK_RE.findall(body))
    for ref in sorted(cands):
        if re.match(r"^[a-z]+://|^mailto:|^/|^~|^\$|^<", ref):
            continue
        if any(ch in ref for ch in "*{}<>") or ("/" not in ref and "." not in ref):
            continue
        if "..." in ref or "\u2026" in ref or os.path.basename(ref.rstrip("/")) in ("", ".", ".."):
            continue                                   # a placeholder like `references/...`, not a real file
        p = os.path.normpath(os.path.join(skill_dir, ref))
        if not os.path.exists(p):
            dead.append(ref)
    return dead


def h2_sections(body):
    """Return [(heading, line_count)] for ## sections, largest first."""
    secs = []
    cur, n = None, 0
    for line in body.split("\n"):
        if line.startswith("## "):
            if cur:
                secs.append((cur, n))
            cur, n = line[3:].strip(), 0
        elif cur:
            n += 1
    if cur:
        secs.append((cur, n))
    return sorted(secs, key=lambda x: -x[1])


# ---------------------------------------------------------------- edges

def mention_regex(name):
    esc = re.escape(name)
    if "-" in name or len(name) >= 9:
        return re.compile(r"(?<![\w/.-])/?" + esc + r"(?![\w-])", re.I)
    # short single word names are common English: require code ticks, slash command or "X skill"
    return re.compile(r"`/?" + esc + r"`|(?<![\w/])/" + esc + r"\b|\b" + esc + r"\s+skill\b|\bskill\s+`?" + esc + r"\b", re.I)


def classify(line, rx):
    """Kind and direction of a mention. Direction 1 = source -> target, -1 = reversed."""
    bare = rx.sub(" ", line)          # the skill name itself must not trigger keywords (e.g. `handoff`)
    if ROUTE_WORDS.search(bare):
        return "routes", 1
    if REVERSE_WORDS.search(bare):
        return "handoff", -1
    if HANDOFF_WORDS.search(bare):
        return "handoff", 1
    if ARROW.search(bare):
        return "routes", 1
    return "mentions", 1


FENCE = re.compile(r"```.*?```", re.S)


def build_edges(skills):
    names = {s["id"]: s for s in skills}
    regs = {sid: mention_regex(s["name"]) for sid, s in names.items()}
    lowname = {sid: s["name"].lower() for sid, s in names.items()}
    rank = {"handoff": 3, "routes": 2, "mentions": 1}
    edges = {}

    def put(src, dst, kind, where, ev):
        if src == dst or names[src]["name"] == names[dst]["name"]:
            return
        cur = edges.get((src, dst))
        if cur is None or rank[kind] > rank[cur["kind"]]:
            edges[(src, dst)] = {"source": src, "target": dst, "kind": kind, "where": where, "evidence": ev[:160]}

    for s in skills:
        texts = [("description", s["description"]), ("SKILL.md", s["_body"])] + s["_refs"]
        for fname, txt in texts:
            for line in txt.split("\n"):
                hits = []
                low = line.lower()
                for tid, rx in regs.items():
                    if lowname[tid] not in low:      # cheap prefilter before the regex
                        continue
                    m = rx.search(line)
                    if m:
                        hits.append((m.start(), tid, rx))
                if not hits:
                    continue
                hits.sort()
                ev = line.strip()
                # a written pipeline "a -> b -> c": link the named skills to each other, in order
                if len(hits) >= 2 and ARROW.search(line):
                    for (_, a, _r), (_, b, _r2) in zip(hits, hits[1:]):
                        between = line[[h[0] for h in hits if h[1] == a][0]:[h[0] for h in hits if h[1] == b][0]]
                        if ARROW.search(between):
                            put(a, b, "handoff", f"{s['id']}:{fname}", ev)
                    for _, tid, _r in hits:
                        if tid != s["id"]:
                            put(s["id"], tid, "mentions", fname, ev)
                    continue
                for _, tid, rx in hits:
                    if tid == s["id"]:
                        continue
                    kind, direction = classify(line, rx)
                    if direction == 1:
                        put(s["id"], tid, kind, fname, ev)
                    else:
                        put(tid, s["id"], kind, fname, ev)
    return list(edges.values())


# ---------------------------------------------------------------- analysis

def families(skills):
    fam = {}
    prefix_count = defaultdict(int)
    loose = [s for s in skills if not s["parent"] and s["source"] != "plugin"]
    for s in loose:
        if "-" in s["name"]:
            prefix_count[s["name"].split("-")[0]] += 1
    for s in skills:
        g = None
        if s["parent"]:
            g = s["parent"]
        elif s["source"] == "plugin":
            g = "plugin:" + s["plugin"]
        elif "-" in s["name"] and prefix_count[s["name"].split("-")[0]] >= 2 \
                and s["name"].split("-")[0] not in GENERIC_PREFIX:
            g = s["name"].split("-")[0]
        fam[s["id"]] = g or "solo"
    return fam


def chains(skill_ids, edges, limit=20):
    adj = defaultdict(list)
    for e in edges:
        if e["kind"] == "handoff":
            adj[e["source"]].append(e["target"])
    paths = []

    def dfs(node, path):
        ext = False
        for nxt in sorted(adj.get(node, [])):
            if nxt in path or len(path) >= 7:
                continue
            ext = True
            dfs(nxt, path + [nxt])
        if not ext and len(path) >= 3:
            paths.append(path)

    for sid in sorted(skill_ids):
        dfs(sid, [sid])
        if len(paths) > 5000:
            break
    # keep maximal, unique node sets
    paths.sort(key=lambda p: -len(p))
    kept = []
    for p in paths:
        s = "\u0000".join(p)
        if any(s in "\u0000".join(k) for k in kept):
            continue
        if any(set(p) == set(k) for k in kept):
            continue
        kept.append(p)
        if len(kept) >= limit:
            break
    return kept


def analyse(skills, edges):
    ids = [s["id"] for s in skills]
    by_id = {s["id"]: s for s in skills}
    indeg, outdeg = defaultdict(int), defaultdict(int)
    for e in edges:
        outdeg[e["source"]] += 1
        indeg[e["target"]] += 1

    # trigger collisions: same quoted phrase claimed by two skills
    claim = defaultdict(list)
    for s in skills:
        if s["user_invoked"]:
            continue
        for t in s["triggers"]:
            claim[t].append(s["id"])
    collisions = [{"phrase": t, "skills": sorted(set(v))} for t, v in claim.items() if len(set(v)) >= 2]
    collisions.sort(key=lambda c: (-len(c["skills"]), c["phrase"]))

    # description overlap: jaccard of content words, outside the same family
    fam = families(skills)
    overlaps = []
    items = [(s["id"], s["_words"]) for s in skills if len(s["_words"]) >= 6 and not s["user_invoked"]]
    for i in range(len(items)):
        for j in range(i + 1, len(items)):
            a, wa = items[i]
            b, wb = items[j]
            inter = len(wa & wb)
            if inter < 5:
                continue
            jac = inter / len(wa | wb)
            if jac >= 0.30:
                overlaps.append({"a": a, "b": b, "score": round(jac, 2),
                                 "same_family": fam[a] == fam[b] and fam[a] != "solo",
                                 "shared": sorted(wa & wb)[:12]})
    overlaps.sort(key=lambda o: -o["score"])

    name_clash = defaultdict(list)
    for s in skills:
        name_clash[s["name"]].append(s["path_display"])
    name_collisions = [{"name": n, "paths": p} for n, p in name_clash.items() if len(p) > 1]

    orphans = [sid for sid in ids if indeg[sid] == 0 and outdeg[sid] == 0]
    oversized = []
    for s in skills:
        reasons = []
        if s["skill_lines"] > MAX_LINES:
            reasons.append(f"SKILL.md has {s['skill_lines']} lines (budget {MAX_LINES})")
        if len(s["description"]) > MAX_DESC:
            reasons.append(f"description is {len(s['description'])} chars (budget {MAX_DESC})")
        if reasons:
            oversized.append({"skill": s["id"], "reasons": reasons, "lines": s["skill_lines"],
                              "has_references": s["has_references"],
                              "biggest_sections": [{"heading": h, "lines": n} for h, n in s["_sections"][:3]]})
    oversized.sort(key=lambda o: -o["lines"])
    dead = [{"skill": s["id"], "refs": s["dead_refs"]} for s in skills if s["dead_refs"]]
    no_desc = [s["id"] for s in skills if not s["description"].strip()]
    return {"indeg": indeg, "outdeg": outdeg, "collisions": collisions, "overlaps": overlaps,
            "name_collisions": name_collisions, "orphans": orphans, "oversized": oversized,
            "dead_refs": dead, "no_description": no_desc, "families": fam}


def proposals(skills, edges, found, chain_list):
    by_id = {s["id"]: s for s in skills}
    props = []
    pid = 0

    def add(kind, skill, detail, edit):
        nonlocal pid
        pid += 1
        m = by_id[skill].get("managed")
        if m:
            detail += f" [managed: {m}, edit upstream or it will be overwritten]"
            edit = dict(edit, managed=m)
        props.append({"id": f"P{pid:03d}", "kind": kind, "skill": skill, "detail": detail, "edit": edit})

    edge_set = {(e["source"], e["target"]) for e in edges}
    # 1. make every chain hop explicit in both directions
    edge_where = {(e["source"], e["target"]): e["where"] for e in edges}
    done = set()
    for ch in chain_list:
        for a, b in zip(ch, ch[1:]):
            where = edge_where.get((a, b), "")
            if ":" in where and (a, b) not in done:      # the hop is only written down by a third skill
                done.add((a, b))
                add("works-with", a, f"{a} hands off to {b} (chain {' -> '.join(ch)}) but only {where.split(':')[0]} says so",
                    {"op": "add_works_with", "file": by_id[a]["skill_md"], "line": f"- Hands off to `{by_id[b]['name']}`"})
            if (b, a) not in edge_set and (b, a) not in done:
                done.add((b, a))
                add("works-with", b, f"{b} is fed by {a} (chain {' -> '.join(ch)}) but never names it",
                    {"op": "add_works_with", "file": by_id[b]["skill_md"], "line": f"- Receives from `{by_id[a]['name']}`"})
    # 2. orphans: suggest nearest neighbours by description words
    for sid in found["orphans"]:
        s = by_id[sid]
        if s["user_invoked"] or len(s["_words"]) < 5:
            continue
        scored = []
        for t in skills:
            if t["id"] == sid:
                continue
            inter = len(s["_words"] & t["_words"])
            if inter >= 3:
                scored.append((inter / len(s["_words"] | t["_words"]), t["id"]))
        scored.sort(reverse=True)
        near = [t for sc, t in scored[:2] if sc >= 0.10]
        if near:
            add("works-with", sid, f"orphan; closest skills by description: {', '.join(near)}",
                {"op": "add_works_with", "file": s["skill_md"],
                 "line": "- " + "; ".join(f"Works with `{by_id[n]['name']}`" for n in near)})
    # 3. oversized: move the biggest section out
    for o in found["oversized"]:
        s = by_id[o["skill"]]
        if s["skill_lines"] <= MAX_LINES or not o["biggest_sections"]:
            continue
        sec = o["biggest_sections"][0]
        slug = re.sub(r"[^a-z0-9]+", "-", sec["heading"].lower()).strip("-")[:40] or "section"
        add("move-to-references", o["skill"],
            f"move section '{sec['heading']}' ({sec['lines']} lines) to references/{slug}.md",
            {"op": "move_section", "file": s["skill_md"], "heading": sec["heading"],
             "target": f"references/{slug}.md"})
    # 4. collisions and dead refs: report only, a human rewrites descriptions
    for c in found["collisions"][:40]:
        add("sharpen-trigger", c["skills"][0], f"phrase '{c['phrase']}' is claimed by {', '.join(c['skills'])}",
            {"op": "manual"})
    for d in found["dead_refs"]:
        add("fix-dead-ref", d["skill"], "missing: " + ", ".join(d["refs"][:6]), {"op": "manual"})
    return props


# ---------------------------------------------------------------- report

def render_md(meta, skills, edges, found, chain_list, props):
    by_id = {s["id"]: s for s in skills}
    L = []
    w = L.append
    w(f"# Skills map\n")
    w(f"Generated {meta['date']} by skill-organiser. Read only scan of: {', '.join(meta['roots'])}.\n")
    w("## Summary\n")
    w("| Measure | Value |\n|---|---|")
    for k, v in meta["numbers"].items():
        w(f"| {k} | {v} |")
    w("")
    w("## Families\n")
    fam = defaultdict(list)
    for sid, g in found["families"].items():
        fam[g].append(sid)
    w("| Family | Skills |\n|---|---|")
    for g in sorted(fam, key=lambda g: (g == "solo", -len(fam[g]), g)):
        if g == "solo":
            continue
        w(f"| {g} | {len(fam[g])}: {', '.join(sorted(fam[g])[:12])}{' ...' if len(fam[g]) > 12 else ''} |")
    w(f"| solo | {len(fam.get('solo', []))} skills with no family |\n")
    w("## Chains (pipelines found from handoff lines)\n")
    if chain_list:
        for c in chain_list:
            w("- " + " -> ".join(f"`{x}`" for x in c))
    else:
        w("- none found")
    w("")
    w("## Hubs (most linked)\n")
    hubs = sorted(skills, key=lambda s: -(found["indeg"][s["id"]] + found["outdeg"][s["id"]]))[:12]
    w("| Skill | In | Out |\n|---|---|---|")
    for s in hubs:
        w(f"| {s['id']} | {found['indeg'][s['id']]} | {found['outdeg'][s['id']]} |")
    w("")
    w("## Trigger collisions (same phrase, two skills)\n")
    if found["collisions"]:
        for c in found["collisions"][:40]:
            w(f"- \"{c['phrase']}\": {', '.join(c['skills'])}")
    else:
        w("- none")
    w("")
    w("## Description overlap (likely duplicates or rivals)\n")
    cross = [o for o in found["overlaps"] if not o["same_family"]][:25]
    if cross:
        w("| A | B | Overlap | Shared words |\n|---|---|---|---|")
        for o in cross:
            w(f"| {o['a']} | {o['b']} | {o['score']} | {', '.join(o['shared'][:8])} |")
    else:
        w("- none above threshold")
    w("")
    if found["name_collisions"]:
        w("## Same name installed twice\n")
        for n in found["name_collisions"]:
            w(f"- `{n['name']}`: {'; '.join(n['paths'])}")
        w("")
    w("## Orphans (no skill names them, they name no skill)\n")
    w(", ".join(f"`{o}`" for o in sorted(found["orphans"])) or "none")
    w("")
    w("## Oversized\n")
    if found["oversized"]:
        w("| Skill | Why | Biggest section | Has references/ |\n|---|---|---|---|")
        for o in found["oversized"]:
            bs = o["biggest_sections"][0] if o["biggest_sections"] else {"heading": "-", "lines": 0}
            w(f"| {o['skill']} | {'; '.join(o['reasons'])} | {bs['heading']} ({bs['lines']} lines) | {'yes' if o['has_references'] else 'no'} |")
    else:
        w("- none")
    w("")
    w("## Dead file references\n")
    if found["dead_refs"]:
        for d in found["dead_refs"]:
            w(f"- `{d['skill']}`: {', '.join(d['refs'][:8])}")
    else:
        w("- none")
    w("")
    if meta.get("backups"):
        w("## Backup copies skipped\n")
        for b in meta["backups"]:
            w(f"- {b}")
        w("")
    w("## Proposed restructure\n")
    w("Apply mode only adds `Works with` lines or moves one section into references/. "
      "It never deletes a skill. Nothing below has been applied.\n")
    kinds = defaultdict(list)
    for p in props:
        kinds[p["kind"]].append(p)
    titles = {"works-with": "Add Works with / Receives from lines",
              "move-to-references": "Move bulky sections into references/",
              "sharpen-trigger": "Sharpen colliding triggers (manual)",
              "fix-dead-ref": "Fix dead references (manual)"}
    for k in ["works-with", "move-to-references", "sharpen-trigger", "fix-dead-ref"]:
        if not kinds[k]:
            continue
        w(f"### {titles[k]} ({len(kinds[k])})\n")
        for p in kinds[k][:60]:
            w(f"- **{p['id']}** `{p['skill']}`: {p['detail']}")
        if len(kinds[k]) > 60:
            w(f"- ... {len(kinds[k]) - 60} more in proposals.json")
        w("")
    w("To apply: `python3 ~/.claude/skills/skill-organiser/scripts/apply.py --proposals <out>/proposals.json --ids P001,P002` "
      "(dry run), then add `--yes` after the user confirms.\n")
    return "\n".join(L)

# ---------------------------------------------------------------- public (shareable) map

def _globs(values):
    out = []
    for v in values or []:
        if os.path.isfile(os.path.expanduser(v)):
            out += [l.strip() for l in open(os.path.expanduser(v), encoding="utf-8") if l.strip() and not l.startswith("#")]
        else:
            out += [x.strip() for x in v.split(",") if x.strip()]
    return out


def public_aliases(skills, found, keep, hide):
    """Map every skill id and family to a shareable label.

    A skill keeps its real name only if it matches a --keep glob and no --hide glob.
    Everything else becomes skill-001, skill-002 ... A family keeps its name only if all its
    members are shown; otherwise it becomes family-A, family-B ...
    """
    def shown(s):
        names = (s["id"], s["name"])
        if any(fnmatch.fnmatch(n, h) for h in hide for n in names):
            return False
        return any(fnmatch.fnmatch(n, k) for k in keep for n in names)

    alias, n = {}, 0
    for s in sorted(skills, key=lambda s: s["id"]):
        if shown(s):
            alias[s["id"]] = s["id"]
        else:
            n += 1
            alias[s["id"]] = f"skill-{n:03d}"
    members = defaultdict(list)
    for sid, g in found["families"].items():
        members[g].append(sid)
    fam_alias, k = {"solo": "solo"}, 0
    for g in sorted(members):
        if g == "solo":
            continue
        if all(alias[m] == m for m in members[g]) and not any(fnmatch.fnmatch(g, h) for h in hide):
            fam_alias[g] = g
        else:
            fam_alias[g] = "family-" + _letters(k)
            k += 1
    return alias, fam_alias


def _letters(i):
    out = ""
    i += 1
    while i:
        i, r = divmod(i - 1, 26)
        out = chr(65 + r) + out
    return out


def render_public(meta, skills, edges, found, chain_list, props, alias, fam_alias):
    """Same structure as SKILLS-MAP.md with private text removed: hidden names, no paths, no section
    headings, no description words, no reference paths, and trigger phrases only when every claimant is shown."""
    A = lambda sid: alias.get(sid, "skill-?")
    L = []
    w = L.append
    hidden = sum(1 for k, v in alias.items() if k != v)
    w("# Skills map (public)\n")
    w(f"Generated {meta['date']} by skill-organiser. {hidden} of {len(skills)} skill names are replaced with "
      "neutral labels; paths, section headings and description text are left out.\n")
    w("## Summary\n")
    w("| Measure | Value |\n|---|---|")
    for key, v in meta["numbers"].items():
        w(f"| {key} | {v} |")
    w("")
    w("## Families\n")
    fam = defaultdict(list)
    for sid, g in found["families"].items():
        fam[fam_alias.get(g, g)].append(A(sid))
    w("| Family | Skills |\n|---|---|")
    for g in sorted(fam, key=lambda g: (g == "solo", -len(fam[g]), g)):
        if g == "solo":
            continue
        names = sorted(fam[g])
        w(f"| {g} | {len(names)}: {', '.join(names[:12])}{' ...' if len(names) > 12 else ''} |")
    w(f"| solo | {len(fam.get('solo', []))} skills with no family |\n")
    w("## Chains\n")
    for c in chain_list or []:
        w("- " + " -> ".join(f"`{A(x)}`" for x in c))
    if not chain_list:
        w("- none found")
    w("")
    w("## Hubs (most linked)\n")
    hubs = sorted(skills, key=lambda s: -(found["indeg"][s["id"]] + found["outdeg"][s["id"]]))[:12]
    w("| Skill | In | Out |\n|---|---|---|")
    for s in hubs:
        w(f"| {A(s['id'])} | {found['indeg'][s['id']]} | {found['outdeg'][s['id']]} |")
    w("")
    w("## Trigger collisions\n")
    for c in found["collisions"][:40]:
        open_ = all(alias.get(x) == x for x in c["skills"])
        phrase = f"\"{c['phrase']}\"" if open_ else "(phrase hidden)"
        w(f"- {phrase}: {', '.join(A(x) for x in c['skills'])}")
    if not found["collisions"]:
        w("- none")
    w("")
    w("## Description overlap\n")
    cross = [o for o in found["overlaps"] if not o["same_family"]][:25]
    for o in cross:
        w(f"- {A(o['a'])} and {A(o['b'])}: overlap {o['score']}")
    if not cross:
        w("- none above threshold")
    w("")
    w(f"## Same name installed twice\n\n{len(found['name_collisions'])} names\n")
    w("## Orphans\n")
    w(", ".join(f"`{A(o)}`" for o in sorted(found["orphans"], key=A)) or "none")
    w("")
    w("## Oversized\n")
    w("| Skill | Lines | Has references/ |\n|---|---|---|")
    for o in found["oversized"]:
        w(f"| {A(o['skill'])} | {o['lines']} | {'yes' if o['has_references'] else 'no'} |")
    w("")
    w("## Dead file references\n")
    for d in found["dead_refs"]:
        w(f"- `{A(d['skill'])}`: {len(d['refs'])} missing")
    if not found["dead_refs"]:
        w("- none")
    w("")
    w("## Proposed restructure (nothing applied)\n")
    kinds = defaultdict(int)
    for p in props:
        kinds[p["kind"]] += 1
    w("| Kind | Proposals |\n|---|---|")
    for k, v in kinds.items():
        w(f"| {k} | {v} |")
    w("")
    graph = {"nodes": [{"id": A(s["id"]), "group": fam_alias.get(found["families"][s["id"]], "solo"),
                        "size": s["skill_lines"]} for s in skills],
             "edges": [{"source": A(e["source"]), "target": A(e["target"]), "kind": e["kind"]} for e in edges]}
    return "\n".join(L), graph


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root", action="append", help="skills root (repeatable)")
    ap.add_argument("--plugins", action="store_true", help="also scan ~/.claude/plugins/cache")
    ap.add_argument("--out", default=DEFAULT_OUT)
    ap.add_argument("--graph", help="also write a {nodes,edges} graph JSON here")
    ap.add_argument("--quiet", action="store_true")
    ap.add_argument("--public", action="store_true",
                    help="also write SKILLS-MAP.public.md (and make --graph public) with names hidden")
    ap.add_argument("--keep", action="append",
                    help="globs (comma list or a file, one per line) of skill names safe to show; default: none")
    ap.add_argument("--hide", action="append",
                    help="globs of skill or family names to hide even when --keep matches")
    a = ap.parse_args()

    roots = [("user", os.path.expanduser(r)) for r in (a.root or [DEFAULT_ROOT])]
    if a.plugins:
        roots.append(("plugin", PLUGIN_ROOT))
    found_dirs, backups = discover(roots)
    skill_dirs = {d for _, d in found_dirs}

    skills = []
    for source, d in found_dirs:
        p = os.path.join(d, "SKILL.md")
        try:
            text = open(p, encoding="utf-8", errors="replace").read()
        except OSError:
            continue
        fm, body = parse_frontmatter(text)
        name = (fm.get("name") or os.path.basename(d)).strip()
        root = next(r for s, r in roots if d.startswith(r))
        rel = os.path.relpath(d, root)
        parts = rel.split(os.sep)
        parent = None
        plugin = None
        if source == "plugin":
            plugin = parts[0] + ("/" + parts[1] if len(parts) > 1 else "")
        elif len(parts) > 1:
            parent = parts[0] if not parts[0].startswith("synced") else "synced"
        nested = {x for x in skill_dirs if x != d and x.startswith(d + os.sep)}
        files = list_files(d, nested)
        refs = []
        for f, size in files:
            if f.endswith(REF_EXT) and f != "SKILL.md" and size < 400_000 and not f.startswith("examples"):
                try:
                    refs.append((f, open(os.path.join(d, f), encoding="utf-8", errors="replace").read()))
                except OSError:
                    pass
        desc = fm.get("description", "")
        realdir = os.path.realpath(d)
        managed = None
        if source == "plugin":
            managed = "plugin"
        elif parent == "synced":
            managed = "synced"
        elif not realdir.startswith(os.path.realpath(root) + os.sep):
            managed = "external"
        skills.append({
            "managed": managed,
            "name": name, "source": source, "parent": parent, "plugin": plugin,
            "path_display": ("~" + d[len(HOME):]) if d.startswith(HOME) else d,
            "skill_md": p,
            "description": desc,
            "user_invoked": str(fm.get("disable-model-invocation", "")).lower() == "true",
            "triggers": triggers_of(desc),
            "skill_lines": text.count("\n") + 1,
            "skill_bytes": len(text.encode("utf-8")),
            "files": len(files), "total_bytes": sum(s for _, s in files),
            "has_references": any(f.startswith(("references", "reference")) for f, _ in files),
            "has_scripts": any(f.startswith("scripts") for f, _ in files),
            "dead_refs": dead_refs(d, body),
            "_body": body, "_refs": refs, "_words": words_of(desc), "_sections": h2_sections(body),
        })

    # stable unique ids
    count = defaultdict(int)
    for s in skills:
        count[s["name"]] += 1
    for s in skills:
        if count[s["name"]] > 1:
            tag = s["plugin"] or s["parent"] or "top"
            s["id"] = f"{tag}/{s['name']}"
        else:
            s["id"] = s["name"]

    edges = build_edges(skills)
    found = analyse(skills, edges)
    chain_list = chains([s["id"] for s in skills], edges)
    props = proposals(skills, edges, found, chain_list)

    n_handoff = sum(1 for e in edges if e["kind"] == "handoff")
    meta = {
        "date": date.today().isoformat(),
        "roots": [r for _, r in roots],
        "backups": backups,
        "numbers": {
            "Skills scanned": len(skills),
            "Families": len({g for g in found["families"].values() if g != "solo"}),
            "Links between skills": len(edges),
            "Handoff links": n_handoff,
            "Chains of 3+ skills": len(chain_list),
            "Orphans": len(found["orphans"]),
            "Trigger collisions": len(found["collisions"]),
            "Cross family overlaps": len([o for o in found["overlaps"] if not o["same_family"]]),
            "Oversized SKILL.md": len(found["oversized"]),
            "Skills with dead refs": len(found["dead_refs"]),
            "Backup copies skipped": len(backups),
            "Managed elsewhere (synced, plugin, symlink)": sum(1 for s in skills if s["managed"]),
            "Proposals": len(props),
        },
    }
    public = [{k: v for k, v in s.items() if not k.startswith("_")} for s in skills]
    for s in public:
        s["in"] = found["indeg"][s["id"]]
        s["out"] = found["outdeg"][s["id"]]
        s["family"] = found["families"][s["id"]]
    out = {"meta": meta, "skills": public, "edges": edges, "chains": chain_list,
           "collisions": found["collisions"], "overlaps": found["overlaps"],
           "name_collisions": found["name_collisions"], "orphans": found["orphans"],
           "oversized": found["oversized"], "dead_refs": found["dead_refs"], "proposals": props}

    os.makedirs(a.out, exist_ok=True)
    with open(os.path.join(a.out, "skills-map.json"), "w", encoding="utf-8") as f:
        json.dump(deep_clean(out), f, ensure_ascii=False, indent=1)
    with open(os.path.join(a.out, "proposals.json"), "w", encoding="utf-8") as f:
        json.dump(deep_clean(props), f, ensure_ascii=False, indent=1)
    with open(os.path.join(a.out, "SKILLS-MAP.md"), "w", encoding="utf-8") as f:
        f.write(clean(render_md(meta, skills, edges, found, chain_list, props)))
    pub_graph = None
    if a.public:
        keep = _globs(a.keep) or ["skill-organiser"]
        alias, fam_alias = public_aliases(skills, found, keep, _globs(a.hide))
        pub_md, pub_graph = render_public(meta, skills, edges, found, chain_list, props, alias, fam_alias)
        with open(os.path.join(a.out, "SKILLS-MAP.public.md"), "w", encoding="utf-8") as f:
            f.write(clean(pub_md))
    if a.graph:
        g = pub_graph or {"nodes": [{"id": s["id"], "group": found["families"][s["id"]],
                        "size": s["skill_lines"]} for s in skills],
             "edges": [{"source": e["source"], "target": e["target"], "kind": e["kind"]} for e in edges]}
        os.makedirs(os.path.dirname(os.path.abspath(a.graph)), exist_ok=True)
        with open(a.graph, "w", encoding="utf-8") as f:
            json.dump(deep_clean(g), f, ensure_ascii=False)
    if not a.quiet:
        for k, v in meta["numbers"].items():
            print(f"{k:28} {v}")
        print("wrote", a.out)


if __name__ == "__main__":
    sys.exit(main())
