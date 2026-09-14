(()=>{'use strict';
const root=document.getElementById('app');if(!root)return;
const RES_KEY='asoboon_v2_current_reservation_develop_v1';
let timer=0,queued=false;
const read=()=>{try{return JSON.parse(localStorage.getItem(RES_KEY)||'null')}catch{return null}};
const state=()=>{const p=new URLSearchParams(location.search);return String(p.get('view')||'home')};
function dateLabel(v){const m=String(v||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[1]}.${m[2]}.${m[3]}`:String(v||'—')}
function clock(){try{return new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date())}catch{return'--:--:--'}}
function people(r){const a=Number(r?.adults||0),c=Number(r?.paidChildren||0),i=Number(r?.infants||0),total=Number(r?.totalPeople||a+c+i||0);const parts=[];if(a>0)parts.push(`大人${a}`);if(c>0)parts.push(`こども${c}`);if(i>0)parts.push(`0〜5か月${i}`);return{total,detail:parts.join('・')}}
function markup(r,kind){const p=people(r),detail=p.detail?`<div class="v16-breakdown">${p.detail}</div>`:'';return `<div class="v16-proof ${kind||''}" aria-label="受付証の確認情報"><div class="v16-facts"><span><small>利用日</small><strong>${dateLabel(r?.businessDate)}</strong></span><i></i><span><small>人数</small><strong>${p.total>0?p.total+'名':'—'}</strong></span></div>${detail}<div class="v16-live"><span class="v16-live-dot" aria-hidden="true"></span><b>LIVE</b><time data-v16-clock>${clock()}</time><small>時刻が動いている画面をご確認ください</small></div></div>`}
function ensureHome(r){const ticket=root.querySelector('#v7Hero .v7-ticket');if(!ticket)return;let proof=ticket.parentElement?.querySelector(':scope > .v16-proof');if(!proof){ticket.insertAdjacentHTML('afterend',markup(r,'home'));return}const sig=`${r?.businessDate}|${r?.adults}|${r?.paidChildren}|${r?.infants}|${r?.totalPeople}`;if(proof.dataset.sig!==sig){const fresh=document.createElement('div');fresh.innerHTML=markup(r,'home');const next=fresh.firstElementChild;next.dataset.sig=sig;proof.replaceWith(next)}}
function ensureCallstatus(r){const ticket=root.querySelector('.cs-ticket');if(!ticket)return;let proof=ticket.querySelector('.v16-proof');if(!proof){ticket.insertAdjacentHTML('beforeend',markup(r,'callstatus'));proof=ticket.querySelector('.v16-proof')}if(proof){const sig=`${r?.businessDate}|${r?.adults}|${r?.paidChildren}|${r?.infants}|${r?.totalPeople}`;proof.dataset.sig=sig}}
function tick(){root.querySelectorAll('[data-v16-clock]').forEach(el=>{const t=clock();if(el.textContent!==t)el.textContent=t})}
function patch(){queued=false;const r=read();if(!r?.receiptNo)return;const v=state();if(v==='home')ensureHome(r);if(v==='callstatus')ensureCallstatus(r);tick();if(!timer)timer=setInterval(tick,1000)}
function queue(){if(queued)return;queued=true;queueMicrotask(patch)}
new MutationObserver(queue).observe(root,{childList:true,subtree:true});window.addEventListener('popstate',()=>setTimeout(patch,0));patch();setTimeout(patch,80);setTimeout(patch,350);
})();