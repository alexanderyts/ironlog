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

test('tombstones expire after 90 days',()=>{
  const now=Date.now();
  const t=pruneTombstones({old:now-100*86400000,fresh:now-1000},now);
  assert.deepEqual(Object.keys(t),['fresh']);
});

test('export/import payload round-trips and rejects junk',()=>{
  const st={settings:{unit:'kg'},sessions:[s('a',1)],routines:[{id:'r1',name:'Push',exIds:['barbell-bench-press']}],deleted:{},active:null};
  const p=exportPayload(st,'1.2.3');
  assert.equal(p.app,'ironlog');assert.equal(p.version,'1.2.3');
  const d=parseImport(JSON.stringify(p));
  assert.equal(d.sessions.length,1);assert.equal(d.routines[0].name,'Push');
  assert.throws(()=>parseImport('{"nope":1}'));
});
