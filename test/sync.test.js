const test=require('node:test'),assert=require('node:assert/strict');
const {IL}=require('./load.js');
const {mergeSessions,applyTombstones,pruneTombstones,exportPayload,parseImport}=IL.sync;
const s=(id,updatedAt,date)=>({id,updatedAt,date:date||updatedAt,exercises:[]});

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
