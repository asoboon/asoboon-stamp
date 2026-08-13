# BOON RUN v1.0.23 — RANKING SCROLL / QA

Build: `2026-08-11-playable-v1.0.23-ranking-scroll`  
Client: `1.0.23`

## UX change
- Overall WORLD ranking remains the primary ranking view.
- Right pane changed from horizontal 1–5 / 6–10 layout to **one-column vertical scrolling**.
- Leaderboard request increased from TOP10 to **TOP100** (backend client already supports a limit up to the configured leaderboard cap).
- Each row keeps rank, player name, machine badge/name, and distance at readable sizes.
- TOP1 / TOP2 / TOP3 styling retained.
- Current player's row highlighting retained when it is present in the returned list.
- Left sidebar remains dedicated to YOUR BEST / world rank and machine-ranking drill-down.
- Machine ranking remains secondary and also uses the scrollable TOP100 board.
- Vertical touch panning and contained overscroll are explicitly enabled for the board.

## Regression protection
- `run-ranking.js` is byte-for-byte identical to v1.0.22.
- `game.bundle.js` diff versus v1.0.22 contains only:
  1. build/client version bump,
  2. TOP10 -> TOP100 labels,
  3. leaderboard request limit 10 -> 100.
- Therefore course generation, physics, vehicle stats, fuel, obstacle sizes, specials, and the v1.0.20 3K BREAKTHROUGH balance are unchanged.
- BOONJUMP body + rear-wheel + front-wheel visual sync remains intact.
- Valkyrie remains excluded from BOONRUN.

## Static QA performed
- `node --check game.bundle.js` — PASS
- `node --check run-ranking.js` — PASS
- `node --check sw.js` — PASS
- HTML duplicate IDs — 0
- Local index asset references — PASS
- CSS brace balance — PASS
- Ranking request limit = 100 — PASS
- Vertical board rules (`overflow-y`, `pan-y`, no horizontal overflow) — PASS
- Non-target files compared with v1.0.22 — unchanged
- Service Worker cache bumped to `boonrun-20260811-v123rankingscroll`

## Note
This is code/static QA in the available environment. It is not a claim of an iPhone/Android real-device touch test. Final feel should be confirmed on the deployed landscape phone view.
