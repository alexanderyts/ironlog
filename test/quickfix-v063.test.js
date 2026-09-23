// v0.63.0 — the full review's quick-fix batch (REVIEW-2026-09-22 §10 batch 1).
const test=require('node:test'),assert=require('node:assert');
const {IL,session,set}=require('./load.js');
const P=IL.prog;
const {launch}=require('./ui-harness.js');
const DAY=86400000;

/* ---- 4.2 an unassisted rep on an assist machine saves ---- */
test('4.2: an assist machine at an explicit 0 (unassisted) is saved; a blank is still dropped',()=>{
  const keep=w=>P.finalizeSets([{id:'assisted-pull-up',sets:[{w,r:8,done:true}]}]).length;
  assert.equal(keep(0),1,'number 0 = unassisted, kept');
  assert.equal(keep('0'),1,'typed "0" (stored as a string) kept');
  assert.equal(keep(''),0,'blank = maybe forgotten — dropped, so it can’t fake an unassisted PR');
  assert.equal(keep(40),1,'CONTROL: normal assist kept');
  assert.equal(P.finalizeSets([{id:'leg-press',sets:[{w:0,r:8,done:true}]}]).length,0,'CONTROL: a normal machine at 0 is still junk');
});
test('4.2 UI: a blank assist is nudged, an explicit 0 ticks',()=>{
  const h=launch();
  try{
    h.click('[data-action="startFlow"]');h.click('[data-action="blank"]');
    h.click('#btnAddEx');h.click(h.$$('#addResults [data-quickadd]').find(x=>x.dataset.quickadd==='assisted-pull-up'));
    const card=()=>h.$$('#view .log-ex')[0];
    h.type(card().querySelector('input[data-f="w"]'),'');
    card().querySelector('[data-check]').dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));
    assert.match(h.text('#toastMsg'),/0 if unassisted/,'nudged to enter the assist');
    assert.ok(!h.state.active.exercises[0].sets[0].done,'not ticked while blank');
    h.type(card().querySelector('input[data-f="w"]'),'0');
    card().querySelector('[data-check]').dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));
    assert.ok(h.state.active.exercises[0].sets[0].done,'ticked at 0 — an unassisted rep');
  }finally{h.teardown();}
});

/* ---- 4.8 moving a workout moves its set times ---- */
test('4.8: moving a past workout to another day shifts every set’s timestamp too',()=>{
  const h=launch();
  try{
    const d=Date.now()-3*DAY;
    h.state.sessions=[{id:'m1',schema:1,date:d,updatedAt:d,completed:true,endedAt:d+30*60000,
      exercises:[{id:'barbell-bench-press',name:'Bench',sets:[{w:135,r:5,done:true,at:d+5*60000},{w:135,r:5,done:true,at:d+9*60000}]}]}];
    h.click('.tab[data-tab="history"]');h.click('[data-sess="m1"]');h.click('[data-editsess="m1"]');
    const t=new Date(Date.now()-10*DAY),iso=t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0');
    const inp=h.$('#editDate');inp.value=iso;inp.dispatchEvent(new h.win.Event('change',{bubbles:true}));
    h.click('#btnSaveEdit');
    const s=h.state.sessions.find(x=>x.id==='m1');
    assert.equal(s.exercises[0].sets[0].at-s.date,5*60000,'first set still 5 min in');
    assert.equal(s.exercises[0].sets[1].at-s.date,9*60000,'second set still 9 min in');
  }finally{h.teardown();}
});

/* ---- 4.9 CSV uses the current bodyweight when a session has none ---- */
test('4.9: CSV volume falls back to the current bodyweight like the app’s screens',()=>{
  const s=session(1,[['pull-up',[set(0,5)]]]);s.completed=true;   // no s.bw
  const row=IL.sync.sessionSummaryCsv([s],'lb',180).trim().split('\r\n')[1].split(',');
  assert.equal(row[4],'900','180 bodyweight × 5');
  const own=session(1,[['pull-up',[set(0,5)]]]);own.completed=true;own.bw=200;
  assert.equal(IL.sync.sessionSummaryCsv([own],'lb',180).trim().split('\r\n')[1].split(',')[4],'1000','CONTROL: a session’s own bodyweight still wins');
});

/* ---- 7.2 the confirm dialog's backdrop sits above an open sheet ---- */
test('7.2: the confirm backdrop is layered above the sheet (so the sheet can’t be tapped behind it)',()=>{
  const css=require('fs').readFileSync(require('path').join(__dirname,'..','src','styles.css'),'utf8');
  const z=sel=>+(css.match(new RegExp(sel.replace(/[.#]/g,'\\$&')+'\\{[^}]*z-index:(\\d+)'))||[])[1];
  assert.ok(z('#cscrim')>z('.sheet'),'#cscrim '+z('#cscrim')+' > .sheet '+z('.sheet'));
  assert.ok(z('.cdialog')>z('#cscrim'),'and the dialog itself is above its backdrop');
});

/* ---- Settings: debug text hidden until the version line is tapped ---- */
test('Settings: layout diagnostics are hidden until the version line is tapped',()=>{
  const h=launch();
  try{
    h.click('#btnSettings');
    assert.ok(h.$('#vpDiag').hidden,'hidden by default');
    h.click('#verLine');
    assert.ok(!h.$('#vpDiag').hidden,'tap the version to show them');
  }finally{h.teardown();}
});
