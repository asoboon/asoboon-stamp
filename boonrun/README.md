# BOON RUN 2 — v1.2.3 RC7 100-POINT FLOW POLISH

Runtime: `1.2.3-rc7`  
Build: `2026-08-15-rc7-v1.2.3-100point-polish`

## RC7 — final flow polish

- HOME shows the next WORLD / distance target.
- First-drive guidance appears once per machine; learned machines start immediately.
- DISTANCE keeps the current WORLD code visible between milestone flashes.
- RESULT prioritizes same-machine retry over ranking registration.
- Reached WORLD and the next journey target are surfaced in the result story.
- Highway-board messages use a small priority queue so high-value BEST / WORLD / ULTIMATE information wins over stale guidance.
- RC6 compact-phone MACHINE / RECORDS layout selectors are now correctly wired to their buttons.

These changes are presentation / flow only. Gameplay performance, course data, ranking payload and the existing save key are unchanged.

## Core idea

BOON RUN now treats distance as **a journey through changing road worlds**, not only a number. The player should feel that every section goes somewhere while obstacle readability stays stronger than scenery.

## WORLD DRIVE — 7 road worlds

1. `0–1 km` — **DAY HIGHWAY** / デイ・ハイウェイ  
   Soft hills, fields, utility lines, sparse roadside town.
2. `1–2 km` — **CITY APPROACH** / シティ・アプローチ  
   Tree line, growing skyline, distant overpass.
3. `2–3 km` — **METRO RING** / メトロ・リング  
   Denser skyline and elevated expressway silhouette.
4. `3–5 km` — **SUNSET EXPRESS** / サンセット・エクスプレス  
   Bay horizon, sunset palette, suspension bridge.
5. `5–7 km` — **NIGHT CITY** / ナイト・シティ  
   Lit high-rises, city glow, night road lighting.
6. `7–10 km` — **MIDNIGHT LOOP** / ミッドナイト・ループ  
   Deep-night skyline, elevated loop, distant expressway signs.
7. `10 km+` — **STARLIGHT EXPRESS** / スターライト・エクスプレス  
   Deep sky, denser stars, subtle aurora tone, distant beacon skyline.

World scene changes cross-fade over the first ~160 m of a new zone so the background does not pop abruptly.

## SECTION CLEAR × WORLD DRIVE

The existing 1 km SECTION CLEAR system now announces a new world when a world boundary is crossed. The banner shows the world name plus SELF BEST chase information. This remains presentation only and does not alter course difficulty, speed, ranking, fuel, or scoring.

## Background readability rules

- Far scenery uses slow parallax only.
- High-contrast objects are not placed in the active obstacle lane.
- City windows and lights remain subdued and behind hazards.
- Road markers remain intentionally long/sparse to avoid excessive optic flow.
- `prefers-reduced-motion` continues to suppress decorative motion such as stronger sky animation.
- Current v1.2.x uses authored `assets/world-drive/` FAR / MID / NEAR WebP art. The procedural Canvas renderer remains fallback-only when an authored image group is not ready.

## Existing v1.1.0 systems retained

### REPLAY DRIVE
- SELF BEST CHASE
- CRITICAL FLOW
- SECTION CLEAR
- RUN RESULT STORY
- DEATH COACH

### DRIVER SKILL
- RISK LINE
- CRITICAL FEEL
- 9-machine DRIVER MISSION

### MACHINE SELECT
- Finished MACHINE CARD is the visual hero.
- `1024:683`, `object-fit: contain`, no crop / no distortion.
- modern iPhone / compact landscape reflow.
- safe-area and >=44px primary tap targets.
- bright yellow-orange “遊び方” button.

## Protected gameplay

RC6 still does **not** intentionally change:

- 9 machine IDs
- 55 authored course patterns
- PHYSICS
- speed curve
- fuel model
- obstacle geometry or behavior
- CRITICAL judgement threshold
- Valkyrie MACH SYNC / DIVINE MACH conditions or performance
- any ULTIMATE performance
- ranking endpoint / submission payload schema
- save key `asoboonBoonrun.v1`

Static comparison against v1.1.0 confirms PHYSICS / CARS / SPECIALS / PATTERNS / `speedMultiplierAt()` / `effectiveFuelRate()` / `buildRunSubmission()` are byte-identical blocks.

## MACHINE SERIES contract

- **COMMON = who the machine is**
- **BOONJUMP = how it flies**
- **BOONRUN = how it drives**

Workflow B remains. COMMON identity bytes are not changed by WORLD DRIVE.

## WebP handoff

MACHINE CARD WebP assets are retained. Runtime car-part WebP work remains independent from WORLD DRIVE. Current WORLD DRIVE does add its own authored image dependency under `assets/world-drive/`; those background files do not change machine identity or gameplay performance.

## Release gate

Static/code/package QA is included. Final acceptance still requires a real landscape-device one-play smoke test in iPhone/Android/LINE after the WebP handoff is merged.

## v1.2.0 DEV — WORLD DRIVE ASSET INTEGRATION

- Integrates `BOONRUN WORLD DRIVE BACKGROUND ASSET PACK v1.0` as lazy-loaded runtime art.
- Runtime path: `assets/world-drive/`.
- Seven worlds use authored FAR / MID / NEAR WebP panoramas; six boundary transition sets are used between worlds.
- WORLD07 blends to the supplied STARLIGHT LOOP after the ASOBOON TOWER pass.
- `world-drive-preview.html` is a QA-only distance scrubber for direct 0–14km visual inspection.
- Procedural WORLD DRIVE remains the fallback if art is missing or not ready.
- Gameplay, rankings and save schema are unchanged from the v1.1.1 base.

## v1.2.1 DEV — WORLD06 MIDNIGHT LOOP ART REVISION

WORLD06 art revision v1.1 has been applied without changing gameplay. Only `06-midnight-loop` runtime FAR/MID/NEAR and the `05-06` / `06-07` transition layers are replaced. WORLD01–05 and WORLD07 body art remain unchanged. Build/cache identifiers were bumped to avoid stale Service Worker art.


## v1.2.2 DEV — WORLD DRIVE FINAL QA

WORLD DRIVE v1.1 art is unchanged. This build finalizes the background runtime before device LOCK.

### Landmark-locked local parallax
- MID is the authored landmark track and stays exactly distance-locked.
- FAR / MID / NEAR representative depth rates: 5% / 13% / 30%.
- FAR / NEAR only drift between authored anchor distances and return to zero offset at every anchor.
- This keeps bridge/JCT/ferris-wheel/TOWER timing intact while adding true layer-relative motion.
- WORLD06 anchors explicitly include 9.2km, so the ASOBOON TOWER preview gate is not shifted by parallax.
- STARLIGHT LOOP remains continuous literal 5% / 13% / 30% scrolling.

### Runtime loading
- Current WORLD is kept resident.
- Transition art is prefetched before the boundary.
- Incoming WORLD is prefetched shortly before visibility.
- Outgoing WORLD is released after the midpoint.
- All 7 worlds are never intentionally kept resident together.

### Device acceptance still required
Check 05→06→07 continuously on iPhone / Android / LINE for FPS, memory, obstacle/fuel/drone visibility, CRITICAL/ULTIMATE competition, and eye fatigue.


## v1.2.3 RC1 — WORLD DRIVE

No art is changed in this build. It hardens the runtime discovered during final audit.

### Parallax continuity
- MID remains the authored landmark/distance truth.
- FAR / NEAR local offsets now use a smooth bump with zero offset **and zero relative-speed differential** at every authored anchor.
- This removes a possible micro-jerk at 0.6 / 1.6 / 2.6 / 3.5 / 4.0 / 4.5 / 6.0 / 6.6 / 8.0 / 9.0 / 9.2 / 9.6 / 10.0km checkpoints.
- Reduced-motion users receive weaker local parallax; STARLIGHT LOOP aligns all layers to MID speed.

### Memory / loading
- WORLD boundaries use a two-decoded-group handoff instead of retaining outgoing WORLD + transition + incoming WORLD simultaneously.
- Incoming compressed bytes are warmed before handoff.
- WORLD01 is warmed while the player is on the menu and its three WebPs are part of SW CORE.
- A v1.2.2 issue that recreated finite `world:07` after the STARLIGHT LOOP takeover is fixed. After 12.12km only `loop:07` remains intentionally resident.

### QA status before real-device acceptance
- Static/package audit: PASS. JS/SW syntax, asset references, image dimensions, manifest references, duplicate HTML IDs, and Service Worker CORE references were rechecked.
- WORLD DRIVE runtime WebP identity: 42/42 runtime WebPs are byte-identical to the approved BACKGROUND ASSET PACK v1.1 source.
- Gameplay-contract comparison: PHYSICS / FUEL / CARS / PATTERNS / SPECIALS / `buildRunSubmission()` remain byte-identical to the pre-WORLD-DRIVE RUN base used for comparison; `run-ranking.js` is byte-identical to the current Drive root copy.
- Landmark-lock math: anchor phase error is 0; finite-layer progress is monotonic; the smooth local-parallax derivative returns effectively to 0 at authored anchors.
- Cache-policy logic: at most two decoded WORLD DRIVE groups are intentionally retained at boundaries; after 12.12km the finite WORLD07 group is released by policy and the STARLIGHT LOOP remains.
- Local Chromium execution is **not counted as PASS in this audit** because the available Chromium is blocked from local/file URLs by organization policy.
- Final acceptance therefore still requires iPhone Safari / iPhone LINE / Android Chrome / Android LINE device testing for actual FPS, memory pressure, rendering, visibility and comfort.

## v1.2.3 RC6 — whole-game balance polish

RC6 is a UI / flow / readability pass over the complete BOONRUN experience. It intentionally does not rebalance machine performance or course difficulty.

- HOME: height-driven landscape layout so all actions remain visible.
- HELP: compact rules apply by phone height, including wide 932px-class devices.
- MACHINE SELECT: RC5 finished-card-first presentation retained.
- RECORDS: compact landscape dashboard, 3×3 when width permits.
- GAME HUD: pre-start ULTIMATE / highway board are visually quieter.
- RESULT: retry, optional ranking registration, and all secondary actions fit normal landscape phone heights.
- RANKING: submission is explicit from RESULT; automatic end-of-run submission is disabled. Endpoint/session/payload and `run-ranking.js` are unchanged.
- WORLD DRIVE: v1.1 art and v1.2.3 background engine are unchanged.

Final LOCK still requires real-device smoke testing.
