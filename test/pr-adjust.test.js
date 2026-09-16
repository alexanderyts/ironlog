// "That rep wasn't clean" — st.nc sets a record aside WITHOUT deleting the set.
// Oracle numbers come from the real 2026-09-16 backup: barbell row 75x12 / 90x12 / 110x10 on Sep 15,
// over a previous best of 100x10. Marking the 110 must revert the PR to 100x10 and move the next
// suggestion's anchor to 90x12 — while volume, history and rest data stay exactly as they were.
const {IL,session,set,history}=require('./load.js');
const test=require('node:test'), assert=require('node:assert');
const P=IL.prog, A=IL.analysis, B=IL.builder, SY=IL.sync;

const rows=(marked)=>history(
  session(1,[['barbell-row',[set(75,12),set(90,12),set(110,10,marked?{nc:true}:null)]]]),
  session(8,[['barbell-row',[set(100,10)]]])
);

test('marking the top set reverts the PR to the previous best and reports what was set aside',()=>{
  const before=A.personalRecords(rows(false),216,99).filter(p=>p.id==='barbell-row')[0];
  assert.equal(before.w,110);
  assert.equal(before.adjusted,undefined);   // nothing marked → no "PR adjusted" line

  const after=A.personalRecords(rows(true),216,99).filter(p=>p.id==='barbell-row')[0];
  assert.equal(after.w,100,'PR falls back to the previous best');
  assert.equal(after.r,10);
  assert.ok(after.adjusted,'the set-aside rep is remembered');
  assert.equal(after.adjusted.w,110);
  assert.equal(after.adjusted.r,10);
});

test('CONTROL: the marked set still counts for volume — it is set aside, not deleted',()=>{
  const plain=rows(false)[0], marked=rows(true)[0];
  const expected=75*12+90*12+110*10;   // 3,080 lb
  assert.equal(P.sessionVolume(plain,216),expected);
  assert.equal(P.sessionVolume(marked,216),expected,'volume must not change');
  assert.equal(P.sessionSets(marked),3,'it is still a working set');
  assert.equal(marked.exercises[0].sets.length,3,'the set is still in history');
});

test('CONTROL: marking an ordinary set adds no "PR adjusted" line',()=>{
  // mark the 75x12 — it was never the record, so there is nothing to report
  const h=history(
    session(1,[['barbell-row',[set(75,12,{nc:true}),set(90,12),set(110,10)]]]),
    session(8,[['barbell-row',[set(100,10)]]]));
  const p=A.personalRecords(h,216,99).filter(x=>x.id==='barbell-row')[0];
  assert.equal(p.w,110,'the real PR is untouched');
  assert.equal(p.adjusted,undefined);
});

test('the next suggestion anchors on the last CLEAN set, not the disowned one',()=>{
  const clean=P.suggestion(rows(false),'barbell-row',{unit:'lb'});
  const adj=P.suggestion(rows(true),'barbell-row',{unit:'lb'});
  assert.ok(clean.setsStr.indexOf('110')>=0,'unmarked: the 110 is the reference');
  assert.equal(adj.setsStr.indexOf('110'),-1,'marked: the 110 no longer anchors the suggestion');
  assert.ok(adj.setsStr.indexOf('90')>=0,'it falls back to the last clean set');
});

test('the builder does not prefill a set you disowned',()=>{
  // the hole the adversarial pass caught: filtering only in suggestion() left seedExercise alone
  const seeded=B.seedExercise('barbell-row',rows(true),{unit:'lb'});
  assert.ok(seeded.sets.every(s=>(+s.w||0)!==110),'110 must not come back as a prefilled weight');
  const control=B.seedExercise('barbell-row',rows(false),{unit:'lb'});
  assert.ok(control.sets.some(s=>(+s.w||0)>=110),'unmarked, the builder still progresses off the top set');
});

test('a session whose every working set is marked falls through to the one before',()=>{
  const h=history(
    session(1,[['barbell-row',[set(120,10,{nc:true}),set(115,10,{nc:true})]]]),
    session(8,[['barbell-row',[set(100,10)]]]));
  const lp=P.lastPerf(h,'barbell-row',{clean:true});
  assert.equal(lp.sets.length,1);
  assert.equal(lp.sets[0].w,100,'the older clean session becomes the reference');
  const all=P.lastPerf(h,'barbell-row',{});
  assert.equal(all.sets[0].w,120,'without `clean` the scan is unchanged (no behaviour drift)');
});

test('a disowned set is not a bar the live PR line has to clear',()=>{
  const h=rows(true);
  assert.equal(P.bestE1rmBefore(h,'barbell-row',{}),P.e1rm(100,10));
  assert.equal(P.bestE1rmBefore(rows(false),'barbell-row',{}),P.e1rm(110,10));
});

test('the trend keeps the point but stops letting a disowned rep define the line',()=>{
  const s=P.exerciseSeries(rows(true),'barbell-row',{});
  assert.equal(s.length,2,'both sessions still plot — history is never dropped');
  const latest=s[s.length-1];
  assert.equal(latest.w,90,'the clean set defines the point');
  assert.equal(latest.adj,true,'and it is flagged as adjusted');

  // every set marked: the point survives, flagged, rather than vanishing
  const only=P.exerciseSeries(history(
    session(1,[['barbell-row',[set(120,10,{nc:true})]]]),
    session(8,[['barbell-row',[set(100,10)]]])),'barbell-row',{});
  assert.equal(only.length,2);
  assert.equal(only[1].w,120);
  assert.equal(only[1].adj,true);
});

test('the mark survives a backup round-trip',()=>{
  // cleanSession is the trust boundary every import and cloud snapshot passes through: a field it
  // doesn't whitelist is silently dropped, so the flag would vanish on any export → import.
  const wire=JSON.parse(JSON.stringify(rows(true)[0]));
  const cleaned=SY.cleanSession(wire).exercises[0].sets;
  assert.equal(cleaned.length,3);
  assert.equal(cleaned[2].nc,true,'nc must be whitelisted in cleanSet or it is lost on import');
  assert.equal(cleaned[0].nc,undefined);
});

/* ---- UI wiring: the engine can be right while the buttons do nothing ---- */
const {launch}=require('./ui-harness.js');

test('UI: the exercise sheet adjusts a PR and puts it back',()=>{
  const h=launch();
  try{
    // same shape as the real history: a 110x10 top set over a previous best of 100x10
    rows(false).forEach(s=>h.S.upsertSession(JSON.parse(JSON.stringify(s)),false));
    h.state.settings.bodyweight=216;
    h.click('.tab[data-tab="progress"]');
    const row=h.$$('#prCard [data-openex]').find(r=>r.dataset.openex==='barbell-row');
    assert.ok(row,'barbell row has a PR row');
    h.click(row);
    assert.ok(h.text('#sheetBody').indexOf('110')>=0,'the sheet opens on the 110 record');

    h.click('#sheetBody [data-prmark]');
    const after=h.text('#sheetBody');
    assert.ok(after.indexOf('PR adjusted')>=0,'the sheet reports the adjustment');
    assert.ok(after.indexOf('100')>=0,'and shows the reverted best');
    assert.ok(h.text('#prCard').indexOf('PR adjusted')>=0,'the Progress list shows it too');

    h.click('#sheetBody [data-prunmark]');
    assert.equal(h.text('#sheetBody').indexOf('PR adjusted'),-1,'putting it back clears the marker');
    assert.ok(h.text('#prCard').indexOf('110')>=0,'and the 110 is the record again');
  }finally{h.teardown();}
});

test('UI: opening a sheet while a field has focus drops the keyboard first',()=>{
  // the "I tapped Add exercise and nothing happened" fix — a focused input must not survive into the
  // sheet, or iOS leaves the sheet parked below the visible area
  const h=launch();
  try{
    h.click('[data-action="startFlow"]');
    h.click('[data-action="blank"]');
    h.click('#btnAddEx');
    const pick=h.$$('#addResults [data-quickadd]')[0];
    assert.ok(pick,'the library sheet opened with results');
    h.click(pick);

    const wInput=h.$('input[data-f="w"]');
    assert.ok(wInput,'the logged exercise has a weight field');
    wInput.focus();
    assert.equal(h.doc.activeElement,wInput,'the keyboard would be up here');

    h.click('[data-openex]');   // opens the exercise sheet — the real path that used to vanish
    assert.notEqual(h.doc.activeElement,wInput,'focus is released before the sheet opens');
    assert.ok(h.$('#sheet').classList.contains('on'),'and the sheet is actually open');
  }finally{h.teardown();}
});

test('UI: the tip and the chevron make the retroactive path findable, and the tip dismisses for good',()=>{
  const h=launch();
  try{
    rows(false).forEach(s=>h.S.upsertSession(JSON.parse(JSON.stringify(s)),false));
    h.click('.tab[data-tab="progress"]');
    assert.ok(h.has('[data-seentip="prAdjustTip"]'),'a first-time reader is told the rows do something');
    const row=h.$$('#prCard [data-openex]').find(r=>r.dataset.openex==='barbell-row');
    assert.ok(row.querySelector('svg'),'the row carries a chevron so it reads as tappable');

    h.click('[data-seentip="prAdjustTip"]');
    assert.ok(!h.has('[data-seentip="prAdjustTip"]'),'"Got it" hides it');
    assert.equal(h.state.settings.seen.prAdjustTip,true,'and the choice is stored (so it syncs)');
    h.click('.tab[data-tab="today"]');h.click('.tab[data-tab="progress"]');
    assert.ok(!h.has('[data-seentip="prAdjustTip"]'),'it stays hidden across navigation');
  }finally{h.teardown();}
});

test('UI: marking from the post-workout summary stays in the summary',()=>{
  // it used to redraw the exercise sheet over the summary, throwing away "Done" mid-flow
  const h=launch();
  try{
    h.S.upsertSession({id:'old',schema:1,date:Date.now()-8*86400000,updatedAt:1,completed:true,
      exercises:[{id:'barbell-row',name:'Barbell Row',sets:[{w:100,r:10,done:true}]}]},false);
    h.click('[data-action="startFlow"]');h.click('[data-action="blank"]');
    h.click('#btnAddEx');
    h.click(h.$$('#addResults [data-quickadd]').find(x=>x.dataset.quickadd==='barbell-row'));
    h.type('input[data-f="w"]','110');h.type('input[data-f="r"]','10');
    h.click('[data-check]');
    h.click(h.$$('button').find(b=>b.textContent.trim()==='Finish'));
    assert.equal(h.text('#sheetTitle'),'New PR! 💪');

    h.click('#sheetBody [data-prmark]');
    assert.equal(h.text('#sheetTitle'),'New PR! 💪','still on the summary');
    assert.ok(h.has('#sumDone'),'the Done button survives');
    assert.ok(h.text('#sheetBody').indexOf('Set aside')>=0,'the row ticks in place');
    assert.ok(h.state.sessions.some(s=>s.exercises.some(e=>e.sets.some(t=>t.nc))),'and the set really is marked');
  }finally{h.teardown();}
});
