# BOON MONSTER｜Hidden Game Playable Prototype v0.3

`/boonmonster/` はミニアプリ内の既存「隠しゲーム」リンクをそのまま使う、BOON MONSTERの実機テスト面です。

## 現在のテスト範囲
- NEW GAME：幼体3種から開始
- 幼体 → 動物 → カテゴリ → LIGHT / DARK最終進化
- 現行系統：
  - もふーん → ふぇねーん / らびーん
  - ふろーん → さぱーん / うそーん
  - ぎがーん → りざーん / わしーん
- 動物 → 6カテゴリ分岐
- LIGHT / DARKは `PROTOTYPE DEBUG ONLY`
- 図鑑登録
- localStorage SAVE / LOAD
- おせわ（なでる / 給油 / 点検）は育成ターンを消費しない

## 育成テンポ
- 幼体：5育成ターン
- 動物：6育成ターン
- カテゴリ：LIGHT / DARK正式判定未確定のため試作ボタンで最終進化

## アセット状態
既存の幼体21表情atlasはreaction専用としてそのまま使用しています。通常表示は、`data/pixel_lock_registry.json` の `Spec ID -> File Key -> runtime path -> SHA256` 解決を優先し、117件のPIXEL LOCK PNGを表示します。

lock画像の読み込みに失敗した場合は `ASSET ERROR` とSpec IDを表示します。placeholderへフォールバックしません。117 PIXEL LOCK画像自体の変更・再生成は行いません。

## 公開テストパス
`/boonmonster/` を固定公開パスとして維持します。ミニアプリ側の隠しゲームリンク変更は不要です。

## Acceptance record
受入済み縦切りの記録：[`playable-prototype-2026-08-28/`](./playable-prototype-2026-08-28/)
