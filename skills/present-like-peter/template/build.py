#!/usr/bin/env python3
"""Inline src/ into ONE offline HTML file, then run the gates.

usage: python3 build.py [--out dist/index.html] [--three path/to/three.min.js] [--budget-kb 3000]

src/index.src.html  page with placeholders /*{{FONTS}}*/ /*{{CSS}}*/ /*{{THREE}}*/ /*{{ENGINE}}*/ /*{{SCENES}}*/
src/deck.css        tokens and layout
src/engine.js       the deck engine (do not fork per deck; fix it here)
src/scenes.js       canvas set pieces
src/fonts/fonts.json optional: [{"family": "Inter", "file": "Inter.woff2", "weight": "100 900", "style": "normal"}]

Gates (build fails): em or en dash in any source file, fonts.json or *.md in the deck folder, a runtime network reference outside
<aside class="notes">, a slide without notes, a data-step higher than the slide's data-steps.
"""
import argparse, base64, json, re, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE / 'src'
ap = argparse.ArgumentParser()
ap.add_argument('--out', default=str(HERE / 'dist' / 'index.html'))
ap.add_argument('--three', default='')
ap.add_argument('--budget-kb', type=int, default=3000)
args = ap.parse_args()

errors = []
DASHES = [chr(0x2014), chr(0x2013), '&' + 'mdash;', '&' + 'ndash;', '&#' + '8212;', '&#' + '8211;']


def read(name):
    p = SRC / name
    return p.read_text(encoding='utf-8') if p.exists() else ''


html, css, engine, scenes = read('index.src.html'), read('deck.css'), read('engine.js'), read('scenes.js')
dash_targets = [('index.src.html', html), ('deck.css', css), ('engine.js', engine), ('scenes.js', scenes),
                ('fonts/fonts.json', read('fonts/fonts.json'))]
# working files the skill writes next to build.py: brief.md, RESEARCH.md, STORY.md, CRITIQUE.md
dash_targets += [(md.name, md.read_text(encoding='utf-8')) for md in sorted(HERE.glob('*.md'))]
for name, text in dash_targets:
    for d in DASHES:
        for m in re.finditer(re.escape(d), text):
            line = text.count('\n', 0, m.start()) + 1
            errors.append(f'dash {d!r} in {name}:{line}')

# network references outside speaker notes
def strip_notes(t):
    return re.sub(r'<aside class="notes">.*?</aside>', '', t, flags=re.S)

NET = [r'''(?:src|href|srcset)\s*=\s*["']\s*(?:https?:)?//''', r'''url\(\s*["']?\s*(?:https?:)?//''', r'@import', r'''fetch\(\s*["'`]\s*https?:''', r'''import\s[^;]*?from\s*["']https?:''', r'''<link[^>]+stylesheet''']
for name, text in [('index.src.html', strip_notes(html)), ('deck.css', css), ('engine.js', engine), ('scenes.js', scenes)]:
    for pat in NET:
        for m in re.finditer(pat, text, flags=re.I):
            errors.append(f'network reference in {name}: {text[m.start():m.start()+60]!r}')

# slide structure
for i, m in enumerate(re.finditer(r'<section class="slide"(.*?)</section>', html, flags=re.S), 1):
    attrs_end = m.group(1).find('>')
    attrs, body = m.group(1)[:attrs_end], m.group(1)[attrs_end:]
    n_steps = int((re.search(r'data-steps="(\d+)"', attrs) or [0, 0])[1])
    for s in re.findall(r'data-step="(\d+)"', body):
        if int(s) > n_steps:
            errors.append(f'slide {i}: data-step="{s}" but data-steps="{n_steps}"')
    notes = re.search(r'<aside class="notes">(.*?)</aside>', body, flags=re.S)
    if not notes or not re.sub(r'<[^>]+>|\s', '', notes.group(1)):
        errors.append(f'slide {i}: no speaker notes')

if errors:
    print('BUILD FAILED')
    for e in errors:
        print(' -', e)
    sys.exit(1)

fonts_css = ''
fj = SRC / 'fonts' / 'fonts.json'
if fj.exists():
    for f in json.loads(fj.read_text()):
        p = SRC / 'fonts' / f['file']
        fmt = 'woff2' if p.suffix == '.woff2' else 'truetype'
        mime = 'font/woff2' if fmt == 'woff2' else 'font/ttf'
        b = base64.b64encode(p.read_bytes()).decode()
        fonts_css += (f'@font-face{{font-family:"{f["family"]}";src:url(data:{mime};base64,{b}) format("{fmt}");'
                      f'font-weight:{f.get("weight", 400)};font-style:{f.get("style", "normal")};font-display:block}}\n')

three = Path(args.three).read_text(encoding='utf-8') if args.three else ''
for key, val in {'/*{{FONTS}}*/': fonts_css, '/*{{CSS}}*/': css, '/*{{THREE}}*/': three, '/*{{ENGINE}}*/': engine, '/*{{SCENES}}*/': scenes}.items():
    if html.count(key) != 1:
        sys.exit(f'placeholder {key} must appear exactly once')
    html = html.replace(key, val.replace('</script', '<\\/script'))

out = Path(args.out)
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(html, encoding='utf-8')
kb = out.stat().st_size / 1024
slides = len(re.findall(r'<section class="slide"', html))
print(f'{out}  {slides} slides  {kb:.0f} KB' + ('  OVER BUDGET' if kb > args.budget_kb else ''))
if kb > args.budget_kb:
    sys.exit(1)
