(()=>{
'use strict';

const C=window.ASOBOON_RECEPTION_CONFIG||{};
const API={
  waitType:'https://cl.airwait.jp/WCLP/api/20160600/external/stateless/wait/type/get',
  reservations:'https://cl.airwait.jp/WCLP/api/external/stateless/reservations',
  callVersioned:'https://cl.airwait.jp/WCLP/api/20160600/external/stateless/reserve/call',
  callPlain:'https://cl.airwait.jp/WCLP/api/external/stateless/reserve/call',
  lastUpdate:'https://cl.airwait.jp/WCLP/api/external/stateless/store/getLastUpdDateStateless'
};
const STORE_NO='AKR2298124918';
const TEST_WAIT_TYPE_ID='0042';
const TEST_NAME='テスト入場不可';
const AUTO_KEY='asoboon_auto_enabled_v16';
const STRATEGY_KEY='asoboon_airwait_call_strategy_v16';
const TARGET=Math.max(1,Number(C.autoCallingPool||10));
const GAP=Math.max(800,Number(C.autoCallGapMs||1200));
const FAST=Math.max(5000,Number(C.staffFastRefreshMs||10000));
const NORMAL=Math.max(FAST,Number(C.staffNormalRefreshMs||30000));
const $=id=>document.getElementById(id);
const S={
  auto:localStorage.getItem(AUTO_KEY)!=='0',
  slots:[],rows:new Map(),busy:false,timer:null,
  lastUpd:'',lastUpdRaw:null,strategy:readStrategy(),
  attempting:new Set(),lastError:'',lastFullRefresh:0
};

const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function log(msg){const el=$('log');if(el)el.textContent=`[${new Date().toLocaleTimeString('ja-JP')}] ${msg}\n`+el.textContent}
function success(d){return d?.success===true||String(d?.resultCode?.code??'')==='0000'}
function resultCode(d){return String(d?.resultCode?.code??'')}
function resultMessage(d){return String(d?.resultCode?.defaultMessage||d?.message||'')}
function isTrue(v){return v===true||v===1||v==='1'||String(v).toLowerCase()==='true'}
function receipt(v){return String(v??'').normalize('NFKC').replace(/\D/g,'').replace(/^0+(?=\d)/,'')}
function isTest(slot){return String(slot?.waitTypeId??'')===TEST_WAIT_TYPE_ID||String(slot?.waitTypeName??'').normalize('NFKC').trim()===TEST_NAME}
function readStrategy(){try{const x=JSON.parse(localStorage.getItem(STRATEGY_KEY)||'null');return x&&x.verified?x:null}catch{return null}}
function saveStrategy(x){S.strategy={...x,verified:true,verifiedAt:Date.now()};localStorage.setItem(STRATEGY_KEY,JSON.stringify(S.strategy));log(`✅ 呼出方式を確定: ${strategyLabel(S.strategy)}`)}
function strategyLabel(x){if(!x)return'未確定';const t=x.targetStyle==='reserveId'?`reserveId${x.path?' / '+x.path:''}`:x.targetStyle;return `${t} / ${x.endpoint}/${x.auth}`}

function jst(){return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(x=>[x.type,x.value]))}
function nowMin(){const p=jst();return Number(p.hour)*60+Number(p.minute)+Number(p.second)/60}
function parseHHMM(v){const m=String(v??'').normalize('NFKC').match(/^([01]?\d|2[0-3]):([0-5]\d)$/);return m?Number(m[1])*60+Number(m[2]):null}
function parseStart(slot){
  if(isTest(slot))return 8*60;
  const ov=C.slotStartOverrides?.[String(slot?.waitTypeId)];
  if(ov){const n=parseHHMM(ov);if(n!==null)return n}
  const s=String(slot?.waitTypeName??'').normalize('NFKC');
  let m=s.match(/(?:^|[^\d])([01]?\d|2[0-3])\s*[:：]\s*([0-5]\d)/);if(m)return Number(m[1])*60+Number(m[2]);
  m=s.match(/(?:^|[^\d])([01]?\d|2[0-3])\s*時\s*([0-5]?\d)\s*分/);if(m)return Number(m[1])*60+Number(m[2]);
  m=s.match(/(?:^|[^\d])([01]?\d|2[0-3])\s*時\s*半/);if(m)return Number(m[1])*60+30;
  m=s.match(/(?:^|[^\d])([01]?\d|2[0-3])\s*時/);return m?Number(m[1])*60:null;
}
function hhmm(n){if(n===null||!Number.isFinite(n))return'未判定';return`${String(Math.floor(n/60)).padStart(2,'0')}:${String(Math.floor(n%60)).padStart(2,'0')}`}
function activeWindow(slot){const n=nowMin(),start=parseStart(slot);return start!==null&&n>=start&&n<18*60}
function pollMs(){return nowMin()>=8*60&&nowMin()<18*60?FAST:NORMAL}
function stateLabel(slot){const start=parseStart(slot),n=nowMin();if(start===null)return['時刻未判定','stop'];if(n<start)return[`${hhmm(start)} 開始待ち`,'wait'];if(n>=18*60)return['18:00 終了','stop'];if(!S.auto)return['AUTO OFF','stop'];return['自動運転中','running']}

async function formRequest(url,params,{method='POST',keyQuery=true,keyBody=false,authHeader=false,timeout=8000}={}){
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),timeout);
  try{
    const key=String(C.airwaitApiKey||'');
    const body={...params};if(keyBody)body.key=key;
    const target=new URL(url);if(keyQuery)target.searchParams.set('key',key);
    const headers={};
    let requestBody;
    if(method==='POST'){
      headers['Content-Type']='application/x-www-form-urlencoded;charset=UTF-8';
      requestBody=new URLSearchParams(Object.fromEntries(Object.entries(body).filter(([,v])=>v!==undefined&&v!==null&&v!=='').map(([k,v])=>[k,String(v)])));
    }else Object.entries(body).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=='')target.searchParams.set(k,String(v))});
    if(authHeader)headers.corWclpKeyCd=key;
    const r=await fetch(target.toString(),{method,headers,body:requestBody,cache:'no-store',credentials:'omit',signal:ctrl.signal});
    const text=await r.text();let d;try{d=JSON.parse(text)}catch{throw new Error(`JSON以外の応答 HTTP ${r.status}`)}
    return{http:r.status,data:d};
  }finally{clearTimeout(timer)}
}

function flatten(obj,path='root',out=[],depth=0){
  if(depth>8||obj==null)return out;
  if(Array.isArray(obj)){obj.slice(0,30).forEach((v,i)=>flatten(v,`${path}[${i}]`,out,depth+1));return out}
  if(typeof obj==='object'){Object.entries(obj).forEach(([k,v])=>flatten(v,`${path}.${k}`,out,depth+1));return out}
  out.push({path,value:String(obj)});return out;
}
function reserveCandidate(row){
  const flat=flatten(row);
  const candidates=[];
  for(const item of flat){
    const p=item.path.toLowerCase(),v=item.value.trim();
    if(/^\d{12}$/.test(v)&&/(reserve|reservation)/.test(p)&&/(id|reserve|reservation)/.test(p)){
      let score=1;
      if(/\.reserveid$/.test(p)||/\.reservationid$/.test(p))score=100;
      else if(/reserve[_-]?id|reservation[_-]?id/.test(p))score=90;
      else if(/\.id$/.test(p)&&/(reserve|reservation)/.test(p))score=70;
      candidates.push({...item,value:v,score});
    }
    if(/^https?:\/\//i.test(v)&&/(shorturl|url)/.test(p)){
      try{
        const u=new URL(v);
        for(const [k,val] of u.searchParams){if(/^\d{12}$/.test(val)&&/(reserve|reservation|rid|id)/i.test(k))candidates.push({path:`${item.path}?${k}`,value:val,score:80})}
        const pieces=u.pathname.split('/').filter(Boolean);pieces.forEach((val,i)=>{if(/^\d{12}$/.test(val)&&/(reserve|reservation)/i.test(u.pathname))candidates.push({path:`${item.path}.path[${i}]`,value:val,score:50})});
      }catch{}
    }
  }
  candidates.sort((a,b)=>b.score-a.score);
  return candidates[0]||null;
}
function rawKeySummary(row){return flatten(row).map(x=>`${x.path.replace(/^root\./,'')}=${x.value}`).slice(0,60).join(' / ')}

async function loadTypes(){
  const {data:d}=await formRequest(API.waitType,{storeId:C.airwaitStoreId},{keyQuery:false,keyBody:true});
  if(!success(d))throw new Error(resultMessage(d)||`受付枠取得失敗 ${resultCode(d)}`);
  const raw=Array.isArray(d?.innerDto?.waitTypeList)?d.innerDto.waitTypeList:[];
  const test=raw.find(isTest);
  const list=test?raw:[{waitTypeId:TEST_WAIT_TYPE_ID,waitTypeName:TEST_NAME,dispFlg:true,__forcedTest:true},...raw];
  S.slots=list.filter(x=>{
    if(isTest(x))return true;
    if(!isTrue(x?.dispFlg))return false;
    const id=String(x?.waitTypeId??''),name=String(x?.waitTypeName??''),norm=name.normalize('NFKC');
    if(/WEB/i.test(norm))return false;
    if((C.blockedWaitTypeIds||[]).map(String).includes(id))return false;
    return !(C.blockedNamePatterns||[]).some(p=>name.includes(String(p)));
  }).sort((a,b)=>(parseStart(a)??9999)-(parseStart(b)??9999));
}
async function rowsFor(id){
  const out=[];let start=1,total=Infinity,guard=0;
  while(start<=total&&guard++<30){
    const {data:d}=await formRequest(API.reservations,{storeId:C.airwaitStoreId,waitTypeId:String(id),isEnabledStatus:'1',sortStatus:'0',isDesc:'0',start:String(start),limit:'100'},{keyQuery:true});
    if(!success(d))throw new Error(resultMessage(d)||`受付一覧取得失敗 ${resultCode(d)}`);
    const rows=Array.isArray(d?.innerDto?.reservations)?d.innerDto.reservations:[];out.push(...rows);total=Number(d?.innerDto?.count||rows.length);
    if(!rows.length||start+rows.length>total)break;start+=rows.length;
  }
  return out;
}
function activeRows(rows){return rows.filter(r=>['0','1','4'].includes(String(r?.status)))}
function waiting(rows){return activeRows(rows).filter(r=>String(r?.status)==='0'&&String(r?.isCalling)!=='1')}
function calling(rows){return activeRows(rows).filter(r=>String(r?.status)!=='1'&&String(r?.isCalling)==='1')}
function rowState(r){if(String(r?.status)==='1')return['保留中','hold'];if(String(r?.isCalling)==='1')return['呼出中','calling'];if(String(r?.status)==='4')return['対応中','serving'];return['待ち中','']}

function lastUpdateValue(d){
  const flat=flatten(d);const hit=flat.find(x=>/(last.*upd|upd.*date|last.*update|update.*date)/i.test(x.path));
  return hit?hit.value:'';
}
async function loadLastUpdate(){
  try{
    const {data:d}=await formRequest(API.lastUpdate,{storeNo:STORE_NO},{method:'GET',keyQuery:true,timeout:6000});
    if(!success(d))throw new Error(resultMessage(d)||resultCode(d));
    S.lastUpdRaw=d;const v=lastUpdateValue(d);if(v)S.lastUpd=v;
    if($('changeTop')){$('changeTop').textContent=v?'OK':'取得済';$('changeTop').className='ok'}
    return v;
  }catch(e){if($('changeTop')){$('changeTop').textContent='SKIP';$('changeTop').className='warn'};return''}
}

const transports=[
  {endpoint:'versioned',url:API.callVersioned,auth:'query'},
  {endpoint:'plain',url:API.callPlain,auth:'query'},
  {endpoint:'versioned',url:API.callVersioned,auth:'header'},
  {endpoint:'plain',url:API.callPlain,auth:'header'}
];
function targetBody(style,row,slot,candidate){
  const b={storeId:C.airwaitStoreId,callingMethodType:'00'};
  if(style==='reserveId')b.reserveId=candidate?.value||'';
  if(style==='number'){b.number=String(row?.number??'');b.waitTypeId=String(slot?.waitTypeId??'')}
  if(style==='receiptNo'){b.receiptNo=String(row?.number??'');b.waitTypeId=String(slot?.waitTypeId??'')}
  return b;
}
async function callAttempt(style,row,slot,transport,candidate){
  const body=targetBody(style,row,slot,candidate);
  const opts=transport.auth==='header'?{keyQuery:false,authHeader:true}:{keyQuery:true};
  try{
    const {http,data}=await formRequest(transport.url,body,{...opts,timeout:8000});
    return{ok:success(data),http,data,code:resultCode(data),message:resultMessage(data)};
  }catch(e){return{ok:false,http:0,data:null,code:'NETWORK',message:String(e?.message||e)}}
}
async function verifyCalling(slot,row,waitMs=900){
  const num=receipt(row?.number);for(const delay of [waitMs,900,1200]){await sleep(delay);const rows=await rowsFor(slot.waitTypeId);S.rows.set(String(slot.waitTypeId),rows);const hit=rows.find(x=>receipt(x?.number)===num);if(hit&&String(hit?.isCalling)==='1')return true}return false;
}
async function useStrategy(strategy,row,slot,candidate){
  const transport=transports.find(t=>t.endpoint===strategy.endpoint&&t.auth===strategy.auth);if(!transport)return false;
  const c=strategy.targetStyle==='reserveId'?(candidate||reserveCandidate(row)):null;
  if(strategy.targetStyle==='reserveId'&&!c)return false;
  log(`呼出送信 ${row.number}番｜${strategyLabel(strategy)}`);
  const r=await callAttempt(strategy.targetStyle,row,slot,transport,c);
  if(!r.ok){log(`呼出API NG ${row.number}番｜${r.code||r.http} ${r.message}`);return false}
  const reflected=await verifyCalling(slot,row);
  if(reflected){log(`✅ ${row.number}番 呼出中をAirWAITで確認`);return true}
  log(`⚠️ API成功応答後も ${row.number}番 の呼出中反映を確認できません`);return false;
}
async function discoverStrategy(row,slot){
  const candidate=reserveCandidate(row);
  const styles=[];if(candidate)styles.push({style:'reserveId',candidate,path:candidate.path});
  // reserveIdが一覧に無い場合も、AirWAIT自身が返す呼出番号を正規ターゲットとして検証する。
  styles.push({style:'number',candidate:null},{style:'receiptNo',candidate:null});
  for(const s of styles){
    for(const t of transports){
      log(`方式検証 ${row.number}番｜${s.style} / ${t.endpoint}/${t.auth}`);
      const r=await callAttempt(s.style,row,slot,t,s.candidate);
      if(!r.ok){log(`  ↳ ${r.code||r.http} ${r.message||'拒否'}`);continue}
      // 成功応答が出たら二重呼出防止のため、他方式は試さず反映確認に専念。
      const reflected=await verifyCalling(slot,row,700);
      if(reflected){const strategy={targetStyle:s.style,path:s.path||'',endpoint:t.endpoint,auth:t.auth};saveStrategy(strategy);return true}
      log(`⚠️ ${s.style} は成功応答だが呼出状態が未反映。安全のため方式探索を停止`);return false;
    }
  }
  log(`❌ ${row.number}番: AirWAITレスポンスだけでは呼出ターゲットを確定できません。行フィールド: ${rawKeySummary(row)}`);
  return false;
}
async function callOne(row,slot){
  const key=`${slot.waitTypeId}|${receipt(row?.number)}`;if(S.attempting.has(key))return false;S.attempting.add(key);
  try{
    const candidate=reserveCandidate(row);
    if(S.strategy){
      const ok=await useStrategy(S.strategy,row,slot,candidate);if(ok)return true;
      // 既存方式が使えなくなった場合、テスト枠だけで再探索して安全に自己修復。
      if(!isTest(slot)){log(`⚠️ 確定済み呼出方式が失敗。通常枠では再探索せず停止`);return false}
      localStorage.removeItem(STRATEGY_KEY);S.strategy=null;log('呼出方式を再探索します（テスト枠のみ）');
    }
    if(!isTest(slot)&&!candidate){log(`${slot.waitTypeName}: ${row.number}番 は呼出ターゲット未解決。テスト枠で方式確定待ち`);return false}
    return await discoverStrategy(row,slot);
  }finally{setTimeout(()=>S.attempting.delete(key),2500)}
}
async function fill(slot){
  if(!S.auto||!activeWindow(slot)||document.hidden||navigator.onLine===false)return;
  let loops=0;
  while(S.auto&&activeWindow(slot)&&loops++<TARGET){
    const rows=await rowsFor(slot.waitTypeId);S.rows.set(String(slot.waitTypeId),rows);
    const c=calling(rows).length;if(c>=TARGET)break;
    const first=waiting(rows)[0];if(!first)break;
    const ok=await callOne(first,slot);if(!ok)break;
    await sleep(GAP);
  }
}

function rowResolution(r){const c=reserveCandidate(r);if(c)return`AirWAIT内部ID（${c.path.replace(/^root\./,'')}）`;if(S.strategy?.targetStyle==='number')return'呼出番号 number';if(S.strategy?.targetStyle==='receiptNo')return'受付番号 receiptNo';return'方式探索待ち'}
function render(){
  const host=$('slots');host.innerHTML='';
  if(!S.slots.length){host.innerHTML='<div class="empty">表示できる受付枠がありません。</div>';return}
  for(const slot of S.slots){
    const id=String(slot.waitTypeId),rows=activeRows(S.rows.get(id)||[]),ws=waiting(rows),cs=calling(rows),[lab,cls]=stateLabel(slot),sec=document.createElement('section');
    sec.className='slot'+(isTest(slot)?' test':'');
    sec.innerHTML=`<div class="slothead"><div class="slottop"><div class="slotname">${isTest(slot)?'🧪 ':''}${esc(slot.waitTypeName||'名称なし')} <small>#${esc(id)}</small></div><span class="badge ${cls}">${esc(lab)}</span></div><div class="metrics"><div class="metric"><small>待ち中</small><strong>${ws.length}</strong></div><div class="metric"><small>呼出中</small><strong>${cs.length}/${TARGET}</strong></div><div class="metric"><small>有効受付</small><strong>${rows.length}</strong></div></div><div class="schedule">AUTO時間 <strong>${isTest(slot)?'08:00〜18:00':hhmm(parseStart(slot))+'〜18:00'}</strong></div></div><div class="rows"></div>`;
    const body=sec.querySelector('.rows');
    if(!rows.length)body.innerHTML='<div class="empty">現在の受付はありません。</div>';
    else for(const r of rows){const [st,cl]=rowState(r),el=document.createElement('div');el.className='row';el.innerHTML=`<div class="num">${esc(r?.number||'--')}番</div><div class="meta">呼出キー: ${esc(rowResolution(r))}</div><span class="state ${cl}">${st}</span>`;body.appendChild(el)}
    host.appendChild(sec);
  }
  if($('strategyTop')){$('strategyTop').textContent=S.strategy?strategyLabel(S.strategy):'探索中';$('strategyTop').className=S.strategy?'ok':'warn'}
}
function updateTop(){
  $('autoTop').textContent=S.auto?'ON':'OFF';$('autoTop').className=S.auto?'ok':'bad';
  $('pollTop').textContent=`${Math.round(pollMs()/1000)}秒`;$('pollTop').className=pollMs()===FAST?'warn':'';
  const n=$('modeNotice');n.className='notice '+(S.auto?'green':'');n.textContent=S.auto?'✓ AUTO ON｜GitHub PagesとAirWAIT APIだけで監視・呼出しています。':'AUTO OFF｜▶ AUTO ON で再開します。';
  if($('strategyTop')){$('strategyTop').textContent=S.strategy?strategyLabel(S.strategy):'探索中';$('strategyTop').className=S.strategy?'ok':'warn'}
}
function schedule(){if(S.timer)clearTimeout(S.timer);S.timer=setTimeout(()=>refresh(false),pollMs())}
async function refresh(manual=true){
  if(S.busy)return;S.busy=true;$('airTop').textContent='更新中';$('airTop').className='warn';
  try{
    await loadLastUpdate();await loadTypes();
    for(const slot of S.slots.filter(s=>activeWindow(s)||isTest(s)))S.rows.set(String(slot.waitTypeId),await rowsFor(slot.waitTypeId));
    $('airTop').textContent='OK';$('airTop').className='ok';$('updatedTop').textContent=new Date().toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'});S.lastFullRefresh=Date.now();render();
    if(S.auto){for(const slot of S.slots)if(activeWindow(slot)){try{await fill(slot)}catch(e){log(`❌ ${slot.waitTypeName}: ${e?.message||e}`)}render()}}
    if(manual)log(`更新完了 / 枠=${S.slots.length} / AUTO=${S.auto?'ON':'OFF'} / 呼出方式=${strategyLabel(S.strategy)}`);
  }catch(e){S.lastError=String(e?.message||e);$('airTop').textContent='NG';$('airTop').className='bad';log(`更新失敗: ${S.lastError}`)}
  finally{S.busy=false;updateTop();schedule()}
}

$('onBtn').onclick=()=>{S.auto=true;localStorage.setItem(AUTO_KEY,'1');log('AUTO ON');updateTop();refresh(true)};
$('offBtn').onclick=()=>{S.auto=false;localStorage.setItem(AUTO_KEY,'0');log('AUTO OFF');updateTop();render();schedule()};
$('refreshBtn').onclick=()=>refresh(true);
$('resetStrategyBtn').onclick=()=>{localStorage.removeItem(STRATEGY_KEY);S.strategy=null;log('呼出方式の学習をリセット');updateTop();refresh(true)};
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh(false)});
window.addEventListener('online',()=>refresh(false));
updateTop();refresh(true);
})();
