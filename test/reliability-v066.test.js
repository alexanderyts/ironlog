// v0.66.0 — reliability & accessibility (full review §7: 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.11).
// Each fix gets an oracle at the layer the bug lived in (the real adapter, the real screen), plus a
// control where a change could over-reach.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path');
const {launch}=require('./ui-harness.js');
const DAY=86400000;

function fakeDropbox(h){
  let rev=1;const uploads=[];
  let file=JSON.stringify({app:'ironlog',format:2,version:'0.0.0',sessions:[],routines:[],deleted:{}});
  h.win.IL.dropbox={isConfigured:()=>true,isConnected:()=>true,handleRedirect:async()=>{},connect(){},disconnect(){},
    getMetadata:async()=>({rev}),download:async()=>({text:file,rev}),
    upload:async(text)=>{uploads.push(text);file=text;rev++;return 'r'+rev;}};
  return uploads;
}
const click=(h,el)=>el.dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));

/* ---- 7.11: a workout in progress reaches Dropbox on its own ---- */
test('7.11: an in-progress workout uploads to Dropbox without any other change to carry it',async()=>{
  const h=launch();
  try{
    const uploads=fakeDropbox(h);
    await h.S.initCloud();assert.equal(h.state.cloudName,'dropbox');
    await h.state.cloud.flush();const base=uploads.length;
    h.click('[data-action="startFlow"]');h.click('[data-action="blank"]');
    h.click('#btnAddEx');h.click(h.$$('#addResults [data-quickadd]').find(x=>x.dataset.quickadd==='barbell-bench-press'));
    h.state.cloud.pushActive();   // what persistActive's 1.5 s debounce calls
    await h.state.cloud.flush();
    assert.ok(uploads.length>base,'the live workout uploaded');
    const f=JSON.parse(uploads[uploads.length-1]);
    assert.ok(f.active&&f.active.exercises.some(e=>e.id==='barbell-bench-press'),'and the file carries it');
    // CONTROL: nothing new → still no upload
    const n=uploads.length;await h.state.cloud.flush();
    assert.equal(uploads.length,n,'a no-op still does not upload');
  }finally{h.teardown();}
});

/* ---- 7.4: sync pings don't redraw the screen; real changes wait for the typist ---- */
test('7.4: a sync status ping updates only the badge — the screen is not redrawn',()=>{
  const h=launch();
  try{
    const before=h.$('#view').firstElementChild;
    h.state.syncing=true;h.S.emit('status');h.state.syncing=false;h.S.emit('status');
    assert.equal(h.$('#view').firstElementChild,before,'same DOM node → no re-render');
    h.S.emit();   // CONTROL: a data change does re-render
    assert.notEqual(h.$('#view').firstElementChild,before,'a data change still redraws');
  }finally{h.teardown();}
});
test('7.4: a data change that lands mid-typing waits, then renders once the field is left',()=>{
  const h=launch();
  try{
    h.click('[data-action="startFlow"]');h.click('[data-action="blank"]');
    h.click('#btnAddEx');h.click(h.$$('#addResults [data-quickadd]').find(x=>x.dataset.quickadd==='barbell-bench-press'));
    const inp=h.$('#view input[data-f="w"]');inp.focus();
    const node=h.$('#view .log-ex');
    h.state.sessions.push({id:'remote',schema:1,date:Date.now()-2*DAY,updatedAt:Date.now(),completed:true,exercises:[{id:'deadlift',sets:[{w:225,r:5,done:true}]}]});
    h.S.emit();
    assert.equal(h.$('#view .log-ex'),node,'not redrawn while the weight field has focus');
    assert.equal(h.win.document.activeElement,inp,'focus kept');
    inp.blur();inp.dispatchEvent(new h.win.FocusEvent('focusout',{bubbles:true}));
    return new Promise(r=>setTimeout(r,20)).then(()=>{
      assert.notEqual(h.$('#view .log-ex'),node,'redrawn once the field was left (not skipped forever)');
    });
  }finally{setTimeout(()=>h.teardown(),30);}
});

/* ---- 7.5: stale copies ---- */
test('7.5: a note saved after a sync replaced the workout lands in the LIVE copy',()=>{
  const h=launch();
  try{
    h.click('[data-action="startFlow"]');h.click('[data-action="blank"]');
    h.click('#btnAddEx');h.click(h.$$('#addResults [data-quickadd]').find(x=>x.dataset.quickadd==='barbell-bench-press'));
    click(h,h.$('#view [data-exmenu]'));click(h,h.$('#sheetBody [data-exact="note"]'));
    // a sync swaps in a fresh copy of the same workout (what absorbRemote/resolveActive does)
    h.state.active=JSON.parse(JSON.stringify(h.state.active));
    h.$('#noteText').value='left shoulder pinchy';click(h,h.$('#noteSave'));
    assert.equal(h.state.active.exercises[0].note,'left shoulder pinchy','saved into the object that is actually persisted');
    assert.ok(/pinchy/.test(h.win.localStorage.getItem('il_active')),'and it reached storage');
  }finally{h.teardown();}
});
test('7.5: Settings rest toggles write to the live settings after a sync swapped them',()=>{
  const h=launch();
  try{
    h.IL.ui.openSettings();
    h.state.settings=Object.assign({},h.state.settings,{rest:Object.assign({},h.state.settings.rest)});   // replaced wholesale by a sync
    const was=h.state.settings.rest.sound;
    click(h,h.$('#sheetBody [data-sw="sound"]'));
    assert.equal(h.state.settings.rest.sound,!was,'the toggle changed the live settings');
  }finally{h.teardown();}
});
test('7.5: undoing a removed set after a reorder puts it back on the SAME exercise',()=>{
  const h=launch();
  try{
    h.click('[data-action="startFlow"]');h.click('[data-action="blank"]');
    ['barbell-bench-press','lat-pulldown'].forEach(id=>{h.click('#btnAddEx');h.click(h.$$('#addResults [data-quickadd]').find(x=>x.dataset.quickadd===id));});
    const a=h.state.active.exercises,first=a[0],n=first.sets.length;
    click(h,h.$('#view [data-delset="0"]'));
    assert.equal(first.sets.length,n-1);
    a.reverse();   // reorder before tapping Undo
    click(h,h.$('#toastAct'));
    assert.equal(first.sets.length,n,'the set went back to the exercise it came from');
  }finally{h.teardown();}
});

/* ---- 7.8 / 7.9: Library ---- */
test('7.8: Library search updates the list without rebuilding the search field',()=>{
  const h=launch();
  try{
    h.click('.tab[data-tab="library"]');
    const inp=h.$('#libSearch'),total=h.$$('#libResults [data-open]').length;
    inp.value='curl';inp.dispatchEvent(new h.win.Event('input',{bubbles:true}));
    assert.equal(h.$('#libSearch'),inp,'the same input element — never torn down mid-word');
    const n=h.$$('#libResults [data-open]').length;
    assert.ok(n>0&&n<total,'the list filtered: '+n+' of '+total);
    click(h,h.$('#libResults [data-open]'));
    assert.ok(h.$('#sheet').classList.contains('on'),'a freshly drawn row still opens');
  }finally{h.teardown();}
});
test('7.9: while a past workout is open for editing, Library "+" does not silently add to it',()=>{
  const h=launch();
  try{
    const now=Date.now();
    h.state.sessions=[{id:'old',schema:1,date:now-5*DAY,updatedAt:now,completed:true,exercises:[{id:'deadlift',sets:[{w:225,r:5,done:true}]}]}];
    h.click('.tab[data-tab="history"]');click(h,h.$('[data-sess="old"]'));
    const ed=h.$$('#sheetBody button').find(b=>/edit/i.test(b.textContent));click(h,ed);
    h.click('.tab[data-tab="library"]');
    const row=h.$$('#libResults [data-open]').find(r=>r.dataset.open==='barbell-curl');
    click(h,row.querySelector('.ex-add'));
    assert.equal(h.state.sessions[0].exercises.length,1,'nothing added to the old workout');
    assert.match(h.$('#sheetBody [data-addto]').textContent,/session \(editing\)/,'the details sheet names the session instead');
    // CONTROL: with no past session open, "+" still adds straight to today's workout
  }finally{h.teardown();}
  const h2=launch();
  try{h2.click('.tab[data-tab="library"]');
    click(h2,h2.$$('#libResults [data-open]').find(r=>r.dataset.open==='barbell-curl').querySelector('.ex-add'));
    assert.ok(h2.state.active&&h2.state.active.exercises.some(e=>e.id==='barbell-curl'),'CONTROL: quick add still works');
  }finally{h2.teardown();}
});

/* ---- 7.7: screen readers ---- */
test('7.7: pop-ups are dialogs, toggles announce on/off, rows act as buttons, the tab is marked current',()=>{
  const h=launch();
  try{
    const sh=h.$('#sheet');
    assert.equal(sh.getAttribute('role'),'dialog');assert.equal(sh.getAttribute('aria-hidden'),'true','closed sheet hidden from VoiceOver');
    h.IL.ui.openSettings();
    assert.equal(sh.getAttribute('aria-hidden'),'false');
    assert.equal(h.win.document.activeElement,h.$('#sheetTitle'),'focus moves into the sheet');
    const sw=h.$('#sheetBody [data-sw="sound"]');
    assert.equal(sw.getAttribute('role'),'switch');
    const was=sw.getAttribute('aria-checked');click(h,sw);
    assert.notEqual(sw.getAttribute('aria-checked'),was,'switch state announced after a flip');
    h.click('#sheetClose');assert.equal(sh.getAttribute('aria-hidden'),'true');
    assert.equal(h.$('.tab[data-tab="today"]').getAttribute('aria-current'),'page');
    h.click('.tab[data-tab="library"]');
    assert.equal(h.$('.tab[data-tab="library"]').getAttribute('aria-current'),'page');
    assert.equal(h.$('.tab[data-tab="today"]').getAttribute('aria-current'),null);
    const row=h.$('#libResults [data-open]');
    assert.equal(row.getAttribute('role'),'button');assert.equal(row.getAttribute('tabindex'),'0');
    row.dispatchEvent(new h.win.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
    assert.ok(sh.classList.contains('on'),'Enter on a row opens it');
    h.win.document.dispatchEvent(new h.win.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    assert.ok(!sh.classList.contains('on'),'Escape closes the sheet');
    assert.equal(h.$('#toast').getAttribute('role'),'status','toasts are read aloud');
  }finally{h.teardown();}
});
test('7.7: the confirm box is a labelled dialog that takes focus',()=>{
  const h=launch();
  try{
    const d=h.$('#cdialog');assert.equal(d.getAttribute('aria-labelledby'),'cdTitle');
    h.win.eval('0');   // (showConfirm is internal; open it through a real flow)
    h.click('[data-action="startFlow"]');h.click('[data-action="blank"]');
    h.click('#btnAddEx');h.click(h.$$('#addResults [data-quickadd]').find(x=>x.dataset.quickadd==='barbell-bench-press'));
    const ex=h.state.active.exercises[0];ex.sets[ex.sets.length-1].w=100;ex.sets[ex.sets.length-1].r=5;ex.sets[ex.sets.length-1].done=true;h.IL.ui.render();
    click(h,h.$('#view [data-delset="0"]'));   // last set is done → confirm
    assert.ok(d.classList.contains('on'));assert.equal(d.getAttribute('aria-hidden'),'false');
    assert.equal(h.win.document.activeElement,h.$('#cdCancel'),'Cancel (the safe choice) has focus');
  }finally{h.teardown();}
});

/* ---- 7.6 / 7.3 ---- */
test('7.6: the rest bar tints from its own text colour (visible on the light card in dark mode)',()=>{
  const css=fs.readFileSync(path.join(__dirname,'..','src','styles.css'),'utf8');
  const rule=sel=>{const m=css.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\{[^}]*\\}'));return m?m[0]:'';};
  assert.match(rule('.rest-btn'),/currentColor/);assert.match(rule('.rest-prog'),/currentColor/);
  assert.doesNotMatch(rule('.restbar.done .rcard'),/#fff/,'no white-on-green');
});
test('7.3: tapping the header badge explains "Storage full"',()=>{
  const h=launch();
  try{
    h.state.storageError=true;h.IL.ui.render();
    assert.equal(h.$('#cloudText').textContent,'Storage full');
    click(h,h.$('#cloudStatus'));
    assert.match(h.$('#toastMsg').textContent,/Export a backup/);
  }finally{h.teardown();}
});
