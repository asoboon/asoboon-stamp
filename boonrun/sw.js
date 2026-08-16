const CACHE='boonrun-20260816-v123-rc9-sound-master';
const CORE=[
  './','./index.html','./style.css?v=20260816-v123-rc9-sound-master','./game.bundle.js?v=20260816-v123-rc9-sound-master','./run-ranking.js?v=20260816-v123-rc9-sound-master','./manifest.webmanifest',
  './assets/audio/asoboon-audio.js?v=20260816-v123-rc9-sound-master','./assets/audio/sound-manifest.json',
  './assets/audio/runtime/common/ui-confirm.mp3','./assets/audio/runtime/common/countdown-tick.mp3','./assets/audio/runtime/common/countdown-go.mp3','./assets/audio/runtime/boonrun/engine-start.mp3','./assets/audio/runtime/boonrun/jump.mp3','./assets/audio/runtime/boonrun/fuel-small.mp3','./assets/audio/runtime/boonrun/critical-pass.mp3',
  './assets/world-drive/manifest.json','./assets/world-drive/BACKGROUND-ASSET-GUIDE.md','./assets/world-drive/01-day-highway/far.webp','./assets/world-drive/01-day-highway/mid.webp','./assets/world-drive/01-day-highway/near.webp'
];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>Promise.allSettled(CORE.map(u=>c.add(u)))));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('boonrun-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
const cacheFirst=(r)=>caches.match(r).then(hit=>hit||fetch(r).then(res=>{if(res&&res.ok){const c=res.clone();caches.open(CACHE).then(k=>k.put(r,c));}return res;}));
self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);if(r.method!=='GET'||u.origin!==location.origin)return;
  const audioAsset=/\/boonrun\/assets\/audio\/.*\.(mp3|json|js)$/i.test(u.pathname);
  if(audioAsset){e.respondWith(cacheFirst(r));return;}
  const worldAsset=/\/boonrun\/assets\/world-drive\/.*\.(webp|png|json|md)$/i.test(u.pathname);
  if(worldAsset){e.respondWith(cacheFirst(r));return;}
  const cardAsset=/\/boonrun\/assets\/cards\/(boon|wagon|buggy|bike|sport|ssr|princess|valkyrie|secret)\.(webp|png|jpg)$/i.test(u.pathname);
  if(cardAsset){e.respondWith(fetch(r).then(res=>{const c=res.clone();caches.open(CACHE).then(k=>k.put(r,c));return res;}).catch(()=>caches.match(r)));return;}
  const carAsset=/\/boonrun\/assets\/cars\/(boon|wagon|buggy|bike|sport|ssr|princess|valkyrie|secret)-(body|complete|rear-wheel|front-wheel|shadow|boost)\.(webp|png)$/i.test(u.pathname);
  if(carAsset){e.respondWith(cacheFirst(r));return;}
  if(r.destination==='document'||r.destination==='script'||r.destination==='style'){
    e.respondWith(fetch(r).then(res=>{const c=res.clone();caches.open(CACHE).then(x=>x.put(r,c));return res;}).catch(()=>caches.match(r)));return;
  }
  e.respondWith(cacheFirst(r));
});
