(()=>{'use strict';
const root=document.getElementById('app');
if(!root)return;

const STATUS_CACHE_KEY='asoboon-surprise-status-cache-v1';
let warmStarted=false;

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
    cta.addEventListener('pointerenter',()=>void warmVote(),{once:true,passive:true});
    cta.addEventListener('touchstart',()=>void warmVote(),{once:true,passive:true});
  }
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
  await Promise.allSettled([warmVoteStatic(),warmVoteStatus()]);
}

function scheduleWarm(){
  if(warmStarted)return;
  if('requestIdleCallback' in window){
    requestIdleCallback(()=>void warmVote(),{timeout:650});
  }else{
    setTimeout(()=>void warmVote(),450);
  }
}

window.addEventListener('asoboon:v2-route-rendered',()=>setTimeout(()=>{render();scheduleWarm()},0));
window.addEventListener('asoboon:v8-home-status',()=>setTimeout(render,0));
setTimeout(()=>{render();scheduleWarm()},0);
})();
