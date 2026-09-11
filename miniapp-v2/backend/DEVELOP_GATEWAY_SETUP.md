# ASOBooN MINI App v2 — Official Developing Gateway

This backend is **only** for the official ASOBooN Developing MINI App (Channel ID `2009884611`).
It must remain separate from Review, the legacy Purple/GAS backend, and current Published production.

## Cloudflare resources

- Worker: `asoboon-miniapp-v2-develop-gateway`
- Dedicated D1: `asoboon-miniapp-v2-develop-db`
- D1 binding: `DB`
- Worker URL: `https://asoboon-miniapp-v2-develop-gateway.asoboon425.workers.dev`
- Developing-only AirWAIT test waitTypeId: `0042`

## Required Worker configuration

Secrets/variables must be configured in Cloudflare, never committed to GitHub.

- `AIRWAIT_API_KEY` — AirWAIT external API key
- `LINE_MINIAPP_CHANNEL_SECRET` — channel secret for LINE MINI App Developing channel `2009884611`
- `SERVICE_MESSAGE_TEMPLATE_NAME` — exact API template name selected in LINE Developers Console
- `SERVICE_MESSAGE_TEMPLATE_PARAMS_JSON` — JSON object whose keys match that selected LINE service-message template
- `CREATE_ENABLED=1` — controlled Developing reservation create gate

The notification template name and parameter keys are template-specific. Do not guess them; copy them from the selected template in LINE Developers Console.

## Mandatory LINE notification rule

LINE call notification is a **hard prerequisite** for Developing reservation creation.

Flow:

1. Browser obtains the LIFF access token inside the Developing MINI App.
2. Worker verifies all required LINE service-message configuration.
3. Worker exchanges the LIFF token for a LINE service notification token and stores only the notification token in the dedicated Developing D1.
4. **Only after notification token readiness is confirmed** may the Worker call AirWAIT `reserve/create`.
5. After AirWAIT confirms the reservation, the prepared notification token is bound to the confirmed reception number/reserveId.
6. A Cloudflare scheduled worker checks pending Developing reservations every minute.
7. When AirWAIT shows the ticket as being called, the Worker sends the selected LINE Service Message and stores the renewed notification token returned by LINE.

If notification preparation fails, the Worker returns `LINE_NOTIFICATION_NOT_READY` and does **not** create an AirWAIT reception. This prevents the previous failure mode where reception succeeded but no LINE call notification could ever be sent.

## Safety / idempotency rules

- Request creation requires the allowed GitHub Pages origin.
- `CREATE_ENABLED=1` is required.
- LINE access token must verify against Developing Channel ID `2009884611`.
- Existing AirWAIT and business-calendar safety checks remain in force.
- Service notification token issuance is keyed by `requestId` to avoid duplicate issuance.
- An ambiguous token issuance is not automatically repeated.
- AirWAIT create ambiguity remains fail-closed/manual-review; the Worker does not blindly retry `reserve/create`.
- If token-to-ticket finalization is interrupted after AirWAIT confirmation, the scheduled worker reconciles it from the confirmed Developing D1 claim.
- Notification send ambiguity is not blindly duplicated.
- Review/Published endpoints are not imported or modified by this Developing worker.

## Health acceptance

`?action=health` must report at least:

- `environment: "official-develop"`
- `developTestWaitTypeId: "0042"`
- `callstatusEnabled: true`
- `serviceMessageEnabled: true`
- `serviceMessageVersion: "2.0.dev2"`
- `serviceMessageMandatoryBeforeCreate: true`
- `serviceMessageCronEnabled: true`
- `serviceMessageChannelSecretConfigured: true`
- `serviceMessageTemplateConfigured: true`
- `serviceMessageTemplateParamsConfigured: true`
- `serviceMessageReady: true`

Until the last four LINE configuration fields are true, a new Developing AirWAIT reservation is intentionally blocked.

## Final real-device acceptance test

After all health fields are ready:

1. Open the purple/Developing MINI App in LINE.
2. Create one **new** Developing test reservation in waitType `0042`.
3. Confirm the AirWAIT reception number and purple call-status page show the same ticket.
4. Close the LINE chat/app screen so push behavior is observable.
5. Call that ticket from AirWAIT staff operation.
6. Confirm purple call status becomes `入場できます`.
7. Confirm the LINE MINI App service message arrives within the polling window (normally up to about one minute).
8. Confirm the message/call-status route remains inside Developing and does not fall back to HOME or Published.

The old reception `9600` cannot prove the new notification path because its service notification token was never prepared before reservation creation. Use a new reservation after configuration is complete.
