(()=>{'use strict';
const E=window.ASOBOON_V2_ENV||{};
const F=E.featureFlags||{};
const D=window.ASOBOON_V2_BUSINESS_DAY||{};
const root=document.getElementById('app');
if(!root)return;

let latestStatus=window.ASOBOON_HOME_STATUS_SNAPSHOT||null;
let day=null,dayError='',dayLoading=false,lastHeroKey='';

const params=()=>new URLSearchParams(location.search);
const view=()=>String(params().get('view')||'home');
const feature=name=>F[name]===true;
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const setText=(el,text)=>{if(el&&el.textContent!==text)el.textContent=text};

function nowJst(){
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{
    timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',hourCycle:'h23'
  }).formatToParts(new Date()).map(x=>[x.type,x.value]));
  return{date:`${p.year}-${p.month}-${p.day}`,minutes:Number(p.hour)*60+Number(p.minute)}
}
function clockMinutes(v){
  const m=String(v||'').match(/^(\d{1,2}):(\d{2})$/);
  return m?Number(m[1])*60+Number(m[2]):NaN
}
function availability(){
  if(dayError)return{type:'error',eyebrow:'確認中',title:'営業情報を確認できません',message:'受付画面で最新の営業情報をご確認ください。'};
  if(!day)return{type:'loading',eyebrow:'確認中',title:'本日の営業を確認しています',message:'営業カレンダーを確認しています。'};
  const now=nowJst();
  if(String(day.operationalDate||'')!==now.date)return{type:'ended',eyebrow:'受付終了',title:'本日の当日受付は終了しました',message:'次の営業日にご利用ください。'};
  if(day.isClosed)return{type:'closed',eyebrow:'休館日',title:'本日は休館日です',message:'次の営業日にお待ちしています。'};
  const close=clockMinutes(day.closingTime);
  if(Number.isFinite(close)&&now.minutes>=close)return{type:'ended',eyebrow:'受付終了',title:'本日の受付は終了しました',message:'次の営業日にご利用ください。'};
  const t=String(day.businessType||'');
  if(t==='平日'){
    if(now.minutes<570)return{type:'onsite-before',eyebrow:'現地受付',title:'通常平日は現地受付です',message:'現地受付は9:30から。ASOBooN入口でご案内します。'};
    return{type:'onsite',eyebrow:'現地受付',title:'本日は現地受付です',message:'本日はLINE当日受付を行っていません。ASOBooN入口で受付してください。'};
  }
  if(now.minutes<420)return{type:'before',eyebrow:'受付開始前',title:'LINE当日受付は7:00から',message:'7:00になると、この画面から順番を取れます。'};
  return{type:'open'};
}
function round5(x){return Math.max(5,Math.round(x/5)*5)}
function etaText(n){
  if(n<=5)return'まもなく';
  const center=Math.max(1,n*.30);
  if(center<=4)return'約5分以内';
  let lo=round5(center*.83),hi=round5(center*1.17);
  if(hi<=lo)hi=lo+5;
  return`約${lo}〜${hi}分`;
}

const HOME_BUILD='20260919-15';
function routeHref(target,panel=''){
  const base=new URL(E.endpoint||location.href,location.href);
  const u=new URL('index.html',base);
  const p=new URLSearchParams(location.search);
  const menu=String(p.get('menu')||p.get('mode')||'before')==='inside'?'inside':'before';
  u.searchParams.set('view',String(target||'home'));
  u.searchParams.set('mode',menu);
  u.searchParams.set('menu',menu);
  u.searchParams.set('build',HOME_BUILD);
  if(panel)u.searchParams.set('panel',String(panel));
  return u.href;
}

function icon(kind){
  const m={
    first:'<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3" stroke="currentColor" stroke-width="2"/><path d="M6 20c.4-4 2.4-6 6-6s5.6 2 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    price:'<svg viewBox="0 0 24 24" fill="none"><path d="M5 5h14v14H5z" stroke="currentColor" stroke-width="2"/><path d="M8 9h8M8 13h8M8 17h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    parking:'<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" stroke-width="2"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    rules:'<svg viewBox="0 0 24 24" fill="none"><path d="M7 4h10v16H7z" stroke="currentColor" stroke-width="2"/><path d="m9 9 1.5 1.5L14 7M9 15h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    entry:'<svg viewBox="0 0 24 24" fill="none"><path d="M5 20V4h11v16M9 12h10M16 9l3 3-3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    game:'<svg viewBox="0 0 24 24" fill="none"><path d="M7 9h10l2 3v6H5v-6l2-3Z" stroke="currentColor" stroke-width="2"/><path d="M8 14h3M9.5 12.5v3M15.5 13.5h.01M17.5 15.5h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    omikuji:'<svg viewBox="0 0 24 24" fill="none"><path d="M6 20h12M8 20V9h8v11M7 9h10l-1-4H8L7 9Z" stroke="currentColor" stroke-width="2"/><path d="M12 5V3" stroke="currentColor" stroke-width="2"/></svg>',
    stamp:'<svg viewBox="0 0 24 24" fill="none"><path d="M6 18h12M8 18v-4h8v4M9 14l1-7h4l1 7M9 7h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  return m[kind]||'';
}

function quick(kind,title,sub,target,panel=''){
  return `<a class="nh-quick nh-${kind}" href="${routeHref(target,panel)}">
    <span class="nh-quick-icon">${icon(kind)}</span>
    <span class="nh-quick-text"><strong>${title}</strong><small>${sub}</small></span>
    <span class="nh-arrow">›</span>
  </a>`;
}
function play(kind,title,target){
  const enabled=feature(target);
  if(!enabled)return `<button class="nh-fun nh-fun-${kind}" type="button" disabled>
    <span class="nh-fun-icon">${icon(kind)}</span>
    <strong>${title}</strong><small>準備中</small>
  </button>`;
  return `<a class="nh-fun nh-fun-${kind}" href="${routeHref(target)}">
    <span class="nh-fun-icon">${icon(kind)}</span>
    <strong>${title}</strong>
  </a>`;
}

function shell(){
  return `<main class="new-home" aria-label="ASOBooN HOME">
    <section id="nhHero" class="nh-hero nh-loading">
      <div class="nh-eyebrow">TODAY</div>
      <h1>受付状況を確認中</h1>
      <p>確認でき次第、ここに表示します。</p>
    </section>

    <a id="nhToday" class="nh-today" href="${routeHref('timeguide')}" aria-label="本日の営業・利用時間を確認">
      <span class="nh-today-cell"><small>本日の営業</small><strong>確認中</strong></span>
      <span class="nh-today-cell"><small>利用時間</small><strong>—</strong></span>
      <span class="nh-today-cell"><small>閉館</small><strong>—</strong></span>
      <span class="nh-today-arrow">›</span>
    </a>

    <section class="nh-guide" aria-labelledby="nhGuideTitle">
      <header class="nh-heading">
        <span>GUIDE</span>
        <h2 id="nhGuideTitle">ASOBooNガイド</h2>
      </header>
      <div class="nh-quick-grid">
        ${quick('first','初めての方','受付から入場まで','first')}
        ${quick('price','料金','大人600円・子ども900円','first','price')}
        ${quick('parking','駐車場・アクセス','一般道・高速道路からの行き方','parking')}
        ${quick('rules','館内ルール','遊ぶ前に確認','rules')}
      </div>
      <a class="nh-sub-link" href="${routeHref('entry')}">
        <span class="nh-sub-icon">${icon('entry')}</span>
        <span><strong>一時退場・再入場</strong><small>外出・戻るときのルール</small></span>
        <span class="nh-arrow">›</span>
      </a>
    </section>

    <section class="nh-play" aria-labelledby="nhPlayTitle">
      <header class="nh-heading">
        <span>PLAY</span>
        <h2 id="nhPlayTitle">お楽しみ</h2>
      </header>
      <div class="nh-fun-grid">
        ${play('game','ミニゲーム','game')}
        ${play('omikuji','おみくじ','omikuji')}
        ${play('stamp','スタンプ','stamp')}
      </div>
    </section>
  </main>`;
}

function heroMarkup(data={}){
  const kind=String(data.kind||'sync');

  if(kind==='waiting'){
    const n=Number(data.ahead);
    if(!Number.isFinite(n))return heroMarkup({kind:'sync',receipt:data.receipt});
    return{
      cls:'nh-waiting',
      html:`<div class="nh-statusline"><span class="nh-live-dot"></span><span>順番待ち</span></div>
        <div class="nh-wait-main">
          <div><small>あなたの前</small><strong>${n}</strong><em>組</em></div>
          <div><small>待ち時間の目安</small><strong class="nh-eta">${etaText(n)}</strong></div>
        </div>
        <p>順番になるとLINEでお知らせします。</p>
        <a class="nh-primary nh-primary-dark" href="${routeHref('callstatus')}">呼出状況を見る <span>›</span></a>`
    };
  }

  if(kind==='calling')return{
    cls:'nh-calling',
    html:`<div class="nh-eyebrow">呼出中</div><h1>入場できます！</h1>
      <p><strong>呼出後30分以内</strong>にASOBooN入口へお越しください。</p>
      <a class="nh-primary nh-primary-green" href="${routeHref('callstatus')}">受付番号・詳細を見る <span>›</span></a>`
  };

  if(kind==='guide')return{
    cls:'nh-guide-state',
    html:`<div class="nh-eyebrow">ご利用中</div><h1>ご利用中のご案内</h1>
      <p>一時退場・再入場のルールを確認できます。</p>
      <a class="nh-primary nh-primary-dark" href="${routeHref('entry')}">一時退場・再入場を見る <span>›</span></a>`
  };

  if(kind==='none'&&data.canceled){
    const a=availability();
    return{
      cls:'nh-canceled',
      html:`<div class="nh-eyebrow">取消済み</div><h1>当日受付は取り消されています</h1>
        <p>${a.type==='open'?'もう一度順番を取る場合は、当日受付からお進みください。':esc(a.message)}</p>
        ${a.type==='open'?`<a class="nh-primary nh-primary-orange" href="${routeHref('reception')}">当日受付をする <span>›</span></a>`:''}`
    };
  }

  if(kind==='none'){
    const a=availability();
    if(a.type==='open')return{
      cls:'nh-open',
      html:`<div class="nh-eyebrow">本日のご利用</div><h1>当日受付</h1>
        <p>利用する回と人数を選んで、順番を取ります。</p>
        <a class="nh-primary nh-primary-orange" href="${routeHref('reception')}">当日受付をする <span>›</span></a>`
    };
    return{
      cls:`nh-${a.type}`,
      html:`<div class="nh-eyebrow">${esc(a.eyebrow)}</div><h1>${esc(a.title)}</h1><p>${esc(a.message)}</p>
        <a class="nh-primary nh-primary-dark" href="${routeHref('first')}">利用案内を見る <span>›</span></a>`
    };
  }

  return{
    cls:'nh-sync',
    html:`<div class="nh-eyebrow">確認中</div><h1>受付状況を確認中</h1>
      <p>${esc(data.message||'確認でき次第、ここに表示します。')}</p>
      ${data.receipt?`<a class="nh-primary nh-primary-dark" href="${routeHref('callstatus')}">呼出状況を確認する <span>›</span></a>`:''}`
  };
}

function renderHero(data={}){
  const el=root.querySelector('#nhHero');
  if(!el)return;
  const v=heroMarkup(data);
  const key=JSON.stringify([v.cls,data.receipt,data.ahead,data.canceled,data.message,day?.operationalDate,day?.closingTime,dayError]);
  if(key===lastHeroKey)return;
  lastHeroKey=key;
  el.className=`nh-hero ${v.cls}`;
  el.innerHTML=v.html;
}

function patchToday(){
  const box=root.querySelector('#nhToday');
  if(!box)return;
  const labels=box.querySelectorAll('small');
  const vals=box.querySelectorAll('strong');
  if(day){
    const now=nowJst();
    setText(labels[0],String(day.operationalDate||'')===now.date?'本日の営業':'次の営業日');
    setText(vals[0],day.isClosed?'休館':day.businessType||'—');
    setText(vals[1],day.isClosed?'—':day.durationLabel||'—');
    setText(vals[2],day.isClosed?'—':day.closingTime||'—');
    box.classList.toggle('is-closed',Boolean(day.isClosed));
    return;
  }
  setText(vals[0],dayError?'確認できません':'確認中');
  setText(vals[1],'—');
  setText(vals[2],'—');
}

function mount(){
  if(view()!=='home'){
    document.body.classList.remove('new-home-active');
    return;
  }
  const host=document.getElementById('newHomeHost');
  if(!host)return;
  document.body.classList.remove('v33-route-pending','v33-boot');
  document.body.classList.add('new-home-active');
  document.body.classList.remove('v35-home-active','v34-home-active','v32-home-active','v7-home-active');
  const brandSmall=document.querySelector('.brand small');
  if(brandSmall)brandSmall.textContent='川口ハイウェイオアシス';
  if(!host.querySelector('.new-home'))host.innerHTML=shell();
  if(!latestStatus&&window.ASOBOON_HOME_STATUS_SNAPSHOT)latestStatus=window.ASOBOON_HOME_STATUS_SNAPSHOT;
  patchToday();
  renderHero(latestStatus||{kind:'sync'});
}

function businessDayWithTimeout(force=false){
  return Promise.race([
    D.getCurrent({force}),
    new Promise((_,reject)=>setTimeout(()=>reject(Error('BUSINESS_DAY_HOME_TIMEOUT')),4500))
  ]);
}

async function refreshDay(force=false){
  if(dayLoading||typeof D.getCurrent!=='function')return;
  dayLoading=true;dayError='';
  try{
    day=await businessDayWithTimeout(force);
    if(!day?.ok)throw Error('BUSINESS_DAY_UNAVAILABLE');
  }catch(e){
    day=null;dayError=String(e?.message||e||'BUSINESS_DAY_UNAVAILABLE');
  }finally{
    dayLoading=false;
    if(view()==='home'){
      lastHeroKey='';
      patchToday();
      renderHero(latestStatus||{kind:'none'});
    }
  }
}

window.addEventListener('asoboon:v8-home-status',e=>{
  latestStatus=e.detail||{kind:'sync'};
  if(view()==='home'){lastHeroKey='';mount();}
});
window.addEventListener('asoboon:v2-rendered',e=>setTimeout(()=>{
  if(String(e?.detail?.view||view())!=='home'){
    document.body.classList.remove('new-home-active');
    return;
  }
  lastHeroKey='';
  if(window.ASOBOON_HOME_STATUS_SNAPSHOT)latestStatus=window.ASOBOON_HOME_STATUS_SNAPSHOT;
  mount();
  void refreshDay(true);
},0));
window.addEventListener('focus',()=>{if(view()==='home')void refreshDay(true)});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&view()==='home')void refreshDay(true)});

mount();
void refreshDay(false);
})();