# ブーンRUN v1.0.16 ULTIMATE HIGHWAY — QA REPORT

Build: `2026-08-11-playable-v1.0.16-ultimate-highway`
Client: `1.0.16`

## 変更監査

### 最終奥義UI
- PASS: 右下配置を廃止し、右上（燃料HUDの下）へ移動
- PASS: `最終奥義` を主ラベル化
- PASS: `1プレイ1回限り` を常時表示
- PASS: 未使用 `1/1` / 使用済 `0/1` / 発動中表示あり
- PASS: ゲームタップ面とbuttonを分離し、必殺技タップがジャンプへ伝播しない既存ガードを維持

### 高速道路 電光掲示板Tips
- PASS: 左上固定の電光掲示板UIを追加
- PASS: INFO / WARN / DANGER / SPECIAL の表示レベルを実装
- PASS: Tipsキューを実装。同時表示で上書きされない
- PASS: 最短表示2.4秒、通常障害物Tips 3.8秒、車種Tips 4.2秒
- PASS: ドローン `ジャンプ禁止`
- PASS: ロービーム `ジャンプ禁止`
- PASS: アーチ `1段ジャンプ`（バギーは屋根破壊FUEL−12を案内）
- PASS: 木箱は車種別の正解操作を表示
- PASS: `LOWBEAM` / `ARCH` のユーザー向けTips表記なし（カタカナ化）

### 障害物シグナル
- PASS: 回避対象 = 赤グロー + 橙コア + `!`
- PASS: 現在の状態で突破可能 = ライムグロー + 金コア + `✓`
- PASS: ピックアップARMOR / SPECIAL / BOOST / INVINCIBLEの状態に追従して色が変化
- PASS: グローは外周2層 + コア輪郭へ強化
- PASS: 取得アイテム側のシアン/ライム/金/紫シグナルは維持

### 横画面ランキング
- PASS: 左ペイン = 自分の順位・距離・フィルタ・状態
- PASS: 右ペイン = 世界ランキング
- PASS: 1〜5位を左列、6〜10位を右列へ流す横画面グリッド
- PASS: TOP1 / TOP2 / TOP3 を別シグナル
- PASS: 自分の行をシアンで識別
- PASS: 今日 / 今週 / 歴代、総合 / 車種別を維持
- PASS: SECRET通常総合除外の注記を維持
- PASS: 取得上限を20行へ絞り、初期描画を軽量化

## 構文・静的QA
- PASS: `node --check game.bundle.js`
- PASS: `node --check run-ranking.js`
- PASS: CSS parse error 0 (`tinycss2`)
- PASS: HTML duplicate id 0
- PASS: HTML local reference missing 0
- PASS: 本番GAS URL / RUN API 1.1.0 / RUN DB IDは変更なし

## v1.0.15 バランス保護比較
v1.0.15とv1.0.16をデータ定義で比較。

- PASS: PHYSICS 同一
- PASS: OBSTACLES寸法・当たり判定 同一
- PASS: FUEL_ZONES 同一
- PASS: PATTERNS 55件 同一
- PASS: SPECIALS 8台のduration/効果定義 同一
- PASS: 車両の燃料・ジャンプ・重力・hitbox・速度数値 同一

変更した車両定義はユーザー表示テキストのみ（障害物名のカタカナ化）。

## ランタイム・ハーネス
DOM/Canvasをスタブした120Hzゲームランタイムで8台を起動し、SPECIALを検証。

- ブーンピックアップ: PASS / 5.0s / 2回目発動不可
- スマートワゴン: PASS / 4.0s / 2回目発動不可
- ラッキーバギー: PASS / 5.0s / 2回目発動不可
- パワーバイク: PASS / 6.0s / 2回目発動不可
- ニトロスポーツ: PASS / 4.0s / 2回目発動不可
- コズミックファントム: PASS / 5.0s / 2回目発動不可
- プリンセス・スターライナー: PASS / 8.0s / 2回目発動不可
- 無敵のロケットアソブーン人間: PASS / 4.0s / 2回目発動不可

## 備考
この環境のChromium headlessはDBus待ちで画面キャプチャを完了できなかったため、実端末のピクセル単位の見え方については公開後のiPhone/LINE実機確認が最終確認になります。構文、DOM構造、CSS解析、ゲームランタイム、バランス定義の監査は実施済みです。
