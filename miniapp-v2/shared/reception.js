/* ASOBooN LINE MINI App v2 / same-app reception flow */
(()=>{'use strict';
const E=window.ASOBOON_V2_ENV||{};
const R=window.ASOBOON_V2_RULES||{};
const D=window.ASOBOON_V2_BUSINESS_DAY||{};
const CACHE_KEY='asoboon_v2_current_reservation_develop_v1';
const CALL_KEY='asoboon_v2_callstatus_develop_v1';
const PENDING_KEY='asoboon_v2_pending_reception_develop_v1';
const POST_TIMEOUT_MS=45000;
const GET_TIMEOUT_MS=5000;
const POLL_DEADLINE_MS=60000;
const SUBMIT_WATCHDOG_MS=120000;
const PENDING_TTL_MS=24*60*60*1000;
const DEVELOP_LINE_ONLY=E.environment==='develop';
const DEVELOP_TEST_ONLY=DEVELOP_LINE_ONLY&&new URLSearchParams(location.search).get('dev')==='0042'&&Boolean(E.developTestWaitType?.waitTypeId);
const S={
  mode:'web',day:null,waitTypes:null,slots:[],slot:null,
  adult:1,child:0,infant:0,agree:false,location:null,
  health:null,canCreate:false,busy:false,locked:false,recovering:false,generation:0,submitSeq:0
};
let CTX=null;
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const total=()=>S.adult+S.child+S.infant;
const kids=()=>S.child+S.infant;
const price=()=>typeof R.priceFor==='function'?R.priceFor(S):S.adult*600+S.child*900+(S.infant>0?900:0);
const maxTotal=()=>Number(R.limits?.maxTotalPeople||10);
const kidsPerAdult=()=>Number(R.limits?.childrenPerAdult||3);
const validPeople=()=>S.adult>=1&&S.child>=0&&S.infant>=0&&total()<=maxTotal()&&kids()<=S.adult*kidsPerAdult();
const fmtYen=n=>Number(n||0).toLocaleString('ja-JP')+'円';
const fmtDate=v=>{const m=String(v||'').match(/^\d{4}-(\d{2})-(\d{2})$/);return m?`${+m[1]}月${+m[2]}日`:String(v||'')};
function friendlyError(value){const code=String(value||'');const map={
  WAIT_TYPE_NOT_AVAILABLE:'選択した受付枠は現在利用できません。最新の受付状況を確認してください。',
  WAIT_TYPE_NOT_ALLOWED_FOR_DAY:'本日の受付枠ではありません。画面を開き直して最新情報をご確認ください。',
  WAIT_TYPE_MODE_MISMATCH:'受付方法と受付枠が一致していません。画面を開き直してください。',

  AIRWAIT_NO_TICKETS_TODAY:'本日の受付は現在利用できません。',
  AIRWAIT_RECEPTION_UNAVAILABLE:'本日の受付は現在利用できません。',
  AIRWAIT_PEOPLE_OVER_LIMIT:'この人数では受付できません。人数をご確認ください。',
  AIRWAIT_RECEPTION_ENDED:'本日の受付は終了しています。',
  AIRWAIT_UNAUTHORIZED_OPERATION:'受付システムに接続できません。時間をおいてもう一度お試しください。',
  AIRWAIT_UNREGISTERED_DATA:'選択した受付枠を受付システムへ登録できませんでした。最新の受付状況を確認して、もう一度お試しください。',
  AIRWAIT_WAIT_TYPE_UNUSED:'選択した受付枠は現在利用できません。画面を開き直して最新の受付状況をご確認ください。',
  AIRWAIT_OUTSIDE_RECEPTION_TIME:'現在は受付時間外です。',
  AIRWAIT_WAIT_TYPE_OUTSIDE_TIME:'選択した回は現在受付時間外です。',
  AIRWAIT_BELOW_MIN_PEOPLE:'選択した回の受付可能人数に達していません。',
  AIRWAIT_INPUT_ERROR:'受付内容を確認できません。画面を開き直してもう一度お試しください。',
  AIRWAIT_SYSTEM_ERROR:'受付システム側で一時的なエラーが発生しました。受付は成立していません。時間をおいてもう一度お試しください。',
};if(/^AIRWAIT_CREATE_ERROR_RC_/.test(code))return '受付システムから確認できないエラーが返されました。受付は成立していません。画面を開き直してもう一度お試しください。';return map[code]||code||'受付を確定できませんでした。'};

function render(){const methodBlock=DEVELOP_LINE_ONLY?'':`<div class="rec-methods"><button id="recWeb" class="rec-method active" type="button"><span>🌐</span><strong>LINE受付</strong><small>来場前にLINEミニアプリの中で受付します。</small></button><button id="recOnsite" class="rec-method onsite" type="button"><span>📍</span><strong>現地受付</strong><small>ASOBooN付近で現在地を確認して受付します。</small></button></div>`;const locationBlock=DEVELOP_LINE_ONLY?'':`<div id="recLocation" class="rec-location" hidden><p id="recLocationText">現地受付は、施設から500m以内・位置情報の精度200m以内を確認します。</p><button id="recLocationBtn" type="button">現在地を確認する</button></div>`;return `<section class="page-card"><div class="page-head orange"><small>TODAY RECEPTION / NEW HOME</small><h2>当日受付</h2></div><div class="page-body"><div class="rec-wrap">
<div id="recStatus" class="rec-status">LINE接続と受付環境を確認しています…</div>
${methodBlock}
<div id="recDay" class="rec-day"><span><small>営業区分</small><strong>確認中</strong></span><b>—</b></div>
<h3 class="rec-title">① ご利用の回</h3><div id="recSlots" class="rec-slots"><div class="rec-status">受付枠を確認しています…</div></div>
${locationBlock}
<h3 class="rec-title">② ご利用人数</h3><div class="rec-people">
<div class="rec-person"><span><strong>おとな</strong><small>600円</small></span><div class="rec-stepper"><button type="button" data-rec-k="adult" data-rec-d="-1">−</button><output id="recAdult">1</output><button type="button" data-rec-k="adult" data-rec-d="1">＋</button></div></div>
<div class="rec-person"><span><strong>こども</strong><small>6か月〜小6 / 900円</small></span><div class="rec-stepper"><button type="button" data-rec-k="child" data-rec-d="-1">−</button><output id="recChild">0</output><button type="button" data-rec-k="child" data-rec-d="1">＋</button></div></div>
<div class="rec-person"><span><strong>0〜5か月</strong><small>1人目900円 / 2人目以降無料</small></span><div class="rec-stepper"><button type="button" data-rec-k="infant" data-rec-d="-1">−</button><output id="recInfant">0</output><button type="button" data-rec-k="infant" data-rec-d="1">＋</button></div></div>
</div>
<div class="rec-summary"><div class="rec-line"><span>受付方法</span><strong id="recModeLabel">${DEVELOP_TEST_ONLY?'Developingテスト':'LINE受付'}</strong></div><div class="rec-line"><span>回</span><strong id="recSlotLabel">未選択</strong></div><div class="rec-line"><span>合計人数</span><strong id="recPeopleTotal">1名</strong></div><div class="rec-line total"><span>料金目安</span><strong id="recPrice">600円</strong></div></div>
<div id="recPeopleMsg" class="rec-status ok">この人数で受付できます。</div>
<label class="rec-agree"><input id="recAgree" type="checkbox"><span>受付内容を確認しました。</span></label>
<button id="recSubmit" class="rec-submit" type="button" disabled>受付確定（確認待ち）</button>
<div id="recResult" hidden></div>
</div></div></section>`}

function status(text,kind=''){const el=$('recStatus');if(!el)return;el.className='rec-status'+(kind?' '+kind:'');el.textContent=text}
function backendReady(){return Boolean(E.backendUrl&&/^https:\/\//.test(String(E.backendUrl)))}
function newRequestId(){try{return'v2_'+crypto.randomUUID()}catch{return'v2_'+Date.now()+'_'+Math.random().toString(36).slice(2)}}
function readPending(){try{const p=JSON.parse(localStorage.getItem(PENDING_KEY)||'null');if(!p||!p.requestId||Date.now()-Number(p.createdAt||0)>PENDING_TTL_MS){localStorage.removeItem(PENDING_KEY);return null}const phase=String(p.phase||'');if(!['prepared','dispatched','awaiting-result'].includes(phase)){localStorage.removeItem(PENDING_KEY);return null}return p}catch{try{localStorage.removeItem(PENDING_KEY)}catch{}return null}}
function recoverablePending(){const p=readPending();if(!p)return null;if(!['dispatched','awaiting-result'].includes(String(p.phase||''))){try{localStorage.removeItem(PENDING_KEY)}catch{}return null}return p}
function pendingFingerprint(body){return [body.operationalDate,body.mode,body.waitTypeId,body.adults,body.paidChildren,body.infants].map(v=>String(v??'')).join('|')}
function pendingSnapshot(body){return{operationalDate:body.operationalDate,mode:body.mode,waitTypeId:body.waitTypeId,adults:body.adults,paidChildren:body.paidChildren,infants:body.infants}}
function requestIdFor(body){const fingerprint=pendingFingerprint(body),old=readPending();if(old?.fingerprint===fingerprint){if(!old.body){try{localStorage.setItem(PENDING_KEY,JSON.stringify({...old,body:pendingSnapshot(body)}))}catch{}}return String(old.requestId)}const requestId=newRequestId();try{localStorage.setItem(PENDING_KEY,JSON.stringify({requestId,fingerprint,body:pendingSnapshot(body),phase:'prepared',createdAt:Date.now()}))}catch{}return requestId}
function setPendingPhase(requestId,phase){try{const p=readPending();if(!p||String(p.requestId)!==String(requestId))return;localStorage.setItem(PENDING_KEY,JSON.stringify({...p,phase:String(phase),updatedAt:Date.now(),...(phase==='dispatched'?{dispatchedAt:Date.now()}:{} )}))}catch{}}
function pendingBody(p=readPending()){if(!p)return null;if(p.body)return p.body;const a=String(p.fingerprint||'').split('|');if(a.length!==6)return null;return{operationalDate:a[0],mode:a[1],waitTypeId:a[2],adults:Number(a[3]),paidChildren:Number(a[4]),infants:Number(a[5])}}
function clearPending(requestId=''){try{const p=readPending();if(!requestId||!p||String(p.requestId)===String(requestId))localStorage.removeItem(PENDING_KEY)}catch{try{localStorage.removeItem(PENDING_KEY)}catch{}}}
async function withTimeout(promise,ms,message){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),ms)})])}finally{clearTimeout(timer)}}

async function fetchWithTimeout(url,options={},ms=GET_TIMEOUT_MS,message='通信がタイムアウトしました。'){
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),ms);
  try{return await fetch(url,{...options,signal:ctrl.signal})}
  catch(e){if(e?.name==='AbortError')throw Error(message);throw e}
  finally{clearTimeout(timer)}
}

async function gatewayGet(action,params={}){
  if(!backendReady())throw Error('NEW_GATEWAY_NOT_CONFIGURED');
  const u=new URL(E.backendUrl);u.searchParams.set('action',action);
  Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,String(v??'')));u.searchParams.set('_',Date.now());
  const r=await fetchWithTimeout(u,{method:'GET',mode:'cors',credentials:'omit',cache:'no-store',headers:{Accept:'application/json'}},GET_TIMEOUT_MS,'受付状況の確認がタイムアウトしました。');
  let d;try{d=await r.json()}catch{throw Error(`Gateway response invalid (${r.status})`)}
  if(!r.ok&&action!=='requestStatus')throw Error(String(d?.error||`Gateway HTTP ${r.status}`));
  return d;
}

async function pollRequest(id){
  const deadline=Date.now()+POLL_DEADLINE_MS;
  const waits=[350,650,1000,1500,2200,3000,4000];
  let i=0;
  while(Date.now()<deadline){
    await sleep(waits[Math.min(i,waits.length-1)]);i+=1;
    try{
      const r=await gatewayGet('requestStatus',{requestId:id});
      if(r&&r.found)return{...r,_requestId:id};
    }catch{}
  }
  const e=Error('受付結果を確認できません。AirWAIT側で成立している可能性があるため、新しい受付は行わないでください。');
  e.ambiguous=true;e.requestId=id;
  throw e;
}

async function post(action,body){
  const isCreate=action==='createReservation';
  const id=isCreate?requestIdFor(body):newRequestId(),payload={action,requestId:id,...body};
  const options={method:'POST',mode:'cors',credentials:'omit',cache:'no-store',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8',Accept:'application/json'},body:new URLSearchParams(Object.entries(payload).map(([k,v])=>[k,String(v??'')]))};
  let r;
  if(isCreate)setPendingPhase(id,'dispatched');
  try{
    r=await fetchWithTimeout(E.backendUrl,options,POST_TIMEOUT_MS,'受付送信の応答がタイムアウトしました。結果を確認します。');
  }catch{
    if(isCreate)setPendingPhase(id,'awaiting-result');
    return await pollRequest(id);
  }
  let d=null;try{d=await r.json()}catch{}
  if(d&&r.status!==202)return{...d,_requestId:id};
  if(isCreate)setPendingPhase(id,'awaiting-result');
  return await pollRequest(id);
}

function healthSupportsOfficialDevelop(h){
  if(!(h&&h.ok===true&&h.createRequiresVerifiedLiff===true&&h.createEnabled===true))return false;
  if(h.officialDevelopEnabled===true)return true;
  return Array.isArray(h.acceptedClientIds)&&h.acceptedClientIds.map(String).includes(String(E.channelId||''));
}
function lineState(){return typeof CTX?.lineState==='function'?CTX.lineState():{liffReady:false,inClient:false,booting:true}}
async function waitForLine(){let st=lineState();if(st.booting||!st.liffReady){await Promise.race([new Promise(resolve=>window.addEventListener('asoboon:v2-liff-ready',resolve,{once:true})),sleep(6000)]);st=lineState()}if(!st.liffReady)throw Error('LINE接続を確認できません。いったん閉じて開き直してください。');if(!st.inClient)throw Error('LINEミニアプリ内から開いてください。');if(!window.liff||!liff.isLoggedIn())throw Error('LINEログインを確認できません。')}
function developTestRule(){const t=E.developTestWaitType||{};if(E.environment!=='develop'||!t.waitTypeId)return null;return{waitTypeId:String(t.waitTypeId),label:String(t.label||'入場不可テスト'),detail:String(t.detail||'Developing専用テスト枠'),developTest:true}}
function isDevelopTestSlot(s){const t=developTestRule();return Boolean(t&&s&&String(s.waitTypeId)===String(t.waitTypeId))}
function usageAllowed(actual,{developTest=false}={}){const u=String(actual?.usageDispType||'');if(developTest)return !u||['01','02','KeyALL','KeySTORE_RECEPTION_ONLY'].includes(u);return !u||u==='01'||u==='02'||u==='KeyALL'||u==='KeySTORE_RECEPTION_ONLY'}
function buildSlots(waitTypes){const test=developTestRule(),configured=DEVELOP_TEST_ONLY?(test?[test]:[]):[...(S.day&&typeof R.slotsFor==='function'?R.slotsFor(S.day.businessType,S.mode):[])];return configured.map(rule=>{const actual=Array.isArray(waitTypes)?waitTypes.find(x=>String(x.waitTypeId||'')===String(rule.waitTypeId)):null;if(!actual)return null;if(rule.developTest){if(!usageAllowed(actual,{developTest:true}))return null;return{...rule,actual}}if(actual.dispFlg===false||!usageAllowed(actual))return null;return{...rule,actual}}).filter(Boolean)}
function renderSlots(){const el=$('recSlots');if(!el)return;const hasTest=S.slots.some(isDevelopTestSlot);if(S.day?.isClosed&&!hasTest){el.innerHTML='<div class="rec-status bad">本日は休館日です。</div>';return}if(!S.slots.length){el.innerHTML='<div class="rec-status warn">現在選択できる受付枠がありません。</div>';return}el.innerHTML=S.slots.map(s=>`<button type="button" class="rec-slot ${S.slot?.waitTypeId===s.waitTypeId?'active':''}" data-rec-slot="${esc(s.waitTypeId)}" data-rec-available="1"><strong>${esc(s.developTest?'🧪 '+s.label:s.label)}</strong><small>${esc(s.actual?.waitTypeName||s.detail||'')}</small></button>`).join('')}
function locationOk(){return DEVELOP_LINE_ONLY||S.mode!=='onsite'||Boolean(S.location?.ok)}

function renderForm(){
  if(!$('recAdult'))return;
  $('recAdult').textContent=S.adult;$('recChild').textContent=S.child;$('recInfant').textContent=S.infant;
  $('recModeLabel').textContent=DEVELOP_TEST_ONLY?'Developingテスト':S.mode==='web'?'LINE受付':'現地受付';$('recSlotLabel').textContent=S.slot?.label||'未選択';$('recPeopleTotal').textContent=total()+'名';$('recPrice').textContent=fmtYen(price());
  $('recWeb')?.classList.toggle('active',S.mode==='web');$('recOnsite')?.classList.toggle('active',S.mode==='onsite');if($('recLocation'))$('recLocation').hidden=S.mode!=='onsite';
  const peopleOK=validPeople(),msg=$('recPeopleMsg');msg.className='rec-status '+(peopleOK?'ok':'bad');msg.textContent=peopleOK?'この人数で受付できます。':`保護者1名につきお子さま3名まで、1組合計${maxTotal()}名までです。`;
  document.querySelectorAll('[data-rec-k]').forEach(b=>{const k=b.dataset.recK,d=+b.dataset.recD;if(d<0)b.disabled=k==='adult'?S.adult<=1||kids()>(S.adult-1)*kidsPerAdult():S[k]<=0;else b.disabled=total()>=maxTotal()||(k!=='adult'&&kids()>=S.adult*kidsPerAdult())});
  const testSelected=isDevelopTestSlot(S.slot);const ready=peopleOK&&S.slot&&S.day&&S.agree&&locationOk()&&(!S.day.isClosed||testSelected)&&!S.busy&&!S.locked&&S.canCreate;
  const submit=$('recSubmit');submit.disabled=!ready;submit.textContent=S.busy?'受付中…':S.canCreate&&S.day?'受付を確定する':'受付確定（確認待ち）';
}

function distanceM(a,b,c,d){const Rm=6371000,rad=x=>x*Math.PI/180,x=rad(c-a),y=rad(d-b),q=Math.sin(x/2)**2+Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(y/2)**2;return 2*Rm*Math.atan2(Math.sqrt(q),Math.sqrt(1-q))}
async function checkLocation(){const txt=$('recLocationText'),btn=$('recLocationBtn');if(!navigator.geolocation){txt.textContent='この端末では位置情報を利用できません。';return}btn.disabled=true;txt.textContent='現在地を確認しています…';try{const p=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:10000,maximumAge:0}));const g=R.geofence||{},lat=+p.coords.latitude,lng=+p.coords.longitude,accuracy=+p.coords.accuracy,age=Math.max(0,Date.now()-Number(p.timestamp||Date.now())),distance=distanceM(+g.lat,+g.lng,lat,lng),ok=distance<=Number(g.radiusM||500)&&accuracy<=Number(g.maxAccuracyM||200)&&age<=Number(g.maxAgeMs||120000);S.location={ok,lat,lng,accuracy,timestamp:Number(p.timestamp||Date.now()),distance};txt.textContent=ok?`現在地OK：施設から約${Math.round(distance)}m / 精度 約${Math.round(accuracy)}m`:`現地受付の範囲外です：距離 約${Math.round(distance)}m / 精度 約${Math.round(accuracy)}m`;txt.style.color=ok?'#286143':'#87362f'}catch{S.location=null;txt.textContent='位置情報を確認できませんでした。位置情報の許可を確認してください。'}finally{btn.disabled=false;renderForm()}}

async function boot(){
  try{localStorage.removeItem('asoboon_v2_official_web_handoff_develop_v1')}catch{}
  const gen=++S.generation;S.slot=null;S.day=null;S.waitTypes=null;S.health=null;S.canCreate=false;S.location=null;S.agree=false;S.busy=false;S.locked=false;S.recovering=false;if($('recAgree'))$('recAgree').checked=false;
  const dayEl=$('recDay');if(dayEl)dayEl.innerHTML='<span><small>営業区分</small><strong>確認中</strong></span><b>—</b>';
  status('LINE接続・営業カレンダー・受付枠を確認しています…');renderForm();

  const lineTask=withTimeout(waitForLine(),7500,'LINE接続の確認に時間がかかっています。いったん閉じて開き直してください。');
  const dayTask=typeof D.getCurrent==='function'?withTimeout(D.getCurrent({force:true}),12000,'営業カレンダーの取得がタイムアウトしました。'):Promise.reject(Error('営業カレンダー機能を読み込めませんでした。'));
  const gatewayTask=backendReady()?withTimeout(Promise.all([gatewayGet('health'),gatewayGet('waitTypes')]),9000,'受付枠の取得がタイムアウトしました。'):Promise.reject(Error('新Gatewayが設定されていません。'));
  const [lineResult,dayResult,gatewayResult]=await Promise.allSettled([lineTask,dayTask,gatewayTask]);
  if(gen!==S.generation)return;

  const lineOK=lineResult.status==='fulfilled';
  const dayOK=dayResult.status==='fulfilled';
  const gatewayOK=gatewayResult.status==='fulfilled';

  if(dayOK){
    const day=dayResult.value;S.day=day;
    if(dayEl)dayEl.innerHTML=`<span><small>${esc(fmtDate(day.operationalDate))} の営業</small><strong>${esc(day.businessType)}</strong></span><b>${esc(day.isClosed?'休館':day.durationLabel)}</b>`;
  }else if(dayEl){
    dayEl.innerHTML='<span><small>営業区分</small><strong>取得できません</strong></span><b>要再確認</b>';
    console.warn('business day unavailable',dayResult.reason);
  }

  if(gatewayOK){
    const [h,w]=gatewayResult.value;S.health=h;S.waitTypes=w&&w.ok&&Array.isArray(w.waitTypes)?w.waitTypes:null;
  }else{
    console.warn('new gateway read unavailable',gatewayResult.reason);
  }

  S.canCreate=Boolean(lineOK&&dayOK&&gatewayOK&&E.featureFlags?.receptionCreate===true&&healthSupportsOfficialDevelop(S.health));
  S.slots=buildSlots(S.waitTypes);if(DEVELOP_TEST_ONLY&&S.slots.length===1)S.slot=S.slots[0];renderSlots();renderForm();
  const pending=recoverablePending();
  if(pending?.requestId&&lineOK&&dayOK&&gatewayOK){S.locked=true;renderForm();status('前回の受付結果を確認しています。新しい受付は行わないでください。','warn');void recoverAmbiguous(String(pending.requestId));return}

  const hasTest=S.slots.some(isDevelopTestSlot);
  if(!lineOK){status(String(lineResult.reason?.message||lineResult.reason||'LINE接続を確認できません。'),'bad');return}
  if(!gatewayOK){status(`受付枠を取得できませんでした。${String(gatewayResult.reason?.message||gatewayResult.reason||'')}`,'bad');return}
  if(!dayOK){status(hasTest?'営業区分を取得できません。🧪「入場不可テスト」は表示確認できますが、受付確定は安全のため停止しています。':'営業区分を取得できません。受付確定は安全のため停止しています。','warn');return}
  if(DEVELOP_TEST_ONLY&&!S.slots.length){status('Developingテスト枠を確認できません。受付は送信していません。','bad');return}
  if(DEVELOP_TEST_ONLY&&S.canCreate&&hasTest){status('🧪 「入場不可テスト」で受付動作を確認できます。','ok');return}
  if(S.day?.isClosed&&hasTest){status('本日は休館日です。🧪 Developingテスト枠のみ確認できます。','warn');return}
  if(S.day?.isClosed){status('本日は休館日です。','warn');return}
  if(!S.slots.length){status(S.mode==='web'?'現在受付できるLINE受付枠がありません。AirWAITの受付状況をご確認ください。':'現在受付できる枠がありません。AirWAITの受付状況をご確認ください。','warn');return}
  if(S.canCreate&&hasTest){status('🧪 Developing：利用可能なテスト枠を選んで実受付テストできます。','warn');return}
  if(S.canCreate){status('LINE本人確認・営業日・Gateway接続を確認しました。受付できます。','ok');return}
  status('受付に必要な確認が完了していないため、最終確定を停止しています。','warn');
}

function saveConfirmed(rec){try{localStorage.setItem(CACHE_KEY,JSON.stringify({...rec,cachedAt:Date.now()}));localStorage.setItem(CALL_KEY,JSON.stringify({businessDate:rec.businessDate,receiptNo:String(rec.receiptNo),cachedAt:Date.now()}))}catch{}}
function confirmedRecord(r,meta={}){const adults=Number(meta.adults??S.adult??1),paidChildren=Number(meta.paidChildren??S.child??0),infants=Number(meta.infants??S.infant??0),waitTypeId=String(r.waitTypeId||meta.waitTypeId||S.slot?.waitTypeId||''),slot=S.slots.find(x=>String(x.waitTypeId)===waitTypeId);return{reserveId:r.reserveId,receiptNo:r.receiptNo,shortUrl:String(r.shortUrl||''),businessDate:String(r.businessDate||meta.operationalDate||S.day?.operationalDate||''),businessType:String(S.day?.businessType||''),mode:String(meta.mode||S.mode||'web'),waitTypeId,waitTypeLabel:String(slot?.label||S.slot?.label||''),adults,paidChildren,infants,totalPeople:adults+paidChildren+infants,totalPrice:typeof R.priceFor==='function'?R.priceFor({adult:adults,child:paidChildren,infant:infants}):adults*600+paidChildren*900+(infants>0?900:0),source:'asoboon-miniapp-v2-develop'}}
function completeConfirmed(r,meta={}){const rec=confirmedRecord(r,meta);saveConfirmed(rec);clearPending(r?._requestId||readPending()?.requestId||'');S.locked=false;S.busy=false;S.recovering=false;const result=$('recResult');if(result){result.hidden=false;result.innerHTML=`<div class="rec-result"><strong>${esc(rec.receiptNo)}</strong><span>受付番号 / 受付が完了しました</span></div>`}status('受付が完了しました。呼出状況へ移動します。','ok');renderForm();if(typeof CTX?.go==='function')setTimeout(()=>CTX.go('callstatus',{replace:true}),250)}
function bindAmbiguousRetry(requestId){const btn=$('recResult')?.querySelector?.('[data-rec-check-result]');if(btn)btn.addEventListener('click',()=>void recoverAmbiguous(requestId))}
function showRecoveryPanel(requestId,title='受付結果を確認しています。',message='同じ受付の結果だけを再確認します。受付の再送はしません。'){const id=String(requestId||'');const result=$('recResult');if(!result)return;result.hidden=false;result.innerHTML='<div class="rec-lock"><strong>'+esc(title)+'</strong><br>'+esc(message)+(id?'<button class="rec-retry" type="button" data-rec-check-result>受付結果を再確認</button>':'')+'</div>';if(id)bindAmbiguousRetry(id)}
function lockAmbiguous(requestId=''){const id=String(requestId||readPending()?.requestId||'');S.locked=true;S.busy=false;showRecoveryPanel(id,'受付結果を確認しています。新しい受付は行わないでください。','同じ受付の結果だけを再確認します。受付の再送はしません。');status('受付結果を安全に確認しています。新しい受付は行わないでください。','warn');renderForm();if(id)setTimeout(()=>void recoverAmbiguous(id),250)}
async function recoverAmbiguous(requestId){const id=String(requestId||'');if(!id||S.recovering)return;S.recovering=true;showRecoveryPanel(id,'前回の受付結果を確認しています。','新しい受付は行わず、同じ受付の結果だけを確認しています。');status('前回の受付結果を再確認しています。新しい受付は行わないでください。','warn');try{const r=await pollRequest(id);if(r&&r.ok&&r.stored&&r.receiptNo&&r.reserveId){completeConfirmed(r,pendingBody());return}if(r?.found&&r?.ambiguous===true){if(DEVELOP_TEST_ONLY&&String(pendingBody()?.waitTypeId||'')===String(E.developTestWaitType?.waitTypeId||'')){clearPending(id);S.locked=false;S.busy=false;showRecoveryPanel('','前回のテスト受付は確定できませんでした。','Developingテストのため、もう一度受付を試せます。');status('前回のテスト受付は確定できませんでした。もう一度お試しください。','warn');renderForm();return}S.locked=true;showRecoveryPanel(id,'受付処理を確認しています。','同じ受付の結果確認を続けています。新しい受付は作らないでください。');status('受付処理の確認に時間がかかっています。新しい受付は行わないでください。','warn');renderForm();return}if(r?.found&&r?.ambiguous!==true&&r?.ok===false){clearPending(id);S.locked=false;S.busy=false;status(friendlyError(r?.error||'受付は成立していません。内容を確認してもう一度お試しください。'),'bad');renderForm();return}S.locked=true;showRecoveryPanel(id,'受付結果を自動で確定できませんでした。','新しい受付は行わず、下のボタンから同じ受付結果を再確認してください。');status('受付結果を自動で確定できませんでした。下の「受付結果を再確認」をお試しください。','bad');renderForm()}catch{S.locked=true;showRecoveryPanel(id,'まだ受付結果を確認できません。','新しい受付は行わず、下のボタンから同じ受付結果を再確認してください。');status('まだ受付結果を確認できません。下の「受付結果を再確認」をお試しください。','warn');renderForm()}finally{S.recovering=false;bindAmbiguousRetry(id)}}
function lockNotificationAmbiguous(requestId){clearPending(requestId);S.locked=true;S.busy=false;const result=$('recResult');if(result){result.hidden=false;result.innerHTML='<div class="rec-lock"><strong>LINE呼出通知の準備結果を確認できませんでした。</strong><br>AirWAITへの受付送信は行っていません。ミニアプリをいったん完全に閉じて、開き直してから受付してください。</div>'}status('LINE通知の準備結果が不明です。再送せず、ミニアプリを開き直してください。','bad');renderForm()}

async function submit(){
  if($('recSubmit')?.disabled||S.busy||S.locked||!S.slot||!S.day||!S.canCreate)return;
  const seq=++S.submitSeq;
  S.busy=true;status('受付内容を最終確認しています…','warn');renderForm();
  const watchdog=setTimeout(()=>{if(seq===S.submitSeq&&S.busy)lockAmbiguous(readPending()?.requestId||'')},SUBMIT_WATCHDOG_MS);
  try{
    const latest=await withTimeout(D.getCurrent({force:true}),10000,'営業カレンダーの再確認がタイムアウトしました。受付は送信していません。');
    if(seq!==S.submitSeq||S.locked)return;
    if(latest.operationalDate!==S.day.operationalDate)throw Error('営業日が切り替わりました。もう一度確認してください。');
    if(!DEVELOP_LINE_ONLY&&S.mode==='onsite'&&!locationOk())throw Error('現在地の確認が必要です。');
    const token=String(liff.getAccessToken()||'');
    if(token.length<20)throw Error('LINE本人確認情報を取得できません。');
    const loc=DEVELOP_LINE_ONLY?{}:(S.location||{});
    status('受付方法を確認しています…','warn');
    const r=await post('createReservation',{mode:S.mode,adults:S.adult,paidChildren:S.child,infants:S.infant,waitTypeId:S.slot.waitTypeId,operationalDate:S.day.operationalDate,liffAccessToken:token,latitude:loc.lat||'',longitude:loc.lng||'',accuracy:loc.accuracy||'',locationTimestamp:loc.timestamp||''});
    if(seq!==S.submitSeq||S.locked)return;
    if(r?.notificationAmbiguous){lockNotificationAmbiguous(r?._requestId);return}
    if(r?.ambiguous||/AMBIGUOUS|RESULT_UNKNOWN|MANUAL_REVIEW/.test(String(r?.error||r?.message||''))){lockAmbiguous(r?._requestId||readPending()?.requestId||'');return}
    if(!(r&&r.ok&&r.stored&&r.receiptNo&&r.reserveId&&String(r.businessDate||'')===S.day.operationalDate)){clearPending(r?._requestId);throw Error(friendlyError(r?.error||'受付結果が不正です。'))}
    completeConfirmed(r,{operationalDate:S.day.operationalDate,mode:S.mode,waitTypeId:S.slot.waitTypeId,adults:S.adult,paidChildren:S.child,infants:S.infant});
  }catch(e){
    if(seq!==S.submitSeq)return;
    if(e?.ambiguous){lockAmbiguous(e?.requestId||readPending()?.requestId||'');return}
    S.busy=false;status(String(e?.message||e),'bad');renderForm();
  }finally{
    clearTimeout(watchdog);
  }
}

function setMode(mode){S.mode=mode==='onsite'?'onsite':'web';S.slot=null;S.location=null;S.slots=buildSlots(S.waitTypes);renderSlots();renderForm()}
function mount(ctx){CTX=ctx||{};$('recWeb')?.addEventListener('click',()=>setMode('web'));$('recOnsite')?.addEventListener('click',()=>setMode('onsite'));$('recLocationBtn')?.addEventListener('click',checkLocation);$('recAgree')?.addEventListener('change',e=>{S.agree=Boolean(e.target.checked);renderForm()});$('recSubmit')?.addEventListener('click',submit);document.querySelector('.view')?.addEventListener('click',e=>{const slot=e.target.closest?.('[data-rec-slot]');if(slot){S.slot=S.slots.find(x=>String(x.waitTypeId)===String(slot.dataset.recSlot))||null;renderSlots();renderForm();return}const b=e.target.closest?.('[data-rec-k]');if(!b||b.disabled)return;const k=b.dataset.recK,d=Number(b.dataset.recD),prev={adult:S.adult,child:S.child,infant:S.infant};S[k]=Math.max(k==='adult'?1:0,Number(S[k])+d);if(!validPeople())Object.assign(S,prev);renderForm()});renderForm();void boot()}
window.ASOBOON_V2_RECEPTION=Object.freeze({version:'2.1.0-dispatch-proof',render,mount});
})();
