// v0.71.0 — batch 1 "never lose a lift" (night review 2026-09-23). Every test is a scenario that used
// to lose or corrupt a workout; each asserts the lift survives.
const test=require('node:test'),assert=require('node:assert/strict');
const {IL}=require('./load.js');
const {launch}=require('./ui-harness.js');
const Y=IL.sync,DAY=86400000;
const T0=Date.now()-3*DAY;
const W=(id,upd,sets,extra)=>Object.assign({id,schema:1,date:T0,updatedAt:upd,completed:true,exercises:[{id:'back-squat',sets}]},extra||{});
const S=(w,r,at)=>({w,r,done:true,at});
const doneCount=s=>s.exercises.reduce((n,e)=>n+e.sets.filter(x=>x.done).length,0);

/* ---- merges keep ticked sets ---- */
test('a stale, NEWER copy can no longer wipe sets from a fuller one (the 5-sets-to-1 case)',()=>{
  const full=W('w',100,[S(200,5,T0+1),S(200,5,T0+2),S(200,5,T0+3),S(200,5,T0+4),S(200,5,T0+5)]);
  const stale=W('w',200,[S(200,5,T0+1)]);   // older content, finished later on the iPad
  const m=Y.mergeSessions([full],[stale],{});
  assert.equal(doneCount(m.merged[0]),5,'all 5 sets kept');
  assert.ok(m.merged[0].updatedAt>200,'the merged copy is newer than both, so it wins everywhere');
  assert.ok(m.pushNeeded,'and it goes back up to the cloud');
  // symmetric: local newer but missing the remote's sets
  const m2=Y.mergeSessions([stale],[full],{});
  assert.equal(doneCount(m2.merged[0]),5);
});
test('CONTROL: an ordinary edit (same sets, newer copy) still just wins — no duplicates',()=>{
  const a=W('w',100,[S(200,5,T0+1),S(200,5,T0+2)]),b=W('w',200,[S(205,5,T0+1),S(200,5,T0+2)]);
  const m=Y.mergeSessions([a],[b],{});
  assert.equal(doneCount(m.merged[0]),2);assert.equal(m.merged[0].exercises[0].sets[0].w,205);assert.equal(m.merged[0].updatedAt,200);
});
test('two devices, two different live workouts: the losing one is handed back, not thrown away',()=>{
  const mine=Object.assign(W('a',100,[S(225,5,T0+1),S(225,5,T0+2)]),{completed:false});
  const theirs=Object.assign(W('b',300,[]),{completed:false});
  const r=Y.resolveActive({active:mine,activeClearedAt:0},{active:theirs,activeClearedAt:0});
  assert.equal(r.active.id,'b');assert.equal(r.dropped&&r.dropped.id,'a','mine comes back as "dropped"');
  // a phone with a fast clock "ending" the workout is the same case
  const r2=Y.resolveActive({active:mine,activeClearedAt:0},{active:null,activeClearedAt:Date.now()+2*3600e3});
  assert.equal(r2.active,null);assert.equal(r2.dropped&&r2.dropped.id,'a');
  // CONTROL: a workout with nothing ticked is simply replaced (nothing to keep)
  const empty=Object.assign(W('c',100,[{w:225,r:5,done:false}]),{completed:false});
  assert.equal(Y.resolveActive({active:empty,activeClearedAt:0},{active:theirs,activeClearedAt:0}).dropped,null);
});
test('the same live workout open on two devices merges its ticked sets',()=>{
  const a=Object.assign(W('x',100,[S(100,8,T0+1),S(100,8,T0+2)]),{completed:false});
  const b=Object.assign(W('x',200,[S(100,8,T0+1)]),{completed:false});
  assert.equal(doneCount(Y.resolveActive({active:a,activeClearedAt:0},{active:b,activeClearedAt:0}).active),2);
});
test('store: a dropped live workout is kept as a finished "recovered" workout, and you are told',()=>{
  const h=launch();
  try{
    h.state.active=Object.assign(W('mine',100,[S(225,5,T0+1)]),{completed:false});
    h.S.absorbRemote({sessions:[],routines:[],deleted:{},settings:null,active:Object.assign(W('theirs',Date.now(),[]),{completed:false}),activeClearedAt:0});
    const kept=h.state.sessions.find(s=>s.id==='mine');
    assert.ok(kept&&kept.completed&&kept.recovered,'kept as a finished, recovered workout');
    assert.equal(h.state.active.id,'theirs');
    h.S.emit();assert.match(h.text('#toastMsg'),/Kept a workout from another device/);
  }finally{h.teardown();}
});

/* ---- units ---- */
test('lb↔kg: a kg workout from another device is CONVERTED on an lb phone, never relabelled',()=>{
  const h=launch({storage:{il_settings:{unit:'lb',settingsUpdatedAt:50}}});
  try{
    h.S.absorbRemote({sessions:[W('k',100,[S(100,5,T0+1)],{unit:'kg'})],routines:[],deleted:{},settings:null,active:null},{skipActive:true});
    const s=h.state.sessions.find(x=>x.id==='k');
    assert.equal(s.unit,'lb');assert.ok(Math.abs(s.exercises[0].sets[0].w-220.5)<0.6,'100 kg shows as ~220 lb, not 100 lb: '+s.exercises[0].sets[0].w);
  }finally{h.teardown();}
});
test('lb↔kg: a newer, unrelated settings change on another device does not flip the unit you chose',()=>{
  const h=launch({storage:{il_settings:{unit:'kg',unitUpdatedAt:500,settingsUpdatedAt:500}}});
  try{
    h.S.absorbRemote({sessions:[],routines:[],deleted:{},settings:{unit:'lb',theme:'dark',settingsUpdatedAt:900,unitUpdatedAt:100},active:null},{skipActive:true});
    assert.equal(h.state.settings.theme,'dark','the newer theme is taken');
    assert.equal(h.state.settings.unit,'kg','…but the unit you switched to more recently stays');
  }finally{h.teardown();}
});
test('every workout is stamped with its unit (old data too, at load)',()=>{
  const h=launch({storage:{il_sessions:[W('old',100,[S(135,5,T0+1)])],il_settings:{unit:'lb'}}});
  try{assert.equal(h.state.sessions[0].unit,'lb');assert.equal(h.state.sessions[0].exercises[0].sets[0].w,135,'unchanged');}
  finally{h.teardown();}
});

/* ---- record picks don't rewrite history ---- */
test('picking a record changes settings only — no old workout is re-saved',()=>{
  const h=launch();
  try{
    const now=Date.now();
    [{id:'a',date:now-9*DAY,w:75},{id:'b',date:now-2*DAY,w:25}].forEach(x=>h.S.upsertSession({id:x.id,schema:1,date:x.date,updatedAt:1000,completed:true,exercises:[{id:'face-pull',sets:[{w:x.w,r:12,done:true}]}]},false));
    const before=h.state.sessions.map(s=>s.updatedAt).join();
    h.click('.tab[data-tab="progress"]');h.click(h.$$('#liftCard [data-openex]').find(r=>r.dataset.openex==='face-pull'));
    h.click('#sheetBody [data-recchange]');h.click(h.$$('#sheetBody [data-recpick]').find(b=>/25lb/.test(b.textContent)));
    assert.equal(h.state.sessions.map(s=>s.updatedAt).join(),before,'no workout was touched');
    assert.ok(h.state.settings.records&&Object.keys(h.state.settings.records).length===1,'the pick lives in settings');
    assert.equal(h.IL.analysis.personalRecords(h.state.sessions,0,9).find(p=>p.id==='face-pull').w,25,'and it works');
    assert.ok(h.IL.sync.cleanSettings(h.state.settings).records,'and survives sync/backup sanitising');
  }finally{h.teardown();}
});

/* ---- Dropbox ---- */
function fakeDbx(h,opts){
  opts=opts||{};let rev=1,file=JSON.stringify({app:'ironlog',format:2,version:'0.0.0',sessions:opts.sessions||[],routines:[],deleted:{}});const uploads=[];
  const api={isConfigured:()=>true,isConnected:()=>true,handleRedirect:async()=>{},connect(){},disconnect(){},
    getMetadata:async()=>({rev:'r'+rev}),download:async()=>({text:file,rev:'r'+rev}),
    upload:async(text,r)=>{if(opts.onUpload)await opts.onUpload();if(r&&r!=='r'+rev){const e=new Error('conflict');e.conflict=true;throw e;}uploads.push(text);file=text;rev++;return 'r'+rev;},
    _other(sess){const f=JSON.parse(file);f.sessions.push(sess);file=JSON.stringify(f);rev++;}};
  h.win.IL.dropbox=api;return {api,uploads,get file(){return JSON.parse(file);}};
}
test('Dropbox: another device uploading in between is merged, not overwritten',async()=>{
  const h=launch();
  try{
    let hook=null;const f=fakeDbx(h,{onUpload:async()=>{if(hook){const x=hook;hook=null;x();}}});
    await h.S.initCloud();
    // the other phone uploads a workout at the very moment we upload ours (after we read the file)
    hook=()=>f.api._other(W('other',Date.now(),[S(135,5,T0+1)]));
    h.S.upsertSession(W('mine',Date.now(),[S(225,5,T0+2)]),false);
    await h.state.cloud.flush();await h.state.cloud.flush();
    const ids=f.file.sessions.map(s=>s.id);
    assert.ok(ids.includes('other'),'the other phone’s workout was not overwritten: '+ids);
    assert.ok(ids.includes('mine'),'and ours is there too');
    assert.ok(h.state.sessions.some(s=>s.id==='other'),'this phone picked it up');
  }finally{h.teardown();}
});
test('Dropbox: a change made while an upload is running stays pending (and uploads next)',async()=>{
  const h=launch();
  try{
    let hook=null;const f=fakeDbx(h,{onUpload:async()=>{if(hook){const x=hook;hook=null;x();}}});
    await h.S.initCloud();
    hook=()=>{h.state.settings.bodyweight=190;h.S.saveSettingsCloud();};   // lands mid-upload
    h.S.upsertSession(W('m',Date.now(),[S(100,5,T0+1)]),false);
    await h.state.cloud.flush();await h.state.cloud.flush();
    assert.equal(f.file.settings.bodyweight,190,'the mid-upload change reached the file');
  }finally{h.teardown();}
});

/* ---- backup restore ---- */
test('restoring onto a fresh phone brings the settings and offers back deleted workouts',()=>{
  const h=launch();
  try{
    const now=Date.now();
    const backup={app:'ironlog',format:2,settings:{unit:'kg',bodyweight:80,settingsUpdatedAt:now-DAY,setup:{'pec-deck':'seat 4'}},
      sessions:[W('keep',now-DAY,[S(100,5,T0+1)],{unit:'kg'}),W('gone',now-2*DAY,[S(90,5,T0+2)],{unit:'kg'})],routines:[],deleted:{}};
    h.state.deleted.gone=now;   // deleted on this phone by mistake
    h.S.importBackup(JSON.stringify(backup));
    assert.equal(h.state.settings.unit,'kg');assert.equal(h.state.settings.bodyweight,80);assert.equal(h.state.settings.setup['pec-deck'],'seat 4');
    assert.ok(!h.state.sessions.some(s=>s.id==='gone'),'the deleted one is held back…');
    assert.equal(h.S.deletedInLastImport(),1,'…and offered');
    assert.equal(h.S.restoreDeletedFromLastImport(),1);
    assert.ok(h.state.sessions.some(s=>s.id==='gone'),'restored');
  }finally{h.teardown();}
});
test('CONTROL: a phone already set up keeps its own settings on import',()=>{
  const h=launch({storage:{il_settings:{unit:'lb',bodyweight:180,settingsUpdatedAt:Date.now()}}});
  try{h.S.importBackup(JSON.stringify({app:'ironlog',format:2,settings:{unit:'kg',bodyweight:80,settingsUpdatedAt:1},sessions:[],routines:[],deleted:{}}));
    assert.equal(h.state.settings.bodyweight,180);}
  finally{h.teardown();}
});

/* ---- small gaps ---- */
test('corrupt saved workouts are set aside before anything can overwrite them',()=>{
  const raw='[{"id":"x","exercises":[';   // cut off mid-write
  const h=launch({rawStorage:{il_sessions:raw}});
  try{
    assert.equal(h.win.localStorage.getItem('il_sessions_corrupt'),raw,'the unreadable text is kept aside');
    assert.equal(h.state.sessions.length,0,'the app still starts');
  }finally{h.teardown();}
});
test('a set with no reps can’t be ticked (it used to vanish at Finish)',()=>{
  const h=launch();
  try{
    h.click('[data-action="startFlow"]');h.click('[data-action="blank"]');
    h.click('#btnAddEx');h.click(h.$$('#addResults [data-quickadd]').find(x=>x.dataset.quickadd==='barbell-bench-press'));
    h.type('input[data-f="w"]','135');h.type('input[data-f="r"]','');
    h.click('[data-check]');
    assert.equal(h.state.active.exercises[0].sets[0].done,false,'not ticked');assert.match(h.text('#toastMsg'),/Add reps first/);
  }finally{h.teardown();}
});
test('Finish with nothing ticked: "Save all as done" saves the planned sets',()=>{
  const h=launch();
  try{
    h.click('[data-action="startFlow"]');h.click('[data-action="blank"]');
    h.click('#btnAddEx');h.click(h.$$('#addResults [data-quickadd]').find(x=>x.dataset.quickadd==='barbell-bench-press'));
    h.$$('input[data-f="w"]').forEach(i=>h.type(i,'135'));
    const id=h.state.active.id,n=h.state.active.exercises[0].sets.filter(s=>+s.r>0).length;
    h.click('#btnFinishTop');h.click('#finPlanned');
    const saved=h.state.sessions.find(s=>s.id===id);
    assert.ok(saved,'saved');assert.equal(saved.exercises[0].sets.length,n,'all '+n+' planned sets saved as done');
  }finally{h.teardown();}
});
