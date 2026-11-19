"""Web layers for a processed clip: source.mp4 (the prepared frames) and composite.mp4
(depth fog + depth of field on the far plane + warm key on the near plane), both H.264,
GOP 12, no B-frames, faststart, no audio, so a browser can swap layers at the same currentTime.
CPU only, no model, no lock needed. Run after video_vision.py depth (needs work/frames and depth-norm.npy).

usage: python web_layers.py --work <work/clipN> --out <web dir/clipN> [--fps 24]"""
import argparse
import subprocess
from pathlib import Path
import numpy as np, cv2

ap = argparse.ArgumentParser()
ap.add_argument('--work', type=Path, required=True)
ap.add_argument('--out', type=Path, required=True)
ap.add_argument('--fps', type=int, default=24)
A = ap.parse_args()
ENC = ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'slow', '-g', '12', '-bf', '0',
       '-movflags', '+faststart', '-an']


def pipe(path, w, h, crf):
    cmd = ['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{w}x{h}',
           '-r', str(A.fps), '-i', '-', *ENC, '-crf', str(crf), str(path)]
    return subprocess.Popen(cmd, stdin=subprocess.PIPE)


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


if True:
    frames = sorted((A.work / 'frames').glob('*.jpg'))
    depth = np.load(A.work / 'depth-norm.npy', mmap_mode='r')
    h, w = depth.shape[1:]
    assert len(frames) == depth.shape[0], ( len(frames), depth.shape)
    src = pipe(A.out / 'source.mp4', w, h, 24)
    comp = pipe(A.out / 'composite.mp4', w, h, 25)
    fog = np.array([150, 128, 108], np.float32)  # BGR, cool blue grey haze
    for i, fp in enumerate(frames):
        img = cv2.imread(str(fp))
        assert img.shape[:2] == (h, w)
        src.stdin.write(img.tobytes())
        d = cv2.GaussianBlur(np.asarray(depth[i], np.float32), (0, 0), 1.5)
        f = img.astype(np.float32)
        far = smooth(0.62, 0.15, d)[..., None]          # 1 = far
        near = smooth(0.55, 0.9, d)[..., None]           # 1 = near
        blur = cv2.GaussianBlur(f, (0, 0), 5.0)
        out = f * (1 - far) + blur * far                 # depth of field: far plane soft
        out = out * (1 - 0.6 * far) + fog * (0.6 * far)  # atmospheric fog by depth
        out = out * (1 + 0.18 * near) + np.array([0, 6, 14], np.float32) * near  # warm key on the near plane
        comp.stdin.write(np.clip(out, 0, 255).astype(np.uint8).tobytes())
    for p in (src, comp):
        p.stdin.close(); p.wait()
    print(A.out, 'done', w, h, len(frames))
