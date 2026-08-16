# ASOBooN SOUND SYSTEM — COMMON MASTER v1.2.1

This directory is the source of truth for sounds shared by BOONRUN and BOONJUMP.

## Architecture (Workflow B)
- `assets/audio/` = COMMON source of truth.
- `boonrun/assets/audio/` and `boonjump/assets/audio/` keep synchronized runtime copies.
- Game-specific sounds remain only in each game's `runtime/boonrun/` or `runtime/boonjump/` folder.
- Do not make BOONRUN/BOONJUMP load the repository-root COMMON files directly unless deployment architecture is deliberately redesigned and tested.

## Shared bytes
- Audio Manager: `asoboon-audio.js`
- COMMON SFX: `runtime/common/*.mp3` (14)
- MACHINE SIGNATURE: `runtime/machines/*.mp3` (9)

Run `sync-sound-assets.sh` after updating COMMON, then run `verify-sound-assets.sh` before release.
