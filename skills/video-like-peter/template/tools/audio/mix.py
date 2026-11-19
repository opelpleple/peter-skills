# /// script
# dependencies = ["numpy"]
# ///
"""Build the film's sound track: the music bed placed on the picture grid plus a few soft transition sounds,
mastered to -14 LUFS integrated with a true peak ceiling that survives AAC.

  uv run tools/audio/mix.py --music audio/music.wav [--dur 8.0] [--offset 0.0] [--intro-lift 0]
                            [--cues audio/cues.json] [--out audio/mix.wav] [--no-sfx]

Music: plays at its own tempo, moved earlier by --offset seconds so its beats sit on the film's grid (measure
the phase with tools/audio/analyze.py; AAC and MP3 files carry a few tens of ms of priming at the head).
--intro-lift raises the first seconds in dB when a generated intro is too quiet to carry the picture.
Transition sounds are synthesised here from audio/cues.json (soft filtered air, nothing above about 2.6 kHz,
so nothing pierces): [{"k": "whoosh", "t": 3.875, "dur": 0.55, "pan": [-0.4, 0.4], "db": -12},
{"k": "tock", "t": 5.0, "db": -14}]. A whoosh under a full music bed is masked easily: raise it a few dB from
the -17 dB default until it is audible on laptop speakers, rather than brightening it (two finished films used
-17 to -12 and -20 to -18).
Mastering: measure, apply ONE constant gain, a true peak safe limiter, then one trim pass. Do not use the
loudnorm filter for the final pass: when the linear gain it needs would push the true peak over its target it
silently falls back to dynamic mode and rides the level.
"""
import json, subprocess, sys
import numpy as np

def arg(flag, default=None):
    return sys.argv[sys.argv.index(flag) + 1] if flag in sys.argv else default

SR = 48000
DUR = float(arg('--dur', 8.0))
MUSIC = arg('--music', 'audio/music.wav')
OUT = arg('--out', 'audio/mix.wav')
OFFSET = float(arg('--offset', 0.0))          # seconds removed from the head of the music
INTRO_LIFT_DB = float(arg('--intro-lift', 0.0))
N = int(SR * DUR)
db = lambda x: 10 ** (x / 20)

def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()

# ---------------------------------------------------------------- music
m = load(MUSIC)[int(OFFSET * SR):]
music = np.zeros((N, 2), np.float32)
music[:min(N, len(m))] = m[:N]
t = np.arange(N) / SR
# intro lift: +INTRO_LIFT_DB until LIFT_UNTIL - 0.6 s, back to 0 dB at LIFT_UNTIL (set it just before the first drop)
LIFT_UNTIL = float(arg('--lift-until', 7.0))
lift = np.interp(t, [0, max(0.0, LIFT_UNTIL - 0.6), LIFT_UNTIL, max(DUR, LIFT_UNTIL + 0.01)], [INTRO_LIFT_DB, INTRO_LIFT_DB, 0, 0])
music *= db(lift)[:, None].astype(np.float32)
music[:int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))[:, None]
tail = int(0.6 * SR); music[-tail:] *= (np.linspace(1, 0, tail) ** 2)[:, None]

# ---------------------------------------------------------------- soft transition sounds
rng = np.random.default_rng(7)
def lowpass(x, fc):
    a = np.exp(-2 * np.pi * fc / SR); y = np.empty_like(x); acc = 0.0
    for i in range(len(x)):
        acc = (1 - a) * x[i] + a * acc; y[i] = acc
    return y
def whoosh(dur=0.55, pan_from=0.0, pan_to=0.0, peak=0.5):
    n = int(dur * SR); x = rng.standard_normal(n)
    x = lowpass(lowpass(x, 2600), 2600) - lowpass(x, 240)          # band of soft air, about 250 to 2600 Hz
    env = np.exp(-0.5 * ((np.arange(n) / n - peak) / 0.2) ** 2)
    x = x * env; x /= np.abs(x).max() + 1e-9
    pan = np.linspace(pan_from, pan_to, n)                          # -1 left .. 1 right
    return np.stack([x * np.sqrt((1 - pan) / 2), x * np.sqrt((1 + pan) / 2)], axis=1).astype(np.float32)
def tock(freq=170, dur=0.12):
    n = int(dur * SR); tt = np.arange(n) / SR
    x = np.sin(2 * np.pi * freq * tt * (1 + 0.6 * np.exp(-tt * 60))) * np.exp(-tt * 38)
    return np.stack([x, x], axis=1).astype(np.float32)

fx = np.zeros((N, 2), np.float32)
def place(clip, at, gain_db):
    i = int(round(at * SR))
    if 0 <= i < N:
        j = min(N, i + len(clip)); fx[i:j] += clip[:j - i] * db(gain_db)

import os
CUES_FILE = arg('--cues', 'audio/cues.json')
CUES = json.load(open(CUES_FILE)) if os.path.exists(CUES_FILE) else []
if '--no-sfx' not in sys.argv:
    for c in CUES:
        if c['k'] == 'whoosh':
            w = whoosh(c.get('dur', 0.55), c.get('pan', [0, 0])[0], c.get('pan', [0, 0])[1], c.get('peak', 0.5))
            place(w, c['t'] - c.get('dur', 0.55) * c.get('peak', 0.5), c.get('db', -17))    # the loudest point sits on the cue time
        elif c['k'] == 'tock':
            place(tock(c.get('freq', 170)), c['t'], c.get('db', -14))

mix = music * db(-1.0) + fx
mix /= max(1.0, float(np.abs(mix).max()) / 0.97)
raw = OUT.replace('.wav', '_raw.wav')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-i', '-', raw], input=mix.astype(np.float32).tobytes(), check=True)
def measure(path, pre=''):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', path, '-af', pre + 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return json.loads(r[r.rindex('{'):r.rindex('}') + 1])
# constant gain (no dynamic loudnorm riding the level), a true peak safe limiter, then one trim pass
LIM = 'alimiter=limit=0.79:attack=1:release=60:level=disabled'
mj = measure(raw)
g = -14.0 - float(mj['input_i'])
m2 = measure(raw, f'volume={g:.2f}dB,{LIM},')
g += -14.0 - float(m2['input_i'])
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', raw, '-af', f'volume={g:.2f}dB,{LIM}', '-ar', str(SR), OUT], check=True)
print(OUT, DUR, 's  music', MUSIC, ' raw', mj['input_i'], 'LUFS, LRA', mj['input_lra'], '-> -14 LUFS;', len(CUES), 'cues')
