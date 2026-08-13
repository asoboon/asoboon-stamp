# BOONRUN v1.0.30 QA REPORT — FINAL POLISH

Build: `2026-08-12-playable-v1.0.30-final-polish`  
Client: `1.0.30`

## Purpose
Final production polish on top of v1.0.29 without touching the validated gameplay/balance layer.

The main user-visible change is the real ASOBooN MACHINE CARD artwork integration. The v1.0.29 ranking UX and v1.0.26 Emergency Ultimate behavior remain intact.

## MACHINE CARD final integration

### Runtime cards installed
Eight current BOONRUN machines now have final card artwork in `assets/cards/`:

- `boon.webp`
- `wagon.webp`
- `buggy.webp`
- `bike.webp`
- `sport.webp`
- `ssr.webp`
- `princess.webp`
- `secret.webp`

Main artwork spec after runtime optimization:
- 1280 × 853
- WebP
- total main-art payload: **2,069,792 bytes**

Separate rail thumbnails:
- `assets/cards/thumb/{id}.webp`
- 384 × 256
- total thumbnail payload: **181,664 bytes**

### Loading strategy
Opening MACHINE CARD SELECT does **not** load all eight full-resolution cards at once.

- rail: lightweight thumbnail set
- focused card: full artwork
- previous/next card: warmed during browser idle time
- main fallback remains WEBP → PNG → JPG → local RUN vehicle asset

This keeps swipe switching responsive without turning the garage into an all-art startup burst.

### Final card hierarchy
The artwork remains the visual focus.

The lower card label now presents:
- FINAL ULTIMATE name
- Japanese machine name

The detailed ability effect remains in the right information panel, avoiding duplicate long copy over the artwork.

Per-machine focal positions are applied so the 3:2 source compositions crop cleanly inside the live landscape card layout.

Locked cards remain visibly desirable: the artwork is dimmed enough to communicate lock state, but no longer crushed into near-monochrome darkness. Ownership is still explicit through LOCKED state and disabled CTA.

### Valkyrie boundary
Highway Valkyrie remains series-reference/future material only.

- RUN gameplay refs: 0
- RUN runtime card assets: 0
- RUN ranking integration: 0

## Gameplay protection
The v1.0.30 source was compared directly against v1.0.29.

From the production runtime marker:
`let run=null, raf=0`

through the end of `game.bundle.js`, the source is byte-identical.

SHA256 for that protected runtime region in both v1.0.29 and v1.0.30:

`38cb6cb7c031b6a1fb50ec434f0caf12e40a193a28b208ee0f5fda583b6f0133`

Therefore the following were not changed:
- physics
- vehicle performance
- fuel economy / supply
- v1.0.20 3K difficulty curve
- obstacle behavior
- 55 authored course patterns
- SPECIAL behavior
- Emergency Ultimate behavior
- ranking submission construction / gameplay stats

Static counts:
- authored patterns: **55 / 55 unique**
- SPECIAL definitions: **8**
- Valkyrie refs in protected RUN runtime: **0**

## Ranking protection
The v1.0.29 ranking behavior is retained:

- landscape fixed layout
- left YOUR BEST fixed
- right WORLD TOP100 vertical scroll only
- no horizontal ranking scroll
- large 8-machine picker
- stale-while-refresh cached paint
- background refresh
- in-flight request dedupe
- period warming after scope open
- 1-hour validated GAS health cache

Only the client cache namespace was bumped from v129 to v130 for a clean final release.

GAS endpoint and API contract are unchanged. **No GAS redeploy is required.**

## Browser execution QA
Direct localhost navigation is blocked by administrator policy in this environment, so the full production HTML/CSS/JS was executed in headless Chromium via Playwright with local-resource interception. External GAS calls were mocked/blocked for deterministic UI testing.

No JavaScript page errors were observed in the tested fixtures.

### 932 × 430 landscape
MACHINE CARD:
- card: ~674 × 289 px
- art area: ~400 × 287 px
- final main artwork loaded: PASS
- all 8 lightweight rail artworks loaded: PASS
- horizontal document overflow: **0 px**
- RUN CTA height: **54 px**

Ranking with mocked 100-row board:
- rows rendered: **100**
- ranking list client: 636 × 235 px
- ranking list scroll height: 6030 px
- overflow-x: `hidden`
- overflow-y: `auto`
- machine picker choices: **8**
- first machine tile: ~212 × 96 px
- close control: **44 × 44 px**
- horizontal document overflow with picker open: **0 px**

### 844 × 390 landscape
MACHINE CARD:
- card: ~681 × 276 px
- art area: ~456 × 274 px
- final main artwork loaded: PASS
- all 8 lightweight rail artworks loaded: PASS
- horizontal document overflow: **0 px**
- RUN CTA height: **38 px** under the compact-height layout

Ranking with mocked 100-row board:
- rows rendered: **100**
- ranking list client: 578 × 223 px
- ranking list scroll height: 4726 px
- overflow-x: `hidden`
- overflow-y: `auto`
- machine picker choices: **8**
- first machine tile: ~196 × 97 px
- close control: **44 × 44 px**
- horizontal document overflow with picker open: **0 px**

## Static QA
- `node --check game.bundle.js`: PASS
- `node --check run-ranking.js`: PASS
- `node --check sw.js`: PASS
- duplicate HTML IDs: 0
- missing local HTML refs: 0
- card main artwork: 8/8 present and 1280×853
- card thumbnails: 8/8 present and 384×256
- Valkyrie runtime card files: 0
- service-worker card-art network-first rule includes main + thumbnail assets: PASS
- v1.0.30 cache marker: PASS

## Final file SHA256
- `game.bundle.js`: `789b9d217587c776257be133f09418e088831bc24d4861323eeaeed5d97b9b13`
- `run-ranking.js`: `93db39de10ae4fa0ea1cc5e5a06edd5ae088f3fdeeb74371034fa22b9514a5f5`
- `style.css`: `7c4ba07867d0d9bd21fa48e638d3fc8b59fdb46ccd310ab73388035c5ff8a923`
- `index.html`: `c9400dfa6b1604248ec2ba2eb3751414212e0be5121e329d45da94ae1de34cc0`
- `sw.js`: `41ce2f55864d4b807691521af330c24a17c1cd6085eaade860f769f5f8094917`
- `manifest.webmanifest`: `bc5bac8ecc937aca6d2e2d4d762a360856bf72a0e276d6eb989a7b2103b3c6bf`

## Runtime limitation
No real iPhone, Android, or LINE in-app-browser device test was performed in this environment. The Chromium checks above are real production-code layout/execution tests, but they are not a substitute for final physical-device verification.
