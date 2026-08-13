# BOONRUN v1.0.24 — MACHINE CARD SELECT QA

Build: `2026-08-11-playable-v1.0.24-machine-card-select`
Client: `1.0.24`

## Purpose
Replace the old four-column garage with a landscape trading-card catalog UI while leaving gameplay/ranking balance untouched.

## UI implemented
- Landscape `MACHINE CARD SELECT` screen.
- Left vertical card rail for all 8 current BOONRUN machines.
- Large premium featured card.
- Previous / next buttons.
- Horizontal swipe on the featured-card stage.
- Keyboard Left / Right support for desktop QA.
- Featured card displays:
  - rarity
  - machine type
  - English/Japanese machine name
  - drive style
  - handling identity
  - short machine profile
  - RUN BEST
  - owned / selected / locked state
  - `⚡ 最終奥義`
  - special-move name
  - `1 PLAY 1 SHOT`
  - concrete special-move effect
  - `このマシンで走る / SELECT & START`
- Locked machines can be previewed but cannot start.
- `このマシンで走る` commits the focused machine and starts the run.

## Card-art handoff architecture
Artwork is intentionally separated from UI copy.

Drop finished illustration-only artwork into:
`boonrun/assets/cards/`

Supported per machine, priority order:
- `{id}.webp`
- `{id}.png`
- `{id}.jpg`

IDs:
`boon, wagon, buggy, bike, sport, ssr, princess, secret`

Recommended source: 1536×1024, 3:2 landscape, sRGB.

If artwork is missing, the UI automatically uses the current BOONJUMP-synced car preview over a premium CSS highway scene. This allows UI and art production to proceed independently.

Card-art requests are network-first in the service worker so newly uploaded/replaced artwork does not get trapped behind an old image cache.

## Special-move copy included
- ブーンピックアップ — `TITAN BREAK`
- スマートワゴン — `ZERO GRAVITY`
- ラッキーバギー — `SKY RODEO`
- パワーバイク — `LIGHTNING MODE`
- ニトロスポーツ — `OVERDRIVE`
- コズミックファントム — `DIMENSION SHIFT`
- プリンセス・スターライナー — `ROYAL ASCENSION`
- 無敵のロケットアソブーン人間 — `FINAL IGNITION`

All eight include an explicit effect explanation; not only the move name.

## Static QA
PASS:
- `node --check game.bundle.js`
- `node --check run-ranking.js`
- `node --check sw.js`
- CSS parser errors: 0
- duplicate HTML IDs: 0
- missing `$('<id>')` DOM refs: 0
- missing local `index.html` script/style refs: 0
- machine-card presentation entries: 8/8
- special move names present: 8/8
- card-art fallback code present
- card-art network-first SW route present
- authored course patterns: 55
- production `valkyrie` references in `game.bundle.js`: 0

## Regression / balance proof
Compared byte-for-byte against v1.0.23 for the sensitive production data blocks:
- PHYSICS: identical
- OBSTACLES: identical
- ITEMS: identical
- FUEL_ZONES: identical
- FUEL_RULES: identical
- CARS: identical
- PATTERNS: identical
- SPECIALS: identical

`run-ranking.js` is byte-for-byte identical to v1.0.23.
SHA256:
`a32824f2f234549b95f31bbe425175807a2c3fa788b548d42de19d8b42858eaa`

Therefore v1.0.24 does not rebalance jump physics, fuel, obstacle geometry, course generation, car performance, or specials. The v1.0.20 3K BREAKTHROUGH balance remains intact.

## Browser/device limitation
A Chromium runtime screenshot attempt in this container timed out because of the environment's DBus/zygote limitation. No claim is made that a fresh real iPhone/Android/LINE visual test was performed here.

Before public release, recommended device checks are:
1. iPhone landscape — open MACHINE CARD SELECT and swipe all 8 cards.
2. Android landscape — same.
3. Confirm short-height devices keep special effect + START button visible.
4. Drop one real card artwork file into `assets/cards/` and confirm it replaces the CSS fallback without hiding UI copy.
