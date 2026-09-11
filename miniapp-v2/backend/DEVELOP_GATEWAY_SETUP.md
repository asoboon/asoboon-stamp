# ASOBooN MINI App v2 — Official Developing Gateway

This backend is **only** for the official ASOBooN Developing MINI App (Channel ID `2009884611`).
It must remain separate from the Purple staging Worker and from current Published production.

## Cloudflare resources

- Worker name: `asoboon-miniapp-v2-develop-gateway`
- Dedicated D1 database: `asoboon-miniapp-v2-develop-db`
- D1 binding name: `DB`
- Worker Secret: `AIRWAIT_API_KEY`
- Worker variable: `CREATE_ENABLED=0` during connection tests

Source: `miniapp-v2/backend/develop-gateway.js`

The Worker creates its own v2-prefixed D1 tables on the first allowed request.
Do not bind the Purple D1 database.

## Safety gates

The Worker rejects create requests unless all of the following are true:

- request Origin is `https://asoboon.github.io`
- `CREATE_ENABLED=1`
- LINE access token verifies successfully
- verified LINE `client_id` equals `2009884611`
- profile scope is present and LINE profile can be read
- client operational date matches the server-side JST/18:00-cutoff date
- the business calendar confirms an operating day
- reception is inside the allowed time window
- waitTypeId is allowlisted for that business type
- AirWAIT wait-type configuration allows the requested web/onsite mode
- party size rules pass
- onsite requests pass the server-side geofence recheck
- the user has no existing confirmed/in-flight/ambiguous reception for that business day

## AirWAIT ambiguity rule

AirWAIT reserve/create does not expose an external idempotency key. If the Worker cannot know whether an upstream create succeeded, it marks the request and user/day claim `AMBIGUOUS` and does **not** retry the AirWAIT create automatically.

User-facing message remains:

`受付結果を確認しています。新しい受付は行わないでください。`

## Activation order

1. Deploy the dedicated Worker with `CREATE_ENABLED=0`.
2. Bind the dedicated D1 database as `DB`.
3. Add `AIRWAIT_API_KEY` as a Cloudflare Secret.
4. Verify health and waitTypes from the official Developing MINI App.
5. Put the Worker URL into `miniapp-v2/develop/env.js` while keeping `receptionCreate:false`.
6. Verify same-app UI, LINE identity, business calendar, wait types, and onsite location behavior.
7. Only after those checks, set `CREATE_ENABLED=1` and `receptionCreate:true` for a controlled live Developing reception test.

Do not change Review or Published endpoints during this process.
