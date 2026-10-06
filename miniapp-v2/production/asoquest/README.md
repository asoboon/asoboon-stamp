# ASOQUEST — LINE MINI App

ASOBooN公式LINEミニアプリ内で動く、1日完結の館内クエストです。
既存スタンプラリーと公式ホームは別レーンのまま維持します。

## Game
館内の6スポットでパーツを集め、最後に ENGINE START を読み取るとクリアです。

1. ENGINE
2. WHEEL
3. HEADLIGHT
4. FIN
5. GRILLE
6. KEY
7. ENGINE START

1〜6は順不同。ENGINE STARTを先に読んだ場合は残り個数を表示します。

## Architecture
- GAS / DBなし
- localStorageのみ
- 毎日19:00（Asia/Tokyo）に進捗を自動リセット
- NFC / QR共通
- HTML + CSS + JavaScript
- 透明WebPレイヤーで車が完成していく方式
- メーカーロゴ、クレスト、ブランドエンブレム不使用
- 特定車種の完全再現ではなく、オリジナルのクラシックGT

## Asset layers
- car_base.webp
- wheel_front.webp
- wheel_rear.webp
- headlight.webp
- grille.webp
- fin.webp
- engine_fx.webp
- key_fx.webp
- complete_fx.webp

すべて同一1200x367キャンバスへ位置合わせ済みです。

## URLs
- Web: https://asoboon.github.io/asoboon-stamp/miniapp-v2/production/asoquest/
- LINE MINI App: https://miniapp.line.me/2009888671-57TOefc3/asoquest/

NFC用URLは station_urls.csv、QR用URLは station_urls_qr.csv を参照（`?aq=…&src=nfc|qr` 形式。Developing LIFFのiPhone実機で到達確認済み）。

### Deep link 受信側 (`miniapp-v2/shared/asoquest-deeplink.js`)
- LINE Mini App の endpoint (`…/production/` または `…/develop/`) の `<head>` 先頭で、`liff.init()` と HOME 描画より前に同期実行され、ASOQUEST へ `location.replace` する。
- 受理する形式: `?aq=engine|wheel|headlight|fin|grille|key|start&src=nfc|qr`（`liff.state` 経由・直接どちらも可）と、旧形式 `/asoquest/?part=…` / `?station=engine`。
- `station_urls.csv`(NFC) / `station_urls_qr.csv`(QR) が現行。旧形式 `/asoquest/?part=…` で書き込み済みのタグも引き続き受理される。
- 診断: URLに `&debug=asoquest` を付けると自動遷移を止めて診断パネルを表示（トークン類はマスク、ログは sessionStorage のみ）。
- Developing の ASOQUEST は production の ASOQUEST と同一オリジンのため localStorage を共有する。テスト前に `asoquest:v9:*` を消すこと。
- shared script を変更したら `index.html` の `?v=` を更新すること（Production / Developing 共用）。
- 緊急 rollback は `index.html` の `asoquest-deeplink.js` の1行を外すだけ（`ASOBOON_ASOQUEST_HANDOFF` 未設定となり従来の `initLiff` に戻る）。

## Daily reset
- リセット時刻: 毎日19:00 JST
- 18:59:59までは前サイクル
- 19:00:00から新サイクル（0/6）
- 画面を開いたまま19:00を跨いだ場合も自動リセット
