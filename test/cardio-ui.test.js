// Cardio logging — screen-level oracles (Phase C2). Drives the real bundle: open the sheet, pick,
// start/finish or log, and assert the SAVED record and the live state, not just that clicks didn't throw.
const test=require('node:test'),assert=require('node:assert/strict');
const {launch}=require('./ui-harness.js');

const savedCardio=h=>h.state.sessions.filter(s=>s.kind==='cardio');

test('C2: Start a live cardio session, adjust type/intensity, Finish → saves a correct cardio record',()=>{
  const h=launch();
  try{
    h.click('[data-action="cardioOpen"]');            // open the Cardio sheet
    assert.ok(h.has('#btnCardioStart'),'sheet offers a live start');
    h.$$('[data-cardtype]').find(b=>b.dataset.cardtype==='elliptical').dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));
    h.$$('[data-cardint]').find(b=>b.dataset.cardint==='hard').dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));
    h.click('#btnCardioStart');
    assert.ok(h.state.active&&h.state.active.kind==='cardio','a live cardio session is active');
    assert.equal(h.state.active.cardio.type,'elliptical');
    assert.equal(h.state.active.cardio.intensity,'hard');
    assert.ok(h.has('#cardioClock'),'the live clock is on screen');
    // simulate ~18 minutes elapsed (under the 30-min forgotten-Finish threshold → finishes straight away)
    h.state.active.date=Date.now()-18*60000;
    h.click('#btnCardioFinish');
    assert.equal(h.state.active,null,'session finished, nothing left active');
    const rows=savedCardio(h);
    assert.equal(rows.length,1,'one cardio session saved');
    const c=rows[0];
    assert.equal(c.completed,true);
    assert.equal(c.exercises.length,0,'saved cardio carries no exercises');   // length, not deepEqual — cross-realm arrays
    assert.equal(c.cardio.type,'elliptical');
    assert.equal(c.cardio.intensity,'hard');
    assert.equal(h.IL.prog.sessionDuration(c),18,'duration ≈ 18 min');
  }finally{h.teardown();}
});

test('C2: Manual entry (minutes + distance) logs a completed cardio session without a timer',()=>{
  const h=launch();
  try{
    h.click('[data-action="cardioOpen"]');
    h.$$('[data-cardtype]').find(b=>b.dataset.cardtype==='outdoor').dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));
    // bump minutes 30 → 45 (two +5s… actually +5 thrice); assert via the saved duration
    const plus=h.$$('[data-cardmin]').find(b=>b.dataset.cardmin==='5');
    plus.dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));
    plus.dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));
    plus.dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));   // 30 → 45
    h.type('#cardDist','2.5');
    h.click('#btnCardioLog');
    assert.equal(h.state.active,null,'manual entry never leaves a session active');
    const rows=savedCardio(h);
    assert.equal(rows.length,1);
    const c=rows[0];
    assert.equal(c.cardio.type,'outdoor');
    assert.equal(h.IL.prog.sessionDuration(c),45,'logged 45 minutes');
    assert.equal(c.cardio.distance,2.5,'distance captured');
    assert.equal(c.cardio.unit,'mi','unit follows the lb default');
  }finally{h.teardown();}
});

test('C2: a cardio session left running for hours offers an honest end, not a 5-hour record',()=>{
  const h=launch();
  try{
    h.click('[data-action="cardioOpen"]');
    h.click('#btnCardioStart');                        // treadmill/easy defaults
    h.state.active.date=Date.now()-5*60*60000;         // "started" 5 hours ago
    h.click('#btnCardioFinish');
    // the forgotten-Finish sheet appears rather than committing 5 hours
    assert.ok(h.has('#cEndHour'),'offers an estimated end');
    assert.equal(savedCardio(h).length,0,'nothing saved yet');
    h.click('#cEndHour');                              // ≈1 hour after start
    const rows=savedCardio(h);
    assert.equal(rows.length,1,'saved after choosing an end');
    assert.equal(rows[0].endEstimated,true,'flagged as an estimate');
    assert.equal(h.IL.prog.sessionDuration(rows[0]),60,'recorded ≈60 min, not 300');
  }finally{h.teardown();}
});

test('C3: a logged cardio session shows in History and counts this week, but not in volume',()=>{
  const h=launch();
  try{
    const now=Date.now(),ws=h.IL.prog.weekStart(now);
    // one lift this week + one cardio this week, seeded directly
    h.state.sessions=[
      {id:'lift1',schema:1,date:ws+3600000,updatedAt:now,completed:true,
        exercises:[{id:'barbell-bench-press',name:'Bench',sets:[{w:135,r:5,done:true},{w:135,r:5,done:true}]}]},
      {id:'card1',schema:1,date:ws+7200000,updatedAt:now,completed:true,kind:'cardio',exercises:[],
        endedAt:ws+7200000+32*60000,cardio:{type:'treadmill',intensity:'easy',distance:1.6,unit:'mi'}},
    ];
    // Progress: "This week" counts BOTH (2); week volume is the lift only (135*5*2 = 1350)
    h.click('.tab[data-tab="progress"]');
    const stat=lbl=>{const c=h.$$('.stat').find(x=>x.querySelector('.k')&&x.querySelector('.k').textContent.trim().indexOf(lbl)===0);const v=c&&c.querySelector('.v');const m=v&&v.textContent.match(/-?\d[\d,]*/);return m?+m[0].replace(/,/g,''):null;};
    assert.equal(stat('This week'),2,'cardio + lift both count this week');
    assert.equal(stat('Week volume'),1350,'week volume is the lift only — cardio adds nothing');
    // History: the cardio card renders with its type and duration
    h.click('.tab[data-tab="history"]');
    const view=h.$('#view').textContent;
    assert.match(view,/Treadmill/,'cardio card shows the type');
    assert.match(view,/Cardio/,'cardio card is labelled');
    assert.match(view,/32 min/,'cardio card shows the duration');
  }finally{h.teardown();}
});

test('C5: editing a saved cardio session updates its type and duration',()=>{
  const h=launch();
  try{
    const now=Date.now();
    h.state.sessions=[{id:'cardX',schema:1,date:now-40*60000,updatedAt:now,completed:true,kind:'cardio',exercises:[],
      endedAt:now,cardio:{type:'treadmill',intensity:'easy'}}];   // 40-min treadmill/easy
    h.click('.tab[data-tab="history"]');
    h.$('[data-sess="cardX"]').dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));   // open detail
    h.click('#cardEdit');                                        // open the edit sheet
    // change type → elliptical, drop minutes 40 → 30 (two −5s)
    h.$$('[data-cardtype]').find(b=>b.dataset.cardtype==='elliptical').dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));
    const minus=()=>h.$$('[data-cardmin]').find(b=>b.dataset.cardmin==='-5');
    minus().dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));
    minus().dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));
    h.click('#btnCardioSave');
    const s=h.state.sessions.find(x=>x.id==='cardX');
    assert.equal(s.cardio.type,'elliptical','type updated');
    assert.equal(h.IL.prog.sessionDuration(s),30,'duration updated to 30 min');
  }finally{h.teardown();}
});

test('C2b: manual cardio can be back-dated to a past day',()=>{
  const h=launch();
  try{
    h.click('[data-action="cardioOpen"]');
    // pick a date three days ago
    const d=new Date(Date.now()-3*86400000);const iso=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    const w=h.$('#cardWhen');assert.ok(w,'the sheet has a When date field');
    w.value=iso;
    h.click('#btnCardioLog');
    const c=h.state.sessions.filter(s=>s.kind==='cardio')[0];
    assert.ok(c,'a cardio session was logged');
    const logged=new Date(c.date);
    assert.equal(logged.getFullYear()+'-'+String(logged.getMonth()+1).padStart(2,'0')+'-'+String(logged.getDate()).padStart(2,'0'),iso,'session lands on the chosen day');
    assert.ok(c.endedAt-c.date>0,'still has a positive duration');
  }finally{h.teardown();}
});
