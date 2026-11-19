#!/usr/bin/env python3
"""Per-frame statistics of a video (or rendered frames folder): mean luma, luma spread, frame-to-frame
change, black/white frames, cuts/flashes, and how well the visual change lines up with drum hits.

usage: python3 tools/qa/frame_stats.py <video.mp4 | frames-dir> [--fps 30] [--drums audio/cues.json]
          [--out work/qa/frame_stats] [--size 192x108]
writes <out>.json (summary + per-frame arrays), <out>.csv and <out>.png (plot: luma on top, change below, drum hits as ticks)

Drum file: any JSON holding event times in seconds is accepted: a list of numbers, a list of objects with
"t"/"time"/"onset" (and optional "strength"/"velocity"), or an object whose keys (kick, snare, hits, onsets,
...) hold such lists. Keys containing "frame" are read as frame numbers, keys ending in "_ms" as milliseconds.
Sync metrics (computed per drum list and for all hits together):
  r_lag0     Pearson correlation of the change series with a drum-hit envelope (exp decay, half-life 2 frames)
  best_lag   lag in frames (-6..+6) with the highest correlation (positive = picture reacts after the hit)
  spikes_on_hits   share of the strongest visual-change spikes that sit within +-1 frame of a hit, and the
                   share expected by chance for the same number of hits (enrichment = ratio of the two)
"""
import argparse, csv, json, os, subprocess, sys, zlib, struct
import numpy as np
os.environ['PATH'] = os.environ.get('PATH', '/usr/bin:/bin') + ':/opt/homebrew/bin:/usr/local/bin'  # ffmpeg from a minimal shell too

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

def decode_gray(src, fps, w, h):
    if os.path.isdir(src):
        ext = next((e for e in ('png', 'jpg') if os.path.exists(os.path.join(src, f'00000.{e}'))), None)
        if not ext: sys.exit('folder has no 00000.png / 00000.jpg')
        inp = ['-framerate', str(fps), '-start_number', '0', '-i', os.path.join(src, f'%05d.{ext}')]
    else:
        inp = ['-i', src]
    cmd = ['ffmpeg', '-v', 'error', *inp, '-map', '0:v:0', '-vf', f'scale={w}:{h}:flags=area,format=gray', '-f', 'rawvideo', '-']
    r = subprocess.run(cmd, capture_output=True)
    if r.returncode: sys.exit('decode failed: ' + r.stderr.decode()[-500:])
    a = np.frombuffer(r.stdout, np.uint8)
    return a.reshape(-1, h, w)

def load_events(path, fps):
    """Return {name: sorted array of times in seconds} from a loosely structured JSON file."""
    data = json.load(open(path))
    out = {}
    def times_of(lst, key):
        ts, ws = [], []
        for x in lst:
            if isinstance(x, (int, float)): ts.append(float(x)); ws.append(1.0)
            elif isinstance(x, dict):
                t = next((x[k] for k in ('t', 'time', 'onset', 'sec', 'seconds', 'frame') if k in x and isinstance(x[k], (int, float))), None)
                if t is None: continue
                if 'frame' in x and t == x['frame'] and not any(k in x for k in ('t', 'time', 'onset')): t = t / fps
                ts.append(float(t)); ws.append(float(next((x[k] for k in ('strength', 'velocity', 'weight', 'amp') if k in x), 1.0)))
        if not ts: return None
        ts = np.array(ts)
        k = key.lower()
        if 'frame' in k: ts = ts / fps
        elif k.endswith('_ms') or k == 'ms': ts = ts / 1000.0
        o = np.argsort(ts)
        return ts[o], np.array(ws)[o]
    def walk(node, key):
        if isinstance(node, list) and node and all(isinstance(x, (int, float, dict)) for x in node):
            got = times_of(node, key)
            if got is not None and len(got[0]) >= 2: out[key or 'events'] = got; return
        if isinstance(node, dict):
            for k, v in node.items():
                if k.lower() in ('bpm', 'tempo', 'duration', 'sample_rate', 'sr', 'fps', 'meta', 'source', 'notes'): continue
                walk(v, f'{key}.{k}' if key else k)
        elif isinstance(node, list):
            for i, v in enumerate(node[:64]):
                if isinstance(v, (dict, list)): walk(v, f'{key}[{i}]')
    walk(data, '')
    return out

def png_write(path, rgb):
    h, w, _ = rgb.shape
    raw = b''.join(b'\x00' + rgb[y].tobytes() for y in range(h))
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 6)) + chunk(b'IEND', b''))

def plot(path, luma, diff, hits_frames, fps):
    W, H, pad = 1800, 420, 30
    img = np.full((H, W, 3), 16, np.uint8)
    n = len(luma)
    def draw(series, y0, y1, color, vmax):
        cols = np.linspace(0, n, W - 2 * pad + 1).astype(int)
        for x in range(W - 2 * pad):
            a, b = cols[x], max(cols[x] + 1, cols[x + 1])
            seg = series[a:b]
            if not len(seg): continue
            lo, hi = seg.min() / vmax, seg.max() / vmax
            ya, yb = int(y1 - hi * (y1 - y0)), int(y1 - lo * (y1 - y0))
            img[max(y0, ya):min(y1, yb) + 1, pad + x] = color
    img[pad:190, pad:W - pad] = 28
    img[220:H - pad, pad:W - pad] = 28
    for s in range(0, int(n / fps) + 1, 10):  # 10 s grid
        x = pad + int(s * fps / n * (W - 2 * pad))
        if x < W - pad: img[pad:H - pad, x] = (48, 48, 56) if s % 60 else (90, 90, 100)
    for f in hits_frames:
        x = pad + int(f / n * (W - 2 * pad))
        if pad <= x < W - pad: img[H - pad - 14:H - pad, x] = (230, 60, 80)
    draw(luma, pad, 190, (244, 213, 141), 255.0)
    draw(diff, 220, H - pad - 16, (184, 140, 255), max(1e-6, float(np.percentile(diff, 99.5))))
    png_write(path, img)

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('src')
    ap.add_argument('--fps', type=int, default=30)
    ap.add_argument('--drums', default=os.path.join(ROOT, 'audio', 'beats.json'))
    ap.add_argument('--out', default='work/qa/frame_stats')
    ap.add_argument('--size', default='192x108')
    A = ap.parse_args()
    w, h = map(int, A.size.split('x'))
    fr = decode_gray(A.src, A.fps, w, h).astype(np.float32)
    n = len(fr)
    luma = fr.mean(axis=(1, 2))
    spread = fr.std(axis=(1, 2))
    diff = np.zeros(n, np.float32)
    diff[1:] = np.abs(fr[1:] - fr[:-1]).mean(axis=(1, 2))
    med, mad = float(np.median(diff[1:])), float(np.median(np.abs(diff[1:] - np.median(diff[1:])))) + 1e-6
    local_max = np.r_[False, (diff[1:-1] >= diff[:-2]) & (diff[1:-1] >= diff[2:]), False]
    cuts = np.where(local_max & (diff > med + 12 * mad) & (diff > 8))[0]
    black = np.where(luma < 4)[0]
    white = np.where(luma > 235)[0]
    def runs(idx):
        if not len(idx): return []
        out, s, p = [], idx[0], idx[0]
        for i in idx[1:]:
            if i != p + 1: out.append([int(s), int(p)]); s = i
            p = i
        out.append([int(s), int(p)])
        return out
    summary = {'source': A.src, 'frames': int(n), 'seconds': n / A.fps, 'luma_mean': round(float(luma.mean()), 2),
               'luma_p5_p95': [round(float(np.percentile(luma, 5)), 2), round(float(np.percentile(luma, 95)), 2)],
               'change_median': round(med, 3), 'change_p95': round(float(np.percentile(diff, 95)), 3), 'change_max': round(float(diff.max()), 3),
               'cuts_or_flashes': int(len(cuts)), 'black_frame_runs': runs(black), 'white_frame_runs': runs(white),
               'static_runs_over_2s': [r for r in runs(np.where(diff < 0.05)[0]) if r[1] - r[0] + 1 >= 2 * A.fps]}
    sync = {}
    hits_all = []
    if A.drums and os.path.exists(A.drums):
        ev = load_events(A.drums, A.fps)
        dz = (diff - diff.mean()) / (diff.std() + 1e-9)
        top = np.where(local_max & (diff >= np.percentile(diff, 90)))[0]
        def metrics(times):
            fidx = np.round(np.asarray(times) * A.fps).astype(int)
            fidx = fidx[(fidx >= 0) & (fidx < n)]
            imp = np.zeros(n); np.add.at(imp, fidx, 1.0)
            k = 0.5 ** (np.arange(12) / 2.0)  # half-life 2 frames
            env = np.convolve(imp, k)[:n]
            envz = (env - env.mean()) / (env.std() + 1e-9)
            lags = {L: float(np.mean(dz[max(0, L):n + min(0, L)] * envz[max(0, -L):n - max(0, L)])) for L in range(-6, 7)}
            best = max(lags, key=lags.get)
            near = np.zeros(n, bool)
            for d in (-1, 0, 1): near[np.clip(fidx + d, 0, n - 1)] = True
            on = float(near[top].mean()) if len(top) else 0.0
            chance = float(near.mean())
            return {'hits': int(len(fidx)), 'r_lag0': round(lags[0], 4), 'best_lag_frames': int(best), 'r_best': round(lags[best], 4),
                    'spikes_considered': int(len(top)), 'spikes_on_hits': round(on, 4), 'chance': round(chance, 4),
                    'enrichment': round(on / chance, 2) if chance else None}, fidx
        for name, (ts, ws) in ev.items():
            sync[name], fidx = metrics(ts)
            hits_all.extend(ts.tolist())
        if len(ev) > 1:
            sync['ALL'], _ = metrics(sorted(hits_all))
        summary['drums_file'] = A.drums
    summary['sync'] = sync
    out = os.path.abspath(A.out)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    json.dump({'summary': summary, 'luma': np.round(luma, 2).tolist(), 'spread': np.round(spread, 2).tolist(), 'change': np.round(diff, 3).tolist(), 'cuts': cuts.tolist()}, open(out + '.json', 'w'))
    with open(out + '.csv', 'w', newline='') as f:
        wr = csv.writer(f); wr.writerow(['frame', 'time_s', 'luma', 'spread', 'change', 'cut'])
        cs = set(cuts.tolist())
        for i in range(n): wr.writerow([i, f'{i / A.fps:.3f}', f'{luma[i]:.2f}', f'{spread[i]:.2f}', f'{diff[i]:.3f}', int(i in cs)])
    plot(out + '.png', luma, diff, np.round(np.asarray(hits_all) * A.fps).astype(int) if hits_all else [], A.fps)
    print(json.dumps(summary, indent=1))
    print('wrote', os.path.relpath(out, os.getcwd()) + '.{json,csv,png}')

if __name__ == '__main__':
    main()
