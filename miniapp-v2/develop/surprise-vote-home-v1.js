(()=>{'use strict';
const root=document.getElementById('app');
if(!root)return;

const STATUS_CACHE_KEY='asoboon-surprise-status-cache-v1';
let warmStarted=false;
let statusWarmPromise=null;
let staticWarmPromise=null;

function helpNode(){return root.querySelector('.v38-help')}

function render(){
  const el=helpNode();
  if(!el)return;
  el.dataset.surpriseMode='idle';
  el.innerHTML=
    '<a class="v38-surprise-cta is-idle" href="./surprise-vote.html">'+
      '<span class="v38-surprise-badge">イベント投票</span>'+
      '<span class="v38-surprise-copy">'+
        '<strong>今日のイベント投票</strong>'+
        '<small>今日の開催回・投票時間・結果はこちら</small>'+
      '</span>'+
      '<span class="v38-surprise-arrow" aria-hidden="true">›</span>'+
    '</a>';

  const cta=el.querySelector('.v38-surprise-cta');
  if(cta){
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
}

function hasWarmStatus(){
  try{
    const box=JSON.parse(localStorage.getItem(STATUS_CACHE_KEY)||'null');
    return !!(box&&box.data&&box.data.ok===true&&Date.now()-Number(box.savedAt||0)<5*60*1000);
  }catch(_){return false}
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
  const urls=[
    './surprise-vote.html',
    './surprise-vote.css?v=20261002-10',
    './env.js?v=20260926-09',
    './surprise-vote-config.js?v=20261002-10',
    './surprise-vote.js?v=20261002-10'
  ];
  await Promise.allSettled(urls.map(url=>fetch(url,{
    method:'GET',
    cache:'force-cache',
    credentials:'same-origin'
  })));
}

async function warmVoteStatus(){
  const backend=String(window.ASOBOON_V2_ENV?.backendUrl||'').trim();
  if(!backend)return;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),1200);
  try{
    const url=new URL(backend);
    url.searchParams.set('action','surpriseVotePublicStatus');
    url.searchParams.set('_',String(Date.now()));
    const response=await fetch(url.toString(),{
      method:'GET',
      cache:'no-store',
      credentials:'omit',
      signal:controller.signal,
      headers:{Accept:'application/json'}
    });
    if(!response.ok)return;
    const data=await response.json();
    if(!data||data.ok!==true)return;
    delete data.user;
    try{
      localStorage.setItem(STATUS_CACHE_KEY,JSON.stringify({savedAt:Date.now(),data}));
    }catch(_){ }
  }catch(_){
  }finally{
    clearTimeout(timer);
  }
}

async function warmVote(){
  if(warmStarted)return;
  warmStarted=true;
  // D1 snapshot is tiny and fast; start it immediately without blocking HOME.
  void warmVoteStatusOnce();
  // Static assets are larger, so keep them low-priority.
  if('requestIdleCallback' in window){
    requestIdleCallback(()=>void warmVoteStaticOnce(),{timeout:500});
  }else{
    setTimeout(()=>void warmVoteStaticOnce(),300);
  }
}

function scheduleWarm(){
  void warmVote();
}

window.addEventListener('asoboon:v2-route-rendered',()=>setTimeout(()=>{render();scheduleWarm()},0));
window.addEventListener('asoboon:v8-home-status',()=>setTimeout(render,0));
setTimeout(()=>{render();scheduleWarm()},0);
})();
