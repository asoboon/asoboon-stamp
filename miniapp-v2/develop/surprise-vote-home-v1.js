(()=>{'use strict';
const CFG=window.ASOBOON_SURPRISE_VOTE_CONFIG||{},root=document.getElementById('app');
if(!root)return;
let currentMode='idle',currentEvent=null,refreshing=false,timer=null;

function apiUrl(){return String(CFG.API_URL||'').trim()}
function jsonp(params){
  const url=apiUrl();
  if(!url)return Promise.resolve({ok:true,mode:'idle',event:null});
  return new Promise((resolve,reject)=>{
    const cb='__asoboonSurpriseHome_'+Date.now()+'_'+Math.floor(Math.random()*100000);
    const script=document.createElement('script');
    let done=false;
    const timeout=setTimeout(()=>finish(new Error('timeout')),Math.max(12000,Number(CFG.REQUEST_TIMEOUT_MS||20000)));
    function finish(err,data){
      if(done)return;done=true;clearTimeout(timeout);
      try{delete window[cb]}catch(_){window[cb]=undefined}
      script.remove();
      err?reject(err):resolve(data);
    }
    window[cb]=data=>finish(null,data);
    script.onerror=()=>finish(new Error('network'));
    const q=new URLSearchParams({...params,callback:cb,_:String(Date.now())});
    script.src=url+(url.includes('?')?'&':'?')+q.toString();
    document.head.appendChild(script);
  });
}
function helpNode(){return root.querySelector('.v38-help')}
function labelForEvent(){
  const t=String(currentEvent?.event_time||'').trim();
  return t?t+'開催予定':'今日のイベント';
}
function render(){
  const el=helpNode();if(!el)return;
  const voting=currentMode==='voting';
  const settling=currentMode==='settling';
  const result=currentMode==='result';
  const upcoming=currentMode==='upcoming';
  const tone=voting?'is-voting':result?'is-result':settling?'is-settling':'is-idle';
  const badge=voting?'投票受付中':settling?'集計中':result?'結果発表':upcoming?'このあと':'イベント投票';
  const sub=voting
    ?'100 ASOBooNを好きなイベントに投票しよう！'
    :settling
      ?'ただいま投票結果を集計しています'
      :result
        ?labelForEvent()+'の結果を見よう！'
        :upcoming
          ?labelForEvent()+'の候補をチェック！'
          :'今日の開催回・投票時間・結果を確認できます';
  el.dataset.surpriseMode=currentMode;
  el.innerHTML=
    '<a class="v38-surprise-cta '+tone+'" href="./surprise-vote.html">'+
      '<span class="v38-surprise-badge">'+badge+'</span>'+
      '<span class="v38-surprise-copy">'+
        '<strong>今日のイベント投票</strong>'+
        '<small>'+sub+'</small>'+
      '</span>'+
      '<span class="v38-surprise-arrow" aria-hidden="true">›</span>'+
    '</a>';
}
async function refresh(){
  if(refreshing)return;refreshing=true;
  try{
    const data=await jsonp({action:'status'});
    if(data?.ok===true){
      currentMode=String(data.mode||'idle');
      currentEvent=data.event||null;
    }else{
      currentMode='idle';currentEvent=null;
    }
  }catch(_){
    currentMode='idle';currentEvent=null;
  }finally{
    refreshing=false;render();
  }
}
function schedule(){
  clearInterval(timer);
  timer=setInterval(()=>{if(!document.hidden)void refresh()},Math.max(15000,Number(CFG.HOME_REFRESH_MS||60000)));
}
window.addEventListener('asoboon:v2-route-rendered',()=>setTimeout(()=>{render();if(location.search.includes('view=home')||!new URLSearchParams(location.search).get('view'))void refresh()},0));
window.addEventListener('asoboon:v8-home-status',()=>setTimeout(render,0));
window.addEventListener('focus',()=>void refresh());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh()});
setTimeout(()=>{render();void refresh();schedule()},0);
})();