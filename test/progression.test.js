const test=require('node:test'),assert=require('node:assert/strict');
const {IL,session,set}=require('./load.js');
const P=IL.prog;

test('lastPerf returns the most recent working sets, respecting exclusions',()=>{
  const now=Date.now();
  const older=session(10,[['barbell-bench-press',[set(135,8),set(135,8)]]],{now});
  const newer=session(2,[['barbell-bench-press',[set(145,6)]]],{now});
  const hist=[newer,older];
  assert.deepEqual(P.lastPerf(hist,'barbell-bench-press').sets,[{w:145,r:6}]);
  assert.deepEqual(P.lastPerf(hist,'barbell-bench-press',{excludeId:newer.id}).sets,[{w:135,r:8},{w:135,r:8}]);
  assert.deepEqual(P.lastPerf(hist,'barbell-bench-press',{beforeTs:newer.date}).sets,[{w:135,r:8},{w:135,r:8}]);
  assert.equal(P.lastPerf(hist,'deadlift'),null);
});

test('suggestion: hitting the top of the rep range → add weight; otherwise beat last time',()=>{
  const now=Date.now();
  const top=[session(2,[['barbell-bench-press',[set(135,8),set(135,8),set(135,8)]]],{now})];
  assert.equal(P.suggestion(top,'barbell-bench-press',{unit:'lb'}).kind,'weight');
  const mid=[session(2,[['barbell-bench-press',[set(135,8),set(135,6)]]],{now})];
  assert.equal(P.suggestion(mid,'barbell-bench-press',{unit:'lb'}).kind,'match');
  assert.equal(P.suggestion([],'barbell-bench-press').kind,'new');
  assert.equal(P.suggestion(top,'barbell-bench-press',{unit:'kg'}).setsStr,'3×8/8/8 @ 135kg');
});

test('unit conversion: lb → kg → lb is exact; kg → lb → kg within a tenth',()=>{
  for(let w=2.5;w<=500;w+=2.5){
    const kg=P.convertWeight(w,'lb','kg');
    assert.equal(P.convertWeight(kg,'kg','lb'),w,w+' lb');
  }
  for(let k=2.5;k<=200;k+=2.5){
    const lb=P.convertWeight(k,'kg','lb');
    assert.ok(Math.abs(P.convertWeight(lb,'lb','kg')-k)<=0.1+1e-9,k+' kg');
  }
  assert.equal(P.convertWeight('', 'lb','kg'),'');
  assert.equal(P.convertWeight(0,'lb','kg'),0);
  const hist=[session(1,[['back-squat',[set(225,5)]]])];
  P.convertSessions(hist,'lb','kg',123);
  assert.equal(hist[0].exercises[0].sets[0].w,102.1);
  assert.equal(hist[0].updatedAt,123);
});

test('streak counts consecutive training weeks and tolerates an untrained current week',()=>{
  const now=Date.now();
  const w=7*86400000;
  assert.equal(P.calcStreak([],now),0);
  const hist=[session(1,[['crunch',[set(0,20)]]],{now}),session(8,[['crunch',[set(0,20)]]],{now}),session(15,[['crunch',[set(0,20)]]],{now})];
  assert.ok(P.calcStreak(hist,now)>=2);
  const lastWeekOnly=[session(8,[['crunch',[set(0,20)]]],{now})];
  assert.ok(P.calcStreak(lastWeekOnly,now)>=1,'a streak from last week survives an untrained current week');
  assert.equal(P.calcStreak([session(30,[['crunch',[set(0,20)]]],{now})],now),0);
  assert.ok(w>0);
});

test('e1rm and fmtVol',()=>{
  assert.equal(P.e1rm(100,1),100);assert.equal(P.e1rm(100,10),133);
  // comma-formatted (readable to a lifter) up to 99,999 — a real session/week volume almost never
  // exceeds this, so "k" abbreviation is reserved for numbers actually too long to read at a glance
  assert.equal(P.fmtVol(950),'950');
  assert.equal(P.fmtVol(5900),'5,900');
  assert.equal(P.fmtVol(12000),'12,000');
  assert.equal(P.fmtVol(99999),'99,999');
  assert.equal(P.fmtVol(142000),'142k');
  assert.equal(P.fmtVol(2500000),'2.5M');
});
