#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
COMMON="$ROOT/assets/machines/common"
CARDS="$ROOT/assets/machines/cards"

machines=(boon wagon buggy bike sport ssr princess valkyrie secret)

copy_if_exists() {
  local src="$1"
  local dst="$2"
  if [[ -f "$src" ]]; then
    mkdir -p "$(dirname "$dst")"
    cp -p "$src" "$dst"
  fi
}

for id in "${machines[@]}"; do
  for part in body boost shadow front rear front-wheel rear-wheel; do
    copy_if_exists "$COMMON/$id/$part.png" "$ROOT/boonjump/assets/cars/$id-$part.png"
  done
  for part in body boost shadow front-wheel rear-wheel complete; do
    copy_if_exists "$COMMON/$id/$part.png" "$ROOT/boonrun/assets/cars/$id-$part.png"
  done
done

copy_if_exists "$CARDS/01-boon-pickup.webp" "$ROOT/boonjump/assets/cards/01-boon-pickup.webp"
copy_if_exists "$CARDS/02-smart-wagon.webp" "$ROOT/boonjump/assets/cards/02-smart-wagon.webp"
copy_if_exists "$CARDS/03-lucky-buggy.webp" "$ROOT/boonjump/assets/cards/03-lucky-buggy.webp"
copy_if_exists "$CARDS/04-power-bike.webp" "$ROOT/boonjump/assets/cards/04-power-bike.webp"
copy_if_exists "$CARDS/05-nitro-sport.webp" "$ROOT/boonjump/assets/cards/05-nitro-sport.webp"
copy_if_exists "$CARDS/06-cosmic-phantom.webp" "$ROOT/boonjump/assets/cards/06-cosmic-phantom.webp"
copy_if_exists "$CARDS/07-princess-starliner.webp" "$ROOT/boonjump/assets/cards/07-princess-starliner.webp"
copy_if_exists "$CARDS/08-secret-rocket.webp" "$ROOT/boonjump/assets/cards/08-secret-rocket.webp"
copy_if_exists "$CARDS/09-highway-valkyrie.webp" "$ROOT/boonjump/assets/cards/09-highway-valkyrie.webp"

copy_if_exists "$CARDS/01-boon-pickup.webp" "$ROOT/boonrun/assets/cards/boon.webp"
copy_if_exists "$CARDS/02-smart-wagon.webp" "$ROOT/boonrun/assets/cards/wagon.webp"
copy_if_exists "$CARDS/03-lucky-buggy.webp" "$ROOT/boonrun/assets/cards/buggy.webp"
copy_if_exists "$CARDS/04-power-bike.webp" "$ROOT/boonrun/assets/cards/bike.webp"
copy_if_exists "$CARDS/05-nitro-sport.webp" "$ROOT/boonrun/assets/cards/sport.webp"
copy_if_exists "$CARDS/06-cosmic-phantom.webp" "$ROOT/boonrun/assets/cards/ssr.webp"
copy_if_exists "$CARDS/07-princess-starliner.webp" "$ROOT/boonrun/assets/cards/princess.webp"
copy_if_exists "$CARDS/08-secret-rocket.webp" "$ROOT/boonrun/assets/cards/secret.webp"
copy_if_exists "$CARDS/09-highway-valkyrie.webp" "$ROOT/boonrun/assets/cards/valkyrie.webp"

# Workflow B invariant: after syncing, COMMON and both runtime copies must be byte-identical.
bash "$ROOT/assets/machines/verify-machine-assets.sh"
