// Per-side accounting ("⇆ Each side") + auto-slotting a newly added exercise.
// Volume = weight × reps × holds (copies of the weight moving: a pair of dumbbells, two cable stacks)
//                       × sides (reps done once per side: one arm / one leg at a time).
const test=require('node:test'),assert=require('node:assert');
const {IL,session,set,history}=require('./load.js');
const P=IL.prog,A=IL.analysis,B=IL.builder;
const vol=(id,w,r,side,mode)=>{const s=session(1,[[id,[set(w,r)]]]);if(side!=null)s.exercises[0].side=side;if(mode)s.exercises[0].mode=mode;return P.sessionVolume(s,0);};

/* ---- volume: every common shape counts what was actually lifted ---- */
test('a pair of dumbbells counts both (the field is per dumbbell)',()=>{
  assert.equal(vol('dumbbell-bench-press',50,10),1000);
});
test('a ONE-dumbbell lift counts once (goblet squat)',()=>{
  assert.equal(vol('goblet-squat',50,10),500);
});
test('one dumbbell, one side at a time, counts both sides (dumbbell row)',()=>{
  assert.equal(vol('dumbbell-row',60,10),1200);
});
test('a one-arm cable lift counts both sides',()=>{
  assert.equal(vol('single-arm-cable-row',40,10),800);
});
test('the owner’s case: one-arm cable curl 20/side vs two-hand bar 45 — both honest',()=>{
  assert.equal(vol('cable-curl',45,10),450,'two hands on one 45 stack = 45 × 10, NOT per arm');
  assert.equal(vol('cable-curl',20,10,true),400,'switched to each side: 20 × 10 × 2 sides');
});
test('dumbbell lunges: two dumbbells AND reps per leg',()=>{
  assert.equal(vol('walking-lunge',25,10),1000,'25 × 2 dumbbells × 10 reps × 2 legs');
});
test('a two-stack cable fly counts each stack',()=>{
  assert.equal(vol('cable-crossover',20,10),400);
});
test('a dumbbell lift switched to one side at a time is ONE dumbbell (volume unchanged)',()=>{
  assert.equal(vol('dumbbell-shoulder-press',40,10),800,'both arms, two dumbbells');
  assert.equal(vol('dumbbell-shoulder-press',40,10,true),800,'one arm at a time, one dumbbell, per side');
});
test('CONTROL: barbell and machine lifts are untouched',()=>{
  assert.equal(vol('barbell-bench-press',135,5),675);
  assert.equal(vol('leg-press',200,10),2000);
});

/* ---- tracks: a lift done the other way round keeps its own history ---- */
test('trackOf equals the equipment for a lift on its default, and differs when flipped',()=>{
  const d={id:'cable-curl'},f={id:'cable-curl',side:true},same={id:'dumbbell-row',side:true};
  assert.equal(P.trackOf(d),'cable');
  assert.notEqual(P.trackOf(f),'cable');
  assert.equal(P.trackOf(same),'dumbbell','a flag equal to the default is not a new track');
});
test('PRs: the one-arm cable curl never competes with the two-hand bar',()=>{
  const two=session(9,[['cable-curl',[set(45,10)]]]);
  const one=session(2,[['cable-curl',[set(20,12)]]]);one.exercises[0].side=true;
  const prs=A.personalRecords(history(two,one),0,99).filter(p=>p.id==='cable-curl');
  assert.equal(prs.length,2,'two separate records');
  const oneArm=prs.find(p=>p.sides===2),bar=prs.find(p=>p.sides===1);
  assert.equal(oneArm.w,20);assert.equal(bar.w,45);
});
test('suggestions and seeding follow the side you used last',()=>{
  const two=session(9,[['cable-curl',[set(45,10),set(45,10)]]]);
  const one=session(2,[['cable-curl',[set(20,12),set(20,12)]]]);one.exercises[0].side=true;
  const inst=B.seedExercise('cable-curl',history(two,one),{unit:'lb'});
  assert.equal(inst.side,true,'the "each side" choice is remembered like the equipment');
  assert.ok(inst.sets.every(s=>+s.w<=25),'prefilled from the one-arm history, not the 45 lb bar: '+inst.sets.map(s=>s.w).join(','));
});
test('the side flag survives backup/cloud cleaning; junk is dropped',()=>{
  const ok=IL.sync.cleanSession({id:'a',date:1,exercises:[{id:'cable-curl',side:true,sets:[{w:20,r:10,done:true}]}]});
  assert.equal(ok.exercises[0].side,true);
  const junk=IL.sync.cleanSession({id:'a',date:1,exercises:[{id:'cable-curl',side:'yes',sets:[]}]});
  assert.equal(junk.exercises[0].side,undefined);
});

/* ---- UI ---- */
const {launch}=require('./ui-harness.js');
function startBlank(h){h.click('[data-action="startFlow"]');h.click('[data-action="blank"]');}
function addEx(h,id){h.click('#btnAddEx');h.click(h.$$('#addResults [data-quickadd]').find(x=>x.dataset.quickadd===id));}
const card=(h,re)=>h.$$('#view .log-ex').find(c=>re.test(c.querySelector('.ex-name').textContent));

test('UI: the ⇆ chip shows on a cable lift (not a barbell one) and flips the headers',()=>{
  const h=launch();
  try{
    startBlank(h);addEx(h,'cable-curl');addEx(h,'barbell-bench-press');
    assert.ok(card(h,/Cable Curl/).querySelector('[data-side]'),'cable curl has the chip');
    assert.ok(!card(h,/Barbell Bench/).querySelector('[data-side]'),'barbell bench does not');
    card(h,/Cable Curl/).querySelector('[data-side]').dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));
    const cc=card(h,/Cable Curl/);
    assert.match(cc.querySelector('.set-hdr').textContent,/Reps \/ side/);
    assert.equal(h.state.active.exercises.find(e=>e.id==='cable-curl').side,true);
    cc.querySelector('[data-side]').dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));
    assert.equal(h.state.active.exercises.find(e=>e.id==='cable-curl').side,undefined,'back to default = no flag stored');
  }finally{h.teardown();}
});
test('UI: headers say what to type — "Lb ea" for a pair of dumbbells, plain "Lb" for one',()=>{
  const h=launch();
  try{
    startBlank(h);addEx(h,'dumbbell-bench-press');addEx(h,'goblet-squat');
    assert.match(card(h,/Dumbbell Bench/).querySelector('.set-hdr').textContent,/Lb ea/);
    assert.doesNotMatch(card(h,/Goblet/).querySelector('.set-hdr').textContent,/ea/);
  }finally{h.teardown();}
});

test('UI: an added lift slots in by priority among exercises not yet started',()=>{
  const h=launch();
  try{
    startBlank(h);addEx(h,'lateral-raise');addEx(h,'tricep-pushdown');
    addEx(h,'barbell-bench-press');   // nothing started → the big press goes first
    assert.equal(h.state.active.exercises[0].id,'barbell-bench-press');
  }finally{h.teardown();}
});
test('UI: an added lift never jumps ahead of an exercise you have started',()=>{
  const h=launch();
  try{
    startBlank(h);addEx(h,'lateral-raise');
    const lr=h.state.active.exercises[0];lr.sets[0].w=15;lr.sets[0].done=true;   // lateral raise is under way
    addEx(h,'barbell-bench-press');
    assert.deepEqual(h.state.active.exercises.map(e=>e.id),['lateral-raise','barbell-bench-press']);
  }finally{h.teardown();}
});
