#!/bin/bash
# install.sh: check (and where possible complete) everything video-like-peter needs. Safe to run again.
#
#   ./install.sh            check tools, install playwright-core + its headless Chromium once, OUTSIDE the skill
#                           folder, in $VLP_CACHE (default ${XDG_CACHE_HOME:-~/.cache}/video-like-peter/vendor)
#   CHECK_ONLY=1 ./install.sh   only report, change nothing
#
# Required: node 18+ (and npm), ffmpeg with drawtext, python3. Recommended: yt-dlp (reference hunt),
# uv (audio tools). three.js 0.180.0 ships inside template/tools/vendor/three, so rendering never touches
# the network; the only download is playwright-core and its browser, once.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
# the vendor folder lives outside the skill, so the skill stays small to share and holds no third-party SKILL.md
CACHE="${VLP_CACHE:-${XDG_CACHE_HOME:-$HOME/.cache}/video-like-peter/vendor}"
ok=1
say() { printf '%-14s %s\n' "$1" "$2"; }
need() {  # need <cmd> <hint>
  if command -v "$1" >/dev/null 2>&1; then say "$1" "ok ($(command -v "$1"))"; else say "$1" "MISSING: $2"; ok=0; fi
}
want() {
  if command -v "$1" >/dev/null 2>&1; then say "$1" "ok"; else say "$1" "optional, missing: $2"; fi
}
need node "install Node 18 or newer (https://nodejs.org or brew install node)"
if command -v node >/dev/null 2>&1; then
  major=$(node -p 'process.versions.node.split(".")[0]')
  [ "$major" -ge 18 ] || { say node "too old ($(node -v)), need 18+"; ok=0; }
fi
need npm "comes with Node"
need ffmpeg "brew install ffmpeg (or your package manager)"
if command -v ffmpeg >/dev/null 2>&1; then
  ffmpeg -hide_banner -filters 2>/dev/null | grep -q ' drawtext ' && say drawtext "ok" || { say drawtext "MISSING: ffmpeg built without drawtext (contact sheets need it)"; ok=0; }
fi
need python3 "install Python 3"
want yt-dlp "pipx install yt-dlp (needed for scripts/hunt.sh and grab.sh on URLs)"
want uv "curl -LsSf https://astral.sh/uv/install.sh | sh (audio analysis and mix tools)"
[ -f "$HERE/template/tools/vendor/three/build/three.module.js" ] && say three.js "ok (vendored 0.180.0)" || { say three.js "MISSING from template/tools/vendor/three"; ok=0; }

if [ "${CHECK_ONLY:-0}" = 1 ]; then
  if [ -d "$CACHE/playwright-core" ]; then say playwright "ok ($CACHE)"
  elif [ -d "$HERE/template/tools/vendor/playwright-core" ]; then say playwright "inside the skill (old layout): ./install.sh moves it to $CACHE"
  else say playwright "not installed yet (run ./install.sh)"; fi
  [ $ok = 1 ] && echo "check: ok" || echo "check: fix the MISSING lines"; exit 0
fi
[ $ok = 1 ] || { echo "install: fix the MISSING lines first"; exit 1; }
chmod +x "$HERE"/scripts/*.sh "$HERE"/scripts/*.py "$HERE/template/setup.sh" 2>/dev/null || true
# playwright-core + chromium-headless-shell, installed into $CACHE (a tiny kit: setup.sh + three, so
# template/setup.sh does the work and stays idempotent)
LEGACY="$HERE/template/tools/vendor/playwright-core"
mkdir -p "$CACHE/kit/tools/vendor"
if [ -d "$LEGACY" ] && [ ! -L "$LEGACY" ]; then
  if [ -d "$CACHE/playwright-core" ]; then rm -rf "$LEGACY"; else mv "$LEGACY" "$CACHE/playwright-core"; fi
  say playwright "moved out of the skill folder to $CACHE"
fi
cp "$HERE/template/setup.sh" "$CACHE/kit/setup.sh"
[ -e "$CACHE/kit/tools/vendor/three" ] || cp -R "$HERE/template/tools/vendor/three" "$CACHE/kit/tools/vendor/three"
[ -d "$CACHE/playwright-core" ] && [ ! -e "$CACHE/kit/tools/vendor/playwright-core" ] && ln -s "$CACHE/playwright-core" "$CACHE/kit/tools/vendor/playwright-core"
if [ -n "${PLAYWRIGHT_VENDOR:-}" ]; then
  (cd "$CACHE/kit" && ./setup.sh "$PLAYWRIGHT_VENDOR") || exit 1
else
  (cd "$CACHE/kit" && ./setup.sh) || exit 1
fi
# keep one real copy at $CACHE/playwright-core
if [ ! -L "$CACHE/kit/tools/vendor/playwright-core" ]; then
  rm -rf "$CACHE/playwright-core"; mv "$CACHE/kit/tools/vendor/playwright-core" "$CACHE/playwright-core"
  ln -s "$CACHE/playwright-core" "$CACHE/kit/tools/vendor/playwright-core"
fi
rm -rf "$HERE/template/work" "$HERE/template/audio"
say playwright "ok ($CACHE/playwright-core)"
echo "install: ok. Start a film with: $HERE/scripts/new-film.sh <folder> \"<title>\""
