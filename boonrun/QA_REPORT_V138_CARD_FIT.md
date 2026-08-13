# BOON RUN v1.0.38 DEV — MACHINE CARD TRUE FIT QA

## Scope
MACHINE SELECT layout only. Google Drive production runtime was not edited by this package work.

## Root cause
- v1.0.35 used viewport-based card width formulas.
- v1.1 later forced 44px tap targets and taller header/rail rows.
- Those two sizing systems competed on short landscape screens.
- Modern iPhone landscape widths above 760px (812/844/852/932 class) still used the 3-column rail/card/info layout, making the finished MACHINE CARD look unnaturally small.

## Fix
- Added `fitGarageCard()` using the actual rendered feature-box width/height.
- Preserves exact 1024:683 MACHINE CARD ratio.
- Re-fits on resize, orientation change, and ResizeObserver changes.
- Expanded compact top-strip layout through 1180px landscape widths.
- Preserved 44px navigation and primary CTA targets.
- No crop, no distortion, no COMMON asset edits.

## Static QA
- `node --check game.bundle.js`: PASS
- `node --check sw.js`: PASS
- 1024:683 ratio rule: PASS
- measured card-fit function present: PASS
- <=1180px landscape reflow present: PASS
- 44px CTA/navigation target retained: PASS

## Gameplay unchanged
- 9 machine IDs
- 55 course patterns
- jump physics / hitboxes / speed / fuel
- CRITICAL judgement
- MACH SYNC / DIVINE MACH
- ULTIMATE performance
- ranking endpoint / payload schema / save key

## Release status
DEV only. Requires final real-device visual smoke test before promotion.
