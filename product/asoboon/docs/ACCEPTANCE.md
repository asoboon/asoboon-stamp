# ASOBooN Model 本番受入基準

## Customer
- 現地受付枠だけ表示される
- WEB枠が表示されない
- 1受付10名超を拒否
- 保護者1名につき子ども3名超を拒否
- 0〜5か月無料が料金計算へ加算されない
- 18:00〜18:59受付不可
- 19:00から翌日受付
- 二重送信しても受付が重複しない
- キャンセル済みなら端末の受付済み状態が解除される

## Staff
- 当日台帳だけでID連携
- 100組超でも全件取得
- 先頭ID未連携時に後続を呼ばない
- WEB枠を表示/呼出しない
- API異常時にAUTO OFFへ安全停止
- AirWAIT呼出API未確認時はAUTO ON不可

## Server AUTO
- 受付開始前は呼ばない
- 開始後に最大10組まで呼出
- 呼出中が減ると次周期で補充
- 18:00以降は呼出しない
- iPadスリープ中も継続
- 同時実行はScriptLockで排他

## Security
- GitHub/HTML/JSにAirWAIT APIキーなし
- STAFF_KEYはScript Properties + 端末localStorageのみ
- reserveIdだけでは顧客受付状態を照会できない
- 呼出API開放はScript Propertyで明示制御
