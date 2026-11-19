#!/usr/bin/env bash
# Alternative to tools/bin/film for a render that is already on disk: build the delivery MP4 from rendered frames or
# chunks plus the mastered WAV. H.264 High level 4.1 (libx264, aq-mode=3), yuv420p BT.709 limited range (tagged),
# constant 30 fps, every frame, AAC-LC 48 kHz stereo 320 kb/s straight from the WAV (no audio filters), +faststart.
# The frame count is taken from the WAV, so picture and sound end together. With --no-audio the frame count is
# whatever the render holds and the file is silent.
#
# usage: tools/render/encode.sh <frames-or-chunks-dir> [out.mp4] [options]
#   <dir>            a render.mjs output folder: .../frames (00000.png|jpg ...) or .../chunks (c00000-00300.mkv + .json)
#                    (passing the parent work/render/<slug>-WxH folder also works)
#   out.mp4          default deliver/film.mp4
#   --crf 17         x264 quality (lower = better/larger). 17 is visually transparent for motion graphics.
#   --preset slow    x264 preset
#   --maxrate 40M    VBV cap (with --bufsize 80M) so frame-wide grain cannot blow up the file size
#   --wav audio/mix.wav
#   --no-audio       silent file, frame count from the render (chunk sidecars or numbered frames)
#   --fps 30
#   --preview        quick 960x540 check file (veryfast, crf 23), skips the spec check
#   --no-check       skip the ffprobe and loudness summary afterwards
#   --dry-run        print the ffmpeg command only
set -euo pipefail
export PATH="${PATH:-/usr/bin:/bin}:/opt/homebrew/bin:/usr/local/bin:/usr/sbin"  # ffmpeg/ffprobe from a minimal shell too
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
IN=""; OUT=""; CRF=17; PRESET=slow; MAXRATE=40M; BUFSIZE=80M; WAV="audio/mix.wav"; FPS=30; PREVIEW=0; CHECK=1; DRY=0; NOAUDIO=0
while [ $# -gt 0 ]; do
  case "$1" in
    --crf) CRF="$2"; shift 2;; --preset) PRESET="$2"; shift 2;; --maxrate) MAXRATE="$2"; shift 2;; --bufsize) BUFSIZE="$2"; shift 2;;
    --wav) WAV="$2"; shift 2;; --fps) FPS="$2"; shift 2;; --preview) PREVIEW=1; shift;; --no-check) CHECK=0; shift;; --no-audio) NOAUDIO=1; shift;;
    --dry-run) DRY=1; shift;; -h|--help) sed -n '2,20p' "$0"; exit 0;;
    -*) echo "encode: unknown option $1" >&2; exit 2;;
    *) if [ -z "$IN" ]; then IN="$1"; elif [ -z "$OUT" ]; then OUT="$1"; else echo "encode: too many arguments" >&2; exit 2; fi; shift;;
  esac
done
[ -n "$IN" ] || { sed -n '2,20p' "$0"; exit 2; }
[ -d "$IN" ] || { echo "encode: not a folder: $IN" >&2; exit 2; }
if [ -d "$IN/chunks" ] && ls "$IN/chunks"/c*.json >/dev/null 2>&1; then IN="$IN/chunks"; elif [ -d "$IN/frames" ]; then IN="$IN/frames"; fi
if [ $NOAUDIO = 0 ]; then [ -f "$WAV" ] || { echo "encode: WAV not found: $WAV (use --no-audio for a silent file)" >&2; exit 2; }; fi
if [ -z "$OUT" ]; then if [ $PREVIEW = 1 ]; then OUT="work/preview.mp4"; else OUT="deliver/film.mp4"; fi; fi
mkdir -p "$(dirname "$OUT")"

if [ $NOAUDIO = 0 ]; then
  # expected frame count from the WAV's exact sample count
  read -r SAMPLES RATE < <(ffprobe -v error -select_streams a:0 -show_entries stream=duration_ts,sample_rate -of csv=p=0 "$WAV" | awk -F, '{print $2, $1}')
  FRAMES=$(python3 -c "print(round($SAMPLES / $RATE * $FPS))")
  echo "encode: sound track $WAV = $SAMPLES samples @ $RATE Hz -> $FRAMES frames at $FPS fps"
else
  # silent: as many frames as the render holds
  FRAMES=$(python3 - "$IN" <<'PY'
import glob, json, os, sys
d = sys.argv[1]
side = glob.glob(os.path.join(d, 'c*-*.json'))
if side: print(max(json.load(open(s))['b'] for s in side))
else: print(len([f for f in os.listdir(d) if f[:5].isdigit() and f.endswith(('.png', '.jpg'))]))
PY
)
  echo "encode: no audio, $FRAMES frames from $IN"
fi

INPUT=()
if ls "$IN"/c*.json >/dev/null 2>&1; then
  # chunks: sidecars must cover 0..FRAMES-1 exactly once, and every chunk must contain the frames it claims
  LIST="$IN/encode-list.txt"
  python3 - "$IN" "$FRAMES" "$LIST" <<'PY'
import glob, json, os, subprocess, sys
d, total, lst = sys.argv[1], int(sys.argv[2]), sys.argv[3]
side = sorted(glob.glob(os.path.join(d, 'c*-*.json')))
spans = []
for s in side:
    j = json.load(open(s))
    media = s[:-5] + '.mkv'
    if not os.path.exists(media): sys.exit(f'encode: missing {media}')
    n = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-count_packets', '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', media], capture_output=True, text=True).stdout.strip()
    if int(n) != j['frames'] or j['b'] - j['a'] != j['frames']: sys.exit(f'encode: {media} holds {n} frames, sidecar says {j["frames"]} ({j["a"]}..{j["b"]})')
    spans.append((j['a'], j['b'], media))
spans.sort()
pos = 0
for a, b, m in spans:
    if a != pos: sys.exit(f'encode: chunk gap or overlap at frame {pos} (next chunk starts at {a})')
    pos = b
if pos != total: sys.exit(f'encode: chunks cover frames 0..{pos - 1}, the sound track needs {total}')
open(lst, 'w').write(''.join(f"file '{os.path.abspath(m)}'\n" for _, _, m in spans))
print(f'encode: {len(spans)} chunks verified, frames 0..{total - 1}')
PY
  INPUT=(-f concat -safe 0 -i "$LIST")
else
  EXT=""; for e in png jpg; do [ -f "$IN/00000.$e" ] && EXT=$e && break; done
  [ -n "$EXT" ] || { echo "encode: no 00000.png/jpg and no chunk sidecars in $IN" >&2; exit 2; }
  MISSING=$(python3 -c "import os,sys; d,e,n=sys.argv[1],sys.argv[2],int(sys.argv[3]); m=[f for f in range(n) if not os.path.exists(f'{d}/{f:05d}.{e}')]; print(len(m), m[:10])" "$IN" "$EXT" "$FRAMES")
  [ "${MISSING%% *}" = "0" ] || { echo "encode: missing frames in $IN: $MISSING" >&2; exit 1; }
  echo "encode: $FRAMES frames $IN/%05d.$EXT present"
  INPUT=(-framerate "$FPS" -start_number 0 -i "$IN/%05d.$EXT")
fi

# setpts renumbers frames by index (exact 1/fps spacing whatever the chunk container's timebase);
# swscale: RGB -> BT.709 limited-range YUV 4:2:0, accurate rounding; tagged to match.
TAGS="setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv"  # without it x264 writes primaries/transfer "unknown"
VF="setpts=N/($FPS*TB),scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p,$TAGS"
VIDEO=(-c:v libx264 -profile:v high -level:v 4.1 -preset "$PRESET" -crf "$CRF" -maxrate "$MAXRATE" -bufsize "$BUFSIZE"
  -x264-params aq-mode=3 -g 60 -keyint_min 30 -pix_fmt yuv420p
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv)
if [ $PREVIEW = 1 ]; then
  VF="setpts=N/($FPS*TB),scale=960:540:out_color_matrix=bt709:out_range=tv:flags=bicubic,format=yuv420p,$TAGS"
  VIDEO=(-c:v libx264 -profile:v high -preset veryfast -crf 23 -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv)
  CHECK=0
fi
if [ $NOAUDIO = 0 ]; then
  CMD=(ffmpeg -hide_banner -y "${INPUT[@]}" -i "$WAV" -map 0:v:0 -map 1:a:0 -vf "$VF" -r "$FPS" -fps_mode cfr -frames:v "$FRAMES"
    "${VIDEO[@]}" -c:a aac -b:a 320k -ar 48000 -ac 2 -movflags +faststart "$OUT")
else
  CMD=(ffmpeg -hide_banner -y "${INPUT[@]}" -map 0:v:0 -vf "$VF" -r "$FPS" -fps_mode cfr -frames:v "$FRAMES"
    "${VIDEO[@]}" -an -movflags +faststart "$OUT")
fi
echo "encode: ${CMD[*]}"
[ $DRY = 1 ] && exit 0
START=$(date +%s)
STATS=(-stats); [ -t 1 ] || STATS=(-stats -stats_period 15)   # fewer progress lines when logged to a file
"${CMD[@]}" -loglevel error "${STATS[@]}"
echo "encode: wrote $OUT ($(du -h "$OUT" | cut -f1)) in $(( $(date +%s) - START )) s"
if [ $CHECK = 1 ]; then
  ffprobe -v error -show_entries format=duration,size:stream=codec_name,profile,level,width,height,nb_frames,r_frame_rate -of compact "$OUT"
  [ $NOAUDIO = 0 ] && ffmpeg -hide_banner -i "$OUT" -af ebur128=peak=true -f null - 2>&1 | grep -E "I:|Peak:" | tail -2
fi
exit 0
