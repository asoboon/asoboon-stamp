/* Official ASOBooN miniapp release check. Read-only; never touches reservations. */
(()=>{'use strict';
if(window.ASOBOON_ASOQUEST_HANDOFF)return;
const current=document.currentScript;
if(!current?.src||typeof fetch!=='function')return;
const scriptUrl=new URL(current.src,location.href);
const loaded=scriptUrl.searchParams.get('id')||'';
if(!/^[a-f0-9]{12}$/.test(loaded))return;
window.ASOBOON_RELEASE_ID=loaded;
const manifestUrl=new URL('./release.json',scriptUrl);
manifestUrl.searchParams.set('_nocache',String(Date.now()));
void fetch(manifestUrl.href,{cache:'no-store'})
.then(response=>response.ok?response.json():null)
.then(manifest=>{
 const latest=String(manifest?.releaseId||'');
 if(!/^[a-f0-9]{12}$/.test(latest)||latest===loaded)return;
 const target=new URL(location.href);
 // A fresh URL forces the HTML to bypass the previous cached release.
 // Stop if the CDN still serves the older HTML on the first retry.
 if(target.searchParams.get('_asoboon_release')===latest)return;
 target.searchParams.set('_asoboon_release',latest);
 location.replace(target.href);
}).catch(()=>{}); // Offline remains usable; never interfere with LIFF or booking.
})();
