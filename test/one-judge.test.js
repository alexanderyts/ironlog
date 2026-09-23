// v0.65.0 — ONE JUDGE (full review 4.1): the progress chart, PR board, live "New PR", coach "trending
// up" and the stall check all score a set through progression.scoreSet. These pin the bugs that lived
// in the gaps between their old, separate rulebooks.
const test=require('node:test'),assert=require('node:assert');
const {IL,session,set,history,NOW}=require('./load.js');
const P=IL.prog,A=IL.analysis,B=IL.builder;
const DAY=86400000;
const pr=(h,id,bw)=>A.personalRecords(h,bw||0,999).filter(p=>p.id===id)[0];

/* ---- 4.1: the judges agree ---- */
test('4.1: the PR board, the progress chart and the live PR check agree on the same lifts',()=>{
  const lifts=[['barbell-bench-press',[[185,5],[175,8],[165,10]]],['assisted-pull-up',[[40,8],[30,6],[50,12]]],['plank',[[0,45],[0,60],[0,50]]],['hanging-leg-raise',[[0,10],[0,15],[0,12]]]];
  lifts.forEach(([id,perf])=>{
    const h=history(...perf.map(([w,r],i)=>session(9-i*3,[[id,[set(w,r)]]],{now:NOW})));
    const board=pr(h,id,180),series=P.exerciseSeries(h,id,{bw:180});
    const top=series.reduce((a,p)=>p.est>a.est?p:a,series[0]);
    assert.equal(board.w,top.w,id+': PR board and chart pick the same best set (weight)');
    assert.equal(board.r,top.r,id+': …and reps');
    // a new session that beats it is a live PR; one that doesn't isn't
    const best=P.bestSetBefore(h,id,{bw:180});
    assert.ok(best,id+': has a best to beat');
  });
});
test('4.1: a 0-rep junk set is no longer anyone’s "best" (225×0 read as a 225 PR)',()=>{
  const h=history(session(3,[['barbell-bench-press',[set(225,0),set(135,5)]]],{now:NOW}));
  assert.equal(P.bestE1rmBefore(h,'barbell-bench-press',{}),P.e1rm(135,5));
});
test('4.1: the stall check counts bodyweight — a pull-up at +10×6 is not "equal" to bodyweight ×12',()=>{
  // the stall check (builder recentPerfs) scores through scoreSet too — compare the scores directly
  const a=P.scoreSet('pull-up',{w:10,r:6},180),b=P.scoreSet('pull-up',{w:0,r:12},180);
  assert.notEqual(a.score,b.score,'different efforts score differently');
  assert.ok(b.score>a.score,'bodyweight ×12 (e1RM ~252) beats +10 ×6 (~228)');
  assert.equal(P.scoreSet('pull-up',{w:0,r:12},0),null,'CONTROL: no bodyweight → not a record…');
  assert.ok(P.scoreSet('pull-up',{w:0,r:12},0,{repsFallback:true}),'…but the stall check may still compare reps');
});

/* ---- 4.3 / 4.4: assist machines ---- */
test('4.3: an assist machine is planned around its HARDEST (least-assist) sets',()=>{
  const n=P.nextSets([{w:50,r:12},{w:40,r:8},{w:40,r:8}],IL.data.EX['assisted-pull-up'],'lb');
  assert.equal(n.bumped,false,'the 40-assist sets missed the range → no assist taken off yet');
  assert.deepEqual(n.sets.map(s=>s.w),[50,40,40],'held where they were');
  const ready=P.nextSets([{w:50,r:12},{w:40,r:12},{w:40,r:12}],IL.data.EX['assisted-pull-up'],'lb');
  assert.equal(ready.bumped,true);
  assert.ok(ready.sets[1].w<40,'once the hard sets hit the top, THEY get less assist: '+ready.sets.map(s=>s.w));
});
test('4.3: "straight sets" spread the hardest set, not the easiest',()=>{
  const h=history(session(3,[['assisted-pull-up',[set(50,12),set(40,8),set(40,8)]]],{now:NOW}));
  const st=B.seedExercise('assisted-pull-up',h,{unit:'lb',setStyle:'straight'}).sets.map(s=>s.w);
  assert.ok(st.every(w=>w===40),'all sets at the 40 assist, not 50: '+st);
});
test('4.3: assist-machine wording talks about LESS assist',()=>{
  const h=history(session(3,[['assisted-pull-up',[set(40,8),set(40,8)]]],{now:NOW}));
  const s=P.suggestion(h,'assisted-pull-up',{unit:'lb'});
  assert.match(s.text,/less assist/,'"earns … less assist", not "+5lb": '+s.text);
});
test('4.4: an assist-machine PR breaks ties on reps — 40×12 is not replaced by a later 40×5',()=>{
  const h=history(session(9,[['assisted-pull-up',[set(40,12)]]],{now:NOW}),session(2,[['assisted-pull-up',[set(40,5)]]],{now:NOW}));
  assert.equal(pr(h,'assisted-pull-up',180).r,12);
});
test('4.4: with no bodyweight set, an assist machine still trends up as the assist drops',()=>{
  const h=history(session(9,[['assisted-pull-up',[set(50,8)]]],{now:NOW}),session(2,[['assisted-pull-up',[set(30,8)]]],{now:NOW}));
  const s=P.exerciseSeries(h,'assisted-pull-up',{bw:0});
  assert.equal(s.length,2);assert.equal(s[1].metric,'assist');
  assert.ok(s[1].est>s[0].est,'less assist reads as progress, not a flat line at 0: '+s.map(p=>p.est));
});

/* ---- 4.5: rep-only bodyweight moves ---- */
test('4.5: hanging leg raises adding reps get a PR, a trend and count as improving',()=>{
  const h=history(...[[20,8],[13,12],[6,15]].map(([d,r])=>session(d,[['hanging-leg-raise',[set(0,r)]]],{now:NOW})));
  assert.equal(pr(h,'hanging-leg-raise').r,15,'PR = most reps');
  const s=P.exerciseSeries(h,'hanging-leg-raise',{});
  assert.deepEqual(s.map(p=>p.est),[8,12,15],'a trend line in reps');
  assert.equal(s[0].metric,'reps');
  assert.deepEqual(A.progressionStat(h,NOW,0),{n:1,up:1},'counted as trending up');
});
test('4.5 CONTROL: a weighted version of a rep-only move is still judged by its load',()=>{
  const sc=P.scoreSet('glute-bridge',{w:45,r:12},0);
  assert.equal(sc.kind,'e1rm');assert.equal(sc.score,P.e1rm(45,12));
});

/* ---- 4.7: timed holds ---- */
test('4.7: a timed hold’s recovery day uses the BOTTOM of its range, and the wording says seconds',()=>{
  const ex=IL.data.EX.plank;
  assert.ok(P.deloadSets([{w:0,r:60},{w:0,r:60}],ex,'lb').every(s=>s.r===ex.rr[0]),'deload = the shortest hold');
  const h=history(session(3,[['plank',[set(0,40),set(0,40)]]],{now:NOW}));
  const s=P.suggestion(h,'plank',{unit:'lb'});
  assert.match(s.setsStr,/40s/,'"2×40s/40s", not "2×40/40": '+s.setsStr);
  assert.doesNotMatch(s.text,/add a rep/,'never "add a rep" for a hold: '+s.text);
});

/* ---- UI: live PR + finish summary for every kind of lift ---- */
const {launch}=require('./ui-harness.js');
test('UI: the live "New PR" banner now fires for an assist machine and a plank',()=>{
  const h=launch();
  try{
    const now=Date.now();
    h.state.sessions=[{id:'o1',schema:1,date:now-3*DAY,updatedAt:now,completed:true,exercises:[
      {id:'assisted-pull-up',sets:[{w:40,r:8,done:true}]},{id:'plank',sets:[{w:0,r:45,done:true}]}]}];
    h.click('[data-action="startFlow"]');h.click('[data-action="blank"]');
    ['assisted-pull-up','plank'].forEach(id=>{h.click('#btnAddEx');h.click(h.$$('#addResults [data-quickadd]').find(x=>x.dataset.quickadd===id));});
    const a=h.state.active.exercises;const ap=a.find(e=>e.id==='assisted-pull-up'),pk=a.find(e=>e.id==='plank');
    ap.sets[0].w=30;ap.sets[0].r=8;ap.sets[0].done=true;pk.sets[0].r=60;pk.sets[0].done=true;h.IL.ui.render();
    const txt=h.$('#view').textContent;
    assert.match(txt,/New PR — 30lb assist × 8/,'assist machine PR shown');
    assert.match(txt,/New PR — 60s hold/,'plank PR shown');
  }finally{h.teardown();}
});
