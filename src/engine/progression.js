// Pure helpers for sets, volume, personal history and progressive overload.
// No DOM, no app state: everything takes the sessions array it should look at.
var IL=globalThis.IL||(globalThis.IL={});
if(typeof require==='function'&&!IL.data)require('../data/exercises.js');
const {EX,BW_FACTOR,EQUIP_MODE,MODES}=IL.data;

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
function sessionVolume(s,bw){let v=0;s.exercises.forEach(e=>e.sets.forEach(st=>{if(isWorking(st))v+=setLoad(e.id,st.w,bw)*(+st.r||0);}));return v;}
function sessionSets(s){let n=0;s.exercises.forEach(e=>e.sets.forEach(st=>{if(isWorking(st))n++;}));return n;}
// What actually gets SAVED when a workout is finished: only sets the user checked done. A prefilled
// prescription (weight filled in, not ticked) must NOT be saved as performed — that was the bug that
// polluted history/PRs/volume. `t` is the transient "edited but not ticked" flag; stripped here.
// Pure: returns a new exercises array (drops exercises left with no done sets). The UI prompts about
// edited-but-unticked sets BEFORE calling this, marking them done if the user says so.
function finalizeSets(exercises){
  return (exercises||[]).map(e=>{
    const sets=e.sets.filter(st=>st.done===true).map(st=>{const o=Object.assign({},st);delete o.t;o.done=true;return o;});
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
const real=sessions=>(sessions||[]).filter(s=>s.completed!==false&&!s.deload);

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
    const e=s.exercises.find(x=>x.id===exId&&(!opts.mode||modeOf(x)===opts.mode)&&x.sets.some(isWorking));
    if(e)return{date:s.date,mode:modeOf(e),sets:e.sets.filter(isWorking).map(st=>({w:+st.w||0,r:+st.r||0}))};
  }
  return null;
}
// Every performance of an exercise (optionally one modality), oldest→newest, for a progress trend:
// the best working set of each real (non-deload) session, as estimated 1RM. opts: {mode, bw, limit}
function exerciseSeries(sessions,exId,opts){
  opts=opts||{};const bw=opts.bw||0,out=[];
  for(const s of real(sessions)){
    const e=s.exercises.find(x=>x.id===exId&&(!opts.mode||modeOf(x)===opts.mode));
    if(!e)continue;
    let best=0,w=0,r=0;
    e.sets.forEach(st=>{if(!isWorking(st))return;const est=e1rm(setLoad(exId,st.w,bw),+st.r||0);if(est>best){best=est;w=+st.w||0;r=+st.r||0;}});
    if(best>0)out.push({date:s.date,est:best,w,r});
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
    e.sets.forEach(st=>{if(!isWorking(st))return;const est=e1rm(setLoad(exId,st.w,bw),+st.r||0);if(est>best)best=est;});
  }
  return best;
}
// The modality used the last time this exercise was logged (for "remembering" the user's choice);
// null if it's never been logged or was logged in its default mode. Intentionally NOT real(): a
// deload still tells you which equipment you last reached for.
function lastModeFor(sessions,exId){
  for(const s of sessions||[]){
    if(s.completed===false)continue;
    const e=s.exercises.find(x=>x.id===exId);
    if(e)return e.mode||null;
  }
  return null;
}
function unitIncrement(unit){return unit==='kg'?2.5:5;}

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
function fmtPerf(sets,unit){
  unit=unit||'';if(!sets||!sets.length)return'';
  const p=setPattern(sets);
  if(p.pattern==='flat')return sets.length+'×'+sets.map(s=>s.r).join('/')+(p.top>0?' @ '+p.top+unit:' · bodyweight');
  return sets.map(s=>+s.w||0).join('→')+unit+' · '+sets.map(s=>s.r).join('/');
}

// What to load next time, from last time's working sets. Returns {sets:[{w,r}], bumped, pattern,
// anchor, short:(anchor reps missing), under:(any anchor set below the range)}
function nextSets(last,ex,unit){
  const lo=ex?ex.rr[0]:8,hi=ex?ex.rr[1]:12,inc=unitIncrement(unit||'lb');
  const p=setPattern(last);
  const anchorSets=p.anchor.map(i=>last[i]);
  const short=anchorSets.reduce((n,s)=>n+Math.max(0,hi-(+s.r||0)),0);
  const under=anchorSets.some(s=>(+s.r||0)<lo);
  const weighted=p.top>0;
  const ready=weighted&&short===0;
  if(!ready)return{sets:last.map(s=>({w:+s.w||0,r:+s.r||0})),bumped:false,pattern:p.pattern,anchor:p.anchor,short,under,weighted};
  const newTop=p.top+inc;
  const sets=last.map((s,i)=>{
    const w=+s.w||0;
    if(p.anchor.includes(i))return{w:newTop,r:lo};
    const shifted=Math.min(newTop,Math.max(w,roundTo(w*newTop/p.top,inc)));
    return{w:shifted,r:+s.r||0};
  });
  return{sets,bumped:true,pattern:p.pattern,anchor:p.anchor,short:0,under:false,weighted,newTop};
}

/* Deload prescription: intentionally lighter loads for a recovery session (see the research note in
   ui.js openDeload). ~60% of last real working weight, rounded to the plate grid, reps at the top of
   the range — light enough to move well shy of failure with a focus on full range and the stretch.
   Bodyweight moves stay bodyweight (just do easy, controlled reps). Because lastPerf skips deloads,
   this pulls from the last REAL session, and the deload itself never becomes a progression anchor. */
function deloadSets(last,ex,unit){
  const hi=ex?ex.rr[1]:12,inc=unitIncrement(unit||'lb');
  return last.map(s=>{const w=+s.w||0;const dw=w>0?Math.max(inc,Math.round(w*0.6/inc)*inc):0;return{w:dw,r:hi};});
}
// Progressive-overload suggestion for an exercise. kind: 'new' | 'weight' | 'match' | 'reps'
// 'weight' means the prescription (`next`) already carries the bump; the text explains it.
function suggestion(sessions,exId,opts){
  opts=opts||{};const unit=opts.unit||'lb';
  const lp=lastPerf(sessions,exId,{beforeTs:opts.activeDate,excludeId:opts.activeId,mode:opts.mode});
  const ex=EX[exId];
  if(!lp||!lp.sets.length)return{lp:null,kind:'new',text:'First time logging this — set your baseline.',next:null};
  const n=nextSets(lp.sets,ex,unit),setsStr=fmtPerf(lp.sets,unit),inc=unitIncrement(unit);
  const ramp=n.pattern!=='flat';
  const topLbl=n.pattern==='descending'?'opener':'top set';
  if(n.bumped){
    const text=ramp?`${n.pattern==='descending'?'Opener':'Top set'} hit the range — ${topLbl} prefilled at ${n.newTop}${unit}, the rest shifted up`
                   :`Hit top reps last time — prefilled +${inc}${unit}`;
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
// Converts every stored weight in place; returns ids of sessions touched
function convertSessions(sessions,from,to,now){
  if(from===to)return [];const ids=[];
  sessions.forEach(s=>{s.exercises.forEach(e=>e.sets.forEach(st=>{st.w=convertWeight(st.w,from,to);}));s.updatedAt=now||Date.now();ids.push(s.id);});
  return ids;
}
// Consecutive weeks with at least one workout (current week may be untrained yet)
function calcStreak(sessions,now){
  now=now||Date.now();const done=sessions.filter(s=>s.completed!==false&&s.exercises.length);
  if(!done.length)return 0;
  const weeks=new Set(done.map(s=>Math.floor(startOfDay(s.date)/(7*DAY))));
  const cur=Math.floor(startOfDay(now)/(7*DAY));
  let wk=cur,n=0;while(weeks.has(wk)){n++;wk--;}
  if(n===0&&weeks.has(cur-1)){wk=cur-1;while(weeks.has(wk)){n++;wk--;}}
  return n;
}

IL.prog={DAY,startOfDay,e1rm,isWorking,setLoad,sessionVolume,sessionSets,finalizeSets,parseWeightInput,fmtVol,modeOf,real,lastPerf,lastModeFor,exerciseSeries,bestE1rmBefore,setPattern,fmtPerf,nextSets,deloadSets,suggestion,unitIncrement,convertWeight,convertSessions,calcStreak};
if(typeof module!=='undefined')module.exports=IL.prog;
