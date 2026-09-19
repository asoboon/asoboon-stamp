(()=>{'use strict';
const E=window.ASOBOON_V2_ENV||{};
const F=E.featureFlags||{};
const D=window.ASOBOON_V2_BUSINESS_DAY||{};
const root=document.getElementById('app');
if(!root)return;
let latest=window.ASOBOON_HOME_STATUS_SNAPSHOT||null,day=null,dayError='',dayLoading=false,lastHero='';
const params=()=>new URLSearchParams(location.search);
const currentView=()=>String(params().get('view')||'home');
const feature=name=>F[name]===true;
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const setText=(el,text)=>{if(el&&el.textContent!==text)el.textContent=text};
function nowJst(){const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(x=>[x.type,x.value]));return{date:`${p.year}-${p.month}-${p.day}`,minutes:Number(p.hour)*60+Number(p.minute)}}
function clockMinutes(v){const m=String(v||'').match(/^(\d{1,2}):(\d{2})$/);return m?Number(m[1])*60+Number(m[2]):NaN}
function availability(){
  if(dayError)return{type:'error',label:'確認中',title:'営業情報を確認できません',message:'受付画面で最新の営業情報をご確認ください。'};
  if(!day)return{type:'loading',label:'確認中',title:'本日の営業を確認しています',message:'営業カレンダーを確認しています。'};
  const now=nowJst();
  if(String(day.operationalDate||'')!==now.date)return{type:'ended',label:'受付終了',title:'本日の当日受付は終了しました',message:'次の営業日にご利用ください。'};
  if(day.isClosed)return{type:'closed',label:'休館日',title:'本日は休館日です',message:'次の営業日にお待ちしています。'};
  const close=clockMinutes(day.closingTime);
  if(Number.isFinite(close)&&now.minutes>=close)return{type:'ended',label:'受付終了',title:'本日の受付は終了しました',message:'次の営業日にご利用ください。'};
  if(String(day.businessType||'')==='平日')return now.minutes<570
    ?{type:'onsite-before',label:'現地受付',title:'本日は現地受付です',message:'現地受付は9:30から。ASOBooN入口で受付してください。'}
    :{type:'onsite',label:'現地受付',title:'本日は現地受付です',message:'LINE当日受付は行っていません。ASOBooN入口で受付してください。'};
  if(now.minutes<420)return{type:'before',label:'受付開始前',title:'LINE当日受付は7:00から',message:'7:00になると、この画面から順番を取れます。'};
  return{type:'open'};
}
function round5(x){return Math.max(5,Math.round(x/5)*5)}
function etaText(n){if(n<=5)return'まもなく';const c=Math.max(1,n*.30);if(c<=4)return'約5分以内';let lo=round5(c*.83),hi=round5(c*1.17);if(hi<=lo)hi=lo+5;return`約${lo}〜${hi}分`}
function icon(kind){const m={first:'<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3" stroke="currentColor" stroke-width="2"/><path d="M6 20c.4-4 2.4-6 6-6s5.6 2 6 6" stroke="currentColor" stroke-width="2"/></svg>',price:'<svg viewBox="0 0 24 24" fill="none"><path d="M5 5h14v14H5zM8 9h8M8 13h8M8 17h5" stroke="currentColor" stroke-width="2"/></svg>',parking:'<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" stroke-width="2"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9" stroke="currentColor" stroke-width="2"/></svg>',rules:'<svg viewBox="0 0 24 24" fill="none"><path d="M7 4h10v16H7zM9 9l1.5 1.5L14 7M9 15h6" stroke="currentColor" stroke-width="2"/></svg>',entry:'<svg viewBox="0 0 24 24" fill="none"><path d="M5 20V4h11v16M9 12h10M16 9l3 3-3 3" stroke="currentColor" stroke-width="2"/></svg>',game:'🎮',omikuji:'🎯',stamp:'🔩'};return m[kind]||''}
function guideCard(kind,title,sub,view,panel=''){return `<button class="v37-guide-card ${kind}" type="button" data-v7-view="${view}"${panel?` data-v7-panel="${panel}"`:''}><span class="v37-guide-icon">${icon(kind)}</span><span><strong>${title}</strong><small>${sub}</small></span><b>›</b></button>`}
function funCard(kind,title,view){const enabled=feature(view);return `<button class="v37-fun-card ${kind}" type="button" data-v7-view="${view}" ${enabled?'':'disabled'}><span>${icon(kind)}</span><strong>${title}</strong><small>${enabled?'あそぶ':'準備中'}</small></button>`}
function baseHome(){return `<section class="home-shell v37-home" aria-label="ASOBooN HOME">
  <section id="v37Hero" class="v37-hero loading"><div class="v37-kicker">TODAY ACTION</div><h1>本日の状況を確認しています</h1><p>確認でき次第、今日まず行うことを表示します。</p></section>
  <button id="v37Today" class="v37-today" type="button" data-v7-view="timeguide" aria-label="本日の営業・利用時間を確認"><span><small>本日の営業</small><strong>確認中</strong></span><span><small>利用時間</small><strong>—</strong></span><span><small>閉館</small><strong>—</strong></span><b>›</b></button>
  <section class="v37-guide"><header><small>GUIDE</small><h2>ASOBooNガイド</h2></header><div class="v37-guide-grid">
    ${guideCard('first','初めての方','受付から入場まで','first')}
    ${guideCard('price','料金','大人600円・子ども900円','first','price')}
    ${guideCard('parking','駐車場・アクセス','一般道・高速道路からの行き方','parking')}
    ${guideCard('rules','館内ルール','遊ぶ前に確認','rules')}
  </div>${guideCard('entry','一時退場・再入場','外出・戻るときのルール','entry')}</section>
  <section class="v37-fun"><header><small>FUN</small><h2>お楽しみ</h2></header><div>${funCard('game','ミニゲーム','game')}${funCard('omikuji','おみくじ','omikuji')}${funCard('stamp','スタンプ','stamp')}</div></section>
  </section>`}
function action(view,label,tone='dark'){return `<button class="v37-primary ${tone}" type="button" data-v7-view="${view}">${label}<span>›</span></button>`}
function heroMarkup(data={}){
  const kind=String(data.kind||'sync'),receipt=String(data.receipt||'').trim();
  if(kind==='waiting'){
    const n=Number(data.ahead);if(!Number.isFinite(n))return heroMarkup({kind:'sync',receipt});
    return{kind,html:`<div class="v37-status"><i></i><strong>順番待ち</strong>${receipt?`<span>受付番号 ${esc(receipt)}</span>`:''}</div><div class="v37-wait"><div><small>あなたの前</small><strong>${n}</strong><span>組</span></div><div><small>待ち時間の目安</small><strong>${etaText(n)}</strong></div></div><p>順番になるとLINEで呼出通知が届きます。</p>${action('callstatus','呼出状況を見る')}`};
  }
  if(kind==='calling')return{kind,html:`<div class="v37-kicker">NOW CALLING</div><h1>入場できます！</h1>${receipt?`<div class="v37-receipt">受付番号 <strong>${esc(receipt)}</strong></div>`:''}<p><strong>呼出後30分以内</strong>にASOBooN入口へお越しください。</p>${action('callstatus','受付番号・詳細を見る','green')}`};
  if(kind==='guide')return{kind,html:`<div class="v37-kicker">IN ASOBOON</div><h1>ご利用中のご案内</h1>${receipt?`<div class="v37-receipt">受付番号 <strong>${esc(receipt)}</strong></div>`:''}<p>一時退場・再入場など、利用中に必要な案内を確認できます。</p>${action('entry','一時退場・再入場を見る')}`};
  if(kind==='none'&&data.canceled){const a=availability();return{kind:'canceled',html:`<div class="v37-kicker">CANCELED</div><h1>当日受付は取消済みです</h1><p>${a.type==='open'?'もう一度順番を取る場合は、当日受付からお進みください。':esc(a.message)}</p>${a.type==='open'?action('reception','当日受付をする','orange'):''}`}}
  if(kind==='none'){
    const a=availability();
    if(a.type==='open')return{kind:'open',html:`<div class="v37-kicker">TODAY ACTION</div><h1>本日の当日受付</h1><p>利用する回と人数を選んで、LINEで順番を取ります。</p>${action('reception','当日受付をする','orange')}`};
    return{kind:a.type,html:`<div class="v37-kicker">${esc(a.label)}</div><h1>${esc(a.title)}</h1><p>${esc(a.message)}</p>${action('first','利用案内を見る')}`};
  }
  return{kind:'sync',html:`<div class="v37-kicker">TODAY ACTION</div><h1>受付状況を確認しています</h1><p>${esc(data.message||'確認でき次第、今日まず行うことを表示します。')}</p>${receipt?action('callstatus','呼出状況を確認する'):''}`};
}
function renderHero(data={}){const hero=root.querySelector('#v37Hero');if(!hero)return;const v=heroMarkup(data),sig=JSON.stringify([v.kind,data.receipt,data.ahead,data.canceled,data.message,day?.operationalDate,day?.closingTime,dayError]);if(sig===lastHero&&hero.dataset.rendered==='1')return;lastHero=sig;hero.dataset.rendered='1';hero.className=`v37-hero ${v.kind}`;hero.innerHTML=v.html}
function patchToday(){const box=root.querySelector('#v37Today');if(!box)return;const labels=box.querySelectorAll('small'),vals=box.querySelectorAll('strong');if(day){const now=nowJst();setText(labels[0],String(day.operationalDate||'')===now.date?'本日の営業':'次の営業日');setText(vals[0],day.isClosed?'休館':day.businessType||'—');setText(vals[1],day.isClosed?'—':day.durationLabel||'—');setText(vals[2],day.isClosed?'—':day.closingTime||'—');box.classList.toggle('closed',Boolean(day.isClosed));return}setText(vals[0],dayError?'確認できません':'確認中');setText(vals[1],'—');setText(vals[2],'—')}
function mount(){if(currentView()!=='home'){document.body.classList.remove('v37-home-active');return}const existing=root.querySelector('.v37-home');if(!existing){const old=root.querySelector('.home-shell');if(!old)return;old.outerHTML=baseHome()}document.body.classList.remove('v35-home-active');document.body.classList.add('v37-home-active');const brand=document.querySelector('.brand small');setText(brand,'川口ハイウェイオアシス');patchToday();if(!latest&&window.ASOBOON_HOME_STATUS_SNAPSHOT)latest=window.ASOBOON_HOME_STATUS_SNAPSHOT;renderHero(latest||{kind:'sync'})}
async function refreshDay(force=false){if(dayLoading||typeof D.getCurrent!=='function')return;dayLoading=true;dayError='';try{day=await Promise.race([D.getCurrent({force}),new Promise((_,reject)=>setTimeout(()=>reject(Error('BUSINESS_DAY_HOME_TIMEOUT')),4500))]);if(!day?.ok)throw Error('BUSINESS_DAY_UNAVAILABLE')}catch(e){day=null;dayError=String(e?.message||e||'BUSINESS_DAY_UNAVAILABLE')}finally{dayLoading=false;if(currentView()==='home'){lastHero='';patchToday();renderHero(latest||{kind:'none'})}}}
window.addEventListener('asoboon:v8-home-status',e=>{latest=e.detail||{kind:'sync'};if(currentView()==='home'){lastHero='';mount()}});
window.addEventListener('asoboon:v2-route-rendered',()=>{lastHero='';mount()});
window.addEventListener('focus',()=>{if(currentView()==='home')void refreshDay(true)});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&currentView()==='home')void refreshDay(true)});
mount();void refreshDay(false);
})();
