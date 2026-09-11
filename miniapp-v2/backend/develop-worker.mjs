/**
 * ASOBooN MINI App v2 - Developing Worker wrapper
 * Adds LINE Service Message registration + 1 minute call notification worker.
 * Official Developing only. Review/Published are not imported or modified.
 */
import gateway from '../../develop-gateway.runtime.mjs';
import {
  serviceHealth,
  registerReservationNotification,
  serviceStatus,
  runServiceMessageWorker,
} from './develop-service-message.js';

const ALLOWED_ORIGIN = 'https://asoboon.github.io';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const action = String(url.searchParams.get('action') || '');

    if (request.method === 'GET' && action === 'serviceMessageStatus') {
      if (!originAllowed(request)) return json(request, { ok:false, error:'ORIGIN_NOT_ALLOWED' }, 403);
      try { return json(request, await serviceStatus(env, Object.fromEntries(url.searchParams.entries()))); }
      catch (e) { return json(request, { ok:false, found:false, error:safeError(e) }, Number(e?.status || 500)); }
    }

    if (request.method === 'GET' && (action === 'health' || !action)) {
      const base = await gateway.fetch(request, env, ctx);
      let body;
      try { body = await base.clone().json(); }
      catch { return base; }
      try { Object.assign(body, await serviceHealth(env)); }
      catch (e) {
        Object.assign(body, {
          serviceMessageEnabled: true,
          serviceMessageCronEnabled: true,
          serviceMessageHealthError: safeError(e),
        });
      }
      return new Response(JSON.stringify(body), { status: base.status, headers: base.headers });
    }

    let createPayload = null;
    if (request.method === 'POST') {
      try {
        const clone = request.clone();
        createPayload = await readBody(clone);
        if (String(createPayload?.action || '') !== 'createReservation') createPayload = null;
      } catch { createPayload = null; }
    }

    const base = await gateway.fetch(request, env, ctx);
    if (!createPayload) return base;

    let body;
    try { body = await base.clone().json(); }
    catch { return base; }
    if (!(base.ok && body?.ok === true && body?.stored === true && body?.receiptNo && body?.reserveId)) return base;

    try {
      body.serviceMessage = await registerReservationNotification(env, createPayload, body);
    } catch (e) {
      body.serviceMessage = { ok:false, ready:false, status:'REGISTRATION_ERROR', error:safeError(e) };
    }
    return new Response(JSON.stringify(body), { status: base.status, headers: base.headers });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runServiceMessageWorker(env).catch(e => console.error('service-message-worker', safeError(e))));
  },
};

async function readBody(request) {
  const ct = String(request.headers.get('Content-Type') || '').toLowerCase();
  if (ct.includes('application/json')) return await request.json();
  return Object.fromEntries(new URLSearchParams(await request.text()));
}

function originAllowed(request) {
  return String(request.headers.get('Origin') || '') === ALLOWED_ORIGIN;
}
function corsHeaders(request) {
  const h = {
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
    'Content-Type': 'application/json; charset=utf-8',
  };
  if (originAllowed(request)) h['Access-Control-Allow-Origin'] = ALLOWED_ORIGIN;
  return h;
}
function json(request, payload, status=200) {
  return new Response(JSON.stringify(payload), { status, headers: corsHeaders(request) });
}
function safeError(e) { return String(e?.message || e || 'UNKNOWN_ERROR').replace(/[\r\n\t]+/g,' ').slice(0,500); }
