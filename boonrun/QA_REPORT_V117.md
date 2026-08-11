# BOON RUN v1.0.17 QA REPORT

Build: `2026-08-11-playable-v1.0.17-crate-double-ultimate-xl`

## Changes audited
- CRATE: 34x124 -> 34x138 hitbox; visual 38x126 -> 38x140. Still smaller than the older 148px crate.
- Standard double-jump cars now require a second jump for CRATE.
- Buggy remains the intentional one-tap high-clear exception.
- Rocket remains hold/release control.
- Ultimate button enlarged, including short-height landscape phone media query.

## Crate physics check
Analytical peak check using the production PHYSICS constants and car profiles.
Princess is checked at the worst case, STAR x5 jump bonus (1.10x).

| car | 1-tap peak | 2-tap peak (second tap ~150ms) | crate 138px |
|---|---:|---:|---|
| boon | 90.4px | 212.5px | 1 tap BLOCK / 2 taps CLEAR |
| wagon | 131.7px | 206.6px | 1 tap BLOCK / 2 taps CLEAR |
| bike | 68.3px | 219.5px | 1 tap BLOCK / 2 taps CLEAR |
| sport | 131.4px | 204.9px | 1 tap BLOCK / 2 taps CLEAR |
| ssr | 133.0px | 198.5px | 1 tap BLOCK / 2 taps CLEAR |
| princess STAR5 | 133.9px | 223.3px | 1 tap BLOCK / 2 taps CLEAR |
| buggy | 254.3px | n/a | intended 1-tap CLEAR |

PASS: standard double-jump cars cannot clear CRATE with first jump peak alone.
PASS: standard double-jump cars clear CRATE with second jump.
PASS: buggy keeps its COMMIT one-jump identity.

## Regression checks
- `node --check game.bundle.js`: PASS
- `node --check run-ranking.js`: PASS
- Authored pattern definitions: 55 (unchanged count)
- Ranking client (`run-ranking.js`) is byte-for-byte unchanged from v1.0.16.
- Fuel zone definitions, SPECIAL definitions, ranking API URL/DB/API version were not intentionally changed in this patch.
- VERSION / service-worker cache / asset query versions updated to v1.0.17.

## Ultimate button size
- Base: 194 x >=94px (v1.0.16: 158 x >=76px)
- landscape <=900px: 178 x >=86px (v1.0.16: 138 x >=68px)
- short landscape <=390px high: 168 x >=80px (v1.0.16: 128 x >=62px)

## Scope / limitation
This QA is code-level/static plus targeted production-physics verification. It is not a claim of an iPhone/Android real-device run in this environment. Real-device game feel should be judged from the deployed build.
