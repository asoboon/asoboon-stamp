# BOON START HOME v5.5｜4導線のアフォーダンス・シグニファイア実装

作成日：2026-11-06

## 変更の目的
従来のHOMEでは情報の色は刷新されても、押せる場所と押した後の結果が伝わりにくい。選定済みのミントソーダとパッションオレンジ #FF7A00 を維持し、以下の既存4導線を操作として明確化した。

| 既存の項目 | 見せること | 既存の遷移 |
|---|---|---|
| 呼出状況 | 「呼出状況を見る」と番号・待ち順・入場案内。暖色の副ボタン、分かりやすい矢印、立体影・押下動作 | callstatus |
| 営業区分 | 実際の営業区分・利用時間・閉館時刻を並べ、その下に「営業区分・利用時間を詳しく見る →」を明示 | timeguide |
| 本日の混雑状況 | 受付枠の残り人数であることを明示。既存WEB/LINEの受付方法を立体ボタンとして区別。通信失敗時の既存案内も押せる形に | WEBは既存AirWAIT、LINEはreception |
| アソブーンタイマー | 「遊べる時間を計算する →」。当日の有効な計算結果があれば「計算結果を確認する」に切替 | timeguide |

## 守った条件
- WEB受付ボタンを新規追加しない。以前不適切に追加された boOnV5WebReception は引き続き0個。
- LINE受付、AirWAIT、料金、受付の営業日判断、呼出判定、通知、キャンセル、通信エラーの処理は変更しない。
- バックエンド由来ではない実数・待ち時間を作らない。混雑欄は館内のリアルタイム人数ではなく、各受付枠の残り人数。
- 緑GOは正式callingのみ。waitingで前0組でも入場OKにはしない。
- 無効状態の操作対象に活性ボタンの装飾を付けない。
- サプライズ投票はHOME非表示のまま。
- 標準HOMEを読み込む最初のバンドルは139,918B / gzip 37,369Bで不変。変更は既存ミントの遅延CSS/JSだけ。
- URLの boonTheme=classic は以前のビジュアルを表示できる緊急切戻し経路として維持。

## 差分
- miniapp-v2/production/boon-mint-v51-preview.js：既存のDOM上に、進む先を伝える文言・操作サインを重複なしで追加。
- miniapp-v2/production/boon-mint-v53-passion.css：押せるカードと非活性カードを視覚的に区別するレイアウトとタッチフィードバック。
- miniapp-v2/production/production-shell-loader.js と home.html：キャッシュハッシュ更新のみ。
- tests/boon-home-v55-affordance-contract.test.mjs：操作の意味と既存ルールの分離を確認。
- tests/asoboon-production-browser.spec.js：320/390/430pxの可視操作領域・実際の画面遷移・保存済みタイマーを確認するテスト。
- docs/boon-v55-affordance/qa：19状態のブラウザ画像とテストの元データ。
- docs/boon-v55-affordance/comparison/home_v54_vs_v55.png：同一状態のHOMEの前後比較。

## 検証結果
- Nodeの全既存回帰・契約テスト：304／304 合格。
- Headless Chrome：19状態×320/390/430px＝57／57合格、横方向のはみ出しなし。
- 追加の4導線の操作テスト：クリックで実際の timeguide、callstatus、reception へ遷移することを検証。
- 初回バンドルの容量不変（139,918B / gzip37,369B）。
- 実LINE iOS/Android とAirWAIT通し試験は対象外、未確認。自動テストはLINE／Gatewayをモック化し、実予約を作成していない。

## 反映と復旧
本番PRのCIを通し、通常マージルールを守って反映する。差し戻し時は本差分のコミットをgit revert後、node miniapp-v2/build-production.mjsを実行。見た目だけ戻す緊急操作はURLの ?boonTheme=classic を使用する。業務バックエンドをロールバックする必要はない。
\n## 多言語\n標準HOMEの操作ラベルは既存の言語切替に追従（日本語／英語／簡体中文／ベトナム語／ネパール語／韓国語／クルマンジー語）。英語→日本語に戻せることを画面操作テストで確認。\n