/**
 * ブーンジャンプ 世界ランキング通信 V2.2.5
 * - 名前登録・記録送信・ランキング取得をすべてJSONPで実行
 * - 同名登録エラーをその場で受け取る
 * - 未送信記録を端末へ保持し、自動再送
 */
const BOON_RANKING = (() => {
  'use strict';

  const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzp4sB67QKmeh-OlE2KPsl-UuKRZzgSF4XUq5trE8YI57h9WBJGBkTu979rNPSeRy_D/exec';
  const PLAYER_ID_KEY = 'boonjump_world_player_id_v1';
  const PLAYER_NAME_KEY = 'boonjump_world_player_name_v1';
  const SCORE_QUEUE_KEY = 'boonjump_world_score_queue_v3';
  const MAX_QUEUE = 40;
  const JSONP_TIMEOUT = 25000;
  let flushingPromise = null;

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

  function health() {
    return getJsonp({ action: 'health' }, 15000);
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

  function readQueue() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SCORE_QUEUE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.filter(item => item && item.request_id) : [];
    } catch (_) {
      return [];
    }
  }

  function writeQueue(queue) {
    localStorage.setItem(SCORE_QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE)));
  }

  function queueScore(payload) {
    const item = {
      action: 'submit',
      request_id: createId('score'),
      player_id: getPlayerId(),
      display_name: getPlayerName(),
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
    const queue = readQueue();
    queue.push(item);
    writeQueue(queue);
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
        script.remove();
        error ? reject(error) : resolve(data);
      };

      const timer = setTimeout(
        () => finish(new Error('ランキング通信がタイムアウトしました。')),
        timeout
      );

      window[callback] = data => {
        if (data && data.ok) {
          finish(null, data);
        } else {
          finish(new Error((data && data.error) || 'ランキング通信に失敗しました。'));
        }
      };

      const query = new URLSearchParams({
        ...params,
        callback,
        _t: String(Date.now()),
      });
      script.async = true;
      script.src = `${WEB_APP_URL}?${query.toString()}`;
      script.onerror = () => finish(new Error('ランキングサーバーへ接続できませんでした。'));
      document.head.appendChild(script);
    });
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

    localStorage.setItem(PLAYER_NAME_KEY, data.display_name || displayName);

    // 保留中の記録も確定した名前へそろえる。
    const fixedName = data.display_name || displayName;
    const queue = readQueue().map(item => ({ ...item, display_name: fixedName }));
    writeQueue(queue);
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

  async function sendQueuedScore(item) {
    const direct = await getJsonp(item, 30000);
    const accepted = Boolean(direct.accepted || direct.duplicate);
    const review = Boolean(direct.review);
    if (!accepted && !review) throw new Error(direct.reason || '記録が受理されませんでした。');
    return {ok:true,confirmed:accepted,review,reason:direct.reason||'',me:direct.player_rank||null,server:direct};
  }

  async function flushQueue() {
    if (flushingPromise) return flushingPromise;

    flushingPromise = (async () => {
      let queue = readQueue();
      const sent = [];
      const failed = [];

      for (const item of [...queue]) {
        try {
          // 名前変更後の保留記録にも、現在の名前を反映する。
          const currentName = getPlayerName();
          const sendItem = currentName ? { ...item, display_name: currentName } : item;
          const result = await sendQueuedScore(sendItem);
          sent.push({ item, result });
          queue = queue.filter(row => row.request_id !== item.request_id);
          writeQueue(queue);
        } catch (error) {
          failed.push({ item, error });
          // 名前の再登録が必要なときは、後続記録も同様に失敗するため中断する。
          if (/ネーム|名前|すでに使われ/.test(String(error && error.message))) break;
        }
      }

      return {
        ok: failed.length === 0,
        sent,
        failed,
        pending: queue.length,
      };
    })().finally(() => {
      flushingPromise = null;
    });

    return flushingPromise;
  }

  async function submitScore(payload) {
    if (!getPlayerName()) {
      throw new Error('先にランキングネームを登録してください。');
    }

    const item = queueScore(payload);
    const result = await flushQueue();
    const sent = result.sent.find(row => row.item.request_id === item.request_id);
    if (sent) return sent.result;

    const failed = result.failed.find(row => row.item.request_id === item.request_id);
    throw (failed && failed.error) || new Error('記録を端末に保存しました。通信回復後に自動送信します。');
  }

  function getPendingCount() {
    return readQueue().length;
  }

  window.addEventListener('online', () => {
    if (getPlayerName()) flushQueue().catch(() => {});
  });

  return {
    health,
    getPlayerId,
    getPlayerName,
    normalizePlayerName,
    rename,
    ensureRegistered,
    submitScore,
    flushQueue,
    getPendingCount,
    getLeaderboard,
    getPlayer,
  };
})();
