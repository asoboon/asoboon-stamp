ASOBooN MACHINE SERIES — BOONRUN CARD ART
Final integration: v1.0.30

Runtime art (1280×853 WebP):
- boon.webp
- wagon.webp
- buggy.webp
- bike.webp
- sport.webp
- ssr.webp
- princess.webp
- secret.webp

Lightweight rail thumbnails (384×256 WebP):
- thumb/{id}.webp

The main card loads only the focused machine art. The rail uses the lightweight
thumbnail set. Adjacent main cards are warmed while the browser is idle so swipe
switching feels immediate without loading all eight full artworks at startup.

Fallback order for the main card:
WEBP -> PNG -> JPG -> local RUN vehicle asset

Highway Valkyrie remains a MACHINE SERIES reference and is intentionally NOT
included in BOONRUN assets, gameplay, selection, or ranking in this build.
