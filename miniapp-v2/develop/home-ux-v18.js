(()=>{'use strict';
const root=document.getElementById('app');if(!root)return;
let queued=false;
function view(){return String(new URLSearchParams(location.search).get('view')||'home')}
function patch(){queued=false;if(view()!=='home')return;root.querySelectorAll('.v7-sign small').forEach(el=>{if(el.textContent!=='入口')el.textContent='入口'});root.querySelectorAll('.v9-status-shortcut').forEach(el=>el.remove());const hero=root.querySelector('#v7Hero');if(!hero)return;const calling=hero.querySelector('.v7-call-title');if(calling){const btn=hero.querySelector('.v7-primary');if(btn){btn.textContent='入場・退場の案内を見る';btn.dataset.v7View='entry';delete btn.dataset.v7Panel}}}
function queue(){if(queued)return;queued=true;queueMicrotask(patch)}
new MutationObserver(queue).observe(root,{childList:true,subtree:true,characterData:true});window.addEventListener('asoboon:v8-home-status',queue);window.addEventListener('popstate',()=>setTimeout(patch,0));patch();setTimeout(patch,80);setTimeout(patch,350);
})();
