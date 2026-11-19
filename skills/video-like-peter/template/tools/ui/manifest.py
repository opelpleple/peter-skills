"""Merge work/ui/anchors.json (sizes and anchors) with film/assets/ui/index.json (captured PNGs) into
film/assets/ui/manifest.json, the file engine/brand.js uiCard() reads. Then, if Pillow is installed, tile every
PNG on the light field colour into work/qa/ui-gallery.jpg so you can open it and look at the whole kit."""
import json, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
A = json.load(open(f'{ROOT}/work/ui/anchors.json'))
X = json.load(open(f'{ROOT}/film/assets/ui/index.json'))
man = {}
for name, a in A.items():
    if name not in X:
        print('missing png', name); continue
    x = X[name]
    man[name] = {'file': f'{name}.png', 'w': a['w'], 'h': a['h'], 'pad': x['pad'], 'dpr': x['dpr'], 'anchors': a['anchors']}
json.dump(man, open(f'{ROOT}/film/assets/ui/manifest.json', 'w'), indent=1)
print('manifest', len(man), 'components:', ', '.join(man))

try:
    from PIL import Image
except ImportError:
    print('no Pillow: gallery skipped (pip install pillow, or run with uv run --with pillow)')
    raise SystemExit(0)
items = []
for name, m in man.items():
    im = Image.open(f"{ROOT}/film/assets/ui/{m['file']}").convert('RGBA')
    k = 0.5 / m['dpr']                      # half of the CSS size
    items.append((name, im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))), Image.LANCZOS)))
W = max([1600] + [im.width for _, im in items]); x = y = 0; rowh = 0; pos = []
for name, im in items:
    if x + im.width > W: x = 0; y += rowh; rowh = 0
    pos.append((x, y, im)); x += im.width; rowh = max(rowh, im.height)
bg = Image.new('RGBA', (W, max(1, y + rowh)), (242, 241, 236, 255))
for x, y, im in pos:
    bg.alpha_composite(im, (x, y))
os.makedirs(f'{ROOT}/work/qa', exist_ok=True)
bg.convert('RGB').save(f'{ROOT}/work/qa/ui-gallery.jpg', quality=90)
print('gallery', f'{ROOT}/work/qa/ui-gallery.jpg')
