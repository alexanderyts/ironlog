const test=require('node:test'),assert=require('node:assert/strict');
const {IL,session,set}=require('./load.js');
const A=IL.analysis;
const now=Date.now();

// A push-heavy, multi-week history: enough to be readyForComparative, imbalanced toward pushing.
function pushHistory(){
  const h=[];
  for(let w=0;w<5;w++)h.push(session(w*7+2,[
    ['barbell-bench-press',[set(135+w*5,8),set(135+w*5,8),set(135+w*5,8)]],
    ['overhead-press',[set(75,8),set(75,8)]],
    ['tricep-pushdown',[set(50,12),set(50,12)]]],{now}));
  return h;
}

test('findings: typed decisions; comparative ones gated by readyForComparative',()=>{
  const hist=pushHistory();
  const F=A.findings(A.analyze(hist,now),hist,now,0);
  const types=F.map(f=>f.type);
  const bal=F.find(f=>f.type==='balance');
  assert.ok(bal&&bal.dir==='push','push/pull imbalance detected as data');
  assert.ok(types.includes('region-gap'),'chest region gap present as data');
  assert.ok(F.every(f=>typeof f.type==='string'&&!('x' in f)),'findings carry no rendered text');
  // brand-new user: no comparative verdicts yet
  const tiny=[session(1,[['barbell-bench-press',[set(135,8)]]],{now})];
  const Ft=A.findings(A.analyze(tiny,now),tiny,now,0);
  assert.ok(!Ft.some(f=>['balance','legs-low','volume-low','freq-low'].includes(f.type)),'comparative findings withheld early');
});

test('buildTips is a renderer over findings — capped at 5, every tip is a rendered finding',()=>{
  const hist=pushHistory();
  const a=A.analyze(hist,now);
  const tips=A.buildTips(a,hist,now,0);
  assert.ok(tips.length>=1&&tips.length<=5);
  const rendered=new Set(A.findings(a,hist,now,0).map(f=>A.renderFinding(f).x));
  assert.ok(tips.every(t=>rendered.has(t.x)),'each tip corresponds to a finding');
  assert.ok(tips.every(t=>['warn','good','info'].includes(t.lv)));
});

test('findingKey gives one identity per concern (deload variants share it)',()=>{
  assert.equal(A.findingKey({type:'region-gap',group:'Chest',reg:'upper'}),'region-gap:Chest:upper');
  assert.equal(A.findingKey({type:'deload-taken'}),A.findingKey({type:'deload-due'}));
  assert.notEqual(A.findingKey({type:'region-gap',group:'Chest',reg:'upper'}),A.findingKey({type:'region-gap',group:'Chest',reg:'lower'}));
});

test('withStatus marks new / persisting / resolved across the 28-day boundary',()=>{
  const hist=[];
  // older window (~5–8 weeks ago): chest via flat bench only → upper-chest gap back then
  for(let w=5;w<9;w++)hist.push(session(w*7+2,[['barbell-bench-press',[set(135,8),set(135,8),set(135,8)]]],{now}));
  // recent window (0–3 weeks ago): added incline → upper chest now covered
  for(let w=0;w<4;w++)hist.push(session(w*7+2,[['barbell-bench-press',[set(135,8),set(135,8)]],['incline-barbell-press',[set(115,8),set(115,8)]]],{now}));
  const ws=A.withStatus(hist,now,0);
  assert.ok(ws.every(f=>['new','persisting','resolved'].includes(f.status)),'every finding carries a valid status');
  assert.ok(ws.find(f=>f.type==='region-gap'&&f.group==='Chest'&&f.reg==='upper'&&f.status==='resolved'),'upper-chest gap resolved once incline was added');
  assert.ok(ws.find(f=>f.type==='region-gap'&&f.group==='Chest'&&f.reg==='lower'&&f.status==='persisting'),'lower-chest gap persists across both windows');
});
