# BOONJUMP v3.2.6 — MACHINE CARD SHOWCASE QA

Date: 2026-08-13

## Scope
- Integrate the 9 supplied BOON SERIES finished MACHINE CARD artworks into MACHINE SELECT.
- Reuse the same artwork for single-gacha / 10-draw bonus reveal.
- Keep the pre-existing BOONJUMP selector order.
- Treat numbers printed inside card artwork as debut/history numbers only.
- Do not alter gameplay balance, timing motion, distance caps, rarity rates, tune, ranking keys, or save keys.

## Card asset map
- boon -> 01-boon-pickup.webp
- wagon -> 02-smart-wagon.webp
- buggy -> 03-lucky-buggy.webp
- bike -> 04-power-bike.webp
- sport -> 05-nitro-sport.webp
- ssr (Cosmic Phantom internal id) -> 06-cosmic-phantom.webp
- princess -> 07-princess-starliner.webp
- secret -> 08-secret-rocket.webp
- valkyrie -> 09-highway-valkyrie.webp

## Selector display order (unchanged)
1. boon
2. wagon
3. buggy
4. bike
5. sport
6. princess
7. ssr / Cosmic Phantom
8. valkyrie
9. secret

The printed card numbers therefore intentionally appear 01, 02, 03, 04, 05, 07, 06, 09, 08 in this selector order.

## Asset optimization
- 9 WebP cards
- 1024 x 683 each
- total: 2,093,828 bytes (~2.0 MiB)
- no front-load precache; card images use runtime image cache
- current + adjacent selector cards are preloaded on demand

## Regression protection
SHA256 comparison vs v3.2.5:
- CARS definition: identical
- motionValue: identical
- nitroMotion: identical
- timingPrecision: identical

Therefore ACCEL/TURBO/NITRO behavior and the existing PERFECT-100 logic were not changed.

## Static checks
- index inline JS: syntax PASS
- ranking-client.js: syntax PASS
- sw.js: syntax PASS
- MACHINE CARD assets: 9 / 9 present
- existing VFX WebP assets: 25 preserved
- Service Worker image runtime cache expanded to /assets/cards/

## UI changes
- MACHINE SELECT hero is now the finished 3:2 MACHINE CARD artwork.
- Locked machine: card is darkened with a lock overlay.
- Selected machine: small external selected badge; card artwork is not covered by duplicate text.
- Duplicate card-level name/rarity/max-distance UI removed from hero.
- JUMP PROFILE below card now contains only BOONJUMP-specific information.
- Stats are JUMP BEST / MAX / TUNE.
- Intro copy was simplified for children.
- Gacha reveal now presents the same MACHINE CARD artwork after the draw settles.
