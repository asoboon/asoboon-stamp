const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

let runtime;

before(() => {
  execFileSync(process.execPath, ['miniapp-v2/backend/prepare-develop-test-runtime.mjs']);
  let source = fs.readFileSync('develop-gateway.runtime.mjs', 'utf8');
  source = source.replace('export default {', 'globalThis.gateway = {');
  source += '\nglobalThis.__receptionTest={SLOT_RULES,validateWaitType,operationalDate,airwaitResultError,claimRequest,finalizeRequest,requestStatus,claimUserDay,releaseUserClaim,markUserClaim};';
  const context = { URL, URLSearchParams, Request, Response, Headers, TextEncoder, crypto, structuredClone, setTimeout, clearTimeout, console };
  vm.createContext(context);
  vm.runInContext(source, context);
  runtime = context.__receptionTest;
});

function result(changes = 0) { return { meta: { changes } }; }

class LifecycleDB {
  constructor() { this.requests = new Map(); this.claims = new Map(); }
  prepare(sql) {
    const db = this;
    return { bind(...args) { return {
      async run() {
        if (sql.includes('INSERT OR IGNORE INTO v2_request_results')) {
          const [id, action, created, updated, expires] = args;
          if (db.requests.has(id)) return result(0);
          db.requests.set(id, { request_id:id, action, state:'RECEIVED', result_json:'', expires_at:expires, created_at:created, updated_at:updated });
          return result(1);
        }
        if (sql.includes('UPDATE v2_request_results SET action=')) {
          const [action,state,json,ambiguous,updated,expires,id]=args, row=db.requests.get(id);
          Object.assign(row,{action,state,result_json:json,ambiguous,updated_at:updated,expires_at:expires}); return result(1);
        }
        if (sql.includes('DELETE FROM v2_request_results WHERE expires_at')) return result(0);
        if (sql.includes('INSERT OR IGNORE INTO v2_user_day_claims')) {
          const [hash,date,id,waitType,created,updated]=args, key=`${hash}|${date}`;
          if(db.claims.has(key)) return result(0);
          db.claims.set(key,{request_id:id,state:'CREATE_INFLIGHT',receipt_no:'',reserve_id:'',wait_type_id:waitType,updated_at:updated,created_at:created}); return result(1);
        }
        if (sql.includes("DELETE FROM v2_user_day_claims")) {
          const [hash,date,id]=args,key=`${hash}|${date}`,row=db.claims.get(key);
          if(row&&row.request_id===id&&row.state==='CREATE_INFLIGHT'){db.claims.delete(key);return result(1)} return result(0);
        }
        if (sql.includes('UPDATE v2_user_day_claims SET state=')) {
          const [state,updated,hash,date]=args,row=db.claims.get(`${hash}|${date}`);if(row){row.state=state;row.updated_at=updated;return result(1)}return result(0);
        }
        throw new Error(`Unhandled run SQL: ${sql}`);
      },
      async first() {
        if (sql.includes('FROM v2_request_results')) return db.requests.get(args[0]) || null;
        if (sql.includes('FROM v2_user_day_claims')) return db.claims.get(`${args[0]}|${args[1]}`) || null;
        throw new Error(`Unhandled first SQL: ${sql}`);
      }
    }} };
  }
}

test('WEB and onsite waitType IDs are separated and regular weekday WEB is empty', () => {
  const r = runtime.SLOT_RULES;
  assert.deepEqual(Array.from(r.web['土日祝日']), ['0030','0032','0034']);
  assert.deepEqual(Array.from(r.onsite['土日祝日']), ['0029','0031','0033']);
  assert.deepEqual(Array.from(r.web['平日特定日']), ['0036','0038']);
  assert.deepEqual(Array.from(r.onsite['平日特定日']), ['0035','0037']);
  assert.deepEqual(Array.from(r.web['平日']), []);
  assert.deepEqual(Array.from(r.onsite['平日']), ['0023','0025']);
});

test('0042 is a Developing-only exception while customer slots still enforce availability and mode', () => {
  const closedTest=[{waitTypeId:'0042',dispFlg:false,usageDispType:'KeySTORE_RECEPTION_ONLY'}];
  assert.equal(runtime.validateWaitType(closedTest,{businessType:'土日祝日'},'web','0042').waitTypeId,'0042');
  const disabledCustomer=[{waitTypeId:'0030',dispFlg:false,usageDispType:'KeyONLINE_RECEPTION_ONLY'}];
  assert.throws(()=>runtime.validateWaitType(disabledCustomer,{businessType:'土日祝日'},'web','0030'),/WAIT_TYPE_NOT_AVAILABLE/);
  const storeOnly=[{waitTypeId:'0030',dispFlg:true,usageDispType:'KeySTORE_RECEPTION_ONLY'}];
  assert.throws(()=>runtime.validateWaitType(storeOnly,{businessType:'土日祝日'},'web','0030'),/WAIT_TYPE_MODE_MISMATCH/);
  assert.throws(()=>runtime.validateWaitType([],{businessType:'土日祝日'},'web','0030'),/WAIT_TYPE_NOT_AVAILABLE/);
});

test('AirWAIT structured errors are deterministic while unknown create results stay ambiguous', () => {
  const deterministic=runtime.airwaitResultError('3537');
  assert.equal(deterministic.message,'AIRWAIT_RECEPTION_ENDED');
  assert.equal(deterministic.ambiguous,false);
  const source=fs.readFileSync('develop-gateway.runtime.mjs','utf8');
  assert.match(source,/hasDefinitiveAirwaitError/);
  assert.match(source,/AIRWAIT_CREATE_NETWORK_AMBIGUOUS_MANUAL_REVIEW/);
  assert.match(source,/AIRWAIT_CREATE_200_RESULT_AMBIGUOUS_MANUAL_REVIEW/);
});

test('request and user claims follow confirmed, rejected, and ambiguous lifecycle without resend ownership', async () => {
  const DB=new LifecycleDB(),env={DB},id='request_12345678';
  const first=await runtime.claimRequest(env,id,'createReservation');assert.equal(first.owner,true);assert.equal(first.cached,false);
  await runtime.finalizeRequest(env,id,'createReservation',{ok:false,ambiguous:false,error:'AIRWAIT_RECEPTION_ENDED'});
  const retry=await runtime.claimRequest(env,id,'createReservation');
  assert.equal(retry.owner,false);assert.equal(retry.cached,true);assert.equal(retry.result.error,'AIRWAIT_RECEPTION_ENDED');
  assert.equal((await runtime.requestStatus(env,id)).found,true);

  const c=await runtime.claimUserDay(env,'user','2026-09-23','req_a_123456','0030');assert.equal(c.existing,false);
  await runtime.releaseUserClaim(env,'user','2026-09-23','req_a_123456');assert.equal(DB.claims.size,0);
  await runtime.claimUserDay(env,'user','2026-09-23','req_b_123456','0030');
  await runtime.markUserClaim(env,'user','2026-09-23','AMBIGUOUS');
  await assert.rejects(runtime.claimUserDay(env,'user','2026-09-23','req_c_123456','0030'),/EXISTING_AMBIGUOUS/);
  assert.equal(DB.claims.size,1);
});

test('19:00 JST changes the operational date', () => {
  assert.equal(runtime.operationalDate(Date.parse('2026-09-23T09:59:59Z')),'2026-09-23');
  assert.equal(runtime.operationalDate(Date.parse('2026-09-23T10:00:00Z')),'2026-09-24');
});

test('TOKEN_READY notification claim is adopted by the next request after deterministic create failure', async () => {
  const claims=new Map(),usage=new Map();
  class ServiceDB {
    prepare(sql){const statement={async run(){return result(0)},bind(...args){return{
      async first(){
        if(sql.includes('FROM v2_service_liff_token_usage'))return usage.get(args[0])||null;
        if(sql.includes('FROM v2_service_token_claims'))return claims.get(args[0])||null;
        throw Error(`Unhandled first: ${sql}`);
      },
      async run(){
        if(sql.startsWith('CREATE ')||sql.includes('CREATE TABLE')||sql.includes('CREATE INDEX'))return result(0);
        if(sql.includes('INSERT OR IGNORE INTO v2_service_liff_token_usage')){const [hash,id,,created,updated]=args;if(usage.has(hash))return result(0);usage.set(hash,{token_hash:hash,request_id:id,status:'CLAIMED',created_at:created,updated_at:updated});return result(1)}
        if(sql.includes('INSERT OR IGNORE INTO v2_service_token_claims')){const [id,date,waitType,created,updated]=args;if(claims.has(id))return result(0);claims.set(id,{request_id:id,business_date:date,wait_type_id:waitType,status:'TOKEN_ISSUE_PENDING',notification_token:'',expires_at:0,remaining_count:0,created_at:created,updated_at:updated});return result(1)}
        if(sql.includes("status='TOKEN_READY',last_error=")){const [token,expires,count,session,updated,id]=args,row=claims.get(id);Object.assign(row,{status:'TOKEN_READY',notification_token:token,expires_at:expires,remaining_count:count,session_id:session,updated_at:updated});return result(1)}
        if(sql.includes("UPDATE v2_service_liff_token_usage SET status='TOKEN_READY'")){const [updated,hash,id]=args,row=usage.get(hash);if(row&&row.request_id===id){Object.assign(row,{status:'TOKEN_READY',updated_at:updated});return result(1)}return result(0)}
        if(sql.includes('UPDATE v2_service_token_claims SET\n    request_id=')){const [next,date,waitType,updated,old]=args,row=claims.get(old);if(!row||row.status!=='TOKEN_READY')return result(0);claims.delete(old);Object.assign(row,{request_id:next,business_date:date,wait_type_id:waitType,updated_at:updated});claims.set(next,row);return result(1)}
        if(sql.includes("UPDATE v2_service_liff_token_usage SET\n    request_id=")){const [next,updated,hash,old]=args,row=usage.get(hash);if(!row||row.request_id!==old||row.status!=='TOKEN_READY')return result(0);Object.assign(row,{request_id:next,updated_at:updated});return result(1)}
        if(sql.includes('UPDATE v2_service_token_claims SET request_id='))return result(0);
        if(sql.includes('DELETE FROM v2_service_liff_token_usage'))return result(0);
        if(sql.includes('UPDATE v2_service_token_claims SET status='))return result(1);
        throw Error(`Unhandled run: ${sql}`);
      }
    }}};return statement}
    async batch(statements){for(const statement of statements)await statement.run();return []}
  }
  const originalFetch=global.fetch;
  global.fetch=async url=>String(url).includes('/oauth2/')
    ? new Response(JSON.stringify({access_token:'channel-token',expires_in:3600}),{status:200})
    : new Response(JSON.stringify({notificationToken:'notify-token',remainingCount:3,expiresIn:3600,sessionId:'session'}),{status:200});
  try{
    const moduleUrl=pathToFileURL(require('node:path').resolve('miniapp-v2/backend/develop-service-message.js')).href+`?t=${Date.now()}`;
    const {prepareReservationNotification}=await import(moduleUrl);
    const env={DB:new ServiceDB(),LINE_MINIAPP_CHANNEL_SECRET:'secret',SERVICE_MESSAGE_TEMPLATE_NAME:'template',SERVICE_MESSAGE_TEMPLATE_PARAMS_JSON:'{}'};
    const token='liff-access-token-long-enough';
    await prepareReservationNotification(env,{requestId:'request_old_123',operationalDate:'2026-09-23',waitTypeId:'0030',liffAccessToken:token});
    const adopted=await prepareReservationNotification(env,{requestId:'request_new_456',operationalDate:'2026-09-23',waitTypeId:'0032',liffAccessToken:token});
    assert.equal(adopted.ready,true);assert.equal(adopted.reused,true);
    assert.equal(claims.has('request_old_123'),false);assert.equal(claims.get('request_new_456').notification_token,'notify-token');
  }finally{global.fetch=originalFetch}
});
