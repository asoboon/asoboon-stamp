# ASOQUEST v7 — WebP layer staging

This directory is a non-production staging lane. Existing /asoquest/ remains untouched.

## Goal
Replace the code-drawn car with aligned transparent WebP layers made from the approved original car artwork.

## Required assets (all 800x600 transparent WebP)
Reuse the byte-identical canonical pack under ../asoquest/assets/.
- car_base.webp
- wheel_front.webp
- wheel_rear.webp
- headlight.webp
- grille.webp
- fin.webp
- engine_fx.webp
- key_fx.webp
- complete_fx.webp

All files MUST share the same canvas and coordinate system.

## Part mapping
- ENGINE -> engine_fx acquisition animation
- WHEEL -> wheel_front + wheel_rear
- HEADLIGHT -> headlight
- FIN -> fin
- GRILLE -> grille
- KEY -> key_fx acquisition animation
- 6/6 -> complete_fx
- ENGINE START after 6/6 -> complete FX + clear overlay

No manufacturer logo, crest, emblem or model badge should be added.

## Staging URL
https://asoboon.github.io/asoboon-stamp/miniapp-v2/production/asoquest-v7/

## Staging LINE URL
https://miniapp.line.me/2009884613-ELc6kolf/asoquest-v7/

After visual QA, migrate v7 into /asoquest/ and update NFC/QR station URLs to the final path.
