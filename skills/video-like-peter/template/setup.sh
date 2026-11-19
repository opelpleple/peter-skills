#!/bin/bash
# setup.sh: make tools/vendor (three.js and playwright-core) for this film folder. Idempotent: run it again
# any time; it does nothing when the right versions are already there.
#
#   ./setup.sh                       install what is missing of three@0.180.0 (vendored) and playwright-core@1.64.1
#   ./setup.sh <existing-vendor-dir> reuse a vendor folder of another film (a folder holding three/ and
#                                    playwright-core/): copied, so this film does not depend on the other one
#   LINK=1 ./setup.sh <dir>          symlink instead of copying (saves about 36 MB, shares the other folder)
#
# Browser: render.mjs and tools/ui/anchors.cjs launch Chromium through playwright-core. By default that is the
# chromium-headless-shell build matching playwright-core 1.64.1, which lives in the Playwright browser cache
# (macOS ~/Library/Caches/ms-playwright, Linux ~/.cache/ms-playwright). This script installs it when it is
# missing (npx playwright-core install chromium-headless-shell, about 100 MB, needs the network once).
# Alternatives: render.mjs --browser chrome uses an installed Google Chrome (CHROME=/path/to/chrome, else the
# macOS app path, else Playwright's 'chrome' channel); CHROME=/path/to/chrome also serves the UI capture. On macOS the renderer uses the Metal GPU by default; elsewhere it uses SwiftShader (software).
# Set SKIP_BROWSER=1 to skip the browser check.
#
# Also needed on PATH: node 18+, ffmpeg (with drawtext, for contact sheets and encoding), python3.
# For the audio tools: uv (or python3 with numpy; librosa for analyze.py).
set -euo pipefail
KIT="$(cd "$(dirname "$0")" && pwd)"
V="$KIT/tools/vendor"
THREE_V=0.180.0
PW_V=1.64.1

have() {  # have <package> <version>
  [ -f "$V/$1/package.json" ] && [ "$(node -p "require('$V/$1/package.json').version" 2>/dev/null)" = "$2" ]
}

command -v node >/dev/null || { echo "setup: node is not on PATH" >&2; exit 1; }
mkdir -p "$V"

offline_help() {
  cat >&2 <<'HELP'
setup: ways round a missing network or a failed install:
  ./setup.sh /path/to/vendor   reuse a vendor folder (holding three/ and playwright-core/) of another film
  SKIP_BROWSER=1 ./setup.sh    skip the browser step; then render with --browser chrome and CHROME=/path/to/chrome
  CHROME=/path/to/chrome       an installed Chrome or Chromium for render.mjs --browser chrome and tools/ui/capture.sh
  Linux: the headless shell may need system libraries: node tools/vendor/playwright-core/cli.js install --with-deps chromium-headless-shell
HELP
}

if [ $# -ge 1 ]; then
  [ -d "$1" ] || { echo "setup: vendor folder not found: $1" >&2; offline_help; exit 1; }
  SRC="$(cd "$1" && pwd)"
  for pkg in three playwright-core; do
    [ -f "$SRC/$pkg/package.json" ] || { echo "setup: $SRC/$pkg/package.json not found" >&2; exit 1; }
    want=$([ $pkg = three ] && echo $THREE_V || echo $PW_V)
    got=$(node -p "require('$SRC/$pkg/package.json').version")
    [ "$got" = "$want" ] || echo "setup: note: $SRC/$pkg is $got, the kit was tested with $want"
    if [ -L "$V/$pkg" ] || { [ -e "$V/$pkg" ] && ! have $pkg "$got"; }; then rm -rf "$V/$pkg"; fi
    if [ -e "$V/$pkg" ]; then echo "setup: $pkg $got already in tools/vendor"; continue; fi
    if [ "${LINK:-0}" = 1 ]; then ln -s "$SRC/$pkg" "$V/$pkg"; echo "setup: linked $pkg -> $SRC/$pkg"
    else cp -R "$SRC/$pkg" "$V/$pkg"; echo "setup: copied $pkg $got from $SRC"; fi
  done
else
  # three ships vendored in this kit (tools/vendor/three, build files only); playwright-core is installed once
  NEED=()
  have three $THREE_V || NEED+=("three@$THREE_V")
  have playwright-core $PW_V || NEED+=("playwright-core@$PW_V")
  if [ ${#NEED[@]} = 0 ]; then
    echo "setup: three $THREE_V and playwright-core $PW_V already in tools/vendor"
  else
    command -v npm >/dev/null || { echo "setup: npm is not on PATH" >&2; exit 1; }
    TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
    echo "setup: npm install ${NEED[*]}"
    if ! (cd "$TMP" && npm init -y >/dev/null && npm install --no-audit --no-fund --ignore-scripts "${NEED[@]}" >"$TMP/npm.log" 2>&1); then
      echo "setup: npm install failed (no network, or the registry is unreachable). Last lines of the npm log:" >&2
      tail -8 "$TMP/npm.log" >&2
      offline_help; exit 1
    fi
    for spec in "${NEED[@]}"; do pkg="${spec%@*}"; rm -rf "$V/$pkg"; cp -R "$TMP/node_modules/$pkg" "$V/$pkg"; done
    echo "setup: installed into tools/vendor"
  fi
fi

# the importmap in film/index.html needs this file
[ -f "$V/three/build/three.module.js" ] || { echo "setup: three/build/three.module.js missing" >&2; exit 1; }

if [ "${SKIP_BROWSER:-0}" != 1 ]; then
  CACHE="${PLAYWRIGHT_BROWSERS_PATH:-}"
  [ -z "$CACHE" ] && { [ "$(uname)" = Darwin ] && CACHE="$HOME/Library/Caches/ms-playwright" || CACHE="$HOME/.cache/ms-playwright"; }
  REV=$(node -p "require('$V/playwright-core/browsers.json').browsers.find(b => b.name === 'chromium-headless-shell').revision" 2>/dev/null || echo "")
  if [ -n "$REV" ] && [ -d "$CACHE/chromium_headless_shell-$REV" ]; then
    echo "setup: chromium-headless-shell $REV found in $CACHE"
  else
    echo "setup: chromium-headless-shell ${REV:-?} not in $CACHE: installing (needs the network once)"
    if ! node "$V/playwright-core/cli.js" install chromium-headless-shell; then
      echo "setup: the browser download failed. three and playwright-core are installed; only the browser is missing." >&2
      offline_help; exit 1
    fi
  fi
fi
mkdir -p "$KIT/work" "$KIT/audio"
chmod +x "$KIT"/tools/bin/* "$KIT"/tools/render/encode.sh "$KIT"/tools/ui/capture.sh 2>/dev/null || true
echo "setup: ok. Next: tools/bin/stills first 0:7.5:0.5   (then open work/qa/first.jpg)"
