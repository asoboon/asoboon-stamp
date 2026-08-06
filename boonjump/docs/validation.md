# V2.1.4 Validation

Build: `2026-08-06-exhilaration-wheel-v5`

## Static checks
- JavaScript syntax: PASS
- Wheel body layers: 7 vehicles, front/rear present
- Canvas wheel assets: 7 vehicles, front/rear present
- Secret rocket body asset: present
- Tachometer 14時方向説明: removed
- Tachometer background red band: removed by final CSS override
- How-to screen/button: absent
- Game balance constants: unchanged from V2.1.3

## Visual intent
- Precise wheel centers are defined against 760×280 source coordinates.
- Wheels rotate in the preflight vehicle renderer and flight canvas.
- Launch, judgment, nitro, landing, and result effects were strengthened without changing scoring.
