/**
 * ブーンジャンプ 世界ランキング API V2.3.5
 * 保存先: Google Spreadsheet
 * Spreadsheet ID: 1oFLApJ_0IlTUc-DLhoFSDIS7OspzlrZ9rm4ia71EvME
 *
 * 方針:
 * - ランキング登録は任意
 * - 選択された記録だけを受信
 * - 歴代／今日／今週のいずれにも更新がない記録はscore_logへ追加しない
 * - 同一端末の本人判定用player_tokenに対応（旧版クライアントも閲覧・既存記録送信は互換）
 */

const CONFIG = Object.freeze({
  SPREADSHEET_ID: '1oFLApJ_0IlTUc-DLhoFSDIS7OspzlrZ9rm4ia71EvME',
  TIMEZONE: 'Asia/Tokyo',
  LEADERBOARD_LIMIT: 100,
  NAME_MIN: 2,
  NAME_MAX: 12,
  API_VERSION: '2.3.5',
  SHEETS: Object.freeze({
    PLAYERS: 'players',
    MACHINE_BESTS: 'machine_bests',
    PERIOD_BESTS: 'period_bests',
    SCORE_LOG: 'score_log',
    BLOCKED_NAMES: 'blocked_names',
  }),
});

const MACHINES = Object.freeze({
  boon:     { name: 'ブーンピックアップ', finalCap: 1995, secret: false },
  wagon:    { name: 'スマートワゴン', finalCap: 1943, secret: false },
  buggy:    { name: 'ラッキーバギー', finalCap: 2310, secret: false },
  bike:     { name: 'パワーバイク', finalCap: 2468, secret: false },
  sport:    { name: 'ニトロスポーツ', finalCap: 2651, secret: false },
  ssr:      { name: 'コズミックファントム', finalCap: 3150, secret: false },
  princess: { name: 'プリンセス・スターライナー', finalCap: 3100, secret: false },
  secret:   { name: '無敵のロケットアソブーン人間', finalCap: 5000, secret: true },
});

const VALID_JUDGES = new Set(['MISS', 'GOOD', 'GREAT', 'CRITICAL', 'SUPER']);
let SPREADSHEET_CACHE_ = null;
let MACHINE_RECORDS_CACHE_ = null;
let PERIOD_RECORDS_CACHE_ = null;

function doGet(e) {
  resetRequestCaches_();
  const p = (e && e.parameter) || {};
  const callback = p.callback;

  try {
    const action = String(p.action || 'health').toLowerCase();
    let result;

    if (action === 'health') {
      result = {
        ok: true,
        service: 'boonjump-ranking',
        api_version: CONFIG.API_VERSION,
        ranking_mode: 'manual',
        write_policy: 'meaningful-best-only',
        bulk_submit: true,
        now: nowIso_(),
      };
    } else if (action === 'leaderboard') {
      result = getLeaderboard_(p);
    } else if (action === 'dashboard') {
      result = getDashboard_(p);
    } else if (action === 'player') {
      result = getPlayer_(p);
    } else if (action === 'resolve_identity') {
      result = resolveIdentity_(p);
    } else if (action === 'name_available') {
      result = checkNameAvailable_(p);
    } else if (action === 'score_status') {
      result = getScoreStatus_(p);
    } else if (action === 'bulk_submit') {
      result = withScriptLock_(function () {
        const value = bulkSubmitScores_(p);
        SpreadsheetApp.flush();
        return value;
      });
    } else if (action === 'submit' || action === 'rename') {
      result = withScriptLock_(function () {
        const value = action === 'submit' ? submitScore_(p) : renamePlayer_(p);
        SpreadsheetApp.flush();
        return value;
      });
    } else {
      throw new Error('不明なactionです。');
    }

    return output_(result, callback);
  } catch (error) {
    return output_({ ok: false, error: String(error.message || error) }, callback);
  }
}

function doPost(e) {
  resetRequestCaches_();
  try {
    const body = parseBody_(e);
    const action = String(body.action || 'submit').toLowerCase();
    const result = withScriptLock_(function () {
      let value;
      if (action === 'submit') value = submitScore_(body);
      else if (action === 'bulk_submit') value = bulkSubmitScores_(body);
      else if (action === 'rename') value = renamePlayer_(body);
      else throw new Error('不明なactionです。');
      SpreadsheetApp.flush();
      return value;
    });
    return output_(result);
  } catch (error) {
    return output_({ ok: false, error: String(error.message || error) });
  }
}

function withScriptLock_(callback) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return callback();
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function submitScore_(body) {
  const requestId = cleanId_(body.request_id, 12, 100, 'request_id');
  let playerId = cleanId_(body.player_id, 12, 100, 'player_id');
  const playerToken = normalizePlayerToken_(body.player_token);
  const submittedName = validateName_(body.display_name);
  let player = findPlayerRecord_(playerId);
  if (!player && playerToken) {
    const tokenPlayer = findPlayerRecordByToken_(playerToken);
    if (tokenPlayer) {
      playerId = tokenPlayer.player_id;
      player = tokenPlayer;
    }
  }

  enforceRateLimit_('submit', playerId, 30);

  if (player && String(player.status || 'ACTIVE') !== 'ACTIVE') {
    throw new Error('ランキングネームの再登録が必要です。');
  }
  assertPlayerIdentity_(player, playerToken, 'submit', submittedName);

  let displayName = submittedName;
  if (player) {
    displayName = validateName_(player.display_name);
  } else {
    assertNameAvailable_(submittedName, playerId);
  }

  const machineId = String(body.machine_id || '').trim();
  const machine = MACHINES[machineId];
  const distance = Number(body.distance);
  const accel = normalizeJudge_(body.accel_judge);
  const turbo = normalizeJudge_(body.turbo_judge);
  const nitro = normalizeJudge_(body.nitro_judge);
  const tuneLevel = Math.max(0, Math.min(50, Math.floor(Number(body.tune_level) || 0)));
  const playedAt = normalizeDate_(body.played_at) || new Date();
  const receivedAt = new Date();
  const sourceBuild = truncate_(body.source_build, 100);
  const clientVersion = truncate_(body.client_version, 40);
  const fastResponse = String(body.response_mode || '').toLowerCase() === 'fast';

  if (!machine) throw new Error('存在しないマシンです。');
  if (!Number.isInteger(distance) || distance <= 0) throw new Error('距離が不正です。');
  if (distance > machine.finalCap) throw new Error(`距離が上限${machine.finalCap}mを超えています。`);

  const dayKey = Utilities.formatDate(receivedAt, CONFIG.TIMEZONE, 'yyyy-MM-dd');
  const weekKey = getWeekKey_(receivedAt);

  if (requestExists_(requestId)) {
    return makeSubmitResponse_({
      playerId,
      machineId,
      requestId,
      duplicate: true,
      skipped: false,
      updated: { machine: false, today: false, week: false },
      fast: fastResponse,
    });
  }

  const currentAll = findMachineBestDistance_(playerId, machineId);
  const currentDay = findPeriodBestDistance_('DAY', dayKey, playerId, machineId);
  const currentWeek = findPeriodBestDistance_('WEEK', weekKey, playerId, machineId);
  const improvesAll = distance > currentAll;
  const improvesDay = distance > currentDay;
  const improvesWeek = distance > currentWeek;

  upsertPlayer_(playerId, displayName, receivedAt, 'ACTIVE', !player, playerToken);

  if (!improvesAll && !improvesDay && !improvesWeek) {
    return makeSubmitResponse_({
      playerId,
      machineId,
      requestId,
      duplicate: false,
      skipped: true,
      reason: 'already_registered',
      updated: { machine: false, today: false, week: false },
      fast: fastResponse,
    });
  }

  appendScoreLog_({
    requestId,
    playerId,
    displayName,
    machineId,
    distance,
    accel,
    turbo,
    nitro,
    tuneLevel,
    playedAt,
    receivedAt,
    status: 'ACCEPTED',
    reason: '',
    sourceBuild,
    clientVersion,
  });

  let machineUpdated = false;
  let dayUpdated = false;
  let weekUpdated = false;

  if (improvesAll) {
    machineUpdated = upsertMachineBest_({
      playerId,
      displayName,
      machineId,
      machineName: machine.name,
      distance,
      accel,
      turbo,
      nitro,
      achievedAt: receivedAt,
      sourceBuild,
    });
  }

  if (improvesDay) {
    dayUpdated = upsertPeriodBest_({
      periodType: 'DAY',
      periodKey: dayKey,
      playerId,
      displayName,
      machineId,
      machineName: machine.name,
      distance,
      achievedAt: receivedAt,
      verified: true,
      sourceBuild,
    });
  }

  if (improvesWeek) {
    weekUpdated = upsertPeriodBest_({
      periodType: 'WEEK',
      periodKey: weekKey,
      playerId,
      displayName,
      machineId,
      machineName: machine.name,
      distance,
      achievedAt: receivedAt,
      verified: true,
      sourceBuild,
    });
  }

  return makeSubmitResponse_({
    playerId,
    machineId,
    requestId,
    duplicate: false,
    skipped: false,
    updated: { machine: machineUpdated, today: dayUpdated, week: weekUpdated },
    fast: fastResponse,
  });
}


function bulkSubmitScores_(body) {
  const bulkRequestId = cleanId_(body.bulk_request_id, 12, 100, 'bulk_request_id');
  let playerId = cleanId_(body.player_id, 12, 100, 'player_id');
  const playerToken = normalizePlayerToken_(body.player_token);
  const submittedName = validateName_(body.display_name);
  let player = findPlayerRecord_(playerId);

  if (!player && playerToken) {
    const tokenPlayer = findPlayerRecordByToken_(playerToken);
    if (tokenPlayer) {
      playerId = tokenPlayer.player_id;
      player = tokenPlayer;
    }
  }

  enforceRateLimit_('bulk_submit', playerId, 8);

  if (player && String(player.status || 'ACTIVE') !== 'ACTIVE') {
    throw new Error('ランキングネームの再登録が必要です。');
  }
  assertPlayerIdentity_(player, playerToken, 'submit', submittedName);

  let displayName = submittedName;
  if (player) displayName = validateName_(player.display_name);
  else assertNameAvailable_(submittedName, playerId);

  const records = parseBulkRecords_(body);
  const receivedAt = new Date();
  const dayKey = Utilities.formatDate(receivedAt, CONFIG.TIMEZONE, 'yyyy-MM-dd');
  const weekKey = getWeekKey_(receivedAt);

  upsertPlayer_(playerId, displayName, receivedAt, 'ACTIVE', !player, playerToken);

  const machineSheet = sheet_(CONFIG.SHEETS.MACHINE_BESTS);
  const periodSheet = sheet_(CONFIG.SHEETS.PERIOD_BESTS);
  const scoreSheet = sheet_(CONFIG.SHEETS.SCORE_LOG);
  const machineValues = machineSheet.getDataRange().getValues();
  const periodValues = periodSheet.getDataRange().getValues();
  const scoreLastRow = scoreSheet.getLastRow();
  const requestIds = new Set(
    scoreLastRow >= 2
      ? scoreSheet.getRange(2, 1, scoreLastRow - 1, 1).getValues().map(row => String(row[0] || ''))
      : []
  );
  const machineIndex = new Map();
  for (let i = 1; i < machineValues.length; i++) {
    if (String(machineValues[i][0]) !== playerId) continue;
    machineIndex.set(String(machineValues[i][2]), {
      row: i + 1,
      distance: Number(machineValues[i][4]) || 0,
    });
  }

  const periodIndex = new Map();
  for (let i = 1; i < periodValues.length; i++) {
    if (String(periodValues[i][2]) !== playerId) continue;
    const key = [
      String(periodValues[i][0]),
      normalizePeriodKey_(periodValues[i][1]),
      String(periodValues[i][4]),
    ].join('|');
    periodIndex.set(key, {
      row: i + 1,
      distance: Number(periodValues[i][6]) || 0,
    });
  }

  const logRows = [];
  const machineUpdates = [];
  const machineAppends = [];
  const periodUpdates = [];
  const periodAppends = [];
  const results = [];
  let registered = 0;
  let skipped = 0;
  let duplicates = 0;
  const boardUpdates = { machine: 0, today: 0, week: 0 };

  records.forEach(record => {
    if (requestIds.has(record.requestId)) {
      duplicates += 1;
      results.push({
        machine_id: record.machineId,
        distance: record.distance,
        duplicate: true,
        skipped: false,
        updated: { machine: false, today: false, week: false },
      });
      return;
    }

    const currentMachine = machineIndex.get(record.machineId);
    const dayIndexKey = ['DAY', dayKey, record.machineId].join('|');
    const weekIndexKey = ['WEEK', weekKey, record.machineId].join('|');
    const currentDay = periodIndex.get(dayIndexKey);
    const currentWeek = periodIndex.get(weekIndexKey);
    const improvesMachine = record.distance > (currentMachine ? currentMachine.distance : 0);
    const improvesDay = record.distance > (currentDay ? currentDay.distance : 0);
    const improvesWeek = record.distance > (currentWeek ? currentWeek.distance : 0);

    if (!improvesMachine && !improvesDay && !improvesWeek) {
      skipped += 1;
      results.push({
        machine_id: record.machineId,
        distance: record.distance,
        duplicate: false,
        skipped: true,
        reason: 'already_registered',
        updated: { machine: false, today: false, week: false },
      });
      return;
    }

    const machine = MACHINES[record.machineId];
    logRows.push([
      record.requestId,
      playerId,
      displayName,
      record.machineId,
      record.distance,
      record.accel,
      record.turbo,
      record.nitro,
      record.tuneLevel,
      record.playedAt,
      receivedAt,
      'ACCEPTED',
      '',
      record.sourceBuild,
      record.clientVersion,
    ]);

    if (improvesMachine) {
      const rowValues = [[
        playerId,
        displayName,
        record.machineId,
        machine.name,
        record.distance,
        record.accel,
        record.turbo,
        record.nitro,
        receivedAt,
        record.sourceBuild,
      ]];
      if (currentMachine) machineUpdates.push({ row: currentMachine.row, values: rowValues });
      else machineAppends.push(rowValues[0]);
      machineIndex.set(record.machineId, { row: currentMachine ? currentMachine.row : 0, distance: record.distance });
      boardUpdates.machine += 1;
    }

    if (improvesDay) {
      const rowValues = [[
        'DAY', dayKey, playerId, displayName, record.machineId, machine.name,
        record.distance, receivedAt, true, record.sourceBuild,
      ]];
      if (currentDay) periodUpdates.push({ row: currentDay.row, values: rowValues });
      else periodAppends.push(rowValues[0]);
      periodIndex.set(dayIndexKey, { row: currentDay ? currentDay.row : 0, distance: record.distance });
      boardUpdates.today += 1;
    }

    if (improvesWeek) {
      const rowValues = [[
        'WEEK', weekKey, playerId, displayName, record.machineId, machine.name,
        record.distance, receivedAt, true, record.sourceBuild,
      ]];
      if (currentWeek) periodUpdates.push({ row: currentWeek.row, values: rowValues });
      else periodAppends.push(rowValues[0]);
      periodIndex.set(weekIndexKey, { row: currentWeek ? currentWeek.row : 0, distance: record.distance });
      boardUpdates.week += 1;
    }

    registered += 1;
    results.push({
      machine_id: record.machineId,
      distance: record.distance,
      duplicate: false,
      skipped: false,
      updated: { machine: improvesMachine, today: improvesDay, week: improvesWeek },
    });
    requestIds.add(record.requestId);
  });

  machineUpdates.forEach(item => machineSheet.getRange(item.row, 1, 1, 10).setValues(item.values));
  if (machineAppends.length) {
    machineSheet.getRange(machineSheet.getLastRow() + 1, 1, machineAppends.length, 10).setValues(machineAppends);
  }
  periodUpdates.forEach(item => periodSheet.getRange(item.row, 1, 1, 10).setValues(item.values));
  if (periodAppends.length) {
    periodSheet.getRange(periodSheet.getLastRow() + 1, 1, periodAppends.length, 10).setValues(periodAppends);
  }
  if (logRows.length) {
    scoreSheet.getRange(scoreSheet.getLastRow() + 1, 1, logRows.length, 15).setValues(logRows);
  }

  resetRankingDataCaches_();

  return {
    ok: true,
    accepted: true,
    bulk_request_id: bulkRequestId,
    player_id: playerId,
    total: records.length,
    registered,
    skipped,
    duplicates,
    updated: boardUpdates,
    results,
  };
}

function parseBulkRecords_(body) {
  let input = body.records;
  if (input == null || input === '') input = body.records_json;
  let rows = input;

  if (!Array.isArray(rows)) {
    try {
      rows = JSON.parse(String(rows || '[]'));
    } catch (_) {
      throw new Error('一括登録データを読み取れませんでした。');
    }
  }

  const max = Object.keys(MACHINES).length;
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > max) {
    throw new Error(`一括登録できる記録は1〜${max}件です。`);
  }

  const seenMachines = new Set();
  return rows.map(row => {
    const requestId = cleanId_(row.request_id, 12, 100, 'request_id');
    const machineId = String(row.machine_id || '').trim();
    const machine = MACHINES[machineId];
    if (!machine) throw new Error('存在しないマシンが含まれています。');
    if (seenMachines.has(machineId)) throw new Error('同じマシンの記録が重複しています。');
    seenMachines.add(machineId);

    const distance = Number(row.distance);
    if (!Number.isInteger(distance) || distance <= 0) throw new Error(`${machine.name}の距離が不正です。`);
    if (distance > machine.finalCap) throw new Error(`${machine.name}の距離が上限${machine.finalCap}mを超えています。`);

    return {
      requestId,
      machineId,
      distance,
      accel: normalizeJudge_(row.accel_judge),
      turbo: normalizeJudge_(row.turbo_judge),
      nitro: normalizeJudge_(row.nitro_judge),
      tuneLevel: Math.max(0, Math.min(50, Math.floor(Number(row.tune_level) || 0))),
      playedAt: normalizeDate_(row.played_at) || new Date(),
      sourceBuild: truncate_(row.source_build, 100),
      clientVersion: truncate_(row.client_version, 40),
    };
  });
}

function makeSubmitResponse_(args) {
  resetRankingDataCaches_();
  const ranks = args.fast ? { all: null, today: null, week: null } : getPlayerRanks_(args.playerId, args.machineId);
  return {
    ok: true,
    accepted: true,
    duplicate: Boolean(args.duplicate),
    skipped: Boolean(args.skipped),
    reason: args.reason || '',
    request_id: args.requestId,
    player_id: args.playerId,
    updated: args.updated || { machine: false, today: false, week: false },
    player_rank: ranks.all || null,
    player_ranks: ranks,
  };
}

function getPlayerRanks_(playerId, machineId) {
  return {
    all: getLeaderboard_({ period: 'all', player_id: playerId, machine_id: machineId, limit: '100' }).me || null,
    today: getLeaderboard_({ period: 'today', player_id: playerId, machine_id: machineId, limit: '100' }).me || null,
    week: getLeaderboard_({ period: 'week', player_id: playerId, machine_id: machineId, limit: '100' }).me || null,
  };
}

function renamePlayer_(body) {
  const playerId = cleanId_(body.player_id, 12, 100, 'player_id');
  const playerToken = normalizePlayerToken_(body.player_token);
  const displayName = validateName_(body.display_name);
  const player = findPlayerRecord_(playerId);

  enforceRateLimit_('rename', playerId, 10);
  assertPlayerIdentity_(player, playerToken, 'rename', displayName);
  assertNameAvailable_(displayName, playerId);

  const now = new Date();
  upsertPlayer_(playerId, displayName, now, 'ACTIVE', true, playerToken);
  propagateName_(playerId, displayName);

  return {
    ok: true,
    player_id: playerId,
    display_name: displayName,
    status: 'ACTIVE',
  };
}

function checkNameAvailable_(p) {
  const playerId = cleanId_(p.player_id, 12, 100, 'player_id');
  const displayName = validateName_(p.display_name);
  const available = !isDisplayNameTaken_(displayName, playerId);
  return {
    ok: true,
    available,
    display_name: displayName,
    error: available ? '' : 'このランキングネームはすでに使われています。',
  };
}

function getScoreStatus_(p) {
  const requestId = cleanId_(p.request_id, 12, 100, 'request_id');
  const playerId = cleanId_(p.player_id, 12, 100, 'player_id');
  const values = sheet_(CONFIG.SHEETS.SCORE_LOG).getDataRange().getValues();

  for (let i = values.length - 1; i >= 1; i--) {
    if (String(values[i][0]) !== requestId) continue;
    if (String(values[i][1]) !== playerId) throw new Error('記録の所有者が一致しません。');
    const machineId = String(values[i][3] || '');
    const ranks = getPlayerRanks_(playerId, machineId);
    return {
      ok: true,
      found: true,
      request_id: requestId,
      status: String(values[i][11] || ''),
      reason: String(values[i][12] || ''),
      accepted: String(values[i][11] || '') === 'ACCEPTED',
      player_rank: ranks.all || null,
      player_ranks: ranks,
    };
  }

  return { ok: true, found: false, request_id: requestId };
}

function getDashboard_(p) {
  const playerId = String(p.player_id || '').trim();
  const overview = {
    today: getLeaderboard_({ period: 'today', player_id: playerId, limit: '10' }),
    week: getLeaderboard_({ period: 'week', player_id: playerId, limit: '10' }),
    all: getLeaderboard_({ period: 'all', player_id: playerId, limit: '10' }),
  };
  const machines = Object.keys(MACHINES).map(machineId => ({
    machine_id: machineId,
    machine_name: MACHINES[machineId].name,
    board: getLeaderboard_({
      period: 'all',
      player_id: playerId,
      machine_id: machineId,
      include_secret: machineId === 'secret' ? 'true' : 'false',
      limit: '3',
    }),
  }));
  return {
    ok: true,
    api_version: CONFIG.API_VERSION,
    overview,
    machines,
    generated_at: nowIso_(),
  };
}

function getLeaderboard_(p) {
  const period = String(p.period || 'all').toLowerCase();
  const machineId = String(p.machine_id || '').trim();
  const playerId = String(p.player_id || '').trim();
  const includeSecret = String(p.include_secret || 'false').toLowerCase() === 'true';
  const limit = Math.max(1, Math.min(CONFIG.LEADERBOARD_LIMIT, Number(p.limit) || 100));

  if (machineId && !MACHINES[machineId]) throw new Error('存在しないマシンです。');
  if (!['all', 'today', 'week'].includes(period)) throw new Error('periodはall / today / weekです。');

  const rows = period === 'all'
    ? readMachineBestRecords_()
    : readPeriodBestRecords_(
        period === 'today' ? 'DAY' : 'WEEK',
        period === 'today' ? todayKey_() : getWeekKey_(new Date())
      );

  const filtered = rows.filter(row => {
    if (machineId && row.machine_id !== machineId) return false;
    if (!machineId && !includeSecret && MACHINES[row.machine_id] && MACHINES[row.machine_id].secret) return false;
    return Number.isFinite(row.best_distance) && row.best_distance > 0;
  });

  const byPlayer = new Map();
  filtered.forEach(row => {
    const current = byPlayer.get(row.player_id);
    if (
      !current ||
      row.best_distance > current.best_distance ||
      (row.best_distance === current.best_distance && row.achieved_at < current.achieved_at)
    ) {
      byPlayer.set(row.player_id, row);
    }
  });

  const ranked = [...byPlayer.values()]
    .sort((a, b) => b.best_distance - a.best_distance || String(a.achieved_at).localeCompare(String(b.achieved_at)))
    .map((row, index) => ({
      rank: index + 1,
      player_id: row.player_id,
      display_name: row.display_name,
      machine_id: row.machine_id,
      machine_name: row.machine_name,
      distance: row.best_distance,
      achieved_at: row.achieved_at,
    }));

  const meIndex = playerId ? ranked.findIndex(row => row.player_id === playerId) : -1;
  const me = meIndex >= 0 ? ranked[meIndex] : null;

  return {
    ok: true,
    period,
    period_key: period === 'today' ? todayKey_() : period === 'week' ? getWeekKey_(new Date()) : null,
    machine_id: machineId || null,
    include_secret: includeSecret,
    total_players: ranked.length,
    rows: ranked.slice(0, limit),
    me,
    around_me: meIndex >= 0 ? ranked.slice(Math.max(0, meIndex - 2), meIndex + 3) : [],
    generated_at: nowIso_(),
  };
}

function resolveIdentity_(p) {
  const token = normalizePlayerToken_(p.player_token);
  if (!token) return { ok: true, player: null };
  const values = playersSheet_().getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][6] || '') !== token) continue;
    return {
      ok: true,
      player: {
        player_id: String(values[i][0]),
        display_name: String(values[i][1] || ''),
        status: String(values[i][4] || 'ACTIVE'),
      },
    };
  }
  return { ok: true, player: null };
}

function getPlayer_(p) {
  const playerId = cleanId_(p.player_id, 12, 100, 'player_id');
  const player = findPlayerRecord_(playerId);
  if (!player) return { ok: true, player: null };

  return {
    ok: true,
    player: {
      player_id: player.player_id,
      display_name: player.display_name,
      created_at: dateToIso_(player.created_at),
      updated_at: dateToIso_(player.updated_at),
      status: player.status || 'ACTIVE',
    },
  };
}

function assertPlayerIdentity_(player, suppliedToken, operation, submittedName) {
  if (!player) return;
  const storedToken = String(player.player_token || '');
  if (!storedToken) return;
  if (suppliedToken && suppliedToken === storedToken) return;

  // player_idが一致し、登録済みの名前も同じなら本人の継続利用としてtoken更新を許可する。
  // 旧版からの移行や、ブラウザ側でtokenだけ消えた場合に自分の名前で弾かれないため。
  const sameName = canonicalNameKey_(player.display_name) === canonicalNameKey_(submittedName);
  if (sameName && (operation === 'submit' || operation === 'rename')) return;

  throw new Error('この端末のランキング登録情報が一致しません。登録した端末からお試しください。');
}

function normalizePlayerToken_(value) {
  const token = String(value || '').trim();
  if (!token) return '';
  return cleanId_(token, 16, 160, 'player_token');
}

function enforceRateLimit_(action, playerId, limit) {
  try {
    const bucket = Math.floor(Date.now() / 60000);
    const key = `boonjump-rate:${action}:${playerId}:${bucket}`;
    const cache = CacheService.getScriptCache();
    const count = Number(cache.get(key) || 0) + 1;
    if (count > limit) throw new Error('操作回数が多すぎます。少し待ってからお試しください。');
    cache.put(key, String(count), 70);
  } catch (error) {
    if (String(error && error.message || '').includes('操作回数')) throw error;
  }
}

function upsertPlayer_(playerId, displayName, now, status, updateNameTime, playerToken) {
  const sh = playersSheet_();
  const values = sh.getDataRange().getValues();
  const nextStatus = status || 'ACTIVE';

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) !== playerId) continue;
    const nextToken = String(playerToken || values[i][6] || '');
    sh.getRange(i + 1, 2, 1, 6).setValues([[
      displayName,
      values[i][2] || now,
      now,
      nextStatus,
      updateNameTime ? now : (values[i][5] || now),
      nextToken,
    ]]);
    return i + 1;
  }

  sh.appendRow([playerId, displayName, now, now, nextStatus, now, String(playerToken || '')]);
  return sh.getLastRow();
}

function findMachineBestDistance_(playerId, machineId) {
  const values = sheet_(CONFIG.SHEETS.MACHINE_BESTS).getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === playerId && String(values[i][2]) === machineId) {
      return Number(values[i][4]) || 0;
    }
  }
  return 0;
}

function findPeriodBestDistance_(periodType, periodKey, playerId, machineId) {
  const values = sheet_(CONFIG.SHEETS.PERIOD_BESTS).getDataRange().getValues();
  const normalizedKey = normalizePeriodKey_(periodKey);
  for (let i = 1; i < values.length; i++) {
    if (
      String(values[i][0]) === periodType &&
      normalizePeriodKey_(values[i][1]) === normalizedKey &&
      String(values[i][2]) === playerId &&
      String(values[i][4]) === machineId
    ) {
      return Number(values[i][6]) || 0;
    }
  }
  return 0;
}

function normalizePeriodKey_(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return Utilities.formatDate(value, CONFIG.TIMEZONE, 'yyyy-MM-dd');
  }
  const text = String(value || '').trim();
  const direct = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (direct) return `${direct[1]}-${direct[2]}-${direct[3]}`;
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return Utilities.formatDate(parsed, CONFIG.TIMEZONE, 'yyyy-MM-dd');
  return text;
}

function upsertMachineBest_(record) {
  const sh = sheet_(CONFIG.SHEETS.MACHINE_BESTS);
  const values = sh.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) !== record.playerId || String(values[i][2]) !== record.machineId) continue;
    const oldDistance = Number(values[i][4]) || 0;
    if (record.distance <= oldDistance) return false;
    sh.getRange(i + 1, 1, 1, 10).setValues([[
      record.playerId, record.displayName, record.machineId, record.machineName, record.distance,
      record.accel, record.turbo, record.nitro, record.achievedAt, record.sourceBuild,
    ]]);
    return true;
  }
  sh.appendRow([
    record.playerId, record.displayName, record.machineId, record.machineName, record.distance,
    record.accel, record.turbo, record.nitro, record.achievedAt, record.sourceBuild,
  ]);
  return true;
}

function upsertPeriodBest_(record) {
  const sh = sheet_(CONFIG.SHEETS.PERIOD_BESTS);
  const values = sh.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (
      String(values[i][0]) === record.periodType &&
      normalizePeriodKey_(values[i][1]) === normalizePeriodKey_(record.periodKey) &&
      String(values[i][2]) === record.playerId &&
      String(values[i][4]) === record.machineId
    ) {
      const oldDistance = Number(values[i][6]) || 0;
      if (record.distance <= oldDistance) return false;
      sh.getRange(i + 1, 1, 1, 10).setValues([[
        record.periodType, record.periodKey, record.playerId, record.displayName,
        record.machineId, record.machineName, record.distance, record.achievedAt,
        record.verified, record.sourceBuild,
      ]]);
      return true;
    }
  }
  sh.appendRow([
    record.periodType, record.periodKey, record.playerId, record.displayName,
    record.machineId, record.machineName, record.distance, record.achievedAt,
    record.verified, record.sourceBuild,
  ]);
  return true;
}

function appendScoreLog_(record) {
  sheet_(CONFIG.SHEETS.SCORE_LOG).appendRow([
    record.requestId, record.playerId, record.displayName, record.machineId, record.distance,
    record.accel, record.turbo, record.nitro, record.tuneLevel, record.playedAt, record.receivedAt,
    record.status, record.reason, record.sourceBuild, record.clientVersion,
  ]);
}

function requestExists_(requestId) {
  const sh = sheet_(CONFIG.SHEETS.SCORE_LOG);
  if (sh.getLastRow() < 2) return false;
  return Boolean(
    sh.getRange(2, 1, sh.getLastRow() - 1, 1)
      .createTextFinder(requestId)
      .matchEntireCell(true)
      .findNext()
  );
}

function propagateName_(playerId, displayName) {
  const targets = [
    { name: CONFIG.SHEETS.MACHINE_BESTS, playerCol: 1, nameCol: 2 },
    { name: CONFIG.SHEETS.PERIOD_BESTS, playerCol: 3, nameCol: 4 },
  ];

  targets.forEach(target => {
    const sh = sheet_(target.name);
    const last = sh.getLastRow();
    if (last < 2) return;
    const ids = sh.getRange(2, target.playerCol, last - 1, 1).getValues();
    const names = sh.getRange(2, target.nameCol, last - 1, 1).getValues();
    let changed = false;
    ids.forEach((row, index) => {
      if (String(row[0]) === playerId) {
        names[index][0] = displayName;
        changed = true;
      }
    });
    if (changed) sh.getRange(2, target.nameCol, names.length, 1).setValues(names);
  });
}

function resetRankingDataCaches_() {
  MACHINE_RECORDS_CACHE_ = null;
  PERIOD_RECORDS_CACHE_ = null;
}

function resetRequestCaches_() {
  SPREADSHEET_CACHE_ = null;
  resetRankingDataCaches_();
}

function readMachineBestRecords_() {
  if (MACHINE_RECORDS_CACHE_) return MACHINE_RECORDS_CACHE_;
  const values = sheet_(CONFIG.SHEETS.MACHINE_BESTS).getDataRange().getValues();
  MACHINE_RECORDS_CACHE_ = values.slice(1).filter(row => row[0]).map(row => ({
    player_id: String(row[0]),
    display_name: String(row[1] || 'NO NAME'),
    machine_id: String(row[2]),
    machine_name: String(row[3] || (MACHINES[row[2]] && MACHINES[row[2]].name) || row[2]),
    best_distance: Number(row[4]),
    achieved_at: dateToIso_(row[8]),
  }));
  return MACHINE_RECORDS_CACHE_;
}

function readAllPeriodBestRecords_() {
  if (PERIOD_RECORDS_CACHE_) return PERIOD_RECORDS_CACHE_;
  const values = sheet_(CONFIG.SHEETS.PERIOD_BESTS).getDataRange().getValues();
  PERIOD_RECORDS_CACHE_ = values.slice(1).filter(row => row[2]).map(row => ({
    period_type: String(row[0]),
    period_key: normalizePeriodKey_(row[1]),
    player_id: String(row[2]),
    display_name: String(row[3] || 'NO NAME'),
    machine_id: String(row[4]),
    machine_name: String(row[5] || (MACHINES[row[4]] && MACHINES[row[4]].name) || row[4]),
    best_distance: Number(row[6]),
    achieved_at: dateToIso_(row[7]),
  }));
  return PERIOD_RECORDS_CACHE_;
}

function readPeriodBestRecords_(periodType, periodKey) {
  const normalizedKey = normalizePeriodKey_(periodKey);
  return readAllPeriodBestRecords_().filter(row => row.period_type === periodType && row.period_key === normalizedKey);
}

function findPlayerRecord_(playerId) {
  const values = playersSheet_().getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) !== playerId) continue;
    return {
      row: i + 1,
      player_id: String(values[i][0]),
      display_name: String(values[i][1] || ''),
      created_at: values[i][2] || '',
      updated_at: values[i][3] || '',
      status: String(values[i][4] || 'ACTIVE'),
      player_token: String(values[i][6] || ''),
    };
  }
  return null;
}

function findPlayerRecordByToken_(playerToken) {
  if (!playerToken) return null;
  const values = playersSheet_().getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][6] || '') !== String(playerToken)) continue;
    return {
      row: i + 1,
      player_id: String(values[i][0]),
      display_name: String(values[i][1] || ''),
      created_at: values[i][2] || '',
      updated_at: values[i][3] || '',
      status: String(values[i][4] || 'ACTIVE'),
      player_token: String(values[i][6] || ''),
    };
  }
  return null;
}

function canonicalNameKey_(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F\u200B-\u200D\u2060\uFEFF]/g, '')
    .replace(/\s+/g, '')
    .toLocaleLowerCase();
}

function isDisplayNameTaken_(displayName, exceptPlayerId) {
  const target = canonicalNameKey_(displayName);
  if (!target) return false;

  const values = playersSheet_().getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    const rowPlayerId = String(values[i][0] || '');
    const rowName = String(values[i][1] || '');
    const rowStatus = String(values[i][4] || 'ACTIVE');
    if (!rowPlayerId || rowPlayerId === String(exceptPlayerId || '')) continue;
    if (rowStatus !== 'ACTIVE') continue;
    if (canonicalNameKey_(rowName) === target) return true;
  }
  return false;
}

function assertNameAvailable_(displayName, exceptPlayerId) {
  if (isDisplayNameTaken_(displayName, exceptPlayerId)) {
    throw new Error('このランキングネームはすでに使われています。別の名前をつけてください。');
  }
}

function validateName_(value) {
  const name = String(value || '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F\u200B-\u200D\u2060\uFEFF]/g, '')
    .trim();
  const length = [...name].length;

  if (length < CONFIG.NAME_MIN || length > CONFIG.NAME_MAX) {
    throw new Error(`名前は${CONFIG.NAME_MIN}〜${CONFIG.NAME_MAX}文字で入力してください。`);
  }
  if (/https?:\/\/|www\.|@/i.test(name)) {
    throw new Error('URLや連絡先は名前に使用できません。');
  }
  if (containsBlockedTerm_(name)) {
    throw new Error('この名前は使用できません。');
  }
  return name;
}

function containsBlockedTerm_(name) {
  const lower = normalizeModerationText_(name);
  const compact = compactModerationText_(lower);
  const tokens = lower.split(/[\s\u3000._\-‐‑–—・･,，、。!！?？"'`~…\/\\|:：;；()\[\]{}<>＜＞+=＋]+/).filter(Boolean);
  const blocked = getBlockedTerms_();

  return blocked.some(termValue => {
    const term = normalizeModerationText_(termValue);
    if (!term) return false;
    const termCompact = compactModerationText_(term);
    const length = [...termCompact].length;
    const ascii = /^[a-z0-9]+$/.test(termCompact);

    if (ascii && length <= 3) return tokens.includes(termCompact);
    if (!ascii && length <= 2) return compact === termCompact || tokens.includes(termCompact);
    return compact.includes(termCompact);
  });
}

function getBlockedTerms_() {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'boonjump-blocked-terms-v2';
  try {
    const cached = cache.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (_) {}

  const terms = sheet_(CONFIG.SHEETS.BLOCKED_NAMES).getDataRange().getValues().slice(1)
    .filter(row => row[0] && row[2] === true)
    .map(row => String(row[0]));

  try { cache.put(cacheKey, JSON.stringify(terms), 300); } catch (_) {}
  return terms;
}

function normalizeModerationText_(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F\u200B-\u200D\u2060\uFEFF]/g, '')
    .toLocaleLowerCase()
    .trim();
}

function compactModerationText_(value) {
  return normalizeModerationText_(value)
    .replace(/[\s\u3000._\-‐‑–—・･,，、。!！?？"'`~…\/\\|:：;；()\[\]{}<>＜＞+=＋]/g, '');
}

function normalizeJudge_(value) {
  const judge = String(value || 'MISS').toUpperCase();
  if (!VALID_JUDGES.has(judge)) throw new Error('判定値が不正です。');
  return judge;
}

function cleanId_(value, min, max, label) {
  const id = String(value || '').trim();
  if (id.length < min || id.length > max || !/^[A-Za-z0-9._:-]+$/.test(id)) {
    throw new Error(`${label}が不正です。`);
  }
  return id;
}

function parseBody_(e) {
  const text = e && e.postData && e.postData.contents;
  if (text) {
    try { return JSON.parse(text); } catch (_) {}
  }
  return (e && e.parameter) || {};
}

function output_(payload, callback) {
  const json = JSON.stringify(payload);
  if (callback && /^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(callback)) {
    return ContentService.createTextOutput(`${callback}(${json});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function spreadsheet_() {
  if (!SPREADSHEET_CACHE_) SPREADSHEET_CACHE_ = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  return SPREADSHEET_CACHE_;
}

function sheet_(name) {
  const sh = spreadsheet_().getSheetByName(name);
  if (!sh) throw new Error(`シート「${name}」がありません。`);
  return sh;
}

function playersSheet_() {
  const sh = sheet_(CONFIG.SHEETS.PLAYERS);
  if (String(sh.getRange(1, 7).getValue() || '') !== 'player_token') {
    sh.getRange(1, 7).setValue('player_token');
  }
  return sh;
}

function todayKey_() {
  return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd');
}

function getWeekKey_(date) {
  const local = new Date(Utilities.formatDate(date, CONFIG.TIMEZONE, 'yyyy/MM/dd HH:mm:ss'));
  const day = local.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  local.setDate(local.getDate() + diff);
  local.setHours(0, 0, 0, 0);
  return Utilities.formatDate(local, CONFIG.TIMEZONE, 'yyyy-MM-dd');
}

function normalizeDate_(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateToIso_(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function nowIso_() {
  return new Date().toISOString();
}

function truncate_(value, maxLength) {
  return String(value || '').slice(0, maxLength);
}

/** 管理用: 既存の重複名を整理 */
function repairDuplicateNames() {
  const sh = playersSheet_();
  const values = sh.getDataRange().getValues();
  const claimed = new Set();
  let repaired = 0;

  for (let i = 1; i < values.length; i++) {
    const key = canonicalNameKey_(values[i][1]);
    if (!key) continue;
    if (claimed.has(key)) {
      sh.getRange(i + 1, 2).clearContent();
      sh.getRange(i + 1, 4).setValue(new Date());
      sh.getRange(i + 1, 5).setValue('RENAME_REQUIRED');
      repaired += 1;
    } else {
      claimed.add(key);
    }
  }
  SpreadsheetApp.flush();
  console.log('重複名の整理件数: ' + repaired);
  return repaired;
}

/** 管理用: period_bestsの既存重複を整理 */
function repairPeriodBestDuplicates() {
  const sh = sheet_(CONFIG.SHEETS.PERIOD_BESTS);
  const values = sh.getDataRange().getValues();
  if (values.length < 3) return 0;

  const header = values[0];
  const bestByKey = new Map();
  values.slice(1).forEach(row => {
    if (!row[2]) return;
    const key = [String(row[0]), normalizePeriodKey_(row[1]), String(row[2]), String(row[4])].join('::');
    const current = bestByKey.get(key);
    if (!current || Number(row[6] || 0) > Number(current[6] || 0)) {
      const copy = row.slice();
      copy[1] = normalizePeriodKey_(row[1]);
      bestByKey.set(key, copy);
    }
  });

  const rows = [...bestByKey.values()];
  sh.clearContents();
  sh.getRange(1, 1, 1, header.length).setValues([header]);
  if (rows.length) sh.getRange(2, 1, rows.length, header.length).setValues(rows);
  SpreadsheetApp.flush();
  return Math.max(0, values.length - 1 - rows.length);
}

/** Apps Script上で手動実行する接続テスト */
function testHealth() {
  console.log(JSON.stringify({
    health: {
      ok: true,
      api_version: CONFIG.API_VERSION,
      ranking_mode: 'manual',
    },
    leaderboard: getLeaderboard_({ period: 'all', limit: '10' }),
  }, null, 2));
}
