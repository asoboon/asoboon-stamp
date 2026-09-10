const ALLOWED_ORIGIN = 'https://asoboon.github.io';

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
  };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    if (request.method !== 'GET') {
      return new Response(JSON.stringify({ ok: false, error: 'METHOD_NOT_ALLOWED' }), {
        status: 405,
        headers: corsHeaders(request),
      });
    }

    try {
      const row = await env.DB.prepare(
        "SELECT COUNT(*) AS table_count FROM sqlite_master WHERE type='table' AND name IN ('notification_bindings','airwait_snapshot','request_results','system_state')"
      ).first();

      const tableCount = Number(row?.table_count || 0);
      const ok = tableCount === 4;

      return new Response(JSON.stringify({
        ok,
        service: 'ASOBooN PURPLE Gateway',
        version: 'cf-0.1-health',
        dbBinding: true,
        expectedTables: 4,
        foundTables: tableCount,
      }, null, 2), {
        status: ok ? 200 : 503,
        headers: corsHeaders(request),
      });
    } catch (error) {
      return new Response(JSON.stringify({
        ok: false,
        service: 'ASOBooN PURPLE Gateway',
        version: 'cf-0.1-health',
        dbBinding: false,
        error: String(error?.message || error),
      }, null, 2), {
        status: 500,
        headers: corsHeaders(request),
      });
    }
  },
};
