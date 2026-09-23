// v0.50.0 stopwatch for time-held lifts. The engine-side contract that protects stopwatch data, the
// library additions, and the button wiring. The full countdown→hold→Stop flow is verified in-browser.
const {IL,session,set,history}=require('./load.js');
const test=require('node:test'),assert=require('node:assert');
const P=IL.prog,{EX,TIME_METRIC,META}=IL.data,SR=IL.search;

test('the five new time-held lifts exist, are flagged time-metric, and are searchable',()=>{
  ['dead-hang','wall-sit','side-plank','hollow-hold','suitcase-carry'].forEach(id=>{
    assert.ok(EX[id],'exercise exists: '+id);
    assert.ok(TIME_METRIC.has(id),'is time-metric: '+id);
    assert.ok(META[id],'has META (library integrity): '+id);
  });
  assert.equal(SR.searchEx('wall sit')[0].id,'wall-sit');
  assert.equal(SR.searchEx('dead hang')[0].id,'dead-hang');
});

test('finalizeSets keeps a time-held lift logged by seconds alone — load is optional',()=>{
  // this is what stops a stopwatch-logged carry (no weight entered) from being silently dropped on Finish
  const ex=[{id:'suitcase-carry',name:'Suitcase Carry',sets:[{w:'',r:40,done:true}]}];
  const out=P.finalizeSets(ex);
  assert.equal(out.length,1,'the carry survives');
  assert.equal(out[0].sets.length,1);
  assert.equal(out[0].sets[0].r,40);
});

test('CONTROL: a weightless NON-time loaded lift is still dropped (unchanged guard)',()=>{
  const out=P.finalizeSets([{id:'barbell-bench-press',name:'Bench',sets:[{w:'',r:8,done:true}]}]);
  assert.equal(out.length,0,'a weightless bench set is still junk and dropped');
});

test('a plank never contributes weight×reps volume even with a load field',()=>{
  const s=session(1,[['plank',[set(0,60)]]]);
  assert.equal(P.sessionVolume(s,200),0,'seconds are not volume');
  assert.equal(P.sessionSets(s),1,'but it still counts as a working set');
});

/* ---- UI wiring ---- */
const {launch}=require('./ui-harness.js');

test('UI: the ⏱ button shows on a time-held lift in an active workout, not on a normal lift',()=>{
  const h=launch();
  try{
    h.click('[data-action="startFlow"]');h.click('[data-action="blank"]');
    const add=id=>{h.click('#btnAddEx');h.click(h.$$('#addResults [data-quickadd]').find(x=>x.dataset.quickadd===id));};
    add('plank');add('barbell-bench-press');
    const cards=h.$$('#view .log-ex');
    const plankCard=cards.find(c=>/Plank/.test(c.textContent));
    const benchCard=cards.find(c=>/Bench/.test(c.textContent));
    assert.ok(plankCard.querySelector('[data-stopwatch]'),'plank card has a ⏱ button');
    assert.ok(!benchCard.querySelector('[data-stopwatch]'),'bench card does not');
  }finally{h.teardown();}
});

test('UI: tapping ⏱ opens the stopwatch bar in its countdown, mutually exclusive with rest',()=>{
  const h=launch();
  try{
    h.click('[data-action="startFlow"]');h.click('[data-action="blank"]');
    h.click('#btnAddEx');h.click(h.$$('#addResults [data-quickadd]').find(x=>x.dataset.quickadd==='plank'));
    h.click('#view [data-stopwatch]');
    assert.ok(h.$('#swbar').classList.contains('on'),'the stopwatch bar is shown');
    assert.equal(h.text('#swLbl'),'Get set','it starts in the get-set countdown');
    assert.ok(!h.$('#swbar').classList.contains('run'),'not yet running');
    assert.ok(!h.$('#restbar').classList.contains('on'),'the rest bar is not up at the same time');
  }finally{h.teardown();}
});

/* ---- U1 + U4: stopwatch targets the right exercise by identity, and skips warm-up sets ----
   These drive the REAL countdown (jsdom timers run in real time), so they wait ~6s each. */
function startBlank(h,ids){
  h.click('[data-action="startFlow"]');h.click('[data-action="blank"]');
  ids.forEach(id=>{h.click('#btnAddEx');h.click(h.$$('#addResults [data-quickadd]').find(x=>x.dataset.quickadd===id));});
}

test('U1: deleting an exercise mid-hold logs the seconds to the ORIGINAL lift, not the wrong one',()=>{
  const h=launch({fakeClock:true});
  try{
    startBlank(h,['barbell-bench-press','overhead-press','plank']);
    const plankCard=h.$$('#view .log-ex').find(c=>/Plank/.test(c.textContent));
    plankCard.querySelector('[data-stopwatch]').dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));
    h.clock.tick(5500);   // past the 5s countdown, into the hold (virtual clock: no real wait)
    // delete Bench (index 0) via its ⋯ menu → Remove — plank shifts from index 2 to 1
    h.$$('#view .log-ex').find(c=>/Bench/.test(c.textContent)).querySelector('[data-exmenu]').dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));
    h.click('#sheetBody [data-exact="remove"]');
    h.clock.tick(400);
    h.click('#swStop');
    const plank=h.state.active.exercises.find(e=>e.id==='plank');
    const ohp=h.state.active.exercises.find(e=>e.id==='overhead-press');
    const plankDone=plank.sets.find(s=>s.done&&+s.r>0);
    assert.ok(plankDone,'the plank got the logged seconds');
    assert.ok(!ohp.sets.some(s=>s.done),'the OHP (which shifted into the old index) did NOT');
  }finally{h.teardown();}
});

test('U4: the hold is written to the first WORKING set, skipping a leading warm-up',()=>{
  const h=launch({fakeClock:true});
  try{
    startBlank(h,['plank']);
    // mark set 1 a warm-up
    const warmBtn=h.$('#view [data-warm]');warmBtn.dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));
    h.$('#view [data-stopwatch]').dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));
    h.clock.tick(5500);
    h.click('#swStop');
    const plank=h.state.active.exercises.find(e=>e.id==='plank');
    assert.ok(plank.sets[0].warm,'set 1 stayed a warm-up');
    assert.ok(!(plank.sets[0].done&&+plank.sets[0].r>0),'the hold did NOT land in the warm-up set');
    assert.ok(plank.sets.some((s,i)=>i>0&&s.done&&+s.r>0),'it landed in a working set');
  }finally{h.teardown();}
});
