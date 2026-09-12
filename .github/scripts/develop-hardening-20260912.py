from pathlib import Path


def read(path):
    return Path(path).read_text(encoding='utf-8')


def write(path, text):
    Path(path).write_text(text, encoding='utf-8')


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    return text.replace(old, new, 1)


# 1) LINE service-message hardening
p = 'miniapp-v2/backend/develop-service-message.js'
s = read(p)
s = replace_once(s, "VERSION: '2.1.dev4'", "VERSION: '2.2.dev5'", 'service version')
s = replace_once(
    s,
    "    serviceMessageCronEnabled: true,\n",
    "    serviceMessageCronEnabled: true,\n    serviceMessageImmediateObservationEnabled: true,\n    serviceMessageReusableUnboundToken: true,\n",
    'service health flags',
)
old_usage = """  const usage = await env.DB.prepare('SELECT request_id,status FROM v2_service_liff_token_usage WHERE token_hash=? LIMIT 1').bind(tokenHash).first();
  if (usage && String(usage.request_id || '') !== requestId) {
    throw apiError('LIFF_NOTIFICATION_TOKEN_ALREADY_CLAIMED_REOPEN_MINIAPP', 409, true);
  }
  if (!usage) {
"""
new_usage = """  const usage = await env.DB.prepare('SELECT request_id,status,created_at,updated_at FROM v2_service_liff_token_usage WHERE token_hash=? LIMIT 1').bind(tokenHash).first();
  if (usage && String(usage.request_id || '') !== requestId) {
    const adopted = await adoptReusableNotificationClaim(env, tokenHash, usage, requestId, businessDate, waitTypeId);
    if (adopted) return publicClaim(adopted, true);
    throw apiError('LIFF_NOTIFICATION_TOKEN_ALREADY_CLAIMED_REOPEN_MINIAPP', 409, true);
  }
  if (!usage) {
"""
s = replace_once(s, old_usage, new_usage, 'adopt unbound token')

marker = "export async function runServiceMessageWorker(env) {"
immediate_fn = """export async function sendObservedCallNotification(env, observation) {
  await ensureServiceSchema(env);
  const businessDate = normalizeDate(observation?.businessDate);
  const receiptNo = normalizeReceipt(observation?.receiptNo);
  const observedWaitType = normalizeWaitType(observation?.waitTypeId);
  const calling = observation?.isCalling === true || String(observation?.isCalling || '') === '1';
  if (!businessDate || !receiptNo || String(observation?.status || '') !== '0' || !calling) {
    return { ok:true, sent:false, reason:'NOT_CALLING', version:SM.VERSION };
  }

  let rec = await env.DB.prepare(`SELECT * FROM v2_service_messages
    WHERE business_date=? AND receipt_no=? AND notified_at=0
    ORDER BY updated_at DESC LIMIT 1`).bind(businessDate, receiptNo).first();

  if (!rec) {
    const pendingResult = await env.DB.prepare(`SELECT * FROM v2_service_messages
      WHERE business_date=? AND notified_at=0 AND notification_token<>''
      ORDER BY updated_at DESC LIMIT 500`).bind(businessDate).all();
    const candidates = (Array.isArray(pendingResult?.results) ? pendingResult.results : []).map(x => ({ ...x, number:x.receipt_no }));
    rec = selectTicketMatch(candidates, receiptNo).row;
  }
  if (!rec) return { ok:true, sent:false, reason:'SERVICE_ROW_NOT_FOUND', version:SM.VERSION };

  if (observedWaitType && String(rec.wait_type_id || '') !== observedWaitType) {
    await env.DB.prepare(`UPDATE v2_service_messages SET wait_type_id=?,updated_at=?
      WHERE business_date=? AND reserve_id=? AND notified_at=0`)
      .bind(observedWaitType, Date.now(), rec.business_date, rec.reserve_id).run();
    rec = { ...rec, wait_type_id:observedWaitType };
  }

  const result = await sendCallMessage(env, rec, {
    number:receiptNo,
    waitTypeId:observedWaitType || String(rec.wait_type_id || ''),
    waitTypeName:String(observation?.waitTypeName || ''),
    status:'0',
    isCalling:'1',
  });
  return { ok:true, ...result, version:SM.VERSION };
}

"""
s = replace_once(s, marker, immediate_fn + marker, 'immediate observed call export')

old_worker = """  const byWaitType = new Map();
  for (const rec of pending) {
    const wt = normalizeWaitType(rec.wait_type_id);
    if (wt && !byWaitType.has(wt)) byWaitType.set(wt, await fetchAirwaitReservations(env, wt));
  }

  let sent = 0;
  for (const rec of pending) {
    const own = (byWaitType.get(String(rec.wait_type_id)) || []).find(r => sameTicket(r.number, rec.receipt_no));
    if (!own || String(own.status || '') !== '0' || String(own.isCalling || '0') !== '1') continue;
    const result = await sendCallMessage(env, rec, own);
    if (result.sent) sent += 1;
  }
  return { ok:true, checked:pending.length, sent, reconciled:true, version:SM.VERSION };
"""
new_worker = """  const byWaitType = new Map();
  for (const rec of pending) {
    const wt = normalizeWaitType(rec.wait_type_id);
    if (wt && !byWaitType.has(wt)) byWaitType.set(wt, await fetchAirwaitReservations(env, wt));
  }

  let allRows = null;
  let sent = 0;
  for (let rec of pending) {
    let match = selectTicketMatch(byWaitType.get(String(rec.wait_type_id)) || [], rec.receipt_no);
    if (!match.row && !match.ambiguous) {
      if (!allRows) allRows = await fetchAirwaitReservations(env, '');
      match = selectTicketMatch(allRows, rec.receipt_no);
      const correctedWaitType = normalizeWaitType(match.row?.waitTypeId);
      if (correctedWaitType && correctedWaitType !== String(rec.wait_type_id || '')) {
        await env.DB.prepare(`UPDATE v2_service_messages SET wait_type_id=?,updated_at=?
          WHERE business_date=? AND reserve_id=? AND notified_at=0`)
          .bind(correctedWaitType, Date.now(), rec.business_date, rec.reserve_id).run();
        rec = { ...rec, wait_type_id:correctedWaitType };
      }
    }

    const own = match.row;
    const retryEvidence = String(rec.status || '') === 'CALL_SEND_RETRY';
    const callingNow = Boolean(own && String(own.status || '') === '0' && String(own.isCalling || '0') === '1');
    if (!callingNow && !retryEvidence) continue;
    const result = await sendCallMessage(env, rec, own || { waitTypeName:'' });
    if (result.sent) sent += 1;
  }
  return { ok:true, checked:pending.length, sent, reconciled:true, version:SM.VERSION };
"""
s = replace_once(s, old_worker, new_worker, 'cron retry/fallback')

old_fetch = """async function fetchAirwaitReservations(env, waitTypeId) {
  const out=[]; let start=1;
  for (let page=0; page<20; page+=1) {
    const response=await fetchWithTimeout(SM.AIR_RESERVATIONS,{
      method:'POST',headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded;charset=UTF-8',corWclpKeyCd:env.AIRWAIT_API_KEY},
      body:new URLSearchParams({storeId:SM.STORE_ID,waitTypeId,sortStatus:'0',isDesc:'0',start:String(start),limit:'100'}),
    }, SM.EXTERNAL_TIMEOUT_MS);
"""
new_fetch = """async function fetchAirwaitReservations(env, waitTypeId) {
  const out=[]; let start=1;
  for (let page=0; page<20; page+=1) {
    const params={storeId:SM.STORE_ID,sortStatus:'0',isDesc:'0',start:String(start),limit:'100'};
    if (normalizeWaitType(waitTypeId)) params.waitTypeId=normalizeWaitType(waitTypeId);
    const response=await fetchWithTimeout(SM.AIR_RESERVATIONS,{
      method:'POST',headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded;charset=UTF-8',corWclpKeyCd:env.AIRWAIT_API_KEY},
      body:new URLSearchParams(params),
    }, SM.EXTERNAL_TIMEOUT_MS);
"""
s = replace_once(s, old_fetch, new_fetch, 'all-wait service fetch')

helper_marker = "async function getTokenClaim(env, requestId){"
adopt_helper = """async function adoptReusableNotificationClaim(env, tokenHash, usage, newRequestId, businessDate, waitTypeId) {
  if (String(usage?.status || '') !== 'TOKEN_READY') return null;
  const oldRequestId = normalizeRequestId(usage?.request_id);
  if (!oldRequestId || oldRequestId === newRequestId) return null;
  const oldClaim = await getTokenClaim(env, oldRequestId);
  if (!oldClaim || String(oldClaim.status || '') !== 'TOKEN_READY' || !String(oldClaim.notification_token || '')) return null;
  if (Number(oldClaim.expires_at || 0) <= Date.now() + 30_000 || Number(oldClaim.remaining_count || 0) <= 0) return null;

  const now = Date.now();
  const moved = await env.DB.prepare(`UPDATE v2_service_token_claims SET
    request_id=?,business_date=?,wait_type_id=?,updated_at=?
    WHERE request_id=? AND status='TOKEN_READY' AND notification_token<>''`)
    .bind(newRequestId, businessDate, waitTypeId, now, oldRequestId).run();
  if (Number(moved?.meta?.changes || 0) !== 1) return null;

  const usageMoved = await env.DB.prepare(`UPDATE v2_service_liff_token_usage SET
    request_id=?,status='TOKEN_READY',updated_at=?
    WHERE token_hash=? AND request_id=? AND status='TOKEN_READY'`)
    .bind(newRequestId, now, tokenHash, oldRequestId).run();
  if (Number(usageMoved?.meta?.changes || 0) !== 1) {
    await env.DB.prepare(`UPDATE v2_service_token_claims SET request_id=?,updated_at=?
      WHERE request_id=? AND status='TOKEN_READY'`)
      .bind(oldRequestId, Date.now(), newRequestId).run();
    return null;
  }
  return await getTokenClaim(env, newRequestId);
}

"""
s = replace_once(s, helper_marker, adopt_helper + helper_marker, 'adopt helper')

old_ticket_tail = """function sameTicket(a,b){const x=ticketParts(a),y=ticketParts(b);if(!x||!y||!x.digits||!y.digits||x.digits!==y.digits)return false;if(x.prefix&&y.prefix&&x.prefix!==y.prefix)return false;return true;}
function normalizeWaitType"""
new_ticket_tail = """function sameTicket(a,b){const x=ticketParts(a),y=ticketParts(b);if(!x||!y||!x.digits||!y.digits||x.digits!==y.digits)return false;if(x.prefix&&y.prefix&&x.prefix!==y.prefix)return false;return true;}
function selectTicketMatch(rows,receiptNo){const list=Array.isArray(rows)?rows:[];const target=ticketIdentity(receiptNo);const exact=target?list.filter(r=>ticketIdentity(r?.number)===target):[];if(exact.length===1)return{row:exact[0],ambiguous:false,count:1,mode:'exact'};if(exact.length>1)return{row:null,ambiguous:true,count:exact.length,mode:'exact'};const loose=list.filter(r=>sameTicket(r?.number,receiptNo));if(loose.length===1)return{row:loose[0],ambiguous:false,count:1,mode:'compatible'};return{row:null,ambiguous:loose.length>1,count:loose.length,mode:'compatible'};}
function normalizeWaitType"""
s = replace_once(s, old_ticket_tail, new_ticket_tail, 'service unique ticket match')
write(p, s)


# 2) Developing wrapper: immediate call observation + safe reconciliation
p = 'miniapp-v2/backend/develop-worker.mjs'
s = read(p)
s = replace_once(
    s,
    "  runServiceMessageWorker,\n} from './develop-service-message.js';",
    "  runServiceMessageWorker,\n  sendObservedCallNotification,\n} from './develop-service-message.js';",
    'wrapper import immediate notifier',
)
s = replace_once(
    s,
    """    if (reservationStatusPayload) {
      return await reconcileReservationStatus(request, env, base, reservationStatusPayload);
    }
""",
    """    if (reservationStatusPayload) {
      const statusResponse = await reconcileReservationStatus(request, env, base, reservationStatusPayload);
      queueObservedCallNotification(env, statusResponse, ctx);
      return statusResponse;
    }
""",
    'queue immediate notification',
)
insert_marker = "async function getBusinessDayProxy(value) {"
queue_fn = """function queueObservedCallNotification(env, response, ctx) {
  const job = (async () => {
    let body;
    try { body = await response.clone().json(); } catch { return; }
    if (!(body?.ok === true && body?.found === true && String(body?.status || '') === '0' && body?.isCalling === true)) return;
    await sendObservedCallNotification(env, body);
  })();
  const guarded = job.catch(e => console.warn('CALLSTATUS_IMMEDIATE_NOTIFY_FAILED', safeError(e)));
  if (typeof ctx?.waitUntil === 'function') ctx.waitUntil(guarded);
  else void guarded;
}

"""
s = replace_once(s, insert_marker, queue_fn + insert_marker, 'wrapper immediate queue helper')
old_reconcile = """    const rows = await fetchAllReservationsForReconcile(env);
    const matches = rows.filter(r => sameTicket(r.number, body.receiptNo));
    const activeMatches = matches.filter(r => ['0','1','4'].includes(String(r.status || '')));
    const candidate = activeMatches.length === 1
      ? activeMatches[0]
      : (activeMatches.length === 0 && matches.length === 1 ? matches[0] : null);

    if (!candidate) {
      return new Response(JSON.stringify({
        ...body,
        reconcileTried:true,
        reconcileAmbiguous:activeMatches.length > 1 || matches.length > 1,
        reconcileCandidateCount:matches.length,
      }), { status:base.status, headers:base.headers });
    }
"""
new_reconcile = """    const rows = await fetchAllReservationsForReconcile(env);
    const match = selectTicketMatch(rows, body.receiptNo);
    const candidate = match.row;

    if (!candidate) {
      return new Response(JSON.stringify({
        ...body,
        reconcileTried:true,
        reconcileAmbiguous:match.ambiguous,
        reconcileCandidateCount:match.count,
      }), { status:base.status, headers:base.headers });
    }
"""
s = replace_once(s, old_reconcile, new_reconcile, 'wrapper unique reconciliation')
old_session_update = """        await env.DB.prepare('UPDATE v2_reservation_sessions SET wait_type_id=? WHERE token_hash=?')
          .bind(candidateWaitTypeId, tokenHash).run();
"""
new_session_update = """        await env.DB.prepare('UPDATE v2_reservation_sessions SET wait_type_id=? WHERE token_hash=?')
          .bind(candidateWaitTypeId, tokenHash).run();
        try {
          await env.DB.prepare(`UPDATE v2_service_messages SET wait_type_id=?,updated_at=?
            WHERE business_date=? AND receipt_no=? AND notified_at=0`)
            .bind(candidateWaitTypeId, Date.now(), String(body.businessDate || ''), String(body.receiptNo || '')).run();
        } catch (e) {
          console.warn('CALLSTATUS_RECONCILE_SERVICE_WAITTYPE_FAILED', safeError(e));
        }
"""
s = replace_once(s, old_session_update, new_session_update, 'repair service wait type')
old_wrapper_ticket = """function sameTicket(number, receiptNo) {
  const a=ticketParts(number),b=ticketParts(receiptNo);
  if(!a||!b||!a.digits||!b.digits||a.digits!==b.digits)return false;
  if(a.prefix&&b.prefix&&a.prefix!==b.prefix)return false;
  return true;
}

function rebuildCreateRequest"""
new_wrapper_ticket = """function sameTicket(number, receiptNo) {
  const a=ticketParts(number),b=ticketParts(receiptNo);
  if(!a||!b||!a.digits||!b.digits||a.digits!==b.digits)return false;
  if(a.prefix&&b.prefix&&a.prefix!==b.prefix)return false;
  return true;
}
function selectTicketMatch(rows, receiptNo) {
  const list=Array.isArray(rows)?rows:[];
  const target=ticketIdentity(receiptNo);
  const exact=target?list.filter(r=>ticketIdentity(r?.number)===target):[];
  if(exact.length===1)return{row:exact[0],ambiguous:false,count:1,mode:'exact'};
  if(exact.length>1)return{row:null,ambiguous:true,count:exact.length,mode:'exact'};
  const loose=list.filter(r=>sameTicket(r?.number,receiptNo));
  if(loose.length===1)return{row:loose[0],ambiguous:false,count:1,mode:'compatible'};
  return{row:null,ambiguous:loose.length>1,count:loose.length,mode:'compatible'};
}

function rebuildCreateRequest"""
s = replace_once(s, old_wrapper_ticket, new_wrapper_ticket, 'wrapper unique ticket helper')
write(p, s)


# 3) Call-status foreground polling: only the very front polls at 5s
p = 'miniapp-v2/shared/callstatus.js'
s = read(p)
s = replace_once(s, "const POLL_NEAR_MS=15000;", "const POLL_FRONT_MS=5000;\nconst POLL_NEAR_MS=15000;", 'front poll const')
s = replace_once(
    s,
    "function pollLabel(ms){if(!ms)return'自動更新停止';if(ms<=6000)return'約6秒ごと';if(ms<=15000)return'約15秒ごと';if(ms<=60000)return'約1分ごと';return'約3分ごと'}",
    "function pollLabel(ms){if(!ms)return'自動更新停止';if(ms<=5000)return'約5秒ごと';if(ms<=6000)return'約6秒ごと';if(ms<=15000)return'約15秒ごと';if(ms<=60000)return'約1分ごと';return'約3分ごと'}",
    'poll labels',
)
s = replace_once(
    s,
    "    if(Number.isFinite(ahead)&&ahead<=5)return POLL_NEAR_MS;",
    "    if(Number.isFinite(ahead)&&ahead<=1)return POLL_FRONT_MS;\n    if(Number.isFinite(ahead)&&ahead<=5)return POLL_NEAR_MS;",
    'front poll rule',
)
s = replace_once(s, '確認後は待ち人数に応じて約15秒〜3分で調整します。', '確認後は待ち人数に応じて約5秒〜3分で調整します。', 'callstatus note')
s = replace_once(s, "version:'1.6.1-post-create-reconcile'", "version:'1.6.2-frontline-observe'", 'callstatus version')
write(p, s)


# 4) Runtime gateway: memoize schema init and never choose an ambiguous compatible receipt
p = 'miniapp-v2/backend/prepare-develop-test-runtime.mjs'
s = read(p)
s = replace_once(s, "VERSION: '1.4.dev-hardening'", "VERSION: '1.5.dev-correctness'", 'runtime version')
schema_marker = """replaceOnce(
  "function enforceReceptionHours(day, mode) {\\n  if (day.isClosed) throw apiError('CLOSED_DAY', 400);",
"""
schema_patch = """replaceOnce(
  "async function ensureSchema(env) {\\n  await env.DB.batch([",
  "let gatewaySchemaReady = null;\\nasync function ensureSchema(env) {\\n  if (gatewaySchemaReady) return await gatewaySchemaReady;\\n  gatewaySchemaReady = env.DB.batch(["
);
replaceOnce(
  "  ]);\\n}\\n\\nasync function health(env) {",
  "  ]).catch(e => { gatewaySchemaReady = null; throw e; });\\n  return await gatewaySchemaReady;\\n}\\n\\nasync function health(env) {"
);

""" + schema_marker
s = replace_once(s, schema_marker, schema_patch, 'gateway schema memoization patch')
old_runtime_ticket = """function sameTicket(number, receiptNo) {
  const a = ticketParts(number), b = ticketParts(receiptNo);
  if (!a || !b || !a.digits || !b.digits || a.digits !== b.digits) return false;
  if (a.prefix && b.prefix && a.prefix !== b.prefix) return false;
  return true;
}

function reservationState"""
new_runtime_ticket = """function sameTicket(number, receiptNo) {
  const a = ticketParts(number), b = ticketParts(receiptNo);
  if (!a || !b || !a.digits || !b.digits || a.digits !== b.digits) return false;
  if (a.prefix && b.prefix && a.prefix !== b.prefix) return false;
  return true;
}

function selectTicketMatch(rows, receiptNo) {
  const list = Array.isArray(rows) ? rows : [];
  const target = ticketIdentity(receiptNo);
  const exact = target ? list.filter(r => ticketIdentity(r?.number) === target) : [];
  if (exact.length === 1) return { row:exact[0], ambiguous:false, count:1, mode:'exact' };
  if (exact.length > 1) return { row:null, ambiguous:true, count:exact.length, mode:'exact' };
  const loose = list.filter(r => sameTicket(r?.number, receiptNo));
  if (loose.length === 1) return { row:loose[0], ambiguous:false, count:1, mode:'compatible' };
  return { row:null, ambiguous:loose.length > 1, count:loose.length, mode:'compatible' };
}

function reservationState"""
s = replace_once(s, old_runtime_ticket, new_runtime_ticket, 'runtime unique ticket helper')
s = replace_once(
    s,
    """  const rows = await fetchAirwaitReservations(env, String(session.wait_type_id || ''));
  const ownIndex = rows.findIndex(r => sameTicket(r.number, session.receipt_no));
  const own = ownIndex >= 0 ? rows[ownIndex] : null;
""",
    """  const rows = await fetchAirwaitReservations(env, String(session.wait_type_id || ''));
  const ownMatch = selectTicketMatch(rows, session.receipt_no);
  const own = ownMatch.row;
""",
    'runtime select own ticket',
)
s = replace_once(
    s,
    """  const active = rows.filter(r => ['0', '1', '4'].includes(String(r.status || '')));
  const activeIndex = active.findIndex(r => sameTicket(r.number, session.receipt_no));
""",
    """  const active = rows.filter(r => ['0', '1', '4'].includes(String(r.status || '')));
  const ownIdentity = ticketIdentity(own.number);
  const activeIndex = active.findIndex(r => ticketIdentity(r.number) === ownIdentity);
""",
    'runtime exact active index',
)
s = replace_once(
    s,
    "state='CONFIRMED' AND receipt_no<>'' AND reserve_id<>'' LIMIT 1",
    "state='CONFIRMED' AND receipt_no<>'' AND reserve_id<>'' ORDER BY updated_at DESC LIMIT 1",
    'latest session recovery',
)
write(p, s)


# 5) Deployment health gate follows the hardened service version/features
p = '.github/workflows/deploy-miniapp-v2-develop-gateway.yml'
s = read(p)
s = s.replace('x.serviceMessageVersion!=="2.1.dev4"', 'x.serviceMessageVersion!=="2.2.dev5"')
s = replace_once(
    s,
    "                  x.serviceMessageCronEnabled!==true\n",
    "                  x.serviceMessageCronEnabled!==true ||\n                  x.serviceMessageImmediateObservationEnabled!==true ||\n                  x.serviceMessageReusableUnboundToken!==true\n",
    'deploy health new features',
)
write(p, s)


# 6) Browser cache bump because callstatus.js changed
p = 'miniapp-v2/develop/index.html'
s = read(p)
if '?v=20260912-08' not in s:
    raise SystemExit('develop cache: expected 20260912-08')
s = s.replace('?v=20260912-08', '?v=20260912-09')
write(p, s)


# 7) Regression locks for the new failure modes
p = '.github/workflows/newhome-flow-verify.yml'
s = read(p)
s = replace_once(s, "          grep -F \"const POLL_NEAR_MS=15000;\" miniapp-v2/shared/callstatus.js\n", "          grep -F \"const POLL_FRONT_MS=5000;\" miniapp-v2/shared/callstatus.js\n          grep -F \"const POLL_NEAR_MS=15000;\" miniapp-v2/shared/callstatus.js\n", 'test front poll')
s = replace_once(s, "          grep -F \"ahead<=5\" miniapp-v2/shared/callstatus.js\n", "          grep -F \"ahead<=1\" miniapp-v2/shared/callstatus.js\n          grep -F \"ahead<=5\" miniapp-v2/shared/callstatus.js\n", 'test front condition')
s = replace_once(s, "          grep -F \"version:'1.6.1-post-create-reconcile'\" miniapp-v2/shared/callstatus.js\n", "          grep -F \"version:'1.6.2-frontline-observe'\" miniapp-v2/shared/callstatus.js\n", 'test callstatus version')
s = replace_once(s, "          if(versions[0]!=='20260912-08') throw new Error(`unexpected cache version ${versions[0]}`);", "          if(versions[0]!=='20260912-09') throw new Error(`unexpected cache version ${versions[0]}`);", 'test cache version')
insert_before = "      - name: Service notification scan must not starve after 200 rows\n"
new_tests = """      - name: Receipt selection must prefer exact identity and fail ambiguous compatible matches
        run: |
          set -euo pipefail
          grep -F 'function selectTicketMatch' miniapp-v2/backend/develop-worker.mjs
          grep -F 'function selectTicketMatch' miniapp-v2/backend/develop-service-message.js
          grep -F 'function selectTicketMatch' miniapp-v2/backend/prepare-develop-test-runtime.mjs
          node <<'NODE'
          const parts=v=>{const k=String(v||'').normalize('NFKC').toUpperCase().replace(/[\\s\\-ー]/g,'');const m=k.match(/^([FT]?)(\\d+)$/);return m?{prefix:m[1],digits:m[2].replace(/^0+(?=\\d)/,'')}:null};
          const id=v=>{const p=parts(v);return p?p.prefix+p.digits:''};
          const same=(a,b)=>{const x=parts(a),y=parts(b);if(!x||!y||x.digits!==y.digits)return false;if(x.prefix&&y.prefix&&x.prefix!==y.prefix)return false;return true};
          const pick=(rows,target)=>{const exact=rows.filter(r=>id(r.number)===id(target));if(exact.length===1)return exact[0];if(exact.length>1)return null;const loose=rows.filter(r=>same(r.number,target));return loose.length===1?loose[0]:null};
          if(pick([{number:'F123'},{number:'T123'}],'123')!==null) throw new Error('prefixless ambiguous receipt must not auto-select');
          if(pick([{number:'F123'},{number:'T123'}],'F123')?.number!=='F123') throw new Error('exact prefix must win');
          if(pick([{number:'F123'}],'123')?.number!=='F123') throw new Error('single compatible prefix may reconcile');
          NODE

      - name: LINE notification must survive corrected retries and call-state transitions
        run: |
          set -euo pipefail
          grep -F "VERSION: '2.2.dev5'" miniapp-v2/backend/develop-service-message.js
          grep -F 'adoptReusableNotificationClaim' miniapp-v2/backend/develop-service-message.js
          grep -F 'serviceMessageReusableUnboundToken: true' miniapp-v2/backend/develop-service-message.js
          grep -F 'sendObservedCallNotification' miniapp-v2/backend/develop-service-message.js
          grep -F 'sendObservedCallNotification' miniapp-v2/backend/develop-worker.mjs
          grep -F 'queueObservedCallNotification' miniapp-v2/backend/develop-worker.mjs
          grep -F "retryEvidence = String(rec.status || '') === 'CALL_SEND_RETRY'" miniapp-v2/backend/develop-service-message.js
          grep -F 'serviceMessageImmediateObservationEnabled: true' miniapp-v2/backend/develop-service-message.js

      - name: Gateway schema initialization must be memoized per isolate
        run: |
          set -euo pipefail
          grep -F 'let gatewaySchemaReady = null;' miniapp-v2/backend/prepare-develop-test-runtime.mjs
          node miniapp-v2/backend/prepare-develop-test-runtime.mjs
          grep -F 'let gatewaySchemaReady = null;' develop-gateway.runtime.mjs
          grep -F 'if (gatewaySchemaReady) return await gatewaySchemaReady;' develop-gateway.runtime.mjs

""" + insert_before
s = replace_once(s, insert_before, new_tests, 'insert correctness regression tests')
write(p, s)

print('Developing hardening patch prepared successfully.')
