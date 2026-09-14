// Roadmap v7 Phase B — Continuity. Each fix has an ORACLE (hand-computed) and a CONTROL. These attack
// the ways the engine mis-read a normal training life over months: double progression, a deload/missed
// week, tier-1 rotation, assist machines, and the DST week bug.
const test=require('node:test'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {IL,session,set,history,weekly,NOW}=require('./load.js');
const B=IL.builder,P=IL.prog,{EX}=IL.data;

test('B1: double progression at 1×/week is NOT a stall (climbing reps at the same top weight)',()=>{
  // 100×12 → 105×8 → 105×9 → 105×10 weekly: e1RM ties (Epley 105×10 = 100×12 = 140) but reps at 105
  // are climbing 8→9→10 — progress, not a plateau.
  const dp=history(session(3,[['dumbbell-row',[set(105,10)]]],{now:NOW}),session(10,[['dumbbell-row',[set(105,9)]]],{now:NOW}),
                   session(17,[['dumbbell-row',[set(105,8)]]],{now:NOW}),session(24,[['dumbbell-row',[set(100,12)]]],{now:NOW}));
  assert.equal(B.isStalled(dp,'dumbbell-row',{now:NOW}),false,'reps climbing at 105 is progress');
  assert.equal(B.planWorkout(['Back'],dp,2,{now:NOW}).rotation,null,'so the lift is not rotated out');
  // control: genuinely flat 105×8 four weeks IS a stall
  assert.equal(B.isStalled(weekly([['dumbbell-row',()=>[set(105,8)]]],4,{now:NOW}),'dumbbell-row',{now:NOW}),true);
  // control: a weight bump with NO subsequent rep progress (100×12 → 105×8 ×3) still stalls after 3 flat weeks
  const bumpFlat=history(session(3,[['dumbbell-row',[set(105,8)]]],{now:NOW}),session(10,[['dumbbell-row',[set(105,8)]]],{now:NOW}),
                         session(17,[['dumbbell-row',[set(105,8)]]],{now:NOW}),session(24,[['dumbbell-row',[set(100,12)]]],{now:NOW}));
  assert.equal(B.isStalled(bumpFlat,'dumbbell-row',{now:NOW}),true);
});

test('B2: a deload week does not restart the plan; a missed week continues as a lapse',()=>{
  const PUSH=['barbell-bench-press','tricep-pushdown'];
  const day=(d,dl)=>session(d,PUSH.map(id=>[id,[set(id==='barbell-bench-press'?185:50,6),set(id==='barbell-bench-press'?185:50,6)]]),{now:NOW,deload:dl});
  // real push 10.5 & 17.5 days ago, a deload block Mon/Wed/Fri in between → the deloads bridge the gap
  const block=history(day(10.5),day(17.5),session(3,[['barbell-bench-press',[set(110,8)]]],{now:NOW,deload:true}),session(5,[['barbell-bench-press',[set(110,8)]]],{now:NOW,deload:true}));
  const pb=B.planWorkout(['Chest','Triceps'],block,1,{now:NOW});
  assert.equal(pb.mode,'continue','a 3+1 deload block continues the plan, not a fresh reshuffle');
  assert.ok(!pb.lapsed,'within the window via the deload bridge, not a lapse');
  // control: the SAME history with the deloads removed → the 10.5-day gap is a lapse (proves the deloads bridged it)
  const noBridge=history(day(10.5),day(17.5));
  assert.equal(B.planWorkout(['Chest','Triceps'],noBridge,1,{now:NOW}).lapsed,true);
});

test('B4: a tier-1 main lift (deadlift) is never rotated like an accessory, even when flat',()=>{
  const back=history(...[7,14,21,28,35].map(d=>session(d,[['deadlift',[set(315,5),set(315,5)]],['lat-pulldown',[set(120,10)]],['barbell-row',[set(155,8)]]],{now:NOW})));
  const p=B.planWorkout(['Back'],back,2,{now:NOW});
  assert.ok(!p.rotation||p.rotation.from!=='deadlift','a flat deadlift is not swapped for a rack pull');
  // control: a flat ACCESSORY (lateral raise) in a shoulders plan does rotate
  const sh=history(...[7,14,21,28].map(d=>session(d,[['overhead-press',[set(95+((28-d)/7)*5,6)]],['lateral-raise',[set(20,15),set(20,15)]]],{now:NOW})));
  const ps=B.planWorkout(['Shoulders'],sh,2,{now:NOW});
  assert.ok(ps.rotation&&ps.rotation.from==='lateral-raise','the stalled accessory still rotates');
});

test('B8: equipment mode follows the last REAL session, not a deload done on other gear',()=>{
  const hist=history(session(10,[['overhead-press',[set(225,8),set(225,8)],{mode:'smith'}]],{now:NOW}),
                     session(3,[['overhead-press',[set(110,8)],{mode:'barbell'}]],{now:NOW,deload:true}));
  const seed=B.seedExercise('overhead-press',hist,{unit:'lb'});
  assert.equal(seed.mode,'smith','mode from the real Smith session, not the barbell deload');
  assert.deepEqual(seed.sets.map(s=>[s.w,s.r]),[[230,5],[230,5]],'prescription from the Smith 225, progressed');
});

test('B10: week index advances by exactly 1 every week across DST, in every timezone (the NZ streak bug)',()=>{
  // TZ must be set BEFORE node starts, so run the real weekIndex in child processes. Sample every 7
  // days for 31 weeks (spanning NZ's early-April fall-back and late-Sept spring-forward) — each step
  // must be +1. Before the fix, weekStart(ts)/(7·DAY) sat near x.5 in +12/+13h zones and stepped by
  // 0 or 2 across a DST change, so a weekly streak in NZ read as 2 instead of 9.
  const script="const{IL}=require('./test/load.js');const wi=IL.prog.weekIndex,D=86400000;"+
    "let t=Date.UTC(2026,2,4,12),prev=wi(t),diffs=[];"+
    "for(let i=1;i<32;i++){t+=7*D;const w=wi(t);diffs.push(w-prev);prev=w;}"+
    "process.stdout.write(JSON.stringify(diffs));";
  for(const tz of ['Pacific/Auckland','America/New_York','Europe/Berlin','Asia/Kolkata']){
    const out=execFileSync(process.execPath,['-e',script],{env:{...process.env,TZ:tz},cwd:process.cwd()}).toString();
    assert.ok(JSON.parse(out).every(d=>d===1),tz+': every weekly step is +1 ('+out+')');
  }
});
