// Views, interactions, rest timer and boot. Everything that touches the DOM lives here.
var IL=globalThis.IL||(globalThis.IL={});
const CFG=IL.config||{},D=IL.data,P=IL.prog,B=IL.builder,A=IL.analysis,S=IL.store,SR=IL.search,DBX=IL.dropbox;
const {EX,EXERCISES,GROUPS,exIcon,C,I}=D;
const state=S.state;
const APP_VERSION=CFG.VERSION||'0';

/* ---------------- helpers ---------------- */
const $=s=>document.querySelector(s);
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
const U=()=>state.settings.unit;
const inc=()=>P.unitIncrement(U());
const bw=()=>+state.settings.bodyweight||0;
const {DAY,startOfDay,fmtVol}=P;
function fmtDate(ts){return new Date(ts).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});}
function relDay(ts){const t=startOfDay(Date.now()),d=startOfDay(ts);const diff=Math.round((t-d)/DAY);
  if(diff===0)return'Today';if(diff===1)return'Yesterday';if(diff<7)return diff+' days ago';return fmtDate(ts);}
const volOf=s=>P.sessionVolume(s,bw());
const setsOf=s=>P.sessionSets(s);
const completedSessions=()=>state.sessions.filter(s=>s.completed!==false&&s.exercises.length);
const ICON_BACK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>';
function demoURL(id){const e=EX[id];return 'https://www.youtube.com/results?search_query='+encodeURIComponent('how to '+e.name+' proper form technique');}

let toastT=null;
function toast(msg,action){
  const t=$('#toast'),b=$('#toastAct');$('#toastMsg').textContent=msg;
  if(action){b.hidden=false;b.textContent=action.label;b.onclick=()=>{hideToast();action.fn();};t.classList.add('act');}
  else{b.hidden=true;b.onclick=null;t.classList.remove('act');}
  t.classList.add('on');clearTimeout(toastT);toastT=setTimeout(hideToast,action?6000:1900);
}
function hideToast(){$('#toast').classList.remove('on','act');}
let _confirmCb=null;
function showConfirm(title,msg,okLabel,cb,kind){
  $('#cdTitle').textContent=title;$('#cdMsg').textContent=msg;
  const ok=$('#cdOk');ok.textContent=okLabel;ok.className='btn '+(kind==='primary'?'primary':'danger');
  _confirmCb=cb;$('#cdialog').classList.add('on');$('#cscrim').classList.add('on');
}
function closeConfirm(){$('#cdialog').classList.remove('on');$('#cscrim').classList.remove('on');_confirmCb=null;}
function openSheet(title,body){$('#sheetTitle').textContent=title;$('#sheetBody').innerHTML=body;$('#sheet').classList.add('on');$('#scrim').classList.add('on');}
function closeSheet(){$('#sheet').classList.remove('on');$('#scrim').classList.remove('on');}
function applyTheme(){const t=state.settings.theme;if(t==='system')document.documentElement.removeAttribute('data-theme');else document.documentElement.setAttribute('data-theme',t);}
function updateCloud(){
  const el=$('#cloudStatus'),t=$('#cloudText');if(!el)return;
  if(CFG.DEMO){el.className='cloud';t.textContent='Demo · sample data';return;}
  if(state.cloudError&&state.cloudName!=='none'){el.className='cloud err';t.textContent='Sync problem';return;}
  if(state.cloudName==='artifact'||state.cloudName==='dropbox'){
    const pending=state.dirty.size||state.syncing;
    el.className='cloud '+(pending?'local':'synced');t.textContent=pending?'Syncing…':'Backed up';
  }else{el.className='cloud local';t.textContent='On this phone';}
}

/* ---------------- router ---------------- */
let currentTab='today';
let todayScreen='home';          // 'home' | 'start' | 'active' | 'edit'
let editSession=null,editDirty=false;
let pickedGroups=new Set();
let calMonth=new Date().getFullYear()*12+new Date().getMonth(),selDay=null;
let libQuery='',libGroup='All';
function setTab(t){currentTab=t;document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));render();window.scrollTo(0,0);}
function render(){
  const v=$('#view');
  if(currentTab==='today')v.innerHTML=viewToday();
  else if(currentTab==='history')v.innerHTML=viewHistory();
  else if(currentTab==='library')v.innerHTML=viewLibrary();
  else if(currentTab==='progress')v.innerHTML=viewProgress();
  bind();updateCloud();
}
// current session being edited on the Today tab (the live workout or a past one)
const cur=()=>todayScreen==='edit'?editSession:state.active;
function persistCur(){if(todayScreen==='edit')editDirty=true;else S.persistActive();}

/* ---------------- TODAY ---------------- */
function viewToday(){
  if(todayScreen==='edit'&&editSession)return editorView(editSession,'edit');
  if(todayScreen==='active'&&state.active)return editorView(state.active,'active');
  if(todayScreen==='start')return startWorkoutView();
  return homeView();
}
function homeView(){
  const done=completedSessions(),now=Date.now();
  const wk=done.filter(s=>s.date>=now-7*DAY);
  const wkVol=wk.reduce((a,s)=>a+volOf(s),0);
  const streak=P.calcStreak(done,now);
  const hr=new Date().getHours();const greet=hr<12?'Good morning':hr<18?'Good afternoon':'Good evening';
  const last=done[0];
  return `
  <div class="section">
    <div style="padding:6px 2px 0">
      <div class="eyebrow">${new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</div>
      <h2 style="font-size:27px;margin-top:5px">${greet}.</h2>
    </div>
    ${state.active?resumeCard():''}
    <div class="statgrid" style="grid-template-columns:1fr 1fr 1fr;margin:16px 0 18px;gap:9px">
      <div class="card stat" style="padding:14px 12px"><div class="k">This wk</div><div class="v mono">${wk.length}</div></div>
      <div class="card stat" style="padding:14px 12px"><div class="k">Streak</div><div class="v mono">${streak}<small>wk</small></div></div>
      <div class="card stat" style="padding:14px 12px"><div class="k">Volume</div><div class="v mono">${fmtVol(wkVol)}</div></div>
    </div>
    ${state.active?'':`<button class="btn primary block" id="btnStartFlow" style="height:56px;font-size:16px">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg> Start a workout</button>`}
    ${last?`<div class="eyebrow" style="margin:26px 2px 10px">Last session</div>${sessCard(last)}`:emptyHome()}
    <div class="eyebrow" style="margin:24px 2px 10px">Jump in</div>
    <button class="btn ghost block" id="btnGoLibrary" style="justify-content:space-between">
      <span>Browse exercise library</span><span class="dim mono">${EXERCISES.length} exercises ›</span></button>
  </div>`;
}
function emptyHome(){return `<div class="card" style="padding:26px 18px;text-align:center;margin-top:20px"><div class="dim">No workouts logged yet.<br>Tap <b style="color:var(--accent)">Start a workout</b> above to log your first session.</div></div>`;}
function resumeCard(){
  const s=state.active;const sets=setsOf(s);
  return `<button class="resume" id="btnResume">
    <span class="tri"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>
    <span style="flex:1;min-width:0"><span style="font-weight:700;display:block">Resume your workout</span><span class="dim" style="font-size:13px">${s.exercises.length} exercise${s.exercises.length!==1?'s':''} · ${sets} set${sets!==1?'s':''} logged</span></span>
    <span style="color:var(--accent);font-size:20px;flex-shrink:0">→</span></button>`;
}
function startWorkoutView(){
  return `
  <div class="section">
    <div class="topbar"><button class="backbtn" id="btnBackHome">${ICON_BACK} Home</button></div>
    <div style="padding:0 2px">
      <div class="eyebrow">New workout</div>
      <h2 style="font-size:24px;margin-top:6px">What are you training?</h2>
      <p class="muted" style="margin:7px 0 0">Pick your muscle groups (first pick leads the session) and I'll build a balanced plan — or start from scratch.</p>
    </div>
    <div class="eyebrow" style="margin:22px 2px 10px">Target muscle groups</div>
    <div class="chips" id="groupPick">${GROUPS.map(g=>`<button class="chip ${pickedGroups.has(g)?'on':''}" data-g="${g}">${g}</button>`).join('')}</div>
    <div class="spacer"></div><div class="spacer"></div>
    <button class="btn primary block" id="btnRecommend" style="height:56px;font-size:16px">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2 2M16.4 16.4l2 2M18.4 5.6l-2 2M7.6 16.4l-2 2"/><circle cx="12" cy="12" r="3.2"/></svg>
      Build me a workout</button>
    <div style="height:10px"></div>
    <button class="btn ghost block" id="btnBlank">Start from scratch</button>
    ${routineList()}
    ${recentTemplates()}
  </div>`;
}
function routineList(){
  if(!state.routines.length)return'';
  return `<div class="eyebrow" style="margin:26px 2px 10px">Your routines</div>`+state.routines.map(r=>`<div class="routine" data-routine="${r.id}">
      <span class="ex-ic">${exIcon(EX[r.exIds[0]]?EX[r.exIds[0]].group:'Core')}</span>
      <span style="min-width:0"><span style="font-weight:700;display:block">${esc(r.name)}</span><span class="dim" style="font-size:12.5px">${r.exIds.length} exercises · ${r.exIds.slice(0,3).map(id=>EX[id]?EX[id].name:id).join(', ')}${r.exIds.length>3?'…':''}</span></span>
      <button class="del" data-delroutine="${r.id}" aria-label="Delete routine">✕</button></div>`).join('');
}
function recentTemplates(){
  const last=completedSessions().slice(0,2);
  if(!last.length)return'';
  return `<div class="eyebrow" style="margin:26px 2px 10px">Repeat a recent session</div>`+
    last.map(s=>`<button class="btn ghost block" style="justify-content:space-between;margin-bottom:9px;height:auto;padding:13px 16px" data-repeat="${s.id}">
      <span style="text-align:left"><span style="font-weight:700;display:block">${relDay(s.date)}</span><span class="dim" style="font-size:13px;font-weight:500">${s.exercises.map(e=>EX[e.id]?EX[e.id].name:e.name).slice(0,3).join(' · ')}${s.exercises.length>3?' +'+(s.exercises.length-3):''}</span></span>
      <span class="ex-add" style="background:var(--surface-2)">↻</span></button>`).join('');
}
const SCHEMA=1;
function newSession(exIds){return{id:S.uid(),schema:SCHEMA,date:Date.now(),updatedAt:Date.now(),completed:false,exercises:(exIds||[]).map(id=>B.seedExercise(id,state.sessions))};}
function startSession(exIds,msg){S.setActive(newSession(exIds));todayScreen='active';render();if(msg)toast(msg);}

/* ---------------- session editor (live workout or editing a past one) ---------------- */
function editorView(s,mode){
  const vol=volOf(s),sets=setsOf(s),edit=mode==='edit';
  return `
  <div class="section">
    <div class="topbar"><button class="backbtn" id="btnBackHome">${ICON_BACK} ${edit?'Cancel':'Home'}</button>
      ${edit?'':'<button class="linkbtn dim" id="btnDiscard">Discard</button>'}</div>
    <div style="padding:0 2px 2px"><div class="eyebrow">${edit?'Editing · '+fmtDate(s.date):'Workout in progress · saves automatically'}</div>
      <h2 style="font-size:23px;margin-top:4px">${new Date(s.date).toLocaleDateString(undefined,{weekday:'long'})}'s session</h2></div>
    <div class="statgrid" style="margin:14px 0 18px">
      <div class="card stat"><div class="k">Working sets</div><div class="v mono">${sets}</div></div>
      <div class="card stat"><div class="k">Volume</div><div class="v mono">${fmtVol(vol)}<small>${U()}</small></div></div>
    </div>
    <div id="logList">${s.exercises.map((e,i)=>logExercise(s,e,i,mode)).join('')||emptyLog()}</div>
    <div style="display:flex;gap:4px;flex-wrap:wrap;margin:0 0 6px">
      ${s.exercises.length>=3?`<button class="linkbtn" id="btnReorder">↕ Auto-order</button>`:''}
      ${s.exercises.length?`<button class="linkbtn" id="btnSaveRoutine">★ Save as routine</button>`:''}
    </div>
    ${edit?'':topSuggestionHTML()}
    <button class="btn ghost block" id="btnAddEx" style="margin-top:4px">＋ Add exercise</button>
    <div style="height:14px"></div>
    ${edit?`<button class="btn primary block" id="btnSaveEdit">Save changes</button>`
          :`<button class="btn good block" id="btnFinish" ${sets===0?'disabled style="opacity:.5"':''}>Finish &amp; save workout</button>`}
  </div>`;
}
function emptyLog(){return `<div class="card" style="padding:26px 18px;text-align:center;margin-bottom:14px"><div class="dim">No exercises yet.<br>Add one to start logging sets.</div></div>`;}
function topSuggestionHTML(){
  if(!state.active||!state.active.exercises.length)return'';
  const s=B.complementSuggestions(state.active.exercises.map(e=>e.id),1)[0];
  if(!s)return'';
  return `<button class="btn ghost block" data-suggest="${s.id}" style="justify-content:flex-start;gap:11px;margin:0 0 10px;height:auto;padding:12px 14px;border-style:dashed">
    <span class="ex-add" style="background:var(--accent-soft);flex-shrink:0">＋</span>
    <span style="text-align:left;min-width:0"><span style="font-weight:700;display:block">Suggested: ${esc(EX[s.id].name)}</span><span class="dim" style="font-size:12.5px">${esc(s.why)}</span></span></button>`;
}
function logExercise(s,e,ei,mode){
  const ex=EX[e.id];let sugg='';
  if(mode==='active'){
    const sg=P.suggestion(state.sessions,e.id,{unit:U(),activeDate:s.date,activeId:s.id});
    if(sg.lp){const w=sg.kind==='weight';
      sugg=`<div class="sugg ${w?'':'match'}"><span>${w?'💪 '+sg.text:sg.text} · <span class="lastp">${esc(sg.setsStr)}</span></span>${w?`<button class="apply" data-bumpw="${ei}">+${inc()}${U()}</button>`:''}</div>`;}
  }
  return `<div class="card log-ex" data-ei="${ei}">
    <div class="log-ex-head">
      <div class="ex-ic">${exIcon(ex?ex.group:'Core')}</div>
      <button data-openex="${e.id}" style="flex:1;min-width:0;text-align:left;background:none;padding:0"><div class="ex-name">${esc(e.name)} <span class="dim" style="font-weight:400;font-size:12px">ⓘ</span></div>
        <div class="ex-sub">${ex?ex.muscles.join(' · '):''} · target ${ex?ex.rr[0]+'–'+ex.rr[1]:'8–12'} reps</div></button>
      <button class="sheet-x" data-delex="${ei}" aria-label="Remove exercise">✕</button>
    </div>
    ${sugg}
    <div class="setgrid">
      <div class="set-hdr"><div>Set</div><div>${U()==='kg'?'Kg':'Lb'}</div><div>Reps</div><div></div></div>
      ${e.sets.map((st,si)=>setRow(st,ei,si)).join('')}
    </div>
    <div class="set-actions">
      <button class="linkbtn" data-addset="${ei}">＋ Add set</button>
      <a class="linkbtn dim" href="${demoURL(e.id)}" target="_blank" rel="noopener" style="margin-left:auto;text-decoration:none">▶ Watch demo</a>
    </div>
    ${ei===0?'<div class="hint">Tip: tap a set number to mark it a warm-up (kept out of PRs and volume).</div>':''}
  </div>`;
}
function setRow(st,ei,si){
  return `<div class="set-row ${st.done?'done':''}" data-si="${si}">
    <button class="set-no ${st.warm?'warm':''}" data-warm="${ei}" data-s="${si}" aria-label="Toggle warm-up">${st.warm?'W':si+1}</button>
    <div class="numwrap"><button data-step="w" data-d="-1" data-ei="${ei}" data-s="${si}" aria-label="Less weight">−</button>
      <input inputmode="decimal" data-f="w" data-ei="${ei}" data-s="${si}" value="${st.w!==''&&st.w!=null?st.w:''}" placeholder="0" aria-label="Weight">
      <button data-step="w" data-d="1" data-ei="${ei}" data-s="${si}" aria-label="More weight">+</button></div>
    <div class="numwrap"><button data-step="r" data-d="-1" data-ei="${ei}" data-s="${si}" aria-label="Fewer reps">−</button>
      <input inputmode="numeric" data-f="r" data-ei="${ei}" data-s="${si}" value="${st.r!==''&&st.r!=null?st.r:''}" placeholder="0" aria-label="Reps">
      <button data-step="r" data-d="1" data-ei="${ei}" data-s="${si}" aria-label="More reps">+</button></div>
    <button class="set-check ${st.done?'on':''}" data-check="${ei}" data-s="${si}" aria-label="Complete set">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 6"/></svg></button>
  </div>`;
}

/* ---------------- HISTORY ---------------- */
function viewHistory(){
  const done=completedSessions();
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
  return list.map(s=>sessCard(s)).join('');
}
function sessCard(s){
  return `<div class="card sess" data-sess="${s.id}">
    <div class="sess-top"><div class="sess-date">${relDay(s.date)}</div><span class="pill accent">${s.exercises.length} exercise${s.exercises.length!==1?'s':''}</span></div>
    <div class="sess-meta"><span class="muted">Volume <b>${fmtVol(volOf(s))} ${U()}</b></span><span class="muted">Sets <b>${setsOf(s)}</b></span></div>
    <div class="sess-ex">${s.exercises.slice(0,4).map(e=>{const best=e.sets.filter(P.isWorking);const top=best.length?Math.max(...best.map(x=>+x.w||0)):0;
      return `<div><span>${esc(EX[e.id]?EX[e.id].name:e.name)}</span><span class="s">${best.length}×${best.length?best[0].r:0} · ${top}${U()}</span></div>`;}).join('')}
      ${s.exercises.length>4?`<div class="dim" style="font-size:12px">+${s.exercises.length-4} more</div>`:''}</div>
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
function viewProgress(){
  const done=completedSessions(),now=Date.now();
  const wk=done.filter(s=>s.date>=now-7*DAY),mo=done.filter(s=>s.date>=now-30*DAY);
  const wkVol=wk.reduce((a,s)=>a+volOf(s),0);
  return `<div class="section">
    <div class="view-title" style="margin:0 2px 14px;font-size:22px">Progress</div>
    <div class="statgrid">
      <div class="card stat"><div class="k">This week</div><div class="v mono">${wk.length}<small>workouts</small></div></div>
      <div class="card stat"><div class="k">Week volume</div><div class="v mono">${fmtVol(wkVol)}<small>${U()}</small></div></div>
      <div class="card stat"><div class="k">30-day workouts</div><div class="v mono">${mo.length}</div></div>
      <div class="card stat"><div class="k">Current streak</div><div class="v mono">${P.calcStreak(done,now)}<small>wk</small></div></div>
    </div>
    ${coachCard(done)}
    <div class="eyebrow" style="margin:24px 2px 10px">Weekly volume · last 8 weeks</div>
    <div class="card" style="padding:14px 12px 10px">${volumeChart()}</div>
    <div class="eyebrow" style="margin:24px 2px 10px">Personal records</div>
    <div class="card list">${prList()}</div>
    ${muscleBreakdown(mo)}
  </div>`;
}
function volumeChart(){
  const cols=A.weeklyVolumes(state.sessions,Date.now(),bw(),8);
  const max=Math.max(1,...cols.map(c=>c.v));
  return `<div class="chart">${cols.map((c,i)=>`<div class="bar-col"><div class="bar ${c.v===0?'z':''}" style="height:${c.v===0?3:Math.max(6,c.v/max*112)}px"></div><div class="bar-lb">${i===cols.length-1?'Now':new Date(c.start).toLocaleDateString(undefined,{month:'numeric',day:'numeric'})}</div></div>`).join('')}</div>`;
}
function prList(){
  const arr=A.personalRecords(state.sessions,bw(),8);
  if(!arr.length)return`<div style="padding:22px;text-align:center" class="dim">Log a few sets and your PRs show up here.</div>`;
  const setStr=p=>p.bodyweight?(p.w?'Bodyweight +'+p.w+U():'Bodyweight')+' × '+p.r:p.w+U()+' × '+p.r;
  return arr.map(p=>`<div class="ex-row"><div style="flex:1;min-width:0"><div class="ex-name">${esc(p.name)}</div>
    <div class="ex-sub">Best set ${setStr(p)}</div></div>
    <div style="text-align:right">${p.compound?`<div class="mono" style="font-weight:700;font-size:16px">${p.est}<span class="dim" style="font-size:11px"> ${U()} e1RM</span></div>`:`<div class="mono dim" style="font-weight:600;font-size:13px">${p.load}${U()}</div>`}</div></div>`).join('');
}
function balBar(l,lv,r,rv){
  const total=lv+rv||1,lp=Math.round(lv/total*100);
  return `<div style="margin-bottom:13px"><div class="row-between" style="font-size:12.5px;margin-bottom:5px"><span style="font-weight:600">${l} <span class="mono dim">${lv}</span></span><span style="font-weight:600"><span class="mono dim">${rv}</span> ${r}</span></div>
    <div style="height:9px;border-radius:5px;overflow:hidden;display:flex;background:var(--surface-2)"><div style="width:${lp}%;background:var(--accent)"></div><div style="flex:1;background:var(--good)"></div></div></div>`;
}
function coachCard(done){
  if(!done.length)return '';
  const a=A.analyze(state.sessions,Date.now());
  if(a.sessions<1)return `<div class="eyebrow" style="margin:24px 2px 10px">Effectiveness</div><div class="card" style="padding:20px;text-align:center"><div class="dim">Train in the last 4 weeks to see your balance analysis and coaching tips.</div></div>`;
  const tips=A.buildTips(a,state.sessions,Date.now(),bw());
  const dot={warn:'var(--warn)',good:'var(--good)',info:'var(--ink-3)'};
  return `<div class="eyebrow" style="margin:24px 2px 10px">Effectiveness · last 4 weeks</div>
    <div class="card" style="padding:16px 16px 6px">${balBar('Push',a.push,'Pull',a.pull)}${balBar('Upper body',a.upperSets,'Lower body',a.lowerSets)}</div>
    <div class="eyebrow" style="margin:18px 2px 10px">Coach's notes</div>
    <div class="card" style="padding:4px 16px">${tips.map((t,i)=>`<div style="display:flex;gap:11px;padding:12px 0;${i?'border-top:1px solid var(--line)':''}"><span style="width:9px;height:9px;border-radius:50%;background:${dot[t.lv]};flex-shrink:0;margin-top:5px"></span><div style="font-size:13.5px;line-height:1.5">${t.x}</div></div>`).join('')}</div>`;
}
function muscleBreakdown(mo){
  const arr=A.muscleSetCounts(mo);if(!arr.length)return'';
  const max=Math.max(...arr.map(a=>a[1]));
  return `<div class="eyebrow" style="margin:24px 2px 10px">Sets by muscle · last 30 days</div>
    <div class="card" style="padding:15px 16px">${arr.map(([g,n])=>`<div style="margin-bottom:11px"><div class="row-between" style="margin-bottom:5px"><span style="font-weight:600;font-size:13.5px">${g}</span><span class="mono dim" style="font-size:12.5px">${n} sets</span></div><div style="height:7px;background:var(--surface-2);border-radius:4px;overflow:hidden"><div style="height:100%;width:${n/max*100}%;background:var(--accent);border-radius:4px"></div></div></div>`).join('')}</div>`;
}

/* ---------------- sheets ---------------- */
function exerciseDetail(id){
  const e=EX[id];const lp=P.lastPerf(state.sessions,id,{excludeId:state.active&&state.active.id});
  const target=cur();const inWorkout=target&&target.exercises.some(x=>x.id===id);
  return `<div style="display:flex;gap:13px;align-items:center;margin-bottom:16px">
      <div class="ex-ic" style="width:52px;height:52px">${exIcon(e.group)}</div>
      <div><div class="mono dim" style="font-size:12px">${e.equip} · ${e.type}${e.tier===1?' · foundational lift':''}</div>
      <div class="chips" style="margin-top:6px">${e.muscles.map(m=>`<span class="pill">${m}</span>`).join('')}</div></div></div>
    <p class="instr">${esc(e.instr)}</p>
    <div class="card" style="padding:12px 15px;margin:16px 0">
      <div class="row-between"><span class="eyebrow">Target rep range</span><span class="mono" style="font-weight:600">${e.rr[0]}–${e.rr[1]}</span></div>
      ${lp?`<div class="row-between" style="margin-top:10px;padding-top:10px;border-top:1px solid var(--line)"><span class="eyebrow">Last time</span><span class="mono" style="font-weight:600">${lp.sets.length}×${lp.sets[0].r} @ ${Math.max(...lp.sets.map(s=>s.w))}${U()}</span></div>`:''}
    </div>
    <a class="btn ghost block" href="${demoURL(id)}" target="_blank" rel="noopener" style="margin-bottom:10px;text-decoration:none">▶ Watch a demo video</a>
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
function fmtSec(s){return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');}
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
function openSettings(){
  const R=state.settings.rest,st=state.settings;
  openSheet('Settings',`
    <div class="settingrow"><div><div style="font-weight:600">Units</div><div class="dim" style="font-size:13px">Weight display</div></div>
      <div class="seg" id="segUnit"><button data-u="lb" class="${U()==='lb'?'on':''}">lb</button><button data-u="kg" class="${U()==='kg'?'on':''}">kg</button></div></div>
    <div class="settingrow"><div><div style="font-weight:600">Bodyweight</div><div class="dim" style="font-size:13px">Counts pull-ups, dips &amp; push-ups toward volume and PRs</div></div>
      <div class="stepper"><button data-bw="-1">−</button><button class="val mono" id="bwVal" title="Tap to type">${bw()?bw()+' '+U():'Set'}</button><button data-bw="1">＋</button></div></div>
    <div class="settingrow"><div><div style="font-weight:600">Theme</div><div class="dim" style="font-size:13px">Appearance</div></div>
      <div class="seg" id="segTheme"><button data-t="system" class="${st.theme==='system'?'on':''}">Auto</button><button data-t="light" class="${st.theme==='light'?'on':''}">Light</button><button data-t="dark" class="${st.theme==='dark'?'on':''}">Dark</button></div></div>
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
    ${CFG.DEMO?'':`<div style="height:18px"></div>
    <div class="eyebrow" style="margin-bottom:10px">Your data</div>
    <button class="btn ghost block" id="btnExport" style="margin-bottom:10px">⬇ Export a backup file</button>
    <label class="btn ghost block" style="margin-bottom:10px">⬆ Import a backup<input type="file" id="fileImport" accept="application/json" hidden></label>`}
    <div class="dim" style="font-size:12px;text-align:center;margin-top:18px">Ironlog v${APP_VERSION} · ${state.sessions.length} sessions · ${state.routines.length} routines</div>`);
  $('#segUnit').addEventListener('click',e=>{const b=e.target.closest('[data-u]');if(!b)return;const nu=b.dataset.u;if(nu===U())return;
    showConfirm('Switch to '+nu+'?','Every logged weight will be converted so your history and PRs stay accurate.','Convert to '+nu,()=>{convertUnits(U(),nu);openSettings();render();toast('Converted to '+nu);},'primary');});
  $('#segTheme').addEventListener('click',e=>{const b=e.target.closest('[data-t]');if(!b)return;state.settings.theme=b.dataset.t;S.saveSettingsCloud();applyTheme();openSettings();});
  const bwStep=U()==='kg'?1:2.5;
  $('#sheetBody').querySelectorAll('[data-bw]').forEach(b=>b.addEventListener('click',()=>{state.settings.bodyweight=Math.max(0,bw()+(+b.dataset.bw)*bwStep);S.saveSettingsCloud();$('#bwVal').textContent=bw()?bw()+' '+U():'Set';}));
  $('#bwVal').addEventListener('click',()=>openNumberSheet('Your bodyweight ('+U()+')',bw()||'',v=>{state.settings.bodyweight=Math.max(0,v);S.saveSettingsCloud();openSettings();}));
  const on=(sel,fn)=>{const el=$(sel);if(el)el.addEventListener('click',fn);};
  on('#btnExport',exportData);
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
  const ids=P.convertSessions(state.sessions,from,to);
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
function importData(ev){
  const f=ev.target.files[0];if(!f)return;const rd=new FileReader();
  rd.onload=()=>{try{const added=S.importBackup(rd.result);applyTheme();toast('Imported '+added+' new session'+(added!==1?'s':''));closeSheet();render();}
    catch(e){toast('That file could not be read');}};
  rd.readAsText(f);
}
function openSessionDetail(sid){
  const s=state.sessions.find(x=>x.id===sid);if(!s)return;
  openSheet(fmtDate(s.date),`<div class="sess-meta" style="margin:0 0 16px"><span class="muted">Volume <b>${fmtVol(volOf(s))} ${U()}</b></span><span class="muted">Sets <b>${setsOf(s)}</b></span><span class="muted">${new Date(s.date).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</span></div>
    ${s.exercises.map(e=>{const ex=EX[e.id];return `<div class="card" style="padding:13px 15px;margin-bottom:10px">
      <div style="display:flex;gap:11px;align-items:center;margin-bottom:9px"><div class="ex-ic" style="width:36px;height:36px">${exIcon(ex?ex.group:'Core')}</div><div class="ex-name">${esc(ex?ex.name:e.name)}</div></div>
      <div class="setgrid" style="padding:0"><div class="set-hdr"><div>Set</div><div>${U()}</div><div>Reps</div><div></div></div>
      ${e.sets.filter(st=>st.done!==false).map((st,i)=>`<div class="set-row"><div class="set-no ${st.warm?'warm':''}">${st.warm?'W':i+1}</div><div class="numwrap" style="justify-content:center"><span class="mono" style="font-size:16px;font-weight:600">${st.w||0}</span></div><div class="numwrap" style="justify-content:center"><span class="mono" style="font-size:16px;font-weight:600">${st.r||0}</span></div><div></div></div>`).join('')}</div></div>`;}).join('')}
    <div style="display:flex;gap:9px;margin:8px 0 10px"><button class="btn ghost" style="flex:1" data-editsess="${s.id}">✎ Edit</button><button class="btn ghost" style="flex:1" data-repeatfrom="${s.id}">↻ Repeat</button></div>
    <button class="btn ghost block" data-routinefrom="${s.id}" style="margin-bottom:10px">★ Save as routine</button>
    <button class="linkbtn dim" data-delsess="${s.id}" style="display:block;text-align:center;width:100%">Delete this session</button>`);
  const body=$('#sheetBody');
  body.querySelector('[data-repeatfrom]').addEventListener('click',()=>{closeSheet();startSession(s.exercises.map(e=>e.id),'Loaded — weights prefilled');setTab('today');});
  body.querySelector('[data-editsess]').addEventListener('click',()=>{closeSheet();startEdit(s);});
  body.querySelector('[data-routinefrom]').addEventListener('click',()=>{closeSheet();saveAsRoutine(s);});
  body.querySelector('[data-delsess]').addEventListener('click',()=>showConfirm('Delete session?','This removes the workout from your history.','Delete',()=>{
    const copy=JSON.parse(JSON.stringify(s));S.deleteSession(s.id);closeSheet();render();
    toast('Session deleted',{label:'Undo',fn:()=>{S.restoreSession(copy);render();toast('Restored');}});}));
}

/* ---------------- actions ---------------- */
function addExerciseToCur(id){
  if(todayScreen!=='edit'&&!state.active){S.setActive(newSession([]));}
  const t=cur();
  if(t.exercises.some(x=>x.id===id)){toast('Already added');return;}
  t.exercises.push(B.seedExercise(id,state.sessions,t.id));
  persistCur();if(todayScreen!=='edit')todayScreen='active';
  if(currentTab!=='today')setTab('today');else render();
  toast(EX[id].name+' added');
}
function reorderCur(){
  const t=cur();if(!t||t.exercises.length<2)return;
  const counts={};t.exercises.forEach(e=>{const g=EX[e.id]&&EX[e.id].group;if(g)counts[g]=(counts[g]||0)+1;});
  const focus=Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0];
  const map={};t.exercises.forEach(e=>map[e.id]=e);
  t.exercises=B.orderByFatigue(t.exercises.map(e=>e.id),focus).map(id=>map[id]);
  persistCur();render();toast('Ordered for best performance');
}
// A set counts as performed if it was ticked done or has a weight entered. Prefilled reps alone
// never count — otherwise untouched prescribed sets would pollute history.
function cleanSets(s){
  s.exercises.forEach(e=>{e.sets=e.sets.filter(st=>st.done||+st.w).map(st=>Object.assign(st,{done:true}));});
  s.exercises=s.exercises.filter(e=>e.sets.length);
}
function finishWorkout(){
  const s=state.active;cleanSets(s);
  if(!s.exercises.length){toast('Log at least one set first');return;}
  s.completed=true;s.updatedAt=Date.now();
  S.upsertSession(s,false);state.active=null;S.persistActive();todayScreen='home';
  toast('Workout saved 💪');setTab('history');
}
function startEdit(s){editSession=JSON.parse(JSON.stringify(s));editDirty=false;todayScreen='edit';setTab('today');}
function finishEdit(){
  const s=editSession;cleanSets(s);
  if(!s.exercises.length){toast('Keep at least one set, or delete the session instead');return;}
  s.updatedAt=Date.now();S.upsertSession(s,false);
  editSession=null;editDirty=false;todayScreen='home';toast('Changes saved');setTab('history');
}
function leaveEditor(){
  if(todayScreen==='edit'){
    const go=()=>{editSession=null;editDirty=false;todayScreen='home';setTab('history');};
    if(editDirty)showConfirm('Discard changes?','Your edits to this session will be lost.','Discard',go);else go();
  }else{todayScreen='home';render();}
}

/* ---------------- bind ---------------- */
function bindClick(sel,fn){const el=$(sel);if(el)el.addEventListener('click',fn);}
function bind(){
  const v=$('#view');
  bindClick('#btnStartFlow',()=>{todayScreen='start';render();});
  bindClick('#btnResume',()=>{todayScreen='active';render();});
  bindClick('#btnGoLibrary',()=>setTab('library'));
  bindClick('#btnBackHome',leaveEditor);
  const gp=$('#groupPick');if(gp)gp.addEventListener('click',e=>{const b=e.target.closest('[data-g]');if(!b)return;const g=b.dataset.g;pickedGroups.has(g)?pickedGroups.delete(g):pickedGroups.add(g);b.classList.toggle('on');});
  bindClick('#btnRecommend',()=>{const ids=B.buildRecommendation([...pickedGroups],state.sessions);pickedGroups.clear();startSession(ids,'Workout built — adjust anything');});
  bindClick('#btnBlank',()=>startSession([]));
  v.querySelectorAll('[data-repeat]').forEach(b=>b.addEventListener('click',()=>{const s=state.sessions.find(x=>x.id===b.dataset.repeat);if(s)startSession(s.exercises.map(e=>e.id),'Loaded — weights prefilled from history');}));
  v.querySelectorAll('[data-routine]').forEach(el=>el.addEventListener('click',e=>{
    if(e.target.closest('[data-delroutine]'))return;
    const r=state.routines.find(x=>x.id===el.dataset.routine);if(r)startSession(r.exIds,r.name+' loaded');}));
  v.querySelectorAll('[data-delroutine]').forEach(b=>b.addEventListener('click',()=>{
    const r=state.routines.find(x=>x.id===b.dataset.delroutine);if(!r)return;
    showConfirm('Delete routine?',r.name+' will be removed.','Delete',()=>{const copy=Object.assign({},r);S.deleteRoutine(r.id);render();toast('Routine deleted',{label:'Undo',fn:()=>{S.saveRoutine(copy);render();}});});}));
  // editor
  bindClick('#btnAddEx',openAddExercise);
  const sg=v.querySelector('[data-suggest]');if(sg)sg.addEventListener('click',()=>addExerciseToCur(sg.dataset.suggest));
  bindClick('#btnReorder',reorderCur);
  bindClick('#btnSaveRoutine',()=>saveAsRoutine(cur()));
  bindClick('#btnFinish',finishWorkout);
  bindClick('#btnSaveEdit',finishEdit);
  bindClick('#btnDiscard',()=>showConfirm('Discard workout?','Nothing from this session will be saved.','Discard',()=>{
    const copy=state.active;state.active=null;S.persistActive();todayScreen='home';render();
    toast('Workout discarded',{label:'Undo',fn:()=>{S.setActive(copy);todayScreen='active';render();}});}));
  const ll=$('#logList');if(ll)bindLog(ll);
  // history
  const sl=$('#sessList'),cal=v.querySelector('.cal-grid');
  if(cal)cal.addEventListener('click',e=>{const c=e.target.closest('[data-day]');if(!c)return;const d=+c.dataset.day;selDay=selDay===d?null:d;render();});
  v.querySelectorAll('[data-mon]').forEach(b=>b.addEventListener('click',()=>{calMonth+=+b.dataset.mon;selDay=null;render();}));
  if(sl)sl.addEventListener('click',e=>{const c=e.target.closest('[data-sess]');if(c)openSessionDetail(c.dataset.sess);});
  // library
  const ls=$('#libSearch');if(ls)ls.addEventListener('input',()=>{libQuery=ls.value;const pos=ls.selectionStart;render();const n=$('#libSearch');if(n){n.focus();n.setSelectionRange(pos,pos);}});
  v.querySelectorAll('[data-lg]').forEach(b=>b.addEventListener('click',()=>{libGroup=b.dataset.lg;render();}));
  // library rows: the "+" adds straight to today's workout; the rest of the row opens details
  v.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',e=>{
    if(e.target.closest('.ex-add')){addExerciseToCur(b.dataset.open);return;}
    openSheet(EX[b.dataset.open].name,exerciseDetail(b.dataset.open));}));
}
function bindLog(root){
  root.addEventListener('click',e=>{
    const t=cur();if(!t)return;
    const chk=e.target.closest('[data-check]');if(chk){const ei=+chk.dataset.check,si=+chk.dataset.s;const st=t.exercises[ei].sets[si];st.done=!st.done;
      if(st.done&&todayScreen==='active'&&state.settings.rest.auto&&!st.warm)startRest(restSecondsFor(t.exercises[ei].id));persistCur();render();return;}
    const wm=e.target.closest('[data-warm]');if(wm){const ei=+wm.dataset.warm,si=+wm.dataset.s;const st=t.exercises[ei].sets[si];st.warm=!st.warm;persistCur();render();toast(st.warm?'Marked as warm-up':'Counted as a working set');return;}
    const step=e.target.closest('[data-step]');if(step){const ei=+step.dataset.ei,si=+step.dataset.s,f=step.dataset.step,d=+step.dataset.d;const st=t.exercises[ei].sets[si];let v=+st[f]||0;v+=f==='w'?d*inc():d;if(v<0)v=0;st[f]=v;persistCur();const inp=$(`input[data-f="${f}"][data-ei="${ei}"][data-s="${si}"]`);if(inp)inp.value=v;return;}
    const add=e.target.closest('[data-addset]');if(add){const ei=+add.dataset.addset;const sets=t.exercises[ei].sets;const last=sets[sets.length-1]||{w:'',r:''};sets.push({w:last.w,r:last.r,done:false});persistCur();render();return;}
    const del=e.target.closest('[data-delex]');if(del){const ei=+del.dataset.delex;const removed=t.exercises.splice(ei,1)[0];persistCur();render();
      toast(removed.name+' removed',{label:'Undo',fn:()=>{const c=cur();if(c){c.exercises.splice(ei,0,removed);persistCur();render();}}});return;}
    const bwp=e.target.closest('[data-bumpw]');if(bwp){const ei=+bwp.dataset.bumpw;t.exercises[ei].sets.forEach(s=>{s.w=(+s.w||0)+inc();});persistCur();render();toast('Weights bumped +'+inc()+U());return;}
    const oe=e.target.closest('[data-openex]');if(oe){openSheet(EX[oe.dataset.openex].name,exerciseDetail(oe.dataset.openex));return;}
  });
  root.addEventListener('input',e=>{const inp=e.target.closest('input[data-f]');if(!inp)return;const t=cur();if(!t)return;
    const ei=+inp.dataset.ei,si=+inp.dataset.s,f=inp.dataset.f;const val=inp.value.replace(/[^0-9.]/g,'');
    t.exercises[ei].sets[si][f]=val===''?'':(f==='r'?parseInt(val)||val:parseFloat(val)||val);persistCur();});
}

/* ---------------- rest timer ---------------- */
let restState=null,restInt=null,audioCtx=null;
function unlockAudio(){try{if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();}catch(e){}}
function beep(){
  if(!state.settings.rest.sound)return;
  try{if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();const t=audioCtx.currentTime;
    [0,0.22,0.44].forEach((d,i)=>{const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.frequency.value=i===2?1046:784;o.type='sine';o.connect(g);g.connect(audioCtx.destination);
      g.gain.setValueAtTime(0.0001,t+d);g.gain.exponentialRampToValueAtTime(0.35,t+d+0.02);g.gain.exponentialRampToValueAtTime(0.0001,t+d+0.18);o.start(t+d);o.stop(t+d+0.2);});
  }catch(e){}
}
function restSecondsFor(exId){const ex=EX[exId];const r=state.settings.rest;return ex?(ex.type===C?r.compound:r.isolation):90;}
function startRest(seconds){
  if(!seconds||seconds<5)return;
  restState={total:seconds,end:Date.now()+seconds*1000};
  const bar=$('#restbar');bar.classList.add('on');bar.classList.remove('done');$('#restLbl').textContent='Rest';
  clearInterval(restInt);restInt=setInterval(tickRest,300);tickRest();
}
function tickRest(){
  if(!restState)return;
  const rem=Math.max(0,restState.end-Date.now()),s=Math.ceil(rem/1000);
  $('#restTime').textContent=Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
  $('#restProg').style.width=(100-(rem/(restState.total*1000))*100)+'%';
  if(rem<=0)finishRest();
}
function finishRest(){
  clearInterval(restInt);restInt=null;
  const bar=$('#restbar');bar.classList.add('done');$('#restLbl').textContent='Rest done';$('#restTime').textContent='Go!';$('#restProg').style.width='100%';
  beep();try{if(navigator.vibrate)navigator.vibrate([180,90,180]);}catch(e){}
  if(state.settings.rest.notify&&'Notification'in window&&Notification.permission==='granted'){try{new Notification('Rest complete 💪',{body:'Time for your next set.'});}catch(e){}}
  restState=null;setTimeout(()=>{const b=$('#restbar');if(b.classList.contains('done'))stopRest();},5000);
}
function stopRest(){clearInterval(restInt);restInt=null;restState=null;const b=$('#restbar');b.classList.remove('on','done');}

/* ---------------- boot ---------------- */
function boot(){
  state.sessions.forEach(s=>{if(!s.schema)s.schema=SCHEMA;});   // schema migrations live here
  document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
  $('#sheetClose').addEventListener('click',closeSheet);$('#scrim').addEventListener('click',closeSheet);
  $('#cdCancel').addEventListener('click',closeConfirm);$('#cscrim').addEventListener('click',closeConfirm);
  $('#cdOk').addEventListener('click',()=>{const cb=_confirmCb;closeConfirm();if(cb)cb();});
  $('#sheetBody').addEventListener('click',e=>{const a=e.target.closest('[data-addto]');if(a){addExerciseToCur(a.dataset.addto);closeSheet();}});
  $('#btnSettings').addEventListener('click',openSettings);
  $('#restSkip').addEventListener('click',stopRest);
  $('#restAdd').addEventListener('click',()=>{if(!restState)return;restState.end+=15000;restState.total+=15;$('#restbar').classList.remove('done');if(!restInt)restInt=setInterval(tickRest,300);tickRest();});
  document.addEventListener('pointerdown',unlockAudio);
  // re-render on cloud changes, but never yank focus from someone typing a weight
  S.onChange(()=>{updateCloud();const a=document.activeElement;if(a&&a.tagName==='INPUT')return;render();});
  applyTheme();setTab('today');S.initCloud();
  if(state.justSeeded)setTimeout(()=>toast('Sample data loaded — explore every tab'),600);
}
IL.ui={toast,render,setTab,openSettings,boot};
boot();
