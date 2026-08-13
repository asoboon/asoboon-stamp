# ASOBooN Machine Asset Consolidation Report

## 1. Summary

Implemented source-of-truth COMMON asset consolidation using workflow B: `assets/machines/` is authoritative, while BOONJUMP and BOONRUN keep runtime sync copies so either game folder can still be uploaded independently.

No machine IDs, save keys, ranking endpoints, ranking keys, gacha rates, display order, or gameplay balance values were intentionally changed.

Backup: `/Users/ikegamiryuusuke/Downloads/asoboon-stamp-main_BACKUP_20260813_134129.zip`

## 2. COMMON Assets

- boon: body.png, boost.png, complete.png, front-wheel.png, front.png, rear-wheel.png, rear.png, shadow.png
- wagon: body.png, boost.png, complete.png, front-wheel.png, front.png, rear-wheel.png, rear.png, shadow.png
- buggy: body.png, boost.png, complete.png, front-wheel.png, front.png, rear-wheel.png, rear.png, shadow.png
- bike: body.png, boost.png, complete.png, front-wheel.png, front.png, rear-wheel.png, rear.png, shadow.png
- sport: body.png, boost.png, complete.png, front-wheel.png, front.png, rear-wheel.png, rear.png, shadow.png
- ssr: body.png, boost.png, complete.png, front-wheel.png, front.png, rear-wheel.png, rear.png, shadow.png
- princess: body.png, boost.png, complete.png, front-wheel.png, front.png, rear-wheel.png, rear.png, shadow.png
- valkyrie: body.png, boost.png, complete.png, front-wheel.png, front.png, rear-wheel.png, rear.png, shadow.png
- secret: body.png, boost.png, complete.png, front.png, rear.png, shadow.png

## 3. MACHINE CARD Results

- 01-boon-pickup.webp -> boon
- 02-smart-wagon.webp -> wagon
- 03-lucky-buggy.webp -> buggy
- 04-power-bike.webp -> bike
- 05-nitro-sport.webp -> sport
- 06-cosmic-phantom.webp -> ssr
- 07-princess-starliner.webp -> princess
- 08-secret-rocket.webp -> secret
- 09-highway-valkyrie.webp -> valkyrie

All 9 authoritative cards are in `assets/machines/cards/`, copied to `boonjump/assets/cards/` and to RUN as `boonrun/assets/cards/{id}.webp`.

## 4. BOONJUMP Assets

BOONJUMP-specific VFX stayed independent under `boonjump/assets/vfx/`:

- boonjump/assets/vfx/boon/fireball-flight.webp
- boonjump/assets/vfx/boon/impact-burst.webp
- boonjump/assets/vfx/boon/overpressure.webp
- boonjump/assets/vfx/buggy/chaos-impact-burst.webp
- boonjump/assets/vfx/buggy/electric-bounce-arc.webp
- boonjump/assets/vfx/buggy/electric-ground-trail.webp
- boonjump/assets/vfx/princess/crystal-orbit-trail.webp
- boonjump/assets/vfx/princess/crystal-wing.webp
- boonjump/assets/vfx/princess/royal-crown-wing.webp
- boonjump/assets/vfx/princess/star-orbit.webp
- boonjump/assets/vfx/sport/nitro-spear.webp
- boonjump/assets/vfx/sport/plasma-line.webp
- boonjump/assets/vfx/sport/pressure-burst.webp
- boonjump/assets/vfx/ssr/dimension-comet.webp
- boonjump/assets/vfx/ssr/dimension-rift.webp
- boonjump/assets/vfx/ssr/gravity-core.webp
- boonjump/assets/vfx/ssr/gravity-lens-fracture.webp
- boonjump/assets/vfx/valkyrie/README.txt
- boonjump/assets/vfx/valkyrie/mach-cone.webp
- boonjump/assets/vfx/valkyrie/rune-halo.webp
- boonjump/assets/vfx/valkyrie/sonic-trail.webp
- boonjump/assets/vfx/valkyrie/wing-front.webp
- boonjump/assets/vfx/valkyrie/wing-rear.webp
- boonjump/assets/vfx/wagon/air-capsule.webp
- boonjump/assets/vfx/wagon/airflow-stream.webp
- boonjump/assets/vfx/wagon/stability-ring.webp

## 5. BOONRUN Assets

- Procedural RUN gameplay assets remain in `boonrun/game.bundle.js`: obstacles, fuel, drone, road, CRITICAL/ULTIMATE/special effects.
- Runtime common sync copies remain in `boonrun/assets/cars/` and `boonrun/assets/cards/` for standalone upload safety.

## 6. KEEP SEPARATE

- assets/machines/keep-separate/boonrun-card-illustrations/bike.webp
- assets/machines/keep-separate/boonrun-card-illustrations/boon.webp
- assets/machines/keep-separate/boonrun-card-illustrations/buggy.webp
- assets/machines/keep-separate/boonrun-card-illustrations/princess.webp
- assets/machines/keep-separate/boonrun-card-illustrations/secret.webp
- assets/machines/keep-separate/boonrun-card-illustrations/sport.webp
- assets/machines/keep-separate/boonrun-card-illustrations/ssr.webp
- assets/machines/keep-separate/boonrun-card-illustrations/thumb/bike.webp
- assets/machines/keep-separate/boonrun-card-illustrations/thumb/boon.webp
- assets/machines/keep-separate/boonrun-card-illustrations/thumb/buggy.webp
- assets/machines/keep-separate/boonrun-card-illustrations/thumb/princess.webp
- assets/machines/keep-separate/boonrun-card-illustrations/thumb/secret.webp
- assets/machines/keep-separate/boonrun-card-illustrations/thumb/sport.webp
- assets/machines/keep-separate/boonrun-card-illustrations/thumb/ssr.webp
- assets/machines/keep-separate/boonrun-card-illustrations/thumb/wagon.webp
- assets/machines/keep-separate/boonrun-card-illustrations/wagon.webp

These are derived RUN card illustrations/thumbnails, not numbered MACHINE CARD正本.

## 7. SHA-256 Classification

- JUMP/RUN exact shared machine parts: 43 files (`body`, `boost`, `shadow`, and non-secret wheels) are SHA-256 perfect matches.
- JUMP duplicate `boonjump/cars`: 68 files matched `boonjump/assets/cars`; 61 became COMMON source files and 7 legacy `suv` aliases were removed as `bike` duplicates.
- JUMP duplicate `boonjump/vfx`: 26 files matched `boonjump/assets/vfx` and were removed.
- RUN old card illustrations: 16 files were derived/KEEP SEPARATE, not commonized.
- Substantial-same format/resolution-only cases: 0. No lossy conversion or recompression was performed.

Detailed table: `assets/machines/migration/asset-comparison.csv`
Full move/delete log: `assets/machines/migration/asset-migration-ops.tsv`

## 8. Body / Wheel / Shadow / Icon / Thumbnail

- Body: 9/9 JUMP-RUN exact matches, promoted to COMMON source.
- Front wheel / rear wheel: 8/8 non-secret JUMP-RUN exact matches, promoted to COMMON source. Secret has no runtime wheel pair.
- Shadow: 9/9 exact matches, promoted to COMMON source.
- Icons: left game-specific because manifests use separate PWA icons.
- Thumbnails: RUN legacy thumbnails moved to KEEP SEPARATE because they are not current runtime dependencies.

## 9. Deleted Or Removed Duplicates

- Removed `boonjump/vfx/` duplicate subtree after exact comparison.
- Removed `boonjump/assets/cars/suv-*` legacy duplicates after confirming byte equality with `bike-*`.
- Removed top-level `boonjump/cars/` from game upload surface by moving canonical machine files to COMMON.

## 10. Moved / Renamed Files

- `boonjump/cars/{id}-{part}.png` -> `assets/machines/common/{id}/{part}.png`
- `boonjump/cards/*.webp` -> `assets/machines/cards/*.webp`
- `boonrun/assets/cards/*.webp` old illustrations -> `assets/machines/keep-separate/boonrun-card-illustrations/`
- `boonrun/assets/cards/thumb/*.webp` -> `assets/machines/keep-separate/boonrun-card-illustrations/thumb/`
- `boonjump/docs` and QA reports -> `docs/archive/boonjump/`
- `boonrun/QA_REPORT*.md` -> `docs/archive/boonrun/`

## 11. Code And Service Worker Changes

- `boonjump/index.html`: updated build/cache asset version; removed obsolete asset aliases `suv`, `cosmic`, and Valkyrie fallback-to-ssr.
- `boonjump/sw.js`: updated cache build; removed deleted `suv` precache paths; added 9 MACHINE CARD precache paths.
- `boonrun/sw.js`: updated cache name.
- `boonrun/assets/cards/README.txt` and `boonrun/VERSION.txt`: documented common card sync behavior.
- Added `assets/machines/README.md` and `assets/machines/sync-machine-assets.sh`.

## 12. File Counts

- Current BOONJUMP files: 269 -> 105 (164 fewer)
- Current BOONRUN files: 94 -> 74 (20 fewer)
- Project total files: 379 -> 372 (7 fewer, including this report/audit files)
- COMMON library files: 79
- `assets/machines/` total files: 100
- KEEP SEPARATE files: 16

JUMP remains 105 files because VFX is intentionally kept as individually controlled files. Reducing below 100 would require atlas/merge work that would harm VFX independence or maintenance.

## 13. Final Folder Tree

```text
assets/machines/cards
assets/machines/common
assets/machines/common/bike
assets/machines/common/boon
assets/machines/common/buggy
assets/machines/common/princess
assets/machines/common/secret
assets/machines/common/sport
assets/machines/common/ssr
assets/machines/common/valkyrie
assets/machines/common/wagon
assets/machines/keep-separate
assets/machines/keep-separate/boonrun-card-illustrations
assets/machines/keep-separate/boonrun-card-illustrations/thumb
assets/machines/migration
```

## 14. Tests

- Backup created before edits: PASS.
- JavaScript syntax: `boonjump` inline JS, `ranking-client.js`, both SW files, `boonrun/game.bundle.js`, `run-ranking.js`: PASS.
- Manifest JSON/icons: PASS.
- Image decode check: PASS.
- Dynamic machine asset paths: PASS.
- MACHINE CARD 9 files: PASS.
- Service Worker precache paths: PASS.
- SHA sync from COMMON to runtime copies: PASS.
- Total path validation checks: 627, failures: 0.
- Local HTTP sample checks: PASS for `/boonjump/`, `/boonrun/`, JUMP Valkyrie card, RUN Valkyrie card.

Browser interaction note: Playwright is not installed in this downloaded static copy, and Chrome headless did not return reliably in this restricted execution environment. Full click-through gameplay was not completed here; static/runtime path validation and HTTP 200 checks passed.

## 15. Ranking / Save Protection

Confirmed unchanged identifiers in code:

- BOONJUMP save key: `asoboonBoonjump.v2`
- BOONJUMP legacy key: `asoboonBooncar.v6`
- BOONJUMP ranking endpoint/key file: `boonjump/ranking-client.js` was not edited.
- BOONRUN ranking endpoint/key file: `boonrun/run-ranking.js` was not edited.
- Machine IDs remain: `boon`, `wagon`, `buggy`, `bike`, `sport`, `ssr`, `princess`, `valkyrie`, `secret`.

## 16. Remaining Risks

- BOONJUMP is 105 files, not under 100. This is the safer result because JUMP VFX stayed separate.
- RUN old illustration cards are preserved in KEEP SEPARATE; a design decision is needed before deleting them permanently.
- Full manual/gameplay browser click-through should still be performed in a normal browser before production upload.

## 17. Future Asset Addition Rules

Use `assets/machines/README.md` as the rulebook. Short version:

- Put machine identity in COMMON.
- Put flight/AWAKENING/jump effects only in BOONJUMP.
- Put run/CRITICAL/ULTIMATE/obstacle/fuel/road effects only in BOONRUN.
- Never change machine IDs or card numbers during asset work.
- Run `assets/machines/sync-machine-assets.sh` after changing COMMON.
- Update Service Worker cache names after sync.
