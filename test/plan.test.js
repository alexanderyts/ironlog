const test=require('node:test'),assert=require('node:assert/strict');
const {IL,session,set}=require('./load.js');
const {EX}=IL.data;
const B=IL.builder;

// A push day repeated weekly. `mod` lets a test tweak a session's sets by week index.
const PUSH=['barbell-bench-press','incline-dumbbell-press','overhead-press','cable-crossover','tricep-pushdown'];
function pushDay(daysAgo,now,mod){
  return session(daysAgo,PUSH.map(id=>[id,(mod&&mod(id,daysAgo))||[set(100,8),set(100,8),set(100,8)]]),{now});
}

test('continues a recent plan for the same muscles instead of reshuffling',()=>{
  const now=Date.now();
  const hist=[pushDay(7,now)];
  const p=B.planWorkout(['Chest','Shoulders','Triceps'],hist,3,{now});
  assert.equal(p.mode,'continue');
  assert.deepEqual(new Set(p.ids),new Set(PUSH));
  assert.equal(p.rotation,null,'nothing rotates on week 2');
});

test('fresh build when the plan is older than the window, for different muscles, or on request',()=>{
  const now=Date.now();
  const old=[pushDay(B.CONTINUE_DAYS+2,now)];
  assert.equal(B.planWorkout(['Chest','Shoulders','Triceps'],old,3,{now}).mode,'fresh');
  assert.equal(B.planWorkout(['Back','Biceps'],[pushDay(3,now)],3,{now}).mode,'fresh');
  assert.equal(B.planWorkout(['Chest','Shoulders','Triceps'],[pushDay(3,now)],3,{now,fresh:true}).mode,'fresh');
});

test('an incidental add-on exercise does not break plan matching; a second group does',()=>{
  const now=Date.now();
  const withCurl=session(4,[...PUSH.map(id=>[id,[set(100,8)]]),['barbell-curl',[set(50,10)]]],{now});
  assert.equal(B.planWorkout(['Chest','Shoulders','Triceps'],[withCurl],1,{now}).mode,'continue');
  const armDay=session(4,[...PUSH.map(id=>[id,[set(100,8)]]),['barbell-curl',[set(50,10)]],['hammer-curl',[set(30,10)]]],{now});
  assert.equal(B.planWorkout(['Chest','Shoulders','Triceps'],[armDay],1,{now}).mode,'fresh');
});

test('rotates exactly one stalled accessory, never the anchor, with a same-group replacement',()=>{
  const now=Date.now();
  // 4 weekly sessions; crossover flat at 40×12 throughout (stalled), everything else climbing
  const hist=[7,14,21,28].map(d=>pushDay(d,now,(id,days)=>{
    const wk=days/7;
    if(id==='cable-crossover')return[set(40,12),set(40,12)];
    return[set(100+5*(5-wk),6),set(100+5*(5-wk),6)];
  }));
  const p=B.planWorkout(['Chest','Shoulders','Triceps'],hist,2,{now});
  assert.equal(p.mode,'continue');
  assert.ok(p.rotation,'a rotation happened');
  assert.equal(p.rotation.from,'cable-crossover');
  assert.equal(p.rotation.why,'stalled');
  assert.equal(EX[p.rotation.to].group,'Chest');
  assert.ok(p.ids.includes('barbell-bench-press'),'anchor kept');
  assert.equal(p.ids.filter(id=>!PUSH.includes(id)).length,1,'only one exercise changed');
});

test('stale-but-progressing accessories are kept until the hard limit',()=>{
  const now=Date.now();
  const climbing=(id,days)=>{const wk=days/7,hi=EX[id].rr[1];return[set(100+5*(6-wk),hi),set(100+5*(6-wk),hi)];}; // top of each range → progressing
  const six=[7,14,21,28,35,42].map(d=>pushDay(d,now,climbing));
  assert.equal(B.planWorkout(['Chest','Shoulders','Triceps'],six,2,{now}).rotation,null,'6 sessions, all progressing: keep');
  const nine=[7,14,21,28,35,42,49,56,63].map(d=>pushDay(d,now,climbing));
  const p=B.planWorkout(['Chest','Shoulders','Triceps'],nine,2,{now});
  assert.ok(p.rotation&&p.rotation.why!=='stalled','9 sessions: rotate one for freshness');
  assert.notEqual(p.rotation.from,'barbell-bench-press','anchor never rotates');
});

test('streak and stall helpers',()=>{
  const now=Date.now();
  const hist=[pushDay(7,now),pushDay(14,now),session(21,[['barbell-bench-press',[set(100,8)]]],{now}),pushDay(28,now)];
  assert.equal(B.exerciseStreak(hist,'barbell-bench-press'),4);
  assert.equal(B.exerciseStreak(hist,'cable-crossover'),2,'broken by the bench-only session');
  assert.equal(B.exerciseStreak(hist,'deadlift'),0);
  assert.equal(B.isStalled(hist,'cable-crossover'),true,'flat 100×8 for 3 sessions');
  const up=[session(7,[['barbell-curl',[set(60,10)]]],{now}),session(14,[['barbell-curl',[set(55,10)]]],{now}),session(21,[['barbell-curl',[set(50,10)]]],{now})];
  assert.equal(B.isStalled(up,'barbell-curl'),false);
});
