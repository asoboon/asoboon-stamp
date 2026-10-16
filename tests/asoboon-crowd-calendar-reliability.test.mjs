import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(p,'utf8');
const NOW=Date.parse('2026-10-16T04:33:00Z');
function browser(){
 let now=NOW;const storage=new Map(),events={},nodes=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',classList:{toggle(){},remove(){},add(){}},addEventListener(type,fn){this[type]=fn},append(){}});return nodes.get(id)};
 const window={addEventListener(type,fn){events[type]=fn}};
 const document={hidden:false,getElementById:node,addEventListener(type,fn){events[type]=fn},createElement:()=>node('created'),body:{classList:{remove(){},add(){}}}};
 class Clock extends Date{constructor(...args){super(...(args.length?args:[now]))}static now(){return now}}
 const context={window,document,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},Date:Clock,Intl,URL,URLSearchParams,AbortController,location:{search:'',href:'https://example.test/'},setTimeout:()=>1,clearTimeout(){},setInterval:fn=>{events.interval=fn},fetch:async()=>{throw Error('offline')}};
 return{context,node,events,storage,time(value){now=value}};
}
const onsite=[{detailedWaitType:'すぐ入場受付【平日】',reserveUnit:'PERSON',remaining:264,remainingVerified:true},{detailedWaitType:'14時から【平日】',reserveUnit:'PERSON',remaining:50,remainingVerified:true},{detailedWaitType:'《ご待機者専用》',reserveUnit:'GROUP',remaining:7}];
const slots=[{waitTypeId:'0024',waitTypeName:'10時ご入場枠【WEB平日】',detailedWaitType:onsite[0].detailedWaitType,slotKey:'10:00',matchMode:'alias-name',evidence:'PERSON',reserveUnit:'PERSON',remaining:264},{waitTypeId:'0027',waitTypeName:'14時ご入場枠【WEB平日】',detailedWaitType:onsite[1].detailedWaitType,slotKey:'14:00',matchMode:'time-key',evidence:'PERSON',reserveUnit:'PERSON',remaining:50}];
function home(){
 const b=browser();b.context.window.ASOBOON_V2_ENV={backendUrl:'https://example.test/api'};
 b.node('app').querySelector=selector=>selector==='#v38Slots'?b.node('slots'):null;
 let code=read('miniapp-v2/production/home-v38.js');
 code=code.slice(0,code.indexOf("root.addEventListener('click'"))+`window.test={fetchCrowd,renderSlots,validCrowdSlots,verifiedWebRemaining,onsiteRemaining,readCrowdCache,restoreFreshCrowdForDay,reset(){crowdSlots=null;crowdAt=0;crowdRetryAt=0},setDay(value){day=value},state(){return {crowdAt,crowdStale}}};})();`;
 runInNewContext(code,b.context);b.api=b.context.window.test;b.api.setDay({ok:true,operationalDate:'2026-10-16',businessType:'平日'});
 b.respond=data=>{b.context.fetch=async()=>({ok:true,json:async()=>data})};
 return b;
}
const payload=(extra={})=>({ok:true,slots,observedDetails:onsite,fetchedAt:new Date(NOW).toISOString(),...extra});
test('live weekday fixture displays onsite 264 / 50, unknown WEB, 14:00 reception link, no occupancy percentage',async()=>{
 const b=home();b.respond(payload());await b.api.fetchCrowd(true);
 assert.deepEqual(JSON.parse(JSON.stringify(b.api.validCrowdSlots())).map(x=>[x.id,x.web,x.onsite]),[['0024',null,264],['0027',null,50]]);
 const cache=JSON.parse(b.storage.get('asoboon_v2_crowd_snapshot_production_v1'));
 assert.equal(cache.verifiedFresh,true);assert.equal(cache.savedAt,NOW);assert.equal(cache.schema,2);
 const html=b.node('slots').innerHTML;
 for(const text of ['現地／LINE受付','264<small>名','50<small>名','data-v7-slot="14:00"','13:33','data-stale="false"'])assert.ok(html.includes(text),text);
 assert.doesNotMatch(html,/%|progressbar|かなり混雑/);
 for(const matchMode of ['alias-name','time-key'])assert.equal(b.api.verifiedWebRemaining({...slots[0],matchMode}),null);
 const exact={...slots[0],matchMode:'exact-name',detailedWaitType:slots[0].waitTypeName,remaining:0};
 assert.equal(b.api.verifiedWebRemaining(exact),0);
 for(const remaining of [null,undefined,'',false,-1,1.2])assert.equal(b.api.verifiedWebRemaining({...exact,remaining}),null);
 assert.equal(b.api.verifiedWebRemaining({...exact,reserveUnit:'GROUP'}),null);
});
test('duplicate/non-PERSON onsite rows and unverified zero stay unknown',async()=>{
 for(const rows of [[onsite[0],onsite[0]],[{...onsite[0],reserveUnit:'GROUP'}],[{...onsite[0],remaining:0,remainingVerified:false}]]){
  const b=home();b.respond(payload({observedDetails:rows}));await b.api.fetchCrowd(true);assert.equal(b.api.onsiteRemaining('0024'),null);
 }
});
test('offline last-good retains original time and counts with explicit stale flag, never extends storage time',async()=>{
 const b=home();b.respond(payload());await b.api.fetchCrowd(true);b.time(NOW+40000);
 b.context.fetch=async()=>{throw Error('offline')};await b.api.fetchCrowd(true);
 assert.equal(b.api.state().crowdAt,NOW);assert.equal(b.api.state().crowdStale,true);
 assert.match(b.node('slots').innerHTML,/13:33 確認時点.*過去の情報/);assert.match(b.node('slots').innerHTML,/264<small>名/);assert.match(b.node('slots').innerHTML,/data-stale="true"/);
 b.api.reset();assert.equal(b.api.restoreFreshCrowdForDay(),true);assert.equal(b.api.state().crowdAt,NOW);assert.equal(b.api.state().crowdStale,true);
 b.time(NOW+31*60000);assert.equal(b.api.readCrowdCache(),null);assert.equal(b.api.validCrowdSlots()[0].onsite,null);
});
test('stale server result retains fetchedAt; missing, future, previous-date timestamps cannot become live',async()=>{
 const b=home();b.time(NOW+120000);b.respond(payload({stale:true}));await b.api.fetchCrowd(true);
 assert.equal(b.api.state().crowdAt,NOW);assert.equal(b.api.validCrowdSlots()[0].onsite,264);assert.equal(b.api.state().crowdStale,true);
 for(const fetchedAt of [undefined,'invalid',new Date(NOW+60000).toISOString(),'2026-10-15T04:33:00Z']){
  const x=home();x.respond(payload({fetchedAt}));await x.api.fetchCrowd(true);assert.equal(x.api.state().crowdAt,0);assert.equal(x.api.validCrowdSlots()[0].onsite,null);
 }
 b.api.setDay({operationalDate:'2026-10-17',businessType:'土日祝日'});assert.equal(b.api.readCrowdCache(),null);
});
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('calendar shares fresh month, refreshes on focus after 5 minutes, visibly updates and marks offline data stale',async()=>{
 const b=browser();let calls=0,closed=false,offline=false,sourceAt=NOW;
 b.context.window.ASOBOON_V2_BUSINESS_DAY={async getMonth(){calls++;if(offline)throw Error('offline');return{days:Array.from({length:16},(_,i)=>({ok:true,operationalDate:`2026-10-${16+i}`,businessType:closed?'休館':'平日',isClosed:closed,closingTime:'17:00',fetchedAt:sourceAt}))}}};
 runInNewContext(read('miniapp-v2/production/business-calendar.js'),b.context);await settle();
 assert.equal(calls,1);assert.match(b.node('bcDetail').innerHTML,/10:00〜17:00/);
 b.time(NOW+60000);b.events.focus();await settle();assert.equal(calls,1);
 closed=true;sourceAt=NOW+300001;b.time(sourceAt);b.events.focus();await settle();assert.equal(calls,2);assert.match(b.node('bcDetail').innerHTML,/休館日です/);
 offline=true;b.time(sourceAt+300001);b.events.focus();await settle();assert.equal(calls,3);assert.match(b.node('bcStatus').textContent,/過去の情報/);assert.match(b.node('bcDetail').innerHTML,/最新未確認/);
 const cached=JSON.parse([...b.storage.values()][0]);assert.equal(cached['2026-10'].days['2026-10-16'].day.fetchedAt,sourceAt);
});
test('calendar in-flight duplicate does not invalidate successful rendering',async()=>{
 const b=browser();let finish,calls=0;
 b.context.window.ASOBOON_V2_BUSINESS_DAY={getMonth(){calls++;return new Promise(r=>finish=r)}};
 runInNewContext(read('miniapp-v2/production/business-calendar.js'),b.context);b.events.focus();
 finish({days:[{ok:true,operationalDate:'2026-10-16',businessType:'休館',isClosed:true,fetchedAt:NOW}]});await settle();
 assert.equal(calls,1);assert.match(b.node('bcDetail').innerHTML,/休館日です/);
});
test('failed month batch never fans out into individual date requests',async()=>{
 const b=browser();let individual=0,batch=0;
 b.context.window.ASOBOON_V2_ENV={backendUrl:'https://example.test/api'};
 b.context.window.ASOBOON_V2_BUSINESS_DAY={getByDate(){individual++;throw Error('unexpected')},rules:{},normalizeDate:v=>v};
 b.context.fetch=async()=>{batch++;return{ok:false,json:async()=>({ok:false})}};
 runInNewContext(read('miniapp-v2/production/business-day-cutoff-v26.js'),b.context);
 await assert.rejects(b.context.window.ASOBOON_V2_BUSINESS_DAY.getMonth('2026-10',{fromDate:'2026-10-16'}));
 assert.equal(batch,1);assert.equal(individual,0);
});
test('calendar reload uses original source time; an already four-minute-old server cache expires after one minute',async()=>{
 const b=browser();let calls=0;
 const service={async getMonth(){calls++;return {days:Array.from({length:16},(_,i)=>({ok:true,operationalDate:`2026-10-${16+i}`,businessType:'平日',isClosed:false,fetchedAt:NOW-240000}))}}};
 b.context.window.ASOBOON_V2_BUSINESS_DAY=service;
 runInNewContext(read('miniapp-v2/production/business-calendar.js'),b.context);await settle();assert.equal(calls,1);
 const reopened=browser();for(const [key,value] of b.storage)reopened.storage.set(key,value);
 reopened.context.window.ASOBOON_V2_BUSINESS_DAY=service;
 runInNewContext(read('miniapp-v2/production/business-calendar.js'),reopened.context);await settle();assert.equal(calls,1);
 reopened.time(NOW+60001);reopened.events.focus();await settle();assert.equal(calls,2);
 assert.match(reopened.node('bcStatus').textContent,/過去の情報/);
});
test('after 19:00 JST the next operational date never shows tomorrow as today or fetches crowd',async()=>{
 const b=home();let calls=0;
 b.time(Date.parse('2026-10-16T10:03:00Z')); // 19:03 JST, 2026-10-17 is operational date
 b.api.setDay({ok:true,operationalDate:'2026-10-17',businessType:'土日祝日'});
 b.context.fetch=async()=>{calls++;throw Error('should not fetch next-day crowd')};
 b.api.renderSlots();
 assert.match(b.node('slots').innerHTML,/本日の営業は終了しました/);
 await b.api.fetchCrowd(true);
 assert.equal(calls,0);
 assert.doesNotMatch(b.node('slots').innerHTML,/264<small>名/);
});
test('same-month midnight rollover starts fresh load and ignores stale in-flight result',async()=>{
 const b=browser(),resolvers=[],froms=[];
 b.context.window.ASOBOON_V2_BUSINESS_DAY={getMonth(_month,opts){froms.push(opts.fromDate);return new Promise(resolve=>resolvers.push(resolve))}};
 runInNewContext(read('miniapp-v2/production/business-calendar.js'),b.context);
 assert.deepEqual(froms,['2026-10-16']);
 b.time(Date.parse('2026-10-16T15:00:01Z')); // 2026-10-17 00:00 JST
 b.events.visibilitychange();
 assert.deepEqual(froms,['2026-10-16','2026-10-17']);
 resolvers[0]({days:[{ok:true,operationalDate:'2026-10-16',businessType:'休館',isClosed:true,fetchedAt:NOW}]});
 await settle();
 assert.doesNotMatch(b.node('bcDetail').innerHTML,/10月16日/);
 resolvers[1]({days:[{ok:true,operationalDate:'2026-10-17',businessType:'平日',isClosed:false,fetchedAt:Date.parse('2026-10-16T15:00:01Z')}]});
 await settle();
 assert.match(b.node('bcDetail').innerHTML,/10月17日/);
 assert.doesNotMatch(b.node('bcDetail').innerHTML,/休館日です/);
});
