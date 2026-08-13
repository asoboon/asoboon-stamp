HIGHWAY VALKYRIE VFX CONTRACT — v3.1.0 ART SOURCE INTEGRATION

Source basis:
ASOBOON_MACHINE_LIBRARY/02_GAME_ASSETS/BOONJUMP/VFX/08_valkyrie/

Integrated source-derived assets:
- wing-rear.webp   <- valkyrie-wing-rear-vfx-candidate-v01.png
- wing-front.webp  <- valkyrie-twin-wing-vfx-candidate-v01.png
- mach-cone.webp   <- valkyrie-mach-cone-vfx-candidate-v01.png
- rune-halo.webp   <- valkyrie-divine-gate-vfx-candidate-v01.png
- sonic-trail.webp <- valkyrie-sonic-trail-vfx-candidate-v01.png

Important:
The supplied library did NOT contain an independent final divine-aura/world-pressure image.
Therefore this build does not invent one. Existing Canvas/world treatment remains as the fallback/support layer.

Awakening phases use REAL screen time:
- BREAK     0.00-0.15s
- ASCEND    0.15-0.55s
- AWAKENED  0.55s-landing
- LANDING   ~0.42s

ASCEND reveal order:
wing-rear -> wing-front -> mach-cone -> rune-halo
sonic-trail supports the pressure/speed state behind the vehicle.

Runtime parameters remain independent:
wingAlpha, runeAlpha, machConeAlpha, worldFxAlpha, screenFxAlpha, trailIntensity

Layer contract:
BACKGROUND WORLD FX -> REAR VFX -> VEHICLE -> FRONT VFX -> SCREEN FX -> HUD

Fallback:
If required Valkyrie art fails to load, the Canvas fallback remains available.
