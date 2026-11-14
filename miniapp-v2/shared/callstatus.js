/* ASOBooN LINE MINI App v2 / same-app call status */
(()=>{'use strict';
const E=window.ASOBOON_V2_ENV||{};
const STORAGE_NS=String(E.storageNamespace||E.environment||'develop').replace(/[^a-z0-9_-]/gi,'_');
const CACHE_KEY=`asoboon_v2_current_reservation_${STORAGE_NS}_v1`;
const CALL_KEY=`asoboon_v2_callstatus_${STORAGE_NS}_v1`;
const SESSION_KEY=`asoboon_v2_callstatus_session_${STORAGE_NS}_v1`;
const HOME_SNAP_KEY=`asoboon_v2_home_status_${STORAGE_NS}_v1`;
const RATE_LIMIT_STORAGE_KEY=`asoboon_v2_callstatus_retry_after_${STORAGE_NS}_v1`;
const CANCELED_KEY='asoboon_v2_callstatus_canceled_'+STORAGE_NS+'_v1';
const UNRESOLVED_KEY='asoboon_v2_callstatus_unresolved_'+STORAGE_NS+'_v1';
const POLL_RECONCILE_MS=6000;
// A successful identity-backed recovery returning found:false is not a network error.
const VERIFIED_NO_SESSION=Object.freeze({verifiedNoSession:true});
const POLL_RECONCILE_MAX=3;
const POLL_FRONT_MS=8000;
const POLL_NEAR_MS=15000;
const POLL_MID_MS=30000;
const POLL_FAR_MS=45000;
const POLL_ERROR_MS=30000;
const POLL_RATE_LIMITED_MS=90000;
const POLL_TERMINAL_MS=15000;
const POLL_JITTER=0.10;
const REQUEST_TIMEOUT_MS=10000;
const CANCEL_REQUEST_TIMEOUT_MS=60000;
let pollTimer=0,generation=0,receptionObserver=null,receptionTimer=0,receptionReceipt='',nextPollMs=POLL_FAR_MS,notFoundStreak=0,lastStatus=null,cancelBusy=false;
let activeRefreshGeneration=-1,queuedManualRefresh=false;
let heartbeatTimer=0,lastRefreshStartedAt=0,lastRefreshSucceededAt=0,nextPollAt=0,rateLimitUntil=0,hadRefreshError=false;
let numberListTimer=0,numberListAbort=null,numberListGeneration=0,numberListBusy=false;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const $=id=>document.getElementById(id);

function readJSON(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
function writeJSON(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}}
function removeKey(key){try{localStorage.removeItem(key)}catch{}}
function backendReady(){return Boolean(E.backendUrl&&/^https:\/\//.test(String(E.backendUrl)))}
function stopPolling(){
 generation+=1;activeRefreshGeneration=-1;queuedManualRefresh=false;
 if(pollTimer){clearTimeout(pollTimer);pollTimer=0}
 if(heartbeatTimer){clearInterval(heartbeatTimer);heartbeatTimer=0}
 nextPollAt=0;
}
function stopReceptionWatch(){if(receptionObserver){receptionObserver.disconnect();receptionObserver=null}if(receptionTimer){clearTimeout(receptionTimer);receptionTimer=0}}
const CALL_VISUAL_TONES=['waiting','calling','done','canceled','hold','loading'];
function setCallVisualTone(state){
 const code=String(state||'');
 const tone=code==='waiting'?'waiting':code==='calling'?'calling':
   ['done','processing'].includes(code)?'done':code==='canceled'?'canceled':
   code==='hold'?'hold':'loading';
 const page=$('csState')?.closest('.cs-page');
 if(page)page.dataset.callTone=tone;
 document.body.dataset.asoboonCallTone=tone;
}
function clearCallVisualTone(){
 delete document.body.dataset.asoboonCallTone;
}
function unmount(){clearCallVisualTone();stopNumberList();stopPolling();stopReceptionWatch()}
function fmtClock(ms){try{return new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(Number(ms||Date.now())))}catch{return'--:--'}}
function pollLabel(ms){if(!ms)return'自動更新停止';if(ms<=6000)return'約6秒ごと';if(ms<=8000)return'約8秒ごと';if(ms<=15000)return'約15秒ごと';if(ms<=30000)return'約30秒ごと';if(ms<=45000)return'約45秒ごと';return'約90秒ごと'}
function restoreThrottle(){
 if(rateLimitUntil>clockTick())return;
 try{
   const until=Number(sessionStorage.getItem(RATE_LIMIT_STORAGE_KEY)||0);
   const ms=until-Date.now();
   if(ms>0&&ms<=POLL_RATE_LIMITED_MS){rateLimitUntil=clockTick()+ms;return}
   sessionStorage.removeItem(RATE_LIMIT_STORAGE_KEY);
 }catch{}
 rateLimitUntil=0;
}
function rememberThrottle(){
 rateLimitUntil=clockTick()+POLL_RATE_LIMITED_MS;
 try{sessionStorage.setItem(RATE_LIMIT_STORAGE_KEY,String(Date.now()+POLL_RATE_LIMITED_MS))}catch{}
}
function clearThrottle(){
 rateLimitUntil=0;
 try{sessionStorage.removeItem(RATE_LIMIT_STORAGE_KEY)}catch{}
}
function clockTick(){return typeof performance!=='undefined'&&typeof performance.now==='function'?performance.now():Date.now()}
function jitter(ms){if(!ms)return 0;const factor=1-POLL_JITTER+Math.random()*POLL_JITTER*2;return Math.max(1000,Math.round(ms*factor))}

function pageHtml(){return `<section class="page-card cs-page"><div class="page-head green"><small>CALL STATUS / NEW HOME</small><h2>呼出状況</h2></div><div class="page-body cs-body">
<div id="csTop" class="cs-top"><span class="cs-live-dot"></span><strong>受付情報を確認しています</strong><small>AirWAITの最新状況を自動で確認します。</small></div>
<div class="cs-ticket"><small>あなたの受付番号</small><strong id="csReceipt">—</strong><span>番</span><div id="csWaitType" class="cs-waittype">受付枠を確認中</div></div>
<div id="csState" class="cs-state loading"><div class="cs-state-icon">⏳</div><strong id="csTitle">状況を確認中</strong><p id="csMessage">LINEで受付情報を確認しています。</p></div>
<div id="csQueue" class="cs-queue" hidden><div><small>あなたの前</small><strong id="csAhead">—</strong><span>組</span></div><div><small>現在の位置</small><strong id="csRank">—</strong><span id="csTotal">組中</span></div></div>
<section id="csForecast" class="cs-forecast" hidden aria-label="呼出時刻の参考目安">
  <div class="cs-forecast-head"><span>🕒 あなたの呼出時刻の目安</span><small id="csForecastMode">順番からの参考予測</small></div>
  <div class="cs-forecast-main"><strong id="csForecastClock">—</strong><span id="csForecastSuffix">ごろ</span></div>
  <div class="cs-forecast-flow">
    <div class="cs-forecast-point"><span class="cs-forecast-dot"></span><small id="csForecastStart">呼出開始</small></div>
    <div class="cs-forecast-flow-line" aria-hidden="true">➜</div>
    <div class="cs-forecast-point end"><span class="cs-forecast-dot"></span><small id="csForecastTarget">あなたの目安</small></div>
  </div>
  <p id="csForecastNote" class="cs-forecast-note">順番からの参考予測です。実際の呼出時刻は前後します。</p>
</section>
<details id="csNumberList" class="cs-number-list">
 <summary><span class="cs-number-list-summary"><strong id="csNumberListTitle">受付番号一覧</strong><small id="csNumberListHint">呼出中・待機中の番号を見る</small></span><span class="cs-number-list-chevron" aria-hidden="true">⌄</span></summary>
 <div class="cs-number-list-body"><p id="csNumberListNotice" class="cs-number-list-notice" role="status" aria-live="polite">開くと最新の受付番号を確認します。</p>
 <div id="csNumberListGroups" class="cs-number-list-groups"></div>
 <div class="cs-number-list-footer"><small id="csNumberListTime">—</small><button id="csNumberListRefresh" type="button">↻ 更新</button></div>
 </div>
</details>
<div class="cs-meta"><span>最終確認</span><strong id="csChecked">—</strong></div>
<div id="csHeartbeat" class="cs-heartbeat" role="status" aria-live="off"><span class="cs-heartbeat-dot" aria-hidden="true"></span><span id="csHeartbeatLabel">自動更新を準備しています</span></div>
<button id="csRefresh" class="cs-refresh" type="button">↻ 今すぐ更新</button>
<div id="csCancelArea" class="cs-cancel-area" hidden><button id="csCancel" class="cs-cancel" type="button">受付をキャンセルする</button><small>キャンセル後は元の順番には戻せません。</small></div>
    <div id="csRebookArea" class="cs-rebook-area" hidden>
      <button id="csRebook" class="cs-rebook" type="button" data-v7-view="reception">もう一度受付する</button>
      <small>新しい受付は、受付時間と空き枠をご確認のうえお手続きください。</small>
    </div>
<div id="csError" class="cs-error" hidden></div>
<div class="cs-note"><strong>自動更新：</strong>開いている間は状況に応じて約8〜45秒ごとに確認します。通信集中時には更新間隔を延ばして再試行します。画面を閉じている間は通信を止め、LINE呼出通知を優先します。</div>
</div>
<div id="csCancelDialog" class="cs-cancel-dialog" hidden role="dialog" aria-modal="true" aria-labelledby="csCancelTitle"><button class="cs-cancel-backdrop" type="button" data-cs-cancel-close aria-label="閉じる"></button><div class="cs-cancel-sheet"><div class="cs-cancel-mark">!</div><h3 id="csCancelTitle">受付をキャンセルしますか？</h3><p>受付番号 <strong id="csCancelReceipt">—</strong><br>キャンセルすると現在の順番は取り消され、元には戻せません。</p><div id="csCancelError" class="cs-error" hidden></div><button id="csCancelProceed" class="cs-cancel-proceed" type="button">キャンセルする</button><button class="cs-cancel-dismiss" type="button" data-cs-cancel-close>やめる</button></div></div>
</section>`}

function updateCancelAction(state){
  const area=$('csCancelArea'),button=$('csCancel');
  if(!area)return;
  const allowed=['waiting','calling','hold'].includes(String(state||''));
  area.hidden=!allowed;
  if(button){button.disabled=cancelBusy||!allowed;button.textContent=cancelBusy?'キャンセル処理中…':'受付をキャンセルする'}
}
function updateRebookAction(data){
  const area=$('csRebookArea');if(!area)return;
  // A new same-day claim is allowed only after an actual terminal outcome.
  // No second reservation is sent until the guest explicitly uses reception.
  area.hidden=!(data?.found===true&&['canceled','done'].includes(String(data.state||'')));
}
function openCancelDialog(){
  if(cancelBusy||!['waiting','calling','hold'].includes(String(lastStatus?.state||'')))return;
  const dialog=$('csCancelDialog');if(!dialog)return;
  const cached=cachedReservation();
  if($('csCancelReceipt'))$('csCancelReceipt').textContent=String(lastStatus?.receiptNo||cached?.receiptNo||'—');
  const err=$('csCancelError');if(err){err.hidden=true;err.textContent=''}
  dialog.hidden=false;
}
function closeCancelDialog(){const dialog=$('csCancelDialog');if(dialog&&!cancelBusy)dialog.hidden=true}
function friendlyCancelError(value){
  const code=String(value||'');
  if(/CANCEL_NOT_ALLOWED_STATE_DONE/.test(code))return'すでにご案内済みのためキャンセルできません。';
  if(/CANCEL_NOT_ALLOWED_STATE_PROCESSING/.test(code))return'受付対応中のため、スタッフへお声がけください。';
  if(/CANCEL_NOT_ALLOWED_STATE_CANCELED/.test(code))return'この受付はすでにキャンセルされています。';
  if(/SESSION|LINE_ACCESS_TOKEN|LINE_PROFILE/.test(code))return'本人確認情報を更新します。ミニアプリを開き直してもう一度お試しください。';
  if(/CAPABILITY|CSRF|CONFIRM|DETAIL/.test(code))return'キャンセル情報を確認できませんでした。少し時間をおいてもう一度お試しください。';
  if(/CANCEL_REQUEST_TIMEOUT/.test(code))return'キャンセル処理に時間がかかっています。受付は作り直さず、最新状況を確認してください。';
  if(/RESULT_UNKNOWN|NOT_CONFIRMED|UPSTREAM_TIMEOUT/.test(code))return'キャンセル結果を確認できませんでした。受付状況を更新してご確認ください。';
  return'キャンセルできませんでした。受付状況を更新してもう一度お試しください。';
}
async function cancelCurrentReservation(){
  if(cancelBusy)return;
  cancelBusy=true;updateCancelAction(lastStatus?.state);
  const proceed=$('csCancelProceed');if(proceed){proceed.disabled=true;proceed.textContent='キャンセル処理中…'}
  setError('');
  try{
    await waitForLine();
    const session=await ensureSession();
    if(!session)throw Error('CALLSTATUS_SESSION_REQUIRED');
    const token=String(liff.getAccessToken?.()||'');
    if(token.length<20)throw Error('LINE_ACCESS_TOKEN_REQUIRED');
    const d=await gatewayPost('cancelReservation',{sessionToken:session.sessionToken,liffAccessToken:token},{timeoutMs:CANCEL_REQUEST_TIMEOUT_MS});
    if(!(d?.ok===true&&d?.canceled===true))throw Error(String(d?.error||'CANCEL_NOT_CONFIRMED'));
    if($('csCancelDialog'))$('csCancelDialog').hidden=true;
    const canceled={...lastStatus,...d,found:true,state:'canceled',receiptNo:String(d.receiptNo||session.receiptNo||''),checkedAt:Number(d.checkedAt||Date.now())};
    lastStatus=canceled;
    applyStatus(canceled);
  }catch(e){
    const raw=String(e?.message||e||'');
    let reconciled=false;
    try{
      await sleep(700);
      const session=await ensureSession();
      if(session){
        const latest=await gatewayPost('reservationStatus',{sessionToken:session.sessionToken});
        if(latest?.found&&latest?.state==='canceled'){
          if($('csCancelDialog'))$('csCancelDialog').hidden=true;
          lastStatus=latest;
          applyStatus(latest);
          reconciled=true;
        }
      }
    }catch{}
    if(!reconciled){
      const friendly=friendlyCancelError(raw);
      setError(friendly);
      const err=$('csCancelError');
      if(err){
        err.hidden=false;
        err.textContent=friendly+`\n確認コード：${raw.slice(0,120)}`;
      }
    }
  }
  finally{
    cancelBusy=false;
    if(proceed){proceed.disabled=false;proceed.textContent='キャンセルする'}
    updateCancelAction(lastStatus?.state);
  }
}

function stateMeta(state,ahead){
  switch(String(state||'')){
    case'waiting':return{cls:'waiting',icon:'🕒',title:'順番をお待ちください',msg:Number.isFinite(ahead)?`現在、あなたの前に${ahead}組お待ちです。`:'現在、順番をお待ちいただいています。'};
    case'calling':return{cls:'calling',icon:'🎉',title:'入場できます',msg:'受付でこの受付番号をスタッフにお見せください。'};
    case'hold':return{cls:'hold',icon:'⏸️',title:'保留中です',msg:'スタッフの案内をご確認ください。'};
    case'processing':return{cls:'processing',icon:'✅',title:'受付対応中です',msg:'スタッフが受付対応を進めています。'};
    case'done':return{cls:'done',icon:'🏁',title:'ご案内済みです',msg:'この受付はご案内済みになっています。'};
    case'canceled':return{cls:'canceled',icon:'✕',title:'受付は取消済みです',msg:'この番号の自動確認は終了しました。受付をやり直す場合は下のボタンをご利用ください。'};
    case'closed':return{cls:'closed',icon:'✓',title:'本日の受付は終了しました',msg:'この受付番号の呼出状況表示は終了しています。'};
    default:return{cls:'loading',icon:'🔄',title:'状況を確認しています',msg:'AirWAITの最新情報を取得しています。'};
  }
}

function updateCallForecast(data){
 const el=$('csForecast');
 if(!el)return;
 const result=window.ASOBOON_V2_CALL_FORECAST?.predict?.(data)||null;
 el.hidden=!result;
 if(!result)return;
 const write=(id,value)=>{const node=$(id);if(node)node.textContent=value};
 write('csForecastClock',result.soon?'まもなく':result.clock);
 write('csForecastSuffix',result.soon?'':'ごろ');
 write('csForecastMode',result.prestart?'呼出開始前・順番からの目安':'待ち組数からの参考目安');
 write('csForecastStart','呼出開始 '+result.start);
 write('csForecastTarget',result.soon?'まもなく':'あなた '+result.clock+'ごろ');
 write('csForecastNote',result.prestart
  ?'この回の呼出開始時刻と受付順から計算した参考予測です。実際の呼出は前後します。'
  :'現在の待ち組数をもとにした参考予測です。実際の進行で前後します。LINEの呼出通知・最新状況をご確認ください。');
}
function delayForStatus(d){
  if(!d?.found)return POLL_RECONCILE_MS;
  const state=String(d.state||'');
  if(state==='calling')return POLL_TERMINAL_MS;
  if(state==='done')return POLL_TERMINAL_MS; // Staff may return a guided guest to waiting.
  if(['canceled','closed'].includes(state))return 0;
  if(['hold','processing'].includes(state))return POLL_MID_MS;
  if(state==='waiting'){
    const ahead=Number.isSafeInteger(d.aheadCount)&&d.aheadCount>=0?d.aheadCount:null;
    if(ahead===null)return POLL_RECONCILE_MS;
    if(ahead!==null&&ahead<=1)return POLL_FRONT_MS;
    if(ahead!==null&&ahead<=5)return POLL_NEAR_MS;
    if(ahead!==null&&ahead<=20)return POLL_MID_MS;
    return POLL_FAR_MS;
  }
  return POLL_ERROR_MS;
}

function scheduleNext(gen=generation){
  if(pollTimer){clearTimeout(pollTimer);pollTimer=0}
  if(gen!==generation||!$('csState')||document.visibilityState!=='visible'||!nextPollMs)return;
  const delay=jitter(nextPollMs);nextPollAt=clockTick()+delay;
  pollTimer=setTimeout(()=>{pollTimer=0;nextPollAt=0;void refreshStatus()},delay);
  renderHeartbeat();
}

function renderHeartbeat(){
 const label=$('csHeartbeatLabel');if(!label)return;
 if(activeRefreshGeneration===generation){
   const seconds=Math.max(0,Math.floor((clockTick()-lastRefreshStartedAt)/1000));
   label.textContent=seconds>=5
     ?`確認が続いています（${seconds}秒経過）。通信結果を待っています。`
     :`最新の呼出状況を確認中… ${seconds}秒`;
   return;
 }
 if(nextPollAt>0){
   const seconds=Math.max(0,Math.ceil((nextPollAt-clockTick())/1000));
   const suffix=lastRefreshSucceededAt&&!hadRefreshError?`最終取得 ${fmtClock(lastRefreshSucceededAt)} ／ `:'';
   label.textContent=`${hadRefreshError?'通信が不安定です。':'自動更新は動作中です。'}${suffix}次の再確認まで ${seconds}秒`;
   return;
 }
 label.textContent=lastRefreshSucceededAt?'最新の確認結果を表示しています。':'自動更新を準備しています。';
}
function startHeartbeat(){
 if(heartbeatTimer)clearInterval(heartbeatTimer);
 heartbeatTimer=setInterval(()=>{
   if(document.visibilityState==='visible'&&$('csState'))renderHeartbeat();
 },1000);
 renderHeartbeat();
}
function setError(text){const el=$('csError');if(!el)return;if(!text){el.hidden=true;el.textContent='';return}el.hidden=false;el.textContent=String(text)}
function setBusy(busy){const b=$('csRefresh');if(b){b.disabled=busy;b.textContent=busy?'確認中…':'↻ 今すぐ更新'}}
function cachedReservation(){return readJSON(CACHE_KEY)||readJSON(CALL_KEY)||{}}
// A cancellation proven by AirWAIT or this guest's successful cancellation
// is terminal. A missing record is UNKNOWN, not evidence of cancellation.
function sameCachedTicket(note,cached=cachedReservation()){
 if(!note||!note.receiptNo||!cached||!cached.receiptNo)return false;
 if(String(note.receiptNo)!==String(cached.receiptNo))return false;
 if(note.businessDate&&cached.businessDate&&String(note.businessDate)!==String(cached.businessDate))return false;
 if(note.reserveId&&cached.reserveId&&String(note.reserveId)!==String(cached.reserveId))return false;
 return !(Number(cached.cachedAt||0)>Number(note.savedAt||0)+1000);
}
function canceledTicket(){const note=readJSON(CANCELED_KEY);return sameCachedTicket(note)?note:null}
function unresolvedTicket(){const note=readJSON(UNRESOLVED_KEY);return sameCachedTicket(note)?note:null}
function saveCanceledTicket(d){
 const c=cachedReservation(),receiptNo=String(d.receiptNo||c.receiptNo||'').trim();
 if(!receiptNo)return;
 writeJSON(CANCELED_KEY,{receiptNo,businessDate:String(d.businessDate||c.businessDate||''),
 reserveId:String(d.reserveId||c.reserveId||''),savedAt:Date.now(),checkedAt:Number(d.checkedAt||Date.now())});
 removeKey(UNRESOLVED_KEY);removeKey(SESSION_KEY);
}
function pauseUnresolved(c=cachedReservation()){
 const receiptNo=String(c.receiptNo||'').trim();
 if(receiptNo)writeJSON(UNRESOLVED_KEY,{receiptNo,businessDate:String(c.businessDate||''),
 reserveId:String(c.reserveId||''),savedAt:Date.now()});
 nextPollMs=0;nextPollAt=0;
}

function cachedWaitType(){const c=cachedReservation();return String(c.waitTypeName||c.waitTypeLabel||'受付枠を確認中')}

function showVerifiedMissing(cached){
 // Keep the saved receipt for staff assistance. A missing active session may be
 // a terminal/deleted booking or an identity mismatch; never claim which one.
 notFoundStreak+=1;pauseUnresolved(cached);
 updateCallForecast(null);
 updateCancelAction('');updateRebookAction(null);
 const receipt=String(cached?.receiptNo||'').trim();
 if($('csReceipt'))$('csReceipt').textContent=receipt||'—';
 if($('csWaitType'))$('csWaitType').textContent=cachedWaitType();
 const state=$('csState');if(state){state.className='cs-state missing';const icon=state.querySelector('.cs-state-icon');if(icon)icon.textContent='？'}
 const panel=state?.closest('.cs-page');if(panel)panel.dataset.callTone='missing';document.body.dataset.asoboonCallTone='missing';
 if($('csQueue'))$('csQueue').hidden=true;
 if($('csTitle'))$('csTitle').textContent=receipt?'この受付番号を確認できません':'本日の受付はありません';
 if($('csMessage'))$('csMessage').textContent=receipt
  ?'LINE本人確認は完了しましたが、現在この受付番号の記録を確認できません。取消・終了・削除や別アカウントでの受付などが考えられます。番号は保存したままです。'
  :'当日受付が完了すると、ここで呼出状況を確認できます。';
 if($('csChecked'))$('csChecked').textContent=fmtClock(Date.now());
 setError(receipt?'お困りの場合は保存済みの受付番号をスタッフへお伝えください。新しい受付は自動作成しません。':'');
 const top=$('csTop');if(top){top.className='cs-top warn';top.querySelector('strong').textContent='該当する受付情報が見つかりません';top.querySelector('small').textContent='通信エラーではありません。自動確認は停止しました。必要なときだけ手動で更新できます。'}
}

function shareHomeStatus(d){
  if(String(E.environment||'')==='production'){
    // Relay only owner-bound live observations; a staff restore from DONE to
    // WAITING must REVOKE any previously surfaced HOME rebooking CTA.
    if(d?.found!==true)return;
    const cached=cachedReservation();
    if(!cached?.receiptNo||String(d.receiptNo||'')!==String(cached.receiptNo))return;
    if(cached.businessDate&&d.businessDate&&String(cached.businessDate)!==String(d.businessDate))return;
    if(cached.waitTypeId&&d.waitTypeId&&String(cached.waitTypeId)!==String(d.waitTypeId))return;
    if(cached.reserveId&&d.reserveId&&String(cached.reserveId)!==String(d.reserveId))return;
    const checkedAt=Number(d.checkedAt||Date.now());
    if(cached.cachedAt&&checkedAt<Number(cached.cachedAt))return;
    const kinds={done:'guided',canceled:'canceled',waiting:'waiting',calling:'calling',hold:'hold',processing:'hold',closed:'closed'};
    const status={kind:kinds[String(d.state||'')]||'sync',receipt:String(d.receiptNo),
      checkedAt,source:'live',businessDate:String(d.businessDate||cached.businessDate||''),
      reserveId:String(d.reserveId||cached.reserveId||''),waitTypeId:String(d.waitTypeId||cached.waitTypeId||'')};
    window.ASOBOON_HOME_STATUS_SNAPSHOT=status;
    window.dispatchEvent(new CustomEvent('asoboon:v8-home-status',{detail:status}));
    return;
  }
  if(!['develop','review'].includes(String(E.environment||'')))return;
  const cached=cachedReservation();
  const receipt=String(d?.receiptNo||cached?.receiptNo||'—');
  const checkedAt=Number(d?.checkedAt||Date.now());
  let status;
  if(!d?.found){
    status={kind:'sync',receipt,message:'受付状況を照合しています',checkedAt,source:'callstatus'};
  }else if(d.state==='waiting'){
    const ahead=Number.isSafeInteger(d.aheadCount)&&d.aheadCount>=0?d.aheadCount:null;
    status={kind:'waiting',receipt,ahead:Number.isFinite(ahead)?ahead:null,checkedAt,source:'callstatus'};
  }else if(d.state==='calling'){
    status={kind:'calling',receipt,checkedAt,source:'callstatus'};
  }else if(d.state==='hold'){
    status={kind:'hold',receipt,checkedAt,source:'callstatus'};
  }else if(['processing','done'].includes(String(d.state||''))){
    status={kind:'guided',receipt,checkedAt,source:'callstatus'};
  }else if(d.state==='canceled'){
    status={kind:'canceled',receipt,canceled:true,checkedAt,source:'callstatus'};
  }else if(d.state==='closed'){
    status={kind:'closed',receipt,checkedAt,source:'callstatus'};
  }else{
    status={kind:'sync',receipt,message:'受付状況を確認しています',checkedAt,source:'callstatus'};
  }
  window.ASOBOON_HOME_STATUS_SNAPSHOT=status;
  writeJSON(HOME_SNAP_KEY,{receiptNo:receipt,businessDate:String(d?.businessDate||cached?.businessDate||''),savedAt:checkedAt,status});
  window.dispatchEvent(new CustomEvent('asoboon:v8-home-status',{detail:status}));
}
function applyStatus(d){
  if(!d||!$('csState'))return;
  lastStatus=d;
  if(d.found===true&&d.state==='canceled'){
    if(!canceledTicket())saveCanceledTicket(d);
    stopPolling(); // Cancel any already scheduled heartbeat or in-flight result.
  }
  else if(d.found===true&&d.state!=='canceled')removeKey(UNRESOLVED_KEY);
  setCallVisualTone(d.found?d.state:'loading');
  updateCallForecast(d);
  updateCancelAction(d?.found?d.state:'');
  updateRebookAction(d);
  shareHomeStatus(d);
  const cached=cachedReservation();
  const receipt=String(d.receiptNo||cached.receiptNo||'—');
  if($('csReceipt'))$('csReceipt').textContent=receipt;
  if($('csWaitType'))$('csWaitType').textContent=String(d.waitTypeName||cached.waitTypeName||cached.waitTypeLabel||'受付枠');
  if(!d.found){
    setCallVisualTone('loading');
    notFoundStreak+=1;
    nextPollMs=notFoundStreak<POLL_RECONCILE_MAX?POLL_RECONCILE_MS:0;
    if(nextPollMs===0)pauseUnresolved(cached);
    const box=$('csState');if(box)box.className='cs-state loading';
    if($('csQueue'))$('csQueue').hidden=true;
    if($('csChecked'))$('csChecked').textContent=fmtClock(d.checkedAt);
    const reconciling=notFoundStreak<POLL_RECONCILE_MAX;
    if($('csTitle'))$('csTitle').textContent=reconciling?'受付状況を照合中':'受付状況が変更されています';
    if($('csMessage'))$('csMessage').textContent=reconciling?`受付番号は保存済みです。全ての受付枠から最新状態を探しています（${notFoundStreak}/${POLL_RECONCILE_MAX}）。`:'取消・終了・受付枠変更の可能性があります。受付番号は残し、自動確認を停止しました。必要なら手動で更新してください。';
    setError(reconciling?'':'新しい受付を作り直さず、この受付番号のままご確認ください。');
    const top=$('csTop');if(top){top.className=reconciling?'cs-top ok':'cs-top warn';top.querySelector('strong').textContent=reconciling?'受付状況を照合中':'受付状況が変更されています';top.querySelector('small').textContent=reconciling?'受付直後の反映待ちを自動で再確認しています。':`次回は${pollLabel(nextPollMs)}に確認します。`}
    return;
  }
  notFoundStreak=0;
  setError('');
  nextPollMs=delayForStatus(d);
  const ahead=Number.isSafeInteger(d.aheadCount)&&d.aheadCount>=0?d.aheadCount:null;
  const aheadLabel=$('csAhead')?.parentElement?.querySelector('small');
  if(aheadLabel)aheadLabel.textContent=d.queueScope==='combined-web-line'?'あなたの前（WEB＋LINE）':d.queueScope==='unverified'?'待ち順を確認中':'あなたの前';
  const m=stateMeta(d.state,ahead),box=$('csState');
  if(box)box.className='cs-state '+m.cls;
  const icon=box?.querySelector?.('.cs-state-icon');if(icon)icon.textContent=m.icon;
  if($('csTitle'))$('csTitle').textContent=m.title;
  if($('csMessage'))$('csMessage').textContent=
    d.state==='waiting'&&d.queueScope==='unverified'
      ?'WEB受付とLINE受付の待ち順を確認しています。受付番号は保持されています。'
      :m.msg;
  const showQueue=d.state==='waiting'||d.state==='calling';
  if($('csQueue'))$('csQueue').hidden=!showQueue;
  if(showQueue){if($('csAhead'))$('csAhead').textContent=ahead??'—';if($('csRank'))$('csRank').textContent=d.queueRank??'—';if($('csTotal'))$('csTotal').textContent=` / ${d.activeCount??'—'}組中`}
  if($('csChecked'))$('csChecked').textContent=fmtClock(d.checkedAt);
  if(d.state==='canceled'&&$('csHeartbeatLabel'))$('csHeartbeatLabel').textContent='取消済み・自動更新は終了しました。';
  const top=$('csTop');if(top){top.className='cs-top ok';top.querySelector('strong').textContent='AirWAITと接続中';top.querySelector('small').textContent=nextPollMs?`待ち状況に応じて${pollLabel(nextPollMs)}に自動更新します。`:'この受付は自動更新を終了しました。'}
}

async function gatewayPost(action,body={},options={}){
  if(!backendReady())throw Error('呼出状況Gatewayが設定されていません。');
  const payload={action,...body};
  const timeoutMs=Math.max(1000,Number(options?.timeoutMs||REQUEST_TIMEOUT_MS));
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),timeoutMs);
  try{
    const r=await fetch(E.backendUrl,{method:'POST',mode:'cors',credentials:'omit',cache:'no-store',signal:ctrl.signal,headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8',Accept:'application/json'},body:new URLSearchParams(Object.entries(payload).map(([k,v])=>[k,String(v??'')]))});
    let d=null;try{d=await r.json()}catch(e){if(ctrl.signal.aborted)throw e}
    if(!r.ok)throw Error(String(d?.error||`Gateway HTTP ${r.status}`));
    if(!d||typeof d!=='object')throw Error('呼出状況の応答を読み取れませんでした。');
    return d;
  }catch(e){
    if(ctrl.signal.aborted||e?.name==='AbortError')throw Error(action==='cancelReservation'?'CANCEL_REQUEST_TIMEOUT':'呼出状況の確認がタイムアウトしました。');
    throw e;
  }finally{clearTimeout(timer)}
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
  if(d.found===false)return VERIFIED_NO_SESSION;
  if(d.found!==true)throw Error('受付情報の照合結果を確認できません。');
  const session={sessionToken:String(d.sessionToken||''),businessDate:String(d.businessDate||''),receiptNo:String(d.receiptNo||''),waitTypeId:String(d.waitTypeId||''),expiresAt:Number(d.expiresAt||0),cachedAt:Date.now()};
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
  // A proven cancellation stays terminal even after reopening HOME/LINE.
  const canceled=canceledTicket();
  if(canceled){
    if(lastStatus?.state!=='canceled')applyStatus({...canceled,found:true,state:'canceled'});
    return;
  }
  // Unknown missing records stop automatic lookups; a deliberate refresh can
  // reconcile a staff-restored ticket without deleting the receipt.
  if(manual){removeKey(UNRESOLVED_KEY);notFoundStreak=0}
  else if(unresolvedTicket()){showVerifiedMissing(cachedReservation());return}
  // Only one status request per mounted screen. A manual tap while loading
  // queues ONE additional refresh instead of racing and showing stale results.
  if(activeRefreshGeneration===gen){if(manual)queuedManualRefresh=true;return}
  if(rateLimitUntil>clockTick()){
    nextPollMs=Math.max(1000,rateLimitUntil-clockTick());
    if(manual)setError('アクセス集中のため待機しています。画面は自動で再確認します。');
    scheduleNext(gen);return;
  }
  activeRefreshGeneration=gen;nextPollAt=0;lastRefreshStartedAt=clockTick();renderHeartbeat();
  if(manual)setBusy(true);
  setError('');
  try{
    let session=await ensureSession();
    if(gen!==generation||!$('csState'))return;
    if(session===VERIFIED_NO_SESSION){showVerifiedMissing(cachedReservation());return}
    if(!session){
      const cached=cachedReservation();
      nextPollMs=cached?.receiptNo?POLL_MID_MS:POLL_RATE_LIMITED_MS;
      if($('csReceipt'))$('csReceipt').textContent=String(cached.receiptNo||'—');
      if($('csWaitType'))$('csWaitType').textContent=cachedWaitType();
      if($('csTitle'))$('csTitle').textContent='本日の受付が見つかりません';
      if($('csMessage'))$('csMessage').textContent='当日受付を完了すると、ここに自動で呼出状況が表示されます。';
      setError('受付済みなのに表示されない場合は、受付番号をスタッフへお伝えください。');
      return;
    }
    if($('csReceipt'))$('csReceipt').textContent=String(session.receiptNo||'—');
    let d;
    try{d=await gatewayPost('reservationStatus',{sessionToken:session.sessionToken})}
    catch(e){
      if(/SESSION/.test(String(e?.message||''))){removeKey(SESSION_KEY);session=await recoverSession();if(gen!==generation||!$('csState'))return;if(session===VERIFIED_NO_SESSION){showVerifiedMissing(cachedReservation());return}if(!session)throw e;d=await gatewayPost('reservationStatus',{sessionToken:session.sessionToken})}
      else throw e;
    }
    if(gen!==generation||!$('csState'))return;
    applyStatus(d);
    lastRefreshSucceededAt=Date.now();hadRefreshError=false;clearThrottle();
  }catch(e){if(gen!==generation||!$('csState'))return;const code=String(e?.message||e);const throttled=/RATE_LIMITED|HTTP 429/i.test(code),auth=/LINEミニアプリ内|LINE本人確認情報/.test(code);hadRefreshError=true;nextPollMs=(throttled||auth)?POLL_RATE_LIMITED_MS:POLL_TERMINAL_MS;if(throttled)rememberThrottle();setCallVisualTone('loading');updateCallForecast(null);setError(throttled?'アクセスが集中しています。しばらくすると自動で再確認します。LINEの呼出通知もご確認ください。':auth?'LINEミニアプリから開き直して呼出状況をご確認ください。受付番号は消えません。':code);const title=$('csTitle'),message=$('csMessage');if(title)title.textContent=auth?'LINE内で受付状況をご確認ください':throttled?'アクセスが集中しています':'最新状況を確認できませんでした';if(message)message.textContent=auth?'この画面はLINEアプリ内の本人確認が必要です。':throttled?'自動で再確認しています。':'新しい情報は未確認です。LINE内から再確認してください。';const top=$('csTop');if(top){top.className='cs-top warn';top.querySelector('strong').textContent=auth?'LINEでの本人確認が必要です':'更新できませんでした';top.querySelector('small').textContent=throttled?'アクセス集中のため約90秒後に再確認します。':auth?'LINEアプリ内で開いてください。':'通信状況を確認して、もう一度お試しください。'}}
  finally{
    if(manual)setBusy(false);
    if(activeRefreshGeneration===gen)activeRefreshGeneration=-1;
    if(gen===generation&&$('csState')){
      if(queuedManualRefresh){queuedManualRefresh=false;void refreshStatus({manual:true})}
      else scheduleNext(gen);
      renderHeartbeat();
    }
  }
}

// Public, read-only AirWAIT number list. Keep personal owner-bound status separate.
// Fetch only when the visitor expands the list, and never persist other tickets.
const NUMBER_LIST_REFRESH_MS=45000;
const NUMBER_LIST_TIMEOUT_MS=21000;
const NUMBER_LIST_STATES=new Set(['calling','processing','hold','waiting']);
const NUMBER_LIST_COPY=Object.freeze({
 ja:{title:'受付番号一覧',hint:'呼出中・待機中の番号を見る',checking:'AirWAITの最新番号を確認しています…',empty:'現在、呼出中・待機中の番号はありません。',failed:'番号一覧を更新できませんでした。「更新」で再確認してください。',stale:'最新の番号を確認できません。更新して再確認してください。',updated:'最終更新',refresh:'↻ 更新',refreshing:'確認中…',calling:'呼出中',processing:'ご案内中',hold:'保留中',waiting:'待機中',live:'45秒ごとに自動更新'},
 en:{title:'Ticket numbers',hint:'See called and waiting numbers',checking:'Checking AirWAIT numbers…',empty:'No current calling or waiting numbers.',failed:'Could not refresh the list. Try Update.',stale:'Current numbers could not be verified.',updated:'Updated',refresh:'↻ Update',refreshing:'Checking…',calling:'Calling',processing:'Assisting',hold:'On hold',waiting:'Waiting',live:'Auto-updates every 45s'},
 'zh-CN':{title:'取号列表',hint:'查看叫号与等候号码',checking:'正在确认最新号码…',empty:'目前没有叫号或等候号码。',failed:'无法更新号码，请重试。',stale:'无法确认最新号码。',updated:'更新',refresh:'↻ 刷新',refreshing:'确认中…',calling:'叫号中',processing:'办理中',hold:'暂停',waiting:'等候',live:'每45秒自动更新'},
 ko:{title:'접수번호 목록',hint:'호출 중·대기 중 번호 확인',checking:'최신 번호를 확인 중…',empty:'현재 호출·대기 중인 번호가 없습니다.',failed:'목록을 새로고침할 수 없습니다.',stale:'최신 번호를 확인할 수 없습니다.',updated:'업데이트',refresh:'↻ 새로고침',refreshing:'확인 중…',calling:'호출 중',processing:'안내 중',hold:'보류',waiting:'대기 중',live:'45초마다 자동 갱신'},
 vi:{title:'Danh sách số',hint:'Xem số đang gọi và chờ',checking:'Đang kiểm tra số mới nhất…',empty:'Không có số đang gọi hoặc chờ.',failed:'Không thể cập nhật. Thử lại.',stale:'Chưa xác minh được số mới nhất.',updated:'Cập nhật',refresh:'↻ Làm mới',refreshing:'Đang kiểm tra…',calling:'Đang gọi',processing:'Đang phục vụ',hold:'Tạm giữ',waiting:'Đang chờ',live:'Tự làm mới mỗi 45 giây'},
 ne:{title:'टोकन नम्बर सूची',hint:'बोलाइएका र पर्खिरहेका नम्बर',checking:'नयाँ नम्बर जाँच हुँदैछ…',empty:'अहिले बोलाइएका वा पर्खिरहेका नम्बर छैनन्।',failed:'सूची अपडेट गर्न सकिएन।',stale:'नयाँ नम्बर पुष्टि भएन।',updated:'अपडेट',refresh:'↻ फेरि जाँच',refreshing:'जाँच हुँदै…',calling:'बोलाउँदै',processing:'सेवा हुँदै',hold:'रोकिएको',waiting:'पर्खिरहेको',live:'४५ सेकेन्डमा अद्यावधिक'},
 kmr:{title:'Lîsteya hejmarên qeydkirinê',hint:'Hejmarên hatine bangkirin û li bendê',checking:'Hejmarên nû têne kontrolkirin…',empty:'Niha hejmarên li bendê an bangkirî tune ne.',failed:'Lîste nehat nûkirin. Dîsa biceribîne.',stale:'Hejmarên nû nehatin piştrastkirin.',updated:'Nûkirin',refresh:'↻ Nû bike',refreshing:'Tê kontrolkirin…',calling:'Bang dikin',processing:'Tê pêşwazîkirin',hold:'Rawestayî',waiting:'Li bendê',live:'Her 45 çirkeyan nû dibe'}
});
function numberListLabels(){
 const lang=String(window.ASOBOON_I18N?.language||document.documentElement.lang||'ja');
 return NUMBER_LIST_COPY[lang]||NUMBER_LIST_COPY[lang.startsWith('zh')?'zh-CN':'ja'];
}
function stopNumberList(){
 numberListGeneration++;
 if(numberListTimer){clearTimeout(numberListTimer);numberListTimer=0}
 if(numberListAbort){numberListAbort.abort();numberListAbort=null}
 numberListBusy=false;
}
function numberListReset(){
 const rows=$('csNumberListGroups');if(rows)rows.replaceChildren();
 const copy=numberListLabels(),notice=$('csNumberListNotice');
 if(notice){notice.textContent=copy.hint;notice.hidden=false}
 if($('csNumberListTime'))$('csNumberListTime').textContent='—';
}
function numberListText(parent,tag,cls,text){
 const el=document.createElement(tag);if(cls)el.className=cls;el.textContent=text;parent.appendChild(el);return el;
}
function renderNumberList(data){
 const groups=$('csNumberListGroups'),notice=$('csNumberListNotice'),labels=numberListLabels();
 if(!groups||!notice)return;
 groups.replaceChildren();
 let any=false;
 for(const slot of data.slots){
  const active=(Array.isArray(slot?.rows)?slot.rows:[]).filter(r=>NUMBER_LIST_STATES.has(String(r?.state||''))&&/^[FT]?\d{1,8}$/.test(String(r?.number||'').trim()));
  if(!active.length)continue;
  any=true;
  const card=numberListText(groups,'section','cs-number-session','');
  numberListText(card,'h3','cs-number-session-title',String(slot.label||'').slice(0,60));
  const container=numberListText(card,'div','cs-number-chip-grid','');
  for(const state of ['calling','processing','hold','waiting']){
   for(const row of active.filter(x=>x.state===state)){
    const chip=numberListText(container,'div','cs-number-chip cs-number-chip--'+state,'');
    numberListText(chip,'strong','cs-number-chip-value',String(row.number).trim());
    numberListText(chip,'span','cs-number-chip-state',labels[state]);
   }
  }
 }
 notice.hidden=any;
 if(!any)notice.textContent=labels.empty;
 const clock=new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(data.fetchedAt));
 if($('csNumberListTime'))$('csNumberListTime').textContent=labels.updated+' '+clock+' · '+labels.live;
}
function scheduleNumberList(gen){
 if(numberListTimer){clearTimeout(numberListTimer);numberListTimer=0}
 if(gen!==numberListGeneration||!$('csNumberList')?.open||document.hidden)return;
 numberListTimer=setTimeout(()=>{numberListTimer=0;void refreshNumberList()},NUMBER_LIST_REFRESH_MS);
}
async function refreshNumberList(){
 const panel=$('csNumberList');if(!panel?.open||numberListBusy||document.hidden)return;
 const gen=numberListGeneration;
 numberListBusy=true;
 if(numberListTimer){clearTimeout(numberListTimer);numberListTimer=0}
 const labels=numberListLabels(),notice=$('csNumberListNotice'),groups=$('csNumberListGroups'),button=$('csNumberListRefresh');
 if(groups)groups.replaceChildren();
 if(notice){notice.hidden=false;notice.textContent=labels.checking;notice.classList.add('is-checking')}
 if(button){button.disabled=true;button.textContent=labels.refreshing}
 if($('csNumberListTime'))$('csNumberListTime').textContent='—';
 const ctrl=new AbortController();numberListAbort=ctrl;
 const timeout=setTimeout(()=>ctrl.abort(),NUMBER_LIST_TIMEOUT_MS);
 try{
  if(!backendReady())throw Error('NO_BACKEND');
  const url=new URL(E.backendUrl);url.searchParams.set('action','boardStatus');url.searchParams.set('_',String(Date.now()));
  const response=await fetch(url,{method:'GET',cache:'no-store',credentials:'omit',signal:ctrl.signal});
  if(!response.ok)throw Error('BOARD_HTTP_'+response.status);
  const data=await response.json();
  const at=Date.parse(String(data?.fetchedAt||''));
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
  const today=parts.year+'-'+parts.month+'-'+parts.day;
  if(data?.ok!==true||data.stale===true||data.isClosed===true||!Array.isArray(data.slots)||String(data.businessDate||'')!==today||!Number.isFinite(at)||Math.abs(Date.now()-at)>60000)throw Error('BOARD_NOT_VERIFIED');
  if(gen!==numberListGeneration||!$('csNumberList')?.open)return;
  renderNumberList(data);
 }catch(e){
  if(gen!==numberListGeneration||!$('csNumberList')?.open)return;
  if(groups)groups.replaceChildren();
  if(notice){notice.hidden=false;notice.textContent=String(e?.message||'')==='BOARD_NOT_VERIFIED'?labels.stale:labels.failed}
 }finally{
  clearTimeout(timeout);
  if(numberListAbort===ctrl)numberListAbort=null;
  if(gen===numberListGeneration){
   numberListBusy=false;
   if(button){button.disabled=false;button.textContent=numberListLabels().refresh}
   notice?.classList.remove('is-checking');
   scheduleNumberList(gen);
  }
 }
}
function mountNumberList(){
 stopNumberList();
 const panel=$('csNumberList');if(!panel)return;
 panel.open=false;numberListReset();
 const labels=numberListLabels();
 if($('csNumberListTitle'))$('csNumberListTitle').textContent=labels.title;
 if($('csNumberListHint'))$('csNumberListHint').textContent=labels.hint;
 if($('csNumberListRefresh'))$('csNumberListRefresh').textContent=labels.refresh;
 if(panel.dataset.bound==='1')return;
 panel.dataset.bound='1';
 panel.addEventListener('toggle',()=>{
  if(panel.open){void refreshNumberList()}
  else{stopNumberList();numberListReset()}
 });
 $('csNumberListRefresh')?.addEventListener('click',()=>void refreshNumberList());
}
function mountCallstatus(){
  setCallVisualTone('loading');
  updateCallForecast(null);
  stopPolling();
  stopReceptionWatch();
  mountNumberList();
  nextPollMs=POLL_FAR_MS;
  notFoundStreak=0;lastRefreshSucceededAt=0;restoreThrottle();hadRefreshError=rateLimitUntil>clockTick();startHeartbeat();
  const gen=generation;
  const cached=cachedReservation();
  if($('csReceipt'))$('csReceipt').textContent=String(cached.receiptNo||'—');
  if($('csWaitType'))$('csWaitType').textContent=cachedWaitType();
  $('csRefresh')?.addEventListener('click',()=>refreshStatus({manual:true}));
  $('csCancel')?.addEventListener('click',openCancelDialog);
  $('csCancelProceed')?.addEventListener('click',()=>void cancelCurrentReservation());
  document.querySelectorAll('[data-cs-cancel-close]').forEach(el=>el.addEventListener('click',closeCancelDialog));
  updateCancelAction('');
  updateRebookAction(null);
  const terminal=canceledTicket();
  if(terminal){
    applyStatus({...terminal,found:true,state:'canceled'});
    renderHeartbeat();
    return;
  }
  if(unresolvedTicket()){
    showVerifiedMissing(cached);
    renderHeartbeat();
    return;
  }
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

window.addEventListener('asoboon:language-changed',()=>{
 const panel=$('csNumberList');if(!panel)return;
 const labels=numberListLabels();
 if($('csNumberListTitle'))$('csNumberListTitle').textContent=labels.title;
 if($('csNumberListHint'))$('csNumberListHint').textContent=labels.hint;
 if($('csNumberListRefresh'))$('csNumberListRefresh').textContent=labels.refresh;
 if(panel.open){stopNumberList();void refreshNumberList()}else numberListReset();
});
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden'){
    if(numberListTimer){clearTimeout(numberListTimer);numberListTimer=0}
    if(numberListAbort){numberListAbort.abort();numberListAbort=null}
    if(pollTimer){clearTimeout(pollTimer);pollTimer=0}
    if(heartbeatTimer){clearInterval(heartbeatTimer);heartbeatTimer=0}
    nextPollAt=0;return;
  }
  if($('csState')){startHeartbeat();void refreshStatus();if($('csNumberList')?.open){stopNumberList();void refreshNumberList()}}
});
window.ASOBOON_V2_CALLSTATUS=Object.freeze({
  version:'1.9.0-stop-canceled-receipt',
  nativeCancelVersion:'1.1-long-wait',
  render:pageHtml,
  mount:mountCallstatus,
  watchReception,
  unmount,
  refresh:()=>refreshStatus({manual:true})
});
})();