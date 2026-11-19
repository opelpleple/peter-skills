"""Fine envelope of a take: RMS (dB) per quarter second and the strongest onsets, for chosen windows.
  uv run --with librosa --with numpy python tools/audio/envelope.py file.mp3 0:9 36:42"""
import sys, numpy as np, librosa
path = sys.argv[1]
y, sr = librosa.load(path, sr=22050, mono=True)
hop = 128
on = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
ot = librosa.frames_to_time(np.arange(len(on)), sr=sr, hop_length=hop)
S = np.abs(librosa.stft(y, n_fft=2048, hop_length=512)) ** 2
f = librosa.fft_frequencies(sr=sr, n_fft=2048); st = librosa.frames_to_time(np.arange(S.shape[1]), sr=sr, hop_length=512)
band = lambda lo, hi: 10 * np.log10(S[(f >= lo) & (f < hi)].sum(axis=0) + 1e-9)
low, mid, high = band(30, 200), band(200, 2500), band(2500, 11000)
print(path)
for w in sys.argv[2:]:
    a, b = [float(x) for x in w.split(':')]
    print(f' window {a}..{b}: time  low/mid/high dB (per 0.25 s)   onset peak')
    for t in np.arange(a, b, 0.25):
        m = (st >= t) & (st < t + 0.25); mo = (ot >= t) & (ot < t + 0.25)
        if not m.any(): continue
        pk = ot[mo][np.argmax(on[mo])] if mo.any() else 0
        print(f'  {t:6.2f}  {low[m].mean():5.1f} {mid[m].mean():5.1f} {high[m].mean():5.1f}   onset {on[mo].max():5.1f} at {pk:6.3f}')
