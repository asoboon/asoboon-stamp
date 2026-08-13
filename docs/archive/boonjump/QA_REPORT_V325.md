# BOONJUMP v3.2.5 — MACHINE SELECT PRODUCT POLISH

## Scope
Presentation/input polish only. Vehicle performance, timing motion, distance caps, gacha rates, tuning, ranking payload schema, and VFX files are unchanged from v3.2.4.

## Machine selector polish
- BOON RUNのカードDNA（暗色斜めカード、レアリティ、選択中バッジ、大きな車体、操作タイプ、短い紹介、BEST）を維持。
- BOONJUMP専用のカード情報として「最大飛距離」チップを追加。
- ヘッダーに「所持台数 / 全台数」と現在位置を表示。
- 左右スワイプ、左右矢印、サムネイル列の3方式で車種切替。
- キーボード左右キーにも対応。
- カード切替時だけ短い方向アニメーションを追加。常時アニメーションは追加しない。
- ACCEL / TURBO / NITROに日本語補助ラベルを追加。
- 未解放車は車名と最大飛距離を伏せ、コレクション感を統一。
- モバイル幅での余白・文字階層・車体サイズ・サムネイル列を再調整。
- 画面上に残っていた旧 `V2.5.2` 表示を削除。

## Verification
- `index.html` inline JS: `node --check` PASS
- `ranking-client.js`: `node --check` PASS
- `sw.js`: `node --check` PASS
- `CARS` block: v3.2.4と完全一致 (SHA256 prefix `986ab9e02721787b`)
- `motionValue` block: v3.2.4と完全一致 (SHA256 prefix `b731eebfeffa3366`)
- `nitroMotion` block: v3.2.4と完全一致 (SHA256 prefix `b6a6627f04f0844b`)
- PERFECT 100 verifier: 81 cases / 1,944 frame-phase simulations / 0 failures
- VFX: 25 references / 25 WebP files / 0 missing
- Service Worker local refs: 77 / 0 missing
- New selector IDs: duplicate 0

## Build
- App version: `3.2.5`
- Build: `2026-08-12-machine-selector-polish-v325`
