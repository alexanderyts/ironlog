// v0.67.0 — safety nets from the full review §8. None of these test a feature; they stop a whole
// class of mistake from shipping quietly.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path');
const {launch}=require('./ui-harness.js');
const build=require('../build.js');
const DAY=86400000;
const root=path.join(__dirname,'..');
const norm=s=>s.replace(/\r\n/g,'\n');

/* The committed site must be what the source builds — a forgotten `node build.js` would ship stale
   code to the phone (the home-screen app loads docs/, not src/). Includes the CSP hashes. */
test('the built files match the source (run `node build.js` if this fails)',()=>{
  const pairs=[['docs/index.html',build.site],['docs/sw.js',build.sw]];
  if(fs.existsSync(path.join(root,'dist/app.html')))pairs.push(['dist/app.html',build.artifact],['dist/demo.html',build.demo]);
  pairs.forEach(([f,want])=>assert.ok(norm(fs.readFileSync(path.join(root,f),'utf8'))===norm(want),f+' is stale — run node build.js'));
  assert.match(build.site,/sha256-/,'the site carries CSP script hashes');
});

/* Bad saved data must never blank a tab. Storage can hold anything: an old app version's shape, a
   half-written record, a hand-edited backup. Every tab must still draw (the error boundary's
   "Something went wrong" counts as a failure here). */
test('weird saved data does not blank any tab',()=>{
  const now=Date.now();
  const junk=[
    {id:'a',date:now-DAY,completed:true,exercises:[{id:'barbell-bench-press',sets:[{w:'abc',r:'5',done:true},{w:null,r:null},{}]}]},
    {id:'b',date:now-2*DAY,completed:true,exercises:[{id:'no-such-exercise',sets:[{w:100,r:5,done:true}]}]},
    {id:'c',date:now-3*DAY,completed:true,exercises:[{id:'plank',sets:[{w:0,r:-30,done:true,at:'x'}]}]},
    {id:'d',date:now-4*DAY,completed:true,exercises:[]},
    {id:'e',date:now-5*DAY,completed:true,kind:'cardio',exercises:[],cardio:{type:'nope',intensity:7}},
    {id:'f',date:now-6*DAY,completed:true,exercises:[{id:'assisted-pull-up',sets:[{w:999,r:0,done:true,nc:true}]}],bw:'heavy',endedAt:-5},
    {id:'g',date:now-7*DAY,completed:true,exercises:[{id:'barbell-row',sets:[{w:1e9,r:1e6,done:true}],side:'weird',mode:'rocket'}]},
  ];
  const h=launch({storage:{il_sessions:junk,il_settings:{unit:'lb',bodyweight:180,profile:{goal:'banana'}}}});
  try{
    ['today','history','library','progress'].forEach(t=>{
      h.click('.tab[data-tab="'+t+'"]');
      assert.doesNotMatch(h.text('#view'),/Something went wrong/,t+' tab drew');
      assert.ok(h.text('#view').length>20,t+' tab is not blank');
    });
    h.click('.tab[data-tab="history"]');h.click('[data-sess="a"]');
    assert.ok(h.$('#sheet').classList.contains('on'),'a junk session still opens');
  }finally{h.teardown();}
});

/* Speed guard at 2,000 workouts — by COUNTING work, not timing it (timings flake on a busy machine).
   Every session's `exercises` read is counted: a full Progress render may scan history a handful of
   times, but an accidental per-session rescan (O(n²)) would read it thousands of times per session. */
test('speed guard: Progress at 2,000 workouts scans history a bounded number of times',()=>{
  const now=Date.now(),ids=['barbell-bench-press','back-squat','deadlift','lat-pulldown','barbell-curl','plank'];
  const sessions=[];for(let i=0;i<2000;i++)sessions.push({id:'s'+i,schema:1,date:now-(i+1)*DAY/2,updatedAt:now,completed:true,
    exercises:[0,1,2].map(k=>({id:ids[(i+k)%ids.length],sets:[{w:100+i%20,r:5+k,done:true},{w:100+i%20,r:5,done:true}]}))});
  const h=launch({storage:{il_sessions:sessions}});
  try{
    let reads=0;
    h.state.sessions.forEach(s=>{let ex=s.exercises;Object.defineProperty(s,'exercises',{get(){reads++;return ex;},set(v){ex=v;},enumerable:true,configurable:true});});
    h.click('.tab[data-tab="progress"]');
    const first=reads/2000;
    assert.ok(first<80,'first Progress render reads each session '+first.toFixed(1)+'× (an O(n²) slip would be ~2000×)');
    reads=0;h.IL.ui.render();
    assert.ok(reads/2000<first,'a re-render with unchanged data reuses cached stats ('+(reads/2000).toFixed(1)+'× vs '+first.toFixed(1)+'×)');
  }finally{h.teardown();}
});

/* The one-time bodyweight stamp (D-1): old workouts get the bodyweight known at the time, once, so
   their bodyweight-lift maths stops drifting when the setting changes later. */
test('bodyweight stamp: old workouts are frozen once at the current bodyweight, never re-stamped',()=>{
  const now=Date.now();
  const old=[{id:'o1',schema:1,date:now-9*DAY,updatedAt:now-9*DAY,completed:true,exercises:[{id:'pull-up',sets:[{w:0,r:10,done:true}]}]},
             {id:'o2',schema:1,date:now-5*DAY,updatedAt:now-5*DAY,completed:true,bw:170,exercises:[{id:'pull-up',sets:[{w:0,r:8,done:true}]}]}];
  const h=launch({storage:{il_sessions:old,il_settings:{unit:'lb',bodyweight:180}}});
  try{
    const by=id=>h.state.sessions.find(s=>s.id===id);
    assert.equal(by('o1').bw,180,'an unstamped workout takes the bodyweight known now');
    assert.equal(by('o2').bw,170,'an already-stamped workout keeps its own');
    assert.equal(by('o1').updatedAt,now-9*DAY,'a local fill — no updatedAt bump, so no mass re-upload');
    assert.equal(h.win.localStorage.getItem('il_bwfrozen'),'1');
  }finally{h.teardown();}
  // next boot, weight has changed: nothing is re-stamped
  const h2=launch({storage:{il_sessions:[Object.assign({},old[0],{bw:180}),old[1]],il_settings:{unit:'lb',bodyweight:200},il_bwfrozen:1}});
  try{assert.equal(h2.state.sessions.find(s=>s.id==='o1').bw,180,'frozen stays frozen after a bodyweight change');}
  finally{h2.teardown();}
  // CONTROL: no bodyweight known yet → nothing stamped and the freeze waits
  const h3=launch({storage:{il_sessions:old,il_settings:{unit:'lb',bodyweight:0}}});
  try{assert.equal(h3.state.sessions.find(s=>s.id==='o1').bw,undefined);assert.equal(h3.win.localStorage.getItem('il_bwfrozen'),null,'still waiting for a bodyweight');}
  finally{h3.teardown();}
});
