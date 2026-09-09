// Effectiveness analysis: balance, coverage gaps, weekly volume adequacy, progression, PRs.
var IL=globalThis.IL||(globalThis.IL={});
if(typeof require==='function'&&!IL.data)require('../data/exercises.js');
if(typeof require==='function'&&!IL.prog)require('./progression.js');
const {EX,EXERCISES,REGIONS,IDEAL_PATS,LOWER_GROUPS,regLabel,patLabel,exampleFor}=IL.data;
const {DAY,startOfDay,e1rm,isWorking,setLoad,sessionVolume}=IL.prog;

const completed=sessions=>sessions.filter(s=>s.completed!==false&&s.exercises.length);

// A comparative judgment ("you press more than you pull", "legs are undertrained") needs a real
// sample to mean anything — one heavy session can trip a raw set-count threshold. Require both a
// minimum number of distinct sessions AND a minimum spread of days, so a burst of same-day/same-week
// logging doesn't unlock program-level verdicts a new user hasn't had a chance to act on yet.
const MIN_COMPARATIVE_SESSIONS=4,MIN_COMPARATIVE_DAYS=10;

function analyze(sessions,now){
  now=now||Date.now();const winDays=28,weeks=4;
  const done=completed(sessions).filter(s=>s.date>=now-winDays*DAY);
  const groupSets={},effSets={},pat={hpush:0,vpush:0,hpull:0,vpull:0,hinge:0,squat:0,lunge:0,iso:0},regSeen={},patSeen={};
  let totalSets=0;
  done.forEach(s=>s.exercises.forEach(e=>{const ex=EX[e.id];if(!ex)return;const n=e.sets.filter(isWorking).length;if(!n)return;
    totalSets+=n;groupSets[ex.group]=(groupSets[ex.group]||0)+n;pat[ex.pat]=(pat[ex.pat]||0)+n;
    // effective volume: a press also trains triceps/shoulders — secondary muscles get half credit
    ex.muscles.forEach((m,i)=>{effSets[m]=(effSets[m]||0)+(i===0||m===ex.group?n:n*0.5);});
    (regSeen[ex.group]=regSeen[ex.group]||new Set()).add(ex.reg);(patSeen[ex.group]=patSeen[ex.group]||new Set()).add(ex.pat);}));
  const push=pat.hpush+pat.vpush,pull=pat.hpull+pat.vpull;
  let upperSets=0,lowerSets=0;Object.entries(groupSets).forEach(([g,n])=>{LOWER_GROUPS.indexOf(g)>=0?lowerSets+=n:upperSets+=n;});
  const perWeek={};Object.entries(groupSets).forEach(([g,n])=>perWeek[g]=(effSets[g]||n)/weeks);
  const dates=done.map(s=>s.date);
  const daySpan=dates.length?Math.round((Math.max(...dates)-Math.min(...dates))/DAY):0;
  const readyForComparative=done.length>=MIN_COMPARATIVE_SESSIONS&&daySpan>=MIN_COMPARATIVE_DAYS;
  return {sessions:done.length,daySpan,readyForComparative,totalSets,groupSets,effSets,perWeek,push,pull,upperSets,lowerSets,regSeen,patSeen,weeks};
}
// How many tracked lifts trend up in estimated 1RM over the last 4 weeks
function progressionStat(sessions,now,bw){
  now=now||Date.now();
  const done=completed(sessions).filter(s=>s.date>=now-28*DAY).sort((x,y)=>x.date-y.date);
  const byEx={};
  done.forEach(s=>s.exercises.forEach(e=>{const best=Math.max(0,...e.sets.filter(isWorking).map(st=>e1rm(setLoad(e.id,st.w,bw),+st.r||0)));if(best)(byEx[e.id]=byEx[e.id]||[]).push(best);}));
  let n=0,up=0;Object.values(byEx).forEach(arr=>{if(arr.length>=2){n++;if(arr[arr.length-1]>arr[0])up++;}});
  return {n,up};
}
function gapPrio(g,r){return {'Shoulders:rear':5,'Chest:upper':4,'Hamstrings:overall':4,'Back:lats':3,'Chest:lower':2,'Triceps:long':2}[g+':'+r]||1;}
function patPrio(g,p){return {'Hamstrings:hinge':5,'Hamstrings:iso':4,'Back:hpull':4,'Back:vpull':4,'Glutes:hinge':3,'Quads:lunge':2,'Quads:iso':1}[g+':'+p]||0.5;}
// Coaching tips: [{lv:'warn'|'good'|'info', x:html}]. Comparative/program-level verdicts (push vs
// pull, upper vs lower, weekly-volume landmarks) only appear once a.readyForComparative is true —
// see MIN_COMPARATIVE_SESSIONS/DAYS above. Region/pattern gaps and progression are per-muscle or
// per-exercise instructions ("try adding X"), not verdicts about your training as a whole, so they
// can appear as soon as they're individually meaningful — this is what lets the report get richer
// over time instead of jumping straight to a full analysis on day one.
function buildTips(a,sessions,now,bw){
  const t=[],trained=Object.keys(a.groupSets).filter(g=>a.groupSets[g]>=2);
  if(a.readyForComparative){
    if(a.push+a.pull>=6){
      if(a.push>=a.pull*1.5&&a.push-a.pull>=3)t.push({lv:'warn',x:`Your pressing outweighs pulling (<b>${a.push}</b> push vs <b>${a.pull}</b> pull sets). Add rows or pull-ups to balance your shoulders and posture.`});
      else if(a.pull>=a.push*1.5&&a.pull-a.push>=3)t.push({lv:'warn',x:`You pull far more than you press (<b>${a.pull}</b> vs <b>${a.push}</b>). Add a press to even it out.`});
      else t.push({lv:'good',x:`Push/pull balance looks healthy (<b>${a.push}</b> vs <b>${a.pull}</b> sets).`});
    }
    // upper has twice the muscle groups, so ~2:1 is normal (push/pull/legs); flag only a real skew
    if(a.upperSets+a.lowerSets>=8&&a.lowerSets*3<=a.upperSets)t.push({lv:'warn',x:`Legs are undertrained — <b>${a.lowerSets}</b> lower-body sets vs <b>${a.upperSets}</b> upper. Add a squat or hinge day.`});
  }
  const gaps=[];
  trained.forEach(g=>{const seen=a.regSeen[g]||new Set();(REGIONS[g]||[]).forEach(r=>{if(!seen.has(r)){const ex=exampleFor(g,r);if(ex)gaps.push({lv:'info',prio:gapPrio(g,r),x:`You train ${g.toLowerCase()} but skip <b>${regLabel(g,r)}</b>. Try <b>${ex}</b>.`});}});});
  trained.forEach(g=>{const seen=a.patSeen[g]||new Set();(IDEAL_PATS[g]||[]).forEach(p=>{if(!seen.has(p)){const ex=EXERCISES.find(x=>x.group===g&&x.pat===p&&x.tier<=2)||EXERCISES.find(x=>x.group===g&&x.pat===p);if(ex)gaps.push({lv:'info',prio:patPrio(g,p),x:`Your ${g.toLowerCase()} work has no <b>${p==='iso'?'isolation':patLabel(p)}</b> movement — pair it with <b>${ex.name}</b> for complete development.`});}});});
  gaps.sort((x,y)=>y.prio-x.prio);t.push(...gaps.slice(0,2));
  if(a.readyForComparative){
    // volume landmark applies to major muscles you clearly train (≥4 sets in the window); core/calves have their own norms
    const under=trained.filter(g=>a.groupSets[g]>=4&&g!=='Core'&&g!=='Calves').map(g=>({g,pw:a.perWeek[g]})).filter(x=>x.pw<8).sort((x,y)=>x.pw-y.pw)[0];
    if(under)t.push({lv:'warn',x:`Only ~<b>${under.pw.toFixed(1)}</b> sets/week of ${under.g.toLowerCase()} — aim for <b>10+</b> weekly sets to drive growth.`});
  }
  const pr=progressionStat(sessions,now,bw);
  if(pr.n>=2)t.push({lv:pr.up>=pr.n/2?'good':'info',x:`Progression: <b>${pr.up}/${pr.n}</b> of your tracked lifts are trending up in estimated strength this month.${pr.up>=pr.n/2?' Keep it going.':' Lean on the +weight suggestions to push the rest.'}`});
  return t.slice(0,5);   // may be empty — the caller owns empty-state copy (it knows WHY: too little history vs. genuinely nothing to flag)
}
// Best set per exercise by estimated 1RM
function personalRecords(sessions,bw,limit){
  const best={};
  completed(sessions).forEach(s=>s.exercises.forEach(e=>e.sets.forEach(st=>{
    if(!isWorking(st))return;const w=setLoad(e.id,st.w,bw),r=+st.r||0;if(!w||!r)return;
    const est=e1rm(w,r);
    const ex=EX[e.id];
    if(!best[e.id]||est>best[e.id].est)best[e.id]={id:e.id,w:+st.w||0,load:w,r,est,name:ex?ex.name:e.name,date:s.date,compound:!!ex&&ex.type==='compound',bodyweight:!!ex&&ex.equip==='Bodyweight'};
  })));
  // compound lifts (where an estimated 1RM means something) first, by e1RM; isolation after, by load
  return Object.values(best).sort((a,b)=>(b.compound-a.compound)||(a.compound?b.est-a.est:b.load-a.load)).slice(0,limit||8);
}
// Volume per week for the last n weeks (oldest first), weeks starting Sunday
function weeklyVolumes(sessions,now,bw,n){
  now=now||Date.now();n=n||8;
  const today=startOfDay(now);const weekStart=today-(new Date(now).getDay())*DAY;
  const done=completed(sessions);const cols=[];
  for(let i=n-1;i>=0;i--){const ws=weekStart-i*7*DAY,we=ws+7*DAY;
    cols.push({start:ws,v:done.filter(s=>s.date>=ws&&s.date<we).reduce((a,s)=>a+sessionVolume(s,bw),0)});}
  return cols;
}
function muscleSetCounts(sessions){
  const cnt={};completed(sessions).forEach(s=>s.exercises.forEach(e=>{const g=EX[e.id]?EX[e.id].group:'Other';cnt[g]=(cnt[g]||0)+e.sets.filter(isWorking).length;}));
  return Object.entries(cnt).sort((a,b)=>b[1]-a[1]);
}

IL.analysis={analyze,progressionStat,gapPrio,patPrio,buildTips,personalRecords,weeklyVolumes,muscleSetCounts,MIN_COMPARATIVE_SESSIONS,MIN_COMPARATIVE_DAYS};
if(typeof module!=='undefined')module.exports=IL.analysis;
