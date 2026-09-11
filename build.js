// Build: assembles src/ into
//   dist/app.html  — single-file Claude Artifact (cloud DB backend)
//   docs/          — standalone site for GitHub Pages (Dropbox backend, offline service worker, icons)
const fs=require('fs'),path=require('path'),zlib=require('zlib'),crypto=require('crypto');
const b64sha=s=>crypto.createHash('sha256').update(s,'utf8').digest('base64');
const root=__dirname,pkg=require('./package.json');
const cfg=fs.existsSync(path.join(root,'config.json'))?JSON.parse(fs.readFileSync(path.join(root,'config.json'),'utf8')):{};
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const write=(p,d)=>{const f=path.join(root,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,d);console.log('  wrote',p,typeof d==='string'?(d.length/1024).toFixed(1)+' KB':d.length+' bytes');};

const MODULES=['src/data/exercises.js','src/engine/progression.js','src/engine/search.js','src/engine/builder.js','src/engine/analysis.js','src/engine/sync.js','src/app/dropbox.js','src/app/store.js','src/app/ui.js'];
const FONTS='<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800&family=IBM+Plex+Mono:wght@500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap">';

function bundle(target,demo){
  const head=`/* Ironlog v${pkg.version} · ${target}${demo?' demo':''} build */\nvar IL=globalThis.IL||(globalThis.IL={});IL.config={BUILD:${JSON.stringify(target)},DEMO:${!!demo},VERSION:${JSON.stringify(pkg.version)},DROPBOX_APP_KEY:${JSON.stringify(cfg.DROPBOX_APP_KEY||'')}};\n`;
  const mods=demo?[...MODULES.slice(0,7),'src/app/seed.js',...MODULES.slice(7)]:MODULES;   // seed data only ships in the demo
  // each module is wrapped so its top-level consts stay private; exports go on IL
  return head+mods.map(m=>`\n/* ===== ${m} ===== */\n(function(){'use strict';\n${read(m)}\n})();\n`).join('');
}
const css=read('src/styles.css'),body=read('src/template.html');

// --- Artifact (the claude.ai wrapper supplies doctype/head; we start at <title>) ---
const artifact=`<title>Ironlog</title>\n${FONTS}\n<style>\n${css}\n</style>\n${body}\n<script>\n${bundle('artifact')}\n</script>\n`;
// --- Shareable demo artifact: no cloud database (so it can be shared publicly), seeded with sample data ---
const demo=`<title>Ironlog Demo</title>\n${FONTS}\n<style>\n${css}\n</style>\n${body}\n<script>\n${bundle('artifact',true)}\n</script>\n`;

// --- Standalone site ---
const SW_REG=`if('serviceWorker' in navigator&&location.hostname!=='localhost'){navigator.serviceWorker.register('./sw.js').then(reg=>{reg.addEventListener('updatefound',()=>{const nw=reg.installing;if(!nw)return;nw.addEventListener('statechange',()=>{if(nw.state==='installed'&&navigator.serviceWorker.controller&&IL.ui)IL.ui.toast('Update ready',{label:'Reload',fn:()=>location.reload()});});});}).catch(()=>{});}`;
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
<meta name="theme-color" content="#0d1219">
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
const ASSETS=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
// Only cache a genuinely good response — never a 404/503 error page or an opaque/redirected reply.
// Caching a bad response would serve it back offline as if it were the app (a deploy that 503s once
// would strand the PWA on an error page forever).
function cacheable(res){return res&&res.ok&&!res.redirected&&res.type!=='opaque';}
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(u.origin!==location.origin||e.request.method!=='GET')return;           // Dropbox / fonts go to the network
  if(e.request.mode==='navigate'||e.request.destination==='document'){
    e.respondWith(fetch(e.request).then(res=>{if(cacheable(res)){const copy=res.clone();e.waitUntil(caches.open(V).then(c=>c.put(e.request,copy)));}return res;}).catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||caches.match('./index.html'))));
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
