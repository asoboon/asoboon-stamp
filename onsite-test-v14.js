(()=>{
'use strict';
const $=id=>document.getElementById(id);
const G=window.ASOBOON_ONSITE_GATE;
const P=window.ASOBOON_RESERVATION_POLICY||{};
const RES_KEY='asoboon_current_reservation_v3';
const CALL_KEY='asoboon_callstatus_number_v4';
let ackSlot='',scheduled=false,applying=false;

const setText=(el,v)=>{if(el&&el.textContent!==String(v))el.textContent=String(v)};
const setHidden=(el,v)=>{if(el&&el.hidden!==!!v)el.hidden=!!v};
const setClass=(el,v)=>{if(el&&el.className!==v)el.className=v};
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function jstParts(){return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(x=>[x.type,x.value]))}
function todayKey(){const p=jstParts();return `${p.year}-${p.month}-${p.day}`}
function todayLabel(){const p=jstParts();const w={Sun:'日',Mon:'月',Tue:'火',Wed:'水',Thu:'木',Fri:'金',Sat:'土'}[p.weekday]||p.weekday||'';return `${Number(p.month)}/${Number(p.day)}（${w}）`}
function nowMinutes(){const p=jstParts();return Number(p.hour)*60+Number(p.minute)}
function weekdayIndex(){const p=jstParts();return {Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[p.weekday]}
function extractTime(s){s=String(s||'').normalize('NFKC');let m=s.match(/(?:^|[^\d])([01]?\d|2[0-3])\s*[:：]\s*([0-5]\d)/);if(m)return`${String(Number(m[1])).padStart(2,'0')}:${m[2]}`;m=s.match(/(?:^|[^\d])([01]?\d|2[0-3])\s*時\s*([0-5]?\d)\s*分/);if(m)return`${String(Number(m[1])).padStart(2,'0')}:${String(Number(m[2])).padStart(2,'0')}`;m=s.match(/(?:^|[^\d])([01]?\d|2[0-3])\s*時\s*半/);if(m)return`${String(Number(m[1])).padStart(2,'0')}:30`;m=s.match(/(?:^|[^\d])([01]?\d|2[0-3])\s*時/);return m?`${String(Number(m[1])).padStart(2,'0')}:00`:''}
function mins(t){const m=String(t).match(/^(\d{2}):(\d{2})$/);return m?Number(m[1])*60+Number(m[2]):null}
function slotName(b){return b?.querySelector('strong')?.textContent?.trim()||''}
function hasResult(){return ($('currentCard')&&!$('currentCard').hidden)||($('successCard')&&!$('successCard').hidden)}

function installStyle(){
  if($('asbTestV14Style'))return;
  const s=document.createElement('style');s.id='asbTestV14Style';s.textContent=`
.hero{padding-bottom:15px!important}.hero>p,.hero .daybar{display:none!important}.hero h1{margin-bottom:0!important}
.today-summary{position:relative;z-index:2;margin-top:12px;display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:11px 12px;border-radius:15px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25)}
.today-left{min-width:0}.today-date{display:block;color:#f6d98f;font-size:.68rem;font-weight:950}.today-type{display:block;margin-top:2px;color:#fff;font-size:1.06rem;font-weight:1000;line-height:1.15}.today-use{min-width:112px;padding:8px 10px;border-radius:12px;background:#fff2c9;color:#0f2b46;text-align:center}.today-use small{display:block;font-size:.56rem;font-weight:900;color:#7a5a1b}.today-use strong{display:block;margin-top:1px;font-size:.82rem;font-weight:1000;line-height:1.2}
.test-geo{margin-top:12px;padding:14px;border:2px solid #87afc7;border-radius:18px;background:linear-gradient(180deg,#f6fbff,#eaf4fa);box-shadow:0 10px 22px rgba(32,65,85,.1)}.geo-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.test-geo h2{margin:0;color:#0f2b46;font-size:1rem}.geo-rule{flex:0 0 auto;padding:4px 7px;border-radius:999px;background:#dbeaf3;color:#365b72;font-size:.58rem;font-weight:950}.test-geo p{margin:6px 0 0;color:#526d7d;font-size:.69rem;line-height:1.5;font-weight:800}.test-geo .geo-state{margin-top:9px;padding:9px 10px;border-radius:11px;background:#edf5ff;color:#315a78;font-size:.68rem;line-height:1.45;font-weight:850}.test-geo .geo-state.ok{background:#e8f6ed;color:#245f3d}.test-geo .geo-state.bad{background:#fff0ed;color:#85362e}.test-geo button{width:100%;min-height:49px;margin-top:10px;border:0;border-radius:13px;background:#173b58;color:#fff;font-weight:950}.test-geo button:disabled{opacity:.5}
.asb-slot-extra{display:block;margin-top:7px}.asb-badge{display:inline-flex;padding:4px 9px;border-radius:999px;font-size:.65rem;font-weight:1000}.asb-badge.now{background:#e1f5e8;color:#1f653f}.asb-badge.future{background:#edf3f7;color:#405b6d}.asb-badge.old{background:#eee8dc;color:#746957}.asb-help{display:block;margin-top:4px;font-size:.62rem;line-height:1.4;font-weight:800;color:#806044}.slot.asb-old{opacity:.46!important}.slot .asb-original-small{display:none!important}
.arrival-gate{margin:0 0 11px;padding:14px;border:3px solid #dc8551;border-radius:16px;background:#fff3e9;color:#633018}.arrival-gate strong{display:block;color:#9b3e10}.arrival-gate p{margin:6px 0 0;font-size:.71rem;line-height:1.6;font-weight:800}.arrival-gate-actions{display:grid;gap:7px;margin-top:10px}.arrival-gate button{min-height:48px;border-radius:12px;font-weight:950}.arrival-yes{border:0;background:#d46b27;color:#fff}.arrival-no{border:1px solid #d7c7aa;background:#f5ead9;color:#0f2b46}
@media(max-width:370px){.today-summary{grid-template-columns:1fr}.today-use{text-align:left;min-width:0}.geo-head{align-items:flex-start;flex-direction:column}}
`;document.head.appendChild(s)
}

function dayMode(){
  const key=todayKey();
  const ex=P.exceptions?.[key];
  const mode=ex?.mode || P.defaultModeByWeekday?.[weekdayIndex()];
  const label=String(P.modes?.[mode]?.label||'');
  if(/平日特定/.test(label))return{type:'平日特定日',use:'入場から3時間'};
  if(/2時間30分|土日祝/.test(label))return{type:'土日祝日',use:'入場から2時間30分'};
  if(/休館/.test(label))return{type:'休館',use:'本日は休館'};
  const names=[...document.querySelectorAll('#slotList .slot strong')].map(x=>x.textContent||'').join(' ');
  if(/平日特定/.test(names))return{type:'平日特定日',use:'入場から3時間'};
  if(/土日祝|土休日|2\.5|2時間30分/.test(names))return{type:'土日祝日',use:'入場から2時間30分'};
  if(/平日/.test(names))return{type:'平日',use:'平日営業'};
  return{type:'営業区分を確認中',use:'読み込み中'};
}
function renderSummary(){
  const hero=document.querySelector('.hero');if(!hero)return;
  let box=$('todaySummary');
  if(!box){box=document.createElement('div');box.id='todaySummary';box.className='today-summary';hero.querySelector('h1')?.insertAdjacentElement('afterend',box)}
  const d=dayMode();
  const html=`<div class="today-left"><span class="today-date">${esc(todayLabel())}</span><strong class="today-type">${esc(d.type)}</strong></div><div class="today-use"><small>利用時間</small><strong>${esc(d.use)}</strong></div>`;
  if(box.dataset.sig!==html){box.dataset.sig=html;box.innerHTML=html}
  setText($('heroTitle'),'入場する回を選ぶ');
  const kicker=document.querySelector('.kicker');if(kicker)setText(kicker,'🎫 ASOBooN 入場受付');
}

function ensureGeo(){
  let box=$('testGeoGate');if(box)return box;
  box=document.createElement('section');box.id='testGeoGate';box.className='test-geo';
  box.innerHTML='<div class="geo-head"><h2>📍 現在地を確認</h2><span class="geo-rule">9:30〜18:00・500m以内</span></div><p>現地受付のため、現在地を確認してください。</p><button id="testGeoVerify" type="button">現在地を確認する</button><div id="testGeoState" class="geo-state">確認すると受付へ進めます。</div>';
  const flow=$('receptionFlow');flow?.parentNode?.insertBefore(box,flow);
  $('testGeoVerify')?.addEventListener('click',async()=>{const b=$('testGeoVerify');if(b){b.disabled=true;setText(b,'確認中…')}await G?.verify?.();applyGate()});
  return box
}
function applyGate(){
  if(!G)return;
  const flow=$('receptionFlow'),box=ensureGeo(),btn=$('testGeoVerify'),st=$('testGeoState');if(!flow||!box)return;
  if(hasResult()){setHidden(box,true);return}
  setHidden(box,false);
  const open=G.openNow(),valid=G.valid();
  if(!open){setHidden(flow,true);if(btn){btn.disabled=true;setText(btn,'現地受付時間外')}if(st){setClass(st,'geo-state bad');setText(st,'現地受付は9:30〜18:00です。')}return}
  if(valid){setHidden(flow,false);if(btn){btn.disabled=false;setText(btn,'✓ 現在地確認済み')}if(st){setClass(st,'geo-state ok');setText(st,'✓ 現在地を確認しました。受付へ進めます。')}}
  else{setHidden(flow,true);if(btn){btn.disabled=!!G.state.checking;setText(btn,G.state.checking?'確認中…':'現在地を確認する')}if(st){setClass(st,'geo-state '+(G.state.lastError?'bad':''));setText(st,G.state.lastError||'確認すると受付へ進めます。')}}
}

function showArrivalGate(button){
  $('arrivalGateV14')?.remove();
  const list=$('slotList');if(!list)return;
  const name=slotName(button),time=extractTime(name),x=document.createElement('div');x.id='arrivalGateV14';x.className='arrival-gate';
  x.innerHTML=`<strong>⚠️ ${esc(time||name)}の回は開始済みです</strong><p>予約後すぐ呼び出される場合があります。<br><b>30分以内に受付へ来られる場合のみ</b>進んでください。</p><div class="arrival-gate-actions"><button class="arrival-yes" type="button">30分以内に行けます</button><button class="arrival-no" type="button">次の回を見る</button></div>`;
  list.parentNode.insertBefore(x,list);
  x.querySelector('.arrival-yes').onclick=()=>{ackSlot=String(button.dataset.slot||'');x.remove();button.click()};
  x.querySelector('.arrival-no').onclick=()=>{ackSlot='';x.remove();const buttons=[...list.querySelectorAll('.slot:not(:disabled)')],i=buttons.indexOf(button);buttons[i+1]?.scrollIntoView({behavior:'smooth',block:'center'})};
  x.scrollIntoView({behavior:'smooth',block:'center'})
}
function decorateSlots(){
  const list=$('slotList');if(!list)return;
  const headSmall=$('slotCard')?.querySelector('.step-head small');if(headSmall)setText(headSmall,'表示時間は入場開始時間です');
  const timed=[...list.querySelectorAll('button.slot[data-slot]')].map(b=>({b,t:mins(extractTime(slotName(b)))})).filter(x=>x.t!==null).sort((a,b)=>a.t-b.t),now=nowMinutes();
  timed.forEach((x,i)=>{
    const next=timed[i+1]?.t??null,old=next!==null&&now>=next,started=now>=x.t&&!old;
    x.b.dataset.started=started?'1':'0';x.b.dataset.old=old?'1':'0';x.b.classList.toggle('asb-old',old);
    if(old&&!x.b.disabled)x.b.disabled=true;
    const original=x.b.querySelector(':scope > small:not(.asb-help)');if(original)original.classList.add('asb-original-small');
    let extra=x.b.querySelector('.asb-slot-extra');if(!extra){extra=document.createElement('span');extra.className='asb-slot-extra';x.b.appendChild(extra)}
    let html='';
    if(old)html='<span class="asb-badge old">受付終了</span>';
    else if(started)html='<span class="asb-badge now">🟢 今すぐ入場するならこちら</span><span class="asb-help">予約後すぐ呼び出される場合があります</span>';
    else{const t=extractTime(slotName(x.b));html=`<span class="asb-badge future">${esc(t)}から入場</span>`}
    if(extra.dataset.sig!==html){extra.dataset.sig=html;extra.innerHTML=html}
  });
  renderSummary()
}

function interceptSlot(e){
  const b=e.target.closest?.('#slotList button.slot[data-slot]');if(!b)return;
  if(!G?.valid?.()){e.preventDefault();e.stopImmediatePropagation();applyGate();return}
  if(b.dataset.old==='1'){e.preventDefault();e.stopImmediatePropagation();return}
  const id=String(b.dataset.slot||'');
  if(b.dataset.started==='1'&&ackSlot!==id){e.preventDefault();e.stopImmediatePropagation();showArrivalGate(b);return}
  ackSlot=id
}
function interceptConfirm(e){if(G?.valid?.())return;e.preventDefault();e.stopImmediatePropagation();applyGate();G?.verify?.().then(applyGate)}
function syncCallStatus(){try{const r=JSON.parse(localStorage.getItem(RES_KEY)||'null');if(!r?.receiptNo)return;const next={date:todayKey(),number:String(r.receiptNo),operationalDay:String(r.operationalDay||'')},raw=JSON.stringify(next);if(localStorage.getItem(CALL_KEY)!==raw)localStorage.setItem(CALL_KEY,raw)}catch{}}
function rewriteLinks(){document.querySelectorAll('a[href]').forEach(a=>{const h=String(a.getAttribute('href')||'');if(/(?:^|\/)yobidashi\.html(?:[?#]|$)/.test(h))a.setAttribute('href','./callstatus.html')})}
function apply(){if(applying)return;applying=true;try{installStyle();renderSummary();ensureGeo();applyGate();decorateSlots();rewriteLinks();syncCallStatus()}finally{applying=false}}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;apply()})}
document.addEventListener('click',interceptSlot,true);
document.addEventListener('click',e=>{if(e.target.closest?.('#modalConfirm'))interceptConfirm(e)},true);
new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','class','disabled']});
setInterval(apply,10000);window.addEventListener('pageshow',apply);document.addEventListener('visibilitychange',()=>{if(!document.hidden)apply()});setTimeout(apply,0);
})();
