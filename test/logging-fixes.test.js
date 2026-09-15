// v0.48 logging fixes — assisted dip, time-held lifts, and the rest-gap plausibility floor.
// Every test pairs an ORACLE (hand-computed) with a CONTROL (the normal case, unchanged).
const test=require('node:test'),assert=require('node:assert/strict');
const {IL,session,set,history,NOW}=require('./load.js');
const P=IL.prog,A=IL.analysis,SR=IL.search;

test('assisted dip is inverted — hitting top reps prescribes LESS assist (harder)',()=>{
  const ad=history(session(2,[['assisted-dip',[set(75,12),set(75,12),set(75,12)]]]));
  const s=P.suggestion(ad,'assisted-dip',{unit:'lb'});
  assert.equal(s.next[0].w,70,'75 → 70 lb of assist = harder next time');
  assert.match(s.text,/less assist/i,'the label says less assist, not "+"');
  // CONTROL: an ordinary bodyweight dip goes the other way
  const td=history(session(2,[['tricep-dip',[set(70,12),set(70,12),set(70,12)]]]));
  const t=P.suggestion(td,'tricep-dip',{unit:'lb'});
  assert.equal(t.next[0].w,75,'70 → 75 = heavier (normal progression)');
  assert.match(t.text,/\+5/,'the label adds weight');
});

test('"assisted dip" search finds the assisted machine, not the (unrelated) Machine Dip',()=>{
  const r=SR.searchEx('assisted dip');
  assert.equal(r[0].id,'assisted-dip','top hit is the assist machine');
  assert.ok(!r.slice(0,3).some(e=>e.id==='machine-dip')||r[0].id==='assisted-dip','Machine Dip no longer hijacks the query');
});

test('time-held lifts (carry) carry no weight×reps volume, but still count as sets',()=>{
  const sess=session(1,[['barbell-bench-press',[set(100,5),set(100,5)]],['farmers-carry',[set(50,2),set(50,2),set(50,2)]]]);
  assert.equal(P.sessionVolume(sess,0),1000,'volume = the bench only (100×5×2); the carry adds nothing');
  // CONTROL: the bench alone gives the same number — proof the carry contributed zero, not that volume broke
  assert.equal(P.sessionVolume(session(1,[['barbell-bench-press',[set(100,5),set(100,5)]]]),0),1000);
  // the carry is still a set for balance/coverage
  const fore=A.muscleSetCounts([sess]).find(x=>x[0]==='Forearms');
  assert.deepEqual(fore,['Forearms',3],'all 3 carry sets count toward Forearms');
});

test('a carry never produces a 1RM estimate on the PR list',()=>{
  const sess=session(1,[['farmers-carry',[set(50,2),set(60,2)]]]);
  const fc=A.personalRecords([sess],0,8).find(p=>p.id==='farmers-carry');
  assert.ok(fc,'the carry still gets a PR row');
  assert.equal(fc.time,true,'flagged time-held');
  assert.equal(fc.showEst,false,'no bogus e1RM');
  assert.equal(fc.load,60,'best = the heavier carry');
  // CONTROL: a real compound DOES estimate
  const bench=A.personalRecords([session(1,[['barbell-bench-press',[set(100,5)]]])],0,8)[0];
  assert.equal(bench.showEst,true,'a barbell press still shows an e1RM');
});

test('rest gaps under 20s are ignored — a batch-tick or mis-log is not a rest',()=>{
  const now=NOW;const gap=(a,b)=>({w:100,r:5,done:true,at:a});
  const s={id:'x',schema:1,date:now,updatedAt:now,completed:true,exercises:[{id:'barbell-bench-press',name:'B',
    sets:[{w:100,r:5,done:true,at:now+1000},{w:100,r:5,done:true,at:now+5000},{w:100,r:5,done:true,at:now+95000}]}]};
  const r=A.restTaken(s);
  assert.equal(r.n,1,'only the real 90s gap counts; the 4s gap is dropped');
  assert.equal(r.median,90,'median rest = 90s, not ~4s');
  // CONTROL: three plausible gaps all count
  const s2={id:'y',schema:1,date:now,updatedAt:now,completed:true,exercises:[{id:'barbell-bench-press',name:'B',
    sets:[{w:100,r:5,done:true,at:now},{w:100,r:5,done:true,at:now+60000},{w:100,r:5,done:true,at:now+180000}]}]};
  assert.equal(A.restTaken(s2).n,2,'two real gaps, both kept');
});

test('assisted-lift volume = (bodyweight − assist) × reps, not the assistance itself',()=>{
  const bw=216;
  // assisted dip 70/55/70 × 12/10/12 → (216−70)×12 + (216−55)×10 + (216−70)×12 = 1752+1610+1752 = 5114
  const s=session(1,[['assisted-dip',[set(70,12),set(55,10),set(70,12)]]]);
  assert.equal(P.sessionVolume(s,bw),5114,'the resistance moved, not the machine assist (which would be 2230)');
  // the harder set (55 assist = 161 lb) out-volumes an easier one at equal reps — direction is right
  const easy=P.sessionVolume(session(1,[['assisted-dip',[set(90,10)]]]),bw);   // (216−90)×10 = 1260
  const hard=P.sessionVolume(session(1,[['assisted-dip',[set(50,10)]]]),bw);   // (216−50)×10 = 1660
  assert.ok(hard>easy,'less assist = more volume');
  // CONTROL: without a bodyweight it can't be computed → contributes 0 (never counts the assist)
  assert.equal(P.sessionVolume(s,0),0,'no bodyweight → 0, not the assist number');
  // CONTROL: a weighted bodyweight lift still ADDS bodyweight (tricep-dip, factor 1)
  assert.equal(P.sessionVolume(session(1,[['tricep-dip',[set(25,10)]]]),bw),(216+25)*10,'weighted dip = bodyweight + added');
});
