// Phase P2 — the builder listens to the training profile. Every lever gets ONE test that asserts
// what CHANGED and what DIDN'T (a control), with a hand-computed oracle — never "it ran". The final
// block re-runs the builder's own adversarial audits with a profile set, so a lever can't quietly
// break churn/hold/anchor safety. Levers apply in a fixed order: avoid → gym → protect → length →
// goal → sets → push.
const test=require('node:test'),assert=require('node:assert/strict');
const {IL,session,set,history,NOW}=require('./load.js');
const A=IL.analysis,B=IL.builder,P=IL.prog,{EX}=IL.data;
const br=(groups,seed,profile)=>B.buildRecommendation(groups,[],seed,undefined,undefined,profile);

// ── 1. avoid ─────────────────────────────────────────────────────────────────────────────────────
test('P2 avoid: an avoided lift never appears in a fresh plan, and IS there without the lever',()=>{
  for(let seed=0;seed<8;seed++){
    assert.ok(br(['Chest'],seed).includes('barbell-bench-press')||seed>0,'sanity: bench is a natural chest pick');
    assert.ok(!br(['Chest'],seed,{avoid:['barbell-bench-press']}).includes('barbell-bench-press'),'avoid removes it, seed '+seed);
  }
  // control: with the lever off at seed 1 the bench is chosen (the exact plan we avoid against)
  assert.ok(br(['Chest'],1).includes('barbell-bench-press'),'control: bench present without avoid');
});
test('P2 avoid: a CONTINUED plan swaps an avoided lift for a same-group lift, and says why',()=>{
  const hist=[3,10,17].map(d=>session(d,[['barbell-bench-press',[set(185,6),set(185,6)]],['tricep-pushdown',[set(60,10)]]],{now:NOW}));
  const p=B.planWorkout(['Chest','Triceps'],hist,2,{now:NOW,profile:{avoid:['barbell-bench-press']}});
  assert.ok(!p.ids.includes('barbell-bench-press'),'avoided lift gone from the continued plan');
  assert.equal(EX[p.ids[0]].group,'Chest','swapped for another chest lift, not dropped');
  const sw=(p.reactions||[]).find(r=>r.type==='avoid-swap');
  assert.ok(sw&&sw.from==='barbell-bench-press'&&/avoid/.test(sw.why),'a reason mentions the avoid');
  // and a deload STILL respects avoid (a user directive, not a progression reaction)
  const pd=B.planWorkout(['Chest','Triceps'],hist,2,{now:NOW,deload:true,profile:{avoid:['barbell-bench-press']}});
  assert.ok(!pd.ids.includes('barbell-bench-press'),'a deload honours avoid too');
});

// ── 2. gym ───────────────────────────────────────────────────────────────────────────────────────
test('P2 gym=home: fresh proposals are dumbbell/bodyweight only; full gym keeps barbells (control)',()=>{
  const home=br(['Chest'],1,{gym:'home'});
  assert.ok(home.every(id=>EX[id].equip==='Dumbbell'||EX[id].equip==='Bodyweight'),'home = DB/BW only: '+home.join(','));
  assert.ok(br(['Chest'],1).some(id=>EX[id].equip==='Barbell'),'control: full gym still proposes a barbell lift');
});
test('P2 gym=machine: excludes barbells UNLESS the user logs that lift in smith mode',()=>{
  assert.ok(!br(['Chest'],1,{gym:'machine'}).some(id=>EX[id].equip==='Barbell'),'no barbell in a machine-gym fresh plan');
  // a barbell lift logged in SMITH mode is kept (prescribed as smith) — the exception the spec calls out
  const smith=history(session(3,[['barbell-bench-press',[set(135,8)]]],{now:NOW}));
  smith[0].exercises[0].mode='smith';
  assert.ok(B.buildRecommendation(['Chest'],smith,1,undefined,undefined,{gym:'machine'}).includes('barbell-bench-press'),'a smith-logged barbell lift survives the machine filter');
});

// ── 3. protect ───────────────────────────────────────────────────────────────────────────────────
test('P2 protect: drops tier-1 free-weight compounds for that group, and never bumps its volume',()=>{
  const prot=br(['Chest'],1,{protect:['Chest']});
  assert.ok(prot.every(id=>!(EX[id].tier===1&&EX[id].type==='compound'&&(EX[id].equip==='Barbell'||EX[id].equip==='Dumbbell'))),'no tier-1 free-weight compound for a protected muscle: '+prot.join(','));
  assert.ok(br(['Chest'],1).some(id=>EX[id].tier===1&&EX[id].type==='compound'),'control: unprotected chest has a tier-1 compound');
  // volume: an undertrained protected muscle is NOT given an extra set; an undertrained UNprotected one still is
  const hist=[3,10,17,24].map(d=>session(d,[['barbell-bench-press',[set(135,8),set(135,8)]],['tricep-pushdown',[set(60,10),set(60,10)]]],{now:NOW}));
  const hints=A.buildHints(hist,NOW,0);
  assert.deepEqual(hints.undertrained.slice().sort(),['Chest','Triceps'],'both muscles read undertrained (oracle setup)');
  const vb=B.planWorkout(['Chest','Triceps'],hist,2,{now:NOW,hints,profile:{protect:['Chest']}}).volumeBump;
  assert.ok(!vb.some(id=>EX[id].group==='Chest'),'no volume bump on the protected chest');
  assert.ok(vb.some(id=>EX[id].group==='Triceps'),'triceps (unprotected) still bumped — protect is group-scoped');
});

// ── 4. length ────────────────────────────────────────────────────────────────────────────────────
test('P2 length: short ≤ standard ≤ long session size (monotonic), within the caps',()=>{
  const g=['Chest','Back','Legs'];
  const s=br(g,1,{length:'short'}).length,n=br(g,1).length,l=br(g,1,{length:'long'}).length;
  assert.ok(s<=n&&n<=l,`monotonic short(${s}) ≤ standard(${n}) ≤ long(${l})`);
  assert.ok(s<n||l>n,'length actually moves the size, not a no-op');
  assert.ok(s<=5&&l<=8,'short caps at 5, long at 8');
});

// ── 5. goal (seedExercise / nextSets) ──────────────────────────────────────────────────────────────
test('P2 goal: size seeds more reps on a fresh lift; on history it holds where general would bump',()=>{
  // fresh, no history: bench rr [5,8]. general targets 5; size shifts +2 → 7. strength pins to 5.
  const reps=g=>B.seedExercise('barbell-bench-press',[],{unit:'lb',goal:g}).sets.map(s=>s.r);
  assert.deepEqual(reps('size'),[7,7,7,7],'size fresh target = 7 (5+2)');
  assert.deepEqual(reps(undefined),[5,5,5,5],'control: general fresh target = 5 (rr low)');
  // with history 185×8×2: general reaches its top (8) → bumps to 190×5; size wants 10 → not ready, holds 185×8
  const hist=history(session(3,[['barbell-bench-press',[set(185,8),set(185,8)]]],{now:NOW}));
  const top=g=>B.seedExercise('barbell-bench-press',hist,{unit:'lb',goal:g}).sets.map(s=>s.w);
  assert.deepEqual(top(undefined),[190,190],'control: general bumps the weight (reached rr top)');
  assert.deepEqual(top('size'),[185,185],'size holds — the higher rep target is not met yet');
});

// ── 6. sets (set style) ────────────────────────────────────────────────────────────────────────────
test('P2 sets: ramp makes a tier-1 top set a 3-step climb; straight flattens an ascending prescription',()=>{
  const hist=history(session(3,[['barbell-bench-press',[set(185,8),set(185,8)]]],{now:NOW}));   // general bumps → 190×5 flat
  const ramp=B.seedExercise('barbell-bench-press',hist,{unit:'lb',setStyle:'ramp'}).sets;
  assert.deepEqual(ramp.map(s=>s.w),[150,170,190],'ramp: 0.8/0.9/1.0 of 190 on the 5lb grid');
  assert.equal(ramp.length,3,'ramp is exactly three sets');
  // straight flattens a non-flat prescription to the top weight
  const asc=history(session(3,[['barbell-bench-press',[set(170,5),set(180,5),set(190,8)]]],{now:NOW}));
  assert.deepEqual(B.seedExercise('barbell-bench-press',asc,{unit:'lb'}).sets.map(s=>s.w),[175,185,195],'control: auto mirrors the ascending shape');
  assert.deepEqual(B.seedExercise('barbell-bench-press',asc,{unit:'lb',setStyle:'straight'}).sets.map(s=>s.w),[195,195,195],'straight: all sets at the top weight');
  // descending pattern (heavy opener, lighter back-offs): the opener 200×5 fell short of 8 so auto
  // mirrors; ramp must carry the OPENER's 5 reps to the top set, not the back-offs' 8
  const desc=history(session(3,[['barbell-bench-press',[set(200,5),set(180,8),set(180,8)]]],{now:NOW}));
  assert.deepEqual(B.seedExercise('barbell-bench-press',desc,{unit:'lb'}).sets.map(s=>[s.w,s.r]),[[200,5],[180,8],[180,8]],'control: auto mirrors the descending shape');
  assert.deepEqual(B.seedExercise('barbell-bench-press',desc,{unit:'lb',setStyle:'ramp'}).sets.map(s=>[s.w,s.r]),[[160,5],[180,5],[200,5]],'ramp: top-set reps come from the set that carried the top weight');
});

// ── 7. push ─────────────────────────────────────────────────────────────────────────────────────
test('P2 push=quiet: the suggestion never bumps and mirrors last time; auto still bumps (control)',()=>{
  const hist=history(session(3,[['barbell-bench-press',[set(185,8),set(185,8)]]],{now:NOW}));
  const auto=P.suggestion(hist,'barbell-bench-press',{unit:'lb'});
  assert.equal(auto.kind,'weight','control: auto suggests a heavier top set');
  assert.deepEqual(auto.next.map(s=>s.w),[190,190],'control: +5lb bump');
  const quiet=P.suggestion(hist,'barbell-bench-press',{unit:'lb',push:'quiet'});
  assert.equal(quiet.kind,'match','quiet never suggests a bump');
  assert.deepEqual(quiet.next.map(s=>s.w),[185,185],'quiet mirrors last time exactly');
  // the SET ROWS must agree with the coach line — a 190 prefilled next to "Recorded — last time was
  // 185×8" would contradict it. Rows are seeded by seedExercise, so it needs the lever too.
  assert.deepEqual(B.seedExercise('barbell-bench-press',hist,{unit:'lb'}).sets.map(s=>[s.w,s.r]),[[190,5],[190,5]],'control: auto rows carry the bump');
  assert.deepEqual(B.seedExercise('barbell-bench-press',hist,{unit:'lb',push:'quiet'}).sets.map(s=>[s.w,s.r]),[[185,8],[185,8]],'quiet rows mirror last time — no bump in the rows either');
  assert.deepEqual(B.seedExercise('barbell-bench-press',hist,{unit:'lb',push:'quiet',deload:true}).sets.map(s=>s.w),[110,110],'quiet never overrides a deload (60% of 185 on the 5lb grid)');
});

// ── audit-green: the invariants survive a profile ──────────────────────────────────────────────────
test('P2 audit: a combined machine + protect Shoulders + short profile keeps CHURN/HOLD green',()=>{
  const PUSH=['barbell-bench-press','incline-dumbbell-press','overhead-press','cable-crossover','tricep-pushdown'];
  const day=d=>session(d,PUSH.map(id=>[id,[set(200-d,6),set(200-d,6)]]),{now:NOW});   // progressing every week
  const hist=[3,10,17,24,31,38].map(day);
  const hints=A.buildHints(hist,NOW,0);
  const prof={gym:'machine',protect:['Shoulders'],length:'short'};
  const base=B.planWorkout(['Chest','Shoulders','Triceps'],hist,1,{now:NOW,hints,profile:prof});
  const baseSet=new Set(base.ids);
  for(let i=0;i<20;i++){
    const p=B.planWorkout(['Chest','Shoulders','Triceps'],hist,Math.floor(Math.random()*1e6),{now:NOW,hints,profile:prof});
    assert.equal(p.rotation,null,'HOLD WHAT WORKS: no spurious rotation under a profile, iter '+i);
    assert.deepEqual(new Set(p.ids),baseSet,'CHURN: the plan is identical across seeds under a profile, iter '+i);
  }
  // a continued barbell anchor the user already trains is NOT retroactively swapped by gym/protect
  assert.ok(base.ids.includes('overhead-press'),'a continued barbell anchor is retained, not force-swapped (no retroactive churn)');
});
