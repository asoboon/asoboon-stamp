# ASOBooN公式LINEミニアプリ｜品質・修正ガイド（2026-11-10）

## 正本と入口
- 本番の正本は `https://asoboon.github.io/asoboon-stamp/home.html`。LINEミニアプリ `2009884613-ELc6kolf` の設定先は `miniapp-v2/production/env-facility.js` で確認する。
- `miniapp-v2/production/index.html` は別の直通・診断用入口。公式HOMEの装飾／折りたたみと同一とは限らない。公式HOMEのUI評価には `home.html` を使う。
- `home.html` のCSS／JSは `miniapp-v2/production/production-shell-loader.js` が読み込む。直接、生成済み `production-app.js` を編集しない。

## 誰が値を決めるか
- 営業区分と休館：`miniapp-v2/production/home-v38.js` と営業日APIが正本。HOMEの表現は `boon-home-v56-layout.js`。
- `boon-home-v613-board.js` の `translateBusiness` は翻訳表示だけを管理。元の日本語値が `読み込み中 → 休館日` のように変わったら必ず元値を更新し、前の翻訳で上書きしない。
- 休館日と「受付番号の呼出確認が終了」の表示は別状態。 `offday` と `closed` を混同しない。
- 混雑予想のユーザー確定仕様は **320人＝100%**。WEB＋LINEの公開残人数から算出した参考値であり、現場の実測入館者数ではない。不明／非公開の人数を0と決めつけない。
- 受付数のチェック「人数の条件は満たしています」と、受付枠が空いていることは別。 `reception-v7.js` で区別する。
- 予約の発行、二重送信防止、取消、LINE本人認証、呼出通知、AirWAIT APIの意味をUI改修で変更しない。

## CSSの修正先
- 最初：`production-app.css`（ビルド成果）、`choco-mint-nav-v8.css`、`choco-mint-unified-v9.css`
- HOMEのオプション層：`boon-mint-v51-preview.css`、`boon-mint-v53-passion.css`、`boon-home-v56.css`、最終補正 `boon-home-v613-board.css`
- 遷移先画面：遅延読込 `production-routes.css` に `bundle-sources.json` の `routeStyles` が結合される。視認性の最終補正は既存の `access-legibility-v11.css`。
- 今後の改修では新しい上書きCSSファイルを追加する前に既存の担当ファイルを編集し、実際の読み込み順を検証する。

## リリースの合格条件
1. `node miniapp-v2/build-production.mjs` のあと `node miniapp-v2/build-production.mjs --check` が成功。
2. `npm run test:miniapp-production` の全件と `node --test tests/boon-home-v613-contract.test.mjs tests/boon-home-v56-structure-contract.test.mjs` の全件が合格。
3. 320／375／390／430／768pxで、横はみ出し・44px未満の主要タップ操作・12px未満の重要説明をチェック。
4. 本番mainへのPRマージ前に必須CIが全件成功し、マージ後のGitHub Pages deployと公開スクリプト更新を確認。
5. 100点の最終認定にはLINEアプリ実機で、実際の営業中の受付・呼出・通知・取消の状態別表示を確認する。モックでのE2E合格だけでは「実機100点」を宣言しない。
