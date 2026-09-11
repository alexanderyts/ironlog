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
/* ── Import sanitization: the trust boundary for file imports and cloud (Dropbox/DB) snapshots ──────
   Backups are UNTRUSTED input (a shared file, a synced blob, another viewer of a shared artifact).
   Every record is rebuilt field-by-field from a whitelist with each value type-coerced. Two payoffs:
   (1) the UI renders numbers as numbers and short strings as strings, so a crafted value like
       w:'"><img onerror=…>' can't survive to inject into markup, and (2) because we only ever assign
   known literal keys to fresh objects, this is structurally immune to prototype pollution
   (__proto__/constructor keys in the JSON are simply never copied). Escaping in the views and the CSP
   are defense-in-depth on top of this. */
const MAX_STR=120, MAX_ARR=2000, MAX_SETS=100, MAX_EX=60;
function sStr(v,max){return typeof v==='string'?v.slice(0,max||MAX_STR):'';}
function sId(v){return (typeof v==='string'?v:'').replace(/[^A-Za-z0-9_:.-]/g,'').slice(0,64);}
function sNum(v){const n=typeof v==='number'?v:(typeof v==='string'&&v.trim()!==''?+v:NaN);return Number.isFinite(n)?n:0;}
function sNumBlank(v){if(v===''||v==null)return '';const n=+v;return Number.isFinite(n)?n:'';}
function sArr(v,max){return Array.isArray(v)?v.slice(0,max||MAX_ARR):[];}
const rid=p=>p+Math.random().toString(36).slice(2,9);

function cleanSet(st){st=st&&typeof st==='object'?st:{};const o={w:sNumBlank(st.w),r:sNumBlank(st.r),done:!!st.done};if(st.warm)o.warm=true;return o;}
function cleanExercise(e){e=e&&typeof e==='object'?e:{};const o={id:sId(e.id),name:sStr(e.name),sets:sArr(e.sets,MAX_SETS).map(cleanSet)};if(e.mode)o.mode=sId(e.mode);return o;}
function cleanSession(s){s=s&&typeof s==='object'?s:{};const o={id:sId(s.id)||rid('imp'),schema:sNum(s.schema)||1,date:sNum(s.date)||Date.now(),updatedAt:sNum(s.updatedAt)||sNum(s.date)||Date.now(),completed:s.completed!==false,exercises:sArr(s.exercises,MAX_EX).map(cleanExercise)};if(s.deload)o.deload=true;return o;}
function cleanRoutine(r){r=r&&typeof r==='object'?r:{};return {id:sId(r.id)||rid('r'),name:sStr(r.name),exIds:sArr(r.exIds,MAX_EX).map(sId).filter(Boolean),updatedAt:sNum(r.updatedAt)||Date.now()};}
function cleanSettings(o){if(!o||typeof o!=='object')return null;
  const s={settingsUpdatedAt:sNum(o.settingsUpdatedAt)};
  if(o.unit==='kg'||o.unit==='lb')s.unit=o.unit;
  if(o.theme==='system'||o.theme==='light'||o.theme==='dark')s.theme=o.theme;
  s.bodyweight=Math.max(0,Math.min(2000,sNum(o.bodyweight)));
  const r=o.rest&&typeof o.rest==='object'?o.rest:{};
  s.rest={auto:r.auto!==false,sound:r.sound!==false,notify:!!r.notify,
    compound:Math.max(0,Math.min(3600,sNum(r.compound)||120)),isolation:Math.max(0,Math.min(3600,sNum(r.isolation)||75))};
  return s;
}
const DANGER_KEY=/^(__proto__|constructor|prototype)$/;
function cleanDeleted(o){const out=Object.create(null);if(o&&typeof o==='object')Object.keys(o).forEach(k=>{if(DANGER_KEY.test(k))return;const key=sId(k),at=sNum(o[k]);if(key&&!DANGER_KEY.test(key)&&at)out[key]=at;});return out;}

function parseImport(json){
  const d=typeof json==='string'?JSON.parse(json):json;
  if(!d||typeof d!=='object'||!Array.isArray(d.sessions))throw new Error('Not an Ironlog backup');
  return {
    settings:cleanSettings(d.settings),
    sessions:sArr(d.sessions).map(cleanSession),
    routines:sArr(d.routines).map(cleanRoutine),
    deleted:cleanDeleted(d.deleted),
    active:(d.active&&typeof d.active==='object')?cleanSession(d.active):null
  };
}

IL.sync={mergeSessions,applyTombstones,pruneTombstones,exportPayload,parseImport,cleanSession,cleanRoutine,cleanSettings,TOMB_KEEP};
if(typeof module!=='undefined')module.exports=IL.sync;
