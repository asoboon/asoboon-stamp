
/**
 * ASOBooN 当日サプライズイベント投票 Backend
 * Standalone Google Apps Script / 専用スプレッドシート用
 *
 * 既存の受付・呼出・ランキングGASには混ぜないでください。
 *
 * 初回:
 * 1. 新しいGoogleスプレッドシートを作る
 * 2. 拡張機能 > Apps Script にこのファイルを貼る
 * 3. setupSurpriseVoteSpreadsheet() を1回実行
 * 4. ウェブアプリとしてデプロイ（実行: 自分 / アクセス: 全員）
 * 5. 発行された /exec URL を surprise-vote-config.js の API_URL に設定
 */

const SURPRISE_VOTE = Object.freeze({
  VERSION: '2.2.0',
  TIMEZONE: 'Asia/Tokyo',
  MAX_POINTS: 100,
  EVENT_SHEET: 'イベント設定',
  VOTE_SHEET: '投票データ',
  TOTAL_SHEET: '集計',
  GUIDE_SHEET: '使い方',
  PROP_SPREADSHEET_ID: 'SURPRISE_SPREADSHEET_ID',
  PROP_VOTER_SALT: 'SURPRISE_VOTER_SALT',
  EVENT_CACHE_SECONDS: 30,
  TOTAL_CACHE_SECONDS: 10,
  LOCK_WAIT_MS: 900,
  SETTLE_SECONDS: 20,
  DAILY_RESET_HOUR: 18
});

const SURPRISE_EVENT_HEADERS = Object.freeze([
  '開催日',
  '開催時刻',
  '開催',
  '候補1',
  '候補2',
  '候補3',
  '候補4',
  '候補5',
  '候補6',
  '候補7',
  '候補8',
  '候補9',
  '候補10',
  '結果上書き',
  '中止',
  'メモ',
  '自動確定候補',
  '確定種別',
  '更新日時'
]);

const SURPRISE_VOTE_HEADERS = Object.freeze([
  'event_id',
  'voter_hash',
  'used',
  'allocations_json',
  'updated_at'
]);

const SURPRISE_EVENT_OPTIONS = Object.freeze([
  'パラバルーン（グリーン）',
  'パラバルーン（ボールプール）',
  '宝探し',
  'だるまさんが隠れた',
  'ふわふわベッド',
  '跳び箱',
  '赤ちゃんイベント',
  '鬼ごっこ'
]);

const SURPRISE_TOTAL_HEADERS = Object.freeze([
  'event_id',
  'c1',
  'c2',
  'c3',
  'c4',
  'c5',
  'c6',
  'c7',
  'c8',
  'c9',
  'c10',
  'updated_at'
]);

const SURPRISE_SCHEDULES = Object.freeze({
  '11:00': Object.freeze({
    start: '08:00',
    end: '10:45',
    resultEnd: '11:30'
  }),
  '14:00': Object.freeze({
    start: '11:30',
    end: '13:45',
    resultEnd: '14:30'
  }),
  '14:30': Object.freeze({
    start: '11:30',
    end: '14:15',
    resultEnd: '15:00'
  }),
  '16:00': Object.freeze({
    start: '14:30',
    end: '15:45',
    resultEnd: '16:30'
  })
});

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    const action = String(params.action || 'status').toLowerCase();

    let payload;

    if (action === 'health') {
      payload = {
        ok: true,
        version: SURPRISE_VOTE.VERSION,
        architecture: 'GAS_V2_1_CUMULATIVE_SINGLE_SOURCE',
        dailyReset: '18:00',
        settleSeconds: SURPRISE_VOTE.SETTLE_SECONDS,
        eventCacheSeconds: SURPRISE_VOTE.EVENT_CACHE_SECONDS,
        totalCacheSeconds: SURPRISE_VOTE.TOTAL_CACHE_SECONDS,
        lockWaitMs: SURPRISE_VOTE.LOCK_WAIT_MS,
        now: isoNow_()
      };
    } else if (action === 'status') {
      payload = apiSurpriseStatus_(params);
    } else if (action === 'vote') {
      payload = apiSurpriseVote_(params);
    } else {
      throw new Error('未対応のactionです。');
    }

    return surpriseOutput_(payload, params.callback);
  } catch (error) {
    const params = (e && e.parameter) || {};
    return surpriseOutput_(
      {
        ok: false,
        error: String(error && error.message ? error.message : error),
        now: isoNow_()
      },
      params.callback
    );
  }
}

function apiSurpriseStatus_(params) {
  const now = new Date();

  if (isAfterSurpriseDailyReset_(now)) {
    return {
      ok: true,
      version: SURPRISE_VOTE.VERSION,
      now: formatIso_(now),
      mode: 'idle',
      event: null,
      daily_reset: '18:00'
    };
  }

  const active = findCurrentSurpriseEvent_(now);

  if (active) {
    const overlap = findSurpriseOverlapForEvent_(active, now);
    if (overlap) {
      return {
        ok: true,
        version: SURPRISE_VOTE.VERSION,
        now: formatIso_(now),
        mode: 'configuration_error',
        event: null,
        configuration_issue: 'OVERLAPPING_VOTE_WINDOWS',
        message: 'イベント情報を準備しています。',
        daily_reset: '18:00'
      };
    }
  }

  if (!active) {
    const upcoming = findNextSurpriseEvent_(now);

    if (upcoming) {
      const overlap = findSurpriseOverlapForEvent_(upcoming, now);
      if (overlap) {
        return {
          ok: true,
          version: SURPRISE_VOTE.VERSION,
          now: formatIso_(now),
          mode: 'configuration_error',
          event: null,
          configuration_issue: 'OVERLAPPING_VOTE_WINDOWS',
          message: 'イベント情報を準備しています。',
          daily_reset: '18:00'
        };
      }

      return {
        ok: true,
        version: SURPRISE_VOTE.VERSION,
        now: formatIso_(now),
        mode: 'upcoming',
        event: publicUpcomingSurpriseEvent_(upcoming),
        daily_reset: '18:00'
      };
    }

    return {
      ok: true,
      version: SURPRISE_VOTE.VERSION,
      now: formatIso_(now),
      mode: 'idle',
      event: null,
      daily_reset: '18:00'
    };
  }

  const voterKey = sanitizeVoterKey_(params.voterKey);
  let vote = null;

  if (voterKey) {
    const voterHash = surpriseVoterHash_(voterKey);
    vote = getSurpriseVote_(active.id, voterHash);
  }

  const revealTotals =
    active.phase === 'result' ||
    !!(vote && vote.used >= SURPRISE_VOTE.MAX_POINTS);

  const totals = revealTotals
    ? (
        active.phase === 'result'
          ? getSurpriseFinalTotals_(active.id, now)
          : getSurpriseTotalsCached_(active.id)
      )
    : emptySurpriseTotals_();

  const options = active.options.map(option => ({
    id: option.id,
    name: option.name,
    total: revealTotals ? Number(totals[option.id] || 0) : null
  }));

  const eventPayload = publicSurpriseEvent_(active, options);
  const response = {
    ok: true,
    version: SURPRISE_VOTE.VERSION,
    now: formatIso_(now),
    mode: active.phase,
    event: eventPayload,
    rank_visible: revealTotals,
    daily_reset: '18:00'
  };

  if (vote) {
    response.user = {
      used: vote.used,
      remaining: Math.max(0, SURPRISE_VOTE.MAX_POINTS - vote.used),
      allocations: vote.allocations
    };
  }

  if (active.phase === 'result') {
    const winner = ensureSurpriseWinner_(active, totals);
    response.winner = winner
      ? {
          id: winner.id,
          name: winner.name,
          total: Number(totals[winner.id] || 0)
        }
      : null;
  }

  return response;
}

function apiSurpriseVote_(params) {
  const eventId = String(params.eventId || '').trim();
  const voterKey = sanitizeVoterKey_(params.voterKey);
  const targets = parseSurpriseTargets_(params.targets);
  const now = new Date();

  if (!eventId) throw new Error('eventIdがありません。');
  if (!voterKey) throw new Error('投票者を確認できません。');

  if (isAfterSurpriseDailyReset_(now)) {
    return {
      ok: false,
      mode: 'idle',
      errorCode: 'DAY_RESET',
      error: '本日の投票は終了しました。',
      now: formatIso_(now)
    };
  }

  const event = findSurpriseEventById_(eventId, now);

  if (!event) {
    throw new Error('このイベントは見つかりません。');
  }

  const overlap = findSurpriseOverlapForEvent_(event, now);
  if (overlap) {
    return {
      ok: false,
      mode: 'configuration_error',
      errorCode: 'OVERLAPPING_VOTE_WINDOWS',
      error: 'イベント情報を準備しています。',
      now: formatIso_(now)
    };
  }

  if (!event.enabled || event.cancelled || event.options.length < 2) {
    return {
      ok: false,
      mode: 'idle',
      error: 'この投票は現在受付していません。',
      now: formatIso_(now)
    };
  }

  if (event.phase !== 'voting' && event.phase !== 'settling') {
    return {
      ok: false,
      mode: event.phase,
      error: 'この投票の受付は終了しました。',
      now: formatIso_(now)
    };
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(SURPRISE_VOTE.LOCK_WAIT_MS)) {
    return {
      ok: false,
      busy: true,
      errorCode: 'BUSY_RETRY',
      retryAfterMs: 500 + Math.floor(Math.random() * 1501),
      error: '投票が混み合っています。自動で再送します。',
      now: formatIso_(now)
    };
  }

  let result;

  try {
    const validIds = new Set(event.options.map(option => option.id));
    const voterHash = surpriseVoterHash_(voterKey);
    const current = getSurpriseVote_(event.id, voterHash);
    const next = Object.assign({}, current.allocations);

    let used = current.used;
    const accepted = {};

    event.options.forEach(option => {
      const id = option.id;
      const currentValue = Math.max(0, Number(next[id] || 0));
      const requested = Math.max(
        currentValue,
        Math.min(
          SURPRISE_VOTE.MAX_POINTS,
          Math.floor(Number(targets[id] || currentValue))
        )
      );

      if (!validIds.has(id) || requested <= currentValue) return;

      const remaining = Math.max(0, SURPRISE_VOTE.MAX_POINTS - used);
      if (remaining <= 0) return;

      const delta = Math.min(requested - currentValue, remaining);
      if (delta <= 0) return;

      next[id] = currentValue + delta;
      used += delta;
      accepted[id] = delta;
    });

    if (used > SURPRISE_VOTE.MAX_POINTS) {
      throw new Error('投票上限を超えています。');
    }

    if (Object.keys(accepted).length > 0) {
      upsertSurpriseVote_(
        event.id,
        voterHash,
        used,
        next,
        now,
        current.row
      );
    }

    result = {
      ok: true,
      version: SURPRISE_VOTE.VERSION,
      now: formatIso_(now),
      mode: event.phase,
      accepted: accepted,
      user: {
        used: used,
        remaining: Math.max(0, SURPRISE_VOTE.MAX_POINTS - used),
        allocations: next
      }
    };
  } finally {
    lock.releaseLock();
  }

  return result;
}

function findCurrentSurpriseEvent_(now) {
  if (isAfterSurpriseDailyReset_(now)) return null;

  const events = loadSurpriseEvents_(now)
    .filter(event => event.enabled && !event.cancelled)
    .filter(event => event.options.length >= 2);

  const voting = events.find(event => event.phase === 'voting');
  if (voting) return voting;

  const settling = events.find(event => event.phase === 'settling');
  if (settling) return settling;

  const result = events.find(event => event.phase === 'result');
  if (result) return result;

  return null;
}

function findNextSurpriseEvent_(now) {
  if (isAfterSurpriseDailyReset_(now)) return null;

  const todayUpcoming = loadSurpriseEvents_(now)
    .filter(event => event.enabled && !event.cancelled)
    .filter(event => event.options.length >= 2)
    .filter(event => event.start > now)
    .sort((a, b) => a.start - b.start)[0];

  if (todayUpcoming) return todayUpcoming;

  return loadFutureSurpriseEvents_(now)
    .filter(event => event.enabled && !event.cancelled)
    .filter(event => event.options.length >= 2)
    .filter(event => event.start > now)
    .sort((a, b) => a.start - b.start)[0] || null;
}

function loadFutureSurpriseEvents_(now) {
  const cache = CacheService.getScriptCache();
  const today = Utilities.formatDate(
    now,
    SURPRISE_VOTE.TIMEZONE,
    'yyyy-MM-dd'
  );
  const cacheKey = 'surprise:v2:future:' + today;
  const cached = cache.get(cacheKey);

  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        return parsed.map(definition =>
          buildSurpriseEventFromDefinition_(definition, now)
        );
      }
    } catch (_) {}
  }

  const sheet = getSurpriseSpreadsheet_()
    .getSheetByName(SURPRISE_VOTE.EVENT_SHEET);

  if (!sheet || sheet.getLastRow() < 2) return [];

  const values = sheet
    .getRange(1, 1, sheet.getLastRow(), SURPRISE_EVENT_HEADERS.length)
    .getValues();

  const headers = values.shift();
  const definitions = [];

  values.forEach((row, index) => {
    const object = {};
    headers.forEach((header, column) => {
      object[String(header)] = row[column];
    });

    const date = normalizeSurpriseDate_(object['開催日']);
    if (!date || date <= today) return;

    const definition = buildSurpriseDefinitionFromObject_(
      object,
      index + 2,
      date
    );

    if (definition) {
      definitions.push(definition);
    }
  });

  definitions.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.eventTime.localeCompare(b.eventTime);
  });

  try {
    cache.put(
      cacheKey,
      JSON.stringify(definitions),
      SURPRISE_VOTE.EVENT_CACHE_SECONDS
    );
  } catch (_) {}

  return definitions.map(definition =>
    buildSurpriseEventFromDefinition_(definition, now)
  );
}

function findSurpriseOverlapForEvent_(target, now) {
  if (!target) return null;

  const events = loadSurpriseEvents_(now)
    .filter(event => event.enabled && !event.cancelled)
    .filter(event => event.options.length >= 2)
    .filter(event => event.id !== target.id);

  for (const other of events) {
    const overlapStart = new Date(
      Math.max(target.start.getTime(), other.start.getTime())
    );
    const overlapEnd = new Date(
      Math.min(target.end.getTime(), other.end.getTime())
    );

    if (overlapStart < overlapEnd) {
      return {
        first: target.id,
        second: other.id,
        overlapStart: overlapStart,
        overlapEnd: overlapEnd
      };
    }
  }

  return null;
}

function findSurpriseEventById_(eventId, now) {
  return loadSurpriseEvents_(now)
    .find(event => event.id === eventId) || null;
}

function loadSurpriseEvents_(now) {
  const today = Utilities.formatDate(
    now,
    SURPRISE_VOTE.TIMEZONE,
    'yyyy-MM-dd'
  );

  return loadSurpriseEventDefinitions_(today)
    .map(definition =>
      buildSurpriseEventFromDefinition_(definition, now)
    )
    .sort((a, b) => a.start - b.start);
}

function buildSurpriseEventFromDefinition_(definition, now) {
  const schedule = SURPRISE_SCHEDULES[definition.eventTime];
  const start = parseSurpriseDateTime_(definition.date, schedule.start);
  const end = parseSurpriseDateTime_(definition.date, schedule.end);
  const settleEnd = new Date(
    end.getTime() + SURPRISE_VOTE.SETTLE_SECONDS * 1000
  );
  const resultEnd = parseSurpriseDateTime_(
    definition.date,
    schedule.resultEnd
  );

  let phase = 'idle';

  if (now >= start && now < end) {
    phase = 'voting';
  } else if (now >= end && now < settleEnd) {
    phase = 'settling';
  } else if (now >= settleEnd && now < resultEnd) {
    phase = 'result';
  }

  return {
    ...definition,
    start: start,
    end: end,
    settleEnd: settleEnd,
    resultEnd: resultEnd,
    phase: phase
  };
}

function loadSurpriseEventDefinitions_(today) {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'surprise:v2:events:' + today;
  const cached = cache.get(cacheKey);

  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {}
  }

  const sheet = getSurpriseSpreadsheet_()
    .getSheetByName(SURPRISE_VOTE.EVENT_SHEET);

  if (!sheet || sheet.getLastRow() < 2) return [];

  const values = sheet
    .getRange(1, 1, sheet.getLastRow(), SURPRISE_EVENT_HEADERS.length)
    .getValues();

  const headers = values.shift();
  const definitions = [];

  values.forEach((row, index) => {
    const object = {};
    headers.forEach((header, column) => {
      object[String(header)] = row[column];
    });

    const date = normalizeSurpriseDate_(object['開催日']);
    if (!date || date !== today) return;

    const definition = buildSurpriseDefinitionFromObject_(
      object,
      index + 2,
      date
    );

    if (definition) {
      definitions.push(definition);
    }
  });

  try {
    cache.put(
      cacheKey,
      JSON.stringify(definitions),
      SURPRISE_VOTE.EVENT_CACHE_SECONDS
    );
  } catch (_) {}

  return definitions;
}

function buildSurpriseDefinitionFromObject_(object, row, date) {
  const eventTime = normalizeSurpriseTime_(object['開催時刻']);
  if (!SURPRISE_SCHEDULES[eventTime]) return null;

  const options = [];
  const seenOptionNames = new Set();

  for (let i = 1; i <= 10; i += 1) {
    const name = String(object['候補' + i] || '').trim();
    if (!name || seenOptionNames.has(name)) continue;

    seenOptionNames.add(name);
    options.push({
      id: 'c' + i,
      name: name
    });
  }

  return {
    id: date.replace(/-/g, '') + '-' + eventTime.replace(':', ''),
    row: row,
    date: date,
    eventTime: eventTime,
    enabled: isSurpriseOn_(object['開催']),
    cancelled: isSurpriseOn_(object['中止']),
    override: String(object['結果上書き'] || '').trim(),
    autoWinner: String(object['自動確定候補'] || '').trim(),
    decisionType: String(object['確定種別'] || '').trim(),
    options: options
  };
}

function publicUpcomingSurpriseEvent_(event) {
  return {
    id: event.id,
    date: event.date,
    event_time: event.eventTime,
    vote_start: formatIso_(event.start),
    vote_end: formatIso_(event.end),
    result_end: formatIso_(event.resultEnd),
    max_points: SURPRISE_VOTE.MAX_POINTS,
    options: []
  };
}

function publicSurpriseEvent_(event, options) {
  return {
    id: event.id,
    date: event.date,
    event_time: event.eventTime,
    vote_start: formatIso_(event.start),
    vote_end: formatIso_(event.end),
    settle_end: formatIso_(event.settleEnd),
    result_end: formatIso_(event.resultEnd),
    max_points: SURPRISE_VOTE.MAX_POINTS,
    options: options
  };
}

function getSurpriseVote_(eventId, voterHash) {
  const sheet = getSurpriseSpreadsheet_()
    .getSheetByName(SURPRISE_VOTE.VOTE_SHEET);

  if (!sheet || sheet.getLastRow() < 2) {
    return {
      row: 0,
      used: 0,
      allocations: {}
    };
  }

  const matches = sheet
    .getRange(2, 2, sheet.getLastRow() - 1, 1)
    .createTextFinder(voterHash)
    .matchEntireCell(true)
    .findAll();

  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const rowNumber = matches[i].getRow();
    const row = sheet
      .getRange(rowNumber, 1, 1, SURPRISE_VOTE_HEADERS.length)
      .getValues()[0];

    if (String(row[0]) !== eventId) continue;

    let allocations = {};

    try {
      allocations = JSON.parse(String(row[3] || '{}')) || {};
    } catch (_) {
      allocations = {};
    }

    allocations = sanitizeSurpriseAllocations_(allocations);

    return {
      row: rowNumber,
      used: Math.min(
        SURPRISE_VOTE.MAX_POINTS,
        Math.max(0, Number(row[2]) || sumSurpriseAllocations_(allocations))
      ),
      allocations: allocations
    };
  }

  return {
    row: 0,
    used: 0,
    allocations: {}
  };
}

function upsertSurpriseVote_(
  eventId,
  voterHash,
  used,
  allocations,
  now,
  existingRow
) {
  const sheet = getSurpriseSpreadsheet_()
    .getSheetByName(SURPRISE_VOTE.VOTE_SHEET);

  const row = [
    eventId,
    voterHash,
    used,
    JSON.stringify(sanitizeSurpriseAllocations_(allocations)),
    formatIso_(now)
  ];

  if (existingRow) {
    sheet
      .getRange(existingRow, 1, 1, row.length)
      .setValues([row]);
  } else {
    sheet.appendRow(row);
  }
}

function emptySurpriseTotals_() {
  const totals = {};
  for (let i = 1; i <= 10; i += 1) {
    totals['c' + i] = 0;
  }
  return totals;
}

function getSurpriseTotalsCached_(eventId) {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'surprise:v2:totals:' + eventId;
  const cached = cache.get(cacheKey);

  if (cached) {
    try {
      return Object.assign(emptySurpriseTotals_(), JSON.parse(cached));
    } catch (_) {}
  }

  const totals = getSurpriseTotalsFresh_(eventId);

  try {
    cache.put(
      cacheKey,
      JSON.stringify(totals),
      SURPRISE_VOTE.TOTAL_CACHE_SECONDS
    );
  } catch (_) {}

  return totals;
}

function getSurpriseFinalTotals_(eventId, now) {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'surprise:v2:final:' + eventId;
  const cached = cache.get(cacheKey);

  if (cached) {
    try {
      return Object.assign(emptySurpriseTotals_(), JSON.parse(cached));
    } catch (_) {}
  }

  const totals = getSurpriseTotalsFresh_(eventId);

  try {
    cache.put(cacheKey, JSON.stringify(totals), 21600);
  } catch (_) {}

  writeSurpriseTotalSnapshot_(eventId, totals, now);
  return totals;
}

function getSurpriseTotalsFresh_(eventId) {
  const sheet = getSurpriseSpreadsheet_()
    .getSheetByName(SURPRISE_VOTE.VOTE_SHEET);

  const totals = emptySurpriseTotals_();
  if (!sheet || sheet.getLastRow() < 2) return totals;

  const rows = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 4)
    .getValues();

  rows.forEach(row => {
    if (String(row[0] || '') !== eventId) return;

    let allocations = {};
    try {
      allocations = sanitizeSurpriseAllocations_(
        JSON.parse(String(row[3] || '{}')) || {}
      );
    } catch (_) {
      allocations = {};
    }

    Object.entries(allocations).forEach(([id, value]) => {
      totals[id] =
        Number(totals[id] || 0) +
        Math.max(0, Number(value) || 0);
    });
  });

  return totals;
}

function writeSurpriseTotalSnapshot_(eventId, totals, now) {
  const cache = CacheService.getScriptCache();
  const doneKey = 'surprise:v2:snapshot:' + eventId;
  if (cache.get(doneKey)) return;

  const sheet = getSurpriseSpreadsheet_()
    .getSheetByName(SURPRISE_VOTE.TOTAL_SHEET);

  if (!sheet) return;

  let rowNumber = 0;
  if (sheet.getLastRow() >= 2) {
    const match = sheet
      .getRange(2, 1, sheet.getLastRow() - 1, 1)
      .createTextFinder(eventId)
      .matchEntireCell(true)
      .findNext();
    if (match) rowNumber = match.getRow();
  }

  const row = [eventId];
  for (let i = 1; i <= 10; i += 1) {
    row.push(Math.max(0, Number(totals['c' + i]) || 0));
  }
  row.push(formatIso_(now));

  if (rowNumber) {
    sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }

  try {
    cache.put(doneKey, '1', 21600);
  } catch (_) {}
}

function ensureSurpriseWinner_(event, totals) {
  const override = String(event.override || '').trim();

  if (override) {
    const option = event.options.find(candidate =>
      candidate.id === override ||
      candidate.name === override
    );

    if (option) {
      writeSurpriseDecision_(event.row, option.id, 'OVERRIDE');
      return option;
    }
  }

  const top = Math.max(
    0,
    ...event.options.map(option => Number(totals[option.id] || 0))
  );

  if (top <= 0) return null;

  const tied = event.options.filter(
    option => Number(totals[option.id] || 0) === top
  );

  const lock = LockService.getScriptLock();

  if (!lock.tryLock(1500)) {
    const savedId = String(event.autoWinner || '').trim();
    return event.options.find(option => option.id === savedId) || null;
  }

  try {
    const sheet = getSurpriseSpreadsheet_()
      .getSheetByName(SURPRISE_VOTE.EVENT_SHEET);

    const persistedId = String(sheet.getRange(event.row, 17).getValue() || '').trim();
    if (persistedId) {
      const persisted = event.options.find(option => option.id === persistedId);
      if (persisted) return persisted;
    }

    const winner =
      tied.length === 1
        ? tied[0]
        : tied[Math.floor(Math.random() * tied.length)];

    writeSurpriseDecision_(
      event.row,
      winner.id,
      tied.length > 1 ? 'AUTO_TIE_RANDOM' : 'AUTO'
    );

    return winner;
  } finally {
    lock.releaseLock();
  }
}

function writeSurpriseDecision_(row, winnerId, type) {
  const sheet = getSurpriseSpreadsheet_()
    .getSheetByName(SURPRISE_VOTE.EVENT_SHEET);

  sheet.getRange(row, 17).setValue(winnerId);
  sheet.getRange(row, 18).setValue(type);
  sheet.getRange(row, 19).setValue(formatIso_(new Date()));
}

function parseSurpriseTargets_(raw) {
  const out = {};

  String(raw || '')
    .split(',')
    .filter(Boolean)
    .forEach(part => {
      const pieces = part.split(':');
      if (pieces.length !== 2) return;

      const id = decodeURIComponent(String(pieces[0] || '')).trim();

      if (!/^c(?:10|[1-9])$/.test(id)) return;

      const value = Math.max(
        0,
        Math.min(
          SURPRISE_VOTE.MAX_POINTS,
          Math.floor(Number(pieces[1]) || 0)
        )
      );

      out[id] = value;
    });

  return out;
}

function sanitizeSurpriseAllocations_(input) {
  const out = {};

  for (let i = 1; i <= 10; i += 1) {
    const id = 'c' + i;
    const value = Math.max(
      0,
      Math.min(
        SURPRISE_VOTE.MAX_POINTS,
        Math.floor(Number(input && input[id]) || 0)
      )
    );

    if (value > 0) out[id] = value;
  }

  return out;
}

function sumSurpriseAllocations_(input) {
  return Object.values(input || {})
    .reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
}

function sanitizeVoterKey_(value) {
  const key = String(value || '').trim();
  if (!key) return '';
  if (key.length > 256) throw new Error('投票者情報が不正です。');
  return key;
}

function surpriseVoterHash_(voterKey) {
  const salt = getSurpriseVoterSalt_();
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salt + '|' + voterKey,
    Utilities.Charset.UTF_8
  );

  return bytes
    .map(value => {
      const n = value < 0 ? value + 256 : value;
      return n.toString(16).padStart(2, '0');
    })
    .join('');
}

function getSurpriseVoterSalt_() {
  const props = PropertiesService.getScriptProperties();
  let salt = props.getProperty(SURPRISE_VOTE.PROP_VOTER_SALT);

  if (!salt) {
    salt = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty(SURPRISE_VOTE.PROP_VOTER_SALT, salt);
  }

  return salt;
}

function getSurpriseSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty(SURPRISE_VOTE.PROP_SPREADSHEET_ID);

  if (id) return SpreadsheetApp.openById(id);

  const active = SpreadsheetApp.getActiveSpreadsheet();

  if (!active) {
    throw new Error(
      '専用スプレッドシートが未設定です。setupSurpriseVoteSpreadsheet()を実行してください。'
    );
  }

  props.setProperty(SURPRISE_VOTE.PROP_SPREADSHEET_ID, active.getId());
  return active;
}

function normalizeSurpriseDate_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(
      value,
      SURPRISE_VOTE.TIMEZONE,
      'yyyy-MM-dd'
    );
  }

  const text = String(value || '').trim();
  if (!text) return '';

  const match = text.match(
    /^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})$/
  );

  if (!match) return '';

  return (
    match[1] + '-' +
    String(match[2]).padStart(2, '0') + '-' +
    String(match[3]).padStart(2, '0')
  );
}

function normalizeSurpriseTime_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(
      value,
      SURPRISE_VOTE.TIMEZONE,
      'HH:mm'
    );
  }

  if (typeof value === 'number' && isFinite(value)) {
    const totalMinutes = Math.round(value * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return (
      String(hours).padStart(2, '0') + ':' +
      String(minutes).padStart(2, '0')
    );
  }

  const text = String(value || '').trim();
  const match = text.match(/^(\d{1,2}):(\d{2})$/);

  if (!match) return '';

  return (
    String(match[1]).padStart(2, '0') + ':' +
    String(match[2]).padStart(2, '0')
  );
}

function parseSurpriseDateTime_(date, time) {
  return Utilities.parseDate(
    date + ' ' + time,
    SURPRISE_VOTE.TIMEZONE,
    'yyyy-MM-dd HH:mm'
  );
}

function isSurpriseOn_(value) {
  const text = String(value || '').trim().toUpperCase();
  return (
    value === true ||
    text === 'ON' ||
    text === 'TRUE' ||
    text === '1' ||
    text === 'YES'
  );
}

function isAfterSurpriseDailyReset_(now) {
  const hour = Number(
    Utilities.formatDate(now, SURPRISE_VOTE.TIMEZONE, 'H')
  );
  return hour >= SURPRISE_VOTE.DAILY_RESET_HOUR;
}

function formatIso_(date) {
  return Utilities.formatDate(
    date,
    SURPRISE_VOTE.TIMEZONE,
    "yyyy-MM-dd'T'HH:mm:ssXXX"
  );
}

function isoNow_() {
  return formatIso_(new Date());
}

function surpriseOutput_(payload, callback) {
  const cb = String(callback || '').trim();

  if (cb && /^[A-Za-z_$][0-9A-Za-z_$.\[\]]{0,127}$/.test(cb)) {
    return ContentService
      .createTextOutput(
        cb + '(' + JSON.stringify(payload) + ');'
      )
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function onEdit(e) {
  try {
    if (!e || !e.range) return;

    const sheet = e.range.getSheet();
    if (sheet.getName() !== SURPRISE_VOTE.EVENT_SHEET) return;
    if (e.range.getRow() < 2) return;

    const cache = CacheService.getScriptCache();
    const today = Utilities.formatDate(
      new Date(),
      SURPRISE_VOTE.TIMEZONE,
      'yyyy-MM-dd'
    );

    cache.remove('surprise:v2:events:' + today);
    cache.remove('surprise:v2:future:' + today);

    const rowDate = normalizeSurpriseDate_(
      sheet.getRange(e.range.getRow(), 1).getValue()
    );

    if (rowDate) {
      cache.remove('surprise:v2:events:' + rowDate);
    }
  } catch (_) {}
}

/**
 * 初回セットアップ。
 * このGASを紐づけた「専用」Googleスプレッドシート上で1回だけ実行してください。
 */
function setupSurpriseVoteSpreadsheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  if (!spreadsheet) {
    throw new Error('Googleスプレッドシートに紐づけて実行してください。');
  }

  spreadsheet.setSpreadsheetTimeZone(SURPRISE_VOTE.TIMEZONE);

  PropertiesService
    .getScriptProperties()
    .setProperty(
      SURPRISE_VOTE.PROP_SPREADSHEET_ID,
      spreadsheet.getId()
    );

  getSurpriseVoterSalt_();

  migrateSurpriseEventSheet_(spreadsheet);

  const eventSheet = ensureSurpriseSheet_(
    spreadsheet,
    SURPRISE_VOTE.EVENT_SHEET,
    SURPRISE_EVENT_HEADERS
  );

  const voteSheet = ensureSurpriseSheet_(
    spreadsheet,
    SURPRISE_VOTE.VOTE_SHEET,
    SURPRISE_VOTE_HEADERS
  );

  const totalSheet = ensureSurpriseSheet_(
    spreadsheet,
    SURPRISE_VOTE.TOTAL_SHEET,
    SURPRISE_TOTAL_HEADERS
  );

  setupSurpriseEventSheet_(eventSheet);
  setupSurpriseGuide_(spreadsheet);

  try {
    voteSheet.hideSheet();
  } catch (_) {}

  try {
    totalSheet.hideSheet();
  } catch (_) {}

  SpreadsheetApp.flush();

  return {
    ok: true,
    spreadsheetId: spreadsheet.getId(),
    spreadsheetUrl: spreadsheet.getUrl()
  };
}

function migrateSurpriseEventSheet_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(SURPRISE_VOTE.EVENT_SHEET);

  if (!sheet || sheet.getLastColumn() < 2) return;

  const secondHeader = String(sheet.getRange(1, 2).getValue() || '').trim();

  // v1.0 の「営業区分」列を削除。既存データは右側の列ごと安全に左へ移動する。
  if (secondHeader === '営業区分') {
    sheet.deleteColumn(2);
  }
}

function ensureSurpriseSheet_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }

  if (
    sheet.getMaxColumns() < headers.length
  ) {
    sheet.insertColumnsAfter(
      sheet.getMaxColumns(),
      headers.length - sheet.getMaxColumns()
    );
  }

  sheet
    .getRange(1, 1, 1, headers.length)
    .setValues([headers]);

  sheet.setFrozenRows(1);

  sheet
    .getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#10283f')
    .setFontColor('#fff7df')
    .setHorizontalAlignment('center');

  return sheet;
}

function setupSurpriseEventSheet_(sheet) {
  const maxRows = Math.max(1000, sheet.getMaxRows());

  if (sheet.getMaxRows() < maxRows) {
    sheet.insertRowsAfter(
      sheet.getMaxRows(),
      maxRows - sheet.getMaxRows()
    );
  }

  sheet.getRange('A2:A1000').setNumberFormat('yyyy/mm/dd');
  sheet.getRange('B2:B1000').setNumberFormat('@');

  const timeValidation = SpreadsheetApp
    .newDataValidation()
    .requireValueInList(
      ['11:00', '14:00', '14:30', '16:00'],
      true
    )
    .setAllowInvalid(false)
    .build();

  const onOffValidation = SpreadsheetApp
    .newDataValidation()
    .requireValueInList(['ON', 'OFF'], true)
    .setAllowInvalid(false)
    .build();

  const candidateValidation = SpreadsheetApp
    .newDataValidation()
    .requireValueInList(
      Array.from(SURPRISE_EVENT_OPTIONS),
      true
    )
    .setAllowInvalid(false)
    .build();

  const cancelValidation = SpreadsheetApp
    .newDataValidation()
    .requireValueInList(['OFF', 'ON'], true)
    .setAllowInvalid(false)
    .build();

  sheet.getRange('B2:B1000').setDataValidation(timeValidation);
  sheet.getRange('C2:C1000').setDataValidation(onOffValidation);
  sheet.getRange('D2:M1000').setDataValidation(candidateValidation);
  sheet.getRange('O2:O1000').setDataValidation(cancelValidation);

  // 同じ日に14:00回と14:30回が両方ONなら目立たせる。
  const conflictFormula =
    '=AND($C2="ON",OR($B2="14:00",$B2="14:30"),COUNTIFS($A$2:$A$1000,$A2,$B$2:$B$1000,IF($B2="14:00","14:30","14:00"),$C$2:$C$1000,"ON")>0)';

  const existingRules = sheet.getConditionalFormatRules();

  const hasConflictRule = existingRules.some(rule => {
    try {
      const condition = rule.getBooleanCondition();
      if (!condition) return false;

      const type = String(condition.getCriteriaType() || '');
      const values = condition.getCriteriaValues() || [];
      const formula = String(values[0] || '');

      return (
        type.indexOf('CUSTOM_FORMULA') >= 0 &&
        formula === conflictFormula
      );
    } catch (_) {
      return false;
    }
  });

  if (!hasConflictRule) {
    const conflictRule = SpreadsheetApp
      .newConditionalFormatRule()
      .whenFormulaSatisfied(conflictFormula)
      .setBackground('#ffe0dc')
      .setFontColor('#9b1c1c')
      .setRanges([sheet.getRange('A2:S1000')])
      .build();

    sheet.setConditionalFormatRules([
      ...existingRules,
      conflictRule
    ]);
  }

  sheet.setColumnWidth(1, 105);
  sheet.setColumnWidth(2, 90);
  sheet.setColumnWidth(3, 70);

  for (let column = 4; column <= 13; column += 1) {
    sheet.setColumnWidth(column, 145);
  }

  sheet.setColumnWidth(14, 145);
  sheet.setColumnWidth(15, 70);
  sheet.setColumnWidth(16, 220);

  sheet.getRange('A1').setNote('イベント開催日。1イベント回につき1行です。');
  sheet.getRange('B1').setNote('11:00 / 14:00 / 14:30 / 16:00 から選択。投票時間は自動設定されます。');
  sheet.getRange('C1').setNote('ONにした回だけ投票を公開します。');
  sheet.getRange('D1').setNote('候補は2〜10件。プルダウンから選択。空欄は表示されません。');
  sheet.getRange('N1').setNote('運営都合で結果を変更する場合、候補名または c1〜c10 を入力。通常は空欄。');
  sheet.getRange('O1').setNote('ONで該当回を即時中止します。通常はOFF。');

  try {
    sheet.hideColumns(17, 3);
  } catch (_) {}
}

function setupSurpriseGuide_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(SURPRISE_VOTE.GUIDE_SHEET);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SURPRISE_VOTE.GUIDE_SHEET);
  }

  sheet.clear();

  const rows = [
    ['ASOBooN サプライズイベント投票｜使い方', ''],
    ['基本', '1イベント回＝「イベント設定」シートの1行です。'],
    ['開催日', 'イベントを行う日を入力します。'],
    ['開催時刻', '11:00 / 14:00 / 14:30 / 16:00 から選びます。投票時間は自動設定されます。'],
    ['開催', '準備ができた回だけ ON にします。OFF はHOMEに出ません。設定変更はキャッシュを即時破棄します。'],
    ['候補1〜10', 'プルダウンから2〜10件選択。空欄の候補はミニアプリに出ません。'],
    ['結果上書き', '通常は空欄。運営都合で変更するときだけ候補名または c1〜c10 を入力します。'],
    ['中止', '通常OFF。当日中止する場合はONにします。'],
    ['', ''],
    ['11:00', '投票 08:00〜10:45 / 結果 10:45〜11:30'],
    ['14:00', '投票 11:30〜13:45 / 結果 13:45〜14:30 ※14:30回と投票時間が重なるため同時ON不可'],
    ['14:30', '投票 11:30〜14:15 / 結果 14:15〜15:00 ※14:00回と投票時間が重なるため同時ON不可'],
    ['16:00', '投票 14:30〜15:45 / 結果 15:45〜16:30'],
    ['', ''],
    ['注意文', '※イベント内容・開催時間は、当日の混雑状況や運営上の都合により、変更または中止となる場合があります。']
  ];

  sheet
    .getRange(1, 1, rows.length, 2)
    .setValues(rows);

  sheet.getRange('A1:B1')
    .merge()
    .setFontWeight('bold')
    .setFontSize(14)
    .setBackground('#10283f')
    .setFontColor('#fff7df');

  sheet.getRange(1, 1, rows.length, 2)
    .setVerticalAlignment('top')
    .setWrap(true);

  sheet.setColumnWidth(1, 160);
  sheet.setColumnWidth(2, 520);
  sheet.setFrozenRows(1);
}
