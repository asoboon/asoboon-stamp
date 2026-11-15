# ASOBooN Mini App — HOME release rules

**Official completed edition (2026-11-15)**: immutable recovery reference
`baseline/official-miniapp-complete-20261115` at
`a146a1b918b340e4156002c00a880f79692abc05`.
The official primary entry is `home.html`; the certified LINE
entry `miniapp-v2/production/index.html` must retain its tested native reception UI while sharing the same
verified three-session board. Never switch to archived pages/old theme versions.

**Mandatory before any miniapp change**:
- Read `docs/ASOBOON_OFFICIAL_RELEASE_LOCK_20261115.md` and the frozen
  HOME contract. Preserve the 10:00, 12:30, and 15:00 paired AirWAIT groups.
  WEB 12:30 (0032) and LINE 12:50 (0031) are ONE entry session.
- Edit the source modules, regenerate via `node miniapp-v2/build-production.mjs`,
  verify with `--check`, and keep both official entrypoint cache keys current.
  Never edit a generated bundle as an isolated hotfix.
- The obsolete `?boonTheme=classic` rollback is forbidden in production;
  never add a second old HOME loader or implicit legacy fallback.
- Run `node --test tests/asoboon-official-release-lock.test.mjs` plus
  the frozen HOME and Playwright tests. Required GitHub checks must pass.
- Styling, palette and decorative assets may change, but not the approved
  structure, booking/call safety, session pairing or forecast without the
  facility owner's explicit decision. Do not weaken safety tests to land a PR.
- Keep legacy source/assets outside the active loading path for reversibility;
  never remove QR/NFC/game/staff dependencies without impact analysis.


When working on home.html, miniapp-v2/production/, miniapp-v2/shared/,
reception/callstatus behavior, or their tests:

- Read docs/ASOBOON_HOME_STABLE_CONTRACT_20261115.md before editing.
- Preserve the approved HOME layout structure, navigation, booking behavior,
  published AirWAIT slot handling, and three-session 320-person forecast.
- Do not freeze colors, background artwork, typography colors, gradients, or
  other purely visual themes. They may change with future styling releases.
- The duplicate “もう一度受付する” button must not reappear on HOME or callstatus.
  Rebooking may continue through the normal published WEB/LINE HOME slots.
- Update the user-approved contract only with the facility owner's explicit
  request. Do not delete, disable, or weaken the checks just to pass CI.
- After changes, run the frozen HOME test and affected Playwright production tests.
  Keep the existing required GitHub checks (verify, develop-browser, verify-newhome-flow).
- Existing public API and ticket issuance safeguards must never be bypassed.
