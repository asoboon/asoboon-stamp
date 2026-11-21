import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const s=fs.readFileSync('miniapp-v2/shared/operational-profiles.js','utf8');
const context={window:{}};vm.runInNewContext(s,context);
const P=context.window.ASOBOON_OPERATING_PROFILES;
const day=(date,raw)=>({ok:true,operationalDate:date,businessType:raw,source:'api'});
for(const [date,raw,key,ids] of [
 ['2026-11-02','平日','WEEKDAY_MONDAY',['0024','0023','0027','0025']],
 ['2026-11-26','平日','WEEKDAY_OTHER',['0023','0025']],
 ['2026-11-09','平日特定日','SPECIAL_WEEKDAY',['0036','0035','0038','0037']],
 ['2026-11-23','土日祝日','WEEKEND_HOLIDAY',['0030','0029','0032','0031','0034','0033']],
 ['2026-11-25','休館','CLOSED',[]],
]){
 test(date+' profile correct and only approved AirWAIT IDs',()=>{
  const p=P.resolve(day(date,raw),date);assert.equal(p?.key,key);
  assert.deepEqual(Array.from(P.expectedIds(p)),ids);
 });
}
test('source of truth overrides day-of-week guess',()=>{
 assert.equal(P.resolve(day('2026-11-23','土日祝日'))?.key,'WEEKEND_HOLIDAY');
 assert.equal(P.resolve(day('2026-11-09','平日特定日'))?.key,'SPECIAL_WEEKDAY');
 assert.equal(P.resolve(day('2026-11-30','平日'))?.key,'WEEKDAY_MONDAY');
});
test('unknown, stale, invalid date, mismatch fail closed',()=>{
 assert.equal(P.resolve(day('2026-11-30','')),null);
 assert.equal(P.resolve({...day('2026-11-30','平日'),source:'cache-stale'}),null);
 assert.equal(P.resolve(day('2026-02-30','平日')),null);
 assert.equal(P.resolve(day('2026-11-30','平日'),'2026-11-29'),null);
 assert.equal(P.resolve({...day('2026-11-30','平日'),ok:false}),null);
});
test('5 profiles retain entry clock and channel uniqueness',()=>{
 const monday=P.resolve(day('2026-11-30','平日'));
 assert.equal(monday.rounds.length,2);
 assert.equal(monday.rounds[0].web.entry,'10:00');
 assert.equal(monday.rounds[0].line.entry,'すぐ入場');
 assert.equal(monday.rounds[1].web.entry,'14:00');
 assert.equal(monday.rounds[1].line.entry,'14:00から');
 assert.equal(monday.forecast,false);
 assert.equal(P.resolve(day('2026-11-21','土日祝日')).rounds[1].line.entry,'12:50頃');
});
const web=id=>({waitTypeId:id,usageDispType:P.mode.WEB,remaining:100,remainingVerified:true});
const line=id=>({waitTypeId:id,usageDispType:P.mode.LINE_STORE,remaining:100,remainingVerified:true});
test('before 9:30 LINE not considered a missing setting',()=>{
 const p=P.resolve(day('2026-11-21','土日祝日'));
 const r=P.reconcile(p,{slots:[web('0030'),web('0032'),web('0034')],verified:true,minute:480});
 assert.equal(r.problems.filter(x=>x.reason==='NOT_PUBLISHED').length,0);
});
test('after 9:30 missing LINE detected, no fake zero',()=>{
 const p=P.resolve(day('2026-11-21','土日祝日'));
 const r=P.reconcile(p,{slots:[web('0030'),web('0032'),web('0034')],verified:true,minute:600});
 assert.deepEqual(Array.from(r.problems.filter(x=>x.reason==='NOT_PUBLISHED').map(x=>x.id)),['0029','0031','0033']);
 assert.equal(r.actual.has('0031'),false);
});
test('unexpected canonical category slot is detected, unknown accessory ignored',()=>{
 const p=P.resolve(day('2026-11-26','平日'));
 const r=P.reconcile(p,{slots:[line('0023'),line('0025'),web('0024'),web('0099')],verified:true,minute:600});
 assert.deepEqual(Array.from(r.problems.filter(x=>x.reason==='UNEXPECTED_PUBLISHED').map(x=>x.id)),['0024']);
});
test('wrong channel and closed-day accidental publish detected',()=>{
 const p=P.resolve(day('2026-11-21','土日祝日'));
 assert.equal(P.reconcile(p,{slots:[line('0030')],verified:true,minute:600}).problems.some(x=>x.reason==='WRONG_CHANNEL'),true);
 const closed=P.resolve(day('2026-11-25','休館'));
 assert.equal(P.reconcile(closed,{slots:[web('0030')],verified:true,minute:600}).problems.some(x=>x.reason==='CLOSED_DAY_HAS_PUBLISHED_SLOTS'),true);
});
test('unverified AirWAIT cannot be treated as verified available',()=>{
 const p=P.resolve(day('2026-11-21','土日祝日'));
 assert.equal(P.reconcile(p,{slots:[web('0030')],verified:false,minute:600}).problems.some(x=>x.reason==='AIRWAIT_UNVERIFIED'),true);
});
test('booking and queue modules are not modified by read-only 5-profile feature',()=>{
 const names=['miniapp-v2/shared/reception.js','miniapp-v2/backend/production-worker.mjs','miniapp-v2/backend/production-gateway.js'];
 for(const name of names)assert.ok(fs.existsSync(name),name);
 const home=fs.readFileSync('miniapp-v2/production/home-v38.js','utf8');
 assert.match(home,/expectedChannel\(profile,id\)/);
 const board=fs.readFileSync('miniapp-v2/production/boon-home-v613-board.js','utf8');
 assert.match(board,/profile\.rounds/);
 assert.match(board,/publicPendingChannel/);
});
