const test=require('node:test'),assert=require('node:assert/strict');
const {IL,session,set,history}=require('./load.js');
const A=IL.analysis;
const now=Date.now();

test('a finding that vanished because you STOPPED training the muscle is not credited as resolved (Phase 6)',()=>{
  // prev window (28-56d ago): shoulders trained (overhead press only -> rear/side region gaps).
  // cur window (0-28d): only chest, no shoulders at all.
  const dropped=history(
    ...[3,10,17].map(d=>session(d,[['barbell-bench-press',[set(135,6),set(135,6)]]],{now})),
    ...[35,42,49].map(d=>session(d,[['overhead-press',[set(95,8),set(95,8)]]],{now}))
  );
  assert.ok(!A.withStatus(dropped,now,0).some(f=>f.status==='resolved'&&f.type==='region-gap'&&f.group==='Shoulders'),
    'dropping shoulders is not "gap sorted"');
  // positive control: a gap filled while STILL training the muscle does resolve
  const filled=history(
    ...[3,10,17].map(d=>session(d,[['overhead-press',[set(95,8),set(95,8)]],['rear-delt-fly',[set(20,15),set(20,15)]]],{now})),
    ...[35,42,49].map(d=>session(d,[['overhead-press',[set(95,8),set(95,8)]]],{now}))
  );
  assert.ok(A.withStatus(filled,now,0).some(f=>f.status==='resolved'&&f.type==='region-gap'&&f.group==='Shoulders'&&f.reg==='rear'),
    'covering the rear delts while still training shoulders IS resolved');
});

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

test('buildTips renders findings — capped at 5, well-formed, no unfilled placeholders',()=>{
  const hist=pushHistory();
  const tips=A.buildTips(A.analyze(hist,now),hist,now,0);
  assert.ok(tips.length>=1&&tips.length<=5);
  assert.ok(tips.every(t=>['warn','good','info'].includes(t.lv)));
  assert.ok(tips.every(t=>t.x&&t.x.length>10&&!/\{|\bundefined\b|NaN/.test(t.x)),'no template leaks: '+JSON.stringify(tips.map(t=>t.x)));
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

// ── Roadmap v6 Phase P3: the coach listens to the profile ────────────────────────────────────────
// One test per lever: a hand-computed ORACLE for the profile that should change the finding, and a
// CONTROL showing Balanced (and the non-triggering values) are untouched. The profile is a lens on the
// same measured facts, so every assertion below is on findings()/buildTips() OUTPUT, not on "it ran".
{
const {weekly,NOW}=require('./load.js');
const Fp=(h,p,ty)=>A.findings(A.analyze(h,NOW),h,NOW,0,p).filter(f=>f.type===ty);
const tips=(h,p)=>A.buildTips(A.analyze(h,NOW),h,NOW,0,p).map(t=>t.x.replace(/<[^>]+>/g,''));

test('P3 days: a 2-day week silences the once-a-week frequency nag; 3+ days keep it; Balanced unchanged',()=>{
  // chest: 8 working sets on ONE day each week for 5 weeks → 8 sets/wk at 1×/wk = freq-low today
  const h=weekly([['barbell-bench-press',[set(135,8),set(135,8),set(135,8),set(135,8)]],['cable-crossover',[set(30,12),set(30,12),set(30,12),set(30,12)]]],5);
  assert.deepEqual(Fp(h,undefined,'freq-low').map(f=>[f.group,f.sets]),[['Chest',8]],'control: Balanced raises freq-low for chest at 8 sets/wk');
  assert.deepEqual(Fp(h,{days:2},'freq-low'),[],'days:2 — once a week is the plan, not a gap');
  assert.deepEqual(Fp(h,{days:3},'freq-low').map(f=>f.group),['Chest'],'days:3 still nags (a muscle fits twice)');
  assert.deepEqual(Fp(h,{days:4},'freq-low').map(f=>f.group),['Chest'],'days:4 keeps today\'s rule');
});

test('P3 goal: volume landmarks — 9 sets/wk fails only the size target (10); 7 sets/wk passes strength (6)',()=>{
  const nine=weekly([['barbell-bench-press',[set(135,8),set(135,8),set(135,8),set(135,8),set(135,8)]],['cable-crossover',[set(30,12),set(30,12),set(30,12),set(30,12)]]],5);
  assert.deepEqual(Fp(nine,undefined,'volume-low'),[],'control: 9/wk is fine for Balanced (threshold 8)');
  assert.deepEqual(Fp(nine,{goal:'general'},'volume-low'),[],'general = Balanced');
  assert.deepEqual(Fp(nine,{goal:'strength'},'volume-low'),[],'strength landmark is 6 — 9 passes');
  const sz=Fp(nine,{goal:'size'},'volume-low');
  assert.deepEqual(sz.map(f=>[f.group,+f.perWeek.toFixed(1),f.target,f.goal]),[['Chest',9,10,'size']],'size: 9/wk is below the 10 landmark, finding carries target+goal');
  assert.match(tips(nine,{goal:'size'}).find(t=>/sets\/week/.test(t)),/for size|For size/i,'wording names the goal');
  assert.match(tips(nine,{goal:'size'}).find(t=>/sets\/week/.test(t)),/10/,'wording carries the landmark');
  const seven=weekly([['barbell-bench-press',[set(135,8),set(135,8),set(135,8),set(135,8)]],['cable-crossover',[set(30,12),set(30,12),set(30,12)]]],5);
  assert.deepEqual(Fp(seven,undefined,'volume-low').map(f=>[f.group,f.target]),[['Chest',undefined]],'control: Balanced flags 7/wk with NO target field (shape unchanged)');
  assert.deepEqual(Fp(seven,{goal:'strength'},'volume-low'),[],'strength: 7/wk is above its 6 landmark');
});

test('P3 protect: heavy-compound gap nags for a protected muscle become one "protect" finding; isolation gaps stay',()=>{
  // shoulders trained with lateral raises only → gaps today: rear delts (fly, isolation), front (OHP,
  // tier-1 compound) and the vertical-press pattern (OHP). Under protect the two OHP nags go away.
  const h=weekly([['lateral-raise',[set(20,12),set(20,12),set(20,12)]],['barbell-bench-press',[set(135,8),set(135,8)]]],5);
  const shGaps=p=>A.findings(A.analyze(h,NOW),h,NOW,0,p).filter(f=>f.group==='Shoulders'&&/gap$/.test(f.type)).map(f=>f.type+':'+(f.reg||f.pat)).sort();
  assert.deepEqual(shGaps(undefined),['pattern-gap:vpush','region-gap:front','region-gap:rear'],'control: Balanced raises all three shoulder gaps');
  assert.deepEqual(Fp(h,undefined,'protect'),[],'control: no protect finding without the lever');
  assert.deepEqual(shGaps({protect:['Shoulders']}),['region-gap:rear'],'protect: only the light isolation gap remains');
  assert.deepEqual(Fp(h,{protect:['Shoulders']},'protect').map(f=>[f.group,f.covering]),[['Shoulders',['Lateral Raise']]],'protect finding credits what covers it');
  assert.deepEqual(shGaps({protect:['Chest']}),['pattern-gap:vpush','region-gap:front','region-gap:rear'],'off-lever control: protecting another muscle leaves shoulders alone');
  const pf=Fp(h,{protect:['Shoulders']},'protect')[0];
  assert.match(A.renderFinding(pf,1).x.replace(/<[^>]+>/g,''),/keeping shoulders light — Lateral Raise is covering it|stays light by your choice; Lateral Raise keeps it moving/,'the tip renders with the covering lift named');
  // builder coherence: the hints the builder reads no longer contain a heavy shoulder gap to fill
  const gaps=A.buildHints(h,NOW,0,{protect:['Shoulders']}).gaps.filter(g=>g.group==='Shoulders').map(g=>g.type+':'+(g.reg||g.pat));
  assert.deepEqual(gaps,['region-gap:rear'],'buildHints carries the same filtered list');
});

test('P3 push=quiet: the progression finding is descriptive only — no "+weight prompts" nudge',()=>{
  const h=weekly([['barbell-bench-press',[set(135,8),set(135,8)]],['back-squat',[set(185,5)]]],5);   // flat → 0 of 2 climbing
  const line=p=>tips(h,p).find(t=>/lifts/.test(t));
  assert.match(line(undefined),/\+weight prompts/,'control: Balanced nudges toward the +weight prompts');
  assert.doesNotMatch(line({push:'quiet'}),/prompt|nudge/,'quiet: states the trend and stops');
  assert.match(line({push:'quiet'}),/0 of 2|0\/2/,'the numbers are still reported');
  assert.equal(Fp(h,undefined,'progression')[0].quiet,undefined,'control: Balanced finding shape unchanged');
});
}

test('P3 protect: the good-news line never displaces a warning under the 5-tip cap',()=>{
  const {weekly,NOW}=require('./load.js');
  // 4 weeks of light shoulders+chest: balance, legs, 2 gaps, chest volume-low = 5 tips already
  const h=weekly([['lateral-raise',[set(20,12),set(20,12),set(20,12)]],['barbell-bench-press',[set(135,8),set(135,8)]]],4);
  const strip=t=>t.x.replace(/<[^>]+>/g,'');
  const auto=A.buildTips(A.analyze(h,NOW),h,NOW,0).map(strip),prot=A.buildTips(A.analyze(h,NOW),h,NOW,0,{protect:['Shoulders']}).map(strip);
  assert.ok(auto.some(t=>/sets\/week of chest/.test(t)),'control: the chest volume warning is shown');
  assert.ok(prot.some(t=>/sets\/week of chest/.test(t)),'protect: the chest volume warning is STILL shown');
  assert.equal(prot.length,5,'cap holds');
  assert.ok(!prot.some(t=>/keeping shoulders light|stays light/.test(t)),'the protect line yields its slot to the warning when the cap is full');
});

test('B-continuity: deload-due counts from the last deload and fires once per block (#7)',()=>{
  const {weekly,NOW}=require('./load.js');
  const dd=(h)=>A.findings(A.analyze(h,NOW),h,NOW,0).find(f=>f.type==='deload-due');
  // 7 straight weeks, no deload → 7%6=1 (<2) → fires with weeks:7
  assert.deepEqual((dd(weekly([['barbell-bench-press',()=>[set(185,6),set(185,6)]]],7,{now:NOW}))||{}).weeks,7);
  // 8 straight weeks → 8%6=2 (not <2) → the block window is closed, no nag
  assert.equal(dd(weekly([['barbell-bench-press',()=>[set(185,6),set(185,6)]]],8,{now:NOW})),undefined);
  // a deload 3 weeks ago silences it even after many weeks of training (was the "12 weeks" bug)
  const withDeload=history(...[3,10,17,24,31,38,45,52].map((d,i)=>session(d,[['barbell-bench-press',[set(185,6),set(185,6)]]],{now:NOW,deload:d===17})));
  assert.equal(dd(withDeload),undefined,'3 weeks after a deload, no "you never deload" nag');
});
