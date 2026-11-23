import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const summary=vm.runInNewContext(source.slice(source.indexOf('function engagementSummary('),source.indexOf('function renderEngagement('))+';engagementSummary');
test('campaign rate weights complete readings by views',()=>{
  const result=summary([{views:100,likes:5,reposts:3,replies:2},{views:900,likes:10,reposts:5,replies:5}]);
  assert.equal(result.rate,3);
  assert.equal(result.count,2);
});
test('missing metrics and zero views do not invent an engagement rate',()=>{
  const result=summary([{views:100,likes:2,reposts:null,replies:1},{views:0,likes:0,reposts:0,replies:0}]);
  assert.equal(result.rate,null);
  assert.equal(result.count,0);
  assert.equal(summary([{views:100,likes:0,reposts:0,replies:0}]).rate,0);
});
