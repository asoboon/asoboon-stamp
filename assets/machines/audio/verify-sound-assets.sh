#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
fail=0; checks=0
check_file(){ local src="$1" dst="$2" label="$3"; checks=$((checks+1)); if [[ ! -f "$dst" ]]; then echo "FAIL missing: $label"; fail=$((fail+1)); return; fi; if ! cmp -s "$src" "$dst"; then echo "FAIL drift: $label"; fail=$((fail+1)); fi; }
for GAME in boonrun boonjump; do
  check_file "$HERE/asoboon-audio.js" "$ROOT/$GAME/assets/audio/asoboon-audio.js" "$GAME audio manager"
  for src in "$HERE"/runtime/common/*.mp3; do check_file "$src" "$ROOT/$GAME/assets/audio/runtime/common/$(basename "$src")" "$GAME common/$(basename "$src")"; done
  for src in "$HERE"/runtime/machines/*.mp3; do check_file "$src" "$ROOT/$GAME/assets/audio/runtime/machines/$(basename "$src")" "$GAME machines/$(basename "$src")"; done
done
printf 'SOUND VERIFY: %d checks / %d failures\n' "$checks" "$fail"
[[ "$fail" -eq 0 ]]
