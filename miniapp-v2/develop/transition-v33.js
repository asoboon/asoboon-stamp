(()=>{'use strict';
let fail=0;
function clearFail(){if(fail){clearTimeout(fail);fail=0}}
function reveal(){clearFail();requestAnimationFrame(()=>requestAnimationFrame(()=>{document.body.classList.remove('v33-route-pending','v33-boot')}))}
function begin(){document.body.classList.add('v33-route-pending');clearFail();fail=setTimeout(()=>document.body.classList.remove('v33-route-pending','v33-boot'),500)}
document.addEventListener('click',e=>{const t=e.target?.closest?.('[data-view],[data-v7-view],[data-pv7-view]');if(t&&!t.disabled)begin()},true);
window.addEventListener('popstate',()=>{begin();queueMicrotask(reveal)});
window.addEventListener('asoboon:v8-home-status',()=>{if(String(new URLSearchParams(location.search).get('view')||'home')==='home')queueMicrotask(reveal)});
fail=setTimeout(()=>document.body.classList.remove('v33-boot','v33-route-pending'),800);queueMicrotask(reveal);
})();