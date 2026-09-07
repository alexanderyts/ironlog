const test=require('node:test'),assert=require('node:assert/strict');
const {IL}=require('./load.js');
const {searchEx}=IL.search;
const top=q=>searchEx(q)[0]&&searchEx(q)[0].name;

test('exact and near-exact names win',()=>{
  assert.equal(top('barbell bench press'),'Barbell Bench Press');
  assert.equal(top('Romanian Deadlift'),'Romanian Deadlift');
});
test('descriptions and aliases resolve',()=>{
  assert.equal(top('rdl'),'Romanian Deadlift');
  assert.equal(top('ohp'),'Overhead Press');
  assert.equal(top('side raise'),'Lateral Raise');
  assert.ok(/Incline/.test(top('incline chest press')));
  assert.equal(top('bench'),'Barbell Bench Press');
  assert.ok(searchEx('bench').slice(0,3).every(e=>/Bench|Incline/.test(e.name)),'"incline bench" alias is a fair match');
});
test('empty query lists everything; nonsense lists nothing',()=>{
  assert.equal(searchEx('').length,IL.data.EXERCISES.length);
  assert.equal(searchEx('zzqx').length,0);
});
