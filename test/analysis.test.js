const test=require('node:test'),assert=require('node:assert/strict');
const {IL,session,set}=require('./load.js');
const A=IL.analysis;
const strip=t=>t.x.replace(/<[^>]+>/g,'');

test('press-heavy, leg-less history triggers balance + gap warnings once there is enough history',()=>{
  const now=Date.now();
  const hist=[
    session(2,[['barbell-bench-press',[set(135,8),set(135,8),set(135,8)]],['overhead-press',[set(75,8),set(75,8)]],['incline-dumbbell-press',[set(50,10),set(50,10)]]],{now}),
    session(5,[['barbell-bench-press',[set(140,8),set(140,8),set(140,8)]],['tricep-pushdown',[set(50,12),set(50,12)]]],{now}),
    session(12,[['barbell-bench-press',[set(130,8),set(130,8),set(130,8)]],['overhead-press',[set(70,8),set(70,8)]]],{now}),
    session(16,[['barbell-bench-press',[set(125,8),set(125,8),set(125,8)]],['tricep-pushdown',[set(45,12),set(45,12)]]],{now})
  ];
  const a=A.analyze(hist,now);
  assert.equal(a.push,18);assert.equal(a.pull,0);assert.equal(a.lowerSets,0);
  assert.equal(a.sessions,4);assert.ok(a.daySpan>=10,'day span '+a.daySpan);
  assert.equal(a.readyForComparative,true);
  const tips=A.buildTips(a,hist,now,0).map(strip);
  assert.ok(tips.some(t=>/pressing outweighs pulling/.test(t)),tips.join('|'));
  assert.ok(tips.some(t=>/Legs are undertrained/.test(t)));
  assert.ok(tips.some(t=>/rear delts/.test(t)),'shoulders trained but no rear delts');
});

test('comparative verdicts stay hidden until there is enough history (new users are not judged on day 1)',()=>{
  const now=Date.now();
  // a single, very lopsided session would have tripped the old raw-set-count thresholds
  const hist=[session(1,[
    ['barbell-bench-press',[set(135,8),set(135,8),set(135,8)]],
    ['overhead-press',[set(75,8),set(75,8),set(75,8)]],
    ['incline-dumbbell-press',[set(50,10),set(50,10)]]
  ],{now})];
  const a=A.analyze(hist,now);
  assert.equal(a.readyForComparative,false);
  const tips=A.buildTips(a,hist,now,0).map(strip);
  assert.ok(!tips.some(t=>/pressing outweighs pulling|Legs are undertrained|weekly sets to drive growth/.test(t)),tips.join('|'));
});

test('pattern gap: hamstrings trained only with curls → suggests a hinge',()=>{
  const now=Date.now();
  const hist=[session(1,[['lying-leg-curl',[set(80,12),set(80,12)]]],{now})];
  const tips=A.buildTips(A.analyze(hist,now),hist,now,0).map(strip);
  assert.ok(tips.some(t=>/no hip hinge/.test(t)),tips.join('|'));
});

test('healthy balance is reported as good, once there is enough history to say so',()=>{
  const now=Date.now();
  const mk=daysAgo=>session(daysAgo,[['barbell-bench-press',[set(135,8),set(135,8),set(135,8)]],['barbell-row',[set(135,8),set(135,8),set(135,8)]]],{now});
  const hist=[mk(1),mk(4),mk(8),mk(13)];
  const tips=A.buildTips(A.analyze(hist,now),hist,now,0);
  assert.ok(tips.some(t=>t.lv==='good'&&/balance looks healthy/.test(t.x)));
});

test('warm-up sets are excluded from analysis, PRs and volume',()=>{
  const now=Date.now();
  const hist=[session(1,[['back-squat',[set(135,5,{warm:true}),set(225,5),set(225,5)]]],{now})];
  assert.equal(A.analyze(hist,now).totalSets,2);
  const pr=A.personalRecords(hist,0)[0];
  assert.equal(pr.w,225);
  assert.equal(IL.prog.sessionVolume(hist[0],0),225*5*2);
  assert.equal(IL.prog.sessionSets(hist[0]),2);
});

test('bodyweight counts toward pull-up load and PRs',()=>{
  const now=Date.now();
  const hist=[session(1,[['pull-up',[set(0,10)]]],{now})];
  assert.equal(A.personalRecords(hist,0).length,0,'no bodyweight set → no load');
  const pr=A.personalRecords(hist,180)[0];
  assert.equal(pr.load,180);assert.equal(pr.est,IL.prog.e1rm(180,10));
  assert.equal(IL.prog.sessionVolume(hist[0],180),1800);
});

test('progression stat counts lifts trending up over the month',()=>{
  const now=Date.now();
  const hist=[session(20,[['barbell-bench-press',[set(135,8)]]],{now}),session(2,[['barbell-bench-press',[set(145,8)]]],{now}),
              session(19,[['back-squat',[set(225,5)]]],{now}),session(3,[['back-squat',[set(225,5)]]],{now})];
  assert.deepEqual(A.progressionStat(hist,now,0),{n:2,up:1});
});

test('weekly volumes returns the requested number of weeks, oldest first',()=>{
  const now=Date.now();
  const cols=A.weeklyVolumes([session(1,[['barbell-curl',[set(50,10)]]],{now})],now,0,8);
  assert.equal(cols.length,8);
  assert.ok(cols[7].v>0||cols[6].v>0,'the recent session lands in the current or previous week');
  assert.ok(cols[0].start<cols[7].start);
});
