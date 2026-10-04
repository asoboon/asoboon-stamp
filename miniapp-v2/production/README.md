# ASOBooN MINI App v2 Production dark launch

This directory is a **non-public promotion candidate** for the official LINE MINI App.

Safety gates currently in force:

- Official Production LIFF identity: `2009888671-57TOefc3`.
- Storage namespace is `production`; Developing browser state is not reused.
- LINE reception uses AirWAIT **STORE_RECEPTION_ONLY** slot IDs and opens at **09:25 JST**.
- `receptionCreate:false` in browser config.
- `backendUrl:''`; no Production Worker is connected from the browser.
- `production-gateway.js` has `PRODUCTION_CREATE_ARMED:false`, so creation remains blocked even if deployed with `CREATE_ENABLED=1`.
- Existing `home.html` / official LIFF endpoint is not changed by this commit.

Promotion requires a dedicated Production Worker, dedicated D1, AirWAIT secret, official Production LINE service-message secret/config, end-to-end create/call/cancel tests, then an explicit final route cutover.
