#!/usr/bin/env node
// Builder audit — runs the REAL workout builder across every muscle-group choice × gym × session length
// × seed (empty history, fresh builds) and counts rule violations. It's the acceptance test for any
// builder change: run it before and after, and the numbers must go the right way.
//
//   node tools/builder-audit.js            ~100 seeds per combination (fast)
//   node tools/builder-audit.js --full     all 997 seeds the app can draw
//   node tools/builder-audit.js --json     machine-readable summary (used by the invariants test)
//
// Time model (for "too long"): 40 s per set (×2 when done one side at a time) + rest (120 s after a
// compound, 75 s after isolation), 90 s per station change, 4 min warm-up per main lift.
const {IL}=require('../test/load.js');
const {EX,GROUPS,PRESETS,TIME_METRIC}=IL.data,B=IL.builder,P=IL.prog;
const C='compound';
const args=process.argv.slice(2),FULL=args.includes('--full'),JSON_OUT=args.includes('--json');

const HARD_BW=new Set(['chest-dip','tricep-dip','nordic-curl','ab-wheel','sissy-squat','hanging-leg-raise','pull-up','chin-up']);
const SELECTIONS=[...GROUPS.map(g=>[g]),...PRESETS.map(p=>p.groups),
  ['Chest','Back'],['Quads','Hamstrings'],['Glutes','Hamstrings'],['Shoulders','Biceps','Triceps'],GROUPS.slice()];
const GYMS=[undefined,'full','machine','home'],LENGTHS=[undefined,'short','long'];
const TARGET={short:45,standard:60,long:75};
// sampled seeds step by 7 (not 10): multiples of 10 are all even, so a 2-way choice would never vary
const seeds=FULL?[...Array(997).keys()]:[...Array(100).keys()].map(i=>i*7);

const isComp=x=>x&&x.type===C&&!TIME_METRIC.has(x.id);
function minutes(exs){let s=0;exs.forEach(e=>{const x=EX[e.id];const comp=isComp(x);
  s+=e.sets.length*(40*P.sidesOf(e)+(comp?120:75))+90;if(comp&&x.tier===1)s+=240;});return s/60;}
function spinalUnits(ids){let u=0;ids.forEach(id=>{const x=EX[id];if(!x||x.type!==C||x.equip!=='Barbell')return;
  if((x.pat==='squat'||x.pat==='hinge')&&x.id!=='hip-thrust')u+=1;else if(x.pat==='hpull')u+=0.5;});return u;}
function gymOK(x,gym,mode){if(gym==='machine')return x.equip!=='Barbell'||mode==='smith';if(gym==='home')return x.equip==='Dumbbell'||x.equip==='Bodyweight';return true;}

const M={builds:0,gym:0,dup:0,spinal:0,isoBeforeComp:0,nearDup:0,pressPileup:0,overTime:0,hamWeak:0,calvesDouble:0,
  upperNoSide:0,machineBackNoRow:0,beginnerRisk:0,emptyGroup:0,carryFirst:0,exTotal:0,setTotal:0,minTotal:0,mins:[]};
const examples={};const ex1=(k,v)=>{if(!examples[k])examples[k]=v;};
const lineups={};

for(const groups of SELECTIONS)for(const gym of GYMS)for(const length of LENGTHS)for(const seed of seeds){
  const profile=(gym||length)?{gym,length}:undefined;
  const p=B.planWorkout(groups.slice(),[],seed,{fresh:true,profile});
  const ids=p.ids;
  const exs=ids.map(id=>B.seedExercise(id,[],{unit:'lb',gym}));
  if(B.fitSessionBudget)B.fitSessionBudget(exs,profile);
  const fin=exs.map(e=>e.id),xs=fin.map(id=>EX[id]);
  const tag=groups.join('+')+' · gym='+(gym||'none')+' · len='+(length||'std')+' · seed '+seed+': '+fin.join(', ');
  M.builds++;
  const k=groups.join('+')+'|'+gym+'|'+length;(lineups[k]=lineups[k]||new Set()).add(fin.join(','));
  if(exs.some((e,i)=>!gymOK(xs[i],gym,P.modeOf(e)))){M.gym++;ex1('gym',tag);}
  if(new Set(fin).size!==fin.length){M.dup++;ex1('dup',tag);}
  if(spinalUnits(fin)>2){M.spinal++;ex1('spinal',tag);}
  let seenIso=false,bad=false;xs.forEach(x=>{if(!isComp(x))seenIso=true;else if(seenIso)bad=true;});if(bad){M.isoBeforeComp++;ex1('isoBeforeComp',tag);}
  let nd=false;for(let i=0;i<xs.length;i++)for(let j=i+1;j<xs.length;j++){const a=xs[i],b=xs[j];
    if(a.group===b.group&&a.pat===b.pat&&a.pat!=='iso'&&a.reg===b.reg&&isComp(a)&&isComp(b))nd=true;}
  if(nd){M.nearDup++;ex1('nearDup',tag);}
  const bbPress=xs.filter(x=>x.equip==='Barbell'&&x.type===C&&(x.pat==='hpush'||x.pat==='vpush')).length;
  const cgWithBench=fin.includes('close-grip-bench')&&xs.some(x=>x.group==='Chest'&&x.equip==='Barbell'&&x.pat==='hpush');
  if(bbPress>=3||cgWithBench){M.pressPileup++;ex1('pressPileup',tag);}
  const mins=minutes(exs),tgt=TARGET[length||'standard'];M.mins.push(mins);M.minTotal+=mins;
  if(mins>tgt+5){M.overTime++;ex1('overTime',tag+' ('+Math.round(mins)+' min)');}
  if(groups.includes('Hamstrings')){const h=xs.filter(x=>x.group==='Hamstrings');
    if(!h.length||h.every(x=>/back-extension/.test(x.id))){M.hamWeak++;ex1('hamWeak',tag);}}
  if(groups.length>=3&&xs.filter(x=>x.group==='Calves').length>1){M.calvesDouble++;ex1('calvesDouble',tag);}
  // (not when so many groups are picked that shoulders can't fit — planWorkout reports those as skipped)
  if(groups.length<=7&&groups.includes('Shoulders')&&groups.includes('Chest')&&!xs.some(x=>x.group==='Shoulders'&&x.reg==='side')){M.upperNoSide++;ex1('upperNoSide',tag);}
  // (only when back got 2+ exercises — a one-slot back on a full-body day can't have both a pull and a row)
  if(gym==='machine'&&xs.filter(x=>x.group==='Back').length>=2&&!xs.some(x=>x.group==='Back'&&x.pat==='hpull')){M.machineBackNoRow++;ex1('machineBackNoRow',tag);}
  if(xs.some(x=>(x.equip==='Barbell'&&x.type===C)||HARD_BW.has(x.id))){M.beginnerRisk++;ex1('beginnerRisk',tag);}
  if(groups.length<=5&&groups.some(g=>!xs.some(x=>x.group===g))){M.emptyGroup++;ex1('emptyGroup',tag);}
  const ci=fin.indexOf('farmers-carry');if(ci>=0&&xs.slice(ci+1).some(x=>x.group==='Biceps')){M.carryFirst++;ex1('carryFirst',tag);}   // grip-heavy curls after the carry
  M.exTotal+=fin.length;M.setTotal+=exs.reduce((a,e)=>a+e.sets.length,0);
}
const pct=n=>(100*n/M.builds).toFixed(1)+'%';
const sorted=M.mins.slice().sort((a,b)=>a-b),p95=sorted[Math.floor(sorted.length*0.95)];
const variety=Object.values(lineups).reduce((a,s)=>a+s.size,0)/Object.keys(lineups).length;
const summary={builds:M.builds,
  gymViolation:M.gym,duplicate:M.dup,spinalOver2:M.spinal,isoBeforeCompound:M.isoBeforeComp,nearDuplicate:M.nearDup,
  pressPileup:M.pressPileup,overTime:M.overTime,hamstringsWeak:M.hamWeak,calvesDouble:M.calvesDouble,upperNoSideDelt:M.upperNoSide,
  machineBackNoRow:M.machineBackNoRow,beginnerRisk:M.beginnerRisk,emptyGroup:M.emptyGroup,carryBeforeArms:M.carryFirst,
  avgExercises:+(M.exTotal/M.builds).toFixed(2),avgSets:+(M.setTotal/M.builds).toFixed(1),avgMinutes:+(M.minTotal/M.builds).toFixed(1),
  p95Minutes:+p95.toFixed(1),avgDistinctLineups:+variety.toFixed(2)};
if(JSON_OUT){console.log(JSON.stringify({summary,examples}));process.exit(0);}
console.log('Builder audit — '+M.builds+' builds ('+(FULL?'all 997':'100')+' seeds × '+SELECTIONS.length+' selections × 4 gyms × 3 lengths), empty history\n');
const rows=[['Safety','gym violation (wrong equipment)',M.gym],['Safety','duplicate exercise',M.dup],['Safety','>2 units of spinal load',M.spinal],
  ['Safety','beginner-risk pick (barbell compound / hard bodyweight)',M.beginnerRisk],
  ['Programming','isolation before a compound',M.isoBeforeComp],['Programming','near-duplicate lifts',M.nearDup],['Programming','3 barbell presses / close-grip beside bench',M.pressPileup],
  ['Programming','hamstrings = back extension only',M.hamWeak],['Programming','2+ calf exercises (3+ groups)',M.calvesDouble],
  ['Programming','chest+shoulders, no side delts',M.upperNoSide],['Programming','machine gym back, no row',M.machineBackNoRow],
  ['Programming','a chosen group got nothing',M.emptyGroup],['Programming','farmer’s carry before arm work',M.carryFirst],
  ['Practical','over time target (+5 min)',M.overTime]];
rows.forEach(r=>console.log(r[0].padEnd(12)+r[1].padEnd(54)+String(r[2]).padStart(7)+'  '+pct(r[2]).padStart(6)));
console.log('\navg exercises '+summary.avgExercises+' · avg sets '+summary.avgSets+' · avg minutes '+summary.avgMinutes+' · p95 minutes '+summary.p95Minutes+' · distinct lineups per choice '+summary.avgDistinctLineups);
if(args.includes('--examples')){console.log('\nExamples:');Object.entries(examples).forEach(([k,v])=>console.log(' '+k+': '+v));}
