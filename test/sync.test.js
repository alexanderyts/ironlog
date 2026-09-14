const test=require('node:test'),assert=require('node:assert/strict');
const {IL}=require('./load.js');
const {mergeSessions,applyTombstones,pruneTombstones,exportPayload,parseImport,resolveActive}=IL.sync;

test('resolveActive: a finished workout is not resurrected by a stale open one (Phase 7)',()=>{
  // Device A finished at t=200 (active null, cleared 200). Device B still holds an open workout from t=100.
  const A={active:null,activeClearedAt:200}, B={active:{id:'w',updatedAt:100}};
  // From A's view, B's stale active must NOT win.
  assert.deepEqual(resolveActive(A,B),{active:null,activeClearedAt:200,changed:false,pushNeeded:true});
  // From B's view, A's newer "cleared at 200" wins → B drops its stale active.
  const rb=resolveActive(B,{active:null,activeClearedAt:200});
  assert.equal(rb.active,null);assert.equal(rb.changed,true);assert.equal(rb.activeClearedAt,200);
  // A genuinely newer remote active IS adopted.
  const rc=resolveActive({active:null,activeClearedAt:50},{active:{id:'x',updatedAt:300}});
  assert.equal(rc.active.id,'x');assert.equal(rc.changed,true);
});

test('import converts a backup recorded in another unit is handled by parseImport passing settings.unit (Phase 7)',()=>{
  // parseImport surfaces the backup's unit so importBackup can convert; here just assert it round-trips.
  const p=parseImport({app:'ironlog',format:2,settings:{unit:'kg',settingsUpdatedAt:1},sessions:[]});
  assert.equal(p.settings.unit,'kg');
});
const s=(id,updatedAt,date)=>({id,updatedAt,date:date||updatedAt,exercises:[]});

test('cleanSettings sanitizes the training profile and seen flags (P1)',()=>{
  const s=IL.sync.cleanSettings({unit:'lb',profile:{gym:'planetfitness',goal:'size',avoid:['x','back-squat'],protect:['Shoulders','Nope'],days:9,sets:'ramp'},seen:{profileIntro:true,junk:1}});
  assert.deepEqual(s.profile,{goal:'size',sets:'ramp',avoid:['back-squat'],protect:['Shoulders']},'bad enum/id/day dropped, valid kept');
  assert.deepEqual(s.seen,{profileIntro:true},'only true flags with clean keys');
  const s2=IL.sync.cleanSettings({unit:'lb',profile:{gym:'x',days:9},seen:{a:1}});
  assert.ok(!('profile'in s2)&&!('seen'in s2),'nothing valid → fields omitted (absent = Balanced = today)');
});

test('profile and seen round-trip through export → import (P1)',()=>{
  const st={settings:{unit:'lb',settingsUpdatedAt:5,profile:{goal:'strength',gym:'machine',protect:['Shoulders']},seen:{profileIntro:true}},sessions:[],routines:[],deleted:{}};
  const p=parseImport(IL.sync.exportPayload(st,'x'));
  assert.deepEqual(p.settings.profile,{goal:'strength',gym:'machine',protect:['Shoulders']});
  assert.deepEqual(p.settings.seen,{profileIntro:true});
});

test('import sanitizer keeps set.at and session.endedAt when real, drops junk (T1)',()=>{
  const p=parseImport({app:'ironlog',format:2,sessions:[
    {id:'t1',date:1000,updatedAt:1000,endedAt:1000+40*60000,exercises:[
      {id:'back-squat',name:'Squat',sets:[{w:100,r:5,done:true,at:1500},{w:100,r:5,done:true,at:'nope'}]}]},
    {id:'t2',date:2000,updatedAt:2000,endedAt:'bad',exercises:[{id:'deadlift',name:'D',sets:[{w:1,r:1,done:true}]}]}
  ]});
  assert.equal(p.sessions[0].endedAt,1000+40*60000,'real endedAt kept');
  assert.equal(p.sessions[0].exercises[0].sets[0].at,1500,'real at kept');
  assert.ok(!('at'in p.sessions[0].exercises[0].sets[1]),'non-numeric at dropped');
  assert.ok(!('endedAt'in p.sessions[1]),'non-numeric endedAt dropped');
});

test('import sanitizer: missing set.done counts as done; an unknown modality is dropped (Phase 6)',()=>{
  const backup={app:'ironlog',format:2,sessions:[{id:'x1',date:1,updatedAt:1,exercises:[
    {id:'barbell-bench-press',name:'Bench',mode:'nonsense',sets:[{w:135,r:8}]},   // no `done`, bogus mode
    {id:'overhead-press',name:'OHP',mode:'smith',sets:[{w:95,r:8,done:false}]}
  ]}]};
  const ex=parseImport(backup).sessions[0].exercises;
  assert.equal(ex[0].sets[0].done,true,'a set with no done flag is treated as performed');
  assert.ok(!('mode'in ex[0]),'an unknown mode is dropped (would otherwise crash Progress)');
  assert.equal(ex[1].mode,'smith','a valid mode is kept');
  assert.equal(ex[1].sets[0].done,false,'an explicit done:false is preserved');
});

test('merge: newest updatedAt wins, remote-only added, local-only flagged for push',()=>{
  const local=[s('a',10),s('b',50),s('c',5)];
  const remote=[s('a',20),s('b',40),s('d',7)];
  const r=mergeSessions(local,remote,{});
  const byId=Object.fromEntries(r.merged.map(x=>[x.id,x.updatedAt]));
  assert.deepEqual(byId,{a:20,b:50,c:5,d:7});
  assert.equal(r.changedLocal,true);    // a and d came from remote
  assert.equal(r.pushNeeded,true);      // b newer locally, c local-only
  assert.ok(r.merged[0].date>=r.merged[r.merged.length-1].date,'sorted newest first');
});

test('merge: identical sides need nothing',()=>{
  const r=mergeSessions([s('a',10)],[s('a',10)],{});
  assert.equal(r.changedLocal,false);assert.equal(r.pushNeeded,false);
});

test('tombstones stop a deleted session coming back from another device',()=>{
  const r=mergeSessions([],[s('gone',10)],{gone:20});
  assert.equal(r.merged.length,0);
  assert.equal(r.pushNeeded,true,'the deletion must propagate');
  const later=mergeSessions([],[s('gone',30)],{gone:20});   // edited remotely AFTER our delete → it returns
  assert.equal(later.merged.length,1);
});

test('applyTombstones removes locally what another device deleted, and merges the newest stamps',()=>{
  const r=applyTombstones([s('x',10),s('y',10)],{y:5},{x:15,y:30});
  assert.deepEqual(r.sessions.map(x=>x.id),[]);
  assert.deepEqual(r.tomb,{x:15,y:30});
  assert.equal(r.changed,true);
});

test('tombstones are kept ~13 months (longer than a phone left off a season) then expire',()=>{
  const now=Date.now();
  // 300 days ago: still remembered (a device coming back online can't resurrect the delete); 401 days: gone
  const t=pruneTombstones({stale:now-401*86400000,inSeason:now-300*86400000,fresh:now-1000},now);
  assert.deepEqual(Object.keys(t).sort(),['fresh','inSeason'],'a 300-day-old tombstone survives, a 401-day one is pruned');
  assert.equal(IL.sync.TOMB_KEEP,400*86400000,'window is 400 days');
});

test('export/import payload round-trips and rejects junk',()=>{
  const st={settings:{unit:'kg'},sessions:[s('a',1)],routines:[{id:'r1',name:'Push',exIds:['barbell-bench-press']}],deleted:{},active:null};
  const p=exportPayload(st,'1.2.3');
  assert.equal(p.app,'ironlog');assert.equal(p.version,'1.2.3');
  const d=parseImport(JSON.stringify(p));
  assert.equal(d.sessions.length,1);assert.equal(d.routines[0].name,'Push');
  assert.throws(()=>parseImport('{"nope":1}'));
});

test('A5: cleanSession keeps a real endEstimated flag, drops a non-true one',()=>{
  const kept=IL.sync.cleanSession({id:'x',date:1000,updatedAt:1000,endedAt:1000+40*60000,endEstimated:true,exercises:[]});
  assert.equal(kept.endEstimated,true,'≈ estimated-end flag survives a sync/import round-trip');
  const off=IL.sync.cleanSession({id:'y',date:1,updatedAt:1,endedAt:1+60000,endEstimated:'yes',exercises:[]});
  assert.ok(!('endEstimated'in off),'a non-boolean flag is dropped');
  const noEnd=IL.sync.cleanSession({id:'z',date:1,updatedAt:1,endEstimated:true,exercises:[]});
  assert.ok(!('endEstimated'in noEnd),'no endEstimated without an endedAt to qualify');
});
