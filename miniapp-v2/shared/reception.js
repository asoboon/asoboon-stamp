/* ASOBooN LINE MINI App v2 / same-app reception flow */
(()=>{'use strict';
const E=window.ASOBOON_V2_ENV||{};
const R=window.ASOBOON_V2_RULES||{};
const D=window.ASOBOON_V2_BUSINESS_DAY||{};
const CACHE_KEY='asoboon_v2_current_reservation_develop_v1';
const CALL_KEY='asoboon_v2_callstatus_develop_v1';
const S={
  mode:'web',day:null,waitTypes:null,slots:[],slot:null,
  adult:1,child:0,infant:0,agree:false,location:null,
  health:null,canCreate:false,busy:false,locked:false,generation:0
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

function render(){return `<section class="page-card"><div class="page-head orange"><small>TODAY RECEPTION / NEW HOME</small><h2>当日受付</h2></div><div class="page-body"><div class="rec-wrap">
<div id="recStatus" class="rec-status">LINE接続と営業カレンダーを確認しています…</div>
<div class="rec-methods"><button id="recWeb" class="rec-method active" type="button"><span>🌐</span><strong>LINE受付</strong><small>来場前にLINEミニアプリの中で受付します。</small></button><button id="recOnsite" class="rec-method onsite" type="button"><span>📍</span><strong>現地受付</strong><small>ASOBooN付近で現在地を確認して受付します。</small></button></div>
<div id="recDay" class="rec-day"><span><small>営業区分</small><strong>確認中</strong></span><b>—</b></div>
<h3 class="rec-title">① ご利用の回</h3><div id="recSlots" class="rec-slots"><div class="rec-status">営業区分を確認しています…</div></div>
<div id="recLocation" class="rec-location" hidden><p id="recLocationText">現地受付は、施設から500m以内・位置情報の精度200m以内を確認します。</p><button id="recLocationBtn" type="button">現在地を確認する</button></div>
<h3 class="rec-title">② ご利用人数</h3><div class="rec-people">
<div class="rec-person"><span><strong>おとな</strong><small>600円</small></span><div class="rec-stepper"><button type="button" data-rec-k="adult" data-rec-d="-1">−</button><output id="recAdult">1</output><button type="button" data-rec-k="adult" data-rec-d="1">＋</button></div></div>
<div class="rec-person"><span><strong>こども</strong><small>6か月〜小6 / 900円</small></span><div class="rec-stepper"><button type="button" data-rec-k="child" data-rec-d="-1">−</button><output id="recChild">0</output><button type="button" data-rec-k="child" data-rec-d="1">＋</button></div></div>
<div class="rec-person"><span><strong>0〜5か月</strong><small>1人目900円 / 2人目以降無料</small></span><div class="rec-stepper"><button type="button" data-rec-k="infant" data-rec-d="-1">−</button><output id="recInfant">0</output><button type="button" data-rec-k="infant" data-rec-d="1">＋</button></div></div>
</div>
<div class="rec-summary"><div class="rec-line"><span>受付方法</span><strong id="recModeLabel">LINE受付</strong></div><div class="rec-line"><span>回</span><strong id="recSlotLabel">未選択</strong></div><div class="rec-line"><span>合計人数</span><strong id="recPeopleTotal">1名</strong></div><div class="rec-line total"><span>料金目安</span><strong id="recPrice">600円</strong></div></div>
<div id="recPeopleMsg" class="rec-status ok">この人数で受付できます。</div>
<label class="rec-agree"><input id="recAgree" type="checkbox"><span>受付内容を確認しました。受付結果が不明な場合は、新しい受付を繰り返し送信しません。</span></label>
<button id="recSubmit" class="rec-submit" type="button" disabled>受付確定（Gateway接続待ち）</button>
<div class="rec-safe">🔒 AirWAIT APIキーやLINEの秘密情報はブラウザに置きません。正式な受付作成はサーバー側Gatewayだけが実行します。</div><div id="recResult" hidden></div>
</div></div></section>`}

function status(text,kind=''){const el=$('recStatus');if(!el)return;el.className='rec-status'+(kind?' '+kind:'');el.textContent=text}
function backendReady(){return Boolean(E.backendUrl&&/^https:\/\//.test(String(E.backendUrl)))}
function requestId(){try{return'v2_'+crypto.randomUUID()}catch{return'v2_'+Date.now()+'_'+Math.random().toString(36).slice(2)}}

async function gatewayGet(action,params={}){
  if(!backendReady())throw Error('NEW_GATEWAY_NOT_CONFIGURED');
  const u=new URL(E.backendUrl);u.searchParams.set('action',action);
  Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,String(v??'')));u.searchParams.set('_',Date.now());
  const r=await fetch(u,{method:'GET',mode:'cors',credentials:'omit',cache:'no-store',headers:{Accept:'application/json'}});
  let d;try{d=await r.json()}catch{throw Error(`Gateway response invalid (${r.status})`)}
  if(!r.ok&&action!=='requestStatus')throw Error(String(d?.error||`Gateway HTTP ${r.status}`));
  return d;
}

async function pollRequest(id){
  for(const ms of[400,800,1200,1800,2600,3600,5000]){await sleep(ms);try{const r=await gatewayGet('requestStatus',{requestId:id});if(r&&r.found)return r}catch{}}
  const e=Error('受付結果を確認できません。');e.ambiguous=true;throw e;
}

async function post(action,body){
  const id=requestId(),payload={action,requestId:id,...body};
  try{
    const r=await fetch(E.backendUrl,{method:'POST',mode:'cors',credentials:'omit',cache:'no-store',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8',Accept:'application/json'},body:new URLSearchParams(Object.entries(payload).map(([k,v])=>[k,String(v??'')]))});
    let d=null;try{d=await r.json()}catch{}
    if(d&&r.status!==202)return d;
    return await pollRequest(id);
  }catch{return await pollRequest(id)}
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
function allowedUsage(actual){const usage=String(actual?.usageDispType||'');return !usage||['01','02','KeyALL','KeySTORE_RECEPTION_ONLY'].includes(usage)}
function buildSlots(waitTypes){const configured=[...(typeof R.slotsFor==='function'?R.slotsFor(S.day?.businessType):[])],test=developTestRule();if(test)configured.push(test);return configured.map(rule=>{const actual=Array.isArray(waitTypes)?waitTypes.find(x=>String(x.waitTypeId||'')===String(rule.waitTypeId)):null;if(rule.developTest){if(!actual||!allowedUsage(actual))return null;return{...rule,actual}}if(actual&&(actual.dispFlg===false||!allowedUsage(actual)))return null;return{...rule,actual}}).filter(Boolean)}
function renderSlots(){const el=$('recSlots');if(!el)return;const hasTest=S.slots.some(isDevelopTestSlot);if(S.day?.isClosed&&!hasTest){el.innerHTML='<div class="rec-status bad">本日は休館日です。</div>';return}if(!S.slots.length){el.innerHTML='<div class="rec-status warn">現在選択できる受付枠がありません。</div>';return}el.innerHTML=S.slots.map(s=>`<button type="button" class="rec-slot ${S.slot?.waitTypeId===s.waitTypeId?'active':''}" data-rec-slot="${esc(s.waitTypeId)}"><strong>${esc(s.developTest?'🧪 '+s.label:s.label)}</strong><small>${esc(s.actual?.waitTypeName||s.detail||'')}</small></button>`).join('')}
function locationOk(){return S.mode!=='onsite'||Boolean(S.location?.ok)}

function renderForm(){
  if(!$('recAdult'))return;
  $('recAdult').textContent=S.adult;$('recChild').textContent=S.child;$('recInfant').textContent=S.infant;
  $('recModeLabel').textContent=S.mode==='web'?'LINE受付':'現地受付';$('recSlotLabel').textContent=S.slot?.label||'未選択';$('recPeopleTotal').textContent=total()+'名';$('recPrice').textContent=fmtYen(price());
  $('recWeb').classList.toggle('active',S.mode==='web');$('recOnsite').classList.toggle('active',S.mode==='onsite');$('recLocation').hidden=S.mode!=='onsite';
  const peopleOK=validPeople(),msg=$('recPeopleMsg');msg.className='rec-status '+(peopleOK?'ok':'bad');msg.textContent=peopleOK?'この人数で受付できます。':`保護者1名につきお子さま3名まで、1組合計${maxTotal()}名までです。`;
  document.querySelectorAll('[data-rec-k]').forEach(b=>{const k=b.dataset.recK,d=+b.dataset.recD;if(d<0)b.disabled=k==='adult'?S.adult<=1||kids()>(S.adult-1)*kidsPerAdult():S[k]<=0;else b.disabled=total()>=maxTotal()||(k!=='adult'&&kids()>=S.adult*kidsPerAdult())});
  const testSelected=isDevelopTestSlot(S.slot);const ready=peopleOK&&S.slot&&S.agree&&locationOk()&&(!S.day?.isClosed||testSelected)&&!S.busy&&!S.locked&&S.canCreate;
  const submit=$('recSubmit');submit.disabled=!ready;submit.textContent=S.busy?'受付中…':S.canCreate?'受付を確定する':'受付確定（Gateway接続待ち）';
}

function distanceM(a,b,c,d){const Rm=6371000,rad=x=>x*Math.PI/180,x=rad(c-a),y=rad(d-b),q=Math.sin(x/2)**2+Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(y/2)**2;return 2*Rm*Math.atan2(Math.sqrt(q),Math.sqrt(1-q))}
async function checkLocation(){const txt=$('recLocationText'),btn=$('recLocationBtn');if(!navigator.geolocation){txt.textContent='この端末では位置情報を利用できません。';return}btn.disabled=true;txt.textContent='現在地を確認しています…';try{const p=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:10000,maximumAge:0}));const g=R.geofence||{},lat=+p.coords.latitude,lng=+p.coords.longitude,accuracy=+p.coords.accuracy,age=Math.max(0,Date.now()-Number(p.timestamp||Date.now())),distance=distanceM(+g.lat,+g.lng,lat,lng),ok=distance<=Number(g.radiusM||500)&&accuracy<=Number(g.maxAccuracyM||200)&&age<=Number(g.maxAgeMs||120000);S.location={ok,lat,lng,accuracy,timestamp:Number(p.timestamp||Date.now()),distance};txt.textContent=ok?`現在地OK：施設から約${Math.round(distance)}m / 精度 約${Math.round(accuracy)}m`:`現地受付の範囲外です：距離 約${Math.round(distance)}m / 精度 約${Math.round(accuracy)}m`;txt.style.color=ok?'#286143':'#87362f'}catch{S.location=null;txt.textContent='位置情報を確認できませんでした。位置情報の許可を確認してください。'}finally{btn.disabled=false;renderForm()}}

async function boot(){
  const gen=++S.generation;S.slot=null;S.day=null;S.waitTypes=null;S.health=null;S.canCreate=false;S.location=null;S.agree=false;S.busy=false;S.locked=false;if($('recAgree'))$('recAgree').checked=false;
  status('LINE接続と営業カレンダーを確認しています…');renderForm();
  try{
    await waitForLine();const day=await D.getCurrent({force:true});if(gen!==S.generation)return;S.day=day;
    $('recDay').innerHTML=`<span><small>${esc(fmtDate(day.operationalDate))} の営業</small><strong>${esc(day.businessType)}</strong></span><b>${esc(day.isClosed?'休館':day.durationLabel)}</b>`;
    if(day.isClosed)status('本日は休館日です。Developingテスト枠のみ確認できます。','warn');
    if(backendReady()){
      try{const [h,w]=await Promise.all([gatewayGet('health'),gatewayGet('waitTypes')]);S.health=h;S.waitTypes=w&&w.ok&&Array.isArray(w.waitTypes)?w.waitTypes:null;S.canCreate=E.featureFlags?.receptionCreate===true&&healthSupportsOfficialDevelop(h)}catch(e){console.warn('new gateway read unavailable',e)}
    }
    S.slots=buildSlots(S.waitTypes);renderSlots();renderForm();
    if(S.canCreate&&S.slots.some(isDevelopTestSlot))status('🧪 Developing：AirWAIT現地枠「入場不可テスト」を選んで実受付テストできます。','warn');
    else if(S.canCreate)status('LINE本人確認・営業日・Gateway接続を確認しました。受付できます。','ok');
    else status('受付画面は新HOMEへ統合済みです。安全な新Gatewayの接続・確認が終わるまで、最終確定だけ停止しています。','warn');
  }catch(e){status(String(e?.message||e),'bad');S.slots=[];renderSlots();renderForm()}
}

function saveConfirmed(rec){try{localStorage.setItem(CACHE_KEY,JSON.stringify({...rec,cachedAt:Date.now()}));localStorage.setItem(CALL_KEY,JSON.stringify({businessDate:rec.businessDate,receiptNo:String(rec.receiptNo),cachedAt:Date.now()}))}catch{}}
function lockAmbiguous(){S.locked=true;S.busy=false;const result=$('recResult');result.hidden=false;result.innerHTML='<div class="rec-lock"><strong>受付結果を確認しています。新しい受付は行わないでください。</strong><br>AirWAIT側だけ受付が成立している可能性があります。自動再送は停止しました。</div>';status('受付結果が不明なため、安全のため再受付をロックしました。','bad');renderForm()}
async function submit(){if($('recSubmit')?.disabled||S.busy||S.locked||!S.slot||!S.day||!S.canCreate)return;S.busy=true;renderForm();try{const latest=await D.getCurrent({force:true});if(latest.operationalDate!==S.day.operationalDate)throw Error('営業日が切り替わりました。もう一度確認してください。');if(S.mode==='onsite'&&!locationOk())throw Error('現在地の確認が必要です。');const token=String(liff.getAccessToken()||'');if(token.length<20)throw Error('LINE本人確認情報を取得できません。');const loc=S.location||{};const r=await post('createReservation',{mode:S.mode,adults:S.adult,paidChildren:S.child,infants:S.infant,waitTypeId:S.slot.waitTypeId,operationalDate:S.day.operationalDate,liffAccessToken:token,latitude:loc.lat||'',longitude:loc.lng||'',accuracy:loc.accuracy||'',locationTimestamp:loc.timestamp||''});if(r?.ambiguous||/AMBIGUOUS|RESULT_UNKNOWN|MANUAL_REVIEW/.test(String(r?.error||r?.message||''))){lockAmbiguous();return}if(!(r&&r.ok&&r.stored&&r.receiptNo&&r.reserveId&&String(r.businessDate||'')===S.day.operationalDate))throw Error(String(r?.error||'受付結果が不正です。'));const rec={reserveId:r.reserveId,receiptNo:r.receiptNo,shortUrl:String(r.shortUrl||''),businessDate:S.day.operationalDate,businessType:S.day.businessType,mode:S.mode,waitTypeId:S.slot.waitTypeId,waitTypeLabel:S.slot.label,adults:S.adult,paidChildren:S.child,infants:S.infant,totalPeople:total(),totalPrice:price(),source:'asoboon-miniapp-v2-develop'};saveConfirmed(rec);const result=$('recResult');result.hidden=false;result.innerHTML=`<div class="rec-result"><strong>${esc(rec.receiptNo)}</strong><span>受付番号 / 受付が完了しました</span></div>`;status('受付が完了しました。','ok');S.busy=false;renderForm()}catch(e){if(e?.ambiguous){lockAmbiguous();return}S.busy=false;status(String(e?.message||e),'bad');renderForm()}}
function setMode(mode){S.mode=mode==='onsite'?'onsite':'web';S.slot=null;S.location=null;S.slots=buildSlots(S.waitTypes);renderSlots();renderForm()}
function mount(ctx){CTX=ctx||{};$('recWeb')?.addEventListener('click',()=>setMode('web'));$('recOnsite')?.addEventListener('click',()=>setMode('onsite'));$('recLocationBtn')?.addEventListener('click',checkLocation);$('recAgree')?.addEventListener('change',e=>{S.agree=Boolean(e.target.checked);renderForm()});$('recSubmit')?.addEventListener('click',submit);document.querySelector('.view')?.addEventListener('click',e=>{const slot=e.target.closest?.('[data-rec-slot]');if(slot){S.slot=S.slots.find(x=>String(x.waitTypeId)===String(slot.dataset.recSlot))||null;renderSlots();renderForm();return}const b=e.target.closest?.('[data-rec-k]');if(!b||b.disabled)return;const k=b.dataset.recK,d=Number(b.dataset.recD),prev={adult:S.adult,child:S.child,infant:S.infant};S[k]=Math.max(k==='adult'?1:0,Number(S[k])+d);if(!validPeople())Object.assign(S,prev);renderForm()});renderForm();void boot()}
window.ASOBOON_V2_RECEPTION=Object.freeze({version:'1.2.0-develop-test-slot',render,mount});
})();
