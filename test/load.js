// Loads the engine modules into a fresh IL namespace for tests.
globalThis.IL={config:{BUILD:'test',VERSION:'0.0.0-test'}};
['data/exercises','engine/progression','engine/search','engine/builder','engine/analysis','engine/sync'].forEach(m=>require('../src/'+m+'.js'));
const IL=globalThis.IL;

// Helpers to fabricate history
let n=0;
function session(daysAgo,exs,opts){
  opts=opts||{};n++;
  const date=(opts.now||Date.now())-daysAgo*86400000;
  return {id:'s'+n,schema:1,date,updatedAt:date,completed:true,
    exercises:exs.map(([id,sets])=>({id,name:IL.data.EX[id]?IL.data.EX[id].name:id,sets:sets.map(s=>Object.assign({done:true},s))}))};
}
const set=(w,r,extra)=>Object.assign({w,r},extra||{});

module.exports={IL,session,set};
