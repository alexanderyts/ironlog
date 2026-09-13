// UI, part 2 of 4 — TODAY: home, the New-workout screen, the live/edit session editor and set rows.
// (Shares scope with ui-core/ui-views/ui-bind — see ui-core.js header.)
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
    ${profileIntroCard()}
    ${state.active?resumeCard():''}
    <div class="statgrid" style="grid-template-columns:1fr 1fr 1fr;margin:16px 0 18px;gap:9px">
      <div class="card stat" style="padding:14px 12px"><div class="k">This wk</div><div class="v mono">${wk.length}</div></div>
      <div class="card stat" style="padding:14px 12px"><div class="k">Streak</div><div class="v mono">${streak}<small>wk</small></div></div>
      <div class="card stat" style="padding:14px 12px"><div class="k">${volLabel()}</div><div class="v mono">${fmtVol(wkVol)}</div></div>
    </div>
    ${state.active?'':`<button class="btn primary block" id="btnStartFlow" data-action="startFlow" style="height:56px;font-size:16px">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg> Start a workout</button>`}
    ${last?`<div class="eyebrow" style="margin:26px 2px 10px">Last session</div>${sessCard(last)}`:emptyHome()}
    <div class="eyebrow" style="margin:24px 2px 10px">Jump in</div>
    <button class="btn ghost block" id="btnGoLibrary" data-action="goLibrary" style="justify-content:space-between">
      <span>Browse exercise library</span><span class="dim mono">${EXERCISES.length} exercises ›</span></button>
  </div>`;
}
function emptyHome(){return `<div class="card" style="padding:26px 18px;text-align:center;margin-top:20px"><div class="dim">No workouts logged yet.<br>Tap <b style="color:var(--accent)">Start a workout</b> above to log your first session.</div></div>`;}
// One-time card introducing the optional training profile (P1). Dismissed by either button (synced).
function profileIntroCard(){
  if(seenFlag('profileIntro'))return '';
  return `<div class="card" id="profileIntro" style="margin:16px 0 0;padding:16px;border:1px solid color-mix(in srgb,var(--accent) 45%,transparent)">
    <div style="font-weight:700;font-size:15px">New: a training profile</div>
    <div class="dim" style="font-size:13px;line-height:1.5;margin-top:5px">Tell Ironlog your goal, the kind of gym you use, days per week and anything you're protecting, and it builds around that. Skip it and you get the balanced default — the same as today.</div>
    <div style="display:flex;gap:9px;margin-top:13px"><button class="btn primary sm" data-action="profileGo">Take me there</button><button class="btn ghost sm" data-action="profileSkip">I'm good</button></div></div>`;
}
function resumeCard(){
  const s=state.active;const sets=setsOf(s);
  return `<button class="resume" id="btnResume" data-action="resume">
    <span class="tri"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>
    <span style="flex:1;min-width:0"><span style="font-weight:700;display:block">Resume your workout</span><span class="dim" style="font-size:13px">${s.exercises.length} exercise${s.exercises.length!==1?'s':''} · ${sets} set${sets!==1?'s':''} logged${P.staleness(s).sinceLastSet>=P.STALE_AFTER_MIN?` · <span style="color:var(--warn)">idle ${fmtDur(P.staleness(s).sinceLastSet)}</span>`:''}</span></span>
    <span style="color:var(--accent);font-size:20px;flex-shrink:0">→</span></button>`;
}
function startWorkoutView(){
  return `
  <div class="section">
    <div class="topbar"><button class="backbtn" id="btnBackHome" data-action="backHome">${ICON_BACK} Home</button></div>
    <div style="padding:0 2px">
      <div class="eyebrow">New workout</div>
      <h2 style="font-size:24px;margin-top:6px">What are you training?</h2>
      <p class="muted" style="margin:7px 0 0">Pick your muscle groups (first pick leads the session) and I'll build a balanced plan — or start from scratch.</p>
    </div>
    <div style="height:18px"></div>${coachNudge()}
    <div class="eyebrow" style="margin:16px 2px 10px">Quick picks</div>
    <div class="chips hscroll" id="presetPick">${PRESETS.map(p=>`<button class="chip ${presetOn(p)?'on':''}" data-action="preset" data-preset="${p.label}">${p.label}</button>`).join('')}</div>
    <div class="eyebrow" style="margin:16px 2px 10px">Target muscle groups</div>
    <div class="chips" id="groupPick">${GROUPS.map(g=>`<button class="chip ${draft.groups.has(g)?'on':''}" data-g="${g}">${g}</button>`).join('')}</div>
    <div class="card settingrow" style="margin:18px 0 0;padding:14px 15px"><div><div style="font-weight:600">Deload / recovery session</div><div class="dim" style="font-size:12.5px">Sore or beat up? Build it ~60% lighter — full range, focus on the stretch. Won't count against your progress or PRs.</div></div><button class="sw ${draft.deload?'on':''}" id="deloadToggle" data-action="deloadToggle" aria-label="Deload session"></button></div>
    <div class="spacer"></div><div class="spacer"></div>
    <div id="buildBtns">${buildButtons()}</div>
    <div class="dim" data-action="profileOpen" style="text-align:center;font-size:12px;margin:10px 0 2px;cursor:pointer">Profile: ${profileSummary()} · <span style="color:var(--accent)">change</span></div>
    <button class="btn ghost block" id="btnBlank" data-action="blank">Start from scratch</button>
    ${routineList()}
    ${recentTemplates()}
  </div>`;
}
// The build button knows whether these muscles have a plan in progress (see planWorkout in
// builder.js) and says so, so "continue" is the obvious default and "fresh" a deliberate choice.
const ICON_BUILD='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2 2M16.4 16.4l2 2M18.4 5.6l-2 2M7.6 16.4l-2 2"/><circle cx="12" cy="12" r="3.2"/></svg>';
function buildButtons(){
  const dl=draft.deload;
  const plan=draft.groups.size?B.findPlan([...draft.groups],state.sessions):null;
  if(!plan)return `<button class="btn primary block" id="btnRecommend" data-action="build" style="height:56px;font-size:16px">${ICON_BUILD} ${dl?'Build me a deload':'Build me a workout'}</button>`;
  // On a deload we continue the SAME plan lighter — no "Session N" progression framing.
  if(dl)return `<button class="btn primary block" id="btnRecommend" data-action="build" style="height:auto;padding:12px 16px;font-size:16px;flex-direction:column;gap:2px">
      <span style="display:flex;align-items:center;gap:8px">🌿 Deload this plan</span>
      <span style="font-size:12.5px;font-weight:500;opacity:.85">${plan.exercises.length} exercises from ${relDay(plan.date).toLowerCase()} · lighter loads</span></button>
    <div style="height:8px"></div>
    <button class="btn ghost block" id="btnFresh" data-action="buildFresh">Build a fresh deload instead</button>`;
  const wk=Math.min(...plan.exercises.map(e=>B.exerciseStreak(state.sessions,e.id)))+1;
  return `<button class="btn primary block" id="btnRecommend" data-action="build" style="height:auto;padding:12px 16px;font-size:16px;flex-direction:column;gap:2px">
      <span style="display:flex;align-items:center;gap:8px">${ICON_BUILD} Continue your plan</span>
      <span style="font-size:12.5px;font-weight:500;opacity:.85">Session ${wk} · ${plan.exercises.length} exercises from ${relDay(plan.date).toLowerCase()}</span></button>
    <div style="height:8px"></div>
    <button class="btn ghost block" id="btnFresh" data-action="buildFresh">Build a fresh plan instead</button>`;
}
// Re-render just the build buttons in place (their label depends on the picked groups / deload).
function refreshBuildBtns(){const bb=$('#buildBtns');if(bb)bb.innerHTML=buildButtons();}
// Is this preset exactly the current selection? (so its chip lights up, and re-tapping clears)
function presetOn(p){return draft.groups.size===p.groups.length&&p.groups.every(g=>draft.groups.has(g));}
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
      <span style="text-align:left"><span style="font-weight:700;display:block">${relDay(s.date)}</span><span class="dim" style="font-size:13px;font-weight:500">${esc(s.exercises.map(e=>EX[e.id]?EX[e.id].name:e.name).slice(0,3).join(' · '))}${s.exercises.length>3?' +'+(s.exercises.length-3):''}</span></span>
      <span class="ex-add" style="background:var(--surface-2)">↻</span></button>`).join('');
}
const SCHEMA=1;
function newSession(exIds,deload,volumeBump){const pf=state.settings.profile||{},goal=pf.goal,setStyle=pf.sets,push=pf.push;const s={id:S.uid(),schema:SCHEMA,date:Date.now(),updatedAt:Date.now(),completed:false,exercises:(exIds||[]).map(id=>B.seedExercise(id,state.sessions,{unit:U(),deload,extraSet:volumeBump&&volumeBump.indexOf(id)>=0,goal,setStyle,push}))};if(deload)s.deload=true;return s;}
// The ONLY way a workout begins. spec: {ids, deload, msg, volumeBump, source}. Every start path —
// build / blank / repeat / routine / history-repeat — routes through here, so the draft reset (and,
// from Phase 1, the discard guard) live in one place instead of at each call site.
function startSession(spec){
  spec=spec||{};
  const begin=()=>{
    S.setActive(newSession(spec.ids||[],!!spec.deload,spec.volumeBump));
    resetDraft();
    todayScreen='active';render();
    if(spec.msg)toast(spec.msg);
  };
  // Guard: don't silently overwrite a workout that already has logged sets (Repeat/Routine/Build).
  if(spec.source!=='add'&&state.active&&setsOf(state.active)>0){
    showConfirm('Discard the workout in progress?','Your current workout has logged sets. Starting a new one will discard them.','Discard & start',begin);
    return;
  }
  begin();
}
// Equipment picker for a logged exercise. Changing it re-scopes progression/PRs to that modality
// (see modeOf/lastPerf); entered sets are kept (you're relabelling how it was done, not clearing it).
// The choice is stored only when it differs from the exercise's native equipment, so data stays clean.
function openModePicker(ei){
  const t=cur();if(!t||!t.exercises[ei])return;const ex=t.exercises[ei];const native=EX[ex.id]?EQUIP_MODE[EX[ex.id].equip]:'barbell';const curMode=modeOf(ex);
  openSheet('How did you do it?',`<div class="dim" style="font-size:13px;margin:-4px 2px 14px">Progress and PRs are tracked separately for each — a Smith press won’t be compared to dumbbells.</div>
    <div class="modelist">${MODE_ORDER.map(m=>`<button class="ex-row modeopt ${m===curMode?'on':''}" data-pickmode="${m}">
      <div style="flex:1;min-width:0"><div class="ex-name">${esc(MODES[m].label)}${m===native?' <span class="dim" style="font-weight:400;font-size:11px">· default</span>':''}</div>
      <div class="ex-sub">${MODES[m].perHand?'Enter the weight of one dumbbell':MODES[m].e1rm?'Free-weight loading':'Stack / cable — shown as load, not a 1RM'}</div></div>
      ${m===curMode?'<span style="color:var(--accent);font-size:18px">✓</span>':''}</button>`).join('')}</div>`);
  $('#sheetBody').querySelectorAll('[data-pickmode]').forEach(b=>b.addEventListener('click',()=>{
    const m=b.dataset.pickmode;if(m===native)delete ex.mode;else ex.mode=m;
    persistCur();closeSheet();render();toast(MODES[m].label);}));
}
// A free-text note on an exercise in THIS session — timestamped by the session, saved with it, synced
// with it. Surfaced next time you do the lift ("shoulder was hurting", a form cue) so a number that
// looks low has its reason next to it.
function openNote(ei){
  const t=cur();if(!t||!t.exercises[ei])return;const ex=t.exercises[ei];
  openSheet('Note · '+(EX[ex.id]?EX[ex.id].name:ex.name),`<div class="dim" style="font-size:13px;margin:-4px 2px 12px">Saved with this session and shown the next time you do this lift.</div>
    <textarea id="noteText" class="field" style="height:110px;padding:12px 14px;resize:none;line-height:1.45" maxlength="500" placeholder="e.g. left shoulder pinchy at the bottom — stayed light">${esc(ex.note||'')}</textarea>
    <button class="btn primary block" id="noteSave" style="margin-top:12px">Save note</button>
    ${ex.note?'<button class="btn ghost block" id="noteClear" style="margin-top:8px">Remove note</button>':''}`);
  const ta=$('#noteText');if(ta){ta.focus();ta.setSelectionRange(ta.value.length,ta.value.length);}
  $('#noteSave').addEventListener('click',()=>{const v=(ta.value||'').trim();if(v)ex.note=v.slice(0,500);else delete ex.note;persistCur();closeSheet();render();toast(v?'Note saved':'Note removed');});
  const nc=$('#noteClear');if(nc)nc.addEventListener('click',()=>{delete ex.note;persistCur();closeSheet();render();toast('Note removed');});
}
function buildAndStart(fresh){
  const dl=draft.deload;
  // Coach's findings feed the builder (Phase C). The engine ignores them on a deload (recovery isn't
  // the time to add volume/coverage), so we always pass them and let planWorkout decide.
  const hints=A.buildHints(state.sessions,Date.now(),bw());
  const p=B.planWorkout([...draft.groups],state.sessions,null,{fresh,hints,deload:dl,profile:state.settings.profile});
  let msg='Workout built — adjust anything';
  if(p.deload)msg=p.mode==='continue'?'Deload — same plan, lighter loads, focus on the stretch':'Deload built — lighter loads, focus on the stretch';
  else if(p.mode==='continue'){
    const gapAdd=(p.reactions||[]).find(r=>r.type==='gap-add');
    if(p.rotation&&p.rotation.anchor)msg=`Swapped ${EX[p.rotation.from].name} → ${EX[p.rotation.to].name} — it stalled through a deload`;
    else if(p.rotation)msg=`Plan continued · swapped ${EX[p.rotation.from].name} → ${EX[p.rotation.to].name} (it stalled)`;
    else if(gapAdd)msg=`Plan continued · added ${EX[gapAdd.exId].name} — ${gapAdd.why}`;
    else if(p.volumeBump&&p.volumeBump.length)msg='Plan continued · +1 set where your volume was low';
    else msg='Plan continued — weights progressed from last time';
  }
  startSession({ids:p.ids,msg,deload:p.deload,volumeBump:p.volumeBump,source:'build'});
}
// Reaction 1: a one-tap nudge toward the muscles the coach says are light or unbalanced this week.
function coachNudge(){
  const h=A.buildHints(state.sessions,Date.now(),bw());
  if(!h.suggestGroups.length)return '';
  return `<button class="btn ghost block" id="coachNudge" data-action="coachNudge" data-groups="${h.suggestGroups.join(',')}" style="justify-content:flex-start;gap:10px;margin:0 0 4px;height:auto;padding:12px 14px;border-style:dashed;text-align:left">
    <span style="color:var(--accent);font-size:16px;flex-shrink:0">✦</span>
    <span style="min-width:0"><span style="font-weight:700;display:block;font-size:13.5px">Coach suggests: ${esc(h.suggestGroups.join(' & '))}</span><span class="dim" style="font-size:12px">Light or unbalanced lately — tap to select</span></span></button>`;
}

/* ---------------- session editor (live workout or editing a past one) ---------------- */
// Forgotten-Finish banner (T2): only on the LIVE workout, only once it's been idle a long time. The
// app never ends the session itself — this just notices and points at Finish / Discard.
function staleBanner(s){
  const st=P.staleness(s);if(st.sinceLastSet<P.STALE_AFTER_MIN)return '';
  const ago=st.lastSetAt?`Your last set was ${fmtDur(st.sinceLastSet)} ago (${fmtClock(st.lastSetAt)})`:`Started ${fmtDur(st.sinceStart)} ago with nothing logged yet`;
  return `<div class="card" id="staleBanner" style="margin:0 0 14px;padding:13px 15px;background:color-mix(in srgb,var(--warn) 14%,transparent);border:1px solid color-mix(in srgb,var(--warn) 40%,transparent)">
    <div style="font-weight:600;color:var(--warn);font-size:13.5px">Still training?</div>
    <div class="dim" style="font-size:12.5px;margin-top:3px">${ago}. Finish to log it (you'll pick the end time), or discard.</div>
    <div style="display:flex;gap:8px;margin-top:11px"><button class="btn good sm" data-action="staleFinish">Finish workout</button><button class="btn ghost sm" data-action="staleDiscard">Discard</button></div></div>`;
}
function editorView(s,mode){
  const vol=volOf(s),sets=setsOf(s),edit=mode==='edit';
  return `
  <div class="section">
    <div class="topbar"><button class="backbtn" id="btnBackHome" data-action="backHome">${ICON_BACK} ${edit?'Cancel':'Home'}</button>
      ${edit?'':'<button class="linkbtn dim" id="btnDiscard">Discard</button>'}</div>
    <div style="padding:0 2px 2px"><div class="eyebrow">${edit?'Editing · '+fmtDate(s.date):`Workout in progress · saves automatically · <span id="elapsedLbl">${fmtElapsed(s.date)}</span>`}</div>
      <h2 style="font-size:23px;margin-top:4px">${new Date(s.date).toLocaleDateString(undefined,{weekday:'long'})}'s session${s.deload?' <span class="deload-badge">Deload</span>':''}</h2></div>
    ${edit?'':staleBanner(s)}
    ${s.deload?`<div class="card" style="margin:0 0 14px;padding:12px 14px;background:var(--good-soft);border:1px solid color-mix(in srgb,var(--good) 30%,transparent)"><div style="font-weight:600;color:var(--good);font-size:13.5px">🌿 Recovery session</div><div class="dim" style="font-size:12.5px;margin-top:3px">Lighter loads on purpose — take each rep through a full range, feel the stretch, and stop 3–4 reps shy of failure. This won't affect your progression or PRs.</div></div>`:''}
    <div class="statgrid" style="margin:14px 0 18px">
      <div class="card stat"><div class="k">Working sets</div><div class="v mono" id="stSets">${sets}</div></div>
      <div class="card stat"><div class="k">${volLabel()}</div><div class="v mono" id="stVol">${fmtVol(vol)}<small>${U()}</small></div></div>
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
  const ex=EX[e.id];let sugg='',prLine='';const emode=modeOf(e);
  if(mode==='active'&&!s.deload){
    // Live PR recognition: the session's best working set beating this lift's all-time best (same mode)
    const histBest=P.bestE1rmBefore(state.sessions,e.id,{mode:emode,bw:bw(),excludeId:s.id});
    if(histBest>0){let best=0,bs=null;e.sets.forEach(st=>{if(st.warm||!P.isWorking(st))return;const est=P.e1rm(P.setLoad(e.id,st.w,bw()),+st.r||0);if((+st.r)&&est>best){best=est;bs=st;}});
      if(bs&&best>histBest)prLine=`<div class="sugg" style="color:var(--good);background:var(--good-soft)"><span>★ New PR — ${bs.w}${U()}${MODES[emode]&&MODES[emode].perHand?'/ea':''} × ${bs.r} <span class="dim">est ${Math.round(best)}${U()}</span></span></div>`;}
  }
  if(mode==='active'&&s.deload){
    sugg=`<div class="sugg match" style="color:var(--good);background:var(--good-soft)"><span>🌿 Recovery — lighter on purpose, own the stretch</span></div>`;
  }else if(mode==='active'){
    const pf=state.settings.profile||{},sgRr=pf.goal?P.repRange(EX[e.id],pf.goal):undefined;
    const sg=P.suggestion(state.sessions,e.id,{unit:U(),activeDate:s.date,activeId:s.id,mode:emode,push:pf.push,rr:sgRr});
    if(sg.lp){const w=sg.kind==='weight';
      // The prescription is already in the set rows; offer a one-tap revert until a set is done
      const canRevert=w&&!e.sets.some(st=>st.done);
      sugg=`<div class="sugg ${w?'':'match'}"><span>${w?'💪 ':''}${esc(sg.text)} · <span class="lastp">last: ${esc(sg.setsStr)}</span></span>${canRevert?`<button class="apply" data-keepw="${ei}">Keep last</button>`:''}</div>`;}
    else if(sg.kind==='new')sugg=`<div class="sugg match"><span>${esc(sg.text)}</span></div>`;
    // A note you left last time on this lift — shown so a lower-than-expected weight has its reason next to it
    if(sg.lp&&sg.lp.note)sugg+=`<div class="sugg match" style="color:var(--ink-2)"><span>📝 <span class="dim">${relDay(sg.lp.date)}:</span> ${esc(sg.lp.note)}</span></div>`;
  }
  const noteLine=e.note?`<button class="sugg match" data-note="${ei}" style="width:calc(100% - 24px);text-align:left;color:var(--ink-2)"><span>📝 ${esc(e.note)}</span></button>`:'';
  const whdr=(U()==='kg'?'Kg':'Lb')+(MODES[emode]&&MODES[emode].perHand?' ea':'');
  return `<div class="card log-ex" data-ei="${ei}">
    <div class="log-ex-head">
      <div class="ex-ic">${exIcon(ex?ex.group:'Core')}</div>
      <button data-openex="${e.id}" style="flex:1;min-width:0;text-align:left;background:none;padding:0"><div class="ex-name">${esc(e.name)} <span class="dim" style="font-weight:400;font-size:12px">ⓘ</span></div>
        <div class="ex-sub">${ex?ex.muscles.join(' · '):''} · target ${ex?ex.rr[0]+'–'+ex.rr[1]:'8–12'} reps</div></button>
      <button class="sheet-x" data-delex="${ei}" aria-label="Remove exercise">✕</button>
    </div>
    <button class="modechip" data-mode="${ei}" aria-label="Change equipment">${esc(MODES[emode]?MODES[emode].label:emode)} ▾</button>
    ${prLine}${sugg}${noteLine}
    <div class="setgrid">
      <div class="set-hdr"><div>Set</div><div>${whdr}</div><div>Reps</div><div></div></div>
      ${e.sets.map((st,si)=>setRow(st,ei,si)).join('')}
    </div>
    <div class="set-actions">
      <button class="linkbtn" data-addset="${ei}">＋ Add set</button>
      ${e.sets.length>1?`<button class="linkbtn" data-delset="${ei}">－ Remove set</button>`:''}
      <button class="linkbtn dim" data-note="${ei}">✎ ${e.note?'Edit note':'Note'}</button>
      <a class="linkbtn dim" href="${demoURL(e.id)}" target="_blank" rel="noopener noreferrer" style="margin-left:auto;text-decoration:none">▶ Watch demo</a>
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

