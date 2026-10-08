# ASOBooN official Production activation

Certified LINE identity: `2009884613-ELc6kolf`. The existing endpoint remains `https://asoboon.github.io/asoboon-stamp/home.html`.

This release connects both Production entries to the dedicated Production Worker, keeps reception inside the MINI App, and opens STORE_RECEPTION_ONLY reception at 09:25 JST. No Developing/Review Worker, database, LIFF identity or storage is reused.

## Release order

1. Configure dedicated Production secrets outside source/browser code: `AIRWAIT_API_KEY` (a newly issued value; do not reuse the historically exposed key), `LINE_MINIAPP_CHANNEL_SECRET`, `LINE_OA_CHANNEL_SECRET`, `LINE_OA_CHANNEL_ACCESS_TOKEN`, `PRODUCTION_DIAGNOSTICS_TOKEN`.
2. Confirm the approved Production Service Message templates match the deploy configuration.
3. Verify the current Production Worker health reports D1, AirWAIT, notification three-pillar and official LINE cancel readiness.
4. Deploy the release with `deploy-miniapp-v2-production-gateway`, `mode=live`. The live preflight refuses activation when required dependencies are missing. `mode=dark` keeps runtime `CREATE_ENABLED=0`.
5. Verify health `createEnabled=true`, then confirm the unchanged certified LINE entry opens the new HOME and reception does not redirect to AirWAIT.
6. Use one staff-controlled real LINE reception to check confirmation, call notification, cancellation and same-day re-reception.

The source arm is enabled for this explicitly authorized release; runtime `CREATE_ENABLED` still defaults to OFF. Mandatory LINE notification preparation remains before any AirWAIT create. Failed/ambiguous results never trigger an automatic duplicate create.

## Rollback

Set Worker runtime `CREATE_ENABLED=0` to stop reception before any LINE/AirWAIT create. Restore `PRODUCTION_HOME_LIVE=false` in `home.html`, or use the retained `home-legacy-certified-20261007.html` snapshot to restore the prior HOME. Keep the certified LINE endpoint unchanged. Re-run `mode=dark` only when all existing readiness checks pass.
