(()=>{
'use strict';

const PENDING='asoboon_reservation_rc3_pending_v1';
const $=id=>document.getElementById(id);
const C=window.ASOBOON_RECEPTION_CONFIG||{};
const P=window.ASOBOON_RESERVATION_POLICY||{};
const WAIT_INFO_URL='https://airwait.jp/WCSP/api/20160600/external/stateless/store/getWaitInfo';

let waitInfo=null;
let waitInfoAt=0;
let selectedId='';
let acknowledgedId='';
let pendingAction=null;
let refreshTimer=0;

function clearDefiniteFailure(){
  const msg=$('receptionMsg');
  if(!msg||msg.hidden||!msg.classList.contains('bad'))return;
  try{localStorage.removeItem(PENDING)}catch{}
}
function exclusive(show){
  ['currentCard','successCard','unknownCard'].forEach(id=>{
    const el=$(id);
    if(el&&id!==show)el.hidden=true;
  });
}
function reconcile(){
  clearDefiniteFailure();
  const u=$('unknownCard'),s=$('successCard'),c=$('currentCard');
  if(u&&!u.hidden){exclusive('unknownCard');return}
  if(s&&!s.hidden){exclusive('successCard');return}
  if(c&&!c.hidden)exclusive('currentCard');
}

function esc(v){
  return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function norm(v){return String(v??'').normalize('NFKC').replace(/\s+/g,'').toLowerCase()}
function jstParts(){
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{
    timeZone:P.timezone||'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',hourCycle:'h23'
  }).formatToParts(new Date()).map(x=>[x.type,x.value]));
}
function nowMinutes(){const p=jstParts();return Number(p.hour)*60+Number(p.minute)}
function extractTime(name){
  const s=String(name||'').normalize('NFKC');let m;
  m=s.match(/(?:^|[^\d])([01]?\d|2[0-3])\s*[:：]\s*([0-5]\d)/);
  if(m)return`${String(Number(m[1])).padStart(2,'0')}:${m[2]}`;
  m=s.match(/(?:^|[^\d])([01]?\d|2[0-3])\s*時\s*([0-5]?\d)\s*分/);
  if(m)return`${String(Number(m[1])).padStart(2,'0')}:${String(Number(m[2])).padStart(2,'0')}`;
  m=s.match(/(?:^|[^\d])([01]?\d|2[0-3])\s*時\s*半/);
  if(m)return`${String(Number(m[1])).padStart(2,'0')}:30`;
  return'';
}
function timeMinutes(t){const m=String(t||'').match(/^(\d{2}):(\d{2})$/);return m?Number(m[1])*60+Number(m[2]):null}
function baseDate(){const p=jstParts();return`${p.year}-${p.month}-${p.day}`}
function currentMode(){
  const base=baseDate(),[y,m,d]=base.split('-').map(Number),wd=new Date(Date.UTC(y,m-1,d,12)).getUTCDay();
  const ex=P.exceptions?.[base];
  return ex?.mode||P.defaultModeByWeekday?.[wd]||'';
}
function modeLabel(){
  const mode=currentMode();
  return String(P.modes?.[mode]?.label||({weekdaySpecial:'平日特定日',twoHalfHour:'土日祝日',closed:'休館',weekday:'平日'}[mode])||'営業日');
}
function usageText(){
  const mode=currentMode();
  const configured=Number(P.modes?.[mode]?.usageMinutes);
  const minutes=Number.isFinite(configured)&&configured>0?configured:(mode==='twoHalfHour'?150:mode==='weekdaySpecial'?180:null);
  if(minutes===180)return'3時間';
  if(minutes===150)return'2時間30分';
  if(minutes&&minutes%60===0)return`${minutes/60}時間`;
  if(minutes)return`${Math.floor(minutes/60)}時間${minutes%60}分`;
  return'';
}
function waitDetailForName(name){
  const list=Array.isArray(waitInfo?.waitDetails)?waitInfo.waitDetails:[];
  const target=norm(name);
  return list.find(x=>norm(x?.detailedWaitType)===target)||null;
}
function callingForName(name){
  const d=waitDetailForName(name);
  if(!d)return false;
  return d.detailedMaxCallingNumber!==null&&d.detailedMaxCallingNumber!==undefined&&String(d.detailedMaxCallingNumber)!=='';
}
function slotName(button){
  const strong=button?.querySelector('strong');
  return strong?strong.textContent.trim():'';
}
function slotTime(button){return timeMinutes(extractTime(slotName(button)))}
function slotIsCalling(button){return button?.dataset?.calling==='1'||callingForName(slotName(button))}
function slotHasStarted(button){
  const p=jstParts();
  if(Number(p.hour)>=Number(P.businessDayCutoffHour??18))return false;
  const t=slotTime(button);
  return t!==null&&nowMinutes()>=t;
}
function startedScheduledButtons(){
  const list=$('slotList');if(!list)return[];
  return[...list.querySelectorAll('button[data-id]')]
    .filter(b=>slotTime(b)!==null&&slotHasStarted(b))
    .sort((a,b)=>slotTime(a)-slotTime(b));
}
function slotIsExpired(button){
  if(!slotHasStarted(button))return false;
  const started=startedScheduledButtons();
  if(started.length<2)return false;
  return button!==started[started.length-1];
}
function slotNeedsArrivalWarning(button){return !slotIsExpired(button)&&(slotIsCalling(button)||slotHasStarted(button))}

function installStyles(){
  if($('asb-slot-help-style'))return;
  const style=document.createElement('style');style.id='asb-slot-help-style';
  style.textContent=`
    .business-day-test{position:relative;z-index:2;margin:12px 0 0;padding:15px 14px;border-radius:18px;background:linear-gradient(180deg,#fff8dc,#f5df9f);border:3px solid #b9872d;color:#332512;text-align:center;box-shadow:0 8px 20px rgba(56,39,16,.18)}
    .business-day-test small{display:block;font-size:.62rem;font-weight:950;letter-spacing:.08em;color:#75511d}.business-day-test strong{display:block;margin-top:2px;font-size:1.45rem;line-height:1.15;color:#173e58}.business-day-test span{display:block;margin-top:6px;font-size:.79rem;line-height:1.5;font-weight:900;color:#5d4828}.business-day-test b{font-size:1.02rem;color:#8b3f12}
    .slot-guide-test{margin:0 0 12px;padding:13px 14px;border-radius:15px;background:#f2f8ff;border:2px solid #b9d9ee;color:#24475e;font-size:.74rem;line-height:1.65}
    .slot-guide-test strong{display:block;margin-bottom:2px;font-size:.82rem;color:#173e58}.slot-guide-test b{color:#8a4b00}
    #slotList .slot{align-items:flex-start;text-align:left}#slotList .slot>strong{min-width:0}
    #slotList .slot.asb-expired{opacity:.58;filter:saturate(.55);cursor:not-allowed}
    .asb-slot-extra{display:block;margin-top:6px}.asb-slot-badge{display:inline-flex;width:max-content;max-width:100%;padding:3px 8px;border-radius:999px;font-size:.62rem;font-weight:950;line-height:1.25}
    .asb-slot-badge.now{background:#fff0d8;color:#955013}.asb-slot-badge.future{background:#eef3f7;color:#425a6c}.asb-slot-badge.calling{background:#ffe6dc;color:#a13d10}.asb-slot-badge.expired{background:#eeeae2;color:#766b5d}
    .asb-slot-help{display:block;margin-top:4px;max-width:260px;font-size:.63rem;line-height:1.45;color:#667987;font-weight:760}.asb-slot-help.calling,.asb-slot-help.now{color:#944417}
    .call-gate-test{margin:10px 0 12px;padding:15px;border-radius:17px;border:3px solid #e5844a;background:#fff5ed;color:#633018}.call-gate-test h3{margin:0 0 6px;font-size:1rem;color:#9a3f10}.call-gate-test p{margin:0;font-size:.74rem;line-height:1.7}.call-gate-test strong{color:#8c2f0d}.call-gate-actions{display:grid;gap:8px;margin-top:12px}.call-gate-test .btn{margin:0}.call-gate-note{margin-top:8px!important;font-size:.64rem!important;color:#7c5b48}
  `;
  document.head.appendChild(style);
}
function ensureBusinessDayCard(){
  installStyles();
  let card=$('businessDayTest');
  if(!card){
    card=document.createElement('div');card.id='businessDayTest';card.className='business-day-test';
    const daybar=$('dayTitle')?.closest('.daybar');
    if(daybar?.parentNode)daybar.parentNode.insertBefore(card,daybar.nextSibling);
    else $('slotList')?.closest('.card')?.prepend(card);
  }
  const use=usageText(),label=modeLabel();
  card.innerHTML=`<small>本日の営業</small><strong>${esc(label)}</strong>${use?`<span>ご入場した時間から <b>${esc(use)}</b> 遊べます</span>`:''}`;
}
function ensureGuide(){
  installStyles();ensureBusinessDayCard();
  const list=$('slotList');if(!list||!list.parentNode)return;
  let guide=$('slotGuideTest');
  if(!guide){guide=document.createElement('div');guide.id='slotGuideTest';guide.className='slot-guide-test';list.parentNode.insertBefore(guide,list)}
  guide.innerHTML=`<strong>表示時間は「入場開始時間」です。終了時間ではありません。</strong>開始時間を過ぎた回でも、現在の回であれば予約できます。<br><b>ただし開始後は、予約後すぐ呼び出される場合があります。</b>`;
}
function clearGate(){const x=$('callGateTest');if(x)x.remove();pendingAction=null}
function showGate(button,action){
  clearGate();
  const list=$('slotList');if(!list||!list.parentNode)return;
  const name=slotName(button)||'この回',time=extractTime(name),calling=slotIsCalling(button);
  const gate=document.createElement('div');gate.id='callGateTest';gate.className='call-gate-test';
  gate.innerHTML=`<h3>⚠️ ${esc(time||name)}の回は入場開始済みです</h3><p>${calling?'現在、呼び出しが進んでいます。':'この回はすでに入場開始時間を過ぎています。'}<br>予約すると、<strong>すぐに呼び出される場合があります。</strong><br>呼出後30分以内にASOBooN受付へ来られる方のみお選びください。</p><div class="call-gate-actions"><button type="button" class="btn primary" id="callGateAccept">30分以内に受付へ行けます</button><button type="button" class="btn light" id="callGateCancel">次の回を確認する</button></div><p class="call-gate-note">※ 呼出後30分を過ぎると受付はキャンセルになります。</p>`;
  list.parentNode.insertBefore(gate,list);pendingAction=action;
  $('callGateAccept').addEventListener('click',()=>{
    acknowledgedId=String(button.dataset.id||selectedId||'');
    const run=pendingAction;clearGate();if(run)run();
  });
  $('callGateCancel').addEventListener('click',()=>{acknowledgedId='';clearGate();const buttons=[...list.querySelectorAll('[data-id]')],idx=buttons.indexOf(button),next=idx>=0?buttons[idx+1]:null;next?.scrollIntoView({behavior:'smooth',block:'center'})});
  gate.scrollIntoView({behavior:'smooth',block:'center'});
}
function decorateSlots(){
  ensureGuide();
  const list=$('slotList');if(!list)return;
  const buttons=[...list.querySelectorAll('button[data-id]')];
  buttons.forEach(button=>{
    const name=slotName(button);if(!name)return;
    const calling=callingForName(name),started=slotHasStarted(button),expired=slotIsExpired(button),time=extractTime(name);
    button.dataset.calling=calling?'1':'0';
    button.dataset.started=started?'1':'0';
    button.dataset.expired=expired?'1':'0';
    if(expired){button.disabled=true;button.classList.add('asb-expired')}else button.classList.remove('asb-expired');
    let extra=button.querySelector('.asb-slot-extra');
    if(!extra){extra=document.createElement('span');extra.className='asb-slot-extra';const remain=button.querySelector('.remain');if(remain)button.insertBefore(extra,remain);else button.appendChild(extra)}
    let kind,label,help;
    if(expired){kind='expired';label='この回の受付は終了';help='現在は次の入場回をお選びください';}
    else if(calling){kind='calling';label='🔴 呼出進行中・今すぐ入場';help='予約後すぐ呼ばれる場合があります。30分以内に受付へ来られる方のみ';}
    else if(started){kind='now';label='🟠 今すぐ入場したい方';help='入場開始済みのため、予約後すぐ呼ばれる場合があります';}
    else{kind='future';label=time?`${time}以降に入場`:'この回で入場';help='表示時刻は入場開始時間です';}
    const html=`<span class="asb-slot-badge ${kind}">${esc(label)}</span><span class="asb-slot-help ${kind}">${esc(help)}</span>`;
    if(extra.dataset.signature!==html){extra.dataset.signature=html;extra.innerHTML=html}
  });
}

async function refreshWaitInfo(){
  if(!C.airwaitApiKey||!C.airwaitStoreId)return;
  try{
    const u=new URL(WAIT_INFO_URL);u.searchParams.set('key',C.airwaitApiKey);u.searchParams.set('storeId',C.airwaitStoreId);
    const res=await fetch(u.toString(),{cache:'no-store',credentials:'omit'});const d=await res.json();
    if(res.ok&&(d?.success===true||String(d?.resultCode?.code||'')==='0000')){waitInfo=d?.innerDto?.stores?.[0]||null;waitInfoAt=Date.now();decorateSlots()}
  }catch{}
}
function scheduleRefresh(){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>{decorateSlots()},30)}

function interceptSlotClick(e){
  const button=e.target.closest('button[data-id]');if(!button||button.disabled)return;
  const id=String(button.dataset.id||'');
  if(slotNeedsArrivalWarning(button)&&acknowledgedId!==id){
    e.preventDefault();e.stopImmediatePropagation();
    showGate(button,()=>button.click());return;
  }
  selectedId=id;
  if(acknowledgedId!==id)acknowledgedId='';
}
function interceptReview(e){
  if(!selectedId||acknowledgedId===selectedId)return;
  const button=[...($('slotList')?.querySelectorAll('button[data-id]')||[])].find(x=>String(x.dataset.id)===selectedId);
  if(button&&slotNeedsArrivalWarning(button)){
    e.preventDefault();e.stopImmediatePropagation();
    const yes=window.confirm('この回は入場開始時間を過ぎています。\n予約後すぐに呼び出される場合があります。\n\n呼出後30分以内にASOBooN受付へ来られますか？');
    if(yes){acknowledgedId=selectedId;e.currentTarget.click()}
  }
}
function resetSelection(){selectedId='';acknowledgedId='';clearGate()}

const root=document.body;
if(root){
  new MutationObserver(()=>{reconcile();scheduleRefresh()}).observe(root,{subtree:true,attributes:true,attributeFilter:['hidden','class'],childList:true});
}
const slotList=$('slotList');if(slotList)slotList.addEventListener('click',interceptSlotClick,true);
$('reviewBtn')?.addEventListener('click',interceptReview,true);
$('modalConfirm')?.addEventListener('click',interceptReview,true);
$('backSlots')?.addEventListener('click',resetSelection);
$('reloadSlots')?.addEventListener('click',resetSelection);

window.addEventListener('pageshow',()=>{reconcile();decorateSlots();refreshWaitInfo()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){decorateSlots();if(Date.now()-waitInfoAt>15000)refreshWaitInfo()}});
setInterval(()=>{if(!document.hidden)refreshWaitInfo()},30000);
setInterval(()=>{if(!document.hidden)decorateSlots()},15000);
setTimeout(()=>{reconcile();decorateSlots();refreshWaitInfo()},0);
})();
