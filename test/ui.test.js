// Automated UI flows in jsdom (Phase 0). These five were only ever verified by hand-driven browser
// scripts before; now they're real regression tests. Each asserts the OUTCOME (an oracle), not just
// that a click didn't throw.
const test=require('node:test'),assert=require('node:assert/strict');
const {launch,buildWorkout}=require('./ui-harness.js');

// A little history so a fresh build prefills real weights and findPlan can continue a plan.
function pushHistory(state,S){
  const now=Date.now();
  state.sessions=[3,10,17].map(d=>({id:'p'+d,schema:1,date:now-d*86400000,updatedAt:now-d*86400000,completed:true,
    exercises:[
      {id:'barbell-bench-press',name:'Bench',sets:[{w:135,r:6,done:true},{w:135,r:6,done:true},{w:135,r:6,done:true}]},
      {id:'overhead-press',name:'OHP',sets:[{w:95,r:8,done:true},{w:95,r:8,done:true}]},
      {id:'tricep-pushdown',name:'Pushdown',sets:[{w:50,r:12,done:true},{w:50,r:12,done:true}]}
    ]}));
}

test('UI: finishing saves ONLY the checked-off sets (the phantom-set regression)',()=>{
  const h=launch();
  try{
    buildWorkout(h,['Chest']);
    const active=h.state.active;
    const prefilled=active.exercises.reduce((n,e)=>n+e.sets.length,0);
    assert.ok(prefilled>=4,'a fresh chest build has several prefilled sets ('+prefilled+')');
    h.click(h.$$('[data-check]')[0]);                          // tick exactly one set
    assert.equal(active.exercises.reduce((n,e)=>n+e.sets.filter(s=>s.done).length,0),1,'one set checked');
    h.click('#btnFinish');
    assert.equal(h.state.active,null,'workout finished');
    const saved=h.state.sessions.filter(s=>s.id===active.id)[0];
    assert.ok(saved,'the session was saved');
    assert.equal(saved.exercises.reduce((n,e)=>n+e.sets.length,0),1,'exactly one set saved, not every prefilled one');
  }finally{h.teardown();}
});

test('UI: editing a set without checking it prompts, and "Leave out" drops it',()=>{
  const h=launch();
  try{
    buildWorkout(h,['Chest']);
    const active=h.state.active;
    h.click(h.$$('[data-check]')[0]);                          // one real done set (Finish needs it enabled)
    h.type(h.$$('input[data-f="w"]')[1],'150');               // edit a different set, leave it unchecked
    assert.equal(active.exercises[0].sets[1].t,1,'edited set flagged touched');
    h.click('#btnFinish');
    assert.ok(h.bodyText().includes('Unchecked sets'),'prompt shown for the edited-but-unchecked set');
    h.click('#finLeaveOut');
    const saved=h.state.sessions.filter(s=>s.id===active.id)[0];
    assert.equal(saved.exercises.reduce((n,e)=>n+e.sets.length,0),1,'left-out set not saved');
  }finally{h.teardown();}
});

test('UI: "Save them as done" keeps the edited-but-unchecked sets',()=>{
  const h=launch();
  try{
    buildWorkout(h,['Chest']);
    const active=h.state.active;
    h.click(h.$$('[data-check]')[0]);
    h.type(h.$$('input[data-f="w"]')[1],'150');
    h.click('#btnFinish');
    h.click('#finSaveAll');
    const saved=h.state.sessions.filter(s=>s.id===active.id)[0];
    assert.equal(saved.exercises[0].sets.length,2,'both the checked and the saved-as-done set are kept');
    assert.ok(saved.exercises[0].sets.every(s=>s.done),'both marked done');
  }finally{h.teardown();}
});

test('UI: a comma decimal is read as a decimal, not multiplied',()=>{
  const h=launch();
  try{
    buildWorkout(h,['Chest']);
    const inp=h.$$('input[data-f="w"]')[0];
    h.type(inp,'12,5');
    assert.equal(inp.value,'12.5','reflected back as 12.5');
    assert.equal(h.state.active.exercises[0].sets[0].w,12.5,'stored as 12.5, not 125');
  }finally{h.teardown();}
});

test('UI: with a plan, toggling deload builds the same exercises lighter (no "Session N")',()=>{
  const h=launch();
  try{
    pushHistory(h.state,h.S);
    h.IL.ui.render();
    h.click('[data-action="startFlow"]');
    ['Chest','Shoulders','Triceps'].forEach(g=>h.click(h.$$('[data-g]').find(b=>b.dataset.g===g)));
    assert.ok(h.text('#btnRecommend').includes('Continue'),'normal label is Continue your plan');
    h.click('[data-action="deloadToggle"]');
    assert.ok(h.text('#btnRecommend').includes('Deload this plan'),'deload label, no "Session N"');
    h.click('[data-action="build"]');
    const a=h.state.active;
    assert.equal(a.deload,true,'built as a deload');
    const bench=a.exercises.find(e=>e.id==='barbell-bench-press');
    assert.ok(bench,'same plan: bench is present, not swapped out');
    assert.ok(bench.sets[0].w>0&&bench.sets[0].w<135,'lighter than the 135 working load ('+bench.sets[0].w+')');
    assert.ok(bench.sets.length<=3,'deload caps sets ('+bench.sets.length+')');
  }finally{h.teardown();}
});

test('UI: T1 — checking a set stamps it, unchecking clears it, finishing records the end time',()=>{
  const h=launch();
  try{
    buildWorkout(h,['Chest']);
    const active=h.state.active,start=active.date;
    assert.ok(h.has('#elapsedLbl'),'editor header shows the elapsed span');
    assert.equal(h.text('#elapsedLbl'),'just started');
    h.click(h.$$('[data-check]')[0]);
    assert.ok(active.exercises[0].sets[0].at>=start,'checking stamps `at`');
    h.click(h.$$('[data-check]')[0]);
    assert.ok(!('at'in active.exercises[0].sets[0]),'unchecking clears `at`');
    h.click(h.$$('[data-check]')[0]);               // re-check, then finish
    h.click('#btnFinish');
    const saved=h.state.sessions.filter(s=>s.id===active.id)[0];
    assert.ok('endedAt'in saved && saved.endedAt>=start,'finish records endedAt');
    assert.ok(saved.exercises[0].sets[0].at,'the saved set keeps its timestamp');
  }finally{h.teardown();}
});

// ── Phase U1: controls & input usability ─────────────────────────────────────────────────────────
const wait=ms=>new Promise(r=>setTimeout(r,ms));

test('UI: tapping a number selects it, so typing replaces the old value (Phase U1)',async()=>{
  const h=launch();
  try{
    pushHistory(h.state,h.S);h.IL.ui.render();buildWorkout(h,['Chest']);
    const inp=h.$$('input[data-f="w"]')[0];
    assert.ok(inp.value.length>0,'prefilled weight present: '+inp.value);
    inp.focus();await wait(5);   // the iOS-safe range set is deferred
    assert.equal(inp.selectionStart,0);assert.equal(inp.selectionEnd,inp.value.length,'whole value selected on focus');
    // control: the value itself is untouched by focusing (nothing is cleared until the user types)
    assert.equal(h.state.active.exercises[0].sets[0].w,+inp.value);
  }finally{h.teardown();}
});

test('UI: Enter moves weight → reps → next set → done (Phase U1)',()=>{
  const h=launch();
  try{
    pushHistory(h.state,h.S);h.IL.ui.render();buildWorkout(h,['Chest']);
    const enter=el=>el.dispatchEvent(new h.win.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
    const w0=h.$('input[data-f="w"][data-ei="0"][data-s="0"]');w0.focus();
    enter(w0);assert.equal(h.doc.activeElement,h.$('input[data-f="r"][data-ei="0"][data-s="0"]'),'weight → reps');
    enter(h.doc.activeElement);assert.equal(h.doc.activeElement,h.$('input[data-f="w"][data-ei="0"][data-s="1"]'),'reps → next set\'s weight');
    const last=h.$$('input[data-f="r"][data-ei="0"]').pop();last.focus();enter(last);
    assert.notEqual(h.doc.activeElement,last,'Enter on the last reps field blurs');
  }finally{h.teardown();}
});

test('UI: one tap on + is exactly one increment; a hold repeats and adds nothing extra on release (Phase U1)',async()=>{
  const h=launch();
  try{
    pushHistory(h.state,h.S);h.IL.ui.render();buildWorkout(h,['Chest']);
    const set0=()=>h.state.active.exercises[0].sets[0];
    const plus=()=>h.$('[data-step="w"][data-d="1"][data-ei="0"][data-s="0"]');
    const start=set0().w;
    h.click(plus());
    assert.equal(set0().w,start+5,'one tap = +5 lb');
    // hold: pointerdown, wait past the delay + two repeats, then release like a browser does (pointerup, then click)
    const ev=n=>new h.win.Event(n,{bubbles:true});
    plus().dispatchEvent(ev('pointerdown'));
    await wait(650);                                  // 400 delay + repeats at 510, 620 → 2 steps
    const afterHold=set0().w;
    assert.ok(afterHold>=start+5+10,'hold repeated at least twice ('+afterHold+')');
    h.doc.dispatchEvent(ev('pointerup'));plus().dispatchEvent(ev('click'));
    const afterRelease=set0().w;
    assert.equal(afterRelease,afterHold,'the trailing click after a hold adds nothing');
    await wait(250);
    assert.equal(set0().w,afterRelease,'and it stopped repeating');
  }finally{h.teardown();}
});

test('UI: a preset selects its muscle groups and re-tapping clears them',()=>{
  const h=launch();
  try{
    h.click('[data-action="startFlow"]');
    const push=h.$$('[data-preset]').find(b=>b.dataset.preset==='Push');
    h.click(push);
    assert.deepEqual(h.$$('#groupPick .chip.on').map(b=>b.dataset.g).sort(),['Chest','Shoulders','Triceps'],'Push selects its three groups');
    h.click(h.$$('[data-preset]').find(b=>b.dataset.preset==='Push'));
    assert.equal(h.$$('#groupPick .chip.on').length,0,'re-tapping Push clears the selection');
  }finally{h.teardown();}
});
