import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const app=readFileSync('public/app.js','utf8');
const cacheHelpers=app.slice(app.indexOf('function validReport('),app.indexOf('const ICONS='));
for(const [key,field,flag] of [['xtracker-dashboard-cache-v1','placements','ok'],['xtracker-of-cache-v1','publishers','ready'],['xtracker-gta-report-human-clicks-v1','publishers','ready'],['xtracker-boosts-v1','tweets','ok']]){
 test(key+' recovers from corrupt cache, rejects invalid reports and tolerates unavailable storage',()=>{
  const entries=new Map(),storage={get:k=>entries.get(k),set:(k,v)=>entries.set(k,v)};
  const context=vm.createContext({storage});vm.runInContext(cacheHelpers,context);
  const report={[flag]:true,[field]:[{views:123,cost:50}],activity:[]};
  context.key=key;context.report=report;
  vm.runInContext('saveReportCache(key,report)',context);
  entries.set(key,'{broken');
  assert.equal(context.readReportCache(key,field,flag)[field][0].views,123);
  for(const bad of [null,{[flag]:true,[field]:{}},{[flag]:true,[field]:[null]},{[flag]:false,[field]:[]}]){
   assert.equal(context.validReport(bad,field,flag),false);
  }
  entries.set(key,JSON.stringify({[flag]:true,[field]:[null]}));
  assert.equal(context.readReportCache(key,field,flag)[field][0].cost,50);
  storage.get=()=>{throw Error('storage blocked');};
  assert.equal(context.readReportCache(key,field,flag),null);
 });
}
test('failed and malformed report refreshes retain verified campaign state',async()=>{
 for(const kind of ['of','gta'])for(const malformed of [false,true]){
  const saved={ready:true,publishers:[{views:123}],activity:[]};
  const state={ofCampaign:saved},gtaState={report:saved,lastLoadAt:0};
  const context=vm.createContext({state,gtaState,Date,AbortSignal,storage:{set(){}},validReport:(d,f,k)=>d?.[k]===true&&Array.isArray(d[f]),
   fetch:async()=>{if(!malformed)throw Error('offline');return {ok:true,json:async()=>({ready:true,publishers:{}})};},
   el:()=>({textContent:''}),preserveReadingPosition:fn=>fn(),renderOfReport(){},renderGtaReport(){},renderCampaigns(){}});
  const start=kind==='of'?'async function loadOfReport(':'async function loadGtaReport(';
  const end=kind==='of'?'async function load(force':'async function refreshGtaReport(';
  vm.runInContext(app.slice(app.indexOf(start),app.indexOf(end)),context);
  await (kind==='of'?context.loadOfReport(true):context.loadGtaReport(true));
  assert.equal(kind==='of'?state.ofCampaign:gtaState.report,saved);
 }
});

test('partial successful responses preserve cached metrics while accepting explicit zero and current status',()=>{
 const context=vm.createContext({storage:{get(){},set(){}}});vm.runInContext(cacheHelpers,context);
 const old={publishers:[{code:'a',postUrl:'https://x.com/a/status/1',trackingUrl:'https://s.gy/a',views:100,likes:5,clicks:12,cost:50,posted:true,metricAt:'2026-11-16'}]};
 const fresh={publishers:[{code:'a',postUrl:'https://x.com/a/status/1',trackingUrl:'https://s.gy/a',views:null,likes:0,clicks:null,cost:null,posted:false}]};
 const result=context.retainCachedStats(fresh,old);
 assert.equal(result.publishers[0].views,100);assert.equal(result.publishers[0].likes,0);assert.equal(result.publishers[0].clicks,12);
 assert.equal(result.publishers[0].cost,null);assert.equal(result.publishers[0].posted,false);assert.equal(result.publishers[0].metricAt,'2026-11-16');assert.equal(result.statsCached,true);
 const changed=context.retainCachedStats({publishers:[{...fresh.publishers[0],postUrl:'https://x.com/a/status/2',trackingUrl:'https://s.gy/b'}]},old);
 assert.equal(changed.publishers[0].views,null);assert.equal(changed.publishers[0].clicks,null);
 assert.equal(context.retainCachedStats({publishers:[]},old).publishers.length,0);
});

test('cached link readings survive a partial report without mixing click definitions',()=>{
 const context=vm.createContext({storage:{get(){},set(){}}});vm.runInContext(cacheHelpers,context);
 const prior={shortIo:{metric:'totalClicks',links:[{code:'a',trackingUrl:'https://s.gy/a',clicks:18},{code:'b',trackingUrl:'https://s.gy/b',clicks:3}]}};
 const fresh={shortIo:{metric:'totalClicks',links:[{code:'a',trackingUrl:'https://s.gy/a',clicks:null},{code:'b',trackingUrl:'https://s.gy/b',clicks:5}]}};
 const result=context.retainCachedStats(fresh,prior);
 assert.equal(result.shortIo.total,23);assert.equal(result.shortIo.verified,2);assert.equal(result.shortIo.stale,true);
 const different=context.retainCachedStats({...fresh,shortIo:{...fresh.shortIo,metric:'humanClicks',total:null}},prior);
 assert.equal(different.shortIo.total,null);
});

test('missing tracking URLs cannot establish identity for cached click attribution',()=>{
 const context=vm.createContext({storage:{get(){},set(){}}});vm.runInContext(cacheHelpers,context);
 for(const trackingUrl of [undefined,'',null]){
  const old={publishers:[{code:'a',postUrl:'https://x.com/a/status/1',trackingUrl,views:100,clicks:12}]};
  const fresh={publishers:[{code:'a',postUrl:'https://x.com/a/status/1',trackingUrl,views:null,clicks:null}]};
  const result=context.retainCachedStats(fresh,old);
  assert.equal(result.publishers[0].views,100);
  assert.equal(result.publishers[0].clicks,null);
 }
});
