# Queue Product — Commercial Edition 1.0

施設向けの受付・順番待ち・スタッフ運用基盤です。ASOBooNで検証したUI/運用を、他施設へ導入できるよう「秘密情報の分離」「設定の外出し」「安全停止」「導入標準化」を行う販売版ディレクトリです。

## Sales Demo

`product/` は現在 `public-config.js` の `demoMode:true` で営業デモとしてそのまま開けます。AirWAIT契約・APIキー・Apps Scriptは不要です。

1. `product/` を開いて「デモデータを初期化」
2. `product/customer/` で受付を1件作成
3. `product/staff/` を開く
4. 同じ受付番号がID連携済みで表示される
5. AUTO ONで「待ち中 → 呼出中」を実演

デモデータは同一オリジンのブラウザlocalStorageだけに保存され、外部サービスへ送信されません。販売先で本番利用する際は `public-config.example.js` を元に `demoMode:false` の施設設定へ切り替えます。

## 販売版の設計原則
1. APIキーをフロントへ置かない — AirWAIT APIキーは Apps Script の Script Properties のみに保存。
2. UIと接続先を分離 — AirWAIT仕様変更時はバックエンド設定だけを変更し、顧客UIを再配布しない。
3. スタッフ操作は認証必須 — STAFF_KEY は端末ローカル保存。GitHubへ保存しない。本番のみ。デモモードでは自動認証。
4. 重複受付を防ぐ — state-changing操作は requestId で冪等化し、POST後に結果を照合。
5. 障害時は安全側へ — 呼出API異常時は自動呼出を停止し、受付・監視は継続。
6. ID/日付を文字列として保持 — reserveIdの先頭0、Spreadsheet Date型を正規化。

## 構成
- `index.html` — 営業デモ入口
- `customer/` — お客様受付UI
- `staff/` — スタッフ運用コンソール
- `public-config.js` — 安全な営業デモ設定
- `public-config.example.js` — 本番用の公開設定テンプレート
- `secure-airwait-client.js` — ブラウザからバックエンドへ接続する共通クライアント／デモエンジン
- `backend/QueueBackend.gs` — AirWAITキーを隠すApps Scriptバックエンド
- `docs/DEPLOYMENT.md` — 導入手順
- `docs/SECURITY.md` — セキュリティ基準
- `docs/OPERATIONS.md` — 現場運用・障害対応
- `PRODUCT_READINESS.md` — 商用化ゲート

## 現行ASOBooN版との関係
ルート直下のASOBooN本番ファイルは現場稼働を優先して維持します。販売版を別ディレクトリで完成させ、検証後にASOBooNも販売版バックエンドへ段階移行します。

## AirWAIT呼出仕様が変わった場合
`AIRWAIT_CALL_API_URL` / `AIRWAIT_CALLING_METHOD` / `AIRWAIT_COUNTER_ID` を Script Properties で変更します。フロントコードの変更は不要です。
