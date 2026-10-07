# ASOBooN LINE MINI App v2 — Certified Production

Official certified Production identity:

- LINE MINI App / LIFF: `2009884613-ELc6kolf`
- Channel ID: `2009884613`
- LINE endpoint: `https://asoboon.github.io/asoboon-stamp/home.html`
- Worker: `asoboon-miniapp-v2-production-gateway`
- Dedicated D1: `asoboon-miniapp-v2-production-db`

## Current release state

Production is implemented but remains **dark / fail-closed** until the final launch gate is explicitly opened.

- Customer `home.html` remains the certified legacy HOME by default.
- New Production HOME can be exercised on the exact endpoint with `?production_preview=1`.
- `PRODUCTION_HOME_LIVE=false` keeps the new HOME out of the normal customer path.
- Browser config keeps `backendUrl:''`, `receptionCreate:false`, and `serviceMessage:false` until final activation.
- Server code keeps `PRODUCTION_CREATE_ARMED:false`; AirWAIT create is blocked even if `CREATE_ENABLED=1` is accidentally supplied.
- When create is hard-OFF, no LINE notification token is issued and no AirWAIT create is attempted.
- LINE reception uses AirWAIT `STORE_RECEPTION_ONLY` slots and opens at 09:25 JST.
- Production runtime rejects Developing/Review channel identities and Developing waitType `0042`.

## Implemented Production APIs

The Production Worker implements the new HOME contracts for:

- `waitTypes`
- `businessDay`
- `crowdRemaining`
- `boardStatus`
- `requestStatus`
- `recoverReservationSession`
- `reservationStatus`
- `cancelReservation`
- `surpriseVotePublicStatus`
- `createReservation` (hard-locked until final activation)

Service Message support, cancel/re-reception lifecycle, request ownership, ambiguous-create handling, shared-IP controls, legacy call-status read proxy, and scheduled call/cancel notifications are implemented and covered by Production-specific tests.

## Required before customer cutover

1. Rotate the AirWAIT API key that existed in historical public Git commits. Never reuse the exposed value.
2. Configure Production secrets outside browser/source code:
   - `AIRWAIT_API_KEY`
   - `LINE_MINIAPP_CHANNEL_SECRET`
   - `LINE_OA_CHANNEL_SECRET`
   - `LINE_OA_CHANNEL_ACCESS_TOKEN`
   - `PRODUCTION_DIAGNOSTICS_TOKEN`
3. Confirm all approved LINE Service Message templates in the Production channel.
4. Dark-deploy the Worker through the protected GitHub `production` environment and require health to report D1/AirWAIT/Service Message/LINE webhook readiness while create stays OFF.
5. Run one real Production LIFF smoke cycle with staff-controlled data: open → create → confirmation → calling → cancel/done → same-day re-reception.
6. Verify the `liff.state` route and `home.html?production_preview=1` on a real LINE client.
7. Re-run independent Claude Code audit.
8. Rehearse rollback using `home-legacy-certified-20261007.html` / `PRODUCTION_HOME_LIVE=false`.
9. Cut over outside customer hours. Enable the HOME first while create remains OFF; arm create only after the read-only/live UI smoke check succeeds.

## Never do

- Do not change the LINE Developers Production endpoint URL for this cutover.
- Do not put AirWAIT or LINE secrets in JavaScript, HTML, GitHub commits, screenshots, or browser storage.
- Do not enable only the browser create flag or only the Worker create flag. Promotion must use the full paired gate.
- Do not reuse Developing/Review D1, LIFF IDs, Worker URLs, storage namespaces, demo vote data, or test waitTypes in Production.
