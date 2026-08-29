(()=>{
'use strict';
const C=window.ASOBOON_RECEPTION_CONFIG||{};
const API={
  waitType:'https://cl.airwait.jp/WCLP/api/20160600/external/stateless/wait/type/get',
  reservations:'https://cl.airwait.jp/WCLP/api/external/stateless/reservations',
  call:'https://cl.airwait.jp/WCLP/api/20160600/external/stateless/reserve/call'
};
const TEST_ID='9600',TEST_NAME='テスト入場不可',AUTO_KEY='asoboon_auto_enabled_v15';
const TARGET=Math.max(1,Number(C.autoCallingPool||10));
const GAP=Math.max(700,Number(C.autoCallGapMs||1200));
const FAST=Math.max(5000,Number(C.staffFastRefreshMs||10000));
const NORMAL=Math.max(FAST,Number(C.staffNormalRefreshMs||30000));
const $=id=>document.getElementById(id);
const S={auto:localStorage.getItem(AUTO_KEY)==='1',slots:[],rows:new Map(),busy:false,timer:null,testDiag:''};
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const log=m=>{const el=$('log');if(el)el.textContent=`[${new Date().toLocaleTimeString('ja-JP')}] ${m}\n`+el.textContent};
function success(d){return d?.success===true||String(d?.resultCode?.code??'')==='0000'}
function normId(v){return String(v??'').normalize('NFKC').trim().replace(/^0+(?=\d)/,'')}
function isTest(slot){return normId(slot?.waitTypeId)===TEST_ID||String(slot?.waitTypeName??'').normalize('NFKC').trim()===TEST_NAME}
function jst(){return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(x=>[x.type,x.value]))}
function nowMin(){const p=jst();return Number(p.hour)*60+Number(p.minute)+Number(p.second)/60}
function parseHHMM(v){const m=String(v??'').normalize('NFKC').match(/^([01]?\d|2[0-3]):([0-5]\d)$/);return m?Number(m[1])*60+Number(m[2]):null}
function parseStart(slot){
  if(isTest(slot))return 8*60;
  const ov=C.slotStartOverrides?.[String(slot?.waitTypeId)];if(ov){const n=parseHHMM(ov);if(n!==null)return n}
  const s=String(slot?.waitTypeName??'').normalize('NFKC');
  let m=s.match(/(?:^|[^\d])([01]?\d|2[0-3])\s*[:：]\s*([0-5]\d)/);if(m)return Number(m[1])*60+Number(m[2]);
  m=s.match(/(?:^|[^\d])([01]?\d|2[0-3])\s*時\s*([0-5]?\d)\s*分/);if(m)return Number(m[1])*60+Number(m[2]);
  m=s.match(/(?:^|[^\d])([01]?\d|2[0-3])\s*時\s*半/);if(m)return Number(m[1])*60+30;
  m=s.match(/(?:^|[^\d])([01]?\d|2[0-3])\s*時/);return m?Number(m[1])*60:null;
}
function hhmm(n){if(n===null||!Number.isFinite(n))return'未判定';return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(Math.floor(n%60)).padStart(2,'0')}`}
function activeWindow(slot){const n=nowMin(),start=parseStart(slot);return start!==null&&n>=start&&n<18*60}
function pollMs(){return nowMin()>=8*60&&nowMin()<18*60?FAST:NORMAL}
function stateLabel(slot){const start=parseStart(slot),n=nowMin();if(start===null)return['時刻未判定','stop'];if(n<start)return[`${hhmm(start)} 開始待ち`,'wait'];if(n>=18*60)return['18:00 終了','stop'];if(!S.auto)return['AUTO OFF','stop'];return['自動運転中','running']}
async function request(url,params,{keyQuery=false,keyBody=false}={}){
  const ctrl=new AbortController(),t=setTimeout(()=>ctrl.abort(),8000);
  try{
    const body={...params};if(keyBody)body.key=String(C.airwaitApiKey||'');
    const target=keyQuery?url+'?key='+encodeURIComponent(String(C.airwaitApiKey||'')):url;
    const r=await fetch(target,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:new URLSearchParams(Object.fromEntries(Object.entries(body).map(([k,v])=>[k,String(v??'')]))),cache:'no-store',credentials:'omit',signal:ctrl.signal});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.json();
  }finally{clearTimeout(t)}
}
async function loadTypes(){
  const d=await request(API.waitType,{storeId:C.airwaitStoreId},{keyBody:true});
  if(!success(d))throw new Error(d?.resultCode?.defaultMessage||'受付枠取得失敗');
  const raw=Array.isArray(d?.innerDto?.waitTypeList)?d.innerDto.waitTypeList:[];
  const returnedTest=raw.find(isTest)||null;
  const diag=returnedTest?`9600取得済み / dispFlg=${String(returnedTest?.dispFlg??'--')}`:'9600は待ち項目一覧に未返却 → 固定枠として直接監視';
  if(S.testDiag!==diag){S.testDiag=diag;log(`🧪 ${diag}`)}
  const list=returnedTest?raw:[{waitTypeId:TEST_ID,waitTypeName:TEST_NAME,dispFlg:'1',__forcedTest:true},...raw];
  S.slots=list.filter(x=>{
    if(isTest(x))return true;
    const disp=x?.dispFlg;if(!(disp===true||disp===1||disp==='1'||String(disp).toLowerCase()==='true'))return false;
    const id=String(x?.waitTypeId??''),name=String(x?.waitTypeName??''),norm=name.normalize('NFKC');
    if(/WEB/i.test(norm))return false;
    if((C.blockedWaitTypeIds||[]).map(String).includes(id))return false;
    return !(C.blockedNamePatterns||[]).some(p=>name.includes(String(p)));
  }).sort((a,b)=>(parseStart(a)??9999)-(parseStart(b)??9999));
}
async function rowsFor(id){
  const out=[];let start=1,total=Infinity,guard=0;
  while(start<=total&&guard++<30){
    const d=await request(API.reservations,{storeId:C.airwaitStoreId,waitTypeId:String(id),sortStatus:'0',isDesc:'0',start:String(start),limit:'100'},{keyQuery:true});
    if(!success(d))throw new Error(d?.resultCode?.defaultMessage||'受付一覧取得失敗');
    const rows=Array.isArray(d?.innerDto?.reservations)?d.innerDto.reservations:[];out.push(...rows);total=Number(d?.innerDto?.count||rows.length);
    if(!rows.length||start+rows.length>total)break;start+=rows.length;
  }
  return out;
}
function activeRows(rows){return rows.filter(r=>['0','1','4'].includes(String(r?.status)))}
function waiting(rows){return activeRows(rows).filter(r=>String(r?.status)==='0'&&String(r?.isCalling)!=='1')}
function calling(rows){return activeRows(rows).filter(r=>String(r?.status)!=='1'&&String(r?.isCalling)==='1')}
function rowState(r){if(String(r?.status)==='1')return['保留中','hold'];if(String(r?.isCalling)==='1')return['呼出中','calling'];if(String(r?.status)==='4')return['対応中','serving'];return['待ち中','']}
function reserveId(r){const v=String(r?.reserveId??'').normalize('NFKC').trim();return /^\d{1,12}$/.test(v)?v.padStart(12,'0'):v}
async function callOne(row,slot){
  const id=reserveId(row);if(!/^\d{12}$/.test(id))throw new Error(`${row?.number||'?'}番 reserveId取得不可`);
  const d=await request(API.call,{storeId:C.airwaitStoreId,reserveId:id,callingMethodType:'00',counterId:'001'},{keyQuery:true});
  if(!success(d))throw new Error(`呼出API ${String(d?.resultCode?.code??'?')}: ${String(d?.resultCode?.defaultMessage||'呼出失敗')}`);
  log(`AUTO ${slot?.waitTypeName||slot?.waitTypeId}: ${row?.number||'?'}番を通常呼出`);
}
async function fill(slot){
  if(!S.auto||!activeWindow(slot)||document.hidden||navigator.onLine===false)return;
  const id=String(slot.waitTypeId);let loops=0;
  while(S.auto&&activeWindow(slot)&&loops++<TARGET){
    const rows=await rowsFor(id);S.rows.set(id,rows);
    const c=calling(rows).length;if(c>=TARGET)break;
    const first=waiting(rows)[0];if(!first)break;
    const rid=reserveId(first);if(!/^\d{12}$/.test(rid)){log(`${slot.waitTypeName}: 先頭 ${first.number}番 reserveIdなしで停止`);break}
    await callOne(first,slot);await new Promise(r=>setTimeout(r,GAP));
  }
}
function render(){
  const host=$('slots');host.innerHTML='';
  if(!S.slots.length){host.innerHTML='<div class="empty">表示できる受付枠がありません。</div>';return}
  for(const slot of S.slots){
    const id=String(slot.waitTypeId),rows=activeRows(S.rows.get(id)||[]),ws=waiting(rows),cs=calling(rows),[lab,cls]=stateLabel(slot),sec=document.createElement('section');
    sec.className='slot'+(isTest(slot)?' test':'');
    sec.innerHTML=`<div class="slothead"><div class="slottop"><div class="slotname">${isTest(slot)?'🧪 ':''}${esc(slot.waitTypeName||'名称なし')} <small style="color:#8faab4">#${esc(id)}</small></div><span class="badge ${cls}">${esc(lab)}</span></div><div class="metrics"><div class="metric"><small>待ち中</small><strong>${ws.length}</strong></div><div class="metric"><small>呼出中</small><strong>${cs.length}/${TARGET}</strong></div><div class="metric"><small>有効受付</small><strong>${rows.length}</strong></div></div><div class="schedule">AUTO時間 <strong>${isTest(slot)?'08:00〜18:00':hhmm(parseStart(slot))+'〜18:00'}</strong></div></div><div class="rows"></div>`;
    const body=sec.querySelector('.rows');
    if(!rows.length)body.innerHTML='<div class="empty">現在の受付はありません。</div>';
    else for(const r of rows){const [st,cl]=rowState(r),el=document.createElement('div');el.className='row';el.innerHTML=`<div class="num">${esc(r?.number||'--')}番</div><div class="meta">reserveId: ${reserveId(r)?esc(reserveId(r)):'なし'}</div><span class="state ${cl}">${st}</span>`;body.appendChild(el)}
    host.appendChild(sec);
  }
}
function updateTop(){
  $('autoTop').textContent=S.auto?'ON':'OFF';$('autoTop').className=S.auto?'ok':'bad';
  $('pollTop').textContent=`${Math.round(pollMs()/1000)}秒`;$('pollTop').className=pollMs()===FAST?'warn':'';
  const n=$('modeNotice');n.className='notice '+(S.auto?'green':'');n.textContent=S.auto?'✓ AUTO ON｜AirWAITを直接監視しています。ページを閉じると停止します。':'AUTO OFF｜▶ AUTO ON を押すと自動呼出を開始します。';
}
function schedule(){if(S.timer)clearTimeout(S.timer);S.timer=setTimeout(()=>refresh(false),pollMs())}
async function refresh(manual=true){
  if(S.busy)return;S.busy=true;$('airTop').textContent='更新中';$('airTop').className='warn';
  try{
    await loadTypes();
    const relevant=S.slots.filter(s=>activeWindow(s)||isTest(s));
    for(const slot of relevant)S.rows.set(String(slot.waitTypeId),await rowsFor(slot.waitTypeId));
    $('airTop').textContent='OK';$('airTop').className='ok';$('updatedTop').textContent=new Date().toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'});render();
    if(S.auto){for(const slot of S.slots)if(activeWindow(slot)){await fill(slot);render()}}
    if(manual)log(`更新完了 / 枠=${S.slots.length} / AUTO=${S.auto?'ON':'OFF'}`);
  }catch(e){$('airTop').textContent='NG';$('airTop').className='bad';log(`更新失敗: ${e?.message||e}`)}
  finally{S.busy=false;updateTop();schedule()}
}
$('onBtn').onclick=()=>{S.auto=true;localStorage.setItem(AUTO_KEY,'1');log('AUTO ON');updateTop();refresh(true)};
$('offBtn').onclick=()=>{S.auto=false;localStorage.setItem(AUTO_KEY,'0');log('AUTO OFF');updateTop();render();schedule()};
$('refreshBtn').onclick=()=>refresh(true);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh(false)});window.addEventListener('online',()=>refresh(false));
updateTop();refresh(true);
})();
