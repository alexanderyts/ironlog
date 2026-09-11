const test=require('node:test'),assert=require('node:assert/strict');
const {IL,session,set}=require('./load.js');
const {EX,EXERCISES,GROUPS,REGIONS,IDEAL_PATS,C,I}=IL.data;
const B=IL.builder;
const names=ids=>ids.map(id=>EX[id].name);

test('every exercise has valid metadata',()=>{
  for(const e of EXERCISES){
    assert.ok(GROUPS.includes(e.group),e.id+' group');
    assert.ok(['hpush','vpush','hpull','vpull','hinge','squat','lunge','iso'].includes(e.pat),e.id+' pattern');
    assert.ok([1,2,3].includes(e.tier),e.id+' tier');
    assert.ok(e.rr[0]<=e.rr[1],e.id+' rep range');
  }
});

test('single-muscle plans cover every ideal region or complementary pattern',()=>{
  for(const g of GROUPS){
    for(let seed=0;seed<7;seed++){
      const ids=B.buildRecommendation([g],[],seed);
      const regs=new Set(ids.map(id=>EX[id].reg)),pats=new Set(ids.map(id=>EX[id].pat));
      const missingReg=(REGIONS[g]||[]).filter(r=>!regs.has(r)&&EXERCISES.some(e=>e.group===g&&e.reg===r));
      const missingPat=(IDEAL_PATS[g]||[]).filter(p=>!pats.has(p)&&EXERCISES.some(e=>e.group===g&&e.pat===p));
      assert.deepEqual(missingReg,[],g+' seed '+seed+' misses regions: '+names(ids));
      assert.deepEqual(missingPat,[],g+' seed '+seed+' misses patterns: '+names(ids));
      assert.equal(new Set(ids).size,ids.length,'no duplicates');
    }
  }
});

test('anchor is a foundational lift on the muscle\'s key pattern',()=>{
  for(const g of GROUPS){
    for(let seed=0;seed<6;seed++){
      const ids=B.buildRecommendation([g],[],seed);
      const first=EX[ids[0]];
      assert.equal(first.tier,1,g+' anchors on tier-1, got '+first.name);
      assert.ok((IDEAL_PATS[g]||[]).includes(first.pat),g+' anchors on key pattern, got '+first.name);
    }
  }
});

test('never anchors shoulders on an upright row or back on a deadlift',()=>{
  for(let seed=0;seed<10;seed++){
    assert.notEqual(B.buildRecommendation(['Shoulders'],[],seed)[0],'upright-row');
    assert.ok(!B.buildRecommendation(['Back'],[],seed).includes('deadlift'),'deadlift is not back-day filler');
  }
});

test('progression continuity: anchors on the foundational lift you have history on',()=>{
  const hist=[session(3,[['incline-barbell-press',[set(135,6)]]])];
  for(let seed=0;seed<5;seed++)assert.equal(B.buildRecommendation(['Chest'],hist,seed)[0],'incline-barbell-press');
});

test('ordering: big compounds first, isolation last, focus muscle leads its tier',()=>{
  const ids=B.orderByFatigue(['dumbbell-fly','back-squat','tricep-pushdown','barbell-bench-press','lateral-raise','deadlift'],'Chest');
  assert.deepEqual(names(ids).slice(0,3),['Back Squat','Deadlift','Barbell Bench Press']);
  assert.ok(ids.slice(3).every(id=>EX[id].type===I),'isolation at the end');
  const chestFirst=B.buildRecommendation(['Chest','Shoulders'],[],1),shoulderFirst=B.buildRecommendation(['Shoulders','Chest'],[],1);
  assert.equal(EX[chestFirst[0]].group,'Chest');assert.equal(EX[shoulderFirst[0]].group,'Shoulders');
});

test('safety: at most two heavy barbell squat/hinge lifts; hip thrust exempt',()=>{
  for(let seed=0;seed<8;seed++){
    const ids=B.buildRecommendation(['Quads','Hamstrings','Glutes','Back'],[],seed);
    assert.ok(ids.filter(id=>B.isHeavyAxial(EX[id])).length<=2,'seed '+seed+': '+names(ids));
  }
  assert.equal(B.isHeavyAxial(EX['hip-thrust']),false);
  assert.equal(B.isHeavyAxial(EX['back-squat']),true);
  const capped=B.capHeavyAxial(['back-squat','deadlift','romanian-deadlift','leg-extension']);
  assert.ok(capped.filter(id=>B.isHeavyAxial(EX[id])).length<=2);
  assert.ok(capped.includes('leg-extension'));
});

test('multi-muscle days stay balanced and sane in size',()=>{
  const ids=B.buildRecommendation(['Chest','Back','Shoulders','Biceps','Triceps'],[],3);
  assert.ok(ids.length>=5&&ids.length<=8,'size '+ids.length);
  assert.ok(EX[ids[0]].type===C,'starts with a compound');
  const push=ids.filter(id=>['hpush','vpush'].includes(EX[id].pat)).length,pull=ids.filter(id=>['hpull','vpull'].includes(EX[id].pat)).length;
  assert.ok(Math.abs(push-pull)<=2,'push '+push+' vs pull '+pull);
});

test('no padding: hamstrings day is hinge + curl, not four of the same thing',()=>{
  const ids=B.buildRecommendation(['Hamstrings'],[],2);
  assert.ok(ids.some(id=>EX[id].pat==='hinge')&&ids.some(id=>EX[id].pat==='iso'));
  assert.ok(ids.length<=3);
});

test('set prescription: main lifts 4, other compounds 3, isolation 3, finishers 2; reps at range floor',()=>{
  assert.equal(B.seedExercise('back-squat',[]).sets.length,4);
  assert.equal(B.seedExercise('back-squat',[]).sets[0].r,5);
  assert.equal(B.seedExercise('push-up',[]).sets.length,3);
  assert.equal(B.seedExercise('lateral-raise',[]).sets.length,3);
  assert.equal(B.seedExercise('dumbbell-fly',[]).sets.length,2);
  const hist=[session(2,[['back-squat',[set(225,5),set(225,5)]]])];
  assert.deepEqual(B.seedExercise('back-squat',hist,{}).sets.map(s=>[s.w,s.r]),[[225,5],[225,5]]);
});

test('complementary suggestions fill region/pattern gaps within the workout\'s own muscles',()=>{
  const afterBench=B.complementSuggestions(['barbell-bench-press'],3).map(s=>EX[s.id].reg);
  assert.ok(afterBench.includes('upper')&&afterBench.includes('lower'),'suggests upper + lower chest: '+afterBench);
  const afterRdl=B.complementSuggestions(['romanian-deadlift'],1)[0];
  assert.equal(EX[afterRdl.id].pat,'iso','hinge → suggests a curl');
  assert.match(afterRdl.why,/an isolation/);
});

test('never suggests a muscle group outside the current workout (a pull day never gets a press)',()=>{
  const pullDay=['deadlift','barbell-row','lat-pulldown','barbell-curl'];
  const pullGroups=new Set(pullDay.map(id=>EX[id].group));
  for(const s of B.complementSuggestions(pullDay,10))assert.ok(pullGroups.has(EX[s.id].group),'suggested '+EX[s.id].name+' ('+EX[s.id].group+') on a pull day');
  // two presses (Chest + Shoulders) — every suggestion must stay within those two groups, never a pull
  const pushDay=['barbell-bench-press','overhead-press'];
  const pushGroups=new Set(pushDay.map(id=>EX[id].group));
  for(const s of B.complementSuggestions(pushDay,10))assert.ok(pushGroups.has(EX[s.id].group),'suggested '+EX[s.id].name+' ('+EX[s.id].group+') outside the push day\'s own muscles');
});
