# ASOBooN Reception Model 1.0 RC2

ASOBooN向けの次期本番正本候補。現在の本番を壊さず `/product/asoboon/` に分離して開発する。

## 目的
- お客様UIは現在のASOBooN現地受付の3ステップ体験を維持
- お客様画面ではWEB予約枠を除外
- スタッフ監視/AUTOではWEB・時間指定予約も含める
- AirWAIT APIキーをブラウザ/GitHubから排除
- 共有台帳・ID連携をサーバー側へ統合
- 自動呼出をブラウザ依存からサーバーAUTOへ移行
- 未確認のAirWAIT仕様は推測で動かさず、サーバー側で安全ロック

## ASOBooN標準
- 1受付 合計10名まで
- 保護者1名につき子ども3名まで
- 大人600円 / 子ども900円
- 0〜5か月までの子どもは追加料金無料
- 18:00〜18:59 現地受付休止
- 19:00以降の翌日受付はAirWAIT営業日切替を確認後に開放
- 同じ開始時刻のWEB予約＋現地受付を1入場回として扱う
- 1入場回の呼出中プール 合計最大10組
- 18:00以降 呼出休止
- T番号（時間指定）、F番号（割込）、通常番号を別物として保持
- テスト枠、ご待機者専用枠、待ち項目ID 0042は運用対象外

## WEB予約とID連携
現地受付はASOBooN側で作成するため `reserveId` を台帳へ保存する。
WEB/時間指定予約はAirWAIT側で作成されるため、ASOBooN台帳に未連携でも正常ケースとして扱う。

予約一覧APIでは呼出番号は取得できるが、現行仕様書では `reserveId` が返らない。呼出APIは `reserveId` 必須のため、WEB/時間指定予約のreserveId取得方法がAirWAITから確認できるまでサーバーAUTOは開放しない。

## 安全ゲート
AUTO ONには以下の両方が必要:
- `AIRWAIT_CALL_ENABLED=1`
- `AIRWAIT_EXTERNAL_RESERVE_ID_READY=1`

翌日受付の開放には:
- `AIRWAIT_NEXT_DAY_RECEPTION_READY=1`

すべて初期値は0。未確認状態で誤って本番運転しない。

## デモ
- お客様: `./customer/?demo=1`
- スタッフ: `./staff/?demo=1`

デモはブラウザ内データだけで動作し、AirWAITへ接続しない。

## 本番移行条件
1. AirWAITから reserve/call の現行仕様回答を受領
2. WEB/時間指定予約のreserveId取得方法を確定
3. 19:00以降の翌営業日受付動作を確定
4. テスト店舗/実環境で呼出E2E成功
5. ASOBooN用 Apps Script backend を新規デプロイ
6. Script Propertiesへ秘密情報を保存
7. `config.js` の backendUrl を新URLへ変更
8. 新APIキーへローテーションし、旧ブラウザ直書きキーを失効
9. `docs/ACCEPTANCE.md` の全項目PASS
10. 現行本番から段階切替

## 重要
- `config.js` に APIキー・STAFF_KEY・秘密URLパラメータを入れない。
- `T208` と `208` のような接頭辞違いを同じ受付番号として扱わない。
- WEB未連携を異常扱いしない。
- 現地だけ先行AUTOし、WEB予約を追い越す運転はしない。
