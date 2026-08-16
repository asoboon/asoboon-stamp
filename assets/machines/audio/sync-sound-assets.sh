#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
for GAME in boonrun boonjump; do
  DEST="$ROOT/$GAME/assets/audio"
  mkdir -p "$DEST/runtime/common" "$DEST/runtime/machines"
  cp "$HERE/asoboon-audio.js" "$DEST/asoboon-audio.js"
  rsync -a --delete "$HERE/runtime/common/" "$DEST/runtime/common/"
  rsync -a --delete "$HERE/runtime/machines/" "$DEST/runtime/machines/"
done
"$HERE/verify-sound-assets.sh"
