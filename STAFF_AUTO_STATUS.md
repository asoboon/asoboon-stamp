# ASOBooN STAFF AUTO 状態メモ

更新日: 2026-08-27

## 現在の正本
- スタッフ入口: `staff-autocall.html`
- 現在表示バージョン: v12.7
- 旧 `staff-autocall-test.html` は現行入口へリダイレクト

## お客様向けUI
- `home.html` / `yoyaku.html` / `onsite-reception-v11.html` は現状を正本として凍結
- 公開WEB予約はAirWAIT公式ページへ遷移
- 隠し現地受付のみ `onsite-reception-v11.html` を使用
- 現地受付・スタッフAUTOでは名称に `WEB` を含む待ち項目を除外

## 現在正常な機能
- AirWAIT待ち項目取得
- AirWAIT受付一覧取得
- 共有台帳取得
- 営業日の日付正規化
- 受付番号と共有台帳の照合
- reserveId連携
- 取消同期
- 受付順を追い越さない安全停止
- 18:00以降の呼出休止
- スタッフ運用サマリー表示

## 現在のブロッカー
AirWAITの予約呼出APIで、仕様書記載の `callingMethodType` が実環境では `1000 入力エラー` となる。

確認済み:
- `KeyNORMAL`
- `KeyCOUNTER`
- `KeyNORMAL_AND_COUNTER`
- 版番号あり/なしの呼出URL
- APIキーのquery/header方式
- storeId/storeNo方式
- counterId付与

安全診断では実予約を使用せず、存在しないダミーreserveIdで入力検証のみ実施。

## AirWAIT回答待ち中の動作
- 呼出API診断NG時はAUTOを安全停止
- 受付取得・共有台帳・ID連携の監視は継続
- AUTO ON操作はUI上で抑止
- 実予約への呼出POSTは行わない

## AirWAITから回答が来たら
1. 呼出APIの現行 `callingMethodType` / 利用条件を確認
2. 呼出アダプタ部分のみ差し替え
3. ダミーreserveIdで入力検証
4. 検証成功後に実受付1件で呼出確認
5. 問題なければ最大10組補充ロジックを本番運用へ

## 変更しないもの
AirWAIT回答対応では、お客様向けUI・公開WEB予約導線・現地受付UIには変更を波及させない。
