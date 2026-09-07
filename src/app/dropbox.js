// Dropbox cloud save for the standalone (GitHub Pages) build. OAuth PKCE runs entirely in the
// browser — no server, no secret. The app writes one JSON file to its own Dropbox app folder.
var IL=globalThis.IL||(globalThis.IL={});

const KEY='il_dbx', PKCE='il_dbx_pkce', FILE='/ironlog.json';
const appKey=()=>(IL.config&&IL.config.DROPBOX_APP_KEY)||'';
function redirectUri(){return location.origin+location.pathname;}
function lsGet(k){try{const v=localStorage.getItem(k);return v?JSON.parse(v):null;}catch(e){return null;}}
function lsSet(k,v){try{if(v==null)localStorage.removeItem(k);else localStorage.setItem(k,JSON.stringify(v));}catch(e){}}

function isConfigured(){return !!appKey()&&typeof fetch==='function';}
function isConnected(){const t=lsGet(KEY);return !!(t&&t.rt);}
function disconnect(){lsSet(KEY,null);}

function b64url(buf){return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
async function connect(){
  const arr=new Uint8Array(48);crypto.getRandomValues(arr);
  const verifier=b64url(arr.buffer);
  const challenge=b64url(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));
  lsSet(PKCE,{verifier,at:Date.now()});
  const u='https://www.dropbox.com/oauth2/authorize?client_id='+encodeURIComponent(appKey())+'&response_type=code&code_challenge='+challenge+'&code_challenge_method=S256&redirect_uri='+encodeURIComponent(redirectUri())+'&token_access_type=offline';
  location.href=u;
}
// Call on page load: finishes the OAuth dance if we just came back from Dropbox
async function handleRedirect(){
  const p=new URLSearchParams(location.search);const code=p.get('code');
  if(!code)return false;
  const pk=lsGet(PKCE);
  try{history.replaceState(null,'',location.pathname);}catch(e){}
  if(!pk)return false;
  const body=new URLSearchParams({code,grant_type:'authorization_code',code_verifier:pk.verifier,client_id:appKey(),redirect_uri:redirectUri()});
  const r=await fetch('https://api.dropboxapi.com/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
  if(!r.ok)throw new Error('Dropbox sign-in failed');
  const j=await r.json();
  lsSet(KEY,{at:j.access_token,rt:j.refresh_token,exp:Date.now()+(j.expires_in||14400)*1000-60000});
  lsSet(PKCE,null);
  return true;
}
async function accessToken(){
  const t=lsGet(KEY);if(!t)throw new Error('not connected');
  if(t.at&&t.exp>Date.now())return t.at;
  const body=new URLSearchParams({grant_type:'refresh_token',refresh_token:t.rt,client_id:appKey()});
  const r=await fetch('https://api.dropboxapi.com/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
  if(!r.ok){if(r.status===400||r.status===401)disconnect();throw new Error('Dropbox session expired');}
  const j=await r.json();
  t.at=j.access_token;t.exp=Date.now()+(j.expires_in||14400)*1000-60000;lsSet(KEY,t);
  return t.at;
}
// Returns {rev, modified} or null when the file doesn't exist yet
async function getMetadata(){
  const at=await accessToken();
  const r=await fetch('https://api.dropboxapi.com/2/files/get_metadata',{method:'POST',headers:{Authorization:'Bearer '+at,'Content-Type':'application/json'},body:JSON.stringify({path:FILE})});
  if(r.status===409)return null;
  if(!r.ok)throw new Error('Dropbox metadata failed');
  const j=await r.json();return {rev:j.rev,modified:j.server_modified};
}
async function download(){
  const at=await accessToken();
  const r=await fetch('https://content.dropboxapi.com/2/files/download',{method:'POST',headers:{Authorization:'Bearer '+at,'Dropbox-API-Arg':JSON.stringify({path:FILE})}});
  if(r.status===409)return null;
  if(!r.ok)throw new Error('Dropbox download failed');
  const meta=JSON.parse(r.headers.get('dropbox-api-result')||'{}');
  return {rev:meta.rev,text:await r.text()};
}
async function upload(text){
  const at=await accessToken();
  const r=await fetch('https://content.dropboxapi.com/2/files/upload',{method:'POST',headers:{Authorization:'Bearer '+at,'Dropbox-API-Arg':JSON.stringify({path:FILE,mode:'overwrite',mute:true}),'Content-Type':'application/octet-stream'},body:text});
  if(!r.ok)throw new Error('Dropbox upload failed');
  const j=await r.json();return j.rev;
}

IL.dropbox={isConfigured,isConnected,connect,disconnect,handleRedirect,getMetadata,download,upload,FILE};
