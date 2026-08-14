# BOON RUN 2 — v1.1.1

Runtime: `1.1.1`  
Build: `2026-08-14-playable-v1.1.1-webp-publication`

## Core idea

BOON RUN is moving from “just avoid obstacles” toward **skillful driving where the player can feel improvement every run**.

### REPLAY DRIVE

- **SELF BEST CHASE** — shows the remaining distance to the selected machine's best and celebrates NEW BEST RUN.
- **CRITICAL FLOW** — rewards consecutive CRITICALs with visible flow feedback only; no performance/ranking multiplier.
- **SECTION CLEAR** — 1 km milestones become clearer section achievements.
- **RUN RESULT STORY** — result badges summarize what kind of run the player just had.
- **DEATH COACH** — one short cause-specific tip points directly to the next attempt.

### DRIVER SKILL

- **RISK LINE** — an inner precision feedback zone inside the existing CRITICAL interaction. It does not widen or change CRITICAL judgement.
- **CRITICAL FEEL** — short visual/audio/haptic feedback without slowing physics or changing game time.
- **DRIVER MISSION** — one machine-specific skill objective for each of the 9 machines.

## 9 current machine IDs

`boon, wagon, buggy, bike, sport, ssr, princess, valkyrie, secret`

`ssr` = Cosmic Phantom. Legacy `suv` is forbidden as a machine ID.

## MACHINE SELECT

- Finished MACHINE CARD remains the visual hero.
- Authoritative card ratio is `1024:683` and uses `object-fit: contain`.
- No crop / no distortion.
- Modern iPhone / short landscape widths reflow to a horizontal machine strip + large card + RUN profile instead of simply shrinking the card.
- safe-area and >=44px primary tap targets are preserved.
- “遊び方” uses a brighter yellow-orange treatment so it reads as interactive without overpowering START.

## Protected gameplay

v1.1.0 does **not** intentionally change:

- 9 machine IDs
- 55 authored course patterns
- car physics / speed / fuel / hitboxes
- obstacle geometry or behavior
- CRITICAL judgement threshold
- Valkyrie MACH SYNC / DIVINE MACH performance
- any ULTIMATE performance
- ranking endpoint / payload schema
- save key `asoboonBoonrun.v1`

## MACHINE SERIES contract

- **COMMON = who the machine is**
- **BOONJUMP = how it flies**
- **BOONRUN = how it drives**

Workflow B is retained. COMMON identity assets are not rewritten for RUN-specific display needs.

## WebP publication

- MACHINE CARD WebP bytes remain unchanged.
- Runtime complete-car WebP derivatives: 9/9.
- Runtime body WebP derivatives: 8/9; SECRET body intentionally keeps PNG because it is already smaller.
- WebP is preferred at runtime, with PNG retained as fallback/source.
- wheel / shadow / boost remain PNG because they are already small and/or runtime-position-sensitive.
- COMMON identity bytes are not rewritten by this RUN publication pass.

## Release gate

Static/code/package checks must pass before publication. Final visual/touch acceptance still requires at least one real landscape phone run in LINE/iPhone/Android because this environment cannot claim a physical-device test.
