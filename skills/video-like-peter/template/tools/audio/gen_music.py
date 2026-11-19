"""Generate a music bed with the ElevenLabs Music API from a composition plan whose chunk boundaries are the
film's chapter times (120 BPM, bar = 2 s).
  python3 tools/audio/gen_music.py audio/takes/take1.mp3 [--seed 11] [--model music_v2_5] [--key-file PATH]
Key: environment variable ELEVENLABS_API_KEY, or the file given with --key-file (never printed). One request
at a time.

Measured behaviour (2026): music_v2_5 does NOT honour the chunk durations. It phrases every 8 bars (16 s at
120 BPM; 8 s phrases were also seen) and returns the total length it likes. Plan for it: generate, measure with
analyze.py, then either splice the take on bar lines (splice.py, scene time stays film time) or conform the
picture with the CUT table in film/main.js. Edit CHUNKS below for each film.
"""
import json, os, sys, urllib.request, urllib.error

def arg(flag, default=None):
    return sys.argv[sys.argv.index(flag) + 1] if flag in sys.argv else default

out = sys.argv[1]
model = arg('--model', 'music_v2_5')
seed = arg('--seed')
BASE = ['modern tech product commercial instrumental', 'exactly 120 BPM', '4/4 time', 'warm analog synth pads', 'soft plucked synth arpeggio',
        'deep round bass', 'clean punchy drums with soft claps', 'confident, calm, premium, optimistic', 'instrumental, no vocals',
        'clean modern production, great production quality', 'smooth highs, nothing harsh or piercing']
NEG = ['vocals', 'singing', 'choir', 'spoken word', 'harsh high synth leads', 'piercing sounds', 'heavy distortion', 'dubstep']
CHUNKS = [
    ('[Intro] {low pad and soft pulse, a little tension} {riser in the last bar into the drop}', 4000,
     BASE + ['quiet intro', 'low pad and soft pulse, no drums', 'rising swell in the last second']),
    ('[Drop] {bright full groove from the first beat}', 4000,
     ['bright drop on the downbeat', 'four on the floor kick', 'plucked arpeggio hook', 'warm chords', 'exactly 120 BPM']),
]
if model == 'music_v1':
    plan = {'positive_global_styles': BASE, 'negative_global_styles': NEG,
            'sections': [{'section_name': t.split(']')[0].strip('['), 'positive_local_styles': st[-4:], 'negative_local_styles': [], 'duration_ms': d, 'lines': []} for t, d, st in CHUNKS]}
else:
    plan = {'chunks': [{'text': t, 'duration_ms': d, 'positive_styles': st, 'negative_styles': NEG} for t, d, st in CHUNKS]}
body = {'composition_plan': plan, 'model_id': model}
if seed: body['seed'] = int(seed)
key = os.environ.get('ELEVENLABS_API_KEY')
if not key and arg('--key-file'):
    key = open(os.path.expanduser(arg('--key-file'))).read().strip()
if not key:
    sys.exit('no key: set ELEVENLABS_API_KEY or pass --key-file PATH')
req = urllib.request.Request('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_192', data=json.dumps(body).encode(),
                             headers={'xi-api-key': key, 'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req, timeout=600) as r:
        data = r.read(); sid = r.headers.get('song-id')
except urllib.error.HTTPError as e:
    print('http', e.code, e.read()[:600].decode('utf8', 'replace')); sys.exit(1)
open(out, 'wb').write(data)
json.dump({'model': model, 'seed': seed, 'song_id': sid, 'plan': plan, 'total_ms': sum(d for _, d, _ in CHUNKS)}, open(out + '.json', 'w'), indent=1)
print('ok', out, len(data), 'bytes', 'song', sid)
