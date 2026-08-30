# ASOBooN NEO MACHINE COMMON FOUNDATION

This directory is the one shared MACHINE ASSET root for **NEO BOONJUMP** and **NEO BOONRUN**.

## Contract

- One MACHINE identity source. Never create a JUMP copy and a RUN copy as separate canon.
- Physical GAME ASSET format is v2: `body.png + wheel.png + layout.json`.
- Shadow is procedural from `layout.json`.
- Dynamic VFX are game-owned and must not be baked into COMMON art.
- `assetKey` is the stable art/file key. It is not automatically a SAVE/ranking `machineId`.
- Existing machine IDs remain compatible. New four IDs stay `PENDING_LOCK` until explicit approval.

## Runtime ownership

COMMON owns: name, CATEGORY, COMMON/RARE, body, wheel, layout, card/identity art.

NEO BOONJUMP owns: jump controls, flight physics, distance, JUMP VFX, JUMP ranking/balance.

NEO BOONRUN owns: run physics, obstacles, fuel, CRITICAL, RUN ULTIMATE, RUN VFX, RUN ranking/balance.

## Current foundation state

`machine-registry.json` contains the normal 12-machine identity set.
`preview/` is a shared staff-only visual smoke asset derived from the 12 approved GAME ASSET implementation previews. Both NEO shells load this exact same preview source.

The production physical files must ultimately live only under:

`assets/neo-machines/source/<assetKey>/body.png`
`assets/neo-machines/source/<assetKey>/wheel.png`
`assets/neo-machines/source/<assetKey>/layout.json`

Do not place production machine art inside `neo-boonjump/` or `neo-boonrun/`.
