/**
 * ブーンジャンプ 世界ランキング通信 V2.3.0
 *
 * 記録は、結果画面が出た瞬間に端末へ確定保存します。
 * その後、同じ request_id を使って複数の経路から送信し、
 * Apps Script の score_status で保存確認を取ります。
 *
 * - JSONP: 成功/エラー内容の取得
 * - sendBeacon: 画面遷移や終了に強い書き込み
 * - fetch(no-cors/keepalive): Beacon非対応端末の補助
 * - Image GET: CORSやレスポンス解析に依存しない最終予備
 *
 * Apps Script側は request_id で重複排除するため、複数経路で
 * 同じ記録が届いてもランキングには1件だけ保存されます。
 */
const BOON_RANKING = (() => {
  'use strict';

  const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzp4sB67QKmeh-OlE2KPsl-UuKRZzgSF4XUq5trE8YI57h9WBJGBkTu979rNPSeRy_D/exec';
  const PLAYER_ID_KEY = 'boonjump_world_player_id_v1';
  const PLAYER_NAME_KEY = 'boonjump_world_player_name_v1';
  const SCORE_QUEUE_KEY = 'boonjump_world_score_queue_v4';
  const LEGACY_QUEUE_KEYS = ['boonjump_world_score_queue_v3', 'boonjump_world_score_queue_v2'];
  const MAX_QUEUE = 60;
  const JSONP_TIMEOUT = 22000;
  const CONFIRM_RETRIES = 3;

  let flushingPromise = null;
  let lastDiagnostic = {
    state: 'idle',
    message: '',
    requestId: '',
    pending: 0,
    updatedAt: 0,
  };

  function setDiagnostic(next) {
    lastDiagnostic = {
      ...lastDiagnostic,
      ...next,
      pending: readQueue().length,
      updatedAt: Date.now(),
    };
    try {
      window.dispatchEvent(new CustomEvent('boon-ranking-status', { detail: { ...lastDiagnostic } }));
    } catch (_) {}
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function createId(prefix = 'p') {
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
    let id = localStorage.getItem(PLAYER_ID_KEY);
    if (!id) {
      id = createId('player');
      localStorage.setItem(PLAYER_ID_KEY, id);
    }
    return id;
  }

  function getPlayerName() {
    return localStorage.getItem(PLAYER_NAME_KEY) || '';
  }

  function normalizePlayerName(name) {
    const normalized = String(name || '')
      .normalize('NFKC')
      .replace(/[\u0000-\u001F\u007F\u200B-\u200D\u2060\uFEFF]/g, '')
      .trim();
    const length = [...normalized].length;
    if (length < 2 || length > 12) {
      throw new Error('ランキングネームは2〜12文字です。');
    }
    if (/https?:\/\/|www\.|@/i.test(normalized)) {
      throw new Error('URLや連絡先は名前に使用できません。');
    }
    return normalized;
  }

  function parseQueue(raw) {
    try {
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed.filter(item => item && item.request_id) : [];
    } catch (_) {
      return [];
    }
  }

  function readQueue() {
    let queue = parseQueue(localStorage.getItem(SCORE_QUEUE_KEY));
    if (!queue.length) {
      for (const key of LEGACY_QUEUE_KEYS) {
        const legacy = parseQueue(localStorage.getItem(key));
        if (legacy.length) {
          queue = legacy;
          writeQueue(queue);
          try { localStorage.removeItem(key); } catch (_) {}
          break;
        }
      }
    }
    return queue;
  }

  function writeQueue(queue) {
    localStorage.setItem(SCORE_QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE)));
  }

  function removeQueued(requestId) {
    const queue = readQueue().filter(item => item.request_id !== requestId);
    writeQueue(queue);
    return queue.length;
  }

  function buildScoreItem(payload) {
    const displayName = getPlayerName();
    if (!displayName) throw new Error('先にランキングネームを登録してください。');
    return {
      action: 'submit',
      request_id: createId('score'),
      player_id: getPlayerId(),
      display_name: displayName,
      machine_id: String(payload.machineId || ''),
      distance: Math.max(0, Math.round(Number(payload.distance) || 0)),
      accel_judge: String(payload.accelJudge || 'MISS'),
      turbo_judge: String(payload.turboJudge || 'MISS'),
      nitro_judge: String(payload.nitroJudge || 'MISS'),
      tune_level: Math.max(0, Math.min(50, Math.floor(Number(payload.tuneLevel) || 0))),
      played_at: new Date().toISOString(),
      source_build: String(payload.sourceBuild || '').slice(0, 100),
      client_version: String(payload.clientVersion || '').slice(0, 40),
      queued_at: Date.now(),
    };
  }

  function queueItem(item) {
    const queue = readQueue().filter(row => row.request_id !== item.request_id);
    queue.push(item);
    writeQueue(queue);
    setDiagnostic({
      state: 'queued',
      message: '端末へ記録を保存しました。',
      requestId: item.request_id,
    });
    return item;
  }

  function paramsFor(item) {
    const params = {};
    Object.entries(item).forEach(([key, value]) => {
      if (value !== undefined && value !== null) params[key] = String(value);
    });
    return params;
  }

  function queryString(item) {
    return new URLSearchParams(paramsFor(item)).toString();
  }

  function fireImageWrite(item) {
    try {
      const img = new Image();
      img.alt = '';
      img.width = 1;
      img.height = 1;
      img.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none';
      const clean = () => { try { img.remove(); } catch (_) {} };
      img.onload = clean;
      img.onerror = clean;
      img.src = `${WEB_APP_URL}?${queryString({ ...item, transport: 'image', _t: Date.now() })}`;
      (document.body || document.documentElement).appendChild(img);
      setTimeout(clean, 30000);
      return true;
    } catch (_) {
      return false;
    }
  }

  function fireBeaconWrite(item) {
    try {
      if (!navigator.sendBeacon) return false;
      const body = new URLSearchParams(paramsFor({ ...item, transport: 'beacon' }));
      return navigator.sendBeacon(WEB_APP_URL, body);
    } catch (_) {
      return false;
    }
  }

  function fireFetchWrite(item) {
    try {
      if (!window.fetch) return false;
      const body = new URLSearchParams(paramsFor({ ...item, transport: 'fetch' }));
      fetch(WEB_APP_URL, {
        method: 'POST',
        mode: 'no-cors',
        keepalive: true,
        body,
      }).catch(() => {});
      return true;
    } catch (_) {
      return false;
    }
  }

  function fireWrite(item) {
    const transports = {
      beacon: fireBeaconWrite(item),
      fetch: fireFetchWrite(item),
      image: fireImageWrite(item),
    };
    setDiagnostic({
      state: 'sending',
      message: 'ランキングサーバーへ送信しています。',
      requestId: item.request_id,
      transports,
    });
    return transports;
  }

  function captureScore(payload) {
    const item = queueItem(buildScoreItem(payload));
    fireWrite(item);
    return item;
  }

  function getJsonp(params, timeout = JSONP_TIMEOUT) {
    return new Promise((resolve, reject) => {
      const callback = `__boonRanking_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      let settled = false;

      const finish = (error, data) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { delete window[callback]; } catch (_) { window[callback] = undefined; }
        try { script.remove(); } catch (_) {}
        error ? reject(error) : resolve(data);
      };

      const timer = setTimeout(
        () => finish(new Error('ランキング通信がタイムアウトしました。')),
        timeout
      );

      window[callback] = data => {
        if (data && data.ok) finish(null, data);
        else finish(new Error((data && data.error) || 'ランキング通信に失敗しました。'));
      };

      const query = new URLSearchParams({
        ...paramsFor(params),
        callback,
        _t: String(Date.now()),
      });
      script.async = true;
      script.src = `${WEB_APP_URL}?${query.toString()}`;
      script.onerror = () => finish(new Error('ランキングサーバーへ接続できませんでした。'));
      document.head.appendChild(script);
    });
  }

  function health() {
    return getJsonp({ action: 'health' }, 15000);
  }

  async function getPlayer() {
    const data = await getJsonp({
      action: 'player',
      player_id: getPlayerId(),
    });
    return data.player || null;
  }

  async function rename(name) {
    const displayName = normalizePlayerName(name);
    const data = await getJsonp({
      action: 'rename',
      player_id: getPlayerId(),
      display_name: displayName,
    });

    const fixedName = data.display_name || displayName;
    localStorage.setItem(PLAYER_NAME_KEY, fixedName);
    const queue = readQueue().map(item => ({ ...item, display_name: fixedName }));
    writeQueue(queue);
    setDiagnostic({ state: 'registered', message: 'ランキングネームを登録しました。' });
    return data;
  }

  async function ensureRegistered() {
    const name = getPlayerName();
    if (!name) return false;
    const player = await getPlayer();
    if (player) {
      if (String(player.status || 'ACTIVE') !== 'ACTIVE') {
        throw new Error('ランキングネームをもう一度登録してください。');
      }
      if (player.display_name === name) return true;
    }
    await rename(name);
    return true;
  }

  function getLeaderboard({ period = 'all', machineId = '', includeSecret = false, limit = 100 } = {}) {
    return getJsonp({
      action: 'leaderboard',
      period,
      machine_id: machineId,
      player_id: getPlayerId(),
      include_secret: String(includeSecret),
      limit: String(limit),
    });
  }

  async function scoreStatus(item) {
    return getJsonp({
      action: 'score_status',
      request_id: item.request_id,
      player_id: item.player_id,
    }, 17000);
  }

  async function jsonpSubmit(item) {
    const data = await getJsonp({ ...item, transport: 'jsonp' }, 26000);
    const accepted = Boolean(data.accepted || data.duplicate);
    const review = Boolean(data.review);
    if (!accepted && !review) {
      throw new Error(data.reason || '記録が受理されませんでした。');
    }
    return {
      ok: true,
      confirmed: accepted,
      review,
      reason: data.reason || '',
      me: data.player_rank || null,
      server: data,
    };
  }

  async function confirmScore(item) {
    setDiagnostic({
      state: 'confirming',
      message: 'スプレッドシートへの保存を確認しています。',
      requestId: item.request_id,
    });

    let lastError = null;
    for (let attempt = 0; attempt < CONFIRM_RETRIES; attempt += 1) {
      if (attempt > 0) {
        fireWrite(item);
        await sleep(650 + attempt * 500);
      } else {
        await sleep(420);
      }

      try {
        const status = await scoreStatus(item);
        if (status.found) {
          removeQueued(item.request_id);
          setDiagnostic({
            state: status.accepted ? 'saved' : 'review',
            message: status.accepted ? '世界ランキングへ保存しました。' : (status.reason || '記録を確認中です。'),
            requestId: item.request_id,
          });
          return {
            ok: true,
            confirmed: Boolean(status.accepted),
            review: !status.accepted,
            reason: status.reason || '',
            me: status.player_rank || null,
            server: status,
          };
        }
      } catch (error) {
        lastError = error;
      }

      try {
        const result = await jsonpSubmit(item);
        removeQueued(item.request_id);
        setDiagnostic({
          state: result.confirmed ? 'saved' : 'review',
          message: result.confirmed ? '世界ランキングへ保存しました。' : (result.reason || '記録を確認中です。'),
          requestId: item.request_id,
        });
        return result;
      } catch (error) {
        lastError = error;
      }
    }

    setDiagnostic({
      state: 'pending',
      message: (lastError && lastError.message) || '記録は端末に保存されています。',
      requestId: item.request_id,
    });
    throw lastError || new Error('記録は端末に保存しました。通信回復後に自動再送します。');
  }

  async function flushQueue() {
    if (flushingPromise) return flushingPromise;
    flushingPromise = (async () => {
      const sent = [];
      const failed = [];
      let queue = readQueue();
      for (const original of [...queue]) {
        const currentName = getPlayerName();
        if (!currentName) break;
        const item = { ...original, display_name: currentName };
        try {
          fireWrite(item);
          const result = await confirmScore(item);
          sent.push({ item, result });
          queue = readQueue();
        } catch (error) {
          failed.push({ item, error });
          if (/ネーム|名前|すでに使われ/.test(String(error && error.message))) break;
        }
      }
      return { ok: failed.length === 0, sent, failed, pending: readQueue().length };
    })().finally(() => {
      flushingPromise = null;
    });
    return flushingPromise;
  }

  async function submitScore(payload) {
    const item = captureScore(payload);
    return confirmScore(item);
  }

  function getPendingCount() {
    return readQueue().length;
  }

  function getDiagnostics() {
    return { ...lastDiagnostic, pending: getPendingCount() };
  }

  window.addEventListener('online', () => {
    if (getPlayerName()) flushQueue().catch(() => {});
  });
  window.addEventListener('pageshow', () => {
    if (getPlayerName() && getPendingCount()) flushQueue().catch(() => {});
  });

  return {
    health,
    getPlayerId,
    getPlayerName,
    normalizePlayerName,
    rename,
    ensureRegistered,
    captureScore,
    confirmScore,
    submitScore,
    flushQueue,
    getPendingCount,
    getDiagnostics,
    getLeaderboard,
    getPlayer,
  };
})();
