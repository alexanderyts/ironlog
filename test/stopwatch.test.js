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
