# ASOBooN BOON START v5.4｜本番標準UI・サプライズ投票非表示

日付：2026年11月6日

## 対象と変更
- 公開アプリ： https://asoboon.github.io/asoboon-stamp/home.html
- GitHub： `asoboon/asoboon-stamp` / PR [#127](https://github.com/asoboon/asoboon-stamp/pull/127)
- 公開前の基準 `main` SHA： `400ba7ade537e484db5ff53011edb604e79bd62a`
- BOON START ミントソーダ v5.4 を**通常URLの標準テーマ**にする。受付枠／人数／確認／完了／呼出／エラーの17シーンを対象。
- 色：ターコイズ `#28C7BE`、ペールミント `#E3FFF6`、パッションオレンジ `#FF7A00`。
- HOMEの「サプライズ投票」カードだけ非表示。コンポーネントの冒頭 `SHOW_HOME_ENTRY=false` で、非表示中は30秒の投票状況ポーリングも開始しない。
- サプライズ投票の独立ページ、投票バックエンド、保存データ、他のミニゲーム・イベント・スタンプラリーは削除しない。
- 受付処理、AirWAITの正式状態、料金・上限、重複受付防止、キャンセル・LINE通知、受付番号保持は**元コードのまま**。

## 表示切替／安全なロールバック
- **通常：** `home.html` → Mint Soda v5.4。
- **旧UI：** `home.html?boonTheme=classic` → 追加テーマCSS・JSを読み込まない。既存の受付・呼出の正規ロジックは同じ。
- `?view=callstatus&boonTheme=classic` のようにviewと組み合わせられる。
- **本番変更全体の切戻し：** 変更前の基準SHA `400ba7ade537e484db5ff53011edb604e79bd62a` から静的ファイルの復旧コミットを生成し、CI通過後にmainへ適用する。Force pushしない。サプライズ投票も以前の状態に戻る。
- **投票入口だけ復活：** `miniapp-v2/production/surprise-vote-home-v1.js` の `SHOW_HOME_ENTRY=true` にして本番ビルドを再実行。
- 本番Workerを変更していないため、Workerのデプロイ・ローテーション・ロールバックは不要。

## 動作検証と制限
- `node miniapp-v2/build-production.mjs --check` で初回ビルド140KB/gzip40KB以下の制約を保持。実測 139,918 bytes、gzip 37,369 bytes。
- Node自動テスト：旧289件＋新ライブガード4件。
- Chrome（LINE/Workerモック、外部通信遮断）：17シーン×320/390/430px＝51件、緑GOの呼出限定・通信断・受付番号の表示をテスト。
- 本番テーマ有効・旧テーマ（`boonTheme=classic`）戻し・サプライズ投票が非表示／ポーリングなしをブラウザで検証。
- `npm run test:miniapp-production` の100ケースで、予約・営業日・呼出・待機、LINE権限エラー、言語ファイル障害をテスト。辞書障害時テストは**v5.4の3ステップ（枠→人数→確認）**に追随。
- テスト値（例：`QA-123`）はすべてモック。実AirWAITの本物の受付発行・取消、公式LINE実機のiOS／Android操作は**未検証**。
- 公開後の確認は**GET／画面表示の読み取りのみ**。本番APIへの受付作成・取消リクエストは行わない。

## 公開後の確認点
1. GH Pages `main` の最新版が配信され、v5.4 CSSとJSを返す。
2. 通常URLでミントと `#FF7A00` が見え、`?boonTheme=classic` では旧表示へ戻る。
3. HOMEのサプライズ投票入口は表示されず、投票状況APIへのHOME自動アクセスなし。
4. 現行の営業日／混雑情報／LINE受付・WEB受付の表示が壊れていない。
5. 正式な呼出中だけ緑GO、待ち0組はまだ呼出前（モック検証と本番コード照合）。

## 保管先
- `docs/boon-v54-live/qa/screens/`：17画面スクリーンショット
- `docs/boon-v54-live/qa/browser-qa.json`：自動QA結果
