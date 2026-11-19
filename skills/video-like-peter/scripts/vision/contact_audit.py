"""Contact audit for analysis.json: says HOW each impact's contact was tested, and how strong it is.

The analyze stage marks contact when a limb point comes within 6% BH of the other body: its SAM mask
if masks were given, else its pose bbox. A bbox is a rectangle, so the bbox test passes for a fist in
the empty air between two bodies, and it passes almost always while two bodies overlap (a clinch).
This script re-tests every impact over the same window (peak-2 .. stop+2) and writes, per impact:

  contact_test   "mask" (SAM instance mask of the target was available) | "bbox" | null (no contact)
  mask_dist_bh   nearest target mask pixel, in body heights (mask test only)
  skel_dist_bh   nearest confident bone segment of the target, in body heights (null = no skeleton)
  target_pose    True if the target had a confident skeleton in the window
  overlap_iou    max IoU of attacker and target pose boxes in the window (> 0.3 = clinch)
  tier           "touch"  mask test passed (count these as strikes)
                 "reach"  bbox test only (proximity, not proof of a hit)
                 null     no contact

It also stamps the depth model and the counts into analysis.json, timeline.json and parallax.json.
CPU only, seconds, no lock.

usage: python contact_audit.py --work <work/clipN> --out <web dir/clipN> [--masks dir --mask-names 1:a,2:b]
       [--depth-model "Video Depth Anything Small (vits), input 518"]"""
import argparse
import json
from pathlib import Path
import numpy as np
from PIL import Image
import cv2

BONES = [(5, 7), (7, 9), (6, 8), (8, 10), (5, 6), (5, 11), (6, 12), (11, 12), (11, 13), (13, 15),
         (12, 14), (14, 16), (0, 1), (0, 2), (1, 3), (2, 4), (0, 5), (0, 6)]
LIMBS = {'l_wrist': 9, 'r_wrist': 10, 'l_ankle': 15, 'r_ankle': 16}
KP_CONF = 0.3

ap = argparse.ArgumentParser()
ap.add_argument('--work', type=Path, required=True)
ap.add_argument('--out', type=Path, required=True)
ap.add_argument('--masks', type=Path)
ap.add_argument('--mask-names')
ap.add_argument('--depth-model')
A = ap.parse_args()

ana = json.load(open(A.out / 'analysis.json'))
W, H, N = ana['clip']['width'], ana['clip']['height'], ana['clip']['frames']
z = np.load(A.work / 'pose.npz')
persons = list(z['persons'])
kps = {p: z[f'kp_{i}'] for i, p in enumerate(persons)}
boxes = {p: z[f'box_{i}'] for i, p in enumerate(persons)}
names = {}
if A.mask_names:
    names = {v: int(k) for k, v in (p.split(':') for p in A.mask_names.split(','))}
masks = None
if A.masks:
    masks = [np.array(Image.open(A.masks / f'{t:05d}.png')) for t in range(N)]


def seg_dist(p, a, b):
    ab = b - a
    t = np.clip(np.dot(p - a, ab) / max(np.dot(ab, ab), 1e-9), 0, 1)
    return float(np.linalg.norm(p - (a + t * ab)))


def iou(a, b):
    if not (np.isfinite(a).all() and np.isfinite(b).all()):
        return 0.0
    x1, y1, x2, y2 = max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3])
    inter = max(0, x2 - x1) * max(0, y2 - y1)
    u = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return float(inter / u) if u > 0 else 0.0


def bh_of(p):
    b = boxes[p]
    v = np.isfinite(b[:, 0])
    return float(np.median(b[v, 3] - b[v, 1]))


dist_cache = {}


def mask_dist(t, inst, x, y):
    key = (t, inst)
    if key not in dist_cache:
        m = (masks[t] != inst).astype(np.uint8)
        dist_cache[key] = cv2.distanceTransform(m, cv2.DIST_L2, 3) if (m == 0).any() else None
    d = dist_cache[key]
    if d is None:
        return None
    return float(d[int(np.clip(y, 0, H - 1)), int(np.clip(x, 0, W - 1))])


for d in ana['impacts']:
    p, j = d['person'], LIMBS[d['limb']]
    bh = bh_of(p)
    c = d.get('contact')
    res = dict(contact_test=None, mask_dist_bh=None, skel_dist_bh=None, target_pose=False, overlap_iou=0.0, tier=None)
    if c:
        tgt = c['target']
        lo, hi = max(d['frame'] - 2, 0), min(d['stop_frame'] + 2, N)
        use_mask = masks is not None and tgt in names
        md, sd, ov, tp = None, None, 0.0, False
        for tt in range(lo, hi):
            x, y, cf = kps[p][tt, j]
            if not np.isfinite(x) or cf < KP_CONF:
                continue
            pt = np.array([x, y])
            if use_mask:
                v = mask_dist(tt, names[tgt], x, y)
                if v is not None:
                    md = v if md is None else min(md, v)
            if tgt in kps:
                k = kps[tgt][tt]
                for a_, b_ in BONES:
                    if k[a_, 2] >= KP_CONF and k[b_, 2] >= KP_CONF and np.isfinite(k[a_, 0]) and np.isfinite(k[b_, 0]):
                        tp = True
                        v = seg_dist(pt, k[a_, :2], k[b_, :2])
                        sd = v if sd is None else min(sd, v)
                ov = max(ov, iou(boxes[p][tt], boxes[tgt][tt]))
        res.update(contact_test='mask' if use_mask else 'bbox',
                   mask_dist_bh=None if md is None else round(md / bh, 3),
                   skel_dist_bh=None if sd is None else round(sd / bh, 3),
                   target_pose=tp, overlap_iou=round(float(ov), 2))
        kp_pk = kps[tgt][d['frame']] if tgt in kps else None
        res['target_pose_at_peak'] = bool(kp_pk is not None and (kp_pk[:, 2] >= KP_CONF).sum() >= 5)
        res['tier'] = 'touch' if (use_mask and md is not None and md <= 0.06 * bh) else 'reach'
        c.update({k: v for k, v in res.items() if k != 'tier'})
        c['tier'] = res['tier']
    d['tier'] = res['tier']

counts = dict(peaks=len(ana['impacts']),
              reach=sum(1 for d in ana['impacts'] if d['tier'] == 'reach'),
              touch=sum(1 for d in ana['impacts'] if d['tier'] == 'touch'),
              clinch=sum(1 for d in ana['impacts'] if d['tier'] and d['contact']['overlap_iou'] > 0.3),
              no_target_pose=sum(1 for d in ana['impacts'] if d['tier'] and not d['contact']['target_pose']))
ana['contact_audit'] = dict(
    method='contact_audit.py: re-tests each impact over peak-2..stop+2. tier touch = within 6% BH of the target SAM mask; '
           'tier reach = within 6% BH of the target pose bbox only (proximity, not proof of a hit). '
           'clinch = attacker and target boxes overlap (IoU > 0.3), where the bbox test passes almost automatically.',
    masks=bool(masks is not None and names), counts=counts)
if A.depth_model:
    ana['depth_model'] = A.depth_model
# identity and left/right repair, copied from the pose stage so the page claims can be checked
ps_path = A.work / 'pose-stats.json'
if ps_path.exists():
    ps = json.load(open(ps_path))
    how = 'SAM mask vote' if ps.get('votes') else ('trunk colour clustering (Lab, k-means)' if ps.get('appearance') else 'ByteTrack ids only')
    ana['pose_tracking'] = dict(
        tracker='ByteTrack per shot (box overlap and motion); ids restart at every cut',
        identity_across_cuts=how if len(ana['clip']['shots']) > 1 or ps.get('votes') else 'single shot, ByteTrack ids only',
        track_to_person=ps.get('identity'),
        lr_swaps_fixed=ps.get('lr_swaps_fixed'),
        lr_repair='crossing test: swap a left/right pair back when the crossed assignment is under half the distance to the previous frame')
json.dump(ana, open(A.out / 'analysis.json', 'w'), indent=2)

tl_path = A.out / 'timeline.json'
tl = json.load(open(tl_path))
by = {(d['frame'], d['person']): d for d in ana['impacts']}
for e in tl['impacts']:
    d = by.get((e['frame'], e['person']))
    if d:
        e['tier'] = d['tier']
        e['contact_test'] = d['contact'] and d['contact']['contact_test']
if A.depth_model:
    tl['depth_model'] = A.depth_model
json.dump(tl, open(tl_path, 'w'), separators=(',', ':'))

px = A.out / 'parallax' / 'parallax.json'
if px.exists() and A.depth_model:
    pj = json.load(open(px))
    pj['depth_model'] = A.depth_model
    json.dump(pj, open(px, 'w'), indent=2)
print(A.out.name, json.dumps(counts))
for d in ana['impacts']:
    if d['tier']:
        c = d['contact']
        print(f"  f{d['frame']:03d} {d['person']}>{c['target']} {d['limb']} {d['tier']} test={c['contact_test']} "
              f"mask={c['mask_dist_bh']} skel={c['skel_dist_bh']} pose={c['target_pose']} at_peak={c['target_pose_at_peak']} iou={c['overlap_iou']}")
