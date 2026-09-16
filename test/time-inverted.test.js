// Batch A correctness: the time-held and assist-machine lift families were only half-wired through the
// engine. These pin the intended behaviour of PRs, the progress trend, and stall detection for them.
const {IL,session,set,history,NOW,DAY}=require('./load.js');
const test=require('node:test'),assert=require('node:assert');
const A=IL.analysis,P=IL.prog,B=IL.builder;

/* ---- C1: bodyweight time-held lifts get a PR (best = longest, then heaviest) ---- */
test('C1: a bodyweight plank produces a PR ranked by seconds',()=>{
  const h=history(session(1,[['plank',[set(0,45),set(0,60)]]]));
  const pr=A.personalRecords(h,200,8).filter(p=>p.id==='plank')[0];
  assert.ok(pr,'plank has a PR row');
  assert.equal(pr.r,60,'the longest hold is the record');
  assert.equal(pr.time,true,'flagged as a time-metric PR');
  assert.equal(pr.showEst,false,'no bogus e1RM for a hold');
});

test('C1: a longer-held carry outranks a shorter one; ties break on load',()=>{
  // seconds-primary so the PR card agrees with the progress chart (which ranks by seconds/setScore)
  const h=history(session(1,[['farmers-carry',[set(50,40),set(60,30),set(60,35)]]]));
  const pr=A.personalRecords(h,200,8).filter(p=>p.id==='farmers-carry')[0];
  assert.equal(pr.r,40,'the longest hold wins');
  assert.equal(pr.w,50,'even though it was lighter');
  // a genuine tie on time breaks to the heavier load
  const h2=history(session(1,[['farmers-carry',[set(55,35),set(60,35)]]]));
  const pr2=A.personalRecords(h2,200,8).filter(p=>p.id==='farmers-carry')[0];
  assert.equal(pr2.w,60,'equal holds → heavier load wins');
});

test('C1 CONTROL: an ordinary bodyweight lift with no bodyweight set still yields no PR',()=>{
  // the load-zero guard must stay for non-time lifts (a pull-up at bw=0 is not a record)
  const h=history(session(1,[['pull-up',[set(0,10)]]]));
  assert.equal(A.personalRecords(h,0,8).filter(p=>p.id==='pull-up').length,0);
});

test('an assist machine at zero assist (an UNASSISTED rep) is the record, not dropped as load-0',()=>{
  // review finding #5: assist is the logged weight, so assist 0 = load 0 = the strongest performance.
  const h=history(
    session(9,[['assisted-pull-up',[set(40,8)]]]),   // 40 lb of help (earlier, weaker)
    session(2,[['assisted-pull-up',[set(0,8)]]])      // no help at all (later, strongest)
  );
  const pr=A.personalRecords(h,200,8).filter(p=>p.id==='assisted-pull-up')[0];
  assert.ok(pr,'the assisted lift has a PR');
  assert.equal(pr.w,0,'the unassisted (0-assist) set is the record');
  const s=P.exerciseSeries(h,'assisted-pull-up',{bw:200});
  assert.equal(s.length,2,'both sessions plot — the 0-assist point is not dropped');
  assert.ok(s[1].est>s[0].est,`trend rises to the unassisted rep: ${s[0].est} → ${s[1].est}`);
});

/* ---- C3: the trend + "lifts trending up" read the RIGHT direction for inverted/timed lifts ---- */
test('C3: an assisted lift trends UP as the assist drops (was reading as decline)',()=>{
  const h=history(
    session(9,[['assisted-pull-up',[set(90,8)]]]),   // more assist = weaker (earlier)
    session(2,[['assisted-pull-up',[set(60,8)]]])     // less assist = stronger (later)
  );
  const s=P.exerciseSeries(h,'assisted-pull-up',{bw:200});
  assert.equal(s.length,2);
  assert.ok(s[1].est>s[0].est,`line should rise: ${s[0].est} → ${s[1].est}`);
  assert.equal(s[0].metric,'resist','tagged as effective resistance, not e1RM');
});

test('C3: a bodyweight plank trend plots seconds instead of an empty (load-0) line',()=>{
  const h=history(
    session(9,[['plank',[set(0,45)]]]),
    session(2,[['plank',[set(0,60)]]])
  );
  const s=P.exerciseSeries(h,'plank',{bw:0});
  assert.equal(s.length,2,'both sessions plot (was empty)');
  assert.deepEqual([s[0].est,s[1].est],[45,60]);
  assert.equal(s[0].metric,'time');
});

test('C3: progressionStat counts an assisted lift dropping assist as trending UP',()=>{
  const h=history(
    session(20,[['assisted-pull-up',[set(90,8)]]]),
    session(5,[['assisted-pull-up',[set(60,8)]]])
  );
  const st=A.progressionStat(h,NOW,200);
  assert.equal(st.n,1,'the lift is tracked');
  assert.equal(st.up,1,'and counted as improving, not declining');
});

test('C3: progressionStat excludes a disowned (nc) set',()=>{
  const h=history(
    session(20,[['barbell-bench-press',[set(100,5)]]]),
    session(5,[['barbell-bench-press',[set(100,5),set(140,3,{nc:true})]]])   // fluke disowned
  );
  const st=A.progressionStat(h,NOW,200);
  // with the nc set ignored, the lift is flat (100x5 → 100x5), not "up"
  assert.equal(st.up,0,'a set-aside fluke must not read as progress');
});

/* ---- C2: an assist machine that is progressing (less assist) is NOT flagged as stalled ---- */
function assistedRun(assists){   // oldest→newest assist values, weekly
  return history(...assists.map((a,i)=>session((assists.length-i)*7,[['assisted-pull-up',[set(a,8)]]])));
}
test('C2: dropping assist over a block is progress, not a stall (was rotated out mid-climb)',()=>{
  assert.equal(B.isStalled(assistedRun([90,80,70,60]),'assisted-pull-up'),false,'less assist = progressing');
});
test('C2 CONTROL: an assist machine with flat assist over the window is stalled',()=>{
  assert.equal(B.isStalled(assistedRun([70,70,70,70]),'assisted-pull-up'),true);
});
test('C2 CONTROL: a normal lift adding weight is still not stalled',()=>{
  const h=history(...[90,95,100,105].map((w,i)=>session((4-i)*7,[['barbell-bench-press',[set(w,8)]]])));
  assert.equal(B.isStalled(h,'barbell-bench-press'),false);
});
test('C2: a plank held longer over a block is not stalled',()=>{
  const h=history(...[40,50,55,60].map((sec,i)=>session((4-i)*7,[['plank',[set(0,sec)]]])));
  assert.equal(B.isStalled(h,'plank'),false,'longer holds = progressing');
});
