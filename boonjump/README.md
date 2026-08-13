# ブーンジャンプ

Current Build: `2026-08-13-first-nickname-webp-v330`
App meta: `Ver.3.3.0`

## ASOBooN MACHINE SERIES 共通仕様

BOONJUMP / BOONRUN の共通マシン素材は **方式B** で管理します。

- 正本: `assets/machines/`
- BOONJUMP runtime copy: `boonjump/assets/`
- BOONRUN runtime copy: `boonrun/assets/`
- COMMON変更後は `assets/machines/sync-machine-assets.sh` で同期
- 同期後は `assets/machines/verify-machine-assets.sh` の `RESULT: PASS` を必須とする
- 同期後はService Worker / cache buildを確認・更新
- GAMEPLAY性能・VFXはゲーム間で共通化しない

基本原則:

> 機体のIDENTITYは共通、GAMEPLAYは独立。

## 9マシン

| machine ID | 正式名称 | MACHINE CARD |
|---|---|---|
| `boon` | ブーンピックアップ | `01-boon-pickup.webp` |
| `wagon` | スマートワゴン | `02-smart-wagon.webp` |
| `buggy` | ラッキーバギー | `03-lucky-buggy.webp` |
| `bike` | パワーバイク | `04-power-bike.webp` |
| `sport` | ニトロスポーツ | `05-nitro-sport.webp` |
| `ssr` | コズミックファントム | `06-cosmic-phantom.webp` |
| `princess` | プリンセス・スターライナー | `07-princess-starliner.webp` |
| `secret` | 無敵のロケットアソブーン人間 | `08-secret-rocket.webp` |
| `valkyrie` | ハイウェイ・ヴァルキリー | `09-highway-valkyrie.webp` |

MACHINE CARDの01〜09は**シリーズ登場順**です。ゲーム内表示順・ガチャ順・性能順を意味しません。

`machine ID` は保存データ・ランキング・内部参照との互換性があるため変更禁止です。

機械可読なIDENTITY正本は `assets/machines/machine-registry.json` です。JUMP距離・判定・ガチャ・チューン等のGAMEPLAY値はregistryへ入れません。

## BOONJUMP所有領域

- ACCEL / TURBO / NITRO
- 飛行
- AWAKENING
- 着地
- JUMP専用VFX / WORLD FX / SCREEN FX
- 距離・チューン・ガチャ・JUMP固有ゲームバランス

BOONRUNのCRITICAL / 障害物 / 燃料 / ドローン / 道路 / RUN ULTIMATEには影響させません。

## 3コンボ入力

ゲーム本編の判定に乱数は使いません。ガチャだけが運要素です。  
ACCEL / TURBO / NITROは学習・再現可能な操作として設計します。

## ランキング

現行UIではプレイ記録が世界ランキングへ自動参加します。

- 未設定時はゲスト名を自動発行
- 表示名は後から変更可能
- 今日 / 今週 / 歴代 / マシン別ランキング
- 1人につき各ランキング1ベストを基本とする
- SECRETは通常車と別扱いの既存仕様を維持

ランキングendpoint / ranking key / save keyは、アセット整理を理由に変更しません。

## COMMON素材

COMMON正本:

- body
- front / rear wheel
- shadow
- MACHINE CARD
- ゲームに依存しないマシンIDENTITY素材

JUMP専用VFXは `boonjump/assets/vfx/` で独立管理します。

## v3.2.8 UI DNA safety pass

COMMON UI DNAの初回適用として、MACHINE CARDとガチャカードは正本比率 `1024:683` を保持し、`object-fit: contain` でcropを禁止しました。マシン切替矢印・サウンド操作も44px以上の操作領域へ統一しています。

この変更は表示・アクセシビリティのみで、ACCEL / TURBO / NITRO / 距離 / ガチャ確率 / ランキングロジックは変更していません。

## v3.2.9 MACHINE SELECT responsive fix

スマホ幅でMACHINE SELECTの内部grid trackがmax-content幅へ膨らみ、390px端末でもselector shellが約720pxになるケースを修正しました。`#garageScreen`を`minmax(0,1fr)`の1列gridへ固定し、shell / stage / rail / profileをすべてviewport由来の`width:100% + min-width:0`へ統一しています。

完成MACHINE CARDを画面幅いっぱいに近いサイズで表示しつつ、左右矢印はカード横幅を奪わないoverlay配置へ変更。横スクロールや右側切れを防ぎます。Gameplay値、表示順、ガチャ、ランキング、save keyは変更していません。

## COMMON UI DNA / SERIES PROFILE

品質基準は `assets/machines/COMMON_UI_DNA.md` を参照します。

- 完成MACHINE CARDを主役にする
- crop / distortion禁止
- safe-areaを尊重
- 主要操作領域は44×44 CSS px以上
- カード内の車名・レアリティを外側で過剰に重複表示しない
- CSS/JSそのものはRUNと共通化しない

JUMPでは同じCOMMONカードの下に、ACCEL / TURBO / NITRO / JUMP BEST / MAX / TUNEなどJUMP固有PROFILEだけを表示します。

## 更新ルール

COMMONを変更する場合:

1. `RUN-JUMP 連携ログ`へ実装前報告
2. 必要ならRUN担当から意見を受け取る
3. `assets/machines/` の正本を変更
4. `sync-machine-assets.sh` でRUN/JUMPへ同期
5. `verify-machine-assets.sh` が `RESULT: PASS` であることを確認
6. SHA-256 / パス参照を確認
7. Service Worker / cache buildを更新
8. 実装後の結果をRUN-JUMP連携ログへ報告

ゲーム側runtime copyだけを直接編集して正本化しないでください。

## 共通仕様正本

`00_SHARED_SPEC / ASOBooN MACHINE SERIES 共通仕様 v1.1`

RUN/JUMP間の変更通知・アイデア共有は、同フォルダの

- `RUN-JUMP 連携ログ`
- `RUN-JUMP アイデア共有ボード`

を使用します。


## v3.3.0 — First Nickname + Lightweight Vehicle Body

- 初回起動時にニックネーム登録を必須化（2〜12文字）。以後は端末に保存し、ランキング表示名として利用。
- 初回登録画面はキャンセル不可。登録後はランキング画面から変更可能。
- 9台の主要body画像に透過WebP軽量版を追加し、WebP優先・PNG fallbackで表示。
- COMMONのPNG正本は変更せず、BOONJUMP runtime向け最適化派生として扱う。RUN gameplay / COMMON bytesには影響なし。
- ACCEL / TURBO / NITRO / 距離 / ガチャ / AWAKENING / ranking endpoint / save key / machine IDは変更なし。
