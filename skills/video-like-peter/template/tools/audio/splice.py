# /// script
# dependencies = ["numpy"]
# ///
"""Splice a music take on bar lines so its sections land on the film's chapters (scene time = film time).

  uv run tools/audio/splice.py audio/takes/take1.mp3 audio/music.wav [--phase 0.048] [--bar 2.0] [--dur 8.0]
                               [--seg 0:2,4:6]

Why: generated music (ElevenLabs music_v2_5 for one) ignores the section lengths you ask for and phrases
every 8 bars. Instead of conforming the picture with a CUT table, cut the take into whole bars and lay them end
to end so every chapter starts on a downbeat of a section that fits it.
--seg lists (source start bar, source end bar) pairs, 0 based, in the take's own grid: bar n starts at
PHASE + n * BAR seconds (find PHASE, the time of the first downbeat, with tools/audio/analyze.py).
Joins are 12 ms equal power crossfades on downbeats, so the beat grid of the result starts at 0.0.
"""
import subprocess, sys
import numpy as np
def arg(flag, default=None):
    return sys.argv[sys.argv.index(flag) + 1] if flag in sys.argv else default
SR = 48000
PHASE = float(arg('--phase', 0.0))      # time of the first downbeat in the take
BAR = float(arg('--bar', 2.0))          # 120 BPM in 4/4
DUR = float(arg('--dur', 8.0))          # length of the result
# example: an 8 s film = the 2 bars before the drop, then the first 2 bars of the drop
SEGMENTS = [tuple(int(v) for v in p.split(':')) for p in arg('--seg', '2:4,4:6').split(',')]
src, out = sys.argv[1], sys.argv[2]
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
x = np.frombuffer(raw, np.float32).reshape(-1, 2)
X = int(0.012 * SR); parts = []
for a, b in SEGMENTS:
    i0, i1 = int((PHASE + a * BAR) * SR), int((PHASE + b * BAR) * SR)
    seg = x[i0:min(i1 + X, len(x))].copy()
    if len(seg) < i1 - i0 + X: seg = np.concatenate([seg, np.zeros((i1 - i0 + X - len(seg), 2), np.float32)])
    parts.append(seg)
y = parts[0]
for p in parts[1:]:
    n = len(y) - X; k = np.linspace(0, np.pi / 2, X)[:, None]
    y = np.concatenate([y[:n], y[n:] * np.cos(k) + p[:X] * np.sin(k), p[X:]])
y = y[:int(DUR * SR)]
y[:int(0.3 * SR)] *= np.linspace(0, 1, int(0.3 * SR))[:, None] ** 2
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-i', '-', out], input=y.astype(np.float32).tobytes(), check=True)
print(out, round(len(y) / SR, 2), 's')
