#!/bin/bash
# Capture every component of ui/components.html to film/assets/ui/<name>.png (3x, transparent) and write
# film/assets/ui/manifest.json (size in CSS px, pad, anchors) plus a gallery work/qa/ui-gallery.jpg.
# Optional arguments: component names to recapture (the others keep their PNG).
#   tools/ui/capture.sh            all components
#   tools/ui/capture.sh card-demo  one component
set -eu
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; cd "$ROOT"
node tools/ui/anchors.cjs "$@"
python3 -I tools/ui/manifest.py
