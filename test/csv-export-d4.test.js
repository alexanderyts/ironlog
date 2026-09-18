// D-4: per-session CSV export (health-app / spreadsheet friendly). sessionSummaryCsv is pure.
const test=require('node:test'),assert=require('node:assert');
const {IL,session,set}=require('./load.js');
const csv=(ss,u)=>IL.sync.sessionSummaryCsv(ss,u);
const rows=s=>s.trim().split('\r\n').map(r=>r.split(',').map(c=>c.replace(/^"|"$/g,'').replace(/""/g,'"')));

test('header names the unit and the summary columns',()=>{
  const h=rows(csv([],'lb'))[0];
  assert.deepEqual(h,['Date','Day','Type','Duration (min)','Volume (lb)','Working sets','Exercises','Bodyweight (lb)','Notes']);
  assert.match(rows(csv([],'kg'))[0].join(','),/Volume \(kg\)/);
});

test('a strength workout becomes one summary row (volume, sets, exercises)',()=>{
  const s=session(1,[['barbell-bench-press',[set(100,5),set(100,5)]]]);s.completed=true;
  const r=rows(csv([s],'lb'));
  assert.equal(r.length,2,'header + one row');
  const [date,,type,,vol,sets,ex]=r[1];
  assert.match(date,/^\d{4}-\d{2}-\d{2}$/,'local ISO date');
  assert.equal(type,'Strength');
  assert.equal(vol,'1000','2×(100×5)');
  assert.equal(sets,'2');assert.equal(ex,'1');
});

test('volume uses the session’s own bodyweight (D-1), not a global',()=>{
  const s=session(1,[['pull-up',[set(0,5)]]]);s.completed=true;s.bw=180;
  const r=rows(csv([s],'lb'))[1];
  assert.equal(r[4],'900','pull-up volume = 180 bw × 5');
  assert.equal(r[7],'180','bodyweight column');
});

test('a deload is labelled, and a cardio row carries its details in Notes',()=>{
  const dl=session(2,[['barbell-bench-press',[set(60,10)]]]);dl.completed=true;dl.deload=true;
  const cardio={id:'c1',schema:1,date:Date.now(),completed:true,kind:'cardio',exercises:[],endedAt:Date.now()+30*60000,cardio:{type:'treadmill',intensity:'hard',distance:3.2,unit:'mi'}};
  const r=rows(csv([dl,cardio],'lb'));
  const dlRow=r.find(x=>x[2]==='Deload'),caRow=r.find(x=>x[2]==='Cardio');
  assert.ok(dlRow,'deload labelled');
  assert.ok(caRow,'cardio labelled');
  assert.equal(caRow[4],'','cardio has no volume');
  assert.match(caRow[8],/treadmill/);assert.match(caRow[8],/3\.2 mi/);
});

test('commas and quotes in a note are CSV-escaped',()=>{
  const s=session(1,[['barbell-bench-press',[set(100,5)]]]);s.completed=true;s.note='felt "great", hips loose';
  const line=csv([s],'lb').trim().split('\r\n')[1];
  assert.match(line,/"felt ""great"", hips loose"/,'quotes doubled, field wrapped');
});

test('in-progress workouts are not exported',()=>{
  const done=session(1,[['barbell-bench-press',[set(100,5)]]]);done.completed=true;
  const live=session(1,[['barbell-bench-press',[set(100,5)]]]);live.completed=false;
  assert.equal(rows(csv([done,live],'lb')).length,2,'only the finished one');
});
