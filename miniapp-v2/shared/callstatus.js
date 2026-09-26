/* ASOBooN LINE MINI App v2 / Developing same-app call status */
(()=>{'use strict';
const E=window.ASOBOON_V2_ENV||{};
const CACHE_KEY='asoboon_v2_current_reservation_develop_v1';
const CALL_KEY='asoboon_v2_callstatus_develop_v1';
const SESSION_KEY='asoboon_v2_callstatus_session_develop_v1';
const HOME_SNAP_KEY='asoboon_v2_home_status_develop_v1';
const POLL_RECONCILE_MS=6000;
const POLL_RECONCILE_MAX=3;
const POLL_FRONT_MS=5000;
const POLL_NEAR_MS=15000;
const POLL_MID_MS=60000;
const POLL_FAR_MS=180000;
const POLL_ERROR_MS=60000;
const POLL_JITTER=0.10;
const REQUEST_TIMEOUT_MS=10000;
let pollTimer=0,generation=0,receptionObserver=null,receptionTimer=0,receptionReceipt='',nextPollMs=POLL_FAR_MS,notFoundStreak=0;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const $=id=>document.getElementById(id);

function readJSON(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
function writeJSON(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}}
function removeKey(key){try{localStorage.removeItem(key)}catch{}}
function backendReady(){return Boolean(E.backendUrl&&/^https:\/\//.test(String(E.backendUrl)))}
function stopPolling(){generation+=1;if(pollTimer){clearTimeout(pollTimer);pollTimer=0}}
function stopReceptionWatch(){if(receptionObserver){receptionObserver.disconnect();receptionObserver=null}if(receptionTimer){clearTimeout(receptionTimer);receptionTimer=0}}
function unmount(){stopPolling();stopReceptionWatch()}
function fmtClock(ms){try{return new Intl.DateTimeFormat('ja-JP',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(Number(ms||Date.now())))}catch{return'--:--'}}
function pollLabel(ms){if(!ms)return'自動更新停止';if(ms<=5000)return'約5秒ごと';if(ms<=6000)return'約6秒ごと';if(ms<=15000)return'約15秒ごと';if(ms<=60000)return'約1分ごと';return'約3分ごと'}
function jitter(ms){if(!ms)return 0;const factor=1-POLL_JITTER+Math.random()*POLL_JITTER*2;return Math.max(1000,Math.round(ms*factor))}

function pageHtml(){return `<section class="page-card cs-page"><div class="page-head green"><small>CALL STATUS / NEW HOME</small><h2>呼出状況</h2></div><div class="page-body cs-body">
<div id="csTop" class="cs-top"><span class="cs-live-dot"></span><strong>受付情報を確認しています</strong><small>AirWAITの最新状況を自動で確認します。</small></div>
<div class="cs-ticket"><small>あなたの受付番号</small><strong id="csReceipt">—</strong><span>番</span><div id="csWaitType" class="cs-waittype">受付枠を確認中</div></div>
<div id="csState" class="cs-state loading"><div class="cs-state-icon">⏳</div><strong id="csTitle">状況を確認中</strong><p id="csMessage">LINE本人確認と受付情報を安全に照合しています。</p></div>
<div id="csQueue" class="cs-queue" hidden><div><small>あなたの前</small><strong id="csAhead">—</strong><span>組</span></div><div><small>現在の位置</small><strong id="csRank">—</strong><span id="csTotal">組中</span></div></div>
<div class="cs-meta"><span>最終確認</span><strong id="csChecked">—</strong></div>
<button id="csRefresh" class="cs-refresh" type="button">↻ 今すぐ更新</button>
<div id="csCancelArea" class="cs-cancel-area" hidden>
  <button id="csCancel" class="cs-cancel" type="button">受付をキャンセルする</button>
  <small>キャンセル後は元の順番には戻せません。</small>
</div>
<div id="csError" class="cs-error" hidden></div>
<div class="cs-note"><strong>自動更新：</strong>受付直後は約6秒間隔で再照合し、確認後は待ち人数に応じて約5秒〜3分で調整します。画面を閉じている間は通信を止め、LINE呼出通知を優先します。</div>
</div>
<div id="csCancelDialog" class="cs-cancel-dialog" hidden>
  <div class="cs-cancel-backdrop" data-cs-cancel-close></div>
  <div class="cs-cancel-sheet" role="dialog" aria-modal="true" aria-labelledby="csCancelTitle">
    <div class="cs-cancel-mark">!</div>
    <h3 id="csCancelTitle">受付をキャンセルしますか？</h3>
    <p>受付番号 <strong id="csCancelReceipt">—</strong> のキャンセル手続きへ進みます。<br>キャンセル後は元の順番には戻せません。</p>
    <button id="csCancelProceed" class="cs-cancel-proceed" type="button">キャンセル手続きへ</button>
    <button class="cs-cancel-dismiss" type="button" data-cs-cancel-close>やめる</button>
  </div>
</div>
</section>`}

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

function delayForStatus(d){
  if(!d?.found)return POLL_RECONCILE_MS;
  const state=String(d.state||'');
  if(['calling','done','canceled'].includes(state))return 0;
  if(['hold','processing'].includes(state))return POLL_MID_MS;
  if(state==='waiting'){
    const ahead=Number(d.aheadCount);
    if(Number.isFinite(ahead)&&ahead<=1)return POLL_FRONT_MS;
    if(Number.isFinite(ahead)&&ahead<=5)return POLL_NEAR_MS;
    if(Number.isFinite(ahead)&&ahead<=20)return POLL_MID_MS;
    return POLL_FAR_MS;
  }
  return POLL_ERROR_MS;
}

function scheduleNext(gen=generation){
  if(pollTimer){clearTimeout(pollTimer);pollTimer=0}
  if(gen!==generation||!$('csState')||document.visibilityState!=='visible'||!nextPollMs)return;
  pollTimer=setTimeout(()=>{pollTimer=0;void refreshStatus()},jitter(nextPollMs));
}

function setError(text){const el=$('csError');if(!el)return;if(!text){el.hidden=true;el.textContent='';return}el.hidden=false;el.textContent=String(text)}
function setBusy(busy){const b=$('csRefresh');if(b){b.disabled=busy;b.textContent=busy?'確認中…':'↻ 今すぐ更新'}}
function cachedReservation(){return readJSON(CACHE_KEY)||readJSON(CALL_KEY)||{}}
function cachedWaitType(){const c=cachedReservation();return String(c.waitTypeName||c.waitTypeLabel||'受付枠を確認中')}
function safeCancelUrl(){
  const raw=String(cachedReservation()?.shortUrl||'').trim();
  if(!raw)return'';
  try{
    const u=new URL(raw,location.href);
    const host=String(u.hostname||'').toLowerCase();
    if(!['http:','https:'].includes(u.protocol)||!(host==='airwait.jp'||host.endsWith('.airwait.jp')))return'';
    u.protocol='https:';
    return u.toString();
  }catch{return''}
}
function updateCancelAction(state){
  const area=$('csCancelArea');
  if(!area)return;
  const cancelable=['waiting','calling','hold'].includes(String(state||''));
  area.hidden=!(cancelable&&safeCancelUrl());
}
function closeCancelDialog(){
  const dlg=$('csCancelDialog');
  if(dlg)dlg.hidden=true;
}
function openCancelDialog(){
  const url=safeCancelUrl();
  if(!url){setError('キャンセル画面を開けませんでした。受付状況を更新してからもう一度お試しください。');return}
  const receipt=String(cachedReservation()?.receiptNo||$('csReceipt')?.textContent||'—');
  if($('csCancelReceipt'))$('csCancelReceipt').textContent=receipt;
  const dlg=$('csCancelDialog');
  if(dlg)dlg.hidden=false;
}
function openOfficialCancelPage(){
  const url=safeCancelUrl();
  if(!url){closeCancelDialog();setError('キャンセル画面を開けませんでした。');return}
  closeCancelDialog();
  const top=$('csTop');
  if(top){
    top.className='cs-top warn';
    top.querySelector('strong').textContent='キャンセル手続き中';
    top.querySelector('small').textContent='AirWAITでキャンセル後、この画面に戻ると自動で反映します。';
  }
  try{
    if(window.liff&&typeof liff.openWindow==='function'){
      liff.openWindow({url,external:false});
      return;
    }
  }catch{}
  window.open(url,'_blank','noopener,noreferrer');
}
function shareHomeStatus(d){if(E.environment!=='develop')return;const cached=cachedReservation(),receipt=String(d?.receiptNo||cached?.receiptNo||'—'),checkedAt=Number(d?.checkedAt||Date.now());let status;if(!d?.found)status={kind:'error',receipt,message:'受付状況を取得できません',checkedAt,source:'callstatus'};else if(d.state==='waiting'&&Number.isFinite(Number(d.aheadCount)))status={kind:'waiting',receipt,ahead:Number(d.aheadCount),checkedAt,source:'callstatus'};else if(d.state==='calling')status={kind:'calling',receipt,checkedAt,source:'callstatus'};else if(d.state==='hold')status={kind:'hold',receipt,checkedAt,source:'callstatus'};else if(['processing','done'].includes(String(d.state||'')))status={kind:'guided',receipt,checkedAt,source:'callstatus'};else if(d.state==='canceled')status={kind:'canceled',receipt,canceled:true,checkedAt,source:'callstatus'};else status={kind:'error',receipt,message:'受付状況を取得できません',checkedAt,source:'callstatus'};window.ASOBOON_HOME_STATUS_SNAPSHOT=status;writeJSON(HOME_SNAP_KEY,{receiptNo:receipt,businessDate:String(d?.businessDate||cached?.businessDate||''),savedAt:checkedAt,status});window.dispatchEvent(new CustomEvent('asoboon:v8-home-status',{detail:status}))}
function applyStatus(d){
  if(!d||!$('csState'))return;
  shareHomeStatus(d);
  const cached=cachedReservation();
  const receipt=String(d.receiptNo||cached.receiptNo||'—');
  if($('csReceipt'))$('csReceipt').textContent=receipt;
  if($('csWaitType'))$('csWaitType').textContent=String(d.waitTypeName||cached.waitTypeName||cached.waitTypeLabel||'受付枠');
  if(!d.found){
    notFoundStreak+=1;
    nextPollMs=notFoundStreak<=POLL_RECONCILE_MAX?POLL_RECONCILE_MS:POLL_MID_MS;
    const box=$('csState');if(box)box.className='cs-state loading';
    if($('csQueue'))$('csQueue').hidden=true;
    if($('csChecked'))$('csChecked').textContent=fmtClock(d.checkedAt);
    const reconciling=notFoundStreak<=POLL_RECONCILE_MAX;
    if($('csTitle'))$('csTitle').textContent=reconciling?'AirWAITへ受付を反映中':'受付情報をまだ確認できません';
    if($('csMessage'))$('csMessage').textContent=reconciling?`受付番号は保存済みです。約6秒後に再確認します（${notFoundStreak}/${POLL_RECONCILE_MAX}）。`:'受付番号は保存済みです。「今すぐ更新」を押しても変わらない場合はスタッフへ受付番号をお伝えください。';
    setError(reconciling?'':'AirWAIT側の受付反映を確認できていません。新しい受付を作り直さないでください。');
    const top=$('csTop');if(top){top.className=reconciling?'cs-top ok':'cs-top warn';top.querySelector('strong').textContent=reconciling?'AirWAITと照合中':'再確認が必要です';top.querySelector('small').textContent=reconciling?'受付直後の反映待ちを自動で再確認しています。':`次回は${pollLabel(nextPollMs)}に確認します。`}
    return;
  }
  notFoundStreak=0;
  setError('');
  nextPollMs=delayForStatus(d);
  const ahead=Number.isFinite(Number(d.aheadCount))?Number(d.aheadCount):null;
  const m=stateMeta(d.state,ahead),box=$('csState');
  updateCancelAction(d.state);
  if(box)box.className='cs-state '+m.cls;
  const icon=box?.querySelector?.('.cs-state-icon');if(icon)icon.textContent=m.icon;
  if($('csTitle'))$('csTitle').textContent=m.title;
  if($('csMessage'))$('csMessage').textContent=m.msg;
  const showQueue=d.state==='waiting'||d.state==='calling';
  if($('csQueue'))$('csQueue').hidden=!showQueue;
  if(showQueue){if($('csAhead'))$('csAhead').textContent=ahead??'—';if($('csRank'))$('csRank').textContent=d.queueRank??'—';if($('csTotal'))$('csTotal').textContent=` / ${d.activeCount??'—'}組中`}
  if($('csChecked'))$('csChecked').textContent=fmtClock(d.checkedAt);
  const top=$('csTop');if(top){top.className='cs-top ok';top.querySelector('strong').textContent='AirWAITと接続中';top.querySelector('small').textContent=nextPollMs?`待ち状況に応じて${pollLabel(nextPollMs)}に自動更新します。`:'この受付は自動更新を終了しました。'}
}

async function gatewayPost(action,body={}){
  if(!backendReady())throw Error('呼出状況Gatewayが設定されていません。');
  const payload={action,...body};
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),REQUEST_TIMEOUT_MS);
  let r;
  try{
    r=await fetch(E.backendUrl,{method:'POST',mode:'cors',credentials:'omit',cache:'no-store',signal:ctrl.signal,headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8',Accept:'application/json'},body:new URLSearchParams(Object.entries(payload).map(([k,v])=>[k,String(v??'')]))});
  }catch(e){
    if(e?.name==='AbortError')throw Error('呼出状況の確認がタイムアウトしました。');
    throw e;
  }finally{clearTimeout(timer)}
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
  const cached=cachedReservation();
  const d=await gatewayPost('recoverReservationSession',{liffAccessToken:token,businessDate:String(cached.businessDate||'')});
  if(!d?.ok)throw Error('受付情報の復元に失敗しました。');
  if(!d.found)return null;
  const session={sessionToken:String(d.sessionToken||''),businessDate:String(d.businessDate||''),receiptNo:String(d.receiptNo||''),waitTypeId:String(d.waitTypeId||''),shortUrl:String(d.shortUrl||''),expiresAt:Number(d.expiresAt||0),cachedAt:Date.now()};
  if(session.sessionToken.length<32)throw Error('呼出状況セッションを作成できませんでした。');
  writeJSON(SESSION_KEY,session);
  writeJSON(CALL_KEY,{businessDate:session.businessDate,receiptNo:session.receiptNo,waitTypeId:session.waitTypeId,cachedAt:Date.now()});
  if(session.shortUrl){
    const current=readJSON(CACHE_KEY)||{};
    writeJSON(CACHE_KEY,{...current,businessDate:session.businessDate,receiptNo:session.receiptNo,waitTypeId:session.waitTypeId,shortUrl:session.shortUrl,cachedAt:Date.now()});
  }
  return session;
}

async function ensureSession(){
  const s=readJSON(SESSION_KEY);
  const cached=cachedReservation();
  const receiptMatches=!cached?.receiptNo||String(s?.receiptNo||'')===String(cached.receiptNo||'');
  const dateMatches=!cached?.businessDate||String(s?.businessDate||'')===String(cached.businessDate||'');
  if(s?.sessionToken&&Number(s.expiresAt||0)>Date.now()+30000&&receiptMatches&&dateMatches)return s;
  removeKey(SESSION_KEY);
  return await recoverSession();
}

async function refreshStatus({manual=false}={}){
  const gen=generation;
  if(!$('csState'))return;
  if(manual)setBusy(true);
  setError('');
  try{
    let session=await ensureSession();
    if(gen!==generation||!$('csState'))return;
    if(!session){
      nextPollMs=POLL_MID_MS;
      const cached=cachedReservation();
      if($('csReceipt'))$('csReceipt').textContent=String(cached.receiptNo||'—');
      if($('csWaitType'))$('csWaitType').textContent=cachedWaitType();
      updateCancelAction('');
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
    if(gen!==generation||!$('csState'))return;
    applyStatus(d);
  }catch(e){nextPollMs=POLL_ERROR_MS;setError(String(e?.message||e));const top=$('csTop');if(top){top.className='cs-top warn';top.querySelector('strong').textContent='更新できませんでした';top.querySelector('small').textContent='通信状況を確認して、もう一度お試しください。'}}
  finally{
    if(manual)setBusy(false);
    if(gen===generation&&$('csState'))scheduleNext(gen);
  }
}

function mountCallstatus(){
  stopPolling();
  stopReceptionWatch();
  nextPollMs=POLL_FAR_MS;
  notFoundStreak=0;
  const gen=generation;
  const cached=cachedReservation();
  if($('csReceipt'))$('csReceipt').textContent=String(cached.receiptNo||'—');
  if($('csWaitType'))$('csWaitType').textContent=cachedWaitType();
  $('csRefresh')?.addEventListener('click',()=>refreshStatus({manual:true}));
  $('csCancel')?.addEventListener('click',openCancelDialog);
  $('csCancelProceed')?.addEventListener('click',openOfficialCancelPage);
  document.querySelectorAll('[data-cs-cancel-close]').forEach(el=>el.addEventListener('click',closeCancelDialog));
  updateCancelAction('');
  queueMicrotask(()=>{if(gen===generation&&$('csState'))void refreshStatus()});
}

function watchReception({go}={}){
  stopReceptionWatch();
  const box=$('recResult');
  if(!box||typeof go!=='function')return;
  const check=()=>{
    const result=box.querySelector?.('.rec-result');
    if(box.hidden||!result||!/受付が完了しました/.test(String(result.textContent||'')))return;
    const cached=cachedReservation();
    const domReceipt=String(result.querySelector?.('strong')?.textContent||'').trim();
    const receipt=domReceipt||String(cached?.receiptNo||'');
    if(!receipt||receptionReceipt===receipt||receptionTimer)return;
    removeKey(SESSION_KEY);
    writeJSON(CALL_KEY,{businessDate:String(cached?.businessDate||''),receiptNo:receipt,waitTypeId:String(cached?.waitTypeId||''),cachedAt:Date.now()});
    receptionReceipt=receipt;
    receptionTimer=setTimeout(()=>{
      receptionTimer=0;
      stopReceptionWatch();
      go('callstatus',{replace:true});
    },350);
  };
  receptionObserver=new MutationObserver(check);
  receptionObserver.observe(box,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  check();
  setTimeout(check,100);
  setTimeout(check,500);
}

document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden'){if(pollTimer){clearTimeout(pollTimer);pollTimer=0};return}
  if($('csState'))void refreshStatus({manual:true});
});
window.ASOBOON_V2_CALLSTATUS=Object.freeze({
  version:'1.6.2-frontline-observe',
  render:pageHtml,
  mount:mountCallstatus,
  watchReception,
  unmount,
  refresh:()=>refreshStatus({manual:true})
});
})();
