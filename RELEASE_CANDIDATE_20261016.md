# ASOBooN LINE miniapp — crowd/calendar repair (2026-10-16)

Status: locally tested candidate only. NOT DEPLOYED; receipt issuing, LINE messaging and production Worker remain unchanged.

## Implemented
- Separates verified STORE/onsite/LINE remaining from WEB remaining. Never maps AirWAIT onsite alias/time-key data to WEB.
- Shows weekday 10:00 and 14:00 reception pools independently; verified 264/50 fixture is onsite, WEB is unknown in that fixture.
- Removes unsourced 350-person occupancy percentages, presents original source time, stale/historical status and prevents cross-day crowd reuse.
- Stops fetching and displaying next-day crowd after the 19:00 JST operational rollover.
- Shares month calendar snapshots at Cloudflare edge for facility Wi-Fi guests, honors five-minute per-day source freshness, shows historical dates explicitly and refreshes on focus.
- Prevents old in-flight calendar requests from overriding a new day at JST midnight; no 31-request client fallback storm after a batch failure.
- Updates bilingual/multilingual source entries; some calendar-only localized strings remain incomplete because the standalone page does not load the miniapp language runtime.

## Evidence
- Live read-only production APIs were observed by the assistant on 2026-10-16 ~13:33 JST: crowdRemaining OK, businessDays October remaining 16/16 OK, November 30/30 OK. No customer changes.
- AirWAIT waitTypes confirmed 0023/0025 are STORE and 0024/0027 are WEB; do not confuse these channels.
- Local Node regression suite: 240 passed, 0 failed (including two additional after-19:00 and midnight in-flight tests).
- Production bundle rebuild, builder --check, node --check and git diff --check passed.
- Independent first-party Claude Code Sonnet read-only review reported no blockers before the final two rollover patches; these were retested by Node after modification.
- Browser Playwright test was NOT run because @playwright/test was unavailable in this isolated environment. Live deployed end-to-end validation is pending.

## Pre-deployment conditions
- Do not switch public production or Worker automatically based on this branch.
- Before releasing: verify exact branch/commit, back up current Worker and frontend release, review deploy plan, and confirm user authorization for production change.
- After release: test actual LINE client for Japanese and other languages, crowd freshness at business hours, calendar month rollover, receipt creation by staff-controlled single test, calling and rollback readiness. No synthetic public reservation.

## Rollback
- Preserve existing main branch and current deployed Cloudflare Worker version.
- Revert frontend commit only after confirming route/asset rollback paths; restore prior Worker deployment independently if needed.
- AirWAIT and LINE reception write gates are intentionally unchanged by this candidate.

## Known limits
- No verified WEB remaining value is available from the observed getWaitInfo aliases, so WEB stays unknown instead of being invented.
- Standalone calendar needs a separate localization/runtime integration for full Korean/Kurmanji language coverage.
- Historic counts up to 30 minutes old may remain faintly visible with clearly marked stale source time; they are not live availability.
