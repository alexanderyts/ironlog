const test=require('node:test'),assert=require('node:assert/strict');
const {IL,session,set}=require('./load.js');
const A=IL.analysis,B=IL.builder,{EX}=IL.data;
const now=Date.now();

test('buildHints turns findings into builder inputs',()=>{
  const hist=[];for(let w=0;w<5;w++)hist.push(session(w*7+2,[['barbell-bench-press',[set(135,6),set(135,6),set(135,6)]]],{now}));
  const h=A.buildHints(hist,now,0);
  assert.ok(Array.isArray(h.gaps)&&h.gaps.some(g=>g.group==='Chest'&&g.reg==='upper'));
  assert.ok(Array.isArray(h.undertrained));
  assert.ok(Array.isArray(h.suggestGroups));
});

test('reaction — gap-ADD covers a flagged region without swapping, and is self-limiting (Phase C)',()=>{
  const hist=[];for(let w=0;w<5;w++)hist.push(session(w*7+2,[['barbell-bench-press',[set(135+w*5,6),set(135+w*5,6),set(135+w*5,6)]]],{now}));
  const hints=A.buildHints(hist,now,0);
  const p=B.planWorkout(['Chest'],hist,2,{now,hints});
  assert.equal(p.mode,'continue');
  assert.equal(p.rotation,null,'a gap is fixed by ADDING, never by swapping the anchor');
  const add=p.reactions.find(r=>r.type==='gap-add');
  assert.ok(add,'an exercise was added');
  assert.equal(EX[add.exId].group,'Chest');assert.equal(EX[add.exId].reg,'upper','highest-prio chest gap');
  assert.ok(p.ids.includes('barbell-bench-press')&&p.ids.includes(add.exId));
  // once the added exercise has been logged, the gap is covered → it is not re-added
  const hist2=hist.concat(session(1,[['barbell-bench-press',[set(165,6)]],[add.exId,[set(95,8)]]],{now})).sort((a,b)=>b.date-a.date);
  const p2=B.planWorkout(['Chest'],hist2,2,{now,hints:A.buildHints(hist2,now,0)});
  assert.ok(!p2.reactions.some(r=>r.type==='gap-add'&&r.exId===add.exId),'not re-added once covered');
});

test('reaction — undertrained group earns +1 set, capped (Phase C)',()=>{
  const hist=[];for(let w=0;w<5;w++)hist.push(session(w*7+2,[['romanian-deadlift',[set(185,8),set(185,8)]],['barbell-bench-press',[set(135,6),set(135,6),set(135,6)]]],{now}));
  const hints=A.buildHints(hist,now,0);
  assert.ok(hints.undertrained.includes('Hamstrings'));
  const p=B.planWorkout(['Hamstrings','Chest'],hist,2,{now,hints});
  assert.ok(p.volumeBump.some(id=>EX[id].group==='Hamstrings'),'a hamstrings exercise is bumped');
  // seedExercise honours the bump and the per-exercise ceiling
  const base=B.seedExercise('romanian-deadlift',hist,{unit:'lb'}).sets.length;
  assert.equal(B.seedExercise('romanian-deadlift',hist,{unit:'lb',extraSet:true}).sets.length,base+1,'+1 set');
  const many=[session(2,[['romanian-deadlift',[set(1,1),set(1,1),set(1,1),set(1,1),set(1,1)]]],{now})];
  assert.equal(B.seedExercise('romanian-deadlift',many,{unit:'lb',extraSet:true}).sets.length,B.MAX_SETS_PER_EX,'capped at the ceiling');
});

test('reaction — a flagged gap never triggers a rotation, and results are stable across seeds (Phase C)',()=>{
  // weights CLIMB toward the present (smaller w = more recent = heavier) → everything progressing
  const hist=[];for(let w=0;w<5;w++)hist.push(session(w*7+2,[['barbell-bench-press',[set(135+(4-w)*5,6),set(135+(4-w)*5,6)]],['tricep-pushdown',[set(50+(4-w)*5,10),set(50+(4-w)*5,10)]]],{now}));
  const hints=A.buildHints(hist,now,0);
  const runs=[1,2,3,99].map(s=>B.planWorkout(['Chest','Triceps'],hist,s,{now,hints}));
  runs.forEach(r=>assert.ok(!r.rotation,'gap reactions add/score — they never swap a progressing lift'));
  const first=new Set(runs[0].ids);
  runs.forEach(r=>assert.deepEqual(new Set(r.ids),first,'same plan every seed'));
});
