// v0.68.0 — Progress tab v2: "Your lifts" (one status per lift), Coach as Focus + Wins, a Muscles chart
// counted the coach's way with a target range, secondary panels folded, Home down to one line.
// The headline oracle is CONSISTENCY: the old tab showed two different hamstring numbers.
const test=require('node:test'),assert=require('node:assert/strict');
const {IL,session,set,history,NOW}=require('./load.js');
const {launch}=require('./ui-harness.js');
const A=IL.analysis,DAY=86400000;
const byId=(ls,id)=>ls.find(l=>l.id===id);

/* ---- Your lifts ---- */
test('liftStatus: one status per lift — new PR, improving, stuck, holding, first time',()=>{
  const h=history(
    session(60,[['back-squat',[set(275,5)]]],{now:NOW}),                                     // an old, heavier squat
    session(20,[['barbell-bench-press',[set(135,8)]],['overhead-press',[set(95,6)]],['back-squat',[set(215,5)]],['barbell-row',[set(135,8)]]],{now:NOW}),
    session(12,[['barbell-bench-press',[set(145,8)]],['overhead-press',[set(95,6)]],['back-squat',[set(225,5)]],['barbell-row',[set(135,8)]]],{now:NOW}),
    session(3,[['barbell-bench-press',[set(155,8)]],['overhead-press',[set(95,6)]],['back-squat',[set(235,5)]],['barbell-row',[set(135,8)]],['plank',[set(0,60)]]],{now:NOW}));
  const ls=A.liftStatus(h,NOW,180);
  assert.equal(byId(ls,'barbell-bench-press').status,'pr');
  assert.deepEqual(byId(ls,'barbell-bench-press').from,{w:145,r:8},'"was" = the best BEFORE the PR');
  assert.equal(byId(ls,'overhead-press').status,'stuck','flat for 17 days = the builder’s own stall rule');
  assert.equal(byId(ls,'back-squat').status,'up','climbing, but still under the 275 from two months ago → improving, not a PR');
  assert.equal(byId(ls,'plank').status,'new');
  assert.equal(ls[0].status,'pr','PRs first');
});
test('liftStatus CONTROL: a lift held level for under 2 weeks is holding, not stuck',()=>{
  const h=history(session(9,[['barbell-row',[set(135,8)]]],{now:NOW}),session(3,[['barbell-row',[set(135,8)]]],{now:NOW}));
  assert.equal(byId(A.liftStatus(h,NOW,180),'barbell-row').status,'hold');
});
test('liftStatus: an assist machine dropping assist is a PR; a set marked "not clean" is ignored',()=>{
  const h=history(session(10,[['assisted-pull-up',[set(40,8)]]],{now:NOW}),session(3,[['assisted-pull-up',[set(30,8)]]],{now:NOW}));
  const l=byId(A.liftStatus(h,NOW,180),'assisted-pull-up');
  assert.equal(l.status,'pr');assert.ok(l.assist);
  const nc=history(session(10,[['barbell-bench-press',[set(135,8)]]],{now:NOW}),session(3,[['barbell-bench-press',[Object.assign(set(185,8),{nc:true}),set(135,8)]]],{now:NOW}));
  assert.notEqual(byId(A.liftStatus(nc,NOW,180),'barbell-bench-press').status,'pr','a disowned set is not a PR');
});

/* ---- one set of numbers ---- */
function hamstringsLow(){   // enough history for comparisons; hamstrings under the 8/week landmark
  const S=[];for(let d=26;d>=2;d-=4)S.push(session(d,[['barbell-bench-press',[set(135,8),set(135,8),set(135,8)]],['barbell-row',[set(135,8),set(135,8),set(135,8),set(135,8),set(135,8),set(135,8)]],
    ['back-squat',[set(185,5),set(185,5),set(185,5)]],['romanian-deadlift',[set(135,8),set(135,8)]]],{now:NOW}));
  return history(...S);
}
test('consistency: the Muscles chart and the coach quote the SAME weekly number for a low muscle',()=>{
  const h=hamstringsLow(),a=A.analyze(h,NOW),F=A.findings(a,h,NOW,180,{});
  const row=A.muscleWeekly(a,{},F).find(r=>r.group==='Hamstrings');
  assert.ok(row&&row.low,'hamstrings flagged low on the chart');
  const f=A.coachReport(a,h,NOW,180,{},{},A.liftStatus(h,NOW,180)).focus.find(x=>x.type==='volume-low'&&/Hamstrings/.test(x.title));
  assert.ok(f,'…and in Focus');
  assert.ok(f.detail.startsWith(row.perWeek+' sets/week'),`same number: chart ${row.perWeek} vs coach "${f.detail}"`);
  // CONTROL: a muscle at/above target is never "low" on either
  const back=A.muscleWeekly(a,{},F).find(r=>r.group==='Back');assert.ok(back.perWeek>=8&&!back.low,'Back at '+back.perWeek+'/week is not low');
});
test('targets follow the training profile goal (and 2-day weeks)',()=>{
  assert.deepEqual(A.volTargetFor({}),[8,15]);
  assert.deepEqual(A.volTargetFor({goal:'size'}),[10,20]);
  assert.deepEqual(A.volTargetFor({goal:'strength'}),[6,12]);
  assert.equal(A.volTargetFor({goal:'size',days:2})[0],6);
});

/* ---- Coach: Focus + Wins ---- */
test('coachReport: at most 3 to-dos, good news never in Focus, "Got it" hides one, suggestions fit the gym',()=>{
  const h=hamstringsLow(),a=A.analyze(h,NOW),lifts=A.liftStatus(h,NOW,180);
  const r=A.coachReport(a,h,NOW,180,{},{},lifts);
  assert.ok(r.focus.length>0&&r.focus.length<=3);
  assert.ok(r.focus.every(f=>f.title&&f.detail),'every to-do has a headline and the number behind it');
  const k=r.focus[0].key,r2=A.coachReport(a,h,NOW,180,{},{['mute:'+k]:true},lifts);
  assert.ok(!r2.focus.some(f=>f.key===k),'muted to-do hidden');
  const home=A.coachReport(a,h,NOW,180,{gym:'home'},{},lifts);
  home.focus.filter(f=>f.exId).forEach(f=>assert.ok(['Dumbbell','Bodyweight'].includes(IL.data.EX[f.exId].equip)||h.some(s=>s.exercises.some(e=>e.id===f.exId)),
    'home gym: '+f.exName+' must be something you can do there (or already do)'));
});
test('coachReport: several PRs become ONE win line, leaving room for the other wins',()=>{
  const S=[];['barbell-bench-press','barbell-row','back-squat','deadlift','overhead-press'].forEach((id,i)=>{S.push(session(20,[[id,[set(100,5)]]],{now:NOW}));S.push(session(4+i,[[id,[set(110,5)]]],{now:NOW}));});
  const h=history(...S),a=A.analyze(h,NOW),r=A.coachReport(a,h,NOW,180,{},{},A.liftStatus(h,NOW,180));
  const pr=r.wins.filter(w=>w.type==='pr');
  assert.equal(pr.length,1);assert.match(pr[0].title,/^5 new PRs/);
});

/* ---- screens ---- */
function seeded(h){
  const now=Date.now(),S=[];
  for(let d=26;d>=2;d-=4)S.push({id:'s'+d,schema:1,date:now-d*DAY,updatedAt:now,completed:true,exercises:[
    {id:'barbell-bench-press',sets:[{w:135+(26-d),r:8,done:true},{w:135,r:8,done:true}]},{id:'barbell-row',sets:[{w:135,r:8,done:true},{w:135,r:8,done:true}]},
    {id:'back-squat',sets:[{w:185,r:5,done:true},{w:185,r:5,done:true}]}]});
  h.state.sessions=S.sort((a,b)=>b.date-a.date);
}
test('UI: Progress reads lifts → coach → muscles, with the secondary panels folded',()=>{
  const h=launch();
  try{
    seeded(h);h.click('.tab[data-tab="progress"]');
    const t=h.text('#view'),at=s=>t.indexOf(s);
    assert.ok(at('Your lifts')>0&&at('Your lifts')<at('Coach')&&at('Coach')<at('Muscles · sets per week'),'order: lifts, coach, muscles');
    assert.match(h.text('#liftCard'),/Barbell Bench Press.*New PR/,'bench shows as a new PR');
    ['records'].forEach(k=>assert.equal(h.$(`[data-collapse="${k}"]`).getAttribute('aria-expanded'),'false',k+' starts folded'));
    assert.equal(h.$('#prCard'),null,'records list not drawn while folded');
    h.click('[data-collapse="records"]');
    assert.ok(h.$('#prCard'),'opens on tap');assert.equal(h.state.settings.seen['expand:records'],true,'and remembers (synced)');
  }finally{h.teardown();}
});
test('UI: a Focus "Try:" link opens that exercise, and a lift row opens its trend',()=>{
  const h=launch();
  try{
    seeded(h);h.click('.tab[data-tab="progress"]');
    const tr=h.$('#coachCard [data-openex]');
    if(tr){h.click(tr);assert.ok(h.$('#sheet').classList.contains('on'),'Try: opens the exercise');assert.ok(h.$('#sheetBody [data-addto]'),'with its Add button');h.click('#sheetClose');}
    h.click(h.$('#liftCard [data-openex]'));
    assert.ok(h.$('#sheet').classList.contains('on'),'a lift row opens its sheet');
  }finally{h.teardown();}
});
test('UI: Home shows one summary line instead of repeating the Progress tiles',()=>{
  const h=launch();
  try{
    seeded(h);h.IL.ui.render();
    assert.match(h.text('#homeSummary'),/workouts? this week/);
    assert.equal(h.$('#view .statgrid'),null,'no tile grid on Home');
  }finally{h.teardown();}
});
