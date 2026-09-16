// D-4: whole-workout notes, and moving a past workout to another day.
const test=require('node:test'),assert=require('node:assert');
const {IL}=require('./load.js');
const {launch,buildWorkout}=require('./ui-harness.js');
const DAY=86400000;

/* ---- engine: the note round-trips through the sanitizer ---- */
test('cleanSession keeps a real workout note and drops an empty/whitespace one',()=>{
  assert.equal(IL.sync.cleanSession({id:'a',date:1,note:'felt strong',exercises:[]}).note,'felt strong');
  assert.equal(IL.sync.cleanSession({id:'a',date:1,note:'   ',exercises:[]}).note,undefined,'blank dropped');
  assert.equal(IL.sync.cleanSession({id:'a',date:1,note:'x'.repeat(999),exercises:[]}).note.length,500,'capped at 500');
  assert.equal(IL.sync.cleanSession({id:'a',date:1,exercises:[]}).note,undefined,'absent stays absent');
});

/* ---- UI: add a note during a workout, see it persist and show in History ---- */
test('a workout note is saved on the session and shown in History',()=>{
  const h=launch();
  try{
    buildWorkout(h,['Chest']);
    h.type(h.$$('input[data-f="w"]')[0],'135');h.click(h.$$('[data-check]')[0]);
    h.click('#btnSessNote');
    h.type('#snoteText','shoulder felt great today');
    h.click('#snoteSave');
    assert.equal(h.state.active.note,'shoulder felt great today','note stored on the live workout');
    // the note line renders in the editor
    assert.ok(h.has('#sessNoteShow'),'the note shows in the editor');
    h.click('#btnFinish');
    const saved=h.state.sessions.find(s=>s.completed);
    assert.equal(saved.note,'shoulder felt great today','note survives finish');
    h.click('.tab[data-tab="history"]');
    assert.ok(h.bodyText().includes('shoulder felt great today'),'the note appears on the History card');
  }finally{h.teardown();}
});

test('removing a workout note clears it',()=>{
  const h=launch();
  try{
    buildWorkout(h,['Chest']);
    h.click('#btnSessNote');h.type('#snoteText','temp');h.click('#snoteSave');
    assert.equal(h.state.active.note,'temp');
    h.click('#btnSessNote');h.click('#snoteClear');
    assert.ok(!h.state.active.note,'note removed');
  }finally{h.teardown();}
});

/* ---- UI: move a past workout to another day ---- */
function seedPast(h,daysAgo){
  const d=Date.now()-daysAgo*DAY;
  h.state.sessions=[{id:'past1',schema:1,date:d,updatedAt:d,completed:true,endedAt:d+40*60000,
    exercises:[{id:'barbell-bench-press',name:'Bench',sets:[{w:135,r:5,done:true}]}]}];
  return d;
}
test('editing a past workout’s date moves it (and keeps its duration), and saving persists it',()=>{
  const h=launch();
  try{
    const orig=seedPast(h,3);
    h.click('.tab[data-tab="history"]');
    h.click('[data-sess="past1"]');            // open the detail sheet
    h.click('[data-editsess="past1"]');        // into the editor
    const inp=h.$('#editDate');
    assert.ok(inp,'the date field is shown in edit mode');
    // move it to 10 days ago
    const target=new Date(Date.now()-10*DAY);
    const iso=target.getFullYear()+'-'+String(target.getMonth()+1).padStart(2,'0')+'-'+String(target.getDate()).padStart(2,'0');
    inp.value=iso;inp.dispatchEvent(new h.win.Event('change',{bubbles:true}));
    h.click('#btnSaveEdit');
    const s=h.state.sessions.find(x=>x.id==='past1');
    const movedDay=new Date(s.date);
    assert.equal(movedDay.getFullYear()+'-'+String(movedDay.getMonth()+1).padStart(2,'0')+'-'+String(movedDay.getDate()).padStart(2,'0'),iso,'date moved to the chosen day');
    assert.equal(s.endedAt-s.date,40*60000,'duration (endedAt − date) is unchanged');
  }finally{h.teardown();}
});
