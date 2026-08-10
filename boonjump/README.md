# ブーンジャンプ V2.6.1 — MASTERPIECE EDITION

Build: `2026-08-10-masterpiece-v1`

V2.6.0 RIVAL CHASEを正本に、ゲームバランスを変更せず、RIVAL体験・トロフィー最終演出・軽量性・セーブ互換性を最終研磨した公開候補版です。

## RIVAL CHASE FINAL POLISH

NEXT RIVALは従来どおり、現在マシン別ランキングの自分の1つ上を、既存dashboardキャッシュからスナップショットします。

飛行中:
- `NEXT RIVAL · #順位`
- ライバル名 / あと○m
- 進捗バー
- 残り100m以内: `LOCK ON`
- 残り20m以内: `PHOTO FINISH`
- 突破: `OVERTAKE` / `+○m 突破！`
- 同距離: `PRECISION BATTLE`
- CanvasのNEXT RIVALライン

リザルト:
- 距離で突破: `OVERTAKE! +○mで突破！`
- 同距離でPRECISION勝利: `同距離・PRECISION勝利！`
- 1〜5m差: `PHOTO FINISH!!`
- 6〜20m差: `SO CLOSE!!`
- 完全同着にも専用文言

RIVAL情報はプレイ開始時点のキャッシュです。実順位はランキング登録後に反映されます。

## 通信 / 軽量性

- RIVAL専用APIなし
- 飛行中ポーリングなし
- `getMachineRival()`はローカルキャッシュ参照のみ
- **飛行中の追加通信0回**
- RIVAL取得失敗でも通常プレイ継続
- トロコン演出の紙吹雪を常設72 DOM要素から、達成時のみ動的36要素へ変更
- 演出終了後は紙吹雪DOMを破棄

## 本当の38 / 38トロコン

従来の大演出内にV2.4時代の `27 / 27` 表記が残っていたため整理しました。

- 既存38トロフィーの定義・取得状態は変更しない
- `trophyComplete`（V2.4までの26個取得条件）は既存トロフィーとして保持
- **現行38個すべて取得した瞬間だけ** `38 / 38 ALL TROPHIES COMPLETE` の最終演出を1回発動
- `grandCompleteAt` を保存し、同じ端末で毎起動ごとに最終演出を繰り返さない
- V2.6.0以前の保存に `grandCompleteAt` が無くても自動補完
- OSの「視差効果を減らす / reduced motion」設定中は、静止版の最終画面を確実に表示

## バランス保護

V2.6.0から以下を変更していません。

- 8台のCARS性能
- ACCEL / TURBO / NITRO判定幅
- 各マシンの固定ゲージ軌道
- 通常飛距離計算
- 3 COMBO PRECISION計算
- LIMIT BREAK条件 / 倍率
- ガチャ主要ロジック
- チューン
- SECRETの距離・ランキング方針

## セーブ

- STORE_KEY: `asoboonBoonjump.v2` 継続
- BACKUP_KEY: `asoboonBoonjump.v2.backup` 継続
- schema: 7
- V2.6.0 schema 6から自動移行
- 車庫 / チューン / 自己ベスト / プレイ数 / PRECISION / LIMIT BREAK / トロフィーを保持

## Apps Script

**再デプロイ不要です。**

V2.6.1はバックエンドAPIを追加していません。V2.5.1 APIをそのまま使用します。同梱`Code.gs`は参照用で、現在V2.5.1が稼働している場合は差し替え不要です。

## 公開

GitHub更新後、初回確認:

`/boonjump/?v=261`

Service Worker build:

`2026-08-10-masterpiece-v1`
