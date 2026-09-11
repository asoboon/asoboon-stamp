/* ASOBooN LINE MINI App v2 / Developing same-app call status */
(()=>{'use strict';
const E=window.ASOBOON_V2_ENV||{};
const CACHE_KEY='asoboon_v2_current_reservation_develop_v1';
const CALL_KEY='asoboon_v2_callstatus_develop_v1';
const SESSION_KEY='asoboon_v2_callstatus_session_develop_v1';
const POLL_MS=10000;
let pollTimer=0,autoNavTimer=0,autoNavReceipt='',generation=0;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

function readJSON(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
function writeJSON(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}}
function removeKey(key){try{localStorage.removeItem(key)}catch{}}
function currentView(){return new URLSearchParams(location.search).get('view')||'home'}
function backendReady(){return Boolean(E.backendUrl&&/^https:\/\//.test(String(E.backendUrl)))}
function sameAppUrl(view){const u=new URL(E.endpoint||location.href,location.href),q=new URLSearchParams(location.search);u.search='';u.hash='';u.searchParams.set('view',view);u.searchParams.set('mode',q.get('mode')==='inside'?'inside':'before');return u.href}
function goSameApp(view,{replace=true}={}){const url=sameAppUrl(view);if(replace)history.replaceState({asoboonV2:true},'',url);else history.pushState({asoboonV2:true},'',url);window.dispatchEvent(new PopStateEvent('popstate'))}
function stopPolling(){generation+=1;if(pollTimer){clearTimeout(pollTimer);pollTimer=0}}
function fmtClock(ms){try{return new Intl.DateTimeFormat('ja-JP',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(Number(ms||Date.now())))}catch{return'--:--'}}

function maybeAutoRouteAfterReception(){
  if(currentView()!=='reception')return;
  const box=document.getElementById('recResult');
  const result=box?.querySelector?.('.rec-result');
  if(!box||box.hidden||!result||!/受付が完了しました/.test(String(result.textContent||'')))return;
  const rec=readJSON(CACHE_KEY);
  const receipt=String(rec?.receiptNo||'');
  if(!receipt||autoNavReceipt===receipt||autoNavTimer)return;
  autoNavReceipt=receipt;
  autoNavTimer=setTimeout(()=>{
    autoNavTimer=0;
    if(currentView()==='reception')goSameApp('callstatus',{replace:true});
  },850);
}

function pageHtml(){return `<section class="page-card cs-page"><div class="page-head green"><small>CALL STATUS / NEW HOME</small><h2>呼出状況</h2></div><div class="page-body cs-body">
<div id="csTop" class="cs-top"><span class="cs-live-dot"></span><strong>受付情報を確認しています</strong><small>AirWAITの最新状況を自動で確認します。</small></div>
<div class="cs-ticket"><small>あなたの受付番号</small><strong id="csReceipt">—</strong><span>番</span><div id="csWaitType" class="cs-waittype">受付枠を確認中</div></div>
<div id="csState" class="cs-state loading"><div class="cs-state-icon">⏳</div><strong id="csTitle">状況を確認中</strong><p id="csMessage">LINE本人確認と受付情報を安全に照合しています。</p></div>
<div id="csQueue" class="cs-queue" hidden><div><small>あなたの前</small><strong id="csAhead">—</strong><span>組</span></div><div><small>現在の位置</small><strong id="csRank">—</strong><span id="csTotal">組中</span></div></div>
<div class="cs-meta"><span>最終確認</span><strong id="csChecked">—</strong></div>
<button id="csRefresh" class="cs-refresh" type="button">↻ 今すぐ更新</button>
<div id="csError" class="cs-error" hidden></div>
<div class="cs-note"><strong>自動更新：</strong>約10秒ごとに確認します。画面を閉じても、同じLINEアカウントで再度開けば本日の受付を復元できます。</div>
</div></section>`}

function stateMeta(state,ahead){
  switch(String(state||'')){
    case'waiting':return{cls:'waiting',icon:'🕒',title:'順番をお待ちください',msg:Number.isFinite(ahead)?`現在、あなたの前に${ahead}組お待ちです。`:'現在、順番をお待ちいただいています。'};
    case'calling':return{cls:'calling',icon:'🎉',title:'入場できます',msg:'受付でこの受付番号をスタッフにお見せください。'};
    case'hold':return{cls:'hold',icon:'⏸️',title:'保留中です',msg:'スタッフの案内をご確認ください。'};
    case'processing':return{cls:'processing',icon:'✅',title:'受付対応中です',msg:'スタッフが受付対応を進めています。'};
    case'done':return{cls:'done',icon:'🏁',title:'ご案内済みです',msg:'この受付はご案内済みになっています。'};
    case'canceled':return{cls:'canceled',icon:'✕',title:'受付は取消になっています',msg:'受付状況についてスタッフへご確認ください。'};
    default:return{cls:'loading',icon:'🔄',title:'状況を確認しています',msg:'AirWAITの最新情報を取得しています。'};
  }
}

function setError(text){const el=$('csError');if(!el)return;if(!text){el.hidden=true;el.textContent='';return}el.hidden=false;el.textContent=String(text)}
function setBusy(busy){const b=$('csRefresh');if(b){b.disabled=busy;b.textContent=busy?'確認中…':'↻ 今すぐ更新'}}
function applyStatus(d){
  if(!d)return;
  const receipt=String(d.receiptNo||readJSON(CACHE_KEY)?.receiptNo||readJSON(CALL_KEY)?.receiptNo||'—');
  if($('csReceipt'))$('csReceipt').textContent=receipt;
  if($('csWaitType'))$('csWaitType').textContent=String(d.waitTypeName||readJSON(CACHE_KEY)?.waitTypeLabel||'受付枠');
  if(!d.found){
    const m=stateMeta('unknown');
    const box=$('csState');if(box)box.className='cs-state '+m.cls;
    if($('csTitle'))$('csTitle').textContent='AirWAITで受付情報を確認中';
    if($('csMessage'))$('csMessage').textContent='受付は保存されています。反映に少し時間がかかる場合があります。';
    if($('csQueue'))$('csQueue').hidden=true;
    if($('csChecked'))$('csChecked').textContent=fmtClock(d.checkedAt);
    return;
  }
  const ahead=Number.isFinite(Number(d.aheadCount))?Number(d.aheadCount):null;
  const m=stateMeta(d.state,ahead),box=$('csState');
  if(box)box.className='cs-state '+m.cls;
  const icon=box?.querySelector?.('.cs-state-icon');if(icon)icon.textContent=m.icon;
  if($('csTitle'))$('csTitle').textContent=m.title;
  if($('csMessage'))$('csMessage').textContent=m.msg;
  const showQueue=d.state==='waiting'||d.state==='calling';
  if($('csQueue'))$('csQueue').hidden=!showQueue;
  if(showQueue){if($('csAhead'))$('csAhead').textContent=ahead??'—';if($('csRank'))$('csRank').textContent=d.queueRank??'—';if($('csTotal'))$('csTotal').textContent=` / ${d.activeCount??'—'}組中`}
  if($('csChecked'))$('csChecked').textContent=fmtClock(d.checkedAt);
  const top=$('csTop');if(top){top.className='cs-top ok';top.querySelector('strong').textContent='AirWAITと接続中';top.querySelector('small').textContent='最新状況を約10秒ごとに自動更新しています。'}
}

async function gatewayPost(action,body={}){
  if(!backendReady())throw Error('呼出状況Gatewayが設定されていません。');
  const payload={action,...body};
  const r=await fetch(E.backendUrl,{method:'POST',mode:'cors',credentials:'omit',cache:'no-store',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8',Accept:'application/json'},body:new URLSearchParams(Object.entries(payload).map(([k,v])=>[k,String(v??'')]))});
  let d=null;try{d=await r.json()}catch{}
  if(!r.ok)throw Error(String(d?.error||`Gateway HTTP ${r.status}`));
  return d||{};
}

async function waitForLine(){
  if(window.liff&&liff.isInClient?.()&&liff.isLoggedIn?.())return;
  await Promise.race([new Promise(resolve=>window.addEventListener('asoboon:v2-liff-ready',resolve,{once:true})),sleep(7000)]);
  if(!window.liff||!liff.isInClient?.()||!liff.isLoggedIn?.())throw Error('LINEミニアプリ内で開き直してください。');
}

async function recoverSession(){
  await waitForLine();
  const token=String(liff.getAccessToken?.()||'');
  if(token.length<20)throw Error('LINE本人確認情報を取得できません。');
  const cached=readJSON(CACHE_KEY)||readJSON(CALL_KEY)||{};
  const d=await gatewayPost('recoverReservationSession',{liffAccessToken:token,businessDate:String(cached.businessDate||'')});
  if(!d?.ok)throw Error('受付情報の復元に失敗しました。');
  if(!d.found)return null;
  const session={sessionToken:String(d.sessionToken||''),businessDate:String(d.businessDate||''),receiptNo:String(d.receiptNo||''),waitTypeId:String(d.waitTypeId||''),expiresAt:Number(d.expiresAt||0),cachedAt:Date.now()};
  if(session.sessionToken.length<32)throw Error('呼出状況セッションを作成できませんでした。');
  writeJSON(SESSION_KEY,session);
  writeJSON(CALL_KEY,{businessDate:session.businessDate,receiptNo:session.receiptNo,cachedAt:Date.now()});
  return session;
}

async function ensureSession(){
  const s=readJSON(SESSION_KEY);
  if(s?.sessionToken&&Number(s.expiresAt||0)>Date.now()+30000)return s;
  removeKey(SESSION_KEY);
  return await recoverSession();
}

async function refreshStatus({manual=false}={}){
  const gen=generation;
  if(currentView()!=='callstatus')return;
  if(manual)setBusy(true);
  setError('');
  try{
    let session=await ensureSession();
    if(gen!==generation||currentView()!=='callstatus')return;
    if(!session){
      const cached=readJSON(CACHE_KEY)||readJSON(CALL_KEY)||{};
      if($('csReceipt'))$('csReceipt').textContent=String(cached.receiptNo||'—');
      if($('csTitle'))$('csTitle').textContent='本日の受付が見つかりません';
      if($('csMessage'))$('csMessage').textContent='当日受付を完了すると、ここに自動で呼出状況が表示されます。';
      setError('受付済みなのに表示されない場合は、受付番号をスタッフへお伝えください。');
      return;
    }
    if($('csReceipt'))$('csReceipt').textContent=String(session.receiptNo||'—');
    let d;
    try{d=await gatewayPost('reservationStatus',{sessionToken:session.sessionToken})}
    catch(e){
      if(/SESSION/.test(String(e?.message||''))){removeKey(SESSION_KEY);session=await recoverSession();if(!session)throw e;d=await gatewayPost('reservationStatus',{sessionToken:session.sessionToken})}
      else throw e;
    }
    if(gen!==generation||currentView()!=='callstatus')return;
    applyStatus(d);
  }catch(e){setError(String(e?.message||e));const top=$('csTop');if(top){top.className='cs-top warn';top.querySelector('strong').textContent='更新できませんでした';top.querySelector('small').textContent='通信状況を確認して、もう一度お試しください。'}}
  finally{
    if(manual)setBusy(false);
    if(gen===generation&&currentView()==='callstatus'){clearTimeout(pollTimer);pollTimer=setTimeout(()=>refreshStatus(),POLL_MS)}
  }
}

function mountCallstatus(main){
  stopPolling();
  const gen=++generation;
  main.dataset.v2Callstatus='1';
  main.innerHTML=pageHtml();
  const cached=readJSON(CACHE_KEY)||readJSON(CALL_KEY)||{};
  if($('csReceipt'))$('csReceipt').textContent=String(cached.receiptNo||'—');
  if($('csWaitType'))$('csWaitType').textContent=String(cached.waitTypeLabel||'受付枠を確認中');
  $('csRefresh')?.addEventListener('click',()=>refreshStatus({manual:true}));
  queueMicrotask(()=>{if(gen===generation)void refreshStatus()});
}

function syncRoute(){
  maybeAutoRouteAfterReception();
  if(currentView()!=='callstatus'){stopPolling();return}
  const main=document.querySelector('main.view.active');
  if(!main||main.dataset.v2Callstatus==='1')return;
  mountCallstatus(main);
}

const observer=new MutationObserver(()=>syncRoute());
observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});
window.addEventListener('popstate',()=>queueMicrotask(syncRoute));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&currentView()==='callstatus')void refreshStatus({manual:true})});
queueMicrotask(syncRoute);
window.ASOBOON_V2_CALLSTATUS=Object.freeze({version:'1.0.0-develop',refresh:()=>refreshStatus({manual:true})});
})();
