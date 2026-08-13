# BOONRUN v1.0.26 QA REPORT — EMERGENCY ULTIMATE
Build: `2026-08-12-playable-v1.0.26-emergency-ultimate`  
Client: `1.0.26`
## Feature contract
- Manual ONE SHOT SPECIAL remains available at **100% duration/effect**.
- If the one-shot is still unused when a fatal event occurs, **EMERGENCY ULTIMATE auto-activates once**.
- Auto duration is **75%** of the normal special duration.
- Fatal crash/PIT: triggering hazard is cleared and a **0.60s safety window** is granted.
- PIT rescue additionally lifts the machine to `y >= 72` with upward velocity `>= 390`.
- GAS OUT: restores **25% of that machine tank**, then starts the reduced special.
- Lucky Buggy auto version gets **2 emergency air kicks**; manual remains 3.
- If the special was already used, no automatic second rescue is granted.
- Ranking remains legal and uses the existing `ability_use_count`; no ranking API/GAS change required.
## Automated checks
- `node --check game.bundle.js`: PASS
- `node --check run-ranking.js`: PASS
- `node --check sw.js`: PASS
- Emergency special unit scenarios: **10/10 PASS**
- CSS parser errors: **0**
- Duplicate HTML IDs: **0**
- Missing local index refs: **0**
- Authored patterns: **55**
- SPECIAL definitions: **8**
- Production `valkyrie` references: **0**
## v1.0.25 → v1.0.26 protected gameplay sections
- PHYSICS: **BYTE-EQUIVALENT** — `08afbf357ee2ebb6e4ca935d2f50f84aab5911e629887fd9a8a63f81fe40c86f`
- OBSTACLES: **BYTE-EQUIVALENT** — `fe2b4cfece8061a2130a1a26394212b435586384b788ca6a9a4452fc66de6874`
- ITEMS: **BYTE-EQUIVALENT** — `401229c6ebe40920fef988be122a60938711746fd3f2523447bf76f8112f3b7b`
- FUEL_ZONES: **BYTE-EQUIVALENT** — `b5e1fd1d7f05e97e9d2b150049743149b23b8412741702c15c56c3d4adf4d1b4`
- FUEL_RULES: **BYTE-EQUIVALENT** — `611509e0c3511ff5f79de02663a6297d8fee0333ecd70b12d5fafa131c8d34d2`
- CARS: **BYTE-EQUIVALENT** — `b1d675abdd90b5975dec41369493e86a34237d699d3aac67925da558c35c193e`
- PATTERNS: **BYTE-EQUIVALENT** — `88cc7f37558c407d46fff050a1e434c0c0d7756413e55493a0a6be0c451a994b`
- SPEED_DIFFICULTY_GAPS: **BYTE-EQUIVALENT** — `1ba61f78b2fc852fa9be48dc0ab00223bb5e8dfb939896852f0983a7f4fd5e6b`
- SPECIAL_DEFINITIONS: **BYTE-EQUIVALENT** — `a7c5d81c0243ee08fe4e70a7971abdc61ffaf3814a47e951782cd24a79dc35fa`

Only the ONE SHOT SPECIAL activation/death interception path, its UI copy/feedback, build/version/cache identifiers, and emergency-banner CSS were intentionally changed.
## Ranking transport integrity
- `run-ranking.js` v1.0.25 SHA256: `a32824f2f234549b95f31bbe425175807a2c3fa788b548d42de19d8b42858eaa`
- `run-ranking.js` v1.0.26 SHA256: `a32824f2f234549b95f31bbe425175807a2c3fa788b548d42de19d8b42858eaa`
- Byte-for-byte identical: **YES**
- GAS v2.6 validator checks session/time/distance cap, not a simulated fuel ledger; the 25% emergency refill does not require a backend validation change.
## Service worker
- Cache: `boonrun-20260812-v126emergency`
- HTML/CSS/JS query: `?v=20260812-v126emergency`
## Important balance note
This feature intentionally increases survivability. It does **not** alter obstacle timings, speed curve, fuel supply, car physics, or authored patterns. Manual activation stays strategically stronger because it keeps 100% duration; automatic rescue is a reduced last-chance fallback. Live distance distribution should be watched after deployment because real players may now pass the previous 3km wall more often.
## Runtime limitation
A fresh headless Chromium smoke test was attempted in this environment but timed out with the same DBus/process limitation seen previously. Therefore this report does **not** claim real browser/device execution or iPhone/Android/LINE testing. Static validation and isolated emergency-logic unit tests passed.
