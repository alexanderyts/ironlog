// UI, part 1 of 4 — CORE: helpers, module state, toast/confirm/sheet infra, theme, cloud badge,
// the router (render/setTab). The four ui-*.js files (core → today → views → bind) are concatenated
// by build.js into ONE IIFE and share one lexical scope, exactly as the original single ui.js did;
// the split is for navigability only. Everything that touches the DOM lives across these four.
var IL=globalThis.IL||(globalThis.IL={});
const CFG=IL.config||{},D=IL.data,P=IL.prog,B=IL.builder,A=IL.analysis,S=IL.store,SR=IL.search,DBX=IL.dropbox;
const {EX,EXERCISES,GROUPS,PRESETS,exIcon,C,I,MODES,MODE_ORDER,EQUIP_MODE}=D;
const modeOf=P.modeOf;
const state=S.state;
const APP_VERSION=CFG.VERSION||'0';

/* ---------------- helpers ---------------- */
const $=s=>document.querySelector(s);
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
const U=()=>state.settings.unit;
const inc=ex=>P.unitIncrement(U(),ex);
const bw=()=>+state.settings.bodyweight||0;
const {DAY,startOfDay,fmtVol}=P;
// Minutes → a short human duration: "5 min", "1 h 12 min", "2 h". Used for workout length.
function fmtDur(min){min=Math.max(0,Math.round(min||0));if(min<60)return min+' min';const h=Math.floor(min/60),m=min%60;return m?h+' h '+m+' min':h+' h';}
// Live elapsed since a workout started (ms timestamp): the editor header ticks this each minute.
function fmtElapsed(startTs){const m=Math.floor((Date.now()-startTs)/60000);return m<1?'just started':fmtDur(m);}
// A wall-clock time like "7:42 PM" (for the forgotten-Finish end-time choice).
function fmtClock(ts){return new Date(ts).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});}
// Seconds → "2:10" (rest durations).
function fmtSec(s){s=Math.round(s||0);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');}
function fmtDate(ts){return new Date(ts).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});}
function relDay(ts){const t=startOfDay(Date.now()),d=startOfDay(ts);const diff=Math.round((t-d)/DAY);
  if(diff===0)return'Today';if(diff===1)return'Yesterday';if(diff<7)return diff+' days ago';return fmtDate(ts);}
const volOf=s=>P.sessionVolume(s,bw());
const setsOf=s=>P.sessionSets(s);
// A "Volume" stat label, tappable for a one-line explainer (the number itself, e.g. "12,480 lb", has
// no context otherwise — see ROADMAP-v2 #1).
function volLabel(label){return `<span data-vol-info style="cursor:pointer">${label||'Volume'} <span class="dim" style="font-weight:400">ⓘ</span></span>`;}
const completedSessions=()=>state.sessions.filter(s=>s.completed!==false&&s.exercises.length&&s.kind!=='cardio');   // strength only — feeds every lifting stat
const completedAny=()=>state.sessions.filter(s=>s.completed!==false&&(s.exercises.length||s.kind==='cardio'));   // strength ∪ cardio — for History, "this week" count, streak
const ICON_BACK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>';
function demoURL(id){const e=EX[id];if(!e)return 'https://www.youtube.com/';return 'https://www.youtube.com/results?search_query='+encodeURIComponent('how to '+e.name+' proper form technique');}

let toastT=null;
function toast(msg,action){
  const t=$('#toast'),b=$('#toastAct');$('#toastMsg').textContent=msg;
  if(action){b.hidden=false;b.textContent=action.label;b.onclick=()=>{hideToast();action.fn();};t.classList.add('act');}
  else{b.hidden=true;b.onclick=null;t.classList.remove('act');}
  // long enough to actually read: ~55 ms per character, 1.9 s minimum, 7 s maximum (review 7.3)
  t.classList.add('on');clearTimeout(toastT);toastT=setTimeout(hideToast,action?6000:Math.min(7000,Math.max(1900,String(msg).length*55)));
}
function hideToast(){$('#toast').classList.remove('on','act');}
let _confirmCb=null;
let _confirmReturn=null;
function showConfirm(title,msg,okLabel,cb,kind){
  $('#cdTitle').textContent=title;$('#cdMsg').textContent=msg;
  const ok=$('#cdOk');ok.textContent=okLabel;ok.className='btn '+(kind==='primary'?'primary':'danger');
  _confirmCb=cb;const d=$('#cdialog');d.classList.add('on');d.setAttribute('aria-hidden','false');$('#cscrim').classList.add('on');
  _confirmReturn=document.activeElement;focusQuiet($('#cdCancel'));   // VoiceOver lands IN the dialog; Cancel is the safe default
}
function closeConfirm(){const d=$('#cdialog');d.classList.remove('on');d.setAttribute('aria-hidden','true');$('#cscrim').classList.remove('on');_confirmCb=null;
  const r=_confirmReturn;_confirmReturn=null;if(r&&document.contains(r)&&r!==document.body&&!/^(INPUT|TEXTAREA)$/.test(r.tagName))focusQuiet(r);}
/* scrollTop=0: a reused sheet must open at its top (search bar), not wherever the last one was scrolled.
   The blur + scroll-to-top is the fix for "I tapped Add exercise and nothing happened": the sheet is
   position:fixed, i.e. anchored to the LAYOUT viewport, and iOS does not shrink that viewport for the
   keyboard — it scrolls the visual viewport up over it. So opening a sheet while a weight/name field
   still held focus painted it below the visible area, above the band the keyboard occupies. Dropping
   focus first lets iOS restore the viewport before the sheet slides up. Deliberately touches nothing
   in the tab-bar / safe-area model (--deficit, --screen-h) — see the invariant note in styles.css. */
let _sheetReturnY=null,_sheetReturnFocus=null;   // background scroll position stashed when a sheet had to scroll the page to top; the element that opened it
function focusQuiet(el){try{if(el)el.focus({preventScroll:true});}catch(e){}}
function openSheet(title,body){
  // Only when a field actually had focus — blurring/scrolling unconditionally would throw away the
  // reader's scroll position every time they tap a PR row or an exercise from a scrolled list. When we
  // DO scroll to top (the iOS keyboard fix), remember where they were so closeSheet can put them back —
  // otherwise opening a Note or the ⓘ mid-set dumped them at the top of a long workout.
  try{const ae=document.activeElement;
    if(ae&&/^(INPUT|TEXTAREA)$/.test(ae.tagName)){ae.blur();
      if(window.scrollY){if(_sheetReturnY==null)_sheetReturnY=window.scrollY;window.scrollTo(0,0);}}
  }catch(e){}
  const sh=$('#sheet');if(!sh.classList.contains('on'))_sheetReturnFocus=document.activeElement;
  $('#sheetTitle').textContent=title;const b=$('#sheetBody');b.innerHTML=body;b.scrollTop=0;sh.classList.add('on');sh.setAttribute('aria-hidden','false');$('#scrim').classList.add('on');a11yScan(b);
  focusQuiet($('#sheetTitle'));   // announce the panel; a sheet that wants a field focused (notes) does so right after
}
function closeSheet(){const sh=$('#sheet'),sc=$('#scrim');
  sh.style.transition='';sh.style.transform='';if(sc)sc.style.opacity='';   // drop any leftover swipe-drag inline styles so the CSS slide-out runs
  sh.classList.remove('on');sh.setAttribute('aria-hidden','true');sc.classList.remove('on');
  const rf=_sheetReturnFocus;_sheetReturnFocus=null;if(rf&&document.contains(rf)&&rf!==document.body&&!/^(INPUT|TEXTAREA)$/.test(rf.tagName))focusQuiet(rf);   // back to the button that opened it (not a field: that would pop the keyboard)
  if(_sheetReturnY!=null){const y=_sheetReturnY;_sheetReturnY=null;try{window.scrollTo(0,y);}catch(e){}}   // restore the pre-sheet scroll position
}
// Swipe-down-to-dismiss for the bottom sheet (the grab bar promised this). Drag from the grab bar/header,
// or from the body when it's scrolled to the top; a horizontal swipe (chip rows) or a drag on a text
// field is ignored. Past ~28% of the height, or a quick flick, it closes; otherwise it springs back.
function initSheetGestures(){
  const sheet=$('#sheet');if(!sheet)return;
  let startY=0,startX=0,dy=0,active=false,committed=false,t0=0;
  const H=()=>sheet.getBoundingClientRect().height||1;
  sheet.addEventListener('touchstart',e=>{
    if(!sheet.classList.contains('on')||e.touches.length!==1)return;
    const tgt=e.target,onHandle=tgt.closest&&tgt.closest('.sheet-grab,.sheet-head');
    const body=$('#sheetBody'),atTop=body&&body.contains(tgt)&&body.scrollTop<=0;
    const isField=tgt.closest&&tgt.closest('input,textarea,select,[contenteditable]');
    if(!onHandle&&(!atTop||isField))return;   // let the body scroll / the field be used
    active=true;committed=false;dy=0;startY=e.touches[0].clientY;startX=e.touches[0].clientX;t0=Date.now();
  },{passive:true});
  sheet.addEventListener('touchmove',e=>{
    if(!active)return;const y=e.touches[0].clientY,dx=e.touches[0].clientX-startX;dy=y-startY;
    if(!committed){
      if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>6){active=false;return;}   // horizontal gesture → not a dismiss
      if(dy>6){committed=true;sheet.style.transition='none';}else return;
    }
    if(dy<0)dy=0;e.preventDefault();
    sheet.style.transform='translateY('+dy+'px)';
    const sc=$('#scrim');if(sc)sc.style.opacity=String(Math.max(0,1-dy/H()));
  },{passive:false});
  const end=()=>{
    if(!active)return;active=false;if(!committed){dy=0;return;}
    sheet.style.transition='';   // hand back to the CSS spring
    const flick=(Date.now()-t0)<300&&dy>60;
    if(dy>H()*0.28||flick){closeSheet();}
    else{sheet.style.transform='';const sc=$('#scrim');if(sc)sc.style.opacity='';}   // snap back
    dy=0;committed=false;
  };
  sheet.addEventListener('touchend',end);sheet.addEventListener('touchcancel',end);
}
function applyTheme(){const t=state.settings.theme;if(t==='system')document.documentElement.removeAttribute('data-theme');else document.documentElement.setAttribute('data-theme',t);}
function updateCloud(){
  const el=$('#cloudStatus'),t=$('#cloudText');if(!el)return;
  if(state.storageError){el.className='cloud err';t.textContent='Storage full';return;}   // takes priority: the on-device save is failing, data is at risk
  if(CFG.DEMO){el.className='cloud';t.textContent='Demo · sample data';return;}
  if(state.cloudError&&state.cloudName!=='none'){el.className='cloud err';t.textContent='Sync problem';return;}
  if(state.cloudName==='artifact'||state.cloudName==='dropbox'){
    const pending=state.dirty.size||state.syncing;
    el.className='cloud '+(pending?'local':'synced');
    t.textContent=pending?'Syncing…':(state.cloudName==='dropbox'?'Synced':'Backed up');   // distinct wording — identical text here was mistaken for viewing the wrong build during Phase 2 debugging
  }else{el.className='cloud local';t.textContent='On this phone';}
}

/* ---------------- accessibility (review 7.7) ----------------
   Tappable rows are <div>s with data-* handlers, and toggles are styled buttons whose state is a CSS
   class. Rather than hand-annotating ~40 templates, one observer marks them as they appear: rows get
   role=button + tabindex, .sw toggles become switches (aria-checked), chips/segments report
   aria-pressed, kept in sync whenever their `on` class flips. Enter/Space activates a div "button". */
const A11Y_ROWS='[data-day],[data-sess],[data-open],[data-openex],[data-quickadd],[data-avtoggle],[data-routine],div[data-action],span[data-vol-info]';
const A11Y_TOGGLES='button.sw,button.chip,.seg button';
function a11yMark(el){
  if(el.matches(A11Y_ROWS)&&!/^(BUTTON|A|INPUT)$/.test(el.tagName)){if(!el.hasAttribute('role'))el.setAttribute('role','button');if(!el.hasAttribute('tabindex'))el.setAttribute('tabindex','0');}
  if(el.matches('button.sw')){el.setAttribute('role','switch');el.setAttribute('aria-checked',String(el.classList.contains('on')));}
  else if(el.matches('button.chip,.seg button'))el.setAttribute('aria-pressed',String(el.classList.contains('on')));
}
function a11yScan(root){if(!root||root.nodeType!==1)return;a11yMark(root);root.querySelectorAll(A11Y_ROWS+','+A11Y_TOGGLES).forEach(a11yMark);}
function initA11y(){
  try{
    a11yScan(document.body);
    new MutationObserver(ms=>ms.forEach(m=>{
      if(m.type==='attributes'){if(m.target.matches&&m.target.matches(A11Y_TOGGLES))a11yMark(m.target);}
      else m.addedNodes.forEach(a11yScan);
    })).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
    document.addEventListener('keydown',e=>{
      if(e.defaultPrevented||(e.key!=='Enter'&&e.key!==' '))return;
      const t=e.target;if(!t||!t.getAttribute||t.getAttribute('role')!=='button'||/^(BUTTON|A|INPUT|TEXTAREA)$/.test(t.tagName))return;
      e.preventDefault();t.click();
    });
    document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;
      if($('#cdialog').classList.contains('on'))closeConfirm();else if($('#sheet').classList.contains('on'))closeSheet();});
  }catch(e){}
}
// Speak a short event (rest started / over, hold began); the ticking clocks themselves stay silent.
function announce(msg){const el=$('#srLive');if(!el)return;el.textContent='';setTimeout(()=>{el.textContent=msg;},50);}

/* ---------------- router ---------------- */
let currentTab='today';
let todayScreen='home';          // 'home' | 'start' | 'active' | 'edit'
let editSession=null,editDirty=false;
// The New-workout screen's transient picks. Reset in exactly one place: resetDraft(), called by
// startSession() when a workout begins — so nothing leaks into the next visit.
let draft={groups:new Set(),deload:false};
function resetDraft(){draft.groups=new Set();draft.deload=false;}
// Cardio-entry sheet's transient picks (type/intensity/distance/minutes). Rebuilt each time the sheet opens.
let cardioDraft=null;
const distanceUnit=()=>U()==='kg'?'km':'mi';   // cardio distance unit follows the weight unit
let calMonth=new Date().getFullYear()*12+new Date().getMonth(),selDay=null,histShown=30;   // History renders 30 at a time (#13)
let libQuery='',libGroup='All';
function setTab(t){vlog('tab '+t);if(t!==currentTab)histShown=30;currentTab=t;document.querySelectorAll('.tab').forEach(b=>{const on=b.dataset.tab===t;b.classList.toggle('active',on);if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});render();window.scrollTo(0,0);}
function render(){
  const v=$('#view');if(!v)return;
  // Error boundary: one malformed record must never white-screen the whole app. On failure, show a
  // recoverable message instead of a blank page (the data is still safe in storage).
  try{
    if(currentTab==='today')v.innerHTML=viewToday();
    else if(currentTab==='history')v.innerHTML=viewHistory();
    else if(currentTab==='library')v.innerHTML=viewLibrary();
    else if(currentTab==='progress')v.innerHTML=viewProgress();
    bind();updateCloud();a11yScan(v);
  }catch(err){
    try{console.error('render failed',err);}catch(e){}
    v.innerHTML='<div class="wrap" style="padding:40px 16px;text-align:center"><h2 style="font-size:20px">Something went wrong</h2>'
      +'<p class="muted" style="margin:10px 0 18px">Your data is safe. Try reloading — if a tab keeps failing, tell us what you were doing.</p>'
      +'<button class="btn primary" id="ilReload" style="display:inline-block">Reload</button></div>';
    const rb=v.querySelector('#ilReload');if(rb)rb.onclick=()=>location.reload();   // JS handler (no inline on* — CSP-safe)
  }
}
/* Derived-stat memo (P2). Every expensive read — Progress-tab analytics, a card's all-time PR — is a
   full scan of state.sessions. They're pure in (sessions, bodyweight, unit, day), so we cache the
   result and reuse it until one of those actually changes. This is what stops the Progress tab from
   re-scanning history ~8× on every collapse/cloud-ping, and the live editor from re-scanning per card
   on every set tick (the completed workout isn't in `sessions` yet, so the sig is stable while logging). */
let _memoSig='',_memo=new Map();
function statSig(){
  const ss=state.sessions;let mx=0;for(let i=0;i<ss.length;i++){const u=ss[i].updatedAt||0;if(u>mx)mx=u;}
  // Day bucket so date-windowed stats refresh at a rollover even with no new data. Shift by the local
  // tz offset so it rolls at LOCAL midnight (the same boundary weekStart/30-day windows use), not UTC —
  // otherwise a PWA left open across local midnight shows stale windows until the UTC rollover.
  const localDay=Math.floor((Date.now()-new Date().getTimezoneOffset()*60000)/DAY);
  return ss.length+':'+mx+':'+bw()+':'+state.settings.unit+':'+localDay;
}
function memoStat(key,fn){
  const sig=statSig();
  if(_memoSig!==sig){_memoSig=sig;_memo.clear();}
  if(_memo.has(key))return _memo.get(key);
  const v=fn();_memo.set(key,v);return v;
}
// current session being edited on the Today tab (the live workout or a past one)
const cur=()=>todayScreen==='edit'?editSession:state.active;
// A sheet or undo toast captures the workout/exercise when it opens. If a sync replaces state.active
// meanwhile (a newer copy from your other phone), writing to the captured object is silently lost —
// persistCur saves the NEW object. Re-resolve at the moment of the write instead (review 7.5): same
// object → it; same workout id → the live copy; the exercise → by identity, else same id at that index.
function liveSession(t){const c=cur();return !t||!c?null:c===t?c:(c.id===t.id?c:null);}
function liveExercise(t,ex,ei){const c=liveSession(t);if(!c||!ex)return null;if(c.exercises.indexOf(ex)>=0)return ex;const x=c.exercises[ei];return x&&x.id===ex.id?x:null;}
function staleToast(){toast('This workout changed on another device — try that again');}
function persistCur(){if(todayScreen==='edit'){editDirty=true;return;}
  const was=state.storageError;
  if(!S.persistActive()&&!was)toast('Storage is full — this workout isn’t being saved. Export a backup from Settings.');   // warn once on the transition, not every tap
}

