const test=require('node:test'),assert=require('node:assert/strict');
const {IL,session,set}=require('./load.js');
const P=IL.prog,B=IL.builder,A=IL.analysis,{EX}=IL.data;
const dl=(daysAgo,exs,now)=>Object.assign(session(daysAgo,exs,{now}),{deload:true});

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
  const normal=B.seedExercise('back-squat',hist,null,'lb',false).sets.map(s=>s.w);
  const deload=B.seedExercise('back-squat',hist,null,'lb',true).sets.map(s=>s.w);
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
  const tips=A.buildTips(A.analyze(withDeload,now),withDeload,now,0).map(t=>t.x.replace(/<[^>]+>/g,''));
  assert.ok(tips.some(x=>/took a deload/i.test(x)),'acknowledges the deload: '+JSON.stringify(tips));
  assert.ok(!tips.some(x=>/weeks<\/b> straight/i.test(x)),'does not also nag for a deload');
});
