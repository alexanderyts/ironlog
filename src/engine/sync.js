// Pure merge/backup logic shared by every cloud backend (Claude DB, Dropbox, file import).
var IL=globalThis.IL||(globalThis.IL={});
if(typeof require==='function'&&!IL.data)require('../data/exercises.js');
const MODES=(IL.data&&IL.data.MODES)||{},EX=(IL.data&&IL.data.EX)||{},GROUPS=(IL.data&&IL.data.GROUPS)||[];   // to validate imported modality / profile ids
// Training profile (v6 P2 reads it; P1 only stores it). Each field is optional; a valid non-'auto'
// value is kept, anything else is dropped (so absent = auto = Balanced = today's behaviour).
const PROFILE_ENUM={goal:['size','strength','general'],gym:['full','machine','home'],length:['short','standard','long'],sets:['straight','ramp'],push:['guide','quiet']};
// Cardio is its own session KIND (kind:'cardio', exercises:[]). These enums bound the two picked fields;
// distance is optional and carries the unit it was logged in (so a later lb↔kg switch can't reinterpret it).
const CARDIO_ENUM={type:['treadmill','elliptical','stairmaster','outdoor','indoor'],intensity:['easy','moderate','hard']};
function cleanCardio(c){c=c&&typeof c==='object'?c:{};const o={};
  o.type=CARDIO_ENUM.type.indexOf(c.type)>=0?c.type:'treadmill';
  o.intensity=CARDIO_ENUM.intensity.indexOf(c.intensity)>=0?c.intensity:'moderate';
  const d=+c.distance;if(Number.isFinite(d)&&d>0)o.distance=Math.min(1000,d);
  if(o.distance!=null)o.unit=c.unit==='km'?'km':'mi';
  return o;}
function cleanProfile(p){if(!p||typeof p!=='object')return undefined;const o={};
  Object.keys(PROFILE_ENUM).forEach(k=>{if(PROFILE_ENUM[k].indexOf(p[k])>=0)o[k]=p[k];});
  if([2,3,4,5,6].indexOf(+p.days)>=0)o.days=+p.days;
  if(Array.isArray(p.avoid)){const a=p.avoid.filter(id=>EX[id]).slice(0,60);if(a.length)o.avoid=a;}
  if(Array.isArray(p.protect)){const g=p.protect.filter(x=>GROUPS.indexOf(x)>=0).slice(0,GROUPS.length);if(g.length)o.protect=g;}
  return Object.keys(o).length?o:undefined;}
// "Seen this announcement once" flags (e.g. the profile intro), synced so a dismissal sticks everywhere.
function cleanSeen(v){if(!v||typeof v!=='object')return undefined;const o={};
  // keys are one-time flags (e.g. 'profileIntro') and coaching mutes ('mute:volume-low:Chest') — allow ':' and '-'
  Object.keys(v).forEach(k=>{if(v[k]===true&&/^[A-Za-z0-9_:-]{1,60}$/.test(k))o[k]=true;});
  return Object.keys(o).length?o:undefined;}

const TOMB_KEEP=400*86400000;   // remember deletions ~13 months — longer than a phone left off for a season, so a device coming back online can't resurrect a delete (a tombstone is ~30 B; 500 of them is 15 KB)

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
    settings:st.settings,sessions:st.sessions,routines:st.routines||[],deleted:st.deleted||{},active:st.active||null,activeClearedAt:st.activeClearedAt||0};
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

function cleanSet(st){st=st&&typeof st==='object'?st:{};const o={w:sNumBlank(st.w),r:sNumBlank(st.r),done:st.done!==false};if(st.warm)o.warm=true;const at=+st.at;if(Number.isFinite(at)&&at>0)o.at=at;return o;}   // missing done => done; `at` (check timestamp) kept if a real number
function cleanExercise(e){e=e&&typeof e==='object'?e:{};const o={id:sId(e.id),name:sStr(e.name),sets:sArr(e.sets,MAX_SETS).map(cleanSet)};if(e.mode&&MODES[e.mode])o.mode=sId(e.mode);if(typeof e.note==='string'&&e.note.trim())o.note=sStr(e.note,500);return o;}   // drop an unknown mode (a bad import would white-screen Progress via MODES[mode].label)
function cleanSession(s){s=s&&typeof s==='object'?s:{};const o={id:sId(s.id)||rid('imp'),schema:sNum(s.schema)||1,date:sNum(s.date)||Date.now(),updatedAt:sNum(s.updatedAt)||sNum(s.date)||Date.now(),completed:s.completed!==false,exercises:sArr(s.exercises,MAX_EX).map(cleanExercise)};if(s.deload)o.deload=true;const end=+s.endedAt;if(Number.isFinite(end)&&end>0){o.endedAt=end;if(s.endEstimated===true)o.endEstimated=true;}
  if(s.kind==='cardio'){o.kind='cardio';o.exercises=[];o.cardio=cleanCardio(s.cardio);}   // cardio never carries exercises → every strength filter drops it
  return o;}
function cleanRoutine(r){r=r&&typeof r==='object'?r:{};return {id:sId(r.id)||rid('r'),name:sStr(r.name),exIds:sArr(r.exIds,MAX_EX).map(sId).filter(Boolean),updatedAt:sNum(r.updatedAt)||Date.now()};}
function cleanSettings(o){if(!o||typeof o!=='object')return null;
  const s={settingsUpdatedAt:sNum(o.settingsUpdatedAt)};
  if(o.unit==='kg'||o.unit==='lb')s.unit=o.unit;
  if(o.theme==='system'||o.theme==='light'||o.theme==='dark')s.theme=o.theme;
  s.bodyweight=Math.max(0,Math.min(2000,sNum(o.bodyweight)));
  const r=o.rest&&typeof o.rest==='object'?o.rest:{};
  s.rest={auto:r.auto!==false,sound:r.sound!==false,notify:!!r.notify,
    compound:Math.max(0,Math.min(3600,sNum(r.compound)||120)),isolation:Math.max(0,Math.min(3600,sNum(r.isolation)||75))};
  const prof=cleanProfile(o.profile);if(prof)s.profile=prof;
  const seen=cleanSeen(o.seen);if(seen)s.seen=seen;
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
    active:(d.active&&typeof d.active==='object')?cleanSession(d.active):null,
    activeClearedAt:sNum(d.activeClearedAt)||0
  };
}

// Resolve the active workout between two devices. Each side is {active, activeClearedAt}; the more
// recent EVENT wins — a workout updated at T, or ended/cleared at T. So a finished workout (cleared)
// is never resurrected by another device's older, still-open active session. Pure and testable.
function resolveActive(local,remote){
  const lc=local.activeClearedAt||0,rc=remote.activeClearedAt||0;
  const localEvt=local.active?(local.active.updatedAt||0):lc;
  const remoteEvt=remote.active?(remote.active.updatedAt||0):rc;
  if(remoteEvt>localEvt)return remote.active?{active:remote.active,activeClearedAt:lc,changed:true,pushNeeded:false}
                                            :{active:null,activeClearedAt:Math.max(lc,rc),changed:true,pushNeeded:false};
  return {active:local.active,activeClearedAt:lc,changed:false,pushNeeded:remoteEvt<localEvt};
}

IL.sync={mergeSessions,applyTombstones,pruneTombstones,exportPayload,parseImport,resolveActive,cleanSession,cleanRoutine,cleanSettings,cleanProfile,cleanCardio,PROFILE_ENUM,CARDIO_ENUM,TOMB_KEEP};
if(typeof module!=='undefined')module.exports=IL.sync;
