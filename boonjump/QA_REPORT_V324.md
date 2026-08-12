# BOONJUMP v3.2.4 QA REPORT

Build: `2026-08-12-boonrun-card-unified-v324`

## UI change
- Machine selector central card rebuilt using the current BOON RUN garage-card visual language.
- Preserved v3.2.3 carousel/arrow/thumbnail selection flow.
- Card now shows rarity, selected state, large machine art, simple difficulty, plain-language introduction, and JUMP BEST.
- Detailed ACCEL / TURBO / NITRO guidance remains immediately below the card.
- MAX distance and tune level remain visible without duplicating BEST.

## Copy change
- All 9 selector taglines rewritten in simpler Japanese.

## Gameplay protection
SHA-256 slices for `CARS`, `motionValue`, and `nitroMotion` are identical to v3.2.3.
No car performance, gacha, distance caps, tune rules, or meter motion definitions were changed.

## 100% reachability
Test model: 9 machines x 3 inputs x 60/90/120 Hz = 81 cases,
with 24 frame-phase offsets per case = 1,944 simulations.
Result: 1,944 PASS / 0 FAIL.

## VFX
- 25 referenced WebP VFX files
- 25 unique references
- 0 missing referenced files

## Static validation
- Inline JS: node --check PASS
- ranking-client.js: node --check PASS
- sw.js: node --check PASS
- Duplicate HTML ids: 0
- Missing `$('<id>')` references: 0
