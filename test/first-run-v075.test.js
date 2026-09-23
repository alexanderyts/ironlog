// v0.75.0 — first run & Home: "Where do you train?", learning from barbell skips, a short first
// workout, the first-workout tip, the deload switch waiting for history, name, recap line, calendar.
const test=require('node:test'),assert=require('node:assert/strict');
const {IL}=require('./load.js');
const {launch,buildWorkout}=require('./ui-harness.js');
const B=IL.builder,DAY=86400000;
const done=(id,date,w)=>({id:'s'+date,schema:1,date,updatedAt:1,completed:true,exercises:[{id,sets:[{w:w||100,r:8,done:true},{w:w||100,r:8,done:true}]}]});

test('calendar reminder: one weekly event on the chosen days, next start that hasn’t passed, CRLF',()=>{
  const wedNoon=new Date(2026,8,23,12,0,0).getTime();   // Wed 23 Sep 2026, local
  const ics=IL.sync.reminderIcs([5,1,3,3],18,0,wedNoon);
  assert.match(ics,/^BEGIN:VCALENDAR\r\n/);assert.match(ics,/END:VCALENDAR\r\n$/);
  assert.match(ics,/\r\nRRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR\r\n/);
  assert.match(ics,/\r\nDTSTART:20260923T180000\r\n/,'today still counts before 6 pm');
  const late=IL.sync.reminderIcs([1,3,5],18,0,new Date(2026,8,23,19,0,0).getTime());
  assert.match(late,/\r\nDTSTART:20260925T180000\r\n/,'after 6 pm Wednesday → Friday');
  assert.equal(IL.sync.reminderIcs([],18,0,wedNoon),'');
});

test('first build: at most 4 exercises × 3 working sets, never dropping a muscle you picked',()=>{
  const ex=id=>({id,sets:[{w:'',r:8},{w:'',r:8},{w:'',r:8},{w:'',r:8}]});
  const exs=B.fitFirstSession(['barbell-bench-press','incline-dumbbell-press','pec-deck','barbell-row','lat-pulldown','seated-cable-row'].map(ex));
  assert.ok(exs.length<=4);assert.ok(exs.every(e=>e.sets.length===3));
  assert.ok(exs.some(e=>IL.data.EX[e.id].group==='Chest')&&exs.some(e=>IL.data.EX[e.id].group==='Back'));
  const w=B.fitFirstSession([{id:'back-squat',sets:[{w:45,r:10,warm:true},{w:'',r:8},{w:'',r:8},{w:'',r:8},{w:'',r:8}]}]);
  assert.equal(w[0].sets.length,4,'a warm-up row doesn’t eat a working set');
});

test('settings keep an optional name (trimmed, capped) and a known gym label only',()=>{
  const s=IL.sync.cleanSettings({name:'  Alexandra-Marie Longname-Smith  ',profile:{gym:'machine',place:'pf'}});
  assert.equal(s.name.length,24);assert.equal(s.profile.place,'pf');
  const bad=IL.sync.cleanSettings({name:'   ',profile:{gym:'full',place:'my-garage'}});
  assert.equal(bad.name,undefined);assert.equal(bad.profile.place,undefined);assert.equal(bad.profile.gym,'full');
});

test('UI: a brand-new lifter’s first build is short, with a how-to-log tip until “Got it”',()=>{
  const h=launch();
  try{
    buildWorkout(h,['Chest','Back']);
    const a=h.state.active;
    assert.ok(a.exercises.length<=4,a.exercises.length+' exercises');
    assert.ok(a.exercises.every(e=>e.sets.filter(s=>!s.warm).length<=3));
    assert.ok(h.has('#firstTip'));assert.match(h.text('#firstTip'),/Only ticked sets are saved/);
    h.click('#firstTip [data-seentip]');assert.ok(!h.has('#firstTip'));
  }finally{h.teardown();}
});

test('UI: with history the build is NOT shortened and there is no tip',()=>{
  const h=launch();
  try{
    const now=Date.now();[9,6,3].forEach(d=>h.S.upsertSession(done('barbell-bench-press',now-d*DAY,135),false));
    buildWorkout(h,['Chest','Back']);
    assert.ok(h.state.active.exercises.length>4,'normal build');assert.ok(!h.has('#firstTip'));
  }finally{h.teardown();}
});

test('UI: the deload switch waits for ~5 workouts',()=>{
  const h=launch();
  try{
    h.click('[data-action="startFlow"]');assert.ok(!h.has('[data-action="deloadToggle"]'),'hidden for a beginner');
    h.click('[data-action="backHome"]');
    const now=Date.now();[15,12,9,6,3].forEach(d=>h.S.upsertSession(done('leg-press',now-d*DAY),false));
    h.click('[data-action="startFlow"]');assert.ok(h.has('[data-action="deloadToggle"]'),'shown after 5');
  }finally{h.teardown();}
});

test('UI: two barbell swaps in different workouts → an offer to skip barbells; accepting sets a machine gym',()=>{
  const h=launch();
  try{
    const now=Date.now();[9,6,3].forEach(d=>h.S.upsertSession(done('barbell-bench-press',now-d*DAY,135),false));
    const swapBench=()=>{
      const ei=h.state.active.exercises.findIndex(e=>e.id==='barbell-bench-press');assert.ok(ei>=0,'bench in the build');
      h.click(`[data-exmenu="${ei}"]`);h.click('[data-exact="replace"]');h.click('[data-replacewith="machine-chest-press"]');
      h.S.setActive(null);h.IL.ui.render();};
    buildWorkout(h,['Chest']);swapBench();
    h.click('[data-action="startFlow"]');assert.ok(!h.has('#bbAsk'),'one swap is not a pattern');h.click('[data-action="backHome"]');
    buildWorkout(h,['Chest']);swapBench();
    h.click('[data-action="startFlow"]');assert.ok(h.has('#bbAsk'),'asked after the second workout');
    h.click('[data-action="bbNoRack"]');
    assert.equal(h.state.settings.profile.gym,'machine');assert.ok(!h.has('#bbAsk'));
  }finally{h.teardown();}
});

test('UI: name in the greeting; a fresh week opens on last week’s recap, not “0 workouts”',()=>{
  const h=launch();
  try{
    h.state.settings.name='Sam';
    const ws=h.IL.prog.weekStart(Date.now());
    h.S.upsertSession(done('leg-press',ws-2*DAY),false);h.S.upsertSession(done('barbell-row',ws-4*DAY),false);
    h.IL.ui.render();
    assert.match(h.text('h2'),/, Sam\.$/);
    assert.match(h.text('#homeSummary'),/^Last week: 2 workouts · 4 sets/);
  }finally{h.teardown();}
});
