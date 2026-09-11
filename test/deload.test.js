const test=require('node:test'),assert=require('node:assert/strict');
const {IL,session,set,history}=require('./load.js');
const P=IL.prog,B=IL.builder,A=IL.analysis,{EX}=IL.data;
const dl=(daysAgo,exs,now)=>session(daysAgo,exs,{now,deload:true});

test('a deload continues the plan verbatim — no rotation/anchor-swap/gap-add/bump (Phase 3)',()=>{
  const now=Date.now();
  const benchDay=d=>session(d,[['barbell-bench-press',[set(185,5),set(185,5)]],['cable-crossover',[set(40,12)]]],{now});
  const stalled=[7,14,21,28,35].map(benchDay);
  const withDeload=history(...stalled,session(10,[['barbell-bench-press',[set(185,5)]],['cable-crossover',[set(40,12)]]],{now,deload:true}));
  // control: without the flag, a stalled anchor + recent deload triggers an anchor swap
  const normal=B.planWorkout(['Chest'],withDeload,2,{now});
  assert.ok(normal.rotation&&normal.rotation.anchor,'control swaps the stalled anchor');
  // with the deload flag: same history, zero structural change
  const d=B.planWorkout(['Chest'],withDeload,2,{now,deload:true});
  assert.equal(d.deload,true);
  assert.equal(d.mode,'continue','still continues the plan');
  assert.equal(d.rotation,null,'no rotation on a deload');
  assert.deepEqual(d.reactions,[],'no reactions on a deload');
  assert.deepEqual(d.volumeBump,[],'no volume bump on a deload');
});

test('hints (undertrained/gaps) are ignored on a deload (Phase 3)',()=>{
  const now=Date.now();
  const hist=[];for(let w=0;w<4;w++)hist.push(session(w*7+2,[['barbell-bench-press',[set(135,6)]]],{now}));
  const hints={undertrained:['Chest'],gaps:[],imbalance:null,legsLow:false,suggestGroups:[]};
  const normal=B.planWorkout(['Chest'],hist,1,{now,hints});
  assert.ok(normal.volumeBump.length>0,'control: undertrained chest gets a volume bump');
  const d=B.planWorkout(['Chest'],hist,1,{now,hints,deload:true});
  assert.deepEqual(d.volumeBump,[],'deload adds no volume');
  assert.deepEqual(d.reactions,[],'deload runs no reactions');
});

test('deload seeding caps at 3 sets, and cuts the load (Phase 3)',()=>{
  const now=Date.now();
  const hist=[session(3,[['barbell-bench-press',[set(135,6),set(135,6),set(135,6),set(135,6),set(135,6)]]],{now})];
  assert.equal(B.seedExercise('barbell-bench-press',hist,{unit:'lb'}).sets.length,5,'normal keeps all 5 sets');
  const d=B.seedExercise('barbell-bench-press',hist,{unit:'lb',deload:true});
  assert.equal(d.sets.length,3,'deload caps at 3 sets');
  assert.ok(d.sets[0].w<135,'deload load is lighter');
});

test('deloadSets: ~60% of last real load, rounded to the plate grid, reps at the top of the range',()=>{
  const ex=EX['barbell-bench-press']; // rr 5–8
  assert.deepEqual(P.deloadSets([set(200,5),set(200,5)],ex,'lb'),[{w:120,r:8},{w:120,r:8}]);
  // bodyweight stays bodyweight, just easy controlled reps
  assert.deepEqual(P.deloadSets([set(0,10)],EX['pull-up'],'lb'),[{w:0,r:EX['pull-up'].rr[1]}]);
});

test('a deload session is invisible to progression — the next real session resumes from the last real one',()=>{
  const now=Date.now();
  const hist=[
    dl(2,[['barbell-bench-press',[set(120,8),set(120,8)]]],now),        // most recent = deload, light
    session(9,[['barbell-bench-press',[set(200,8),set(200,8)]],],{now}) // last real = heavy, hit top
  ];
  // lastPerf skips the deload → returns the real 200 session
  assert.equal(P.lastPerf(hist,'barbell-bench-press').sets[0].w,200);
  // suggestion progresses off 200, never off the 120 deload
  const sg=P.suggestion(hist,'barbell-bench-press',{unit:'lb'});
  assert.equal(sg.kind,'weight');assert.equal(sg.next[0].w,205);
  // includeDeload can still reach it if ever needed
  assert.equal(P.lastPerf(hist,'barbell-bench-press',{includeDeload:true}).sets[0].w,120);
});

test('deloads never set PRs and never count as a regression in the progression stat',()=>{
  const now=Date.now();
  const hist=[
    session(20,[['back-squat',[set(300,5)]]],{now}),
    dl(2,[['back-squat',[set(185,8)]]],now)   // light deload after a heavy PR
  ];
  const pr=A.personalRecords(hist,0).find(p=>p.id==='back-squat');
  assert.equal(pr.w,300,'PR is the real 300, not the 185 deload');
  // only one real session of squat in the window → not counted as trending down
  assert.equal(A.progressionStat(hist,now,0).n,0);
});

test('seedExercise builds a lighter deload from the last real session',()=>{
  const hist=[session(3,[['back-squat',[set(250,5),set(250,5)]]])];
  const normal=B.seedExercise('back-squat',hist,{unit:'lb'}).sets.map(s=>s.w);
  const deload=B.seedExercise('back-squat',hist,{unit:'lb',deload:true}).sets.map(s=>s.w);
  assert.ok(deload.every(w=>w<normal[0]),'deload weights are lighter than the progressed weights');
  assert.deepEqual(deload,[150,150]);
});

test('the builder resumes the real plan, not a deload detour',()=>{
  const now=Date.now();
  const PUSH=['barbell-bench-press','overhead-press','cable-crossover'];
  const hist=[
    dl(2,PUSH.map(id=>[id,[set(60,10)]]),now),                          // recent deload of the push day
    session(6,PUSH.map(id=>[id,[set(120,8)]]),{now})                    // the real plan
  ];
  const p=B.planWorkout(['Chest','Shoulders'],hist,1,{now});
  assert.equal(p.mode,'continue');
  assert.equal(p.plan.date,hist[1].date,'continues from the real session, not the deload');
});

test('coach acknowledges a recent deload instead of nagging for one',()=>{
  const now=Date.now();
  const withDeload=[];for(let w=0;w<7;w++)withDeload.push(session(w*7+3,[['back-squat',[set(225,5),set(225,5)]]],{now}));
  withDeload.unshift(Object.assign(session(1,[['back-squat',[set(135,8)]]],{now}),{deload:true}));
  // assert the DECISION (Phase E rotates the wording): a deload-taken finding, and no deload-due nag
  const F=A.findings(A.analyze(withDeload,now),withDeload,now,0);
  assert.ok(F.some(f=>f.type==='deload-taken'),'acknowledges the recent deload');
  assert.ok(!F.some(f=>f.type==='deload-due'),'does not also nag for a deload');
});
