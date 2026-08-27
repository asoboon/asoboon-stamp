# ASOBooN Reception Model 1.0 RC

ASOBooN向けの次期本番正本候補。現在の本番を壊さず `/product/asoboon/` に分離して開発する。

## 目的
- お客様UIは現在のASOBooN現地受付の3ステップ体験を維持
- WEB予約枠と現地受付を完全分離
- AirWAIT APIキーをブラウザ/GitHubから排除
- 共有台帳・ID連携・キャンセル同期をサーバー側へ統合
- 自動呼出をブラウザ依存からサーバーAUTOへ移行
- AirWAIT呼出APIが未確認の間はバックエンドでAUTOを強制ロック

## ASOBooN標準
- 1受付 合計10名まで
- 保護者1名につき子ども3名まで
- 大人600円 / 子ども900円
- 0〜5か月までの子どもは追加料金無料
- 18:00〜18:59 受付休止
- 19:00から翌日受付
- 呼出中プール 最大10組
- 18:00以降 呼出休止
- WEB枠、テスト枠、ご待機者専用枠を除外

## デモ
- お客様: `./customer/?demo=1`
- スタッフ: `./staff/?demo=1`

デモはブラウザ内データだけで動作し、AirWAITへ接続しない。

## 本番移行条件
1. AirWAITから reserve/call の現行仕様回答を受領
2. `AIRWAIT_CALL_ENABLED=1` にする前にダミー/テスト店舗で呼出E2E成功
3. ASOBooN用 Apps Script backend を新規デプロイ
4. Script Propertiesへ秘密情報を保存
5. `config.js` の backendUrl を新URLへ変更
6. 新APIキーへローテーションし、旧ブラウザ直書きキーを失効
7. iPad実機で1日通し試験
8. 現行本番から段階切替

## 重要
`config.js` に APIキー・STAFF_KEY・秘密URLパラメータを入れない。
