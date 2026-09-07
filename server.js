// Local dev server: serves the standalone site build (docs/) on http://localhost:4321
// Run `npm run build` first. The service worker is skipped on localhost so edits show immediately.
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'docs');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8','.png':'image/png','.css':'text/css; charset=utf-8'};
http.createServer((req,res)=>{
  let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';
  // /demo previews the seeded demo artifact build
  const fp=p==='/demo'?path.join(__dirname,'dist','demo.html'):path.join(root,p);
  fs.readFile(fp,(err,data)=>{
    if(err){res.writeHead(404);res.end('Not found — did you run `npm run build`?');return;}
    res.writeHead(200,{'Content-Type':types[path.extname(fp)]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(data);
  });
}).listen(4321,()=>console.log('Ironlog dev server → http://localhost:4321  (serving docs/)'));
