// Build: assembles src/ into
//   dist/app.html  — single-file Claude Artifact (cloud DB backend)
//   docs/          — standalone site for GitHub Pages (Dropbox backend, offline service worker, icons)
const fs=require('fs'),path=require('path'),zlib=require('zlib'),crypto=require('crypto');
const b64sha=s=>crypto.createHash('sha256').update(s,'utf8').digest('base64');
const root=__dirname,pkg=require('./package.json');
const cfg=fs.existsSync(path.join(root,'config.json'))?JSON.parse(fs.readFileSync(path.join(root,'config.json'),'utf8')):{};
// Normalize line endings: git on Windows (core.autocrlf) can check sources out with CRLF, and a browser
// turns CRLF into LF while parsing the page — so the CSP hash of an inline script computed over CRLF
// text would never match, and the site would load BLANK (script blocked). Hash what the browser sees.
const read=p=>fs.readFileSync(path.join(root,p),'utf8').replace(/\r\n?/g,'\n');
const write=(p,d)=>{const f=path.join(root,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,d);console.log('  wrote',p,typeof d==='string'?(d.length/1024).toFixed(1)+' KB':d.length+' bytes');};

// A module entry is either a file (its own IIFE, private scope, exports on IL) or an ARRAY of files
// concatenated into ONE shared IIFE. The ui-* files are one such group: they were split from a single
// 1,000-line ui.js purely for navigability and share one lexical scope exactly as before — no
// functions hung on a namespace, no behaviour change.
const UI=['src/app/ui-core.js','src/app/ui-today.js','src/app/ui-views.js','src/app/ui-bind.js'];
const MODULES=['src/data/exercises.js','src/engine/progression.js','src/engine/search.js','src/engine/builder.js','src/engine/analysis.js','src/engine/sync.js','src/app/dropbox.js','src/app/store.js',UI];
const FONTS='<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800&family=IBM+Plex+Mono:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap">';

function bundle(target,demo){
  const head=`/* Ironlog v${pkg.version} · ${target}${demo?' demo':''} build */\nvar IL=globalThis.IL||(globalThis.IL={});IL.config={BUILD:${JSON.stringify(target)},DEMO:${!!demo},VERSION:${JSON.stringify(pkg.version)},DROPBOX_APP_KEY:${JSON.stringify(cfg.DROPBOX_APP_KEY||'')}};\n`;
  const mods=demo?[...MODULES.slice(0,7),'src/app/seed.js',...MODULES.slice(7)]:MODULES;   // seed data only ships in the demo
  // each entry is wrapped in one IIFE (private scope, exports on IL); an array entry concatenates its
  // files into that single IIFE so they share scope
  return head+mods.map(m=>{const files=Array.isArray(m)?m:[m];
    const src=files.map(f=>`/* ----- ${f} ----- */\n${read(f)}`).join('\n');
    return `\n/* ===== ${files.join(' + ')} ===== */\n(function(){'use strict';\n${src}\n})();\n`;}).join('');
}
// Safety check: files grouped into ONE IIFE share a scope, so two top-level `function foo` declarations
// silently let the later one win (a duplicate const/let throws at load, which the tests catch — a
// duplicate FUNCTION does not). This has caused a real bug before (fmtSec). Fail the build instead.
function checkSharedScope(){
  MODULES.filter(Array.isArray).forEach(group=>{
    const seen={};
    group.forEach(f=>read(f).split('\n').forEach((line,i)=>{
      const m=line.match(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(|^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/);
      if(!m)return;const name=m[1]||m[2],at=f+':'+(i+1);
      if(seen[name])throw new Error('Duplicate top-level name "'+name+'" in the shared UI scope: '+seen[name]+' and '+at+' — the later one would silently replace the earlier.');
      seen[name]=at;}));
  });
}
checkSharedScope();
const css=read('src/styles.css'),body=read('src/template.html');

// --- Artifact (the claude.ai wrapper supplies doctype/head; we start at <title>) ---
const artifact=`<title>Ironlog</title>\n${FONTS}\n<style>\n${css}\n</style>\n${body}\n<script>\n${bundle('artifact')}\n</script>\n`;
// --- Shareable demo artifact: no cloud database (so it can be shared publicly), seeded with sample data ---
const demo=`<title>Ironlog Demo</title>\n${FONTS}\n<style>\n${css}\n</style>\n${body}\n<script>\n${bundle('artifact',true)}\n</script>\n`;

// --- Standalone site ---
// Register the SW. On an update, only offer Reload if the waiting worker's version actually differs
// from the running page's (network-first means the page HTML is often already current on the deploy
// that also updates the SW — no need to nag). Also re-check for updates when the app is resumed, so
// a long-suspended iOS PWA doesn't keep running stale code.
const SW_REG=`if('serviceWorker' in navigator&&location.hostname!=='localhost'){navigator.serviceWorker.register('./sw.js').then(reg=>{
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')reg.update().catch(()=>{});});
  reg.addEventListener('updatefound',()=>{const nw=reg.installing;if(!nw)return;nw.addEventListener('statechange',()=>{
    if(nw.state==='installed'&&navigator.serviceWorker.controller){
      try{const ch=new MessageChannel();ch.port1.onmessage=ev=>{if(ev.data&&ev.data.v&&ev.data.v!==(IL.config&&IL.config.VERSION)&&IL.ui)IL.ui.toast('Update ready',{label:'Reload',fn:()=>location.reload()});};nw.postMessage('version',[ch.port2]);}
      catch(e){if(IL.ui)IL.ui.toast('Update ready',{label:'Reload',fn:()=>location.reload()});}
    }});});
}).catch(()=>{});}`;
// Inline-script contents, hashed EXACTLY as they appear between the <script> tags so a strict CSP
// (no 'unsafe-inline' for scripts) still lets the app's own code run while blocking any injected
// inline handler (onerror=, onload=, …) — the primary XSS payload for rendered untrusted data.
const siteScript='\n'+bundle('site')+'\n';
const CSP=[
  "default-src 'none'",
  "script-src 'sha256-"+b64sha(siteScript)+"' 'sha256-"+b64sha(SW_REG)+"'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self' https://api.dropboxapi.com https://content.dropboxapi.com",
  "manifest-src 'self'",
  "worker-src 'self'",
  "base-uri 'none'",
  "form-action 'none'"
  // NB: frame-ancestors is ignored in a <meta> CSP (spec) — it needs a real HTTP header, which
  // GitHub Pages can't set. Omitted rather than left as false reassurance.
].join('; ');
const site=`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="referrer" content="no-referrer">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Ironlog</title>
<meta name="description" content="Ironlog — a smart, fast workout tracker.">
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#eef1f5">
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0d1219">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Ironlog">
<link rel="manifest" href="./manifest.webmanifest">
<link rel="apple-touch-icon" href="./apple-touch-icon.png">
<link rel="icon" type="image/png" href="./icon-192.png">
${FONTS}
<style>
${css}
/* standalone: let the blurred header run under the status bar */
.app-head{padding-top:env(safe-area-inset-top,0px)}
</style>
</head>
<body>
${body}
<script>${siteScript}</script>
<script>${SW_REG}</script>
</body>
</html>
`;
const sw=`// Ironlog service worker — app shell cached for offline use; version-keyed so updates replace it.
// The whole app (HTML/CSS/JS) is one self-contained document, so the ONE thing that must never be
// served stale-while-online is that document itself — network-first for it, falling back to the
// cache only when actually offline. Static assets (icons, manifest) rarely change, so cache-first
// there is fine and faster. A pure cache-first strategy for everything (the previous approach) meant
// an installed PWA could get stuck on an old version indefinitely once anything was cached, with no
// way to notice a new deploy without the user manually clearing site data — this fixes that for good.
const V='ironlog-${pkg.version}';
const VER='${pkg.version}';
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
`;
const manifest=JSON.stringify({name:'Ironlog',short_name:'Ironlog',description:'A smart, fast workout tracker.',start_url:'./',scope:'./',display:'standalone',orientation:'portrait',background_color:'#0d1219',theme_color:'#0d1219',
  icons:[{src:'./icon-192.png',sizes:'192x192',type:'image/png'},{src:'./icon-512.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}]},null,2);

// --- Icon: the brand mark (tangerine spark bar on steel) rendered to PNG without any image library ---
function crc32(buf){let c,crc=0xffffffff;for(let n=0;n<buf.length;n++){c=(crc^buf[n])&0xff;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;crc=(crc>>>8)^c;}return (crc^0xffffffff)>>>0;}
function chunk(type,data){const len=Buffer.alloc(4);len.writeUInt32BE(data.length);const td=Buffer.concat([Buffer.from(type),data]);const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(td));return Buffer.concat([len,td,crc]);}
function makeIcon(size){
  const bg=[0x0d,0x12,0x19],fg=[0xf5,0x51,0x1e];
  const cx=size/2,cy=size/2,w=size*0.17,h=size*0.52,skew=Math.tan(12*Math.PI/180);
  const raw=Buffer.alloc((size*3+1)*size);
  for(let y=0;y<size;y++){raw[y*(size*3+1)]=0;
    for(let x=0;x<size;x++){const dy=y+0.5-cy,dx=x+0.5-cx+dy*skew;   // skewX(-12deg): top leans right
      const inside=Math.abs(dy)<=h/2&&Math.abs(dx)<=w/2;
      const px=inside?fg:bg;const o=y*(size*3+1)+1+x*3;raw[o]=px[0];raw[o+1]=px[1];raw[o+2]=px[2];}}
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size,0);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=2;ihdr[10]=0;ihdr[11]=0;ihdr[12]=0;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}

// Exported so the test harness can assemble the exact bundle the browser runs (test/ui-harness.js)
// without a separate build step. Writing files only happens when run directly (`node build.js`).
module.exports={bundle,css,body,artifact,demo,site,sw,FONTS};
if(require.main===module){
  console.log('Building Ironlog v'+pkg.version+(cfg.DROPBOX_APP_KEY?' (Dropbox key set)':' (no Dropbox key — cloud backup off in site build)'));
  write('dist/app.html',artifact);
  write('dist/demo.html',demo);
  write('docs/index.html',site);
  write('docs/sw.js',sw);
  write('docs/manifest.webmanifest',manifest);
  write('docs/icon-192.png',makeIcon(192));
  write('docs/icon-512.png',makeIcon(512));
  write('docs/apple-touch-icon.png',makeIcon(180));
  console.log('Done.');
}
