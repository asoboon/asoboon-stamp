const ALLOWED_ORIGIN = 'https://asoboon.github.io';
const STORE_ID = 'KR01205179';
const LINE_CHANNEL_ID = '2011467470';
const AIRWAIT_LAST = 'https://cl.airwait.jp/WCLP/api/external/stateless/store/getLastUpdDateStateless';
const LINE_OAUTH = 'https://api.line.me/oauth2/v3/token';

function headers(request) {
  const origin = request.headers.get('Origin') || '';
  const allowOrigin = origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN;
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
  };
}

async function checkAirwait(env) {
  if (!env.AIRWAIT_API_KEY) {
    return { configured: false, reachable: false, httpStatus: null, resultCode: null };
  }
  const url = new URL(AIRWAIT_LAST);
  url.searchParams.set('storeId', STORE_ID);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'corWclpKeyCd': env.AIRWAIT_API_KEY,
      },
    });
    let data = null;
    try { data = await response.json(); } catch (_) {}
    const resultCode = String(data?.resultCode?.code || '');
    return {
      configured: true,
      reachable: response.ok && data?.success === true && resultCode === '0000',
      httpStatus: response.status,
      resultCode: resultCode || null,
      hasLastUpdDate: Boolean(data?.innerDto?.lastUpdDate),
    };
  } catch (error) {
    return {
      configured: true,
      reachable: false,
      httpStatus: null,
      resultCode: null,
      networkError: String(error?.message || error).slice(0, 160),
    };
  }
}

async function checkLine(env) {
  if (!env.PURPLE_LINE_MINIAPP_CHANNEL_SECRET) {
    return { configured: false, authorized: false, httpStatus: null };
  }
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: LINE_CHANNEL_ID,
    client_secret: env.PURPLE_LINE_MINIAPP_CHANNEL_SECRET,
  });
  try {
    const response = await fetch(LINE_OAUTH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    let data = null;
    try { data = await response.json(); } catch (_) {}
    return {
      configured: true,
      authorized: response.ok && Boolean(data?.access_token),
      httpStatus: response.status,
      tokenType: response.ok ? String(data?.token_type || '') : null,
      expiresIn: response.ok ? Number(data?.expires_in || 0) : null,
      error: response.ok ? null : String(data?.error_description || data?.error || '').slice(0, 160) || null,
    };
  } catch (error) {
    return {
      configured: true,
      authorized: false,
      httpStatus: null,
      networkError: String(error?.message || error).slice(0, 160),
    };
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: headers(request) });
    }
    if (request.method !== 'GET') {
      return new Response(JSON.stringify({ ok: false, error: 'METHOD_NOT_ALLOWED' }), {
        status: 405,
        headers: headers(request),
      });
    }
    try {
      const db = await env.DB.prepare(
        "SELECT COUNT(*) AS table_count FROM sqlite_master WHERE type='table' AND name IN ('notification_bindings','airwait_snapshot','request_results','system_state')"
      ).first();
      const foundTables = Number(db?.table_count || 0);
      const [airwait, line] = await Promise.all([
        checkAirwait(env),
        checkLine(env),
      ]);
      const ok = foundTables === 4 && airwait.reachable === true && line.authorized === true;
      return new Response(JSON.stringify({
        ok,
        service: 'ASOBooN PURPLE Gateway',
        version: 'cf-0.2-connectivity',
        checks: {
          db: { ok: foundTables === 4, foundTables, expectedTables: 4 },
          airwait,
          line,
        },
        messageSent: false,
      }, null, 2), {
        status: ok ? 200 : 503,
        headers: headers(request),
      });
    } catch (error) {
      return new Response(JSON.stringify({
        ok: false,
        service: 'ASOBooN PURPLE Gateway',
        version: 'cf-0.2-connectivity',
        error: String(error?.message || error).slice(0, 200),
        messageSent: false,
      }, null, 2), {
        status: 500,
        headers: headers(request),
      });
    }
  }
};
