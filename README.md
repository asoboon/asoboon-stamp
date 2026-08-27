# ASOBooN ミニアプリ

GitHub Pagesへそのまま配置できるASOBooN本番リポジトリです。

## 本番系

ルート直下の `home.html` / `onsite-reception-v11.html` / `staff-autocall.html` などはASOBooN現場運用の正本です。現場稼働を優先し、販売版の大規模変更は直接当てません。

## Commercial Edition

`product/` は他施設へ導入できるよう再設計した販売版です。

- AirWAIT APIキーをブラウザ/GitHubへ置かない
- Google Apps Scriptバックエンド経由でAirWAITへ接続
- requestIdによる重複操作防止
- reserveId先頭0 / Spreadsheet日付型をサーバー側で正規化
- 顧客受付UI / スタッフコンソールを同梱
- 呼出API異常時はAUTOを安全停止
- AirWAIT呼出仕様はScript Propertiesで差し替え可能
- 導入手順 / セキュリティ基準 / 障害対応 / 商用化ゲートを文書化
- GitHub Actionsで秘密情報パターンとJavaScript構文を検証

販売版の入口: `product/README.md`

## ブーンジャンプ

- Version: **2.3.5**
- Build: `2026-08-07-bulk-best-registration-v13`
- ランキング登録: **任意**
- 自動送信・未送信キュー: **なし**
- 一括登録: 記録とトロフィー画面から最大8台の自己ベストを1通信で登録
- ランキング表示: 今日TOP10 → 今週TOP10 → 歴代TOP10 → 全8マシンTOP3
- 保存方針: 歴代／今週／今日のいずれかを更新する記録だけ保存
- 世界ランキング保存先: Google Apps Script + Googleスプレッドシート
- 必須Apps Script API: **2.3.5**

## ASOBooN公開手順

1. mainへ反映します。
2. Apps Script変更がある場合は対象Code.gsを再デプロイします。
3. GitHub Pagesのデプロイ成功を確認します。
4. iPad/LINE実機で受付・戻る導線・スタッフ画面を確認します。

## 重要

販売版へASOBooNを移行する際は、フロントからAirWAITへの直接接続を廃止した後に、現在利用中のAirWAIT APIキーをローテーションしてください。
