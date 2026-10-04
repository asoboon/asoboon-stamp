# ASOBooN MINI App v2 — LINE Review

This directory is the certification-review candidate. It is isolated from the customer-facing legacy HOME, Developing, and Production.

## LINE Review identity
- Review channel candidate: `2009884613`
- Review LIFF: `2009884613-ELc6kolf`
- Endpoint to configure in LINE Developers: `https://asoboon.github.io/asoboon-stamp/miniapp-v2/review/`
- Review Worker: `asoboon-miniapp-v2-review-gateway`
- Review D1: `asoboon-miniapp-v2-review-db`

## Safety
- Review reception is a simulation and **never writes AirWAIT**.
- Review verifies the Review LIFF access token and rejects other client IDs.
- Review surprise voting is local demo mode and never writes the live vote backend.
- Service Messages are not issued from Review; unverified MINI App service-message testing remains in Developing.
- The public customer `home.html` remains the legacy HOME until certification and final production approval.

## Reviewer test scenario
1. Open the Review LINE MINI App.
2. From HOME, tap `当日受付`.
3. Select a Review reception slot and party size, confirm the checkbox, then complete reception.
4. The app issues a simulated 6-digit reception number and moves to `呼出状況` without leaving the MINI App.
5. The simulated queue decreases automatically; after roughly 12 seconds it changes to `入場できます`.
6. `キャンセル` can also be tested and remains inside the MINI App.
7. `本日の混雑状況`, `何時まで遊べる？`, `サプライズ投票`, `イベントカレンダー`, `初めての方`, `料金`, `アクセス`, `館内ルール`, and `一時退場・再入場` are available in the same MINI App.

Review simulation exists solely so LY reviewers can test the complete reception flow at any review time without creating a real customer AirWAIT ticket.
