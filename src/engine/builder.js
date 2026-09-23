// The intelligent workout builder: picks complementary exercises per muscle, orders the
// session for maximum performance, and suggests what's missing. Pure: takes history in.
var IL=globalThis.IL||(globalThis.IL={});
if(typeof require==='function'&&!IL.data)require('../data/exercises.js');
if(typeof require==='function'&&!IL.prog)require('./progression.js');
const {C,I,EXERCISES,EX,REGIONS,IDEAL_PATS,PAT_RANK,EQUIP_LOAD,LONG_LENGTH,isAssist,TIME_METRIC,UNILATERAL,regLabel,patLabel,hashId}=IL.data;
const {lastPerf,lastModeFor,lastSideFor,trackOf,sidesOf,scoreSet,sbw,nextSets,deloadSets,repRange,modeOf,real,DAY,unitIncrement}=IL.prog;

// Working sets a movement deserves when you've never logged it: main lifts 4, other compounds 3,
// isolation 3, finishers 2. Reps prefilled at the bottom of the target range.
function prescribedSets(ex){if(!ex)return 3;if(ex.type===C&&!(TIME_METRIC&&TIME_METRIC.has(ex.id)))return ex.tier===1?4:3;return ex.tier===3?2:3;}   // a timed carry is not a 4-set main lift
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
  // the "top" set is the hardest one — for an assist machine that's the LEAST assist (full review 4.3:
  // straight sets spread the most-assisted, i.e. easiest, set across every set)
  const inv=!!ex&&isAssist(ex.id);
  const w=(inv?Math.min:Math.max)(...sets.map(s=>+s.w||0));
  if(w<=0)return sets;
  // straight = every set at the top weight AND the top set's reps. Carrying each set's own reps would
  // put a back-off set's reps on the top weight (200×5/180×8/180×8 → 200×8) — the v0.39.1 ramp bug's twin (#18).
  if(style==='straight'){const topR=(sets.find(s=>(+s.w||0)===w)||sets[sets.length-1]).r;return sets.map(s=>({w,r:topR,done:false}));}
  if(style==='ramp'&&ex&&ex.tier===1){
    // reps come from the set that CARRIES the top weight — on a descending pattern (heavy opener,
    // lighter back-offs) the last set holds back-off reps, which must not land on the top set
    const inc=unitIncrement(unit||'lb',ex),topR=(sets.find(s=>(+s.w||0)===w)||sets[sets.length-1]).r,grid=x=>Math.max(inc,Math.round(x/inc)*inc);
    // Two ramp sets, then the prescribed number of TOP sets (builder audit #12: a flat 80/90/100 left one
    // hard set, and repeated itself forever because next time's count came from that 3-set history).
    const n=Math.max(prescribedSets(ex),sets.length,3),out=[{w:grid(w*0.8),r:topR,done:false},{w:grid(w*0.9),r:topR,done:false}];
    while(out.length<n)out.push({w,r:topR,done:false});
    return out;
  }
  return sets;
}
function seedExercise(id,sessions,opts){
  opts=opts||{};const {excludeId,unit,deload,extraSet,goal,setStyle,push,gym,beforeTs}=opts;   // goal/setStyle/push/gym: profile levers; beforeTs: adding to a PAST workout seeds from history before it
  const ex=EX[id];const mode=lastModeFor(sessions,id),side=lastSideFor(sessions,id);
  const inst={id,name:ex?ex.name:id};if(mode)inst.mode=mode;if(side!=null)inst.side=side;   // remember "⇆ Each side" like the equipment choice
  // A machine gym has no free barbell: a Smith-friendly barbell lift starts in Smith mode (so its
  // history, PRs and the plate loader's Smith bar all line up). An explicit earlier choice still wins.
  if(!inst.mode&&gym==='machine'&&ex&&ex.equip==='Barbell'&&SMITH_OK.has(id))inst.mode='smith';
  // An overridden side / auto-Smith is its own history track — seed from THAT track, never another one
  const lp=lastPerf(sessions||[],id,{excludeId,beforeTs,mode:side!=null||(inst.mode||null)!==(mode||null)?trackOf(inst):(mode||undefined),clean:true});   // real sessions only — a deload is never a baseline; `clean` so a set marked "doesn't count" is never prefilled back at you
  const rr=goal?repRange(ex,goal):(ex?ex.rr:[8,12]);   // goal shifts the target range in one place
  let sets;
  // push:'quiet' — "just record": the rows mirror last time exactly, never a bump. Must agree with
  // suggestion(), which shows neutral text under quiet; a bumped row next to "Recorded" would lie.
  // push:'offer' (the app's default) — an INCREASE is never pre-filled: when last time earned a bump the
  // rows repeat last time and the card offers a one-tap "Try" (suggestion()). No bump due → as before.
  if(lp&&lp.sets.length){const n=deload||push==='quiet'?null:nextSets(lp.sets,ex,unit,goal?rr:undefined);
    sets=(deload?deloadSets(lp.sets,ex,unit):push==='quiet'||(push==='offer'&&n.bumped)?lp.sets.map(s=>({w:+s.w||0,r:+s.r||0})):n.sets).map(s=>({w:s.w,r:s.r,done:false}));}
  // (a deload with no history: top of the range — except a timed hold, whose top is its HARDEST option)
  else{const n=prescribedSets(ex),timed=!!(ex&&TIME_METRIC&&TIME_METRIC.has(id)),r=ex?(deload&&!timed?rr[1]:rr[0]):'';sets=Array.from({length:n},()=>({w:'',r:r,done:false}));}
  if(!deload&&setStyle)sets=shapeStyle(sets,setStyle,ex,unit);   // never reshape a deload — recovery has its own prescription
  if(deload&&sets.length>DELOAD_MAX_SETS)sets=sets.slice(0,DELOAD_MAX_SETS);   // a deload cuts volume as well as load
  if(extraSet&&!deload&&sets.length&&sets.length<MAX_SETS_PER_EX){const last=sets[sets.length-1];sets.push({w:last.w,r:last.r,done:false});}
  // Warm-ups are remembered (batch 4): last time's warm-up rows come back on top, so a lifter who ramps
  // up doesn't re-add them every session. Never on a deload (it has its own light prescription).
  if(!deload&&lp&&sets.length){const w=lastWarmups(sessions,id,{excludeId,beforeTs,track:trackOf(inst)});if(w.length)sets=w.concat(sets);}
  inst.sets=sets;return inst;
}
// The warm-up rows of this lift's most recent real workout (same version), as fresh unticked rows.
function lastWarmups(sessions,id,o){
  for(const s of real(sessions||[])){
    if(o.excludeId&&s.id===o.excludeId)continue;if(o.beforeTs&&s.date>=o.beforeTs)continue;
    const e=s.exercises.find(x=>x.id===id&&trackOf(x)===o.track);if(!e)continue;
    return e.sets.filter(st=>st.warm&&st.done!==false&&(+st.r||0)>0).slice(0,4).map(st=>({w:+st.w||0,r:+st.r||0,warm:true,done:false}));
  }
  return [];
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
  // Only a real compound earns its pattern's rank. An isolation that happens to be tagged with a big
  // pattern (a back extension is 'hinge') or a timed carry must not outrank the presses — it sorts with
  // the isolations. (Builder audit #3/#13: back extension led the machine-gym full body; carry before curls.)
  const timed=!!(TIME_METRIC&&TIME_METRIC.has(ex.id)),comp=ex.type===C&&!timed;
  // squat/hinge 96 · press/pull 64 · lunge 48 · iso 16 · timed holds/carries 8 — finishers go LAST
  // (a farmer's carry before curls fries the grip the curls need)
  let p=timed?8:(comp?(PAT_RANK[ex.pat]||1):1)*16;
  if(comp)p+=15;
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
// Barbell lifts a machine gym can still do — on the Smith machine. Seeded in Smith mode (seedExercise).
const SMITH_OK=new Set(['back-squat','barbell-bench-press','incline-barbell-press','overhead-press','romanian-deadlift','hip-thrust','shrug']);
function profileAllows(e,g,profile,sessions){
  if(!profile||!e)return true;
  if(profile.avoid&&profile.avoid.indexOf(e.id)>=0)return false;
  if(profile.gym==='machine'&&e.equip==='Barbell'&&!SMITH_OK.has(e.id)&&lastModeFor(sessions,e.id)!=='smith')return false;
  if(profile.gym==='home'&&!(e.equip==='Dumbbell'||e.equip==='Bodyweight'))return false;
  if(profile.protect&&profile.protect.indexOf(g)>=0&&e.tier===1&&e.type==='compound'&&(e.equip==='Barbell'||e.equip==='Dumbbell'))return false;
  return true;
}
// Spinal load per lift: a heavy barbell squat or hinge = 1 unit, a barbell row = ½ (the back holds a
// braced hinge under load). Hip thrust loads the hips, not the spine (0).
const spinalUnits=e=>!e||e.type!==C||e.equip!=='Barbell'?0:isHeavyAxial(e)?1:e.pat==='hpull'?0.5:0;
// Safety: a session carries at most 2 units of spinal load, and at most ONE heavy squat and ONE heavy
// hinge — two squats and no hinge isn't a balanced leg day (builder audit #2/#8). Decided by priority,
// so the most important lifts keep their slot. Extras swap to the best non-spinal lift of the same
// muscle and pattern, else are dropped. The alternative must clear the profile (an over-cap swap is the
// builder's own change — it may not smuggle back an avoided / off-equipment / protected lift) and may
// not already be in the session (the old check looked only at the ORIGINAL list, so two extras could
// both become the same back extension — audit #2).
// `balance` (fresh builds only): also at most one heavy squat and one heavy hinge. A continued plan is
// the user's own programming, so it gets only the 2-unit safety cap.
function capHeavyAxial(ids,profile,sessions,balance){
  const keep=new Set();let units=0;const heavyPat={};
  orderByFatigue(ids.slice()).forEach(id=>{const e=EX[id],u=spinalUnits(e);if(!u){keep.add(id);return;}
    if((!balance||!isHeavyAxial(e)||!heavyPat[e.pat])&&units+u<=2){keep.add(id);units+=u;if(isHeavyAxial(e))heavyPat[e.pat]=true;}});
  if(keep.size===ids.length)return ids;
  const out=[];
  ids.forEach(id=>{
    if(keep.has(id)){out.push(id);return;}
    const e=EX[id];
    const alt=EXERCISES.filter(x=>x.group===e.group&&x.pat===e.pat&&!spinalUnits(x)&&ids.indexOf(x.id)<0&&out.indexOf(x.id)<0&&profileAllows(x,x.group,profile,sessions))
      .sort((a,b)=>perfPriority(b)-perfPriority(a))[0];
    if(alt)out.push(alt.id);
  });
  return out;
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
// Training-profile equipment/avoid/protect levers applied to a candidate list. STRICT, never relaxed
// (builder audit #1): the gym rule is physical (the equipment isn't there), the avoid list is often an
// injury, and "protect" exists to keep heavy compounds off a muscle. The old backoff, when a group ran
// dry, relaxed the gym rule and handed a machine gym a barbell RDL. Now an empty result means the group
// is skipped — planWorkout reports it in `skipped` and the app says so.
function profilePool(list,g,profile,sessions){
  if(!profile)return list;
  return list.filter(e=>profileAllows(e,g,profile,sessions));
}
// Moves most beginners can't do yet — their own bodyweight is already too heavy. Kept out of a muscle's
// build until it has history (audit #7).
const HARD_BW=new Set(['chest-dip','tricep-dip','nordic-curl','ab-wheel','sissy-squat','hanging-leg-raise','pull-up','chin-up']);
// Leftover slots in a multi-group session go to the bigger muscles; a small muscle sharing a 3+ group
// session gets one exercise (audit #4: Lower got two calf raises and no leg curl).
const MUSCLE_SIZE={Quads:3,Hamstrings:3,Glutes:3,Back:3,Chest:3,Shoulders:2,Biceps:1,Triceps:1,Calves:1,Core:1,Forearms:1};
const SMALL_GROUP=new Set(['Calves','Forearms','Core']);
// Exercise ids from the last n completed sessions that trained group g (sessions are newest-first).
function recentGroupIds(sessions,g,n){const out=new Set();let k=0;
  for(const s of sessions||[]){if(s.completed===false||!s.exercises.some(e=>EX[e.id]&&EX[e.id].group===g))continue;
    s.exercises.forEach(e=>out.add(e.id));if(++k>=n)break;}
  return out;}
// Among the strongest candidates (within `window` priority points of the best), pick by the build's
// seed — variety between builds without ever choosing a weak option (audit #11: every build of a
// selection used to come out identical; the seed only broke exact ties).
function pickTop(list,seed,window){
  const r=list.slice().sort((a,b)=>perfPriority(b)-perfPriority(a));if(!r.length)return null;
  const top=perfPriority(r[0]),c=r.filter(e=>perfPriority(e)>=top-window);return c[seed%c.length];}
// `trace` (optional array) collects {id, sc, why:[...]} for every pick — a window into WHY the builder
// chose each exercise, used by tools/review.js. No effect on the result.
// ctx: {taken: ids already chosen for this session (other groups), fresh: the user asked for DIFFERENT
// exercises ("Different exercises instead")}.
function pickForGroup(g,per,seed,sessions,hints,trace,profile,ctx){
  sessions=sessions||[];ctx=ctx||{};
  let pool=profilePool(EXERCISES.filter(e=>e.group===g),g,profile,sessions);
  if(!pool.length)return [];
  // Beginner safeguard: a muscle you've never trained here leads with machines and dumbbells. Barbell
  // compounds wait until you've done ANY barbell compound (barbell skill carries across muscles — a
  // lifter who squats isn't a beginner at the hip thrust); moves most beginners can't lift yet (dips,
  // pull-ups, Nordics) wait until that muscle has history (bodyweight strength doesn't carry over).
  if(!lastSessionIds(sessions,g).length){
    const barbellExp=sessions.some(s=>s.completed!==false&&s.exercises.some(e=>EX[e.id]&&EX[e.id].equip==='Barbell'&&EX[e.id].type===C));
    if(!barbellExp){const safe=pool.filter(e=>!(e.equip==='Barbell'&&e.type===C));if(safe.length)pool=safe;}}
  // A move most people can't do yet (dips, pull-ups, Nordics…) waits until you've logged THAT move or its
  // twin (pull-up ↔ chin-up) — a lat pulldown doesn't mean a chin-up. Applies at any experience level.
  {const done=id=>sessions.some(s=>s.completed!==false&&s.exercises.some(x=>x.id===id));
   const hardOK=e=>!HARD_BW.has(e.id)||done(e.id)||EXERCISES.some(x=>x.id!==e.id&&HARD_BW.has(x.id)&&x.group===e.group&&x.pat===e.pat&&done(x.id));
   const ok=pool.filter(hardOK);if(ok.length)pool=ok;}
  // Pressing already in the session trains the triceps hard; a close-grip bench or dip on top is a third
  // press, not triceps variety (audit #5) — the triceps get isolation work instead.
  const taken=(ctx.taken||[]).map(id=>EX[id]).filter(Boolean);
  if(g==='Triceps'&&taken.some(x=>x.type===C&&(x.pat==='hpush'||x.pat==='vpush'))){const iso=pool.filter(e=>e.type!==C);if(iso.length)pool=iso;}
  const ideal=REGIONS[g]||['overall'],idealPats=IDEAL_PATS[g]||['iso'],idealComp=idealPats.filter(p=>p!=='iso');
  const recent=lastSessionIds(sessions,g);
  const avoidRecent=ctx.fresh?recentGroupIds(sessions,g,2):null;   // "Different exercises instead"
  const sel=[],covReg=new Set(),covPat=new Set();
  let anchor=null,anchorWhy='';
  // One shoulder slot beside chest pressing: the front delts are already worked, so the slot goes to a
  // side-delt isolation rather than a second press (audit #5: Upper never had side-delt work).
  // Isolation only (a lateral raise — never an upright row, a compound with an impingement-prone path),
  // and only when you're not already progressing a shoulder lift: your history wins (continuity).
  const shHist=g==='Shoulders'&&pool.some(e=>e.type===C&&lastPerf(sessions,e.id));
  if(g==='Shoulders'&&per===1&&!shHist&&taken.some(x=>x.type===C&&x.pat==='hpush')){
    const side=pool.filter(e=>e.reg==='side'&&e.type!==C);if(side.length){anchor=pickTop(side,seed,6);anchorWhy='side delts: pressing already covers the front of the shoulder';}}
  if(!anchor){
    let cand=pool.filter(e=>e.tier===1);
    if(!cand.length)cand=pool.filter(e=>e.type===C);
    if(!cand.length)cand=pool;
    const keyed=cand.filter(e=>idealPats.indexOf(e.pat)>=0);
    if(keyed.length)cand=keyed;
    let withHist=cand.map(e=>({e,lp:lastPerf(sessions,e.id)})).filter(x=>x.lp).sort((a,b)=>b.lp.date-a.lp.date);
    // Continuity reaches past tier 1: if you've been progressing a key-pattern compound of ANY tier (a
    // machine chest press at a machine gym) and have no tier-1 history, that lift stays your anchor —
    // a new Smith press shouldn't displace the one you're building.
    if(!withHist.length)withHist=pool.filter(e=>e.type===C&&idealPats.indexOf(e.pat)>=0).map(e=>({e,lp:lastPerf(sessions,e.id)})).filter(x=>x.lp).sort((a,b)=>b.lp.date-a.lp.date);
    // A NEW anchor is two-sided: a one-leg/one-arm lift is balance-limited, harder to load and progress,
    // and doubles the time — it makes a good accessory, not the lift a muscle's day is built on.
    // (Your own history still wins: if you've been anchoring on one, the plan continues it.)
    if(!(withHist.length&&!avoidRecent)){const two=cand.filter(e=>!(UNILATERAL&&UNILATERAL.has(e.id)));if(two.length)cand=two;}
    if(withHist.length&&!avoidRecent){anchor=withHist[0].e;anchorWhy='anchor: your most recently trained foundational '+g.toLowerCase()+' lift';}
    else{let c=cand;if(avoidRecent){const other=cand.filter(e=>!avoidRecent.has(e.id));if(other.length)c=other;}
      anchor=pickTop(c,seed,6);anchorWhy=avoidRecent?'anchor: a different foundational '+g.toLowerCase()+' lift (you asked for a change)':'anchor: a top foundational '+g.toLowerCase()+' lift';}
  }
  sel.push(anchor);covReg.add(anchor.reg);covPat.add(anchor.pat);
  if(trace)trace.push({id:anchor.id,sc:null,why:[anchorWhy]});
  while(sel.length<per&&sel.length<pool.length){
    let best=null,bestScore=0,bestWhy=null;
    const isoCount=sel.filter(x=>x.type===I).length,compCount=sel.filter(x=>x.type===C).length;
    const compsCovered=idealComp.every(p=>covPat.has(p));
    pool.forEach(e=>{
      if(sel.indexOf(e)>=0)return;
      let sc=0;const why=[];
      const newReg=!covReg.has(e.reg),newPat=!covPat.has(e.pat);
      if(newReg){const v=ideal.indexOf(e.reg)>=0?4:1;sc+=v;why.push(`+${v} new region (${e.reg})`);}
      if(newPat){const v=idealPats.indexOf(e.pat)>=0?3:1;sc+=v;why.push(`+${v} new pattern (${e.pat})`);}
      // The first-isolation nudge waits until the muscle's key compound patterns are in — otherwise a
      // face pull beat the row on a machine-gym back day (audit #9).
      if(e.type===I&&isoCount===0&&sel.length>=1&&compsCovered){sc+=1.5;why.push('+1.5 first isolation');}
      if(e.type===C&&compCount>=2){const v=compCount>=3?1.5:0.5;sc-=v;why.push(`-${v} already ${compCount} compounds`);}
      if(isHeavyAxial(e)&&idealPats.indexOf(e.pat)<0){sc-=2.5;why.push('-2.5 heavy axial off-pattern');}
      // Nothing new (same region AND same pattern) is a near-duplicate — hip thrust + machine hip thrust,
      // RDL + stiff-leg deadlift. It used to get +0.8 for "different equipment" (audit #5); now it's padding.
      if(!newReg&&!newPat){sc-=1;why.push('-1 nothing new');}
      const tb=e.tier===1?0.6:e.tier===2?0.3:0;if(tb){sc+=tb;why.push(`+${tb} tier ${e.tier}`);}
      const eq=(EQUIP_LOAD[e.equip]||0)/20;sc+=eq;if(eq)why.push(`+${eq.toFixed(2)} ${e.equip.toLowerCase()} loadability`);
      // Side delts are the part of the shoulder nothing else trains (presses hit the front, rows the rear),
      // so they win a tie for the shoulder isolation slot; and rows elsewhere in the session already cover
      // the rear delts.
      if(g==='Shoulders'&&e.reg==='side'){sc+=0.5;why.push('+0.5 side delts (nothing else trains them)');}
      if(g==='Shoulders'&&e.reg==='rear'&&taken.some(x=>x.pat==='hpull')){sc-=1;why.push('-1 rows already hit the rear delts');}
      if(avoidRecent&&avoidRecent.has(e.id)){sc-=2;why.push('-2 you asked for different exercises');}
      else if(recent.indexOf(e.id)>=0){sc-=0.4;why.push('-0.4 did it last session');}
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
function buildRecommendation(groups,sessions,seed,hints,trace,profile,opts){
  opts=opts||{};
  groups=groups&&groups.length?groups.slice():['Chest','Back'];
  seed=seed==null?Math.floor(Math.random()*997):seed;
  let total=groups.length>=3?7:groups.length===2?6:4;
  if(profile){if(profile.length==='short')total=Math.min(total,5);else if(profile.length==='long')total=Math.min(total+1,8);}   // session-size lever
  const per={};const base=Math.max(1,Math.floor(total/groups.length));
  groups.forEach(g=>per[g]=base);
  let rem=total-base*groups.length;
  // A small muscle sharing a 3+ group session gets one exercise; its spare slots go back into the pot
  if(groups.length>=3)groups.forEach(g=>{if(SMALL_GROUP.has(g)&&per[g]>1){rem+=per[g]-1;per[g]=1;}});
  // Leftover slots: bigger muscles first, ties in the order you picked them (audit #4)
  const bySize=groups.filter(g=>!(groups.length>=3&&SMALL_GROUP.has(g))).sort((a,b)=>(MUSCLE_SIZE[b]||1)-(MUSCLE_SIZE[a]||1)||groups.indexOf(a)-groups.indexOf(b));
  for(let i=0;i<rem&&bySize.length;i++)per[bySize[i%bySize.length]]++;
  let out=[];
  groups.forEach(g=>{const cap=Math.min(per[g],Math.max((REGIONS[g]||['overall']).length,(IDEAL_PATS[g]||[]).length)+1,EXERCISES.filter(e=>e.group===g).length);
    out.push(...pickForGroup(g,cap,seed,sessions,hints,trace,profile,{taken:out,fresh:opts.fresh}).map(e=>e.id));});
  // Hard session ceiling = the session size: picking many groups (e.g. all 11) must not produce an
  // 11-exercise workout, and 'short' really is short (it used Math.max(7, total), so short still gave 7
  // — audit #6). orderByFatigue puts the highest-priority work first, so the lowest-priority isolation
  // is what gets cut; planWorkout reports any group left with nothing.
  return orderByFatigue(capHeavyAxial(out,profile,sessions,true),groups[0]).slice(0,total);
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
  const completed=IL.prog.liftSessions(sessions);   // newest-first (upsert/history keep it sorted)
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
  const inv=isAssist(exId), time=TIME_METRIC&&TIME_METRIC.has(exId);
  for(let i=0;i<n;i++){
    const lp=lastPerf(sessions,exId,{beforeTs:before,mode:opts.mode,clean:true});if(!lp)break;   // a disowned set is not evidence of progress OR of a stall
    if(opts.since&&lp.date<opts.since)break;
    let top,topR,score,totR=0;
    if(inv){const minA=Math.min(...lp.sets.map(s=>+s.w||0)),atA=lp.sets.filter(s=>(+s.w||0)===minA);top=-minA;score=-minA;topR=Math.max(...atA.map(s=>+s.r||0));totR=atA.reduce((a,s)=>a+(+s.r||0),0);}
    // timed: heavier load is progress first (a carry that took the suggested +2.5 lb read as "stuck"), then longer
    else if(time){const maxW=Math.max(...lp.sets.map(s=>+s.w||0)),atW=lp.sets.filter(s=>(+s.w||0)===maxW);top=maxW;topR=Math.max(...atW.map(s=>+s.r||0));score=topR;totR=atW.reduce((a,s)=>a+(+s.r||0),0);}
    // score = the ONE judge with that session's bodyweight: a pull-up at +10×6 is no longer "equal" to a
    // bodyweight ×12 (the raw-weight maths ignored the bodyweight). With no bodyweight known it may fall
    // back to reps — fine here, since a stall only ever compares a lift with itself (full review 4.1).
    else{const b=sbw({bw:lp.bw},opts.bw);top=Math.max(...lp.sets.map(s=>+s.w||0));const atT=lp.sets.filter(s=>(+s.w||0)===top);topR=Math.max(...atT.map(s=>+s.r||0));totR=atT.reduce((a,s)=>a+(+s.r||0),0);
      score=Math.max(...lp.sets.map(s=>{const x=scoreSet(exId,s,b,{repsFallback:true});return x?x.score:0;}));}
    out.push({date:lp.date,score,top,topR,totR});
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
    // …or more reps ACROSS the sets at that weight (15/13/12 → 15/15/13): the back sets catching up is
    // progress too — the best set alone never moved, so this read as "stuck" and got swapped (batch 3)
    const rTot=Math.max(...recent.filter(x=>x.top===rTop).map(x=>x.totR||0)),oTot=Math.max(...old.filter(x=>x.top===oTop).map(x=>x.totR||0));
    if(rTot>oTot)return false;
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
// Scoring (builder audit #10): the same MOVEMENT matters most (+4 pattern, +3 region — a front raise
// used to become an overhead press on region alone), then like-for-like type/equipment. Never swaps a
// normal lift for a timed hold (leg extension → wall sit → back) or the reverse, and never swaps IN
// spinal load or a hard bodyweight move the original didn't have (machine hip thrust → sumo deadlift).
function replacementFor(exId,planIds,seed,hints,profile,sessions){
  const e=EX[exId];if(!e)return null;
  const timed=id=>!!(TIME_METRIC&&TIME_METRIC.has(id));
  const cands=profilePool(EXERCISES.filter(x=>x.group===e.group&&x.id!==exId&&planIds.indexOf(x.id)<0&&timed(x.id)===timed(exId)),e.group,profile,sessions);
  return cands.map(x=>{let sc=(x.pat===e.pat?4:0)+(x.reg===e.reg?3:0)+(x.type===e.type?1:0)+(x.equip===e.equip?1:0)+(x.tier===1?.5:x.tier===2?.3:0)+(fillsGap(x,hints)?2:0)
      +(spinalUnits(x)>spinalUnits(e)?-3:0)+(HARD_BW.has(x.id)&&!HARD_BW.has(exId)?-2:0)+(hashId(x.id)%5)/100;return{x,sc};})
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
// Session budget for a FRESHLY built workout (builder audit #6: 21% of builds ran past 75 min, a full-
// body day ~100). Working sets are the lever — aiming for ~60 min standard, ~45 short, ~75 long:
//   1. the third and later main lifts get 3 sets, not 4;
//   2. then sets are trimmed from the END of the workout (lowest priority first), round-robin, never
//      below 2 per exercise; an exercise is dropped only as a last resort (and never below 3).
// Not applied to a continued plan: those sets are the user's own, carried from what they did.
const SESSION_SETS={short:11,standard:16,long:21};   // tuned with tools/builder-audit.js: 0% over target, p95 46 / 62 / 77 min
// A set done one side at a time takes longer (both sides), so it costs 1.5 of the budget.
const setCost=e=>sidesOf(e)===2?1.5:1;
function fitSessionBudget(exs,profile){
  const cap=SESSION_SETS[(profile&&profile.length)||'standard']||SESSION_SETS.standard;
  let mains=0;exs.forEach(e=>{const x=EX[e.id];if(x&&x.type===C&&x.tier===1&&!(TIME_METRIC&&TIME_METRIC.has(x.id))&&++mains>2&&e.sets.length>3)e.sets=e.sets.slice(0,3);});
  let total=exs.reduce((a,e)=>a+e.sets.length*setCost(e),0);
  while(total>cap){let cut=false;for(let i=exs.length-1;i>=0&&total>cap;i--)if(exs[i].sets.length>2){exs[i].sets.pop();total-=setCost(exs[i]);cut=true;}if(!cut)break;}
  // Last resort: drop a whole exercise — the lowest-priority one whose muscle still has another exercise
  // (never a muscle's ONLY one: you picked that muscle). If none qualifies, accept the overrun.
  const grp=e=>EX[e.id]?EX[e.id].group:e.id;
  while(total>cap&&exs.length>3){
    let i=exs.length-1;while(i>=0&&exs.filter(x=>grp(x)===grp(exs[i])).length<2)i--;
    if(i<0)break;const d=exs.splice(i,1)[0];total-=d.sets.length*setCost(d);}
  return exs;
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
  // offerOnly (the app, since the night review): "same lifts" means the same lifts. A stalled lift's
  // swap and a gap-filling extra exercise become OFFERS the user taps to accept, never silent changes;
  // no silent extra set either. Without it (tests, the builder audit) the old behaviour still runs, so
  // the underlying choices stay audited.
  const offerOnly=!!opts.offerOnly,offers=[];
  const meta={};
  const plan=opts.fresh?null:findPlan(groups,sessions,opts.now,meta);
  // Muscles you picked that ended up with nothing (all filtered out, or too many groups for one session)
  const skippedOf=ids=>groups.filter(g=>!ids.some(id=>EX[id]&&EX[id].group===g));
  if(!plan){const ids=buildRecommendation(groups,sessions,seed,hints,undefined,profile,{fresh:!!opts.fresh});
    return{ids,mode:'fresh',plan:null,rotation:null,streak:0,reactions,volumeBump,deload,skipped:skippedOf(ids)};}
  const lapsed=!!meta.lapsed;
  let ids=plan.exercises.map(e=>e.id).filter(id=>EX[id]);
  // The profile applies to a continued plan too — avoid, gym AND protect (builder audit #1: a plan
  // logged at a full gym, continued with gym=machine, kept its barbell lifts). Each failing lift swaps
  // to a same-group alternative that passes; with none, it's dropped rather than kept. A user directive
  // (not a reaction), so it holds on a deload and after a lapse too.
  if(profile){const av=new Set(profile.avoid||[]),next=[];
    for(const id of ids){if(profileAllows(EX[id],EX[id].group,profile,sessions)){next.push(id);continue;}
      // exclude the original plan AND replacements already made, so two swaps can't land on one lift
      const to=replacementFor(id,ids.concat(next),seed,hints,profile,sessions),nm=EX[id].name;
      const reason=av.has(id)?'you asked to avoid it':(profile.protect||[]).indexOf(EX[id].group)>=0?'you’re going easy on '+EX[id].group.toLowerCase():'it needs equipment your gym doesn’t have';
      if(to){next.push(to.id);reactions.push({type:av.has(id)?'avoid-swap':'profile-swap',from:id,to:to.id,why:'swapped '+nm+' — '+reason});}
      else reactions.push({type:'profile-drop',from:id,why:'left out '+nm+' — '+reason});}
    ids=next;}
  // A deload CONTINUES the plan verbatim — same exercises, just lighter (seedExercise cuts load and
  // volume). Zero structural changes: no stall check, rotation, anchor swap, gap-add or volume bump.
  if(deload){const fin=orderByFatigue(capHeavyAxial(ids,profile,sessions),groups[0]);return{ids:fin,mode:'continue',plan,rotation:null,streak:0,reactions,volumeBump,deload:true,skipped:skippedOf(fin)};}
  // Coming back after a lapse (a missed week / holiday): continue the plan with weights carried from
  // where you left off, but make NO structural change — you weren't stalled, you were away, and a
  // detrained first session back shouldn't get extra volume or a rotation.
  if(lapsed){const fin=orderByFatigue(capHeavyAxial(ids,profile,sessions),groups[0]);return{ids:fin,mode:'continue',plan,rotation:null,streak:0,reactions,volumeBump,deload:false,lapsed:true,skipped:skippedOf(fin)};}
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
      if(to){if(offerOnly)offers.push({type:'swap',from:aid,to:to.id,why:'anchor-stalled'});else{ids=ids.map(id=>id===aid?to.id:id);rotation={from:aid,to:to.id,why:'anchor-stalled',anchor:true};}structural=true;break;}
    }
  }
  // 2. Otherwise, rotate at most one STALLED accessory (the one in the plan longest). A progressing
  //    accessory is never touched — continuity is the default. Prefer a gap-filling replacement.
  if(!structural){
    const cands=ids.filter(id=>!anchors.has(id)).map(id=>({id,sessions:exerciseTenure(sessions,id).sessions,stalled:isStalled(sessions,id,{mode:modeById[id],now:opts.now})}))
      .filter(c=>c.stalled).sort((a,b)=>b.sessions-a.sessions);
    if(cands.length){const c=cands[0],to=replacementFor(c.id,ids,seed,hints,profile,sessions);
      if(to){if(offerOnly)offers.push({type:'swap',from:c.id,to:to.id,why:'stalled',streak:c.sessions});else{ids=ids.map(id=>id===c.id?to.id:id);rotation={from:c.id,to:to.id,why:'stalled',streak:c.sessions};}structural=true;}}
  }
  // 3. Gap-ADD (never a swap): one exercise for a flagged region/pattern the plan doesn't cover, only
  //    if there's room and no structural change happened yet. Self-limiting — once logged, gap clears.
  if(!structural&&hints&&hints.gaps&&ids.length<maxEx){
    const covered=gp=>ids.some(id=>EX[id]&&EX[id].group===gp.group&&(gp.reg?EX[id].reg===gp.reg:EX[id].pat===gp.pat));
    const gp=hints.gaps.filter(g=>groups.indexOf(g.group)>=0&&!protect.has(g.group)&&!covered(g)).sort((a,b)=>b.prio-a.prio)[0];
    if(gp){const add=gapFillExercise(gp,ids,profile,sessions);if(add&&EX[add]&&offerOnly){offers.push({type:'add',exId:add,why:'covers '+(gp.reg?regLabel(gp.group,gp.reg):patLabel(gp.pat))});structural=true;}
      else if(add&&EX[add]){ids.push(add);structural=true;reactions.push({type:'gap-add',exId:add,group:gp.group,why:'covers '+(gp.reg?regLabel(gp.group,gp.reg):patLabel(gp.pat))});}}
  }
  // 4. Volume bump (+1 set) for the ONE most-undertrained group this session (the lowest sets/week),
  //    not every low group at once — adding five sets while the toast says "+1 set" was dishonest, and
  //    piling volume onto a returning/low-volume lifter is wrong (#23). Self-limiting: as each session
  //    lifts a group over its landmark, the next session moves to the next-lowest.
  const undByVol=hints&&(hints.undertrainedByVolume||(hints.undertrained||[]).map(g=>({group:g,perWeek:0})));   // accept the old {undertrained:[names]} shape too
  if(!offerOnly&&undByVol&&undByVol.length){   // offer-only: a repeated workout gets no silent extra set (Focus already says the volume is low)
    const pick=undByVol.filter(u=>groups.indexOf(u.group)>=0&&!protect.has(u.group))[0];
    if(pick){const g=pick.group,target=ids.find(id=>EX[id]&&EX[id].group===g&&anchors.has(id))||ids.find(id=>EX[id]&&EX[id].group===g);
      if(target&&volumeBump.indexOf(target)<0){volumeBump.push(target);reactions.push({type:'volume',exId:target,group:g,why:g.toLowerCase()+' volume is low — added a set'});}}
  }
  const streak=Math.min(...ids.filter(id=>!rotation||id!==rotation.to).map(id=>exerciseStreak(sessions,id)));
  const fin=orderByFatigue(capHeavyAxial(ids,profile,sessions),groups[0]);
  return{ids:fin,mode:"continue",plan,rotation,streak:isFinite(streak)?streak:0,reactions,volumeBump,offers,deload:false,skipped:skippedOf(fin)};
}

IL.builder={isStalled,prescribedSets,seedExercise,lastSessionIds,perfPriority,orderByFatigue,isHeavyAxial,spinalUnits,capHeavyAxial,pickForGroup,buildRecommendation,complementSuggestions,fitSessionBudget,SESSION_SETS,SMITH_OK,HARD_BW,
  CONTINUE_DAYS,STALL_MIN_DAYS,ANCHOR_STALL_WEEKS,ANCHOR_DELOAD_DAYS,MAX_SESSION_EX,MAX_SETS_PER_EX,findPlan,exerciseTenure,exerciseStreak,isStalled,recentDeload,planAnchor,replacementFor,anchorVariation,fillsGap,gapFillExercise,profileAllows,planWorkout};
if(typeof module!=='undefined')module.exports=IL.builder;
