# BOONRUN WORLD DRIVE BACKGROUND ASSET PACK v1.0

- Machine faces right; backgrounds scroll right-to-left.
- FAR 4–6%, MID 10–16%, NEAR 25–35%.
- MID/NEAR are alpha layers and should remain behind gameplay objects.
- Player road is rendered by the game; background art is scenery beyond the play road.
- World boundaries use transition/<from-to>/ FAR/MID/NEAR over roughly 160m.
- WORLD07 uses loop assets only after the ASOBOON TOWER pass.

Visibility priority: Machine > Obstacles > Fuel > Drone > CRITICAL/ULTIMATE > Background.

WORLD04 timing: 3.0 late afternoon / 3.5 golden hour / 4.0 sunset peak / 4.5 blue hour / 5.0 nearly night / 5.16 NIGHT CITY.

Rare events (airplane, fireworks, meteor, helicopter, rainbow, full moon, train, special clouds) are NOT baked into these masters.

## BOONRUN standalone runtime note
- This standalone BOONRUN DEV package contains runtime WebP only; CLEAN MASTER PNGs remain in the external art-source pack on Drive.
- `manifest.json` is the runtime-safe manifest. `manifest.source.json` preserves the original art-pack manifest for audit/reference.
- The game lazy-loads only the current/transition/next background groups as needed; it does not preload all seven worlds.

## WORLD06 ART REVISION v1.1
- WORLD03の夜化ではなく、巨大多層JCTを主役とする深夜高速へ全面再制作。
- WORLD05より低光量・深い紺・暖色灯少量。
- 7km入口 → 8km巨大JCT → 9kmJCT内部 → 9.2km以降ASOBOON TOWER予告。
- transition/05-06 と transition/06-07 も v1.1 に差し替え。
