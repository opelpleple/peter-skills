#!/usr/bin/env python3
"""Video vision pipeline: shots, temporally stable depth, tracked skeletons,
motion analysis and web-ready composites.

Stages (run in order, each one reads the previous stage's files in WORK):
  prepare  cut segment, resize long side, extract frames, detect shot cuts
  depth    Video Depth Anything per shot (or --reuse-depth npz)
  pose     YOLO pose + ByteTrack per shot, One Euro smoothing, identity by mask
  analyze  speeds, impacts, contacts, centre of mass, depth ordering
  render   depth.mp4, skeleton.mp4, skeleton-only.mp4, quad.mp4, stills
  all      everything above

Heavy model stages take the lock /tmp/vision-heavy.lock (mkdir based).
Python: a venv with torch (MPS or CUDA), ultralytics, scipy, opencv-python and pillow. Set VDA_ROOT to a clone
of Video-Depth-Anything (default ~/Video-Depth-Anything). The pose weights (yolo11m-pose.pt) are not shipped:
ultralytics downloads them into scripts/vision/models/ (or VISION_MODELS) on the first pose run.
"""
import argparse
import json
import math
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
SKILL = HERE.parent.parent
MODELS = Path(os.environ.get('VISION_MODELS', HERE / 'models'))
VDA_ROOT = Path(os.environ.get('VDA_ROOT', str(Path.home() / 'Video-Depth-Anything')))
LOCK = Path('/tmp/vision-heavy.lock')
OTHER_LOCKS = [] if os.environ.get('VISION_IGNORE_OTHER_LOCKS') else [Path('/tmp/deck-heavy.lock')]
FONT = '/System/Library/Fonts/Helvetica.ttc'

KP = ['nose', 'l_eye', 'r_eye', 'l_ear', 'r_ear', 'l_shoulder', 'r_shoulder', 'l_elbow', 'r_elbow',
      'l_wrist', 'r_wrist', 'l_hip', 'r_hip', 'l_knee', 'r_knee', 'l_ankle', 'r_ankle']
BONES = [(5, 7), (7, 9), (6, 8), (8, 10), (5, 6), (5, 11), (6, 12), (11, 12), (11, 13), (13, 15),
         (12, 14), (14, 16), (0, 1), (0, 2), (1, 3), (2, 4), (0, 5), (0, 6)]
LIMBS = {'l_wrist': 9, 'r_wrist': 10, 'l_ankle': 15, 'r_ankle': 16}
PALETTE = [(25, 195, 255), (255, 135, 25), (120, 255, 120), (255, 80, 200), (255, 240, 90), (160, 120, 255)]
KP_CONF = 0.3


# ----------------------------------------------------------------- helpers
class Lock:
    def __enter__(self):
        for _ in range(720):
            busy = [p for p in OTHER_LOCKS if p.exists()]
            if busy:  # another heavy GPU job (deck renders etc.) is running: wait for it
                print('waiting for', busy, flush=True)
                time.sleep(10)
                continue
            try:
                LOCK.mkdir()
                return self
            except FileExistsError:
                print('waiting for', LOCK, flush=True)
                time.sleep(10)
        raise RuntimeError(f'{LOCK} held too long')

    def __exit__(self, *a):
        try:
            LOCK.rmdir()
        except FileNotFoundError:
            pass


def load_cfg(work):
    return json.loads((work / 'clip.json').read_text())


def save_json(path, obj, indent=None):
    path.write_text(json.dumps(obj, indent=indent, separators=None if indent else (',', ':')) + '\n')


def frames_of(work):
    cfg = load_cfg(work)
    files = sorted((work / 'frames').glob('*.jpg'))
    assert len(files) == cfg['frames'], (len(files), cfg['frames'])
    return np.stack([np.array(Image.open(f).convert('RGB')) for f in files])


def writer(path, w, h, fps, crf=23, preset='slow'):
    return subprocess.Popen(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo',
                             '-pix_fmt', 'rgb24', '-s', f'{w}x{h}', '-r', str(fps), '-i', '-', '-an',
                             '-c:v', 'libx264', '-preset', preset, '-crf', str(crf), '-pix_fmt', 'yuv420p',
                             '-profile:v', 'high', '-movflags', '+faststart', str(path)], stdin=subprocess.PIPE)


def close(wr):
    wr.stdin.close()
    assert wr.wait() == 0


def font(size):
    return ImageFont.truetype(FONT, size)


# ----------------------------------------------------------------- prepare
def prepare(a):
    work = a.work
    (work / 'frames').mkdir(parents=True, exist_ok=True)
    for f in (work / 'frames').glob('*.jpg'):
        f.unlink()
    seg = work / 'segment.mp4'
    probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                                                'stream=width,height,r_frame_rate', '-of', 'json', str(a.src)]))['streams'][0]
    w, h = probe['width'], probe['height']
    num, den = map(int, probe['r_frame_rate'].split('/'))
    fps = round(num / den, 3)
    scale = 'scale=-2:854' if h >= w else 'scale=854:-2'
    subprocess.check_call(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-ss', str(a.start), '-t', str(a.duration),
                           '-i', str(a.src), '-vf', f'{scale}:flags=lanczos', '-an', '-c:v', 'libx264', '-crf', '12',
                           '-pix_fmt', 'yuv420p', str(seg)])
    subprocess.check_call(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(seg), '-q:v', '2',
                           str(work / 'frames' / '%05d.jpg')])
    files = sorted((work / 'frames').glob('*.jpg'))
    for i, f in enumerate(files):  # zero based names
        f.rename(work / 'frames' / f'tmp{i:05d}.jpg')
    for i in range(len(files)):
        (work / 'frames' / f'tmp{i:05d}.jpg').rename(work / 'frames' / f'{i:05d}.jpg')
    n = len(files)
    W, H = Image.open(work / 'frames' / '00000.jpg').size
    log = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(seg), '-vf', f"select='gt(scene,{a.scene})',showinfo",
                          '-f', 'null', '-'], capture_output=True, text=True).stderr
    cuts = sorted({int(round(float(t) * fps)) for t in
                   [p.split('pts_time:')[1].split()[0] for p in log.split('\n') if 'pts_time:' in p]})
    cuts = [c for c in cuts if 2 < c < n - 2]
    bounds = [0] + cuts + [n]
    shots = [[bounds[i], bounds[i + 1]] for i in range(len(bounds) - 1)]
    cfg = dict(source=str(a.src), start=a.start, duration=a.duration, fps=fps, frames=n, width=W, height=H,
               scene_threshold=a.scene, cuts=cuts, shots=shots)
    save_json(work / 'clip.json', cfg, 2)
    print('prepare', cfg, flush=True)


# ----------------------------------------------------------------- depth
def depth(a):
    work = a.work
    cfg = load_cfg(work)
    if a.reuse_depth:
        raw = np.load(a.reuse_depth)['depths'].astype(np.float32)
        assert raw.shape[0] == cfg['frames'] and raw.shape[1:] == (cfg['height'], cfg['width']), raw.shape
        source = f'reused {a.reuse_depth}'
    else:
        import torch
        sys.path.insert(0, str(VDA_ROOT))
        from video_depth_anything.video_depth import VideoDepthAnything
        enc = a.depth_encoder
        conf = {'vits': dict(features=64, out_channels=[48, 96, 192, 384]),
                'vitb': dict(features=128, out_channels=[96, 192, 384, 768]),
                'vitl': dict(features=256, out_channels=[256, 512, 1024, 1024])}[enc]
        dev = 'mps' if torch.backends.mps.is_available() else 'cpu'
        frames = frames_of(work)
        out = []
        with Lock():
            model = VideoDepthAnything(encoder=enc, **conf)
            model.load_state_dict(torch.load(VDA_ROOT / f'checkpoints/video_depth_anything_{enc}.pth',
                                             map_location='cpu', weights_only=True))
            model = model.to(dev).eval()
            for s, e in cfg['shots']:
                print('depth shot', s, e, flush=True)
                d, _ = model.infer_video_depth(frames[s:e], cfg['fps'], input_size=a.depth_size, device=dev, fp32=True)
                out.append(d.astype(np.float32))
            del model
        raw = np.concatenate(out)
        source = f'Video Depth Anything {enc}, input {a.depth_size}'
    assert np.isfinite(raw).all()
    np.savez_compressed(work / 'depth-raw.npz', depths=raw)
    # fixed mapping per shot: 1st and 99th percentile of the whole shot, never per frame
    norm = np.zeros_like(raw)
    maps = []
    for s, e in cfg['shots']:
        lo, hi = np.percentile(raw[s:e], [1, 99])
        norm[s:e] = np.clip((raw[s:e] - lo) / max(hi - lo, 1e-6), 0, 1)
        maps.append(dict(shot=[s, e], lo=float(lo), hi=float(hi)))
    np.save(work / 'depth-norm.npy', norm.astype(np.float16))
    save_json(work / 'depth.json', dict(source=source, kind='relative inverse depth (higher = closer)',
                                       mapping='per shot, 1st..99th percentile -> 0..1, fixed for the shot', shots=maps), 2)
    print('depth done', source, flush=True)


# ----------------------------------------------------------------- pose
class OneEuro:
    """One Euro filter (Casiez et al. 2012) on a scalar sequence with gaps."""

    def __init__(self, fps, min_cutoff, beta, d_cutoff=1.0):
        self.fps, self.mc, self.beta, self.dc = fps, min_cutoff, beta, d_cutoff
        self.x = self.dx = None

    @staticmethod
    def alpha(cutoff, fps):
        tau = 1.0 / (2 * math.pi * cutoff)
        return 1.0 / (1.0 + tau * fps)

    def __call__(self, x):
        if self.x is None:
            self.x, self.dx = x, 0.0
            return x
        dx = (x - self.x) * self.fps
        a_d = self.alpha(self.dc, self.fps)
        self.dx = a_d * dx + (1 - a_d) * self.dx
        cutoff = self.mc + self.beta * abs(self.dx)
        a = self.alpha(cutoff, self.fps)
        self.x = a * x + (1 - a) * self.x
        return self.x


def smooth_track(kps, fps, bh):
    """kps: (T,17,3) pixel coords + conf, NaN where track absent.
    Low confidence points are linearly filled across gaps up to 4 frames, then
    One Euro filtered. Cutoffs scale with body height so fast strikes keep their peaks."""
    T = kps.shape[0]
    out = kps.copy()
    for j in range(17):
        good = np.isfinite(kps[:, j, 0]) & (kps[:, j, 2] >= KP_CONF)
        idx = np.where(good)[0]
        if len(idx) < 2:
            out[:, j, :2] = np.nan
            continue
        for c in range(2):
            v = kps[:, j, c].copy()
            filled = np.interp(np.arange(T), idx, v[idx])
            # only fill short gaps inside the visible span
            gap_ok = np.zeros(T, bool)
            gap_ok[idx] = True
            for k in range(len(idx) - 1):
                if idx[k + 1] - idx[k] <= 5:
                    gap_ok[idx[k]:idx[k + 1] + 1] = True
            v = np.where(gap_ok, filled, np.nan)
            f = OneEuro(fps, min_cutoff=1.2, beta=0.7 / max(bh, 1))
            res = np.full(T, np.nan)
            for t in range(T):
                if np.isfinite(v[t]):
                    res[t] = f(v[t])
                else:
                    f = OneEuro(fps, min_cutoff=1.2, beta=0.7 / max(bh, 1))
            out[:, j, c] = res
    return out


PAIRS = [(1, 2), (3, 4), (5, 6), (7, 8), (9, 10), (11, 12), (13, 14), (15, 16)]


def fix_lr_swaps(kps):
    """Pose models sometimes flip left/right labels for one frame (legs hidden in a coat, side views).
    Swap a pair back when the crossed assignment is far closer to the previous frame. Returns count."""
    fixed = 0
    for t in range(1, kps.shape[0]):
        prev, cur = kps[t - 1], kps[t]
        for l, r in PAIRS:
            if not (np.isfinite(prev[[l, r], :2]).all() and np.isfinite(cur[[l, r], :2]).all()):
                continue
            same = np.linalg.norm(cur[l, :2] - prev[l, :2]) + np.linalg.norm(cur[r, :2] - prev[r, :2])
            cross = np.linalg.norm(cur[l, :2] - prev[r, :2]) + np.linalg.norm(cur[r, :2] - prev[l, :2])
            if cross < 0.5 * same and same > 20:
                cur[[l, r]] = cur[[r, l]]
                fixed += 1
    return fixed


def identity_for(box, kp, labels, names):
    """Vote which mask instance a detection belongs to: share of bbox pixels plus keypoints inside."""
    x1, y1, x2, y2 = [int(round(v)) for v in box]
    H, W = labels.shape
    x1, y1, x2, y2 = max(x1, 0), max(y1, 0), min(x2, W), min(y2, H)
    crop = labels[y1:y2, x1:x2]
    scores = {}
    for inst in names:
        s = (crop == inst).mean() if crop.size else 0
        inside = 0
        for x, y, c in kp:
            if c >= KP_CONF and 0 <= int(y) < H and 0 <= int(x) < W and labels[int(y), int(x)] == inst:
                inside += 1
        scores[inst] = s + inside / 17
    best = max(scores, key=scores.get) if scores else None
    return best, scores


def torso_color(img, kp):
    """median Lab colour of the trunk quad (shoulders + hips), None when the trunk is not visible"""
    pts = [kp[j] for j in (5, 6, 12, 11)]
    if sum(p[2] >= KP_CONF for p in pts) < 4:
        return None
    H, W = img.shape[:2]
    poly = np.array([[int(np.clip(p[0], 0, W - 1)), int(np.clip(p[1], 0, H - 1))] for p in pts], np.int32)
    m = np.zeros((H, W), np.uint8)
    cv2.fillConvexPoly(m, poly, 1)
    m = cv2.erode(m, np.ones((5, 5), np.uint8))  # keep away from the outline (background bleed)
    if m.sum() < 60:
        return None
    lab = cv2.cvtColor(img, cv2.COLOR_RGB2LAB)[m > 0].astype(np.float32)
    return np.median(lab, axis=0)


def appearance_ids(track_frames, frames, k, min_len):
    """Identity across cuts without masks: cluster tracks by median trunk colour (Lab), name groups p1..pk
    from darkest to lightest. Two tracks of one shot that land in the same group and overlap in time are
    reported as a conflict (then the higher confidence detection wins per frame)."""
    feats, keys = [], []
    for tr, items in track_frames.items():
        if len(items) < min_len:
            continue
        cs = [c for c in (torso_color(frames[t], d['kp']) for t, d in items[::2]) if c is not None]
        if len(cs) >= 3:
            feats.append(np.median(cs, axis=0))
            keys.append(tr)
    ident = {tr: tr for tr in track_frames}
    if len(keys) < k:
        return ident, dict(note='not enough tracks with a visible trunk', tracks=keys)
    X = np.array(feats, np.float32)
    w = np.array([0.6, 1.0, 1.0], np.float32)  # lightness counts less: rim light and shadow move it
    crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 100, 0.1)
    _, lab, cent = cv2.kmeans(X * w, k, None, crit, 10, cv2.KMEANS_PP_CENTERS)
    order = np.argsort(cent[:, 0])
    rank = {int(c): i for i, c in enumerate(order)}
    conflicts = []
    for tr, l in zip(keys, lab.ravel()):
        ident[tr] = f'p{rank[int(l)] + 1}'
    for i, a_ in enumerate(keys):
        for b_ in keys[i + 1:]:
            if ident[a_] == ident[b_] and a_.split('t')[0] == b_.split('t')[0]:
                fa = {t for t, _ in track_frames[a_]}
                ov = len(fa & {t for t, _ in track_frames[b_]})
                if ov:
                    conflicts.append(dict(tracks=[a_, b_], group=ident[a_], overlap_frames=ov))
    dbg = dict(method=f'k-means k={k} on median trunk Lab, L weighted 0.6',
               tracks={tr: dict(group=ident[tr], lab=[round(float(v), 1) for v in f]) for tr, f in zip(keys, feats)},
               conflicts=conflicts)
    return ident, dbg


def pose(a):
    work = a.work
    cfg = load_cfg(work)
    from ultralytics import YOLO
    import torch
    dev = 'mps' if torch.backends.mps.is_available() else 'cpu'
    MODELS.mkdir(parents=True, exist_ok=True)
    weights = MODELS / a.pose_model
    frames = frames_of(work)
    N, H, W = cfg['frames'], cfg['height'], cfg['width']
    names = {}
    if a.mask_names:
        for p in a.mask_names.split(','):
            k, v = p.split(':')
            names[int(k)] = v
    detections = []  # per frame list of dict(track,box,kp,conf)
    cwd = os.getcwd()
    os.chdir(MODELS)  # ultralytics downloads the weights into cwd
    with Lock():
        for si, (s, e) in enumerate(cfg['shots']):
            model = YOLO(str(weights.name))  # fresh tracker state per shot
            for t in range(s, e):
                r = model.track(frames[t][:, :, ::-1], persist=True, tracker='bytetrack.yaml', conf=a.pose_conf,
                                iou=0.5, imgsz=a.pose_size, device=dev, verbose=False)[0]
                dets = []
                if r.boxes is not None and len(r.boxes):
                    ids = r.boxes.id.int().tolist() if r.boxes.id is not None else [-1] * len(r.boxes)
                    for k in range(len(r.boxes)):
                        dets.append(dict(track=f's{si}t{ids[k]}', box=r.boxes.xyxy[k].tolist(),
                                         conf=float(r.boxes.conf[k]), kp=r.keypoints.data[k].tolist()))
                detections.append(dets)
            print(f'pose shot {si}: {s}-{e}', flush=True)
            del model
    os.chdir(cwd)
    save_json(work / 'pose-raw.json', detections)

    # identity: map each (shot,track) to a mask instance, else keep track id
    track_frames = {}
    for t, dets in enumerate(detections):
        for d in dets:
            if d['track'].endswith('t-1'):
                continue
            track_frames.setdefault(d['track'], []).append((t, d))
    ident = {}
    votes_dbg = {}
    for tr, items in track_frames.items():
        if a.masks and names:
            acc = {k: 0.0 for k in names}
            for t, d in items:
                lab = np.array(Image.open(a.masks / f'{t:05d}.png'))
                _, sc = identity_for(d['box'], d['kp'], lab, names)
                for k in acc:
                    acc[k] += sc[k]
            best = max(acc, key=acc.get)
            mean = acc[best] / len(items)
            votes_dbg[tr] = {names[k]: round(v / len(items), 3) for k, v in acc.items()}
            ident[tr] = names[best] if mean > 0.35 else tr
        else:
            ident[tr] = tr
    appearance_dbg = None
    if not (a.masks and names) and a.appearance_k:
        ident, appearance_dbg = appearance_ids(track_frames, frames, a.appearance_k, max(4, int(cfg['fps'] * 0.25)))
    if a.rename:  # readable ids after a look at the check sheet, e.g. s0t1:hero
        ren = dict(p.split(':') for p in a.rename.split(','))
        ident = {tr: ren.get(v, v) for tr, v in ident.items()}
    # one detection per identity per frame (highest conf), drop very short tracks
    min_len = max(4, int(cfg['fps'] * 0.25))
    persons = sorted({ident[tr] for tr, it in track_frames.items() if len(it) >= min_len})
    raw = {p: np.full((N, 17, 3), np.nan, np.float32) for p in persons}
    boxes = {p: np.full((N, 4), np.nan, np.float32) for p in persons}
    for tr, items in track_frames.items():
        p = ident[tr]
        if p not in raw or len(items) < min_len:
            continue
        for t, d in items:
            vis = [k_[2] >= KP_CONF for k_ in d['kp']]
            if sum(vis) < a.min_visible_kp or sum(vis[j] for j in (5, 6, 11, 12)) < 3:
                continue  # partial body (cropped, occluded, a lone leg): skeleton not trustworthy
            prev = boxes[p][t]
            if np.isfinite(prev[0]) and raw[p][t, :, 2].mean() >= np.mean([k[2] for k in d['kp']]):
                continue
            raw[p][t] = np.array(d['kp'], np.float32)
            boxes[p][t] = d['box']
    # a body seen only in scattered frames of a shot (cropped giant, passer-by) is noise for that shot
    dropped = []
    for p in persons:
        for si, (s, e) in enumerate(cfg['shots']):
            seen = int(np.isfinite(boxes[p][s:e, 0]).sum())
            if 0 < seen < a.min_shot_coverage * (e - s):
                raw[p][s:e] = np.nan
                boxes[p][s:e] = np.nan
                dropped.append(dict(person=p, shot=si, frames_seen=seen, shot_frames=e - s))
    smooth = {}
    bh = {}
    swaps_fixed = {}
    for p in persons:
        swaps_fixed[p] = sum(fix_lr_swaps(raw[p][s:e]) for s, e in cfg['shots'])
        valid = np.isfinite(boxes[p][:, 0])
        bh[p] = float(np.median(boxes[p][valid, 3] - boxes[p][valid, 1]))
        sm = np.full_like(raw[p], np.nan)
        for s, e in cfg['shots']:  # never smooth across a cut
            sm[s:e] = smooth_track(raw[p][s:e], cfg['fps'], bh[p])
        sm[:, :, 2] = raw[p][:, :, 2]
        smooth[p] = sm
    np.savez_compressed(work / 'pose.npz', persons=np.array(persons), **{f'kp_{i}': smooth[p] for i, p in enumerate(persons)},
                        **{f'raw_{i}': raw[p] for i, p in enumerate(persons)},
                        **{f'box_{i}': boxes[p] for i, p in enumerate(persons)})
    # keypoints.json: per frame per person, normalized 0..1
    frames_out = []
    for t in range(N):
        people = []
        for i, p in enumerate(persons):
            b = boxes[p][t]
            if not np.isfinite(b[0]):
                continue
            k = smooth[p][t]
            pts = [[None, None, round(float(c), 3)] if not np.isfinite(x) else
                   [round(float(x) / W, 4), round(float(y) / H, 4), round(float(c), 3)] for x, y, c in k]
            people.append(dict(id=p, bbox=[round(float(b[0]) / W, 4), round(float(b[1]) / H, 4),
                                           round(float(b[2]) / W, 4), round(float(b[3]) / H, 4)], kp=pts))
        frames_out.append(dict(f=t, t=round(t / cfg['fps'], 4), people=people))
    save_json(a.out / 'keypoints.json', dict(
        format='COCO-17', keypoints=KP, bones=BONES, coords='normalized 0..1, x by width, y by height; null = not visible',
        width=W, height=H, fps=cfg['fps'], shots=cfg['shots'], persons=persons,
        model=f'ultralytics {a.pose_model} + ByteTrack, One Euro smoothing (min_cutoff 1.2 Hz, beta 0.7/bodyheight)',
        frames=frames_out))
    stats = {p: dict(frames_detected=int(np.isfinite(boxes[p][:, 0]).sum()), body_height_px=round(bh[p], 1),
                     mean_kp_conf=round(float(np.nanmean(raw[p][:, :, 2])), 3)) for p in persons}
    save_json(work / 'pose-stats.json', dict(tracks={k: len(v) for k, v in track_frames.items()}, identity=ident,
                                             votes=votes_dbg, appearance=appearance_dbg, lr_swaps_fixed=swaps_fixed, dropped_sparse=dropped, persons=stats), 2)
    print('pose done', json.dumps(stats), flush=True)


# ----------------------------------------------------------------- analyze
def load_pose(work):
    z = np.load(work / 'pose.npz')
    persons = list(z['persons'])
    return persons, {p: z[f'kp_{i}'] for i, p in enumerate(persons)}, {p: z[f'box_{i}'] for i, p in enumerate(persons)}


def speed_series(xy, fps, shots):
    """central difference speed in px/s, NaN across cuts and gaps"""
    T = xy.shape[0]
    v = np.full(T, np.nan)
    for s, e in shots:
        for t in range(s, e):
            a_, b_ = max(t - 1, s), min(t + 1, e - 1)
            if b_ > a_ and np.isfinite(xy[a_]).all() and np.isfinite(xy[b_]).all():
                v[t] = np.linalg.norm(xy[b_] - xy[a_]) / ((b_ - a_) / fps)
    return v


def analyze(a):
    from scipy.signal import find_peaks
    work = a.work
    cfg = load_cfg(work)
    fps, N, W, H, shots = cfg['fps'], cfg['frames'], cfg['width'], cfg['height'], cfg['shots']
    persons, kps, boxes = load_pose(work)
    norm = np.load(work / 'depth-norm.npy').astype(np.float32)
    names = {}
    if a.mask_names:
        names = {v: int(k) for k, v in (p.split(':') for p in a.mask_names.split(','))}
    masks = None
    if a.masks:
        masks = np.stack([np.array(Image.open(a.masks / f'{t:05d}.png')) for t in range(N)])
    # bodies to hit: every pose person plus every mask instance (covers non human creatures)
    bodies = {}
    for p in persons:
        bodies[p] = dict(kind='pose')
    for nm, inst in names.items():
        bodies.setdefault(nm, {})['mask'] = inst
    per = {}
    impacts = []
    for p in persons:
        k = kps[p]
        valid = np.isfinite(boxes[p][:, 0])
        bh = float(np.median(boxes[p][valid, 3] - boxes[p][valid, 1]))
        limb = {}
        for name, j in LIMBS.items():
            v = speed_series(k[:, j, :2], fps, shots)
            v[k[:, j, 2] < KP_CONF] = np.nan  # do not trust hidden joints
            limb[name] = v
        # centre of mass approx: 0.58 hip midpoint + 0.42 shoulder midpoint (trunk + head weighted)
        hip = np.nanmean(k[:, [11, 12], :2], axis=1)
        sho = np.nanmean(k[:, [5, 6], :2], axis=1)
        com = 0.58 * hip + 0.42 * sho
        com_speed = speed_series(com, fps, shots)
        per[p] = dict(bh=bh, limb=limb, com=com, com_speed=com_speed)
        # impacts: per limb peak above max(1.2 BH/s, median + 3 MAD), then speed falls to < 55% within 3 frames
        for name, v in limb.items():
            vv = np.nan_to_num(v, nan=0.0)
            fin = v[np.isfinite(v)]
            if len(fin) < 5:
                continue
            med = np.median(fin)
            mad = np.median(np.abs(fin - med)) + 1e-6
            thr = max(a.impact_min_bhs * bh, med + 3 * 1.4826 * mad)
            peaks, _ = find_peaks(vv, height=thr, distance=max(3, int(fps * 0.2)))
            for pk in peaks:
                shot_end = next(e for s, e in shots if s <= pk < e)
                after = vv[pk + 1:min(pk + 4, shot_end)]
                if len(after) == 0 or after.min() > 0.55 * vv[pk]:
                    continue
                stop = pk + 1 + int(np.argmin(after))
                decel = (vv[pk] - vv[stop]) / ((stop - pk) / fps)
                j = LIMBS[name]
                # contact: limb point inside other body's mask (dilated) or within 6% BH of its pose bbox
                contact = None
                for other, info in bodies.items():
                    if other == p:
                        continue
                    for tt in range(max(pk - 2, 0), min(stop + 2, N)):
                        x, y = k[tt, j, 0], k[tt, j, 1]
                        if not np.isfinite(x):
                            continue
                        xi, yi = int(np.clip(x, 0, W - 1)), int(np.clip(y, 0, H - 1))
                        hit = False
                        if masks is not None and 'mask' in info:
                            r = int(0.06 * bh)
                            win = masks[tt, max(yi - r, 0):yi + r + 1, max(xi - r, 0):xi + r + 1]
                            hit = bool((win == info['mask']).any())
                        elif other in boxes and np.isfinite(boxes[other][tt, 0]):
                            b = boxes[other][tt]
                            pad = 0.06 * bh
                            hit = b[0] - pad <= x <= b[2] + pad and b[1] - pad <= y <= b[3] + pad
                        if hit:
                            contact = dict(target=other, frame=tt, point=[round(float(x) / W, 4), round(float(y) / H, 4)])
                            break
                    if contact:
                        break
                impacts.append(dict(person=p, limb=name, frame=int(pk), t=round(pk / fps, 3), stop_frame=int(stop),
                                    peak_px_s=round(float(vv[pk]), 1), peak_bh_s=round(float(vv[pk] / bh), 2),
                                    speed_after_px_s=round(float(vv[stop]), 1),
                                    decel_px_s2=round(float(decel), 0), contact=contact,
                                    point=[round(float(k[pk, j, 0]) / W, 4), round(float(k[pk, j, 1]) / H, 4)]))
    # merge impacts of the same person within 3 frames (two limbs firing together), keep the fastest
    impacts.sort(key=lambda d: (d['person'], d['frame']))
    merged = []
    for d in impacts:
        if merged and merged[-1]['person'] == d['person'] and d['frame'] - merged[-1]['frame'] <= 3:
            m = merged[-1]
            # prefer the limb that touched something, then the faster one
            if (bool(d['contact']), d['peak_px_s']) > (bool(m['contact']), m['peak_px_s']):
                d['also'] = m['limb']
                merged[-1] = d
            else:
                m['also'] = d['limb']
            continue
        merged.append(d)
    impacts = sorted(merged, key=lambda d: d['frame'])
    # depth ordering: mean shot-normalized inverse depth inside each body (mask if present, else pose bbox)
    order = []
    depth_of = {nm: np.full(N, np.nan) for nm in bodies}
    for t in range(N):
        for nm, info in bodies.items():
            if masks is not None and 'mask' in info:
                m = masks[t] == info['mask']
                if m.sum() > 200:
                    depth_of[nm][t] = float(norm[t][m].mean())
            elif nm in boxes and np.isfinite(boxes[nm][t, 0]):
                x1, y1, x2, y2 = boxes[nm][t].astype(int)
                crop = norm[t, max(y1, 0):y2, max(x1, 0):x2]
                if crop.size:
                    depth_of[nm][t] = float(np.median(crop))
        vals = {nm: depth_of[nm][t] for nm in bodies if np.isfinite(depth_of[nm][t])}
        order.append(sorted(vals, key=vals.get, reverse=True))
    swaps = [t for t in range(1, N) if order[t] and order[t - 1] and order[t][0] != order[t - 1][0]]
    summary = {}
    for p in persons:
        best = {}
        for name, v in per[p]['limb'].items():
            if np.isfinite(v).any():
                t = int(np.nanargmax(v))
                best[name] = dict(frame=t, t=round(t / fps, 3), px_s=round(float(v[t]), 1),
                                  bh_s=round(float(v[t] / per[p]['bh']), 2))
        top = max(best.values(), key=lambda d: d['px_s']) if best else None
        com = per[p]['com']
        fin = np.isfinite(com[:, 0])
        travel = 0.0
        for s, e in shots:
            seg = com[s:e][np.isfinite(com[s:e, 0])]
            if len(seg) > 1:
                travel += float(np.linalg.norm(np.diff(seg, axis=0), axis=1).sum())
        summary[p] = dict(body_height_px=round(per[p]['bh'], 1), frames_tracked=int(np.isfinite(boxes[p][:, 0]).sum()),
                          peak_limb_speed=best, fastest=top and dict(top, limb=[n for n, d in best.items() if d is top][0]),
                          com_travel_px=round(travel, 1), com_travel_bh=round(travel / per[p]['bh'], 2),
                          com_frames=int(fin.sum()), impacts=sum(1 for d in impacts if d['person'] == p),
                          impacts_with_contact=sum(1 for d in impacts if d['person'] == p and d['contact']))
    front_share = {nm: round(sum(1 for o in order if o and o[0] == nm) / max(1, sum(1 for o in order if o)), 3) for nm in bodies}
    analysis = dict(
        clip=dict(fps=fps, frames=N, width=W, height=H, shots=shots, cuts=cfg['cuts']),
        method=dict(
            speed='central difference on One Euro smoothed keypoints, px/s and body-heights/s (BH = median pose bbox height); '
                  'joints below conf 0.3 ignored; no differences across cuts',
            impact=f'limb speed peak above max({a.impact_min_bhs} BH/s, median + 3 MAD) followed within 3 frames by a drop below 55% of peak; '
                   'same-person impacts within 3 frames merged',
            contact='limb point within 6% BH of the other body (its SAM mask if available, else its pose bbox) between peak-2 and stop+2',
            com='0.58 hip midpoint + 0.42 shoulder midpoint (trunk weighted approximation, not a full segment model)',
            depth_order='mean shot-normalized inverse depth inside each body mask (higher = closer to camera)'),
        persons=persons, bodies=list(bodies), summary=summary, impacts=impacts,
        depth_order=dict(front_share=front_share, leader_changes=swaps,
                         mean_depth={nm: round(float(np.nanmean(v)), 3) for nm, v in depth_of.items()}))
    save_json(a.out / 'analysis.json', analysis, 2)

    def r(x, n=1):
        return [None if not np.isfinite(v) else round(float(v), n) for v in x]
    timeline = dict(fps=fps, frames=N, t=[round(t / fps, 4) for t in range(N)], shots=shots, cuts=cfg['cuts'],
                    impacts=[dict(frame=d['frame'], t=d['t'], person=d['person'], limb=d['limb'], peak_bh_s=d['peak_bh_s'],
                                  contact=bool(d['contact'])) for d in impacts],
                    series={p: dict(body_height_px=round(per[p]['bh'], 1),
                                    wrist_px_s=r(np.fmax(per[p]['limb']['l_wrist'], per[p]['limb']['r_wrist'])),
                                    ankle_px_s=r(np.fmax(per[p]['limb']['l_ankle'], per[p]['limb']['r_ankle'])),
                                    wrist_bh_s=r(np.fmax(per[p]['limb']['l_wrist'], per[p]['limb']['r_wrist']) / per[p]['bh'], 2),
                                    ankle_bh_s=r(np.fmax(per[p]['limb']['l_ankle'], per[p]['limb']['r_ankle']) / per[p]['bh'], 2),
                                    com_x=r(per[p]['com'][:, 0] / W, 4), com_y=r(per[p]['com'][:, 1] / H, 4),
                                    com_px_s=r(per[p]['com_speed'])) for p in persons},
                    depth={nm: r(v, 3) for nm, v in depth_of.items()},
                    front=[o[0] if o else None for o in order])
    save_json(a.out / 'timeline.json', timeline)
    print('analyze done:', json.dumps(dict(impacts=len(impacts), summary={p: dict(fastest=s['fastest'], impacts=s['impacts'])
                                                                         for p, s in summary.items()}, front=front_share)), flush=True)


# ----------------------------------------------------------------- render
def inferno(d):
    return cv2.applyColorMap(np.round(np.clip(d, 0, 1) * 255).astype(np.uint8), cv2.COLORMAP_INFERNO)[:, :, ::-1]


def draw_skel(img, k, color, scale=1.0, thick=3, joint_colors=None):
    pts = []
    for x, y, c in k:
        pts.append(None if not np.isfinite(x) or c < KP_CONF else (int(round(x * scale)), int(round(y * scale))))
    for i, j in BONES:
        if pts[i] and pts[j]:
            cv2.line(img, pts[i], pts[j], color, thick, cv2.LINE_AA)
    for n, p in enumerate(pts):
        if p:
            col = joint_colors[n] if joint_colors is not None else (255, 255, 255)
            cv2.circle(img, p, thick + 1, col, -1, cv2.LINE_AA)
            cv2.circle(img, p, thick + 1, color, 1, cv2.LINE_AA)


def label(img, text, size=18, xy=(10, 8)):
    im = Image.fromarray(img)
    d = ImageDraw.Draw(im)
    f = font(size)
    x, y = xy
    tw = d.textlength(text, font=f)
    d.rectangle([x - 6, y - 4, x + tw + 6, y + size + 6], fill=(0, 0, 0))
    d.text((x, y), text, fill=(255, 255, 255), font=f)
    return np.array(im)


def render(a):
    work, out = a.work, a.out
    cfg = load_cfg(work)
    fps, N, W, H = cfg['fps'], cfg['frames'], cfg['width'], cfg['height']
    frames = frames_of(work)
    norm = np.load(work / 'depth-norm.npy').astype(np.float32)
    raw = np.load(work / 'depth-raw.npz')['depths']
    persons, kps, boxes = load_pose(work)
    ana = json.loads((out / 'analysis.json').read_text())
    color = {p: PALETTE[i % len(PALETTE)] for i, p in enumerate(persons)}
    hit_frames = {}
    for d in ana['impacts']:
        for t in range(d['frame'], d['frame'] + 6):
            hit_frames.setdefault(t, []).append(d)
    names = {}
    if a.mask_names:
        names = {v: int(k) for k, v in (p.split(':') for p in a.mask_names.split(','))}
    # full size depth + skeleton videos
    wd = writer(out / 'depth.mp4', W, H, fps, crf=24)
    ws = writer(out / 'skeleton.mp4', W, H, fps, crf=25)
    wo = writer(out / 'skeleton-only.mp4', W, H, fps, crf=22)
    qw, qh = (W // 2) // 2 * 2, (H // 2) // 2 * 2  # yuv420p needs even sizes
    QW, QH = qw * 4, qh
    wq = writer(out / 'quad.mp4', QW, QH, fps, crf=25)
    titles = ['SOURCE', 'DEPTH (VDA)', 'SKELETON (YOLO POSE)', 'DEPTH x SKELETON']
    for t in range(N):
        src = frames[t]
        dep = inferno(norm[t])
        wd.stdin.write(np.ascontiguousarray(dep).tobytes())
        dark = (src.astype(np.float32) * 0.38).astype(np.uint8)
        black = np.zeros_like(src)
        tint = (dep.astype(np.float32) * 0.55).astype(np.uint8)
        for p in persons:
            k = kps[p][t]
            if not np.isfinite(boxes[p][t, 0]):
                continue
            draw_skel(dark, k, color[p], 1.0, 3)
            draw_skel(black, k, color[p], 1.0, 3)
            # joints coloured by local depth: near = white hot, far = deep purple
            jc = []
            for x, y, c in k:
                if np.isfinite(x):
                    v = norm[t, int(np.clip(y, 0, H - 1)), int(np.clip(x, 0, W - 1))]
                    jc.append(tuple(int(c_) for c_ in inferno(np.array([[min(1, v * 1.1 + 0.1)]]))[0, 0]))
                else:
                    jc.append((255, 255, 255))
            draw_skel(tint, k, color[p], 1.0, 4, jc)
            b = boxes[p][t]
            dark = label(dark, f'{p}', 14, (int(max(b[0], 4)) + 6, int(max(b[1], 4)) + 4))
        for d in hit_frames.get(t, []):
            x, y = int(d['point'][0] * W), int(d['point'][1] * H)
            age = t - d['frame']
            rad = 14 + age * 9
            for img in (dark, black, tint):
                cv2.circle(img, (x, y), rad, (255, 255, 255), 2, cv2.LINE_AA)
            txt = f"IMPACT {d['limb'].replace('_', ' ')} {d['peak_bh_s']:.1f} BH/s"
            dark = label(dark, txt, 16, (10, H - 34))
            tint = label(tint, txt, 16, (10, H - 34))
        sec = f'{t / fps:5.2f}s  f{t:03d}'
        ws.stdin.write(label(dark, sec, 14, (W - 120, 8)).tobytes())
        wo.stdin.write(black.tobytes())
        panels = [src, dep, dark, tint]
        row = np.concatenate([label(cv2.resize(pn, (qw, qh), interpolation=cv2.INTER_AREA), tt, 13, (8, 6))
                              for pn, tt in zip(panels, titles)], axis=1)
        wq.stdin.write(np.ascontiguousarray(row).tobytes())
    for w_ in (wd, ws, wo, wq):
        close(w_)

    # stills: 16 bit depth frames + per impact contact sheet + parallax pair
    df = out / 'depth-frames'
    df.mkdir(exist_ok=True)
    picks = sorted({int(round(N * f)) for f in (0.1, 0.35, 0.6, 0.85)})
    for t in picks:
        s, e = next(se for se in cfg['shots'] if se[0] <= t < se[1])
        lo, hi = raw[s:e].min(), raw[s:e].max()
        v16 = np.round((raw[t] - lo) / max(hi - lo, 1e-6) * 65535).astype(np.uint16)
        cv2.imwrite(str(df / f'depth16-f{t:03d}.png'), v16)
    # parallax: strongest contact impact (fallback: strongest impact)
    imp = sorted(ana['impacts'], key=lambda d: (bool(d['contact']), d['peak_px_s']), reverse=True)
    key = imp[0]['frame'] if imp else N // 2
    px = out / 'parallax'
    px.mkdir(exist_ok=True)
    Image.fromarray(frames[key]).save(px / 'color.jpg', quality=90)
    Image.fromarray(np.round(norm[key] * 255).astype(np.uint8)).save(px / 'depth.png')
    save_json(px / 'parallax.json', dict(frame=key, t=round(key / fps, 3), width=W, height=H,
                                         depth='8-bit, white = near (shot-normalized inverse depth), pixel aligned with color.jpg',
                                         tip='blur depth ~2px or dilate near values before displacement to hide edge stretching'), 2)
    # check sheet: source | depth | skeleton for several frames, for human review
    rows = []
    for t in sorted(set(picks + [d['frame'] for d in imp[:3]])):
        dark = (frames[t].astype(np.float32) * 0.38).astype(np.uint8)
        for p in persons:
            if np.isfinite(boxes[p][t, 0]):
                draw_skel(dark, kps[p][t], color[p], 1.0, 3)
        ov = frames[t].copy()
        if a.masks:
            lab = np.array(Image.open(a.masks / f'{t:05d}.png'))
            for nm, inst in names.items():
                c = np.array(color.get(nm, (200, 200, 200)), np.float32)
                ov[lab == inst] = (ov[lab == inst] * 0.5 + c * 0.5).astype(np.uint8)
        row = np.concatenate([label(frames[t], f'f{t} {t / fps:.2f}s', 16), inferno(norm[t]), dark, label(ov, 'masks', 16)], axis=1)
        rows.append(cv2.resize(row, (row.shape[1] // 2, row.shape[0] // 2), interpolation=cv2.INTER_AREA))
    Image.fromarray(np.concatenate(rows, axis=0)).save(work / 'check-sheet.jpg', quality=85)
    Image.fromarray(np.concatenate([frames[key], inferno(norm[key]), (lambda im: [draw_skel(im, kps[p][key], color[p], 1.0, 3) for p in persons if np.isfinite(boxes[p][key, 0])] and im)((frames[key] * 0.38).astype(np.uint8))], axis=1)).save(out / 'poster.jpg', quality=86)
    sizes = {f.name: round(f.stat().st_size / 1e6, 2) for f in out.glob('*.mp4')}
    print('render done', sizes, 'parallax frame', key, flush=True)


# ----------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('stage', choices=['prepare', 'depth', 'pose', 'analyze', 'render', 'all'])
    ap.add_argument('--src', type=Path)
    ap.add_argument('--start', type=float, default=0)
    ap.add_argument('--duration', type=float, default=8)
    ap.add_argument('--work', type=Path, required=True, help='intermediate files (frames, npz)')
    ap.add_argument('--out', type=Path, required=True, help='web outputs')
    ap.add_argument('--scene', type=float, default=0.3)
    ap.add_argument('--reuse-depth', type=Path, help='existing npz with key depths (N,H,W) aligned to the frames')
    ap.add_argument('--depth-encoder', default='vits')
    ap.add_argument('--depth-size', type=int, default=518)
    ap.add_argument('--pose-model', default='yolo11m-pose.pt')
    ap.add_argument('--pose-size', type=int, default=640)
    ap.add_argument('--pose-conf', type=float, default=0.2)
    ap.add_argument('--masks', type=Path, help='folder of per frame instance id PNGs (00000.png ...)')
    ap.add_argument('--mask-names', help='e.g. 1:fighter,2:giant')
    ap.add_argument('--rename', help='rename track or mask ids, e.g. s0t1:hero,s0t2:soldier_a')
    ap.add_argument('--appearance-k', type=int, default=0,
                    help='no masks: link tracks across cuts by trunk colour into K people (p1 darkest ... pK)')
    ap.add_argument('--min-visible-kp', type=int, default=7, help='drop person-frames with fewer confident joints')
    ap.add_argument('--min-shot-coverage', type=float, default=0.4, help='drop a person from a shot seen in fewer frames')
    ap.add_argument('--impact-min-bhs', type=float, default=1.2)
    a = ap.parse_args()
    a.work.mkdir(parents=True, exist_ok=True)
    a.out.mkdir(parents=True, exist_ok=True)
    stages = ['prepare', 'depth', 'pose', 'analyze', 'render'] if a.stage == 'all' else [a.stage]
    for s in stages:
        t0 = time.time()
        globals()[s](a)
        print(f'[{s}] {time.time() - t0:.1f}s', flush=True)


if __name__ == '__main__':
    main()
