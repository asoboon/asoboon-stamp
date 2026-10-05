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
- Asia/Tokyoの日付単位で1日完結
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

NFC用URLは station_urls.csv を参照。QR版は src=nfc を src=qr に置き換えます。
