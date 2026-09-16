// Effectiveness analysis: balance, coverage gaps, weekly volume adequacy, progression, PRs.
var IL=globalThis.IL||(globalThis.IL={});
if(typeof require==='function'&&!IL.data)require('../data/exercises.js');
if(typeof require==='function'&&!IL.prog)require('./progression.js');
const {EX,EXERCISES,REGIONS,IDEAL_PATS,LOWER_GROUPS,MODES,INVERTED_LOAD,TIME_METRIC,regLabel,patLabel,exampleFor,hashId}=IL.data;
const {DAY,startOfDay,e1rm,isWorking,setLoad,sessionVolume,sessionSets,sessionDuration,setTimeline,modeOf,calcStreak,real,weekIndex,weekStart,lastPerf}=IL.prog;

// completed() INCLUDES deloads on purpose — volume/frequency/PR-window analysis wants everything the
// user actually did. Progression-only scans use real() (completed AND not a deload) instead.
const completed=sessions=>sessions.filter(s=>s.completed!==false&&s.exercises.length&&s.kind!=='cardio');

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
  let totalSets=0,backHinge=0;
  done.forEach(s=>{const day=startOfDay(s.date),dayGroups=new Set();
    s.exercises.forEach(e=>{const ex=EX[e.id];if(!ex)return;const n=e.sets.filter(isWorking).length;if(!n)return;
    totalSets+=n;groupSets[ex.group]=(groupSets[ex.group]||0)+n;pat[ex.pat]=(pat[ex.pat]||0)+n;dayGroups.add(ex.group);
    if(ex.pat==='hinge'&&ex.muscles.indexOf('Back')>=0)backHinge+=n;   // a deadlift is a posterior-chain PULL, not "neither" (#22)
    // effective volume: a press also trains triceps/shoulders — secondary muscles get half credit
    ex.muscles.forEach((m,i)=>{effSets[m]=(effSets[m]||0)+(i===0||m===ex.group?n:n*0.5);});
    (regSeen[ex.group]=regSeen[ex.group]||new Set()).add(ex.reg);(patSeen[ex.group]=patSeen[ex.group]||new Set()).add(ex.pat);});
    // how many distinct training DAYS hit each group — for weekly frequency (≥2×/week is better per unit volume)
    dayGroups.forEach(g=>{(groupDays[g]=groupDays[g]||new Set()).add(day);});});
  const groupFreq={};Object.keys(groupDays).forEach(g=>groupFreq[g]=groupDays[g].size);
  const push=pat.hpush+pat.vpush,pull=pat.hpull+pat.vpull+0.5*backHinge;   // half a deadlift's sets count toward pulling (#22)
  let upperSets=0,lowerSets=0;Object.entries(groupSets).forEach(([g,n])=>{LOWER_GROUPS.indexOf(g)>=0?lowerSets+=n:upperSets+=n;});
  // Sustained weekly volume = sets / calendar weeks (the landmarks 8–20 are per-CALENDAR-week: training
  // a muscle 12 sets every OTHER week is 6/week of stimulus, not 12). NOTE #14 (a layoff makes the first
  // sessions back read "low") is deferred — dividing by active weeks OVERSTATES an intermittent trainer's
  // volume, which is worse for this app's users; it needs targeted layoff detection, not a divisor swap.
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
// Weekly working-set landmarks per goal (Schoenfeld 2017 dose-response; Israetel MEV/MAV). Only the
// low end raises a finding; 'general' equals today's threshold so Balanced is unchanged.
const VOL_LANDMARKS={size:[10,20],strength:[6,12],general:[8,15]};
// `profile` (Roadmap v6 P3): the optional training profile is a LENS on the same facts — it never
// changes what was measured, only which findings are worth raising and how they're worded.
function findings(a,sessions,now,bw,profile){
  now=now||Date.now();profile=profile||{};
  const F=[],trained=Object.keys(a.groupSets).filter(g=>a.groupSets[g]>=2);
  const protect=new Set(profile.protect||[]);
  // A suggested example must fit the gym (and not be avoided). Protect is handled by its own block
  // below (which DROPS a protected muscle's heavy gap rather than substitute a lighter lift), so strip
  // protect here — else a protected muscle would get a light alternative instead of the "keeping it light" credit.
  const allow=(x,g)=>IL.builder.profileAllows(x,g,Object.assign({},profile,{protect:undefined}),sessions);   // gym/avoid-legal only (#5)
  if(a.readyForComparative){
    // Don't nag toward a side you're deliberately keeping light: if the fix would be pulling and both
    // pull muscles are protected (or pressing and all press muscles are), stay quiet (#6).
    const pullProt=['Back','Biceps'].every(g=>protect.has(g)),pushProt=['Chest','Shoulders','Triceps'].every(g=>protect.has(g));
    const pu=Math.round(a.push),pl=Math.round(a.pull);   // pull can be fractional now (half-credit hinge) — round for display
    if(a.push+a.pull>=6){
      if(a.push>=a.pull*1.5&&a.push-a.pull>=3){if(!pullProt)F.push({type:'balance',lv:'warn',dir:'push',push:pu,pull:pl});}
      else if(a.pull>=a.push*1.5&&a.pull-a.push>=3){if(!pushProt)F.push({type:'balance',lv:'warn',dir:'pull',push:pu,pull:pl});}
      else F.push({type:'balance',lv:'good',dir:'even',push:pu,pull:pl});
    }
    // Don't tell someone protecting their legs that legs are undertrained (#6).
    const legsProt=['Quads','Hamstrings','Glutes'].some(g=>protect.has(g));
    if(a.upperSets+a.lowerSets>=8&&a.lowerSets*3<=a.upperSets&&!legsProt)F.push({type:'legs-low',lv:'warn',lower:a.lowerSets,upper:a.upperSets});
  }
  const lastDeload=completed(sessions).filter(s=>s.deload&&s.date<now).sort((x,y)=>y.date-x.date)[0];
  const sinceDeload=lastDeload?Math.round((now-lastDeload.date)/DAY):Infinity;
  if(sinceDeload<=14)F.push({type:'deload-taken',lv:'good',days:sinceDeload});
  else{const streakWk=calcStreak(sessions,now),weeksSince=Math.floor(sinceDeload/7);
    // Count from the LAST deload, not the training streak (which runs through deloads), so it can't say
    // "12 weeks without a deload" three weeks after one. Fire once per ~6-week block (weeks 6–7, 12–13…),
    // not every week (#7).
    const weeks=Math.min(streakWk,weeksSince);
    if(weeks>=6&&weeks%6<2)F.push({type:'deload-due',lv:'info',weeks});}
  // Region / pattern gaps: the suggested example must be doable at the user's gym — no "try an Incline
  // Barbell Press" at a home gym. If nothing legal covers the gap there, it isn't a gap worth raising (#5).
  trained.forEach(g=>{const seen=a.regSeen[g]||new Set();(REGIONS[g]||[]).forEach(r=>{if(!seen.has(r)){
    const pick=EXERCISES.find(x=>x.group===g&&x.reg===r&&x.type==='compound'&&allow(x,g))||EXERCISES.find(x=>x.group===g&&x.reg===r&&allow(x,g));
    if(pick)F.push({type:'region-gap',lv:'info',group:g,reg:r,ex:pick.name,prio:gapPrio(g,r)});}});});
  trained.forEach(g=>{const seen=a.patSeen[g]||new Set();(IDEAL_PATS[g]||[]).forEach(p=>{if(!seen.has(p)){
    const pick=EXERCISES.find(x=>x.group===g&&x.pat===p&&x.tier<=2&&allow(x,g))||EXERCISES.find(x=>x.group===g&&x.pat===p&&allow(x,g));
    if(pick)F.push({type:'pattern-gap',lv:'info',group:g,pat:p,exId:pick.id,exName:pick.name,prio:patPrio(g,p)});}});});
  // 'protect': a muscle you're keeping light must not be nagged toward heavy compounds. Gap findings
  // there whose suggested fix is a tier-1 compound are dropped and replaced by ONE 'protect' finding
  // that credits what's covering it; isolation gaps (light, safe) stay. The builder reads the same
  // list, so it stops gap-adding heavy work there too — coach and builder agree by construction.
  if(protect.size){
    const heavy=f=>{const x=f.exId?EX[f.exId]:EXERCISES.find(e=>e.name===f.ex);return !!x&&x.tier===1&&x.type==='compound';};
    for(let i=F.length-1;i>=0;i--){const f=F[i];if((f.type==='region-gap'||f.type==='pattern-gap')&&protect.has(f.group)&&heavy(f))F.splice(i,1);}
    const win=completed(sessions).filter(s=>s.date>=now-28*DAY&&s.date<now);
    protect.forEach(g=>{if(trained.indexOf(g)<0)return;const names=[];
      win.forEach(s=>s.exercises.forEach(e=>{const x=EX[e.id];if(x&&x.group===g&&e.sets.some(isWorking)&&names.indexOf(x.name)<0)names.push(x.name);}));
      if(names.length)F.push({type:'protect',lv:'good',group:g,covering:names.slice(0,3)});});
  }
  if(a.readyForComparative){
    // 'goal' moves the volume landmark; the finding carries the target only when it differs from Balanced
    const goalVol=profile.goal==='size'||profile.goal==='strength'?profile.goal:null;
    let volLo=(VOL_LANDMARKS[goalVol]||VOL_LANDMARKS.general)[0];
    if(profile.days&&profile.days<=2)volLo=Math.min(volLo,6);   // a 2-day lifter can't hit 10 sets/muscle/week; don't call it "low" (#23)
    const volTarget=(goalVol||(profile.days&&profile.days<=2))?volLo:undefined;   // carry the number only when it differs from the Balanced threshold
    trained.filter(g=>a.groupSets[g]>=4&&g!=='Core'&&g!=='Calves').forEach(g=>{if(a.perWeek[g]<volLo)F.push(Object.assign({type:'volume-low',lv:'warn',group:g,perWeek:a.perWeek[g]},volTarget!==undefined?{target:volTarget,goal:goalVol||'general'}:{}));});
    // 'days': on a 2-day week most muscles only fit once — a 1×/week frequency isn't a gap, it's the plan
    if(!(profile.days&&profile.days<=2))
      trained.filter(g=>g!=='Core'&&g!=='Calves'&&a.groupSets[g]/a.weeks>=6&&(a.groupFreq[g]||0)/a.weeks<1.5).forEach(g=>F.push({type:'freq-low',lv:'info',group:g,sets:a.groupSets[g]/a.weeks}));
  }
  const pr=progressionStat(sessions,now,bw);
  // push:'quiet' — the progression finding stays descriptive (no "lean on the +weight prompts")
  if(pr.n>=2)F.push(Object.assign({type:'progression',lv:pr.up>=pr.n/2?'good':'info',up:pr.up,n:pr.n},profile.push==='quiet'?{quiet:true}:{}));
  return F;
}
// A stable identity for a finding, so the same concern across two time windows is recognised as the
// same thing (for new/persisting/resolved status). Deload-taken and deload-due share one identity.
function findingKey(f){
  if(f.type==='region-gap')return 'region-gap:'+f.group+':'+f.reg;
  if(f.type==='pattern-gap')return 'pattern-gap:'+f.group+':'+f.pat;
  if(f.type==='volume-low')return 'volume-low:'+f.group;
  if(f.type==='freq-low')return 'freq-low:'+f.group;
  if(f.type==='protect')return 'protect:'+f.group;
  if(f.type==='deload-taken'||f.type==='deload-due')return 'deload';
  return f.type;
}
// Current findings annotated with status by comparing to the window 28 days earlier (derived from
// history, no persisted state). Resolved findings (present then, gone now) are appended so the coach
// can give credit later (Phase E). buildTips ignores status for now — it's foundation for C and E.
// A finding that vanished only earns "resolved" credit if the CURRENT window could still have raised
// it — otherwise it disappeared because you stopped training that muscle (or stopped logging enough),
// not because you fixed it. And a finding that was already positive is never "resolved".
function canResolve(f,curA){
  if(f.lv==='good'||f.type==='progression')return false;
  if(f.type==='region-gap'||f.type==='pattern-gap')return (curA.groupSets[f.group]||0)>0;   // still training it
  return curA.readyForComparative;   // balance / legs-low / volume-low / freq-low need a real current sample
}
function withStatus(sessions,now,bw,profile){
  now=now||Date.now();
  const curA=analyze(sessions,now);
  const cur=findings(curA,sessions,now,bw,profile);
  const prev=findings(analyze(sessions,now-28*DAY),sessions,now-28*DAY,bw,profile);   // same lens on both windows
  const prevByKey={};prev.forEach(p=>prevByKey[findingKey(p)]=p);
  const curKeys=new Set(cur.map(findingKey));
  const out=cur.map(f=>{const pf=prevByKey[findingKey(f)];return Object.assign({status:pf?'persisting':'new'},pf?{prev:pf}:{},f);});
  prev.forEach(f=>{if(!curKeys.has(findingKey(f))&&canResolve(f,curA))out.push(Object.assign({status:'resolved'},f));});
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
function isoWeek(now){return weekIndex(now||Date.now());}   // local Monday-start week (see progression.js)
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
    case 'deload-taken':{const w=f.days<=7;return {lv:'good',x:pickVariant(f,week,[
      `<b>Deload</b> ${w?'this week':'recently'} — good call. That's where the last block turns into strength.`,
      `You eased off with a <b>deload</b> ${w?'this week':'lately'}. Come back fresh and the loads climb.`,
      `A <b>deload</b> ${w?'this week':'recently'} — recovery's doing its job. Back to full loads when you're ready.`,
      `Smart <b>deload</b> ${w?'this week':'lately'}. Let the fatigue drain, then pick it back up.`])};}
    case 'deload-due':return {lv:'info',x:pickVariant(f,week,[
      `<b>${f.weeks} weeks</b> straight — an easy <b>deload</b> week now clears fatigue for the next push.`,
      `You've trained hard <b>${f.weeks} weeks</b> running. A recovery week sets up your next jump.`,
      `<b>${f.weeks} weeks</b> without a break — a lighter <b>deload</b> keeps progress from stalling.`,
      `Worth a <b>deload</b> soon: <b>${f.weeks} weeks</b> in is when fatigue starts outrunning recovery.`])};
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
      const tgt=f.target||8;   // the finding carries a goal/days-adjusted landmark; else the Balanced threshold (8, matching the trigger — was miswritten as "10+")
      if(f.goal==='size'||f.goal==='strength'){const why=f.goal==='size'?'reliably grows it':'builds strength there';
        return {lv:'warn',x:pickVariant(f,week,[
          `For ${f.goal}, ${g} at ~<b>${pw}</b> sets/week${trend} is below the <b>~${tgt}</b> that ${why}.`,
          `${G} is at ~<b>${pw}</b> sets/week${trend} — for ${f.goal} you want <b>${tgt}+</b>.`])};}
      return {lv:'warn',x:pickVariant(f,week,[
        `Only ~<b>${pw}</b> sets/week of ${g}${trend} — aim for <b>${tgt}+</b> to keep it growing.`,
        `${G} is light at ~<b>${pw}</b> sets/week${trend}. Push toward <b>${tgt}+</b> weekly.`])};
    }
    case 'freq-low':{
      if(st==='resolved')return {lv:'good',x:`${G} is spread across the week better now — good.`};
      return {lv:'info',x:pickVariant(f,week,[
        `You train ${g} hard but about once a week — splitting those <b>~${Math.round(f.sets)} sets</b> across <b>2 days</b> tends to build the muscle faster.`,
        `${G}'s volume is packed into one session. Spreading it over <b>2 days</b> a week grows it better than one big hit.`])};
    }
    case 'protect':{
      const names=f.covering.map(n=>`<b>${n}</b>`),list=names.length>1?names.slice(0,-1).join(', ')+' and '+names[names.length-1]:names[0],pl=names.length>1;
      return {lv:'good',x:pickVariant(f,week,[
        `You're keeping ${g} light — ${list} ${pl?'are':'is'} covering it.`,
        `${G} stays light by your choice; ${list} ${pl?'keep':'keeps'} it moving.`])};
    }
    case 'progression':return {lv:f.lv,x:pickVariant(f,week,[
      `<b>${f.up}/${f.n}</b> of your tracked lifts are trending up in estimated strength this month.${f.up>=f.n/2?' Keep it going.':f.quiet?'':' Lean on the +weight prompts to push the rest.'}`,
      `Strength trend: <b>${f.up}</b> of <b>${f.n}</b> lifts climbing this month.${f.up>=f.n/2?" That's a good ratio.":f.quiet?'':' A few need a nudge — the +weight prompts will help.'}`])};
  }
  return {lv:f.lv||'info',x:''};
}
// Coaching tips: status-aware and varied (Phase E). One resolved "win" is shown first as a positive
// opener when something's been fixed; then the active guidance in the established priority order.
// Findings a user can silence with "Got it" (a warning they've heard). Positive/transient ones
// (protect/progression/deload) aren't mutable. `seen` is settings.seen; a mute key is 'mute:'+findingKey.
const MUTABLE=new Set(['balance','legs-low','region-gap','pattern-gap','volume-low','freq-low']);
function buildTips(a,sessions,now,bw,profile,seen){
  seen=seen||{};
  const week=isoWeek(now),ann=withStatus(sessions,now,bw,profile),t=[];
  const muted=f=>MUTABLE.has(f.type)&&seen['mute:'+findingKey(f)]===true;
  const active=ann.filter(f=>f.status!=='resolved'&&!muted(f)),pick=ty=>active.filter(f=>f.type===ty);
  const add=f=>{const r=renderFinding(f,week);if(MUTABLE.has(f.type))r.key=findingKey(f);t.push(r);};   // key lets the UI show a "Got it" mute
  const resolved=ann.filter(f=>f.status==='resolved'&&RESOLVABLE.has(f.type)).sort((x,y)=>(y.prio||1)-(x.prio||1));
  if(resolved.length)add(resolved[0]);
  pick('balance').forEach(add);
  pick('legs-low').forEach(add);
  pick('deload-taken').concat(pick('deload-due')).forEach(add);
  active.filter(f=>f.type==='region-gap'||f.type==='pattern-gap').sort((x,y)=>y.prio-x.prio).slice(0,2).forEach(add);
  const vol=pick('volume-low').sort((x,y)=>x.perWeek-y.perWeek)[0];if(vol)add(vol);
  const freq=pick('freq-low').sort((x,y)=>y.sets-x.sets)[0];if(freq)add(freq);
  pick('protect').forEach(add);   // good news goes AFTER the warnings so the 5-tip cap never drops a warning for it
  pick('progression').forEach(add);
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
function buildHints(sessions,now,bw,profile){
  const a=analyze(sessions,now);
  const F=findings(a,sessions,now,bw,profile);
  const gaps=F.filter(f=>f.type==='region-gap'||f.type==='pattern-gap');
  const volLow=F.filter(f=>f.type==='volume-low');
  const undertrained=volLow.map(f=>f.group);                                   // group names (kept for suggestGroups)
  const undertrainedByVolume=volLow.map(f=>({group:f.group,perWeek:f.perWeek})).sort((x,y)=>x.perWeek-y.perWeek);   // lowest first — the builder bumps just the neediest group per session (#23)
  const imbalance=F.find(f=>f.type==='balance'&&f.lv==='warn')||null;
  const legsLow=F.some(f=>f.type==='legs-low');
  const protect=new Set((profile&&profile.protect)||[]);
  const suggest=new Set(undertrained);
  if(legsLow)['Quads','Hamstrings','Glutes'].forEach(g=>suggest.add(g));
  if(imbalance)(imbalance.dir==='push'?['Back']:['Chest','Shoulders']).forEach(g=>suggest.add(g));
  const suggestGroups=[...suggest].filter(g=>!protect.has(g)).slice(0,3);      // never nudge toward a muscle you're keeping light (#6)
  return {gaps,undertrained,undertrainedByVolume,imbalance,legsLow,suggestGroups};
}
// Best set per exercise BY MODALITY (a Smith and a dumbbell overhead press are separate PRs) by
// estimated 1RM. `showEst` is true only for compound lifts done with equipment whose 1RM estimate
// is meaningful (barbell/smith/bodyweight) — cable/machine stacks show load instead of a bogus 1RM.
function personalRecords(sessions,bw,limit){
  const best={},set_aside={};
  // Ranking rule for a key, shared by the live best and the set-aside best so they can't drift apart
  const beats=(c,b,inverted,time)=>inverted?(!b||c.load<b.load):time?(!b||c.load>b.load||(c.load===b.load&&c.r>b.r)):(!b||c.est>b.est);
  real(sessions).forEach(s=>{s.exercises.forEach(e=>{const mode=modeOf(e);e.sets.forEach(st=>{
    if(!isWorking(st))return;const w=setLoad(e.id,st.w,bw),r=+st.r||0;if(!w||!r)return;
    const est=e1rm(w,r);const ex=EX[e.id];const key=e.id+':'+mode;
    const inverted=!!(ex&&INVERTED_LOAD&&INVERTED_LOAD.has(e.id));   // assist machine: the PR is the LEAST assist, and no 1RM estimate (#16)
    const time=!!(TIME_METRIC&&TIME_METRIC.has(e.id));   // time-held: "reps" are seconds → no 1RM; best = heaviest, then longest
    const cand={w:+st.w||0,load:w,r,est,date:s.date};
    // "Doesn't count as a record" (#PR-adjust): the user has disowned this rep, so it can never BE the
    // PR — but it is remembered here so the row can show what was set aside. The set itself is
    // untouched everywhere else: it still counts for volume, sets-per-muscle, rest and history.
    if(st.nc){if(beats(cand,set_aside[key],inverted,time))set_aside[key]=cand;return;}
    const showEst=!!ex&&ex.type==='compound'&&!inverted&&!time&&!!(MODES[mode]&&MODES[mode].e1rm);
    if(beats(cand,best[key],inverted,time))best[key]={id:e.id,mode,w:cand.w,load:w,r,est,name:ex?ex.name:e.name,date:s.date,compound:!!ex&&ex.type==='compound',showEst,inverted,time,bodyweight:mode==='bodyweight'};
  })})});
  // Attach the set-aside set only where it WOULD have been the PR — marking an ordinary set says nothing
  Object.keys(best).forEach(k=>{const a=set_aside[k],b=best[k];
    if(a&&beats(a,b,b.inverted,b.time))b.adjusted={w:a.w,r:a.r,date:a.date};});
  // e1RM-comparable lifts first (by e1RM); the rest after, by load
  return Object.values(best).sort((a,b)=>(b.showEst-a.showEst)||(a.showEst?b.est-a.est:b.load-a.load)).slice(0,limit||8);
}
// Volume per week for the last n weeks (oldest first), weeks starting Monday
function weeklyVolumes(sessions,now,bw,n){
  now=now||Date.now();n=n||8;
  const ws0=weekStart(now);   // Monday of the current week
  const done=completed(sessions);const cols=[];
  for(let i=n-1;i>=0;i--){const ws=ws0-i*7*DAY,we=ws+7*DAY;
    cols.push({start:ws,v:done.filter(s=>s.date>=ws&&s.date<we).reduce((a,s)=>a+sessionVolume(s,bw),0)});}
  return cols;
}
/* ── Recovery view: how the user deloads, kept STRICTLY separate from progression ──────────────
   A deload is the user's day at any load for any reason; nothing here feeds prescriptions, PRs or
   stall detection (those read real() sessions only). This is a read-only comparison so someone can
   SEE how often they recover and how their deload loads relate to their working loads. */
function deloadStats(sessions,now){
  now=now||Date.now();
  const done=completed(sessions).filter(s=>s.date<now).sort((a,b)=>b.date-a.date);
  const win=done.filter(s=>s.date>=now-28*DAY),dls=win.filter(s=>s.deload),reals=win.filter(s=>!s.deload);
  const allDl=done.filter(s=>s.deload);
  const gaps=[];for(let i=0;i+1<allDl.length;i++)gaps.push((allDl[i].date-allDl[i+1].date)/DAY);
  const ratios=[],onlyOnDeload=new Set();
  allDl.forEach(s=>s.exercises.forEach(e=>{
    const ex=EX[e.id];if(!ex)return;
    const dTop=Math.max(0,...e.sets.filter(isWorking).map(st=>+st.w||0));
    const rp=lastPerf(done,e.id,{mode:modeOf(e)});   // real only
    if(!rp){onlyOnDeload.add(e.id);return;}
    const rTop=Math.max(0,...rp.sets.map(st=>st.w));
    if(dTop>0&&rTop>0)ratios.push(dTop/rTop*100);   // in percent, so averaging doesn't lose a half-point to float error
  }));
  return {deloads:dls.length,reals:reals.length,total:win.length,
    lastDaysAgo:allDl.length?Math.round((now-allDl[0].date)/DAY):null,
    avgGapDays:gaps.length?Math.round(gaps.reduce((a,b)=>a+b,0)/gaps.length):null,
    loadPct:ratios.length?Math.round(ratios.reduce((a,b)=>a+b,0)/ratios.length):null,
    sharedLifts:ratios.length,
    onlyOnDeload:[...onlyOnDeload].map(id=>EX[id].name)};
}
/* ── Time analytics (T3): everything derived from the per-set `at` stamps and session start/end.
   Sessions with no stamps (logged before timing existed) contribute nothing and are simply skipped. */
const MAX_GAP_MIN=15;   // a single gap longer than this (a phone call, a chat) isn't credited as training time
const MIN_REST_S=20;    // nobody rests <20s between working sets — a gap under this is a batch-tick or a mis-log correction, not a rest, and is excluded from the rest medians
function median(arr){if(!arr.length)return null;const a=arr.slice().sort((x,y)=>x-y),m=a.length>>1;return a.length%2?a[m]:Math.round((a[m-1]+a[m])/2);}
// Minutes attributed to each muscle group: each stamped set owns the time since the previous stamped
// set (or the session start), each interval capped at MAX_GAP_MIN. Returns {group: minutes}.
function timeByGroup(s){
  const tl=setTimeline(s);if(!tl.length)return {};
  const cap=MAX_GAP_MIN*60000,out={};let prev=+s.date;
  tl.forEach(x=>{const dt=Math.min(Math.max(0,x.at-prev),cap);if(x.group)out[x.group]=(out[x.group]||0)+dt/60000;prev=x.at;});
  return out;
}
// Rest gaps (seconds) between consecutive stamped sets of the SAME exercise, split compound/isolation.
function restGaps(s){const all=[],comp=[],iso=[];
  (s.exercises||[]).forEach(e=>{const ex=EX[e.id];const t=e.sets.map(st=>+st.at).filter(a=>a>0).sort((a,b)=>a-b);
    for(let i=1;i<t.length;i++){const g=(t[i]-t[i-1])/1000;if(g<MIN_REST_S)continue;all.push(g);if(ex&&ex.type==='compound')comp.push(g);else if(ex)iso.push(g);}});
  return {all,comp,iso};}
// Median rest actually taken (seconds), overall and by lift type. null when too few stamped sets.
function restTaken(s){const g=restGaps(s);return {median:median(g.all),compound:median(g.comp),isolation:median(g.iso),n:g.all.length};}
// Working sets per 10 minutes; null when the workout isn't timed.
function sessionDensity(s){const d=sessionDuration(s);return (d&&d>0)?+(sessionSets(s)/d*10).toFixed(1):null;}
// Median rest (seconds) for ONE exercise across all its stamped history — for the exercise detail sheet.
function exerciseRest(sessions,id){const gaps=[];completed(sessions).forEach(s=>{const e=s.exercises.find(x=>x.id===id);if(!e)return;
  const t=e.sets.map(st=>+st.at).filter(a=>a>0).sort((a,b)=>a-b);for(let i=1;i<t.length;i++){const g=(t[i]-t[i-1])/1000;if(g>=MIN_REST_S)gaps.push(g);}});return median(gaps);}
// 28-day time picture for the Progress "Time" card: how long, how dense, how much rest, split by muscle.
function timeTrends(sessions,now){
  now=now||Date.now();
  const done=completed(sessions).filter(s=>s.date<now&&s.date>=now-28*DAY&&sessionDuration(s)!=null);
  if(!done.length)return {n:0};
  let totMin=0,totSets=0;const comp=[],iso=[],grp={};
  done.forEach(s=>{totMin+=sessionDuration(s);totSets+=sessionSets(s);
    const g=restGaps(s);comp.push(...g.comp);iso.push(...g.iso);
    const tg=timeByGroup(s);Object.keys(tg).forEach(k=>grp[k]=(grp[k]||0)+tg[k]);});
  return {n:done.length,avgDuration:Math.round(totMin/done.length),
    density:totMin>0?+(totSets/totMin*10).toFixed(1):null,
    restCompound:median(comp),restIsolation:median(iso),
    byGroup:Object.entries(grp).map(([g,m])=>[g,Math.round(m)]).sort((a,b)=>b[1]-a[1])};
}
function muscleSetCounts(sessions){
  const cnt={};completed(sessions).forEach(s=>s.exercises.forEach(e=>{const g=EX[e.id]?EX[e.id].group:'Other';cnt[g]=(cnt[g]||0)+e.sets.filter(isWorking).length;}));
  return Object.entries(cnt).sort((a,b)=>b[1]-a[1]);
}

// Cardio summary (Progress). Reads ONLY cardio sessions — a self-contained picture that never touches
// the lifting analysis. This-week count/minutes, a 4-week total, and a minutes-by-type breakdown.
function cardioStats(sessions,now){
  now=now||Date.now();const ws=weekStart(now),cut=now-28*DAY;
  const all=(sessions||[]).filter(s=>s.completed!==false&&s.kind==='cardio'&&s.date<now);
  if(!all.length)return {sessions:0};
  const wk=all.filter(s=>s.date>=ws),win=all.filter(s=>s.date>=cut);
  const mins=arr=>arr.reduce((a,s)=>a+(sessionDuration(s)||0),0);
  const byType={};win.forEach(s=>{const t=(s.cardio&&s.cardio.type)||'indoor';byType[t]=(byType[t]||0)+(sessionDuration(s)||0);});
  const last=all.slice().sort((a,b)=>b.date-a.date)[0];
  return {sessions:all.length,weekCount:wk.length,weekMin:mins(wk),winCount:win.length,winMin:mins(win),
    byType:Object.entries(byType).sort((a,b)=>b[1]-a[1]),lastType:last.cardio&&last.cardio.type,lastDate:last.date};
}
IL.analysis={analyze,progressionStat,gapPrio,patPrio,findings,findingKey,withStatus,renderFinding,buildTips,buildHints,personalRecords,weeklyVolumes,muscleSetCounts,deloadStats,timeByGroup,restTaken,sessionDensity,exerciseRest,timeTrends,cardioStats,MIN_COMPARATIVE_SESSIONS,MIN_COMPARATIVE_DAYS};
if(typeof module!=='undefined')module.exports=IL.analysis;
