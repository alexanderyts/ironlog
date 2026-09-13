// UI, part 4 of 4 — ACTIONS & WIRING: finish/discard, the delegated event table + bindings, the rest
// timer, and boot(). This file runs last, so boot() sees every function above. (Shares scope — see ui-core.js.)
/* ---------------- actions ---------------- */
function addExerciseToCur(id){
  // Lazy-inits an active session only when there isn't one — so it never overwrites a workout in
  // progress and needs no discard guard (unlike the start paths that go through startSession()).
  if(todayScreen!=='edit'&&!state.active){S.setActive(newSession([]));}
  const t=cur();
  if(t.exercises.some(x=>x.id===id)){toast('Already added');return;}
  t.exercises.push(B.seedExercise(id,state.sessions,{excludeId:t.id,unit:U()}));
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
  s.exercises.forEach(e=>{const emode=modeOf(e);const histBest=P.bestE1rmBefore(state.sessions,e.id,{mode:emode,bw:bw(),excludeId:s.id});if(histBest<=0)return;
    let best=0,bs=null;e.sets.forEach(st=>{if(st.warm||!P.isWorking(st))return;const est=P.e1rm(P.setLoad(e.id,st.w,bw()),+st.r||0);if((+st.r)&&est>best){best=est;bs=st;}});
    if(bs&&best>histBest)prs.push({name:EX[e.id]?EX[e.id].name:e.name,w:bs.w,r:bs.r,perHand:MODES[emode]&&MODES[emode].perHand});});
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
      <div class="card list">${sm.prs.map(p=>`<div class="ex-row"><span style="color:var(--good);font-size:18px;flex-shrink:0">★</span><div style="flex:1;min-width:0"><div class="ex-name">${esc(p.name)}</div><div class="ex-sub">${p.w}${U()}${p.perHand?'/ea':''} × ${p.r}</div></div></div>`).join('')}</div>`;
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
  }else commitFinish(s,now,false);
}
function commitFinish(s,endedAt,estimated){
  closeSheet();stopRest();stopElapsed();
  s.endedAt=endedAt;if(estimated)s.endEstimated=true;else delete s.endEstimated;
  cleanSets(s);
  if(!s.exercises.length){toast('Log at least one set first');return;}
  const sm=workoutSummary(s);
  s.completed=true;s.updatedAt=Date.now();
  S.upsertSession(s,false);state.active=null;S.persistActive();todayScreen='home';
  render();showSummary(sm);
}
function discardActive(){showConfirm('Discard workout?','Nothing from this session will be saved.','Discard',()=>{
  stopRest();stopElapsed();const copy=state.active;state.active=null;S.persistActive();todayScreen='home';render();
  toast('Workout discarded',{label:'Undo',fn:()=>{S.setActive(copy);todayScreen='active';render();}});});}
function startEdit(s){editSession=JSON.parse(JSON.stringify(s));editDirty=false;todayScreen='edit';setTab('today');}
function finishEdit(){
  const s=editSession;
  confirmUnchecked(s,()=>{
    cleanSets(s);
    if(!s.exercises.length){toast('Keep at least one set, or delete the session instead');return;}
    s.updatedAt=Date.now();S.upsertSession(s,false);
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
// Delegated view actions: a click on any element carrying data-action="name" (or inside one) runs
// ACTIONS[name](el, ev). One listener on #view covers every view and survives re-renders, so a new
// button is just markup + a table row — no per-view rebinding. (The editor, sheets and bindLog keep
// their own handlers; those are scoped to regions that change wholesale.)
const ACTIONS={
  startFlow:()=>{todayScreen='start';render();},
  resume:()=>{todayScreen='active';render();},
  goLibrary:()=>setTab('library'),
  backHome:()=>leaveEditor(),
  build:()=>buildAndStart(false),
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
  profileOpen:()=>openProfile()
};
function bind(){
  const v=$('#view');
  if(!v.__delegated){v.__delegated=true;v.addEventListener('click',e=>{
    const a=e.target.closest('[data-action]');if(a&&ACTIONS[a.dataset.action]){ACTIONS[a.dataset.action](a,e);return;}
    const sc=e.target.closest('[data-sess]');if(sc){openSessionDetail(sc.dataset.sess);return;}   // works from Home's last-session card AND History
  });}
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
  bindClick('#btnFinish',finishWorkout);
  bindClick('#btnSaveEdit',finishEdit);
  bindClick('#btnDiscard',discardActive);
  const ll=$('#logList');if(ll)bindLog(ll);
  if(todayScreen==='active'&&state.active&&$('#elapsedLbl'))scheduleElapsed();else stopElapsed();
  // history
  const cal=v.querySelector('.cal-grid');
  if(cal)cal.addEventListener('click',e=>{const c=e.target.closest('[data-day]');if(!c)return;const d=+c.dataset.day;selDay=selDay===d?null:d;render();});
  v.querySelectorAll('[data-mon]').forEach(b=>b.addEventListener('click',()=>{calMonth+=+b.dataset.mon;selDay=null;render();}));
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
  let v=+st[f]||0;v+=f==='w'?d*inc():d;if(v<0)v=0;st[f]=v;st.t=1;persistCur();
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
    const chk=e.target.closest('[data-check]');if(chk){const ei=+chk.dataset.check,si=+chk.dataset.s;const st=t.exercises[ei].sets[si];st.done=!st.done;
      if(st.done)st.at=Date.now();else delete st.at;   // T1: stamp when the set was completed (cleared if un-ticked)
      if(st.done&&todayScreen==='active'&&state.settings.rest.auto&&!st.warm)startRest(restSecondsFor(t.exercises[ei].id));persistCur();render();return;}
    const wm=e.target.closest('[data-warm]');if(wm){const ei=+wm.dataset.warm,si=+wm.dataset.s;const st=t.exercises[ei].sets[si];st.warm=!st.warm;persistCur();render();toast(st.warm?'Marked as warm-up':'Counted as a working set');return;}
    const step=e.target.closest('[data-step]');if(step){if(heldRepeat){heldRepeat=false;return;}   // the click after a hold is not one more step
      stepSet(+step.dataset.ei,+step.dataset.s,step.dataset.step,+step.dataset.d);return;}
    const add=e.target.closest('[data-addset]');if(add){const ei=+add.dataset.addset;const sets=t.exercises[ei].sets;const last=sets[sets.length-1]||{w:'',r:''};sets.push({w:last.w,r:last.r,done:false});persistCur();render();return;}
    const rem=e.target.closest('[data-delset]');if(rem){const ei=+rem.dataset.delset;const sets=t.exercises[ei].sets;if(sets.length<=1)return;
      const idx=sets.length-1;
      const doRemove=()=>{const removed=sets.splice(idx,1)[0];persistCur();render();
        toast('Set removed',{label:'Undo',fn:()=>{const c=cur();if(c&&c.exercises[ei]){c.exercises[ei].sets.splice(idx,0,removed);persistCur();render();}}});};
      if(sets[idx].done)showConfirm('Remove last set?','That set is marked done — remove it anyway?','Remove',doRemove);else doRemove();return;}
    const del=e.target.closest('[data-delex]');if(del){const ei=+del.dataset.delex;const removed=t.exercises.splice(ei,1)[0];persistCur();render();
      toast(removed.name+' removed',{label:'Undo',fn:()=>{const c=cur();if(c){c.exercises.splice(ei,0,removed);persistCur();render();}}});return;}
    const kw=e.target.closest('[data-keepw]');if(kw){const ei=+kw.dataset.keepw;const ex=t.exercises[ei];const lp=P.lastPerf(state.sessions,ex.id,{beforeTs:t.date,excludeId:t.id,mode:modeOf(ex)});
      if(lp)ex.sets=lp.sets.map(s=>({w:s.w,r:s.r,done:false}));persistCur();render();toast('Using last time’s weights');return;}
    const mc=e.target.closest('[data-mode]');if(mc){openModePicker(+mc.dataset.mode);return;}
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
  applyTheme();watchViewport();setTab('today');S.initCloud();
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
