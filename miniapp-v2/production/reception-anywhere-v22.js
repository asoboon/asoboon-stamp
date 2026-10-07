(()=>{'use strict';
const root=document.getElementById('app');if(!root)return;
let queued=false;
const view=()=>String(new URLSearchParams(location.search).get('view')||'home');
const setText=(el,text)=>{if(el&&el.textContent!==text)el.textContent=text};
function patch(){
  queued=false;if(view()!=='reception')return;
  root.querySelector('.rec-methods')?.remove();
  root.querySelector('#recLocation')?.remove();
  root.querySelector('.v22-anywhere-note')?.remove();
  root.querySelector('.v22-dev-test')?.remove();
  const slotTitle=[...root.querySelectorAll('.rec-title')].find(el=>/ご利用の回/.test(String(el.textContent||'')));
  if(slotTitle)slotTitle.hidden=false;
  const slotsBox=root.querySelector('#recSlots');if(slotsBox)slotsBox.hidden=false;
  setText(root.querySelector('#recModeLabel'),'LINE受付（現地受付枠）');
}
function queue(){if(queued)return;queued=true;queueMicrotask(patch)}
new MutationObserver(queue).observe(root,{childList:true,subtree:true});
window.addEventListener('popstate',()=>setTimeout(patch,0));
patch();setTimeout(patch,80);setTimeout(patch,350);
})();
