const test=require('node:test'),assert=require('node:assert/strict');
const {IL,session,set}=require('./load.js');
const P=IL.prog,B=IL.builder,A=IL.analysis,{EX}=IL.data;

// A logged instance with an explicit mode
const inst=(id,mode,sets)=>({id,name:EX[id]?EX[id].name:id,mode,sets:sets.map(s=>Object.assign({done:true},s))});
const sessM=(daysAgo,exs,now)=>({id:'m'+Math.random().toString(36).slice(2),schema:1,date:(now||Date.now())-daysAgo*864e5,updatedAt:0,completed:true,exercises:exs});

test('modeOf: explicit mode wins, else derived from equipment',()=>{
  assert.equal(P.modeOf({id:'overhead-press'}),'barbell');          // Barbell equip
  assert.equal(P.modeOf({id:'overhead-press',mode:'smith'}),'smith');
  assert.equal(P.modeOf({id:'dumbbell-shoulder-press'}),'dumbbell'); // Dumbbell equip
  assert.equal(P.modeOf({id:'lat-pulldown'}),'cable');              // Cable equip
  assert.equal(P.modeOf({id:'pull-up'}),'bodyweight');
});

test('progression compares within (id, mode): dumbbells never chase the Smith',()=>{
  const now=Date.now();
  const hist=[
    sessM(3,[inst('overhead-press','smith',[set(135,8),set(135,8)])],now),      // most recent = smith
    sessM(10,[inst('overhead-press','dumbbell',[set(50,8),set(50,8)])],now)      // dumbbell earlier
  ];
  // asking as dumbbell must return the dumbbell session, not the more-recent smith one
  const lpDb=P.lastPerf(hist,'overhead-press',{mode:'dumbbell'});
  assert.equal(lpDb.mode,'dumbbell');assert.equal(lpDb.sets[0].w,50);
  const lpSm=P.lastPerf(hist,'overhead-press',{mode:'smith'});
  assert.equal(lpSm.sets[0].w,135);
  // suggestion in dumbbell mode progresses off 50, not 135
  const sg=P.suggestion(hist,'overhead-press',{unit:'lb',mode:'dumbbell'});
  assert.ok(sg.next.every(s=>s.w<100),'dumbbell suggestion stays in dumbbell range: '+JSON.stringify(sg.next));
  // with no mode filter, most-recent (smith) is returned — backward-compatible behavior
  assert.equal(P.lastPerf(hist,'overhead-press').sets[0].w,135);
});

test('lastModeFor remembers the last explicit modality',()=>{
  const now=Date.now();
  const hist=[sessM(2,[inst('overhead-press','smith',[set(135,8)])],now)];
  assert.equal(P.lastModeFor(hist,'overhead-press'),'smith');
  assert.equal(P.lastModeFor(hist,'back-squat'),null,'never logged → null');
  // seedExercise carries the remembered mode onto the new instance
  assert.equal(B.seedExercise('overhead-press',hist,{unit:'lb'}).mode,'smith');
});

test('PRs are tracked separately per modality',()=>{
  const now=Date.now();
  const hist=[
    sessM(2,[inst('overhead-press','smith',[set(155,5)])],now),
    sessM(4,[inst('overhead-press','dumbbell',[set(55,8)])],now)
  ];
  const prs=A.personalRecords(hist,0).filter(p=>p.id==='overhead-press');
  assert.equal(prs.length,2,'one PR per modality');
  const smith=prs.find(p=>p.mode==='smith'),db=prs.find(p=>p.mode==='dumbbell');
  assert.ok(smith&&db);
  assert.equal(smith.showEst,true,'smith 1RM is comparable');
  assert.equal(db.showEst,true,'dumbbell 1RM is comparable');
  // a cable/machine compound shows load, not a bogus e1RM
  const mc=[sessM(1,[inst('machine-chest-press','machine',[set(120,10)])],now)];
  assert.equal(A.personalRecords(mc,0)[0].showEst,false);
});

test('mode-less history is unchanged (single derived mode per id)',()=>{
  const now=Date.now();
  const hist=[session(2,[['barbell-bench-press',[set(135,8),set(135,8)]]],{now})];
  // no explicit modes anywhere → suggestion identical whether or not a mode is requested
  const a=P.suggestion(hist,'barbell-bench-press',{unit:'lb'});
  const b=P.suggestion(hist,'barbell-bench-press',{unit:'lb',mode:'barbell'});
  assert.deepEqual(a.next,b.next);
});
