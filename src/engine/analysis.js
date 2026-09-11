// Effectiveness analysis: balance, coverage gaps, weekly volume adequacy, progression, PRs.
var IL=globalThis.IL||(globalThis.IL={});
if(typeof require==='function'&&!IL.data)require('../data/exercises.js');
if(typeof require==='function'&&!IL.prog)require('./progression.js');
const {EX,EXERCISES,REGIONS,IDEAL_PATS,LOWER_GROUPS,MODES,regLabel,patLabel,exampleFor}=IL.data;
const {DAY,startOfDay,e1rm,isWorking,setLoad,sessionVolume,modeOf,calcStreak}=IL.prog;

const completed=sessions=>sessions.filter(s=>s.completed!==false&&s.exercises.length);

// A comparative judgment ("you press more than you pull", "legs are undertrained") needs a real
// sample to mean anything — one heavy session can trip a raw set-count threshold. Require both a
// minimum number of distinct sessions AND a minimum spread of days, so a burst of same-day/same-week
// logging doesn't unlock program-level verdicts a new user hasn't had a chance to act on yet.
const MIN_COMPARATIVE_SESSIONS=4,MIN_COMPARATIVE_DAYS=10;

function analyze(sessions,now){
  now=now||Date.now();const winDays=28,weeks=4;
  // Upper bound (s.date < now) matters when `now` is shifted back to compute a PRIOR window
  // (withStatus); for the normal call it's a no-op since there are no future-dated sessions.
  const done=completed(sessions).filter(s=>s.date>=now-winDays*DAY&&s.date<now);
  const groupSets={},effSets={},pat={hpush:0,vpush:0,hpull:0,vpull:0,hinge:0,squat:0,lunge:0,iso:0},regSeen={},patSeen={},groupDays={};
  let totalSets=0;
  done.forEach(s=>{const day=startOfDay(s.date),dayGroups=new Set();
    s.exercises.forEach(e=>{const ex=EX[e.id];if(!ex)return;const n=e.sets.filter(isWorking).length;if(!n)return;
    totalSets+=n;groupSets[ex.group]=(groupSets[ex.group]||0)+n;pat[ex.pat]=(pat[ex.pat]||0)+n;dayGroups.add(ex.group);
    // effective volume: a press also trains triceps/shoulders — secondary muscles get half credit
    ex.muscles.forEach((m,i)=>{effSets[m]=(effSets[m]||0)+(i===0||m===ex.group?n:n*0.5);});
    (regSeen[ex.group]=regSeen[ex.group]||new Set()).add(ex.reg);(patSeen[ex.group]=patSeen[ex.group]||new Set()).add(ex.pat);});
    // how many distinct training DAYS hit each group — for weekly frequency (≥2×/week is better per unit volume)
    dayGroups.forEach(g=>{(groupDays[g]=groupDays[g]||new Set()).add(day);});});
  const groupFreq={};Object.keys(groupDays).forEach(g=>groupFreq[g]=groupDays[g].size);
  const push=pat.hpush+pat.vpush,pull=pat.hpull+pat.vpull;
  let upperSets=0,lowerSets=0;Object.entries(groupSets).forEach(([g,n])=>{LOWER_GROUPS.indexOf(g)>=0?lowerSets+=n:upperSets+=n;});
  const perWeek={};Object.entries(groupSets).forEach(([g,n])=>perWeek[g]=(effSets[g]||n)/weeks);
  const dates=done.map(s=>s.date);
  const daySpan=dates.length?Math.round((Math.max(...dates)-Math.min(...dates))/DAY):0;
  const readyForComparative=done.length>=MIN_COMPARATIVE_SESSIONS&&daySpan>=MIN_COMPARATIVE_DAYS;
  return {sessions:done.length,daySpan,readyForComparative,totalSets,groupSets,effSets,perWeek,groupFreq,push,pull,upperSets,lowerSets,regSeen,patSeen,weeks};
}
// How many tracked lifts trend up in estimated 1RM over the last 4 weeks
function progressionStat(sessions,now,bw){
  now=now||Date.now();
  const done=completed(sessions).filter(s=>!s.deload&&s.date>=now-28*DAY&&s.date<now).sort((x,y)=>x.date-y.date);
  const byEx={};
  done.forEach(s=>s.exercises.forEach(e=>{const best=Math.max(0,...e.sets.filter(isWorking).map(st=>e1rm(setLoad(e.id,st.w,bw),+st.r||0)));if(best)(byEx[e.id]=byEx[e.id]||[]).push(best);}));
  let n=0,up=0;Object.values(byEx).forEach(arr=>{if(arr.length>=2){n++;if(arr[arr.length-1]>arr[0])up++;}});
  return {n,up};
}
function gapPrio(g,r){return {'Shoulders:rear':5,'Chest:upper':4,'Hamstrings:overall':4,'Back:lats':3,'Chest:lower':2,'Triceps:long':2}[g+':'+r]||1;}
function patPrio(g,p){return {'Hamstrings:hinge':5,'Hamstrings:iso':4,'Back:hpull':4,'Back:vpull':4,'Glutes:hinge':3,'Quads:lunge':2,'Quads:iso':1}[g+':'+p]||0.5;}
/* ── Findings: the DECISION layer (Roadmap v4 Phase A) ─────────────────────────────────────────────
   `findings()` decides what's true about the user's training and returns TYPED data — no wording.
   Two consumers read it: buildTips() renders sentences (below), and the workout builder reads the
   same facts to react (Phase C). Keeping the decision separate from the phrasing is what lets the
   coaching vary its language (Phase E) and the builder act on gaps, from one shared source of truth.
   Gating mirrors the old buildTips exactly: comparative findings (balance/legs/volume/frequency) need
   a.readyForComparative; per-muscle gaps, deload and progression appear as soon as they're meaningful.
   All gaps/volume/freq candidates are returned (not pre-sliced) so the builder sees everything; the
   renderer does the display trimming. */
function findings(a,sessions,now,bw){
  now=now||Date.now();
  const F=[],trained=Object.keys(a.groupSets).filter(g=>a.groupSets[g]>=2);
  if(a.readyForComparative){
    if(a.push+a.pull>=6){
      if(a.push>=a.pull*1.5&&a.push-a.pull>=3)F.push({type:'balance',lv:'warn',dir:'push',push:a.push,pull:a.pull});
      else if(a.pull>=a.push*1.5&&a.pull-a.push>=3)F.push({type:'balance',lv:'warn',dir:'pull',push:a.push,pull:a.pull});
      else F.push({type:'balance',lv:'good',dir:'even',push:a.push,pull:a.pull});
    }
    if(a.upperSets+a.lowerSets>=8&&a.lowerSets*3<=a.upperSets)F.push({type:'legs-low',lv:'warn',lower:a.lowerSets,upper:a.upperSets});
  }
  const lastDeload=completed(sessions).filter(s=>s.deload&&s.date<now).sort((x,y)=>y.date-x.date)[0];
  const sinceDeload=lastDeload?Math.round((now-lastDeload.date)/DAY):Infinity;
  if(sinceDeload<=14)F.push({type:'deload-taken',lv:'good',days:sinceDeload});
  else{const streakWk=calcStreak(sessions,now);if(streakWk>=6)F.push({type:'deload-due',lv:'info',weeks:streakWk});}
  trained.forEach(g=>{const seen=a.regSeen[g]||new Set();(REGIONS[g]||[]).forEach(r=>{if(!seen.has(r)){const ex=exampleFor(g,r);if(ex)F.push({type:'region-gap',lv:'info',group:g,reg:r,ex,prio:gapPrio(g,r)});}});});
  trained.forEach(g=>{const seen=a.patSeen[g]||new Set();(IDEAL_PATS[g]||[]).forEach(p=>{if(!seen.has(p)){const ex=EXERCISES.find(x=>x.group===g&&x.pat===p&&x.tier<=2)||EXERCISES.find(x=>x.group===g&&x.pat===p);if(ex)F.push({type:'pattern-gap',lv:'info',group:g,pat:p,exId:ex.id,exName:ex.name,prio:patPrio(g,p)});}});});
  if(a.readyForComparative){
    trained.filter(g=>a.groupSets[g]>=4&&g!=='Core'&&g!=='Calves').forEach(g=>{if(a.perWeek[g]<8)F.push({type:'volume-low',lv:'warn',group:g,perWeek:a.perWeek[g]});});
    trained.filter(g=>g!=='Core'&&g!=='Calves'&&a.groupSets[g]/a.weeks>=6&&(a.groupFreq[g]||0)/a.weeks<1.5).forEach(g=>F.push({type:'freq-low',lv:'info',group:g,sets:a.groupSets[g]/a.weeks}));
  }
  const pr=progressionStat(sessions,now,bw);
  if(pr.n>=2)F.push({type:'progression',lv:pr.up>=pr.n/2?'good':'info',up:pr.up,n:pr.n});
  return F;
}
// A stable identity for a finding, so the same concern across two time windows is recognised as the
// same thing (for new/persisting/resolved status). Deload-taken and deload-due share one identity.
function findingKey(f){
  if(f.type==='region-gap')return 'region-gap:'+f.group+':'+f.reg;
  if(f.type==='pattern-gap')return 'pattern-gap:'+f.group+':'+f.pat;
  if(f.type==='volume-low')return 'volume-low:'+f.group;
  if(f.type==='freq-low')return 'freq-low:'+f.group;
  if(f.type==='deload-taken'||f.type==='deload-due')return 'deload';
  return f.type;
}
// Current findings annotated with status by comparing to the window 28 days earlier (derived from
// history, no persisted state). Resolved findings (present then, gone now) are appended so the coach
// can give credit later (Phase E). buildTips ignores status for now — it's foundation for C and E.
function withStatus(sessions,now,bw){
  now=now||Date.now();
  const cur=findings(analyze(sessions,now),sessions,now,bw);
  const prev=findings(analyze(sessions,now-28*DAY),sessions,now-28*DAY,bw);
  const prevKeys=new Set(prev.map(findingKey)),curKeys=new Set(cur.map(findingKey));
  const out=cur.map(f=>Object.assign({status:prevKeys.has(findingKey(f))?'persisting':'new'},f));
  prev.forEach(f=>{if(!curKeys.has(findingKey(f)))out.push(Object.assign({status:'resolved'},f));});
  return out;
}

// Render one finding to a tip {lv, x:html}. Wording is preserved verbatim from the pre-refactor
// buildTips so output stays byte-identical (Phase A is invisible); Phase E will vary this.
function renderFinding(f){
  const g=f.group?f.group.toLowerCase():'';
  switch(f.type){
    case 'balance':
      if(f.dir==='push')return {lv:'warn',x:`Your pressing outweighs pulling (<b>${f.push}</b> push vs <b>${f.pull}</b> pull sets). Add rows or pull-ups to balance your shoulders and posture.`};
      if(f.dir==='pull')return {lv:'warn',x:`You pull far more than you press (<b>${f.pull}</b> vs <b>${f.push}</b>). Add a press to even it out.`};
      return {lv:'good',x:`Push/pull balance looks healthy (<b>${f.push}</b> vs <b>${f.pull}</b> sets).`};
    case 'legs-low':return {lv:'warn',x:`Legs are undertrained — <b>${f.lower}</b> lower-body sets vs <b>${f.upper}</b> upper. Add a squat or hinge day.`};
    case 'deload-taken':return {lv:'good',x:`You took a <b>deload</b> ${f.days<=7?'this week':'recently'} — smart. Recovery is where the last block's work turns into growth; ease back to full loads once you feel fresh.`};
    case 'deload-due':return {lv:'info',x:`You've trained <b>${f.weeks} weeks</b> straight — a lighter <b>deload</b> (about 60% loads, full range, focus on the stretch) lets accumulated fatigue and joint stress clear so the next block hits harder.`};
    case 'region-gap':return {lv:'info',x:`You train ${g} but skip <b>${regLabel(f.group,f.reg)}</b>. Try <b>${f.ex}</b>.`};
    case 'pattern-gap':return {lv:'info',x:`Your ${g} work has no <b>${f.pat==='iso'?'isolation':patLabel(f.pat)}</b> movement — pair it with <b>${f.exName}</b> for complete development.`};
    case 'volume-low':return {lv:'warn',x:`Only ~<b>${f.perWeek.toFixed(1)}</b> sets/week of ${g} — aim for <b>10+</b> weekly sets to drive growth.`};
    case 'freq-low':return {lv:'info',x:`You train ${g} hard but about once a week — splitting those <b>~${Math.round(f.sets)} sets</b> across <b>2 days</b> tends to build a muscle faster than one big session.`};
    case 'progression':return {lv:f.lv,x:`Progression: <b>${f.up}/${f.n}</b> of your tracked lifts are trending up in estimated strength this month.${f.up>=f.n/2?' Keep it going.':' Lean on the +weight suggestions to push the rest.'}`};
  }
  return {lv:f.lv||'info',x:''};
}
// Coaching tips: renders findings() in the established order (balance, legs, deload, top-2 gaps,
// lowest-volume, top frequency, progression), capped at 5. See the buildup/empty-state note above.
function buildTips(a,sessions,now,bw){
  const F=findings(a,sessions,now,bw),t=[],pick=ty=>F.filter(f=>f.type===ty);
  pick('balance').forEach(f=>t.push(renderFinding(f)));
  pick('legs-low').forEach(f=>t.push(renderFinding(f)));
  pick('deload-taken').concat(pick('deload-due')).forEach(f=>t.push(renderFinding(f)));
  F.filter(f=>f.type==='region-gap'||f.type==='pattern-gap').sort((x,y)=>y.prio-x.prio).slice(0,2).forEach(f=>t.push(renderFinding(f)));
  const vol=pick('volume-low').sort((x,y)=>x.perWeek-y.perWeek)[0];if(vol)t.push(renderFinding(vol));
  const freq=pick('freq-low').sort((x,y)=>y.sets-x.sets)[0];if(freq)t.push(renderFinding(freq));
  pick('progression').forEach(f=>t.push(renderFinding(f)));
  return t.slice(0,5);   // may be empty — the caller owns empty-state copy (too little history vs. nothing to flag)
}
/* buildHints (Roadmap v4 Phase C): turn findings into inputs the WORKOUT BUILDER can act on — the
   other half of the "coach and builder read the same scoreboard" idea. Pure data; the builder decides
   how to use it and never lets a hint override continuity. Reactions the builder derives from this:
     • gaps → a scoring bonus for exercises that fill a flagged region/pattern gap, and a possible
       one-exercise ADDITION for a never-trained region (never a swap);
     • undertrained → +1 set on a continued plan (self-limiting: the finding clears once volume is
       adequate, so it accumulates toward the productive range then stops);
     • imbalance/legsLow → suggestGroups for the start-screen "train this next" nudge. */
function buildHints(sessions,now,bw){
  const a=analyze(sessions,now);
  const F=findings(a,sessions,now,bw);
  const gaps=F.filter(f=>f.type==='region-gap'||f.type==='pattern-gap');
  const undertrained=F.filter(f=>f.type==='volume-low').map(f=>f.group);
  const imbalance=F.find(f=>f.type==='balance'&&f.lv==='warn')||null;
  const legsLow=F.some(f=>f.type==='legs-low');
  const suggest=new Set(undertrained);
  if(legsLow)['Quads','Hamstrings','Glutes'].forEach(g=>suggest.add(g));
  if(imbalance)(imbalance.dir==='push'?['Back']:['Chest','Shoulders']).forEach(g=>suggest.add(g));
  return {gaps,undertrained,imbalance,legsLow,suggestGroups:[...suggest].slice(0,3)};
}
// Best set per exercise BY MODALITY (a Smith and a dumbbell overhead press are separate PRs) by
// estimated 1RM. `showEst` is true only for compound lifts done with equipment whose 1RM estimate
// is meaningful (barbell/smith/bodyweight) — cable/machine stacks show load instead of a bogus 1RM.
function personalRecords(sessions,bw,limit){
  const best={};
  completed(sessions).forEach(s=>{if(s.deload)return;s.exercises.forEach(e=>{const mode=modeOf(e);e.sets.forEach(st=>{
    if(!isWorking(st))return;const w=setLoad(e.id,st.w,bw),r=+st.r||0;if(!w||!r)return;
    const est=e1rm(w,r);const ex=EX[e.id];const key=e.id+':'+mode;
    const showEst=!!ex&&ex.type==='compound'&&!!(MODES[mode]&&MODES[mode].e1rm);
    if(!best[key]||est>best[key].est)best[key]={id:e.id,mode,w:+st.w||0,load:w,r,est,name:ex?ex.name:e.name,date:s.date,compound:!!ex&&ex.type==='compound',showEst,bodyweight:mode==='bodyweight'};
  })})});
  // e1RM-comparable lifts first (by e1RM); the rest after, by load
  return Object.values(best).sort((a,b)=>(b.showEst-a.showEst)||(a.showEst?b.est-a.est:b.load-a.load)).slice(0,limit||8);
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

IL.analysis={analyze,progressionStat,gapPrio,patPrio,findings,findingKey,withStatus,renderFinding,buildTips,buildHints,personalRecords,weeklyVolumes,muscleSetCounts,MIN_COMPARATIVE_SESSIONS,MIN_COMPARATIVE_DAYS};
if(typeof module!=='undefined')module.exports=IL.analysis;
