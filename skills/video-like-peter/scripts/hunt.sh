#!/bin/bash
# hunt.sh: search YouTube for reference films and list candidates (no download).
#
#   scripts/hunt.sh "<query>" [count] [out.tsv]
#
# Prints and appends one row per result: id, duration (s), views, channel, title, url.
# Run it 3 to 5 times with different queries (style words, not your topic: "kinetic typography title card",
# "brand film motion design", "type animation logo reveal"), then shortlist 2 or 3 in docs/refs.md.
# Needs yt-dlp on PATH. Nothing is downloaded here; scripts/grab.sh fetches frames of the ones you pick.
set -euo pipefail
Q="${1:?usage: hunt.sh \"<query>\" [count] [out.tsv]}"; N="${2:-8}"; OUT="${3:-}"
command -v yt-dlp >/dev/null || { echo "hunt: yt-dlp not on PATH (pipx install yt-dlp, or brew install yt-dlp)" >&2; exit 1; }
ROWS=$(yt-dlp --flat-playlist --no-warnings --skip-download \
  --print "%(id)s	%(duration)s	%(view_count)s	%(channel)s	%(title)s	https://www.youtube.com/watch?v=%(id)s" \
  "ytsearch${N}:${Q}" 2>/dev/null || true)
[ -n "$ROWS" ] || { echo "hunt: no results (network, or YouTube rate limit: wait a minute)" >&2; exit 1; }
echo "# query: $Q"
echo "$ROWS"
if [ -n "$OUT" ]; then
  mkdir -p "$(dirname "$OUT")"
  [ -f "$OUT" ] || printf 'id\tduration\tviews\tchannel\ttitle\turl\tquery\n' > "$OUT"
  echo "$ROWS" | awk -v q="$Q" -F'\t' 'BEGIN{OFS="\t"} {print $0, q}' >> "$OUT"
fi
