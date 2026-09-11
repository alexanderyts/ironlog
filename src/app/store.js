// App state: local-first persistence (localStorage) plus a pluggable cloud backend.
//   artifact  → Claude's built-in database (when the app runs inside a claude.ai artifact)
//   dropbox   → one JSON file in the user's Dropbox app folder (standalone / GitHub Pages build)
//   none      → on-device only
var IL=globalThis.IL||(globalThis.IL={});
const {mergeSessions,applyTombstones,pruneTombstones,exportPayload,parseImport,cleanSession,cleanRoutine,cleanSettings}=IL.sync;
const CFG=IL.config||{};

const LS={sessions:'il_sessions',active:'il_active',settings:'il_settings',dirty:'il_dirty',routines:'il_routines',deleted:'il_deleted',dbxRev:'il_dbx_rev'};
function lsGet(k,f){try{const v=localStorage.getItem(k);return v?JSON.parse(v):f;}catch(e){return f;}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);

const state={
  sessions:lsGet(LS.sessions,[]),
  active:lsGet(LS.active,null),
  settings:Object.assign({unit:'lb',theme:'system',bodyweight:0,settingsUpdatedAt:0},lsGet(LS.settings,{})),
  routines:lsGet(LS.routines,[]),
  deleted:lsGet(LS.deleted,{}),
  dirty:new Set(lsGet(LS.dirty,[])),
  cloud:null, cloudName:'none', syncing:false, lastSync:0, cloudError:''
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

const saveSessions=()=>lsSet(LS.sessions,state.sessions);
const saveActive=()=>lsSet(LS.active,state.active);
const saveSettings=()=>lsSet(LS.settings,state.settings);
const saveRoutines=()=>lsSet(LS.routines,state.routines);
const saveDeleted=()=>lsSet(LS.deleted,state.deleted);
const saveDirty=()=>lsSet(LS.dirty,[...state.dirty]);

const listeners=[];
function onChange(fn){listeners.push(fn);}
function emit(){listeners.forEach(fn=>{try{fn();}catch(e){}});}

/* ---- sessions ---- */
function upsertSession(s,fromCloud){
  s.updatedAt=s.updatedAt||Date.now();
  const i=state.sessions.findIndex(x=>x.id===s.id);
  if(i>=0){if(!fromCloud||s.updatedAt>=(state.sessions[i].updatedAt||0))state.sessions[i]=s;}
  else state.sessions.push(s);
  state.sessions.sort((a,b)=>b.date-a.date);
  saveSessions();
  if(!fromCloud){delete state.deleted[s.id];saveDeleted();state.dirty.add(s.id);saveDirty();if(state.cloud)state.cloud.pushSession(s);}
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
  saveActive();
  if(state.cloud){clearTimeout(activeTimer);activeTimer=setTimeout(()=>state.cloud.pushActive(),1500);}
}
function setActive(s){state.active=s;persistActive();}

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
    state.settings=Object.assign(state.settings,remote.settings);state.settings.rest=Object.assign({auto:true,sound:true,notify:false,compound:120,isolation:75},state.settings.rest||{});changed=true;
  }else if((state.settings.settingsUpdatedAt||0)>((remote.settings&&remote.settings.settingsUpdatedAt)||0))pushNeeded=true;
  if(!opts.skipActive){
    if(remote.active&&(!state.active||(remote.active.updatedAt||0)>(state.active.updatedAt||0))){state.active=remote.active;changed=true;}
    else if(state.active&&(!remote.active||(state.active.updatedAt||0)>(remote.active.updatedAt||0)))pushNeeded=true;
  }
  saveSessions();saveRoutines();saveDeleted();saveSettings();saveActive();
  return {changed,pushNeeded};
}
function importBackup(json){
  const d=parseImport(json);const before=state.sessions.length;
  const r=absorbRemote({sessions:d.sessions,routines:d.routines,deleted:{},settings:null,active:null},{skipActive:true});
  d.sessions.forEach(s=>{state.dirty.add(s.id);});saveDirty();
  if(state.cloud){state.cloud.flush();}
  emit();
  return state.sessions.length-before;
}

/* ---- cloud adapters ---- */
function artifactAdapter(){
  let db=null;
  const A={name:'artifact',
    async init(){
      db=await claude.use('db');if(!db)return false;
      try{const snap=await db.doc('settings/app').get();if(snap.exists){const rs=cleanSettings(snap.data())||{};
        if((rs.settingsUpdatedAt||0)>(state.settings.settingsUpdatedAt||0)){state.settings=Object.assign(state.settings,rs);saveSettings();}
        else if((state.settings.settingsUpdatedAt||0)>(rs.settingsUpdatedAt||0))A.pushSettings();}}catch(e){}
      try{const snap=await db.doc('active/current').get();if(snap.exists){const raw=snap.data();const ra=raw&&raw.id?cleanSession(raw):null;
        if(ra&&(!state.active||(ra.updatedAt||0)>(state.active.updatedAt||0))){state.active=ra;saveActive();}
        else if(state.active)A.pushActive();}else if(state.active)A.pushActive();}catch(e){}
      await A.flush();
      db.collection('sessions').onSnapshot(qs=>{
        const remote=[];qs.docs.forEach(d=>{const data=d.data();if(data){data.id=d.id;remote.push(cleanSession(data));}});
        const t=applyTombstones(state.sessions,state.deleted,{});
        const m=mergeSessions(state.sessions,remote,state.deleted);
        // sessions we deleted locally but the cloud still has → delete there too
        remote.forEach(r=>{if(state.deleted[r.id]&&state.deleted[r.id]>=(r.updatedAt||0))db.doc('sessions/'+r.id).delete().catch(()=>{});});
        if(m.changedLocal){state.sessions=m.merged;saveSessions();emit();}
        state.lastSync=Date.now();emit();
      },()=>{});
      db.collection('routines').onSnapshot(qs=>{
        const remote=[];qs.docs.forEach(d=>{const data=d.data();if(data){data.id=d.id;remote.push(cleanRoutine(data));}});
        const m=mergeSessions(state.routines,remote,{});
        remote.forEach(r=>{if(state.deleted['r:'+r.id])db.doc('routines/'+r.id).delete().catch(()=>{});});
        if(m.changedLocal){state.routines=m.merged.filter(r=>!state.deleted['r:'+r.id]).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));saveRoutines();emit();}
      },()=>{});
      return true;
    },
    async pushSession(s){try{await db.doc('sessions/'+s.id).set(s);state.dirty.delete(s.id);saveDirty();state.lastSync=Date.now();emit();}catch(e){state.cloudError='Sync failed';emit();}},
    deleteSession(id){db.doc('sessions/'+id).delete().catch(()=>{});},
    pushSettings(){db.doc('settings/app').set(state.settings).catch(()=>{});},
    pushRoutine(r){db.doc('routines/'+r.id).set(r).catch(()=>{});},
    deleteRoutine(id){db.doc('routines/'+id).delete().catch(()=>{});},
    pushActive(){db.doc('active/current').set(state.active||{empty:true,updatedAt:Date.now()}).catch(()=>{});},
    async flush(){for(const id of [...state.dirty]){const s=state.sessions.find(x=>x.id===id);if(s)await A.pushSession(s);else{state.dirty.delete(id);saveDirty();}}},
    syncNow(){return A.flush();}
  };
  return A;
}
function dropboxAdapter(){
  const D=IL.dropbox;let timer=null,rev=lsGet(LS.dbxRev,null);
  function schedule(){clearTimeout(timer);timer=setTimeout(()=>A.syncNow(),4000);}
  const A={name:'dropbox',
    async init(){
      try{await D.handleRedirect();}catch(e){state.cloudError=e.message;}
      if(!D.isConnected())return false;
      document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')A.syncNow();});
      window.addEventListener('online',()=>A.syncNow());
      await A.syncNow();
      return true;
    },
    pushSession(){schedule();},deleteSession(){schedule();},pushSettings(){schedule();},pushRoutine(){schedule();},deleteRoutine(){schedule();},pushActive(){schedule();},
    flush(){return A.syncNow();},
    async syncNow(){
      if(state.syncing||!D.isConnected())return;state.syncing=true;state.cloudError='';emit();
      try{
        const meta=await D.getMetadata();
        let pushNeeded=state.dirty.size>0;
        if(meta&&meta.rev!==rev){
          const f=await D.download();
          if(f){try{const remote=parseImport(f.text);const r=absorbRemote({sessions:remote.sessions,routines:remote.routines,deleted:remote.deleted,settings:remote.settings,active:remote.active});
            if(r.changed)emit();if(r.pushNeeded)pushNeeded=true;}catch(e){pushNeeded=true;}
            rev=f.rev;}
        }
        if(!meta||pushNeeded||meta.rev!==rev){
          rev=await D.upload(JSON.stringify(exportPayload(state,CFG.VERSION)));
          state.dirty.clear();saveDirty();
        }
        lsSet(LS.dbxRev,rev);state.lastSync=Date.now();
      }catch(e){state.cloudError=e.message||'Sync failed';}
      state.syncing=false;emit();
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

IL.store={state,LS,uid,saveSessions,saveActive,saveSettings,saveRoutines,saveDirty,onChange,emit,
  upsertSession,deleteSession,restoreSession,saveRoutine,deleteRoutine,saveSettingsCloud,persistActive,setActive,
  absorbRemote,importBackup,initCloud,connectDropbox,disconnectDropbox,resetDemo,exportPayload:()=>exportPayload(state,CFG.VERSION)};
