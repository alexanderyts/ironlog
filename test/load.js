// Loads the engine modules into a fresh IL namespace for tests.
globalThis.IL={config:{BUILD:'test',VERSION:'0.0.0-test'}};
['data/exercises','engine/progression','engine/search','engine/builder','engine/analysis','engine/sync'].forEach(m=>require('../src/'+m+'.js'));
const IL=globalThis.IL;
const DAY=86400000;

// A fixed reference clock: Wednesday 9 Sep 2026, local noon. Tests that touch weeks/streaks/date
// windows MUST anchor to this rather than Date.now() — the streak logic flaked on Thursdays because
// the old tests ran against the live clock. session() dates relative to NOW unless given its own now.
const NOW=new Date(2026,8,9,12,0,0).getTime();

// Helpers to fabricate history. Newest-first ordering is the engine's contract; use history() to sort.
let n=0;
function session(daysAgo,exs,opts){
  opts=opts||{};n++;
  const date=(opts.now||NOW)-daysAgo*DAY;
  const s={id:'s'+n,schema:1,date,updatedAt:date,completed:true,
    exercises:exs.map(([id,sets,meta])=>{
      const inst={id,name:IL.data.EX[id]?IL.data.EX[id].name:id,sets:sets.map(x=>Object.assign({done:true},x))};
      if(meta&&meta.mode)inst.mode=meta.mode;
      return inst;
    })};
  if(opts.deload)s.deload=true;
  return s;
}
const set=(w,r,extra)=>Object.assign({w,r},extra||{});

// Sort sessions newest-first (the order every engine scan assumes).
const history=(...sessions)=>sessions.slice().sort((a,b)=>b.date-a.date);

// Build `weeks` weekly sessions, newest-first. `exs` is an array of [id, setsOrFn]; setsOrFn may be
// a function of the week index (0 = most recent) returning the sets array, so a progressing lift is
// easy to describe: weekly([['bench', w=>[set(185+5*w,6)]]], 4).
function weekly(exs,weeks,opts){
  opts=opts||{};const now=opts.now||NOW,every=opts.every||7,start=opts.start==null?3:opts.start;
  const out=[];
  for(let w=0;w<weeks;w++){
    const daysAgo=start+w*every;
    out.push(session(daysAgo,exs.map(([id,s])=>[id,typeof s==='function'?s(w):s]),{now,deload:opts.deload}));
  }
  return out; // already newest-first (w=0 is the smallest daysAgo)
}

module.exports={IL,session,set,history,weekly,NOW,DAY};
