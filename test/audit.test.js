// Phase F — adversarial audit of the builder. Each block attacks an invariant the whole v4 design
// depends on. If one fails it's a real bug to fix, not a test to loosen.
const test=require('node:test'),assert=require('node:assert/strict');
const {IL,session,set}=require('./load.js');
const A=IL.analysis,B=IL.builder,{EX}=IL.data;
const now=Date.now();
const PUSH=['barbell-bench-press','incline-dumbbell-press','overhead-press','cable-crossover','tricep-pushdown'];
const climb=(id,d)=>[set(200-d,6),set(200-d,6)];            // heavier toward the present → progressing
const day=(d,mod)=>session(d,PUSH.map(id=>[id,(mod&&mod(id,d))||climb(id,d)]),{now});

test('CHURN: continuing a stable, progressing plan is identical across 20 builds (with the full library)',()=>{
  const hist=[3,10,17,24,31,38].map(d=>day(d));
  const hints=A.buildHints(hist,now,0);
  const base=B.planWorkout(['Chest','Shoulders','Triceps'],hist,1,{now,hints});
  const baseSet=new Set(base.ids);
  for(let i=0;i<20;i++){
    const p=B.planWorkout(['Chest','Shoulders','Triceps'],hist,Math.floor(Math.random()*1e6),{now,hints});
    assert.equal(p.rotation,null,'no spurious rotation, iter '+i);
    assert.deepEqual(new Set(p.ids),baseSet,'identical plan, iter '+i);
  }
});

test('HOLD WHAT WORKS: a lift progressing for 10 weeks is never rotated',()=>{
  const hist=[7,14,21,28,35,42,49,56,63,70].map(d=>day(d));
  for(let s=0;s<8;s++)assert.equal(B.planWorkout(['Chest','Shoulders','Triceps'],hist,s,{now}).rotation,null,'seed '+s);
});

test('FREQUENCY FAIRNESS: stall is judged in weeks — 1× and 3×/week converge, neither fires early',()=>{
  const flat=(id)=>id==='cable-crossover'?[set(40,12),set(40,12)]:[set(120,6),set(120,6)];
  const mk=days=>days.map(d=>session(d,PUSH.map(id=>[id,flat(id)]),{now}));
  // 3×/week for one week: 3 sessions but <2 weeks → not a stall
  assert.equal(B.isStalled(mk([2,4,6]),'cable-crossover'),false,'3×/wk, 1 week: not yet');
  // 3×/week over 3 weeks and 1×/week over 3 weeks both read as stalled at comparable calendar time
  assert.equal(B.isStalled(mk([2,4,6,9,11,13,16,18,20]),'cable-crossover'),true,'3×/wk, 3 weeks: stalled');
  assert.equal(B.isStalled(mk([3,10,17]),'cable-crossover'),true,'1×/wk, 3 weeks: stalled');
});

test('ANCHOR SAFETY: swap only with stall+deload, same pattern, never dropped',()=>{
  const benchDay=d=>session(d,[['barbell-bench-press',[set(185,5),set(185,5)]],['cable-crossover',[set(40,12)]]],{now});
  const stalled=[7,14,21,28,35].map(benchDay);
  assert.ok(!(B.planWorkout(['Chest'],stalled,2,{now}).rotation||{}).anchor,'no deload → no anchor swap');
  const withDeload=stalled.concat(Object.assign(benchDay(10),{deload:true})).sort((a,b)=>b.date-a.date);
  const p=B.planWorkout(['Chest'],withDeload,2,{now});
  assert.ok(p.rotation&&p.rotation.anchor,'stall + deload → swap');
  assert.equal(EX[p.rotation.to].pat,EX[p.rotation.from].pat,'same movement pattern — never dropped');
  assert.equal(EX[p.rotation.to].tier,1,'to a tier-1 variation');
});

test('VOLUME CEILINGS: bump only below the threshold, capped, never on a deload',()=>{
  // a well-trained muscle (~10 sets/week) is NOT flagged undertrained → no bump
  const strong=[];for(let w=0;w<4;w++){const b=()=>['barbell-bench-press',[set(135,6),set(135,6),set(135,6),set(135,6),set(135,6)]];
    strong.push(session(w*7+2,[b()],{now}),session(w*7+5,[b()],{now}));}
  const hints=A.buildHints(strong,now,0);
  assert.ok(!hints.undertrained.includes('Chest'),'well-trained chest is not undertrained');
  // per-exercise ceiling holds and a deload never gets an extra set
  const many=[session(2,[['barbell-bench-press',[set(1,1),set(1,1),set(1,1),set(1,1),set(1,1)]]],{now})];
  assert.equal(B.seedExercise('barbell-bench-press',many,null,'lb',false,true).sets.length,B.MAX_SETS_PER_EX,'capped');
  assert.equal(B.seedExercise('barbell-bench-press',many,null,'lb',true,true).sets.length<=B.MAX_SETS_PER_EX,true,'deload never overshoots');
  const dl=B.seedExercise('romanian-deadlift',[session(2,[['romanian-deadlift',[set(100,8),set(100,8)]]],{now})],null,'lb',true,true);
  assert.equal(dl.sets.length,2,'deload ignores the extra-set request');
});

test('SESSION INVARIANTS survive a gap-add: ≤7 exercises, compounds first, heavy-axial capped',()=>{
  // a leg plan missing a region, with room, plus a hint → gap-add, then check invariants
  const legHist=[];for(let w=0;w<5;w++)legHist.push(session(w*7+2,[['back-squat',[set(225,5),set(225,5)]],['romanian-deadlift',[set(185,8),set(185,8)]],['deadlift',[set(275,4),set(275,4)]]],{now}));
  const p=B.planWorkout(['Quads','Hamstrings','Glutes'],legHist,3,{now,hints:A.buildHints(legHist,now,0)});
  assert.ok(p.ids.length<=8,'size stays sane');
  assert.ok(EX[p.ids[0]].type==='compound','a compound leads');
  assert.ok(p.ids.filter(id=>B.isHeavyAxial(EX[id])).length<=2,'heavy-axial cap holds after reactions');
  (p.reactions||[]).forEach(r=>assert.ok(r.why&&r.why.length,'every reaction has a reason'));
});

test('INTERACTION: a rotation and a gap-add never both happen in one session',()=>{
  // crossover stalled (→ rotation) AND an uncovered region flagged: at most one structural change
  const hist=[7,14,21,28].map(d=>session(d,[['barbell-bench-press',[set(200-d,6),set(200-d,6)]],['cable-crossover',[set(40,12),set(40,12)]]],{now}));
  const p=B.planWorkout(['Chest'],hist,2,{now,hints:A.buildHints(hist,now,0)});
  const gapAdds=(p.reactions||[]).filter(r=>r.type==='gap-add').length;
  assert.ok(!(p.rotation&&gapAdds>0),'not both a swap and an add');
});

test('INTERACTION: a modality switch mid-block does not cause a spurious rotation',()=>{
  // bench done barbell (flat) for weeks, then switched to dumbbell in the most recent session — the
  // new dumbbell stream has almost no history, so it must NOT read as a stalled anchor and swap.
  const barbell=d=>session(d,[['barbell-bench-press',[set(185,5),set(185,5)]],['tricep-pushdown',[set(60,10),set(60,10)]]],{now});
  const hist=[8,15,22,29].map(barbell);
  const recent=session(1,[['tricep-pushdown',[set(65,10)]]],{now});
  recent.exercises.unshift({id:'barbell-bench-press',name:'Bench',mode:'dumbbell',sets:[{w:70,r:8,done:true}]});
  hist.unshift(recent);
  const p=B.planWorkout(['Chest','Triceps'],hist,2,{now});
  assert.ok(!p.rotation||!p.rotation.anchor,'a fresh modality stream is not treated as a stalled anchor');
});

test('CHURN with an active stall: the rotation swap is deterministic across seeds',()=>{
  const flat=(id,d)=>id==='cable-crossover'?[set(40,12),set(40,12)]:[set(200-d,6),set(200-d,6)];
  const hist=[3,10,17,24].map(d=>session(d,PUSH.map(id=>[id,flat(id,d)]),{now}));
  const hints=A.buildHints(hist,now,0);
  const swaps=new Set([1,7,42,999,123456].map(s=>{const p=B.planWorkout(['Chest','Shoulders','Triceps'],hist,s,{now,hints});return p.rotation?p.rotation.from+'>'+p.rotation.to:'none';}));
  assert.equal(swaps.size,1,'same swap every build: '+[...swaps]);
});
