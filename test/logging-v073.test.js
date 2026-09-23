// v0.73.0 — batch 4 "logging polish" (night review 2026-09-23): the between-sets loop, driven through
// the real screens.
const test=require('node:test'),assert=require('node:assert/strict');
const {IL,session,set,history,NOW}=require('./load.js');
const {launch}=require('./ui-harness.js');
const DAY=86400000;
const click=(h,el)=>el.dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));
function start(h,ids){h.click('[data-action="startFlow"]');h.click('[data-action="blank"]');
  ids.forEach(id=>{h.click('#btnAddEx');h.click(h.$$('#addResults [data-quickadd]').find(x=>x.dataset.quickadd===id));});}
const card=(h,i)=>h.$$('#view .log-ex')[i||0];
const inp=(h,f,s,ei)=>h.$(`input[data-f="${f}"][data-ei="${ei||0}"][data-s="${s}"]`);
function prev(h,id,sets,daysAgo,extra){h.S.upsertSession(Object.assign({id:'p'+Math.random().toString(36).slice(2,6),schema:1,date:Date.now()-(daysAgo||3)*DAY,updatedAt:1,completed:true,exercises:[{id,sets}]},extra||{}),false);}

test('typing reps on set 1 does NOT change the other sets; weight still follows',()=>{
  const h=launch();
  try{
    prev(h,'barbell-row',[{w:135,r:10,done:true},{w:135,r:10,done:true},{w:135,r:10,done:true}]);
    start(h,['barbell-row']);
    h.type(inp(h,'r',0),'8');
    assert.deepEqual(h.state.active.exercises[0].sets.map(s=>+s.r),[8,10,10],'reps stay put');
    h.type(inp(h,'w',0),'145');
    assert.deepEqual(h.state.active.exercises[0].sets.map(s=>+s.w),[145,145,145],'weight copies down');
  }finally{h.teardown();}
});
test('stopwatch: Stop logs the hold AND starts the rest; ticking another set mid-hold doesn’t kill the hold',()=>{
  const h=launch({fakeClock:true});
  try{
    start(h,['plank','barbell-bench-press']);
    click(h,h.$('#view [data-stopwatch]'));h.clock.tick(5500);
    // tick a bench set while the plank hold runs
    const b=h.state.active.exercises.findIndex(e=>e.id==='barbell-bench-press');
    h.type(inp(h,'w',0,b),'135');h.type(inp(h,'r',0,b),'5');
    click(h,h.$$('#view .log-ex')[b].querySelector('[data-check]'));
    assert.ok(h.$('#swbar').classList.contains('run'),'the hold is still running');
    h.clock.tick(20000);h.click('#swStop');
    assert.ok(h.state.active.exercises.find(e=>e.id==='plank').sets.some(s=>s.done&&+s.r>=20),'hold logged');
    assert.ok(h.$('#restbar').classList.contains('on'),'rest started after the hold');
  }finally{h.teardown();}
});
test('warm-ups: "+ Warm-up" adds a ~50% row on top, and next time it comes back',()=>{
  const h=launch();
  try{
    prev(h,'barbell-bench-press',[{w:185,r:5,done:true},{w:185,r:5,done:true}]);
    start(h,['barbell-bench-press']);
    click(h,card(h).querySelector('[data-addwarm]'));
    const s=h.state.active.exercises[0].sets;
    assert.ok(s[0].warm,'warm-up on top');assert.equal(+s[0].w,95,'~50% of 185 on the 5 lb step');
    assert.equal(s.filter(x=>!x.warm).length,2,'no working set lost');
    // log it and finish; the next workout prefills the warm-up
    s.forEach(x=>{x.done=true;});h.IL.ui.render();
    h.click(h.$$('button').find(x=>x.textContent.trim()==='Finish'));h.click('#sumDone');
    const next=h.IL.builder.seedExercise('barbell-bench-press',h.state.sessions,{unit:'lb'});
    assert.ok(next.sets[0].warm&&+next.sets[0].w===95,'remembered');
  }finally{h.teardown();}
});
test('Add exercise shows YOUR exercises first',()=>{
  const h=launch();
  try{
    prev(h,'pec-deck',[{w:100,r:12,done:true}]);prev(h,'leg-press',[{w:200,r:10,done:true}],5);
    start(h,[]);h.click('#btnAddEx');
    const ids=h.$$('#addResults [data-quickadd]').slice(0,2).map(x=>x.dataset.quickadd);
    assert.deepEqual(ids.sort(),['leg-press','pec-deck']);
    assert.match(h.text('#addResults'),/^Your exercises/);
    // CONTROL: searching still searches everything
    h.type('#addSearch','curl');assert.doesNotMatch(h.text('#addResults'),/Your exercises/);
  }finally{h.teardown();}
});
test('editing an old workout: a newly ticked set is timed within that workout, and added lifts prefill from before it',()=>{
  const h=launch();
  try{
    const old=Date.now()-10*DAY;
    h.S.upsertSession({id:'old',schema:1,date:old,updatedAt:1,completed:true,exercises:[{id:'barbell-row',sets:[{w:135,r:8,done:true,at:old+60000}]}]},false);
    prev(h,'barbell-curl',[{w:95,r:8,done:true}],2);   // NEWER than the old workout
    prev(h,'barbell-curl',[{w:65,r:8,done:true}],15);  // before it
    h.click('.tab[data-tab="history"]');h.click('[data-sess="old"]');
    h.click(h.$$('#sheetBody button').find(b=>/edit/i.test(b.textContent)));
    h.click('#btnAddEx');h.click(h.$$('#addResults [data-quickadd]').find(x=>x.dataset.quickadd==='barbell-curl'));
    const curl=[...h.$$('#view .log-ex')].findIndex(c=>/Barbell Curl/.test(c.textContent));
    assert.ok(curl>=0);
    const w=+h.$(`input[data-f="w"][data-ei="${curl}"][data-s="0"]`).value;
    assert.ok(w<95,'prefilled from BEFORE the old workout ('+w+'), not the newer 95');
    click(h,h.$$('#view .log-ex')[curl].querySelector('[data-check]'));
    h.click('#btnSaveEdit');
    const saved=h.state.sessions.find(s=>s.id==='old'),st=saved.exercises.find(e=>e.id==='barbell-curl').sets[0];
    assert.ok(st.done&&st.at>old&&st.at<old+DAY,'ticked inside that old workout, not today ('+new Date(st.at).toISOString()+')');
  }finally{h.teardown();}
});
test('the plate loader opens at the next set to load, and Done after Finish goes Home',()=>{
  const h=launch();
  try{
    prev(h,'barbell-bench-press',[{w:135,r:5,done:true},{w:155,r:5,done:true},{w:185,r:5,done:true}]);
    start(h,['barbell-bench-press']);
    click(h,card(h).querySelector('[data-plates]'));
    assert.match(h.$('#plWeight').value,/^135$/,'set 1, not the 185 top set');
    h.click('#sheetClose');
    const s=h.state.active.exercises[0].sets;s[0].done=true;h.IL.ui.render();
    h.click(h.$$('button').find(x=>x.textContent.trim()==='Finish'));h.click('#sumDone');
    assert.equal(h.$('.tab.active').dataset.tab,'today','back on Home');
  }finally{h.teardown();}
});
test('forgot to tick the last set: the summary offers to add it (nothing is saved without asking)',()=>{
  const h=launch();
  try{
    prev(h,'barbell-row',[{w:135,r:8,done:true},{w:135,r:8,done:true},{w:135,r:8,done:true}]);
    start(h,['barbell-row']);
    const s=h.state.active.exercises[0].sets;s[0].done=true;s[1].done=true;h.IL.ui.render();   // 3rd forgotten
    const id=h.state.active.id;
    h.click(h.$$('button').find(x=>x.textContent.trim()==='Finish'));
    assert.equal(h.state.sessions.find(x=>x.id===id).exercises[0].sets.length,2,'only ticked sets saved');
    assert.match(h.text('#sheetBody'),/1 planned set wasn’t ticked/);
    h.click('#sumAddLeft');
    assert.equal(h.state.sessions.find(x=>x.id===id).exercises[0].sets.length,3,'added on request');
  }finally{h.teardown();}
});
test('set numbers count working sets only: W, 1, 2, 3 (live editor and History)',()=>{
  const h=launch();
  try{
    prev(h,'barbell-bench-press',[{w:95,r:8,done:true,warm:true},{w:185,r:5,done:true},{w:185,r:5,done:true},{w:185,r:5,done:true}]);
    start(h,['barbell-bench-press']);
    assert.equal(h.$$('#view .log-ex .set-no').map(b=>b.textContent.trim()).join(','),'W,1,2,3');
    h.click('.tab[data-tab="history"]');h.click(h.$$('[data-sess]')[0]);
    assert.equal(h.$$('#sheetBody .set-no').map(b=>b.textContent.trim()).join(','),'W,1,2,3');
  }finally{h.teardown();}
});
