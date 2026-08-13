# BOON RUN v1.0.22 — RANKING FOCUS / QA

Build: `2026-08-11-playable-v1.0.22-ranking-focus`
Client: `1.0.22`

## Purpose
Landscape ranking UI optimization. The overall WORLD ranking is now the primary competition view; machine-specific ranking remains available as a secondary drill-down.

## UI changes
- Default ranking view: **総合ランキング**
- Left pane: **あなたの総合BEST** / current world position
- Right pane: **WORLD TOP 10**, 1–5 and 6–10 arranged for landscape viewing
- Each overall row keeps a compact machine badge/icon so vehicle diversity remains visible without making machine filters primary
- `今日 / 今週 / 歴代` remains top-level
- Machine rankings moved behind a dedicated **マシン別ランキング** button
- Machine selector is hidden until requested
- Machine mode updates title / own-best label / scope caption
- SECRET remains excluded from normal overall and accessible through machine ranking

## Safety / gameplay invariants
- `run-ranking.js`: byte-identical to v1.0.21
  - v1.0.21 SHA256: `a32824f2f234549b95f31bbe425175807a2c3fa788b548d42de19d8b42858eaa`
  - v1.0.22 SHA256: `a32824f2f234549b95f31bbe425175807a2c3fa788b548d42de19d8b42858eaa`
- Gameplay physics / fuel / obstacle patterns / vehicle tuning / SPECIAL behavior were not edited.
- Game JS diff vs v1.0.21 is limited to build/version, ranking DOM references, ranking presentation/filter UI, and ranking event wiring.
- 55 authored patterns retained.
- 8 SPECIAL definitions retained.
- Valkyrie references in RUN: 0.
- BOONJUMP body + rear-wheel + front-wheel visual sync remains intact.

## Static QA
- `node --check game.bundle.js`: PASS
- `node --check run-ranking.js`: PASS
- `node --check sw.js`: PASS
- Duplicate HTML IDs: 0
- Missing `$('<id>')` references: 0
- CSS parser errors: 0
- Ranking mock-render: PASS
  - TOP1 medal
  - distance formatting
  - machine icons/badges
  - self rank card
  - default overall focus
  - machine selector including SECRET
- Service Worker cache bumped to `boonrun-20260811-v122rankingfocus`.

## Limitation
No claim of real iPhone / LINE in-app browser visual testing is made in this QA. Static layout rules and mock ranking rendering were verified.

## Release judgment
PASS for publication as v1.0.22.
