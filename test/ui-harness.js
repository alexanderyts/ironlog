// Boots the REAL app bundle (the same code build.js ships) inside jsdom, in its own isolated realm —
// so UI flows can be asserted, not just eyeballed. Each launch() is a fresh window with empty
// localStorage and its own IL, so tests don't leak into each other or into the engine tests.
//
// Why jsdom + the full bundle (not requiring src/app/ui.js into node): the app's IL lives on the
// jsdom window's globalThis, never on node's, so there is zero pollution of the engine tests' IL/
// module cache. What runs here is exactly what the browser runs.
const {JSDOM}=require('jsdom');
const build=require('../build.js');

// Virtual clock for the jsdom window (see opts.fakeClock). Timers fire in time order as tick() moves
// `now` forward; an interval re-arms itself. Date objects built from a timestamp are unaffected.
function installFakeClock(win){
  let now=Date.now(),seq=1;const start=now,timers=new Map();
  const add=(fn,ms,rep)=>{const id=seq++,d=Math.max(0,+ms||0);timers.set(id,{fn,at:now+d,rep:rep?Math.max(1,d):0});return id;};
  win.setTimeout=(fn,ms,...a)=>add(()=>fn(...a),ms,false);
  win.setInterval=(fn,ms,...a)=>add(()=>fn(...a),ms,true);
  win.clearTimeout=win.clearInterval=id=>{timers.delete(id);};
  win.requestAnimationFrame=fn=>add(()=>fn(now-start),16,false);
  win.cancelAnimationFrame=id=>{timers.delete(id);};
  win.Date.now=()=>now;
  try{Object.defineProperty(win.performance,'now',{value:()=>now-start,configurable:true});}catch(e){}
  return {
    now:()=>now,
    tick(ms){const end=now+ms;
      for(let guard=0;guard<100000;guard++){let next=null;
        for(const [id,t] of timers)if(t.at<=end&&(!next||t.at<next[1].at))next=[id,t];
        if(!next)break;now=next[1].at;const t=next[1];
        if(t.rep)t.at+=t.rep;else timers.delete(next[0]);
        try{t.fn();}catch(e){}}
      now=end;}
  };
}
function launch(opts){
  opts=opts||{};let clock=null;
  const html=`<!doctype html><html><head></head><body>${build.body}<script>${build.bundle('site')}</script></body></html>`;
  const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:opts.url||'https://localhost/',
    beforeParse(window){
      window.scrollTo=()=>{};   // jsdom doesn't implement it; setTab calls it
      if(!window.matchMedia)window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});
      // opts.fakeClock: the app's timers and clocks (setTimeout/setInterval, requestAnimationFrame,
      // Date.now, performance.now) run on a virtual clock the test advances with h.clock.tick(ms) —
      // so a 5 s stopwatch countdown takes no real time and can't flake under a busy machine.
      if(opts.fakeClock)clock=installFakeClock(window);
      // opts.storage: {key:value} already on the phone BEFORE the app boots (boot-time migrations, bad data)
      if(opts.storage)Object.keys(opts.storage).forEach(k=>window.localStorage.setItem(k,JSON.stringify(opts.storage[k])));
      if(opts.rawStorage)Object.keys(opts.rawStorage).forEach(k=>window.localStorage.setItem(k,opts.rawStorage[k]));   // exact text, e.g. a half-written save
    }});
  const win=dom.window,doc=win.document;
  const IL=win.IL;
  if(!IL||!IL.store||!IL.ui)throw new Error('app failed to boot in jsdom');
  const $=s=>doc.querySelector(s);
  const $$=s=>[...doc.querySelectorAll(s)];
  const asEl=x=>typeof x==='string'?$(x):x;
  const click=x=>{const el=asEl(x);if(!el)throw new Error('click: no element for '+x);el.dispatchEvent(new win.MouseEvent('click',{bubbles:true,cancelable:true}));return el;};
  const type=(x,v)=>{const el=asEl(x);if(!el)throw new Error('type: no element for '+x);el.value=v;el.dispatchEvent(new win.Event('input',{bubbles:true}));return el;};
  const text=x=>{const el=asEl(x);return el?el.textContent.replace(/\s+/g,' ').trim():null;};
  const has=x=>!!asEl(x);
  const bodyText=()=>doc.body.textContent.replace(/\s+/g,' ').trim();
  return {dom,win,doc,IL,S:IL.store,state:IL.store.state,clock,$,$$,click,type,text,has,bodyText,
    teardown(){try{win.close();}catch(e){}}};
}

// Convenience: build the app, then drive the New-workout screen to a chosen preset/muscles and Build.
function buildWorkout(h,groups){
  h.click('[data-action="startFlow"]');
  (groups||['Chest']).forEach(g=>{const chip=h.$$('[data-g]').find(b=>b.dataset.g===g);if(chip)chip.dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));});
  h.click('[data-action="build"]');
}

module.exports={launch,buildWorkout};
