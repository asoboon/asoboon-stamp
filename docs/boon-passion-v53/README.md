# BOON START v5.3｜#FF7A00 パッションオレンジ採用

**完了日：2026-11-06。公開中アプリ・公式LINE・AirWAIT・受付ロジックは変更していない。**

## 採用した色
- 主色：ターコイズ **#28C7BE**（維持）
- 背景：ペールミント **#E3FFF6**（維持）
- 操作・楽しさの新アクセント：パッションオレンジ **#FF7A00**（今回の選択）
- オレンジ上の文字：濃い茶 **#492300**（白文字に比べ視認性の高い組み合わせ）
- エラー・呼出近接・正式calling緑GO：意味を持つ状態色として**変更なし**。

**以前の蜜柑色 #FFA83F を新たな主アクセントには使用しない。** 既存v5.2のCSSはベースとして残すが、追加のv5.3 CSSが後から適用され、主CTA・選択状態・料金表示・成功画面は #FF7A00 になる。変更箇所はCSSだけで、JavaScript／予約・通知・キャンセルの業務ロジックは不変。

## 反映箇所
1. ホームのSTARTラインとメインCTA、READYタグ、オレンジの円形アクセント。
2. 受付枠の選択中カードと進行ステップ。
3. 人数を増やす実ボタン（有効なときのみ）と合計料金の強調。
4. WEB受付・案内・あそびコンテンツの装飾アクセント。
5. 受付成功が確認できた場合のみ出る完了チェックとお祝いパネル。

## 変更したファイル
- `miniapp-v2/production/boon-mint-v53-passion.css`：新規CSS専用オーバーレイ。
- `miniapp-v2/build-production.mjs`：フラグが付いたプレビューでのみ上記CSSを読み込むようにする。
- `miniapp-v2/production/production-shell-loader.js`／`home.html`：ビルド生成物、URLの資産ハッシュを更新。
- `tests/boon-mint-production-preview-browser-qa.cjs`：選定パレットおよび実際のボタン・枠・＋ボタン・成功チェックのCSS確認を追加。
- `tests/boon-mint-passion-v53-contract.test.mjs`：コントラストと状態・公開フラグの保持を検証。
- `tests/boon-mint-production-preview-default-browser.cjs`：プレビューなしで新アセットが読み込まれないことを検証。
- `docs/boon-passion-v53/qa`：17場面のブラウザ画像・検証JSON。
- `docs/boon-passion-v53/comparison`：修正前後の6場面比較画像。
- `docs/boon-passion-v53/passion_orange_v53_key_screens.png`：ホーム／人数／受付完了の一覧。

## テスト結果
- **51/51合格**：17状態×320/390/430px。通信はテストモック。横オーバーフロー・未処理JavaScriptエラーなし。
- **289/289合格**：既存Node回帰と新パッションオレンジ契約テスト5件。
- **通常HOMEは影響なし**：`?boonTheme=mint`がないと追加テーマCSS／JSを読み込まない。
- **本番ビルドチェック合格**：既存初回バンドル139,871 bytes／gzip37,349 bytesを維持。
- **waiting前0組で緑GOなし。callingのみ緑5灯とGO。** 通信エラーの受付番号・最終確認時刻の取扱いも維持。
- 実際のLINE内端末・実AirWAIT／呼出通知・保護者の初見テスト：**未確認**。

## 試し方（Pro Mac、開発用のみ）
作業ブランチ：`feat/boon-mint-passion-orange-20261106`

```bash
cd /tmp/hime-boon-passion-v53-20261106
python3 -m http.server 4180 --bind 127.0.0.1
# http://127.0.0.1:4180/home.html?boonTheme=mint
```

**注意：ブラウザのプレビューは、本番用の既存API設定を使うため、実受付・取消操作を行わないこと。** 本テストは外部通信を遮断し、LINE／Gatewayの応答を完全モック化して実施した。

### ロールバック
- v5.3だけを外す：ビルド設定の追加`boon-mint-v53-passion.css`読み込みを除き、既存v5.2を表示させる。
- 全ミントプレビューを外す：URLから`boonTheme=mint`を削除。現在の通常HOMEへ戻る。
- 本番公開はしていないので、公開中アプリへの復旧操作は不要。

## 品質判定
**デザイン色の採用・本番相当のローカルプレビュー・ブラウザとNode自動検証は完了。公開は保留。**
