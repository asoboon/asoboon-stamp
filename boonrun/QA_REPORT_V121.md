# BOON RUN v1.0.21 — WHEEL SYNC FIX / FINAL QA

Build: `2026-08-11-playable-v1.0.21-wheel-sync-fix`

## Root cause
v1.0.19/v1.0.20 synced only `../boonjump/assets/cars/{id}-body.png`. The current BOONJUMP renderer separates car body and wheels. Its gameplay renderer loads `{alias}-body.png`, `{alias}-rear-wheel.png`, and `{alias}-front-wheel.png`, then places the wheel images using per-car wheel coordinates. RUN therefore displayed the newest body without the newest wheels.

## Fix
- RUN now loads BOONJUMP `body + rear-wheel + front-wheel` for every normal synced vehicle.
- Wheel placement uses the same 760×280 wheel coordinates as BOONJUMP.
- Wheels rotate visually from RUN distance; this is rendering-only and does not affect physics.
- Home / garage / record previews are composited from the same multipart assets.
- If body OR either wheel is unavailable, RUN uses its local complete car artwork, so a vehicle can never become wheel-less because of a partial asset load.
- SECRET remains body-only, intentionally.
- Valkyrie remains excluded.

## Balance integrity
Identical to v1.0.20 `3K BREAKTHROUGH`:
- PHYSICS unchanged.
- carPhysics / handling unchanged.
- obstacle geometry unchanged.
- CRATE remains 34×138.
- all authored course patterns unchanged.
- distance difficulty curve unchanged.
- fuel economy / supply curve unchanged.
- all 8 SPECIAL effects unchanged.
- ranking payload and `run-ranking.js` unchanged.

## Static checks
- `game.bundle.js`: `node --check` PASS
- `run-ranking.js`: `node --check` PASS
- `sw.js`: `node --check` PASS
- SW cache bumped to `boonrun-20260811-v121wheelsyncfix`
- SW live-car network-first rule expanded to `body|rear-wheel|front-wheel`
- local complete wheel-bearing artwork retained for all normal RUN cars

## Source parity checked
BOONJUMP current build identifies itself as `2026-08-11-stability-princess-wheel-v9` and defines `ASSET_ROOT='./assets/cars'`. Its gameplay renderer explicitly loads `body`, `rear-wheel`, and `front-wheel` and uses per-car `WHEEL_LAYOUT` coordinates. RUN v1.0.21 mirrors that arrangement for the existing RUN roster only.

## Publish verdict
PASS. Publish v1.0.21 instead of v1.0.20.
