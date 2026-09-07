// Build: assembles src/ into
//   dist/app.html  — single-file Claude Artifact (cloud DB backend)
//   docs/          — standalone site for GitHub Pages (Dropbox backend, offline service worker, icons)
const fs=require('fs'),path=require('path'),zlib=require('zlib');
const root=__dirname,pkg=require('./package.json');
const cfg=fs.existsSync(path.join(root,'config.json'))?JSON.parse(fs.readFileSync(path.join(root,'config.json'),'utf8')):{};
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const write=(p,d)=>{const f=path.join(root,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,d);console.log('  wrote',p,typeof d==='string'?(d.length/1024).toFixed(1)+' KB':d.length+' bytes');};

const MODULES=['src/data/exercises.js','src/engine/progression.js','src/engine/search.js','src/engine/builder.js','src/engine/analysis.js','src/engine/sync.js','src/app/dropbox.js','src/app/store.js','src/app/ui.js'];
const FONTS='<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800&family=IBM+Plex+Mono:wght@500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap">';

function bundle(target){
  const head=`/* Ironlog v${pkg.version} · ${target} build · ${new Date().toISOString()} */\nvar IL=globalThis.IL||(globalThis.IL={});IL.config={BUILD:${JSON.stringify(target)},VERSION:${JSON.stringify(pkg.version)},DROPBOX_APP_KEY:${JSON.stringify(cfg.DROPBOX_APP_KEY||'')}};\n`;
  // each module is wrapped so its top-level consts stay private; exports go on IL
  return head+MODULES.map(m=>`\n/* ===== ${m} ===== */\n(function(){'use strict';\n${read(m)}\n})();\n`).join('');
}
const css=read('src/styles.css'),body=read('src/template.html');

// --- Artifact (the claude.ai wrapper supplies doctype/head; we start at <title>) ---
const artifact=`<title>Ironlog</title>\n${FONTS}\n<style>\n${css}\n</style>\n${body}\n<script>\n${bundle('artifact')}\n</script>\n`;

// --- Standalone site ---
const SW_REG=`if('serviceWorker' in navigator&&location.hostname!=='localhost'){navigator.serviceWorker.register('./sw.js').then(reg=>{reg.addEventListener('updatefound',()=>{const nw=reg.installing;if(!nw)return;nw.addEventListener('statechange',()=>{if(nw.state==='installed'&&navigator.serviceWorker.controller&&IL.ui)IL.ui.toast('Update ready',{label:'Reload',fn:()=>location.reload()});});});}).catch(()=>{});}`;
const site=`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
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
<script>
${bundle('site')}
</script>
<script>${SW_REG}</script>
</body>
</html>
`;
const sw=`// Ironlog service worker — app shell cached for offline use; version-keyed so updates replace it.
const V='ironlog-${pkg.version}';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(u.origin!==location.origin||e.request.method!=='GET')return;           // Dropbox / fonts go to the network
  e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(r=>r||fetch(e.request).then(res=>{const copy=res.clone();caches.open(V).then(c=>c.put(e.request,copy));return res;}).catch(()=>caches.match('./index.html'))));
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
write('docs/index.html',site);
write('docs/sw.js',sw);
write('docs/manifest.webmanifest',manifest);
write('docs/icon-192.png',makeIcon(192));
write('docs/icon-512.png',makeIcon(512));
write('docs/apple-touch-icon.png',makeIcon(180));
console.log('Done.');
