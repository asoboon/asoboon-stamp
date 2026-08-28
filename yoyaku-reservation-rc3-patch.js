(()=>{
'use strict';
const PENDING='asoboon_reservation_rc3_pending_v1';
const $=id=>document.getElementById(id);
function clearDefiniteFailure(){
  const msg=$('receptionMsg');
  if(!msg||msg.hidden||!msg.classList.contains('bad'))return;
  try{localStorage.removeItem(PENDING)}catch{}
}
function exclusive(show){
  ['currentCard','successCard','unknownCard'].forEach(id=>{
    const el=$(id);
    if(el&&id!==show)el.hidden=true;
  });
}
function reconcile(){
  clearDefiniteFailure();
  const u=$('unknownCard'),s=$('successCard'),c=$('currentCard');
  if(u&&!u.hidden){exclusive('unknownCard');return}
  if(s&&!s.hidden){exclusive('successCard');return}
  if(c&&!c.hidden)exclusive('currentCard');
}
const root=document.body;
if(root){
  new MutationObserver(reconcile).observe(root,{subtree:true,attributes:true,attributeFilter:['hidden','class'],childList:true});
}
window.addEventListener('pageshow',reconcile);
setTimeout(reconcile,0);
})();
