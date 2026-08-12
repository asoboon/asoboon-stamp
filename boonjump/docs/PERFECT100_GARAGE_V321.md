# BOONJUMP v3.2.1 PERFECT 100 + BOON GARAGE

## Changes
- Added frame-rate independent PERFECT 100 capture for ACCEL / TURBO / NITRO.
- The meter position actually shown to the player is the value used for judgment.
- Continuous meters capture an exact target crossing for a short machine-specific hold.
- Existing SUPER / CRITICAL / GREAT / GOOD thresholds are unchanged.
- CARS definitions and gameplay balance values are unchanged from v3.2.0.
- Garage UI was aligned with BOON RUN's machine-selection UX: large machine card, rarity, selected state, handling, trait, JUMP BEST and tune level.
- Locked machine taps remain on the garage screen instead of forcing navigation to gacha.

## PERFECT 100 validation
Refresh rates: 60 / 90 / 120 Hz
Machines: 9
Inputs per machine: ACCEL / TURBO / NITRO
Base matrix: 81 cases
Frame-phase offsets tested per case: 24
Total sampled cases: 1,944
Result: PASS, 0 failures.

## Integrity
- CARS block identical to v3.2.0.
- 25 VFX WebP references present, 0 missing.
- index inline JavaScript syntax: PASS.
- ranking-client.js syntax: PASS.
- sw.js syntax: PASS.
