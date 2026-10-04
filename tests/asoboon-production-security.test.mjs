import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const gatewayPath=path.join(here,'..','miniapp-v2','backend','production-gateway.js');
const gatewaySource=fs.readFileSync(gatewayPath,'utf8');
const gatewayModule=await import('data:text/javascript;base64,'+Buffer.from(gatewaySource).toString('base64'));
const T=gatewayModule.__securityTest;

class MemoryD1 {
  constructor(){this.requestResults=new Map();this.userClaims=new Map();}
  prepare(sql){
    const db=this;
    return {
      bind(...args){
        return {
          async run(){return db.run(sql,args)},
          async first(){return db.first(sql,args)},
          async all(){return db.all(sql,args)},
        };
      }
    };
  }
  async run(sql,args){
    if(sql.includes('INSERT OR IGNORE INTO v2_request_results')){
      const [requestId,action,createdAt,updatedAt,expiresAt,userHash]=args;
      if(this.requestResults.has(requestId)) return {meta:{changes:0}};
      this.requestResults.set(requestId,{request_id:requestId,action,state:'RECEIVED',result_json:'',ambiguous:0,created_at:createdAt,updated_at:updatedAt,expires_at:expiresAt,user_hash:userHash});
      return {meta:{changes:1}};
    }
    if(sql.includes('INSERT OR IGNORE INTO v2_user_day_claims')){
      const [userHash,businessDate,requestId,waitTypeId,createdAt,updatedAt]=args;
      const key=userHash+'|'+businessDate;
      if(this.userClaims.has(key)) return {meta:{changes:0}};
      this.userClaims.set(key,{user_hash:userHash,business_date:businessDate,request_id:requestId,state:'CREATE_INFLIGHT',receipt_no:'',reserve_id:'',wait_type_id:waitTypeId,created_at:createdAt,updated_at:updatedAt});
      return {meta:{changes:1}};
    }
    if(sql.startsWith('UPDATE v2_user_day_claims SET state=?')){
      const [state,updatedAt,userHash,businessDate]=args;
      const key=userHash+'|'+businessDate,row=this.userClaims.get(key);
      if(!row) return {meta:{changes:0}};
      row.state=state;row.updated_at=updatedAt;
      return {meta:{changes:1}};
    }
    if(sql.startsWith('UPDATE v2_request_results SET action=')){
      const [action,state,resultJson,ambiguous,updatedAt,expiresAt,requestId]=args;
      const row=this.requestResults.get(requestId);
      if(!row) return {meta:{changes:0}};
      Object.assign(row,{action,state,result_json:resultJson,ambiguous,updated_at:updatedAt,expires_at:expiresAt});
      return {meta:{changes:1}};
    }
    if(sql.startsWith('DELETE FROM v2_request_results WHERE expires_at')) return {meta:{changes:0}};
    throw new Error('Unhandled MemoryD1 run SQL: '+sql);
  }
  async first(sql,args){
    if(sql.includes('FROM v2_request_results WHERE request_id=?')){
      return this.requestResults.get(args[0])||null;
    }
    if(sql.includes('FROM v2_user_day_claims')&&sql.includes('WHERE user_hash=? AND business_date=?')){
      return this.userClaims.get(args[0]+'|'+args[1])||null;
    }
    if(sql.includes('SELECT user_hash FROM v2_user_day_claims WHERE request_id=?')){
      return [...this.userClaims.values()].find(r=>r.request_id===args[0])||null;
    }
    if(sql.includes('FROM v2_official_web_handoffs')) return null;
    throw new Error('Unhandled MemoryD1 first SQL: '+sql);
  }
  async all(){return {results:[]};}
}

function expectPeopleReject(value,min=0,max=10){
  assert.throws(()=>T.strictIntField(value,'field',min,max),/PEOPLE_VALIDATION_ERROR/);
}

test('Production create remains hard-disabled even if CREATE_ENABLED=1',()=>{
  assert.equal(T.productionCreateEnabled({CREATE_ENABLED:'1'}),false);
  assert.match(gatewaySource,/PRODUCTION_CREATE_ARMED:\s*false/);
});

test('strict people validation rejects coercion and unsafe values',()=>{
  for(const v of [-1,1.5,NaN,Infinity,-Infinity,'-1','1.0','1e2',' 1','1 ','01','','999999999999999999999999']) expectPeopleReject(v);
  assert.equal(T.strictIntField('0','child',0,10),0);
  assert.equal(T.strictIntField('10','child',0,10),10);
  assert.equal(T.strictIntField(1,'adult',1,10),1);
  assert.throws(()=>T.validatePartySize(1,4,0),/PEOPLE_VALIDATION_ERROR/);
  assert.throws(()=>T.validatePartySize(1,0,4),/PEOPLE_VALIDATION_ERROR/);
  assert.throws(()=>T.validatePartySize(4,6,1),/PEOPLE_VALIDATION_ERROR/);
  assert.equal(T.validatePartySize(2,3,3),8);
});

test('AirWAIT 9999 and unknown create results are AMBIGUOUS, allowlisted rejects are retryable',()=>{
  assert.equal(T.classifyAirwaitCreateResult(true,200,{success:false,resultCode:{code:'9999'}}).kind,'AMBIGUOUS');
  assert.equal(T.classifyAirwaitCreateResult(true,200,{success:false,resultCode:{code:'7777'}}).kind,'AMBIGUOUS');
  assert.equal(T.classifyAirwaitCreateResult(false,500,{success:false,resultCode:{code:'9999'}}).kind,'AMBIGUOUS');
  assert.equal(T.classifyAirwaitCreateResult(true,200,{success:false,resultCode:{code:'3537'}}).kind,'REJECTED');
  assert.equal(T.classifyAirwaitCreateResult(true,200,{success:true,resultCode:{code:'0000'}}).kind,'SUCCESS');
});

test('HTTP200 success:false resultCode 9999 keeps the user-day claim and blocks a second requestId',async()=>{
  const env={DB:new MemoryD1()},user='u1',date='2026-10-04';
  const first=await T.claimUserDay(env,user,date,'request_00000001','0029');
  assert.equal(first.existing,false);
  const outcome=T.classifyAirwaitCreateResult(true,200,{success:false,resultCode:{code:'9999'}});
  assert.equal(outcome.kind,'AMBIGUOUS');
  await T.markUserClaim(env,user,date,'AMBIGUOUS');
  await assert.rejects(
    T.claimUserDay(env,user,date,'request_00000002','0029'),
    e=>e?.ambiguous===true&&/AMBIGUOUS/.test(String(e?.message||''))
  );
});

test('same requestId 100-way concurrency has exactly one owner',async()=>{
  const env={DB:new MemoryD1()};
  const results=await Promise.all(Array.from({length:100},()=>T.claimRequest(env,'request_same_12345','createReservation','owner-hash')));
  assert.equal(results.filter(x=>x.owner===true).length,1);
  assert.equal(results.filter(x=>x.owner===false).length,99);
});

test('different requestIds from one LINE user cannot create concurrent user-day claims',async()=>{
  const env={DB:new MemoryD1()},user='same-user',date='2026-10-04';
  const results=await Promise.allSettled(Array.from({length:100},(_,i)=>T.claimUserDay(env,user,date,'request_'+String(i).padStart(8,'0'),'0029')));
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(results.filter(x=>x.status==='rejected').length,99);
});

test('09:24:59 is rejected and 09:25:00 is accepted in JST',()=>{
  const day={isClosed:false,closeMin:18*60};
  assert.throws(()=>T.enforceReceptionHours(day,'web',Date.parse('2026-10-04T00:24:59Z')),/WEB_NOT_OPEN_YET/);
  assert.doesNotThrow(()=>T.enforceReceptionHours(day,'web',Date.parse('2026-10-04T00:25:00Z')));
});

test('operational date rolls exactly at 19:00 JST',()=>{
  assert.equal(T.operationalDate(Date.parse('2026-10-04T09:59:59Z')),'2026-10-04');
  assert.equal(T.operationalDate(Date.parse('2026-10-04T10:00:00Z')),'2026-10-05');
});

test('Production ignores client mode/location and accepts STORE_RECEPTION_ONLY only',()=>{
  assert.match(gatewaySource,/const mode = 'web';/);
  assert.doesNotMatch(gatewaySource,/function validateLocation\(/);
  assert.equal(T.usageMatchesMode('KeySTORE_RECEPTION_ONLY'),true);
  assert.equal(T.usageMatchesMode('02'),true);
  assert.equal(T.usageMatchesMode('KeyONLINE_RECEPTION_ONLY'),false);
  assert.equal(T.usageMatchesMode('KeyALL'),false);
  const day={businessType:'土日祝日'};
  assert.equal(T.validateWaitType([{waitTypeId:'0029',dispFlg:true,usageDispType:'KeySTORE_RECEPTION_ONLY'}],day,'web','0029').waitTypeId,'0029');
  assert.throws(()=>T.validateWaitType([{waitTypeId:'0029',dispFlg:true,usageDispType:'KeyONLINE_RECEPTION_ONLY'}],day,'web','0029'),/WAIT_TYPE_MODE_MISMATCH/);
  assert.throws(()=>T.validateWaitType([{waitTypeId:'0030',dispFlg:true,usageDispType:'KeySTORE_RECEPTION_ONLY'}],day,'web','0030'),/WAIT_TYPE_NOT_ALLOWED_FOR_DAY/);
});

test('network and invalid-response paths remain AMBIGUOUS and never release the user claim',()=>{
  assert.match(gatewaySource,/AIRWAIT_CREATE_NETWORK_AMBIGUOUS_MANUAL_REVIEW/);
  assert.match(gatewaySource,/AIRWAIT_CREATE_STORENO_NETWORK_AMBIGUOUS_MANUAL_REVIEW/);
  assert.match(gatewaySource,/AIRWAIT_CREATE_RESPONSE_AMBIGUOUS_MANUAL_REVIEW/);
  assert.match(gatewaySource,/AIRWAIT_CREATE_STORENO_RESPONSE_AMBIGUOUS_MANUAL_REVIEW/);
  assert.doesNotMatch(gatewaySource,/AIRWAIT_CREATE_INVALID_RESPONSE/);
  assert.doesNotMatch(gatewaySource,/AIRWAIT_CREATE_STORENO_INVALID_RESPONSE/);
});

test('request ownership cannot be rebound by client-side/localStorage tampering',async()=>{
  const env={DB:new MemoryD1()};
  assert.equal(await T.requestOwnedBy(env,'request_x',{user_hash:'owner-A'},'owner-B'),false);
  assert.equal(await T.requestOwnedBy(env,'request_x',{user_hash:'owner-A'},'owner-A'),true);
});

test('rate-limit policies are action-separated and create is the strictest write path',()=>{
  const p=T.rateLimits;
  for(const scope of ['create','cancelReservation','reservationStatus','businessDay','waitTypes','crowd','requestStatus']) assert.ok(p[scope],scope);
  assert.ok(p.create.user < p.requestStatus.user);
  assert.ok(p.create.ip < p.reservationStatus.ip);
  assert.notDeepEqual(p.create,p.cancelReservation);
  assert.notDeepEqual(p.waitTypes,p.crowd);
});

function scanProductionText(file,text){
  const violations=[];
  const rules=[
    ['develop-storage',/_develop_v1/],
    ['develop-channel',/2009884611/],
    ['develop-gateway',/asoboon-miniapp-v2-develop-gateway/],
    ['develop-vote-api',/AKfycbx2feW0JIP2aPmS2FX62D07etcaZE4Iq3FtqViLtpp0lsk0Z9aw3YuBQa94gtpH5Z3I/],
    ['develop-test-symbol',/DEVELOP_TEST_SLOT_ID/],
  ];
  for(const [name,re] of rules) if(re.test(text)) violations.push(file+':'+name);
  if(file.endsWith('production-gateway.js')&&/['"]0042['"]/.test(text)) violations.push(file+':develop-test-slot');
  return violations;
}

test('Production tree has no Developing identity/state and scanner proves its negative fixture',()=>{
  const prodDir=path.join(here,'..','miniapp-v2','production');
  const files=[];
  const walk=dir=>{for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,ent.name);if(ent.isDirectory())walk(p);else if(/\.(?:js|html|md)$/.test(ent.name))files.push(p);}};
  walk(prodDir);
  files.push(gatewayPath);
  const violations=files.flatMap(file=>scanProductionText(path.relative(path.join(here,'..'),file),fs.readFileSync(file,'utf8')));
  assert.deepEqual(violations,[]);
  assert.ok(scanProductionText('fixture.js',"const bad='2009884611';").length>0,'negative fixture must be detected');
});
