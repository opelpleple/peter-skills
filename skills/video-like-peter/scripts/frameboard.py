#!/usr/bin/env python3
"""frameboard.py: turn docs/storyboard.json into one self-contained HTML board.

    python3 -I scripts/frameboard.py <film>/docs/storyboard.json <film>/boards/storyboard.html [--thumb 360] [--no-source] [--no-ref-frames]

--no-source is the public copy: it hides reference channels and URLs and drops the reference frames (a
reference's frames are for study, not for publishing). --no-ref-frames drops only the frames.

The board has three parts: the reference board (frames, measured pacing, palette, what to steal and what to
leave), a timeline strip on the beat grid, and the frame board (one card per shot: rough frame, time, copy,
motion, the stolen idea, sound). A shot without a rendered frame gets a drawn placeholder in its field
colour with its copy, so the board works before any code exists; re-run it after `tools/bin/stills` and
the placeholders become real frames.

Paths inside the JSON are relative to the film folder (the parent of docs/). Images are embedded (base64,
shrunk with ffmpeg when it is on PATH), so the HTML can be sent on its own. Stdlib only.
"""
import base64, html, json, os, re, shutil, subprocess, sys, tempfile

def esc(s):
    return html.escape(str(s if s is not None else ''))

def embed(path, width, tmp):
    if not path:
        return None
    if not os.path.isfile(path):
        print(f'frameboard: warning: image not found, using a placeholder: {path}', file=sys.stderr)
        return None
    src = path
    if shutil.which('ffmpeg'):
        out = os.path.join(tmp, f'{len(os.listdir(tmp)):04d}.jpg')
        r = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', path, '-vf', f'scale={width}:-2', '-q:v', '5', out])
        if r.returncode == 0 and os.path.isfile(out):
            src = out
    ext = 'jpeg' if src.lower().endswith(('.jpg', '.jpeg')) else 'png'
    return f'data:image/{ext};base64,' + base64.b64encode(open(src, 'rb').read()).decode()

def read(path):
    return open(path).read() if os.path.isfile(path) else ''

def ref_auto(ref, root):
    d = os.path.join(root, ref.get('dir', ''))
    info = read(os.path.join(d, 'info.txt'))
    for key in ('title', 'channel', 'url'):
        if not ref.get(key):
            m = re.search(rf'^{key}: (.*)$', info, re.M)
            if m: ref[key] = m.group(1)
    if not ref.get('stats'):
        cuts = read(os.path.join(d, 'cuts.txt')).splitlines()
        ref['stats'] = ' / '.join(cuts[:3])
    if not ref.get('palette'):
        ref['palette'] = [l.split()[0] for l in read(os.path.join(d, 'palette.txt')).splitlines() if l.strip()][:6]
    return ref

def main():
    args = sys.argv[1:]
    if len(args) < 2:
        print(__doc__); sys.exit(2)
    sb_path, out_path = args[0], os.path.abspath(args[1])
    thumb = int(args[args.index('--thumb') + 1]) if '--thumb' in args else 360
    nosrc = '--no-source' in args      # public copy: hide reference channels and URLs (titles come from the JSON)
    noref = nosrc or '--no-ref-frames' in args   # and never publish a reference's frames
    root = os.path.dirname(os.path.dirname(os.path.abspath(sb_path)))
    sb = json.load(open(sb_path))
    os.chdir(root)
    tmp = tempfile.mkdtemp()
    dur = float(sb.get('duration', 0)) or max(s['t1'] for s in sb['shots'])
    bpm = float(sb.get('bpm', 120)); beat = 60 / bpm
    W, H = sb.get('size', [1920, 1080])

    css = """
:root{--bg:#f4f3ef;--ink:#17181c;--muted:#6a6c78;--line:#dcdde3;--card:#fff;--accent:#3d5afe}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#111216;--ink:#ecedf1;--muted:#9a9cab;--line:#2a2c35;--card:#1a1b21}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 -apple-system,Segoe UI,Inter,sans-serif}
main{max-width:1180px;margin:0 auto;padding:32px 16px 64px}h1{font-size:30px;margin:0 0 4px}h2{font-size:19px;margin:40px 0 12px}
.sub{color:var(--muted)}.meta{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.chip{border:1px solid var(--line);border-radius:99px;padding:2px 10px;font-size:13px;color:var(--muted)}
.ref{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;margin:0 0 14px}
.ref h3{margin:0;font-size:16px}.strip{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px;margin:12px 0}
.strip img,.shot img{width:100%;display:block;border-radius:6px;background:#000;aspect-ratio:16/9;object-fit:cover}
.sw{display:inline-block;width:22px;height:22px;border-radius:5px;border:1px solid var(--line);vertical-align:middle;margin-right:4px}
.steal{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;margin-top:8px}
.steal div{border-left:3px solid var(--accent);padding:2px 10px}.steal b{display:block;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.leave{margin-top:8px;color:var(--muted);font-size:14px}
.tl{position:relative;height:58px;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:var(--card)}
.tl .blk{position:absolute;top:0;bottom:18px;border-right:1px solid rgba(0,0,0,.25);font-size:12px;padding:4px 6px;overflow:hidden;white-space:nowrap}
.tl .tick{position:absolute;bottom:0;height:18px;border-left:1px solid var(--line);font-size:10px;color:var(--muted);padding-left:2px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
.shot{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px}
.ph{aspect-ratio:16/9;border-radius:6px;display:flex;align-items:center;justify-content:center;text-align:center;padding:10px;font-weight:700;font-size:20px}
.t{font-variant-numeric:tabular-nums;font-weight:600}.row{font-size:14px;margin-top:6px}.row b{color:var(--muted);font-weight:600;margin-right:4px}
"""
    parts = [f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
             f'<title>{esc(sb.get("title", "Storyboard"))}</title><style>{css}</style></head><body><main>']
    parts.append(f'<h1>{esc(sb.get("title", "Storyboard"))}</h1><div class="sub">{esc(sb.get("logline", ""))}</div>')
    parts.append('<div class="meta">' + ''.join(f'<span class="chip">{esc(c)}</span>' for c in [
        f'{dur:g} s', f'{W}x{H}', f'{sb.get("fps", 30)} fps', f'{bpm:g} BPM (beat {beat:g} s)', f'{len(sb["shots"])} shots', f'{len(sb.get("refs", []))} references']) + '</div>')
    if sb.get('rules'):
        parts.append('<div class="sub">' + ' · '.join(esc(r) for r in sb['rules']) + '</div>')

    refs = [ref_auto(r, root) for r in sb.get('refs', [])]
    if refs:
        parts.append('<h2>Reference board</h2>')
    for r in refs:
        parts.append(f'<div class="ref"><h3>{esc(r["id"])}: {esc(r.get("title", ""))}</h3>'
                     + ('' if nosrc else f'<div class="sub">{esc(r.get("channel", ""))} · {esc(r.get("url", ""))}</div>') +
                     f'<div class="row"><b>Measured</b>{esc(r.get("stats", ""))}</div>')
        parts.append('<div class="row"><b>Palette</b>' + ''.join(f'<span class="sw" style="background:{esc(c)}" title="{esc(c)}"></span>' for c in r.get('palette', [])) + '</div>')
        if noref:
            if r.get('frames'):
                parts.append(f'<div class="row"><b>Frames</b>{len(r["frames"])} studied frames kept out of this copy (references are for study only)</div>')
        else:
            imgs = [embed(p, thumb, tmp) for p in r.get('frames', [])]
            parts.append('<div class="strip">' + ''.join(f'<img src="{i}" alt="reference frame">' for i in imgs if i) + '</div>')
        st = r.get('steal', {})
        parts.append('<div class="steal">' + ''.join(f'<div><b>{esc(k)}</b>{esc(v)}</div>' for k, v in st.items()) + '</div>')
        if r.get('leave'):
            parts.append(f'<div class="leave">Leave: {esc(r["leave"])}</div>')
        parts.append('</div>')

    parts.append('<h2>Timeline</h2><div class="tl">')
    for s in sb['shots']:
        l = 100 * s['t0'] / dur; w = 100 * (s['t1'] - s['t0']) / dur
        parts.append(f'<div class="blk" style="left:{l:.3f}%;width:{w:.3f}%;background:{esc(s.get("field", "#ddd"))};color:{esc(s.get("ink", "#111"))}">{esc(s["id"])} {esc(s.get("copy", ""))}</div>')
    n = int(dur / beat + 1e-6)
    for i in range(n + 1):
        parts.append(f'<div class="tick" style="left:{100 * i * beat / dur:.3f}%">{i * beat:g}</div>' if i % 2 == 0 else
                     f'<div class="tick" style="left:{100 * i * beat / dur:.3f}%"></div>')
    parts.append('</div>')

    parts.append('<h2>Frame board</h2><div class="grid">')
    for s in sb['shots']:
        img = embed(s.get('frame'), thumb, tmp)
        pic = (f'<img src="{img}" alt="frame {esc(s["id"])}">' if img else
               f'<div class="ph" style="background:{esc(s.get("field", "#ddd"))};color:{esc(s.get("ink", "#111"))}">{esc(s.get("copy", "")) or esc(s["id"])}</div>')
        parts.append(f'<div class="shot">{pic}<div class="row"><span class="t">{esc(s["id"])} · {s["t0"]:.2f} to {s["t1"]:.2f} s</span></div>')
        for k in ('copy', 'motion', 'steal', 'sound'):
            if s.get(k):
                parts.append(f'<div class="row"><b>{k}</b>{esc(s[k])}</div>')
        parts.append('</div>')
    parts.append('</div></main></body></html>')
    os.makedirs(os.path.dirname(os.path.abspath(out_path)) or '.', exist_ok=True)
    open(out_path, 'w').write('\n'.join(parts))
    shutil.rmtree(tmp, ignore_errors=True)
    print(f'frameboard: {out_path} ({os.path.getsize(out_path) // 1024} KB)')

if __name__ == '__main__':
    main()
