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
