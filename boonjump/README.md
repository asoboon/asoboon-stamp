# ブーンジャンプ 正式公開版 v1.2.1

作成日：2026年8月6日  
ビルド：`2026-08-06-navigation-v5`

## 配置方法

GitHubの `/boonjump/` フォルダ内を、このフォルダの内容で置き換えてください。
`assets/cars/` を含むフォルダ構造を崩すと車体が表示されません。

```text
boonjump/
├── index.html
├── manifest.webmanifest
├── sw.js
├── icons/
│   ├── icon-192.png
│   ├── icon-512.png
│   ├── icon-maskable-192.png
│   └── icon-maskable-512.png
├── assets/
│   └── cars/  ← 35ファイル必須
└── docs/
```

## 今回の仕上げ

- 車体PNG35枚を `assets/cars/` へ外出し・減色最適化
- SECRET解放画面の直書き画像5枚も外部ファイル参照へ統一
- HTMLはネットワーク優先、車体・アイコンはビルド別キャッシュ優先
- プリキャッシュは `Promise.allSettled` と個別取得で、1件の404による全滅を防止
- Service Worker更新を検知し、自動で新バージョンへ切り替え
- `any` と `maskable` のPWAアイコンを分離
- `__boonDebug` と `__boonSound` は `?debug=1` のときだけ公開
- キーボード入力と重複タップ抑制を修正
- 保存キー `asoboonBooncar.v6` を維持
- primary／backup／recoveryの3段階でlocalStorageを保護
- 画面最上部に白緑の「ASOBooNミニアプリへ戻る」を常時表示
- ゲーム中のみ黄色の「ゲーム最初へ」を表示し、ゲーム内移動とアプリ終了を明確に分離
- 下部に重複していたミニアプリHOMEボタンを削除し、戻り先を最上部へ一本化

## localStorageについて

ゲームを閉じる、LINEミニアプリを閉じる、LINEを通常終了する操作では記録が残る設計です。
端末変更、LINEアプリの削除、LINEの保存データ消去、公開ドメイン変更では引き継げません。

## 更新方法

次回更新時は `index.html` の `boonjump-build` と `sw.js` の `BUILD` を同じ新しい値へ上げてください。


## 戻るボタンの役割

- 最上部「ASOBooNミニアプリへ戻る」：ゲームを終了し、`../home.html`へ移動
- 黄色「ゲーム最初へ」：ブーンジャンプ内のタイトル画面へ戻る。ミニアプリからは退出しない
