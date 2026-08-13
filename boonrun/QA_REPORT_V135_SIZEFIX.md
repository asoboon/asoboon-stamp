# BOON RUN 2 v1.0.35 — SIZE / RESPONSIVE QA

## Scope
UI sizing and MACHINE CARD presentation only. Gameplay rules, machine balance, ranking endpoint, save keys and machine IDs are intentionally unchanged.

## Root causes found in v1.0.34
1. `machine-card-screen` inherited the normal screen top/bottom padding, while `machine-card-layout` also used a fixed `height: calc(100dvh - 64/86px)`. The two height systems were added together and could clip the lower/right UI on short landscape phones.
2. The <=900px MACHINE CARD grid required `144px + 320px + 225px + gaps`, which exceeds 667px-class landscape viewports after safe-area/screen padding.
3. Finished 3:2 MACHINE CARD artwork was displayed with vehicle-art padding (`7% 4% 17%`) and duplicate badges/captions over the card itself.
4. The 1600x720 gameplay canvas was styled with both `width:100%` and `height:100%`, allowing viewport aspect ratio to influence visual scaling.

## v1.0.35 fixes
- MACHINE CARD screen is now a flex column that consumes only the actual remaining viewport height.
- 568–760px landscape phones use a horizontal machine rail and a two-column card/info layout.
- <=360px-height landscape gets an additional compact pass.
- Finished card artwork is shown full-frame at its native 1024:683 ratio with no extra padding/duplicate caption overlay.
- 9 current BOONJUMP MACHINE CARD masters are mirrored byte-for-byte into BOONRUN.
- Menu, HUD and ranking controls use fluid widths on compact landscape phones.
- Gameplay canvas preserves the logical 20:9 (1600x720) aspect ratio.

## Card master verification
All 9 BOONRUN card files are SHA-256 identical to the current BOONJUMP card masters.

| RUN id | BOONJUMP master | Result |
|---|---|---|
| boon | 01-boon-pickup.webp | PASS |
| wagon | 02-smart-wagon.webp | PASS |
| buggy | 03-lucky-buggy.webp | PASS |
| bike | 04-power-bike.webp | PASS |
| sport | 05-nitro-sport.webp | PASS |
| ssr | 06-cosmic-phantom.webp | PASS |
| princess | 07-princess-starliner.webp | PASS |
| secret | 08-secret-rocket.webp | PASS |
| valkyrie | 09-highway-valkyrie.webp | PASS |

All 9 card dimensions: `1024 x 683`.

## Static validation
- `game.bundle.js`: `node --check` PASS
- `run-ranking.js`: `node --check` PASS
- `sw.js`: `node --check` PASS
- CSS parse errors: 0
- Literal HTML local refs missing: 0
- MACHINE CARD: 9 / 9 present
- complete car preview: 9 / 9 present
- front/rear wheel pairs: 8 / 8 non-secret machines present
- ranking endpoint: unchanged
- `STORE_KEY = asoboonBoonrun.v1`: unchanged
- `JUMP_STORE_KEY = asoboonBoonjump.v2`: unchanged
- internal machine IDs: unchanged

## Viewport geometry audit
The responsive MACHINE CARD geometry was checked against the following landscape CSS viewports. Card width/height remains within the calculated feature area in all cases.

- 568 x 320 — PASS
- 667 x 375 — PASS
- 740 x 360 — PASS
- 844 x 390 — PASS
- 852 x 393 — PASS
- 874 x 402 — PASS
- 932 x 430 — PASS
- 1024 x 768 — PASS

## Runtime file count
- v1.0.34 BOONRUN: 94 files
- v1.0.35 BOONRUN: 96 files (9th card + this QA report; existing 8 card files were replaced)
- still below the 100-file manual-upload threshold

## Gameplay regression protection
`game.bundle.js` differs from v1.0.34 only in:
- build/client version strings
- MACHINE CARD image load/fallback state handling

Physics, 55-course generation, CRITICAL, ULTIMATE, Valkyrie balance, ranking submission payload and run logic are not changed by this size fix.

## Remaining check
Final visual confirmation should still be done once on the actual LINE in-app browser/device used for production, because browser chrome and safe-area behavior can differ slightly by device/OS.
