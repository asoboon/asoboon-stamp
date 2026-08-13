# ASOBooN Machine Asset Rules

This folder is the source of truth for ASOBooN MACHINE SERIES identity assets.

Formal contract: `00_SHARED_SPEC / ASOBooN MACHINE SERIES 共通仕様 v1.1`

## Principle

**COMMON = そのマシンが何者か**  
**BOONJUMP = そのマシンがどう飛ぶか**  
**BOONRUN = そのマシンがどう走るか**

Machine identity is common. Gameplay is independent.  
**Machine performance is never shared between BOONJUMP and BOONRUN.**

Use workflow B:

1. Keep authoritative machine identity assets here.
2. Sync only the files each game needs into `boonjump/assets/...` and `boonrun/assets/...`.
3. Uploading only `boonjump/` or only `boonrun/` must still work.
4. Run the verifier after every sync. A mismatch is a release-blocking failure.

Do not make BOONJUMP and BOONRUN load root common files at runtime unless the upload/deploy workflow is changed and tested.

## Machine registry

`assets/machines/machine-registry.json` is the machine-readable identity contract.

It contains only series identity information:

- internal machine ID
- series introduction number
- official Japanese name
- authoritative MACHINE CARD path
- authoritative COMMON part names

It must **not** contain JUMP/RUN gameplay performance, distance, speed, CRITICAL, ULTIMATE, AWAKENING, gacha rates, tune values, or ranking balance.

Valid internal IDs:

- `boon`
- `wagon`
- `buggy`
- `bike`
- `sport`
- `ssr`
- `princess`
- `valkyrie`
- `secret`

Do not add `suv` as a new machine ID. It was a legacy duplicate alias for `bike`.  
Do not rename `ssr` to `cosmic`; `ssr` is the established internal ID for コズミックファントム.

## Common Assets

Put an asset in `assets/machines/common/{machine}/` when it is part of the machine identity:

- `body.png`
- `front-wheel.png`
- `rear-wheel.png`
- `front.png`
- `rear.png`
- `shadow.png`
- `boost.png` only when it is the neutral machine exhaust/identity asset
- `complete.png`

SECRET currently has no runtime wheel pair; do not invent one merely to make the folder shape identical.

## Cards

`assets/machines/cards/` contains the authoritative MACHINE CARD files.

The number in each filename is the ASOBooN MACHINE SERIES introduction number. It is **not** the game display order, gacha order, save ID, ranking ID, or internal ID.

Current card map:

- `01-boon-pickup.webp` -> `boon`
- `02-smart-wagon.webp` -> `wagon`
- `03-lucky-buggy.webp` -> `buggy`
- `04-power-bike.webp` -> `bike`
- `05-nitro-sport.webp` -> `sport`
- `06-cosmic-phantom.webp` -> `ssr`
- `07-princess-starliner.webp` -> `princess`
- `08-secret-rocket.webp` -> `secret`
- `09-highway-valkyrie.webp` -> `valkyrie`

BOONJUMP keeps numbered runtime copies in `boonjump/assets/cards/`.  
BOONRUN keeps ID-named runtime copies in `boonrun/assets/cards/`.

## Verification

Run from repository root or directly from the script path:

```bash
bash assets/machines/verify-machine-assets.sh
```

The verifier checks:

- valid `machine-registry.json`
- exactly 9 unique machine IDs and series numbers 1–9
- COMMON source existence
- JUMP runtime copy existence and SHA-256 equality
- RUN runtime copy existence and SHA-256 equality
- all 9 MACHINE CARD copies and SHA-256 equality

**Any FAIL blocks release.**

`sync-machine-assets.sh` automatically calls the verifier after copying.

## COMMON UI DNA

Shared visual quality rules live in:

`assets/machines/COMMON_UI_DNA.md`

This is a quality contract, not a shared CSS/JS component.

Core rules:

- finished MACHINE CARD is the visual focal point
- preserve the card artwork ratio; no crop or distortion
- safe-area aware layout
- primary tap targets at least 44×44 CSS px
- reduce outer spacing before shrinking important content on short screens
- do not duplicate machine name/rarity over finished card art unnecessarily
- share design language, while JUMP/RUN implementation code remains independent

## SERIES PROFILE

The same COMMON card is used in both games, while the profile below it is game-specific.

### BOONJUMP PROFILE

Examples:

- ACCEL
- TURBO
- NITRO
- JUMP BEST
- MAX distance
- TUNE

### BOONRUN PROFILE

Examples:

- driving style
- CRITICAL characteristic
- ULTIMATE
- RUN BEST
- RUN-specific difficulty

## BOONJUMP Assets

Put jump-only gameplay assets in `boonjump/assets/`.

Examples:

- flight VFX
- AWAKENING VFX
- jump, landing, and air nitro effects
- BOONJUMP-only screen or world effects

Do not reuse BOONRUN VFX here.  
Do not put JUMP distance, physics, gacha, tune, ACCEL/TURBO/NITRO values into COMMON.

## BOONRUN Assets

Put run-only gameplay assets in `boonrun/assets/` or keep them in code when the current implementation draws them procedurally.

Examples:

- CRITICAL and ULTIMATE effects
- obstacles
- fuel
- drones
- road and tire-contact effects
- run nitro effects

Do not reuse BOONJUMP VFX here.  
Do not put RUN speed, jump physics, CRITICAL, ULTIMATE or obstacle balance values into COMMON.

## Keep Separate

Use `assets/machines/keep-separate/` for visually related but non-authoritative material:

- old run-only card illustrations
- thumbnails
- candidates needing design review
- derived art that should not overwrite the common identity

Nothing in `keep-separate/` should be referenced by runtime code unless it is intentionally promoted and documented.

## Update Workflow

1. Record the planned COMMON-impacting change in `RUN-JUMP 連携ログ`.
2. Ask the other game owner for input when the change can affect shared identity/UI standards.
3. Edit the authoritative file in `assets/machines/`.
4. Run `assets/machines/sync-machine-assets.sh` from the repository root.
5. Confirm `verify-machine-assets.sh` returns `RESULT: PASS`.
6. Update affected Service Worker cache names.
7. Check generated paths, manifests, CSS, Service Workers, and dynamic machine paths.
8. Start both games locally and verify HOME, MACHINE SELECT, card display, gameplay start, result, and ranking route.
9. Record implementation results and remaining risks in the coordination log.

Never change machine IDs, save keys, ranking keys, ranking endpoints, card numbers, gacha order, display order, or balance values as part of an asset-only update.
