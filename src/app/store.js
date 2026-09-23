// App state: local-first persistence (localStorage) plus a pluggable cloud backend.
//   artifact  → Claude's built-in database (when the app runs inside a claude.ai artifact)
//   dropbox   → one JSON file in the user's Dropbox app folder (standalone / GitHub Pages build)
//   none      → on-device only
var IL=globalThis.IL||(globalThis.IL={});
const {mergeSessions,applyTombstones,pruneTombstones,cleanDeleted,exportPayload,parseImport,cleanSession,cleanRoutine,cleanSettings}=IL.sync;
const CFG=IL.config||{};

const LS={sessions:'il_sessions',active:'il_active',settings:'il_settings',dirty:'il_dirty',routines:'il_routines',deleted:'il_deleted',dbxRev:'il_dbx_rev',activeCleared:'il_active_cleared',pushPending:'il_push_pending',blockedVer:'il_blocked_ver'};
function lsGet(k,f){let v=null;try{v=localStorage.getItem(k);return v?JSON.parse(v):f;}
  catch(e){
    // A stored value that won't parse must never be silently replaced by the default and saved over —
    // for the workouts that would erase them. Keep the raw text aside first (batch 1).
    try{if(v&&k==='il_sessions'&&!localStorage.getItem('il_sessions_corrupt'))localStorage.setItem('il_sessions_corrupt',v);}catch(_){}
    return f;}}
// Returns false when the write is refused (private mode, or the ~5 MB quota is full). Callers that
// hold the only copy of something (a finished workout) MUST check this and not discard it on false.
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(e){return false;}}
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
// One place that owns the defaults so a settings REBUILD (needed to let a removed key like a reset
// profile propagate across devices) can't drift from the shape used at boot. Fresh nested rest each call.
const defSettings=()=>({unit:'lb',theme:'system',bodyweight:0,settingsUpdatedAt:0,rest:{auto:true,sound:true,notify:false,compound:120,isolation:75}});
// Approx bytes localStorage holds for this app (UTF-16, so ×2) — shown in Settings so a user sees the
// ceiling coming before finding #1 bites.
function storageBytes(){try{let n=0;for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);n+=((localStorage.getItem(k)||'').length+k.length)*2;}return n;}catch(e){return 0;}}
// Semver a > b over three integer parts (for the sync version gate).
function verGt(a,b){const pa=String(a||'').split('.').map(n=>+n||0),pb=String(b||'').split('.').map(n=>+n||0);for(let i=0;i<3;i++){if((pa[i]||0)>(pb[i]||0))return true;if((pa[i]||0)<(pb[i]||0))return false;}return false;}

const state={
  sessions:lsGet(LS.sessions,[]),
  active:lsGet(LS.active,null),
  settings:Object.assign({unit:'lb',theme:'system',bodyweight:0,settingsUpdatedAt:0},lsGet(LS.settings,{})),
  routines:lsGet(LS.routines,[]),
  deleted:lsGet(LS.deleted,{}),
  dirty:new Set(lsGet(LS.dirty,[])),
  activeClearedAt:lsGet(LS.activeCleared,0),   // when this device last ended/discarded a workout (so a stale active on another device can't resurrect a finished one)
  cloud:null, cloudName:'none', syncing:false, lastSync:0, cloudError:'', storageError:false
};
state.settings.rest=Object.assign({auto:true,sound:true,notify:false,compound:120,isolation:75},state.settings.rest||{});
state.deleted=pruneTombstones(state.deleted);
// Demo build: load sample data the first time this browser opens it (viewers keep their own copy)
if(CFG.DEMO&&IL.seed&&!state.sessions.length&&!lsGet('il_seeded',false)){
  const d=IL.seed.make(Date.now());
  state.sessions=d.sessions;state.routines=d.routines;Object.assign(state.settings,d.settings);
  lsSet(LS.sessions,state.sessions);lsSet(LS.routines,state.routines);lsSet(LS.settings,state.settings);lsSet('il_seeded',1);
  state.justSeeded=true;
}
function resetDemo(){try{Object.values(LS).forEach(k=>localStorage.removeItem(k));localStorage.removeItem('il_seeded');}catch(e){}location.reload();}
// D-1 one-time freeze: stamp already-logged workouts with the current bodyweight so their bodyweight-lift
// math stops drifting as you update your weight later. Runs once a bodyweight is known; workouts logged
// after this snapshot their own at finish. Local (per-device) marker — not synced, so each device freezes
// its own copy with its own number, and it doesn't bump updatedAt (no mass cloud re-push for a local fill).
(function freezeBodyweight(){
  try{if(lsGet('il_bwfrozen',false))return;const b=+state.settings.bodyweight||0;if(b<=0)return;
    let changed=false;state.sessions.forEach(s=>{if(s&&s.completed&&!(+s.bw>0)){s.bw=b;changed=true;}});
    if(changed)lsSet(LS.sessions,state.sessions);lsSet('il_bwfrozen',1);
  }catch(e){}
})();

/* Units (batch 1). Every workout carries the unit its weights are in, so a lb↔kg switch on one device
   and a newer settings change on another can no longer relabel history (225 lb reading as 225 kg).
   normalizeUnits converts any workout in the other unit to the current one and stamps it; it never
   bumps updatedAt (a local view of the same data). Unstamped workouts (older versions) are assumed to be
   in the unit they've always been shown in. */
function normalizeUnits(list,unit){
  unit=unit||state.settings.unit||'lb';let changed=false;
  (list||[]).forEach(s=>{if(!s||typeof s!=='object')return;
    if(!s.unit){s.unit=unit;changed=true;return;}
    if(s.unit!==unit&&IL.prog&&IL.prog.convertSessions){IL.prog.convertSessions([s],s.unit,unit,0,false);s.unit=unit;changed=true;}});
  return changed;
}
if(normalizeUnits(state.sessions))lsSet(LS.sessions,state.sessions);
if(state.active&&!state.active.unit)state.active.unit=state.settings.unit||'lb';
// A workout another device's sync would have thrown away (it had ticked sets) is kept as a finished,
// "recovered" workout instead, and the UI says so (batch 1).
function recoverWorkout(a){
  if(!a||state.sessions.some(x=>x.id===a.id))return false;
  const ex=IL.prog&&IL.prog.finalizeSets?IL.prog.finalizeSets(a.exercises||[]):(a.exercises||[]);
  if(!ex.length)return false;
  const s=Object.assign({},a,{exercises:ex,completed:true,recovered:true,updatedAt:Date.now()});delete s.offers;
  upsertSession(s,false);state.notice='Kept a workout from another device so nothing was lost — it’s in History.';
  return true;
}
const saveSessions=()=>{const ok=lsSet(LS.sessions,state.sessions);state.storageError=!ok;return ok;};   // the big blob is where the quota bites; track it so the UI can warn
const saveActive=()=>{const a=lsSet(LS.active,state.active);const b=lsSet(LS.activeCleared,state.activeClearedAt||0);return a&&b;};   // the active workout is the SOLE copy of live data until Finish — report if it didn't land
const saveSettings=()=>lsSet(LS.settings,state.settings);
const saveRoutines=()=>lsSet(LS.routines,state.routines);
const saveDeleted=()=>lsSet(LS.deleted,state.deleted);
const saveDirty=()=>lsSet(LS.dirty,[...state.dirty]);

const listeners=[];
function onChange(fn){listeners.push(fn);}
// kind 'data' (default) = something on screen may have changed → the UI re-renders.
// kind 'status' = only sync bookkeeping moved (syncing/lastSync/cloudError) → the UI refreshes just the
// header badge. Every Dropbox sync used to redraw the whole screen twice, ~4 s after each edit, which
// could cut off a held +/− press mid-set (review 7.4).
function emit(kind){listeners.forEach(fn=>{try{fn(kind||'data');}catch(e){}});}

/* ---- sessions ---- */
function upsertSession(s,fromCloud){
  s.updatedAt=s.updatedAt||Date.now();
  if(!s.unit&&!fromCloud)s.unit=state.settings.unit||'lb';
  const i=state.sessions.findIndex(x=>x.id===s.id);
  if(i>=0){if(!fromCloud||s.updatedAt>=(state.sessions[i].updatedAt||0))state.sessions[i]=s;}
  else state.sessions.push(s);
  state.sessions.sort((a,b)=>b.date-a.date);
  const ok=saveSessions();
  if(!fromCloud){delete state.deleted[s.id];saveDeleted();state.dirty.add(s.id);saveDirty();if(state.cloud)state.cloud.pushSession(s);}
  return ok;   // false = the on-disk sessions blob didn't save (quota); the caller must not discard its copy
}
function deleteSession(id){
  state.sessions=state.sessions.filter(s=>s.id!==id);saveSessions();
  state.deleted[id]=Date.now();saveDeleted();
  state.dirty.delete(id);saveDirty();
  if(state.cloud)state.cloud.deleteSession(id);
}
// Undo a delete: drop the tombstone and put it back
function restoreSession(s){delete state.deleted[s.id];saveDeleted();s.updatedAt=Date.now();upsertSession(s,false);}

/* ---- routines ---- */
function saveRoutine(r){
  r.updatedAt=Date.now();r.id=r.id||uid();
  const i=state.routines.findIndex(x=>x.id===r.id);if(i>=0)state.routines[i]=r;else state.routines.push(r);
  state.routines.sort((a,b)=>b.updatedAt-a.updatedAt);saveRoutines();
  delete state.deleted['r:'+r.id];saveDeleted();
  if(state.cloud)state.cloud.pushRoutine(r);
}
function deleteRoutine(id){
  state.routines=state.routines.filter(r=>r.id!==id);saveRoutines();
  state.deleted['r:'+id]=Date.now();saveDeleted();
  if(state.cloud)state.cloud.deleteRoutine(id);
}

/* ---- settings / active ---- */
function saveSettingsCloud(){state.settings.settingsUpdatedAt=Date.now();saveSettings();if(state.cloud)state.cloud.pushSettings();}
let activeTimer=null;
function persistActive(){
  if(state.active)state.active.updatedAt=Date.now();
  else state.activeClearedAt=Date.now();   // record WHEN we cleared it, so the newer event (active vs cleared) wins on merge
  const ok=saveActive();
  if(state.active)state.storageError=!ok;   // a live workout that failed to save is at risk; flag it (clearing writes are safe to lose)
  if(state.cloud){clearTimeout(activeTimer);activeTimer=setTimeout(()=>state.cloud.pushActive(),1500);}
  return ok;
}
function setActive(s){if(s&&!s.unit)s.unit=state.settings.unit||'lb';state.active=s;persistActive();}

/* ---- merging a remote snapshot (Dropbox file / import) ---- */
function absorbRemote(remote,opts){
  opts=opts||{};let changed=false,pushNeeded=false;
  const t=applyTombstones(state.sessions,state.deleted,remote.deleted);
  state.sessions=t.sessions;state.deleted=pruneTombstones(t.tomb);if(t.changed)changed=true;
  const m=mergeSessions(state.sessions,remote.sessions,state.deleted);
  state.sessions=m.merged;if(m.changedLocal)changed=true;if(m.pushNeeded)pushNeeded=true;
  // routines: same rule, tombstoned under r:<id>
  const rt=applyTombstones(state.routines.map(r=>Object.assign({},r,{id:'r:'+r.id})),{},remote.deleted).sessions.map(r=>Object.assign({},r,{id:r.id.slice(2)}));
  if(rt.length!==state.routines.length)changed=true;
  const rm=mergeSessions(rt,(remote.routines||[]).filter(r=>!state.deleted['r:'+r.id]),{});
  state.routines=rm.merged.sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));if(rm.changedLocal)changed=true;if(rm.pushNeeded)pushNeeded=true;
  if(remote.settings&&(remote.settings.settingsUpdatedAt||0)>(state.settings.settingsUpdatedAt||0)){
    // REBUILD from defaults + the cleaned remote, don't merge — a merge keeps a key the remote dropped
    // (e.g. a profile the user reset on the other phone), so the reset would never propagate.
    const keepUnit=(state.settings.unitUpdatedAt||0)>((remote.settings&&remote.settings.unitUpdatedAt)||0)?{unit:state.settings.unit,unitUpdatedAt:state.settings.unitUpdatedAt}:null;
    state.settings=Object.assign(defSettings(),cleanSettings(remote.settings)||{},keepUnit||{});changed=true;   // a newer theme/rest change can't flip the unit you chose more recently
    if(keepUnit)pushNeeded=true;
  }else if((state.settings.settingsUpdatedAt||0)>((remote.settings&&remote.settings.settingsUpdatedAt)||0))pushNeeded=true;
  if(!opts.skipActive){
    const r=IL.sync.resolveActive({active:state.active,activeClearedAt:state.activeClearedAt},{active:remote.active,activeClearedAt:remote.activeClearedAt});
    if(r.changed){state.active=r.active;state.activeClearedAt=r.activeClearedAt;changed=true;}
    if(r.pushNeeded)pushNeeded=true;
    if(r.dropped&&recoverWorkout(r.dropped)){changed=true;pushNeeded=true;}
  }
  // every workout (and the live one) in the unit now in force — converted, never relabelled
  if(normalizeUnits(state.sessions))changed=true;
  if(state.active)normalizeUnits([state.active]);
  opts.saved=saveSessions();saveRoutines();saveDeleted();saveSettings();saveActive();
  return {changed,pushNeeded,saved:opts.saved};
}
function importBackup(json){
  const d=parseImport(json);const before=state.sessions.length;
  // Workouts carry their own unit now; older backups don't, so stamp those with the backup's unit and
  // let normalizeUnits convert to this phone's (kg numbers must never show as lb).
  const fromUnit=(d.settings&&d.settings.unit)||state.settings.unit;
  d.sessions.forEach(s=>{if(!s.unit)s.unit=fromUnit;});if(d.active&&!d.active.unit)d.active.unit=fromUnit;
  // A phone that's never been set up takes the backup's settings (units, bodyweight, machine setups,
  // weight steps, bar weights) and its in-progress workout — restoring onto a new phone kept neither.
  const fresh=!(state.settings.settingsUpdatedAt>0);
  const blocked=d.sessions.filter(s=>state.deleted[s.id]&&state.deleted[s.id]>=(s.updatedAt||0)).length;
  absorbRemote({sessions:d.sessions,routines:d.routines,deleted:{},settings:fresh?d.settings:null,active:!state.active?d.active:null,activeClearedAt:0},{skipActive:!!state.active});
  d.sessions.forEach(s=>{state.dirty.add(s.id);});saveDirty();
  if(state.cloud){state.cloud.flush();}
  emit();
  lastImport={json,blocked};
  return state.sessions.length-before;
}
// Backups can hold workouts you deleted (on purpose or by mistake). The UI offers to bring them back:
// this drops those deletions and re-imports them with a fresh timestamp so every device takes them.
let lastImport=null;
function deletedInLastImport(){return lastImport?lastImport.blocked:0;}
function restoreDeletedFromLastImport(){
  if(!lastImport)return 0;const d=parseImport(lastImport.json),now=Date.now();let n=0;
  d.sessions.forEach(s=>{if(state.deleted[s.id]){delete state.deleted[s.id];s.updatedAt=now;if(!s.unit)s.unit=(d.settings&&d.settings.unit)||state.settings.unit;n++;}});
  saveDeleted();absorbRemote({sessions:d.sessions.filter(s=>s.updatedAt===now),routines:[],deleted:{},settings:null,active:null},{skipActive:true});
  d.sessions.forEach(s=>{if(s.updatedAt===now)state.dirty.add(s.id);});saveDirty();
  if(state.cloud){if(state.cloud.pushTombstones)state.cloud.pushTombstones();state.cloud.flush();}
  lastImport=null;emit();return n;
}

/* ---- cloud adapters ----
   Both backends (artifact DB, Dropbox file) implement the SAME shape:
     {name, init():Promise<bool>, pushSession, deleteSession, pushRoutine, deleteRoutine,
      pushSettings, pushActive, flush, syncNow}
   The contract: an adapter only MOVES BYTES to/from its backend. It must never merge — absorbRemote()
   is the single source of merge truth (tombstones, active, settings, routines). A new backend
   implements the methods above and routes incoming remote data through absorbRemote(); it adds no
   merge logic of its own. (Phase 7 makes the artifact adapter obey this — today it still inlines a
   merge in onSnapshot.) */
function artifactAdapter(){
  let db=null;
  const A={name:'artifact',
    async init(){
      db=await claude.use('db');if(!db)return false;
      try{const snap=await db.doc('settings/app').get();if(snap.exists){const rs=cleanSettings(snap.data())||{};
        if((rs.settingsUpdatedAt||0)>(state.settings.settingsUpdatedAt||0)){const keep=(state.settings.unitUpdatedAt||0)>(rs.unitUpdatedAt||0)?{unit:state.settings.unit,unitUpdatedAt:state.settings.unitUpdatedAt}:{};state.settings=Object.assign(defSettings(),rs,keep);saveSettings();if(normalizeUnits(state.sessions))saveSessions();}   // rebuild, not merge (see absorbRemote) so a reset propagates
        else if((state.settings.settingsUpdatedAt||0)>(rs.settingsUpdatedAt||0))A.pushSettings();}}catch(e){}
      try{const snap=await db.doc('active/current').get();
        if(snap.exists){const raw=snap.data();
          const remoteTs=(raw&&raw.updatedAt)||0,localTs=state.active?(state.active.updatedAt||0):(state.activeClearedAt||0);
          if(raw&&raw.id&&remoteTs>localTs){const r=IL.sync.resolveActive({active:state.active,activeClearedAt:state.activeClearedAt},{active:cleanSession(raw),activeClearedAt:0});state.active=r.active;if(state.active)normalizeUnits([state.active]);saveActive();if(r.dropped)recoverWorkout(r.dropped);}                                    // remote has a newer active
          else if(raw&&raw.empty&&remoteTs>localTs&&state.active){if(IL.sync.hasTicked(state.active))recoverWorkout(state.active);state.active=null;state.activeClearedAt=Math.max(state.activeClearedAt||0,remoteTs);saveActive();}  // remote ended a workout more recently → don't resurrect it
          else if(localTs>remoteTs)A.pushActive();
        }else if(state.active)A.pushActive();}catch(e){}
      await A.flush();
      db.collection('sessions').onSnapshot(qs=>{
        const remote=[];qs.docs.forEach(d=>{const data=d.data();if(data){data.id=d.id;remote.push(cleanSession(data));}});
        normalizeUnits(remote);   // in this phone's unit before comparing
        const m=mergeSessions(state.sessions,remote,state.deleted);
        const rById=new Map(remote.map(r=>[r.id,r]));m.merged.forEach(s=>{const r=rById.get(s.id);if(r&&(s.updatedAt||0)>(r.updatedAt||0)){state.dirty.add(s.id);}});   // a merged copy that gained the other side's sets goes back up
        // sessions we deleted locally but the cloud still has → delete there too
        remote.forEach(r=>{if(state.deleted[r.id]&&state.deleted[r.id]>=(r.updatedAt||0))db.doc('sessions/'+r.id).delete().catch(()=>{});});
        if(m.changedLocal){state.sessions=m.merged;saveSessions();emit();}
        if(state.dirty.size){saveDirty();A.flush();}
        state.lastSync=Date.now();emit('status');
      },()=>{});
      // Shared tombstone doc: mergeSessions can add/update but never REMOVE, so without this a delete on one
      // device is undone the moment another device touches the row (pushSession re-creates it). This doc
      // carries the deletions across, mirroring the Dropbox file's `deleted` map. (D2)
      db.doc('meta/deleted').onSnapshot(snap=>{
        if(!snap.exists)return;
        const rd=cleanDeleted((snap.data()||{}).map);if(!Object.keys(rd).length)return;
        const ts=applyTombstones(state.sessions,state.deleted,rd);   // ts.tomb = merged map; ts.sessions = survivors
        const rt=applyTombstones(state.routines.map(r=>Object.assign({},r,{id:'r:'+r.id})),{},rd).sessions.map(r=>Object.assign({},r,{id:r.id.slice(2)}));
        const newTomb=pruneTombstones(ts.tomb);
        const changed=ts.changed||rt.length!==state.routines.length||Object.keys(newTomb).length!==Object.keys(state.deleted).length;
        state.sessions=ts.sessions;state.routines=rt;state.deleted=newTomb;
        if(changed){saveSessions();saveRoutines();saveDeleted();emit();}
      },()=>{});
      db.collection('routines').onSnapshot(qs=>{
        const remote=[];qs.docs.forEach(d=>{const data=d.data();if(data){data.id=d.id;remote.push(cleanRoutine(data));}});
        const m=mergeSessions(state.routines,remote,{});
        remote.forEach(r=>{if(state.deleted['r:'+r.id])db.doc('routines/'+r.id).delete().catch(()=>{});});
        if(m.changedLocal){state.routines=m.merged.filter(r=>!state.deleted['r:'+r.id]).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));saveRoutines();emit();}
      },()=>{});
      return true;
    },
    async pushSession(s){try{await db.doc('sessions/'+s.id).set(s);state.dirty.delete(s.id);saveDirty();state.lastSync=Date.now();state.cloudError='';emit('status');}catch(e){state.cloudError='Sync failed';emit('status');}},
    deleteSession(id){db.doc('sessions/'+id).delete().catch(()=>{});A.pushTombstones();},
    async pushTombstones(){try{const snap=await db.doc('meta/deleted').get();const rd=snap.exists?cleanDeleted((snap.data()||{}).map):{};
        const merged=Object.assign({},rd);Object.keys(state.deleted).forEach(k=>{if(!merged[k]||state.deleted[k]>merged[k])merged[k]=state.deleted[k];});
        await db.doc('meta/deleted').set({map:pruneTombstones(merged),updatedAt:Date.now()});}catch(e){}},   // merge with the cloud's list first — a plain set() erased the other device's deletes (batch 1)   // publish the deletion so other devices don't resurrect it (D2)
    pushSettings(){db.doc('settings/app').set(state.settings).catch(()=>{});},
    pushRoutine(r){db.doc('routines/'+r.id).set(r).catch(()=>{});},
    deleteRoutine(id){db.doc('routines/'+id).delete().catch(()=>{});A.pushTombstones();},
    pushActive(){db.doc('active/current').set(state.active||{empty:true,updatedAt:state.activeClearedAt||Date.now(),activeClearedAt:state.activeClearedAt||Date.now()}).catch(()=>{});},
    async flush(){for(const id of [...state.dirty]){const s=state.sessions.find(x=>x.id===id);if(s)await A.pushSession(s);else{state.dirty.delete(id);saveDirty();}}},
    syncNow(){return A.flush();}
  };
  return A;
}
function dropboxAdapter(){
  const D=IL.dropbox;let timer=null,rev=lsGet(LS.dbxRev,null),pushPending=lsGet(LS.pushPending,false),blockedVer=lsGet(LS.blockedVer,'');
  function schedule(){clearTimeout(timer);timer=setTimeout(()=>A.syncNow(),4000);}
  // A change that doesn't dirty a session (a setting, a routine, a DELETE) still has to reach the one
  // shared file. `dirty` only tracks sessions, so without this flag those changes upload only when the
  // NEXT session happens to — the profile you set never reaches your other phone, the delete comes back.
  let pendVer=0;   // bumped on every change; an upload only clears "pending" if nothing changed while it ran (batch 1)
  function markPending(){pendVer++;pushPending=true;lsSet(LS.pushPending,true);schedule();}
  const A={name:'dropbox',
    async init(){
      try{await D.handleRedirect();}catch(e){state.cloudError=e.message;}
      if(!D.isConnected())return false;
      document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')A.syncNow();});
      window.addEventListener('online',()=>A.syncNow());
      await A.syncNow();
      return true;
    },
    // pushActive must MARK pending, not just schedule: an in-progress workout dirties no session, so a bare
    // schedule() reached syncNow with nothing flagged and uploaded nothing — your other phone never saw
    // the live workout until something else happened to sync (review 7.11).
    pushSession(){schedule();},deleteSession(){markPending();},pushSettings(){markPending();},pushRoutine(){markPending();},deleteRoutine(){markPending();},pushActive(){markPending();},
    flush(){return A.syncNow();},
    async syncNow(){
      if(state.syncing||!D.isConnected()){if(state.syncing)A._pending=true;return;}   // a sync requested mid-flight re-runs once
      state.syncing=true;state.cloudError='';emit('status');
      const guard=setTimeout(()=>{state.syncing=false;emit('status');},30000);   // never wedge if a request hangs
      try{
        const meta=await D.getMetadata();
        // The "remote is from a NEWER app" block must PERSIST across syncs, not just the download cycle.
        // Once we've seen a newer file we cache its rev, so the next sync skips the download — if the
        // block only lived in that branch, one more logged set would sail past it and clobber the newer
        // backup. So latch it (blockedVer, persisted) and re-derive it whenever we DO read the file.
        let pushNeeded=state.dirty.size>0||pushPending,remoteNewer=!!(blockedVer&&verGt(blockedVer,CFG.VERSION));
        if(meta&&meta.rev!==rev){
          const f=await D.download();
          if(f){try{const remote=parseImport(f.text);
            let rv='';try{rv=JSON.parse(f.text).version||'';}catch(_){}
            const nv=(rv&&verGt(rv,CFG.VERSION))?rv:'';   // is THIS file newer than us? (updates or clears the latch)
            if(nv!==blockedVer){blockedVer=nv;lsSet(LS.blockedVer,nv);}
            remoteNewer=!!nv;
            const r=absorbRemote({sessions:remote.sessions,routines:remote.routines,deleted:remote.deleted,settings:remote.settings,active:remote.active,activeClearedAt:remote.activeClearedAt});
            if(r.changed)emit();if(r.pushNeeded)pushNeeded=true;
            if(r.saved!==false)rev=f.rev;   // storage full: don't remember this version, or the next sync skips the other device's workouts
          }catch(e){pushNeeded=true;rev=f.rev;}
          }
        }
        if(remoteNewer){state.cloudError='Update Ironlog on this phone to sync — your backup is from a newer version.';}
        else if(!meta||pushNeeded||meta.rev!==rev){
          // snapshot BEFORE the await: which sessions (and which version of each) this upload carries, and
          // the pending counter — anything changed while it runs stays pending for the next sync
          const pushIds=[...state.dirty].map(id=>{const s=state.sessions.find(x=>x.id===id);return [id,s?s.updatedAt:0];}),ver0=pendVer;
          try{rev=await D.upload(JSON.stringify(exportPayload(state,CFG.VERSION)),meta?rev:null);}
          catch(e){if(e&&e.conflict){rev=null;lsSet(LS.dbxRev,null);A._pending=true;throw new Error('Another device synced at the same moment — merging and retrying');}throw e;}
          pushIds.forEach(([id,u])=>{const s=state.sessions.find(x=>x.id===id);if(!s||s.updatedAt===u)state.dirty.delete(id);});saveDirty();
          if(pendVer===ver0){pushPending=false;lsSet(LS.pushPending,false);}   // everything that was pending is now in the file
        }
        lsSet(LS.dbxRev,rev);state.lastSync=Date.now();
      }catch(e){state.cloudError=e.message||'Sync failed';}
      clearTimeout(guard);state.syncing=false;emit('status');
      if(A._pending){A._pending=false;return A.syncNow();}
    }
  };
  return A;
}
async function initCloud(){
  try{
    if(CFG.DEMO){state.cloudName='none';emit();return;}
    if(typeof window!=='undefined'&&window.claude&&claude.use){
      const a=artifactAdapter();if(await a.init()){state.cloud=a;state.cloudName='artifact';emit();return;}
    }
    if(CFG.BUILD==='site'&&IL.dropbox&&IL.dropbox.isConfigured()){
      const a=dropboxAdapter();if(await a.init()){state.cloud=a;state.cloudName='dropbox';emit();return;}
    }
  }catch(e){state.cloudError=e.message||'';}
  state.cloudName='none';emit();
}
// Called after the user connects Dropbox (page reloads through OAuth) — same path as boot
function connectDropbox(){return IL.dropbox.connect();}
function disconnectDropbox(){IL.dropbox.disconnect();state.cloud=null;state.cloudName='none';emit();}

IL.store={normalizeUnits,recoverWorkout,deletedInLastImport,restoreDeletedFromLastImport,state,LS,uid,saveSessions,saveActive,saveSettings,saveRoutines,saveDirty,onChange,emit,storageBytes,
  upsertSession,deleteSession,restoreSession,saveRoutine,deleteRoutine,saveSettingsCloud,persistActive,setActive,
  absorbRemote,importBackup,initCloud,connectDropbox,disconnectDropbox,resetDemo,exportPayload:()=>exportPayload(state,CFG.VERSION)};
