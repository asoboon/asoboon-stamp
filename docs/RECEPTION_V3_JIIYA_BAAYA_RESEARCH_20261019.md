# ASOBooN｜じいや・ばあや視点の高速化レビュー＋公式資料リサーチ（2026-10-19）

**状態：DESIGN ONLY / DRAFT #112。** 営業時間中、本番のコード・Github Pages・Cloudflare Workers・D1・LINE Developers・AirWAITは一切変更しない。

## 役割の明示

これは**実際に外部の別AIエージェントへ依頼した結果ではなく**、コードレビューを「じいや＝バックエンド・セキュリティ・可用性」「ばあや＝親子利用のUX・体感速度」に分けた仮想専門家レビューと、LINE/Cloudflare/web.devの一次資料リサーチ。

## じいや：根本原因の切り分け（安全性から）

1. **現在の5秒の内訳はまだ不明。** 10/19に測った0.86秒は初回HOME要素が描画された瞬間。公式LINEのリッチメニューを押した瞬間〜LINE WebView起動〜WebドキュメントのnavigationStart以前の時間は含まれない。Webブラウザだけで「お客様が押してから使えるまで」を測ったことにはならない。**LINE実機の撮影とブラウザ内部タイムラインを両方使う。**
2. **受付遷移の追加バンドルが大きい。** 現行 production-routes.js約148KB、production-routes.css約90KB（gzip/ネットワーク送信量は別途実測）。現行コードはユーザーの受付クリック後に両方を要求する。まず受付専用ファイルを分離し、ホーム表示中の低優先プリフェッチを冷間・温間で比較する。通信が弱いときに全ファイルを高優先preloadするのは逆効果もあり得る。
3. **受付ブートがall-or-nothingである。** shared/reception.js の boot は waitForLine、D.getCurrent({force:true})、GET healthとGET waitTypesを allSettled で同時開始するが、すべて解決するまで表示確定できない。フォームを先に描画、営業日・枠・LINE認証・Worker状態を4レーン並行検証する。**確定ボタンだけは全レーンが最新・真正・成功のとき有効化**。
4. **LIFF初期化は正式な結果管理にする。** 2026/07のLINE開発者向け記事によると、liff.readyはliff.init成功時に解決するが、initが失敗してもrejectしない。liff.readyだけ待つと永久に待つ。初期化のPromiseを1箇所で管理して成功・失敗・タイムアウト・後着SDKの回復を定義する。URLのprimary/secondary redirectとliff.stateを壊さない。
5. **Cronは全エッジPOPを暖めない。** Cloudflare Cache APIはデータセンターごとで共有されない。CronでD1に検証済み公開データを保管することは有効だが、すべての顧客が必ずローカルエッジキャッシュにhitする保証はない。D1 hitとedge hit、AirWAIT実呼出を独立測定。
6. **本人確認をキャッシュしない。** トークン、個人の受付履歴、セッション所有権、確定の可否を公共キャッシュに置かない。受付発行とキャンセルはWorkerが従来どおり再認証・所有者照合する。本人の情報はログ送信しない。

## ばあや：お客様が速いと感じる条件

1. **「画面が見えた」ではなく「受付回と人数が選べる」を優先する。** 当日受付の操作準備は通信を待たずに表示できる。ただし「まだ最新情報を確認中」表示と、確定ボタン無効を明示。
2. 画面切替直後の白画面・読み込み表示を避ける。ボタン操作から200ms以内に視覚フィードバックを返す目標（現場で検証）。お客様が待っている理由は一行で説明する。
3. 混雑残数・カレンダー・サプライズ投票は受付操作を圧迫しない優先順位にする。受付の本人確認と必須データが最優先。見栄えのエフェクトや効果音がリソースを奪う場合は後回し。
4. 過去の有効な受付券がある場合は、既知の**受付番号だけ仮表示**してよいが、呼出中・案内済みなどの状態をローカルキャッシュから「現在の状態」として断定しない。
5. 実際の利用テストは親が初めて操作する想定で、開始から「受付を完了できた」までのタスク時間、誤タップ、再操作、エラーを記録する。体感をイベントメトリクス1本に還元しない。

## 公式ディープリサーチで確認できたこと

| 公式資料 | 確認結果 | ASOBooNでの判断 |
|---|---|---|
| LINE LIFF Pluggable SDK | npm版で必要なAPIのみ組み込むと最大約34%サイズ削減、CDN版では利用不可 | **候補**。SDK方式切替は認証・通知・ディープリンクの互換テストが必要。本番即採用しない。 |
| LINE LIFF Release notes | 2.22.0と2.29.0にセキュリティ懸念による非推奨告知。2.31.1以降を使うよう案内 | **バージョン固定前に最新の安全リリースを再確認**。サイズだけで古い版を採用しない。 |
| LINE liff.ready tips | readyは成功通知。init失敗時には永遠にpendingのままでrejectしない | 完了だけでなく失敗・SDK後着・リトライの状態を明示的に設計 |
| LINE LIFF developing guide | ページを新しく開くごとにliff.initが必要。primaryとsecondaryのリダイレクトにも注意 | 省略不可。画面遷移は同じdocument内で行い、不要な再ページロードは避ける |
| Cloudflare Workers Cache API | Cache APIはデータセンターごとで、他POPへは自動複製されない | 事前Cron = 全ユーザー最速とは断言しない。D1 fallbackを測る |
| Chrome web.dev INP | 描画・タップ応答は別指標。重いJS評価、同期レイアウトなどが操作を遅くする | p75の操作応答・実タップからフォーム表示まで計測 |
| web.dev Resource Priority/Preload | 重要JS/CSSを優先、非重要fetch/assetを後ろへ。過剰なpreloadは競合を招く | ホーム表示と受付モジュール準備を二段階に分け、モバイル低速回線で比較 |

**公式一次資料**
- https://developers.line.biz/en/docs/liff/pluggable-sdk/
- https://developers.line.biz/en/docs/liff/release-notes/
- https://developers.line.biz/en/tips/2026/07/30/liff-ready/
- https://developers.line.biz/en/docs/liff/developing-liff-apps/
- https://developers.line.biz/en/docs/line-mini-app/develop/performance-guidelines/
- https://developers.cloudflare.com/workers/runtime-apis/cache/
- https://developers.cloudflare.com/workers/cache/
- https://web.dev/articles/optimize-inp
- https://web.dev/articles/fetch-priority
- https://web.dev/articles/preload-critical-assets

## 候補の優先順位（安全性×体感）

| 優先 | 施策 | 根拠 | リスク／検証 |
|---|---|---|---|
| P0 | 「LINEのボタンタップ→画面表示→受付タップ→フォーム操作→確定可」の分離計測 | 0.86秒と体感5秒の乖離 | LINE WebViewコンテナの前処理はWeb performance APIだけでは測れない |
| P0 | 受付ページのクリティカルJS/CSSを分割して先行表示 | 追加route-assetsロードの滝を解消 | 旧経路・QR・多言語・戻る操作を破壊しない |
| P0 | 4レーンの受付ブート・単一LINE init Promiseを共有 | allSettledの表示遅延を解消 | 確定ゲートはfail-closed、データ世代・19時切替・認証失敗に注意 |
| P1 | 最低限の営業日・枠をread-only集約してD1から返す | GET数とpayloadを削減 | 新しい情報を誤認しない。予約発行とは分離 |
| P1 | 非重要API・アニメーションの通信優先度を下げる | mobile WebViewでの帯域とCPU競合を減らす | 省電力端末・低速回線で比較 |
| P2 | 新しい安全バージョンのLIFF npm Pluggable SDK検証 | LINE公式「最大約34%」 | バージョン・通知・深いリンク・トークンの相互運用 |
| P2 | エッジキャッシュ・D1の局所性／TTL改善 | AirWAIT問い合わせ削減 | 営業日・枠変更の正確性は速度より優先 |

## 必須のテストマトリクス

- iOS/AndroidのLINEアプリ内、4G・館内Wi-Fi、初回・再訪、LIFF未承認状態。
- SDK未到着、6秒超の後着、liff.init拒否、openid不可、LINE通信429/5xx、AirWAIT残数不明。
- 平日通常・月曜平日特定・土日祝、9:30受付開始境界、19:00リセット、祝日・臨時休館。
- 100/320同時、枠0名、重複タップ、前回受付の復元・本人キャンセル、LINE通知3本柱。
- 旧URL・QRからのスタンプラリー、呼び出し状態の表示、多言語表示・戻る操作。
- メトリクスは原則端末内表示、個人情報・LINEユーザーID・トークン・受付番号は記録/送信しない。

## 結論

最初に試すべきは**追加route資産の最小化と受付操作フォームの先行描画**。それを正しく測るために、LINE WebView起動自体の遅延と、ページ内の認証/通信を分離する。**プラガブルSDK・新API・認証変更は一気に入れない**。

レビュー完了まではこの文書と実験をDraft #112に留め、営業時間中の本番は一切変更しない。
