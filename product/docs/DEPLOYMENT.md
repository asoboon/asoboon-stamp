# 導入手順 — Commercial Edition

## 1. 台帳を作る
Google Spreadsheetを1つ作成し、拡張機能 → Apps Scriptを開きます。`backend/QueueBackend.gs`を配置します。

## 2. Script Propertiesを設定
必須: `AIRWAIT_API_KEY` / `AIRWAIT_STORE_ID` / `BRAND_NAME`
必要に応じて: `AIRWAIT_STORE_NO` / `MAX_TOTAL_PEOPLE` / `CHILDREN_PER_ADULT` / `AIRWAIT_CALL_API_URL` / `AIRWAIT_CALLING_METHOD` / `AIRWAIT_COUNTER_ID`

APIキーをHTML/JavaScript/GitHubへ書かないこと。

## 3. setupProduct() を1回実行
`setupProduct()`で台帳シート・STAFF_KEY・AUTO状態を初期化します。`checkProductSetup()` が `ok:true` になれば準備完了です。

## 4. Webアプリとしてデプロイ
実行ユーザー: 自分。発行された `/exec` URL を `public-config.js` の `backendUrl` に設定します。

## 5. フロント設定
`public-config.example.js` を `public-config.js` にコピーし、施設名・料金表示・backendUrlのみ変更します。秘密情報は入れません。

## 6. STAFF_KEYをスタッフ端末へ
初回生成キーまたは `rotateStaffKey()` で再発行したキーをスタッフ端末へ1回だけ設定します。メールや公開ドキュメントには保存しません。

## 7. 受入テスト
- waitTypes取得
- waitInfo取得
- テスト受付1件
- 台帳保存
- 取消同期
- スタッフ認証
- AUTO OFF/ON保持
- 呼出API（契約/権限確認後）
- 通信断→復帰
- iPadスリープ→復帰
- reserveId先頭0
- 日跨ぎ

## 8. 本番切替
旧フロントからAirWAITへの直接通信を停止し、`secure-airwait-client.js`経由へ変更してからAPIキーをローテーションします。
