/* Official ASOBooN miniapp release check. Read-only; never touches reservations. */
(()=>{'use strict';
if(window.ASOBOON_ASOQUEST_HANDOFF)return;
const current=document.currentScript;
if(!current?.src||typeof fetch!=='function')return;
const scriptUrl=new URL(current.src,location.href);
const loaded=scriptUrl.searchParams.get('id')||'';
if(!/^[a-f0-9]{12}$/.test(loaded))return;
window.ASOBOON_RELEASE_ID=loaded;
// Avoid interrupting reception: never reload after the first user interaction,
// and ignore slow release checks even if the network ignores abort signals.
const started=Date.now();
let interacting=false;
for(const type of ['pointerdown','keydown','click','submit']){
 document.addEventListener(type,()=>{interacting=true},{capture:true,once:true});
}
const controller=new AbortController();
const timeout=setTimeout(()=>controller.abort(),1200);
const manifestUrl=new URL('./release.json',scriptUrl);
manifestUrl.searchParams.set('_nocache',String(Date.now()));
void fetch(manifestUrl.href,{cache:'no-store',signal:controller.signal})
.then(response=>response.ok?response.json():null)
.then(manifest=>{
 if(interacting||Date.now()-started>1200||document.visibilityState==='hidden')return;
 const latest=String(manifest?.releaseId||'');
 if(!/^[a-f0-9]{12}$/.test(latest)||latest===loaded)return;
 const target=new URL(location.href);
 // A fresh URL forces the HTML to bypass the previous cached release.
 // Stop if the CDN still serves the older HTML on the first retry.
 if(target.searchParams.get('_asoboon_release')===latest)return;
 target.searchParams.set('_asoboon_release',latest);
 location.replace(target.href);
}).catch(()=>{}).finally(()=>clearTimeout(timeout));
// Offline remains usable; LIFF, QR/NFC handoffs, and bookings take precedence.
})();
