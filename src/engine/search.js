// Fuzzy "type a description" exercise search.
var IL=globalThis.IL||(globalThis.IL={});
if(typeof require==='function'&&!IL.data)require('../data/exercises.js');
const {EXERCISES}=IL.data;

function norm(s){return String(s||'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();}
function subseq(a,b){let i=0;for(const c of b){if(c===a[i])i++;if(i===a.length)return true;}return i===a.length;}
function searchEx(q){
  q=norm(q); if(!q)return EXERCISES.slice();
  const terms=q.split(' ');
  return EXERCISES.map(e=>{
    const hay=norm(e.name+' '+e.group+' '+e.muscles.join(' ')+' '+e.equip+' '+(e.alias||''));
    let sc=0;
    if(norm(e.name)===q)sc+=100;
    if(hay.includes(q))sc+=40;
    terms.forEach(t=>{ if(!t)return;
      if(hay.includes(' '+t))sc+=12; else if(hay.includes(t))sc+=6; else if(subseq(t,norm(e.name)))sc+=2; });
    return{e,sc};
  }).filter(x=>x.sc>0).sort((a,b)=>b.sc-a.sc).map(x=>x.e);
}

IL.search={norm,subseq,searchEx};
if(typeof module!=='undefined')module.exports=IL.search;
