(()=>{'use strict';
const root=document.getElementById('app');if(!root)return;
let tries=0,timer=0,refreshRequested=false;
const view=()=>String(new URLSearchParams(location.search).get('view')||'home');
function heroNeedsRecovery(){const hero=root.querySelector('#v7Hero');if(!hero)return true;return hero.dataset.v8Rendered!=='1'}
function dispatchSnapshot(){const snap=window.ASOBOON_HOME_STATUS_SNAPSHOT;if(!snap||typeof snap!=='object')return false;window.dispatchEvent(new CustomEvent('asoboon:v8-home-status',{detail:snap}));return true}
function askRefresh(){if(refreshRequested)return;const api=window.ASOBOON_V13_HOME_STATUS;if(!api?.refresh)return;refreshRequested=true;try{const p=api.refresh();if(p&&typeof p.finally==='function')p.finally(()=>{refreshRequested=false});else setTimeout(()=>{refreshRequested=false},1500)}catch{refreshRequested=false}}
function recover(){timer=0;if(view()!=='home')return;tries+=1;const needs=heroNeedsRecovery();if(needs){const sent=dispatchSnapshot();if(!sent)askRefresh();else setTimeout(()=>{if(heroNeedsRecovery())askRefresh()},60)}if(tries<8&&heroNeedsRecovery()){const delays=[80,160,300,500,800,1200,1800,2600];timer=setTimeout(recover,delays[Math.min(tries,delays.length-1)])}}
function restart(){tries=0;refreshRequested=false;if(timer){clearTimeout(timer);timer=0}recover()}
window.addEventListener('asoboon:v2-liff-ready',restart);
window.addEventListener('focus',()=>{if(view()==='home'&&heroNeedsRecovery())restart()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&view()==='home'&&heroNeedsRecovery())restart()});
window.addEventListener('popstate',()=>setTimeout(restart,0));
setTimeout(recover,0);setTimeout(()=>{if(view()==='home'&&heroNeedsRecovery())recover()},250);setTimeout(()=>{if(view()==='home'&&heroNeedsRecovery())recover()},900);
})();
