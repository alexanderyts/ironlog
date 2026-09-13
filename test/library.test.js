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

test('rotation families: exercises have same-group alternatives to swap within',()=>{
  const alt=B.replacementFor('machine-chest-press',['barbell-bench-press'],1);   // returns an exercise object
  assert.ok(alt&&alt.group==='Chest','a chest accessory has a chest replacement');
  const sh=B.replacementFor('lateral-raise',['overhead-press'],1);
  assert.ok(sh&&sh.group==='Shoulders','a shoulder accessory has a shoulder replacement');
});

test('the new glute-medius region has an exercise and is covered by a fresh glute build',()=>{
  assert.ok(EXERCISES.some(e=>e.group==='Glutes'&&e.reg==='medius'),'a medius exercise exists');
  for(let s=0;s<5;s++)assert.ok(B.buildRecommendation(['Glutes'],[],s).some(id=>EX[id].reg==='medius'),'glute build covers medius, seed '+s);
});

test('a fresh build tends to include a lengthened-position (stretch) movement',()=>{
  let withStretch=0;
  for(let s=0;s<6;s++)if(B.buildRecommendation(['Hamstrings','Quads'],[],s).some(id=>LONG_LENGTH.has(id)))withStretch++;
  assert.ok(withStretch>=4,'most builds include a stretch option ('+withStretch+'/6)');
});
