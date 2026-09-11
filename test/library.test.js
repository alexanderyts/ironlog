const test=require('node:test'),assert=require('node:assert/strict');
const {IL}=require('./load.js');
const B=IL.builder,{EX,EXERCISES,LONG_LENGTH,UNILATERAL}=IL.data;

test('library expanded; LONG_LENGTH / UNILATERAL tags reference real exercises',()=>{
  assert.ok(EXERCISES.length>=100,'library grew to ~100+ ('+EXERCISES.length+')');
  [...LONG_LENGTH].forEach(id=>assert.ok(EX[id],'LONG_LENGTH id exists: '+id));
  [...UNILATERAL].forEach(id=>assert.ok(EX[id],'UNILATERAL id exists: '+id));
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
