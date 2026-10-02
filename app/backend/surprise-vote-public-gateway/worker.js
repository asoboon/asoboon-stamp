/**
 * ASOBooN Surprise Vote Public Gateway
 * Read-only production cache for the public vote status.
 *
 * - No AirWAIT access
 * - No LINE secret
 * - No write API for browsers
 * - Cron refreshes the public Apps Script status every minute
 * - D1 persists the latest safe snapshot across isolates/regions
 */

const CFG = Object.freeze({
  VERSION: '1.0.0',
  ARCHITECTURE: 'SURPRISE_VOTE_PUBLIC_D1_V1',
  ALLOWED_ORIGIN: 'https://asoboon.github.io',
  GAS_STATUS_URL: 'https://script.google.com/macros/s/AKfycbx2feW0JIP2aPmS2FX62D07etcaZE4Iq3FtqViLtpp0lsk0Z9aw3YuBQa94gtpH5Z3I/exec',
  KEY: 'public_status',
  FRESH_MS: 90 * 1000,
  NORMAL_MAX_AGE_MS: 5 * 60 * 1000,
  STALE_MAX_AGE_MS: 12 * 60 * 60 * 1000,
  ORIGIN_TIMEOUT_MS: 28 * 1000,
});

let memory = { savedAt: 0, data: null };
let refreshInflight = null;
let schemaReady = false;

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return preflight(request);
    if (request.method !== 'GET') return json(request, { ok: false, error: 'METHOD_NOT_ALLOWED', version: CFG.VERSION }, 405);

    const url = new URL(request.url);
    const action = String(url.searchParams.get('action') || 'health');

    try {
      if (action === 'health') {
        const snap = await readSnapshot(env);
        return json(request, {
          ok: true,
          version: CFG.VERSION,
          architecture: CFG.ARCHITECTURE,
          snapshotReady: Boolean(snap?.data?.ok === true),
          snapshotAgeMs: snap ? Math.max(0, Date.now() - snap.savedAt) : null,
        });
      }

      if (action === 'status') {
        return json(request, await publicStatus(env, ctx));
      }

      return json(request, { ok: false, error: 'UNKNOWN_ACTION', version: CFG.VERSION }, 404);
    } catch (error) {
      return json(request, {
        ok: false,
        error: safeError(error),
        version: CFG.VERSION,
      }, Number(error?.status || 503));
    }
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      refreshStatus(env).catch(error => {
        console.warn('SURPRISE_VOTE_REFRESH_FAILED', safeError(error));
      })
    );
  },
};

async function ensureSchema(env) {
  if (schemaReady) return;
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS surprise_vote_public_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `).run();
  schemaReady = true;
}

async function readSnapshot(env) {
  await ensureSchema(env);
  const row = await env.DB.prepare(
    'SELECT value, updated_at FROM surprise_vote_public_state WHERE key=? LIMIT 1'
  ).bind(CFG.KEY).first();
  if (!row) return null;

  try {
    const data = JSON.parse(String(row.value || ''));
    if (!data || data.ok !== true) return null;
    return { data, savedAt: Number(row.updated_at || 0) };
  } catch {
    return null;
  }
}

async function writeSnapshot(env, data, savedAt = Date.now()) {
  await ensureSchema(env);
  await env.DB.prepare(`
    INSERT INTO surprise_vote_public_state(key,value,updated_at)
    VALUES(?,?,?)
    ON CONFLICT(key) DO UPDATE SET
      value=excluded.value,
      updated_at=excluded.updated_at
  `).bind(CFG.KEY, JSON.stringify(data), Number(savedAt)).run();
}

function phaseSafe(data, savedAt, maxAgeMs) {
  if (!data || data.ok !== true) return false;
  const now = Date.now();
  const age = now - Number(savedAt || 0);
  if (age < 0 || age > maxAgeMs) return false;

  const event = data.event || {};
  const start = Date.parse(event.vote_start || '');
  const end = Date.parse(event.vote_end || '');
  const settleEnd = Date.parse(event.settle_end || '');

  if (data.mode === 'upcoming') {
    return !Number.isFinite(start) || now < start;
  }

  if (data.mode === 'voting') {
    return (!Number.isFinite(start) || now >= start) &&
      (!Number.isFinite(end) || now < end);
  }

  if (data.mode === 'settling') {
    return (!Number.isFinite(end) || now >= end) &&
      (!Number.isFinite(settleEnd) || now < settleEnd);
  }

  if (data.mode === 'result') {
    const selectedStart = Date.parse(event.vote_start || '');
    const laterStarts = (Array.isArray(data.day_events) ? data.day_events : [])
      .map(item => Date.parse(item?.vote_start || ''))
      .filter(value => Number.isFinite(value) && (!Number.isFinite(selectedStart) || value > selectedStart));

    if (laterStarts.length && now >= Math.min(...laterStarts)) return false;

    const date = String(event.date || '').trim();
    const reset = String(data.daily_reset || '18:00').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(reset)) {
      const resetAt = Date.parse(`${date}T${reset}:00+09:00`);
      if (Number.isFinite(resetAt) && now >= resetAt) return false;
    }
    return true;
  }

  if (data.mode === 'idle') return age <= Math.min(maxAgeMs, 60 * 1000);
  return age <= Math.min(maxAgeMs, 30 * 1000);
}

function forClient(data, source, savedAt) {
  const out = JSON.parse(JSON.stringify(data || {}));
  delete out.user;
  out.now = new Date().toISOString();
  out.edge_cache = source;
  out.edge_saved_at = new Date(Number(savedAt || Date.now())).toISOString();
  return out;
}

async function publicStatus(env, ctx) {
  if (phaseSafe(memory.data, memory.savedAt, CFG.FRESH_MS)) {
    return forClient(memory.data, 'memory', memory.savedAt);
  }

  const snap = await readSnapshot(env);
  if (snap && phaseSafe(snap.data, snap.savedAt, CFG.NORMAL_MAX_AGE_MS)) {
    memory = { data: snap.data, savedAt: snap.savedAt };
    if (Date.now() - snap.savedAt > CFG.FRESH_MS) {
      ctx.waitUntil(refreshStatus(env).catch(() => {}));
    }
    return forClient(snap.data, 'd1', snap.savedAt);
  }

  if (snap && phaseSafe(snap.data, snap.savedAt, CFG.STALE_MAX_AGE_MS)) {
    memory = { data: snap.data, savedAt: snap.savedAt };
    ctx.waitUntil(refreshStatus(env).catch(() => {}));
    return forClient(snap.data, 'stale', snap.savedAt);
  }

  // First deploy / phase boundary with no safe snapshot: wait once for origin.
  return await refreshStatus(env);
}

async function refreshStatus(env) {
  if (refreshInflight) return await refreshInflight;

  refreshInflight = (async () => {
    const url = new URL(CFG.GAS_STATUS_URL);
    url.searchParams.set('action', 'status');
    url.searchParams.set('_', String(Date.now()));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CFG.ORIGIN_TIMEOUT_MS);
    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw apiError(`ORIGIN_HTTP_${response.status}`, 503);
      const data = await response.json();
      if (!data || data.ok !== true) throw apiError('ORIGIN_STATUS_INVALID', 503);

      delete data.user;
      const savedAt = Date.now();
      await writeSnapshot(env, data, savedAt);
      memory = { data, savedAt };
      return forClient(data, 'origin', savedAt);
    } catch (error) {
      const snap = await readSnapshot(env).catch(() => null);
      if (snap && phaseSafe(snap.data, snap.savedAt, CFG.STALE_MAX_AGE_MS)) {
        memory = { data: snap.data, savedAt: snap.savedAt };
        return forClient(snap.data, 'stale-origin-error', snap.savedAt);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  })();

  try {
    return await refreshInflight;
  } finally {
    refreshInflight = null;
  }
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const headers = {
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
  };
  if (origin === CFG.ALLOWED_ORIGIN) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function preflight(request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

function json(request, payload, status = 200) {
  const headers = corsHeaders(request);
  headers['Content-Type'] = 'application/json; charset=utf-8';
  return new Response(JSON.stringify(payload), { status, headers });
}

function apiError(message, status = 500) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function safeError(error) {
  if (!error) return 'UNKNOWN_ERROR';
  if (error.name === 'AbortError') return 'ORIGIN_TIMEOUT';
  return String(error.message || error).slice(0, 240);
}
