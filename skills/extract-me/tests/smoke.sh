#!/bin/sh
# Smoke test: build a fake home, scan it, confirm secrets are never listed and counts are right.
set -e
SKILL="$(cd "$(dirname "$0")/.." && pwd)"
T="$(mktemp -d)"
trap 'rm -rf "$T"' EXIT
mkdir -p "$T/code/app/src" "$T/code/films/ep1/renders" "$T/code/app/node_modules/x" "$T/skills/my-skill" "$T/mem"
printf '{"dependencies":{"react":"1","three":"1"}}' > "$T/code/app/package.json"
printf '# Demo app\n' > "$T/code/app/README.md"
for i in 1 2 3; do printf 'x' > "$T/code/app/src/c$i.tsx"; done
printf 'SECRET=1' > "$T/code/app/.env"
printf 'tok' > "$T/code/app/api_token.txt"
printf ':root{}' > "$T/code/app/src/tokens.css"
printf '{}' > "$T/code/app/src/design-tokens.json"
printf 'gift list' > "$T/code/app/secret-santa.md"
mkdir -p "$T/code/app/ssl"
printf 'KEYDATA' > "$T/code/app/ssl/server.key"
printf 'tiny' > "$T/code/app/stray.key"
for i in 1 2 3 4 5 6 7 8 9 10 11; do printf 'v' > "$T/code/films/ep1/renders/shot$i.mp4"; done
head -c 20000 /dev/zero > "$T/code/films/ep1/pitch-deck.key"
printf -- '---\nname: my-skill\ndescription: Make a film storyboard\n---\nbody\n' > "$T/skills/my-skill/SKILL.md"
printf -- '- **Shipped film pipeline (2026-01-01)**: done\n' > "$T/mem/agent.md"
(cd "$T/code/app" && git init -q && git -c user.name=tester -c user.email=t@example.com add -A \
  && git -c user.name=tester -c user.email=t@example.com commit -qm init)
python3 "$SKILL/scripts/scan.py" --identity tester --root "$T/code" --skills-root "$T/skills" \
  --memory-glob "$T/nomem" --memory-file "$T/mem/agent.md" --out "$T/out/scan.json" > "$T/log"
python3 - "$T/out/scan.json" <<'EOF'
import json, sys
d = json.load(open(sys.argv[1]))
t = d["totals"]
assert t["projects"] == 2, t
assert t["commits_mine"] == 1, t
app = [p for p in d["projects"] if p["path"].endswith("app")][0]
# 3 tsx + package.json + README + tokens.css + design-tokens.json + secret-santa.md;
# no .env, no token file, no small or ssl/ .key file
assert app["walk"]["files"] == 8, app["walk"]
assert app["walk"]["ext"].get(".css") == 1 and app["walk"]["ext"].get(".md") == 2, app["walk"]
assert ".key" not in app["walk"]["ext"], app["walk"]
assert "three" in app["packages"], app["packages"]
films = [p for p in d["projects"] if "films" in p["path"]][0]
assert films["kind"] == "folder" and films["walk"]["media_files"] == 12, films   # 11 mp4 + Keynote deck
assert films["walk"]["ext"].get(".key") == 1, films["walk"]
assert d["domains"]["motion"]["projects"] >= 1
assert d["skills"][0]["third_party_signals"] == []
assert d["memory"]["memory_headings"] == ["Shipped film pipeline (2026-01-01)"]
raw = open(sys.argv[1]).read()
assert ".env" not in raw and "api_token" not in raw and "server.key" not in raw
print("smoke OK")
EOF
