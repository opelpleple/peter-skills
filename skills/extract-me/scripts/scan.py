#!/usr/bin/env python3
"""extract-me scanner: read-only, metadata-only inventory of a person's work.

Walks configured roots, finds projects (git repos or folders with a manifest),
and records per project: commit counts for the user's identities, file-type
counts, frameworks from manifests, README first line, last activity. Also lists
skills in a skills root and memory notes. Never opens secret-looking files and
never reads file bodies beyond manifests, README first lines, SKILL.md
frontmatter and memory frontmatter.

Usage:
  python3 scan.py --identity "jane" --identity "Jane Doe" --out scan.json \
      [--root ~/code --root ~/work] [--skills-root ~/.claude/skills] \
      [--memory-glob '~/.claude/projects/*/memory'] [--memory-file FILE] \
      [--rules domains.json] [--max-depth 3]
"""
import argparse, fnmatch, glob, json, os, re, subprocess, sys, time

DEFAULT_ROOTS = ["~/repo", "~/code", "~/projects"]
SKIP_DIRS = {"node_modules", ".git", ".next", "dist", "build", ".venv", "venv", "__pycache__",
             ".cache", "target", "Pods", ".turbo", "coverage", ".godot", ".import", ".svelte-kit",
             ".parcel-cache", "vendor", ".gradle", "DerivedData", "site-packages", ".mypy_cache",
             ".pytest_cache", ".idea", ".vscode", "secrets", ".ssh", ".gnupg", ".aws", ".config"}
# Secret-shaped names only. "*.key" is handled in is_secret() because Keynote decks share the
# extension; "token"/"secret" only match data-file extensions so tokens.css and secret-santa.md count.
SECRET_PATTERNS = [".env", ".env.*", "*.env", "*apikey*", "*api_key*", "*api-key*", "*privkey*", "*private_key*", "*key.json",
                   "*token", "*token*.txt", "*token*.json", "*token*.env", "*token*.yaml", "*token*.yml",
                   "*secret", "*secret*.json", "*secret*.yaml", "*secret*.yml", "*secret*.env", "*secret*.txt",
                   "*credential*",
                   "*.pem", "*.p12", "*.pfx", "id_rsa*", "id_ed25519*", "*password*", ".npmrc",
                   ".netrc", "*.keychain*", "*.sqlite", "*.db"]
MANIFESTS = ["package.json", "pyproject.toml", "requirements.txt", "Cargo.toml", "go.mod",
             "project.godot", "Gemfile", "composer.json", "pubspec.yaml", "SKILL.md",
             "remotion.config.ts", "deno.json", "Package.swift"]
MEDIA = {".mp4", ".mov", ".webm", ".wav", ".mp3", ".m4a", ".png", ".jpg", ".jpeg", ".webp",
         ".gif", ".svg", ".pdf", ".pptx", ".key", ".psd", ".blend", ".glb", ".fbx"}
MAX_FILES_PER_PROJECT = 25000


SECRET_ALLOW = ["tokens.css", "tokens.scss", "tokens.json", "*.tokens.json", "design-tokens.*", "*-tokens.css"]
KEY_DIRS = {"key", "keys", "ssl", "tls", "certs", "cert", "certificates"}
KEYNOTE_MIN_BYTES = 10 * 1024


def is_secret(name, path=None):
    """True for secret-looking files. A .key file is a secret when it is small (key material is
    tiny) or sits under a key/ssl folder; a larger one elsewhere is a Keynote deck. Without a
    path a .key file is treated as a secret."""
    low = name.lower()
    if any(fnmatch.fnmatch(low, p) for p in SECRET_ALLOW):
        return False
    if low.endswith(".key"):
        if path is None:
            return True
        parts = set(x.lower() for x in os.path.normpath(os.path.dirname(path)).split(os.sep))
        try:
            small = os.path.getsize(path) < KEYNOTE_MIN_BYTES
        except OSError:
            small = True
        return small or bool(parts & KEY_DIRS)
    return any(fnmatch.fnmatch(low, p) for p in SECRET_PATTERNS)


def identity_matches(identities, name, email):
    """Exact, case-insensitive match on author name, email or email local part."""
    name, email = name.strip().lower(), email.strip().lower()
    local = email.split("@")[0]
    return any(i.strip().lower() in (name, email, local) for i in identities)


def path_is_blocked(path):
    parts = set(os.path.normpath(path).split(os.sep))
    return bool(parts & {"secrets", ".ssh", ".gnupg"})


def first_readme_line(proj):
    for n in ("README.md", "README", "readme.md", "README.txt"):
        p = os.path.join(proj, n)
        if os.path.isfile(p):
            try:
                with open(p, encoding="utf-8", errors="replace") as f:
                    for line in f:
                        s = line.strip().lstrip("#").strip()
                        if s and not s.startswith(("<", "!", "[!", "```", "---")):
                            return s[:200]
            except OSError:
                return None
    return None


def manifest_packages(proj):
    pk = set()
    pj = os.path.join(proj, "package.json")
    if os.path.isfile(pj):
        try:
            d = json.load(open(pj, encoding="utf-8"))
            for k in ("dependencies", "devDependencies", "peerDependencies"):
                pk.update((d.get(k) or {}).keys())
        except Exception:
            pass
    for n in ("requirements.txt",):
        p = os.path.join(proj, n)
        if os.path.isfile(p):
            for line in open(p, encoding="utf-8", errors="replace"):
                m = re.match(r"\s*([A-Za-z0-9_.\-]+)", line)
                if m and not line.strip().startswith("#"):
                    pk.add(m.group(1).lower())
    pp = os.path.join(proj, "pyproject.toml")
    if os.path.isfile(pp):
        txt = open(pp, encoding="utf-8", errors="replace").read()
        for m in re.finditer(r'"([A-Za-z0-9_.\-]+)\s*[<>=~!\[;"]', txt):
            pk.add(m.group(1).lower())
    if os.path.isfile(os.path.join(proj, "project.godot")):
        pk.add("godot")
    if os.path.isfile(os.path.join(proj, "Cargo.toml")):
        pk.add("rust")
    if os.path.isfile(os.path.join(proj, "go.mod")):
        pk.add("go")
    return sorted(pk)


def git_stats(proj, identities):
    try:
        out = subprocess.run(["git", "-C", proj, "log", "--all", "--no-merges", "--format=%an\t%ae\t%at"],
                             capture_output=True, text=True, timeout=60).stdout
    except Exception:
        return None
    total = mine = 0
    first = last = None
    authors = {}
    for line in out.splitlines():
        parts = line.split("\t")
        if len(parts) != 3:
            continue
        an, ae, at = parts
        total += 1
        authors[an] = authors.get(an, 0) + 1
        if identity_matches(identities, an, ae):
            mine += 1
            t = int(at)
            first = t if first is None else min(first, t)
            last = t if last is None else max(last, t)
    return {"commits_total": total, "commits_mine": mine, "authors": len(authors),
            "author_names": sorted(authors)[:50],
            "first_mine": iso(first), "last_mine": iso(last)}


def iso(t):
    return time.strftime("%Y-%m-%d", time.localtime(t)) if t else None


def walk_project(proj):
    exts, media, n, newest = {}, 0, 0, 0
    subdirs = []
    base = proj.rstrip(os.sep).count(os.sep)
    for dp, dns, fns in os.walk(proj):
        if dp.rstrip(os.sep).count(os.sep) - base < 2:
            subdirs += [d for d in dns if d not in SKIP_DIRS and not d.startswith(".")][:20]
        dns[:] = [d for d in dns if d not in SKIP_DIRS and not d.startswith(".")]
        if path_is_blocked(dp):
            dns[:] = []
            continue
        for fn in fns:
            if fn.startswith(".") or is_secret(fn, os.path.join(dp, fn)):
                continue
            n += 1
            if n > MAX_FILES_PER_PROJECT:
                break
            e = os.path.splitext(fn)[1].lower() or "(none)"
            exts[e] = exts.get(e, 0) + 1
            if e in MEDIA:
                media += 1
            try:
                m = os.stat(os.path.join(dp, fn)).st_mtime
                newest = max(newest, m)
            except OSError:
                pass
        if n > MAX_FILES_PER_PROJECT:
            break
    top = dict(sorted(exts.items(), key=lambda kv: -kv[1])[:15])
    return {"files": min(n, MAX_FILES_PER_PROJECT), "truncated": n > MAX_FILES_PER_PROJECT,
            "subdirs": subdirs[:40],
            "ext": top, "media_files": media, "last_touched": iso(newest)}


def _search(top, max_depth):
    found = []
    base = top.rstrip(os.sep).count(os.sep)
    for dp, dns, fns in os.walk(top):
        if path_is_blocked(dp):
            dns[:] = []
            continue
        is_git = os.path.isdir(os.path.join(dp, ".git"))
        if is_git or any(m in fns for m in MANIFESTS):
            found.append((dp, is_git, "repo" if is_git else "manifest"))
            dns[:] = []
            continue
        if dp.rstrip(os.sep).count(os.sep) - base >= max_depth:
            dns[:] = []
            continue
        dns[:] = [d for d in dns if d not in SKIP_DIRS and not d.startswith(".")]
    return found


def find_projects(root, max_depth):
    """Each top-level folder of a root is a unit of work. Git repos or manifest
    folders inside it become their own projects; a folder with neither is kept
    as a single 'folder' project so loose work (films, decks, plans) counts."""
    root = os.path.expanduser(root)
    if not os.path.isdir(root):
        return []
    out = []
    for name in sorted(os.listdir(root)):
        top = os.path.join(root, name)
        if name.startswith(".") or name in SKIP_DIRS or not os.path.isdir(top) or os.path.islink(top):
            continue
        inner = _search(top, max_depth)
        out += inner if inner else [(top, False, "folder")]
    return out


def frontmatter(path):
    try:
        txt = open(path, encoding="utf-8", errors="replace").read(6000)
    except OSError:
        return {}
    m = re.match(r"---\s*\n(.*?)\n---", txt, re.S)
    if not m:
        return {}
    fm, key = {}, None
    for line in m.group(1).splitlines():
        km = re.match(r"([A-Za-z_-]+):\s*(.*)$", line)
        if km:
            key = km.group(1)
            fm[key] = km.group(2).strip().strip('"').strip(">").strip()
        elif key and line.startswith((" ", "\t")):
            fm[key] = (fm[key] + " " + line.strip()).strip()
    return fm


def scan_skills(skills_root, identities):
    out = []
    sr = os.path.expanduser(skills_root)
    if not os.path.isdir(sr):
        return out
    for name in sorted(os.listdir(sr)):
        p = os.path.join(sr, name)
        sk = os.path.join(p, "SKILL.md")
        if not os.path.isfile(sk):
            continue
        fm = frontmatter(sk)
        link = os.path.islink(p)
        has_license = any(os.path.isfile(os.path.join(p, f)) for f in ("LICENSE", "LICENSE.txt", "LICENSE.md"))
        author = (fm.get("author") or "").lower()
        reasons = []
        if link:
            reasons.append("symlink")
        if has_license:
            reasons.append("has LICENSE")
        if author and not any(i.lower() in author for i in identities):
            reasons.append("author field " + author[:40])
        files = sum(len(f) for _, _, f in os.walk(p))
        try:
            mt = os.stat(sk).st_mtime
        except OSError:
            mt = 0
        out.append({"name": fm.get("name", name), "dir": name,
                    "description": (fm.get("description") or "")[:240],
                    "files": files, "skill_md_lines": sum(1 for _ in open(sk, encoding="utf-8", errors="replace")),
                    "modified": iso(mt), "third_party_signals": reasons})
    fam = {}
    for s in out:
        pre = s["dir"].split("-")[0]
        fam[pre] = fam.get(pre, 0) + 1
    for s in out:
        pre = s["dir"].split("-")[0]
        if fam[pre] >= 8 and "-" in s["dir"]:
            s["third_party_signals"].append(f"family of {fam[pre]} '{pre}-' skills (likely a vendor pack)")
    return out


def scan_memory(globs, files):
    notes = []
    for g in globs:
        for d in glob.glob(os.path.expanduser(g)):
            for f in sorted(glob.glob(os.path.join(d, "*.md"))):
                if os.path.basename(f) == "MEMORY.md":
                    continue
                fm = frontmatter(f)
                notes.append({"file": os.path.basename(f), "name": fm.get("name", ""),
                              "description": (fm.get("description") or "")[:200],
                              "modified": iso(os.stat(f).st_mtime)})
    heads = []
    for f in files:
        p = os.path.expanduser(f)
        if not os.path.isfile(p):
            continue
        for line in open(p, encoding="utf-8", errors="replace"):
            m = re.match(r"\s*-\s+\*\*([^*]{3,120})\*\*", line)
            if m:
                heads.append(m.group(1).strip())
    return {"notes": notes, "memory_headings": heads}


def tokens(text):
    return set(t for t in re.split(r"[^a-z0-9ก-๙]+", text.lower()) if t)


def kw_hits(kw, text):
    """Whole-word match: single words against tokens, phrases as substrings."""
    toks = tokens(text)
    low = text.lower()
    return [k for k in kw if (k in toks) if not re.search(r"[^a-z0-9]", k)] + \
           [k for k in kw if re.search(r"[^a-z0-9]", k) and k in low]


def scan_loose(globs):
    out = []
    for g in globs:
        for f in sorted(glob.glob(os.path.expanduser(g))):
            b = os.path.basename(f)
            if not os.path.isfile(f) or is_secret(b, f):
                continue
            st = os.stat(f)
            out.append({"file": f.replace(os.path.expanduser("~"), "~"), "ext": os.path.splitext(b)[1].lower(),
                        "kb": st.st_size // 1024, "modified": iso(st.st_mtime)})
    return out


def score_domains(projects, skills, memory, rules, loose=()):
    res = {}
    for dom, r in rules.items():
        kw = [k.lower() for k in r.get("keywords", [])]
        pkgs = set(p.lower() for p in r.get("packages", []))
        exts = set(r.get("extensions", []))
        ev, score = [], 0
        for p in projects:
            hits = []
            hay = " ".join([p["path"], p.get("readme") or ""] + p["walk"].get("subdirs", [])).lower()
            hits += kw_hits(kw, hay)
            hits += [x for x in p.get("packages", []) if x.lower() in pkgs]
            ecount = sum(c for e, c in p["walk"]["ext"].items() if e in exts)
            if hits or ecount >= r.get("min_ext_files", 5):
                w = 1 + min(p.get("git", {}).get("commits_mine", 0) if p.get("git") else 0, 200) / 50
                score += w
                ev.append({"path": p["path"], "signals": sorted(set(hits))[:8], "ext_files": ecount,
                           "commits_mine": (p.get("git") or {}).get("commits_mine", 0)})
        sk = [s["dir"] for s in skills if not s["third_party_signals"] and
              kw_hits(kw, s["dir"] + " " + s["description"])]
        mem = [n["file"] for n in memory["notes"] if kw_hits(kw, n["file"] + " " + n["name"] + " " + n["description"])]
        memh = [h for h in memory["memory_headings"] if kw_hits(kw, h)]
        lf = [x["file"] for x in loose if kw_hits(kw, os.path.basename(x["file"]).replace("-", " "))
              or x["ext"] in exts]
        score += len(sk) * 0.5 + len(mem) * 0.25 + len(memh) * 0.5 + len(lf) * 0.25
        res[dom] = {"score": round(score, 1), "projects": len(ev), "skills": sk, "memory_notes": len(mem),
                    "loose_files": len(lf), "loose_examples": lf[:10],
                    "memory_headings": memh[:12],
                    "evidence": sorted(ev, key=lambda e: -(e["commits_mine"] + e["ext_files"] / 10))[:12]}
    return dict(sorted(res.items(), key=lambda kv: -kv[1]["score"]))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", action="append")
    ap.add_argument("--identity", action="append", required=True)
    ap.add_argument("--skills-root", default="~/.claude/skills")
    ap.add_argument("--memory-glob", action="append")
    ap.add_argument("--memory-file", action="append")
    ap.add_argument("--rules", default=os.path.join(os.path.dirname(__file__), "..", "references", "domains.json"))
    ap.add_argument("--max-depth", type=int, default=3)
    ap.add_argument("--loose-glob", action="append", help="loose deliverables, e.g. '~/*.html' (metadata only)")
    ap.add_argument("--exclude", action="append", help="glob on project path, default */references/*")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    roots = a.root or DEFAULT_ROOTS
    for i in a.identity:
        if len(i.strip()) < 4:
            print(f"warning: identity '{i}' is shorter than 4 characters; it only matches an exact name, email or email local part", file=sys.stderr)
    if not any(os.path.isdir(os.path.expanduser(r)) for r in roots):
        print("warning: none of the roots exist (" + ", ".join(roots) + "); pass --root for your project folders", file=sys.stderr)
    rules = json.load(open(a.rules, encoding="utf-8"))
    projects = []
    t0 = time.time()
    for r in roots:
        for path, is_git, kind in find_projects(r, a.max_depth):
            if any(fnmatch.fnmatch(path, os.path.expanduser(x)) for x in (a.exclude or ["*/references/*"])):
                continue
            p = {"path": path.replace(os.path.expanduser("~"), "~"), "root": r, "kind": kind, "git": None}
            if is_git:
                p["git"] = git_stats(path, a.identity)
            p["packages"] = manifest_packages(path)
            p["readme"] = first_readme_line(path)
            p["walk"] = walk_project(path)
            projects.append(p)
    skills = scan_skills(a.skills_root, a.identity)
    memory = scan_memory(a.memory_glob or ["~/.claude/projects/*/memory"], a.memory_file or [])
    loose = scan_loose(a.loose_glob or [])
    domains = score_domains(projects, skills, memory, rules, loose)
    authored = [s for s in skills if not s["third_party_signals"]]
    totals = {"projects": len(projects), "git_repos": sum(1 for p in projects if p["git"]),
              "repos_with_my_commits": sum(1 for p in projects if p["git"] and p["git"]["commits_mine"]),
              "commits_mine": sum((p["git"] or {}).get("commits_mine", 0) for p in projects),
              "files_seen": sum(p["walk"]["files"] for p in projects),
              "media_files": sum(p["walk"]["media_files"] for p in projects),
              "skills_total": len(skills), "skills_authored_guess": len(authored),
              "loose_files": len(loose), "memory_notes": len(memory["notes"]), "memory_headings": len(memory["memory_headings"]),
              "seconds": round(time.time() - t0, 1)}
    out = {"generated": time.strftime("%Y-%m-%d %H:%M"), "identities": a.identity, "roots": roots,
           "totals": totals, "domains": domains, "projects": projects, "loose": loose, "skills": skills, "memory": memory}
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    text = json.dumps(out, ensure_ascii=False, indent=1)
    text = text.replace("\u2013", "-").replace("\u2014", "-")  # normalise long dashes from scanned text
    with open(a.out, "w", encoding="utf-8") as f:
        f.write(text)
    try:
        os.chmod(a.out, 0o600)
    except OSError:
        pass
    print(json.dumps(totals))
    for d, v in domains.items():
        print(f"{d:14} score {v['score']:6}  projects {v['projects']:3}  skills {len(v['skills']):2}")


if __name__ == "__main__":
    main()
