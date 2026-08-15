/**
 * BOONJUMP RANKING V3.0.0 — PHYSICS SCORE PATCH
 * Apply to the current V2.7.0 Code.gs and redeploy as a NEW VERSION.
 *
 * Goal:
 * - Game score is the actual physical landing distance.
 * - No visible/gameplay rawCap/finalCap/limitBreak validation.
 * - Server keeps ONLY a generous anti-tamper safety ceiling.
 * - Existing player_id + player_token, today/week/all, machine boards,
 *   SECRET machine-only ranking, flush/cache/idempotency stay unchanged.
 */

// 1) Change CONFIG.API_VERSION to '3.0.0'.

// 2) Add this safety table near MACHINES.
const PHYSICS_SAFETY_CAP = Object.freeze({
  boon: 5000,
  wagon: 5000,
  buggy: 6000,
  bike: 6500,
  sport: 7000,
  princess: 8000,
  ssr: 8500,
  valkyrie: 9000,
  secret: 12000,
});

function assertPhysicsScorePlausible_(machineId, distance) {
  const machine = MACHINES[machineId];
  if (!machine) throw new Error('存在しないマシンです。');
  const d = Number(distance);
  if (!Number.isInteger(d) || d <= 0) throw new Error('距離が不正です。');
  const safetyCap = Number(PHYSICS_SAFETY_CAP[machineId] || 0);
  if (!safetyCap || d > safetyCap) {
    throw new Error('物理的に想定できない距離です。');
  }
}

/*
3) In submitScore_(body), replace BOTH old score validators:

  assertLimitBreakScorePlausible_(machineId, distance, accel, turbo, nitro, comboPrecision, body.tune_level);
  assertSecretScorePlausible_(machineId, distance, accel, turbo, nitro);

with:

  assertPhysicsScorePlausible_(machineId, distance);

4) In parseBulkRecords_(body), replace the same two validator calls with:

  assertPhysicsScorePlausible_(machineId, distance);

5) In health response, use these flags (remove old limit_break claims):

  ranking_mode: 'auto',
  write_policy: 'meaningful-best-only',
  physics_score: true,
  score_source: 'landing-distance',
  visible_score_caps: false,
  score_validation: 'safety-ceiling-only',
  auto_submit_client: true,
  retry_queue_client: true,

6) Do NOT change:
  - Spreadsheet ID / sheet schema
  - player_id + player_token identity
  - request_id duplicate protection
  - SpreadsheetApp.flush() before success
  - dashboard cache invalidation/revision bump
  - today/week/all best semantics
  - SECRET overall exclusion / machine-only board
*/
