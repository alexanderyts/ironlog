const test=require('node:test'),assert=require('node:assert/strict');
const {IL}=require('./load.js');
const A=IL.analysis;

test('phrasing varies week to week but is stable within a week (Phase E)',()=>{
  const f={type:'region-gap',group:'Shoulders',reg:'rear',ex:'Rear Delt Fly',prio:5};
  assert.equal(A.renderFinding(f,1000).x,A.renderFinding(f,1000).x,'stable within a week');
  const texts=new Set([1000,1001,1002,1003].map(k=>A.renderFinding(f,k).x));
  assert.ok(texts.size>=2,'wording changes across weeks');
});

test('resolved findings give credit, not another warning (Phase E)',()=>{
  const gap={type:'region-gap',status:'resolved',group:'Shoulders',reg:'rear',ex:'Rear Delt Fly',prio:5};
  const r=A.renderFinding(gap,5);
  assert.equal(r.lv,'good');assert.match(r.x,/sorted|covered/i);
  assert.equal(A.renderFinding({type:'volume-low',status:'resolved',group:'Hamstrings',perWeek:11},5).lv,'good');
  assert.equal(A.renderFinding({type:'balance',status:'resolved',dir:'push',push:30,pull:29},5).lv,'good');
});

test('persisting softens to a follow-up; real exercise names are woven in (Phase E)',()=>{
  assert.match(A.renderFinding({type:'balance',status:'persisting',dir:'push',push:40,pull:20},3).x,/still/i);
  assert.match(A.renderFinding({type:'region-gap',group:'Chest',reg:'upper',ex:'Incline Barbell Press',prio:4},3).x,/Incline Barbell Press/);
});

test('volume-low weaves in an upward trend when it is climbing (Phase E)',()=>{
  const f={type:'volume-low',status:'persisting',group:'Hamstrings',perWeek:7,prev:{perWeek:5}};
  assert.match(A.renderFinding(f,2).x,/up from/i);
});

test('every finding type renders without template leaks (Phase E)',()=>{
  const samples=[
    {type:'balance',dir:'push',push:40,pull:20},{type:'balance',dir:'even',push:30,pull:29},
    {type:'legs-low',lower:4,upper:20},{type:'deload-taken',days:3},{type:'deload-due',weeks:7},
    {type:'region-gap',group:'Chest',reg:'upper',ex:'Incline Press',prio:4},
    {type:'pattern-gap',group:'Hamstrings',pat:'hinge',exName:'Romanian Deadlift',prio:5},
    {type:'volume-low',group:'Back',perWeek:6.2},{type:'freq-low',group:'Back',sets:12},
    {type:'progression',lv:'good',up:3,n:4}
  ];
  for(let wk=0;wk<4;wk++)samples.forEach(f=>{const x=A.renderFinding(f,wk).x;
    assert.ok(x&&x.length>10&&!/\{|\bundefined\b|NaN/.test(x),f.type+' wk'+wk+': '+x);});
});
