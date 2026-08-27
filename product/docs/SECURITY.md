# セキュリティ基準

## 商用品として必須
- AirWAIT APIキーは Script Properties / Secret Manager のみ。
- STAFF_KEYをソースコード・GitHub・URLクエリへ固定しない。
- ログへAPIキー・STAFF_KEYを出さない。
- state-changing操作は requestId で冪等化。
- スタッフ操作はバックエンドで再認証する。UI非表示だけを認証に使わない。
- reserveId / receiptNo / waitTypeId は文字列として保存。
- API異常時は自動呼出を停止し、順番を追い越さない。

## 現行ASOBooN版から移行時の重要事項
現行静的フロントは試験開発の都合でAirWAITへの直接接続設定を持っています。販売版への切替後は、現在のAirWAIT APIキーを必ず再発行/ローテーションし、旧キーを無効化してください。Git履歴から文字列を消すだけでは漏えい対策になりません。

## 将来の高負荷構成
Apps Scriptは小〜中規模施設の導入には扱いやすい一方、複数店舗・高トラフィック・厳格なSLAが必要になったらCloud Run / Functions等へバックエンドを移行します。フロントは `QueueProductAPI` インターフェースを維持することで差し替え可能です。
