// v0.62.0 builder safety net. Two layers:
//  1. tools/builder-audit.js — the REAL builder across every muscle choice × gym × length × 100 seeds
//     (empty history). Every safety/programming/time check must be ZERO. A future change that brings
//     back a barbell at a machine gym, a near-duplicate or a 100-minute session fails here.
//  2. The history-dependent cases the audit can't reach: continued plans, rotations, "different
//     exercises", the heavy-lift cap and the session budget.
const test=require('node:test'),assert=require('node:assert');
const {execFileSync}=require('child_process');
const path=require('path');
const {IL,session,set,history,NOW}=require('./load.js');
const B=IL.builder,P=IL.prog,{EX,GROUPS,TIME_METRIC}=IL.data;

test('audit: every safety, programming and time check is zero across 26,400 builds',()=>{
  const out=JSON.parse(execFileSync('node',[path.join(__dirname,'..','tools','builder-audit.js'),'--json']).toString());
  const s=out.summary;
  ['gymViolation','duplicate','spinalOver2','beginnerRisk','isoBeforeCompound','nearDuplicate','pressPileup','hamstringsWeak',
   'calvesDouble','upperNoSideDelt','machineBackNoRow','emptyGroup','carryBeforeArms','overTime'].forEach(k=>
    assert.equal(s[k],0,k+' should be 0 — e.g. '+(out.examples[{gymViolation:'gym',duplicate:'dup',spinalOver2:'spinal',beginnerRisk:'beginnerRisk',
      isoBeforeCompound:'isoBeforeComp',nearDuplicate:'nearDup',pressPileup:'pressPileup',hamstringsWeak:'hamWeak',calvesDouble:'calvesDouble',
      upperNoSideDelt:'upperNoSide',machineBackNoRow:'machineBackNoRow',emptyGroup:'emptyGroup',carryBeforeArms:'carryFirst',overTime:'overTime'}[k]]||'')));
  assert.ok(s.avgDistinctLineups>=3,'builds vary between seeds (was 1 lineup per choice): '+s.avgDistinctLineups);
});

/* ---- continued plans: settings win (owner decision 2026-09-22) ---- */
const pull=d=>session(d,[['barbell-row',[set(135,8),set(135,8)]],['lat-pulldown',[set(120,10),set(120,10)]],['barbell-curl',[set(60,10)]]],{now:NOW});
test('a continued plan at a machine gym swaps a barbell lift with no Smith version, and says why',()=>{
  const hist=[3,10,17].map(pull);
  const p=B.planWorkout(['Back','Biceps'],hist,1,{now:NOW,profile:{gym:'machine'}});
  assert.ok(!p.ids.includes('barbell-row'),'the barbell row is gone: '+p.ids.join(','));
  const sw=p.reactions.find(r=>r.from==='barbell-row');
  assert.ok(sw&&sw.to&&EX[sw.to].group==='Back'&&/equipment/.test(sw.why),'swapped for a back lift with a reason: '+JSON.stringify(sw));
  assert.ok(p.ids.every(id=>EX[id].equip!=='Barbell'||B.SMITH_OK.has(id)),'nothing barbell-only survives');
});
test('CONTROL: the same continued plan at a full gym is untouched',()=>{
  const hist=[3,10,17].map(pull);
  const p=B.planWorkout(['Back','Biceps'],hist,1,{now:NOW,profile:{gym:'full'}});
  assert.ok(p.ids.includes('barbell-row'));
  assert.ok(!p.reactions.some(r=>r.type==='profile-swap'));
});
test('two lifts swapped out of one plan never land on the same replacement',()=>{
  const legs=d=>session(d,[['back-squat',[set(185,5)]],['front-squat',[set(135,5)]],['leg-extension',[set(90,12)]]],{now:NOW});
  const p=B.planWorkout(['Quads'],[3,10,17].map(legs),1,{now:NOW,profile:{gym:'home'}});
  assert.equal(new Set(p.ids).size,p.ids.length,'no duplicates: '+p.ids.join(','));
});

/* ---- heavy-lift cap ---- */
test('a built workout carries at most one heavy squat and one heavy hinge (≤2 spinal units), no duplicates',()=>{
  const out=B.capHeavyAxial(['back-squat','front-squat','romanian-deadlift','stiff-leg-deadlift'],undefined,[],true);
  assert.equal(out.filter(id=>B.isHeavyAxial(EX[id])&&EX[id].pat==='squat').length,1,'one squat: '+out);
  assert.equal(out.filter(id=>B.isHeavyAxial(EX[id])&&EX[id].pat==='hinge').length,1,'one hinge: '+out);
  assert.equal(new Set(out).size,out.length,'no duplicate replacement (audit #2): '+out);
  const units=ids=>ids.reduce((a,id)=>a+B.spinalUnits(EX[id]),0);
  assert.ok(units(B.capHeavyAxial(['back-squat','romanian-deadlift','barbell-row'],undefined,[],true))<=2,'a barbell row counts as half');
});

/* ---- rotation swaps (audit #10) ---- */
test('a stalled lift is never swapped for a timed hold, a heavier spinal lift, or a different movement',()=>{
  const r1=B.replacementFor('leg-extension',['leg-extension'],1);
  assert.ok(!TIME_METRIC.has(r1.id),'leg extension → not a wall sit: '+r1.id);
  const r2=B.replacementFor('machine-hip-thrust',['machine-hip-thrust'],1);
  assert.ok(!B.isHeavyAxial(EX[r2.id]),'machine hip thrust → not a heavy barbell lift: '+r2.id);
  const r3=B.replacementFor('front-raise',['front-raise'],1);
  assert.equal(EX[r3.id].pat,'iso','front raise → another isolation, not a press: '+r3.id);
});

/* ---- "Different exercises instead" really is different (audit #11) ---- */
test('a fresh build asked for different exercises avoids your last two sessions where it can',()=>{
  const chest=(d,ids)=>session(d,ids.map(id=>[id,[set(100,8)]]),{now:NOW});
  const hist=history(chest(3,['barbell-bench-press','incline-dumbbell-press','cable-crossover']),chest(10,['barbell-bench-press','incline-dumbbell-press','cable-crossover']));
  const recent=new Set(['barbell-bench-press','incline-dumbbell-press','cable-crossover']);
  const p=B.planWorkout(['Chest'],hist,1,{now:NOW,fresh:true});
  const repeats=p.ids.filter(id=>recent.has(id)).length;
  assert.ok(repeats<p.ids.length,'at least something changes: '+p.ids.join(','));
  assert.ok(!recent.has(p.ids[0]),'the anchor changes too: '+p.ids[0]);
});

/* ---- session budget (audit #6) ---- */
test('the session budget trims sets from the end, never below 2, and never drops a muscle’s only exercise',()=>{
  const ids=B.planWorkout(['Quads','Chest','Back','Hamstrings','Shoulders'],[],1,{fresh:true}).ids;
  const exs=ids.map(id=>B.seedExercise(id,[],{unit:'lb'}));
  const groups=new Set(exs.map(e=>EX[e.id].group));
  B.fitSessionBudget(exs,undefined);
  const cost=exs.reduce((a,e)=>a+e.sets.length*(P.sidesOf(e)===2?1.5:1),0);
  assert.ok(cost<=B.SESSION_SETS.standard,'within budget: '+cost);
  assert.ok(exs.every(e=>e.sets.length>=2),'never below 2 sets');
  assert.deepEqual(new Set(exs.map(e=>EX[e.id].group)).size,groups.size,'every picked muscle still trained');
});
test('picking more muscles than fit reports the ones left out',()=>{
  const p=B.planWorkout(GROUPS.slice(),[],1,{fresh:true});
  assert.ok(p.ids.length<=7,'still a sane session');
  assert.ok(p.skipped.length>0,'and it says which muscles had no room: '+p.skipped.join(','));
});

/* ---- strength goal (audit #13) ---- */
test('the strength goal narrows compounds only — isolation and timed work keep their range',()=>{
  assert.deepEqual(P.repRange(EX['barbell-bench-press'],'strength'),[5,5]);
  const lr=EX['lateral-raise'];assert.deepEqual(P.repRange(lr,'strength'),lr.rr,'a lateral raise keeps its range');
  const pk=EX['plank'];assert.deepEqual(P.repRange(pk,'strength'),pk.rr,'a plank keeps its hold range');
});
