(()=>{'use strict';
const root=document.getElementById('app');if(!root)return;
const MODEL_KEY='asoboon_v2_queue_eta_develop_v1';
const RES_KEY='asoboon_v2_current_reservation_develop_v1';
let latest=window.ASOBOON_HOME_STATUS_SNAPSHOT||null,queued=false;
const read=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch{return null}};
const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}};
const remove=k=>{try{localStorage.removeItem(k)}catch{}};
const view=()=>String(new URLSearchParams(location.search).get('view')||'home');
function idFor(d){const r=read(RES_KEY)||{};return{receiptNo:String(d?.receipt||r.receiptNo||''),businessDate:String(r.businessDate||'')}}
function sameModel(m,id){return Boolean(m&&String(m.receiptNo||'')===id.receiptNo&&String(m.businessDate||'')===id.businessDate)}
function record(d){const n=Number(d?.ahead),id=idFor(d);if(!Number.isFinite(n)||n<0||!id.receiptNo)return null;let m=read(MODEL_KEY);if(!sameModel(m,id))m={...id,samples:[],createdAt:Date.now()};m.samples=Array.isArray(m.samples)?m.samples:[];if(String(d?.source||'')==='live'){const t=Number(d?.checkedAt||Date.now()),last=m.samples[m.samples.length-1];if(!last||Number(last.a)!==n||t-Number(last.t||0)>=60000)m.samples.push({t,a:n});const cutoff=t-30*60*1000;m.samples=m.samples.filter(x=>Number(x.t)>=cutoff).slice(-40);m.updatedAt=t;write(MODEL_KEY,m)}return m}
function goalPos(n){if(n<=0)return 76;if(n>=30)return 7;return Math.round(7+(30-n)/30*69)}
function goalStage(n){if(n<=2)return'もうすぐゴール！';if(n<=5)return'かなり近づいています';if(n<=10)return'ゴールが見えてきました';if(n<=20)return'ASOBooNへ近づいています';return'まだ少し距離があります'}
function round5(x){return Math.max(5,Math.round(x/5)*5)}
function eta(m,n){if(n<=0)return{main:'まもなくご案内',note:'呼出通知をご確認ください'};const s=(m?.samples||[]).filter(x=>Number.isFinite(Number(x.t))&&Number.isFinite(Number(x.a))).sort((a,b)=>a.t-b.t);if(s.length<2)return{main:'時間を計算中',note:'実際の呼出ペースを確認しています'};const last=s[s.length-1],windowStart=Number(last.t)-15*60*1000;const w=s.filter(x=>Number(x.t)>=windowStart);if(w.length<2)return{main:'時間を計算中',note:'実際の呼出ペースを確認しています'};const first=w[0],elapsed=(Number(last.t)-Number(first.t))/60000,drop=Number(first.a)-Number(last.a);if(elapsed<0.5||drop<=0)return{main:'時間を計算中',note:'列が動き始めると目安時間を表示します'};let rate=drop/elapsed;rate=Math.max(.08,Math.min(5,rate));const center=n/rate;if(!Number.isFinite(center)||center<=0)return{main:'時間を計算中',note:'実際の呼出ペースを確認しています'};if(center<=4)return{main:'あと約5分以内',note:'現在の呼出ペースから算出した目安です'};let lo=round5(center*.72),hi=round5(center*1.35);if(hi<=lo)hi=lo+5;return{main:`あと約${lo}〜${hi}分`,note:'現在の呼出ペースから算出した目安です'}}
function cardHTML(n,e){return `<div class="v15-goal-label">ASOBooNまでの目安</div><div class="v15-eta-main">${e.main}</div><div class="v15-stage">${goalStage(n)}</div><div class="v15-eta-note">${e.note}</div>`}
function ensureCard(hero,n,e){let card=hero.querySelector('.v15-goal-card');if(!card){card=document.createElement('div');card.className='v15-goal-card';const msg=hero.querySelector('.v7-message');if(!msg)return;msg.insertAdjacentElement('afterend',card)}const sig=`${n}|${e.main}|${e.note}`;if(card.dataset.sig!==sig){card.dataset.sig=sig;card.innerHTML=cardHTML(n,e)}}
function patchWaiting(hero,d){hero.querySelectorAll('.v14-progress-card,.v14-advance-pop,.v14-arrival-badge').forEach(x=>x.remove());const n=Number(d?.ahead);if(!Number.isFinite(n))return;const m=record(d),e=eta(m,n);ensureCard(hero,n,e);const pos=goalPos(n),car=hero.querySelector('.v7-car');if(car&&car.style.getPropertyValue('--car-pos')!==`${pos}%`)car.style.setProperty('--car-pos',`${pos}%`);const road=hero.querySelector('.v7-road');if(road){const pct=Math.max(0,Math.min(100,Math.round((pos-7)/69*100))),v=`${pct}%`;if(road.style.getPropertyValue('--goal-pct')!==v)road.style.setProperty('--goal-pct',v);road.classList.remove('v14-journey-road','v14-arrived');road.classList.add('v15-goal-road')}}
function patchCalling(hero){hero.querySelectorAll('.v14-progress-card,.v14-advance-pop,.v14-arrival-badge,.v15-goal-card').forEach(x=>x.remove());const car=hero.querySelector('.v7-car');if(car&&car.style.getPropertyValue('--car-pos')!=='76%')car.style.setProperty('--car-pos','76%');const road=hero.querySelector('.v7-road');if(road){road.style.setProperty('--goal-pct','100%');road.classList.remove('v14-journey-road');road.classList.add('v15-goal-road','v15-arrived')}if(!hero.querySelector('.v15-arrival-badge')){const call=hero.querySelector('.v7-call-title');call?.insertAdjacentHTML('afterend','<div class="v15-arrival-badge"><strong>GOAL!</strong><span>ASOBooNへお越しください</span></div>')}}
function patch(){queued=false;if(view()!=='home')return;const hero=root.querySelector('#v7Hero');if(!hero||!latest)return;const kind=String(latest.kind||'');if(kind==='waiting')patchWaiting(hero,latest);else if(kind==='calling')patchCalling(hero);else if(kind==='none'&&latest.canceled)remove(MODEL_KEY)}
function queue(){if(queued)return;queued=true;queueMicrotask(patch)}
window.addEventListener('asoboon:v8-home-status',e=>{latest=e.detail||null;queue()});
window.addEventListener('popstate',()=>setTimeout(patch,0));
new MutationObserver(queue).observe(root,{childList:true,subtree:true});
patch();setTimeout(patch,80);setTimeout(patch,350);
})();
