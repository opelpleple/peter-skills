#!/usr/bin/env python3
"""Image-based PPTX with presenter notes from an export.cjs folder.
usage: python3 to_pptx.py <export_dir> <out.pptx>   (needs python-pptx and Pillow)
Each slide is the full-bleed PNG (compressed to JPG in a temp folder, not left in the export);
notes carry the speaker notes and sources.
The PPTX is for sharing and printing; the HTML stays the master."""
import json, sys, tempfile
from pathlib import Path

if len(sys.argv) != 3:
    sys.exit('usage: python3 to_pptx.py <export_dir> <out.pptx>')
try:
    from pptx import Presentation
    from pptx.util import Inches
    from PIL import Image
except ImportError as e:
    sys.exit(f'missing dependency ({e.name}): pip install python-pptx pillow')

ex, out = Path(sys.argv[1]), Path(sys.argv[2])
notes_file = ex / 'notes.json'
if not notes_file.exists():
    sys.exit(f'{notes_file} not found: run scripts/export.cjs <deck.html> {ex} first')
try:
    pages = json.loads(notes_file.read_text(encoding='utf-8'))
except json.JSONDecodeError as e:
    sys.exit(f'{notes_file} is not valid JSON: {e}')
missing = [p.get('png', '?') for p in pages if not (ex / p.get('png', '')).is_file()]
if missing:
    sys.exit(f'slide images missing in {ex}: {", ".join(missing)}')

prs = Presentation()
prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)
with tempfile.TemporaryDirectory() as tmp:
    for i, p in enumerate(pages, 1):
        s = prs.slides.add_slide(prs.slide_layouts[6])
        jpg = Path(tmp) / f'{i:03d}.jpg'
        Image.open(ex / p['png']).convert('RGB').save(jpg, quality=90, optimize=True)
        s.shapes.add_picture(str(jpg), 0, 0, width=prs.slide_width, height=prs.slide_height)
        s.notes_slide.notes_text_frame.text = p.get('notes', '')
    out.parent.mkdir(parents=True, exist_ok=True)
    prs.save(out)
print(out, len(pages), 'slides')
