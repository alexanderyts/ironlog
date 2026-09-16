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
const completedCardio=()=>state.sessions.filter(s=>s.completed!==false&&s.kind==='cardio');
const completedAny=()=>state.sessions.filter(s=>s.completed!==false&&(s.exercises.length||s.kind==='cardio'));   // strength ∪ cardio — for History, "this week" count, streak
const ICON_BACK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>';
function demoURL(id){const e=EX[id];if(!e)return 'https://www.youtube.com/';return 'https://www.youtube.com/results?search_query='+encodeURIComponent('how to '+e.name+' proper form technique');}

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
/* scrollTop=0: a reused sheet must open at its top (search bar), not wherever the last one was scrolled.
   The blur + scroll-to-top is the fix for "I tapped Add exercise and nothing happened": the sheet is
   position:fixed, i.e. anchored to the LAYOUT viewport, and iOS does not shrink that viewport for the
   keyboard — it scrolls the visual viewport up over it. So opening a sheet while a weight/name field
   still held focus painted it below the visible area, above the band the keyboard occupies. Dropping
   focus first lets iOS restore the viewport before the sheet slides up. Deliberately touches nothing
   in the tab-bar / safe-area model (--deficit, --screen-h) — see the invariant note in styles.css. */
function openSheet(title,body){
  // Only when a field actually had focus — blurring/scrolling unconditionally would throw away the
  // reader's scroll position every time they tap a PR row or an exercise from a scrolled list.
  try{const ae=document.activeElement;
    if(ae&&/^(INPUT|TEXTAREA)$/.test(ae.tagName)){ae.blur();if(window.scrollY)window.scrollTo(0,0);}
  }catch(e){}
  $('#sheetTitle').textContent=title;const b=$('#sheetBody');b.innerHTML=body;b.scrollTop=0;$('#sheet').classList.add('on');$('#scrim').classList.add('on');
}
function closeSheet(){$('#sheet').classList.remove('on');$('#scrim').classList.remove('on');}
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
function setTab(t){vlog('tab '+t);if(t!==currentTab)histShown=30;currentTab=t;document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));render();window.scrollTo(0,0);}
function render(){
  const v=$('#view');if(!v)return;
  // Error boundary: one malformed record must never white-screen the whole app. On failure, show a
  // recoverable message instead of a blank page (the data is still safe in storage).
  try{
    if(currentTab==='today')v.innerHTML=viewToday();
    else if(currentTab==='history')v.innerHTML=viewHistory();
    else if(currentTab==='library')v.innerHTML=viewLibrary();
    else if(currentTab==='progress')v.innerHTML=viewProgress();
    bind();updateCloud();
  }catch(err){
    try{console.error('render failed',err);}catch(e){}
    v.innerHTML='<div class="wrap" style="padding:40px 16px;text-align:center"><h2 style="font-size:20px">Something went wrong</h2>'
      +'<p class="muted" style="margin:10px 0 18px">Your data is safe. Try reloading — if a tab keeps failing, tell us what you were doing.</p>'
      +'<button class="btn primary" id="ilReload" style="display:inline-block">Reload</button></div>';
    const rb=v.querySelector('#ilReload');if(rb)rb.onclick=()=>location.reload();   // JS handler (no inline on* — CSP-safe)
  }
}
// current session being edited on the Today tab (the live workout or a past one)
const cur=()=>todayScreen==='edit'?editSession:state.active;
function persistCur(){if(todayScreen==='edit')editDirty=true;else S.persistActive();}

