// Batch C — performance (v0.54.0). The behaviour these fixes must NOT change is already covered by the
// Progress/editor tests; here we pin the perf contract itself:
//   P2  the derived-stats layer is memoized — a re-render that doesn't change the data (a collapse
//       toggle, a cloud ping) reuses the cached scan instead of re-running it, and a data change busts it.
//   P2  the live editor reuses the all-time-PR scan across set ticks (history is unchanged mid-workout).
//   P1  the viewport rAF loop stops once the viewport settles instead of writing DOM forever.
const test=require('node:test'),assert=require('node:assert');
const {launch}=require('./ui-harness.js');
const DAY=86400000;

function sess(id,date,sets){return {id,schema:1,date,updatedAt:date,completed:true,
  exercises:[{id:'barbell-bench-press',name:'Bench',sets:sets.map(([w,r])=>({w,r,done:true}))}]};}

// Wrap an engine function on the live IL so we can count how often the real scan runs.
function countCalls(obj,name){
  const orig=obj[name];let n=0;
  obj[name]=function(){n++;return orig.apply(this,arguments);};
  return {get:()=>n,restore:()=>{obj[name]=orig;}};
}

test('P2: a collapse toggle re-renders Progress without re-scanning history (memo hit)',()=>{
  const h=launch();
  try{
    const now=Date.now(),ws=h.IL.prog.weekStart(now);
    h.state.sessions=[sess('a',ws-2*DAY,[[100,8],[100,8]]),sess('b',ws-9*DAY,[[95,8]])];
    h.click('.tab[data-tab="progress"]');
    const wv=countCalls(h.IL.analysis,"weeklyVolumes"),pr=countCalls(h.IL.analysis,"personalRecords");
    // toggle a collapsible panel (Coach's notes) — this calls render()→viewProgress again
    const head=h.$$('[data-collapse]')[0];
    assert.ok(head,'there is a collapsible panel to toggle');
    head.dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));
    head.dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));
    assert.equal(wv.get(),0,'weeklyVolumes was not re-scanned on a collapse toggle');
    assert.equal(pr.get(),0,'personalRecords was not re-scanned on a collapse toggle');
    wv.restore();pr.restore();
  }finally{h.teardown();}
});

test('P2: changing the data busts the memo — stats recompute and reflect the change',()=>{
  const h=launch();
  try{
    const now=Date.now(),ws=h.IL.prog.weekStart(now);
    h.state.sessions=[sess('a',ws+60000,[[100,8],[100,8]])];
    h.click('.tab[data-tab="progress"]');
    const setsTile=()=>{const c=h.$$('.stat').find(x=>x.querySelector('.k')&&x.querySelector('.k').textContent.trim()==='Sets this week');return +c.querySelector('.v').textContent.match(/\d+/)[0];};
    assert.equal(setsTile(),2,'two working sets this week');
    // a new session lands (different length + updatedAt) → memo sig changes
    h.state.sessions=[sess('a',ws+60000,[[100,8],[100,8]]),sess('c',ws+120000,[[100,8]])];
    h.click('.tab[data-tab="today"]');h.click('.tab[data-tab="progress"]');
    assert.equal(setsTile(),3,'the tile reflects the new set — the cache did not go stale');
  }finally{h.teardown();}
});

test('P2: the live editor computes each card’s all-time PR once, not per set tick',()=>{
  const h=launch();
  try{
    // seed history so bestSetBefore has something to scan, then start a fresh bench workout
    const now=Date.now();
    h.state.sessions=[sess('h1',now-5*DAY,[[135,5]]),sess('h2',now-9*DAY,[[130,5]])];
    h.click('[data-action="startFlow"]');h.click('[data-action="blank"]');
    h.click('#btnAddEx');h.click(h.$$('#addResults [data-quickadd]').find(x=>x.dataset.quickadd==='barbell-bench-press'));
    const be=countCalls(h.IL.prog,"bestSetBefore");   // the live PR now uses the one judge's bestSetBefore (memoized)
    // tick a set, untick, re-tick — several editor re-renders, same unchanged history
    const card=h.$$('#view .log-ex')[0];
    const wi=card.querySelector('input[data-f="w"]');wi.value='140';wi.dispatchEvent(new h.win.Event('input',{bubbles:true}));
    const ri=card.querySelector('input[data-f="r"]');ri.value='5';ri.dispatchEvent(new h.win.Event('input',{bubbles:true}));
    for(let i=0;i<3;i++){h.$$('#view .log-ex')[0].querySelector('[data-check]').dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));}
    assert.equal(be.get(),0,'the all-time-PR scan did not re-run on any tick (served from the memo primed on entry)');
    be.restore();
  }finally{h.teardown();}
});

test('P1: the viewport rAF loop stops itself once the viewport is stable',()=>{
  const h=launch({fakeClock:true});   // virtual clock: frames and the 3 s cap without real waiting
  try{
    // Count requestAnimationFrame scheduling. In jsdom the viewport never changes, so the loop reaches
    // its stable threshold (or the 5s hard cap) and stops. Wait past the cap, THEN confirm no more
    // frames are being scheduled — the old always-on loop would keep incrementing forever.
    let raf=0;const orig=h.win.requestAnimationFrame;
    h.win.requestAnimationFrame=function(cb){raf++;return orig.call(h.win,cb);};
    h.clock.tick(3800);   // past the loop's 3s elapsed cap
    const a=raf;
    h.clock.tick(500);
    assert.equal(raf-a,0,'no frames scheduled after the loop settled (delta='+(raf-a)+')');
    // review finding #3: a rotate can be followed by an eventless settle, so it must RE-ARM the loop
    h.win.dispatchEvent(new h.win.Event('orientationchange'));
    h.clock.tick(120);
    assert.ok(raf-a>0,'the loop re-armed after orientationchange (delta='+(raf-a)+')');
  }finally{h.teardown();}
});
