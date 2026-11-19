#!/bin/bash
# grab.sh: study one reference film. Downloads a small copy, measures it, keeps only small frames, deletes
# the video.
#
#   scripts/grab.sh <url-or-file> <ref-dir> [--from S] [--to S] [--fps F] [--keep]
#
# Writes into <ref-dir>:
#   info.txt        title, channel, url, duration, size
#   cuts.txt        every detected cut (scene change score > 0.3) and the shot length statistics
#   frames/*.jpg    frames at --fps (default 4) inside [from, to], 320 px wide, original time in the file name
#   sheet_NN.jpg    contact sheets of those frames, 6x8 tiles each (48 frames per sheet), original time code
#                   burned in; as many sheets as the frames need
# Times in cuts.txt, frame names and sheets are times of the ORIGINAL video, also after a --from/--to section
# download (info.txt records the section).
#   palette.txt     the 8 most frequent colours (hex, share) of the sampled frames
# The downloaded video lives in <ref-dir>/_src and is deleted at the end unless --keep is given.
# Study only: never reuse footage, music, logos or sentences of a reference in your film.
# Needs ffmpeg, python3, and yt-dlp for URLs.
set -euo pipefail
SRC="${1:?usage: grab.sh <url-or-file> <ref-dir> [--from S] [--to S] [--fps F] [--keep]}"; DIR="${2:?ref-dir}"; shift 2
FROM=0; TO=""; FPS=4; KEEP=0; OFF=0   # OFF = original time of file time 0
while [ $# -gt 0 ]; do
  case "$1" in
    --from) FROM="$2"; shift ;;
    --to) TO="$2"; shift ;;
    --fps) FPS="$2"; shift ;;
    --keep) KEEP=1 ;;
    *) echo "grab: unknown option $1" >&2; exit 2 ;;
  esac
  shift
done
mkdir -p "$DIR/_src" "$DIR/frames"
rm -f "$DIR"/frames/*.jpg
if [ -f "$SRC" ]; then
  VID="$SRC"; KEEP=1; echo "title: $(basename "$SRC")" > "$DIR/info.txt"
else
  command -v yt-dlp >/dev/null || { echo "grab: yt-dlp not on PATH" >&2; exit 1; }
  SECT=()
  if [ -n "$TO" ]; then SECT=(--download-sections "*${FROM}-${TO}"); fi
  yt-dlp -q --no-warnings --no-playlist -f "bv*[height<=480][ext=mp4]+ba[ext=m4a]/b[height<=480]/b" \
    --merge-output-format mp4 ${SECT[@]+"${SECT[@]}"} -o "$DIR/_src/ref.%(ext)s" \
    --print-to-file "title: %(title)s
channel: %(channel)s
url: %(webpage_url)s
duration: %(duration)s s" "$DIR/info.txt" "$SRC"
  VID=$(ls "$DIR"/_src/ref.* | head -1)
  # a section download starts at 0 in the file
  if [ -n "$TO" ]; then echo "section: ${FROM} to ${TO} s of the original (file time 0 = original ${FROM})" >> "$DIR/info.txt"; OFF="$FROM"; FROM=0; TO=""; fi
fi
DUR=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$VID")
WH=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate -of csv=p=0 "$VID")
echo "file: ${DUR} s, ${WH} (w,h,fps)" >> "$DIR/info.txt"
TRIM=(-ss "$FROM"); [ -n "$TO" ] && TRIM+=(-to "$TO")

# cuts: scene change score per frame
ffmpeg -hide_banner -v info "${TRIM[@]}" -i "$VID" -vf "select='gt(scene,0.3)',showinfo" -an -f null - 2>&1 \
  | grep -o 'pts_time:[0-9.]*' | cut -d: -f2 > "$DIR/_src/cuts.raw" || true
python3 -I - "$DIR/_src/cuts.raw" "$DUR" "$FROM" "${TO:-$DUR}" "$OFF" > "$DIR/cuts.txt" <<'PY'
import sys
cuts=[float(x) for x in open(sys.argv[1]).read().split()]
o=float(sys.argv[5]); a=float(sys.argv[3])+o; b=float(sys.argv[4])+o; span=b-a
cuts=[c+a for c in cuts]
edges=[a]+cuts+[b]
shots=[round(edges[i+1]-edges[i],3) for i in range(len(edges)-1) if edges[i+1]-edges[i]>0.04]
print(f"window {a:.2f} to {b:.2f} s, {len(cuts)} cuts, {len(shots)} shots")
if shots:
    s=sorted(shots); med=s[len(s)//2]
    print(f"shot length: mean {sum(s)/len(s):.2f} s, median {med:.2f} s, shortest {s[0]:.2f} s, longest {s[-1]:.2f} s")
    print(f"cuts per 10 s: {10*len(cuts)/span:.1f}")
print("cut times (s): " + ", ".join(f"{c:.2f}" for c in cuts))
PY

# frames, renamed in one pass to their original time
ffmpeg -v error "${TRIM[@]}" -i "$VID" -vf "fps=${FPS},scale=320:-2" -q:v 4 "$DIR/_src/f_%04d.jpg"
python3 -I - "$DIR/_src" "$DIR/frames" "$OFF" "$FROM" "$FPS" <<'PY'
import os, sys
src, dst = sys.argv[1], sys.argv[2]; start = float(sys.argv[3]) + float(sys.argv[4]); fps = float(sys.argv[5])
for i, f in enumerate(sorted(x for x in os.listdir(src) if x.startswith('f_') and x.endswith('.jpg'))):
    os.replace(os.path.join(src, f), os.path.join(dst, f't{start + i / fps:06.2f}.jpg'))
PY
# contact sheets, 48 frames each, original time code
rm -f "$DIR"/sheet.jpg "$DIR"/sheet_*.jpg
TC=$(python3 -I -c 'import sys; print(float(sys.argv[1]) + float(sys.argv[2]))' "$OFF" "$FROM")
ffmpeg -v error -y "${TRIM[@]}" -i "$VID" -vf "fps=${FPS},scale=240:-2,drawtext=text='%{pts\:hms\:${TC}}':x=4:y=4:fontsize=13:fontcolor=white:box=1:boxcolor=black@0.6,tile=6x8" -fps_mode vfr -q:v 4 "$DIR/sheet_%02d.jpg"
# palette: 8 most frequent colours on a 4 bit per channel grid
ffmpeg -v error "${TRIM[@]}" -i "$VID" -vf "fps=1,scale=64:36" -f rawvideo -pix_fmt rgb24 "$DIR/_src/px.rgb"
python3 -I - "$DIR/_src/px.rgb" > "$DIR/palette.txt" <<'PY'
import sys, collections
d=open(sys.argv[1],'rb').read(); c=collections.Counter()
for i in range(0,len(d)-2,3):
    c[(d[i]>>4,d[i+1]>>4,d[i+2]>>4)]+=1
n=sum(c.values()) or 1
for (r,g,b),k in c.most_common(8):
    print(f"#{r*17:02X}{g*17:02X}{b*17:02X}  {100*k/n:.1f}%")
PY
if [ $KEEP = 0 ]; then rm -rf "$DIR/_src"; else rm -f "$DIR"/_src/cuts.raw "$DIR"/_src/px.rgb; fi
echo "grab: $(ls "$DIR/frames" | wc -l | tr -d ' ') frames, $(ls "$DIR"/sheet_*.jpg | wc -l | tr -d ' ') sheet(s): $DIR/sheet_NN.jpg"
cat "$DIR/cuts.txt" | head -3
