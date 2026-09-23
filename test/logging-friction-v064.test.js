// v0.64.0 — logging friction (full review §5): copy-down, the ⋯ menu (replace in place, move up/down),
// and per-exercise machine setup + weight step.
const test=require('node:test'),assert=require('node:assert');
const {IL,session,set,history,NOW}=require('./load.js');
const {launch}=require('./ui-harness.js');
const P=IL.prog,B=IL.builder,{EX}=IL.data;

function startWith(h,ids){h.click('[data-action="startFlow"]');h.click('[data-action="blank"]');
  ids.forEach(id=>{h.click('#btnAddEx');h.click(h.$$('#addResults [data-quickadd]').find(x=>x.dataset.quickadd===id));});}
const cardOf=(h,id)=>h.$$('#view .log-ex')[h.state.active.exercises.findIndex(e=>e.id===id)];

/* ---- 5.1 copy-down ---- */
test('5.1: changing a set’s weight carries down to the sets that matched it',()=>{
  const h=launch();
  try{
    startWith(h,['leg-press']);
    const sets=()=>h.state.active.exercises[0].sets;
    h.type(cardOf(h,'leg-press').querySelector('input[data-f="w"][data-s="0"]'),'135');
    assert.deepEqual(sets().map(s=>+s.w||0),sets().map(()=>135),'blank first-time sets all fill in');
    assert.equal(cardOf(h,'leg-press').querySelector('input[data-f="w"][data-s="1"]').value,'135','and the boxes show it (no re-render needed)');
    assert.ok(!sets()[1].t,'followers are not marked as hand-edited');
  }finally{h.teardown();}
});
test('5.1: a ticked, hand-edited or different set is left alone (a ramp keeps its shape)',()=>{
  const h=launch();
  try{
    startWith(h,['leg-press']);
    const s=h.state.active.exercises[0].sets;
    s[0].w=80;s[1].w=90;s[2].w=100;if(s[3])s[3].w=100;h.IL.ui.render();
    h.type(cardOf(h,'leg-press').querySelector('input[data-f="w"][data-s="0"]'),'85');
    assert.equal(+s[1].w,90,'the 90 set did not match the old 80, so it stays');
    assert.equal(+s[2].w,100,'the top set stays');
    // ticked sets never change
    s[1].done=true;s[1].w=100;s[2].w=100;h.IL.ui.render();
    h.type(cardOf(h,'leg-press').querySelector('input[data-f="w"][data-s="0"]'),'100');   // make set 0 match first
    h.type(cardOf(h,'leg-press').querySelector('input[data-f="w"][data-s="0"]'),'110');
    assert.equal(+s[1].w,100,'a ticked set is never overwritten');
    assert.equal(+s[2].w,110,'an unticked matching set follows');
  }finally{h.teardown();}
});
test('5.1: the ± buttons carry down too',()=>{
  const h=launch();
  try{
    startWith(h,['leg-press']);
    h.type(cardOf(h,'leg-press').querySelector('input[data-f="w"][data-s="0"]'),'100');
    cardOf(h,'leg-press').querySelector('[data-step="w"][data-d="1"][data-s="0"]').dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));
    const s=h.state.active.exercises[0].sets;
    assert.ok(s.every(x=>+x.w===+s[0].w)&&+s[0].w>100,'all sets moved together: '+s.map(x=>x.w));
  }finally{h.teardown();}
});

/* ---- ⋯ menu: move, replace, remove ---- */
test('⋯ menu: move up / move down reorders, and the menu follows the exercise',()=>{
  const h=launch();
  try{
    startWith(h,['leg-press','lateral-raise']);   // leg press slots first
    const ids=()=>h.state.active.exercises.map(e=>e.id);
    const first=ids()[0],second=ids()[1];
    cardOf(h,second).querySelector('[data-exmenu]').dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));
    h.click('#sheetBody [data-exact="up"]');
    assert.deepEqual(ids(),[second,first],'moved up');
    assert.ok(h.$('#sheetBody [data-exact="up"]').disabled,'menu reopened on its new (top) position — Move up now disabled');
  }finally{h.teardown();}
});
test('⋯ menu: Replace swaps in place (same spot), with the builder’s best swaps first',()=>{
  const h=launch();
  try{
    startWith(h,['leg-press','lying-leg-curl']);
    const before=h.state.active.exercises.map(e=>e.id),pos=before.indexOf('leg-press');
    cardOf(h,'leg-press').querySelector('[data-exmenu]').dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));
    h.click('#sheetBody [data-exact="replace"]');
    const best=h.$$('#sheetBody [data-replacewith]')[0];
    assert.ok(best,'swap options listed');
    assert.equal(EX[best.dataset.replacewith].group,'Quads','best swap is for the same muscle');
    const to=best.dataset.replacewith;best.dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));
    assert.equal(h.state.active.exercises[pos].id,to,'took the SAME position');
    assert.ok(!h.state.active.exercises.some(e=>e.id==='leg-press'),'the old one is gone');
  }finally{h.teardown();}
});
test('⋯ menu: Replace keeps the sets already logged and adds the new exercise below (v0.73: no confirm, nothing deleted)',()=>{
  const h=launch();
  try{
    startWith(h,['leg-press']);
    const ex=h.state.active.exercises[0];ex.sets[0].w=100;ex.sets[0].done=true;
    cardOf(h,'leg-press').querySelector('[data-exmenu]').dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));
    h.click('#sheetBody [data-exact="replace"]');
    h.$$('#sheetBody [data-replacewith]')[0].dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));
    assert.ok(!h.$('#cdialog').classList.contains('on'),'no confirm needed — nothing is lost');
    const ex0=h.state.active.exercises;
    assert.equal(ex0[0].id,'leg-press','the logged lift stays');assert.equal(ex0[0].sets.length,1,'with only its done set');assert.ok(ex0[0].sets[0].done);
    assert.notEqual(ex0[1].id,'leg-press','the replacement sits right below it');
    h.click('#toastAct');   // Undo
    assert.equal(h.state.active.exercises.length,1);assert.ok(h.state.active.exercises[0].sets.length>1,'undo restores the planned sets too');
  }finally{h.teardown();}
});
test('⋯ menu: Remove removes, with Undo',()=>{
  const h=launch();
  try{
    startWith(h,['leg-press','lateral-raise']);
    cardOf(h,'lateral-raise').querySelector('[data-exmenu]').dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));
    h.click('#sheetBody [data-exact="remove"]');
    assert.ok(!h.state.active.exercises.some(e=>e.id==='lateral-raise'),'removed');
    h.click('#toastAct');
    assert.ok(h.state.active.exercises.some(e=>e.id==='lateral-raise'),'undo brings it back');
  }finally{h.teardown();}
});

/* ---- 5.3 machine setup + weight step ---- */
test('5.3: a setup note is pinned on the card and a weight step is saved per exercise',()=>{
  const h=launch();
  try{
    startWith(h,['pec-deck']);
    cardOf(h,'pec-deck').querySelector('[data-exmenu]').dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));
    h.click('#sheetBody [data-exact="setup"]');
    h.$('#setupText').value='seat 4, pad 3';
    h.$$('#sheetBody [data-wstep]').find(b=>b.dataset.wstep==='10').dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));
    h.click('#setupSave');
    assert.equal(h.state.settings.setup['pec-deck'],'seat 4, pad 3');
    assert.equal(h.state.settings.steps['pec-deck'].lb,10);
    assert.match(cardOf(h,'pec-deck').textContent,/📌 seat 4, pad 3/,'pinned on the card');
    // the ± buttons now move by 10 on this machine
    h.type(cardOf(h,'pec-deck').querySelector('input[data-f="w"][data-s="0"]'),'100');
    cardOf(h,'pec-deck').querySelector('[data-step="w"][data-d="1"][data-s="0"]').dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));
    assert.equal(+h.state.active.exercises[0].sets[0].w,110,'100 → 110, not 102.5');
  }finally{h.teardown();}
});
test('5.3 engine: suggestions step by the machine’s real increment',()=>{
  P.setWeightSteps({'pec-deck':{lb:10}});
  try{
    const hist=history(session(3,[['pec-deck',[set(100,15),set(100,15)]]],{now:NOW}));
    const next=B.seedExercise('pec-deck',hist,{unit:'lb'}).sets.map(s=>s.w);
    assert.ok(next.every(w=>w%10===0),'no 102.5 — every suggested weight is on the 10 lb stack: '+next);
    assert.equal(P.unitIncrement('kg',EX['pec-deck']),1,'CONTROL: kg has its own (default) step');
  }finally{P.setWeightSteps({});}
});
test('5.3 sync: setup notes and steps survive backup/cloud cleaning; junk is dropped',()=>{
  const s=IL.sync.cleanSettings({steps:{'pec-deck':{lb:10,kg:'x'},'__proto__':{lb:5}},setup:{'pec-deck':'seat 4','leg-press':''}});
  assert.deepEqual(JSON.parse(JSON.stringify(s.steps)),{'pec-deck':{lb:10}});
  assert.deepEqual(JSON.parse(JSON.stringify(s.setup)),{'pec-deck':'seat 4'});
});
