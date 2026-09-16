// Batch B — data safety (v0.53.0). Each test pins a specific review finding:
//   D1  a live workout that can't be saved (quota) is flagged + surfaced, not lost silently
//   U2  starting a rest stops a running stopwatch (the two bars never stack)
//   U3  leaving the active editor (Home or a tab switch) self-stops the stopwatch
//   U5  ticking a timed set with no seconds is refused (finalizeSets would drop it otherwise)
//   D6  the deleted / seen maps are key-count capped
//   D2  a delete propagates through the artifact backend's shared tombstone doc (no resurrection)
const test=require('node:test'),assert=require('node:assert');
const {launch}=require('./ui-harness.js');
const {IL}=require('./load.js');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function startBlank(h,ids){
  h.click('[data-action="startFlow"]');h.click('[data-action="blank"]');
  ids.forEach(id=>{h.click('#btnAddEx');h.click(h.$$('#addResults [data-quickadd]').find(x=>x.dataset.quickadd===id));});
}

/* ---------------- D6 (pure engine) ---------------- */
test('D6: cleanDeleted caps the tombstone map and keeps the most-recent keys',()=>{
  const big={};for(let i=0;i<6000;i++)big['id'+i]=1000+i;   // later ids have larger timestamps
  const out=IL.sync.cleanDeleted(big);
  const keys=Object.keys(out);
  assert.ok(keys.length<=5000,'capped at MAX_KEYS, got '+keys.length);
  assert.ok(out['id5999'],'the newest tombstone is kept');
  assert.ok(!out['id0'],'the oldest tombstone is dropped over the cap');
});

test('D6: cleanDeleted still admits a normal-sized map untouched',()=>{
  const out=IL.sync.cleanDeleted({a:5,b:6});
  assert.equal(Object.keys(out).length,2);assert.equal(out.a,5);
});

/* ---------------- U5 ---------------- */
test('U5: ticking a timed set with no seconds is refused with a nudge',()=>{
  const h=launch();
  try{
    startBlank(h,['plank']);
    let card=h.$$('#view .log-ex').find(c=>/Plank/.test(c.textContent));
    const clr=card.querySelector('input[data-f="r"]');clr.value='';clr.dispatchEvent(new h.win.Event('input',{bubbles:true}));   // empty the seeded seconds
    const chk=card.querySelector('[data-check]');
    chk.dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));
    card=h.$$('#view .log-ex').find(c=>/Plank/.test(c.textContent));
    assert.ok(!card.querySelector('.set-check').classList.contains('on'),'the set did not tick');
    assert.equal(h.text('#toastMsg'),'Add seconds first','the nudge points at the seconds field');
    // now enter seconds and it ticks
    const ri=card.querySelector('input[data-f="r"]');ri.value='45';ri.dispatchEvent(new h.win.Event('input',{bubbles:true}));
    card.querySelector('[data-check]').dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));
    const after=h.$$('#view .log-ex').find(c=>/Plank/.test(c.textContent));
    assert.ok(after.querySelector('.set-check').classList.contains('on'),'ticks once seconds are entered');
  }finally{h.teardown();}
});

/* ---------------- U2 ---------------- */
test('U2: starting a rest clears a running stopwatch — the bars never stack',()=>{
  const h=launch();
  try{
    startBlank(h,['plank','barbell-bench-press']);
    h.click('#view [data-stopwatch]');   // plank stopwatch → countdown
    assert.ok(h.$('#swbar').classList.contains('on'),'stopwatch bar is up');
    // tick a bench set with a weight → auto-rest fires → startRest must stop the stopwatch
    const bench=h.$$('#view .log-ex').find(c=>/Bench/.test(c.textContent));
    const wi=bench.querySelector('input[data-f="w"]');wi.value='135';wi.dispatchEvent(new h.win.Event('input',{bubbles:true}));
    const ri=bench.querySelector('input[data-f="r"]');ri.value='5';ri.dispatchEvent(new h.win.Event('input',{bubbles:true}));
    bench.querySelector('[data-check]').dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));
    assert.ok(h.$('#restbar').classList.contains('on'),'rest bar is up');
    assert.ok(!h.$('#swbar').classList.contains('on'),'stopwatch bar was cleared');
  }finally{h.teardown();}
});

/* ---------------- U3 (real timer) ---------------- */
test('U3: switching tabs mid-hold self-stops the stopwatch',async()=>{
  const h=launch();
  try{
    startBlank(h,['plank']);
    h.click('#view [data-stopwatch]');
    assert.ok(h.$('#swbar').classList.contains('on'),'stopwatch running');
    h.$$('.tab').find(b=>b.dataset.tab==='history').dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));
    await sleep(250);   // let the ~100ms tick fire on the new tab
    assert.ok(!h.$('#swbar').classList.contains('on'),'the stopwatch stopped itself off the active editor');
  }finally{h.teardown();}
});

/* ---------------- D1 ---------------- */
test('D1: a live workout that can no longer be saved flags storageError and warns',()=>{
  const h=launch();
  try{
    startBlank(h,['barbell-bench-press']);
    assert.ok(!h.state.storageError,'clean so far');
    // simulate the disk filling mid-session: every write now throws (patch the prototype — jsdom ignores an instance override)
    h.win.Storage.prototype.setItem=function(){throw new Error('QuotaExceededError');};
    // a set-edit tap goes through persistCur → persistActive
    const card=h.$$('#view .log-ex')[0];
    card.querySelector('[data-step][data-d="1"]').dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));
    assert.ok(h.state.storageError,'storageError is set on the failed live save');
    assert.match(h.text('#toastMsg'),/Storage is full/,'the user is warned');
  }finally{h.teardown();}
});

/* ---------------- D2 (artifact backend, fake db) ---------------- */
function fakeDb(){
  const docCbs={},colCbs={},sets={};
  const db={
    doc(path){return {
      get:async()=>({exists:false,data:()=>null}),
      set:async(v)=>{(sets[path]=sets[path]||[]).push(v);},
      delete:async()=>{},
      onSnapshot(cb){docCbs[path]=cb;return ()=>{};}
    };},
    collection(name){return {onSnapshot(cb){colCbs[name]=cb;cb({docs:[]});return ()=>{};}};},
    _fireDoc(path,data){if(docCbs[path])docCbs[path]({exists:true,data:()=>data});},
    _sets:sets
  };
  return db;
}

test('D2: a remote tombstone doc removes a session locally instead of leaving it to be resurrected',async()=>{
  const h=launch();
  try{
    // seed a completed session directly, then wire the artifact backend
    const now=Date.now();
    const s={id:'sess-x',date:now,completed:true,updatedAt:now-10000,exercises:[{id:'barbell-bench-press',name:'Bench',sets:[{w:135,r:5,done:true}]}]};
    h.state.sessions=[s];
    const db=fakeDb();
    h.win.claude={use:async(x)=>x==='db'?db:null};
    await h.S.initCloud();
    assert.equal(h.state.cloudName,'artifact','artifact adapter is active');
    assert.ok(h.state.sessions.some(x=>x.id==='sess-x'),'session present before the tombstone');
    // another device deleted it: the shared meta/deleted doc arrives
    db._fireDoc('meta/deleted',{map:{'sess-x':now},updatedAt:now});
    assert.ok(!h.state.sessions.some(x=>x.id==='sess-x'),'the session is removed locally');
    assert.ok(h.state.deleted['sess-x'],'and recorded as a tombstone so it will not come back');
  }finally{h.teardown();}
});

test('D2: deleting a session publishes the tombstone doc to the artifact backend',async()=>{
  const h=launch();
  try{
    const s={id:'sess-y',date:Date.now(),completed:true,updatedAt:1000,exercises:[{id:'barbell-bench-press',name:'Bench',sets:[{w:135,r:5,done:true}]}]};
    h.state.sessions=[s];
    const db=fakeDb();
    h.win.claude={use:async(x)=>x==='db'?db:null};
    await h.S.initCloud();
    h.S.deleteSession('sess-y');
    assert.ok(db._sets['meta/deleted'],'the tombstone doc was written on delete');
    assert.ok(db._sets['meta/deleted'].slice(-1)[0].map['sess-y'],'and it carries the deleted id');
  }finally{h.teardown();}
});
