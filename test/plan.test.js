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

test('a progressing lift is NEVER rotated, no matter how long it has been in the plan (Phase B)',()=>{
  const now=Date.now();
  const climbing=(id,days)=>{const wk=days/7,hi=EX[id].rr[1];return[set(100+5*(9-wk),hi),set(100+5*(9-wk),hi)];}; // climbs every week → always progressing
  // 9 straight weekly sessions, everything still going up: continuity holds, zero rotation.
  const nine=[7,14,21,28,35,42,49,56,63].map(d=>pushDay(d,now,climbing));
  assert.equal(B.planWorkout(['Chest','Shoulders','Triceps'],nine,2,{now}).rotation,null,'still progressing at 9 weeks → keep the whole plan');
});

test('staleness is measured in weeks, not session count — a 3×/week lifter is not churned (Phase B)',()=>{
  const now=Date.now();
  // Only the crossover is flat; everything else climbs toward the present (200-d rises as d shrinks).
  const sets=(id,d)=>id==='cable-crossover'?[set(40,12),set(40,12)]:[set(200-d,6),set(200-d,6)];
  const day=d=>session(d,PUSH.map(id=>[id,sets(id,d)]),{now});
  // 5 sessions in <2 weeks: the flat crossover hasn't stalled yet (short-term noise) → no rotation.
  assert.equal(B.planWorkout(['Chest','Shoulders','Triceps'],[2,4,6,8,10].map(day),2,{now}).rotation,null,'5 sessions in <2 weeks is not a stall');
  // The same flat crossover spread over 4 weeks IS a stall → it (and only it) rotates.
  const p=B.planWorkout(['Chest','Shoulders','Triceps'],[3,10,17,24].map(day),2,{now});
  assert.ok(p.rotation&&p.rotation.from==='cable-crossover','flat over weeks → stalled → rotate that accessory');
});

test('a stalled ANCHOR swaps to a same-pattern tier-1 variation only after a deload that did not help (Phase B)',()=>{
  const now=Date.now();
  // Bench dead flat for 5 weeks; a deload two weeks ago didn't unstick it → swap to another tier-1 hpush.
  const benchFlat=(id)=>id==='barbell-bench-press'?[set(185,5),set(185,5)]:[set(60+id.length,8)];
  const hist=[7,14,21,28,35].map(d=>session(d,[['barbell-bench-press',[set(185,5),set(185,5)]],['cable-crossover',[set(40,12)]]],{now}));
  hist.push(Object.assign(session(10,[['barbell-bench-press',[set(120,8)]],['cable-crossover',[set(30,12)]]],{now}),{deload:true}));
  hist.sort((a,b)=>b.date-a.date);
  const p=B.planWorkout(['Chest'],hist,2,{now});
  assert.ok(p.rotation&&p.rotation.anchor,'anchor variation swap happened');
  assert.equal(p.rotation.from,'barbell-bench-press');
  assert.equal(EX[p.rotation.to].tier,1);assert.equal(EX[p.rotation.to].pat,'hpush');assert.equal(EX[p.rotation.to].group,'Chest');
  // WITHOUT a recent deload, the stalled anchor is left alone (deload is the gate).
  const noDeload=[7,14,21,28,35].map(d=>session(d,[['barbell-bench-press',[set(185,5),set(185,5)]],['cable-crossover',[set(40,12)]]],{now}));
  const p2=B.planWorkout(['Chest'],noDeload,2,{now});
  assert.ok(!p2.rotation||!p2.rotation.anchor,'no deload → anchor not swapped');
});

test('streak and stall helpers',()=>{
  const now=Date.now();
  const hist=[pushDay(7,now),pushDay(14,now),session(21,[['barbell-bench-press',[set(100,8)]]],{now}),pushDay(28,now)];
  assert.equal(B.exerciseStreak(hist,'barbell-bench-press'),4);
  assert.equal(B.exerciseStreak(hist,'cable-crossover'),2,'broken by the bench-only session');
  assert.equal(B.exerciseStreak(hist,'deadlift'),0);
  // isStalled needs an UNBROKEN run spanning >=2 weeks (the tenure guard). In `hist` the crossover
  // run is broken by the bench-only session (streak 2 / 1 week), so it is NOT stalled — a separate
  // clean 3-week flat run is a stall.
  assert.equal(B.isStalled(hist,'cable-crossover'),false,'a 1-week run is too short to be a stall');
  const flatRun=[7,14,21].map(d=>session(d,[['cable-crossover',[set(40,12)]]],{now}));
  assert.equal(B.isStalled(flatRun,'cable-crossover'),true,'flat 40×12 across 3 weeks is a stall');
  const up=[session(7,[['barbell-curl',[set(60,10)]]],{now}),session(14,[['barbell-curl',[set(55,10)]]],{now}),session(21,[['barbell-curl',[set(50,10)]]],{now})];
  assert.equal(B.isStalled(up,'barbell-curl'),false);
});

test('churn guard: continuing a stable, progressing plan is identical every time (Phase B)',()=>{
  const now=Date.now();
  const climb=(id,d)=>[set(200-d,6),set(200-d,6)];   // everything climbing → nothing stalls
  const hist=[3,10,17,24,31].map(d=>session(d,PUSH.map(id=>[id,climb(id,d)]),{now}));
  const runs=[1,2,3,42,999].map(seed=>B.planWorkout(['Chest','Shoulders','Triceps'],hist,seed,{now}));
  runs.forEach(r=>{assert.equal(r.mode,'continue');assert.equal(r.rotation,null,'no spurious rotation on unchanged data');});
  const first=new Set(runs[0].ids);
  runs.forEach(r=>assert.deepEqual(new Set(r.ids),first,'identical exercises regardless of seed'));
  assert.deepEqual(first,new Set(hist[0].exercises.map(e=>e.id)),'continues the exact plan — no reshuffle');
});
