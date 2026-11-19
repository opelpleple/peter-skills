#!/bin/sh
# Smoke test for be-me: runs every script on a fictional fixture.
# Usage: sh ~/.claude/skills/be-me/tests/smoke.sh
set -eu
SKILL="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT
python3 -I -W error::DeprecationWarning "$SKILL/scripts/ingest_slack.py" "$SKILL/tests/fixture.json" "$OUT/stats.json" --min-msgs 1
python3 -I - "$OUT/stats.json" <<'PY'
import json, sys
s = json.load(open(sys.argv[1]))
ids = [c["id"] for c in s["contacts"]]
assert "UALEX0001" in ids, ids          # DM partner gets a block
assert "UBOT00001" not in ids, ids      # bots are skipped
assert "USAM00001" in ids, ids          # @mention in a channel counts
alex = next(c for c in s["contacts"] if c["id"] == "UALEX0001")
assert alex["dm_messages"] == 17, alex["dm_messages"]
assert ("I", 1) in [tuple(x) for x in alex["dm"]["self_reference"]], alex["dm"]["self_reference"]
PY
python3 -I "$SKILL/scripts/build_cards.py" "$OUT/stats.json" "$OUT" --overlay "$SKILL/references/overlay.example.json" --top 5
test -f "$OUT/contacts/INDEX.md"
grep -q "Alex" "$OUT/contacts/INDEX.md"
python3 -I "$SKILL/scripts/build_cards.py" "$OUT/stats.json" "$OUT/copy" --overlay "$SKILL/tests/overlay.copy-check.json" --raw "$SKILL/tests/fixture.json" 2>"$OUT/warn.txt"
grep -q "copies a raw message" "$OUT/warn.txt"
! grep -q "ยังไม่ต้องรีบ" "$OUT/copy/contacts/"alex-*.md
python3 -I "$SKILL/scripts/sample_messages.py" "$SKILL/tests/fixture.json" --partner UALEX -n 3 >"$OUT/s1.txt" 2>&1 || true
grep -q "no messages" "$OUT/s1.txt"     # prefix id must not match
python3 -I "$SKILL/scripts/sample_messages.py" "$SKILL/tests/fixture.json" --partner UALEX0001 -n 3 >/dev/null
if grep -rl "$(printf '\342\200\224')\|$(printf '\342\200\223')" "$OUT" >/dev/null 2>&1; then echo "dash found in output"; exit 1; fi
echo "be-me smoke test: ok"
