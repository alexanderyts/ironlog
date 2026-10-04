// v0.76.0 — from a real workout: machine weights made plain (pin vs plate-loaded; "Both arms", not
// "Both sides"), the Add-exercise search above the keyboard, and set ticks that keep your place.
const test=require('node:test'),assert=require('node:assert/strict');
const {IL}=require('./load.js');
const {launch}=require('./ui-harness.js');

function startBlank(h){h.click('[data-action="startFlow"]');h.click('[data-action="blank"]');}
function addEx(h,id){h.click('#btnAddEx');h.click(h.$$('#addResults [data-quickadd]').find(x=>x.dataset.quickadd===id));}
const card=(h,id)=>h.$(`#view .log-ex[data-ei="${h.state.active.exercises.findIndex(e=>e.id===id)}"]`);

test('UI: a machine marked plate-loaded says "Plates lb", explains it, and loads the plates per side',()=>{
  const h=launch();
  try{
    startBlank(h);addEx(h,'leg-press');
    let c=card(h,'leg-press');
    assert.match(c.querySelector('[data-mode]').textContent,/^Machine ▾/);
    assert.doesNotMatch(c.querySelector('.set-hdr').textContent,/Plates/);
    assert.ok(!c.querySelector('[data-plates]'),'a pin machine has no plate loader');
    h.click(c.querySelector('[data-mode]'));
    const rows=h.$$('#sheetBody [data-pickmode="machine"]');
    assert.equal(rows.length,2);assert.match(rows[0].textContent,/pin \/ weight stack.*default/s);assert.ok(rows[0].classList.contains('on'));
    h.click(rows.find(r=>r.dataset.pl==='1'));
    assert.deepEqual({...h.state.settings.plates},{'leg-press':true});   // spread: the app's object is from jsdom's realm
    assert.equal(h.state.active.exercises[0].mode,undefined,'still the machine track: same history, same records');
    c=card(h,'leg-press');
    assert.match(c.querySelector('[data-mode]').textContent,/Plate-loaded/);
    assert.match(c.querySelector('.set-hdr').textContent,/Plates Lb/);
    assert.match(h.text('.platehint'),/all the plates on the machine, both sides/);
    // the loader: 180 = two 45s on each side, with no bar to take off
    h.type(c.querySelector('input[data-f="w"]'),'180');
    h.click(card(h,'leg-press').querySelector('[data-plates]'));
    assert.match(h.text('#sheetBody'),/each side of the machine/i);assert.ok(!h.has('#plBar'),'no bar-weight row');
    assert.deepEqual(h.$$('#plateOut .plate').map(x=>x.textContent),['45','45']);
    // and back to a pin machine
    h.click('#sheetClose');h.click(card(h,'leg-press').querySelector('[data-mode]'));
    h.click(h.$$('#sheetBody [data-pickmode="machine"]').find(r=>r.dataset.pl==='0'));
    assert.equal(h.state.settings.plates,undefined);
    assert.doesNotMatch(card(h,'leg-press').querySelector('.set-hdr').textContent,/Plates/);
  }finally{h.teardown();}
});

test('settings keep plate-loaded marks — true only',()=>{
  assert.deepEqual(IL.sync.cleanSettings({plates:{'leg-press':true,'hack-squat':'yes','belt-squat':1}}).plates,{'leg-press':true});
  assert.equal(IL.sync.cleanSettings({plates:{}}).plates,undefined);
});

test('UI: the ⇆ button says arms or legs, not "sides"',()=>{
  const h=launch();
  try{
    startBlank(h);addEx(h,'machine-chest-press');addEx(h,'leg-extension');
    assert.match(card(h,'machine-chest-press').querySelector('[data-side]').textContent,/Both arms/);
    assert.match(card(h,'leg-extension').querySelector('[data-side]').textContent,/Both legs/);
    h.click(card(h,'leg-extension').querySelector('[data-side]'));
    const c=card(h,'leg-extension');
    assert.match(c.querySelector('[data-side]').textContent,/One leg at a time/);
    assert.match(c.querySelector('.set-hdr').textContent,/Reps \/ leg/);
  }finally{h.teardown();}
});

test('UI: Add exercise — searching clears the smart picks, so results sit right under the box',()=>{
  const h=launch();
  try{
    startBlank(h);addEx(h,'barbell-bench-press');
    h.click('#btnAddEx');
    assert.ok(h.has('#addPicks')&&!h.$('#addPicks').hidden,'picks shown first');
    h.$('#addSearch').focus();
    assert.ok(h.$('#addPicks').hidden,'gone once you start searching');
    h.type('#addSearch','burpee');
    assert.equal(h.$('#addResults [data-quickadd]').dataset.quickadd,'burpee');
  }finally{h.teardown();}
});

test('UI: ticking a set lets go of a field first and keeps the ✓ under your thumb',()=>{
  const h=launch();
  try{
    startBlank(h);addEx(h,'leg-press');
    h.state.active.exercises[0].sets.forEach(s=>{s.w=100;s.r=10;});h.IL.ui.render();
    const inp=h.$('input[data-f="w"][data-s="1"]');inp.focus();let blurred=false;inp.addEventListener('blur',()=>{blurred=true;});
    // something above the row grows on re-render (a ★ PR line): the ✓ would land 40px lower
    let n=0;const gb=h.win.Element.prototype.getBoundingClientRect;
    h.win.Element.prototype.getBoundingClientRect=function(){return this.matches('[data-check]')?{top:n++===0?300:340,bottom:0,left:0,right:0,width:0,height:0}:gb.call(this);};
    const by=[];h.win.scrollBy=(x,y)=>by.push([x,y]);
    h.click('[data-check="0"][data-s="0"]');
    assert.equal(h.state.active.exercises[0].sets[0].done,true);
    assert.ok(blurred,'the keyboard closes the ordinary way, not by the field vanishing');
    assert.deepEqual(by,[[0,40]],'the page moves with it');
  }finally{h.teardown();}
});
