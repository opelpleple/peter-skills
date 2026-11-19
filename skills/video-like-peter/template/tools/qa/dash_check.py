#!/usr/bin/env python3
"""Find em dash (U+2014) and en dash (U+2013) characters in project text files (the brief's house rule:
write commas, colons, parentheses or separate sentences instead; a plain ASCII hyphen is fine).

usage: python3 tools/qa/dash_check.py [paths ...] [--all]
  default path: the project folder. Skips binary files, work/stems, work/render, node_modules, .git.
  Third-party text kept verbatim (tools/vendor/**, the fonts' OFL.txt licence files) is reported only with
  --all, and never fails the check. Exit code 1 when an authored file contains a dash character.
"""
import os, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
DASHES = {'\u2014': 'EM DASH', '\u2013': 'EN DASH'}
SKIP_DIRS = {'.git', 'node_modules', '__pycache__'}
SKIP_REL = ('work/stems', 'work/render', 'work/tools/bench')
TEXT_EXT = {'.md', '.txt', '.json', '.js', '.mjs', '.cjs', '.ts', '.html', '.htm', '.css', '.svg', '.py', '.sh', '.csv', '.srt', '.vtt', '.yaml', '.yml', '.xml', '.glsl', '.frag', '.vert', '.toml', '.ini', '.cfg', ''}

def third_party(rel):
    return rel.startswith('tools/vendor/') or (rel.startswith(('tools/fonts/', 'film/fonts/')) and os.path.basename(rel).upper().startswith(('OFL', 'LICENSE')))

def scan(path):
    hits = []
    try:
        if os.path.getsize(path) > 20_000_000: return hits
        with open(path, 'rb') as f: data = f.read()
    except OSError:
        return hits
    if b'\x00' in data[:4096]: return hits
    try: text = data.decode('utf-8')
    except UnicodeDecodeError: return hits
    if not any(d in text for d in DASHES): return hits
    for ln, line in enumerate(text.splitlines(), 1):
        for col, ch in enumerate(line, 1):
            if ch in DASHES:
                hits.append((ln, col, DASHES[ch], line.strip()[:140]))
    return hits

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    show_all = '--all' in sys.argv
    paths = args or [ROOT]
    authored, vendored = {}, {}
    scanned = 0
    for p in paths:
        p = os.path.abspath(p)
        files = [p] if os.path.isfile(p) else []
        if os.path.isdir(p):
            for d, dirs, fs in os.walk(p):
                rel_d = os.path.relpath(d, ROOT).replace(os.sep, '/')
                dirs[:] = [x for x in dirs if x not in SKIP_DIRS and not any((rel_d + '/' + x).lstrip('./').startswith(s) for s in SKIP_REL)]
                files += [os.path.join(d, f) for f in fs if os.path.splitext(f)[1].lower() in TEXT_EXT]
        for f in files:
            rel = os.path.relpath(f, ROOT).replace(os.sep, '/')
            h = scan(f)
            if not third_party(rel): scanned += 1
            if h: (vendored if third_party(rel) else authored)[rel] = h
    for rel, h in sorted(authored.items()):
        for ln, col, name, ctx in h:
            print(f'{rel}:{ln}:{col}: {name}: {ctx}')
    if show_all:
        for rel, h in sorted(vendored.items()):
            print(f'(third-party, verbatim) {rel}: {len(h)} dash characters')
    n = sum(len(h) for h in authored.values())
    print(f'dash_check: scanned {scanned} authored file(s): {n} dash characters in {len(authored)} of them; {sum(len(h) for h in vendored.values())} in {len(vendored)} third-party file(s) kept verbatim')
    sys.exit(1 if n else 0)

if __name__ == '__main__':
    main()
