// D-4: plate calculator. platesPerSide() is pure math; the UI wiring shows the sheet only for
// barbell/Smith lifts and remembers the bar weight per unit.
const test=require('node:test'),assert=require('node:assert');
const {IL}=require('./load.js');
const P=IL.prog;
const flat=r=>r.plates.flatMap(p=>Array(p.count).fill(p.plate));   // per-side plates, largest first

test('lb: 135 on a 45 bar = one 45 per side',()=>{
  assert.deepEqual(flat(P.platesPerSide(135,45,'lb')),[45]);
});
test('lb: 225 = 45 + 45 per side; 185 = 45 + 25; 100 = 25 + 2.5',()=>{
  assert.deepEqual(flat(P.platesPerSide(225,45,'lb')),[45,45]);
  assert.deepEqual(flat(P.platesPerSide(185,45,'lb')),[45,25]);
  assert.deepEqual(flat(P.platesPerSide(100,45,'lb')),[25,2.5]);   // (100−45)/2 = 27.5 = 25 + 2.5
});
test('kg: 100 on a 20 bar = 25 + 15 per side (greedy, largest first)',()=>{
  assert.deepEqual(flat(P.platesPerSide(100,20,'kg')),[25,15]);   // (100−20)/2 = 40 = 25 + 15
});
test('just the bar / below the bar → no plates, with a flag',()=>{
  const bar=P.platesPerSide(45,45,'lb');assert.equal(bar.plates.length,0);assert.equal(bar.belowBar,false);
  const under=P.platesPerSide(30,45,'lb');assert.equal(under.plates.length,0);assert.equal(under.belowBar,true);
});
test('an un-plateable remainder is reported as leftover, not forced',()=>{
  const r=P.platesPerSide(48,45,'lb');   // (48−45)/2 = 1.5 per side; smallest lb plate is 2.5
  assert.equal(r.plates.length,0);assert.equal(r.leftover,1.5);
});
test('a custom (lighter) bar changes the plates',()=>{
  assert.deepEqual(flat(P.platesPerSide(75,35,'lb')),[10,10],'(75−35)/2 = 20 = 10 + 10 (no 20lb plate)');
});

/* ---- UI wiring ---- */
const {launch}=require('./ui-harness.js');
function startBlank(h){h.click('[data-action="startFlow"]');h.click('[data-action="blank"]');}
function addEx(h,id){h.click('#btnAddEx');h.click(h.$$('#addResults [data-quickadd]').find(x=>x.dataset.quickadd===id));}
test('the 🏋 Plates button shows on a barbell lift, not on a machine lift',()=>{
  const h=launch();
  try{
    startBlank(h);addEx(h,'barbell-bench-press');addEx(h,'machine-chest-press');
    const cards=h.$$('#view .log-ex');
    const bb=cards.find(c=>/Barbell Bench/.test(c.textContent));
    const mc=cards.find(c=>/Machine Chest/.test(c.textContent));
    assert.ok(bb.querySelector('[data-plates]'),'barbell lift has the plates button');
    assert.ok(!mc.querySelector('[data-plates]'),'machine lift does not');
  }finally{h.teardown();}
});
test('tapping Plates opens the loader seeded from the top working set; the breakdown renders',()=>{
  const h=launch();
  try{
    startBlank(h);addEx(h,'barbell-bench-press');
    const card=h.$$('#view .log-ex')[0];
    h.type(card.querySelector('input[data-f="w"]'),'135');
    card.querySelector('[data-plates]').dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));
    assert.ok(h.has('.plates'),'the plate sheet is open');
    const plateChips=h.$$('.plates .plate').map(p=>p.textContent);
    assert.deepEqual(plateChips,['45'],'135 on the default 45 bar shows one 45 per side');
  }finally{h.teardown();}
});
test('the bar weight is remembered per unit',()=>{
  const h=launch();
  try{
    startBlank(h);addEx(h,'barbell-bench-press');
    const card=h.$$('#view .log-ex')[0];
    card.querySelector('[data-plates]').dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));
    h.$$('[data-plbar]').find(b=>b.dataset.plbar==='-1').dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));   // 45 → 40
    assert.equal(h.state.settings.bar.lb,40,'the new bar weight is saved for lb');
  }finally{h.teardown();}
});
