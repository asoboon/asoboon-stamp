# ブーンジャンプ 完成版 v1.0.0

作成日：2026年8月5日  
ビルド：`2026-08-05-100point-v1`

## 公開方法

GitHubの `/boonjump/` フォルダへ、このフォルダの中身をそのまま配置してください。

```text
boonjump/
├─ index.html
├─ manifest.webmanifest
├─ sw.js
├─ icons/
│  ├─ icon-192.png
│  └─ icon-512.png
├─ docs/
│  └─ validation.md
└─ README.md
```

公開URLは次の形です。

```text
https://asoboon.github.io/asoboon-stamp/boonjump/
```

## 今回の仕上げ

- ミニアプリホームへ戻るボタンを全画面共通の上部へ追加
- 結果画面からホーム・おみくじ・入場案内へ移動できる導線を追加
- トロフィー総数の `25 / 26` 表示不一致を修正
- 保存領域が使えない環境でもゲーム全体が停止しないよう改善
- PWAアイコンを正式同梱
- Service Workerを安全なキャッシュ処理へ更新
- READMEと実際の納品ファイル構成を一致

## 保存データ

保存キー `asoboonBooncar.v6` は変更していません。既存のベスト記録、車庫、チューン、トロフィーを引き継ぎます。

## 素材について

車両画像は `index.html` に内包されています。外部画像フォルダは不要です。
