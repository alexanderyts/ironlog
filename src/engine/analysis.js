// Effectiveness analysis: balance, coverage gaps, weekly volume adequacy, progression, PRs.
var IL=globalThis.IL||(globalThis.IL={});
if(typeof require==='function'&&!IL.data)require('../data/exercises.js');
if(typeof require==='function'&&!IL.prog)require('./progression.js');
const {EX,EXERCISES,REGIONS,IDEAL_PATS,LOWER_GROUPS,MODES,regLabel,patLabel,exampleFor,hashId}=IL.data;
const {DAY,startOfDay,e1rm,isWorking,setLoad,sessionVolume,modeOf,calcStreak,real}=IL.prog;

// completed() INCLUDES deloads on purpose — volume/frequency/PR-window analysis wants everything the
// user actually did. Progression-only scans use real() (completed AND not a deload) instead.
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
  const done=real(sessions).filter(s=>s.date>=now-28*DAY&&s.date<now).sort((x,y)=>x.date-y.date);
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
  const prevByKey={};prev.forEach(p=>prevByKey[findingKey(p)]=p);
  const curKeys=new Set(cur.map(findingKey));
  const out=cur.map(f=>{const pf=prevByKey[findingKey(f)];return Object.assign({status:pf?'persisting':'new'},pf?{prev:pf}:{},f);});
  prev.forEach(f=>{if(!curKeys.has(findingKey(f)))out.push(Object.assign({status:'resolved'},f));});
  return out;
}

/* ── Phrasing engine (Roadmap v4 Phase E): coaching that reads like a coach, not a form letter ──────
   Still no AI — variety comes from DATA + TEMPLATES. Three levers:
     • 2–3 wordings per finding, picked by hash(findingKey + week) → different next week, STABLE within a
       week (no flicker between renders on the same day);
     • status-aware tone from withStatus: `new` states it, `persisting` softens to a follow-up ("still"),
       `resolved` gives CREDIT ("rear delts: sorted") — the biggest "not canned" win, and the way the
       coach acknowledges that the builder's reactions worked;
     • real numbers and the user's own exercise names woven in. */
const RESOLVABLE=new Set(['balance','legs-low','region-gap','pattern-gap','volume-low','freq-low']);
function isoWeek(now){return Math.floor(startOfDay(now||Date.now())/(7*DAY));}
function cap(s){return s?s.charAt(0).toUpperCase()+s.slice(1):s;}
function pickVariant(f,week,arr){return arr[Math.abs(hashId(findingKey(f))+(week||0))%arr.length];}
// renderFinding(f, week) → {lv, x:html}. `week` keeps wording stable within a week; omit for "now".
function renderFinding(f,week){
  if(week==null)week=isoWeek();
  const g=f.group?f.group.toLowerCase():'',G=cap(g),st=f.status;
  switch(f.type){
    case 'balance':{
      if(st==='resolved')return {lv:'good',x:pickVariant(f,week,[`Push and pull are back in balance — nice adjusting.`,`Your press/pull evened out. Good correction.`])};
      if(f.dir==='even')return {lv:'good',x:pickVariant(f,week,[`Push and pull look balanced (<b>${f.push}</b> vs <b>${f.pull}</b>). Right where you want it.`,`Healthy push/pull split — <b>${f.push}</b> to <b>${f.pull}</b> sets.`])};
      const heavy=f.dir==='push'?'pressing':'pulling',light=f.dir==='push'?'pulling':'pressing',fix=f.dir==='push'?'rows or pull-ups':'a press or two',pre=st==='persisting'?'Still — ':'';
      return {lv:'warn',x:pickVariant(f,week,[
        `${pre}your ${heavy} is outrunning your ${light} (<b>${f.push}</b> push vs <b>${f.pull}</b> pull). Work in ${fix} to keep the shoulders balanced.`,
        `${pre}a lot of ${heavy} lately — <b>${f.push}</b> to <b>${f.pull}</b>. A bit more ${light} protects your posture.`,
        `${pre}${heavy} is well ahead (<b>${f.push}</b> vs <b>${f.pull}</b>). Even it out with ${fix}.`])};
    }
    case 'legs-low':{
      if(st==='resolved')return {lv:'good',x:`Legs are catching up — good call giving them more work.`};
      const pre=st==='persisting'?'Legs are still lagging':'Legs are undertrained';
      return {lv:'warn',x:pickVariant(f,week,[
        `${pre} — <b>${f.lower}</b> lower-body sets to <b>${f.upper}</b> upper. A squat or hinge day would even you out.`,
        `${pre}: <b>${f.lower}</b> vs <b>${f.upper}</b> upper sets. Time to give them their own day.`])};
    }
    case 'deload-taken':return {lv:'good',x:pickVariant(f,week,[
      `You took a <b>deload</b> ${f.days<=7?'this week':'recently'} — smart. Recovery is where the last block turns into growth; ease back to full loads when you feel fresh.`,
      `Nice — a <b>deload</b> ${f.days<=7?'this week':'lately'}. Let the fatigue clear, then pick the loads back up.`])};
    case 'deload-due':return {lv:'info',x:pickVariant(f,week,[
      `<b>${f.weeks} weeks</b> straight — a lighter <b>deload</b> (about 60% loads, full range, own the stretch) clears fatigue so the next block hits harder.`,
      `You've pushed <b>${f.weeks} weeks</b> without a <b>deload</b> — a recovery week now sets up your next jump in strength.`])};
    case 'region-gap':{
      const rl=regLabel(f.group,f.reg);
      if(st==='resolved')return {lv:'good',x:`<b>${cap(rl)}</b> — sorted. Your ${g} is covered now.`};
      const pre=st==='persisting'?`Still nothing hitting your <b>${rl}</b>`:`You train ${g} but skip <b>${rl}</b>`;
      return {lv:'info',x:pickVariant(f,week,[
        `${pre} — try <b>${f.ex}</b>.`,
        `${pre}. <b>${f.ex}</b> would round it out.`])};
    }
    case 'pattern-gap':{
      const pl=f.pat==='iso'?'isolation':patLabel(f.pat);
      if(st==='resolved')return {lv:'good',x:`Your ${g} now has a <b>${pl}</b> covered — nicely rounded.`};
      const pre=st==='persisting'?'still has no':'has no';
      return {lv:'info',x:pickVariant(f,week,[
        `Your ${g} work ${pre} <b>${pl}</b> movement — pair it with <b>${f.exName}</b> for complete development.`,
        `No <b>${pl}</b> in your ${g} lately. <b>${f.exName}</b> fills that in.`])};
    }
    case 'volume-low':{
      if(st==='resolved')return {lv:'good',x:`${G} volume is back up where it should be — nice work.`};
      const pw=f.perWeek.toFixed(1),trend=(st==='persisting'&&f.prev&&f.perWeek>f.prev.perWeek)?` (up from ~${f.prev.perWeek.toFixed(1)}, keep climbing)`:'';
      return {lv:'warn',x:pickVariant(f,week,[
        `Only ~<b>${pw}</b> sets/week of ${g}${trend} — aim for <b>10+</b> to drive growth.`,
        `${G} is light at ~<b>${pw}</b> sets/week${trend}. Push toward <b>10+</b> weekly.`])};
    }
    case 'freq-low':{
      if(st==='resolved')return {lv:'good',x:`${G} is spread across the week better now — good.`};
      return {lv:'info',x:pickVariant(f,week,[
        `You train ${g} hard but about once a week — splitting those <b>~${Math.round(f.sets)} sets</b> across <b>2 days</b> tends to build the muscle faster.`,
        `${G}'s volume is packed into one session. Spreading it over <b>2 days</b> a week grows it better than one big hit.`])};
    }
    case 'progression':return {lv:f.lv,x:pickVariant(f,week,[
      `<b>${f.up}/${f.n}</b> of your tracked lifts are trending up in estimated strength this month.${f.up>=f.n/2?' Keep it going.':' Lean on the +weight prompts to push the rest.'}`,
      `Strength trend: <b>${f.up}</b> of <b>${f.n}</b> lifts climbing this month.${f.up>=f.n/2?" That's a good ratio.":' A few need a nudge — the +weight prompts will help.'}`])};
  }
  return {lv:f.lv||'info',x:''};
}
// Coaching tips: status-aware and varied (Phase E). One resolved "win" is shown first as a positive
// opener when something's been fixed; then the active guidance in the established priority order.
function buildTips(a,sessions,now,bw){
  const week=isoWeek(now),ann=withStatus(sessions,now,bw),t=[];
  const active=ann.filter(f=>f.status!=='resolved'),pick=ty=>active.filter(f=>f.type===ty);
  const resolved=ann.filter(f=>f.status==='resolved'&&RESOLVABLE.has(f.type)).sort((x,y)=>(y.prio||1)-(x.prio||1));
  if(resolved.length)t.push(renderFinding(resolved[0],week));
  pick('balance').forEach(f=>t.push(renderFinding(f,week)));
  pick('legs-low').forEach(f=>t.push(renderFinding(f,week)));
  pick('deload-taken').concat(pick('deload-due')).forEach(f=>t.push(renderFinding(f,week)));
  active.filter(f=>f.type==='region-gap'||f.type==='pattern-gap').sort((x,y)=>y.prio-x.prio).slice(0,2).forEach(f=>t.push(renderFinding(f,week)));
  const vol=pick('volume-low').sort((x,y)=>x.perWeek-y.perWeek)[0];if(vol)t.push(renderFinding(vol,week));
  const freq=pick('freq-low').sort((x,y)=>y.sets-x.sets)[0];if(freq)t.push(renderFinding(freq,week));
  pick('progression').forEach(f=>t.push(renderFinding(f,week)));
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
  real(sessions).forEach(s=>{s.exercises.forEach(e=>{const mode=modeOf(e);e.sets.forEach(st=>{
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
