# BOONRUN v1.0.27 QA REPORT — RANKING SPEED & UX
Build: `2026-08-12-playable-v1.0.27-ranking-speed-ux`  
Client: `1.0.27`

## Purpose
Improve ranking responsiveness and make machine-specific rankings obvious and easy to tap without changing gameplay balance.

## Implemented
- Instant cached paint via `peekLeaderboard()` before network refresh.
- Idle `run_dashboard` prefetch to warm overall boards and all-time machine previews.
- 45s fresh client cache / 15min stale fallback.
- Same in-flight leaderboard request deduplication.
- Request sequence guard so fast period/machine switching cannot let an older response overwrite the latest view.
- Manual `↻ 最新` refresh button.
- Tiny machine `<select>` removed.
- Large 8-machine picker added; each machine is a dedicated tap target.
- Explicit `← 総合ランキングへ戻る` button when viewing a machine board.
- Machine picker closes immediately after selection and loads that board.
- WORLD board remains landscape + vertical scroll.
- Previous render bug corrected: TOP100 request was being sliced to 10 rows in the renderer. v1.0.27 renders up to 100 rows.
- SECRET remains machine-only and excluded from normal overall ranking.

## Backend / GAS
- GAS endpoint and API contract unchanged (`RUN API 1.1.0`, GAS V2.6.0 expected).
- No GAS redeploy required.
- `run-ranking.js` frontend transport changed only to add cache/prefetch/dedupe behavior.

## Gameplay protection
Compared with v1.0.26:
- Course / cars / patterns before `const BUILD`: byte-identical.
- Game configuration after version constants: byte-identical.
- Runtime gameplay section including Emergency Ultimate through the ranking boundary: byte-identical.
- 55 authored patterns retained.
- 8 ranked machines retained.
- 8 SPECIAL definitions retained.
- Valkyrie gameplay/ranking references: 0.

Protected segment hashes carried unchanged from v1.0.26:
- course+cars+patterns: `16102b8ac9843179faa793ac4678973432842bae2ada0fd47f0693686f7a2a77`
- game config: `899c304b8c87072cb5a3acb0fbacc80b84cfb69ab42e2c825991b831e4ad2307`
- gameplay/runtime incl. Emergency Ultimate: `85d7f8f98046621c60cbaf3c9e3639a9537c147af9516371bf5ffedfd40fae92`

## Static QA
- `node --check game.bundle.js`: PASS
- `node --check run-ranking.js`: PASS
- `node --check sw.js`: PASS
- CSS parse errors (tinycss2): 0
- Duplicate HTML IDs: 0
- Missing local HTML refs: 0
- Ranking picker required IDs: PASS
- Old `rankingMachineSelect` references: 0
- TOP100 renderer marker: PASS
- Client cache marker: PASS
- Dashboard prefetch marker: PASS
- In-flight dedupe marker: PASS
- stale-response request-sequence guard: PASS

## Cache harness
A Node mock JSONP harness verified:
1. dashboard prefetch seeds instant overall cache,
2. partial dashboard cache does not block a full TOP100 fetch,
3. a fresh full cache reopens without another network request,
4. duplicate simultaneous leaderboard requests are deduplicated,
5. invalidation clears the selected cached board.

Result: **PASS**.

## Final file SHA256
- `game.bundle.js`: `b776ac2162441534507f1a1cf8a4e88092d6eaa8a132c018f7be5bb692e1377b`
- `run-ranking.js`: `6cd21fb2686239465b303b6d853f56d2ac768b920069399e59d0d8d9557229bf`
- `style.css`: `0b8d3c1060cf1b5b41630a931353f8142e31afed763ff9c92dcd934923635542`
- `index.html`: `f089dabec366c3ba866d729d1fa5b9873fd733b0bf86fa4bda5f6766c935db3b`
- `sw.js`: `a49605332cc1676a0767a7713853313b2c46b7ac3bfeb734482b861b51b0a3df`

## Service worker
- Cache: `boonrun-20260812-v127rankingux`
- HTML/CSS/JS queries: `?v=20260812-v127rankingux`

## Runtime limitation
A Chromium visual automation attempt was made, but this environment blocks local/file navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`. Therefore this report does **not** claim real iPhone/Android/LINE or browser-rendering validation. Static, syntax, cache harness, diff and ZIP validation are the QA basis for this build.
