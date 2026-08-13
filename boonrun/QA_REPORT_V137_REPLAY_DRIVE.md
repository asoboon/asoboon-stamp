# BOONRUN v1.0.37 DEV — REPLAY DRIVE QA

## Scope

Feedback-only gameplay polish based on v1.0.36.

## Implemented

1. SELF BEST CHASE
   - Per-machine best gap shown in HUD within 500m.
   - Crossing the old machine best produces a one-time reward cue.
   - No score multiplier or gameplay bonus.

2. CRITICAL FLOW
   - Visual streak window: 5.5s.
   - Tracks current/max visual flow only.
   - Does not alter CRITICAL judgement, total close_count, Valkyrie counter, Phantom counter, NITRO charge, or ranking payload.

3. SECTION CLEAR
   - Existing 1000m milestones receive a short center-screen presentation.
   - Milestone interval remains 1000m.

4. RUN RESULT STORY
   - Result badges for NEW BEST / FLOW / CRITICAL / ULTIMATE / RISK FUEL / distance.
   - No rewards or persistent unlocks added.

5. DEATH COACH
   - Cause-specific next-run advice for GAS, DRONE/LOWBEAM, PIT, CRATE, ROLLTIRE, ARCH, CONE/BARRIER.

## Static QA

- `node --check game.bundle.js`: PASS
- `node --check sw.js`: PASS
- HTML duplicate IDs: 0
- JavaScript `$()` DOM references missing from HTML: 0
- HTML local refs missing: 0
- Service Worker CORE refs missing: 0
- Runtime MACHINE CARD count: 9 / 9
- Runtime complete car fallback count: 9 / 9
- `suv-*` runtime files: 0

## Gameplay invariants compared with v1.0.36

- PHYSICS block: byte-equivalent
- ITEMS block: byte-equivalent
- FUEL_ZONES block: byte-equivalent
- FUEL_RULES block: byte-equivalent
- CARS block: byte-equivalent
- PATTERNS block: byte-equivalent
- SPECIALS block: byte-equivalent
- Pattern IDs: 55
- `buildRunSubmission()` function: unchanged
- save key: `asoboonBoonrun.v1`

## Browser QA

Headless Chromium smoke test could not be completed in the current container because Chromium did not terminate cleanly in this environment. Do not treat this as a browser PASS.

Before production:
- iPhone Safari landscape
- iPhone LINE landscape
- Android Chrome landscape
- Android LINE landscape
- short-height ~320px / 360px result modal fit
- 9-machine selection and one run each
- Valkyrie CRITICAL×3 / MACH SYNC / DIVINE MACH counters
- ranking session + submit
- save persistence
