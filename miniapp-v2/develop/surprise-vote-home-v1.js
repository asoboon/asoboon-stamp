(()=>{'use strict';
const root=document.getElementById('app');
if(!root)return;

const ENV=window.ASOBOON_V2_ENV||{};
const STATUS_CACHE_KEY='asoboon-surprise-status-cache-v1';
let warmStarted=false;
let statusWarmPromise=null;
let staticWarmPromise=null;
let refreshTimer=0;
let loading=false;
let lastMode='';

const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function node(){return root.querySelector('#v38Surprise')}
function hide(){const el=node();if(el){el.hidden=true;el.innerHTML='';el.dataset.surpriseMode='idle'}lastMode=''}
function clock(value){const raw=String(value||'').trim();const m=raw.match(/(?:T|^)(\d{2}):(\d{2})/);return m?`${m[1]}:${m[2]}`:raw}
function cachedStatus(maxAge=5*60*1000){
  try{
    const box=JSON.parse(localStorage.getItem(STATUS_CACHE_KEY)||'null');
    if(!box||!box.data||box.data.ok!==true||Date.now()-Number(box.savedAt||0)>=maxAge)return null;
    return box.data;
  }catch(_){return null}
}
function hasWarmStatus(){return !!cachedStatus()}
function cardModel(data){
  const mode=String(data?.mode||'idle');
  const event=data?.event||{};
  const eventTime=clock(event.event_time||'');
  const winner=String(data?.winner?.name||event?.winner?.name||'').trim();
  if(mode==='voting')return{mode,badge:'投票受付中',title:'サプライズ投票 開催中',sub:eventTime?`${eventTime}のイベントをみんなで決めよう`:'今日のイベントをみんなで決めよう',detail:'100アソブーンを好きなイベントに投票'};
  if(mode==='settling')return{mode,badge:'集計中',title:'ただいま集計中',sub:eventTime?`${eventTime}のイベント投票`:'今日のイベント投票',detail:'もうすぐ結果発表'};
  if(mode==='result')return{mode,badge:'結果発表',title:'サプライズ投票 結果発表',sub:eventTime?`${eventTime}のイベント`:'今日のイベント',detail:winner?`選ばれたのは「${winner}」`:'結果を見てみよう'};
  if(mode==='upcoming')return{mode,badge:'まもなく',title:'サプライズ投票',sub:eventTime?`${eventTime}のイベント投票を予定しています`:'今日の投票を予定しています',detail:event.vote_start?`${clock(event.vote_start)}から投票スタート`:'開始までお待ちください'};
  return null;
}
function render(data){
  const el=node();if(!el)return;
  const model=cardModel(data);if(!model){hide();return}
  el.hidden=false;el.dataset.surpriseMode=model.mode;lastMode=model.mode;
  el.innerHTML=`<div class="v38-surprise-label"><h2>サプライズ投票</h2><small>今日だけの参加コンテンツ</small></div><a class="v38-surprise-cta is-${esc(model.mode)}" href="./surprise-vote.html"><span class="v38-surprise-badge">${esc(model.badge)}</span><span class="v38-surprise-copy"><strong>${esc(model.title)}</strong><small>${esc(model.sub)}</small><em>${esc(model.detail)}</em></span><span class="v38-surprise-arrow" aria-hidden="true">›</span></a>`;
  bindCta(el.querySelector('.v38-surprise-cta'));
}
function bindCta(cta){
  if(!cta)return;
  cta.addEventListener('pointerenter',()=>void warmVoteStaticOnce(),{once:true,passive:true});
  cta.addEventListener('touchstart',()=>void warmVoteStaticOnce(),{once:true,passive:true});
  cta.addEventListener('click',async event=>{
    if(hasWarmStatus())return;
    event.preventDefault();
    const href=cta.href;
    const warm=warmVoteStatusOnce();
    await Promise.race([warm,new Promise(resolve=>setTimeout(resolve,420))]);
    location.href=href;
  });
}
function warmVoteStatusOnce(){
  if(!statusWarmPromise)statusWarmPromise=warmVoteStatus().finally(()=>{statusWarmPromise=null});
  return statusWarmPromise;
}
function warmVoteStaticOnce(){
  if(!staticWarmPromise)staticWarmPromise=warmVoteStatic().finally(()=>{staticWarmPromise=null});
  return staticWarmPromise;
}
async function warmVoteStatic(){
  const urls=['./surprise-vote.html','./surprise-vote.css?v=20261002-12','./env.js?v=20260926-09','./surprise-vote-config.js?v=20261002-12','./surprise-vote.js?v=20261002-12'];
  await Promise.allSettled(urls.map(url=>fetch(url,{method:'GET',cache:'force-cache',credentials:'same-origin'})));
}
async function warmVoteStatus(){
  const backend=String(ENV.backendUrl||'').trim();
  if(!backend)return null;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),1200);
  try{
    const url=new URL(backend);url.searchParams.set('action','surpriseVotePublicStatus');url.searchParams.set('_',String(Date.now()));
    const response=await fetch(url.toString(),{method:'GET',cache:'no-store',credentials:'omit',signal:controller.signal,headers:{Accept:'application/json'}});
    if(!response.ok)return null;
    const data=await response.json();
    if(!data||data.ok!==true)return null;
    delete data.user;
    try{localStorage.setItem(STATUS_CACHE_KEY,JSON.stringify({savedAt:Date.now(),data}))}catch(_){ }
    return data;
  }catch(_){return null}finally{clearTimeout(timer)}
}
async function refresh(){
  if(loading||document.hidden)return;
  const cached=cachedStatus();if(cached)render(cached);
  loading=true;
  try{
    const fresh=await warmVoteStatusOnce();
    if(fresh)render(fresh);else if(!cached&&!lastMode)hide();
  }finally{loading=false}
}
async function warmVote(){
  if(warmStarted)return;
  warmStarted=true;
  void refresh();
  if('requestIdleCallback' in window)requestIdleCallback(()=>void warmVoteStaticOnce(),{timeout:500});
  else setTimeout(()=>void warmVoteStaticOnce(),300);
}
function scheduleWarm(){void warmVote()}
function startRefreshTimer(){clearInterval(refreshTimer);refreshTimer=setInterval(()=>void refresh(),30000)}
window.addEventListener('asoboon:v2-route-rendered',()=>setTimeout(()=>{if(new URLSearchParams(location.search).get('view')!=='home')return;void refresh();scheduleWarm()},0));
window.addEventListener('asoboon:v8-home-status',()=>setTimeout(()=>void refresh(),0));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh()});
setTimeout(()=>{void refresh();scheduleWarm();startRefreshTimer()},0);
})();
