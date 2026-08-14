# BOONJUMP v4.2.0-rc — LIMIT BREAK FINAL / VALKYRIE HARD

Build: `2026-08-14-limit-break-final-rc-v420`

## Final balance
- ガチャで同じマシンが重複した場合:
  - **そのマシンを即 TUNE +1**
  - または **LIMIT BREAK素材へ変換**
- LIMIT BREAK素材変換: R 1 / SR 3 / SSR 8 / EXR 16 / UR 32
- 素材TUNE基礎コスト: R 2 / SR 6 / SSR 24 / EXR 48 / UR 96
- 高TUNE帯ほど素材コスト倍率: ×1 / ×2 / ×4 / ×8 / ×16 / ×32 ...
- SECRETは素材TUNE対象外。

## TUNE curve
- **Lv.1–50:** 旧仕様を完全維持し、+0.10% / Lv（Lv.50で+5%）。
- **Lv.51以降:** パーセント強化を積み続けず、LIMIT BREAKの「潜在飛距離」を解放する。
- Lv.51–100: +12m / Lv
- Lv.101–200: +6m / Lv
- Lv.201–400: +3m / Lv
- Lv.401–800: +1.5m / Lv
- Lv.801–1600: +0.75m / Lv
- 以降もレベル帯が2倍になるたびに1Lvあたりの伸びは半減。
- 各帯を完走すると潜在値は約+600m。TUNEレベル自体にハード上限は設けない。

LIMIT BREAKの潜在値は入力精度でしか実距離にならない。SUPER×3が最大、CRITICAL/GREAT/GOODでは大幅に減衰、MISSを含む場合はLIMIT BREAK距離ボーナス0。

## 4000m SOFT WALL
通常8マシンはすべて4000m突破可能。ただし4000m以降は対数型SOFT WALLで強く圧縮する。
上限値は画面へ表示しない。育成を続ければ伸びるが、4000m以降は記録更新が急激に難しくなる。

SECRETは独立した5000m級設計を維持する。

## HIGHWAY VALKYRIE HARD
ヴァルキリーの入力は **ACCEL / TURBO / NITRO** の3つのみ。SHIFT / OVERDRIVE入力は存在しない。

- ACCEL: period 940ms / SUPER ±0.014
- TURBO: period 1040ms / SUPER ±0.014
- NITRO: travel 920ms / SUPER ±0.013
- Valkyrie PERFECT HOLD: 22ms
- TURBOは停止ロックなしの固定二段加速。ランダムではなく学習可能。
- CRITICAL以上×3: MACH SYNC
- SUPER×3 + COMBO PRECISION 99.00%以上: DIVINE MACH
- SUPER×3 + COMBO PRECISION 99.70%以上: DIVINE MACH PERFECT
- ヴァルキリーが4000mを越えるには SUPER×3 + PRECISION 99.00%以上が必須。

## Compatibility
- save key: `asoboonBoonjump.v2` 維持
- machine IDs / gacha rates / 3-tap architecture 維持
- MACHINE GROWTH / AWAKENING 維持
- RUN gameplay / COMMON bytes は変更しない

## Release gate
このRCの4000m級記録を世界ランキングへ登録するには、同梱のRanking API v2.7 patchを先にGASへ反映すること。
旧APIはTUNE 50 / 旧距離上限で拒否するため、ゲームだけ先行公開しない。

実機 iPhone / Android / LINE で1プレイ確認後にproduction昇格する。

---


# ブーンジャンプ

Current Build: `2026-08-14-machine-growth-v400`
App meta: `Ver.4.0.0`

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

- 初回起動時に2〜12文字のニックネーム登録を必須化
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


## v4.0.0 MACHINE GROWTH

「記録の上限を見るゲーム」から、「好きなマシンを育てて記録を伸ばすゲーム」へ進化させる大型アップデートです。

各マシンはプレイ内容に応じて、以下の4軸が成長します。

- ENGINE: ACCEL精度で成長
- AERO: TURBO精度で成長
- BOOST: NITRO精度で成長
- AWAKENING: 3 COMBO精度と高判定連続で成長

成長Lvに明示的な上限表示は設けません。既存のTUNEは保存互換のため維持しますが、MACHINE SELECTでは距離MAXを表示せず、GROWTHとSPECIALを主役にします。

AWAKENINGが育つと、各マシン固有のSPECIALが解放されます。SPECIALは3 COMBOすべてCRITICAL以上で発動し、SUPER×3ではMAXIMUMになります。判定幅や入力速度は変更せず、成功したプレイの記録伸長ルートだけを追加します。

| machine ID | SPECIAL |
|---|---|
| `boon` | BOOST CHARGE |
| `wagon` | STABLE DRIVE |
| `buggy` | LUCKY BURST |
| `bike` | RED ZONE |
| `sport` | OVER NITRO |
| `ssr` | DIMENSION SHIFT |
| `princess` | ROYAL ASCEND |
| `valkyrie` | DIVINE MACH |
| `secret` | ROCKET OVERDRIVE |

既存save key `asoboonBoonjump.v2` は変更せず、schema 5でgrowth情報を後方互換追加します。旧プレイヤーは既存PLAY数/TUNE履歴から最低限の成長値を引き継ぎます。ranking endpoint / ranking key / machine ID / ガチャ率 / 3タップ判定幅は変更しません。

## COMMON UI DNA / SERIES PROFILE

品質基準は `assets/machines/COMMON_UI_DNA.md` を参照します。

- 完成MACHINE CARDを主役にする
- crop / distortion禁止
- safe-areaを尊重
- 主要操作領域は44×44 CSS px以上
- カード内の車名・レアリティを外側で過剰に重複表示しない
- CSS/JSそのものはRUNと共通化しない

JUMPでは同じCOMMONカードの下に、ACCEL / TURBO / NITRO / JUMP BEST / MACHINE GROWTH / SPECIALなどJUMP固有PROFILEだけを表示します。上限距離はUIへ表示しません。

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
