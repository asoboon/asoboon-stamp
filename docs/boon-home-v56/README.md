# BOON START HOME v5.6 | ゼロベース再設計
日付：2026-11-06

## ゴール
従来のHOMEの色・影・矢印だけを変更する方法をやめ、画面構造自体を「操作デッキ」として再構成した。

### 画面構成
1. START ZONE：実在の受付スタートを一つのオレンジCTAとして明確化。
2. 01 呼出状況：濃色の独立パネルに、実在の呼出状況ボタンを移動。押す意味が見える白いチケット風カード。
3. 02 今日の営業 × 03 あそべる時間：隣り合った2つの独立タイル。左は既存営業区分・利用時間・閉館時刻、右は既存タイマーへの操作。
4. 04 本日の混雑状況：3時間帯の受付枠を並べた濃色の比較ボード。元々のWEB/LINE枠を対比。実データがないときは作らない。

### 実装と不変条件
- JSは実DOMノードの移動だけを担当。既存受付・AirWAIT・通知・取消・営業区分・受付残り人数の本体処理は変更なし。
- 新しいWEB受付ボタンは追加しない。以前撤去した重複ボタンは0個。
- サプライズ投票のHOME入口は引き続き非表示。
- 呼出中緑GOの条件は従来どおり正式callingのみ。前0組でもGOにしない。
- パレットはターコイズ #28C7BE、背景 #E3FFF6、パッションオレンジ #FF7A00。
- 7言語の画面見出し、操作文言、320px/390px/430px幅に対応。
- 旧デザイン表示に戻す場合はURLの boonTheme=classic を利用可能。
- 初回HOMEの既存バンドル139,918 bytes/gzip37,369 bytesで不変。v5.6は遅延デザインCSS/JSのみ。
- スクリーンショットの人数・時間はすべてQA用の模擬値。実際の営業状況を意味しない。

### 検証
- Node自動テスト310/310件合格
- 本番構成Playwright101/101件合格。4画面・7言語・3画面幅の実操作テスト含む。
- 既存受付・呼出・各状態のブラウザ57/57ケース合格。
- LINE SDK/Worker/AirWAITの実接続はテストではモック化し、実受付は作成していない。
- 実LINE内iOS/Androidの受付→通知→取消のE2Eは未確認。

### 成果物
- comparison/HOME_v55_vs_v56_same_QA_data.png：同一の模擬残数の比較画像
- visual/v56_320_QA_mock.png, visual/v56_390_QA_mock.png, visual/v56_430_QA_mock.png
- qa/screens/01.png〜19.png：状態検証
- miniapp-v2/production/boon-home-v56-layout.js, boon-home-v56.css：画面の新しいDOM・CSS
- miniapp-v2/build-production.mjs：デザイン追加読み込み
- tests/asoboon-production-browser.spec.js：新レイアウトとルート/言語/タッチ操作の検証

### 復旧
- ビジュアルのみ変更前にするには ?boonTheme=classic
- コードとして完全に戻すには該当Gitコミットをrevertし、node miniapp-v2/build-production.mjsを再実行する。
