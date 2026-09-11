/* ASOBooN LINE MINI App v2 / isolated new HOME + same-app router */
(()=>{'use strict';
const C=window.ASOBOON_V2_COMMON||{};
const E=window.ASOBOON_V2_ENV||{};
const F=E.featureFlags||{};
const root=document.getElementById('app');
const state={mode:'before',view:'home',liffReady:false,inClient:false,displayName:'',bootError:'',booting:true};
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const q=()=>new URLSearchParams(location.search);
const receptionModule=()=>window.ASOBOON_V2_RECEPTION;
const callstatusModule=()=>window.ASOBOON_V2_CALLSTATUS;
const timeguideModule=()=>window.ASOBOON_V2_TIMEGUIDE;
function normalizeView(v){return Object.values(C.routes||{}).includes(String(v||''))?String(v):'home'}
function normalizeMode(v){return String(v)==='inside'?'inside':'before'}
function endpointBase(){const u=new URL(E.endpoint||location.href,location.href);u.search='';u.hash='';return u}
function isNewAppUrl(value){try{const u=new URL(String(value||''),location.href),b=endpointBase();return u.origin===b.origin&&u.pathname.startsWith(b.pathname)}catch{return false}}
function routeUrl(view,extra={}){const u=endpointBase();u.searchParams.set('view',normalizeView(view));u.searchParams.set('mode',state.mode);Object.entries(extra).forEach(([k,v])=>{if(v!==''&&v!=null)u.searchParams.set(k,String(v))});if(!isNewAppUrl(u.href))throw Error('NEW_HOME_ROUTE_ESCAPE_BLOCKED');return u.href}
function go(view,{replace=false,...extra}={}){if(!state.liffReady&&state.inClient)return;const u=routeUrl(view,extra);if(replace)history.replaceState({asoboonV2:true},'',u);else history.pushState({asoboonV2:true},'',u);readRoute();render();window.scrollTo({top:0,behavior:'smooth'})}
function setMode(mode){if(!state.liffReady&&state.inClient)return;state.mode=normalizeMode(mode);const u=new URL(routeUrl(state.view));u.searchParams.set('mode',state.mode);history.replaceState({asoboonV2:true},'',u.href);render()}
function readRoute(){const p=q();state.view=normalizeView(p.get('view'));state.mode=normalizeMode(p.get('mode'))}
function feature(route){const map={reception:'reception',callstatus:'callstatus',timeguide:'timeguide',first:'firstGuide',entry:'entryGuide',rules:'rules',stamp:'stamp',omikuji:'omikuji',game:'game',parking:'parking'};const k=map[route];return k?F[k]===true:true}
function actionCard(view,kind,title,desc,cls=''){const enabled=feature(view);return `<button class="flow-card ${cls}" data-view="${view}" type="button"><span class="mini">${esc(kind)}</span><strong>${esc(title)}</strong><p>${esc(desc)}</p><span class="arrow">›</span>${enabled?'':'<span class="soon">準備中</span>'}</button>`}
function funCard(view,emoji,title,sub){const enabled=feature(view);return `<button class="fun-card" data-view="${view}" type="button"><span class="emoji">${emoji}</span><strong>${esc(title)}</strong><small>${esc(sub)}</small>${enabled?'':'<span class="soon">統合中</span>'}</button>`}
function home(){const inside=state.mode==='inside';return `<section class="home-shell"><div class="hero ${inside?'inside':''}"><span class="hero-kicker">ASOBooN NEW HOME · ${esc(E.environmentLabel||'')}</span><h1>${inside?'館内ナビ':'来場前ナビ'}<span>受付から入場まで、ひとつのLINEミニアプリで。</span></h1><p>${inside?'入場後によく使う機能を、迷わずここから。':'新しいASOBooNの入口です。受付・呼出・入場案内をひとつにつなぎます。'}</p></div><div class="mode-toggle" aria-label="表示切替"><button type="button" data-mode="before" class="${inside?'':'active'}">🚗 来場前</button><button type="button" data-mode="inside" class="${inside?'active':''}">🎪 館内</button></div><div class="section-title">あそぶ <small>上段固定</small></div><div class="fun-grid">${funCard('game','🏎️','ミニゲーム','ブーンシリーズ')}${funCard('omikuji','🎯','おみくじ','今日の運勢')}${funCard('stamp','🔩','スタンプ','館内ラリー')}</div><div class="section-title">${inside?'館内で使う':'入場までの流れ'}</div><div class="flow-grid">${inside?`${actionCard('timeguide','PLAY TIME','何時まであそべる？','入場時刻から利用終了の目安を確認','primary')}${actionCard('rules','RULES','館内ルール','遊ぶ前に大切なルールを確認')}${actionCard('entry','ENTRY / EXIT','入退場方法','受付・退場の流れを確認')}${actionCard('callstatus','CALL STATUS','呼出状況','受付番号の現在地を確認','call')}`:`${actionCard('reception','TODAY RECEPTION','当日受付','WEB受付・現地受付をここから','primary')}${actionCard('entry','BEFORE ENTRY','入場まで','受付後から入場までの流れ')}${actionCard('first','FIRST VISIT','初めての方','料金・対象年齢・利用方法')}${actionCard('callstatus','CALL STATUS','呼出状況','順番・呼出状態を確認','call')}${actionCard('parking','ACCESS','駐車場・アクセス','川口ハイウェイオアシスへの行き方')}${actionCard('rules','RULES','館内ルール','ご利用前に確認')}`}</div><div class="notice"><strong>NEW HOME：</strong> この画面は旧HOMEとは完全分離しています。主要機能から旧HOME・旧LIFF・Purple MINI Appへ戻るリンクは持ちません。</div></section>`}
function disabledPage(view,title,icon){return `<section class="page-card"><div class="page-head"><small>ASOBooN NEW HOME / ${esc(E.environmentLabel||'')}</small><h2>${esc(title)}</h2></div><div class="disabled-card"><div class="disabled-icon">${icon}</div><h3>新HOMEへ統合中</h3><p>旧HOMEや別LIFFへ逃がさず、この新しいASOBooN MINI Appの中で完結する形に作り替えています。</p><span class="pill">${esc(view)} · SAFE HOLD</span></div></section>`}
function receptionPage(){const mod=receptionModule();return mod&&typeof mod.render==='function'?mod.render():disabledPage('reception','当日受付','🎫')}
function callstatusPage(){const mod=callstatusModule();return mod&&typeof mod.render==='function'?mod.render():disabledPage('callstatus','呼出状況','🔔')}
function timePage(){const mod=timeguideModule();return mod&&typeof mod.render==='function'?mod.render():disabledPage('timeguide','何時まであそべる？','⏱️')}
function firstPage(){return `<section class="page-card"><div class="page-head orange"><small>FIRST VISIT</small><h2>初めての方へ</h2></div><div class="page-body"><h3>ASOBooNは0歳から小学校6年生まで</h3><p>川口ハイウェイオアシス内の屋内あそび場です。保護者1名につき、お子さま3名までご利用いただけます。</p><div class="step-list"><div class="step"><b>1</b><span>LINEミニアプリから当日受付</span></div><div class="step"><b>2</b><span>呼出状況を確認しながら待機</span></div><div class="step"><b>3</b><span>呼出後30分以内を目安に受付へ</span></div><div class="step"><b>4</b><span>受付・会計後に入場</span></div></div><div class="timebox"><small>通常料金</small><strong>大人 600円 / 子ども 900円</strong><p>6か月未満は、1人目900円・2人目以降は追加料金なしです。</p></div></div></section>`}
function entryPage(){return `<section class="page-card"><div class="page-head green"><small>ENTRY / EXIT</small><h2>入退場方法</h2></div><div class="page-body"><h3>受付番号を準備して受付へ</h3><p>呼出状態になったら、受付番号を確認できる状態で受付へお越しください。</p><div class="step-list"><div class="step"><b>1</b><span>当日受付を完了する</span></div><div class="step"><b>2</b><span>LINE通知・呼出状況を確認する</span></div><div class="step"><b>3</b><span>呼出されたら受付・会計へ</span></div><div class="step"><b>4</b><span>入場後は利用時間案内を確認</span></div></div></div></section>`}
function rulesPage(){return `<section class="page-card"><div class="page-head"><small>SAFETY & PLAY</small><h2>館内ルール</h2></div><div class="page-body"><p>安全を守りながら、子ども自身が考えて挑戦できる遊びを大切にしています。</p><div class="rule-list"><div class="rule"><strong>保護者の方と一緒に</strong>お子さまから目を離さず、一緒に館内をお楽しみください。</div><div class="rule"><strong>危険な行為は止める</strong>他のお客さまにぶつかる行為や、設備の想定外利用はスタッフがお声がけします。</div><div class="rule"><strong>困った時はスタッフへ</strong>けが・迷子・体調不良などは近くのスタッフへお知らせください。</div></div></div></section>`}
function parkingPage(){return `<section class="page-card"><div class="page-head orange"><small>ACCESS</small><h2>駐車場・アクセス</h2></div><div class="page-body"><h3>川口ハイウェイオアシス内</h3><p>ASOBooNは川口ハイウェイオアシス内にあります。外部サイトを開く案内と主要機能を明確に分離します。</p><div class="rule-list"><div class="rule"><strong>主要機能ではありません</strong>地図・施設公式サイト等の外部リンクを追加する場合は、外部へ移動することを明示します。</div></div></div></section>`}
function pageFor(view){if(view==='home')return home();if(!feature(view)){const meta={reception:['当日受付','🎫'],callstatus:['呼出状況','🔔'],timeguide:['何時まであそべる？','⏱️'],stamp:['スタンプラリー','🔩'],omikuji:['おみくじ','🎯'],game:['ミニゲーム','🏎️']}[view]||[view,'🛠️'];return disabledPage(view,meta[0],meta[1])}if(view==='reception')return receptionPage();if(view==='callstatus')return callstatusPage();if(view==='first')return firstPage();if(view==='entry')return entryPage();if(view==='rules')return rulesPage();if(view==='timeguide')return timePage();if(view==='parking')return parkingPage();return disabledPage(view,view,'🛠️')}
function shell(){const homeView=state.view==='home';const lineText=state.booting?'LINE接続中':state.liffReady?(state.inClient?'LINE内':'ブラウザプレビュー'):(state.bootError?'LIFF確認エラー':'LIFF未接続');const dot=state.liffReady?(state.inClient?'ok':'warn'):(state.bootError?'warn':'');return `<div class="devbar"><span><i class="dot ${dot}"></i><b>🧪 NEW HOME · ${esc(E.environmentLabel||'ENV')}</b></span><span>${esc(lineText)} · v${esc(C.version||'')}</span></div><header class="topbar"><button class="iconbtn ${homeView?'ghost':''}" id="backBtn" type="button" aria-label="新HOMEへ戻る">‹</button><div class="brand"><strong>ASOBooN</strong><small>NEW OFFICIAL LINE MINI APP</small></div><button class="iconbtn ${homeView?'ghost':''}" data-view="home" type="button" aria-label="新HOME">⌂</button></header><main class="view active">${pageFor(state.view)}</main><footer class="footer"><b>ASOBooN NEW HOME / MINI APP v2</b><br>${esc(E.environmentLabel||'')} · isolated routing · legacy HOME blocked</footer>`}
function lineState(){return{liffReady:state.liffReady,inClient:state.inClient,bootError:state.bootError,booting:state.booting,displayName:state.displayName}}
function cleanupModules(){try{callstatusModule()?.unmount?.()}catch(e){console.warn('CALLSTATUS_UNMOUNT_FAILED',e)}try{timeguideModule()?.unmount?.()}catch(e){console.warn('TIMEGUIDE_UNMOUNT_FAILED',e)}}
function bindModule(){
  if(state.view==='reception'&&feature('reception')){
    try{receptionModule()?.mount?.({env:E,common:C,lineState,go})}catch(e){console.error('RECEPTION_MOUNT_FAILED',e)}
    try{callstatusModule()?.watchReception?.({go})}catch(e){console.error('CALLSTATUS_RECEPTION_WATCH_FAILED',e)}
  }
  if(state.view==='callstatus'&&feature('callstatus')){
    try{callstatusModule()?.mount?.({env:E,common:C,lineState,go})}catch(e){console.error('CALLSTATUS_MOUNT_FAILED',e)}
  }
  if(state.view==='timeguide'&&feature('timeguide')){
    try{timeguideModule()?.mount?.({env:E,common:C,lineState,go})}catch(e){console.error('TIMEGUIDE_MOUNT_FAILED',e)}
  }
}
function bind(){root.querySelectorAll('[data-view]').forEach(el=>el.addEventListener('click',()=>go(el.dataset.view)));root.querySelectorAll('[data-mode]').forEach(el=>el.addEventListener('click',()=>setMode(el.dataset.mode)));const back=document.getElementById('backBtn');if(back&&!back.classList.contains('ghost'))back.addEventListener('click',()=>go('home',{replace:true}));root.addEventListener('click',e=>{const a=e.target.closest?.('a[href]');if(!a)return;if(a.hasAttribute('data-external'))return;const href=a.href||a.getAttribute('href');if(href&&!isNewAppUrl(href)){e.preventDefault();e.stopPropagation();console.error('NEW_HOME_ROUTE_ESCAPE_BLOCKED',href)}},true);bindModule()}
function render(){cleanupModules();document.title='ASOBooN 新HOME｜LINEミニアプリ';root.innerHTML=shell();bind()}
function canonicalizeAfterLiff(){try{readRoute();const canonical=routeUrl(state.view);if(location.href!==canonical)history.replaceState({asoboonV2:true},'',canonical)}catch{state.bootError='NEW_HOME_ENDPOINT_INVALID'}}
async function initLiff(){
  if(!E.liffId||!window.liff){state.booting=false;state.bootError='LIFF_SDK_NOT_READY';readRoute();window.dispatchEvent(new CustomEvent('asoboon:v2-liff-ready',{detail:lineState()}));render();return}
  try{
    state.inClient=Boolean(liff.isInClient());
    await liff.init({liffId:E.liffId});
    state.liffReady=true;
    state.inClient=Boolean(liff.isInClient());
    canonicalizeAfterLiff();
    if(liff.isLoggedIn()){
      try{const p=await liff.getProfile();state.displayName=String(p?.displayName||'')}catch{}
    }
  }catch(e){
    state.bootError=String(e?.message||e||'LIFF_INIT_FAILED').slice(0,120);
    readRoute();
  }
  state.booting=false;
  window.dispatchEvent(new CustomEvent('asoboon:v2-liff-ready',{detail:lineState()}));
  render();
}
window.addEventListener('popstate',()=>{if(!state.booting){readRoute();render()}});
/* IMPORTANT: LINE injects liff.state and related parameters during startup.
 * Do not read/replace the URL until liff.init() resolves. */
render();
void initLiff();
})();
