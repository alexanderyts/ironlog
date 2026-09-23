// UI, part 4 of 4 — ACTIONS & WIRING: finish/discard, the delegated event table + bindings, the rest
// timer, and boot(). This file runs last, so boot() sees every function above. (Shares scope — see ui-core.js.)
/* ---------------- actions ---------------- */
function addExerciseToCur(id){
  // Lazy-inits an active session only when there isn't one — so it never overwrites a workout in
  // progress and needs no discard guard (unlike the start paths that go through startSession()).
  if(todayScreen!=='edit'&&!state.active){S.setActive(newSession([]));}
  const t=cur();
  if(t.exercises.some(x=>x.id===id)){toast('Already added');return;}
  const pf=state.settings.profile||{},inst=B.seedExercise(id,state.sessions,{excludeId:t.id,unit:U(),goal:pf.goal,setStyle:pf.sets,push:pf.push,gym:pf.gym});
  const pos=slotFor(t,id);t.exercises.splice(pos,0,inst);
  persistCur();if(todayScreen!=='edit')todayScreen='active';
  if(currentTab!=='today')setTab('today');else render();
  toast(EX[id].name+(pos<t.exercises.length-1?' added — slotted in as #'+(pos+1):' added'));
}
// The workout's focus muscle: the group with the most exercises (the Auto-order tiebreak).
function focusGroup(exs){const counts={};exs.forEach(e=>{const g=EX[e.id]&&EX[e.id].group;if(g)counts[g]=(counts[g]||0)+1;});
  return Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0];}
// Where a newly added lift belongs: by the same big-lifts-first rule as Auto-order, but only among the
// exercises you HAVEN'T started — anything with a ticked set stays exactly where it is, and the new lift
// never jumps ahead of work already begun. Equal priority goes after (stable).
function slotFor(t,id){
  const exs=t.exercises;let after=-1;exs.forEach((e,i)=>{if(e.sets.some(s=>s.done))after=i;});
  const focus=focusGroup(exs.concat([{id}])),p=B.perfPriority(EX[id],focus);
  for(let i=after+1;i<exs.length;i++)if(p>B.perfPriority(EX[exs[i].id],focus))return i;
  return exs.length;
}
function reorderCur(){
  const t=cur();if(!t||t.exercises.length<2)return;
  const focus=focusGroup(t.exercises);
  const map={};t.exercises.forEach(e=>map[e.id]=e);
  t.exercises=B.orderByFatigue(t.exercises.map(e=>e.id),focus).map(id=>map[id]);
  persistCur();render();toast('Ordered for best performance');
}
// Keep the editor's Working-sets / Volume tiles honest after an in-place edit (stepper or typing on a
// set that's already checked) without a full re-render, which would steal input focus.
function refreshStats(){const t=cur();if(!t)return;const a=$('#stSets'),b=$('#stVol');if(a)a.textContent=setsOf(t);if(b)b.innerHTML=fmtVol(volOf(t))+'<small>'+U()+'</small>';}
// Only sets the user actually checked done are saved (see finalizeSets). Edited-but-unticked sets are
// resolved by confirmUnchecked() before this runs.
function cleanSets(s){s.exercises=P.finalizeSets(s.exercises);}
// How many sets were edited (numbers entered/stepped) but never checked off.
function pendingSets(s){return s.exercises.reduce((n,e)=>n+e.sets.filter(st=>st.t&&!st.done).length,0);}
// Before finishing, if there are edited-but-unticked sets, ask whether to keep them. Otherwise they'd
// silently vanish (only done sets save). Two explicit choices; closing the sheet cancels the finish.
function confirmUnchecked(s,commit){
  const pending=pendingSets(s);
  if(!pending){commit();return;}
  const them=pending>1?'them':'it',n=pending+' set'+(pending>1?'s':'');
  openSheet('Unchecked sets',`<div class="dim" style="font-size:13.5px;margin:-2px 2px 15px;line-height:1.5">You entered numbers on ${n} without checking ${them} off. Save ${them} as done, or leave ${them} out of this workout?</div>
    <button class="btn primary block" id="finSaveAll" style="margin-bottom:9px">Save ${them} as done</button>
    <button class="btn ghost block" id="finLeaveOut">Leave ${them} out</button>`);
  const go=markDone=>{closeSheet();if(markDone)s.exercises.forEach(e=>e.sets.forEach(st=>{if(st.t&&!st.done)st.done=true;}));commit();};
  const a=$('#finSaveAll'),b=$('#finLeaveOut');if(a)a.addEventListener('click',()=>go(true));if(b)b.addEventListener('click',()=>go(false));
}
// Recap of a just-finished session, computed BEFORE it's saved (so history = prior sessions).
function workoutSummary(s){
  const prs=[];
  s.exercises.forEach(e=>{
    // An e1RM comparison is meaningless for an assist machine (less weight = harder) and for a
    // time-held lift ("reps" are seconds) — it would both miss real improvements and invent fake ones.
    // The Progress PR list ranks those correctly; here we simply stay quiet rather than lie.
    if(D.INVERTED_LOAD.has(e.id)||D.TIME_METRIC.has(e.id))return;
    const etrack=P.trackOf(e);const histBest=P.bestE1rmBefore(state.sessions,e.id,{mode:etrack,bw:bw(),excludeId:s.id});if(histBest<=0)return;
    let best=0,bs=null;e.sets.forEach(st=>{if(st.warm||st.nc||!P.isWorking(st))return;const est=P.e1rm(P.setLoad(e.id,st.w,bw()),+st.r||0);if((+st.r)&&est>best){best=est;bs=st;}});
    if(bs&&best>histBest)prs.push({id:e.id,name:EX[e.id]?EX[e.id].name:e.name,w:bs.w,r:bs.r,perHand:P.holdsOf(e)===2,perSide:P.sidesOf(e)===2});});
  return {sets:setsOf(s),vol:volOf(s),prs,deload:!!s.deload,dur:P.sessionDuration(s),estimated:!!s.endEstimated};
}
function showSummary(sm){
  let body=`<div class="statgrid" style="margin:2px 0 14px">
      <div class="card stat"><div class="k">Working sets</div><div class="v mono">${sm.sets}</div></div>
      <div class="card stat"><div class="k">Volume</div><div class="v mono">${fmtVol(sm.vol)}<small>${U()}</small></div></div></div>`;
  if(sm.dur!=null)body+=`<div class="dim" style="text-align:center;font-size:12.5px;margin:-4px 0 14px">${sm.estimated?'≈ ':''}${fmtDur(sm.dur)}</div>`;
  if(sm.deload){
    body+=`<div class="card" style="padding:14px 15px;background:var(--good-soft);border:1px solid color-mix(in srgb,var(--good) 30%,transparent)"><div style="color:var(--good);font-weight:600;font-size:13.5px">🌿 Recovery in the bank</div><div class="dim" style="font-size:12.5px;margin-top:3px">Fatigue's clearing — ease back to full loads when you feel fresh. This won't affect your progression.</div></div>`;
  }else if(sm.prs.length){
    body+=`<div class="eyebrow" style="margin:2px 2px 8px">🎉 New personal record${sm.prs.length>1?'s':''}</div>
      <div class="card list">${sm.prs.map(p=>`<div class="ex-row"><span style="color:var(--good);font-size:18px;flex-shrink:0">★</span><div style="flex:1;min-width:0"><div class="ex-name">${esc(p.name)}</div><div class="ex-sub">${p.w}${U()}${p.perHand?'/ea':''} × ${p.r}${p.perSide?'/side':''}</div></div>
        <button class="btn sm ghost" data-prmark="${p.id}" data-insummary="1" style="flex-shrink:0">Wasn’t clean</button></div>`).join('')}</div>`;
  }else{
    body+=`<div class="dim" style="font-size:13.5px;line-height:1.5;padding:0 2px">Logged and saved. Consistency is what moves the numbers — every session counts.</div>`;
  }
  body+=`<button class="btn primary block" id="sumDone" style="margin-top:16px">Done</button>`;
  openSheet(sm.deload?'Recovery logged 🌿':(sm.prs.length?'New PR! 💪':'Workout complete 💪'),body);
  const d=$('#sumDone');if(d)d.addEventListener('click',()=>{closeSheet();setTab('history');});
}
function finishWorkout(){
  const s=state.active;
  confirmUnchecked(s,()=>chooseEndThenCommit(s));
}
// T2: when Finish was likely forgotten (last set a while ago), let the user log the real end time
// rather than "now", instead of silently inflating the duration. Otherwise finish straight away.
function chooseEndThenCommit(s){
  const st=P.staleness(s),now=Date.now();
  if(st.lastSetAt&&st.sinceLastSet>=P.STALE_CONFIRM_MIN){
    const lastEnd=st.lastSetAt+P.END_PAD_MIN*60000;
    openSheet('When did you finish?',`<div class="dim" style="font-size:13.5px;margin:-2px 2px 14px;line-height:1.5">Your last set was ${fmtDur(st.sinceLastSet)} ago, at ${fmtClock(st.lastSetAt)}. Log this workout as ending then, or now?</div>
      <button class="btn primary block" id="endAtLast" style="margin-bottom:9px">End at my last set · ${fmtClock(lastEnd)}</button>
      <button class="btn ghost block" id="endNow">End now · ${fmtClock(now)}</button>`);
    const a=$('#endAtLast'),b=$('#endNow');
    if(a)a.addEventListener('click',()=>commitFinish(s,lastEnd,true));
    if(b)b.addEventListener('click',()=>commitFinish(s,now,false));
  }else if(!st.lastSetAt&&st.sinceStart>=P.STALE_CONFIRM_MIN){
    // No set timestamps at all (a workout that predates timing, or nothing was ever checked) and it
    // was started a while ago: "now" would record the whole gap as training time — the 50-hour
    // workout. Offer an honest estimate or no length rather than inventing one.
    const hourIn=+s.date+60*60000;
    openSheet('When did you finish?',`<div class="dim" style="font-size:13.5px;margin:-2px 2px 14px;line-height:1.5">This workout was started ${fmtDur(st.sinceStart)} ago and its sets aren't time-stamped, so Ironlog can't tell how long you trained.</div>
      <button class="btn primary block" id="endNow" style="margin-bottom:9px">End now · ${fmtClock(now)}</button>
      <button class="btn ghost block" id="endHour" style="margin-bottom:9px">About an hour after I started · ≈${fmtClock(hourIn)}</button>
      <button class="btn ghost block" id="endNone">Don't record a length</button>`);
    const a=$('#endNow'),b=$('#endHour'),c=$('#endNone');
    if(a)a.addEventListener('click',()=>commitFinish(s,now,false));
    if(b)b.addEventListener('click',()=>commitFinish(s,hourIn,true));
    if(c)c.addEventListener('click',()=>commitFinish(s,null,false));
  }else commitFinish(s,now,false);
}
// endedAt may be null ("don't record a length"): the session then has no duration anywhere it's read.
function commitFinish(s,endedAt,estimated){
  closeSheet();stopRest();stopSw();stopElapsed();
  if(endedAt)s.endedAt=endedAt;else delete s.endedAt;
  if(estimated&&endedAt)s.endEstimated=true;else delete s.endEstimated;
  cleanSets(s);
  if(!s.exercises.length){toast('Log at least one set first');return;}
  const sm=workoutSummary(s);
  s.completed=true;s.updatedAt=Date.now();
  if(bw()>0&&!(+s.bw>0))s.bw=bw();   // snapshot the bodyweight this workout was done at, so its bodyweight-lift math stays put as your weight changes later (D-1)
  if(!S.upsertSession(s,false)){
    // Storage is full: the sessions blob didn't save. DON'T clear the active workout — it stays on
    // this device (il_active still holds it) and, if cloud is on, was already pushed, so nothing is
    // lost. Undo the finish in memory so the editor shows the workout exactly as it was.
    const i=state.sessions.findIndex(x=>x.id===s.id);if(i>=0)state.sessions.splice(i,1);
    s.completed=false;delete s.endedAt;delete s.endEstimated;
    toast('Storage is full — your workout is safe but not saved yet. Export a backup from Settings, then finish again.');
    render();return;
  }
  state.active=null;S.persistActive();todayScreen='home';
  render();showSummary(sm);
}
/* "That rep wasn't clean" — set the current record aside. Finds the exact set behind the PR (same
   session, same modality, same weight × reps) and flags it `nc`. Nothing is deleted: the set keeps its
   place in History and its share of your volume; it just stops being the bar the app measures you
   against, and stops seeding the next workout. Re-openable both ways. */
function markBestSet(id,btn){
  const p=prFor(id);
  if(!p){toast('No record to adjust');return;}
  const s=state.sessions.find(x=>x.date===p.date&&x.exercises.some(e=>e.id===id));
  const e=s&&(s.exercises.find(x=>x.id===id&&P.trackOf(x)===(p.track||p.mode))||s.exercises.find(x=>x.id===id));
  const st=e&&e.sets.find(x=>!x.nc&&P.isWorking(x)&&(+x.w||0)===p.w&&(+x.r||0)===p.r);
  if(!st){toast('Couldn’t find that set');return;}
  st.nc=true;s.updatedAt=Date.now();S.upsertSession(s,false);
  render();
  // From the post-workout summary, stay in the summary: redrawing the exercise sheet over it threw
  // away the "Done" button and the trip back to History mid-flow. Tick the row in place instead.
  if(btn&&btn.dataset.insummary){btn.outerHTML='<span class="dim" style="font-size:12.5px;flex-shrink:0">Set aside ✓</span>';}
  else openSheet(EX[id]?EX[id].name:id,exerciseDetail(id));
  toast('Set aside — it still counts toward your volume');
}
// The mirror of markBestSet: restore the single set the card is showing as "PR adjusted" (the disowned
// set that currently beats the record, in that record's modality). Walking back several is one tap
// each. Fallback: if there's no beating-set on display but sets are still set aside (a lower one, or
// one in another modality the card can't surface), clear whatever's left so nothing can strand.
function unmarkSets(id){
  const p=prFor(id);
  let restored=0;
  if(p&&p.adjusted){
    const s=state.sessions.find(x=>x.date===p.adjusted.date&&x.exercises.some(e=>e.id===id));
    const e=s&&(s.exercises.find(x=>x.id===id&&P.trackOf(x)===(p.track||p.mode))||s.exercises.find(x=>x.id===id));
    const st=e&&e.sets.find(x=>x.nc&&(+x.w||0)===p.adjusted.w&&(+x.r||0)===p.adjusted.r);
    if(st){delete st.nc;s.updatedAt=Date.now();S.upsertSession(s,false);restored=1;}
  }
  if(!restored){   // nothing on display to restore — clear any remaining set-aside sets for this lift
    state.sessions.forEach(s=>{let hit=false;
      s.exercises.forEach(e=>{if(e.id!==id)return;e.sets.forEach(st=>{if(st.nc){delete st.nc;hit=true;restored++;}});});
      if(hit){s.updatedAt=Date.now();S.upsertSession(s,false);}});
  }
  if(!restored){toast('Nothing was set aside');return;}
  render();openSheet(EX[id]?EX[id].name:id,exerciseDetail(id));
  toast('Counting it again');
}
function discardActive(){showConfirm('Discard workout?','Nothing from this session will be saved.','Discard',()=>{
  stopRest();stopSw();stopElapsed();const copy=state.active;state.active=null;S.persistActive();todayScreen='home';render();
  toast('Workout discarded',{label:'Undo',fn:()=>{S.setActive(copy);todayScreen='active';render();}});});}

/* ---------------- cardio finish / manual save ---------------- */
// Read the distance input (live view or sheet) into a cardio object, dropping a blank/invalid value.
function cardioFromInput(base){
  const c=Object.assign({},base);delete c.distance;delete c.unit;
  const el=$('#cardDist');const d=el?parseFloat(el.value):(base&&base.distance);
  if(isFinite(d)&&d>0){c.distance=d;c.unit=distanceUnit();}
  return c;
}
// Finish a LIVE cardio session. Like a lift's Finish, a long-forgotten one offers an honest end time
// rather than silently recording hours of "cardio" (the same 50-hour safeguard).
function finishCardio(){
  const s=state.active;if(!s)return;
  s.cardio=cardioFromInput(s.cardio);
  const now=Date.now(),sinceStart=Math.round((now-s.date)/60000);
  if(sinceStart>=P.STALE_CONFIRM_MIN){
    const hourIn=+s.date+60*60000;
    openSheet('When did you finish?',`<div class="dim" style="font-size:13.5px;margin:-2px 2px 14px;line-height:1.5">This cardio session was started ${fmtDur(sinceStart)} ago. When did you actually finish?</div>
      <button class="btn primary block" id="cEndNow" style="margin-bottom:9px">Just now · ${fmtClock(now)}</button>
      <button class="btn ghost block" id="cEndHour" style="margin-bottom:9px">About an hour after I started · ≈${fmtClock(hourIn)}</button>
      <button class="btn ghost block" id="cEndNone">Don't record a length</button>`);
    bindClick('#cEndNow',()=>commitCardio(s,now,false));
    bindClick('#cEndHour',()=>commitCardio(s,hourIn,true));
    bindClick('#cEndNone',()=>commitCardio(s,null,false));
    return;
  }
  commitCardio(s,now,false);
}
// Save a cardio session (live-finished or manually entered) with the same storage-full guard as a lift.
function commitCardio(s,endedAt,estimated){
  closeSheet();stopElapsed();stopCardioClock();
  if(endedAt)s.endedAt=endedAt;else delete s.endedAt;
  if(estimated&&endedAt)s.endEstimated=true;else delete s.endEstimated;
  s.completed=true;s.updatedAt=Date.now();
  if(!S.upsertSession(s,false)){
    const i=state.sessions.findIndex(x=>x.id===s.id);if(i>=0)state.sessions.splice(i,1);
    s.completed=false;delete s.endedAt;delete s.endEstimated;
    if(state.active===s){toast('Storage is full — your cardio is safe but not saved yet. Export a backup from Settings, then finish again.');}
    else toast('Storage is full — that cardio session didn’t save. Export a backup from Settings.');
    render();return;
  }
  if(state.active===s){state.active=null;S.persistActive();}
  const mins=P.sessionDuration(s);
  todayScreen='home';setTab('history');
  toast(`Logged ${cardioTypeLabel(s.cardio.type)}${mins!=null?' · '+fmtDur(mins):''}`);
}
// Manual entry from the sheet: build a completed cardio session from the picks + minutes (+ optional
// back-date). Today → ends ~now; a past date → placed at midday on that day so History shows it right.
function logCardioManual(){
  const c=cardioDraft;const mins=Math.max(1,+c.mins||0);const now=Date.now();
  const wEl=$('#cardWhen'),when=(wEl&&wEl.value)||c.when||'';const today=(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');})();
  let end=now;
  if(when&&when!==today){const p=when.split('-').map(Number);if(p.length===3&&p[0]){const d=new Date(p[0],p[1]-1,p[2],12,0,0).getTime();if(isFinite(d)&&d<now)end=d;}}   // midday on the chosen day, never in the future
  const date=end-mins*60000;   // duration = minutes
  const cardio=cardioFromInput({type:c.type,intensity:c.intensity});
  const s={id:S.uid(),schema:SCHEMA,date,updatedAt:now,completed:false,kind:'cardio',exercises:[],cardio};
  commitCardio(s,end,false);
}
function startEdit(s){editSession=JSON.parse(JSON.stringify(s));editDirty=false;todayScreen='edit';setTab('today');}
// Move a past workout to another day (D-4). Keeps the original time-of-day, and shifts endedAt by the
// same delta so the recorded duration is unchanged. Edit mode only.
function changeEditDate(iso){
  const s=cur();if(!s||!iso)return;const parts=iso.split('-').map(Number);if(parts.length!==3||!parts[0])return;
  const old=new Date(s.date),nd=new Date(parts[0],parts[1]-1,parts[2],old.getHours(),old.getMinutes(),old.getSeconds(),old.getMilliseconds());
  const t=nd.getTime();if(t>Date.now()||t===s.date)return;   // no future-dating, no-op if unchanged
  const delta=t-s.date;s.date=t;if(+s.endedAt>0)s.endedAt+=delta;
  editDirty=true;render();toast('Moved to '+nd.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'}));
}
function finishEdit(){
  const s=editSession;
  confirmUnchecked(s,()=>{
    cleanSets(s);
    if(!s.exercises.length){toast('Keep at least one set, or delete the session instead');return;}
    s.updatedAt=Date.now();
    if(!S.upsertSession(s,false)){toast('Storage is full — the edit didn’t save. Export a backup from Settings.');render();return;}   // don't claim "Changes saved" on a failed write
    editSession=null;editDirty=false;todayScreen='home';toast('Changes saved');setTab('history');
  });
}
function leaveEditor(){
  if(todayScreen==='edit'){
    const go=()=>{editSession=null;editDirty=false;todayScreen='home';setTab('history');};
    if(editDirty)showConfirm('Discard changes?','Your edits to this session will be lost.','Discard',go);else go();
  }else{todayScreen='home';render();}
}

/* ---------------- bind ---------------- */
function bindClick(sel,fn){const el=$(sel);if(el)el.addEventListener('click',fn);}
// The editor header's elapsed time (T1). A self-rescheduling 1-minute timeout updates just the
// #elapsedLbl span (no re-render, so it never steals input focus); it stops itself the moment the
// span is gone or the active workout ends. Re-armed by bind() whenever the active editor renders.
let elapsedT=null,notifiedStaleId=null;
function stopElapsed(){clearTimeout(elapsedT);elapsedT=null;}
function scheduleElapsed(){stopElapsed();elapsedT=setTimeout(()=>{
  if(!(state.active&&todayScreen==='active'))return;
  if(state.active.kind==='cardio'){const el=$('#elapsedLbl');if(el)el.textContent=fmtElapsed(state.active.date);scheduleElapsed();return;}   // cardio has no sets/stale banner — just tick the label
  const stale=P.staleness(state.active).sinceLastSet>=P.STALE_AFTER_MIN;
  if(stale)maybeStaleNotify(state.active);
  // Crossing the threshold brings in the banner via a re-render (bind() re-arms this timer). Never
  // re-render while someone is typing a weight.
  if(stale&&!$('#staleBanner')){const a=document.activeElement;if(!(a&&a.tagName==='INPUT')){render();return;}}
  const el=$('#elapsedLbl');if(el)el.textContent=fmtElapsed(state.active.date);
  scheduleElapsed();},60000);}
// A single "still training?" notification, only while the app is BACKGROUNDED and only if the user
// already allowed rest notifications — no new permission prompt. A PWA can't wake itself, so this is
// best-effort (won't fire on a suspended iOS PWA); the in-app banner is the real safety net.
function maybeStaleNotify(s){
  if(notifiedStaleId===s.id||!document.hidden)return;
  try{if(state.settings.rest.notify&&'Notification'in window&&Notification.permission==='granted'){
    notifiedStaleId=s.id;new Notification('Still training?',{body:'Your workout is still open — finish it to log it.'});}}catch(e){}
}
// Cardio live clock — ticks the mm:ss readout every second (its own timer; the minute-level #elapsedLbl
// is handled by scheduleElapsed). Stops itself the instant the cardio session ends or the view changes.
let cardioClockT=null;
function stopCardioClock(){clearInterval(cardioClockT);cardioClockT=null;}
function startCardioClock(){stopCardioClock();cardioClockT=setInterval(()=>{
  if(!(state.active&&state.active.kind==='cardio'&&todayScreen==='active')){stopCardioClock();return;}
  const el=$('#cardioClock');if(el)el.textContent=fmtClockElapsed(state.active.date);else stopCardioClock();
},1000);}
function discardCardio(){showConfirm('Discard cardio?','This session won’t be saved.','Discard',()=>{
  stopCardioClock();stopElapsed();const copy=state.active;state.active=null;S.persistActive();todayScreen='home';render();
  toast('Cardio discarded',{label:'Undo',fn:()=>{S.setActive(copy);todayScreen='active';render();}});});}
// Live cardio view wiring: Finish/Discard, the type/intensity chips (mutate the active record + re-render,
// preserving any typed distance across the render), and the per-second clock.
function bindCardioLive(){
  const v=$('#view');
  bindClick('#btnCardioFinish',finishCardio);bindClick('#btnCardioFinishBottom',finishCardio);
  bindClick('#btnCardioDiscard',discardCardio);
  const keepDist=()=>{state.active.cardio=cardioFromInput(state.active.cardio);};
  v.querySelectorAll('[data-cardtype]').forEach(b=>b.addEventListener('click',()=>{keepDist();state.active.cardio.type=b.dataset.cardtype;S.persistActive();render();}));
  v.querySelectorAll('[data-cardint]').forEach(b=>b.addEventListener('click',()=>{keepDist();state.active.cardio.intensity=b.dataset.cardint;S.persistActive();render();}));
  startCardioClock();
}
// Manual/start sheet wiring: type/intensity chips + minutes stepper re-render the sheet; the distance
// input is captured before each re-render so a typed value survives.
function bindCardioSheet(bodyFn){
  bodyFn=bodyFn||cardioSheetBody;
  const b=$('#sheetBody');
  const grab=()=>{const el=$('#cardDist');if(el)cardioDraft.distance=el.value;const w=$('#cardWhen');if(w)cardioDraft.when=w.value;};
  const rerender=()=>{grab();b.innerHTML=bodyFn();bindCardioSheet(bodyFn);};
  b.querySelectorAll('[data-cardtype]').forEach(el=>el.addEventListener('click',()=>{cardioDraft.type=el.dataset.cardtype;rerender();}));
  b.querySelectorAll('[data-cardint]').forEach(el=>el.addEventListener('click',()=>{cardioDraft.intensity=el.dataset.cardint;rerender();}));
  b.querySelectorAll('[data-cardmin]').forEach(el=>el.addEventListener('click',()=>{cardioDraft.mins=Math.max(1,(+cardioDraft.mins||0)+ +el.dataset.cardmin);rerender();}));
  bindClick('#btnCardioStart',startCardio);
  bindClick('#btnCardioLog',logCardioManual);
  bindClick('#btnCardioSave',saveCardioEdit);
}
// Save edits back to an existing cardio record (id/date kept; minutes → endedAt).
function saveCardioEdit(){
  const c=cardioDraft,s=state.sessions.find(x=>x.id===c.editId);if(!s)return;
  const mins=Math.max(1,+c.mins||0);
  s.cardio=cardioFromInput({type:c.type,intensity:c.intensity});
  s.endedAt=s.date+mins*60000;delete s.endEstimated;s.updatedAt=Date.now();
  if(!S.upsertSession(s,false)){toast('Storage is full — the edit didn’t save. Export a backup from Settings.');render();return;}
  closeSheet();render();toast('Cardio updated');
}
// Delegated view actions: a click on any element carrying data-action="name" (or inside one) runs
// ACTIONS[name](el, ev). One listener on #view covers every view and survives re-renders, so a new
// button is just markup + a table row — no per-view rebinding. (The editor, sheets and bindLog keep
// their own handlers; those are scoped to regions that change wholesale.)
const ACTIONS={
  startFlow:()=>{todayScreen='start';render();},
  resume:()=>{todayScreen='active';render();},
  goLibrary:()=>setTab('library'),
  backHome:()=>leaveEditor(),
  build:()=>{if(!draft.groups.size)return;buildAndStart(false);},   // belt for the disabled button (a synthetic click could otherwise build the old Chest+Back default)
  buildFresh:()=>buildAndStart(true),
  coachNudge:el=>{draft.groups=new Set(el.dataset.groups.split(','));render();},
  preset:el=>{const p=PRESETS.find(x=>x.label===el.dataset.preset);if(!p)return;
    draft.groups=presetOn(p)?new Set():new Set(p.groups);   // tap to select those groups; tap again to clear
    render();},
  blank:()=>startSession({ids:[],msg:draft.deload?'Deload — lighter loads, focus on the stretch':null,deload:draft.deload,source:'blank'}),
  deloadToggle:el=>{draft.deload=!draft.deload;el.classList.toggle('on',draft.deload);refreshBuildBtns();},
  staleFinish:()=>finishWorkout(),
  staleDiscard:()=>discardActive(),
  profileGo:()=>{markSeen('profileIntro');openProfile();},
  profileSkip:()=>{markSeen('profileIntro');render();},
  profileOpen:()=>openProfile(),
  cardioOpen:()=>{if(state.active){toast('Finish or discard your current session first');return;}openCardioSheet();}
};
function bind(){
  const v=$('#view');
  if(!v.__delegated){v.__delegated=true;v.addEventListener('click',e=>{
    const a=e.target.closest('[data-action]');if(a&&ACTIONS[a.dataset.action]){ACTIONS[a.dataset.action](a,e);return;}
    const stip=e.target.closest('[data-seentip]');if(stip){markSeen(stip.dataset.seentip);render();return;}   // generic one-time tip dismissal
    const mu=e.target.closest('[data-mute]');if(mu){const seen=state.settings.seen=state.settings.seen||{};seen['mute:'+mu.dataset.mute]=true;S.saveSettingsCloud();render();toast('Got it — hidden from Coach’s notes',{label:'Undo',fn:()=>{delete seen['mute:'+mu.dataset.mute];S.saveSettingsCloud();render();}});return;}
    const cl=e.target.closest('[data-collapse]');if(cl){toggleCollapse(cl.dataset.collapse);return;}
    const bv=e.target.closest('[data-barval]');if(bv){bv.classList.toggle('on');return;}   // reveal/hide a volume bar's value
    const sc=e.target.closest('[data-sess]');if(sc){openSessionDetail(sc.dataset.sess);return;}   // works from Home's last-session card AND History
  });
  // Enter/Space activate the role="button" divs (collapse headers, tappable bars) for keyboard users
  v.addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;
    const cl=e.target.closest&&e.target.closest('[data-collapse]');if(cl){e.preventDefault();toggleCollapse(cl.dataset.collapse);return;}
    const bv=e.target.closest&&e.target.closest('[data-barval]');if(bv){e.preventDefault();bv.classList.toggle('on');}});}
  const gp=$('#groupPick');if(gp)gp.addEventListener('click',e=>{const b=e.target.closest('[data-g]');if(!b)return;const g=b.dataset.g;draft.groups.has(g)?draft.groups.delete(g):draft.groups.add(g);b.classList.toggle('on');
    refreshBuildBtns();});
  v.querySelectorAll('[data-repeat]').forEach(b=>b.addEventListener('click',()=>{const s=state.sessions.find(x=>x.id===b.dataset.repeat);if(s)startSession({ids:s.exercises.map(e=>e.id),msg:draft.deload?'Deload — same exercises, lighter loads':'Loaded — weights prefilled from history',deload:draft.deload,source:'repeat'});}));
  v.querySelectorAll('[data-routine]').forEach(el=>el.addEventListener('click',e=>{
    if(e.target.closest('[data-delroutine]'))return;
    const r=state.routines.find(x=>x.id===el.dataset.routine);if(r)startSession({ids:r.exIds,msg:draft.deload?r.name+' — deload (lighter loads)':r.name+' loaded',deload:draft.deload,source:'routine'});}));
  v.querySelectorAll('[data-delroutine]').forEach(b=>b.addEventListener('click',()=>{
    const r=state.routines.find(x=>x.id===b.dataset.delroutine);if(!r)return;
    showConfirm('Delete routine?',r.name+' will be removed.','Delete',()=>{const copy=Object.assign({},r);S.deleteRoutine(r.id);render();toast('Routine deleted',{label:'Undo',fn:()=>{S.saveRoutine(copy);render();}});});}));
  // editor
  bindClick('#btnAddEx',openAddExercise);
  const sg=v.querySelector('[data-suggest]');if(sg)sg.addEventListener('click',()=>addExerciseToCur(sg.dataset.suggest));
  bindClick('#btnReorder',reorderCur);
  bindClick('#btnSaveRoutine',()=>saveAsRoutine(cur()));
  bindClick('#btnSessNote',openSessionNote);bindClick('#sessNoteShow',openSessionNote);
  const ed=$('#editDate');if(ed)ed.addEventListener('change',()=>changeEditDate(ed.value));
  bindClick('#btnFinish',finishWorkout);bindClick('#btnFinishTop',finishWorkout);   // two routes, one function
  bindClick('#btnSaveEdit',finishEdit);
  bindClick('#btnDiscard',discardActive);
  const ll=$('#logList');if(ll)bindLog(ll);
  if(todayScreen==='active'&&state.active&&state.active.kind==='cardio')bindCardioLive();else stopCardioClock();
  if(todayScreen==='active'&&state.active&&$('#elapsedLbl'))scheduleElapsed();else stopElapsed();
  // history
  const cal=v.querySelector('.cal-grid');
  if(cal)cal.addEventListener('click',e=>{const c=e.target.closest('[data-day]');if(!c)return;const d=+c.dataset.day;selDay=selDay===d?null:d;render();});
  v.querySelectorAll('[data-mon]').forEach(b=>b.addEventListener('click',()=>{calMonth+=+b.dataset.mon;selDay=null;render();}));
  bindClick('#btnHistMore',()=>{histShown+=30;render();});
  // [data-sess] is handled by the delegated #view listener above (fires from History AND the Home card).
  // progress: PR rows open the lift's detail (with its progress trend)
  const prc=$('#prCard');if(prc)prc.addEventListener('click',e=>{const r=e.target.closest('[data-openex]');if(r&&EX[r.dataset.openex])openSheet(EX[r.dataset.openex].name,exerciseDetail(r.dataset.openex));});
  // library
  const ls=$('#libSearch');if(ls)ls.addEventListener('input',()=>{libQuery=ls.value;const pos=ls.selectionStart;render();const n=$('#libSearch');if(n){n.focus();n.setSelectionRange(pos,pos);}});
  v.querySelectorAll('[data-lg]').forEach(b=>b.addEventListener('click',()=>{libGroup=b.dataset.lg;render();}));
  // library rows: the "+" adds straight to today's workout; the rest of the row opens details
  v.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',e=>{
    if(e.target.closest('.ex-add')){addExerciseToCur(b.dataset.open);return;}
    if(EX[b.dataset.open])openSheet(EX[b.dataset.open].name,exerciseDetail(b.dataset.open));}));
}
// One stepper tick on a set's weight/reps (shared by tap and hold-to-repeat).
function stepSet(ei,si,f,d){
  const t=cur();if(!t||!t.exercises[ei]||!t.exercises[ei].sets[si])return;const st=t.exercises[ei].sets[si];
  let v=+st[f]||0;v+=f==='w'?d*inc(EX[t.exercises[ei].id]):d;if(v<0)v=0;st[f]=v;st.t=1;persistCur();   // the +/- step matches the lift's increment (2.5 for dumbbells/isolation)
  const inp=$(`input[data-f="${f}"][data-ei="${ei}"][data-s="${si}"]`);if(inp)inp.value=v;refreshStats();
  try{if(navigator.vibrate)navigator.vibrate(8);}catch(e){}   // light haptic where the platform has one (Android); iOS Safari has none
}
// Hold-to-repeat state: after HOLD_DELAY the stepper repeats every HOLD_EVERY until the pointer lifts.
// A hold that repeated at least once suppresses the trailing click, so a hold never adds one extra.
const HOLD_DELAY=400,HOLD_EVERY=110,HOLD_MAX=60;
let holdT=null,holdI=null,holdSteps=0,heldRepeat=false;
function stopHold(){clearTimeout(holdT);clearInterval(holdI);holdT=holdI=null;}
function bindLog(root){
  stopHold();   // a re-render replaces the buttons mid-hold; never let a timer outlive its button
  if(!document.__holdWired){document.__holdWired=true;['pointerup','pointercancel'].forEach(ev=>document.addEventListener(ev,stopHold));}
  root.addEventListener('pointerdown',e=>{const b=e.target.closest('[data-step]');if(!b)return;
    stopHold();holdSteps=0;heldRepeat=false;
    const ei=+b.dataset.ei,si=+b.dataset.s,f=b.dataset.step,d=+b.dataset.d;
    holdT=setTimeout(()=>{holdI=setInterval(()=>{if(++holdSteps>HOLD_MAX){stopHold();return;}heldRepeat=true;stepSet(ei,si,f,d);},HOLD_EVERY);},HOLD_DELAY);});
  root.addEventListener('pointerleave',stopHold);
  // Tapping a number selects it, so typing REPLACES the old value instead of inserting into it.
  // iOS Safari ignores a synchronous select() inside the focus handler — hence the deferred range set.
  const selectAll=inp=>{try{inp.select();}catch(x){}setTimeout(()=>{try{if(document.activeElement===inp)inp.setSelectionRange(0,inp.value.length);}catch(x){}},0);};
  root.addEventListener('focusin',e=>{const inp=e.target.closest&&e.target.closest('input[data-f]');if(inp)selectAll(inp);});
  // Also on every TAP (after the browser has placed its caret): tapping an already-focused number
  // re-selects it too, so "tap, type" always replaces — the behaviour the owner asked for.
  root.addEventListener('pointerup',e=>{const inp=e.target.closest&&e.target.closest('input[data-f]');if(inp)selectAll(inp);});
  // Enter / "Done" moves on: weight → reps → next set's weight → done.
  root.addEventListener('keydown',e=>{if(e.key!=='Enter')return;const inp=e.target.closest&&e.target.closest('input[data-f]');if(!inp)return;e.preventDefault();
    const ei=+inp.dataset.ei,si=+inp.dataset.s,f=inp.dataset.f;
    const next=f==='w'?$(`input[data-f="r"][data-ei="${ei}"][data-s="${si}"]`):$(`input[data-f="w"][data-ei="${ei}"][data-s="${si+1}"]`);
    if(next)next.focus();else inp.blur();});
  root.addEventListener('click',e=>{
    const t=cur();if(!t)return;
    const chk=e.target.closest('[data-check]');if(chk){const ei=+chk.dataset.check,si=+chk.dataset.s;const st=t.exercises[ei].sets[si];
      if(!st.done){const cex=EX[t.exercises[ei].id];
        // Ticking a loaded lift with no weight would save a 0-volume "working" set and poison "last time".
        // Point the user at the weight field instead of silently accepting it. Bodyweight moves are exempt,
        // and so are time-held lifts (a carry can be logged by time alone; load is optional).
        if(cex&&cex.equip!=='Bodyweight'&&!D.TIME_METRIC.has(cex.id)&&!(+st.w>0)){const wi=$(`input[data-f="w"][data-ei="${ei}"][data-s="${si}"]`);if(wi){wi.focus();if(wi.select)wi.select();}toast('Add a weight first');return;}
        // Timed lifts log seconds in the reps field. Ticking with it empty saves a set finalizeSets then
        // drops (r>0 required), losing the tick with no warning — require the seconds first.
        if(cex&&D.TIME_METRIC.has(cex.id)&&!(+st.r>0)){const ri=$(`input[data-f="r"][data-ei="${ei}"][data-s="${si}"]`);if(ri){ri.focus();if(ri.select)ri.select();}toast('Add seconds first');return;}}
      st.done=!st.done;
      // T1: stamp on completion, but keep an existing stamp on un-tick → re-tick (a mis-tap corrected
      // seconds later keeps its true time, instead of jumping to "now" and skewing the rest medians).
      if(st.done&&!(+st.at>0))st.at=Date.now();
      if(st.done&&todayScreen==='active'&&state.settings.rest.auto&&!st.warm)startRest(restSecondsFor(t.exercises[ei].id));persistCur();render();return;}
    const wm=e.target.closest('[data-warm]');if(wm){const ei=+wm.dataset.warm,si=+wm.dataset.s;const st=t.exercises[ei].sets[si];st.warm=!st.warm;persistCur();render();toast(st.warm?'Marked as warm-up':'Counted as a working set');return;}
    const step=e.target.closest('[data-step]');if(step){if(heldRepeat){heldRepeat=false;return;}   // the click after a hold is not one more step
      stepSet(+step.dataset.ei,+step.dataset.s,step.dataset.step,+step.dataset.d);return;}
    const add=e.target.closest('[data-addset]');if(add){const ei=+add.dataset.addset;const sets=t.exercises[ei].sets;const last=sets[sets.length-1]||{w:'',r:''};sets.push({w:last.w,r:last.r,done:false});persistCur();render();return;}
    const sw=e.target.closest('[data-stopwatch]');if(sw){startStopwatch(+sw.dataset.stopwatch);return;}
    const pl=e.target.closest('[data-plates]');if(pl){const ex=t.exercises[+pl.dataset.plates],m=P.modeOf(ex);const top=Math.max(0,...ex.sets.filter(s=>!s.warm).map(s=>+s.w||0));openPlateSheet(top||barWeight(m),m);return;}   // heaviest entered work set (not just ticked ones — you load the bar before lifting)
    const rem=e.target.closest('[data-delset]');if(rem){const ei=+rem.dataset.delset;const sets=t.exercises[ei].sets;if(sets.length<=1)return;
      const idx=sets.length-1;
      const doRemove=()=>{const removed=sets.splice(idx,1)[0];persistCur();render();
        toast('Set removed',{label:'Undo',fn:()=>{const c=cur();if(c&&c.exercises[ei]){c.exercises[ei].sets.splice(idx,0,removed);persistCur();render();}}});};
      if(sets[idx].done)showConfirm('Remove last set?','That set is marked done — remove it anyway?','Remove',doRemove);else doRemove();return;}
    const del=e.target.closest('[data-delex]');if(del){const ei=+del.dataset.delex;const removed=t.exercises.splice(ei,1)[0];persistCur();render();
      toast(removed.name+' removed',{label:'Undo',fn:()=>{const c=cur();if(c){c.exercises.splice(ei,0,removed);persistCur();render();}}});return;}
    const kw=e.target.closest('[data-keepw]');if(kw){const ei=+kw.dataset.keepw;const ex=t.exercises[ei];const lp=P.lastPerf(state.sessions,ex.id,{beforeTs:t.date,excludeId:t.id,mode:P.trackOf(ex)});
      if(lp)ex.sets=lp.sets.map(s=>({w:s.w,r:s.r,done:false}));persistCur();render();toast('Using last time’s weights');return;}
    const mc=e.target.closest('[data-mode]');if(mc){openModePicker(+mc.dataset.mode);return;}
    // "⇆ Each side": flip one-side-at-a-time. Stored only when it differs from the lift's default, so a
    // lift on its default has no flag (and stays on its existing history track).
    const sd=e.target.closest('[data-side]');if(sd){const ex=t.exercises[+sd.dataset.side];if(!ex)return;
      const next=P.sidesOf(ex)!==2;if(next===P.sideDefault(ex.id))delete ex.side;else ex.side=next;
      persistCur();render();toast(next?'One side at a time — reps per side':'Both sides at once');return;}
    const nt=e.target.closest('[data-note]');if(nt){openNote(+nt.dataset.note);return;}
    const oe=e.target.closest('[data-openex]');if(oe){if(EX[oe.dataset.openex])openSheet(EX[oe.dataset.openex].name,exerciseDetail(oe.dataset.openex));return;}
  });
  root.addEventListener('input',e=>{const inp=e.target.closest('input[data-f]');if(!inp)return;const t=cur();if(!t)return;
    const ei=+inp.dataset.ei,si=+inp.dataset.s,f=inp.dataset.f;const val=P.parseWeightInput(inp.value);
    if(val!==inp.value)inp.value=val;   // reflect the sanitized value back (e.g. "12,5" -> "12.5")
    const st=t.exercises[ei].sets[si];st[f]=val===''?'':(f==='r'?parseInt(val)||val:parseFloat(val)||val);
    st.t=1;   // edited but not necessarily ticked — Finish will ask before dropping it
    persistCur();refreshStats();});
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
  stopSw();   // rest and stopwatch share one slot — never stack them (U2)
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

/* ---------------- stopwatch (time-held lifts: planks, carries, hangs) ---------------- */
// Shares the rest-bar chassis and is mutually exclusive with it (same screen slot). Clock-driven off
// Date.now(), never a tick count, so locking the phone mid-hold doesn't lose time. State is in-memory
// and session-scoped like the rest timer — nothing to persist.
let swState=null,swInt=null;   // {ex, phase:'count'|'run', end (countdown) / start (elapsed)}
function stopSw(){clearInterval(swInt);swInt=null;swState=null;const b=$('#swbar');if(b)b.classList.remove('on','run');}
function startStopwatch(ei){
  const t=cur();if(!t||!t.exercises[ei]||todayScreen!=='active')return;
  stopRest();unlockAudio();   // the two bars can't share the slot; drop any running rest first
  // Capture the exercise OBJECT, not its index — the list can be deleted/reordered while the timer runs,
  // and an index would then point at a different lift (or off the end). The object ref survives both.
  swState={ex:t.exercises[ei],phase:'count',end:Date.now()+5000};   // 5s to get into position
  const b=$('#swbar');if(b){b.classList.add('on');b.classList.remove('run');}
  clearInterval(swInt);swInt=setInterval(tickSw,100);tickSw();
}
function tickSw(){
  if(!swState)return;
  if(currentTab!=='today'||todayScreen!=='active'||!state.active){   // left the editor (Home, or a History/Progress/Library tab switch) → self-stop instead of counting over another screen and writing into a hidden workout (U3)
    const wasRun=swState.phase==='run';stopSw();if(wasRun)toast('Hold stopped — you left the workout');return;}
  const b=$('#swbar');if(!b)return;
  if(swState.phase==='count'){
    const rem=Math.max(0,swState.end-Date.now()),n=Math.ceil(rem/1000);
    $('#swLbl').textContent='Get set';$('#swTime').textContent=n>0?String(n):'Go';
    if(rem<=0){swState.phase='run';swState.start=Date.now();b.classList.add('run');beep();try{if(navigator.vibrate)navigator.vibrate(120);}catch(e){}}
    return;
  }
  const el=Math.floor((Date.now()-swState.start)/1000);
  $('#swLbl').textContent='Holding';$('#swTime').textContent=Math.floor(el/60)+':'+String(el%60).padStart(2,'0');
}
// Stop writes the elapsed seconds into the next unticked set (adding one if every set is done) and ticks
// it. Stopping during the countdown just cancels — nothing was held yet.
function finishStopwatch(){
  if(!swState){stopSw();return;}
  if(swState.phase!=='run'){stopSw();toast('Stopwatch cancelled');return;}
  const t=cur(),ex=swState.ex,secs=Math.max(1,Math.round((Date.now()-swState.start)/1000));
  stopSw();
  // Resolve the exercise by identity, not index — if it was deleted mid-hold, say so instead of writing
  // the time onto whatever now sits at that index.
  if(!t||!ex||t.exercises.indexOf(ex)<0){toast('That exercise was removed — hold not logged');return;}
  const sets=ex.sets;let st=sets.find(s=>!s.done&&!s.warm);   // next unticked WORKING set (skip warm-ups)
  if(!st){st={w:sets.length?sets[sets.length-1].w:'',r:'',done:false};sets.push(st);}
  st.r=secs;st.done=true;if(!(+st.at>0))st.at=Date.now();
  persistCur();render();toast('Logged '+secs+'s');
}

/* ---------------- boot ---------------- */
function boot(){
  state.sessions.forEach(s=>{if(!s.schema)s.schema=SCHEMA;});   // schema migrations live here
  document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
  $('#sheetClose').addEventListener('click',closeSheet);$('#scrim').addEventListener('click',closeSheet);
  $('#cdCancel').addEventListener('click',closeConfirm);$('#cscrim').addEventListener('click',closeConfirm);
  $('#cdOk').addEventListener('click',()=>{const cb=_confirmCb;closeConfirm();if(cb)cb();});
  $('#sheetBody').addEventListener('click',e=>{const a=e.target.closest('[data-addto]');if(a){addExerciseToCur(a.dataset.addto);closeSheet();return;}
    const pm=e.target.closest('[data-prmark]');if(pm){markBestSet(pm.dataset.prmark,pm);return;}
    const pu=e.target.closest('[data-prunmark]');if(pu){unmarkSets(pu.dataset.prunmark);return;}});
  $('#btnSettings').addEventListener('click',openSettings);
  $('#restSkip').addEventListener('click',stopRest);
  $('#swStop').addEventListener('click',finishStopwatch);$('#swCancel').addEventListener('click',()=>{stopSw();toast('Stopwatch cancelled');});
  $('#restAdd').addEventListener('click',()=>{
    if(!restState){   // during the "Go!" (done) grace state, +15s starts a fresh short rest instead of no-op
      if($('#restbar').classList.contains('done')){restState={total:15,end:Date.now()+15000};$('#restbar').classList.remove('done');$('#restLbl').textContent='Rest';}
      else return;
    }else{restState.end+=15000;restState.total+=15;$('#restbar').classList.remove('done');}
    if(!restInt)restInt=setInterval(tickRest,300);tickRest();});
  document.addEventListener('pointerdown',unlockAudio);
  // On resume, re-render the live editor so the stale banner / idle time reflect the real elapsed
  // time (a suspended tab's minute timer won't have fired). Never while typing.
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&todayScreen==='active'&&state.active){const a=document.activeElement;if(!(a&&a.tagName==='INPUT'))render();}});
  $('#view').addEventListener('click',e=>{if(e.target.closest('[data-vol-info]'))toast('Volume = weight × reps, added up across your working sets');});
  // re-render on cloud changes, but never yank focus from someone typing a weight
  S.onChange(()=>{updateCloud();const a=document.activeElement;if(a&&a.tagName==='INPUT')return;render();});
  applyTheme();watchViewport();initSheetGestures();setTab('today');S.initCloud();
  if(state.justSeeded)setTimeout(()=>toast('Sample data loaded — explore every tab'),600);
}
IL.ui={toast,render,setTab,openSettings,boot};
// Last-resort guards: a runtime error in an event handler or a rejected promise should degrade
// quietly, never blank the screen or surface a raw stack to the user.
try{
  window.addEventListener('error',e=>{try{console.error('runtime error',e.error||e.message);}catch(_){}});
  window.addEventListener('unhandledrejection',e=>{try{console.error('unhandled rejection',e.reason);}catch(_){}});
}catch(e){}
try{boot();}catch(err){try{console.error('boot failed',err);}catch(e){}}
