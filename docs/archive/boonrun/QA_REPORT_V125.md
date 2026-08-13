# BOONRUN v1.0.25 — MACHINE CARD POLISH QA

Build: `2026-08-11-playable-v1.0.25-machine-card-polish`  
Client: `1.0.25`

## Purpose
Polish only the MACHINE CARD SELECT experience introduced in v1.0.24. The target hierarchy is:

1. Card artwork
2. One-shot special move
3. Select & Start CTA

No game-balance rebalance is included.

## UI polish included
- Finished card artwork remains the visual hero; UI overlay darkness is reduced when real card art is present.
- ONE SHOT special panel gets stronger hierarchy and Japanese `1プレイ1回` visibility.
- `MACHINE 01..08` numbering added to the card face.
- Current selected machine receives a dedicated `SELECTED MACHINE` badge.
- Left catalog rail becomes more card-like.
- When `assets/cards/{id}.webp|png|jpg` exists, the left rail automatically uses that finished card art as its thumbnail.
- If card art is absent, the complete local/synced machine preview remains the fallback.
- Card-change foil sweep and subtle selection sound added; no gameplay effect.
- Short landscape layouts retain larger critical copy by hiding only secondary information.
- Empty owned-state helper copy is removed to reduce clutter.
- Card art remains text-free and hot-swappable.

## Static validation
- `node --check game.bundle.js`: PASS
- `node --check run-ranking.js`: PASS
- `node --check sw.js`: PASS
- CSS parse errors via tinycss2: 0
- Duplicate HTML IDs: 0
- Missing local index script/style references: 0
- Authored pattern IDs: 55 / 55 unique
- ONE SHOT SPECIAL definitions: 8 / 8
- MACHINE CARD presentation definitions: 8 / 8
- Valkyrie references in production HTML/CSS/JS: 0
- Card artwork version: `125`
- Service Worker cache: `boonrun-20260811-v125cardpolish`

## Balance protection
The entire production configuration prefix before `const BUILD` is byte-for-byte identical to v1.0.24.

This includes the authoritative physics/course configuration and all 55 authored patterns.

SHA256 of the unchanged prefix:
`16102b8ac9843179faa793ac4678973432842bae2ada0fd47f0693686f7a2a77`

A source diff from v1.0.24 to v1.0.25 shows changes only in:
- build/client/card-art version strings
- MACHINE CARD DOM references
- catalog thumbnail artwork loading
- card artwork-present UI state
- catalog presentation / status / selection sound

No jump physics, fuel, obstacle geometry, difficulty curve, vehicle performance, SPECIAL behavior, or ranking transport logic was changed.

Therefore the v1.0.20 3K BREAKTHROUGH balance remains intact.

## Ranking protection
`run-ranking.js` is byte-for-byte identical to v1.0.24.

SHA256:
`a32824f2f234549b95f31bbe425175807a2c3fa788b548d42de19d8b42858eaa`

No GAS redeploy is required for this UI release.

## Other unchanged artifact
`manifest.webmanifest` is byte-for-byte identical to v1.0.24.

SHA256:
`bc5bac8ecc937aca6d2e2d4d762a360856bf72a0e276d6eb989a7b2103b3c6bf`

## Browser-runtime limitation
A Chromium headless screenshot attempt was made in the build environment, but Chromium timed out with DBus/zygote environment errors. Therefore no claim is made that this new UI was visually verified on a real iPhone, Android device, LINE in-app browser, or a successful headless browser render.

Static/code/package QA is PASS; real-device visual feel remains the final acceptance step.
