// Pure helpers for sets, volume, personal history and progressive overload.
// No DOM, no app state: everything takes the sessions array it should look at.
var IL=globalThis.IL||(globalThis.IL={});
if(typeof require==='function'&&!IL.data)require('../data/exercises.js');
const {EX,BW_FACTOR}=IL.data;

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
// Comma-format up to 99,999 (a lifter reads "12,480 lb" faster than "12.5k lb" — the ambiguous "k"
// only earns its keep once a number is genuinely too long to read at a glance).
function fmtVol(v){
  v=Math.round(v||0);
  if(v<100000)return v.toLocaleString('en-US');
  if(v<1000000)return Math.round(v/1000)+'k';
  return (v/1000000).toFixed(1)+'M';
}

// Most recent completed performance of an exercise. opts: {beforeTs, excludeId}
function lastPerf(sessions,exId,opts){
  opts=opts||{};
  for(const s of sessions){
    if(s.completed===false)continue;
    if(opts.beforeTs&&s.date>=opts.beforeTs)continue;
    if(opts.excludeId&&s.id===opts.excludeId)continue;
    const e=s.exercises.find(x=>x.id===exId&&x.sets.some(isWorking));
    if(e)return{date:s.date,sets:e.sets.filter(isWorking).map(st=>({w:+st.w||0,r:+st.r||0}))};
  }
  return null;
}
// Progressive-overload suggestion for an exercise. kind: 'new' | 'weight' | 'match'
function suggestion(sessions,exId,opts){
  opts=opts||{};const unit=opts.unit||'lb';
  const lp=lastPerf(sessions,exId,{beforeTs:opts.activeDate,excludeId:opts.activeId});
  const ex=EX[exId];const hi=ex?ex.rr[1]:12;
  if(!lp||!lp.sets.length)return{lp:null,kind:'new',text:'First time logging this — set your baseline.'};
  const allTop=lp.sets.every(s=>s.r>=hi);
  const setsStr=lp.sets.length+'×'+lp.sets.map(s=>s.r).join('/')+' @ '+Math.max(...lp.sets.map(s=>s.w))+unit;
  if(allTop)return{lp,kind:'weight',text:'Hit top reps last time',setsStr};
  return{lp,kind:'match',text:'Beat last time',setsStr};
}
function unitIncrement(unit){return unit==='kg'?2.5:5;}

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

IL.prog={DAY,startOfDay,e1rm,isWorking,setLoad,sessionVolume,sessionSets,fmtVol,lastPerf,suggestion,unitIncrement,convertWeight,convertSessions,calcStreak};
if(typeof module!=='undefined')module.exports=IL.prog;
