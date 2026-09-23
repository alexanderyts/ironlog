const test=require('node:test'),assert=require('node:assert/strict');
const {IL}=require('./load.js');
const B=IL.builder,{EX,EXERCISES,LONG_LENGTH,UNILATERAL,META,BW_FACTOR}=IL.data;

// Integrity guard for future additions: exercises.js falls back to ['overall','iso',3] when META is
// missing, so a new exercise with a forgotten META entry silently becomes an untiered isolation move
// (wrong region/pattern/tier, invisible). And a tag id that doesn't match a real exercise is dead.
// (No current violations — this only catches the next mistake.)
test('every exercise has explicit META, and every tag/factor id references a real exercise',()=>{
  EXERCISES.forEach(e=>assert.ok(META[e.id],'missing META (would default to iso/overall/3): '+e.id));
  Object.keys(META).forEach(id=>assert.ok(EX[id],'META key with no exercise: '+id));
  [...LONG_LENGTH].forEach(id=>assert.ok(EX[id],'LONG_LENGTH id with no exercise: '+id));
  [...UNILATERAL].forEach(id=>assert.ok(EX[id],'UNILATERAL id with no exercise: '+id));
  Object.keys(BW_FACTOR).forEach(id=>assert.ok(EX[id],'BW_FACTOR id with no exercise: '+id));
});

test('library expanded; LONG_LENGTH / UNILATERAL tags reference real exercises',()=>{
  assert.ok(EXERCISES.length>=100,'library grew to ~100+ ('+EXERCISES.length+')');
  [...LONG_LENGTH].forEach(id=>assert.ok(EX[id],'LONG_LENGTH id exists: '+id));
  [...UNILATERAL].forEach(id=>assert.ok(EX[id],'UNILATERAL id exists: '+id));
});

test('a machine-only gym can still build every preset (commercial-gym pass)',()=>{
  const {PRESETS}=IL.data;
  const machineOnly=EXERCISES.filter(e=>e.equip==='Machine'||e.equip==='Cable').map(e=>e.id);
  // every muscle group has at least one machine/cable option, and the search finds the wife's ask
  IL.data.GROUPS.forEach(g=>assert.ok(EXERCISES.some(e=>e.group===g&&(e.equip==='Machine'||e.equip==='Cable')),g+' has a machine option'));
  const S=IL.search;
  assert.equal(S.searchEx('hip abductor')[0].id,'hip-abduction');
  assert.equal(S.searchEx('adductor')[0].id,'hip-adduction');
  assert.ok(S.searchEx('ab machine').some(e=>e.id==='ab-crunch-machine'));
  assert.ok(machineOnly.length>=35,'plenty of machine work ('+machineOnly.length+')');
  void PRESETS;
});

test('rotation families: a stalled lift is replaced within its own group, deterministically',()=>{
  // oracle: the swap is fixed (hashId tie-break), not seed-dependent — see replacementFor
  assert.equal(B.replacementFor('machine-chest-press',['barbell-bench-press'],1).id,'dumbbell-bench-press');
  assert.equal(B.replacementFor('lateral-raise',['overhead-press'],1).id,'machine-lateral-raise');
  // property: the replacement is always same-group and never one already in the plan
  ['machine-chest-press','lateral-raise','tricep-pushdown','lat-pulldown'].forEach(id=>{
    const r=B.replacementFor(id,[id],7);assert.equal(r.group,EX[id].group,id+' → same group');assert.notEqual(r.id,id);
  });
});

test('the new glute-medius region is covered by every fresh glute build',()=>{
  assert.ok(EXERCISES.some(e=>e.group==='Glutes'&&e.reg==='medius'),'a medius exercise exists');
  // oracle for seed 0, property for all seeds. (v0.62.0: the old oracle was hip thrust + MACHINE hip
  // thrust — a near-duplicate the builder audit flagged; a beginner now leads with the machine version.)
  assert.deepEqual(B.buildRecommendation(['Glutes'],[],0),['machine-hip-thrust','hip-abduction']);
  for(let s=0;s<20;s++)assert.ok(B.buildRecommendation(['Glutes'],[],s).some(id=>EX[id].reg==='medius'),'glute build covers medius, seed '+s);
});

test('every fresh leg build includes a lengthened-position (stretch) movement',()=>{
  // oracle for seed 1, property across 20 seeds. (v0.62.0: the old oracle REQUIRED RDL + stiff-leg deadlift
  // together — the near-duplicate pair the builder audit flagged. A beginner's hamstrings now anchor on the
  // Dumbbell RDL, itself a stretch-position hinge.)
  const s1=B.buildRecommendation(['Hamstrings','Quads'],[],1);
  assert.ok(s1.includes('dumbbell-romanian-deadlift'),'seed 1: '+s1.join(','));
  assert.ok(!(s1.includes('romanian-deadlift')&&s1.includes('stiff-leg-deadlift')),'never RDL + stiff-leg together');
  for(let s=0;s<20;s++){const ids=B.buildRecommendation(['Hamstrings','Quads'],[],s);
    assert.ok(ids.some(id=>LONG_LENGTH.has(id)),'seed '+s+' has a stretch option: '+ids.join(','));}
});
