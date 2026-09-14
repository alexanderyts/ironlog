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
    h.type(h.$$('input[data-f="w"]')[0],'135');                // a loaded lift needs a weight before it can be ticked (#19)
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
    h.type(h.$$('input[data-f="w"]')[0],'135');               // weight before the tick (#19)
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
    h.type(h.$$('input[data-f="w"]')[0],'135');               // weight before the tick (#19)
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
    h.type(h.$$('input[data-f="w"]')[0],'135');               // weight before the tick (#19)
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

test('UI: T2 — a long-idle workout shows the banner and Finish offers the last-set end time',()=>{
  const h=launch();
  try{
    buildWorkout(h,['Chest']);
    const active=h.state.active,now=Date.now();
    h.type(h.$$('input[data-f="w"]')[0],'135');               // weight before the tick (#19)
    h.click(h.$$('[data-check]')[0]);
    // pretend the last set was 80 min ago and the workout started 140 min ago (Finish forgotten)
    active.exercises[0].sets[0].at=now-80*60000;active.date=now-140*60000;
    h.IL.ui.render();
    assert.ok(h.has('#staleBanner'),'stale banner shown after 80 min idle');
    assert.ok(h.bodyText().includes('Still training'),'banner copy present');
    h.click('#btnFinish');
    assert.ok(h.has('#endAtLast')&&h.has('#endNow'),'end-time choice offered');
    h.click('#endAtLast');
    const saved=h.state.sessions.filter(s=>s.id===active.id)[0];
    assert.equal(saved.endEstimated,true,'flagged as estimated');
    assert.ok(saved.endedAt<=now-70*60000,'ended near the last set (~77 min ago), not now: '+Math.round((now-saved.endedAt)/60000)+' min ago');
    // date = now−140, endedAt = (now−80)+3 = now−77  →  duration = 140 − 77 = 63 min
    assert.equal(h.IL.prog.sessionDuration(saved),63);
  }finally{h.teardown();}
});

test('UI: a workout with no set timestamps, finished two days later, is never logged as 50 hours',()=>{
  const h=launch();
  try{
    buildWorkout(h,['Chest']);
    const active=h.state.active,now=Date.now();
    h.type(h.$$('input[data-f="w"]')[0],'135');               // weight before the tick (#19)
    h.click(h.$$('[data-check]')[0]);
    // the real bug: a session that predates set timestamps (v0.35), left open for 50 hours
    delete active.exercises[0].sets[0].at;active.date=now-50*3600000;
    h.IL.ui.render();
    h.click('#btnFinish');
    assert.ok(h.has('#endNow')&&h.has('#endHour')&&h.has('#endNone'),'offered now / about an hour / no length — not silently "now"');
    h.click('#endNone');
    const saved=h.state.sessions.filter(s=>s.id===active.id)[0];
    assert.ok(saved&&saved.completed,'saved');
    assert.ok(!('endedAt'in saved),'no end time recorded');
    assert.equal(h.IL.prog.sessionDuration(saved),null,'no length shown');
    // control: an ordinary stamped workout still records endedAt ≈ now without any sheet
    buildWorkout(h,['Back']);
    const b=h.state.active;h.type(h.$$('input[data-f="w"]')[0],'185');h.click(h.$$('[data-check]')[0]);h.click('#btnFinish');
    const sb=h.state.sessions.filter(s=>s.id===b.id)[0];
    assert.ok(sb.endedAt>=now&&h.IL.prog.sessionDuration(sb)<=1,'control: fresh workout ends now');
  }finally{h.teardown();}
});

test('UI: Finish is in the top bar of the live editor — disabled with no set, enabled after one, and it finishes',()=>{
  const h=launch();
  try{
    buildWorkout(h,['Chest']);
    const active=h.state.active;
    assert.ok(h.has('#btnFinishTop'),'top-bar Finish present');
    assert.equal(h.$('#btnFinishTop').disabled,true,'disabled before any set is checked');
    h.type(h.$$('input[data-f="w"]')[0],'135');               // weight before the tick (#19)
    h.click(h.$$('[data-check]')[0]);
    assert.equal(h.$('#btnFinishTop').disabled,false,'enabled once a set is done');
    h.click('#btnFinishTop');
    assert.equal(h.state.active,null,'top-bar Finish ends the workout');
    assert.ok(h.state.sessions.some(s=>s.id===active.id&&s.completed),'and saves it');
    // control: not offered while editing a past session
    h.IL.ui.setTab('history');
  }finally{h.teardown();}
});

test('UI: T2 — finishing a normal (not-idle) workout does NOT prompt for the end time (control)',()=>{
  const h=launch();
  try{
    buildWorkout(h,['Chest']);
    h.type(h.$$('input[data-f="w"]')[0],'135');   // weight before the tick (#19)
    h.click(h.$$('[data-check]')[0]);   // just checked → sinceLastSet ~0
    h.click('#btnFinish');
    assert.ok(!h.has('#endAtLast'),'no end-time sheet for a fresh finish');
    assert.equal(h.state.sessions.length,1,'saved directly');
    assert.ok(!h.state.sessions[0].endEstimated,'not flagged estimated');
  }finally{h.teardown();}
});

test('UI: T3 — the Progress Time card summarises duration, rest and time-by-muscle',()=>{
  const h=launch();
  try{
    const now=Date.now(),M=60000,D=86400000;
    h.state.sessions=[
      {id:'a',schema:1,date:now-2*D,updatedAt:1,completed:true,endedAt:now-2*D+40*M,exercises:[{id:'barbell-bench-press',name:'B',sets:[{w:135,r:8,done:true,at:now-2*D+10*M},{w:135,r:8,done:true,at:now-2*D+13*M}]}]},
      {id:'b',schema:1,date:now-5*D,updatedAt:1,completed:true,endedAt:now-5*D+20*M,exercises:[{id:'lateral-raise',name:'L',sets:[{w:15,r:12,done:true,at:now-5*D+2*M},{w:15,r:12,done:true,at:now-5*D+3*M}]}]}
    ];
    h.IL.ui.render();
    h.click(h.$$('[data-tab]').find(b=>b.dataset.tab==='progress'));
    const txt=h.text('#view');
    assert.ok(txt.includes('Time · last 4 weeks'),'Time card present');
    assert.ok(txt.includes('30 min'),'avg workout (40+20)/2 = 30 min');
    assert.ok(txt.includes('compounds ~3:00'),'compound rest 3:00 (bench 180s gap)');
    assert.ok(txt.includes('isolation ~1:00'),'isolation rest 1:00 (lateral 60s gap)');
    assert.ok(txt.includes('Chest')&&txt.includes('Shoulders'),'time-by-muscle lists both groups');
  }finally{h.teardown();}
});

test('UI: P1 — the profile intro appears once; "I\'m good" dismisses it and changes nothing',()=>{
  const h=launch();
  try{
    assert.ok(h.has('#profileIntro'),'intro card on first launch');
    assert.equal(h.state.settings.profile,undefined,'no profile yet');
    h.click('[data-action="profileSkip"]');
    assert.ok(!h.has('#profileIntro'),'card gone after I\'m good');
    assert.equal(h.state.settings.seen.profileIntro,true,'seen flag set');
    assert.equal(h.state.settings.profile,undefined,'profile still absent');
    h.IL.ui.render();assert.ok(!h.has('#profileIntro'),'stays gone');
  }finally{h.teardown();}
});

test('UI: P1 — "Take me there" opens the profile; a choice saves it and bumps settingsUpdatedAt',()=>{
  const h=launch();
  try{
    const before=h.state.settings.settingsUpdatedAt||0;
    h.click('[data-action="profileGo"]');
    assert.equal(h.state.settings.seen.profileIntro,true,'seen set on open');
    assert.ok(h.$('[data-pset="gym"]'),'profile sheet open');
    h.click(h.$$('[data-pset="gym"]').find(b=>b.dataset.pv==='machine'));
    assert.equal(h.state.settings.profile.gym,'machine','choice saved');
    assert.ok((h.state.settings.settingsUpdatedAt||0)>=before,'settingsUpdatedAt advanced');
    h.click(h.$$('[data-pset="gym"]').find(b=>b.dataset.pv==='auto'));
    assert.ok(!h.state.settings.profile||!h.state.settings.profile.gym,'Balanced clears the field');
  }finally{h.teardown();}
});

test('UI: P1 — the New-workout screen shows the profile summary (Balanced → the choice)',()=>{
  const h=launch();
  try{
    h.click('[data-action="startFlow"]');
    assert.ok(h.text('#view').includes('Profile: Balanced'),'Balanced by default');
    h.state.settings.profile={gym:'machine'};
    h.click('[data-action="backHome"]');h.click('[data-action="startFlow"]');
    assert.ok(h.text('#view').includes('Machine gym'),'reflects the choice');
  }finally{h.teardown();}
});

// P2 flips the P1 control: a saved profile now reaches the builder end-to-end. Oracle: the baseline
// continued plan contains the barbell bench; after avoid:['barbell-bench-press'] it must be gone —
// and SWAPPED (same session size), not merely dropped. Control: a goal-only profile changes reps,
// never the exercise list, so the ids stay identical.
test('UI: P2 — the profile reaches the builder: avoid swaps a lift out; goal alone leaves the list',()=>{
  const h=launch();
  try{
    pushHistory(h.state,h.S);h.IL.ui.render();
    const build=()=>{h.click('[data-action="startFlow"]');['Chest','Shoulders','Triceps'].forEach(g=>h.click(h.$$('[data-g]').find(b=>b.dataset.g===g)));
      h.click('[data-action="build"]');const ids=h.state.active.exercises.map(e=>e.id);h.state.active=null;h.S.persistActive();h.click('[data-action="backHome"]');return ids;};
    const a=build();
    assert.ok(a.includes('barbell-bench-press'),'baseline continued plan includes the barbell bench (oracle for the swap): '+a.join(','));
    h.state.settings.profile={avoid:['barbell-bench-press']};h.IL.ui.render();
    const b=build();
    assert.ok(!b.includes('barbell-bench-press'),'avoid removed the barbell bench: '+b.join(','));
    assert.equal(b.length,a.length,'same session size — the bench was swapped, not just dropped');
    // control: goal is a seed-only lever (reps/load), so the exercise list is unchanged from baseline
    h.state.settings.profile={goal:'strength'};h.IL.ui.render();
    const c=build();
    assert.deepEqual(c,a,'goal:strength changes prescriptions, not which exercises are chosen');
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

test('A3: ticking a loaded lift with no weight is refused with a nudge; it ticks once a weight is entered',()=>{
  const h=launch();
  try{
    buildWorkout(h,['Chest']);                                   // fresh → blank weights
    const active=h.state.active,ex0=active.exercises[0];
    assert.notEqual(h.IL.data.EX[ex0.id].equip,'Bodyweight','precondition: the first pick is a loaded lift');
    h.click(h.$$('[data-check]')[0]);                            // try to tick with no weight
    assert.ok(!ex0.sets[0].done,'not marked done');
    assert.ok(h.bodyText().includes('Add a weight'),'the user is nudged, not silently accepted');
    h.type(h.$$('input[data-f="w"]')[0],'135');
    h.click(h.$$('[data-check]')[0]);
    assert.ok(ex0.sets[0].done,'ticks once a weight is entered');
  }finally{h.teardown();}
});

test('A1: when storage is full, finishing keeps the workout instead of losing it',()=>{
  const h=launch();
  try{
    buildWorkout(h,['Chest']);
    const active=h.state.active;
    h.type(h.$$('input[data-f="w"]')[0],'135');
    h.click(h.$$('[data-check]')[0]);
    // jsdom's localStorage is a Proxy (so `ls.foo=x` is a setItem), so patch the prototype method itself
    const proto=h.win.Storage.prototype,orig=proto.setItem;
    proto.setItem=function(k,v){if(k==='il_sessions')throw new Error('QuotaExceededError');return orig.call(this,k,v);};   // the big blob can't write
    h.click('#btnFinish');
    assert.ok(h.state.active&&h.state.active.id===active.id,'the workout is still the active session, not cleared');
    assert.ok(h.state.active.exercises[0].sets.some(s=>s.done),'its ticked set is intact');
    assert.equal(h.state.sessions.filter(s=>s.id===active.id).length,0,'not left half-saved in the sessions list');
    assert.ok(h.bodyText().includes('Storage is full'),'the user is told, not left thinking it saved');
    const onDisk=JSON.parse(h.win.localStorage.getItem('il_active'));
    assert.ok(onDisk&&onDisk.id===active.id,'il_active still holds it → a reload resumes the workout, nothing lost');
    // control: with storage working again, the same Finish saves and clears
    proto.setItem=orig;
    h.click('#btnFinish');
    assert.equal(h.state.active,null,'now it finishes');
    assert.ok(h.state.sessions.some(s=>s.id===active.id&&s.completed),'and is saved');
  }finally{h.teardown();}
});

test('A5: a profile reset on another device propagates (settings rebuilt from the newer remote, not merged)',()=>{
  const h=launch();
  try{
    h.state.settings.profile={goal:'size'};h.state.settings.settingsUpdatedAt=100;
    h.S.absorbRemote({sessions:[],routines:[],deleted:{},settings:{unit:'lb',settingsUpdatedAt:200},active:null},{skipActive:true});   // newer, no profile
    assert.ok(!h.state.settings.profile,'the removed profile is gone locally — a merge would have kept it');
    // control: an OLDER remote leaves the local profile alone
    h.state.settings.profile={goal:'strength'};h.state.settings.settingsUpdatedAt=300;
    h.S.absorbRemote({sessions:[],routines:[],deleted:{},settings:{unit:'lb',settingsUpdatedAt:150},active:null},{skipActive:true});
    assert.equal(h.state.settings.profile.goal,'strength','older remote does not wipe it');
  }finally{h.teardown();}
});
