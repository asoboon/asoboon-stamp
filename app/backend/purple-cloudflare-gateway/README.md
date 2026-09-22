# 紫Cloudflare Gateway 残数取得監査（2026-09-22 JST）

対象は `asoboon-purple-gateway` のみ。Production/Developing Gateway と `asoboon-purple-scheduler` は変更しない。

## 変更前の記録

- 稼働Workerバージョン: `0bf782f6-769b-4f39-a3fa-734bd01d4965`（`2.1.cf10`、100%）
- Cloudflare `/content/v2` から取得したソースのSHA-256: `e0121248331f90725d6114ea36f06a06ca2a92a2401ee16a16e0b87aa9706fd5`
- `DB`: D1 `asoboon-purple-db` / `a86a9fcf-ed55-430c-a1fc-726c1eba356e`
- secret binding名: `AIRWAIT_API_KEY`、`PURPLE_LINE_MINIAPP_CHANNEL_SECRET`。値は取得・保存・記録していない。
- compatibility date: `2026-09-10`、flagsなし、workers.dev有効、cronなし。
- 既存のPOST受付作成・LINEトークン発行、SchedulerのRPCハンドラは変更しない。

## 読み取り専用追加

`GET ?action=crowdRemaining` が、AirWAIT
`https://airwait.jp/WCSP/api/20160600/external/stateless/store/getWaitInfo`
を読み取る。`waitDetails[].detailedWaitType` を、既存の `wait/type/get` の `waitTypeName` と正規化後に一対一一致させる。対象は実際に `KeyONLINE_RECEPTION_ONLY` と確認した 0030/0032/0034/0036/0038 のみ。`reserveUnit === "PERSON"`、非負の安全な整数、一意の名称一致が揃った場合だけ `remaining` を返す。GROUP・未一致・重複・異常値は `null`。予約一覧や `numPerson` の合算はしない。

2026-09-22 の実レスポンスでは、0030/0032/0034 の `detailedWaitType` が各 `waitTypeName` と完全一致し、`reserveUnit` はすべて `PERSON` だった。UTC 01:41:59の残数は25/0/0名、01:47:48は3/0/0名、02:37:54は0/0/0名。0036/0038 は当日の `waitDetails` に存在せず、未確認として `null`。

## 有効化を止めている理由

AirWAIT実レスポンスに回別の受付中／終了フィールドは見つからなかった。店舗全体には `onlineRcptFlg=true` と `onlineRcptCode=00` があるが、回別の受付可否を示す根拠にはしない。`dispFlg` も受付可否には使用しない。このため、残数があっても受付終了している場合に残数を隠す条件を安全に確定できず、通常の `home-purple.html` は引き続き fail-closed のままとする。

最終デプロイ版は `47cff494-8a6a-443c-9a68-4b9340254157`（`2.1.cf13`、100%）。Git上の `worker.js` はこの版のソースで、secret値を含まない。Cloudflareの新バージョン作成時は `--keep-vars --strict` を使い、デプロイ前に既存secret2件・D1 binding・RPCハンドラが保持されていることを確認した。

次に必要なのは、AirWAITの回別受付終了を示す正本と値の意味の確認。確認できるまで紫HOMEに残数を通常表示しない。
