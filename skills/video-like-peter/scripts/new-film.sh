#!/bin/bash
# new-film.sh: start a film folder from the skill's template (engine, tools, vendored three.js).
#
#   scripts/new-film.sh <folder> "<title>"
#
# Makes <folder>/ with the template, plus the pre-production folders: refs/ (reference hunt), docs/
# (brief.md, refs.md, storyboard.json), boards/ (frame board HTML). playwright-core is linked from the
# vendor cache install.sh fills (VLP_CACHE, default ~/.cache/video-like-peter/vendor); LINK=0 copies it
# instead, about 13 MB.
set -euo pipefail
SKILL="$(cd "$(dirname "$0")/.." && pwd)"
DST="${1:?usage: new-film.sh <folder> \"<title>\"}"; TITLE="${2:-Untitled film}"
[ -e "$DST" ] && { echo "new-film: $DST exists" >&2; exit 1; }
mkdir -p "$DST"
cp -R "$SKILL/template/." "$DST/"
rm -rf "$DST/tools/vendor/playwright-core" "$DST/work" "$DST/audio"
CACHE="${VLP_CACHE:-${XDG_CACHE_HOME:-$HOME/.cache}/video-like-peter/vendor}"
PW=""
for c in "$CACHE/playwright-core" "$SKILL/template/tools/vendor/playwright-core"; do [ -d "$c" ] && { PW="$c"; break; }; done
if [ -n "$PW" ]; then
  if [ "${LINK:-1}" = 1 ]; then ln -s "$PW" "$DST/tools/vendor/playwright-core"
  else cp -R "$PW" "$DST/tools/vendor/playwright-core"; fi
else
  echo "new-film: playwright-core not installed yet: run $SKILL/install.sh, or ./setup.sh in the film" >&2
fi
mkdir -p "$DST/refs" "$DST/boards" "$DST/work" "$DST/audio" "$DST/deliver"
cp "$SKILL/references/brief-template.md" "$DST/docs/brief.md"
# plain text replace, so a title with / & or \ is safe
python3 -I -c 'import sys; p = sys.argv[1]; s = open(p).read(); open(p, "w").write(s.replace("{{TITLE}}", sys.argv[2]))' "$DST/docs/brief.md" "$TITLE"
cp "$SKILL/references/storyboard.example.json" "$DST/docs/storyboard.json"
chmod +x "$DST"/setup.sh "$DST"/tools/bin/* "$DST"/tools/render/encode.sh "$DST"/tools/ui/capture.sh 2>/dev/null || true
echo "new-film: $DST ready. Next: fill docs/brief.md, then hunt references (SKILL.md step 2)."
