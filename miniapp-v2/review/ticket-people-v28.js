(()=>{'use strict';
const root=document.getElementById('app');if(!root)return;
const RES_KEY='asoboon_v2_current_reservation_develop_v1';
const LAST_KEY='asoboon_v2_last_receipt_develop_v1';
let queued=false;
const readJSON=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch{return null}};
const read=()=>{const cur=readJSON(RES_KEY);if(cur?.receiptNo)return cur;const last=readJSON(LAST_KEY);return last?.receiptNo?last:null};
function values(r){const adult=Math.max(0,Number(r?.adults||0)),child=Math.max(0,Number(r?.paidChildren||0)),infant=Math.max(0,Number(r?.infants||0));return{adult,child,infant,total:adult+child+infant}}
function markup(r){const p=values(r);return `<section class="v28-people" aria-label="受付人数内訳"><div class="v28-people-head"><span>人数内訳</span><strong>合計 ${p.total}名</strong></div><div class="v28-people-grid"><div class="v28-person adult"><small>大人</small><b>${p.adult}</b><span>名</span></div><div class="v28-person child"><small>子ども</small><b>${p.child}</b><span>名</span></div><div class="v28-person infant"><small>0〜5か月</small><b>${p.infant}</b><span>名</span></div></div></section>`}
function patchPass(pass,r){if(!pass||!r?.receiptNo)return;const p=values(r),sig=[r.receiptNo,p.adult,p.child,p.infant].join('|');if(pass.dataset.v28Sig===sig&&pass.querySelector('.v28-people'))return;pass.dataset.v28Sig=sig;pass.querySelector('.v28-people')?.remove();const facts=pass.querySelector('.v17-facts');if(!facts)return;facts.insertAdjacentHTML('afterend',markup(r));const old=pass.querySelector('.v17-breakdown');if(old)old.hidden=true}
function patch(){queued=false;const r=read();if(!r?.receiptNo)return;root.querySelectorAll('.v17-pass').forEach(pass=>patchPass(pass,r))}
function queue(){if(queued)return;queued=true;queueMicrotask(patch)}
new MutationObserver(queue).observe(root,{childList:true,subtree:true});
window.addEventListener('popstate',()=>setTimeout(patch,0));
window.addEventListener('asoboon:v2-reservation-saved',()=>setTimeout(patch,0));
patch();setTimeout(patch,80);setTimeout(patch,350);
})();
