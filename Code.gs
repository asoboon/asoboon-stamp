/**
 * ブーンジャンプ 世界ランキング API V2.2.4
 * 保存先: Google Spreadsheet
 * Spreadsheet ID: 1oFLApJ_0IlTUc-DLhoFSDIS7OspzlrZ9rm4ia71EvME
 */

const CONFIG = Object.freeze({
  SPREADSHEET_ID: '1oFLApJ_0IlTUc-DLhoFSDIS7OspzlrZ9rm4ia71EvME',
  TIMEZONE: 'Asia/Tokyo',
  LEADERBOARD_LIMIT: 100,
  NAME_MIN: 2,
  NAME_MAX: 12,
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

function doGet(e) {
  const p = (e && e.parameter) || {};
  const callback = p.callback;
  try {
    const action = String(p.action || 'health').toLowerCase();
    let result;

    if (action === 'health') {
      result = {
        ok: true,
        service: 'boonjump-ranking',
        api_version: '2.2.4',
        now: nowIso_(),
      };
    } else if (action === 'leaderboard') {
      result = getLeaderboard_(p);
    } else if (action === 'player') {
      result = getPlayer_(p);
    } else if (action === 'name_available') {
      result = checkNameAvailable_(p);
    } else if (action === 'score_status') {
      result = getScoreStatus_(p);
    } else if (action === 'submit' || action === 'rename') {
      // GitHub Pagesからの書き込みはJSONP GETで受ける。
      // POST＋hidden iframe方式より、成功・失敗を確実にゲームへ返せる。
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
    return output_({
      ok: false,
      error: String(error.message || error),
    }, callback);
  }
}

function doPost(e) {
  try {
    const body = parseBody_(e);
    const action = String(body.action || 'submit').toLowerCase();
    const result = withScriptLock_(function () {
      let value;
      if (action === 'submit') {
        value = submitScore_(body);
      } else if (action === 'rename') {
        value = renamePlayer_(body);
      } else {
        throw new Error('不明なactionです。');
      }
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
  const playerId = cleanId_(body.player_id, 12, 100, 'player_id');
  const submittedName = validateName_(body.display_name);
  const player = findPlayerRecord_(playerId);

  if (player && String(player.status || 'ACTIVE') !== 'ACTIVE') {
    throw new Error('ランキングネームの再登録が必要です。');
  }

  let displayName = submittedName;
  if (player) {
    // 記録送信では名前を勝手に変更させない。登録済みの名前を正本にする。
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

  if (!machine) throw new Error('存在しないマシンです。');
  if (!Number.isInteger(distance) || distance < 0) throw new Error('距離が不正です。');
  if (distance > machine.finalCap) throw new Error(`距離が上限${machine.finalCap}mを超えています。`);

  if (requestExists_(requestId)) {
    const duplicateSnapshot = getLeaderboard_({
      period: 'all',
      player_id: playerId,
      machine_id: machineId,
      limit: '10',
    });
    return {
      ok: true,
      accepted: true,
      duplicate: true,
      request_id: requestId,
      player_rank: duplicateSnapshot.me || null,
    };
  }

  let status = 'ACCEPTED';
  let reason = '';
  if (Math.abs(receivedAt.getTime() - playedAt.getTime()) > 24 * 60 * 60 * 1000) {
    status = 'REVIEW';
    reason = 'played_atが受信時刻から24時間以上離れています。';
  }

  upsertPlayer_(playerId, displayName, receivedAt, 'ACTIVE', !player);
  appendScoreLog_({
    requestId, playerId, displayName, machineId, distance,
    accel, turbo, nitro, tuneLevel, playedAt, receivedAt,
    status, reason, sourceBuild, clientVersion,
  });

  let machineUpdated = false;
  let dayUpdated = false;
  let weekUpdated = false;

  if (status === 'ACCEPTED') {
    machineUpdated = upsertMachineBest_({
      playerId, displayName, machineId, machineName: machine.name,
      distance, accel, turbo, nitro, achievedAt: receivedAt, sourceBuild,
    });

    const dayKey = Utilities.formatDate(receivedAt, CONFIG.TIMEZONE, 'yyyy-MM-dd');
    const weekKey = getWeekKey_(receivedAt);

    dayUpdated = upsertPeriodBest_({
      periodType: 'DAY', periodKey: dayKey, playerId, displayName,
      machineId, machineName: machine.name, distance,
      achievedAt: receivedAt, verified: true, sourceBuild,
    });
    weekUpdated = upsertPeriodBest_({
      periodType: 'WEEK', periodKey: weekKey, playerId, displayName,
      machineId, machineName: machine.name, distance,
      achievedAt: receivedAt, verified: true, sourceBuild,
    });
  }

  const snapshot = getLeaderboard_({
    period: 'all',
    player_id: playerId,
    machine_id: machineId,
    limit: '10',
  });

  return {
    ok: true,
    accepted: status === 'ACCEPTED',
    review: status === 'REVIEW',
    reason,
    request_id: requestId,
    updated: {
      machine: machineUpdated,
      today: dayUpdated,
      week: weekUpdated,
    },
    player_rank: snapshot.me || null,
  };
}

function renamePlayer_(body) {
  const playerId = cleanId_(body.player_id, 12, 100, 'player_id');
  const displayName = validateName_(body.display_name);
  assertNameAvailable_(displayName, playerId);

  const now = new Date();
  upsertPlayer_(playerId, displayName, now, 'ACTIVE', true);
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
    const snapshot = getLeaderboard_({
      period: 'all',
      player_id: playerId,
      machine_id: machineId,
      limit: '10',
    });
    return {
      ok: true,
      found: true,
      request_id: requestId,
      status: String(values[i][11] || ''),
      reason: String(values[i][12] || ''),
      accepted: String(values[i][11] || '') === 'ACCEPTED',
      player_rank: snapshot.me || null,
    };
  }
  return { ok: true, found: false, request_id: requestId };
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
    : readPeriodBestRecords_(period === 'today' ? 'DAY' : 'WEEK', period === 'today' ? todayKey_() : getWeekKey_(new Date()));

  const filtered = rows.filter(r => {
    if (machineId && r.machine_id !== machineId) return false;
    if (!machineId && !includeSecret && MACHINES[r.machine_id] && MACHINES[r.machine_id].secret) return false;
    return Number.isFinite(r.best_distance) && r.best_distance >= 0;
  });

  // 同一人物は各ランキングに最高記録1件だけ。
  const byPlayer = new Map();
  filtered.forEach(r => {
    const current = byPlayer.get(r.player_id);
    if (!current || r.best_distance > current.best_distance ||
        (r.best_distance === current.best_distance && r.achieved_at < current.achieved_at)) {
      byPlayer.set(r.player_id, r);
    }
  });

  const ranked = [...byPlayer.values()]
    .sort((a, b) => b.best_distance - a.best_distance || String(a.achieved_at).localeCompare(String(b.achieved_at)))
    .map((r, i) => ({
      rank: i + 1,
      player_id: r.player_id,
      display_name: r.display_name,
      machine_id: r.machine_id,
      machine_name: r.machine_name,
      distance: r.best_distance,
      achieved_at: r.achieved_at,
    }));

  const meIndex = playerId ? ranked.findIndex(r => r.player_id === playerId) : -1;
  const me = meIndex >= 0 ? ranked[meIndex] : null;
  const aroundMe = meIndex >= 0 ? ranked.slice(Math.max(0, meIndex - 2), meIndex + 3) : [];

  return {
    ok: true,
    period,
    period_key: period === 'today' ? todayKey_() : period === 'week' ? getWeekKey_(new Date()) : null,
    machine_id: machineId || null,
    include_secret: includeSecret,
    total_players: ranked.length,
    rows: ranked.slice(0, limit),
    me,
    around_me: aroundMe,
    generated_at: nowIso_(),
  };
}

function getPlayer_(p) {
  const playerId = cleanId_(p.player_id, 12, 100, 'player_id');
  const players = sheet_(CONFIG.SHEETS.PLAYERS).getDataRange().getValues();
  for (let i = 1; i < players.length; i++) {
    if (String(players[i][0]) === playerId) {
      return {
        ok: true,
        player: {
          player_id: players[i][0],
          display_name: players[i][1],
          created_at: dateToIso_(players[i][2]),
          updated_at: dateToIso_(players[i][3]),
          status: players[i][4] || 'ACTIVE',
        },
      };
    }
  }
  return { ok: true, player: null };
}

function upsertPlayer_(playerId, displayName, now, status, updateNameTime) {
  const sh = sheet_(CONFIG.SHEETS.PLAYERS);
  const values = sh.getDataRange().getValues();
  const nextStatus = status || 'ACTIVE';

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === playerId) {
      sh.getRange(i + 1, 2, 1, 5).setValues([[
        displayName,
        values[i][2] || now,
        now,
        nextStatus,
        updateNameTime ? now : (values[i][5] || now),
      ]]);
      return i + 1;
    }
  }

  sh.appendRow([playerId, displayName, now, now, nextStatus, now]);
  return sh.getLastRow();
}

function upsertMachineBest_(r) {
  const sh = sheet_(CONFIG.SHEETS.MACHINE_BESTS);
  const values = sh.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === r.playerId && String(values[i][2]) === r.machineId) {
      const oldDistance = Number(values[i][4]) || 0;
      if (r.distance <= oldDistance) return false;
      sh.getRange(i + 1, 1, 1, 10).setValues([[
        r.playerId, r.displayName, r.machineId, r.machineName, r.distance,
        r.accel, r.turbo, r.nitro, r.achievedAt, r.sourceBuild,
      ]]);
      return true;
    }
  }
  sh.appendRow([
    r.playerId, r.displayName, r.machineId, r.machineName, r.distance,
    r.accel, r.turbo, r.nitro, r.achievedAt, r.sourceBuild,
  ]);
  return true;
}

function upsertPeriodBest_(r) {
  const sh = sheet_(CONFIG.SHEETS.PERIOD_BESTS);
  const values = sh.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === r.periodType &&
        String(values[i][1]) === r.periodKey &&
        String(values[i][2]) === r.playerId &&
        String(values[i][4]) === r.machineId) {
      const oldDistance = Number(values[i][6]) || 0;
      if (r.distance <= oldDistance) return false;
      sh.getRange(i + 1, 1, 1, 10).setValues([[
        r.periodType, r.periodKey, r.playerId, r.displayName,
        r.machineId, r.machineName, r.distance, r.achievedAt,
        r.verified, r.sourceBuild,
      ]]);
      return true;
    }
  }
  sh.appendRow([
    r.periodType, r.periodKey, r.playerId, r.displayName,
    r.machineId, r.machineName, r.distance, r.achievedAt,
    r.verified, r.sourceBuild,
  ]);
  return true;
}

function appendScoreLog_(r) {
  sheet_(CONFIG.SHEETS.SCORE_LOG).appendRow([
    r.requestId, r.playerId, r.displayName, r.machineId, r.distance,
    r.accel, r.turbo, r.nitro, r.tuneLevel, r.playedAt, r.receivedAt,
    r.status, r.reason, r.sourceBuild, r.clientVersion,
  ]);
}

function requestExists_(requestId) {
  const sh = sheet_(CONFIG.SHEETS.SCORE_LOG);
  if (sh.getLastRow() < 2) return false;
  return !!sh.getRange(2, 1, sh.getLastRow() - 1, 1)
    .createTextFinder(requestId)
    .matchEntireCell(true)
    .findNext();
}

function propagateName_(playerId, displayName) {
  const targets = [
    { name: CONFIG.SHEETS.MACHINE_BESTS, playerCol: 1, nameCol: 2 },
    { name: CONFIG.SHEETS.PERIOD_BESTS, playerCol: 3, nameCol: 4 },
  ];
  targets.forEach(t => {
    const sh = sheet_(t.name);
    const last = sh.getLastRow();
    if (last < 2) return;
    const ids = sh.getRange(2, t.playerCol, last - 1, 1).getValues();
    const names = sh.getRange(2, t.nameCol, last - 1, 1).getValues();
    let changed = false;
    ids.forEach((row, i) => {
      if (String(row[0]) === playerId) {
        names[i][0] = displayName;
        changed = true;
      }
    });
    if (changed) sh.getRange(2, t.nameCol, names.length, 1).setValues(names);
  });
}

function readMachineBestRecords_() {
  const v = sheet_(CONFIG.SHEETS.MACHINE_BESTS).getDataRange().getValues();
  return v.slice(1).filter(r => r[0]).map(r => ({
    player_id: String(r[0]),
    display_name: String(r[1] || 'NO NAME'),
    machine_id: String(r[2]),
    machine_name: String(r[3] || (MACHINES[r[2]] && MACHINES[r[2]].name) || r[2]),
    best_distance: Number(r[4]),
    achieved_at: dateToIso_(r[8]),
  }));
}

function readPeriodBestRecords_(periodType, periodKey) {
  const v = sheet_(CONFIG.SHEETS.PERIOD_BESTS).getDataRange().getValues();
  return v.slice(1)
    .filter(r => String(r[0]) === periodType && String(r[1]) === periodKey && r[2])
    .map(r => ({
      player_id: String(r[2]),
      display_name: String(r[3] || 'NO NAME'),
      machine_id: String(r[4]),
      machine_name: String(r[5] || (MACHINES[r[4]] && MACHINES[r[4]].name) || r[4]),
      best_distance: Number(r[6]),
      achieved_at: dateToIso_(r[7]),
    }));
}

function findPlayerRecord_(playerId) {
  const values = sheet_(CONFIG.SHEETS.PLAYERS).getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === playerId) {
      return {
        row: i + 1,
        player_id: String(values[i][0]),
        display_name: String(values[i][1] || ''),
        status: String(values[i][4] || 'ACTIVE'),
      };
    }
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

  const values = sheet_(CONFIG.SHEETS.PLAYERS).getDataRange().getValues();
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

/**
 * 既存の重複名を整理する管理用関数。
 * 同じ名前は一番古い1件だけACTIVEで残し、後発を再登録待ちにする。
 */
function repairDuplicateNames() {
  const sh = sheet_(CONFIG.SHEETS.PLAYERS);
  const values = sh.getDataRange().getValues();
  const claimed = new Set();
  let repaired = 0;

  for (let i = 1; i < values.length; i++) {
    const name = String(values[i][1] || '');
    const key = canonicalNameKey_(name);
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

function validateName_(value) {
  const name = String(value || '').normalize('NFKC').replace(/[\u0000-\u001F\u007F\u200B-\u200D\u2060\uFEFF]/g, '').trim();
  const length = [...name].length;
  if (length < CONFIG.NAME_MIN || length > CONFIG.NAME_MAX) {
    throw new Error(`名前は${CONFIG.NAME_MIN}〜${CONFIG.NAME_MAX}文字で入力してください。`);
  }
  if (/https?:\/\/|www\.|@/i.test(name)) throw new Error('URLや連絡先は名前に使用できません。');

  const blocked = sheet_(CONFIG.SHEETS.BLOCKED_NAMES).getDataRange().getValues().slice(1)
    .filter(r => r[0] && r[2] === true)
    .map(r => String(r[0]).normalize('NFKC').toLowerCase());
  const lower = name.toLowerCase();
  if (blocked.some(word => lower.includes(word))) throw new Error('この名前は使用できません。');
  return name;
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

function sheet_(name) {
  const sh = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(name);
  if (!sh) throw new Error(`シート「${name}」がありません。`);
  return sh;
}

function todayKey_() {
  return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd');
}

function getWeekKey_(date) {
  // 月曜開始。キーはその週の月曜日 yyyy-MM-dd。
  const local = new Date(Utilities.formatDate(date, CONFIG.TIMEZONE, "yyyy/MM/dd HH:mm:ss"));
  const day = local.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  local.setDate(local.getDate() + diff);
  local.setHours(0, 0, 0, 0);
  return Utilities.formatDate(local, CONFIG.TIMEZONE, 'yyyy-MM-dd');
}

function normalizeDate_(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dateToIso_(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

function nowIso_() {
  return new Date().toISOString();
}

function truncate_(value, max) {
  return String(value || '').slice(0, max);
}

/**
 * Apps Script上で手動実行する接続テスト。
 * 実行ログにJSONが出ればスプレッドシート接続成功。
 */
function testHealth() {
  console.log(JSON.stringify(getLeaderboard_({ period: 'all', limit: '10' }), null, 2));
}
