const CACHE='boonrun-20260816-v123-rc9-sound-fix1';
const SOUND_VERSION='20260816-v123-rc9-sound-fix1';
const CORE=[
  './','./index.html','./style.css?v=20260816-v123-rc9-sound-master','./game.bundle.js?v=20260816-v123-rc9-sound-master','./run-ranking.js?v=20260816-v123-rc9-sound-master','./manifest.webmanifest',
  './assets/audio/asoboon-audio.js?v=20260816-v123-rc9-sound-master',`./assets/audio/boonrun-audio-runtime.js?v=${SOUND_VERSION}`,`./assets/audio/sound-manifest.json?v=${SOUND_VERSION}`,
  `./assets/audio/runtime/common/ui-confirm.mp3?v=${SOUND_VERSION}`,`./assets/audio/runtime/common/countdown-tick.mp3?v=${SOUND_VERSION}`,`./assets/audio/runtime/common/countdown-go.mp3?v=${SOUND_VERSION}`,`./assets/audio/runtime/boonrun/engine-start.mp3?v=${SOUND_VERSION}`,`./assets/audio/runtime/boonrun/jump.mp3?v=${SOUND_VERSION}`,`./assets/audio/runtime/boonrun/fuel-small.mp3?v=${SOUND_VERSION}`,`./assets/audio/runtime/boonrun/critical-pass.mp3?v=${SOUND_VERSION}`,
  './assets/world-drive/manifest.json','./assets/world-drive/BACKGROUND-ASSET-GUIDE.md','./assets/world-drive/01-day-highway/far.webp','./assets/world-drive/01-day-highway/mid.webp','./assets/world-drive/01-day-highway/near.webp'
];
const put=(r,res)=>{if(res&&res.ok){const c=res.clone();caches.open(CACHE).then(k=>k.put(r,c)).catch(()=>{});}return res;};
const cacheFirst=(r)=>caches.match(r).then(hit=>hit||fetch(r).then(res=>put(r,res)));
const networkFirstFresh=(r)=>{
  const fresh=new Request(r,{cache:'reload'});
  return fetch(fresh).then(res=>put(r,res)).catch(()=>caches.match(r));
};
self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>Promise.allSettled(CORE.map(u=>c.add(new Request(u,{cache:'reload'}))))));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('boonrun-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);if(r.method!=='GET'||u.origin!==location.origin)return;
  const audioAsset=/\/boonrun\/assets\/audio\/.*\.(mp3|json|js)$/i.test(u.pathname);
  if(audioAsset){e.respondWith(networkFirstFresh(r));return;}
  const worldAsset=/\/boonrun\/assets\/world-drive\/.*\.(webp|png|json|md)$/i.test(u.pathname);
  if(worldAsset){e.respondWith(cacheFirst(r));return;}
  const cardAsset=/\/boonrun\/assets\/cards\/(boon|wagon|buggy|bike|sport|ssr|princess|valkyrie|secret)\.(webp|png|jpg)$/i.test(u.pathname);
  if(cardAsset){e.respondWith(fetch(r).then(res=>put(r,res)).catch(()=>caches.match(r)));return;}
  const carAsset=/\/boonrun\/assets\/cars\/(boon|wagon|buggy|bike|sport|ssr|princess|valkyrie|secret)-(body|complete|rear-wheel|front-wheel|shadow|boost)\.(webp|png)$/i.test(u.pathname);
  if(carAsset){e.respondWith(cacheFirst(r));return;}
  if(r.destination==='document'||r.destination==='script'||r.destination==='style'){
    e.respondWith(fetch(new Request(r,{cache:'reload'})).then(res=>put(r,res)).catch(()=>caches.match(r)));return;
  }
  e.respondWith(cacheFirst(r));
});
