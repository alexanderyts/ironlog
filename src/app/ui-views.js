// UI, part 3 of 4 — VIEWS & SHEETS: History, Library, Progress (coach/recovery cards), the exercise
// detail/notes/add sheets, Settings, and the iOS viewport code. (Shares scope — see ui-core.js.)
/* ---------------- HISTORY ---------------- */
function viewHistory(){
  const done=completedAny();   // History + calendar show lifts AND cardio
  return `<div class="section">
    <div class="view-title" style="margin:0 2px 14px;font-size:22px">History</div>
    <div class="card" style="padding:16px">${calendar(done)}</div>
    <div class="eyebrow" style="margin:22px 2px 12px">${selDay?fmtDate(selDay):'All sessions'}</div>
    <div id="sessList">${sessionList(done)}</div>
  </div>`;
}
function calendar(done){
  const y=Math.floor(calMonth/12),m=calMonth%12;
  const first=new Date(y,m,1),days=new Date(y,m+1,0).getDate(),pad=first.getDay();
  const daySet={};done.forEach(s=>{const d=startOfDay(s.date);daySet[d]=(daySet[d]||0)+1;});
  const today=startOfDay(Date.now());
  let cells='';for(let i=0;i<pad;i++)cells+=`<div class="cal-cell pad"></div>`;
  for(let d=1;d<=days;d++){const ts=new Date(y,m,d).getTime();
    cells+=`<div class="cal-cell ${daySet[ts]?'has':''} ${ts===today?'today':''} ${ts===selDay?'sel':''}" data-day="${ts}">${d}</div>`;}
  return `<div class="cal-head"><button class="icon-btn" data-mon="-1" aria-label="Previous month">‹</button><h3>${first.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</h3><button class="icon-btn" data-mon="1" aria-label="Next month">›</button></div>
    <div class="cal-grid">${['S','M','T','W','T','F','S'].map(d=>`<div class="cal-dow">${d}</div>`).join('')}${cells}</div>`;
}
function sessionList(done){
  let list=selDay?done.filter(s=>startOfDay(s.date)===selDay):done;
  if(!list.length)return `<div class="card" style="padding:24px;text-align:center"><span class="dim">${selDay?'No workout logged this day.':'No workouts yet. Your logged sessions will appear here.'}</span></div>`;
  // Render a page at a time — a year of history is 150+ cards, and building them all froze the tab (#13).
  const shown=selDay?list.length:Math.min(histShown,list.length);
  const cards=list.slice(0,shown).map(s=>sessCard(s)).join('');
  const more=shown<list.length?`<button class="btn ghost block" id="btnHistMore" style="margin-top:4px">Show ${Math.min(30,list.length-shown)} more · ${list.length-shown} older</button>`:'';
  return cards+more;
}
function sessCard(s){
  if(s.kind==='cardio'){const c=s.cardio||{},dur=P.sessionDuration(s);
    const bits=[cardioIntLabel(c.intensity)];if(dur!=null)bits.push((s.endEstimated?'≈':'')+fmtDur(dur));if(c.distance!=null)bits.push(c.distance+' '+(c.unit||distanceUnit()));
    return `<div class="card sess" data-sess="${s.id}">
      <div class="sess-top"><div class="sess-date" style="display:flex;align-items:center;gap:8px"><span style="color:var(--accent)">${CARDIO_ICON}</span>${relDay(s.date)}</div><span class="pill">Cardio</span></div>
      <div class="sess-meta"><span class="muted"><b>${cardioTypeLabel(c.type)}</b></span><span class="muted">${bits.join(' · ')}</span></div></div>`;}
  return `<div class="card sess" data-sess="${s.id}">
    <div class="sess-top"><div class="sess-date">${relDay(s.date)}${s.deload?' <span class="deload-badge">Deload</span>':''}</div><span class="pill accent">${s.exercises.length} exercise${s.exercises.length!==1?'s':''}</span></div>
    <div class="sess-meta"><span class="muted">Volume <b>${fmtVol(volOf(s))} ${U()}</b></span><span class="muted">Sets <b>${setsOf(s)}</b></span>${P.sessionDuration(s)!=null?`<span class="muted">${s.endEstimated?'≈':''}<b>${fmtDur(P.sessionDuration(s))}</b></span>`:''}</div>
    <div class="sess-ex">${s.exercises.slice(0,4).map(e=>{const best=e.sets.filter(P.isWorking);const top=best.length?Math.max(...best.map(x=>+x.w||0)):0;
      const tm=D.TIME_METRIC.has(e.id);   // seconds, not reps — and a bodyweight hold has no "· 0lb" to show
      return `<div><span>${esc(EX[e.id]?EX[e.id].name:e.name)}</span><span class="s">${best.length}×${best.length?best[0].r+(tm?'s':''):0}${top?' · '+top+U():''}</span></div>`;}).join('')}
      ${s.exercises.length>4?`<div class="dim" style="font-size:12px">+${s.exercises.length-4} more</div>`:''}</div>
    ${s.note?`<div class="sess-note" style="margin-top:9px;padding-top:9px;border-top:1px solid var(--line);font-size:12.5px;color:var(--ink-2);line-height:1.4">📝 ${esc(s.note)}</div>`:''}
  </div>`;
}

/* ---------------- LIBRARY ---------------- */
function viewLibrary(){
  let res=SR.searchEx(libQuery);
  if(libGroup!=='All')res=res.filter(e=>e.group===libGroup||e.muscles.includes(libGroup));
  return `<div class="section">
    <div class="view-title" style="margin:0 2px 14px;font-size:22px">Exercise Library</div>
    <div class="search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
      <input id="libSearch" placeholder="Describe or name an exercise…" value="${esc(libQuery)}"></div>
    <div class="chips hscroll" style="margin:13px 0 4px">
      ${['All',...GROUPS].map(g=>`<button class="chip ${libGroup===g?'on':''}" data-lg="${g}">${g}</button>`).join('')}</div>
    <div class="dim" style="font-size:12.5px;margin:8px 2px 10px">${res.length} exercise${res.length!==1?'s':''}</div>
    <div class="card list">${res.length?res.map(e=>libRow(e)).join(''):'<div style="padding:24px;text-align:center" class="dim">No match. Try a simpler word like “press” or “curl”.</div>'}</div>
  </div>`;
}
function libRow(e,attr){
  return `<div class="ex-row" ${attr||'data-open="'+e.id+'"'}>
    <div class="ex-ic">${exIcon(e.group)}</div>
    <div style="flex:1;min-width:0"><div class="ex-name">${esc(e.name)}</div><div class="ex-sub">${e.group} · ${e.equip} · ${e.type}</div></div>
    <div class="ex-add">＋</div></div>`;
}

/* ---------------- PROGRESS ---------------- */
// A "+N vs last week" line under a stat. Rule: only shown when last week had a real value to compare
// against (no "+3 vs 0" for someone's first week). A down week is muted, never alarming — an easy week
// isn't a failure. Rendered as its own line so it never disturbs the big number a test/reader reads.
function statDelta(cur,prev,fmtFn){
  if(!prev)return '';   // nothing meaningful to compare to yet
  const d=cur-prev;if(d===0)return `<div class="statdelta">— same as last week</div>`;
  const f=fmtFn?fmtFn(Math.abs(d)):Math.abs(d);
  return `<div class="statdelta ${d>0?'up':''}">${d>0?'+':'−'}${f} vs last week</div>`;
}
function viewProgress(){
  const done=completedSessions(),anyDone=completedAny(),now=Date.now();
  const ws=P.weekStart(now),lwStart=ws-7*DAY,elapsed=now-ws;   // this-week start (Mon), last-week start, and how far into the week we are
  // Compare against last week THROUGH THE SAME POINT, not the whole week — otherwise a Tuesday (a
  // partial week) always shows a big drop against a full one. This Mon–Tue vs last Mon–Tue is fair,
  // and by Sunday it's the full week either way.
  const inWk=arr=>arr.filter(s=>s.date>=ws),inLw=arr=>arr.filter(s=>s.date>=lwStart&&s.date<lwStart+elapsed);
  const mo=done.filter(s=>s.date>=now-30*DAY);   // strength last 30d — for the muscle breakdown only
  // Rule (stated once): COUNT tiles (sessions, streak) include cardio — showing up is showing up.
  // MAGNITUDE tiles (volume, sets) are strength only, because cardio has no load or working sets.
  const wkAny=inWk(anyDone).length,lwAny=inLw(anyDone).length;
  const wkStr=inWk(done),lwStr=inLw(done);
  const wkVol=wkStr.reduce((a,s)=>a+volOf(s),0),lwVol=lwStr.reduce((a,s)=>a+volOf(s),0);
  const wkSets=wkStr.reduce((a,s)=>a+setsOf(s),0),lwSets=lwStr.reduce((a,s)=>a+setsOf(s),0);
  return `<div class="section">
    <div class="view-title" style="margin:0 2px 14px;font-size:22px">Progress</div>
    <div class="statgrid">
      <div class="card stat"><div class="k">This week</div><div class="v mono">${wkAny}<small>session${wkAny!==1?'s':''}</small></div>${statDelta(wkAny,lwAny)}</div>
      <div class="card stat"><div class="k">${volLabel('Week volume')}</div><div class="v mono">${fmtVol(wkVol)}<small>${U()}</small></div>${statDelta(wkVol,lwVol,fmtVol)}</div>
      <div class="card stat"><div class="k">Sets this week</div><div class="v mono">${wkSets}<small>set${wkSets!==1?'s':''}</small></div>${statDelta(wkSets,lwSets)}</div>
      <div class="card stat"><div class="k">Current streak</div><div class="v mono">${P.calcStreak(anyDone,now)}<small>wk</small></div></div>
    </div>
    ${coachCard(done)}
    ${recoveryCard()}
    ${timeCard()}
    ${cardioCard()}
    <div class="eyebrow" style="margin:24px 2px 10px">Weekly volume · last 8 weeks</div>
    <div class="card" style="padding:14px 12px 10px">${volumeChart()}</div>
    <div class="eyebrow" style="margin:24px 2px 10px">Personal records</div>
    ${prTip()}
    <div class="card list" id="prCard">${prList()}</div>
    ${muscleBreakdown(mo)}
  </div>`;
}
function volumeChart(){
  const cols=memoStat('wv8',()=>A.weeklyVolumes(state.sessions,Date.now(),bw(),8));
  const max=Math.max(1,...cols.map(c=>c.v)),u=U();
  // The tallest bar is always labelled (gives the scale a number); any other non-empty bar reveals
  // its value on tap. Empty weeks aren't tappable. Screen readers get the value from aria-label.
  return `<div class="chart">${cols.map((c,i)=>{
    const now=i===cols.length-1,lb=now?'Now':new Date(c.start).toLocaleDateString(undefined,{month:'numeric',day:'numeric'}),
      val=fmtVol(c.v),peak=c.v>0&&c.v===max;
    return `<div class="bar-col${peak?' peak':''}"${c.v>0?` role="button" tabindex="0" data-barval aria-label="Week of ${now?'this week':lb}: ${val} ${u} volume"`:''}>`
      +`<div class="bar-val">${val}</div>`
      +`<div class="bar ${c.v===0?'z':''}" style="height:${c.v===0?3:Math.max(6,c.v/max*112)}px"></div>`
      +`<div class="bar-lb">${lb}</div></div>`;
  }).join('')}</div>`;
}
// A one-time nudge that a PR row opens something, and that a record can be set aside — otherwise the
// only way anyone meets "that rep wasn't clean" is by happening to set a PR in front of the finish
// screen. Same dismiss-once pattern as the coaching notes' "Got it"; rides the synced `seen` map.
function prTip(){
  if(seenFlag('prAdjustTip'))return '';
  if(!memoStat('prAll',()=>A.personalRecords(state.sessions,bw(),999)).length)return '';   // nothing to tap yet — don't tell a new user to tap a record
  return `<div class="card" style="padding:11px 14px;margin:0 0 9px;background:var(--surface-2);border:none;display:flex;gap:10px;align-items:center">
    <div class="dim" style="font-size:12.5px;line-height:1.45;flex:1">Tap a record for its trend — or set it aside if the form wasn’t there.</div>
    <button class="linkbtn dim" data-seentip="prAdjustTip" style="font-size:12px;padding:2px 4px;flex-shrink:0">Got it</button></div>`;
}
const CHEV_R='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;color:var(--ink-3)"><path d="M9 6l6 6-6 6"/></svg>';
function prList(){
  const arr=memoStat('prAll',()=>A.personalRecords(state.sessions,bw(),999)).slice(0,8);
  if(!arr.length)return`<div style="padding:22px;text-align:center" class="dim">Log a few sets and your PRs show up here.</div>`;
  const rsuf=p=>p.time?'s':'';   // time-held lifts show seconds, not reps
  const sideSuf=p=>p.sides===2?'/side':'';   // reps (or seconds) counted per side
  const setStr=p=>p.bodyweight?(p.w?'Bodyweight +'+p.w+U():'Bodyweight')+' × '+p.r+rsuf(p)+sideSuf(p):p.w+U()+(p.holds===2?'/ea':'')+' × '+p.r+rsuf(p)+sideSuf(p);
  // show the modality only when it isn't the exercise's native equipment (so a Smith/cable variant
  // is distinguishable from the default; ordinary PRs stay uncluttered)
  const pill=t=>` <span class="pill" style="font-size:10px;padding:1px 7px">${esc(t)}</span>`;
  // …and tag a lift done the non-default way round ("Each side" / "Both sides"), since it keeps its own record
  const modeTag=p=>{const ex=EX[p.id];const native=ex&&EQUIP_MODE[ex.equip];
    return (p.mode&&p.mode!==native?pill(MODES[p.mode].label):'')+(p.track&&p.track.indexOf('|')>=0?pill(p.sides===2?'Each side':'Both sides'):'');};
  return arr.map(p=>`<div class="ex-row" data-openex="${p.id}" style="cursor:pointer"><div style="flex:1;min-width:0"><div class="ex-name">${esc(p.name)}${modeTag(p)}</div>
    <div class="ex-sub">Best set ${setStr(p)}</div>${p.adjusted?`<div class="ex-sub" style="color:var(--warn)">PR adjusted · ${setStr({...p,w:p.adjusted.w,r:p.adjusted.r})} on ${fmtDate(p.adjusted.date)} set aside</div>`:''}</div>
    <div style="text-align:right">${p.showEst?`<div class="mono" style="font-weight:700;font-size:16px">${p.est}<span class="dim" style="font-size:11px"> ${U()} e1RM</span></div>`:`<div class="mono dim" style="font-weight:600;font-size:13px">${p.load}${U()}</div>`}</div>${CHEV_R}</div>`).join('');
}
function balBar(l,lv,r,rv){
  const total=lv+rv||1,lp=Math.round(lv/total*100);
  return `<div style="margin-bottom:13px"><div class="row-between" style="font-size:12.5px;margin-bottom:5px"><span style="font-weight:600">${l} <span class="mono dim">${lv}</span></span><span style="font-weight:600"><span class="mono dim">${rv}</span> ${r}</span></div>
    <div style="height:9px;border-radius:5px;overflow:hidden;display:flex;background:var(--surface-2)"><div style="width:${lp}%;background:var(--accent)"></div><div style="flex:1;background:var(--good)"></div></div></div>`;
}
// How much longer until Coach's Notes will show program-level verdicts (push/pull balance, legs
// undertrained, weekly-volume landmarks) — those need real history to mean anything, so a brand-new
// user sees encouragement here instead of a premature judgment. See analysis.js MIN_COMPARATIVE_*.
function buildupMessage(a){
  const remS=Math.max(0,A.MIN_COMPARATIVE_SESSIONS-a.sessions);
  if(remS>0)return `Log ${remS} more session${remS===1?'':'s'} and I'll start giving you balance and volume feedback.`;
  if(a.daySpan<A.MIN_COMPARATIVE_DAYS)return `A few more days of training and I'll start giving you balance and volume feedback.`;
  return `I'll start giving you balance and volume feedback soon.`;
}
function tipsCard(tips){
  const dot={warn:'var(--warn)',good:'var(--good)',info:'var(--ink-3)'};
  return `<div class="card" style="padding:4px 16px">${tips.map((t,i)=>`<div style="display:flex;gap:11px;padding:12px 0;${i?'border-top:1px solid var(--line)':''}"><span style="width:9px;height:9px;border-radius:50%;background:${dot[t.lv]};flex-shrink:0;margin-top:5px"></span><div style="font-size:13.5px;line-height:1.5">${t.x}${t.key?` <button class="linkbtn dim" data-mute="${esc(t.key)}" style="font-size:12px;padding:2px 4px" aria-label="Stop showing this note">Got it</button>`:''}</div></div>`).join('')}</div>`;
}
// Collapsible section (Coach's notes / Recovery / Time). Default open; the user's open/closed choice
// per panel rides the synced `seen` map as 'collapse:<key>' (absent = open), so it persists and syncs
// with no new sanitizer surface. `summary` shows a one-line gist while collapsed.
function panelOpen(k){return !seenFlag('collapse:'+k);}
function collapsible(key,title,summary,body,margin){
  const open=panelOpen(key);
  const chev=`<svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>`;
  return `<div class="eyebrow collapse-head${open?' open':''}" role="button" tabindex="0" aria-expanded="${open}" data-collapse="${esc(key)}" style="margin:${margin||'24px 2px 10px'}">
    <span>${title}</span>
    <span class="collapse-r">${open||!summary?'':`<span class="collapse-sum">${summary}</span>`}${chev}</span></div>
    ${open?body:''}`;
}
function coachCard(done){
  if(!done.length)return '';
  const a=memoStat('analyze',()=>A.analyze(state.sessions,Date.now()));
  const tips=A.buildTips(a,state.sessions,Date.now(),bw(),state.settings.profile,state.settings.seen);   // not memoized — depends on the mutable seen/profile settings, and is cheap given `a`
  const sum=tips.length?`${tips.length} note${tips.length!==1?'s':''}`:'all clear';
  if(!a.readyForComparative){
    // early on: encouragement + whatever per-muscle tips (region/pattern gaps, progression) are
    // already individually meaningful — no full balance analysis yet, so no "Effectiveness" bars
    const body=`<div class="card" style="padding:16px;margin-bottom:${tips.length?'12':'0'}px"><div class="dim" style="font-size:13.5px;line-height:1.5">${buildupMessage(a)}</div></div>
      ${tips.length?tipsCard(tips):''}`;
    return collapsible('coach',"Coach's notes",tips.length?sum:'warming up',body);
  }
  const body=tips.length?tipsCard(tips):`<div class="card" style="padding:20px;text-align:center"><div class="dim">Nothing to flag — your training looks well-rounded right now.</div></div>`;
  return `<div class="eyebrow" style="margin:24px 2px 10px">Effectiveness · last 4 weeks</div>
    <div class="card" style="padding:16px 16px 6px">${balBar('Push',Math.round(a.push),'Pull',Math.round(a.pull))}${balBar('Upper body',a.upperSets,'Lower body',a.lowerSets)}</div>
    ${collapsible('coach',"Coach's notes",sum,body,'18px 2px 10px')}`;
}
// Read-only view of HOW the user deloads. Deliberately makes no judgment and never touches
// progression — a deload is theirs, at any load, for any reason. See analysis.deloadStats.
function recoveryCard(){
  const d=memoStat('deload',()=>A.deloadStats(state.sessions,Date.now()));
  if(!d.deloads&&d.lastDaysAgo==null)return '';
  const rows=[];
  if(d.total)rows.push(`<b>${d.deloads} of your last ${d.total}</b> session${d.total!==1?'s':''} ${d.deloads===1?'was':'were'} a deload${d.lastDaysAgo!=null?` (most recent ${d.lastDaysAgo===0?'today':d.lastDaysAgo+' day'+(d.lastDaysAgo===1?'':'s')+' ago'})`:''}.`);
  if(d.avgGapDays!=null)rows.push(`You've been taking one about every <b>${d.avgGapDays} day${d.avgGapDays===1?'':'s'}</b>.`);
  if(d.loadPct!=null)rows.push(`On the ${d.sharedLifts} lift${d.sharedLifts!==1?'s':''} you also train hard, your deload loads run about <b>${d.loadPct}%</b> of your working loads.`);
  if(d.onlyOnDeload.length)rows.push(`${d.onlyOnDeload.length} exercise${d.onlyOnDeload.length!==1?'s have':' has'} only ever appeared on a deload (${esc(d.onlyOnDeload.slice(0,3).join(', '))}${d.onlyOnDeload.length>3?', …':''}) — the builder has no full-effort numbers for ${d.onlyOnDeload.length!==1?'them':'it'} yet.`);
  const sum=d.lastDaysAgo==null?`${d.deloads} logged`:d.lastDaysAgo===0?'last one today':`last one ${d.lastDaysAgo}d ago`;
  const body=`<div class="card" style="padding:14px 16px"><div style="font-size:13.5px;line-height:1.55">${rows.map(r=>`<div style="padding:4px 0">${r}</div>`).join('')}</div>
    <div class="dim" style="font-size:12px;margin-top:8px">Deloads never affect your progression, PRs or the builder — this is just so you can see your own pattern.</div></div>`;
  return collapsible('recovery','Recovery · how you deload',sum,body);
}
// Time card (T3): how long you train, how dense, how long you rest, and where the time goes — all
// from the per-set stamps. Shows nothing until at least one timed workout exists.
function timeCard(){
  const t=memoStat('time',()=>A.timeTrends(state.sessions,Date.now()));
  if(!t.n)return '';
  const rest=[];if(t.restCompound!=null)rest.push('compounds ~'+fmtSec(t.restCompound));if(t.restIsolation!=null)rest.push('isolation ~'+fmtSec(t.restIsolation));
  const maxG=Math.max(1,...t.byGroup.map(g=>g[1]));
  const body=`<div class="card" style="padding:15px 16px">
      <div class="row-between" style="font-size:13.5px;margin-bottom:${rest.length||t.byGroup.length?'12':'0'}px">
        <span class="muted">Avg workout <b class="mono">${fmtDur(t.avgDuration)}</b></span>
        <span class="muted">${t.density!=null?`<b class="mono">${t.density}</b> sets / 10 min`:''}</span></div>
      ${rest.length?`<div class="dim" style="font-size:12.5px;margin-bottom:${t.byGroup.length?'13':'0'}px">You rest about ${rest.join(' · ')} between sets. <span style="opacity:.75">Sets ticked seconds apart aren't counted as rest.</span></div>`:''}
      ${t.byGroup.length?`<div class="eyebrow" style="margin:2px 0 9px">Where your time goes</div>
        ${t.byGroup.map(([g,m])=>`<div style="margin-bottom:9px"><div class="row-between" style="margin-bottom:4px"><span style="font-weight:600;font-size:13px">${g}</span><span class="mono dim" style="font-size:12px">${fmtDur(m)}</span></div><div style="height:6px;background:var(--surface-2);border-radius:3px;overflow:hidden"><div style="height:100%;width:${Math.round(m/maxG*100)}%;background:var(--accent);border-radius:3px"></div></div></div>`).join('')}`:''}
    </div>`;
  return collapsible('time','Time · last 4 weeks',`avg ${fmtDur(t.avgDuration)}`,body);
}
// Cardio summary — its own section on Progress. Nothing here touches the lifting stats.
function cardioCard(){
  const c=memoStat('cardio',()=>A.cardioStats(state.sessions,Date.now()));
  if(!c.sessions)return '';
  const maxT=Math.max(1,...c.byType.map(t=>t[1]));
  const body=`<div class="card" style="padding:15px 16px">
      <div class="row-between" style="font-size:13.5px;margin-bottom:${c.byType.length?'12':'0'}px">
        <span class="muted">This week <b class="mono">${c.weekCount} session${c.weekCount!==1?'s':''}</b></span>
        <span class="muted">${c.weekMin?`<b class="mono">${fmtDur(c.weekMin)}</b>`:''}</span></div>
      ${c.byType.length?`<div class="eyebrow" style="margin:2px 0 9px">Minutes by type · last 4 weeks</div>
        ${c.byType.map(([t,m])=>`<div style="margin-bottom:9px"><div class="row-between" style="margin-bottom:4px"><span style="font-weight:600;font-size:13px">${cardioTypeLabel(t)}</span><span class="mono dim" style="font-size:12px">${fmtDur(m)}</span></div><div style="height:6px;background:var(--surface-2);border-radius:3px;overflow:hidden"><div style="height:100%;width:${Math.round(m/maxT*100)}%;background:var(--accent);border-radius:3px"></div></div></div>`).join('')}`:''}
    </div>`;
  return collapsible('cardio','Cardio · last 4 weeks',`${c.winCount} session${c.winCount!==1?'s':''} · ${fmtDur(c.winMin)}`,body);
}
function muscleBreakdown(mo){
  const arr=memoStat('msc',()=>A.muscleSetCounts(mo));if(!arr.length)return'';
  const max=Math.max(...arr.map(a=>a[1]));
  return `<div class="eyebrow" style="margin:24px 2px 10px">Sets by muscle · last 30 days</div>
    <div class="card" style="padding:15px 16px">${arr.map(([g,n])=>`<div style="margin-bottom:11px"><div class="row-between" style="margin-bottom:5px"><span style="font-weight:600;font-size:13.5px">${g}</span><span class="mono dim" style="font-size:12.5px">${n} sets</span></div><div style="height:7px;background:var(--surface-2);border-radius:4px;overflow:hidden"><div style="height:100%;width:${n/max*100}%;background:var(--accent);border-radius:4px"></div></div></div>`).join('')}</div>`;
}

/* ---------------- sheets ---------------- */
// Compact SVG line of a lift's best-set estimated 1RM over its recent sessions, with the delta.
function trendCard(id){
  const dmode=P.lastTrackFor(state.sessions,id);   // follow the version (equipment + side) done most recently
  const series=P.exerciseSeries(state.sessions,id,{mode:dmode,bw:bw(),limit:10});
  if(series.length<2)return '';   // need at least two sessions to show a trend
  const vals=series.map(p=>p.est),min=Math.min(...vals),max=Math.max(...vals),range=max-min||1;
  const W=280,H=46,pad=5;
  const pts=series.map((p,i)=>[pad+(W-2*pad)*(series.length===1?0:i/(series.length-1)),pad+(H-2*pad)*(1-(p.est-min)/range)]);
  const d=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
  const last=pts[pts.length-1],delta=Math.round(vals[vals.length-1]-vals[0]);
  // The y-value's meaning depends on the lift: estimated 1RM for normal lifts, effective resistance
  // (bodyweight − assist) for assist machines, seconds for time-held lifts — so the label and unit
  // adapt, never printing "60 lb e1RM" for a plank.
  // (from the one judge: 'reps' for rep-only bodyweight moves; 'assist' for an assist machine with no
  // bodyweight entered — its score is −assist, so it's shown as the assist, with "less" as progress)
  const metric=series[series.length-1].metric||'e1rm';
  const unit=metric==='time'?'s':metric==='reps'?' reps':U();
  const label=metric==='time'?'Progress · hold':metric==='resist'?'Progress · resistance':metric==='assist'?'Progress · less assist':metric==='reps'?'Progress · reps':'Progress · est. 1RM';
  // A dip caused by the user setting their own record aside is not a decline, and must not be painted
  // like one. When the latest point is adjusted, the delta goes neutral and says why — that is the
  // whole point of the flag: going lighter on purpose should never read as losing ground.
  const adjusted=!!series[series.length-1].adj, anyAdj=series.some(p=>p.adj);
  const col=adjusted?'var(--ink-3)':delta>0?'var(--good)':delta<0?'var(--warn)':'var(--ink-3)';
  const asst=metric==='assist';   // shown as the assist itself; progress = LESS of it
  const arrow=delta>0?(asst?'▲ '+delta+unit+' less':'▲ +'+delta+unit):delta<0?(asst?'▼ '+Math.abs(delta)+unit+' more':'▼ '+Math.abs(delta)+unit):'— flat';
  const shown=asst?Math.abs(vals[vals.length-1])+unit+' assist':vals[vals.length-1]+unit;
  return `<div class="card" style="padding:14px 15px;margin:0 0 12px">
    <div class="row-between" style="margin-bottom:9px"><span class="eyebrow">${label}</span>
      <span class="mono" style="font-weight:700;color:${col}">${shown} <span style="font-size:12px">${arrow}</span></span></div>
    <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="none" style="display:block;overflow:visible">
      <path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
      <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3.5" fill="${adjusted?'var(--ink-3)':'var(--accent)'}"/></svg>
    <div class="dim" style="font-size:11.5px;margin-top:7px">Best set each session · last ${series.length}${anyAdj?' · <span style="color:var(--warn)">PR adjusted</span> — a set you set aside isn’t counted here':''}</div></div>`;
}
/* Your best set on this lift, with the one-tap escape hatch for a rep you don't want to be held to.
   Marking DELETES NOTHING: the set stays in History and keeps counting toward your volume — it just
   stops being the bar, both here and in what the app prefills next time (see lastPerf's `clean`).
   "That rep wasn't clean" sets aside the record shown here (that record's exact set); "Count it again"
   restores it. Both operate a set at a time; a lift trained in two modalities can be adjusted in each. */
const markedSets=id=>{let n=0;state.sessions.forEach(s=>s.exercises.forEach(e=>{if(e.id===id)e.sets.forEach(st=>{if(st.nc)n++;});}));return n;};
// The record a lift's adjust controls act on: the version (equipment + "each side") done most recently —
// the same one the trend chart follows. A lift with two versions (one-arm vs two-hand) has two records.
function prFor(id){const all=A.personalRecords(state.sessions,bw(),999).filter(x=>x.id===id),t=P.lastTrackFor(state.sessions,id);
  return all.find(x=>x.track===t)||all[0];}
function prAdjustCard(id){
  const p=prFor(id);
  const marked=markedSets(id);
  if(!p&&!marked)return '';
  // Format a w×r the same way the record itself reads: seconds for time-held lifts, "Bodyweight" moves,
  // per-hand dumbbells — so a set-aside plank shows "45s", not "0lb × 45".
  const fmt=p?((w,r)=>p.bodyweight?(w?'Bodyweight +'+w+U():'Bodyweight')+' × '+r+(p.time?'s':''):w+U()+(p.holds===2?'/ea':'')+' × '+r+(p.time?'s':'')+(p.sides===2?'/side':'')):null;
  return `<div class="card" style="padding:12px 15px;margin:0 0 12px">
    <div class="row-between"><span class="eyebrow">Your best set</span>
      <span class="mono" style="font-weight:600">${p?esc(fmt(p.w,p.r)):'—'}</span></div>
    ${p&&p.adjusted?`<div class="dim" style="font-size:12px;margin-top:7px;line-height:1.45"><b style="color:var(--warn)">PR adjusted.</b> ${esc(fmt(p.adjusted.w,p.adjusted.r))} on ${fmtDate(p.adjusted.date)} is set aside — still in your history and still counted in your volume.</div>`:''}
    <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
      ${p?`<button class="btn sm ghost" data-prmark="${id}">That rep wasn’t clean</button>`:''}
      ${marked?`<button class="btn sm ghost" data-prunmark="${id}">Count it again</button>`:''}
    </div></div>`;
}
// The last few notes ever left on this lift (deloads included — a note is a note), newest first.
function notesCard(id){
  const notes=[];
  state.sessions.forEach(s=>{if(s.completed===false)return;s.exercises.forEach(e=>{if(e.id===id&&e.note)notes.push({date:s.date,note:e.note,deload:!!s.deload});});});
  if(!notes.length)return '';
  notes.sort((a,b)=>b.date-a.date);
  return `<div class="card" style="padding:12px 15px;margin:0 0 12px"><div class="eyebrow" style="margin-bottom:8px">Your notes</div>
    ${notes.slice(0,4).map(n=>`<div style="font-size:13.5px;line-height:1.45;padding:5px 0;border-top:1px solid var(--line)"><span class="dim mono" style="font-size:11.5px">${fmtDate(n.date)}${n.deload?' · deload':''}</span><br>${esc(n.note)}</div>`).join('')}
    ${notes.length>4?`<div class="dim" style="font-size:12px;margin-top:6px">+${notes.length-4} older</div>`:''}</div>`;
}
function exerciseDetail(id){
  const e=EX[id];const lp=P.lastPerf(state.sessions,id,{excludeId:state.active&&state.active.id});
  const target=cur();const inWorkout=target&&target.exercises.some(x=>x.id===id);
  const rest=A.exerciseRest(state.sessions,id);   // T3: median rest you actually take here
  return `<div style="display:flex;gap:13px;align-items:center;margin-bottom:16px">
      <div class="ex-ic" style="width:52px;height:52px">${exIcon(e.group)}</div>
      <div><div class="mono dim" style="font-size:12px">${e.equip} · ${e.type}${e.tier===1?' · foundational lift':''}</div>
      <div class="chips" style="margin-top:6px">${e.muscles.map(m=>`<span class="pill">${m}</span>`).join('')}</div></div></div>
    <p class="instr">${esc(e.instr)}</p>
    ${trendCard(id)}
    ${prAdjustCard(id)}
    ${notesCard(id)}
    <div class="card" style="padding:12px 15px;margin:16px 0">
      <div class="row-between"><span class="eyebrow">Target rep range</span><span class="mono" style="font-weight:600">${e.rr[0]}–${e.rr[1]}</span></div>
      ${lp?`<div class="row-between" style="margin-top:10px;padding-top:10px;border-top:1px solid var(--line)"><span class="eyebrow">Last time</span><span class="mono" style="font-weight:600">${esc(P.fmtPerf(lp.sets,U(),D.TIME_METRIC.has(id)?'s':''))}</span></div>`:''}
      ${rest!=null?`<div class="row-between" style="margin-top:10px;padding-top:10px;border-top:1px solid var(--line)"><span class="eyebrow">Rest you usually take</span><span class="mono" style="font-weight:600">~${fmtSec(rest)}</span></div>`:''}
    </div>
    <a class="btn ghost block" href="${demoURL(id)}" target="_blank" rel="noopener noreferrer" style="margin-bottom:10px;text-decoration:none">▶ Watch a demo video</a>
    <button class="btn primary block" data-addto="${id}">${inWorkout?'✓ Already in this workout':'＋ Add to '+(todayScreen==='edit'?'this session':'today’s workout')}</button>`;
}
function openAddExercise(){
  const target=cur();
  const sugg=target&&target.exercises.length?B.complementSuggestions(target.exercises.map(e=>e.id),3):[];
  const suggHTML=sugg.length?`<div class="eyebrow" style="margin:0 2px 8px;display:flex;align-items:center;gap:6px"><span style="color:var(--accent)">✦</span> Smart picks to complement your workout</div>
    <div class="card list" id="addSuggest" style="margin-bottom:16px">${sugg.map(s=>`<div class="ex-row" data-quickadd="${s.id}"><div class="ex-ic">${exIcon(EX[s.id].group)}</div><div style="flex:1;min-width:0"><div class="ex-name">${esc(EX[s.id].name)}</div><div class="ex-sub" style="color:var(--accent)">${esc(s.why)}</div></div><div class="ex-add">＋</div></div>`).join('')}</div>`:'';
  openSheet('Add exercise',`${suggHTML}<div class="search" style="margin-bottom:12px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
    <input id="addSearch" placeholder="Search or describe an exercise…"></div>
    <div class="chips hscroll" id="addGroups" style="margin-bottom:12px">${['All',...GROUPS].map(g=>`<button class="chip ${g==='All'?'on':''}" data-ag="${g}">${g}</button>`).join('')}</div>
    <div class="card list" id="addResults">${SR.searchEx('').map(e=>libRow(e,'data-quickadd="'+e.id+'"')).join('')}</div>`);
  const pick=ev=>{const b=ev.target.closest('[data-quickadd]');if(!b)return;addExerciseToCur(b.dataset.quickadd);closeSheet();};
  const sg=$('#addSuggest');if(sg)sg.addEventListener('click',pick);
  $('#addResults').addEventListener('click',pick);
  const inp=$('#addSearch');let ag='All';
  const refresh=()=>{let r=SR.searchEx(inp.value);if(ag!=='All')r=r.filter(e=>e.group===ag||e.muscles.includes(ag));
    $('#addResults').innerHTML=r.length?r.map(e=>libRow(e,'data-quickadd="'+e.id+'"')).join(''):'<div style="padding:20px;text-align:center" class="dim">No match.</div>';};
  inp.addEventListener('input',refresh);
  $('#addGroups').addEventListener('click',ev=>{const b=ev.target.closest('[data-ag]');if(!b)return;ag=b.dataset.ag;$('#addGroups').querySelectorAll('.chip').forEach(c=>c.classList.toggle('on',c===b));refresh();});
}
function openNameSheet(title,defaultName,cb){
  openSheet(title,`<input class="field" id="nameInput" placeholder="e.g. Push day" value="${esc(defaultName)}" maxlength="40">
    <div style="height:12px"></div><button class="btn primary block" id="nameOk">Save</button>`);
  const inp=$('#nameInput');setTimeout(()=>inp.focus(),300);
  const go=()=>{const n=inp.value.trim();if(!n){toast('Give it a name');return;}closeSheet();cb(n);};
  $('#nameOk').addEventListener('click',go);inp.addEventListener('keydown',e=>{if(e.key==='Enter')go();});
}
function openNumberSheet(title,value,cb){
  openSheet(title,`<input class="field mono" id="numInput" inputmode="decimal" placeholder="0" value="${esc(value)}" style="font-size:22px;text-align:center">
    <div style="height:12px"></div><button class="btn primary block" id="numOk">Save</button>`);
  const inp=$('#numInput');setTimeout(()=>{inp.focus();inp.select();},300);
  const go=()=>{const v=parseFloat(inp.value);if(isNaN(v)){toast('Enter a number');return;}closeSheet();cb(v);};
  $('#numOk').addEventListener('click',go);inp.addEventListener('keydown',e=>{if(e.key==='Enter')go();});
}
function saveAsRoutine(s){
  const ids=s.exercises.map(e=>e.id);if(!ids.length)return;
  const guess=[...new Set(ids.map(id=>EX[id]&&EX[id].group).filter(Boolean))].slice(0,2).join(' & ')||'My routine';
  openNameSheet('Save routine',guess,name=>{S.saveRoutine({name,exIds:ids});toast('Routine saved');});
}
// (fmtSec lives in ui-core — it rounds first; a duplicate here without rounding was overriding it and
//  printing medians like "2:40.813813". Removed so every rest time reads as clean m:ss.)
function cloudSection(){
  const n=state.cloudName;const last=state.lastSync?new Date(state.lastSync).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'';
  if(CFG.DEMO)return `<div class="card" style="padding:13px 15px;background:var(--surface-2);border:none"><div class="cloud" style="font-size:13px"><span class="dot"></span>This is a demo with sample data. Anything you change stays in this browser only.</div>
      <button class="btn sm ghost" id="btnResetDemo" style="margin-top:10px">Reset sample data</button></div>`;
  if(n==='artifact')return `<div class="card" style="padding:13px 15px;background:var(--surface-2);border:none"><div class="cloud synced" style="font-size:13px"><span class="dot"></span>Backed up to your Claude account — safe if you lose this phone.</div></div>`;
  if(CFG.BUILD==='site'){
    if(!DBX.isConfigured())return `<div class="card" style="padding:13px 15px;background:var(--surface-2);border:none"><div class="cloud local" style="font-size:13px"><span class="dot"></span>Cloud backup is off. Add your Dropbox app key in <b>config.json</b> and rebuild (see README).</div></div>`;
    if(n==='dropbox')return `<div class="card" style="padding:13px 15px;background:var(--surface-2);border:none"><div class="cloud ${state.cloudError?'err':'synced'}" style="font-size:13px"><span class="dot"></span>${state.cloudError?'Dropbox: '+esc(state.cloudError):'Synced with Dropbox'+(last?' · '+last:'')}</div>
      <div style="display:flex;gap:8px;margin-top:10px"><button class="btn sm ghost" id="btnSyncNow">Sync now</button><button class="btn sm ghost" id="btnDbxOff">Disconnect</button></div></div>`;
    return `<button class="btn primary block" id="btnDbxOn" style="margin-bottom:8px">Connect Dropbox for cloud backup</button><div class="dim" style="font-size:12.5px;text-align:center">Saves your history to a file in your Dropbox and keeps every device in sync.</div>`;
  }
  return `<div class="card" style="padding:13px 15px;background:var(--surface-2);border:none"><div class="cloud local" style="font-size:13px"><span class="dot"></span>Saved on this phone. Open the app signed in on your account to enable cloud backup.</div></div>`;
}
/* Layout diagnostics shown under the version in Settings. Reads the real safe-area insets by
   measuring a probe element (the only reliable way — computed --safe-b just echoes "env(...)").
   If a viewport problem is ever reported again, these numbers say which state iOS is in:
   inset state = insets 0 and inner < screen height; full-bleed = insets real and inner = screen. */
function viewportDiag(){
  try{
    const probe=document.createElement('div');
    // padding for both, not height: with the global border-box sizing, height would be clamped up
    // to the padding and read the top inset twice (that's what v0.8.6's "bottom 62" was)
    probe.style.cssText='position:fixed;left:-9999px;top:0;visibility:hidden;pointer-events:none;width:1px;height:0;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)';
    document.body.appendChild(probe);
    const cs=getComputedStyle(probe);
    const b=Math.round(parseFloat(cs.paddingBottom)||0), t=Math.round(parseFloat(cs.paddingTop)||0);
    probe.remove();
    const vv=window.visualViewport;
    return `screen ${screen.width}×${screen.height} · inner ${innerWidth}×${innerHeight}`+(vv?` · visual ${Math.round(vv.height)}`:'')+` · inset top ${t} bottom ${b} · deficit ${viewportDeficit()}`;
  }catch(e){return '';}
}
/* The launch-time viewport bug, handled deterministically. In an installed (standalone) iOS web app
   the layout viewport comes up short of the screen — measured 62px on an iPhone Pro Max: WebKit
   subtracts the top inset from the bottom until a later native layout pass (usually the first
   scroll) corrects it. The region below the short viewport is still painted, so fixed-bottom
   elements just need to be pushed down by exactly that shortfall (--deficit) to land on the true
   screen edge; once WebKit corrects itself the shortfall reads 0 and everything is back to normal.
   Standalone-only on purpose: in a browser tab innerHeight legitimately excludes the toolbars. */
const STANDALONE=navigator.standalone===true||(window.matchMedia&&matchMedia('(display-mode: standalone)').matches);
function viewportDeficit(){
  if(!STANDALONE||innerWidth>innerHeight)return 0;
  const d=Math.round(screen.height-innerHeight);
  return d>0&&d<=120?d:0;
}
const vpLog=[], vpT0=(window.performance&&performance.now())||Date.now();
function vlog(m){const t=((window.performance&&performance.now())||Date.now())-vpT0;vpLog.push(Math.round(t)+'ms '+m);if(vpLog.length>14)vpLog.shift();}
let _lastDeficit=-1,_lastScreenH=-1,_lastPortrait=null;
// Returns true if anything actually changed this call — the rAF loop uses that to know when the
// launch-time viewport has settled so it can stop (see watchViewport). Every DOM write is guarded so
// a steady state writes nothing (P1: the old version rewrote --screen-h/minHeight ~60×/s forever).
function syncViewportDeficit(){
  let changed=false;
  const d=viewportDeficit();
  if(STANDALONE){
    const de=document.documentElement, portrait=innerWidth<=innerHeight, sh=screen.height;
    // Bar position is derived from screen.height (constant), not the viewport — see .tabbar CSS
    if(sh!==_lastScreenH){de.style.setProperty('--screen-h',sh+'px');_lastScreenH=sh;changed=true;}
    if(portrait!==_lastPortrait){
      de.classList.toggle('standalone',portrait);
      // THE trigger for WebKit's launch-time viewport correction (from the v0.8.9 on-device timeline):
      // the document becoming taller than the short viewport — i.e. scrollable. A taller-than-viewport
      // document that PERSISTS clears it within ~40ms. Keeping the document at least screen-height tall
      // does exactly that, and is a no-op once corrected (it persists, so writing it once is enough).
      de.style.minHeight=portrait?sh+'px':'';
      _lastPortrait=portrait;changed=true;
    }
  }
  if(d!==_lastDeficit){
    _lastDeficit=d;
    document.documentElement.style.setProperty('--deficit',d+'px');
    vlog('deficit '+d+' inner '+innerHeight);changed=true;
  }
  return changed;
}
// Is the on-screen keyboard up? On iOS the layout viewport doesn't shrink for the keyboard, so a
// fixed-bottom bar floats over it (and can get shoved to the top of the keyboard on scroll). When the
// visual viewport is much shorter than the window, hide the tab bar — CSS .kb-open .tabbar{display:none}.
function syncKeyboard(){
  const vv=window.visualViewport;if(!vv)return;
  const kb=window.innerHeight-vv.height-vv.offsetTop;
  document.documentElement.classList.toggle('kb-open',kb>120);
}
// A SELF-STOPPING poll for WebKit's eventless viewport corrections. It runs per frame only until the
// viewport has been stable ~2s (or a 3s hard cap), then stops — a permanent 60fps loop is pure battery/
// main-thread waste in an installed PWA (P1). It is RE-ARMABLE: events that can be followed by an
// eventless settle (a rotate whose dims lag the event, returning from background) restart it, so the
// correctness the old always-on loop gave is kept where it actually matters.
let _vpLoopOn=false;
function armViewportLoop(){
  if(_vpLoopOn)return;_vpLoopOn=true;
  const t0=(window.performance&&performance.now())||Date.now();let stable=0;
  const frame=()=>{
    if(!document.hidden){if(syncViewportDeficit())stable=0;else stable++;}
    const elapsed=((window.performance&&performance.now())||Date.now())-t0;
    if(stable<120&&elapsed<3000)requestAnimationFrame(frame);else{_vpLoopOn=false;vlog('vp loop done '+Math.round(elapsed)+'ms');}
  };
  requestAnimationFrame(frame);
}
function watchViewport(){
  syncViewportDeficit();
  ['resize','orientationchange','pageshow','focus','scroll'].forEach(ev=>addEventListener(ev,syncViewportDeficit,{passive:true}));
  document.addEventListener('visibilitychange',syncViewportDeficit);
  if(window.visualViewport){visualViewport.addEventListener('resize',syncViewportDeficit);
    visualViewport.addEventListener('resize',syncKeyboard);visualViewport.addEventListener('scroll',syncKeyboard);}
  addEventListener('focusout',()=>setTimeout(syncKeyboard,50),{passive:true});   // catch the keyboard dismissing
  // Re-arm the settle poll after events whose final layout can lag the event itself (iOS fires
  // orientationchange before innerWidth/Height update; returning from background can re-trigger a correction).
  ['orientationchange','pageshow'].forEach(ev=>addEventListener(ev,armViewportLoop,{passive:true}));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)armViewportLoop();});
  armViewportLoop();
  addEventListener('touchstart',()=>vlog('touch'),{passive:true,once:true});
  addEventListener('load',()=>vlog('load'));
}
/* ---------------- training profile (P1: optional, engine starts using it in P2) ---------------- */
function seenFlag(k){return !!(state.settings.seen&&state.settings.seen[k]);}
function markSeen(k){state.settings.seen=Object.assign({},state.settings.seen,{[k]:true});S.saveSettingsCloud();}
// Two-way toggle for a collapsible panel: 'collapse:<key>' present = collapsed, absent = open (default).
// Rides the synced `seen` map, so the choice persists and syncs across devices.
function toggleCollapse(key){const k='collapse:'+key,seen=state.settings.seen=state.settings.seen||{};
  if(seen[k])delete seen[k];else seen[k]=true;S.saveSettingsCloud();render();}
// A short label for the "Profile: …" lines; "Balanced" when nothing is set.
function profileSummary(){const p=state.settings.profile||{};const parts=[];
  const g={size:'Size',strength:'Strength',general:'General'},gy={full:'Full gym',machine:'Machine gym',home:'Home'};
  if(p.goal)parts.push(g[p.goal]);if(p.gym)parts.push(gy[p.gym]);if(p.days)parts.push(p.days+'d/wk');
  return parts.length?parts.join(' · '):'Balanced';}
function setProfile(field,val){const p=Object.assign({},state.settings.profile);
  if(!val||val==='auto')delete p[field];else p[field]=field==='days'?+val:val;
  state.settings.profile=Object.keys(p).length?p:undefined;S.saveSettingsCloud();}
function toggleProtect(gp){const p=Object.assign({},state.settings.profile),set=new Set(p.protect||[]);
  set.has(gp)?set.delete(gp):set.add(gp);if(set.size)p.protect=[...set];else delete p.protect;
  state.settings.profile=Object.keys(p).length?p:undefined;S.saveSettingsCloud();}
function addAvoid(id){const p=Object.assign({},state.settings.profile),set=new Set(p.avoid||[]);set.add(id);p.avoid=[...set];
  state.settings.profile=p;S.saveSettingsCloud();}
function removeAvoid(id){const p=Object.assign({},state.settings.profile),a=(p.avoid||[]).filter(x=>x!==id);
  if(a.length)p.avoid=a;else delete p.avoid;state.settings.profile=Object.keys(p).length?p:undefined;S.saveSettingsCloud();}
function pchips(field,opts){const c=(state.settings.profile&&state.settings.profile[field])||'auto';
  return `<div class="chips">${opts.map(([v,l])=>`<button class="chip ${(''+c)===v?'on':''}" data-pset="${field}" data-pv="${v}">${l}</button>`).join('')}</div>`;}
function prow(label,inner){return `<div style="margin-bottom:18px"><div class="eyebrow" style="margin-bottom:8px">${label}</div>${inner}</div>`;}
function profileBody(){const p=state.settings.profile||{},avoid=p.avoid||[],protect=new Set(p.protect||[]);
  return `<div class="dim" style="font-size:13px;margin:-4px 2px 16px;line-height:1.5">All optional — anything left on <b>Balanced</b> works exactly like today. Changes save automatically; the workout builder and coach adapt to whatever you set here.</div>
    ${prow('Main goal',pchips('goal',[['auto','Balanced'],['size','Size'],['strength','Strength'],['general','General']]))}
    ${prow('Your gym',pchips('gym',[['auto','Balanced'],['full','Full gym'],['machine','Machine-focused'],['home','Home / minimal']]))}
    ${prow('Days per week',pchips('days',[['auto','Any'],['2','2'],['3','3'],['4','4'],['5','5'],['6','6']]))}
    ${prow('Session length',pchips('length',[['auto','Balanced'],['short','Short'],['standard','Standard'],['long','Long']]))}
    ${prow('Set style',pchips('sets',[['auto','Balanced'],['straight','Straight'],['ramp','Ramping']]))}
    ${prow('Coaching',pchips('push',[['auto','Balanced'],['guide','Guide me'],['quiet','Just record']]))}
    ${prow('Protect — keep these light',`<div class="chips">${GROUPS.map(g=>`<button class="chip ${protect.has(g)?'on':''}" data-pprotect="${g}">${g}</button>`).join('')}</div>`)}
    ${prow('Exercises to avoid',`${avoid.length?`<div class="chips" style="margin-bottom:9px">${avoid.map(id=>`<button class="chip on" data-pdelavoid="${id}">${esc(EX[id]?EX[id].name:id)} ✕</button>`).join('')}</div>`:''}<button class="btn ghost sm" id="pAvoid">＋ Add exercise to avoid</button>`)}
    <button class="btn ghost block" id="pReset" style="margin-top:6px">Reset to Balanced</button>`;}
function openProfile(){openSheet('Training profile',profileBody());bindProfile();}
function bindProfile(){const b=$('#sheetBody');const rerender=()=>{b.innerHTML=profileBody();bindProfile();};
  b.querySelectorAll('[data-pset]').forEach(el=>el.addEventListener('click',()=>{setProfile(el.dataset.pset,el.dataset.pv);rerender();}));
  b.querySelectorAll('[data-pprotect]').forEach(el=>el.addEventListener('click',()=>{toggleProtect(el.dataset.pprotect);rerender();}));
  b.querySelectorAll('[data-pdelavoid]').forEach(el=>el.addEventListener('click',()=>{removeAvoid(el.dataset.pdelavoid);rerender();}));
  const av=$('#pAvoid');if(av)av.addEventListener('click',openAvoidPicker);
  const rst=$('#pReset');if(rst)rst.addEventListener('click',()=>{state.settings.profile=undefined;S.saveSettingsCloud();rerender();});}
function openAvoidPicker(){
  openSheet('Avoid which exercises?',`<div class="dim" style="font-size:12.5px;margin:-4px 2px 12px">Tap to toggle — the builder won't propose these.</div>
    <div class="search" style="margin-bottom:12px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg><input id="avSearch" placeholder="Search exercises…"></div>
    <div class="card list" id="avResults"></div>
    <button class="btn primary block" id="avDone" style="margin-top:14px">Done</button>`);
  const avoidSet=()=>new Set((state.settings.profile&&state.settings.profile.avoid)||[]);
  const row=e=>{const on=avoidSet().has(e.id);return `<div class="ex-row" data-avtoggle="${e.id}"><div class="ex-ic">${exIcon(e.group)}</div><div style="flex:1;min-width:0"><div class="ex-name">${esc(e.name)}</div><div class="ex-sub">${e.group} · ${e.equip}</div></div><div class="ex-add" style="${on?'background:var(--warn);color:#fff':''}">${on?'✓':'＋'}</div></div>`;};
  const inp=$('#avSearch'),refresh=()=>{const r=SR.searchEx(inp.value);$('#avResults').innerHTML=r.slice(0,60).map(row).join('')||'<div style="padding:20px;text-align:center" class="dim">No match.</div>';};
  refresh();inp.addEventListener('input',refresh);
  $('#avResults').addEventListener('click',ev=>{const b=ev.target.closest('[data-avtoggle]');if(!b)return;const id=b.dataset.avtoggle;avoidSet().has(id)?removeAvoid(id):addAvoid(id);refresh();});
  $('#avDone').addEventListener('click',openProfile);
}
function openSettings(){
  const R=state.settings.rest,st=state.settings;
  openSheet('Settings',`
    <div class="settingrow"><div><div style="font-weight:600">Units</div><div class="dim" style="font-size:13px">Weight display</div></div>
      <div class="seg" id="segUnit"><button data-u="lb" class="${U()==='lb'?'on':''}">lb</button><button data-u="kg" class="${U()==='kg'?'on':''}">kg</button></div></div>
    <div class="settingrow"><div><div style="font-weight:600">Bodyweight</div><div class="dim" style="font-size:13px">Counts pull-ups, dips &amp; push-ups toward volume and PRs</div></div>
      <div class="stepper"><button data-bw="-1">−</button><button class="val mono" id="bwVal" title="Tap to type">${bw()?bw()+' '+U():'Set'}</button><button data-bw="1">＋</button></div></div>
    <div class="settingrow"><div><div style="font-weight:600">Theme</div><div class="dim" style="font-size:13px">Appearance</div></div>
      <div class="seg" id="segTheme"><button data-t="system" class="${st.theme==='system'?'on':''}">Auto</button><button data-t="light" class="${st.theme==='light'?'on':''}">Light</button><button data-t="dark" class="${st.theme==='dark'?'on':''}">Dark</button></div></div>
    <button class="settingrow" id="btnProfile" style="width:100%;text-align:left;background:none;border:none;border-bottom:1px solid var(--line)"><div><div style="font-weight:600">Training profile</div><div class="dim" style="font-size:13px">How the builder tailors your workouts</div></div><span class="mono dim" style="font-size:13px">${profileSummary()} ›</span></button>
    <div style="height:18px"></div>
    <div class="eyebrow" style="margin-bottom:10px">Cloud backup</div>
    ${cloudSection()}
    <div style="height:18px"></div>
    <div class="eyebrow" style="margin-bottom:2px">Rest timer</div>
    <div class="settingrow"><div><div style="font-weight:600">Auto-start after each set</div><div class="dim" style="font-size:13px">Begins a countdown when you tap a set complete</div></div><button class="sw ${R.auto?'on':''}" data-sw="auto" aria-label="Auto-start rest timer"></button></div>
    <div class="settingrow"><div><div style="font-weight:600">Sound alert</div><div class="dim" style="font-size:13px">Beeps when rest is over</div></div><button class="sw ${R.sound?'on':''}" data-sw="sound" aria-label="Rest sound"></button></div>
    <div class="settingrow"><div><div style="font-weight:600">Phone notification</div><div class="dim" style="font-size:13px">Banner when rest ends (app must be open)</div></div><button class="sw ${R.notify?'on':''}" data-sw="notify" aria-label="Rest notification"></button></div>
    <div class="settingrow"><div><div style="font-weight:600">Rest after big lifts</div><div class="dim" style="font-size:13px">Squat, bench, deadlift, rows…</div></div>
      <div class="stepper"><button data-rest="compound" data-d="-15">−</button><span class="val mono" id="rvC">${fmtSec(R.compound)}</span><button data-rest="compound" data-d="15">＋</button></div></div>
    <div class="settingrow"><div><div style="font-weight:600">Rest after isolation</div><div class="dim" style="font-size:13px">Curls, raises, extensions…</div></div>
      <div class="stepper"><button data-rest="isolation" data-d="-15">−</button><span class="val mono" id="rvI">${fmtSec(R.isolation)}</span><button data-rest="isolation" data-d="15">＋</button></div></div>
    ${Object.keys(state.settings.seen||{}).some(k=>k.indexOf('mute:')===0)?`<div style="height:18px"></div>
    <button class="btn ghost block" id="btnUnmute">Show hidden coaching notes again</button>`:''}
    ${CFG.DEMO?'':`<div style="height:18px"></div>
    <div class="eyebrow" style="margin-bottom:10px">Your data</div>
    <button class="btn ghost block" id="btnExport" style="margin-bottom:10px">⬇ Export a backup file</button>
    <button class="btn ghost block" id="btnExportCsv" style="margin-bottom:10px">⬇ Export sessions (CSV)</button>
    <label class="btn ghost block" style="margin-bottom:10px">⬆ Import a backup<input type="file" id="fileImport" accept="application/json" hidden></label>`}
    <div style="height:18px"></div>
    <div class="dim" style="font-size:11.5px;line-height:1.55;text-align:center;padding:0 6px">Ironlog offers general fitness information, not medical advice. Warm up, use a weight you can control, and stop if something hurts. Consult a qualified professional before starting a program — you train at your own risk.</div>
    <div class="dim" id="verLine" role="button" tabindex="0" style="font-size:12px;text-align:center;margin-top:16px">Ironlog v${APP_VERSION} · ${state.sessions.length} sessions · ${state.routines.length} routines · ${(IL.store.storageBytes()/1e6).toFixed(1)} MB on this phone</div>
    <div id="vpDiag" hidden>   <!-- layout diagnostics for troubleshooting the iPhone screen fit; tap the version line to show -->
      <div class="dim mono" style="font-size:10.5px;text-align:center;margin-top:4px;opacity:.7">${viewportDiag()}</div>
      <div class="dim mono" style="font-size:10.5px;text-align:center;margin-top:4px;opacity:.7">${vpLog.join(' · ')}</div></div>`);
  $('#segUnit').addEventListener('click',e=>{const b=e.target.closest('[data-u]');if(!b)return;const nu=b.dataset.u;if(nu===U())return;
    showConfirm('Switch to '+nu+'?','Every logged weight will be converted so your history and PRs stay accurate.','Convert to '+nu,()=>{convertUnits(U(),nu);openSettings();render();toast('Converted to '+nu);},'primary');});
  $('#segTheme').addEventListener('click',e=>{const b=e.target.closest('[data-t]');if(!b)return;state.settings.theme=b.dataset.t;S.saveSettingsCloud();applyTheme();openSettings();});
  const bwStep=U()==='kg'?1:2.5;
  $('#sheetBody').querySelectorAll('[data-bw]').forEach(b=>b.addEventListener('click',()=>{state.settings.bodyweight=Math.max(0,bw()+(+b.dataset.bw)*bwStep);S.saveSettingsCloud();$('#bwVal').textContent=bw()?bw()+' '+U():'Set';}));
  $('#bwVal').addEventListener('click',()=>openNumberSheet('Your bodyweight ('+U()+')',bw()||'',v=>{state.settings.bodyweight=Math.max(0,v);S.saveSettingsCloud();openSettings();}));
  const on=(sel,fn)=>{const el=$(sel);if(el)el.addEventListener('click',fn);};
  on('#btnProfile',openProfile);
  on('#btnUnmute',()=>{const seen=state.settings.seen||{};Object.keys(seen).forEach(k=>{if(k.indexOf('mute:')===0)delete seen[k];});S.saveSettingsCloud();openSettings();render();toast('Coaching notes are back on');});
  on('#btnExport',exportData);
  on('#verLine',()=>{const d=$('#vpDiag');if(d)d.hidden=!d.hidden;});
  on('#btnExportCsv',exportCsv);
  const fi=$('#fileImport');if(fi)fi.addEventListener('change',importData);
  on('#btnResetDemo',()=>showConfirm('Reset the demo?','Reloads the original sample data and discards your changes.','Reset',()=>S.resetDemo()));
  on('#btnDbxOn',()=>S.connectDropbox());
  on('#btnDbxOff',()=>showConfirm('Disconnect Dropbox?','Your data stays on this phone; it just stops syncing.','Disconnect',()=>{S.disconnectDropbox();openSettings();render();}));
  on('#btnSyncNow',async()=>{if(state.cloud){toast('Syncing…');await state.cloud.syncNow();openSettings();}});
  $('#sheetBody').querySelectorAll('[data-sw]').forEach(b=>b.addEventListener('click',async()=>{
    const k=b.dataset.sw;
    if(k==='notify'&&!R.notify){
      if('Notification'in window){try{const p=await Notification.requestPermission();if(p!=='granted'){toast('Allow notifications in your browser to use this');return;}}catch(e){toast('Notifications not available here');return;}}
      else{toast('Notifications not supported here');return;}
    }
    R[k]=!R[k];b.classList.toggle('on',R[k]);S.saveSettingsCloud();
    if(k==='sound'&&R.sound){unlockAudio();beep();}
  }));
  $('#sheetBody').querySelectorAll('[data-rest]').forEach(b=>b.addEventListener('click',()=>{
    const k=b.dataset.rest,d=+b.dataset.d;R[k]=Math.max(15,Math.min(600,R[k]+d));
    $(k==='compound'?'#rvC':'#rvI').textContent=fmtSec(R[k]);S.saveSettingsCloud();
  }));
}
function convertUnits(from,to){
  const ids=P.convertSessions(state.sessions,from,to,Date.now(),true);   // the user's own toggle: stamp so other devices take the converted values
  ids.forEach(id=>state.dirty.add(id));S.saveSessions();S.saveDirty();
  if(state.active){state.active.exercises.forEach(e=>e.sets.forEach(st=>{st.w=P.convertWeight(st.w,from,to);}));S.persistActive();}
  if(editSession)editSession.exercises.forEach(e=>e.sets.forEach(st=>{st.w=P.convertWeight(st.w,from,to);}));
  state.settings.bodyweight=Math.round(P.convertWeight(bw(),from,to)||0);
  state.settings.unit=to;S.saveSettingsCloud();
  if(state.cloud)state.cloud.flush();
}
async function exportData(){
  const json=JSON.stringify(S.exportPayload(),null,2);
  const fname='ironlog-backup-'+new Date().toISOString().slice(0,10)+'.json';
  try{if(window.claude&&claude.use){const dl=await claude.use('downloads');if(dl){await dl.save({filename:fname,data:json});toast('Backup saved');return;}}}catch(e){}
  try{const blob=new Blob([json],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=fname;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('Backup downloaded');}
  catch(e){toast('Could not export here');}
}
async function exportCsv(){
  const done=state.sessions.filter(s=>s.completed!==false).length;
  if(!done){toast('No finished workouts to export yet');return;}
  const csv=IL.sync.sessionSummaryCsv(state.sessions,U(),bw());
  const fname='ironlog-sessions-'+new Date().toISOString().slice(0,10)+'.csv';
  try{if(window.claude&&claude.use){const dl=await claude.use('downloads');if(dl){await dl.save({filename:fname,data:csv});toast('CSV saved');return;}}}catch(e){}
  try{const blob=new Blob([csv],{type:'text/csv'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=fname;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('CSV downloaded');}
  catch(e){toast('Could not export here');}
}
function importData(ev){
  const f=ev.target.files[0];if(!f)return;const rd=new FileReader();
  rd.onload=()=>{try{const added=S.importBackup(rd.result);applyTheme();toast('Imported '+added+' new session'+(added!==1?'s':''));closeSheet();render();}
    catch(e){toast('That file could not be read');}};
  rd.readAsText(f);
}
function openSessionDetail(sid){
  const s=state.sessions.find(x=>x.id===sid);if(!s)return;
  if(s.kind==='cardio'){openCardioDetail(s);return;}
  openSheet(fmtDate(s.date),`<div class="sess-meta" style="margin:0 0 16px"><span class="muted">Volume <b>${fmtVol(volOf(s))} ${U()}</b></span><span class="muted">Sets <b>${setsOf(s)}</b></span><span class="muted">${new Date(s.date).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</span></div>
    ${s.note?`<div class="card" style="padding:12px 14px;margin-bottom:14px;background:var(--surface-2);border:none;font-size:13.5px;line-height:1.5;color:var(--ink-2)">📝 ${esc(s.note)}</div>`:''}
    ${s.exercises.map(e=>{const ex=EX[e.id];return `<div class="card" style="padding:13px 15px;margin-bottom:10px">
      <div style="display:flex;gap:11px;align-items:center;margin-bottom:9px"><div class="ex-ic" style="width:36px;height:36px">${exIcon(ex?ex.group:'Core')}</div><div class="ex-name">${esc(ex?ex.name:e.name)}</div></div>
      <div class="setgrid" style="padding:0"><div class="set-hdr"><div>Set</div><div>${U()}</div><div>${D.TIME_METRIC.has(e.id)?'Sec':'Reps'}</div><div></div></div>
      ${e.sets.filter(st=>st.done!==false).map((st,i)=>`<div class="set-row"><div class="set-no ${st.warm?'warm':''}">${st.warm?'W':i+1}</div><div class="numwrap" style="justify-content:center"><span class="mono" style="font-size:16px;font-weight:600">${st.w||0}</span></div><div class="numwrap" style="justify-content:center"><span class="mono" style="font-size:16px;font-weight:600">${st.r||0}${D.TIME_METRIC.has(e.id)?'s':''}</span></div><div></div></div>`).join('')}</div></div>`;}).join('')}
    <div style="display:flex;gap:9px;margin:8px 0 10px"><button class="btn ghost" style="flex:1" data-editsess="${s.id}">✎ Edit</button><button class="btn ghost" style="flex:1" data-repeatfrom="${s.id}">↻ Repeat</button></div>
    <button class="btn ghost block" data-routinefrom="${s.id}" style="margin-bottom:10px">★ Save as routine</button>
    <button class="linkbtn dim" data-delsess="${s.id}" style="display:block;text-align:center;width:100%">Delete this session</button>`);
  const body=$('#sheetBody');
  body.querySelector('[data-repeatfrom]').addEventListener('click',()=>{closeSheet();startSession({ids:s.exercises.map(e=>e.id),msg:'Loaded — weights prefilled',source:'repeat'});setTab('today');});
  body.querySelector('[data-editsess]').addEventListener('click',()=>{closeSheet();startEdit(s);});
  body.querySelector('[data-routinefrom]').addEventListener('click',()=>{closeSheet();saveAsRoutine(s);});
  body.querySelector('[data-delsess]').addEventListener('click',()=>showConfirm('Delete session?','This removes the workout from your history.','Delete',()=>{
    const copy=JSON.parse(JSON.stringify(s));S.deleteSession(s.id);closeSheet();render();
    toast('Session deleted',{label:'Undo',fn:()=>{S.restoreSession(copy);render();toast('Restored');}});}));
}
// Cardio session detail — type/intensity/duration/distance, plus delete (edit lands in C5).
function openCardioDetail(s){
  const c=s.cardio||{},dur=P.sessionDuration(s);
  openSheet(fmtDate(s.date),`
    <div class="card" style="padding:16px;margin-bottom:14px">
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px"><div class="ex-ic" style="width:42px;height:42px">${CARDIO_ICON}</div>
        <div><div class="ex-name" style="font-size:16px">${cardioTypeLabel(c.type)}</div><div class="ex-sub">${cardioIntLabel(c.intensity)} intensity</div></div></div>
      <div class="sess-meta" style="margin:0">
        ${dur!=null?`<span class="muted">${s.endEstimated?'≈':''}Duration <b>${fmtDur(dur)}</b></span>`:''}
        ${c.distance!=null?`<span class="muted">Distance <b>${c.distance} ${c.unit||distanceUnit()}</b></span>`:''}
        <span class="muted">${new Date(s.date).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</span></div></div>
    <div class="dim" style="font-size:12px;margin:0 2px 14px">Cardio is tracked on its own — it never affects your lifting volume, PRs or the coach.</div>
    <button class="btn ghost block" id="cardEdit" style="margin-bottom:12px">✎ Edit</button>
    <button class="linkbtn dim" data-delsess="${s.id}" style="display:block;text-align:center;width:100%">Delete this session</button>`);
  $('#cardEdit').addEventListener('click',()=>openCardioEdit(s));
  $('#sheetBody').querySelector('[data-delsess]').addEventListener('click',()=>showConfirm('Delete session?','This removes the cardio session from your history.','Delete',()=>{
    const copy=JSON.parse(JSON.stringify(s));S.deleteSession(s.id);closeSheet();render();
    toast('Session deleted',{label:'Undo',fn:()=>{S.restoreSession(copy);render();toast('Restored');}});}));
}

