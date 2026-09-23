// v0.69.0 — "Your record": you pick which set counts as your record (default: your best). Picking
// flags every BETTER set as not-a-record (the existing `nc` flag) and unflags the rest — so one idea
// covers a rep with broken form and a lift done a different way that day (seated vs standing face pulls).
const test=require('node:test'),assert=require('node:assert/strict');
const {IL,session,set,history,NOW}=require('./load.js');
const {launch}=require('./ui-harness.js');
const P=IL.prog,A=IL.analysis,B=IL.builder,DAY=86400000;
const rec=(h,id)=>A.personalRecords(h,0,99).find(p=>p.id===id);
const ncCount=h=>h.reduce((n,s)=>n+s.exercises.reduce((m,e)=>m+e.sets.filter(t=>t.nc).length,0),0);

/* ---- engine ---- */
function facePulls(){   // two seated sessions at 70-75, then standing at 25
  return history(session(20,[['face-pull',[set(75,12),set(75,10)]]],{now:NOW}),session(14,[['face-pull',[set(70,12)]]],{now:NOW}),
    session(7,[['face-pull',[set(25,12)]]],{now:NOW}),session(2,[['face-pull',[set(25,15),set(25,14)]]],{now:NOW}));
}
test('recordChoices: one row per workout (its best set), newest first, best logged marked',()=>{
  const h=facePulls(),ch=P.recordChoices(h,'face-pull','cable',0,8);
  assert.deepEqual(ch.map(c=>c.w+'x'+c.r),['25x15','25x12','70x12','75x12']);
  assert.equal(ch.filter(c=>c.bestLogged).length,1);assert.equal(ch.find(c=>c.bestLogged).w,75);
});
test('the face-pull case: picking the standing 25 makes it the record and the next weights follow it',()=>{
  const h=facePulls(),c=P.recordChoices(h,'face-pull','cable',0,8)[0];   // 25 × 15
  P.pickRecord(h,'face-pull','cable',0,{score:c.score,tie:c.tie});
  const r=rec(h,'face-pull');
  assert.equal(r.w,25);assert.equal(r.r,15);
  assert.ok(r.adjusted&&r.adjusted.w===75,'the card can still say "best logged 75"');
  const next=B.seedExercise('face-pull',h,{unit:'lb'}).sets.map(s=>s.w);
  assert.ok(next.every(w=>w<=30),'next workout starts near 25, not 75: '+next);
  // CONTROL: nothing is deleted — the seated sessions keep their sets and their volume
  assert.equal(h.find(s=>s.exercises[0].sets[0].w===75).exercises[0].sets.length,2);
  assert.ok(P.sessionVolume(h.find(s=>s.exercises[0].sets[0].w===75),0)>0);
});
test('picking again recomputes: a higher pick un-flags what is now below it; "use best" clears everything',()=>{
  const h=facePulls(),ch=P.recordChoices(h,'face-pull','cable',0,8);
  P.pickRecord(h,'face-pull','cable',0,ch[0]);          // 25×15 → the 70 and both 75s are flagged
  assert.equal(ncCount(h),3);
  const seventy=ch.find(c=>c.w===70);P.pickRecord(h,'face-pull','cable',0,seventy);
  assert.equal(ncCount(h),2,'only the 75s beat a 70×12 pick');
  assert.equal(rec(h,'face-pull').w,70);
  P.pickRecord(h,'face-pull','cable',0,null);
  assert.equal(ncCount(h),0);assert.equal(rec(h,'face-pull').w,75);
});
test('CONTROL: a pick only touches that lift and that version of it',()=>{
  const h=history(session(5,[['barbell-curl',[set(90,8)]],['barbell-row',[set(185,8)]]],{now:NOW}),session(2,[['barbell-curl',[set(60,10)]]],{now:NOW}));
  h[1].exercises.push({id:'cable-curl',side:true,sets:[set(40,10)]});
  P.pickRecord(h,'barbell-curl','barbell',0,P.recordChoices(h,'barbell-curl','barbell',0,8)[0]);
  assert.equal(rec(h,'barbell-row').w,185,'another lift is untouched');
  assert.equal(ncCount(h),1,'only the 90 curl');
});
test('a new best AFTER a pick is a record again — the pick is not a ceiling',()=>{
  const h=facePulls();P.pickRecord(h,'face-pull','cable',0,P.recordChoices(h,'face-pull','cable',0,8)[0]);
  h.unshift(session(0.5,[['face-pull',[set(30,15)]]],{now:NOW}));
  assert.equal(rec(h,'face-pull').w,30);
});

/* ---- screens ---- */
function load(h,sess){sess.forEach(s=>h.S.upsertSession(JSON.parse(JSON.stringify(s)),false));}
function openLift(h,id){h.click('.tab[data-tab="progress"]');h.click(h.$$('#liftCard [data-openex]').find(r=>r.dataset.openex===id));}
test('UI: Change → pick a set → the record, the note and "Use best" all follow',()=>{
  const h=launch();
  try{
    const now=Date.now();
    load(h,[{id:'a',schema:1,date:now-9*DAY,updatedAt:now,completed:true,exercises:[{id:'face-pull',sets:[{w:75,r:12,done:true}]}]},
            {id:'b',schema:1,date:now-2*DAY,updatedAt:now,completed:true,exercises:[{id:'face-pull',sets:[{w:25,r:15,done:true}]}]}]);
    openLift(h,'face-pull');
    assert.match(h.text('#sheetBody'),/Your record 75lb × 12/);
    assert.match(h.text('#sheetBody'),/Tap Change if a set shouldn’t count/,'first-time explainer');
    h.click('#sheetBody [data-recchange]');
    assert.equal(h.text('#sheetTitle'),'Which set is your record?');
    const opts=h.$$('#sheetBody [data-recpick]');
    assert.equal(opts.length,2);assert.equal(opts[1].getAttribute('aria-checked'),'true','the 75 is ticked by default');
    h.click(opts[0]);   // 25 × 15
    const t=h.text('#sheetBody');
    assert.match(t,/Your record 25lb × 15/);assert.match(t,/Your pick · best logged 75lb × 12/);
    assert.match(h.text('#toastMsg'),/Your record: 25lb × 15/);
    h.click('#sheetBody [data-recbest]');
    assert.match(h.text('#sheetBody'),/Your record 75lb × 12/);assert.doesNotMatch(h.text('#sheetBody'),/Your pick/);
    h.click('#sheetBody [data-seentip="recordTip"]');
    assert.doesNotMatch(h.text('#sheetBody'),/Tap Change/,'explainer dismissed');assert.equal(h.state.settings.seen.recordTip,true);
  }finally{h.teardown();}
});
test('UI: the picker writes a timed lift in seconds',()=>{
  const h=launch();
  try{
    const now=Date.now();
    load(h,[{id:'a',schema:1,date:now-9*DAY,updatedAt:now,completed:true,exercises:[{id:'plank',sets:[{w:0,r:90,done:true}]}]},
            {id:'b',schema:1,date:now-2*DAY,updatedAt:now,completed:true,exercises:[{id:'plank',sets:[{w:0,r:60,done:true}]}]}]);
    openLift(h,'plank');h.click('#sheetBody [data-recchange]');
    const t=h.text('#sheetBody');assert.match(t,/90s/);assert.match(t,/60s/);assert.doesNotMatch(t,/0lb/);
  }finally{h.teardown();}
});
test('UI: "Don’t count this" on the finish screen keeps the old record and stays on the summary',()=>{
  const h=launch();
  try{
    h.S.upsertSession({id:'old',schema:1,date:Date.now()-8*DAY,updatedAt:1,completed:true,exercises:[{id:'barbell-row',sets:[{w:100,r:10,done:true}]}]},false);
    h.click('[data-action="startFlow"]');h.click('[data-action="blank"]');
    h.click('#btnAddEx');h.click(h.$$('#addResults [data-quickadd]').find(x=>x.dataset.quickadd==='barbell-row'));
    h.type('input[data-f="w"]','110');h.type('input[data-f="r"]','10');h.click('[data-check]');
    h.click(h.$$('button').find(b=>b.textContent.trim()==='Finish'));
    assert.equal(h.text('#sheetTitle'),'New PR! 💪');
    assert.match(h.text('#sheetBody'),/PR = personal record/,'a beginner is told what PR means…');
    h.click('#sheetBody [data-nocount]');
    assert.equal(h.text('#sheetTitle'),'New PR! 💪','still on the summary');assert.ok(h.has('#sumDone'));
    assert.match(h.text('#sheetBody'),/Not counted ✓/);
    assert.equal(h.IL.analysis.personalRecords(h.state.sessions,0,9).find(p=>p.id==='barbell-row').w,100,'the 100 is still the record');   // the app's engine: picks live in its settings (batch 1)
    assert.ok(!h.state.sessions.some(s=>s.id!==h.state.sessions[0].id&&s.exercises.some(e=>e.sets.some(t=>t.nc))),'no old workout was rewritten');
    assert.equal(h.state.settings.seen.prWord,true,'…once');
  }finally{h.teardown();}
});
