const CACHE='boonrun-20260815-v123-rc1-world-drive';
const CORE=['./','./index.html','./style.css?v=20260815-v123-rc1-world-drive','./game.bundle.js?v=20260815-v123-rc1-world-drive','./run-ranking.js?v=20260815-v123-rc1-world-drive','./manifest.webmanifest','./assets/world-drive/manifest.json','./assets/world-drive/BACKGROUND-ASSET-GUIDE.md','./assets/world-drive/01-day-highway/far.webp','./assets/world-drive/01-day-highway/mid.webp','./assets/world-drive/01-day-highway/near.webp'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>Promise.allSettled(CORE.map(u=>c.add(u)))));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('boonrun-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=='GET'||u.origin!==location.origin)return;
  const worldAsset=/\/boonrun\/assets\/world-drive\/.*\.(webp|png|json|md)$/i.test(u.pathname);
  if(worldAsset){
    e.respondWith(caches.match(r).then(hit=>hit||fetch(r).then(res=>{const c=res.clone();caches.open(CACHE).then(k=>k.put(r,c));return res;})));
    return;
  }
  const cardAsset=/\/boonrun\/assets\/cards\/(boon|wagon|buggy|bike|sport|ssr|princess|valkyrie|secret)\.(webp|png|jpg)$/i.test(u.pathname);
  if(cardAsset){e.respondWith(fetch(r).then(res=>{const c=res.clone();caches.open(CACHE).then(k=>k.put(r,c));return res;}).catch(()=>caches.match(r)));return;}
  const carAsset=/\/boonrun\/assets\/cars\/(boon|wagon|buggy|bike|sport|ssr|princess|valkyrie|secret)-(body|complete|rear-wheel|front-wheel|shadow|boost)\.(webp|png)$/i.test(u.pathname);
  if(carAsset){e.respondWith(caches.match(r).then(x=>x||fetch(r).then(res=>{const c=res.clone();caches.open(CACHE).then(k=>k.put(r,c));return res;})));return;}
  if(r.destination==='document'||r.destination==='script'||r.destination==='style'){
    e.respondWith(fetch(r).then(res=>{const c=res.clone();caches.open(CACHE).then(x=>x.put(r,c));return res;}).catch(()=>caches.match(r)));return;
  }
  e.respondWith(caches.match(r).then(x=>x||fetch(r).then(res=>{const c=res.clone();caches.open(CACHE).then(k=>k.put(r,c));return res;})));
});
