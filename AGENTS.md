# ASOBooN Mini App — HOME release rules

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
