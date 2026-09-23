// v0.72.0 — batch 3 "trustworthy suggestions" (night review 2026-09-23). Each fix has an oracle built
// from the reviewer's exact scenario, plus a control that the ordinary case is unchanged.
const test=require('node:test'),assert=require('node:assert/strict');
const {IL,session,set,history,NOW}=require('./load.js');
const {launch}=require('./ui-harness.js');
const P=IL.prog,B=IL.builder,A=IL.analysis,EX=IL.data.EX;
const byId=(ls,id)=>ls.find(l=>l.id===id);

test('"Stuck": reps added on the back sets at the same weight count as progress',()=>{
  const s=r=>r.map(x=>set(100,x));
  const h=history(...[[22,[15,13,12]],[15,[15,14,12]],[8,[15,14,13]],[1,[15,15,13]]].map(([d,r])=>session(d,[['pec-deck',s(r)]],{now:NOW})));
  assert.equal(B.isStalled(h,'pec-deck',{}),false,'15/13/12 → 15/15/13 is climbing');
  assert.notEqual(byId(A.liftStatus(h,NOW,180),'pec-deck').status,'stuck');
  // CONTROL: truly flat is still stuck
  const flat=history(...[22,15,8,1].map(d=>session(d,[['pec-deck',s([12,12,12])]],{now:NOW})));
  assert.equal(B.isStalled(flat,'pec-deck',{}),true);
});
test('timed carry: taking the suggested heavier weight (shorter hold) is progress, and the bump keeps most of the time',()=>{
  const h=history(session(22,[['farmers-carry',[set(50,40)]]],{now:NOW}),session(15,[['farmers-carry',[set(52.5,24)]]],{now:NOW}),
    session(8,[['farmers-carry',[set(52.5,27)]]],{now:NOW}),session(1,[['farmers-carry',[set(52.5,30)]]],{now:NOW}));
  assert.equal(B.isStalled(h,'farmers-carry',{}),false);
  const n=P.nextSets([{w:50,r:40},{w:50,r:40}],EX['farmers-carry'],'lb');
  assert.ok(n.bumped);assert.equal(n.sets[0].r,30,'mid-range (30 s), not 21 s');
});
test('assist machines: a back-off set loses at most one step of assist',()=>{
  assert.deepEqual(P.nextSets([{w:10,r:12},{w:40,r:8}],EX['assisted-pull-up'],'lb').sets.map(s=>s.w),[5,35]);
  assert.deepEqual(P.nextSets([{w:5,r:12},{w:20,r:8}],EX['assisted-pull-up'],'lb').sets.map(s=>s.w),[0,15],'never jumps to unassisted');
});
test('your machine step is respected: pec deck set to 15 lb goes 100 → 115, not 112.5',()=>{
  P.setWeightSteps({'pec-deck':{lb:15}});
  try{
    assert.deepEqual(P.nextSets([{w:100,r:15},{w:100,r:15}],EX['pec-deck'],'lb').sets.map(s=>s.w),[115,115]);
    // a stack that isn't a multiple of the step (25/40/55…) is followed, never rounded off it
    assert.equal(P.nextSets([{w:25,r:15}],EX['pec-deck'],'lb').sets[0].w,40,'25 → 40, not 45');
  }finally{P.setWeightSteps({});}
  // CONTROL: no step set → the usual half-step grid for a machine
  assert.equal(P.nextSets([{w:100,r:15}],EX['pec-deck'],'lb').sets[0].w,102.5);
});
test('barbell: an off-grid weight (after lb↔kg) snaps to whole plates, never 1.25 lb leftovers',()=>{
  const w=P.nextSets([{w:132.25,r:8},{w:132.25,r:8}],EX['barbell-bench-press'],'lb').sets[0].w;
  assert.equal(w%5,0,'on the 5 lb grid: '+w);
});
test('push-ups with no bodyweight set still show up in Your lifts (judged by reps)',()=>{
  const h=history(session(9,[['push-up',[set(0,12),set(0,10)]]],{now:NOW}),session(2,[['push-up',[set(0,15),set(0,14)]]],{now:NOW}));
  const l=byId(A.liftStatus(h,NOW,0),'push-up');
  assert.ok(l,'listed');assert.equal(l.kind,'reps');assert.ok(l.status==='up'||l.status==='pr');
  assert.equal(P.exerciseSeries(h,'push-up',{bw:0}).length,2,'and it has a trend');
});
test('balance: a machine chest day (press + pec deck) is not "add more pressing" against an equal back day',()=>{
  const S=[];for(let d=12;d>=0;d-=4)S.push(session(d,[['machine-chest-press',[set(100,10),set(100,10),set(100,10)]],['pec-deck',[set(80,12),set(80,12),set(80,12)]],
    ['lat-pulldown',[set(100,10),set(100,10),set(100,10)]],['seated-cable-row',[set(100,10),set(100,10),set(100,10)]]],{now:NOW}));
  const h=history(...S),a=A.analyze(h,NOW);
  assert.equal(Math.round(a.push),Math.round(a.pull),'push '+a.push+' vs pull '+a.pull);
  assert.ok(!A.findings(a,h,NOW,180,{}).some(f=>f.type==='balance'&&f.lv==='warn'));
});
test('wording: a per-set target, not missing reps summed across sets',()=>{
  const h=history(session(3,[['lateral-raise',[set(20,15),set(20,14),set(20,12)]]],{now:NOW}));
  const t=P.suggestion(h,'lateral-raise',{unit:'lb'}).text;
  assert.match(t,/^Reach 20 reps on every set to earn more weight$/,t);
  assert.doesNotMatch(t,/19 more/);
});
test('"Don’t count this" keeps next time’s set count',()=>{
  const h=history(session(3,[['barbell-bench-press',[Object.assign(set(120,3),{nc:true}),set(100,8),set(100,8)]]],{now:NOW}));
  const lp=P.lastPerf(h,'barbell-bench-press',{clean:true});
  assert.equal(lp.sets.length,3,'3 sets, not 2');assert.ok(lp.sets.every(s=>s.w<=100),'the disowned 120 never comes back');
});
test('a deload from unassisted (0) adds assist; two dumbbells count double on a both-sides row',()=>{
  assert.ok(P.deloadSets([{w:0,r:8}],EX['assisted-pull-up'],'lb')[0].w>0);
  assert.equal(P.holdsOf({id:'dumbbell-row',side:false}),2,'both sides at once = 2 dumbbells');
  assert.equal(P.holdsOf({id:'dumbbell-row'}),1,'CONTROL: the usual one-arm row is one dumbbell');
});
test('UI: with a 15 lb machine step, + follows the stack (25 → 40)',()=>{
  const h=launch();
  try{
    h.state.settings.steps={'pec-deck':{lb:15}};
    h.click('[data-action="startFlow"]');h.click('[data-action="blank"]');
    h.click('#btnAddEx');h.click(h.$$('#addResults [data-quickadd]').find(x=>x.dataset.quickadd==='pec-deck'));
    h.type('input[data-f="w"]','25');
    h.click('[data-step="w"][data-d="1"][data-ei="0"][data-s="0"]');
    assert.equal(+h.state.active.exercises[0].sets[0].w,40);
  }finally{h.teardown();}
});
