(()=>{'use strict';
const root=document.getElementById('app');if(!root)return;
const PROGRESS_KEY='asoboon_v2_queue_journey_develop_v1';
const RES_KEY='asoboon_v2_current_reservation_develop_v1';
let latest=window.ASOBOON_HOME_STATUS_SNAPSHOT||null,lastFlashKey='',queued=false;
const read=key=>{try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}};
const write=(key,v)=>{try{localStorage.setItem(key,JSON.stringify(v));return true}catch{return false}};
const remove=key=>{try{localStorage.removeItem(key)}catch{}};
const view=()=>String(new URLSearchParams(location.search).get('view')||'home');
function reservationFor(d){const r=read(RES_KEY)||{};return{receiptNo:String(d?.receipt||r.receiptNo||''),businessDate:String(r.businessDate||'')}}
function readProgress(id){const p=read(PROGRESS_KEY);if(!p||String(p.receiptNo||'')!==id.receiptNo||String(p.businessDate||'')!==id.businessDate)return null;return p}
function journeyPos(initial,current){if(!Number.isFinite(initial)||initial<=0)return null;if(current<=0)return 76;const ratio=Math.max(0,Math.min(1,(initial-current)/initial));return Math.round(7+69*ratio)}
function ensureProgress(d){const n=Number(d?.ahead);if(!Number.isFinite(n)||n<0)return null;const id=reservationFor(d);if(!id.receiptNo)return null;let p=readProgress(id);if(!p){p={...id,initialAhead:n,lastAhead:n,currentAhead:n,startedAt:Date.now(),updatedAt:Date.now()};write(PROGRESS_KEY,p);return{...p,advancedNow:0}}
 const prev=Number(p.lastAhead);const advancedNow=Number.isFinite(prev)&&n<prev?prev-n:0;p.currentAhead=n;p.lastAhead=n;p.updatedAt=Date.now();write(PROGRESS_KEY,p);return{...p,advancedNow}}
function summaryMarkup(p){const initial=Number(p.initialAhead),current=Number(p.currentAhead);const total=Math.max(0,initial-current);const pct=initial>0?Math.max(0,Math.min(100,Math.round(total/initial*100))):0;const totalCopy=total>0?`<strong>${total}組進みました</strong>`:'<strong>ここからスタート</strong>';return `<div class="v14-progress-card"><div class="v14-progress-row"><span>受付時 <b>${initial}組</b></span><span class="v14-progress-arrow">→</span><span>現在 <b>${current}組</b></span></div><div class="v14-progress-track" aria-hidden="true"><span style="width:${pct}%"></span></div><div class="v14-progress-foot">${totalCopy}<small>ASOBooNまで進行中</small></div></div>`}
function flash(hero,p){if(!p.advancedNow)return;const key=`${p.receiptNo}:${p.currentAhead}:${p.updatedAt}`;if(key===lastFlashKey)return;lastFlashKey=key;hero.querySelector('.v14-advance-pop')?.remove();const pop=document.createElement('div');pop.className='v14-advance-pop';pop.textContent=`${p.advancedNow}組進みました！`;hero.appendChild(pop);setTimeout(()=>pop.remove(),1900)}
function patchWaiting(hero,d){const p=ensureProgress(d);if(!p)return;let card=hero.querySelector('.v14-progress-card');const html=summaryMarkup(p);if(!card){const msg=hero.querySelector('.v7-message');if(msg)msg.insertAdjacentHTML('afterend',html)}else if(card.outerHTML!==html)card.outerHTML=html;const car=hero.querySelector('.v7-car');const pos=journeyPos(Number(p.initialAhead),Number(p.currentAhead));if(car&&Number.isFinite(pos))car.style.setProperty('--car-pos',`${pos}%`);const road=hero.querySelector('.v7-road');if(road){road.style.setProperty('--journey-pct',`${Math.max(0,Math.min(100,Math.round((Number(p.initialAhead)-Number(p.currentAhead))/Math.max(1,Number(p.initialAhead))*100)))}%`);road.classList.add('v14-journey-road')}flash(hero,p)}
function patchCalling(hero,d){const id=reservationFor(d),p=readProgress(id);const car=hero.querySelector('.v7-car');if(car)car.style.setProperty('--car-pos','76%');const road=hero.querySelector('.v7-road');if(road){road.style.setProperty('--journey-pct','100%');road.classList.add('v14-journey-road','v14-arrived')}if(p&&!hero.querySelector('.v14-arrival-badge')){const call=hero.querySelector('.v7-call-title');call?.insertAdjacentHTML('afterend',`<div class="v14-arrival-badge"><span>受付時 ${Number(p.initialAhead)}組</span><strong>ASOBooNに到着！</strong></div>`)}}
function patch(){queued=false;if(view()!=='home')return;const hero=root.querySelector('#v7Hero');if(!hero||!latest)return;const kind=String(latest.kind||'');if(kind==='waiting')patchWaiting(hero,latest);else if(kind==='calling')patchCalling(hero,latest);else if(kind==='none'&&latest.canceled)remove(PROGRESS_KEY)}
function queue(){if(queued)return;queued=true;queueMicrotask(patch)}
window.addEventListener('asoboon:v8-home-status',e=>{latest=e.detail||null;queue()});
window.addEventListener('popstate',()=>setTimeout(patch,0));
new MutationObserver(queue).observe(root,{childList:true,subtree:true});
patch();setTimeout(patch,80);setTimeout(patch,350);
})();
