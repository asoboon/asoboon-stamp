# BOON RUN v1.0.20 — 3K BREAKTHROUGH / BALANCE QA

Build: `2026-08-11-playable-v1.0.20-3k-breakthrough`

## Goal

Live-player feedback showed that no player had cleared 3,000m. v1.0.20 treats that as stronger evidence than theoretical solvability and removes the abrupt 3km difficulty cliff without flattening the endless endgame.

This release does **not** rebalance car stats, fuel economy, CRATE physics, SPECIAL abilities, ranking transport, or vehicle visuals. It changes only course pacing: speed progression, difficulty-band timing, hazard introduction timing, between-pattern recovery, and one learning-band anti-stack rule.

## Main balance changes

### Speed curve

The 2–6km band now accelerates more gradually while retaining the exact 1.65 cap at 20km+.

Key points (old -> new):

- 500m: 1.100 -> 1.050
- 1,000m: 1.150 -> 1.093
- 2,000m: 1.250 -> 1.156
- 3,000m: 1.317 -> 1.220  (-7.3%)
- 4,000m: 1.383 -> 1.280  (-7.5%)
- 5,000m: 1.450 -> 1.340  (-7.6%)
- 10,000m: 1.600 -> 1.560
- 20,000m+: 1.650 -> 1.650  (unchanged)

### Between-pattern breathing room

The old build tightened from 0.48s immediately to 0.38s at 3,000m. That cliff is removed.

- 2.5–3.5km: 0.62s
- 3.5–5km: 0.56s
- 5–7km: 0.50s for d1–3 / 0.62s for d4
- 7–10km: 0.46s for d1–3 / 0.58s for d4–5
- 20km+ d4–5: 0.55s, same as old endgame

Within-pattern timings are unchanged.

### Hazard introduction

- ROLLTIRE metadata unlock: 2,800m -> 3,600m
- ROLLTIRE authored patterns: 3,000m -> 3,800m (TRIPLE_GROUND begins at 3,600m)
- LOWBEAM metadata unlock: 2,600m -> 5,200m
- LOWBEAM authored patterns: 4,200m -> 5,600m
- ARCH metadata unlock: 4,300m -> 7,600m
- ARCH authored patterns: 6,500m -> 8,200m
- P054 DRONE_AIR_FUEL: 1,800m -> 3,000m
- P055 DRONE_CRATE: 2,400m -> 3,400m

### Difficulty bands

- 0–600m: d1
- 600–3,200m: d1–2
- 3,200–5,000m: d1–3
- 5,000–7,000m: d2–4
- 7,000–10,000m: d2–5
- 10,000–20,000m: d3–5
- 20,000m+: d4–5 (unchanged endgame)

Before 5,000m, a d3 pattern is also followed by an easier d1–2/REST candidate with a 72% bias when one is available. This prevents repeated d3 stacking during the learning band; it does not modify any pattern itself.

## Fixed-seed course-generation audit

A neutral, no-boost simulation using the production course seed and production selection/debt logic was run to compare where new difficulty first appears. Exact distances can shift slightly in real play due to vehicle speed multipliers / boost states, but the pacing direction is deterministic.

Old v1.0.19:
- first d3: ~3,311m
- first ROLLTIRE pattern: ~3,379m
- first d4: ~4,265m
- first d5: ~6,590m

New v1.0.20:
- first d3: ~3,630m
- first ROLLTIRE pattern: ~4,026m
- first d4: ~5,750m
- first d5: ~8,389m

This directly removes the observed ~3km multi-system spike while preserving progression afterward.

## Regression protection

Compared with v1.0.19:

- PHYSICS: unchanged
- CARS: unchanged
- FUEL_ZONES / FUEL_RULES: unchanged
- SPECIALS (8 one-shot ultimates): unchanged
- Pattern IDs / difficulty values / tags / event timings / event contents: unchanged
- Obstacle geometry and collision dimensions: unchanged
- CRATE remains 34 x 138px
- `run-ranking.js`: byte-for-byte unchanged
- `style.css`: byte-for-byte unchanged
- `manifest.webmanifest`: byte-for-byte unchanged
- BOON JUMP visual-sync behavior: preserved
- Valkyrie references in production RUN core: 0

Because car physics, obstacle geometry, and every authored pattern's event content/timing are unchanged, the v1.0.18/v1.0.19 660-case standard-car physical route validation remains applicable. v1.0.20 only moves when validated patterns can be selected and how much recovery space exists between them.

## Structural / static checks

- `node --check game.bundle.js`: PASS
- `node --check run-ranking.js`: PASS
- `node --check sw.js`: PASS
- Authored pattern count: 55
- Duplicate pattern IDs: 0
- Every pattern minM >= every obstacle unlock used by that pattern: PASS
- Duplicate HTML IDs: 0
- SPECIAL definitions: 8
- Valkyrie references: 0
- Service Worker cache: `boonrun-20260811-v1203kbreakthrough`
- Core query-string cache busters: v1.0.20

`../home.html` is intentionally a parent-repository link and is therefore absent only when BOON RUN is inspected as a standalone folder.

## Ranking / backend

No GAS change is required. Ranking endpoint, API compatibility, player identity, session creation, and submission schema are unchanged. The new slower midgame can only reduce the risk of a client exceeding the existing server distance-speed ceiling; it cannot create a false positive by being faster than the backend cap.

## Balance intent after v1.0.20

- ~0–3km: learn and build consistency
- ~3–5km: first real d3 decisions
- ~5–8km: midgame, moving/no-jump combinations begin to matter
- ~8–10km: full vocabulary including ARCH
- 10–20km: advanced execution / fuel routing
- 20km+: unchanged max-speed d4–5 endless band

Fuel remains distance-based and unchanged, so slowing the clock does not make the fuel economy easier per meter.

## Test limitation

This QA covers source diffing, static checks, structural course checks, exact configuration comparison, and fixed-seed generator simulation. It does not claim a fresh physical iPhone / Android / LINE in-app-browser playtest. The next important validation is real-player distance distribution after deployment: specifically whether multiple players begin clearing 3,000m without 5,000–8,000m becoming trivial.
