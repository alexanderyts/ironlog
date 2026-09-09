// Ironlog service worker — app shell cached for offline use; version-keyed so updates replace it.
// The whole app (HTML/CSS/JS) is one self-contained document, so the ONE thing that must never be
// served stale-while-online is that document itself — network-first for it, falling back to the
// cache only when actually offline. Static assets (icons, manifest) rarely change, so cache-first
// there is fine and faster. A pure cache-first strategy for everything (the previous approach) meant
// an installed PWA could get stuck on an old version indefinitely once anything was cached, with no
// way to notice a new deploy without the user manually clearing site data — this fixes that for good.
const V='ironlog-0.8.6';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(u.origin!==location.origin||e.request.method!=='GET')return;           // Dropbox / fonts go to the network
  if(e.request.mode==='navigate'||e.request.destination==='document'){
    e.respondWith(fetch(e.request).then(res=>{const copy=res.clone();caches.open(V).then(c=>c.put(e.request,copy));return res;}).catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||caches.match('./index.html'))));
    return;
  }
  e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(r=>r||fetch(e.request).then(res=>{const copy=res.clone();caches.open(V).then(c=>c.put(e.request,copy));return res;})));
});
