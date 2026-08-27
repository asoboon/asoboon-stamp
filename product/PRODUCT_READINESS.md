# Product Readiness Gate

## READY — 実装済み/設計済み
- 顧客UIとスタッフUIの分離
- WEB枠と現地枠の分離
- 受付順を追い越さない安全制御
- 共有台帳・ID連携
- AUTO状態永続化
- API異常時の安全停止
- 運用サマリー
- reserveId先頭0対策
- Spreadsheet日付型正規化
- 秘密情報をサーバー側へ移す販売版バックエンド
- state-changing操作のrequestId冪等化
- 呼出API設定の外出し
- 導入/セキュリティ/運用ドキュメント

## BLOCKED — 外部確認待ち
- ASOBooN契約環境でのAirWAIT `reserve/call` の現行 callingMethodType / 利用可否

## BEFORE FIRST SALE — 必須
- 販売版バックエンドをテスト用AirWAIT店舗でE2E検証
- APIキーをローテーションしてフロント直書きを廃止
- 1日通しのiPad実機耐久試験
- 複数受付→キャンセル→呼出→完了の回帰試験
- 利用規約/保守範囲/障害時責任分界を契約書へ明記
- 顧客データ保持期間と削除ポリシーを決定

## RELEASE基準
上記BLOCKEDが解消し、BEFORE FIRST SALEの技術項目が全PASSになった時点を Commercial 1.0 GA とする。
