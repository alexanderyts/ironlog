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
function cleanSeen(v){if(!v||typeof v!=='object')return undefined;const o={};let n=0;
  // keys are one-time flags (e.g. 'profileIntro') and coaching mutes ('mute:volume-low:Chest') — allow ':' and '-'
  Object.keys(v).forEach(k=>{if(n>=MAX_KEYS)return;if(v[k]===true&&/^[A-Za-z0-9_:-]{1,60}$/.test(k)){o[k]=true;n++;}});   // cap so a corrupt map can't be absorbed and re-uploaded forever (D6)
  return Object.keys(o).length?o:undefined;}

const TOMB_KEEP=400*86400000;   // remember deletions ~13 months — longer than a phone left off for a season, so a device coming back online can't resurrect a delete (a tombstone is ~30 B; 500 of them is 15 KB)

/* Never lose a ticked set in a merge (batch 1). Merging used to be "the newest copy of a workout wins,
   whole" — so an older copy finished on the iPad could replace a fuller copy logged on the phone.
   Now the winning copy also takes every TICKED, time-stamped set the other copy has and it lacks
   (matched by exercise + tick time). Sets without a tick time (old data) fall back to newest-wins.
   The trade-off, chosen on purpose: a set deleted on one device can come back from a stale copy —
   annoying but visible and fixable, where a lost lift is not. */
const clone=o=>JSON.parse(JSON.stringify(o));
function tickKeys(s){const k=new Set();(s&&s.exercises||[]).forEach(e=>(e.sets||[]).forEach(st=>{if(st&&st.done!==false&&+st.at>0)k.add(e.id+'@'+(+st.at));}));return k;}
function hasTicked(s){return !!(s&&(s.exercises||[]).some(e=>(e.sets||[]).some(st=>st&&st.done!==false&&((+st.r||0)>0||(+st.w||0)>0))));}
// Copy into `into` (mutated) the ticked, time-stamped sets of `from` that it lacks. Returns how many.
function unionSets(into,from){
  if(!into||!from||!Array.isArray(into.exercises)||!Array.isArray(from.exercises))return 0;
  const have=tickKeys(into);let n=0;
  from.exercises.forEach(fe=>(fe.sets||[]).forEach(st=>{
    if(!(st&&st.done!==false&&+st.at>0))return;const k=fe.id+'@'+(+st.at);if(have.has(k))return;
    let e=into.exercises.find(x=>x.id===fe.id&&(x.mode||'')===(fe.mode||'')&&x.side===fe.side)||into.exercises.find(x=>x.id===fe.id);
    if(!e){e=clone(Object.assign({},fe,{sets:[]}));into.exercises.push(e);}
    e.sets.push(clone(st));have.add(k);n++;}));
  return n;
}
// Merge by id, newest updatedAt wins — plus the ticked sets of the losing copy (unionSets). tomb = {id: deletedAt}.
function mergeSessions(local,remote,tomb){
  tomb=tomb||{};
  const map=new Map((local||[]).map(s=>[s.id,s]));
  let changedLocal=false,pushNeeded=false;
  (remote||[]).forEach(r=>{
    if(!r||!r.id)return;
    if(tomb[r.id]&&tomb[r.id]>=(r.updatedAt||0)){pushNeeded=true;return;}   // deleted here after remote's copy → stays deleted
    const l=map.get(r.id);
    if(!l){map.set(r.id,r);changedLocal=true;}
    else if((r.updatedAt||0)>(l.updatedAt||0)){const c=clone(r);
      if(unionSets(c,l)){c.updatedAt=Math.max(r.updatedAt||0,l.updatedAt||0)+1;pushNeeded=true;map.set(r.id,c);}else map.set(r.id,r);changedLocal=true;}
    else if((l.updatedAt||0)>(r.updatedAt||0)){const c=clone(l);
      if(unionSets(c,r)){c.updatedAt=(l.updatedAt||0)+1;map.set(l.id,c);changedLocal=true;}pushNeeded=true;}
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
const MAX_STR=120, MAX_ARR=2000, MAX_SESSIONS=50000, MAX_SETS=100, MAX_EX=60, MAX_KEYS=5000;   // key-count cap for the deleted/seen maps
function sStr(v,max){return typeof v==='string'?v.slice(0,max||MAX_STR):'';}
function sId(v){return (typeof v==='string'?v:'').replace(/[^A-Za-z0-9_:.-]/g,'').slice(0,64);}
function sNum(v){const n=typeof v==='number'?v:(typeof v==='string'&&v.trim()!==''?+v:NaN);return Number.isFinite(n)?n:0;}
function sNumBlank(v){if(v===''||v==null)return '';const n=+v;return Number.isFinite(n)?n:'';}
function sArr(v,max){return Array.isArray(v)?v.slice(0,max||MAX_ARR):[];}
const rid=p=>p+Math.random().toString(36).slice(2,9);

function cleanSet(st){st=st&&typeof st==='object'?st:{};const o={w:sNumBlank(st.w),r:sNumBlank(st.r),done:st.done!==false};if(st.warm)o.warm=true;if(st.nc)o.nc=true;const at=+st.at;if(Number.isFinite(at)&&at>0)o.at=at;return o;}   // missing done => done; `at` (check timestamp) kept if a real number; `nc` = "doesn't count as a record"
function cleanExercise(e){e=e&&typeof e==='object'?e:{};const o={id:sId(e.id),name:sStr(e.name),sets:sArr(e.sets,MAX_SETS).map(cleanSet)};if(e.mode&&MODES[e.mode])o.mode=sId(e.mode);if(typeof e.side==='boolean')o.side=e.side;if(typeof e.note==='string'&&e.note.trim())o.note=sStr(e.note,500);return o;}   // drop an unknown mode (a bad import would white-screen Progress via MODES[mode].label)
function cleanSession(s){s=s&&typeof s==='object'?s:{};const o={id:sId(s.id)||rid('imp'),schema:sNum(s.schema)||1,date:sNum(s.date)||Date.now(),updatedAt:sNum(s.updatedAt)||sNum(s.date)||Date.now(),completed:s.completed!==false,exercises:sArr(s.exercises,MAX_EX).map(cleanExercise)};if(s.deload)o.deload=true;const b=sNum(s.bw);if(b>0)o.bw=Math.min(2000,b);/* per-session bodyweight snapshot (D-1) — preserve through cloud/import */if(typeof s.note==='string'&&s.note.trim())o.note=sStr(s.note,500);/* whole-workout note (D-4) */const end=+s.endedAt;if(Number.isFinite(end)&&end>0){o.endedAt=end;if(s.endEstimated===true)o.endEstimated=true;}
  if(s.unit==='lb'||s.unit==='kg')o.unit=s.unit;/* the unit its weights are in (batch 1) */if(s.recovered===true)o.recovered=true;
  if(s.kind==='cardio'){o.kind='cardio';o.exercises=[];o.cardio=cleanCardio(s.cardio);}   // cardio never carries exercises → every strength filter drops it
  return o;}
function cleanRoutine(r){r=r&&typeof r==='object'?r:{};return {id:sId(r.id)||rid('r'),name:sStr(r.name),exIds:sArr(r.exIds,MAX_EX).map(sId).filter(Boolean),updatedAt:sNum(r.updatedAt)||Date.now()};}
function cleanSettings(o){if(!o||typeof o!=='object')return null;
  const s={settingsUpdatedAt:sNum(o.settingsUpdatedAt)};
  if(o.unit==='kg'||o.unit==='lb')s.unit=o.unit;
  const uu=sNum(o.unitUpdatedAt);if(uu>0)s.unitUpdatedAt=uu;   // when the unit itself last changed (an unrelated newer settings change can't flip it)
  if(o.theme==='system'||o.theme==='light'||o.theme==='dark')s.theme=o.theme;
  s.bodyweight=Math.max(0,Math.min(2000,sNum(o.bodyweight)));
  const r=o.rest&&typeof o.rest==='object'?o.rest:{};
  s.rest={auto:r.auto!==false,sound:r.sound!==false,notify:!!r.notify,
    compound:Math.max(0,Math.min(3600,sNum(r.compound)||120)),isolation:Math.max(0,Math.min(3600,sNum(r.isolation)||75))};
  const prof=cleanProfile(o.profile);if(prof)s.profile=prof;
  const seen=cleanSeen(o.seen);if(seen)s.seen=seen;
  // remembered empty-bar weight per unit for the plate calculator (D-4): `bar` = barbell, `smithBar` = Smith
  const cleanBar=v=>{if(!v||typeof v!=='object')return null;const o={};if('lb'in v){const n=sNum(v.lb);if(n>=0)o.lb=Math.min(200,n);}if('kg'in v){const n=sNum(v.kg);if(n>=0)o.kg=Math.min(100,n);}return Object.keys(o).length?o:null;};   // preserve an explicit 0 (counterbalanced Smith)
  const bar=cleanBar(o.bar);if(bar)s.bar=bar;const sbar=cleanBar(o.smithBar);if(sbar)s.smithBar=sbar;
  // per-exercise weight step {exId:{lb,kg}} and machine-setup note {exId:"seat 4, pad 3"} (full review 5.3)
  const idMap=(v,fn)=>{if(!v||typeof v!=='object')return null;const r={};let n=0;
    Object.keys(v).forEach(k=>{if(n>=MAX_KEYS||DANGER_KEY.test(k))return;const key=sId(k);if(!key||DANGER_KEY.test(key))return;const x=fn(v[k]);if(x!=null){r[key]=x;n++;}});
    return Object.keys(r).length?r:null;};
  const steps=idMap(o.steps,x=>{if(!x||typeof x!=='object')return null;const r={};['lb','kg'].forEach(u=>{const n=sNum(x[u]);if(n>0&&n<=50)r[u]=n;});return Object.keys(r).length?r:null;});
  if(steps)s.steps=steps;
  const setup=idMap(o.setup,x=>typeof x==='string'&&x.trim()?sStr(x.trim(),120):null);if(setup)s.setup=setup;
  // "Your record" picks {exId:track: {score,tie}} (batch 1 — stored once instead of re-stamping old workouts)
  const records=idMap(o.records,x=>{if(!x||typeof x!=='object')return null;const sc=+x.score,ti=+x.tie;return Number.isFinite(sc)?{score:sc,tie:Number.isFinite(ti)?ti:0}:null;});if(records)s.records=records;
  return s;
}
const DANGER_KEY=/^(__proto__|constructor|prototype)$/;
function cleanDeleted(o){const out=Object.create(null);if(!o||typeof o!=='object')return out;
  let keys=Object.keys(o);
  if(keys.length>MAX_KEYS)keys=keys.sort((a,b)=>(sNum(o[b])||0)-(sNum(o[a])||0)).slice(0,MAX_KEYS);   // keep the most-recent tombstones; drop the overflow so a corrupt map can't be re-uploaded forever (D6)
  keys.forEach(k=>{if(DANGER_KEY.test(k))return;const key=sId(k),at=sNum(o[k]);if(key&&!DANGER_KEY.test(key)&&at)out[key]=at;});return out;}

function parseImport(json){
  const d=typeof json==='string'?JSON.parse(json):json;
  if(!d||typeof d!=='object'||!Array.isArray(d.sessions))throw new Error('Not an Ironlog backup');
  return {
    settings:cleanSettings(d.settings),
    sessions:sArr(d.sessions,MAX_SESSIONS).map(cleanSession),   // was capped at 2,000 — a long-time lifter's oldest workouts were silently cut
    routines:sArr(d.routines).map(cleanRoutine),
    deleted:cleanDeleted(d.deleted),
    active:(d.active&&typeof d.active==='object')?cleanSession(d.active):null,
    activeClearedAt:sNum(d.activeClearedAt)||0
  };
}

// Resolve the active workout between two devices. Each side is {active, activeClearedAt}; the more
// recent EVENT wins — a workout updated at T, or ended/cleared at T. So a finished workout (cleared)
// is never resurrected by another device's older, still-open active session. Pure and testable.
// Batch 1: a live workout with ticked sets is never silently thrown away. When the other device's
// newer event would REPLACE it (a different workout) or END it, it comes back as `dropped` so the store
// can keep it as a recovered workout. The same workout open on both sides merges its ticked sets.
function resolveActive(local,remote){
  const lc=local.activeClearedAt||0,rc=remote.activeClearedAt||0;
  const la=local.active,ra=remote.active;
  const localEvt=la?(la.updatedAt||0):lc;
  const remoteEvt=ra?(ra.updatedAt||0):rc;
  if(remoteEvt>localEvt){
    if(ra){if(la&&la.id===ra.id){const c=clone(ra);unionSets(c,la);return {active:c,activeClearedAt:lc,changed:true,pushNeeded:tickKeys(c).size>tickKeys(ra).size};}
      return {active:ra,activeClearedAt:lc,changed:true,pushNeeded:false,dropped:la&&hasTicked(la)?la:null};}
    return {active:null,activeClearedAt:Math.max(lc,rc),changed:true,pushNeeded:false,dropped:la&&hasTicked(la)?la:null};
  }
  if(la&&ra&&la.id===ra.id){const c=clone(la);if(unionSets(c,ra)){c.updatedAt=(la.updatedAt||0)+1;return {active:c,activeClearedAt:lc,changed:true,pushNeeded:true};}}
  return {active:la,activeClearedAt:lc,changed:false,pushNeeded:remoteEvt<localEvt};
}

// One row per finished workout — a health-app / spreadsheet friendly summary (D-4 CSV export). Volume
// uses each session's own bodyweight (D-1). Cardio rows carry their type/intensity/distance in Notes.
function csvCell(v){v=v==null?'':String(v);return /[",\n\r]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}
// bw: the current bodyweight, the fallback for a session saved without its own (the same rule the app's
// screens use — otherwise the CSV showed 0 volume for those bodyweight lifts; full review 4.9)
function sessionSummaryCsv(sessions,unit,bw){
  const P=IL.prog;unit=unit==='kg'?'kg':'lb';
  const rows=[['Date','Day','Type','Duration (min)','Volume ('+unit+')','Working sets','Exercises','Bodyweight ('+unit+')','Notes']];
  (sessions||[]).filter(s=>s&&s.completed!==false).slice().sort((a,b)=>a.date-b.date).forEach(s=>{
    const d=new Date(s.date),iso=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    const day=d.toLocaleDateString('en-US',{weekday:'short'}),cardio=s.kind==='cardio';
    const dur=P.sessionDuration(s);let notes=s.note||'';
    if(cardio){const c=s.cardio||{},bits=[c.type,c.intensity,(c.distance!=null?c.distance+' '+(c.unit||''):'')].filter(Boolean);notes=[bits.join(' · '),s.note].filter(Boolean).join(' — ');}
    rows.push([iso,day,cardio?'Cardio':(s.deload?'Deload':'Strength'),dur==null?'':dur,
      cardio?'':P.sessionVolume(s,+bw||0),cardio?'':P.sessionSets(s),cardio?'':(s.exercises?s.exercises.length:0),
      (+s.bw>0)?s.bw:'',notes].map(csvCell));
  });
  return rows.map(r=>r.join(',')).join('\r\n')+'\r\n';
}

IL.sync={unionSets,hasTicked,MAX_SESSIONS,mergeSessions,applyTombstones,pruneTombstones,cleanDeleted,exportPayload,parseImport,resolveActive,cleanSession,cleanRoutine,cleanSettings,cleanProfile,cleanCardio,sessionSummaryCsv,PROFILE_ENUM,CARDIO_ENUM,TOMB_KEEP};
if(typeof module!=='undefined')module.exports=IL.sync;
