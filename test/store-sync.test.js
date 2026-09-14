// Phase A: the store's Dropbox sync path, driven through the REAL dropboxAdapter with a fake backend.
// Boots the full bundle (BUILD='site') in jsdom, injects a fake IL.dropbox that records uploads, then
// checks the fixes: a non-session change uploads (#2), a no-op doesn't, a delete propagates, and an
// older app refuses to overwrite a newer backup (#21 version gate).
const test=require('node:test'),assert=require('node:assert/strict');
const {launch}=require('./ui-harness.js');

test('A2/A5: settings + deletes upload to Dropbox, no-ops do not, and an older app will not clobber a newer file',async()=>{
  const h=launch();
  try{
    let rev=1;const uploads=[];
    let file=JSON.stringify({app:'ironlog',format:2,version:'0.0.0',sessions:[],routines:[],deleted:{}});
    h.win.IL.dropbox={
      isConfigured:()=>true,isConnected:()=>true,handleRedirect:async()=>{},connect(){},disconnect(){},
      getMetadata:async()=>({rev}),download:async()=>({text:file,rev}),
      upload:async(text)=>{uploads.push(text);file=text;rev++;return 'r'+rev;}
    };
    await h.S.initCloud();
    assert.equal(h.state.cloudName,'dropbox','the dropbox adapter is active');
    const base=uploads.length;

    // (#2) a settings-only change must reach the shared file
    h.state.settings.profile={goal:'size'};h.S.saveSettingsCloud();
    await h.state.cloud.flush();
    assert.ok(uploads.length>base,'a profile change uploaded');
    assert.ok(JSON.parse(uploads[uploads.length-1]).settings.profile.goal==='size','the profile is in the file');

    // a genuine no-op must NOT upload
    const n=uploads.length;
    await h.state.cloud.flush();
    assert.equal(uploads.length,n,'nothing pending → no upload');

    // (#2) a delete must propagate as a tombstone
    h.S.upsertSession({id:'z',schema:1,date:Date.now(),updatedAt:Date.now(),completed:true,exercises:[{id:'back-squat',sets:[{w:100,r:5,done:true}]}]},false);
    await h.state.cloud.flush();
    const m=uploads.length;
    h.S.deleteSession('z');
    await h.state.cloud.flush();
    assert.ok(uploads.length>m,'a delete uploaded');
    assert.ok(JSON.parse(uploads[uploads.length-1]).deleted.z,'the tombstone is in the file');

    // (#21) a file written by a NEWER app must not be overwritten by this older one
    file=JSON.stringify({app:'ironlog',format:2,version:'9.9.9',sessions:[],routines:[],deleted:{}});rev++;
    const before=uploads.length;
    h.state.settings.theme='dark';h.S.saveSettingsCloud();
    await h.state.cloud.flush();
    assert.equal(uploads.length,before,'an older app does not overwrite a newer backup');
    assert.ok(/update ironlog/i.test(h.state.cloudError),'and it says to update the app');
  }finally{h.teardown();}
});
