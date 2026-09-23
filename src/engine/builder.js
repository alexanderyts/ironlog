// The intelligent workout builder: picks complementary exercises per muscle, orders the
// session for maximum performance, and suggests what's missing. Pure: takes history in.
var IL=globalThis.IL||(globalThis.IL={});
if(typeof require==='function'&&!IL.data)require('../data/exercises.js');
if(typeof require==='function'&&!IL.prog)require('./progression.js');
const {C,I,EXERCISES,EX,REGIONS,IDEAL_PATS,PAT_RANK,EQUIP_LOAD,LONG_LENGTH,INVERTED_LOAD,TIME_METRIC,regLabel,patLabel,hashId}=IL.data;
const {lastPerf,lastModeFor,lastSideFor,trackOf,nextSets,deloadSets,repRange,modeOf,real,DAY,unitIncrement}=IL.prog;

// Working sets a movement deserves when you've never logged it: main lifts 4, other compounds 3,
// isolation 3, finishers 2. Reps prefilled at the bottom of the target range.
function prescribedSets(ex){if(!ex)return 3;if(ex.type===C)return ex.tier===1?4:3;return ex.tier===3?2:3;}
// With history, the sets are seeded with the pattern-aware progressive-overload prescription
// (see nextSets in progression.js), not a stale copy of last time. The modality the user last
// performed this exercise with is remembered and carried onto the new instance, and the seed pulls
// from that modality's history so the prescription is like-for-like.
// extraSet (Phase C volume bump) duplicates the last set once, capped at MAX_SETS_PER_EX. Never on a
// deload (a deload reduces work) — the caller already excludes deloads from volumeBump.
// Set-style lever (Profile P2). 'ramp': a tier-1 lift's prescription becomes three ascending sets
// [0.8w, 0.9w, w] on the plate grid — a built-in warm-up ramp to the top set. 'straight': forces
// every set flat at the top weight even if last time ramped. Only reshapes weighted sets, so a
// brand-new lift with no load yet is left as-is; reps are carried from the prescription.
function shapeStyle(sets,style,ex,unit){
  if(!sets.length)return sets;
  const w=Math.max(...sets.map(s=>+s.w||0));
  if(w<=0)return sets;
  // straight = every set at the top weight AND the top set's reps. Carrying each set's own reps would
  // put a back-off set's reps on the top weight (200×5/180×8/180×8 → 200×8) — the v0.39.1 ramp bug's twin (#18).
  if(style==='straight'){const topR=(sets.find(s=>(+s.w||0)===w)||sets[sets.length-1]).r;return sets.map(s=>({w,r:topR,done:false}));}
  if(style==='ramp'&&ex&&ex.tier===1){
    // reps come from the set that CARRIES the top weight — on a descending pattern (heavy opener,
    // lighter back-offs) the last set holds back-off reps, which must not land on the top set
    const inc=unitIncrement(unit||'lb',ex),topR=(sets.find(s=>(+s.w||0)===w)||sets[sets.length-1]).r,grid=x=>Math.max(inc,Math.round(x/inc)*inc);
    return[{w:grid(w*0.8),r:topR,done:false},{w:grid(w*0.9),r:topR,done:false},{w,r:topR,done:false}];
  }
  return sets;
}
function seedExercise(id,sessions,opts){
  opts=opts||{};const {excludeId,unit,deload,extraSet,goal,setStyle,push}=opts;   // goal/setStyle/push: profile levers
  const ex=EX[id];const mode=lastModeFor(sessions,id),side=lastSideFor(sessions,id);
  const inst={id,name:ex?ex.name:id};if(mode)inst.mode=mode;if(side!=null)inst.side=side;   // remember "⇆ Each side" like the equipment choice
  // An overridden side is its own history track — seed from THAT track, never the other way of doing it
  const lp=lastPerf(sessions||[],id,{excludeId,mode:side!=null?trackOf(inst):(mode||undefined),clean:true});   // real sessions only — a deload is never a baseline; `clean` so a set marked "doesn't count" is never prefilled back at you
  const rr=goal?repRange(ex,goal):(ex?ex.rr:[8,12]);   // goal shifts the target range in one place
  let sets;
  // push:'quiet' — "just record": the rows mirror last time exactly, never a bump. Must agree with
  // suggestion(), which shows neutral text under quiet; a bumped row next to "Recorded" would lie.
  if(lp&&lp.sets.length)sets=(deload?deloadSets(lp.sets,ex,unit):push==='quiet'?lp.sets.map(s=>({w:+s.w||0,r:+s.r||0})):nextSets(lp.sets,ex,unit,goal?rr:undefined).sets).map(s=>({w:s.w,r:s.r,done:false}));
  else{const n=prescribedSets(ex),r=ex?(deload?rr[1]:rr[0]):'';sets=Array.from({length:n},()=>({w:'',r:r,done:false}));}
  if(!deload&&setStyle)sets=shapeStyle(sets,setStyle,ex,unit);   // never reshape a deload — recovery has its own prescription
  if(deload&&sets.length>DELOAD_MAX_SETS)sets=sets.slice(0,DELOAD_MAX_SETS);   // a deload cuts volume as well as load
  if(extraSet&&!deload&&sets.length&&sets.length<MAX_SETS_PER_EX){const last=sets[sets.length-1];sets.push({w:last.w,r:last.r,done:false});}
  inst.sets=sets;return inst;
}
// Exercise ids from the most recent completed session that trained this group
function lastSessionIds(sessions,g){
  const s=(sessions||[]).find(x=>x.completed!==false&&x.exercises.some(e=>EX[e.id]&&EX[e.id].group===g));
  return s?s.exercises.map(e=>e.id):[];
}

// How much an exercise "deserves" to go early: biggest / most-loadable compounds while fresh,
// isolation last, foundational before secondary, and the focus muscle's key lift leads.
function perfPriority(ex,focus){
  if(!ex)return -1;                    // unknown id (retired/imported) sorts last, never crashes ordering
  let p=(PAT_RANK[ex.pat]||1)*16;      // squat/hinge 96 · press/pull 64 · lunge 48 · iso 16
  if(ex.type===C)p+=15;
  p+=EQUIP_LOAD[ex.equip]||0;
  p+=ex.tier===1?6:ex.tier===2?2:0;
  if(focus&&ex.group===focus)p+=10;
  return p;
}
function orderByFatigue(ids,focus){
  return ids.map((id,i)=>({id,i,p:perfPriority(EX[id],focus)})).sort((a,b)=>b.p-a.p||a.i-b.i).map(o=>o.id);
}
// Barbell squats/deadlifts/RDLs load the spine; a hip thrust loads the hips, so it's exempt
const isHeavyAxial=e=>!!e&&e.type===C&&e.equip==='Barbell'&&(e.pat==='squat'||e.pat==='hinge')&&e.id!=='hip-thrust';
// Does an exercise pass the profile's hard filters (avoid → gym → protect)? A STRICT per-exercise
// test with no backoff — for callers where dropping the exercise is fine. profilePool applies the
// same three rules but relaxes them rather than strand a group; this never relaxes. Same rule set,
// so the two can't drift on what "machine excludes" or "protect drops" means.
function profileAllows(e,g,profile,sessions){
  if(!profile||!e)return true;
  if(profile.avoid&&profile.avoid.indexOf(e.id)>=0)return false;
  if(profile.gym==='machine'&&e.equip==='Barbell'&&lastModeFor(sessions,e.id)!=='smith')return false;
  if(profile.gym==='home'&&!(e.equip==='Dumbbell'||e.equip==='Bodyweight'))return false;
  if(profile.protect&&profile.protect.indexOf(g)>=0&&e.tier===1&&e.type==='compound'&&(e.equip==='Barbell'||e.equip==='Dumbbell'))return false;
  return true;
}
// Safety: at most two heavy barbell squat/hinge lifts per session. Extras swap to a non-barbell
// variant of the same pattern from the same muscle, else are dropped. The alternative must clear the
// profile too — an over-cap swap is the builder's own change, so it may not smuggle back an avoided /
// off-equipment / protected lift (a real leak the P4 audit caught). No legal alt → drop the extra.
function capHeavyAxial(ids,profile,sessions){
  const heavy=ids.filter(id=>isHeavyAxial(EX[id]));
  if(heavy.length<=2)return ids;
  const keep=new Set(orderByFatigue(heavy).slice(0,2));
  return ids.map(id=>{
    if(!isHeavyAxial(EX[id])||keep.has(id))return id;
    const e=EX[id];
    const alt=EXERCISES.find(x=>x.group===e.group&&x.pat===e.pat&&!isHeavyAxial(x)&&ids.indexOf(x.id)<0&&profileAllows(x,x.group,profile,sessions));
    return alt?alt.id:null;
  }).filter(Boolean);
}

// Pick exercises for one muscle group:
//  1. anchor = a foundational (tier-1) lift on the muscle's KEY pattern — and the SAME one you've been
//     progressing if you have history, so progressive overload compounds week to week.
//  2. fill to cover the muscle's regions/heads AND its complementary movement patterns.
//  3. stop when nothing left adds real coverage — no padding with redundant movements.
// Does a coach hint flag this exercise as filling a gap for its group? (Phase C reaction 2.)
function fillsGap(e,hints){
  if(!hints||!hints.gaps)return false;
  return hints.gaps.some(gp=>gp.group===e.group&&(gp.reg===e.reg||gp.pat===e.pat));
}
// Training-profile equipment/avoid/protect levers, applied to a candidate list in a FIXED order
// (avoid → gym → protect) so they compose predictably. Each is a no-op when the profile is Balanced.
// Never returns empty: if a lever would strand a group, it backs off to the least-restrictive result.
function profilePool(list,g,profile,sessions){
  if(!profile)return list;
  const avoid=profile.avoid&&profile.avoid.length?new Set(profile.avoid):null;
  const p=avoid?list.filter(e=>!avoid.has(e.id)):list;
  const full=p.filter(e=>profileAllows(e,g,profile,sessions));   // avoid+gym+protect, the strict rule
  if(full.length)return full;              // best case: all levers satisfied
  const gymFilter=e=>profile.gym==='machine'?(e.equip!=='Barbell'||lastModeFor(sessions,e.id)==='smith')
    :profile.gym==='home'?(e.equip==='Dumbbell'||e.equip==='Bodyweight'):true;
  const gymOnly=p.filter(gymFilter);
  if(gymOnly.length)return gymOnly;        // protect emptied it → keep the gym constraint at least
  return p.length?p:list;                  // gym emptied it → avoid-only, else the untouched list
}
// `trace` (optional array) collects {id, sc, why:[...]} for every pick — a window into WHY the builder
// chose each exercise, used by tools/review.js. No effect on the result.
function pickForGroup(g,per,seed,sessions,hints,trace,profile){
  sessions=sessions||[];
  const pool=profilePool(EXERCISES.filter(e=>e.group===g),g,profile,sessions);
  if(!pool.length)return [];
  const ideal=REGIONS[g]||['overall'],idealPats=IDEAL_PATS[g]||['iso'];
  const recent=lastSessionIds(sessions,g);
  const sel=[],covReg=new Set(),covPat=new Set();
  let cand=pool.filter(e=>e.tier===1);
  if(!cand.length)cand=pool.filter(e=>e.type===C);
  if(!cand.length)cand=pool;
  const keyed=cand.filter(e=>idealPats.indexOf(e.pat)>=0);
  if(keyed.length)cand=keyed;
  const withHist=cand.map(e=>({e,lp:lastPerf(sessions,e.id)})).filter(x=>x.lp).sort((a,b)=>b.lp.date-a.lp.date);
  let anchor;
  if(withHist.length)anchor=withHist[0].e;
  else{const ranked=cand.slice().sort((a,b)=>perfPriority(b)-perfPriority(a));
    const top=ranked.filter(e=>perfPriority(e)===perfPriority(ranked[0]));
    anchor=top[seed%top.length];}
  sel.push(anchor);covReg.add(anchor.reg);covPat.add(anchor.pat);
  if(trace)trace.push({id:anchor.id,sc:null,why:[withHist.length?'anchor: your most recently trained foundational '+g.toLowerCase()+' lift':'anchor: highest-priority foundational '+g.toLowerCase()+' lift (no history)']});
  while(sel.length<per&&sel.length<pool.length){
    let best=null,bestScore=0,bestWhy=null;
    const isoCount=sel.filter(x=>x.type===I).length,compCount=sel.filter(x=>x.type===C).length;
    pool.forEach(e=>{
      if(sel.indexOf(e)>=0)return;
      let sc=0;const why=[];
      const newReg=!covReg.has(e.reg),newPat=!covPat.has(e.pat);
      if(newReg){const v=ideal.indexOf(e.reg)>=0?4:1;sc+=v;why.push(`+${v} new region (${e.reg})`);}
      if(newPat){const v=idealPats.indexOf(e.pat)>=0?3:1;sc+=v;why.push(`+${v} new pattern (${e.pat})`);}
      if(e.type===I&&isoCount===0&&sel.length>=1){sc+=1.5;why.push('+1.5 first isolation');}
      if(e.type===C&&compCount>=2){const v=compCount>=3?1.5:0.5;sc-=v;why.push(`-${v} already ${compCount} compounds`);}
      if(isHeavyAxial(e)&&idealPats.indexOf(e.pat)<0){sc-=2.5;why.push('-2.5 heavy axial off-pattern');}
      if(!newReg&&!newPat){
        if(e.type===C&&!sel.some(x=>x.pat===e.pat&&x.equip===e.equip)){sc+=0.8;why.push('+0.8 same pattern, different equipment');} else{sc-=1;why.push('-1 nothing new');}
      }
      const tb=e.tier===1?0.6:e.tier===2?0.3:0;if(tb){sc+=tb;why.push(`+${tb} tier ${e.tier}`);}
      const eq=(EQUIP_LOAD[e.equip]||0)/20;sc+=eq;if(eq)why.push(`+${eq.toFixed(2)} ${e.equip.toLowerCase()} loadability`);
      if(recent.indexOf(e.id)>=0){sc-=0.4;why.push('-0.4 did it last session');}
      // Phase D: a small nudge toward including one lengthened-position (stretch) movement per muscle
      if(LONG_LENGTH&&LONG_LENGTH.has(e.id)&&!sel.some(x=>LONG_LENGTH.has(x.id))){sc+=0.7;why.push('+0.7 stretch-position option');}
      if(fillsGap(e,hints)){sc+=2;why.push('+2 covers a Coach-flagged gap');}   // Phase C
      sc+=((hashId(e.id)+seed)%5)/100;
      if(sc>bestScore){bestScore=sc;best=e;bestWhy=why;}
    });
    if(!best)break;
    sel.push(best);covReg.add(best.reg);covPat.add(best.pat);
    if(trace)trace.push({id:best.id,sc:+bestScore.toFixed(2),why:bestWhy});
  }
  return sel;
}
// groups: muscle groups in the order the user picked them (first = session focus)
function buildRecommendation(groups,sessions,seed,hints,trace,profile){
  groups=groups&&groups.length?groups.slice():['Chest','Back'];
  seed=seed==null?Math.floor(Math.random()*997):seed;
  let total=groups.length>=3?7:groups.length===2?6:4;
  if(profile){if(profile.length==='short')total=Math.min(total,5);else if(profile.length==='long')total=Math.min(total+1,8);}   // session-size lever
  const per={};const base=Math.max(1,Math.floor(total/groups.length));
  groups.forEach(g=>per[g]=base);
  let rem=total-base*groups.length;
  const bySize=groups.slice().sort((a,b)=>(REGIONS[b]||[]).length-(REGIONS[a]||[]).length);
  for(let i=0;i<rem;i++)per[bySize[i%bySize.length]]++;
  let out=[];
  groups.forEach(g=>{const cap=Math.min(per[g],Math.max((REGIONS[g]||['overall']).length,(IDEAL_PATS[g]||[]).length)+1,EXERCISES.filter(e=>e.group===g).length);
    out.push(...pickForGroup(g,cap,seed,sessions,hints,trace,profile).map(e=>e.id));});
  // Hard session ceiling: picking many groups (e.g. all 11) must not produce an 11-exercise workout.
  // orderByFatigue puts the highest-priority work first, so the slice drops the lowest-priority
  // isolation last. The 'long' length lever raises the ceiling to 8.
  return orderByFatigue(capHeavyAxial(out,profile,sessions),groups[0]).slice(0,Math.max(MAX_SESSION_EX,total));
}
// Suggest exercises that COMPLEMENT what's already chosen — always from a muscle group already in
// the workout (a pull day should never get a press "to balance" it; that's a program-level,
// multi-week concern that Coach's Notes already covers, not a within-session one). Returns [{id, why}].
function complementSuggestions(chosenIds,limit){
  limit=limit||3;
  const chosen=chosenIds.map(id=>EX[id]).filter(Boolean);
  if(!chosen.length)return [];
  const groups=new Set(chosen.map(e=>e.group));
  const covReg={},covPatG={},covPat=new Set();
  chosen.forEach(e=>{(covReg[e.group]=covReg[e.group]||new Set()).add(e.reg);(covPatG[e.group]=covPatG[e.group]||new Set()).add(e.pat);covPat.add(e.pat);});
  const scored=EXERCISES.filter(e=>groups.has(e.group)&&chosenIds.indexOf(e.id)<0).map(e=>{
    let sc=0,why='';
    const ideal=REGIONS[e.group]||[],ip=IDEAL_PATS[e.group]||[];
    if(ideal.indexOf(e.reg)>=0&&!(covReg[e.group]&&covReg[e.group].has(e.reg))){sc+=5;why='Hits your '+regLabel(e.group,e.reg)+' — not covered yet';}
    if(ip.indexOf(e.pat)>=0&&!(covPatG[e.group]&&covPatG[e.group].has(e.pat))){sc+=4;if(!why)why='Adds '+(e.pat==='iso'?'an isolation angle':'a '+patLabel(e.pat))+' — pairs with your '+e.group.toLowerCase()+' work';}
    else if(!covPat.has(e.pat)&&e.pat!=='iso'){sc+=2;if(!why)why='Adds a '+patLabel(e.pat)+' — new movement angle';}
    if(e.type===I&&!why){sc+=0.6;why='Isolation to finish off your '+e.group.toLowerCase();}
    sc+=e.tier===1?0.5:e.tier===2?0.3:0;
    return {e,sc,why};
  }).filter(x=>x.sc>0&&x.why).sort((a,b)=>b.sc-a.sc);   // require a reason, so no blank suggestion line
  const res=[],seen=new Set();
  for(const x of scored){const key=x.e.group+':'+x.e.reg;if(seen.has(key))continue;seen.add(key);res.push({id:x.e.id,why:x.why});if(res.length>=limit)break;}
  return res;
}

/* ── Mesocycle-aware planning ────────────────────────────────────────────────────────────────────
   Progressive overload needs the SAME movements repeated long enough to add load to them, and the
   practice effect (technique improving with exposure) is itself a big part of early progress. So a
   "Build me a workout" for muscles you trained recently must not reshuffle the accessories — it
   should continue the plan, and rotate movements only deliberately: one at a time, never the
   anchor, and only when a movement is stale or stalled (a stall is exactly when a variation helps).

   Deliberately NO new persisted "plan" state: the session history already is the plan record.
   The plan for a muscle combination = the most recent completed session for that combination
   (within CONTINUE_DAYS); repeat streaks and stalls are derived by walking history. That syncs via
   the existing session merge for free and can never drift out of step with what was actually done.

   Rotation policy (Roadmap v4 Phase B — measured in TIME, not session count, and biased hard toward
   continuity, per the user's goal of progress over variety):
     • A non-anchor accessory rotates ONLY when it is STALLED — best-set e1RM not improving across ≥3
       performances spanning ≥STALL_MIN_DAYS. A lift that is still progressing is NEVER rotated, no
       matter how long it's been in the plan. "Stick with what works" is the default.
     • The ANCHOR (tier-1 key-pattern lift) normally never rotates. Sole exception: a long stall
       (≥ANCHOR_STALL_WEEKS of tenure) that a recent deload (≤ANCHOR_DELOAD_DAYS) did NOT unstick →
       swap to a same-group, same-pattern tier-1 VARIATION (bench→incline, squat→front squat), never
       dropping the pattern. Rare by construction.
     • At most ONE change per continued session (anchor swap wins, else one accessory); among stalled
       accessories the one in the plan longest rotates.
     • Exposure is measured in WEEKS (exerciseTenure), which normalizes by frequency: 8 sessions at
       2×/week and 4 at 1×/week are both "4 weeks" of the same movement — a high-frequency lifter is
       never churned by a raw session counter (the bug this phase fixes). */
const CONTINUE_DAYS=10,LAPSE_DAYS=42,STALL_MIN_DAYS=14,ANCHOR_STALL_WEEKS=3,ANCHOR_DELOAD_DAYS=21,MAX_SESSION_EX=7,MAX_SETS_PER_EX=5,DELOAD_MAX_SETS=3;
const WEEK=7*DAY;
const {e1rm}=IL.prog;

function sessionGroups(s){const g={};s.exercises.forEach(e=>{const x=EX[e.id];if(x)g[x.group]=(g[x.group]||0)+1;});return g;}
// The most recent completed session (within the window) that trained exactly these groups —
// tolerating one incidental add-on exercise from another group.
// The plan for these groups = the most recent matching real session. Walk ALL completed sessions with
// a moving reference: a DELOAD advances the window instead of ending it (so a 3+1 block continues the
// plan, not restarts it — #4), and a non-matching real session advances it too. Two windows: within
// CONTINUE_DAYS it's the normal "Session N" continuation; out to LAPSE_DAYS (a missed week or a
// holiday) it still continues but is flagged `meta.lapsed` so the caller skips stall/rotation/volume.
function findPlan(groups,sessions,now,meta){
  now=now||Date.now();const want=new Set(groups);
  const completed=(sessions||[]).filter(s=>s.completed!==false&&s.exercises&&s.exercises.length&&s.kind!=='cardio');   // newest-first (upsert/history keep it sorted)
  const scan=maxGap=>{
    let ref=now;
    for(const s of completed){
      if(ref-s.date>maxGap*DAY)return null;      // the chain broke — nothing recent enough to continue
      if(s.deload){ref=s.date;continue;}         // a deload bridges the gap without being the plan itself
      const sg=sessionGroups(s);
      if([...want].every(g=>sg[g])){
        // tolerate ONE incidental add-on from outside the picked groups, summed across them, so picking
        // 'Chest' alone won't continue a whole push day
        const extras=Object.keys(sg).filter(g=>!want.has(g)).reduce((a,g)=>a+sg[g],0);
        if(extras<=1)return s;
      }
      ref=s.date;
    }
    return null;
  };
  const near=scan(CONTINUE_DAYS);if(near)return near;
  const far=scan(LAPSE_DAYS);if(far){if(meta)meta.lapsed=true;return far;}
  return null;
}
// How long this exercise has been in the plan: the run of consecutive most-recent sessions of its
// group that included it, and the calendar SPAN of that run in weeks (see the policy note above).
// Deloads are transparent to it.
function exerciseTenure(sessions,exId){
  const ex=EX[exId];if(!ex)return{sessions:0,weeks:0,oldest:0};
  let n=0,newest=0,oldest=0;
  for(const s of real(sessions)){
    if(!s.exercises.some(e=>EX[e.id]&&EX[e.id].group===ex.group))continue;
    if(!s.exercises.some(e=>e.id===exId))break;              // a group session that dropped it ends the run
    if(n&&(oldest-s.date)>CONTINUE_DAYS*DAY)break;           // a long break (returning after time off) ends the run
    if(!n)newest=s.date;oldest=s.date;n++;
  }
  return{sessions:n,weeks:n?(newest-oldest)/WEEK:0,oldest};
}
function exerciseStreak(sessions,exId){return exerciseTenure(sessions,exId).sessions;}
// The last n performances, newest first, as {date, score, top}. score = best-set estimated 1RM
// (folds reps in); top = heaviest working weight that session. opts: {n, mode, since}. `since` bounds
// the scan to the current tenure run so ancient heavier history can't defeat the recent window.
// Mode-scoped so alternating equipment doesn't produce a meaningless sequence.
function recentPerfs(sessions,exId,opts){
  opts=opts||{};const n=opts.n||3,out=[];let before;
  // Every axis below is normalized so HIGHER = BETTER, letting isStalled's comparisons stay direction-
  // agnostic across lift types. Assist machines: less assist is better, so top/score = −(least assist).
  // Time-held lifts: longer is better, so top/score = seconds. Everything else: heaviest weight / e1RM.
  const inv=INVERTED_LOAD&&INVERTED_LOAD.has(exId), time=TIME_METRIC&&TIME_METRIC.has(exId);
  for(let i=0;i<n;i++){
    const lp=lastPerf(sessions,exId,{beforeTs:before,mode:opts.mode,clean:true});if(!lp)break;   // a disowned set is not evidence of progress OR of a stall
    if(opts.since&&lp.date<opts.since)break;
    let top,topR,score;
    if(inv){const minA=Math.min(...lp.sets.map(s=>+s.w||0));top=-minA;score=-minA;topR=Math.max(...lp.sets.filter(s=>(+s.w||0)===minA).map(s=>+s.r||0));}
    else if(time){const maxS=Math.max(...lp.sets.map(s=>+s.r||0));top=maxS;score=maxS;topR=maxS;}
    else{top=Math.max(...lp.sets.map(s=>+s.w||0));topR=Math.max(...lp.sets.filter(s=>(+s.w||0)===top).map(s=>+s.r||0));score=Math.max(...lp.sets.map(s=>s.w>0?e1rm(s.w,s.r):s.r));}
    out.push({date:lp.date,score,top,topR});
    before=lp.date;
  }
  return out;
}
// Stalled = your best in the last ~2 weeks hasn't beaten your best from before that, judged in
// CALENDAR time (fair across frequency). Three guards keep it from mistaking progress for a plateau:
//   • the run must span at least STALL_MIN_DAYS (a fresh/short run can't be "stalled");
//   • only performances within the current tenure run count (ancient heavier sessions are excluded);
//   • a HEAVIER top weight in the recent window is progress regardless of e1RM — double progression
//     drops reps (and thus estimated 1RM) right after a weight bump, which must NOT read as a stall.
function isStalled(sessions,exId,opts){
  opts=opts||{};
  const t=exerciseTenure(sessions,exId);
  if(t.weeks*7<STALL_MIN_DAYS)return false;                       // not enough calendar time in this run
  const p=recentPerfs(sessions,exId,{n:8,mode:opts.mode,since:t.oldest});
  if(p.length<3)return false;
  const cutoff=p[0].date-STALL_MIN_DAYS*DAY;
  const recent=p.filter(x=>x.date>cutoff),old=p.filter(x=>x.date<=cutoff);
  if(!recent.length||!old.length)return false;                   // not enough calendar span yet
  const rTop=Math.max(...recent.map(x=>x.top)),oTop=Math.max(...old.map(x=>x.top));
  if(rTop>oTop)return false;                                      // added weight = progressing
  // Same top weight but MORE reps at it = double progression before the next bump (100×12 → 105×8 →
  // 105×9 → 105×10 is climbing, not stalled). e1RM ties here (Epley: 105×10 = 100×12) would otherwise
  // read as a plateau and rotate the lift out mid-climb (#3).
  if(rTop===oTop){
    const rReps=Math.max(...recent.filter(x=>x.top===rTop).map(x=>x.topR));
    const oReps=Math.max(...old.filter(x=>x.top===oTop).map(x=>x.topR));
    if(rReps>oReps)return false;
  }
  return Math.max(...recent.map(x=>x.score))<=Math.max(...old.map(x=>x.score));
}
// A deload taken within `days` that (when exId is given) actually trained that exercise's muscle —
// a legs-only deload doesn't count as having tried to unstick a bench press. opts: {now, days, exId}.
function recentDeload(sessions,opts){
  opts=opts||{};const now=opts.now||Date.now(),cut=now-(opts.days||ANCHOR_DELOAD_DAYS)*DAY,g=opts.exId&&EX[opts.exId]&&EX[opts.exId].group;
  return (sessions||[]).some(s=>s.deload&&s.completed!==false&&s.date>=cut&&s.date<now&&(!opts.exId||s.exercises.some(e=>EX[e.id]&&EX[e.id].group===g)));
}
function planAnchor(ids,g){
  const c=ids.map(id=>EX[id]).filter(e=>e&&e.group===g&&e.tier===1&&(IDEAL_PATS[g]||[]).indexOf(e.pat)>=0);
  return c.sort((a,b)=>perfPriority(b)-perfPriority(a))[0]||null;
}
// The replacement for a rotated exercise is DETERMINISTIC (tie-broken by hashId, not the build seed)
// so rebuilding a stalled plan gives the same swap — a rotation shouldn't be a lottery. (Seed still
// varies fresh builds; only the continue-path rotation goes through here.)
function replacementFor(exId,planIds,seed,hints,profile,sessions){
  const e=EX[exId];
  const cands=profilePool(EXERCISES.filter(x=>x.group===e.group&&x.id!==exId&&planIds.indexOf(x.id)<0),e.group,profile,sessions);
  return cands.map(x=>{let sc=(x.reg===e.reg?4:0)+(x.pat===e.pat?3:0)+(x.type===e.type?1:0)+(x.tier===1?.5:x.tier===2?.3:0)+(fillsGap(x,hints)?2:0)+(hashId(x.id)%5)/100;return{x,sc};})
    .sort((a,b)=>b.sc-a.sc)[0]?.x||null;
}
// A same-group, same-pattern tier-1 alternative for a stalled anchor (bench→incline, squat→front
// squat) — a variation for the block, never a change of pattern. Deterministic. Null if none.
function anchorVariation(exId,planIds,seed,profile,sessions){
  const e=EX[exId];
  const cands=profilePool(EXERCISES.filter(x=>x.tier===1&&x.group===e.group&&x.pat===e.pat&&x.id!==exId&&planIds.indexOf(x.id)<0),e.group,profile,sessions);
  return cands.sort((a,b)=>perfPriority(b)-perfPriority(a)||(hashId(a.id)%5)-(hashId(b.id)%5))[0]||null;
}
// An exercise id to cover a flagged gap that isn't already in the plan (Phase C reaction 4).
function gapFillExercise(gp,ids,profile,sessions){
  // A gap-add is OPTIONAL, so filter STRICTLY through profileAllows (drop, never back off): a machine
  // gym must not get a barbell RDL added, a home gym a cable face-pull, etc. (#5). profilePool's backoff
  // is right for a group that MUST be covered; wrong here, where skipping the add is fine.
  if(gp.type==='pattern-gap'&&gp.exId&&ids.indexOf(gp.exId)<0&&profileAllows(EX[gp.exId],gp.group,profile,sessions))return gp.exId;
  const cands=EXERCISES.filter(x=>x.group===gp.group&&ids.indexOf(x.id)<0&&(gp.reg?x.reg===gp.reg:x.pat===gp.pat)&&profileAllows(x,gp.group,profile,sessions));
  return cands.sort((a,b)=>(a.tier-b.tier)||(perfPriority(b)-perfPriority(a)))[0]?.id||null;
}
// What to train for these groups today. Returns {ids, mode:'continue'|'fresh', plan, rotation, streak,
// reactions, volumeBump}. opts.fresh forces a fresh build; opts.hints (from analysis.buildHints) lets
// the builder REACT to Coach's findings — always additively/by scoring, never overriding continuity.
function planWorkout(groups,sessions,seed,opts){
  opts=opts||{};sessions=sessions||[];
  groups=groups&&groups.length?groups.slice():['Chest','Back'];
  seed=seed==null?Math.floor(Math.random()*997):seed;
  const deload=!!opts.deload,profile=opts.profile;
  const maxEx=profile&&profile.length==='long'?8:MAX_SESSION_EX;
  const protect=new Set(profile&&profile.protect||[]);
  const hints=deload?null:opts.hints,reactions=[],volumeBump=[];   // a deload never adds volume/coverage
  const meta={};
  const plan=opts.fresh?null:findPlan(groups,sessions,opts.now,meta);
  if(!plan)return{ids:buildRecommendation(groups,sessions,seed,hints,undefined,profile),mode:'fresh',plan:null,rotation:null,streak:0,reactions,volumeBump,deload};
  const lapsed=!!meta.lapsed;
  let ids=plan.exercises.map(e=>e.id).filter(id=>EX[id]);
  // Profile 'avoid' applies even to a continued plan: swap any avoided lift for a same-group
  // alternative (a user directive, not a reaction — so it holds on a deload too).
  if(profile&&profile.avoid&&profile.avoid.length){const av=new Set(profile.avoid);
    ids=ids.map(id=>{if(!av.has(id))return id;const to=replacementFor(id,ids,seed,hints,profile,sessions);
      if(to){reactions.push({type:'avoid-swap',from:id,to:to.id,why:'swapped '+(EX[id]?EX[id].name:id)+' — you asked to avoid it'});return to.id;}return id;});}
  // A deload CONTINUES the plan verbatim — same exercises, just lighter (seedExercise cuts load and
  // volume). Zero structural changes: no stall check, rotation, anchor swap, gap-add or volume bump.
  if(deload)return{ids:orderByFatigue(capHeavyAxial(ids,profile,sessions),groups[0]),mode:'continue',plan,rotation:null,streak:0,reactions,volumeBump,deload:true};
  // Coming back after a lapse (a missed week / holiday): continue the plan with weights carried from
  // where you left off, but make NO structural change — you weren't stalled, you were away, and a
  // detrained first session back shouldn't get extra volume or a rotation.
  if(lapsed)return{ids:orderByFatigue(capHeavyAxial(ids,profile,sessions),groups[0]),mode:'continue',plan,rotation:null,streak:0,reactions,volumeBump,deload:false,lapsed:true};
  const modeById={};plan.exercises.forEach(e=>{if(EX[e.id])modeById[e.id]=trackOf(e);});   // stall checks follow the same track (equipment + side)
  // Anchors are protected from rotation: the group's key tier-1 lift AND every other tier-1 lift in the
  // plan (a main deadlift/squat is not an "accessory" to be swapped out on a stall — #15).
  const anchors=new Set([...groups.map(g=>planAnchor(ids,g)).filter(Boolean).map(e=>e.id),...ids.filter(id=>EX[id]&&EX[id].tier===1)]);
  let rotation=null,structural=false;   // at most ONE structural change per session (swap OR gap-add)
  // 1. Anchor variation swap — rare: a long-stalled main lift that a recent deload OF THAT MUSCLE
  //    didn't unstick.
  for(const aid of anchors){
    if(!recentDeload(sessions,{now:opts.now,exId:aid}))continue;
    const t=exerciseTenure(sessions,aid);
    if(t.weeks>=ANCHOR_STALL_WEEKS&&isStalled(sessions,aid,{mode:modeById[aid],now:opts.now})){
      const to=anchorVariation(aid,ids,seed,profile,sessions);
      if(to){ids=ids.map(id=>id===aid?to.id:id);rotation={from:aid,to:to.id,why:'anchor-stalled',anchor:true};structural=true;break;}
    }
  }
  // 2. Otherwise, rotate at most one STALLED accessory (the one in the plan longest). A progressing
  //    accessory is never touched — continuity is the default. Prefer a gap-filling replacement.
  if(!structural){
    const cands=ids.filter(id=>!anchors.has(id)).map(id=>({id,sessions:exerciseTenure(sessions,id).sessions,stalled:isStalled(sessions,id,{mode:modeById[id],now:opts.now})}))
      .filter(c=>c.stalled).sort((a,b)=>b.sessions-a.sessions);
    if(cands.length){const c=cands[0],to=replacementFor(c.id,ids,seed,hints,profile,sessions);
      if(to){ids=ids.map(id=>id===c.id?to.id:id);rotation={from:c.id,to:to.id,why:'stalled',streak:c.sessions};structural=true;}}
  }
  // 3. Gap-ADD (never a swap): one exercise for a flagged region/pattern the plan doesn't cover, only
  //    if there's room and no structural change happened yet. Self-limiting — once logged, gap clears.
  if(!structural&&hints&&hints.gaps&&ids.length<maxEx){
    const covered=gp=>ids.some(id=>EX[id]&&EX[id].group===gp.group&&(gp.reg?EX[id].reg===gp.reg:EX[id].pat===gp.pat));
    const gp=hints.gaps.filter(g=>groups.indexOf(g.group)>=0&&!protect.has(g.group)&&!covered(g)).sort((a,b)=>b.prio-a.prio)[0];
    if(gp){const add=gapFillExercise(gp,ids,profile,sessions);if(add&&EX[add]){ids.push(add);structural=true;reactions.push({type:'gap-add',exId:add,group:gp.group,why:'covers '+(gp.reg?regLabel(gp.group,gp.reg):patLabel(gp.pat))});}}
  }
  // 4. Volume bump (+1 set) for the ONE most-undertrained group this session (the lowest sets/week),
  //    not every low group at once — adding five sets while the toast says "+1 set" was dishonest, and
  //    piling volume onto a returning/low-volume lifter is wrong (#23). Self-limiting: as each session
  //    lifts a group over its landmark, the next session moves to the next-lowest.
  const undByVol=hints&&(hints.undertrainedByVolume||(hints.undertrained||[]).map(g=>({group:g,perWeek:0})));   // accept the old {undertrained:[names]} shape too
  if(undByVol&&undByVol.length){
    const pick=undByVol.filter(u=>groups.indexOf(u.group)>=0&&!protect.has(u.group))[0];
    if(pick){const g=pick.group,target=ids.find(id=>EX[id]&&EX[id].group===g&&anchors.has(id))||ids.find(id=>EX[id]&&EX[id].group===g);
      if(target&&volumeBump.indexOf(target)<0){volumeBump.push(target);reactions.push({type:'volume',exId:target,group:g,why:g.toLowerCase()+' volume is low — added a set'});}}
  }
  const streak=Math.min(...ids.filter(id=>!rotation||id!==rotation.to).map(id=>exerciseStreak(sessions,id)));
  return{ids:orderByFatigue(capHeavyAxial(ids,profile,sessions),groups[0]),mode:"continue",plan,rotation,streak:isFinite(streak)?streak:0,reactions,volumeBump,deload:false};
}

IL.builder={prescribedSets,seedExercise,lastSessionIds,perfPriority,orderByFatigue,isHeavyAxial,capHeavyAxial,pickForGroup,buildRecommendation,complementSuggestions,
  CONTINUE_DAYS,STALL_MIN_DAYS,ANCHOR_STALL_WEEKS,ANCHOR_DELOAD_DAYS,MAX_SESSION_EX,MAX_SETS_PER_EX,findPlan,exerciseTenure,exerciseStreak,isStalled,recentDeload,planAnchor,replacementFor,anchorVariation,fillsGap,gapFillExercise,profileAllows,planWorkout};
if(typeof module!=='undefined')module.exports=IL.builder;
