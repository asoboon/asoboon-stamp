# ASOBooN Model 導入手順

## 1. Apps Script
ASOBooN AirWAIT 台帳スプレッドシートから新しいApps Scriptプロジェクトを作成し、`backend/ASOBooNBackend.gs` を配置する。

## 2. Script Properties
必須:
- `AIRWAIT_API_KEY`
- `AIRWAIT_STORE_ID`

初期セットアップ後に自動生成/設定:
- `ASOBOON_SHEET_ID`
- `STAFF_KEY`
- `AUTO_ENABLED=0`
- `AIRWAIT_CALL_ENABLED=0`
- `AUTO_POOL=10`
- `AUTO_STOP_TIME=18:00`

AirWAIT回答後に必要に応じて設定:
- `AIRWAIT_CALL_API_URL`
- `AIRWAIT_CALLING_METHOD`
- `AIRWAIT_COUNTER_ID`
- `AIRWAIT_CALL_ENABLED=1`

## 3. 初期化
Apps Scriptエディタで `setupASOBooNModel()` を1回実行。

## 4. Web App公開
実行ユーザー: 自分
アクセス: 運用要件に合わせたWeb App公開設定

公開URLを `../config.js` の `backendUrl` に設定する。

## 5. サーバーAUTO
呼出API確認前は絶対に `AIRWAIT_CALL_ENABLED=1` にしない。
確認後、スタッフ画面からAUTO ONすると1分周期トリガーが自動作成される。

## 6. 本番切替
現行のASOBooN本番導線は最後まで維持する。新モデルで受付→台帳→取消→呼出→完了のE2Eを確認後に切り替える。
