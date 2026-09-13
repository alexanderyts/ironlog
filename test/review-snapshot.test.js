// Regression net for the owner's REAL history: run tools/review.js over each private backup in
// data/ (gitignored) and compare to a saved snapshot. A change that alters what the builder would do,
// or what the coach would say, for real data is caught here — not discovered on the phone.
//   • no data/ fixtures  → test skips (public checkout, fresh clone)
//   • snapshot missing    → it's written (first run establishes the baseline)
//   • intentional change  → UPDATE_SNAPSHOTS=1 node --test test/review-snapshot.test.js
const test=require('node:test'),assert=require('node:assert/strict');
const {execFileSync}=require('child_process');
const fs=require('fs'),path=require('path');
const dir=path.join(__dirname,'..','data');
const review=path.join(__dirname,'..','tools','review.js');
const update=!!process.env.UPDATE_SNAPSHOTS;

test('review output for private backups is unchanged (skipped when no fixtures)',t=>{
  if(!fs.existsSync(dir)){t.skip('no data/ directory');return;}
  const backups=fs.readdirSync(dir).filter(f=>f.endsWith('.json'));
  if(!backups.length){t.skip('no *.json backups in data/');return;}
  backups.forEach(f=>{
    const json=JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'));
    const now=json.exported?Date.parse(json.exported):Date.now();
    const out=execFileSync('node',[review,path.join(dir,f),'--why'],{env:Object.assign({},process.env,{REVIEW_NOW:String(now)})}).toString();
    const exp=path.join(dir,f.replace(/\.json$/,'.expected.txt'));
    if(update||!fs.existsSync(exp)){fs.writeFileSync(exp,out);return;}
    assert.equal(out,fs.readFileSync(exp,'utf8'),f+': review output changed — inspect the diff; if intended, UPDATE_SNAPSHOTS=1 to accept');
  });
});
