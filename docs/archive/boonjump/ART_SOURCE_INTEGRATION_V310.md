# BOONJUMP v3.1.0 — ART SOURCE INTEGRATION

## Source of truth used

This build was brushed up using the supplied `ASOBOON_MACHINE_LIBRARY`.
No MASTER DESIGN candidate was substituted for the current in-game side-view body because the library report explicitly classifies all nine MASTER images as candidates / non-final side-view references.

## Source-art VFX integrated

- Boon Pickup: 3 source-derived VFX
- Smart Wagon: 3
- Lucky Buggy: 3
- Power Bike: 0 (no independent source VFX supplied)
- Nitro Sports: 3
- Princess Starliner: 4
- Cosmic Phantom: 4 selected from 10 candidates to avoid visual overload
- Highway Valkyrie: 5
- Secret Rocket: 0 (no independent source VFX supplied)

Total integrated source-derived VFX: 25 WebP assets.

## Design rule

The source artwork becomes the hero layer only after the full asset set for that machine has loaded. Until then, the existing Canvas VFX remains the fallback. This prevents a half-loaded art set from mixing with procedural VFX.

When source-art awakening is active, procedural speed lines, trail, particles, generic aura and generic awakening geometry are reduced or suppressed so the artwork does not become a bright pile of overlapping effects.

## Source gaps intentionally not invented

The supplied library contains no independent BOONJUMP VFX for:

- Power Bike
- Secret Rocket

The supplied Valkyrie set also has no independent final `divine-aura/world-pressure` screen asset. The build therefore keeps existing procedural support rather than extracting or inventing an asset from a concept/reference sheet.

## Game logic protection

The complete `CARS` definition is byte-for-byte identical to v3.0.2.
No change was made to:

- gacha rates
- machine caps
- tune values
- control timings
- SUPER / CRITICAL thresholds
- ranking payload logic
- localStorage keys
- secret unlock rules

## Delivery status

This is an ART SOURCE INTEGRATION build. The VFX source files are still labeled `candidate` in the supplied library, so final art-direction approval can be done independently from the game-logic release decision.
