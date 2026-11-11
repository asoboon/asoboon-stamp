# ASOBooN 呼出復帰・削除枠・本人キャンセル修正 2026-11-11

## 発端
- AirWAITで「案内済み」とした後に「待機中」へ戻すと、アプリ側の呼出状況が復帰しない・最新情報を取得できない
- AirWAITで削除した受付枠がHOMEの残り人数表に残り続ける
- 呼出状況エラー時にお客様自身のキャンセル機能の有無が分からない

## 実装
- `miniapp-v2/shared/callstatus.js`：案内済み（done）で自動更新を停止せず、表示中は15秒間隔で再照合。通信失敗も15秒後に自動再試行（認証・429は90秒バックオフ）。キャンセルは既存どおり、サーバー確認済みの waiting/calling/hold のみ表示
- `miniapp-v2/production/home-status-v13.js`：HOME側の案内済み状態を15秒間隔で再照合（公開された受付情報を安全に読み取るだけ）
- `miniapp-v2/backend/production-worker.mjs`：本人認証された受付セッションをもとにAirWAITの同一受付がdoneからwaiting/calling/hold/processingへ戻った際、当日のD1 claimを COMPLETED→CONFIRMED に戻す。受付番号＋予約ID＋受付枠ID＋本人ハッシュ＋営業日が一致するもののみ。CANCELEDは復活させない
- `miniapp-v2/backend/production-gateway.js`：AirWAIT公開受付枠一覧の共有キャッシュTTLを10分→45秒へ短縮
- `miniapp-v2/production/home-v38.js`：最新の公開枠一覧から削除・非公開を確認できた同一回のWEB/LINE両方をHOMEから除外。片方だけ削除の場合は「受付なし」。公開状態の確認に失敗した場合は、直近に検証済みの非公開状態を保持し、人数を空きと誤認させない。営業終了後の当日実績・既存参考表示は維持

## テストとリスク
- worker実APIロジックを模したSQLite/HTTP統合テストで「案内済み→待機→本人の新規受付重複防止→本人キャンセル」を確認
- Playwrightで削除枠非表示・部分削除・実際の呼出→取消確認画面→取消完了を検証
- 変更した公開枠一覧のTTLはサーバー（Cloudflare Worker）配信後に初めて有効
- 実際のお客様のLINEアカウント・実AirWAITの番号に対する状態変更/キャンセル操作は行わない
- LINE実機での外部API更新完了までは「本番確認済み」としない

## 作業メモ
変更PR：#173（HOME導線整理に追加）、セキュリティテストと全Productionブラウザ回帰テストを通したうえでmainへマージ。Workerは自動デプロイではないため、main反映後にworkflow_dispatchで**mode=live**と現在の公開データ事前取得設定を維持したまま反映する必要がある。mode=darkで本番受付を停止してはいけない。
