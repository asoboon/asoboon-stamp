# ASOBooN MACHINE SERIES — COMMON UI DNA v1.1

This document defines shared **quality rules**, not shared CSS/JS implementation.
BOONJUMP and BOONRUN remain independently implemented.

## Principle

**Same machine identity, game-specific play information.**

- MACHINE CARD communicates who the machine is.
- JUMP PROFILE communicates how it flies.
- RUN PROFILE communicates how it runs.
- Do not duplicate information already legible inside the finished MACHINE CARD.

## MACHINE CARD

- Preserve the authoritative card artwork without crop or distortion.
- Current authoritative cards use a 3:2 design ratio (1024×683 runtime source is approximately 3:2); render with `object-fit: contain` or equivalent.
- Never stretch the card to arbitrary viewport ratios.
- Never modify the series number. It is introduction order, not game display order.
- Do not layer duplicate machine name / rarity badges over finished card art unless accessibility requires a non-visual label.
- Keep the card as the visual focal point in MACHINE SELECT.

## Responsive quality baseline

- Respect `env(safe-area-inset-*)` where controls can touch device edges.
- Primary tap/click targets: minimum 44×44 CSS px.
- On short viewports, reduce outer spacing before shrinking critical content.
- Avoid horizontal overflow.
- Preserve artwork aspect ratio before optimizing text density.
- Ensure the selected state is visible without relying on color alone.
- Locked state must remain identifiable without destroying card readability.

## Visual size consistency

- Judge apparent vehicle/card size, not only CSS width.
- Transparent padding in source art must not cause one machine to look dramatically smaller than another.
- Use per-machine display calibration only in game-specific UI when required; do not edit COMMON source bytes to compensate for one screen.

## SERIES PROFILE

### BOONJUMP
Display only JUMP-specific information below the common card, e.g.:
- ACCEL
- TURBO
- NITRO
- JUMP BEST
- MAX distance
- TUNE

### BOONRUN
Display only RUN-specific information below the common card, e.g.:
- driving style
- CRITICAL characteristic
- ULTIMATE
- RUN BEST
- game-specific difficulty

## Independence rule

Share the design standard, not the implementation file.
Do not create a single shared CSS/JS component whose change can unintentionally alter both games.
