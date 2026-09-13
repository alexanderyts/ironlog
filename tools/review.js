#!/usr/bin/env node
// Data review: run a real Ironlog backup through the SAME engine the app uses and print what it sees.
//   node tools/review.js path/to/ironlog-backup.json
// Read-only. Nothing here changes the app or the data — it's a lens for reviewing trends, checking
// that the builder/coach would do the right thing next, and spotting suspicious records.
const fs=require('fs'),path=require('path');
globalThis.IL={config:{BUILD:'review',VERSION:'review'}};
['data/exercises','engine/progression','engine/search','engine/builder','engine/analysis','engine/sync'].forEach(m=>require(path.join(__dirname,'..','src',m+'.js')));
const IL=globalThis.IL,{EX,GROUPS,PRESETS}=IL.data,P=IL.prog,B=IL.builder,A=IL.analysis;

const file=process.argv[2],WHY=process.argv.includes('--why');
if(!file){console.error('usage: node tools/review.js <backup.json> [--why]   (--why prints the score breakdown behind each fresh-build pick)');process.exit(1);}
const d=IL.sync.parseImport(fs.readFileSync(file,'utf8'));
const unit=(d.settings&&d.settings.unit)||'lb',bw=(d.settings&&d.settings.bodyweight)||0;
const sessions=d.sessions.slice().sort((a,b)=>b.date-a.date);
const now=Date.now(),DAY=86400000;
const fmtD=ts=>new Date(ts).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
const strip=h=>String(h).replace(/<[^>]+>/g,'');
const line=(t)=>console.log(t);const H=(t)=>{line('');line('== '+t+' ==');};

H('SESSIONS ('+sessions.length+', unit '+unit+')');
sessions.forEach(s=>{
  const sets=P.sessionSets(s),vol=P.sessionVolume(s,bw);
  line(`${fmtD(s.date)}${s.deload?'  [DELOAD]':''}  ${s.exercises.length} ex · ${sets} sets · ${P.fmtVol(vol)} ${unit}`);
  s.exercises.forEach(e=>{
    const ex=EX[e.id];const ws=e.sets.filter(P.isWorking);
    const perf=ws.map(st=>`${st.w===''||st.w==null?'bw':st.w}×${st.r}`).join(' ');
    line(`    ${(ex?ex.name:e.id+' (unknown)').padEnd(30)} ${e.mode?'['+e.mode+'] ':''}${perf}${e.note?'   📝 '+e.note:''}`);
  });
});

H('RECOVERY (deloads vs real sessions — read-only, never feeds progression)');
const R=A.deloadStats(sessions,now);
line(`${R.deloads} of the last ${R.total} sessions were deloads · last deload ${R.lastDaysAgo==null?'never':R.lastDaysAgo+'d ago'} · avg gap between deloads ${R.avgGapDays==null?'-':R.avgGapDays+'d'}`);
line(`deload loads vs working loads on ${R.sharedLifts} shared lift(s): ${R.loadPct==null?'n/a':R.loadPct+'%'}`);
line(`exercises seen ONLY on deloads (${R.onlyOnDeload.length}): ${R.onlyOnDeload.join(', ')||'none'}`);

H('STREAK / WEEKS');
line(`Streak: ${P.calcStreak(sessions,now)} wk  ·  sessions in the last 7 days: ${sessions.filter(s=>s.completed!==false&&now-s.date<7*DAY).length}`);
const a=A.analyze(sessions,now);
line(`28-day window: ${a.sessions} sessions over ${a.daySpan} days · comparative coaching ${a.readyForComparative?'ON':'OFF (needs '+A.MIN_COMPARATIVE_SESSIONS+' sessions across '+A.MIN_COMPARATIVE_DAYS+'+ days)'}`);
line(`Sets/week by muscle: `+Object.entries(a.perWeek).map(([g,n])=>`${g} ${n.toFixed(1)}`).join(' · '));
line(`Push ${a.push} vs pull ${a.pull} · upper ${a.upperSets} vs lower ${a.lowerSets}`);

H('PER-EXERCISE PROGRESSION (what the app thinks is happening)');
const seen=new Set();
sessions.forEach(s=>s.exercises.forEach(e=>{if(seen.has(e.id)||!EX[e.id])return;seen.add(e.id);
  const ex=EX[e.id],mode=P.modeOf(e);
  const series=P.exerciseSeries(sessions,e.id,{mode,bw});
  const t=B.exerciseTenure(sessions,e.id);
  const stalled=B.isStalled(sessions,e.id,{mode,now});
  const sg=P.suggestion(sessions,e.id,{unit,mode});
  const trend=series.map(p=>`${p.w}×${p.r}(${p.est})`).join(' → ');
  line(`${ex.name} [${mode}]  tenure ${t.sessions} sess / ${t.weeks.toFixed(1)} wk  ${stalled?'STALLED':'ok'}`);
  line(`    e1RM trend: ${trend||'-'}`);
  line(`    next time:  ${sg.kind==='new'?'(no history)':sg.text+' → '+(sg.next||[]).map(x=>x.w+'×'+x.r).join(' ')}`);
}));

H("COACH'S NOTES (as the app would render them today)");
A.buildTips(a,sessions,now,bw).forEach(t=>line(`[${t.lv}] ${strip(t.x)}`));
const F=A.withStatus(sessions,now,bw);
line('raw findings: '+F.map(f=>f.type+(f.group?':'+f.group:'')+(f.reg?':'+f.reg:'')+'('+f.status+')').join(', '));

H('WHAT THE BUILDER WOULD DO NEXT');
const last=sessions.find(s=>s.completed!==false&&!s.deload);
const groupsOf=s=>[...new Set(s.exercises.map(e=>EX[e.id]&&EX[e.id].group).filter(Boolean))];
const targets=last?[groupsOf(last)]:[];
PRESETS.forEach(p=>targets.push(p.groups));
const hints=A.buildHints(sessions,now,bw);
line('hints: gaps '+hints.gaps.length+' · undertrained ['+hints.undertrained.join(',')+'] · imbalance '+(hints.imbalance||'none')+' · suggests '+hints.suggestGroups.join('/'));
targets.forEach((g,i)=>{
  const p=B.planWorkout(g,sessions,1,{now,hints});
  const label=i===0?'repeat of last session groups ('+g.join('+')+')':PRESETS[i-1].label;
  line(`${label.padEnd(44)} ${p.mode.toUpperCase()}${p.mode==='continue'?' session '+(p.streak+1):''}${p.rotation?'  SWAP '+p.rotation.from+'→'+p.rotation.to+(p.rotation.anchor?' (anchor)':''):''}${p.reactions.length?'  '+p.reactions.map(r=>r.type+':'+r.why).join('; '):''}`);
  line('    '+p.ids.map(id=>EX[id].name).join(' · '));
  if(WHY&&p.mode==='fresh'){const tr=[];B.buildRecommendation(g,sessions,1,hints,tr);
    tr.forEach(t=>line(`      ${EX[t.id].name.padEnd(30)} ${t.sc==null?'':'score '+t.sc+'  '}${t.why.join(', ')}`));}
});
if(!WHY)line('(add --why to see the score breakdown behind each fresh-build pick)');

H('SANITY FLAGS');
let flags=0;
sessions.forEach(s=>{
  s.exercises.forEach(e=>{
    const ex=EX[e.id];if(!ex){line(`! ${fmtD(s.date)} unknown exercise id "${e.id}"`);flags++;return;}
    const ws=e.sets.filter(P.isWorking);
    if(ws.length>=3&&ws.every(st=>st.w===ws[0].w&&st.r===ws[0].r)&&ex.equip!=='Bodyweight')
      line(`? ${fmtD(s.date)} ${ex.name}: ${ws.length} identical sets (${ws[0].w}×${ws[0].r}) — real, or an untouched prefill saved by the pre-v0.23 bug?`),flags++;
    ws.forEach(st=>{if(ex.equip!=='Bodyweight'&&!(+st.w)){line(`! ${fmtD(s.date)} ${ex.name}: a working set with no weight`);flags++;}
      if(+st.r>ex.rr[1]*2){line(`? ${fmtD(s.date)} ${ex.name}: ${st.r} reps is far above the ${ex.rr[0]}–${ex.rr[1]} target — right exercise?`);flags++;}});
  });
});
if(!flags)line('none');
line('');
