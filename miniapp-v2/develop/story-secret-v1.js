(()=>{'use strict';
const TARGET='./chief-story/';
const TAP_COUNT=7;
const WINDOW_MS=3500;
let taps=[];
document.addEventListener('click',e=>{
  const brand=e.target&&e.target.closest?e.target.closest('.brand strong'):null;
  if(!brand)return;
  const view=new URLSearchParams(location.search).get('view')||'home';
  if(view!=='home')return;
  const now=Date.now();
  taps=taps.filter(t=>now-t<WINDOW_MS);
  taps.push(now);
  if(taps.length>=TAP_COUNT){
    taps=[];
    location.href=TARGET;
  }
},true);
})();