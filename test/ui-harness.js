// Boots the REAL app bundle (the same code build.js ships) inside jsdom, in its own isolated realm —
// so UI flows can be asserted, not just eyeballed. Each launch() is a fresh window with empty
// localStorage and its own IL, so tests don't leak into each other or into the engine tests.
//
// Why jsdom + the full bundle (not requiring src/app/ui.js into node): the app's IL lives on the
// jsdom window's globalThis, never on node's, so there is zero pollution of the engine tests' IL/
// module cache. What runs here is exactly what the browser runs.
const {JSDOM}=require('jsdom');
const build=require('../build.js');

function launch(opts){
  opts=opts||{};
  const html=`<!doctype html><html><head></head><body>${build.body}<script>${build.bundle('site')}</script></body></html>`;
  const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:opts.url||'https://localhost/',
    beforeParse(window){
      window.scrollTo=()=>{};   // jsdom doesn't implement it; setTab calls it
      if(!window.matchMedia)window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});
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
  return {dom,win,doc,IL,S:IL.store,state:IL.store.state,$,$$,click,type,text,has,bodyText,
    teardown(){try{win.close();}catch(e){}}};
}

// Convenience: build the app, then drive the New-workout screen to a chosen preset/muscles and Build.
function buildWorkout(h,groups){
  h.click('[data-action="startFlow"]');
  (groups||['Chest']).forEach(g=>{const chip=h.$$('[data-g]').find(b=>b.dataset.g===g);if(chip)chip.dispatchEvent(new h.win.MouseEvent('click',{bubbles:true}));});
  h.click('[data-action="build"]');
}

module.exports={launch,buildWorkout};
