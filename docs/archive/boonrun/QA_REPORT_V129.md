# BOONRUN v1.0.29 QA REPORT — RANKING POLISH

Build: `2026-08-12-playable-v1.0.29-ranking-polish`  
Client: `1.0.29`

## Purpose
Polish the ranking experience after v1.0.28 without changing gameplay balance.

## UI / UX changes

### 1. WORLD TOP100 is a true single-column vertical list
The right ranking panel is explicitly locked to:
- `overflow-y: auto`
- `overflow-x: hidden`
- `flex-direction: column`
- `touch-action: pan-y`

The intended landscape structure is preserved:
- left: YOUR BEST / ranking navigation
- right: WORLD TOP100 vertical scroll
- no horizontal ranking navigation

### 2. Machine ranking is easier to identify and tap
The 8-machine picker now uses:
- real local vehicle artwork instead of emoji-only identification
- full-tile tap targets
- machine name
- local `MY BEST`
- explicit `ランキングを見る` action copy
- selected-machine styling

When a machine ranking is active, the sidebar selector also shows the real machine thumbnail and the separate `🌍 総合ランキングへ戻る` action remains visible.

### 3. Ranking rows are cleaner
- full-width rows
- TOP1 / TOP2 / TOP3 retained and strengthened
- own row remains highlighted and now has a compact `YOU` badge
- overall ranking shows the machine identity
- machine-specific ranking does not repeat the same machine label on every row

### 4. Scope changes reset only the ranking scroll
Changing period or machine resets the right list to the top. Refreshing the same scope does not forcibly change navigation structure.

## Response / cache polish

### 1. Backend health validation cache
A successful `run_health` validation is cached locally for 1 hour.

This avoids a repeated health round-trip before leaderboard calls when the exact expected API / RUN DB were already validated recently.

Validation still checks:
- RUN API `1.1.0`
- RUN DB `1y0WU_DB4huHELEtTbuoAjhZtomP7nd6af7LicNUF7ro`

A mismatched or expired health cache is ignored and a real health check is performed again.

### 2. Period warming after the user opens a scope
Startup still warms only the default `all / overall / TOP100` board.

After the user actually opens a ranking scope, the other two periods for that same scope are warmed quietly in sequence.

Examples:
- open overall / 歴代 → 今日 and 今週 are warmed
- select sport / 歴代 → sport 今日 and sport 今週 are warmed

This keeps the v1.0.28 fix that removed the heavy 11-board startup dashboard prefetch, while making period switching during an active ranking session faster.

### 3. Existing protections retained
- stale-while-refresh cached paint
- in-flight request dedupe
- stale-request sequence guard
- explicit retry on first-load failure
- score submission clears all leaderboard caches
- score submission also clears the period-warm state

## Ranking transport harness
Node VM harness results:

1. Cold health cache:
   - `run_health`
   - then `run_leaderboard`
   - PASS

2. Valid 1-hour health cache:
   - `run_leaderboard` only
   - PASS

## Chromium UI fixture
A local-data fixture using the production CSS was rendered in headless Chromium because direct localhost navigation is blocked by administrator policy in this environment.

### 844 × 390 landscape
Ranking list:
- client height: `223px`
- scroll height: `4726px`
- client width: `578px`
- scroll width: `578px`
- overflow-y: `auto`
- overflow-x: `hidden`
- display: `flex`
- flex-direction: `column`

Machine ranking control:
- main machine button height: `52px`
- machine picker tile: approx `196 × 96px`
- close button: `44 × 44px`

### 932 × 430 landscape
Ranking list:
- client height: `235px`
- scroll height: `6030px`
- client width: `636px`
- scroll width: `636px`
- overflow-y: `auto`
- overflow-x: `hidden`

Machine ranking control:
- main machine button height: `68px`
- machine picker tile: approx `212 × 96px`
- close button: `44 × 44px`

Result: **vertical scrolling only, no horizontal overflow in the tested fixtures.**

## Gameplay protection
Compared with v1.0.28:

- pre-BUILD production core: byte-identical
- `makeDefaultState` through ranking boundary: byte-identical
- SPECIALS data: byte-identical
- 55 authored patterns retained
- 8 SPECIAL definitions retained
- Valkyrie gameplay refs: 0

Protected SHA256:
- pre-BUILD production core: `16102b8ac9843179faa793ac4678973432842bae2ada0fd47f0693686f7a2a77`
- state/UI/gameplay through ranking boundary: `3c393d54f56d03f8c4132b00f8abcfc9e007586b570bd95cca2b2907fdd41447`
- SPECIALS data block: `a7c5d81c0243ee08fe4e70a7971abdc61ffaf3814a47e951782cd24a79dc35fa`

No physics, car performance, fuel, authored course pattern, difficulty curve, Emergency Ultimate behavior, or SPECIAL definition was changed.

## Static QA
- `node --check game.bundle.js`: PASS
- `node --check run-ranking.js`: PASS
- `node --check sw.js`: PASS
- CSS parser errors: 0
- duplicate HTML IDs: 0
- missing local HTML refs: 0
- authored pattern IDs: 55
- SPECIAL definitions: 8
- Valkyrie refs in RUN gameplay bundle: 0
- v1.0.29 service-worker cache marker: PASS

## Backend / GAS
- endpoint unchanged
- API contract unchanged
- Apps Script code unchanged
- **GAS redeploy is not required**

## Final file SHA256
- `game.bundle.js`: `0d7d04aa95c73873c1eef79c22895320ccd2480544328f220a1fd6c3a80948cf`
- `run-ranking.js`: `ee5b2eb87e4d446af5979a5efe5b9bf2abbd5b2b3d1c44cd21ae94b98d4720e2`
- `style.css`: `eebdb024e6b08b519c34edfdcb1e8b37e22023030bfcc04eae7576c99653c4f9`
- `index.html`: `153af69177b2dccb7c5cce4b856948921af32ff2ac4c0ce9468b935d9077c5be`
- `sw.js`: `c29c31e970b0125943d492f672f906f6dcf52faea63dbbb326a4e617bcbf4bfe`
- `manifest.webmanifest`: `bc5bac8ecc937aca6d2e2d4d762a360856bf72a0e276d6eb989a7b2103b3c6bf`

## Runtime limitation
No real iPhone / Android / LINE in-app-browser test was performed in this environment. Direct localhost app navigation is blocked by administrator policy, so browser geometry was validated with an inline production-CSS fixture instead.
