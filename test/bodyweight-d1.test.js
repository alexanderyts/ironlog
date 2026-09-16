// D-1: per-session bodyweight. A bodyweight lift is scored by the bodyweight recorded ON that session
// (s.bw), not by whatever the caller passes as "today's" — so old workouts don't drift when you update
// your weight. Sessions with no s.bw fall back to the passed scalar (unchanged behaviour).
const {IL,session,set,history}=require('./load.js');
const test=require('node:test'),assert=require('node:assert');
const P=IL.prog,A=IL.analysis;

function withBw(s,bw){s.bw=bw;return s;}   // stamp a session's bodyweight

test('exerciseSeries scores each pull-up session by its OWN bodyweight, ignoring the passed scalar',()=>{
  // same logged work (bodyweight-only, 5 reps) at two different bodyweights → the heavier one is harder
  const h=history(
    withBw(session(9,[['pull-up',[set(0,5)]]]),180),
    withBw(session(2,[['pull-up',[set(0,5)]]]),200)
  );
  const s=P.exerciseSeries(h,'pull-up',{bw:999});   // scalar must NOT override the stamped values
  assert.equal(s.length,2);
  assert.equal(s[0].est,P.e1rm(180,5),'first session scored at its 180 bodyweight');
  assert.equal(s[1].est,P.e1rm(200,5),'second at its 200 bodyweight');
  assert.ok(s[1].est>s[0].est,'trend rises with the heavier bodyweight, not the scalar');
});

test('personalRecords: the session at a heavier bodyweight is the pull-up record (same reps)',()=>{
  const h=history(
    withBw(session(9,[['pull-up',[set(0,5)]]]),200),
    withBw(session(2,[['pull-up',[set(0,5)]]]),180)
  );
  const pr=A.personalRecords(h,999,8).filter(p=>p.id==='pull-up')[0];
  assert.ok(pr,'pull-up has a PR');
  assert.equal(pr.est,P.e1rm(200,5),'ranked by the 200-bodyweight session, not the 999 scalar');
});

test('sessionVolume uses the session bodyweight when present, else the fallback',()=>{
  const s=withBw(session(1,[['pull-up',[set(0,5)]]]),180);
  assert.equal(P.sessionVolume(s,999),180*5,'stamped bodyweight wins over the scalar');
  const s2=session(1,[['pull-up',[set(0,5)]]]);   // no stamp
  assert.equal(P.sessionVolume(s2,150),150*5,'falls back to the passed scalar');
});

test('CONTROL: a session with no s.bw behaves exactly as before (falls back to scalar)',()=>{
  const h=history(session(2,[['pull-up',[set(0,5)]]]));
  const s=P.exerciseSeries(h,'pull-up',{bw:200});
  assert.equal(s[0].est,P.e1rm(200,5),'unstamped session uses the passed bodyweight');
});

test('cleanSession preserves a valid s.bw and drops junk',()=>{
  assert.equal(IL.sync.cleanSession({id:'a',date:1,bw:185,exercises:[]}).bw,185);
  assert.equal(IL.sync.cleanSession({id:'a',date:1,bw:-5,exercises:[]}).bw,undefined,'negative dropped');
  assert.equal(IL.sync.cleanSession({id:'a',date:1,bw:99999,exercises:[]}).bw,2000,'clamped');
  assert.equal(IL.sync.cleanSession({id:'a',date:1,exercises:[]}).bw,undefined,'absent stays absent');
});

test('convertSessions converts the stamped bodyweight too (lb→kg)',()=>{
  const s=withBw(session(1,[['pull-up',[set(0,5)]]]),200);
  IL.prog.convertSessions([s],'lb','kg',Date.now());
  assert.equal(s.bw,P.convertWeight(200,'lb','kg'),'s.bw converted alongside the set weights');
});

/* ---- UI: finishing a workout snapshots the current bodyweight ---- */
const {launch,buildWorkout}=require('./ui-harness.js');

test('UI: finishing a workout stamps it with the current bodyweight',()=>{
  const h=launch();
  try{
    h.state.settings.bodyweight=185;
    buildWorkout(h,['Chest']);
    h.type(h.$$('input[data-f="w"]')[0],'135');
    h.click(h.$$('[data-check]')[0]);
    h.click('#btnFinish');
    const saved=h.state.sessions.find(s=>s.completed);
    assert.ok(saved,'the workout was saved');
    assert.equal(saved.bw,185,'it carries the bodyweight it was done at');
  }finally{h.teardown();}
});

test('UI CONTROL: with no bodyweight set, a finished workout carries no snapshot',()=>{
  const h=launch();
  try{
    h.state.settings.bodyweight=0;
    buildWorkout(h,['Chest']);
    h.type(h.$$('input[data-f="w"]')[0],'135');
    h.click(h.$$('[data-check]')[0]);
    h.click('#btnFinish');
    const saved=h.state.sessions.find(s=>s.completed);
    assert.ok(!(+saved.bw>0),'no bogus 0 stamp when bodyweight is unknown');
  }finally{h.teardown();}
});
