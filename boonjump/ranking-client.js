/**
 * ブーンジャンプ 世界ランキング通信 V2.3.9
 *
 * - ランキング登録は完全な任意操作
 * - 自動送信・未送信キュー・バックグラウンド再送なし
 * - プレイヤーが選んだ記録だけを送信
 * - 同一端末の本人判定用トークンを保持
 */
const BOON_RANKING = (() => {
  'use strict';

  const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzp4sB67QKmeh-OlE2KPsl-UuKRZzgSF4XUq5trE8YI57h9WBJGBkTu979rNPSeRy_D/exec';
  const PLAYER_ID_KEY = 'boonjump_world_player_id_v1';
  const PLAYER_NAME_KEY = 'boonjump_world_player_name_v1';
  const PLAYER_TOKEN_KEY = 'boonjump_world_player_token_v1';
  const LEGACY_PLAYER_ID_KEY = 'boonjump_world_legacy_player_id_v1';
  const LEGACY_QUEUE_KEYS = [
    'boonjump_world_score_queue_v4',
    'boonjump_world_score_queue_v3',
    'boonjump_world_score_queue_v2',
  ];
  const JSONP_TIMEOUT = 16000;
  const DASHBOARD_CACHE_MS = 20000;
  const DASHBOARD_STALE_MS = 5 * 60 * 1000;
  const DASHBOARD_STORAGE_KEY = 'boonjump_world_dashboard_cache_v1';
  let dashboardCache = null;
  let dashboardCacheAt = 0;
  let dashboardPromise = null;

  function safeGet(key) {
    try { return localStorage.getItem(key) || ''; } catch (_) { return ''; }
  }

  function safeSet(key, value) {
    try { localStorage.setItem(key, String(value || '')); return true; } catch (_) { return false; }
  }


  function safeRemove(key) {
    try { localStorage.removeItem(key); return true; } catch (_) { return false; }
  }

  function loadPersistedDashboard() {
    try {
      const raw = safeGet(DASHBOARD_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const at = Number(parsed && parsed.at) || 0;
      const data = parsed && parsed.data;
      if (!data || !data.ok || !data.overview || !Array.isArray(data.machines)) return;
      if (Date.now() - at > DASHBOARD_STALE_MS) {
        safeRemove(DASHBOARD_STORAGE_KEY);
        return;
      }
      dashboardCache = data;
      dashboardCacheAt = at;
    } catch (_) {}
  }

  function persistDashboard(data) {
    try {
      safeSet(DASHBOARD_STORAGE_KEY, JSON.stringify({ at: dashboardCacheAt, data }));
    } catch (_) {}
  }

  function parseLegacyQueue(raw) {
    try {
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed.filter(item => item && item.player_id) : [];
    } catch (_) {
      return [];
    }
  }

  function migrateLegacyIdentityAndClearQueues() {
    try {
      let legacyRow = null;
      for (const key of LEGACY_QUEUE_KEYS) {
        const row = parseLegacyQueue(safeGet(key))[0];
        if (row && row.player_id) {
          legacyRow = row;
          break;
        }
      }
      if (legacyRow) {
        safeSet(LEGACY_PLAYER_ID_KEY, legacyRow.player_id);
        if (!safeGet(PLAYER_ID_KEY)) safeSet(PLAYER_ID_KEY, legacyRow.player_id);
        if (!safeGet(PLAYER_NAME_KEY) && legacyRow.display_name) safeSet(PLAYER_NAME_KEY, legacyRow.display_name);
      }
      LEGACY_QUEUE_KEYS.forEach(key => {
        try { localStorage.removeItem(key); } catch (_) {}
      });
    } catch (_) {}
  }

  function createId(prefix = 'id') {
    let random = '';
    try {
      const values = crypto.getRandomValues(new Uint32Array(4));
      random = [...values].map(value => value.toString(36)).join('');
    } catch (_) {
      random = `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
    }
    return `${prefix}-${Date.now().toString(36)}-${random}`;
  }

  function getPlayerId() {
    let id = safeGet(PLAYER_ID_KEY);
    if (!id) {
      id = createId('player');
      safeSet(PLAYER_ID_KEY, id);
    }
    return id;
  }

  function setPlayerId(id) {
    if (id) safeSet(PLAYER_ID_KEY, id);
  }

  function getPlayerToken() {
    let token = safeGet(PLAYER_TOKEN_KEY);
    if (!token) {
      token = createId('token');
      safeSet(PLAYER_TOKEN_KEY, token);
    }
    return token;
  }

  function getPlayerName() {
    return safeGet(PLAYER_NAME_KEY);
  }

  function setPlayerName(name) {
    safeSet(PLAYER_NAME_KEY, String(name || ''));
  }

  function normalizePlayerName(name) {
    const normalized = String(name || '')
      .normalize('NFKC')
      .replace(/[\u0000-\u001F\u007F\u200B-\u200D\u2060\uFEFF]/g, '')
      .trim();
    const length = [...normalized].length;
    if (length < 2 || length > 12) throw new Error('ランキングネームは2〜12文字です。');
    if (/https?:\/\/|www\.|@/i.test(normalized)) throw new Error('URLや連絡先は名前に使用できません。');
    return normalized;
  }

  function canonicalName(name) {
    return String(name || '')
      .normalize('NFKC')
      .replace(/[\u0000-\u001F\u007F\u200B-\u200D\u2060\uFEFF\s]/g, '')
      .toLocaleLowerCase();
  }

  function paramsFor(values) {
    const params = {};
    Object.entries(values || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) params[key] = String(value);
    });
    return params;
  }

  function getJsonp(params, timeout = JSONP_TIMEOUT) {
    return new Promise((resolve, reject) => {
      const callback = `__boonRanking_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      let settled = false;
      let timer = 0;

      const finish = (error, data) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { delete window[callback]; } catch (_) { window[callback] = undefined; }
        try { script.remove(); } catch (_) {}
        if (error) reject(error);
        else resolve(data);
      };

      timer = setTimeout(
        () => finish(new Error('ランキング通信がタイムアウトしました。通信状況を確認して、もう一度押してください。')),
        timeout
      );

      window[callback] = data => {
        if (data && data.ok) finish(null, data);
        else finish(new Error((data && (data.error || data.reason)) || 'ランキング通信に失敗しました。'));
      };

      const query = new URLSearchParams({ ...paramsFor(params), callback, _t: String(Date.now()) });
      script.async = true;
      script.src = `${WEB_APP_URL}?${query.toString()}`;
      script.onerror = () => finish(new Error('ランキングサーバーへ接続できませんでした。'));
      document.head.appendChild(script);
    });
  }

  function health() {
    return getJsonp({ action: 'health' }, 15000);
  }

  async function getPlayerById(playerId) {
    const data = await getJsonp({ action: 'player', player_id: playerId }, 17000);
    return data.player || null;
  }

  async function getPlayer() {
    return getPlayerById(getPlayerId());
  }

  async function resolveIdentityByToken() {
    try {
      const data = await getJsonp({
        action: 'resolve_identity',
        player_token: getPlayerToken(),
      }, 17000);
      const player = data.player || null;
      if (player && player.player_id) {
        setPlayerId(player.player_id);
        if (player.display_name) setPlayerName(player.display_name);
      }
      return player;
    } catch (_) {
      // V2.3.1以前のApps Scriptには未実装。通常のID照合へ進む。
      return null;
    }
  }

  async function recoverLegacyIdentity(displayName) {
    const legacyId = safeGet(LEGACY_PLAYER_ID_KEY);
    if (!legacyId || legacyId === getPlayerId()) return null;
    try {
      const legacyPlayer = await getPlayerById(legacyId);
      if (
        legacyPlayer &&
        String(legacyPlayer.status || 'ACTIVE') === 'ACTIVE' &&
        canonicalName(legacyPlayer.display_name) === canonicalName(displayName)
      ) {
        setPlayerId(legacyId);
        setPlayerName(legacyPlayer.display_name || displayName);
        return legacyPlayer;
      }
    } catch (_) {}
    return null;
  }

  async function registerName(name) {
    const displayName = normalizePlayerName(name);
    const sendRename = () => getJsonp({
      action: 'rename',
      player_id: getPlayerId(),
      player_token: getPlayerToken(),
      display_name: displayName,
    }, 18000);

    try {
      const data = await sendRename();
      if (data.player_id) setPlayerId(data.player_id);
      setPlayerName(data.display_name || displayName);
      invalidateCache();
      return data;
    } catch (firstError) {
      // 通常は上の1通信で完了。ID移行が必要な端末だけ復旧処理へ進む。
      let current = await resolveIdentityByToken();
      if (!current) current = await recoverLegacyIdentity(displayName);
      if (!current) throw firstError;
      const data = await sendRename();
      if (data.player_id) setPlayerId(data.player_id);
      setPlayerName(data.display_name || displayName);
      invalidateCache();
      return { ...data, reused: true };
    }
  }

  async function ensureRegistered() { return Boolean(getPlayerName());
  }

  function invalidateCache({ keepStale = true } = {}) {
    if (keepStale && dashboardCache) {
      dashboardCacheAt = 0;
      return;
    }
    dashboardCache = null;
    dashboardCacheAt = 0;
    safeRemove(DASHBOARD_STORAGE_KEY);
  }

  function peekDashboard() {
    return dashboardCache;
  }

  function getDashboardCacheAge() {
    return dashboardCache ? Math.max(0, Date.now() - dashboardCacheAt) : Infinity;
  }

  async function getDashboard({ force = false } = {}) {
    if (!force && dashboardCache && Date.now() - dashboardCacheAt < DASHBOARD_CACHE_MS) {
      return dashboardCache;
    }
    if (dashboardPromise) return dashboardPromise;
    dashboardPromise = getJsonp({
      action: 'dashboard',
      player_id: getPlayerId(),
    }, 18000).then(data => {
      dashboardCache = data;
      dashboardCacheAt = Date.now();
      persistDashboard(data);
      return data;
    }).finally(() => {
      dashboardPromise = null;
    });
    return dashboardPromise;
  }

  function prefetchDashboard({ force = false } = {}) {
    return getDashboard({ force }).catch(() => null);
  }

  function getLeaderboard({ period = 'all', machineId = '', includeSecret = false, limit = 100 } = {}) {
    return getJsonp({
      action: 'leaderboard',
      period,
      machine_id: machineId,
      player_id: getPlayerId(),
      include_secret: String(includeSecret),
      limit: String(limit),
    }, 16000);
  }

  function buildScoreItem(payload) {
    const displayName = getPlayerName();
    if (!displayName) throw new Error('先にランキングネームを登録してください。');

    const machineId = String(payload.machineId || '').trim();
    const distance = Math.max(0, Math.round(Number(payload.distance) || 0));
    if (!machineId) throw new Error('マシン情報がありません。');
    if (!distance) throw new Error('0mの記録はランキングへ登録できません。');

    const playedAt = payload.playedAt ? new Date(payload.playedAt) : new Date();
    const safePlayedAt = Number.isNaN(playedAt.getTime()) ? new Date() : playedAt;

    return {
      action: 'submit',
      request_id: createId('score'),
      player_id: getPlayerId(),
      player_token: getPlayerToken(),
      display_name: displayName,
      machine_id: machineId,
      distance,
      accel_judge: String(payload.accelJudge || 'MISS'),
      turbo_judge: String(payload.turboJudge || 'MISS'),
      nitro_judge: String(payload.nitroJudge || 'MISS'),
      tune_level: Math.max(0, Math.min(50, Math.floor(Number(payload.tuneLevel) || 0))),
      played_at: safePlayedAt.toISOString(),
      source_build: String(payload.sourceBuild || '').slice(0, 100),
      client_version: String(payload.clientVersion || '').slice(0, 40),
      transport: 'manual-jsonp',
      response_mode: 'fast',
    };
  }

  function isIdentitySyncError(error) {
    const message = String(error && error.message || error || '');
    return /登録情報が一致|再登録が必要|ランキング登録情報/.test(message);
  }

  function primeDashboard(data) {
    if (!data || !data.ok || !data.overview || !Array.isArray(data.machines)) return false;
    dashboardCache = data;
    dashboardCacheAt = Date.now();
    persistDashboard(data);
    return true;
  }

  async function submitScore(payload) {
    if (!getPlayerName()) throw new Error('先にランキングネームを登録してください。');
    const item = buildScoreItem(payload);
    item.include_dashboard = 'false';

    const send = () => getJsonp(item, 20000);
    let data;
    try {
      data = await send();
    } catch (error) {
      if (!isIdentitySyncError(error)) throw error;
      const recovered = await resolveIdentityByToken();
      if (!recovered) throw error;
      item.player_id = getPlayerId();
      item.player_token = getPlayerToken();
      data = await send();
    }

    if (data.player_id) setPlayerId(data.player_id);
    const accepted = Boolean(data.accepted || data.duplicate || data.skipped);
    if (!accepted) throw new Error(data.reason || '記録が受理されませんでした。');
    if (!primeDashboard(data.dashboard)) invalidateCache({ keepStale: true });

    return {
      ok: true,
      skipped: Boolean(data.skipped),
      duplicate: Boolean(data.duplicate),
      reason: data.reason || '',
      me: data.player_rank || (data.player_ranks && data.player_ranks.all) || null,
      ranks: data.player_ranks || null,
      updated: data.updated || null,
      dashboard: data.dashboard || null,
      server: data,
    };
  }



  function buildBulkRecord(payload) {
    const item = buildScoreItem(payload);
    return {
      request_id: item.request_id,
      machine_id: item.machine_id,
      distance: item.distance,
      accel_judge: item.accel_judge,
      turbo_judge: item.turbo_judge,
      nitro_judge: item.nitro_judge,
      tune_level: item.tune_level,
      played_at: item.played_at,
      source_build: item.source_build,
      client_version: item.client_version,
    };
  }

  async function submitScores(payloads) {
    const displayName = getPlayerName();
    if (!displayName) throw new Error('先にランキングネームを登録してください。');
    if (!Array.isArray(payloads) || !payloads.length) throw new Error('登録できる自己ベストがありません。');

    const records = payloads.map(buildBulkRecord);
    const request = {
      action: 'bulk_submit',
      bulk_request_id: createId('bulk'),
      player_id: getPlayerId(),
      player_token: getPlayerToken(),
      display_name: displayName,
      records_json: JSON.stringify(records),
      response_mode: 'fast',
      include_dashboard: 'false',
    };

    const send = () => getJsonp(request, 24000);
    let data;
    try {
      data = await send();
    } catch (error) {
      if (!isIdentitySyncError(error)) throw error;
      const recovered = await resolveIdentityByToken();
      if (!recovered) throw error;
      request.player_id = getPlayerId();
      request.player_token = getPlayerToken();
      data = await send();
    }

    if (data.player_id) setPlayerId(data.player_id);
    if (!data.accepted) throw new Error(data.reason || '自己ベストを一括登録できませんでした。');
    if (!primeDashboard(data.dashboard)) invalidateCache({ keepStale: true });

    return {
      ok: true,
      total: Number(data.total) || records.length,
      registered: Number(data.registered) || 0,
      skipped: Number(data.skipped) || 0,
      duplicates: Number(data.duplicates) || 0,
      updated: data.updated || null,
      results: Array.isArray(data.results) ? data.results : [],
      dashboard: data.dashboard || null,
      server: data,
    };
  }


  // V2.3.0以前との互換用。自動キューは常に空として扱う。
  function getPendingCount() { return 0; }
  async function flushQueue() { return { ok: true, sent: [], failed: [], pending: 0 }; }
  function getDiagnostics() {
    return {
      state: 'manual',
      message: 'ランキング登録は任意です。選んだ記録だけ送信します。',
      pending: 0,
    };
  }

  loadPersistedDashboard();
  migrateLegacyIdentityAndClearQueues();

  return {
    health,
    getPlayerId,
    getPlayerName,
    setPlayerName,
    getPlayerToken,
    normalizePlayerName,
    registerName,
    rename: registerName,
    ensureRegistered,
    submitScore,
    submitScores,
    flushQueue,
    getPendingCount,
    getDiagnostics,
    getLeaderboard,
    getDashboard,
    peekDashboard,
    getDashboardCacheAge,
    prefetchDashboard,
    invalidateCache,
    getPlayer,
  };
})();
