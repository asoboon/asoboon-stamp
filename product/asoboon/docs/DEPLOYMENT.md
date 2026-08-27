# ASOBooN Model RC2 導入手順

## 1. Apps Script
ASOBooN AirWAIT 台帳スプレッドシートから新しいApps Scriptプロジェクトを作成し、`backend/` 内の `.gs` ファイルを配置する。

## 2. Script Properties
必須:
- `AIRWAIT_API_KEY`
- `AIRWAIT_STORE_ID`

`setupASOBooNModel()` 実行時に自動生成/初期化:
- `ASOBOON_SHEET_ID`
- `STAFF_KEY`
- `AUTO_ENABLED=0`
- `AIRWAIT_CALL_ENABLED=0`
- `AIRWAIT_EXTERNAL_RESERVE_ID_READY=0`
- `AIRWAIT_NEXT_DAY_RECEPTION_READY=0`
- `AUTO_POOL=10`
- `AUTO_STOP_TIME=18:00`
- `AUTO_PENDING_GRACE_MS=120000`
- `BLOCKED_WAIT_TYPE_IDS_JSON=["0042"]`
- `BLOCKED_NAME_PATTERNS_JSON=["WEB","テスト","ご待機者専用","待機者専用"]`
- `OPERATION_BLOCKED_NAME_PATTERNS_JSON=["テスト","ご待機者専用","待機者専用"]`

AirWAIT回答後に必要に応じて設定:
- `AIRWAIT_CALL_API_URL`
- `AIRWAIT_CALLING_METHOD`
- `AIRWAIT_COUNTER_ID`

## 3. 絶対に順番を飛ばさない開放手順
### 呼出API
実環境またはテスト店舗で `reserve/call` の正常成功を確認してから:
- `AIRWAIT_CALL_ENABLED=1`

### WEB/時間指定予約
T番号・WEB予約の `reserveId` を安全に取得できる実装まで完成し、実予約で照合確認してから:
- `AIRWAIT_EXTERNAL_RESERVE_ID_READY=1`

上記2つが両方 `1` でなければサーバーAUTOはONにならない。

### 翌日受付
19:00以降に `reserve/create` した受付がAirWAIT上で確実に翌営業日扱いとなることを確認してから:
- `AIRWAIT_NEXT_DAY_RECEPTION_READY=1`

未確認の間、19:00以降のお客様受付はサーバー/画面双方で閉じる。

## 4. 初期化
Apps Scriptエディタで `setupASOBooNModel()` を1回実行する。

## 5. Web App公開
- 実行ユーザー: 自分
- アクセス: ASOBooNの運用要件に合わせたWeb App公開設定

公開URLを `../config.js` の `backendUrl` に設定する。
APIキーやSTAFF_KEYを `config.js` に書かない。

## 6. サーバーAUTO
呼出関連の2ゲート確認前は絶対に開放しない。
開放後、スタッフ画面からAUTO ONすると `runASOBooNAutoCycle` の1分周期トリガーが自動作成される。
同じ開始時刻のWEB＋現地は1入場回として合計最大10組を管理する。

## 7. 本番前チェック
- T番号と通常番号を別予約として扱えること
- WEB予約がスタッフ画面に見えること
- お客様現地受付画面にはWEB枠が出ないこと
- 現地受付のreserveIdが必ず台帳へ即時保存されること
- 100組超ページング
- 同時二重送信
- AirWAIT反映遅延
- スタッフ手動呼出との競合
- キャンセル/取消
- 18:00境界/19:00境界
- iPadスリープ中のサーバーAUTO
- AirWAIT/GAS障害時の安全停止

詳細は `ACCEPTANCE.md` を正本とする。

## 8. 本番切替
現行のASOBooN本番導線は最後まで維持する。新モデルで受付→台帳→WEB時間指定→取消→呼出→対応中/完了までのE2Eを確認後に段階切替する。

切替時は新APIキーへローテーションし、旧ブラウザ直書きキーを失効させる。
