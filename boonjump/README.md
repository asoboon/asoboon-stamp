# ブーンジャンプ V2.6.2 — PRINCESS 3 RHYTHMS UPDATE

Build: `2026-08-10-princess-rhythm-v2`

V2.6.1 MASTERPIECE EDITIONを正本に、プリンセス・スターライナーの100.00%到達不能バグを修正し、ACCEL / TURBO / NITROを明確に異なる3つの固定リズムへ再設計した更新版です。

## 修正: プリンセス100.00%

V2.6.1ではACCELの理想値が `.80` なのに、旧rhythm軌道の最大アンカーが `.78` でした。
そのためACCELの100.00%が構造上不可能で、3 COMBO PRECISION 100.00%も実プレイでは到達できませんでした。

V2.6.2では各入力に短い `PERFECT LOCK` を設け、実際の60fps相当ブラウザ操作で以下を確認しています。

- ACCEL: 100.00%
- TURBO: 100.00%
- NITRO: 100.00%
- 3 COMBO: 100.00%
- LIMIT BREAK: 発動

PERFECT LOCKは短時間のみで、乱数はありません。

## PRINCESS — 3 RHYTHMS

### ACCEL — WALTZ
`ゆったりワン・ツー・スリー♪ 3拍目の星で止める`

- 2600ms周期
- 3拍子で段階的に上昇
- 3拍目だけ `.80` に短くPERFECT LOCK
- ゆっくり覚えて合わせるリズム

### TURBO — SYNCOPATION
`高速タン・タン…タンタン♪ 裏拍の中央を狙う`

- 1450ms周期
- 左右へ不規則にジャンプ
- 中央 `.50` は短い裏拍のみ
- ACCELとは速度も動きも別物

### NITRO — STAIR
`ためて落ちる階段リズム♪ 5段目のキラッを狙う`

- 2050ms travel
- 停止→落下を不均等に繰り返す階段型
- 5段目でリング中心 `.76` に短くPERFECT LOCK
- 横ゲージではなく縦ステップとして攻略

## 追加安定化

LIMIT BREAK時に `nitroFlash > 1` となった瞬間、shockwave半径が負数になる可能性があった既存描画処理をclampしました。
プリンセス100%実機相当テスト中に検出し、Canvas例外が出ないことを再確認しています。

## バランス保護

変更したのはプリンセスの3入力モーションだけです。
以下はV2.6.1から維持しています。

- プリンセス rawCap 2952 / finalCap 3100 / Lv50 3100m
- LIMIT BREAK最大 3162m
- 判定幅（SUPER / CRITICAL / GREAT / GOOD）
- distanceScale / baseSpeed / launchAngle / boostPower / gravity / drag
- 他7台の性能・操作軌道
- ガチャ率
- ランキング仕様
- RIVAL CHASE
- トロフィー38個
- セーブキー `asoboonBoonjump.v2`
- schema 7

## Apps Script

バックエンド変更はありません。V2.5.1以降の現行GASをそのまま使用できます。
再デプロイ不要です。

## 公開

GitHub更新後の初回確認:

`/boonjump/?v=262`

Service Worker build:

`2026-08-10-princess-rhythm-v2`
