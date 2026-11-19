"""Measure a music take against the film's 120 BPM grid.
  uv run --with librosa --with numpy --with soundfile python tools/audio/analyze.py audio/takes/take1.mp3 [...] [--marks 4.0,8.0]
Prints for each file: tempo of a straight grid fitted to the detected beats, how well the onsets sit on a
0.5 s comb (and the phase of that comb), onset strength at the chapter times, loudness per 2 s bar.
"""
import sys, json
import numpy as np, librosa

# chapter times to check for onset strength (edit to your film's T values, or pass --marks 3.75,4.0)
MARKS = [float(x) for x in sys.argv[sys.argv.index('--marks') + 1].split(',')] if '--marks' in sys.argv else [2.0, 4.0, 6.0]
FILES = [a for i, a in enumerate(sys.argv[1:], 1) if a != '--marks' and sys.argv[i - 1] != '--marks']
for path in FILES:
    y, sr = librosa.load(path, sr=22050, mono=True)
    dur = len(y) / sr
    hop = 256
    onset = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
    times = librosa.frames_to_time(np.arange(len(onset)), sr=sr, hop_length=hop)
    tempo, frames = librosa.beat.beat_track(onset_envelope=onset, sr=sr, hop_length=hop, units='frames', start_bpm=120, tightness=200)
    raw = librosa.frames_to_time(frames, sr=sr, hop_length=hop)
    idx = np.round((raw - raw[0]) / np.median(np.diff(raw))).astype(int)
    period, off = np.polyfit(idx, raw, 1)
    resid = raw - (off + idx * period)
    bpm = 60 / period
    # comb test: for candidate periods near 0.5 s find the phase that collects the most onset energy
    best = None
    for per in np.arange(0.492, 0.5081, 0.0002):
        ph = np.mod(times, per) / per
        hist, _ = np.histogram(ph, bins=50, range=(0, 1), weights=onset)
        k = int(np.argmax(hist)); share = hist[k] / hist.sum()
        if best is None or share > best[0]: best = (share, per, (k + 0.5) / 50 * per)
    share, per, phase = best
    # phase of the exact 0.5 s comb
    ph = np.mod(times, 0.5) / 0.5
    hist, _ = np.histogram(ph, bins=50, range=(0, 1), weights=onset)
    k = int(np.argmax(hist)); share05 = hist[k] / hist.sum(); phase05 = (k + 0.5) / 50 * 0.5
    # drift check: comb phase in the first and the second half
    def phase_in(a, b):
        m = (times >= a) & (times < b)
        h, _ = np.histogram(np.mod(times[m], 0.5) / 0.5, bins=50, range=(0, 1), weights=onset[m])
        return round((int(np.argmax(h)) + 0.5) / 50 * 0.5, 3)
    med = np.median(onset)
    marks = {m: round(float(onset[(times >= m - 0.06) & (times <= m + 0.08)].max() / (med + 1e-9)), 1) for m in MARKS if m < dur}
    rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=512)[0]
    rt = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=512)
    bars = [round(float(20 * np.log10(np.sqrt(np.mean(rms[(rt >= b) & (rt < b + 2)] ** 2)) + 1e-9)), 1) for b in np.arange(0, dur - 0.5, 2)]
    cent = librosa.feature.spectral_centroid(y=y, sr=sr, hop_length=512)[0]
    cbars = [int(np.mean(cent[(rt >= b) & (rt < b + 2)])) for b in np.arange(0, dur - 0.5, 2)]
    print(json.dumps({
        'file': path, 'dur': round(dur, 2), 'bpm_fit': round(float(bpm), 2), 'grid_offset_s': round(float(off % period), 3), 'beat_resid_ms_rms': round(float(np.sqrt(np.mean(resid ** 2)) * 1000), 1),
        'best_comb_period_s': round(float(per), 4), 'best_comb_bpm': round(60 / float(per), 2), 'best_comb_share': round(float(share), 3),
        'comb_0.5s_share': round(float(share05), 3), 'comb_0.5s_phase_s': round(float(phase05), 3),
        'phase_by_quarter_s': [phase_in(0, 10), phase_in(10, 20), phase_in(20, 30), phase_in(30, dur)],
        'onset_at_marks_x_median': marks, 'rms_db_per_bar': bars, 'centroid_hz_per_bar': cbars,
    }))
