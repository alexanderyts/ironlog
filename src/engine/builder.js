// The intelligent workout builder: picks complementary exercises per muscle, orders the
// session for maximum performance, and suggests what's missing. Pure: takes history in.
var IL=globalThis.IL||(globalThis.IL={});
if(typeof require==='function'&&!IL.data)require('../data/exercises.js');
if(typeof require==='function'&&!IL.prog)require('./progression.js');
const {C,I,EXERCISES,EX,REGIONS,IDEAL_PATS,PAT_RANK,EQUIP_LOAD,regLabel,patLabel,hashId}=IL.data;
const {lastPerf,nextSets}=IL.prog;

// Working sets a movement deserves when you've never logged it: main lifts 4, other compounds 3,
// isolation 3, finishers 2. Reps prefilled at the bottom of the target range.
function prescribedSets(ex){if(!ex)return 3;if(ex.type===C)return ex.tier===1?4:3;return ex.tier===3?2:3;}
// With history, the sets are seeded with the pattern-aware progressive-overload prescription
// (see nextSets in progression.js), not a stale copy of last time.
function seedExercise(id,sessions,excludeId,unit){
  const ex=EX[id];const lp=lastPerf(sessions||[],id,{excludeId});
  if(lp&&lp.sets.length)return{id,name:ex?ex.name:id,sets:nextSets(lp.sets,ex,unit).sets.map(s=>({w:s.w,r:s.r,done:false}))};
  const n=prescribedSets(ex),r=ex?ex.rr[0]:'';
  return{id,name:ex?ex.name:id,sets:Array.from({length:n},()=>({w:'',r:r,done:false}))};
}
// Exercise ids from the most recent completed session that trained this group
function lastSessionIds(sessions,g){
  const s=(sessions||[]).find(x=>x.completed!==false&&x.exercises.some(e=>EX[e.id]&&EX[e.id].group===g));
  return s?s.exercises.map(e=>e.id):[];
}

// How much an exercise "deserves" to go early: biggest / most-loadable compounds while fresh,
// isolation last, foundational before secondary, and the focus muscle's key lift leads.
function perfPriority(ex,focus){
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
// Safety: at most two heavy barbell squat/hinge lifts per session. Extras swap to a non-barbell
// variant of the same pattern from the same muscle, else are dropped.
function capHeavyAxial(ids){
  const heavy=ids.filter(id=>isHeavyAxial(EX[id]));
  if(heavy.length<=2)return ids;
  const keep=new Set(orderByFatigue(heavy).slice(0,2));
  return ids.map(id=>{
    if(!isHeavyAxial(EX[id])||keep.has(id))return id;
    const e=EX[id];
    const alt=EXERCISES.find(x=>x.group===e.group&&x.pat===e.pat&&!isHeavyAxial(x)&&ids.indexOf(x.id)<0);
    return alt?alt.id:null;
  }).filter(Boolean);
}

// Pick exercises for one muscle group:
//  1. anchor = a foundational (tier-1) lift on the muscle's KEY pattern — and the SAME one you've been
//     progressing if you have history, so progressive overload compounds week to week.
//  2. fill to cover the muscle's regions/heads AND its complementary movement patterns.
//  3. stop when nothing left adds real coverage — no padding with redundant movements.
function pickForGroup(g,per,seed,sessions){
  sessions=sessions||[];
  const pool=EXERCISES.filter(e=>e.group===g);
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
  while(sel.length<per&&sel.length<pool.length){
    let best=null,bestScore=0;
    const isoCount=sel.filter(x=>x.type===I).length,compCount=sel.filter(x=>x.type===C).length;
    pool.forEach(e=>{
      if(sel.indexOf(e)>=0)return;
      let sc=0;
      const newReg=!covReg.has(e.reg),newPat=!covPat.has(e.pat);
      if(newReg)sc+=ideal.indexOf(e.reg)>=0?4:1;
      if(newPat)sc+=idealPats.indexOf(e.pat)>=0?3:1;
      if(e.type===I&&isoCount===0&&sel.length>=1)sc+=1.5;
      if(e.type===C&&compCount>=2)sc-=compCount>=3?1.5:0.5;
      if(isHeavyAxial(e)&&idealPats.indexOf(e.pat)<0)sc-=2.5;
      if(!newReg&&!newPat){
        if(e.type===C&&!sel.some(x=>x.pat===e.pat&&x.equip===e.equip))sc+=0.8; else sc-=1;
      }
      sc+=e.tier===1?0.6:e.tier===2?0.3:0;
      sc+=(EQUIP_LOAD[e.equip]||0)/20;
      if(recent.indexOf(e.id)>=0)sc-=0.4;
      sc+=((hashId(e.id)+seed)%5)/100;
      if(sc>bestScore){bestScore=sc;best=e;}
    });
    if(!best)break;
    sel.push(best);covReg.add(best.reg);covPat.add(best.pat);
  }
  return sel;
}
// groups: muscle groups in the order the user picked them (first = session focus)
function buildRecommendation(groups,sessions,seed){
  groups=groups&&groups.length?groups.slice():['Chest','Back'];
  seed=seed==null?Math.floor(Math.random()*997):seed;
  const total=groups.length>=4?7:groups.length===3?7:groups.length===2?6:4;
  const per={};const base=Math.max(1,Math.floor(total/groups.length));
  groups.forEach(g=>per[g]=base);
  let rem=total-base*groups.length;
  const bySize=groups.slice().sort((a,b)=>(REGIONS[b]||[]).length-(REGIONS[a]||[]).length);
  for(let i=0;i<rem;i++)per[bySize[i%bySize.length]]++;
  let out=[];
  groups.forEach(g=>{const cap=Math.min(per[g],Math.max((REGIONS[g]||['overall']).length,(IDEAL_PATS[g]||[]).length)+1,EXERCISES.filter(e=>e.group===g).length);
    out.push(...pickForGroup(g,cap,seed,sessions).map(e=>e.id));});
  return orderByFatigue(capHeavyAxial(out),groups[0]);
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
  }).filter(x=>x.sc>0).sort((a,b)=>b.sc-a.sc);
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

   Rotation rules (RP/Helms-style mesocycle practice, simplified):
     • anchor (the group's tier-1 key-pattern lift) is never rotated by the planner
     • STALLED: ≥3 performances and the best e1RM has not improved across the last two sessions
     • STALE:   repeated ≥ROTATE_AFTER consecutive sessions AND not currently progressing (its last
                session didn't earn a load bump), or ≥ROTATE_HARD sessions regardless
     • at most ONE rotation per continue; stalled beats stale, longer streak breaks ties
     • replacement: same group, same region and pattern preferred, not already in the plan */
const CONTINUE_DAYS=10,ROTATE_AFTER=5,ROTATE_HARD=8;
const {e1rm,nextSets:prescribe}=IL.prog;

function sessionGroups(s){const g={};s.exercises.forEach(e=>{const x=EX[e.id];if(x)g[x.group]=(g[x.group]||0)+1;});return g;}
// The most recent completed session (within the window) that trained exactly these groups —
// tolerating one incidental add-on exercise from another group.
function findPlan(groups,sessions,now){
  now=now||Date.now();const want=new Set(groups);
  for(const s of sessions||[]){
    if(s.completed===false||!s.exercises.length)continue;
    if(now-s.date>CONTINUE_DAYS*86400000)break;
    const sg=sessionGroups(s);
    if(![...want].every(g=>sg[g]))continue;
    if(Object.keys(sg).some(g=>!want.has(g)&&sg[g]>1))continue;
    return s;
  }
  return null;
}
// Consecutive most-recent sessions of this exercise's group that included it
function exerciseStreak(sessions,exId){
  const ex=EX[exId];if(!ex)return 0;let n=0;
  for(const s of sessions||[]){
    if(s.completed===false)continue;
    if(!s.exercises.some(e=>EX[e.id]&&EX[e.id].group===ex.group))continue;
    if(s.exercises.some(e=>e.id===exId))n++;else break;
  }
  return n;
}
// Best e1RM (or reps for weightless work) of the last three performances, newest first
function recentScores(sessions,exId,n){
  const out=[];let before;
  for(let i=0;i<(n||3);i++){
    const lp=lastPerf(sessions,exId,{beforeTs:before});if(!lp)break;
    out.push(Math.max(...lp.sets.map(s=>s.w>0?e1rm(s.w,s.r):s.r)));before=lp.date;
  }
  return out;
}
function isStalled(sessions,exId){const sc=recentScores(sessions,exId,3);return sc.length>=3&&sc[0]<=sc[1]&&sc[1]<=sc[2];}
function isProgressing(sessions,exId){const lp=lastPerf(sessions,exId);return !!lp&&prescribe(lp.sets,EX[exId],'lb').bumped;}
function planAnchor(ids,g){
  const c=ids.map(id=>EX[id]).filter(e=>e&&e.group===g&&e.tier===1&&(IDEAL_PATS[g]||[]).indexOf(e.pat)>=0);
  return c.sort((a,b)=>perfPriority(b)-perfPriority(a))[0]||null;
}
function replacementFor(exId,planIds,seed){
  const e=EX[exId];
  const cands=EXERCISES.filter(x=>x.group===e.group&&x.id!==exId&&planIds.indexOf(x.id)<0);
  return cands.map(x=>{let sc=(x.reg===e.reg?4:0)+(x.pat===e.pat?3:0)+(x.type===e.type?1:0)+(x.tier===1?.5:x.tier===2?.3:0)+((hashId(x.id)+(seed||0))%5)/100;return{x,sc};})
    .sort((a,b)=>b.sc-a.sc)[0]?.x||null;
}
// What to train for these groups today. Returns {ids, mode:'continue'|'fresh', plan, rotation,
// streak}. opts.fresh forces a fresh build (the "Start fresh" escape hatch).
function planWorkout(groups,sessions,seed,opts){
  opts=opts||{};sessions=sessions||[];
  groups=groups&&groups.length?groups.slice():['Chest','Back'];
  seed=seed==null?Math.floor(Math.random()*997):seed;
  const plan=opts.fresh?null:findPlan(groups,sessions,opts.now);
  if(!plan)return{ids:buildRecommendation(groups,sessions,seed),mode:'fresh',plan:null,rotation:null,streak:0};
  let ids=plan.exercises.map(e=>e.id).filter(id=>EX[id]);
  const anchors=new Set(groups.map(g=>planAnchor(ids,g)).filter(Boolean).map(e=>e.id));
  const cands=ids.filter(id=>!anchors.has(id)).map(id=>{
    const streak=exerciseStreak(sessions,id),stalled=isStalled(sessions,id),progressing=isProgressing(sessions,id);
    const stale=streak>=ROTATE_HARD||(streak>=ROTATE_AFTER&&!progressing);
    return{id,streak,pri:stalled?2:stale?1:0};
  }).filter(c=>c.pri>0).sort((a,b)=>b.pri-a.pri||b.streak-a.streak);
  let rotation=null;
  if(cands.length){
    const c=cands[0],to=replacementFor(c.id,ids,seed);
    if(to){ids=ids.map(id=>id===c.id?to.id:id);rotation={from:c.id,to:to.id,why:c.pri===2?'stalled':'time for a change',streak:c.streak};}
  }
  const streak=Math.min(...ids.filter(id=>!rotation||id!==rotation.to).map(id=>exerciseStreak(sessions,id)));
  return{ids:orderByFatigue(capHeavyAxial(ids),groups[0]),mode:'continue',plan,rotation,streak:isFinite(streak)?streak:0};
}

IL.builder={prescribedSets,seedExercise,lastSessionIds,perfPriority,orderByFatigue,isHeavyAxial,capHeavyAxial,pickForGroup,buildRecommendation,complementSuggestions,
  CONTINUE_DAYS,ROTATE_AFTER,ROTATE_HARD,findPlan,exerciseStreak,isStalled,isProgressing,planAnchor,replacementFor,planWorkout};
if(typeof module!=='undefined')module.exports=IL.builder;
