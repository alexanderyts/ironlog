// Cardio logging — engine-level oracles (Phase C1). Cardio is its own session kind and must be
// INVISIBLE to every strength calculation, while still being a real, well-formed record.
const test=require('node:test'),assert=require('node:assert/strict');
const {IL,session,set,history,NOW,DAY}=require('./load.js');
const S=IL.sync,P=IL.prog,A=IL.analysis;

// A completed cardio record as the app would build it.
function cardio(daysAgo,mins,extra){const date=NOW-daysAgo*DAY;
  return Object.assign({id:'c'+daysAgo+'-'+mins,schema:1,date,updatedAt:date,completed:true,kind:'cardio',
    exercises:[],endedAt:date+mins*60000,cardio:{type:'treadmill',intensity:'easy'}},extra||{});}

test('C1: cleanSession round-trips a cardio record and forces exercises:[]',()=>{
  const raw={id:'x',schema:1,date:NOW,updatedAt:NOW,completed:true,kind:'cardio',
    endedAt:NOW+32*60000,cardio:{type:'elliptical',intensity:'hard',distance:1.5,unit:'mi'},
    exercises:[{id:'barbell-bench-press',sets:[{w:135,r:5,done:true}]}]};   // stray exercises must be dropped
  const o=S.cleanSession(raw);
  assert.equal(o.kind,'cardio');
  assert.deepEqual(o.exercises,[],'cardio never keeps exercises');
  assert.equal(o.cardio.type,'elliptical');
  assert.equal(o.cardio.intensity,'hard');
  assert.equal(o.cardio.distance,1.5);
  assert.equal(o.cardio.unit,'mi');
  assert.equal(o.endedAt,NOW+32*60000);
  assert.equal(P.sessionDuration(o),32,'duration = endedAt − date');
});

test('C1: cleanCardio clamps a bad type/intensity to safe defaults and drops junk distance',()=>{
  const o=S.cleanCardio({type:'moon-walk',intensity:'ludicrous',distance:-4});
  assert.equal(o.type,'treadmill','unknown type → default');
  assert.equal(o.intensity,'moderate','unknown intensity → default');
  assert.equal(o.distance,undefined,'a non-positive distance is dropped');
  assert.equal(o.unit,undefined,'no unit without a distance');
  // control: a valid record is preserved verbatim
  const g=S.cleanCardio({type:'outdoor',intensity:'easy',distance:2,unit:'km'});
  assert.deepEqual(g,{type:'outdoor',intensity:'easy',distance:2,unit:'km'});
});

test('C1 CONTROL: cleanSession leaves a strength session untouched',()=>{
  const strength=session(1,[['barbell-bench-press',[set(135,5),set(135,5)]]]);
  const o=S.cleanSession(strength);
  assert.equal(o.kind,undefined,'no cardio marker on a lift');
  assert.equal(o.exercises.length,1);
  assert.equal(o.exercises[0].sets.length,2);
});

test('C1: cardio is INVISIBLE to every strength calculation',()=>{
  const lift=session(2,[['barbell-bench-press',[set(135,5),set(135,5),set(135,5)]]]);
  const withCardio=history(lift,cardio(1,40),cardio(3,25));
  const liftOnly=[lift];
  const now=NOW+1;   // just after the sessions
  // volume: the cardio sessions add nothing
  assert.equal(A.weeklyVolumes(withCardio,now,0,8).reduce((a,c)=>a+c.v,0),
               A.weeklyVolumes(liftOnly,now,0,8).reduce((a,c)=>a+c.v,0),'weekly volume unchanged by cardio');
  // PRs, muscle counts, full analyze — identical with or without cardio present
  assert.deepEqual(A.personalRecords(withCardio,0,8),A.personalRecords(liftOnly,0,8),'PRs unchanged');
  assert.deepEqual(A.muscleSetCounts(withCardio.filter(s=>s.date>=now-30*DAY)),
                   A.muscleSetCounts(liftOnly),'muscle set counts unchanged');
  assert.deepEqual(A.analyze(withCardio,now),A.analyze(liftOnly,now),'analyze() unchanged');
});

test('C1: streak DOES count a week that has only a cardio session',()=>{
  // current week (NOW) has a cardio-only session; no lifts at all
  const s=[cardio(1,30)];
  assert.equal(P.calcStreak(s,NOW),1,'a cardio-only week counts toward the streak');
  // control: an empty history is a zero streak
  assert.equal(P.calcStreak([],NOW),0);
  // control: a cardio session two-plus weeks back with nothing since is not a current streak
  assert.equal(P.calcStreak([cardio(20,30)],NOW),0,'an old cardio-only week is not a live streak');
});

test('C4: cardioStats summarizes cardio only, with hand-computed minutes',()=>{
  // this week: two cardio sessions (30 + 20 min); 4-week window also includes an older 40-min one
  const s=[cardio(0,30),cardio(1,20,{cardio:{type:'elliptical',intensity:'moderate'}}),cardio(10,40)];
  const c=A.cardioStats(s,NOW+1);
  assert.equal(c.sessions,3,'all three cardio sessions counted');
  assert.equal(c.weekCount,2,'two this calendar week');
  assert.equal(c.weekMin,50,'30 + 20 = 50 min this week');
  assert.equal(c.winMin,90,'30 + 20 + 40 = 90 min over 4 weeks');
  const treadmill=c.byType.find(t=>t[0]==='treadmill');
  assert.equal(treadmill[1],70,'treadmill = 30 (today) + 40 (10d ago)');
  // control: no cardio → an empty summary
  assert.equal(A.cardioStats([session(1,[['barbell-bench-press',[set(135,5)]]])],NOW+1).sessions,0);
});

test('C5: a cardio session survives an export/import round-trip',()=>{
  const c=cardio(2,45,{cardio:{type:'stairmaster',intensity:'moderate',distance:2.2,unit:'km'}});
  const lift=session(1,[['barbell-bench-press',[set(135,5)]]]);
  const out=S.parseImport({sessions:[c,lift],routines:[],settings:{},deleted:{}});
  const round=out.sessions.find(s=>s.kind==='cardio');
  assert.ok(round,'cardio session preserved through import');
  assert.equal(round.cardio.type,'stairmaster');
  assert.equal(round.cardio.intensity,'moderate');
  assert.equal(round.cardio.distance,2.2);
  assert.equal(round.cardio.unit,'km');
  assert.equal(round.exercises.length,0);
  assert.equal(IL.prog.sessionDuration(round),45,'duration preserved');
});
