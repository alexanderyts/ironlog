// Pure helpers for sets, volume, personal history and progressive overload.
// No DOM, no app state: everything takes the sessions array it should look at.
var IL=globalThis.IL||(globalThis.IL={});
if(typeof require==='function'&&!IL.data)require('../data/exercises.js');
const {EX,BW_FACTOR,EQUIP_MODE,MODES,INVERTED_LOAD,TIME_METRIC}=IL.data;

// The modality a logged exercise instance was performed with: its explicit `mode`, else derived
// from the exercise's fixed equipment. Stable for any instance, so mode-less history (and every
// existing test) resolves to a single consistent mode per exercise id — i.e. no behavior change.
function modeOf(e){return (e&&e.mode)||EQUIP_MODE[EX[e&&e.id]&&EX[e.id].equip]||'barbell';}

const DAY=86400000;
function startOfDay(ts){const d=new Date(ts);d.setHours(0,0,0,0);return d.getTime();}
// Epley estimated one-rep max
function e1rm(w,r){return r<=1?w:Math.round(w*(1+r/30));}
// A set counts toward volume/PRs/history when it was performed and isn't a warm-up
function isWorking(st){return st.done!==false&&!st.warm;}
// Load moved in a set: entered weight plus a share of bodyweight on bodyweight moves
function setLoad(exId,w,bw){const f=BW_FACTOR[exId]||0;return (+w||0)+(bw&&f?Math.round(bw*f):0);}
function sessionVolume(s,bw){let v=0;s.exercises.forEach(e=>{
  if(TIME_METRIC&&TIME_METRIC.has(e.id))return;   // time-held lifts (planks, carries) count seconds, not weight×reps
  // Assisted machines: the logged number is the ASSISTANCE, so the resistance actually moved is
  // bodyweight − assist (mirrors a weighted bodyweight lift, which is bodyweight + added). Needs a
  // bodyweight; without one it's unknowable and contributes 0 rather than counting the machine's help.
  const inv=INVERTED_LOAD&&INVERTED_LOAD.has(e.id);
  e.sets.forEach(st=>{if(isWorking(st)){const load=inv?Math.max(0,(+bw||0)-(+st.w||0)):setLoad(e.id,st.w,bw);v+=load*(+st.r||0);}});
});return v;}
function sessionSets(s){let n=0;s.exercises.forEach(e=>e.sets.forEach(st=>{if(isWorking(st))n++;}));return n;}
// How long a finished workout took, in whole minutes. `date` is the start (set at newSession); a set
// gets `at` when checked; `endedAt` is stamped at Finish. Returns null when the session predates
// timing (no endedAt) or the stamps are nonsense — so time stats simply skip old sessions.
// A span over MAX_SESSION_MIN is not a workout, it's a forgotten Finish (the 50-hour session): treat
// it as unknown so it neither shows on the card nor skews the Time averages. One comparison here
// covers every reader — History, summary, density, trends — with no data migration.
const MAX_SESSION_MIN=8*60;
function sessionDuration(s){const a=+s.date,b=+s.endedAt;if(!(b>a&&isFinite(a)&&isFinite(b)))return null;const m=Math.round((b-a)/60000);return m>MAX_SESSION_MIN?null:m;}
// Checked sets with a timestamp, as {exId, group, at}, oldest first — the raw material for time-per-
// muscle and rest-taken analytics (T3). Sets with no stamp (old data, or unchecked) are omitted.
function setTimeline(s){const out=[];(s.exercises||[]).forEach(e=>{const g=EX[e.id]?EX[e.id].group:null;e.sets.forEach(st=>{if(isFinite(+st.at)&&+st.at>0)out.push({exId:e.id,group:g,at:+st.at});});});return out.sort((a,b)=>a.at-b.at);}
// Forgotten-Finish safeguards (T2). The app never ends a workout itself — it notices and asks.
const STALE_AFTER_MIN=75,      // no checked set for this long while a workout is open → "still training?"
      LONG_SESSION_MIN=150,     // an unusually long open session (belt-and-suspenders for the banner copy)
      STALE_CONFIRM_MIN=30,     // at Finish, if the last set was this long ago, offer to log THAT time
      END_PAD_MIN=3;            // …plus a few minutes for the set itself
function lastSetAt(s){let m=0;(s.exercises||[]).forEach(e=>e.sets.forEach(st=>{const a=+st.at;if(a>m)m=a;}));return m||null;}
// {lastSetAt, sinceLastSet, sinceStart} in whole minutes. Idle time is measured from the last checked
// set, or from the start if nothing has been checked yet.
function staleness(s,now){now=now||Date.now();const ls=lastSetAt(s),ref=ls||+s.date;
  return {lastSetAt:ls,sinceLastSet:Math.floor((now-ref)/60000),sinceStart:Math.floor((now-(+s.date))/60000)};}
// What actually gets SAVED when a workout is finished: only sets the user checked done. A prefilled
// prescription (weight filled in, not ticked) must NOT be saved as performed — that was the bug that
// polluted history/PRs/volume. `t` is the transient "edited but not ticked" flag; stripped here.
// Pure: returns a new exercises array (drops exercises left with no done sets). The UI prompts about
// edited-but-unticked sets BEFORE calling this, marking them done if the user says so.
function finalizeSets(exercises){
  return (exercises||[]).map(e=>{
    // only checked-off sets, and never a junk set with zero reps (it would prefill as 0×0 next time)
    // or a weighted lift ticked with no weight (it would save as 0-volume and skew "last time"). An
    // unknown id is treated as bodyweight so a custom move isn't wrongly dropped.
    // Object.assign copies `at` (the check timestamp) through; only `t` (the transient touched flag) is stripped.
    const ex=EX[e.id],allowBlank=!ex||ex.equip==='Bodyweight'||(TIME_METRIC&&TIME_METRIC.has(e.id));   // a time-held lift (plank/carry/hang) can be logged by seconds alone — load is optional
    const sets=e.sets.filter(st=>st.done===true&&(+st.r||0)>0&&(allowBlank||(+st.w||0)>0)).map(st=>{const o=Object.assign({},st);delete o.t;o.done=true;return o;});
    return Object.assign({},e,{sets});
  }).filter(e=>e.sets.length);
}
// Sanitize a weight input string: accept a comma as the decimal separator (European keyboards) and
// strip anything that isn't a digit or dot, so "12,5" reads as 12.5 rather than 125.
function parseWeightInput(str){return String(str==null?'':str).replace(',','.').replace(/[^0-9.]/g,'');}
// Comma-format up to 99,999 (a lifter reads "12,480 lb" faster than "12.5k lb" — the ambiguous "k"
// only earns its keep once a number is genuinely too long to read at a glance).
function fmtVol(v){
  v=Math.round(v||0);
  if(v<100000)return v.toLocaleString('en-US');
  if(v<1000000)return Math.round(v/1000)+'k';
  return (v/1000000).toFixed(1)+'M';
}

// The sessions that count toward PROGRESSION: completed, and not a deload (a deload is a recovery
// detour, invisible to overload). Order is preserved (callers rely on newest-first). This is the one
// predicate every progression/history scan shares — change it here, not in nine places.
const real=sessions=>(sessions||[]).filter(s=>s.completed!==false&&!s.deload&&s.kind!=='cardio');

// Most recent completed performance of an exercise. opts: {beforeTs, excludeId, mode}
// When `mode` is given, only instances performed with that modality match — so progression compares
// like-for-like (25 lb dumbbells never chase a 75 lb Smith). Omit mode to match regardless.
// (Keeps its own loop rather than real() so opts.includeDeload can reach a deload when asked.)
function lastPerf(sessions,exId,opts){
  opts=opts||{};
  for(const s of sessions){
    if(s.completed===false)continue;
    if(s.deload&&!opts.includeDeload)continue;   // a deload is a recovery detour, not a progression data point
    if(opts.beforeTs&&s.date>=opts.beforeTs)continue;
    if(opts.excludeId&&s.id===opts.excludeId)continue;
    // a checked set with zero reps (an old junk record) is not a performance — never carry it forward.
    // opts.clean also skips sets the user marked "doesn't count as a record" (st.nc): the weight WAS
    // moved (it still counts for volume and history), but the user has said it shouldn't set the bar,
    // so it must not seed the next workout or anchor the next suggestion. Because `some(perfSet)` uses
    // the same predicate, a session whose every working set is marked is skipped whole and the scan
    // falls through to the one before it — the fallback chain costs no extra code.
    const perfSet=st=>isWorking(st)&&(+st.r||0)>0&&!(opts.clean&&st.nc);
    const e=s.exercises.find(x=>x.id===exId&&(!opts.mode||modeOf(x)===opts.mode)&&x.sets.some(perfSet));
    if(e)return{date:s.date,mode:modeOf(e),sets:e.sets.filter(perfSet).map(st=>({w:+st.w||0,r:+st.r||0})),note:e.note||''};
  }
  return null;
}
// The comparable "score" of a set, where HIGHER IS ALWAYS BETTER regardless of lift type — so a trend
// line, a stall check, or "lifts trending up" can compare sessions without special-casing at each call
// site. Assist machines (INVERTED_LOAD): effective resistance = bodyweight − assist (needs bw; 0 until
// set). Time-held lifts (TIME_METRIC): seconds held. Everything else: estimated 1RM.
function setScore(exId,st,bw){
  const w=+st.w||0,r=+st.r||0;
  if(INVERTED_LOAD&&INVERTED_LOAD.has(exId))return Math.max(0,(+bw||0)-w);
  if(TIME_METRIC&&TIME_METRIC.has(exId))return r;
  return e1rm(setLoad(exId,w,bw),r);
}
function scoreMetric(exId){return (INVERTED_LOAD&&INVERTED_LOAD.has(exId))?'resist':(TIME_METRIC&&TIME_METRIC.has(exId))?'time':'e1rm';}
// Every performance of an exercise (optionally one modality), oldest→newest, for a progress trend. The
// y-value is setScore (e1RM for normal lifts, effective resistance for assist machines, seconds for
// holds), so the line always rises with real progress. opts: {mode, bw, limit}
function exerciseSeries(sessions,exId,opts){
  opts=opts||{};const bw=opts.bw||0,out=[],metric=scoreMetric(exId);
  for(const s of real(sessions)){
    const e=s.exercises.find(x=>x.id===exId&&(!opts.mode||modeOf(x)===opts.mode));
    if(!e)continue;
    // A set marked "doesn't count" (st.nc) must not define the trend line — otherwise a rep the user
    // has disowned reads as their level, and every honest session after it looks like a decline. But
    // the point is never DROPPED: if that session has no clean set at all it still plots, flagged, so
    // the history stays visible. `adj` tells the view to mark the point "PR adjusted".
    let best=-1,w=0,r=0,ncBest=-1,ncW=0,ncR=0;   // -1 so a legitimate score of 0 (e.g. assist == bodyweight) still plots
    e.sets.forEach(st=>{if(!isWorking(st))return;
      const r0=+st.r||0,load=setLoad(exId,st.w,bw);
      if(!r0||(!load&&metric!=='time'))return;   // same "real set" gate as personalRecords — junk (0-rep / no-load non-time) sets don't plot
      const sc=setScore(exId,st,bw);
      if(st.nc){if(sc>ncBest){ncBest=sc;ncW=+st.w||0;ncR=+st.r||0;}return;}
      if(sc>best){best=sc;w=+st.w||0;r=+st.r||0;}});
    if(best>=0)out.push({date:s.date,est:best,w,r,metric,adj:ncBest>best||undefined});
    else if(ncBest>=0)out.push({date:s.date,est:ncBest,w:ncW,r:ncR,metric,adj:true});
  }
  out.sort((a,b)=>a.date-b.date);
  return opts.limit?out.slice(-opts.limit):out;
}
// Best estimated 1RM for an exercise+mode across real sessions strictly before beforeTs (for live PR
// detection). opts: {mode, bw, beforeTs, excludeId}
function bestE1rmBefore(sessions,exId,opts){
  opts=opts||{};const bw=opts.bw||0;let best=0;
  for(const s of real(sessions)){
    if(opts.excludeId&&s.id===opts.excludeId)continue;
    if(opts.beforeTs&&s.date>=opts.beforeTs)continue;
    const e=s.exercises.find(x=>x.id===exId&&(!opts.mode||modeOf(x)===opts.mode));
    if(!e)continue;
    e.sets.forEach(st=>{if(st.nc||!isWorking(st))return;const est=e1rm(setLoad(exId,st.w,bw),+st.r||0);if(est>best)best=est;});   // a disowned set is not a bar the next PR has to clear
  }
  return best;
}
// The modality used the last time this exercise was logged (for "remembering" the user's choice);
// null if it's never been logged or was logged in its default mode. Intentionally NOT real(): a
// deload still tells you which equipment you last reached for.
function lastModeFor(sessions,exId){
  for(const s of sessions||[]){
    if(s.completed===false||s.deload)continue;   // mode follows the last REAL session; a deload done on other equipment must not switch the prescription's modality (#28)
    const e=s.exercises.find(x=>x.id===exId);
    if(e)return e.mode||null;
  }
  return null;
}
// The load step for one progression bump. A barbell adds 5 lb / 2.5 kg; a per-hand dumbbell or any
// isolation move adds HALF that (2.5 lb / 1 kg) — a flat 5 lb was a 20–33% jump on a lateral raise or
// a per-dumbbell press and overshot every time (#11). Pass `ex` to get the equipment-aware step.
function unitIncrement(unit,ex){
  if(ex&&(ex.equip==='Dumbbell'||ex.type==='isolation'))return unit==='kg'?1:2.5;
  return unit==='kg'?2.5:5;
}

/* ── Pattern-aware progressive overload ──────────────────────────────────────────────────────────
   Lifters don't only do straight sets. The three patterns that matter, and what they mean for the
   load decision:
     flat        135×8 135×8 135×8       every set is equally informative
     ascending   135×10 155×8 185×6      a ramp; the LAST (heaviest) set is the real test
     descending  225×5 205×8 205×8       top set + back-offs; the FIRST (heaviest) set is the test,
                                         the back-offs exist to accumulate volume, not to progress
   One rule covers all of them, plus anything irregular (a pyramid up-and-down = 'mixed'):
     ► the heaviest working set(s) are the ANCHOR, and only the anchor decides whether to add load.
   Which sets the anchor is falls out of where the max weight sits; the pattern label only changes
   how the non-anchor sets are carried forward and how we describe last time.

   Decision (double progression, the standard hypertrophy scheme): if every anchor set reached the
   top of the exercise's rep range, add one plate-increment to the anchor and drop its reps to the
   bottom of the range to climb again. Non-anchor sets are shifted PROPORTIONALLY (same ratio to the
   anchor as last time, rounded to the plate grid, never below last time, never above the anchor) so
   a ramp or a set of back-offs keeps its shape instead of being copied stale or bumped uniformly.
   If the anchor fell short, last time is carried forward verbatim as the target to beat, and the
   message says exactly how many anchor reps were missing. Below the bottom of the range → hold.
   Weightless (bodyweight) work can't take a plate increment → progress by reps instead. */

const sameW=(a,b)=>Math.abs((+a||0)-(+b||0))<1e-6;
function roundTo(w,grid){return Math.round(w/grid)*grid;}

// Classifies working sets. Returns {pattern, anchor:[indices], top:maxWeight}
function setPattern(sets){
  const w=sets.map(s=>+s.w||0);
  if(!w.length)return{pattern:'flat',anchor:[],top:0};
  const top=Math.max(...w);
  const anchor=w.map((x,i)=>sameW(x,top)?i:-1).filter(i=>i>=0);
  if(anchor.length===w.length)return{pattern:'flat',anchor,top};
  let up=true,down=true;
  for(let i=1;i<w.length;i++){if(w[i]<w[i-1]-1e-6)up=false;if(w[i]>w[i-1]+1e-6)down=false;}
  if(up&&anchor[0]===w.length-anchor.length)return{pattern:'ascending',anchor,top};
  if(down&&anchor[anchor.length-1]===anchor.length-1)return{pattern:'descending',anchor,top};
  return{pattern:'mixed',anchor,top};
}

// "3×8/8/8 @ 135lb" for flat work; "135→155→185lb · 10/8/6" when the weight changes across sets
function fmtPerf(sets,unit,rsuf){
  unit=unit||'';rsuf=rsuf||'';if(!sets||!sets.length)return'';   // rsuf='s' renders the rep field as seconds (time-held lifts)
  const p=setPattern(sets);
  if(p.pattern==='flat')return sets.length+'×'+sets.map(s=>s.r+rsuf).join('/')+(p.top>0?' @ '+p.top+unit:' · bodyweight');
  return sets.map(s=>+s.w||0).join('→')+unit+' · '+sets.map(s=>s.r+rsuf).join('/');
}

// What to load next time, from last time's working sets. Returns {sets:[{w,r}], bumped, pattern,
// anchor, short:(anchor reps missing), under:(any anchor set below the range)}
// Effective rep range for a fresh prescription, biased by the training goal (Profile P2). 'general'
// or no profile = the exercise's own range (today's behaviour). 'strength' pins the target to the
// low end so load is added as soon as that rep count is met (heavy, low-rep work). 'size' nudges the
// whole window up by two reps — more reps banked before loading — capped at 15 so it never runs away.
// One place owns the shift, so seedExercise and nextSets stay in agreement.
function repRange(ex,goal){
  const lo=ex?ex.rr[0]:8,hi=ex?ex.rr[1]:12,cap=Math.max(15,hi);   // the cap can't shrink a naturally high-rep move (plank 30–60, carry 20–40) — #17
  if(goal==='strength')return[lo,lo];
  if(goal==='size')return[Math.min(lo+2,cap),Math.min(hi+2,cap)];
  return[lo,hi];
}
function nextSets(last,ex,unit,rr){
  const lo=rr?rr[0]:(ex?ex.rr[0]:8),hi=rr?rr[1]:(ex?ex.rr[1]:12),baseInc=unitIncrement(unit||'lb',ex);
  const resetR=(hi-lo>=4)?lo+1:lo;   // on a wide range, resetting to the very bottom drops too many reps — start one above (#11)
  const inverted=!!(ex&&INVERTED_LOAD&&INVERTED_LOAD.has(ex.id)),inc=inverted?-baseInc:baseInc;   // assist machines: LESS weight is harder, so a bump REDUCES load (#16)
  const p=setPattern(last);
  const anchorSets=p.anchor.map(i=>last[i]);
  const short=anchorSets.reduce((n,s)=>n+Math.max(0,hi-(+s.r||0)),0);
  const under=anchorSets.some(s=>(+s.r||0)<lo);
  const weighted=p.top>0;
  const ready=weighted&&short===0;
  if(!ready)return{sets:last.map(s=>({w:+s.w||0,r:+s.r||0})),bumped:false,pattern:p.pattern,anchor:p.anchor,short,under,weighted};
  // Snap an off-grid top (a converted 102.1 kg) onto the plate half-grid BEFORE adding, so it lands
  // on 102.5→105 instead of drifting 104.6/107.1 forever (#29); a value already on the grid is unchanged.
  const half=baseInc/2,off=Math.abs(p.top/half-Math.round(p.top/half))>1e-6;
  let newTop=(off?roundTo(p.top,half):p.top)+inc;
  if(inverted)newTop=Math.max(0,newTop);
  const sets=last.map((s,i)=>{
    const w=+s.w||0;
    if(p.anchor.includes(i))return{w:newTop,r:resetR};
    const scaled=roundTo(w*newTop/p.top,baseInc);
    return{w:inverted?Math.max(0,scaled):Math.min(newTop,Math.max(w,scaled)),r:+s.r||0};
  });
  return{sets,bumped:true,pattern:p.pattern,anchor:p.anchor,short:0,under:false,weighted,newTop};
}

/* Deload prescription: intentionally lighter loads for a recovery session (see the research note in
   ui.js openDeload). ~60% of last real working weight, rounded to the plate grid, reps at the top of
   the range — light enough to move well shy of failure with a focus on full range and the stretch.
   Bodyweight moves stay bodyweight (just do easy, controlled reps). Because lastPerf skips deloads,
   this pulls from the last REAL session, and the deload itself never becomes a progression anchor. */
function deloadSets(last,ex,unit){
  const hi=ex?ex.rr[1]:12,inc=unitIncrement(unit||'lb',ex);
  // On an assist machine (#16) less weight is HARDER, so a deload must ADD assist, not cut it —
  // otherwise "recovery" prescribes a harder set than last time. ~40% MORE assist, on the grid.
  const inverted=!!(ex&&INVERTED_LOAD&&INVERTED_LOAD.has(ex.id));
  return last.map(s=>{const w=+s.w||0;
    const dw=w>0?(inverted?Math.round(w*1.4/inc)*inc:Math.max(inc,Math.round(w*0.6/inc)*inc)):w;
    return{w:dw,r:hi};});
}
// Progressive-overload suggestion for an exercise. kind: 'new' | 'weight' | 'match' | 'reps'
// 'weight' means the prescription (`next`) already carries the bump; the text explains it.
// Deloads NEVER feed progression — a deload is the user's day, at any load, for any reason (sore,
// injury, form work), and the app must not assume why. But the information isn't hidden: when no
// real session exists, the suggestion mentions the last deload for reference and leaves it at that.
function suggestion(sessions,exId,opts){
  opts=opts||{};const unit=opts.unit||'lb';
  const scope={beforeTs:opts.activeDate,excludeId:opts.activeId,mode:opts.mode,clean:true};   // never suggest off a set the user disowned
  const lp=lastPerf(sessions,exId,scope);
  const ex=EX[exId];
  if(!lp||!lp.sets.length){
    const dl=lastPerf(sessions,exId,Object.assign({},scope,{includeDeload:true}));
    if(dl)return{lp:null,kind:'new',text:'No full session yet — your last deload here was '+fmtPerf(dl.sets,unit)+'. Set your baseline.',next:null,deloadRef:dl};
    return{lp:null,kind:'new',text:'First time logging this — set your baseline.',next:null};
  }
  const setsStr=fmtPerf(lp.sets,unit),inc=unitIncrement(unit,ex);
  // push:'quiet' (Profile P2) — the user asked the app to just record, never suggest heavier. Mirror
  // last time as-is: no bump, neutral wording. The prescription still carries last time's numbers so
  // they aren't retyped; the coach simply stops nudging.
  if(opts.push==='quiet')return{lp,kind:'match',pattern:setPattern(lp.sets).pattern,text:'Recorded — last time was '+setsStr,setsStr,next:lp.sets.map(s=>({w:+s.w||0,r:+s.r||0}))};
  const n=nextSets(lp.sets,ex,unit,opts.rr);
  const ramp=n.pattern!=='flat';
  const topLbl=n.pattern==='descending'?'opener':'top set';
  const inverted=!!(ex&&INVERTED_LOAD&&INVERTED_LOAD.has(ex.id));   // assist machine: a bump means LESS assist
  if(n.bumped){
    // the REAL bump can differ from `inc` when the last top was off-grid (after a unit conversion) and
    // got snapped before adding — so report newTop − lastTop, not inc, or the label lies (#11/#29)
    const lastTop=Math.max(...lp.sets.map(s=>+s.w||0)),bump=+(n.newTop-lastTop).toFixed(2);
    const text=inverted?(n.newTop>0?`Hit top reps — prefilled ${+(lastTop-n.newTop).toFixed(2)}${unit} less assist`:'Hit top reps with no assist — try an unassisted rep next')
              :ramp?`${n.pattern==='descending'?'Opener':'Top set'} hit the range — ${topLbl} prefilled at ${n.newTop}${unit}, the rest shifted up`
                   :`Hit top reps last time — prefilled +${bump}${unit}`;
    return{lp,kind:'weight',pattern:n.pattern,text,setsStr,next:n.sets};
  }
  if(!n.weighted)return{lp,kind:n.short===0?'reps':'match',pattern:n.pattern,text:n.short===0?'Hit top reps — add a rep or some load':'Beat last time',setsStr,next:n.sets};
  if(n.under)return{lp,kind:'match',pattern:n.pattern,text:`Fell under the range on the ${ramp?topLbl:'work sets'} — stay at ${Math.max(...lp.sets.map(s=>s.w))}${unit} and own it`,setsStr,next:n.sets};
  const where=ramp?` on your ${topLbl}`:'';
  return{lp,kind:'match',pattern:n.pattern,text:`${n.short} more rep${n.short===1?'':'s'}${where} earns +${inc}${unit}`,setsStr,next:n.sets};
}

// lb <-> kg. kg keeps 0.1 resolution and lb 0.25, so any lb value on a quarter-pound grid
// survives lb → kg → lb exactly (kg-rounding error ≤ 0.05 kg ≈ 0.11 lb, under half a step).
function convertWeight(n,from,to){
  if(from===to||n===''||n==null)return n;const v=+n;if(!v)return v;
  const f=to==='kg'?0.45359237:2.2046226,res=to==='kg'?0.1:0.25;
  return +(Math.round(v*f/res)*res).toFixed(2);
}
// Converts every stored weight in place; returns ids of sessions touched. `stamp` bumps updatedAt —
// TRUE for the user's own unit toggle (their whole history genuinely changed, other devices should
// take it), but FALSE when converting an IMPORTED backup: re-stamping there would make an old backup
// look newer than your local edits and resurrect sessions you'd deleted (#20).
function convertSessions(sessions,from,to,now,stamp){
  if(from===to)return [];const ids=[];
  sessions.forEach(s=>{s.exercises.forEach(e=>e.sets.forEach(st=>{st.w=convertWeight(st.w,from,to);}));if(stamp)s.updatedAt=now||Date.now();ids.push(s.id);});
  return ids;
}
// Local calendar week, MONDAY start. weekStart(ts) = local-midnight timestamp of that week's Monday;
// weekIndex(ts) = a monotonic integer that increments each Monday. Both are computed from local
// calendar days, so a session Tue/Wed and one Thu of the SAME week share a week (the old
// floor(ts/7days) bucketed on a fixed epoch boundary that fell mid-week and split them), and neither
// drifts across a daylight-saving change.
function weekStart(ts){const d=new Date(ts),day=(d.getDay()+6)%7;return new Date(d.getFullYear(),d.getMonth(),d.getDate()-day).getTime();}
// Week index anchored to a FIXED Monday (the epoch's first Monday, local). Subtracting a Monday from a
// Monday keeps the ratio near a whole number, so round() can't flip on a DST week — the old
// weekStart(ts)/(7*DAY) sat near x.5 in +12/+13h zones (NZ) and stepped by 0 or 2 across a DST change (#30).
const WEEK_EPOCH=weekStart(4*DAY);
function weekIndex(ts){return Math.round((weekStart(ts)-WEEK_EPOCH)/(7*DAY));}
// Consecutive weeks with at least one workout. The current week may be untrained yet (doesn't break it),
// and ONE empty week between two trained weeks is tolerated — a single week off (travel, a rest week)
// shouldn't zero a streak; two empty weeks in a row do end it (#7).
function calcStreak(sessions,now){
  // streak counts any completed activity — a lifting session OR a cardio session (deliberate: cardio
  // is real training). Everything else strength-only via completed()/exercises.length keeps cardio out.
  now=now||Date.now();const done=sessions.filter(s=>s.completed!==false&&(s.exercises.length||s.kind==='cardio'));
  if(!done.length)return 0;
  const weeks=new Set(done.map(s=>weekIndex(s.date)));
  const cur=weekIndex(now);
  let wk=weeks.has(cur)?cur:cur-1;          // a not-yet-trained current week doesn't count against the streak
  if(!weeks.has(wk))return 0;
  let n=0,skipped=false;
  while(true){
    if(weeks.has(wk)){n++;wk--;skipped=false;}
    else if(!skipped&&weeks.has(wk-1)){skipped=true;wk--;}   // hop one empty week if the week before it was trained
    else break;
  }
  return n;
}

IL.prog={DAY,startOfDay,e1rm,isWorking,setLoad,sessionVolume,sessionSets,sessionDuration,MAX_SESSION_MIN,setTimeline,lastSetAt,staleness,STALE_AFTER_MIN,LONG_SESSION_MIN,STALE_CONFIRM_MIN,END_PAD_MIN,finalizeSets,parseWeightInput,fmtVol,modeOf,real,lastPerf,lastModeFor,exerciseSeries,setScore,scoreMetric,bestE1rmBefore,setPattern,fmtPerf,repRange,nextSets,deloadSets,suggestion,unitIncrement,convertWeight,convertSessions,calcStreak,weekIndex,weekStart};
if(typeof module!=='undefined')module.exports=IL.prog;
