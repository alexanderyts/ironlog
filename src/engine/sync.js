// Pure merge/backup logic shared by every cloud backend (Claude DB, Dropbox, file import).
var IL=globalThis.IL||(globalThis.IL={});

const TOMB_KEEP=90*86400000;   // remember deletions for 90 days so no device resurrects them

// Merge by id, newest updatedAt wins. tomb = {id: deletedAt}. Returns what changed on each side.
function mergeSessions(local,remote,tomb){
  tomb=tomb||{};
  const map=new Map((local||[]).map(s=>[s.id,s]));
  let changedLocal=false,pushNeeded=false;
  (remote||[]).forEach(r=>{
    if(!r||!r.id)return;
    if(tomb[r.id]&&tomb[r.id]>=(r.updatedAt||0)){pushNeeded=true;return;}   // deleted here after remote's copy → stays deleted
    const l=map.get(r.id);
    if(!l){map.set(r.id,r);changedLocal=true;}
    else if((r.updatedAt||0)>(l.updatedAt||0)){map.set(r.id,r);changedLocal=true;}
    else if((l.updatedAt||0)>(r.updatedAt||0))pushNeeded=true;
  });
  const remoteIds=new Set((remote||[]).map(r=>r&&r.id));
  (local||[]).forEach(l=>{if(!remoteIds.has(l.id))pushNeeded=true;});
  const merged=[...map.values()].sort((a,b)=>(b.date||0)-(a.date||0));
  return {merged,changedLocal,pushNeeded};
}
// Apply another device's deletions; returns {sessions, tomb, changed}
function applyTombstones(sessions,localTomb,remoteTomb){
  const tomb=Object.assign({},localTomb||{});let changed=false;
  Object.entries(remoteTomb||{}).forEach(([id,at])=>{if(!tomb[id]||at>tomb[id])tomb[id]=at;});
  const out=(sessions||[]).filter(s=>{const t=tomb[s.id];if(t&&t>=(s.updatedAt||0)){changed=true;return false;}return true;});
  return {sessions:out,tomb,changed};
}
function pruneTombstones(tomb,now){
  now=now||Date.now();const out={};
  Object.entries(tomb||{}).forEach(([id,at])=>{if(now-at<TOMB_KEEP)out[id]=at;});
  return out;
}
// The one backup/sync document shape (file export and Dropbox both use it)
function exportPayload(st,version){
  return {app:'ironlog',format:2,version:version||'',exported:new Date().toISOString(),
    settings:st.settings,sessions:st.sessions,routines:st.routines||[],deleted:st.deleted||{},active:st.active||null};
}
function parseImport(json){
  const d=typeof json==='string'?JSON.parse(json):json;
  if(!d||!Array.isArray(d.sessions))throw new Error('Not an Ironlog backup');
  return {settings:d.settings||null,sessions:d.sessions,routines:Array.isArray(d.routines)?d.routines:[],deleted:d.deleted||{},active:d.active||null};
}

IL.sync={mergeSessions,applyTombstones,pruneTombstones,exportPayload,parseImport,TOMB_KEEP};
if(typeof module!=='undefined')module.exports=IL.sync;
