// v0.70.0 — the app suggests, never applies (owner's decisions after the night review):
//   • an increase is a one-tap "Try", never pre-filled; after 10+ days away there's no offer at all
//   • "same lifts" means the same lifts: a stalled lift's swap and a gap-filling add are OFFERS
//   • the strength goal uses a 2-rep window (see builder-safety.test.js)
const test=require('node:test'),assert=require('node:assert/strict');
const {IL,session,set,history,NOW}=require('./load.js');
const {launch}=require('./ui-harness.js');
const P=IL.prog,B=IL.builder,EX=IL.data.EX,DAY=86400000;

/* ---- engine ---- */
test('offer: when last time earned a bump, the rows repeat last time and the increase is offered',()=>{
  const h=history(session(3,[['barbell-bench-press',[set(135,8),set(135,8)]]],{now:NOW}));
  assert.deepEqual(B.seedExercise('barbell-bench-press',h,{unit:'lb',push:'offer'}).sets.map(s=>s.w),[135,135],'rows = last time');
  const sg=P.suggestion(h,'barbell-bench-press',{unit:'lb',push:'offer',activeDate:NOW});
  assert.equal(sg.kind,'try');assert.equal(sg.tryLabel,'140lb');
  assert.ok(sg.tryNext.every(s=>s.w===140),'the Try applies 140');
  // CONTROL: the engine's old behaviour is unchanged without push (the builder audit and older tests)
  assert.deepEqual(B.seedExercise('barbell-bench-press',h,{unit:'lb'}).sets.map(s=>s.w),[140,140]);
});
test('offer CONTROL: no bump due → the usual prescription (and no Try)',()=>{
  const h=history(session(3,[['barbell-bench-press',[set(135,6),set(135,6)]]],{now:NOW}));
  const sg=P.suggestion(h,'barbell-bench-press',{unit:'lb',push:'offer',activeDate:NOW});
  assert.notEqual(sg.kind,'try');
  assert.ok(B.seedExercise('barbell-bench-press',h,{unit:'lb',push:'offer'}).sets.every(s=>s.w===135));
});
test('back after 10+ days: "Welcome back — same as last time", no offer',()=>{
  const h=history(session(12,[['barbell-bench-press',[set(135,8),set(135,8)]]],{now:NOW}));
  const sg=P.suggestion(h,'barbell-bench-press',{unit:'lb',push:'offer',activeDate:NOW});
  assert.equal(sg.kind,'match');assert.match(sg.text,/Welcome back/);
});
test('assist machines are offered LESS assist, in those words',()=>{
  const h=history(session(3,[['assisted-pull-up',[set(40,12),set(40,12)]]],{now:NOW}));
  const sg=P.suggestion(h,'assisted-pull-up',{unit:'lb',push:'offer',activeDate:NOW});
  assert.equal(sg.kind,'try');assert.match(sg.tryLabel,/lb assist$/);assert.match(sg.text,/less assist/);
});
function stalledPecDeck(){const s=r=>r.map(x=>set(100,x));
  return history(...[22,15,8,1].map(d=>session(d,[['pec-deck',s([12,12,12])],['barbell-bench-press',[set(135+(22-d),8)]]],{now:NOW})));}
test('offerOnly: a stalled lift stays in the workout, and the swap is returned as an offer',()=>{
  const h=stalledPecDeck();
  const p=B.planWorkout(['Chest'],h,1,{now:NOW,offerOnly:true});
  assert.ok(p.ids.includes('pec-deck'),'pec deck kept');
  assert.equal(p.offers.length,1);assert.equal(p.offers[0].type,'swap');assert.equal(p.offers[0].from,'pec-deck');
  assert.equal(p.rotation,null,'nothing swapped');
  // CONTROL: without offerOnly the builder still makes the change (audited behaviour)
  assert.ok(!B.planWorkout(['Chest'],h,1,{now:NOW}).ids.includes('pec-deck'));
});

/* ---- screens ---- */
function load(h,sess){h.state.sessions=JSON.parse(JSON.stringify(sess)).sort((a,b)=>b.date-a.date);}
const hist=days=>[{id:'b1',schema:1,date:Date.now()-days*DAY,updatedAt:Date.now(),completed:true,exercises:[{id:'barbell-bench-press',sets:[{w:135,r:8,done:true},{w:135,r:8,done:true},{w:135,r:8,done:true}]}]}];
function startBench(h){h.click('[data-action="startFlow"]');h.click('[data-action="blank"]');
  h.click('#btnAddEx');h.click(h.$$('#addResults [data-quickadd]').find(x=>x.dataset.quickadd==='barbell-bench-press'));}
test('UI: rows show last time; "Try 140lb" applies it to the sets not yet ticked; "Back to last time" undoes',()=>{
  const h=launch();
  try{
    load(h,hist(3));startBench(h);
    const ws=()=>h.state.active.exercises[0].sets.map(s=>+s.w);
    assert.deepEqual(ws(),[135,135,135],'prefilled with last time, not +5');
    const t=h.$('#view [data-tryw]');assert.ok(t,'Try button shown');assert.match(t.textContent,/Try 140lb/);
    // tick set 1 at 135 first — Try must not change a done set
    h.$('#view [data-check]').dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));
    h.click('#view [data-tryw]');
    assert.deepEqual(ws(),[135,140,140],'only the unticked sets move');
    assert.match(h.text('#view'),/Going for 140lb/);
    h.click('#view [data-keepw]');
    assert.deepEqual(ws(),[135,135,135],'back to last time');
    assert.ok(h.state.active.exercises[0].sets[0].done,'the ticked set stays ticked');
  }finally{h.teardown();}
});
test('UI: after two weeks away, bench says "Welcome back — same as last time" with no Try',()=>{
  const h=launch();
  try{load(h,hist(14));startBench(h);
    assert.match(h.text('#view'),/Welcome back — same as last time/);assert.equal(h.$('#view [data-tryw]'),null);
  }finally{h.teardown();}
});
test('UI: "Just record" profile → no Try at all',()=>{
  const h=launch();
  try{load(h,hist(3));h.state.settings.profile={push:'quiet'};startBench(h);
    assert.equal(h.$('#view [data-tryw]'),null);assert.deepEqual(h.state.active.exercises[0].sets.map(s=>+s.w),[135,135,135]);
  }finally{h.teardown();}
});
test('UI: a stalled lift gets a Swap/Keep card; Keep is remembered for the next build',()=>{
  const h=launch();
  try{
    const now=Date.now(),mk=(d,w)=>({id:'s'+d,schema:1,date:now-d*DAY,updatedAt:now,completed:true,exercises:[{id:'pec-deck',sets:[{w:100,r:12,done:true},{w:100,r:12,done:true},{w:100,r:12,done:true}]},{id:'barbell-bench-press',sets:[{w,r:8,done:true}]}]});
    load(h,[mk(22,135),mk(15,140),mk(8,145),mk(1,150)]);
    const build=()=>{h.click('[data-action="startFlow"]');h.click(h.$$('[data-g]').find(b=>b.dataset.g==='Chest'));h.click('[data-action="build"]');};
    build();
    const ids=()=>h.state.active.exercises.map(e=>e.id);
    assert.ok(ids().includes('pec-deck'),'pec deck is still in the workout');
    assert.ok(h.$('#view [data-offerswap]'),'a Swap offer is shown');
    h.click('#view [data-offerkeep]');
    assert.equal(h.$('#view [data-offerswap]'),null,'Keep dismisses it');
    const keepKey=Object.keys(h.state.settings.seen||{}).find(k=>k.startsWith('keep:pec-deck:'));assert.ok(keepKey,'and remembers it');
    // the next build (same week) doesn't offer it again
    h.state.active=null;h.IL.ui.setTab('today');build();
    assert.ok(ids().includes('pec-deck'));assert.equal(h.$('#view [data-offerswap]'),null,'not offered again after Keep');
  }finally{h.teardown();}
});
test('UI: Swap replaces the lift in place, and nothing screen-only is saved at Finish',()=>{
  const h=launch();
  try{
    const now=Date.now(),mk=(d,w)=>({id:'s'+d,schema:1,date:now-d*DAY,updatedAt:now,completed:true,exercises:[{id:'pec-deck',sets:[{w:100,r:12,done:true},{w:100,r:12,done:true},{w:100,r:12,done:true}]},{id:'barbell-bench-press',sets:[{w,r:8,done:true}]}]});
    load(h,[mk(22,135),mk(15,140),mk(8,145),mk(1,150)]);
    h.click('[data-action="startFlow"]');h.click(h.$$('[data-g]').find(b=>b.dataset.g==='Chest'));h.click('[data-action="build"]');
    const at=h.state.active.exercises.findIndex(e=>e.id==='pec-deck');
    h.click('#view [data-offerswap]');
    assert.ok(!h.state.active.exercises.some(e=>e.id==='pec-deck'),'swapped');
    assert.ok(h.state.active.exercises[at]&&h.state.active.exercises[at].id!=='barbell-bench-press','in the same spot');
    const b=h.state.active.exercises.find(e=>e.id==='barbell-bench-press');b.tried=true;b.sets[0].w=150;b.sets[0].r=8;b.sets[0].done=true;
    h.click(h.$$('button').find(x=>x.textContent.trim()==='Finish'));
    const saved=h.state.sessions[0];
    assert.ok(!saved.offers&&saved.exercises.every(e=>!('tried' in e)&&!('offer' in e)),'no screen-only flags in history');
  }finally{h.teardown();}
});
