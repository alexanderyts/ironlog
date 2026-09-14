const test=require('node:test'),assert=require('node:assert/strict');
const {IL,session,set}=require('./load.js');

test('sessionDuration: whole minutes from date→endedAt, null when untimed or nonsensical (T1)',()=>{
  const start=1_000_000_000_000;
  assert.equal(IL.prog.sessionDuration({date:start,endedAt:start+52*60000}),52);
  assert.equal(IL.prog.sessionDuration({date:start,endedAt:start+90*1000}),2,'rounds to nearest minute (1.5→2)');
  assert.equal(IL.prog.sessionDuration({date:start}),null,'no endedAt (pre-timing session) → null');
  assert.equal(IL.prog.sessionDuration({date:start,endedAt:start-5}),null,'end before start → null');
  // a span beyond 8h is a forgotten Finish, not a workout: unknown rather than a 3,000-minute session
  assert.equal(IL.prog.MAX_SESSION_MIN,480);
  assert.equal(IL.prog.sessionDuration({date:start,endedAt:start+479*60000}),479,'control: 7h59 is still a (long) workout');
  assert.equal(IL.prog.sessionDuration({date:start,endedAt:start+481*60000}),null,'8h01 → null');
  assert.equal(IL.prog.sessionDuration({date:start,endedAt:start+50*3600000}),null,'the 50-hour session → null');
});

test('setTimeline: stamped checked sets as {exId,group,at}, oldest first; unstamped skipped (T1)',()=>{
  const s={date:0,exercises:[
    {id:'barbell-bench-press',sets:[{w:135,r:8,done:true,at:300},{w:135,r:8,done:true,at:100}]},
    {id:'overhead-press',sets:[{w:95,r:8,done:true,at:200},{w:95,r:8,done:false}]}  // last has no stamp
  ]};
  assert.deepEqual(IL.prog.setTimeline(s),[
    {exId:'barbell-bench-press',group:'Chest',at:100},
    {exId:'overhead-press',group:'Shoulders',at:200},
    {exId:'barbell-bench-press',group:'Chest',at:300}
  ]);
});

test('staleness: idle time from the last checked set (or the start), thresholds exposed (T2)',()=>{
  const now=1_000_000_000_000;
  const s={date:now-100*60000,exercises:[{sets:[{done:true,at:now-95*60000},{done:true,at:now-80*60000}]}]};
  const st=IL.prog.staleness(s,now);
  assert.equal(st.lastSetAt,now-80*60000,'most recent stamp wins');
  assert.equal(st.sinceLastSet,80);
  assert.equal(st.sinceStart,100);
  // nothing checked yet → measured from the start
  const st2=IL.prog.staleness({date:now-40*60000,exercises:[{sets:[{done:false}]}]},now);
  assert.equal(st2.lastSetAt,null);assert.equal(st2.sinceLastSet,40);assert.equal(st2.sinceStart,40);
  assert.equal(IL.prog.STALE_AFTER_MIN,75);assert.equal(IL.prog.STALE_CONFIRM_MIN,30);assert.equal(IL.prog.END_PAD_MIN,3);
});

test('finalizeSets carries the check timestamp `at` through to the saved set (T1)',()=>{
  const out=IL.prog.finalizeSets([{id:'back-squat',name:'Squat',sets:[{w:100,r:5,done:true,at:12345,t:1}]}]);
  assert.equal(out[0].sets[0].at,12345,'at kept');
  assert.ok(!('t'in out[0].sets[0]),'t still stripped');
});

const P=IL.prog;

test('finalizeSets saves only checked-off sets — a prefilled prescription is never saved as done',()=>{
  const ex=[
    {id:'barbell-bench-press',name:'Bench',sets:[
      {w:135,r:8,done:true},        // ticked → kept
      {w:135,r:8,done:false,t:1},   // edited but not ticked → dropped (the old bug saved this)
      {w:135,r:8,done:false}        // untouched prefill → dropped
    ]},
    {id:'overhead-press',name:'OHP',sets:[{w:95,r:8,done:false}]}  // nothing done → whole exercise dropped
  ];
  const out=P.finalizeSets(ex);
  assert.equal(out.length,1,'exercise with no done sets is dropped');
  assert.equal(out[0].sets.length,1,'only the one ticked set survives');
  assert.deepEqual(out[0].sets[0],{w:135,r:8,done:true});
  assert.ok(!('t'in out[0].sets[0]),'transient touch flag is stripped');
  // done bodyweight set (no weight) is still kept
  assert.equal(P.finalizeSets([{id:'pull-up',name:'Pull-up',sets:[{w:'',r:8,done:true}]}])[0].sets.length,1);
});

test('parseWeightInput accepts a comma decimal and strips junk',()=>{
  assert.equal(P.parseWeightInput('12,5'),'12.5');
  assert.equal(P.parseWeightInput('102.5'),'102.5');
  assert.equal(P.parseWeightInput('1a2b'),'12');
  assert.equal(P.parseWeightInput(''),'');
});

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
  const sg=P.suggestion(top,'barbell-bench-press',{unit:'lb'});
  assert.equal(sg.kind,'weight');
  assert.deepEqual(sg.next,[{w:140,r:5},{w:140,r:5},{w:140,r:5}],'flat: every set bumped, reps reset to the bottom of the range');
  const mid=[session(2,[['barbell-bench-press',[set(135,8),set(135,6)]]],{now})];
  const sm=P.suggestion(mid,'barbell-bench-press',{unit:'lb'});
  assert.equal(sm.kind,'match');
  assert.match(sm.text,/^2 more reps earns \+5lb/);
  assert.deepEqual(sm.next,[{w:135,r:8},{w:135,r:6}],'not ready: last time carried forward as the target');
  assert.equal(P.suggestion([],'barbell-bench-press').kind,'new');
  assert.equal(P.suggestion(top,'barbell-bench-press',{unit:'kg'}).setsStr,'3×8/8/8 @ 135kg');
});

test('setPattern: flat / ascending / descending / mixed, anchored on the heaviest sets',()=>{
  assert.deepEqual(P.setPattern([set(135,8),set(135,8)]),{pattern:'flat',anchor:[0,1],top:135});
  assert.deepEqual(P.setPattern([set(135,10),set(155,8),set(185,6)]),{pattern:'ascending',anchor:[2],top:185});
  assert.deepEqual(P.setPattern([set(135,10),set(175,8),set(175,6)]),{pattern:'ascending',anchor:[1,2],top:175},'ramp that holds at the top: both top sets anchor');
  assert.deepEqual(P.setPattern([set(225,5),set(205,8),set(205,8)]),{pattern:'descending',anchor:[0],top:225});
  assert.deepEqual(P.setPattern([set(135,10),set(185,6),set(135,10)]),{pattern:'mixed',anchor:[1],top:185});
  assert.deepEqual(P.setPattern([set(0,15),set(0,15)]),{pattern:'flat',anchor:[0,1],top:0});
});

test('nextSets: ascending ramp bumps the top set and shifts the ramp proportionally on the plate grid',()=>{
  const ex=IL.data.EX['barbell-bench-press']; // rr 5–8 → 185×8 hits the top
  const n=P.nextSets([set(135,10),set(155,9),set(185,8)],ex,'lb');
  assert.equal(n.bumped,true);assert.equal(n.pattern,'ascending');assert.equal(n.newTop,190);
  assert.deepEqual(n.sets,[{w:140,r:10},{w:160,r:9},{w:190,r:5}]);
  // not ready: top set short by 2 → carried forward verbatim, short counted on the anchor only
  const m=P.nextSets([set(135,10),set(155,9),set(185,6)],ex,'lb');
  assert.equal(m.bumped,false);assert.equal(m.short,2);
  assert.deepEqual(m.sets,[{w:135,r:10},{w:155,r:9},{w:185,r:6}]);
});

test('nextSets: top set + back-offs bumps the opener, back-offs follow, never above the opener or below last time',()=>{
  const ex=IL.data.EX['back-squat'];
  const hi=ex.rr[1];
  const n=P.nextSets([set(225,hi),set(205,hi+2),set(205,hi+2)],ex,'lb');
  assert.equal(n.pattern,'descending');assert.equal(n.bumped,true);
  assert.equal(n.sets[0].w,230);assert.equal(n.sets[0].r,ex.rr[0]);
  assert.ok(n.sets[1].w>=205&&n.sets[1].w<=230);assert.equal(n.sets[1].r,hi+2,'back-off reps kept as last time');
  // kg grid
  const k=P.nextSets([set(100,hi),set(90,hi)],ex,'kg');
  assert.equal(k.sets[0].w,102.5);assert.equal(k.sets[1].w%2.5,0);
});

test('nextSets: under-range and bodyweight cases',()=>{
  const ex=IL.data.EX['barbell-bench-press'];
  const u=P.nextSets([set(185,3),set(185,3)],ex,'lb');
  assert.equal(u.bumped,false);assert.equal(u.under,true);
  const sg=P.suggestion([session(1,[['barbell-bench-press',[set(185,3)]]])],'barbell-bench-press',{unit:'lb'});
  assert.match(sg.text,/stay at 185lb/);
  const bw=P.nextSets([set(0,20),set(0,20)],IL.data.EX['push-up']||{rr:[8,20]},'lb');
  assert.equal(bw.bumped,false);assert.equal(bw.weighted,false);
});

test('fmtPerf describes flat and ramped work differently',()=>{
  assert.equal(P.fmtPerf([set(135,8),set(135,8)],'lb'),'2×8/8 @ 135lb');
  assert.equal(P.fmtPerf([set(135,10),set(155,8),set(185,6)],'lb'),'135→155→185lb · 10/8/6');
  assert.equal(P.fmtPerf([],'lb'),'');
  assert.equal(P.fmtPerf([set(0,12),set(0,10)],'lb'),'2×12/10 · bodyweight');
});

test('seedExercise seeds the prescription, not a stale copy of last time',()=>{
  const B=IL.builder;
  const hist=[session(2,[['barbell-bench-press',[set(135,8),set(135,8)]]])];
  assert.deepEqual(B.seedExercise('barbell-bench-press',hist,{unit:'lb'}).sets,[{w:140,r:5,done:false},{w:140,r:5,done:false}]);
  assert.equal(B.seedExercise('deadlift',hist,{unit:'lb'}).sets.length,4,'no history: prescribed set count');
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
  const orig=hist[0].updatedAt;
  P.convertSessions(hist,'lb','kg',123);                 // no stamp arg → an IMPORT conversion
  assert.equal(hist[0].exercises[0].sets[0].w,102.1,'weight converted');
  assert.equal(hist[0].updatedAt,orig,'updatedAt NOT bumped on an import conversion (#20) — so an old backup cannot look newer than local edits');
  // control: the user's own unit toggle passes stamp=true and DOES bump updatedAt
  const hist2=[session(1,[['back-squat',[set(225,5)]]])];
  P.convertSessions(hist2,'lb','kg',456,true);
  assert.equal(hist2[0].updatedAt,456,'local toggle stamps so other devices take the converted values');
});

test('streak counts consecutive training weeks and tolerates an untrained current week',()=>{
  // Pinned to a fixed mid-week day (Wed) so week-boundary math is deterministic — "8 days ago" is
  // reliably the previous week. With a live Date.now() this flakes when today IS the week boundary.
  const now=new Date(2026,8,9,12,0,0).getTime();
  const w=7*86400000;
  assert.equal(P.calcStreak([],now),0);
  const hist=[session(1,[['crunch',[set(0,20)]]],{now}),session(8,[['crunch',[set(0,20)]]],{now}),session(15,[['crunch',[set(0,20)]]],{now})];
  assert.ok(P.calcStreak(hist,now)>=2);
  const lastWeekOnly=[session(8,[['crunch',[set(0,20)]]],{now})];
  assert.ok(P.calcStreak(lastWeekOnly,now)>=1,'a streak from last week survives an untrained current week');
  assert.equal(P.calcStreak([session(30,[['crunch',[set(0,20)]]],{now})],now),0);
  assert.ok(w>0);
});

test('weekIndex: local Monday-start weeks, DST-safe',()=>{
  const D=(y,m,d,h)=>new Date(y,m,d,h||12).getTime();
  // Sun 23:59 and the Monday that STARTS that same week share an index; the next Monday differs by 1
  const sun=new Date(2026,8,13,23,59).getTime();          // Sun 13 Sep 2026 (week of Mon 7 Sep)
  assert.equal(P.weekIndex(sun),P.weekIndex(D(2026,8,7,0)),'Sun night == that week\'s Monday');
  assert.equal(P.weekIndex(D(2026,8,14))-P.weekIndex(D(2026,8,7)),1,'consecutive Mondays differ by 1');
  // a week spanning the end-of-DST change (Sun 1 Nov 2026 in the US) is still one bucket
  assert.equal(P.weekIndex(D(2026,9,28)),P.weekIndex(D(2026,10,1)),'Wed and the following Sun across DST share a week');
  assert.equal(P.weekIndex(D(2026,10,2))-P.weekIndex(D(2026,9,28)),1,'the next Monday is the next week');
});

test('streak counts REAL Mon–Sun weeks: Tue+Wed+Thu of one week is a 1-week streak',()=>{
  // The reported bug: 3 sessions Tue/Wed/Thu read as "2 weeks" because the old epoch bucket split them.
  const now=new Date(2026,8,11,12).getTime();             // Fri 11 Sep 2026 (week of Mon 7 Sep)
  const wk=[new Date(2026,8,8,18),new Date(2026,8,9,18),new Date(2026,8,10,18)]  // Tue, Wed, Thu
    .map(d=>({id:'s'+d.getTime(),schema:1,date:d.getTime(),updatedAt:d.getTime(),completed:true,exercises:[{id:'crunch',name:'Crunch',sets:[{w:0,r:20,done:true}]}]}));
  assert.equal(P.calcStreak(wk,now),1,'one calendar week');
  // a Sun→Mon pair crosses a week boundary → 2
  const cross=[{id:'a',schema:1,date:new Date(2026,8,6,18).getTime(),updatedAt:0,completed:true,exercises:[{id:'crunch',name:'C',sets:[{w:0,r:20,done:true}]}]},
               {id:'b',schema:1,date:new Date(2026,8,7,18).getTime(),updatedAt:0,completed:true,exercises:[{id:'crunch',name:'C',sets:[{w:0,r:20,done:true}]}]}];
  assert.equal(P.calcStreak(cross,now),2,'Sun + Mon are two different weeks');
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

test('exerciseSeries: best-set e1RM per real session, oldest→newest, deloads excluded',()=>{
  const now=Date.now();
  const hist=[
    session(2,[['back-squat',[set(245,5),set(245,3)]]],{now}),
    Object.assign(session(5,[['back-squat',[set(135,10)]]],{now}),{deload:true}),   // deload skipped
    session(12,[['back-squat',[set(225,5)]]],{now})
  ];
  const s=P.exerciseSeries(hist,'back-squat',{});
  assert.equal(s.length,2,'deload excluded');
  assert.ok(s[0].date<s[1].date,'oldest first');
  assert.equal(s[0].est,P.e1rm(225,5));
  assert.equal(s[1].est,P.e1rm(245,5),'takes the best set of the session');
});

test('bestE1rmBefore: all-time best for live PR detection, per mode, ignoring deloads',()=>{
  const now=Date.now();
  const hist=[
    session(3,[['barbell-bench-press',[set(185,5)]]],{now}),
    session(10,[['barbell-bench-press',[set(200,3)]]],{now})
  ];
  const best=P.bestE1rmBefore(hist,'barbell-bench-press',{});
  assert.equal(best,Math.max(P.e1rm(185,5),P.e1rm(200,3)));
  // a heavier future set would beat it (PR); mode filter isolates a different modality
  assert.equal(P.bestE1rmBefore(hist,'barbell-bench-press',{mode:'dumbbell'}),0,'no dumbbell history → 0');
});

test('A3: finalizeSets drops a loaded lift ticked with no weight, keeps a bodyweight one',()=>{
  // A ticked barbell set with w:'' would save as 0-volume and poison "last time" — drop it.
  const r=IL.prog.finalizeSets([{id:'barbell-bench-press',sets:[{w:'',r:6,done:true},{w:135,r:6,done:true}]}]);
  assert.equal(r.length,1,'the exercise survives (it has one real set)');
  assert.equal(r[0].sets.length,1,'only the weighted set is kept');
  assert.equal(r[0].sets[0].w,135);
  // control: a bodyweight move ticked with no weight IS a real set
  const bw=IL.prog.finalizeSets([{id:'push-up',sets:[{w:'',r:20,done:true}]}]);
  assert.equal(bw.length,1);assert.equal(bw[0].sets.length,1,'push-up with no weight kept');
  // control: an exercise left with only weightless loaded sets drops entirely (nothing to save)
  const gone=IL.prog.finalizeSets([{id:'barbell-bench-press',sets:[{w:'',r:6,done:true}]}]);
  assert.equal(gone.length,0,'a weightless-only loaded exercise is dropped');
});
