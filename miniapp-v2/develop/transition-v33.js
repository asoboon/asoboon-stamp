(()=>{'use strict';
let fail=0,revealTimer=0;
function clearFail(){if(fail){clearTimeout(fail);fail=0}}
function clearReveal(){if(revealTimer){clearTimeout(revealTimer);revealTimer=0}}
function reveal(){clearReveal();clearFail();requestAnimationFrame(()=>requestAnimationFrame(()=>{document.body.classList.remove('v33-route-pending','v33-boot')}))}
function begin(){document.body.classList.add('v33-route-pending');clearReveal();clearFail();fail=setTimeout(()=>document.body.classList.remove('v33-route-pending','v33-boot'),700)}
function revealAfterPatches(){clearReveal();revealTimer=setTimeout(reveal,0)}
document.addEventListener('click',e=>{const t=e.target?.closest?.('[data-view],[data-v7-view],[data-pv7-view],#backBtn');if(t&&!t.disabled)begin()},true);
window.addEventListener('popstate',()=>{begin();revealAfterPatches()});
window.addEventListener('asoboon:v8-home-status',()=>{if(String(new URLSearchParams(location.search).get('view')||'home')==='home')revealAfterPatches()});
fail=setTimeout(()=>document.body.classList.remove('v33-boot','v33-route-pending'),900);revealAfterPatches();
})();