// v0.46.0 polish batch — screen-level oracles (jsdom). Each asserts the rendered OUTCOME the user
// sees, with a hand-computed expected value and a control, not just that a render didn't throw.
const test=require('node:test'),assert=require('node:assert/strict');
const {launch}=require('./ui-harness.js');
const DAY=86400000;

// Read a Progress "stat" card's leading number by its label ("This week", etc.).
function statVal(h,label){
  const card=h.$$('.stat').find(c=>{const k=c.querySelector('.k');return k&&k.textContent.trim()===label;});
  if(!card)return null;
  const v=card.querySelector('.v');const m=v&&v.textContent.match(/-?\d[\d,]*/);
  return m?+m[0].replace(/,/g,''):null;
}
function gotoProgress(h){h.click('.tab[data-tab="progress"]');}
// Only the rendered view — NOT document.body, which also contains the inlined bundle source.
function viewText(h){return h.$('#view').textContent.replace(/\s+/g,' ').trim();}
function sess(id,date,exercises,extra){return Object.assign({id,schema:1,date,updatedAt:date,completed:true,exercises},extra||{});}
function lift(id,sets){return {id,name:id,sets:sets.map(([w,r])=>({w,r,done:true}))};}

test('Progress "This week" counts the calendar week (Mon–Sun), not a rolling 7 days',()=>{
  const h=launch();
  try{
    const P=h.IL.prog,now=Date.now(),ws=P.weekStart(now);
    // one session just INSIDE this calendar week, one just BEFORE this Monday (last week).
    // Both fall inside a rolling 7-day window, so the rolling version would count 2.
    h.state.sessions=[
      sess('inwk',ws+60000,[lift('barbell-bench-press',[[100,5]])]),
      sess('lastwk',ws-60000,[lift('barbell-bench-press',[[100,5]])]),
    ];
    gotoProgress(h);
    assert.equal(h.state.sessions.length,2,'control: both sessions exist in state');
    assert.equal(statVal(h,'This week'),1,'only the session on/after this Monday counts');
  }finally{h.teardown();}
});

test('Volume chart: the tallest bar is always labelled; tapping another reveals its value',()=>{
  const h=launch();
  try{
    const now=Date.now(),P=h.IL.prog;
    // three distinct weeks; hand-computed volumes 500 / 1000 / 300 → week -7d is the peak (1000).
    h.state.sessions=[
      sess('w0',now,        [lift('barbell-bench-press',[[100,5]])]),   // 500
      sess('w1',now-7*DAY,  [lift('barbell-bench-press',[[100,10]])]),  // 1000  ← max
      sess('w2',now-14*DAY, [lift('barbell-bench-press',[[100,3]])]),   // 300
    ];
    gotoProgress(h);
    const peak=h.$('.bar-col.peak');
    assert.ok(peak,'exactly the tallest bar is marked peak');
    assert.equal(h.$$('.bar-col.peak').length,1,'only one peak bar');
    assert.equal(peak.querySelector('.bar-val').textContent.trim(),P.fmtVol(1000),'peak label = fmtVol(max volume)');
    // a non-peak, non-empty bar is tappable and hidden until tapped
    const others=h.$$('.bar-col[data-barval]').filter(c=>!c.classList.contains('peak'));
    assert.ok(others.length>=2,'the other two logged weeks are tappable');
    const one=others.find(c=>c.querySelector('.bar-val').textContent.trim()===P.fmtVol(500));
    assert.ok(one,'the 500-volume week is present and unlabelled by default');
    assert.ok(!one.classList.contains('on'),'control: its value is hidden before the tap');
    assert.match(one.getAttribute('aria-label'),/500/,'screen readers get the value without tapping');
    one.dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));
    assert.ok(one.classList.contains('on'),'tapping reveals it');
  }finally{h.teardown();}
});

test("Coach's notes / Recovery are collapsible, and the choice persists in synced settings",()=>{
  const h=launch();
  try{
    const now=Date.now();
    // two normal sessions + one deload → Coach's notes renders (early branch) and Recovery renders.
    h.state.sessions=[
      sess('a',now-2*DAY,[lift('barbell-bench-press',[[100,6]])]),
      sess('b',now-4*DAY,[lift('barbell-bench-press',[[100,6]])]),
      sess('d',now-1*DAY,[lift('barbell-bench-press',[[60,6]])],{deload:true}),
    ];
    gotoProgress(h);
    const head=()=>h.$('[data-collapse="coach"]');
    assert.ok(head(),"Coach's notes is a collapsible header");
    assert.equal(head().getAttribute('aria-expanded'),'true','open by default');
    assert.match(viewText(h),/start giving you balance and volume feedback/i,'control: the notes body is visible while open');
    assert.ok(h.$('[data-collapse="recovery"]'),'Recovery is collapsible too');

    head().dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));   // collapse
    assert.equal(head().getAttribute('aria-expanded'),'false','collapsed after tap');
    assert.doesNotMatch(viewText(h),/start giving you balance and volume feedback/i,'body hidden when collapsed');
    assert.equal(h.state.settings.seen['collapse:coach'],true,'choice stored in seen (syncs via saveSettingsCloud)');
    // survives a sanitizer round-trip (what Dropbox/DB sync does to settings)
    const cleaned=h.IL.sync.cleanSettings(h.state.settings);
    assert.equal(cleaned.seen['collapse:coach'],true,'collapse flag survives cloud sanitization');

    head().dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));   // re-open
    assert.equal(head().getAttribute('aria-expanded'),'true','re-opens on second tap');
    assert.ok(!(h.state.settings.seen&&h.state.settings.seen['collapse:coach']),'flag cleared when re-opened');
  }finally{h.teardown();}
});

test('Deload coach notes vary week to week and no longer echo the in-workout stretch cue',()=>{
  const A=require('./load.js').IL.analysis;
  for(const type of ['deload-taken','deload-due']){
    const f=type==='deload-taken'?{type,days:3}:{type,weeks:7};
    const texts=new Set([0,1,2,3].map(wk=>A.renderFinding(f,wk).x));
    assert.ok(texts.size>=3,type+': at least 3 distinct wordings across 4 weeks (got '+texts.size+')');
    [0,1,2,3].forEach(wk=>{const x=A.renderFinding(f,wk).x;
      assert.doesNotMatch(x,/own the stretch|feel the stretch/i,type+' wk'+wk+' should not repeat the badge cue');
      assert.match(x,/deload|recovery/i,type+' wk'+wk+' still names the deload/recovery');
    });
  }
});
