// v0.51.0 Progress-tab pass: deload note tense (Monday-weeks, not rolling 7 days), the tile refresh
// ("Sets this week" replacing "30-day sessions"), and the vs-last-week deltas.
const {IL,NOW,DAY}=require('./load.js');
const test=require('node:test'),assert=require('node:assert');
const A=IL.analysis,P=IL.prog;

/* ---- deload note tense ---- */
function mk(date,deload){return {id:'s'+date,schema:1,date,updatedAt:date,completed:true,deload:!!deload,
  exercises:[{id:'barbell-bench-press',name:'Bench',sets:[{w:deload?60:100,r:deload?10:8,done:true}]}]};}
function deloadNote(deloadDate){
  const sessions=[mk(NOW-DAY,false),mk(deloadDate,true)];
  const a=A.analyze(sessions,NOW),tips=A.buildTips(a,sessions,NOW,200,null,{});
  const dl=tips.find(t=>/deload/i.test(t.x));return dl&&dl.x;
}
const ws=P.weekStart(NOW);

test('a deload THIS week reads "this week"',()=>{
  assert.match(deloadNote(ws+DAY/2),/this week/);
});
test('a deload LAST week reads "last week", never "this week" (the reported bug)',()=>{
  const txt=deloadNote(ws-DAY/2);   // just before this Monday = last calendar week
  assert.match(txt,/last week/);
  assert.doesNotMatch(txt,/this week/);
});
test('a deload two+ weeks back reads "N days ago"',()=>{
  assert.match(deloadNote(ws-8*DAY),/days ago/);
});

/* ---- stat tiles ---- */
const {launch}=require('./ui-harness.js');
function sess(id,date,sets){return {id,schema:1,date,updatedAt:date,completed:true,
  exercises:[{id:'barbell-bench-press',name:'Bench',sets:sets.map(([w,r])=>({w,r,done:true}))}]};}
function statVal(h,label){const c=h.$$('.stat').find(x=>{const k=x.querySelector('.k');return k&&k.textContent.trim()===label;});
  if(!c)return null;const m=c.querySelector('.v').textContent.match(/-?\d[\d,]*/);return m?+m[0].replace(/,/g,''):null;}
function statDeltaText(h,label){const c=h.$$('.stat').find(x=>{const k=x.querySelector('.k');return k&&k.textContent.trim()===label;});
  const d=c&&c.querySelector('.statdelta');return d?d.textContent.replace(/\s+/g,' ').trim():null;}

test('the confusing "30-day sessions" tile is gone; "Sets this week" replaces it',()=>{
  const h=launch();
  try{
    const now=Date.now(),ws=h.IL.prog.weekStart(now);
    h.state.sessions=[sess('a',ws+3600e3,[[100,8],[100,8],[100,6]])];   // 3 working sets this week
    h.click('.tab[data-tab="progress"]');
    const labels=h.$$('.stat .k').map(k=>k.textContent.trim());
    assert.ok(!labels.includes('30-day sessions'),'the 30-day tile is gone');
    assert.ok(labels.includes('Sets this week'),'the sets tile is present');
    assert.equal(statVal(h,'Sets this week'),3,'it counts this week’s working sets');
  }finally{h.teardown();}
});

test('tiles show a vs-last-week delta only when last week has something to compare',()=>{
  const h=launch();
  try{
    const now=Date.now(),ws=h.IL.prog.weekStart(now);
    // first-week user: only this week, no prior week
    h.state.sessions=[sess('a',ws+3600e3,[[100,8],[100,8]])];
    h.click('.tab[data-tab="progress"]');
    assert.equal(statDeltaText(h,'Sets this week'),null,'no "+N vs 0" for a first week');

    // add last week AT THE SAME POINT in the week (2 sets) → this week 3 sets → +1
    h.state.sessions=[sess('a',ws+60000,[[100,8],[100,8],[100,6]]),sess('b',ws-7*DAY+60000,[[100,8],[100,8]])];
    h.click('.tab[data-tab="today"]');h.click('.tab[data-tab="progress"]');
    assert.match(statDeltaText(h,'Sets this week'),/\+1 vs last week/);
  }finally{h.teardown();}
});
