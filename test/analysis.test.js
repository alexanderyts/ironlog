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
  // assert the DECISIONS (findings), not the varied wording (Phase E rotates phrasing weekly)
  const F=A.findings(a,hist,now,0);
  assert.ok(F.find(f=>f.type==='balance'&&f.dir==='push'),'push/pull imbalance');
  assert.ok(F.find(f=>f.type==='legs-low'),'legs undertrained');
  assert.ok(F.find(f=>f.type==='region-gap'&&f.group==='Shoulders'&&f.reg==='rear'),'rear-delt gap');
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
  const F=A.findings(a,hist,now,0);
  assert.ok(!F.some(f=>['balance','legs-low','volume-low','freq-low'].includes(f.type)),'no comparative verdicts on day 1');
});

test('pattern gap: hamstrings trained only with curls → suggests a hinge',()=>{
  const now=Date.now();
  const hist=[session(1,[['lying-leg-curl',[set(80,12),set(80,12)]]],{now})];
  const F=A.findings(A.analyze(hist,now),hist,now,0);
  assert.ok(F.some(f=>f.type==='pattern-gap'&&f.group==='Hamstrings'&&f.pat==='hinge'),'hamstrings missing a hinge');
});

test('healthy balance is reported as good, once there is enough history to say so',()=>{
  const now=Date.now();
  const mk=daysAgo=>session(daysAgo,[['barbell-bench-press',[set(135,8),set(135,8),set(135,8)]],['barbell-row',[set(135,8),set(135,8),set(135,8)]]],{now});
  const hist=[mk(1),mk(4),mk(8),mk(13)];
  const F=A.findings(A.analyze(hist,now),hist,now,0);
  assert.ok(F.some(f=>f.type==='balance'&&f.dir==='even'&&f.lv==='good'),'balanced push/pull reported as good');
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

test('frequency nudge: real weekly volume packed into ~one session/week',()=>{
  const now=Date.now();const day=86400000;
  // Chest trained once a week for 5 weeks, ~8 sets each time (>=6/wk, freq ~1/wk); plus a leg day so legs aren't flagged
  const hist=[];
  for(let w=0;w<5;w++){
    hist.push(session(w*7+1,[['barbell-bench-press',[set(135,8),set(135,8),set(135,8),set(135,8)]],['incline-dumbbell-press',[set(50,10),set(50,10),set(50,10),set(50,10)]]],{now}));
    hist.push(session(w*7+4,[['back-squat',[set(225,5),set(225,5),set(225,5)]],['romanian-deadlift',[set(185,8),set(185,8),set(185,8)]],['leg-extension',[set(90,12),set(90,12)]]],{now}));
  }
  const a=A.analyze(hist,now);
  assert.ok(a.groupFreq.Chest<=6,'chest hit on ~5 distinct days in the 28d window');
  // Assert the DECISION (a freq-low finding for chest), not the rendered top-5 slice — which competes
  // with date-dependent tips like a deload prompt and isn't a stable target after the Phase A refactor.
  const F=A.findings(a,hist,now,0);
  assert.ok(F.some(f=>f.type==='freq-low'&&f.group==='Chest'),'a low-frequency finding fires for chest');
  assert.ok(A.renderFinding(F.find(f=>f.type==='freq-low'&&f.group==='Chest')).x.match(/train chest hard but about once a week/i),'and renders the expected copy');
});

test('deload prompt appears only after a long unbroken training streak',()=>{
  const now=Date.now();
  const short=[0,1,2].map(w=>session(w*7+1,[['back-squat',[set(225,5)]]],{now}));
  assert.ok(!A.buildTips(A.analyze(short,now),short,now,0).map(strip).some(x=>/deload/i.test(x)),'no deload at 3 weeks');
  const long=[];for(let w=0;w<7;w++)long.push(session(w*7+1,[['back-squat',[set(225,5),set(225,5)]]],{now}));
  assert.ok(A.buildTips(A.analyze(long,now),long,now,0).map(strip).some(x=>/deload/i.test(x)),'deload after 7 straight weeks');
});
