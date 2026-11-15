# ASOBooN公式LINEミニアプリ｜完成版・更新事故防止ルール

**施設責任者が承認した完成版：2026年11月15日。**
復元用ブランチ：`baseline/official-miniapp-complete-20261115`
（固定コミット `a146a1b918b340e4156002c00a880f79692abc05`）。
同じ内容がPR #220で本番公開され、GitHub Pages配信も確認済み。

## 正式な本番と旧資産

- **正式HOME**：`https://asoboon.github.io/asoboon-stamp/home.html`
- **認証済みLINEの別入口**：`miniapp-v2/production/index.html`。この入口は操作安全性のため軽量なネイティブ画面を維持し、受付枠・混雑予想のボードを正式HOMEと共有する。LINEの認証URLと環境IDは変えない。
- ルート`index.html`はスタンプ／QR等の旧URLを移行させる導線。ゲームとNFCの互換性があるため一括削除は禁止。通常起動は正式HOMEへ転送する。
- `home-legacy-*`などは本番HOMEの参照元ではなく履歴・復元素材。削除する前に全導線とリンク元を検証する。
- `?boonTheme=classic`は旧版を呼び出す原因になるため、どちらの正式入口でも使わない。

## 完成版で固定する「仕組み」

1. 土日祝の入場回は「10:00の回」「12:30の回」「15:00の回」の**3カード**。
2. 各カードには別々のWEB受付とLINE・現地受付が入るが、**同じ入場回**である。
   - 10:00の回：WEB `0030`・LINE/現地 `0029`（10:25頃）
   - 12:30の回：WEB `0032`（12:30）・LINE/現地 `0031`（12:50頃）
   - 15:00の回：WEB `0034`（15:00）・LINE/現地 `0033`（15:15頃）
3. **混雑予想は各回で合算**：`round((320 - verifiedWebRemaining - verifiedLineRemaining) / 320 * 100)`。片方が非公開、未検証、欠損なら`—`。残数だけで受付可能・公開中と判定しない。
4. WEB受付7:00／LINE・現地受付9:30。9:30前でも確認画面への導線は可、発券は不可。受付結果・呼出・取消・再受付の安全ルールを維持。
5. 不要な重複ボタン、電話番号、旧UIのフォールバックを復活させない。
6. **配色・チョコレート装飾・フォント等の見た目は固定しない**。操作構造、枠の組み合わせと安全性のみを合格基準として固定する。

## 自動で防ぐ仕組み

- 編集は`miniapp-v2/shared/`や`miniapp-v2/production/`の原本へ行い、`node miniapp-v2/build-production.mjs`で本番bundleとHTMLを同時生成。生成済み`production-app.js`だけの書き換えは禁止。
- ビルドは`release.json`にリリースIDを生成。各入口は`release-guard.js`から最新IDを取得し、古いHTMLがキャッシュされていたらクエリを変えて**1回だけ再読み込み**する。LINEの状態パラメータを保持し、通信不能でも受付処理は止めない。
- キャッシュ確認は起動直後の最大1.2秒まで。ユーザーがタップ・キー操作・送信を開始した後は**自動再読み込みを禁止**し、受付途中の情報を保持する。
- リリースIDには生成後のクエリ部分を正規化したHOMEのHTML本体とLINE入口の生成テンプレートも含める。HTMLだけを更新しても新しい版になる。
- HTML、JS、CSSのキャッシュキーはビルドで内容ベースに同期。これにより古いスクリプトが新しいHTMLに混ざる事象を抑止する。
- `tests/asoboon-official-release-lock.test.mjs`が、旧UIへの切替、両入口での同一デザインモジュール、3回の枠ID、混雑予想式、manifest・キャッシュキー、古いキャッシュからの復旧を検査する。
- このテストと従来の完成仕様テストを、`miniapp-v2-main-verify`と`newhome-flow-verify`の両方で必須実行する。エラーをテスト削除・緩和でごまかさない。
- GitHub Pagesへ公開した後は、配信中の`home.html`・`production-shell-loader.js`・`production-app.js`・`boon-home-v613-board.js`・`release.json`を取得し、生成版と照合する。

## 変更・復旧の手順

- 運営仕様・構造を変える場合だけ施設責任者の明確な変更指示が必要。色や装飾のみなら契約は変更しない。
- 失敗時は、専用保存ブランチと現行mainの差分から修正PRを作る。`main`を強制更新せず、AirWAIT APIや受付データを勝手に改変しない。
- GitHub Pages・端末・通信キャッシュの全てを絶対に制御できるわけではない。実機LINEでの確認も公開手順に残す。失敗時に「完成」と報告しない。

## 監査の参照

- 完成時の変更：PR #220
- 復元点：`https://github.com/asoboon/asoboon-stamp/tree/baseline/official-miniapp-complete-20261115`
- 本番URL：`https://asoboon.github.io/asoboon-stamp/home.html`
