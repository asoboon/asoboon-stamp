# BOON MONSTER｜育成ループ v0.2

幼体3種を実際に育成できるGitHub Pages向け静的Webプロトタイプです。

## 遊べること
- モンスター直接タップ: surprised → smile → normal
- おせわ: なでる / 給油 / 点検
- おでかけ: 各幼体2ロケーション
- FUEL / CONDITION / MOODの実値変化
- MATURITYを内部蓄積（数値は非表示）
- おでかけ履歴と進化方向を内部保存
- 条件到達で evolution_ready と「なんだか様子が違う……！」
- ガレージ: 状態確認 / 軽い整備 / 休ませる
- localStorage保存
- 3幼体は個別セーブ

## 正本維持
- Canvas 96×96
- RGBA透過PNG
- AAなし
- anchor (48,80)
- 表示サイズ 192×192
- actual animal evolution は未実装

## Playable Prototype 受入記録
2026-08-29に、BABY → ANIMAL → CATEGORY → LIGHT/DARK FINAL → DEX → SAVE/LOAD の縦切りプロトタイプが最終E2Eを通過しました。

記録: [`playable-prototype-2026-08-28/`](./playable-prototype-2026-08-28/)

既存の `/boonmonster/` 公開テストゲームは維持し、この受入済み縦切りを次の統合基準として扱います。

## GitHub Pages
`/boonmonster/` を固定公開パスとして使用します。
