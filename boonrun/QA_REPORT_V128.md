# BOONRUN v1.0.28 QA REPORT — DEBUGFIX

Build: `2026-08-12-playable-v1.0.28-debugfix`  
Client: `1.0.28`

## Purpose
Debug the v1.0.27 ranking-speed build without changing gameplay balance.

## Bugs / risks found in v1.0.27

### 1. Ranking prefetch was heavier than necessary
v1.0.27 called `run_dashboard` while idle. On a cold GAS cache, the backend implementation expands that one dashboard request into:
- 3 overall leaderboard calculations (`today`, `week`, `all`)
- 8 machine leaderboard calculations

That is **11 leaderboard reads/calculations** before the user necessarily opens ranking. Since each RUN leaderboard reads Google Sheets data, this could compete with the first real ranking request instead of accelerating it.

### Fix
v1.0.28 prefetches only the default `all / overall / TOP100` leaderboard. It starts ~280ms after boot. If the user opens ranking at the same time, the in-flight dedupe shares the same request instead of creating another one.

## 2. First-load ranking failure could leave the spinner forever
When there was no cached board and the network request failed, v1.0.27 updated only the status text. The main ranking list still contained the loading spinner.

### Fix
A dedicated ranking error state now replaces the spinner and shows a large `↻ もう一度読み込む` retry button.

## 3. Submission cache invalidation was incomplete
`invalidateLeaderboard()` previously cleared only cache keys already present in the current page's in-memory map. Ranking boards that existed only in `localStorage` and had not yet been opened in the current page could survive a score submission and briefly display stale data later.

### Fix
A full invalidation now clears every localStorage entry with the v1.0.28 ranking-cache prefix.

## 4. Machine picker had avoidable mobile rendering / tap risk
The full ranking picker used a large `backdrop-filter: blur(14px)`, which is expensive on mobile in-app browsers. On short landscape screens, the close button could shrink to 34px and machine tiles to about 51px.

### Fix
- Removed the full-panel backdrop blur.
- Close button is minimum 44×44px.
- Machine tile minimum heights are protected on small/short landscape screens.
- Machine picker closes when switching `今日 / 今週 / 歴代`.
- Escape closes the picker on keyboard-capable devices.

## 5. Refresh indicator animation was unreliable
The previous spinner attempted to animate `::first-letter`, which is not a reliable transform target across browsers.

### Fix
The refresh button now uses a dedicated animated pseudo-element while updating.

## Ranking cache harness
A Node VM harness verified:
1. v1.0.28 prefetch uses `run_leaderboard`, not `run_dashboard`.
2. Simultaneous prefetch + screen-open produces one leaderboard request via in-flight dedupe.
3. A fresh full TOP100 cache reopens with no network request.
4. Full invalidation removes untouched localStorage ranking caches.

Result: **PASS**.

## Gameplay protection
Compared with v1.0.27:
- Production core before `const BUILD`: byte-identical.
- `function makeDefaultState` through the ranking boundary: byte-identical.
- Emergency Ultimate implementation: byte-identical.
- World/game-loop segment: byte-identical.
- 55 authored patterns retained.
- 8 RUN cars retained.
- 8 SPECIAL definitions retained.
- Valkyrie gameplay refs: 0.

Protected SHA256 segments:
- pre-build production core: `16102b8ac9843179faa793ac4678973432842bae2ada0fd47f0693686f7a2a77`
- state/UI/gameplay through ranking boundary: `3c393d54f56d03f8c4132b00f8abcfc9e007586b570bd95cca2b2907fdd41447`
- Emergency Ultimate block: `617b22abef87e03b17b83109320ff0ef9e0543213fb154a31de3cb6732b958cb`
- world/game-loop block: `44110e5a50cfbd3633ee4137b4fa5c398b94b2b8c6063331608b017f876f0094`

## Static QA
- `node --check game.bundle.js`: PASS
- `node --check run-ranking.js`: PASS
- `node --check sw.js`: PASS
- CSS parse errors (`tinycss2`): 0
- Duplicate HTML IDs: 0
- Missing local HTML refs: 0
- Authored patterns: 55
- SPECIAL definitions: 8
- v1.0.28 index version query refs: 3
- v1.0.28 service-worker cache marker: PASS

## Backend / GAS
- Endpoint / contract unchanged.
- RUN API remains `1.1.0`.
- Expected RUN DB unchanged.
- **No GAS redeploy is required for v1.0.28.**
- `run_dashboard` remains available in `run-ranking.js`; it is simply no longer used as the startup prefetch path.

## Final file SHA256
- `game.bundle.js`: `2b731a5af9be2eb217fcd3b0cc4986b36d9e49ae86299cf79ae4e61a90c0ef91`
- `run-ranking.js`: `ea4bf38daa5991523d657cabb020c394cae10c62273e64c4f490990348562c95`
- `style.css`: `dd92042d88b93bd7b79acc96cf14486ec3bf9ce0d4f4081d3a2fb7ef301ceadc`
- `index.html`: `f53ddf34b11da58378b996f45eef97e2247bb0dd4d2237d8c53df9af02aa34e3`
- `sw.js`: `c67d57aa10b2fbc7e3f8cd21ed0b82a43270a688cf6c98aa526a420c5cde1577`
- `manifest.webmanifest`: `bc5bac8ecc937aca6d2e2d4d762a360856bf72a0e276d6eb989a7b2103b3c6bf`

## Service worker
Cache: `boonrun-20260812-v128debugfix`

HTML/CSS/JS query marker: `?v=20260812-v128debugfix`

## Runtime limitation
No real iPhone / Android / LINE in-app-browser test was performed in this environment. This build is validated by static checks, exact diff protection, CSS/HTML validation, cache harness, and final ZIP re-extraction checks.
