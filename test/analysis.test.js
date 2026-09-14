const test=require('node:test'),assert=require('node:assert/strict');
const {IL,session,set}=require('./load.js');
const A=IL.analysis;
const M=60000;

test('timeByGroup: each stamped set owns the gap before it (capped), attributed to its muscle (T3)',()=>{
  const s={date:0,exercises:[
    {id:'barbell-bench-press',sets:[{w:135,r:8,done:true,at:10*M},{w:135,r:8,done:true,at:13*M}]},   // Chest
    {id:'lateral-raise',sets:[{w:15,r:12,done:true,at:20*M},{w:15,r:12,done:true,at:21*M}]}           // Shoulders
  ]};
  // bench: 10 (from start) + 3; lateral: 7 (since last bench) + 1  →  Chest 13, Shoulders 8
  assert.deepEqual(A.timeByGroup(s),{Chest:13,Shoulders:8});
  // a 45-min gap is capped at 15
  const s2={date:0,exercises:[{id:'back-squat',sets:[{done:true,at:5*M},{done:true,at:50*M}]}]};
  assert.deepEqual(A.timeByGroup(s2),{Quads:20});   // 5 + min(45,15)
  // no stamps → nothing
  assert.deepEqual(A.timeByGroup({date:0,exercises:[{id:'back-squat',sets:[{done:true}]}]}),{});
});

test('restTaken: median seconds between same-exercise sets, split compound/isolation (T3)',()=>{
  const s={date:0,exercises:[
    {id:'barbell-bench-press',sets:[{done:true,at:10*M},{done:true,at:13*M}]},   // compound, one 180s gap
    {id:'lateral-raise',sets:[{done:true,at:20*M},{done:true,at:21*M}]}          // isolation, one 60s gap
  ]};
  assert.deepEqual(A.restTaken(s),{median:120,compound:180,isolation:60,n:2});   // median of [60,180] = 120
  assert.deepEqual(A.restTaken({date:0,exercises:[{id:'back-squat',sets:[{done:true,at:5*M}]}]}),{median:null,compound:null,isolation:null,n:0});
});

test('sessionDensity: working sets per 10 minutes; null when untimed (T3)',()=>{
  const s={date:0,endedAt:24*M,exercises:[{id:'barbell-bench-press',sets:[{w:1,r:1,done:true},{w:1,r:1,done:true},{w:1,r:1,done:true},{w:1,r:1,done:true}]}]};
  assert.equal(A.sessionDensity(s),1.7);          // 4 sets / 24 min * 10 = 1.66 → 1.7
  assert.equal(A.sessionDensity({date:0,exercises:[{id:'back-squat',sets:[{w:1,r:1,done:true}]}]}),null);
});

test('timeTrends: 28-day averages skip untimed sessions (T3)',()=>{
  const now=Date.now();
  const timed=(d,exs,end)=>({id:'s'+d,schema:1,date:now-d*DAY,updatedAt:1,completed:true,endedAt:now-d*DAY+end,exercises:exs});
  const DAY=86400000;
  const sessions=[
    timed(2,[{id:'barbell-bench-press',sets:[{w:135,r:8,done:true,at:now-2*DAY+2*M},{w:135,r:8,done:true,at:now-2*DAY+5*M}]}],40*M),
    timed(5,[{id:'lateral-raise',sets:[{w:15,r:12,done:true,at:now-5*DAY+2*M},{w:15,r:12,done:true,at:now-5*DAY+3*M}]}],20*M),
    {id:'old',schema:1,date:now-3*DAY,updatedAt:1,completed:true,exercises:[{id:'back-squat',sets:[{w:225,r:5,done:true}]}]},  // untimed → skipped
    timed(7,[{id:'deadlift',sets:[{w:315,r:5,done:true}]}],50*60*M)   // the forgotten-Finish "50-hour workout" → skipped, not averaged
  ];
  const t=A.timeTrends(sessions,now);
  assert.equal(t.n,2,'only the two plausibly-timed sessions count');
  assert.equal(t.avgDuration,30,'(40+20)/2 — a 50h session would have made this 1020');
  assert.equal(t.restCompound,180,'bench 3-min gap');
  assert.equal(t.restIsolation,60,'lateral 1-min gap');
});
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
  // variant-independent: both wordings name the muscle and suggest spreading it over 2 days (asserting
  // one specific variant flaked as the week rotated the phrasing)
  const fx=A.renderFinding(F.find(f=>f.type==='freq-low'&&f.group==='Chest')).x;
  assert.ok(/chest/i.test(fx)&&/2 days/i.test(fx),'renders chest freq copy: '+fx);
});

test('deload prompt appears only after a long unbroken training streak',()=>{
  const now=Date.now();
  const short=[0,1,2].map(w=>session(w*7+1,[['back-squat',[set(225,5)]]],{now}));
  assert.ok(!A.buildTips(A.analyze(short,now),short,now,0).map(strip).some(x=>/deload/i.test(x)),'no deload at 3 weeks');
  const long=[];for(let w=0;w<7;w++)long.push(session(w*7+1,[['back-squat',[set(225,5),set(225,5)]]],{now}));
  assert.ok(A.buildTips(A.analyze(long,now),long,now,0).map(strip).some(x=>/deload/i.test(x)),'deload after 7 straight weeks');
});
