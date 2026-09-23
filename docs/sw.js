// Ironlog service worker — app shell cached for offline use; version-keyed so updates replace it.
// The whole app (HTML/CSS/JS) is one self-contained document, so the ONE thing that must never be
// served stale-while-online is that document itself — network-first for it, falling back to the
// cache only when actually offline. Static assets (icons, manifest) rarely change, so cache-first
// there is fine and faster. A pure cache-first strategy for everything (the previous approach) meant
// an installed PWA could get stuck on an old version indefinitely once anything was cached, with no
// way to notice a new deploy without the user manually clearing site data — this fixes that for good.
const V='ironlog-0.75.1';
const VER='0.75.1';
// Report this worker's version so the page can decide whether an "Update ready" toast is warranted.
self.addEventListener('message',e=>{if(e.data==='version'&&e.ports&&e.ports[0])e.ports[0].postMessage({v:VER});});
const ASSETS=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];
// cache:'reload' so the offline copy is the fresh deploy, not a 10-minute-old HTTP-cached page
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(ASSETS.map(u=>new Request(u,{cache:'reload'})))).then(()=>self.skipWaiting()));});
// Only ever delete Ironlog's OWN old caches — github.io is a shared origin, other projects live there too
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V&&k.indexOf('ironlog-')===0).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
// Only cache a genuinely good response — never a 404/503 error page or an opaque/redirected reply.
// Caching a bad response would serve it back offline as if it were the app (a deploy that 503s once
// would strand the PWA on an error page forever).
function cacheable(res){return res&&res.ok&&!res.redirected&&res.type!=='opaque';}
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(u.origin!==location.origin||e.request.method!=='GET')return;           // Dropbox / fonts go to the network
  if(e.request.mode==='navigate'||e.request.destination==='document'){
    // Network-first — but never wait forever. On gym "lie-fi" (connected, nothing loads) fetch() HANGS
    // instead of failing, so the offline fallback never kicked in and the app sat on a blank screen.
    // After 3 s the saved copy opens; the network reply, if it arrives, still refreshes the cache for
    // next time. A non-OK reply (a 404/503 mid-deploy) also gets the saved copy, not an error page.
    const cached=()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||caches.match('./index.html'));
    const net=fetch(e.request).then(res=>{if(cacheable(res)){const copy=res.clone();return caches.open(V).then(c=>c.put(e.request,copy)).then(()=>res);}return res;});
    e.waitUntil(net.catch(()=>{}));   // keep the worker alive long enough to finish refreshing the cache
    e.respondWith(new Promise(resolve=>{
      let done=false;const settle=r=>{if(!done&&r){done=true;resolve(r);}};
      const timer=setTimeout(()=>cached().then(settle),3000);   // no saved copy yet (first visit)? keep waiting for the network
      net.then(res=>{if(res.ok){clearTimeout(timer);settle(res);}else cached().then(r=>settle(r||res));})
        .catch(()=>{clearTimeout(timer);cached().then(r=>settle(r||Response.error()));});
    }));
    return;
  }
  e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(r=>r||fetch(e.request).then(res=>{if(cacheable(res)){const copy=res.clone();e.waitUntil(caches.open(V).then(c=>c.put(e.request,copy)));}return res;})));
});
