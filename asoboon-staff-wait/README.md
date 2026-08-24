# ASOBooN STAFF WAIT v0.2 — LIVE受付番号版

## 修正点
v0.1の 101 / 201 / 301... はDEMOデータでした。v0.2ではダミー受付番号を完全撤去し、Airウェイト `external/stateless/reservations` の `number` をそのまま表示します。

## 対象枠（2026-08-21 Airウェイト設定画面を正本）
- 10:00: 1001–1199 / 2001–2199
- 12:30: 1201–1399 / 2201–2399
- 15:00: 1501–1699 / 2501–2699

APIの `sortStatus=0, isDesc=0` を使い、受付時間の古い順で取得します。WEBと店頭の番号帯を数値順に再ソートしないため、同じ回の中で本当の受付順を維持します。

## 初回設定
GitHub Pages公開後、画面右上の「API設定」からAPIキーと店舗ID（または店舗NO）を登録します。値はGitHubファイルには書かれず、その端末のlocalStorageだけに保存されます。

## 現時点の書込み操作
添付API仕様書では以下を確認済みです。
- 呼出: `/reserve/call` — `reserveId` が必須
- 保留/案内: `/reserve/update` — `reserveId` と `version` が必須

一方、受付一覧 `/reservations` のレスポンスには `number / waitTypeId / waitTypeName / status / isCalling / counter...` はありますが、`reserveId` と `version` はありません。
そのため、既存受付を受付番号から安全に呼出・保留・案内するには、`reserveId/version` を取得できる正式手段の確認が必要です。v0.2では誤更新防止のため書込みボタンを無効化しています。

## アップロード先
既存リポジトリ `asoboon/asoboon-stamp` の `asoboon-staff-wait/` を、このフォルダの内容で置き換えてください。
