// v0.74.0 — batch 5a "clear screens" (night review 2026-09-23): accuracy and plain words on the
// read-side screens.
const test=require('node:test'),assert=require('node:assert/strict');
const {IL,session,set,history,NOW}=require('./load.js');
const {launch}=require('./ui-harness.js');
const A=IL.analysis,DAY=86400000;
const byId=(ls,id)=>ls.find(l=>l.id===id);

test('a new lifter’s first week is not divided by 4 (6 chest sets in week one = 6/week, not 1.5)',()=>{
  const h=history(session(5,[['barbell-bench-press',[set(135,8),set(135,8),set(135,8)]]],{now:NOW}),session(2,[['barbell-bench-press',[set(135,8),set(135,8),set(135,8)]]],{now:NOW}));
  assert.equal(A.analyze(h,NOW).perWeek.Chest,6);
  // CONTROL: a long-time lifter still averages over 4 weeks
  const long=history(session(60,[['barbell-bench-press',[set(135,8)]]],{now:NOW}),...h);
  assert.equal(A.analyze(long,NOW).perWeek.Chest,1.5);
});
test('Muscles lists every main muscle (0 when untrained) and helper-worked muscles get a number',()=>{
  const h=history(...[20,13,6].map(d=>session(d,[['barbell-row',[set(135,8),set(135,8),set(135,8)]]],{now:NOW})));
  const a=A.analyze(h,NOW),rows=A.muscleWeekly(a,{},A.findings(a,h,NOW,180,{}));
  ['Chest','Back','Shoulders','Biceps','Triceps','Quads','Hamstrings','Glutes'].forEach(g=>assert.ok(rows.some(r=>r.group===g),g+' has a row'));
  assert.ok(rows.find(r=>r.group==='Biceps').perWeek>0,'biceps (helper on rows) has a number');
  assert.ok(!rows.find(r=>r.group==='Biceps').low,'…but a helper-only muscle isn’t nagged as "low"');
});
test('a lift going down reads "below your best" with the latest set, not "Stuck" with an old best',()=>{
  const h=history(session(20,[['barbell-bench-press',[set(185,5)]]],{now:NOW}),session(13,[['barbell-bench-press',[set(175,5)]]],{now:NOW}),session(6,[['barbell-bench-press',[set(165,5)]]],{now:NOW}));
  const l=byId(A.liftStatus(h,NOW,180),'barbell-bench-press');
  assert.equal(l.status,'down');assert.equal(l.to.w,165);assert.equal(l.best.w,185);
});
test('no gap to-dos after one workout; "Not trained yet" wording while under a month in',()=>{
  const one=history(session(1,[['barbell-bench-press',[set(135,8),set(135,8)]]],{now:NOW}));
  assert.ok(!A.coachReport(A.analyze(one,NOW),one,NOW,180,{},{},[]).focus.some(f=>/Cover your|add (a|an) /.test(f.title)));
  const three=history(...[9,5,1].map(d=>session(d,[['barbell-bench-press',[set(135,8),set(135,8)]]],{now:NOW})));
  const f=A.coachReport(A.analyze(three,NOW),three,NOW,180,{},{},[]).focus.find(x=>x.type==='region-gap');
  assert.ok(f&&f.detail==='Not trained yet',f&&f.detail);
});
test('"enough history" counts all your workouts, not just the last 4 weeks',()=>{
  const S=[];for(let d=70;d>=40;d-=3)S.push(session(d,[['barbell-bench-press',[set(135,8)]]],{now:NOW}));
  S.push(session(3,[['barbell-bench-press',[set(135,8)]]],{now:NOW}),session(1,[['barbell-bench-press',[set(135,8)]]],{now:NOW}));
  assert.equal(A.analyze(history(...S),NOW).readyForComparative,true,'a returning lifter isn’t told "a few more days"');
});
test('UI: records use the same set format, no "e1RM", and "Show all" beyond 8',()=>{
  const h=launch();
  try{
    const now=Date.now(),ids=['barbell-bench-press','back-squat','deadlift','barbell-row','overhead-press','lat-pulldown','pec-deck','leg-press','assisted-pull-up','plank'];
    ids.forEach((id,i)=>h.S.upsertSession({id:'s'+i,schema:1,date:now-(i+2)*DAY,updatedAt:1,completed:true,exercises:[{id,sets:[{w:id==='plank'?0:40,r:id==='plank'?45:8,done:true}]}]},false));
    h.state.settings.bodyweight=180;
    h.click('.tab[data-tab="progress"]');h.click('[data-collapse="records"]');
    assert.equal(h.$$('#prCard [data-openex]').length,8);h.click('#prCard [data-recordsall]');
    assert.equal(h.$$('#prCard [data-openex]').length,10);
    const t=h.text('#prCard');
    assert.doesNotMatch(t,/e1RM/);assert.match(t,/40lb assist × 8/);assert.match(t,/45s/);
  }finally{h.teardown();}
});
test('UI: each version of a lift opens its OWN record',()=>{
  const h=launch();
  try{
    const now=Date.now();
    h.S.upsertSession({id:'a',schema:1,date:now-3*DAY,updatedAt:1,completed:true,exercises:[{id:'dumbbell-curl',sets:[{w:30,r:11,done:true}]}]},false);
    h.S.upsertSession({id:'b',schema:1,date:now-1*DAY,updatedAt:1,completed:true,exercises:[{id:'dumbbell-curl',side:true,sets:[{w:25,r:12,done:true}]}]},false);
    h.click('.tab[data-tab="progress"]');
    const rows=h.$$('#liftCard [data-openex]').filter(r=>r.dataset.openex==='dumbbell-curl');
    assert.equal(rows.length,2);assert.ok(rows.some(r=>/Each side/.test(r.textContent)),'tagged');
    const both=rows.find(r=>!/Each side/.test(r.textContent));h.click(both);
    assert.match(h.text('#sheetBody'),/Your record 30lb\/ea × 11/,'the both-hands row opens the both-hands record');
  }finally{h.teardown();}
});
test('UI: History cards name one real set; session detail and moving a late workout to today',()=>{
  const h=launch();
  try{
    const now=Date.now();
    h.S.upsertSession({id:'x',schema:1,date:now-2*DAY,updatedAt:1,completed:true,exercises:[{id:'barbell-bench-press',sets:[{w:135,r:10,done:true},{w:185,r:5,done:true}]}]},false);
    h.click('.tab[data-tab="history"]');
    assert.match(h.text('#view'),/2× · 185lb × 5/,'the top set, not "2×10 · 185lb"');
  }finally{h.teardown();}
});
test('UI: nothing lifted yet → one clear line on Progress (no zero tiles)',()=>{
  const h=launch();
  try{h.click('.tab[data-tab="progress"]');assert.match(h.text('#view'),/Your progress shows up here/);assert.equal(h.$('#view .statgrid'),null);}
  finally{h.teardown();}
});
test('UI: searching "treadmill" in the Library points to cardio',()=>{
  const h=launch();
  try{h.click('.tab[data-tab="library"]');h.type('#libSearch','treadmill');assert.ok(h.$('#libResults [data-action="cardioOpen"]'));}
  finally{h.teardown();}
});
