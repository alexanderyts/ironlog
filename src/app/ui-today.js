// UI, part 2 of 4 — TODAY: home, the New-workout screen, the live/edit session editor and set rows.
// (Shares scope with ui-core/ui-views/ui-bind — see ui-core.js header.)
/* ---------------- TODAY ---------------- */
function viewToday(){
  if(todayScreen==='edit'&&editSession)return editorView(editSession,'edit');
  if(todayScreen==='active'&&state.active&&state.active.kind==='cardio')return cardioLiveView(state.active);
  if(todayScreen==='active'&&state.active)return editorView(state.active,'active');
  if(todayScreen==='start')return startWorkoutView();
  return homeView();
}
function homeView(){
  const now=Date.now();
  const wkAny=completedAny().filter(s=>s.date>=P.weekStart(now)).length;   // count includes cardio
  const streak=P.calcStreak(completedAny(),now);
  const hr=new Date().getHours();const greet=hr<12?'Good morning':hr<18?'Good afternoon':'Good evening';
  const last=completedAny()[0];   // most recent session of any kind (lift or cardio)
  return `
  <div class="section">
    <div style="padding:6px 2px 0">
      <div class="eyebrow">${new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</div>
      <h2 style="font-size:27px;margin-top:5px">${greet}${state.settings.name?', '+esc(state.settings.name):''}.</h2>
    </div>
    ${gymPickCard()}
    ${state.active?resumeCard():''}
    ${backupNudge()}
    <div class="dim" id="homeSummary" style="font-size:13.5px;margin:10px 2px 16px">${homeSummary(now,wkAny,streak,last)}</div>   <!-- one line: the full tiles live on Progress (review 5.6) -->
    ${state.active?'':startBlock()}
    ${state.active?'':cardioBlock()}
    ${last?`<div class="eyebrow" style="margin:26px 2px 10px">Last session</div>${sessCard(last)}`:emptyHome()}
    <div class="eyebrow" style="margin:24px 2px 10px">Jump in</div>
    <button class="btn ghost block" data-action="goLibrary" style="justify-content:space-between">
      <span>Browse exercise library</span><span class="dim mono">${EXERCISES.length} exercises ›</span></button>
  </div>`;
}
// One line under the greeting (v0.75). Trained this week → the count. Not yet → last week's recap (a
// fresh week shouldn't open on "0 workouts"). Nothing last week either → how long since the last one.
function homeSummary(now,wkAny,streak,last){
  const sk=streak?` · ${streak}-week streak`:'';
  if(wkAny||!last)return `${wkAny} workout${wkAny!==1?'s':''} this week${sk}`;
  const ws=P.weekStart(now),prev=completedAny().filter(s=>s.date>=ws-7*86400000&&s.date<ws);
  if(prev.length){const sets=prev.reduce((a,s)=>a+(s.kind==='cardio'?0:setsOf(s)),0);
    return `Last week: ${prev.length} workout${prev.length!==1?'s':''}${sets?` · ${sets} sets`:''}${sk}`;}
  const d=Math.round((startOfDay(now)-startOfDay(last.date))/DAY);
  return `Last workout ${d<=1?'yesterday':d+' days ago'} — new week, fresh start`;
}
// "Your lifts live only on this phone" (batch 1): after 3 workouts with no cloud backup, once per 20
// workouts. Export always works; Dropbox is offered where this build has it.
function backupNudge(){
  if(CFG.DEMO||state.cloudName!=='none')return '';
  const n=completedAny().length,key='backupNudge:'+Math.floor(n/20);
  if(n<3||seenFlag(key))return '';
  const dbx=CFG.BUILD==='site'&&DBX&&DBX.isConfigured&&DBX.isConfigured();
  return `<div class="card" style="padding:14px 15px;margin:14px 0 4px;border-color:color-mix(in srgb,var(--warn) 45%,var(--line))">
    <div style="font-weight:700;font-size:14px">Your ${n} workouts are only on this phone</div>
    <div class="dim" style="font-size:12.5px;margin-top:3px;line-height:1.45">If the phone is lost or its storage is cleared, they’re gone. ${dbx?'Connect Dropbox (2 min) to back up automatically, or save a copy now.':'Save a backup copy now — it takes a tap.'}</div>
    <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
      ${dbx?'<button class="btn primary sm" data-action="nudgeDropbox">Connect Dropbox</button>':''}
      <button class="btn ${dbx?'ghost':'primary'} sm" data-action="nudgeExport">Save a backup</button>
      <button class="linkbtn dim" data-seentip="${key}" style="font-size:12.5px">Not now</button></div></div>`;
}
function emptyHome(){return `<div class="card" style="padding:26px 18px;text-align:center;margin-top:20px"><div class="dim">No workouts logged yet.<br>Tap <b style="color:var(--accent)">Start a workout</b> above to log your first session.</div></div>`;}
// Home's primary action: YOU choose what to train. The app doesn't lead with a "plan" it decided —
// it just opens the picker; guidance (your last session, the coach's suggestions, prefilled weights)
// shows up once you've chosen.
function startBlock(){
  const START=`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`;
  return `<button class="btn primary block" data-action="startFlow" style="height:56px;font-size:16px">${START} Start a workout</button>`;
}
/* ---------------- CARDIO ----------------
   A cardio session is its own kind (kind:'cardio', exercises:[]) — invisible to the lifting math.
   Two ways in: Start a live timer (finish stamps the end), or log one you already did by hand. */
const CARDIO_TYPES=[['treadmill','Treadmill'],['elliptical','Elliptical'],['stairmaster','StairMaster'],['outdoor','Outdoor'],['indoor','Indoor']];
const CARDIO_INTS=[['easy','Easy'],['moderate','Moderate'],['hard','Hard']];
const cardioTypeLabel=t=>{const f=CARDIO_TYPES.find(x=>x[0]===t);return f?f[1]:t;};
const cardioIntLabel=i=>{const f=CARDIO_INTS.find(x=>x[0]===i);return f?f[1]:i;};
const CARDIO_ICON=`<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 4.5a1.4 1.4 0 1 0 0-.01M6 21l3-5 3 2 1-4M9 16l-2-3 4-3 2 3h3"/></svg>`;
// The last cardio type this person logged — a small nicety so the picker defaults to their usual.
function lastCardioType(){const c=state.sessions.filter(s=>s.completed!==false&&s.kind==='cardio'&&s.cardio).sort((a,b)=>b.date-a.date)[0];return c?c.cardio.type:'treadmill';}
function cardioBlock(){
  return `<button class="btn ghost block" data-action="cardioOpen" style="margin-top:10px;height:50px;justify-content:center;gap:9px">${CARDIO_ICON} Log cardio</button>`;
}
// Live cardio: a running clock + the type/intensity/distance you can adjust while you go, then Finish.
function cardioLiveView(s){
  const c=s.cardio||{};
  return `
  <div class="section">
    <div class="topbar"><button class="backbtn" data-action="backHome">${ICON_BACK} Home</button>
      <span style="display:flex;gap:10px;align-items:center"><button class="linkbtn dim" id="btnCardioDiscard">Discard</button><button class="btn good sm" id="btnCardioFinish">Finish</button></span></div>
    <div style="padding:0 2px 2px"><div class="eyebrow">Cardio in progress · saves when you finish · <span id="elapsedLbl">${fmtElapsed(s.date)}</span></div>
      <h2 style="font-size:23px;margin-top:4px">${cardioTypeLabel(c.type)}</h2></div>
    <div class="card" style="padding:18px 16px;margin:14px 0 16px;text-align:center">
      <div class="eyebrow" style="margin-bottom:6px">Elapsed</div>
      <div class="mono" id="cardioClock" style="font-size:44px;font-weight:800;letter-spacing:-.02em;font-family:var(--font-display)">${fmtClockElapsed(s.date)}</div></div>
    ${cardioFields(c,'live')}
    <div style="height:14px"></div>
    <button class="btn good block" id="btnCardioFinishBottom">Finish &amp; save cardio</button>
  </div>`;
}
// The shared type/intensity/distance controls, used by both the live view and the manual sheet.
// `ctx` ('live'|'sheet') just namespaces nothing — the data-attrs are the same; handlers read cardioDraft/active.
function cardioFields(c,ctx){
  const du=distanceUnit();
  return `
    <div class="eyebrow" style="margin:2px 2px 8px">Type</div>
    <div class="chips" style="margin-bottom:14px">${CARDIO_TYPES.map(([v,l])=>`<button class="chip ${c.type===v?'on':''}" data-cardtype="${v}">${l}</button>`).join('')}</div>
    <div class="eyebrow" style="margin:2px 2px 8px">Intensity</div>
    <div class="chips" style="margin-bottom:14px">${CARDIO_INTS.map(([v,l])=>`<button class="chip ${c.intensity===v?'on':''}" data-cardint="${v}">${l}</button>`).join('')}</div>
    <div class="eyebrow" style="margin:2px 2px 8px">Distance · optional</div>
    <div class="search" style="margin-bottom:2px"><input id="cardDist" inputmode="decimal" placeholder="e.g. 1.5" value="${c.distance!=null?c.distance:''}"><span class="dim mono" style="font-size:13px">${du}</span></div>`;
}
// mm:ss elapsed for the live clock (updated by the second in bindCardio).
function fmtClockElapsed(startTs){const t=Math.max(0,Math.floor((Date.now()-startTs)/1000));const m=Math.floor(t/60),ss=t%60;return m+':'+(ss<10?'0':'')+ss;}
// The manual / start sheet: pick type+intensity+distance, then either Start the timer or log minutes.
function dateISO(ts){const d=new Date(ts);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}   // local YYYY-MM-DD for a <input type=date>
function todayISO(){return dateISO(Date.now());}
function openCardioSheet(){
  cardioDraft={type:lastCardioType(),intensity:'easy',distance:'',mins:30,when:todayISO()};
  openSheet('Cardio',cardioSheetBody());
  bindCardioSheet();
}
function cardioSheetBody(){
  const c=cardioDraft;
  return `
    ${cardioFields(c,'sheet')}
    <button class="btn primary block" id="btnCardioStart" style="margin-top:16px;gap:9px">${CARDIO_ICON} Start now &amp; time it</button>
    <div class="row-between" style="margin:18px 2px 12px"><span class="eyebrow">Or log one you already did</span></div>
    <div class="settingrow" style="border:none;padding:6px 2px">
      <div><div style="font-weight:600">Minutes</div><div class="dim" style="font-size:12.5px">How long you went</div></div>
      <div class="stepper"><button data-cardmin="-5">−</button><button class="val mono">${c.mins}</button><button data-cardmin="5">＋</button></div></div>
    <div class="settingrow" style="border:none;padding:6px 2px">
      <div><div style="font-weight:600">When</div><div class="dim" style="font-size:12.5px">Defaults to today — back-date a walk you forgot</div></div>
      <input type="date" id="cardWhen" value="${esc(c.when||todayISO())}" max="${todayISO()}" class="field" style="width:auto;height:40px;padding:0 12px"></div>
    <button class="btn good block" id="btnCardioLog" style="margin-top:12px">Log it</button>`;
}
// Edit a saved cardio session — same fields, prefilled, plus its minutes; saves back to the record.
function openCardioEdit(s){
  const dur=P.sessionDuration(s),c=s.cardio||{};
  cardioDraft={type:c.type,intensity:c.intensity,distance:c.distance!=null?String(c.distance):'',mins:dur!=null?dur:30,editId:s.id};
  closeSheet();openSheet('Edit cardio',cardioEditBody());bindCardioSheet(cardioEditBody);
}
function cardioEditBody(){
  const c=cardioDraft;
  return `
    ${cardioFields(c,'edit')}
    <div class="settingrow" style="border:none;padding:6px 2px">
      <div><div style="font-weight:600">Minutes</div><div class="dim" style="font-size:12.5px">How long you went</div></div>
      <div class="stepper"><button data-cardmin="-5">−</button><button class="val mono">${c.mins}</button><button data-cardmin="5">＋</button></div></div>
    <button class="btn primary block" id="btnCardioSave" style="margin-top:12px">Save changes</button>`;
}
// Begin a live cardio session from the sheet's current picks.
function startCardio(){
  const c=cardioDraft||{type:'treadmill',intensity:'easy'};
  const cardio=cardioFromInput({type:c.type,intensity:c.intensity});   // reads the #cardDist field
  const s={id:S.uid(),schema:SCHEMA,date:Date.now(),updatedAt:Date.now(),completed:false,kind:'cardio',exercises:[],cardio};
  closeSheet();S.setActive(s);todayScreen='active';render();
}
// "Where do you train?" (v0.75) — one tap on Home instead of a settings form. A gym's name is a
// shortcut onto the builder's three gym types; chains vary by branch, so it's a starting guess the
// app corrects from what you skip (see barbellAskCard), never a promise about your branch.
const GYM_PLACES=[
  {id:'pf',label:'Planet Fitness',gym:'machine'},{id:'la',label:'LA Fitness',gym:'full'},
  {id:'anytime',label:'Anytime Fitness',gym:'full'},{id:'crunch',label:'Crunch',gym:'full'},
  {id:'ymca',label:'YMCA',gym:'full'},{id:'24hr',label:'24 Hour Fitness',gym:'full'},
  {id:'big',label:'Big gym',gym:'full',other:true},{id:'machines',label:'Mostly machines',gym:'machine',other:true},
  {id:'apt',label:'Apartment / hotel gym',gym:'home',other:true},{id:'home',label:'Home',gym:'home',other:true}];
const GYM_NOTE={full:'barbells, racks, machines and dumbbells',machine:'machines, Smith machine and dumbbells — no barbell rack',home:'dumbbells and bodyweight'};
let gymOther=false;   // "Somewhere else" opens the generic choices
function gymPickCard(){
  const pf=state.settings.profile||{};
  if(pf.gym||seenFlag('gymAsk')||state.active)return '';
  const chip=g=>`<button class="chip" data-place="${g.id}">${esc(g.label)}</button>`;
  return `<div class="card" id="gymPick" style="margin:16px 0 0;padding:16px;border:1px solid color-mix(in srgb,var(--accent) 45%,transparent)">
    <div style="font-weight:700;font-size:15px">Where do you train?</div>
    <div class="dim" style="font-size:13px;line-height:1.5;margin-top:4px">So workouts only use equipment you have. One tap — change it any time in Settings.</div>
    <div class="chips" style="margin-top:12px">${GYM_PLACES.filter(g=>!g.other).map(chip).join('')}${gymOther?'':'<button class="chip" data-action="gymOther">Somewhere else…</button>'}</div>
    ${gymOther?`<div class="chips" style="margin-top:8px">${GYM_PLACES.filter(g=>g.other).map(chip).join('')}</div>`:''}
    <button class="linkbtn dim" data-seentip="gymAsk" style="font-size:12.5px;margin-top:8px;padding:2px 0">Skip</button></div>`;
}
function setPlace(id){const g=GYM_PLACES.find(x=>x.id===id);if(!g)return;
  state.settings.profile=Object.assign({},state.settings.profile,{gym:g.gym,place:g.id});markSeen('gymAsk');render();
  toast(g.label+': '+GYM_NOTE[g.gym]+'. Change it in Settings.');}
// Learning from what you skip (v0.75): replace barbell lifts in two different workouts and the app
// ASKS whether your gym has a barbell rack — an offer, never a silent change.
function noteBarbellSkip(t,old,toId){
  const x=old&&EX[old.id],to=EX[toId],pf=state.settings.profile||{};
  if(!t||!x||!to||x.equip!=='Barbell'||to.equip==='Barbell'||modeOf(old)==='smith'||pf.gym==='machine'||pf.gym==='home'||seenFlag('bbAsk'))return;
  const k='bbswap:'+String(t.id).slice(0,40);if(!seenFlag(k))markSeen(k);}
function barbellAskCard(){
  const pf=state.settings.profile||{};
  if(seenFlag('bbAsk')||pf.gym==='machine'||pf.gym==='home')return '';
  if(Object.keys(state.settings.seen||{}).filter(k=>k.indexOf('bbswap:')===0).length<2)return '';
  return `<div class="card" id="bbAsk" style="margin:0 0 12px;padding:14px 15px">
    <div style="font-weight:700;font-size:14px">No barbell rack at your gym?</div>
    <div class="dim" style="font-size:12.5px;margin-top:3px;line-height:1.45">You’ve swapped out barbell lifts a couple of times. Ironlog can stick to machines, the Smith machine and dumbbells instead.</div>
    <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn primary sm" data-action="bbNoRack">No rack — skip barbells</button><button class="btn ghost sm" data-action="bbHasRack">I have one</button></div></div>`;
}
function resumeCard(){
  const s=state.active;
  if(s.kind==='cardio'){const c=s.cardio||{};
    return `<button class="resume" data-action="resume">
      <span class="tri">${CARDIO_ICON}</span>
      <span style="flex:1;min-width:0"><span style="font-weight:700;display:block">Resume your cardio</span><span class="dim" style="font-size:13px">${cardioTypeLabel(c.type)} · running ${fmtElapsed(s.date)}</span></span>
      <span style="color:var(--accent);font-size:20px;flex-shrink:0">→</span></button>`;}
  const sets=setsOf(s);
  return `<button class="resume" data-action="resume">
    <span class="tri"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>
    <span style="flex:1;min-width:0"><span style="font-weight:700;display:block">Resume your workout</span><span class="dim" style="font-size:13px">${s.exercises.length} exercise${s.exercises.length!==1?'s':''} · ${sets} set${sets!==1?'s':''} logged${P.staleness(s).sinceLastSet>=P.STALE_AFTER_MIN?` · <span style="color:var(--warn)">idle ${fmtDur(P.staleness(s).sinceLastSet)}</span>`:''}</span></span>
    <span style="color:var(--accent);font-size:20px;flex-shrink:0">→</span></button>`;
}
function startWorkoutView(){
  return `
  <div class="section">
    <div class="topbar"><button class="backbtn" data-action="backHome">${ICON_BACK} Home</button></div>
    <div style="padding:0 2px">
      <div class="eyebrow">New workout</div>
      <h2 style="font-size:24px;margin-top:6px">What are you training?</h2>
      <p class="muted" style="margin:7px 0 0">Pick your muscle groups (first pick leads the session) and I'll fill in a balanced set of exercises with your weights from last time — or start from scratch.</p>
    </div>
    <div style="height:18px"></div>${barbellAskCard()}${coachNudge()}
    <div class="eyebrow" style="margin:16px 2px 10px">Quick picks</div>
    <div class="chips hscroll">${PRESETS.map(p=>`<button class="chip ${presetOn(p)?'on':''}" data-action="preset" data-preset="${p.label}">${p.label}</button>`).join('')}</div>
    <div class="eyebrow" style="margin:16px 2px 10px">Target muscle groups</div>
    <div class="chips" id="groupPick">${GROUPS.map(g=>`<button class="chip ${draft.groups.has(g)?'on':''}" data-g="${g}">${g}</button>`).join('')}</div>
    ${completedSessions().length>=5||draft.deload?`<div class="card settingrow" style="margin:18px 0 0;padding:14px 15px"><div><div style="font-weight:600">Deload / recovery session</div><div class="dim" style="font-size:12.5px">Sore or beat up? Build it ~60% lighter — full range, focus on the stretch. Won't count against your progress or PRs.</div></div><button class="sw ${draft.deload?'on':''}" data-action="deloadToggle" aria-label="Deload session"></button></div>`:''}   <!-- a recovery week means nothing before ~5 workouts (v0.75) -->
    <div class="spacer"></div><div class="spacer"></div>
    <div id="buildBtns">${buildButtons()}</div>
    <div class="dim" data-action="profileOpen" style="text-align:center;font-size:12px;margin:10px 0 2px;cursor:pointer">Profile: ${profileSummary()} · <span style="color:var(--accent)">change</span></div>
    <button class="btn ghost block" data-action="blank">Start from scratch</button>
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
  if(!plan){const noSel=!draft.groups.size;   // building nothing silently defaulted to Chest+Back — make the user choose (#25)
    return `<button class="btn primary block" id="btnRecommend" data-action="build" ${noSel?'disabled':''} style="height:56px;font-size:16px${noSel?';opacity:.5':''}">${ICON_BUILD} ${noSel?'Pick a muscle group above':(dl?'Build me a deload':'Build me a workout')}</button>`;}
  // The user picked these muscles and has trained them before — offer to build with the SAME exercises
  // and their weights carried forward (that's the guidance), or shuffle in different exercises. No
  // "plan"/"Session N" framing: the app remembers, it doesn't decide the program.
  if(dl)return `<button class="btn primary block" id="btnRecommend" data-action="build" style="height:auto;padding:12px 16px;font-size:16px;flex-direction:column;gap:2px">
      <span style="display:flex;align-items:center;gap:8px">🌿 Build a deload</span>
      <span style="font-size:12.5px;font-weight:500;opacity:.85">same lifts as ${relDayMid(plan.date)}, ~60% lighter</span></button>
    <div style="height:8px"></div>
    <button class="btn ghost block" data-action="buildFresh">Different exercises instead</button>`;
  return `<button class="btn primary block" id="btnRecommend" data-action="build" style="height:auto;padding:12px 16px;font-size:16px;flex-direction:column;gap:2px">
      <span style="display:flex;align-items:center;gap:8px">${ICON_BUILD} Build my workout</span>
      <span style="font-size:12.5px;font-weight:500;opacity:.85">same lifts as ${relDayMid(plan.date)} · weights prefilled from last time</span></button>
    <div style="height:8px"></div>
    <button class="btn ghost block" data-action="buildFresh">Different exercises instead</button>`;
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
// opts.budget: a FRESHLY built workout is trimmed to the session-length budget (~60 / 45 / 75 min). A
// continued plan, a repeat or a routine keeps the user's own set counts.
function newSession(exIds,deload,volumeBump,opts){const pf=state.settings.profile||{},goal=pf.goal,setStyle=pf.sets,push=pushMode(),gym=pf.gym;
  const s={id:S.uid(),schema:SCHEMA,date:Date.now(),updatedAt:Date.now(),completed:false,exercises:(exIds||[]).map(id=>B.seedExercise(id,state.sessions,{unit:U(),deload,extraSet:volumeBump&&volumeBump.indexOf(id)>=0,goal,setStyle,push,gym}))};
  if(opts&&opts.budget)B.fitSessionBudget(s.exercises,pf);
  if(opts&&opts.first)B.fitFirstSession(s.exercises);
  if(deload)s.deload=true;return s;}
// The ONLY way a workout begins. spec: {ids, deload, msg, volumeBump, source}. Every start path —
// build / blank / repeat / routine / history-repeat — routes through here, so the draft reset (and,
// from Phase 1, the discard guard) live in one place instead of at each call site.
function startSession(spec){
  spec=spec||{};
  const begin=()=>{
    S.setActive(attachOffers(newSession(spec.ids||[],!!spec.deload,spec.volumeBump,{budget:!!spec.budget,first:!!spec.first}),spec.offers));
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
    const m=b.dataset.pickmode,x=liveExercise(t,ex,ei);if(!x){closeSheet();staleToast();return;}if(m===native)delete x.mode;else x.mode=m;
    persistCur();closeSheet();render();toast(MODES[m].label);}));
}
// A free-text note on an exercise in THIS session — timestamped by the session, saved with it, synced
// with it. Surfaced next time you do the lift ("shoulder was hurting", a form cue) so a number that
// looks low has its reason next to it.
function openNote(ei){
  const t=cur();if(!t||!t.exercises[ei])return;const ex=t.exercises[ei];
  noteSheet({id:'note',title:'Note · '+(EX[ex.id]?EX[ex.id].name:ex.name),note:ex.note,resolve:()=>liveExercise(t,ex,ei),
    intro:'Saved with this session and shown the next time you do this lift.',placeholder:'e.g. left shoulder pinchy at the bottom — stayed light'});
}
// A note for the whole workout (D-4) — how the session felt, sleep, an injury flare. Kept on the session
// and shown in History. Works on the live workout or a past one being edited (cur()).
function openSessionNote(){
  const t=cur();if(!t)return;
  noteSheet({id:'snote',title:'Workout note',note:t.note,resolve:()=>liveSession(t),
    intro:'A note for this whole session — how it felt, sleep, energy. Shown in your History.',placeholder:'e.g. slept badly, everything felt heavy — still hit the numbers'});
}
// The one note panel both use. `resolve` finds the LIVE object at save time (see liveSession, 7.5).
function noteSheet(o){
  openSheet(o.title,`<div class="dim" style="font-size:13px;margin:-4px 2px 12px">${esc(o.intro)}</div>
    <textarea id="${o.id}Text" class="field" style="height:110px;padding:12px 14px;resize:none;line-height:1.45" maxlength="500" aria-label="Note" placeholder="${esc(o.placeholder)}">${esc(o.note||'')}</textarea>
    <button class="btn primary block" id="${o.id}Save" style="margin-top:12px">Save note</button>
    ${o.note?`<button class="btn ghost block" id="${o.id}Clear" style="margin-top:8px">Remove note</button>`:''}`);
  const ta=$('#'+o.id+'Text');if(ta){ta.focus();ta.setSelectionRange(ta.value.length,ta.value.length);}
  const write=v=>{const x=o.resolve();if(!x){closeSheet();staleToast();return;}if(v)x.note=v.slice(0,500);else delete x.note;persistCur();closeSheet();render();toast(v?'Note saved':'Note removed');};
  $('#'+o.id+'Save').addEventListener('click',()=>write((ta.value||'').trim()));
  const nc=$('#'+o.id+'Clear');if(nc)nc.addEventListener('click',()=>write(''));
}
/* ---- plate calculator (D-4) ---- barbell/Smith lifts log the TOTAL bar weight, so this shows how to
   load each side. The empty-bar weight is remembered per equipment (barbell vs Smith) AND per unit — a
   straight bar is ~45lb/20kg, a Smith carriage varies by machine (often listed on it). Adjustable; the
   sheet doubles as a calculator (± any weight). Settings: `bar` = barbell, `smithBar` = Smith. */
const BAR_DEFAULT={barbell:{lb:45,kg:20},smith:{lb:25,kg:10}};
function barKey(mode){return mode==='smith'?'smithBar':'bar';}
function barWeight(mode){const b=state.settings[barKey(mode)]||{},v=b[U()];return (typeof v==='number'&&isFinite(v)&&v>=0)?v:BAR_DEFAULT[mode==='smith'?'smith':'barbell'][U()];}   // an explicit 0 is honoured (counterbalanced Smith); only a missing value falls back to the default
function setBarWeight(mode,v){const k=barKey(mode),b=Object.assign({},state.settings[k]);b[U()]=v;state.settings[k]=b;S.saveSettingsCloud();}
let plateDraft=null;
// Just the breakdown — re-rendered on every keystroke WITHOUT touching the inputs, so typing keeps focus.
function plateOutHtml(){
  const u=U(),r=P.platesPerSide(plateDraft.weight,plateDraft.bar,u),n=r.plates.reduce((a,p)=>a+p.count,0);
  const chips=r.plates.length?r.plates.map(p=>Array(p.count).fill(0).map(()=>`<span class="plate p${String(p.plate).replace('.','_')}">${p.plate}</span>`).join('')).join('')
    :`<div class="dim" style="padding:12px 2px">${r.belowBar?'That’s less than the empty bar.':'Just the empty bar — no plates.'}</div>`;
  return `<div class="eyebrow" style="margin:18px 2px 10px">Each side${n?` · ${n} plate${n!==1?'s':''}`:''}</div>
    <div class="plates">${chips}</div>
    ${r.leftover>0?`<div class="dim" style="font-size:12px;margin-top:10px">+${r.leftover}${u} per side left over — no standard plate fits it.</div>`:''}`;
}
function plateSheetBody(){
  const mode=plateDraft.mode,u=U(),smith=mode==='smith';
  return `<div class="dim" style="font-size:13px;margin:-4px 2px 16px">How to load each side of the ${smith?'Smith bar':'bar'}. Type a weight or tap ±.</div>
    <div class="platewt">
      <button class="platestep" data-plw="-1" aria-label="Less">−</button>
      <div class="platewt-in"><input id="plWeight" inputmode="decimal" value="${plateDraft.weight}" aria-label="Total weight"><span class="u">${u}</span></div>
      <button class="platestep" data-plw="1" aria-label="More">＋</button></div>
    <div id="plateOut">${plateOutHtml()}</div>
    <div class="settingrow" style="border-top:1px solid var(--line);border-bottom:none;padding:14px 2px 4px;margin-top:18px">
      <div><div style="font-weight:600;font-size:13.5px">${smith?'Smith bar weight':'Bar weight'}</div><div class="dim" style="font-size:12px">${smith?'The carriage — often listed on the machine':'The empty bar'}</div></div>
      <div class="stepper"><button data-plbar="-1">−</button><input id="plBar" class="barin mono" inputmode="decimal" value="${plateDraft.bar}" aria-label="Bar weight"><span class="baru dim">${u}</span><button data-plbar="1">＋</button></div></div>`;
}
function bindPlateSheet(){
  const mode=plateDraft.mode,step=U()==='kg'?2.5:5,num=v=>{const n=parseFloat(P.parseWeightInput(String(v)));return isFinite(n)?n:0;};
  const wIn=$('#plWeight'),bIn=$('#plBar'),out=$('#plateOut');
  const sync=()=>{if(out)out.innerHTML=plateOutHtml();};
  if(wIn)wIn.addEventListener('input',()=>{plateDraft.weight=Math.max(0,num(wIn.value));sync();});
  if(bIn){bIn.addEventListener('input',()=>{plateDraft.bar=Math.min(mode==='smith'?100:200,Math.max(0,num(bIn.value)));sync();});
    bIn.addEventListener('change',()=>{setBarWeight(mode,plateDraft.bar);});}   // persist the bar only when they're done typing it
  $('#sheetBody').querySelectorAll('[data-plw]').forEach(b=>b.addEventListener('click',()=>{plateDraft.weight=Math.max(0,+(plateDraft.weight+(+b.dataset.plw)*step).toFixed(2));if(wIn)wIn.value=plateDraft.weight;sync();}));
  $('#sheetBody').querySelectorAll('[data-plbar]').forEach(b=>b.addEventListener('click',()=>{plateDraft.bar=Math.max(0,+(plateDraft.bar+(+b.dataset.plbar)*step).toFixed(2));setBarWeight(mode,plateDraft.bar);if(bIn)bIn.value=plateDraft.bar;sync();}));
}
function openPlateSheet(weight,mode){
  mode=mode==='smith'?'smith':'barbell';const bar=barWeight(mode),w=Math.round(+weight||0);
  plateDraft={mode,bar,weight:w||bar};
  openSheet('Plate loader',plateSheetBody());bindPlateSheet();
}
/* ---- exercise ⋯ menu (full review 5.2 replace · 5.3 setup & step · 5.4 reorder · 5.7 declutter) ----
   One button per card instead of a row of small links beside the ✓. */
// Per-exercise machine setup note ("seat 4, pad 3") and weight step — settings.setup / settings.steps,
// synced, keyed by exercise id (the step per unit: a stack in lb and in kg are different numbers).
function exSetup(id){const s=state.settings.setup||{};return s[id]||'';}
function exStep(id){const o=(state.settings.steps||{})[id];return o&&+o[U()]>0?+o[U()]:0;}
function defaultStep(ex){return ex&&(ex.equip==='Dumbbell'||ex.type==='isolation')?(U()==='kg'?1:2.5):(U()==='kg'?2.5:5);}
function openExMenu(ei){
  const t=cur(),e=t&&t.exercises[ei];if(!e)return;const ex=EX[e.id],n=t.exercises.length;
  const row=(act,icon,label,sub,dis)=>`<button class="ex-row" data-exact="${act}"${dis?' disabled':''}><div class="ex-ic">${icon}</div><div style="flex:1;min-width:0;text-align:left"><div class="ex-name">${label}</div>${sub?`<div class="ex-sub">${sub}</div>`:''}</div></button>`;
  const step=exStep(e.id),su=exSetup(e.id);
  openSheet(ex?ex.name:e.name,`<div class="card list">
      ${row('replace','↻','Replace with a similar exercise','Machine taken? Keeps this spot in the workout')}
      ${row('up','↑','Move up','',ei===0)}
      ${row('down','↓','Move down','',ei===n-1)}
      ${row('setup','📌','Machine setup & weight step',esc(su||'')+(su&&step?' · ':'')+(step?'goes up by '+step+' '+U():''))}
      ${row('note','✎',e.note?'Edit note for this workout':'Note for this workout','')}
    </div>
    <a class="btn ghost block" href="${demoURL(e.id)}" target="_blank" rel="noopener noreferrer" style="margin-top:12px;text-decoration:none">▶ Watch a demo</a>
    <button class="linkbtn dim" data-exact="remove" style="display:block;text-align:center;width:100%;margin-top:14px">Remove from workout</button>`);
  $('#sheetBody').querySelectorAll('[data-exact]').forEach(b=>b.addEventListener('click',()=>{
    const a=b.dataset.exact,c=cur();if(!c||!c.exercises[ei])return;
    if(a==='replace')openReplace(ei);
    else if(a==='up'||a==='down'){const j=a==='up'?ei-1:ei+1;if(j<0||j>=c.exercises.length)return;
      const x=c.exercises[ei];c.exercises[ei]=c.exercises[j];c.exercises[j]=x;persistCur();render();openExMenu(j);toast(a==='up'?'Moved up':'Moved down');}   // menu stays open on the moved exercise, so you can keep going
    else if(a==='setup')openExSetup(ei);
    else if(a==='note')openNote(ei);
    else if(a==='remove'){closeSheet();removeExercise(ei);}
  }));
}
// Replace in place: the builder's own swap ranking first (same movement, fits your gym/avoid settings),
// then everything else for that muscle. The swap takes the SAME spot — no more delete-add-scroll.
function openReplace(ei){
  const t=cur(),e=t&&t.exercises[ei],ex=e&&EX[e.id];if(!ex)return;
  const inPlan=t.exercises.map(x=>x.id),pf=state.settings.profile,best=[];
  for(let k=0;k<4;k++){const r=B.replacementFor(e.id,inPlan.concat(best),0,null,pf,state.sessions);if(!r)break;best.push(r.id);}
  const others=IL.data.EXERCISES.filter(x=>x.group===ex.group&&x.id!==e.id&&inPlan.indexOf(x.id)<0&&best.indexOf(x.id)<0).sort((a,b)=>a.name.localeCompare(b.name));
  const row=x=>`<button class="ex-row" data-replacewith="${x.id}"><div class="ex-ic">${exIcon(x.group)}</div><div style="flex:1;min-width:0;text-align:left"><div class="ex-name">${esc(x.name)}</div><div class="ex-sub">${esc(x.equip)} · ${esc(x.muscles.join(' · '))}</div></div></button>`;
  openSheet('Replace '+ex.name,`<div class="dim" style="font-size:13px;margin:-4px 2px 14px">Pick a swap — it takes ${esc(ex.name)}’s spot in your workout.</div>
    ${best.length?`<div class="eyebrow" style="margin:0 2px 8px">Best swaps</div><div class="card list">${best.map(id=>row(EX[id])).join('')}</div>`:''}
    ${others.length?`<div class="eyebrow" style="margin:16px 2px 8px">Other ${ex.group.toLowerCase()} exercises</div><div class="card list">${others.map(row).join('')}</div>`:''}`);
  $('#sheetBody').querySelectorAll('[data-replacewith]').forEach(b=>b.addEventListener('click',()=>{const t=cur();noteBarbellSkip(t,t&&t.exercises[ei],b.dataset.replacewith);doReplace(ei,b.dataset.replacewith);}));
}
// Replace keeps what you already did (batch 4): with sets ticked, the old exercise stays with ONLY those
// sets and the new one goes right below it — machine taken after set 2 no longer deletes sets 1–2.
function doReplace(ei,id){
  const t=cur(),old=t&&t.exercises[ei];if(!old||!EX[id])return;const logged=old.sets.filter(s=>s.done).length;
  if(logged){const c=liveSession(t),o=liveExercise(t,old,ei);if(!c||!o){closeSheet();staleToast();return;}
    const pf=state.settings.profile||{},before=o.sets.slice(),inst=B.seedExercise(id,state.sessions,{excludeId:c.id,unit:U(),goal:pf.goal,setStyle:pf.sets,push:pushMode(),gym:pf.gym});
    o.sets=o.sets.filter(s=>s.done);delete o.offer;const at=c.exercises.indexOf(o)+1;c.exercises.splice(at,0,inst);persistCur();closeSheet();render();
    toast('Kept your '+logged+' set'+(logged!==1?'s':'')+' · '+EX[id].name+' added below',{label:'Undo',fn:()=>{const x=cur();if(!x)return;const k=x.exercises.indexOf(inst);if(k>=0)x.exercises.splice(k,1);o.sets=before;persistCur();render();}});
    return;}
  const go=()=>{const pf=state.settings.profile||{},c=liveSession(t),o=liveExercise(t,old,ei);if(!c||!o){closeSheet();staleToast();return;}
    const inst=B.seedExercise(id,state.sessions,{excludeId:c.id,unit:U(),goal:pf.goal,setStyle:pf.sets,push:pushMode(),gym:pf.gym});
    ei=c.exercises.indexOf(o);c.exercises.splice(ei,1,inst);persistCur();closeSheet();render();
    toast((old.name||EX[old.id].name)+' → '+EX[id].name,{label:'Undo',fn:()=>{const c=cur();if(c&&c.exercises[ei]===inst){c.exercises.splice(ei,1,old);persistCur();render();}}});};
  if(logged)showConfirm('Replace '+(old.name||EX[old.id].name)+'?','You’ve logged '+logged+' set'+(logged!==1?'s':'')+' on it — they’ll be removed from this workout.','Replace',go);else go();
}
// Machine setup note + weight step for this exercise (kept for every future workout).
function openExSetup(ei){
  const t=cur(),e=t&&t.exercises[ei],ex=e&&EX[e.id];if(!ex)return;
  const u=U(),opts=u==='kg'?[0.5,1,2.5,5,10]:[1,2.5,5,10,15];let pick=exStep(e.id);
  openSheet('Setup · '+ex.name,`<div class="dim" style="font-size:13px;margin:-4px 2px 14px">Saved for this exercise and shown every time you do it.</div>
    <div class="eyebrow" style="margin:0 2px 8px">Machine setup</div>
    <input id="setupText" class="field" maxlength="120" placeholder="e.g. seat 4, back pad 3, pin at 7" value="${esc(exSetup(e.id))}" style="height:44px;padding:0 14px">
    <div class="eyebrow" style="margin:18px 2px 8px">Weight goes up by</div>
    <div class="chips">
      <button class="chip ${!pick?'on':''}" data-wstep="0">Auto (${defaultStep(ex)} ${u})</button>
      ${opts.map(v=>`<button class="chip ${pick===v?'on':''}" data-wstep="${v}">${v} ${u}</button>`).join('')}
    </div>
    <div class="dim" style="font-size:12px;margin:8px 2px 0;line-height:1.45">Match your machine’s weight stack or plates, so suggestions only use weights you can actually select.</div>
    <button class="btn primary block" id="setupSave" style="margin-top:18px">Save</button>`);
  $('#sheetBody').querySelectorAll('[data-wstep]').forEach(b=>b.addEventListener('click',()=>{pick=+b.dataset.wstep;
    $('#sheetBody').querySelectorAll('[data-wstep]').forEach(x=>x.classList.toggle('on',+x.dataset.wstep===pick));}));
  $('#setupSave').addEventListener('click',()=>{
    const setup=Object.assign({},state.settings.setup),v=($('#setupText').value||'').trim().slice(0,120);
    if(v)setup[e.id]=v;else delete setup[e.id];state.settings.setup=setup;
    const steps=Object.assign({},state.settings.steps),o=Object.assign({},steps[e.id]);
    if(pick)o[u]=pick;else delete o[u];if(Object.keys(o).length)steps[e.id]=o;else delete steps[e.id];state.settings.steps=steps;
    S.saveSettingsCloud();closeSheet();render();toast(pick?'Saved — suggestions now step by '+pick+' '+u:'Saved');});
}
/* Offers from the builder (night review): a stalled lift's swap sits on that lift's card; a gap-filling
   exercise is a card above "Add exercise". Tapping "Keep" / "No thanks" is remembered for 3 weeks. */
const offerWeek=()=>P.weekIndex(Date.now());
function offerDeclined(kind,id){const w=offerWeek();return [0,1,2].some(d=>seenFlag(kind+':'+id+':'+(w-d)));}
function attachOffers(s,offers){
  (offers||[]).forEach(o=>{
    if(o.type==='swap'){if(offerDeclined('keep',o.from))return;const e=s.exercises.find(x=>x.id===o.from);if(e)e.offer={to:o.to,why:o.why};}
    else if(o.type==='add'&&!offerDeclined('skipadd',o.exId)&&!s.exercises.some(x=>x.id===o.exId))(s.offers=s.offers||[]).push({exId:o.exId,why:o.why});
  });
  return s;
}
function offerAddsHTML(s){
  return (s.offers||[]).filter(o=>EX[o.exId]&&!s.exercises.some(x=>x.id===o.exId)).map(o=>`<div class="sugg match offer" style="margin:0 0 10px"><span>Add <b>${esc(EX[o.exId].name)}</b>? It ${esc(o.why)}.</span><span style="display:flex;gap:6px;flex-shrink:0"><button class="apply" data-offeradd="${o.exId}">Add</button><button class="apply ghost" data-offerskip="${o.exId}">No thanks</button></span></div>`).join('');
}
function buildAndStart(fresh){
  const dl=draft.deload;
  // Coach's findings feed the builder (Phase C). The engine ignores them on a deload (recovery isn't
  // the time to add volume/coverage), so we always pass them and let planWorkout decide.
  const hints=A.buildHints(state.sessions,Date.now(),bw(),state.settings.profile);
  const p=B.planWorkout([...draft.groups],state.sessions,null,{fresh,hints,deload:dl,profile:state.settings.profile,offerOnly:true});   // same lifts = same lifts; changes are offers
  let msg='Workout built — adjust anything';
  if(p.deload)msg=p.mode==='continue'?'Deload — same lifts as last time, lighter loads, focus on the stretch':'Deload built — lighter loads, focus on the stretch';
  else if(p.mode==='continue'){
    if(p.lapsed)msg=`Welcome back — weights carried from your session ${relDayMid(p.plan.date)}`;
    else msg='Same lifts as last time — adjust anything'+((p.offers||[]).length?' · one suggestion inside':'');
  }
  // Settings win on a continued plan: say what was swapped/left out and why (it outranks the messages above)
  const prof=(p.reactions||[]).filter(r=>r.type==='profile-swap'||r.type==='avoid-swap'||r.type==='profile-drop');
  if(prof.length)msg=prof[0].why.charAt(0).toUpperCase()+prof[0].why.slice(1)+(prof.length>1?' (+'+(prof.length-1)+' more)':'');
  // A muscle you picked that got nothing: no room (too many muscles), or nothing fits your settings
  if(p.skipped&&p.skipped.length){const pf=state.settings.profile;
    const noFit=p.skipped.filter(g=>!IL.data.EXERCISES.some(e=>e.group===g&&B.profileAllows(e,g,pf,state.sessions)));
    msg+=noFit.length?' · nothing fits your settings for '+noFit.join(' & '):' · no room for '+p.skipped.join(' & ')+' — pick fewer muscles';}
  const first=p.mode==='fresh'&&!p.deload&&!completedSessions().length;   // brand new: a short first day (v0.75)
  if(first)msg='Your first workout — kept short so you can learn the ropes';
  startSession({ids:p.ids,msg,deload:p.deload,volumeBump:p.volumeBump,offers:p.offers,source:'build',budget:p.mode==='fresh',first});
}
// Reaction 1: a one-tap nudge toward the muscles the coach says are light or unbalanced this week.
function coachNudge(){
  const h=A.buildHints(state.sessions,Date.now(),bw(),state.settings.profile);
  if(!h.suggestGroups.length)return '';
  return `<button class="btn ghost block" data-action="coachNudge" data-groups="${h.suggestGroups.join(',')}" style="justify-content:flex-start;gap:10px;margin:0 0 4px;height:auto;padding:12px 14px;border-style:dashed;text-align:left">
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
    <div class="topbar"><button class="backbtn" data-action="backHome">${ICON_BACK} ${edit?'Cancel':'Home'}</button>
      ${edit?'':`<span style="display:flex;gap:10px;align-items:center"><button class="linkbtn dim" id="btnDiscard">Discard</button><button class="btn good sm" id="btnFinishTop">Finish</button></span>`}</div>
    <div style="padding:0 2px 2px"><div class="eyebrow">${edit?'Editing · '+fmtDate(s.date):`Workout in progress · saves automatically · <span id="elapsedLbl">${fmtElapsed(s.date)}</span>`}</div>
      <h2 style="font-size:23px;margin-top:4px">${new Date(s.date).toLocaleDateString(undefined,{weekday:'long'})}'s session${s.deload?' <span class="deload-badge">Deload</span>':''}</h2></div>
    ${edit?`<div class="settingrow" style="border:none;padding:8px 2px;margin:2px 0 0"><div><div style="font-weight:600;font-size:13.5px">Date</div><div class="dim" style="font-size:12px">Move this workout to another day</div></div>
      <input type="date" id="editDate" value="${dateISO(s.date)}" max="${todayISO()}" class="field" style="width:auto;height:38px;padding:0 12px"></div>`:''}
    ${edit?'':staleBanner(s)}${edit?'':firstTip()}
    ${s.deload?`<div class="card" style="margin:0 0 14px;padding:12px 14px;background:var(--good-soft);border:1px solid color-mix(in srgb,var(--good) 30%,transparent)"><div style="font-weight:600;color:var(--good);font-size:13.5px">🌿 Recovery session</div><div class="dim" style="font-size:12.5px;margin-top:3px">Lighter loads on purpose — take each rep through a full range, feel the stretch, and stop 3–4 reps shy of failure. This won't affect your progression or PRs.</div></div>`:''}
    <div class="statgrid" style="margin:14px 0 18px">
      <div class="card stat"><div class="k">Working sets</div><div class="v mono" id="stSets">${sets}</div></div>
      <div class="card stat"><div class="k">${volLabel()}</div><div class="v mono" id="stVol">${fmtVol(vol)}<small>${U()}</small></div></div>
    </div>
    ${s.note?`<button class="sugg match" id="sessNoteShow" style="width:100%;text-align:left;color:var(--ink-2);margin:0 0 14px"><span>📝 ${esc(s.note)}</span></button>`:''}
    <div id="logList">${s.exercises.map((e,i)=>logExercise(s,e,i,mode)).join('')||emptyLog()}</div>
    <div style="display:flex;gap:4px;flex-wrap:wrap;margin:0 0 6px">
      <button class="linkbtn" id="btnSessNote">📝 ${s.note?'Edit note':'Workout note'}</button>
      ${s.exercises.length>=3?`<button class="linkbtn" id="btnReorder">↕ Auto-order</button>`:''}
      ${s.exercises.length?`<button class="linkbtn" id="btnSaveRoutine">★ Save as routine</button>`:''}
    </div>
    ${edit?'':offerAddsHTML(s)}${edit?'':topSuggestionHTML()}
    <button class="btn ghost block" id="btnAddEx" style="margin-top:4px">＋ Add exercise</button>
    <div style="height:14px"></div>
    ${edit?`<button class="btn primary block" id="btnSaveEdit">Save changes</button>`
          :`<button class="btn good block" id="btnFinish">Finish &amp; save workout</button>`}
  </div>`;
}
// The first workout ever (v0.75): how logging works, in four lines, until you tap Got it.
function firstTip(){
  if(completedSessions().length||seenFlag('firstTip'))return '';
  return `<div class="card" id="firstTip" style="margin:0 0 14px;padding:14px 15px;border:1px solid color-mix(in srgb,var(--accent) 40%,transparent)">
    <div style="font-weight:700;font-size:14px">How to log</div>
    <ul class="dim" style="font-size:12.5px;line-height:1.55;margin:5px 0 0;padding-left:18px">
      <li>Enter the weight and reps you did, then tap <b>✓</b>.</li>
      <li>Only ticked sets are saved.</li>
      <li>Not sure of a weight? Start light — next time the app remembers it.</li>
      <li>Tap <b>Finish</b> when you’re done.</li></ul>
    <button class="linkbtn dim" data-seentip="firstTip" style="font-size:12.5px;margin-top:6px;padding:2px 0">Got it</button></div>`;
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
// How a PR set reads, for any kind of lift (live banner + finish summary).
function prText(e,st,kind){
  const w=+st.w||0,r=+st.r||0,u=U(),ea=P.holdsOf(e)===2?'/ea':'',side=P.sidesOf(e)===2?'/side':'';
  if(kind==='time')return (w?w+u+ea+' · ':'')+r+'s hold'+side;
  if(kind==='resist'||kind==='assist')return (w?w+u+' assist':'unassisted')+' × '+r+side;
  if(kind==='reps')return r+' reps'+side;
  return w+u+ea+' × '+r+side;
}
function logExercise(s,e,ei,mode){
  const ex=EX[e.id];let sugg='',prLine='';const emode=modeOf(e);
  // etrack = the history this instance belongs to (equipment + "each side"); emode stays for labels
  const etrack=P.trackOf(e),holds=P.holdsOf(e),sides=P.sidesOf(e),wEa=holds===2?'/ea':'',rSide=sides===2?'/side':'';
  // Live PR line for EVERY kind of lift now — the one judge scores assist machines (less assist, then
  // more reps), timed holds (seconds) and rep-only moves correctly; the old e1RM-only maths couldn't, so
  // they used to be switched off here. Never on a deload.
  if(mode==='active'&&!s.deload){
    // Live PR recognition — the ONE judge (P.sessionPR), shared with the finish summary. Memoized: the
    // all-time best is a full-history scan, and the in-progress session isn't in `sessions` yet, so it's
    // identical for every set tick — computed once per (lift, track). (P2)
    const hist=memoStat('be1:'+e.id+':'+etrack+':'+s.id,()=>P.bestSetBefore(state.sessions,e.id,{mode:etrack,bw:bw(),excludeId:s.id}));
    const pr=P.sessionPR(state.sessions,e,s,bw(),hist);
    if(pr)prLine=`<div class="sugg" style="color:var(--good);background:var(--good-soft)"><span>★ New PR — ${esc(prText(e,pr.set,pr.kind))}${pr.kind==='e1rm'?` <span class="dim">est ${Math.round(pr.score)}${U()}</span>`:''}</span></div>`;
  }
  if(mode==='active'&&s.deload){
    sugg=`<div class="sugg match" style="color:var(--good);background:var(--good-soft)"><span>🌿 Recovery set — easy load, full range</span></div>`;
  }else if(mode==='active'){
    const pf=state.settings.profile||{},sgRr=pf.goal?P.repRange(EX[e.id],pf.goal):undefined;
    const sg=P.suggestion(state.sessions,e.id,{unit:U(),activeDate:s.date,activeId:s.id,mode:etrack,push:pushMode(),rr:sgRr});
    const open=e.sets.some(st=>!st.done);
    if(sg.kind==='try'){
      // One-tap "Try": the rows hold last time's numbers; the increase is offered, never pre-applied.
      sugg=e.tried?`<div class="sugg"><span>💪 Going for ${esc(sg.tryLabel)} · <span class="lastp">last: ${esc(sg.setsStr)}</span></span>${open?`<button class="apply" data-keepw="${ei}">Back to last time</button>`:''}</div>`
        :`<div class="sugg match"><span>${esc(sg.text)} · <span class="lastp">last: ${esc(sg.setsStr)}</span></span>${open?`<button class="apply" data-tryw="${ei}">Try ${esc(sg.tryLabel)}</button>`:''}</div>`;}
    else if(sg.lp){const w=sg.kind==='weight';
      // The prescription is already in the set rows; offer a one-tap revert until a set is done
      const canRevert=w&&!e.sets.some(st=>st.done);
      sugg=`<div class="sugg ${w?'':'match'}"><span>${w?'💪 ':''}${esc(sg.text)} · <span class="lastp">last: ${esc(sg.setsStr)}</span></span>${canRevert?`<button class="apply" data-keepw="${ei}">Keep last</button>`:''}</div>`;}
    else if(sg.kind==='new')sugg=`<div class="sugg match"><span>${esc(sg.text)}</span></div>`;
    // A note you left last time on this lift — shown so a lower-than-expected weight has its reason next to it
    if(sg.lp&&sg.lp.note)sugg+=`<div class="sugg match" style="color:var(--ink-2)"><span>📝 <span class="dim">${relDay(sg.lp.date)}:</span> ${esc(sg.lp.note)}</span></div>`;
  }
  // A suggested swap for a lift that has stopped improving — offered, never done for you (night review)
  if(mode==='active'&&e.offer&&EX[e.offer.to])sugg+=`<div class="sugg match offer"><span>Hasn’t improved in a few weeks — try <b>${esc(EX[e.offer.to].name)}</b> instead?</span><span style="display:flex;gap:6px;flex-shrink:0"><button class="apply" data-offerswap="${ei}">Swap</button><button class="apply ghost" data-offerkeep="${ei}">Keep</button></span></div>`;
  const noteLine=e.note?`<button class="sugg match" data-note="${ei}" style="width:calc(100% - 24px);text-align:left;color:var(--ink-2)"><span>📝 ${esc(e.note)}</span></button>`:'';
  // Headers say exactly what to type: "Lb ea" = weight of ONE dumbbell / one stack; "/ side" = one side's reps
  const whdr=(U()==='kg'?'Kg':'Lb')+(holds===2?' ea':''),rhdr=(D.TIME_METRIC.has(e.id)?'Sec':'Reps')+(sides===2?' / side':'');
  // "⇆ Each side" only where doing it one-sided is realistic and changes the math
  const sideOK=(emode==='cable'||emode==='dumbbell'||emode==='machine')&&!D.isAssist(e.id)&&!D.TIME_METRIC.has(e.id);
  return `<div class="card log-ex" data-ei="${ei}">
    <div class="log-ex-head">
      <div class="ex-ic">${exIcon(ex?ex.group:'Core')}</div>
      <button data-openex="${e.id}" style="flex:1;min-width:0;text-align:left;background:none;padding:0"><div class="ex-name">${esc(e.name)} <span class="dim" style="font-weight:400;font-size:12px">ⓘ</span></div>
        <div class="ex-sub">${ex?ex.muscles.join(' · '):''} · target ${ex?ex.rr[0]+'–'+ex.rr[1]:'8–12'} ${D.TIME_METRIC.has(e.id)?'sec':'reps'}</div></button>
      <button class="sheet-x" data-exmenu="${ei}" aria-label="Exercise options: replace, move, setup, note, remove">⋯</button>
    </div>
    <div class="chiprow"><button class="modechip" data-mode="${ei}" aria-label="Change equipment">${esc(MODES[emode]?MODES[emode].label:emode)} ▾</button>
      ${sideOK?`<button class="modechip${sides===2?' on':''}" data-side="${ei}" aria-pressed="${sides===2}" aria-label="One side at a time">⇆ ${sides===2?'Each side':'Both sides'}</button>`:''}</div>
    ${exSetup(e.id)?`<button class="sugg match" data-exsetup="${ei}" style="width:calc(100% - 24px);text-align:left;color:var(--ink-2)"><span>📌 ${esc(exSetup(e.id))}</span></button>`:''}
    ${prLine}${sugg}${noteLine}
    <div class="setgrid">
      <div class="set-hdr"><div>Set</div><div>${whdr}</div><div>${rhdr}</div><div></div></div>
      ${e.sets.map((st,si)=>setRow(st,ei,si,e.sets.slice(0,si).filter(x=>!x.warm).length+1)).join('')}
    </div>
    <div class="set-actions">
      <button class="linkbtn" data-addset="${ei}">＋ Add set</button>
      ${mode!=='view'&&!e.sets.some(st=>st.warm)?`<button class="linkbtn dim" data-addwarm="${ei}">＋ Warm-up</button>`:''}
      ${e.sets.length>1?`<button class="linkbtn" data-delset="${ei}">－ Remove set</button>`:''}
      ${D.TIME_METRIC.has(e.id)&&todayScreen==='active'?`<button class="linkbtn" data-stopwatch="${ei}">⏱ Stopwatch</button>`:''}
      ${(emode==='barbell'||emode==='smith')?`<button class="linkbtn" data-plates="${ei}">🏋 Plates</button>`:''}
    </div>
    ${ei===0&&state.sessions.length<3?'<div class="hint">Tip: tap a set number to mark it a warm-up (kept out of PRs and volume).</div>':''}
  </div>`;
}
function setRow(st,ei,si,no){   // no = the working-set number (warm-ups don't count: W, 1, 2, 3)
  return `<div class="set-row ${st.done?'done':''}" data-si="${si}">
    <button class="set-no ${st.warm?'warm':''}" data-warm="${ei}" data-s="${si}" aria-label="Toggle warm-up">${st.warm?'W':no}</button>
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

