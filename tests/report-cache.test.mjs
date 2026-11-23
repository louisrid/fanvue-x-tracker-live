import test from 'node:test';
import assert from 'node:assert/strict';
import {cachedReport} from '../netlify/lib/report-cache.mjs';
const request=new Request('https://fixture.test/report');
function storage(initial){let value=initial;return {get:async()=>value,setJSON:async(_,v)=>{value=v;},value:()=>value};}
test('a stale verified response returns without waiting for upstream refresh',async()=>{
 const cache=storage({savedAt:0,data:{ok:true,placements:[{clicks:73}],checkedAt:'2026-11-01'}});
 let finish;const pending=new Promise(resolve=>finish=resolve),tasks=[];
 const response=await cachedReport('test',request,{waitUntil:p=>tasks.push(p)},async()=>{await pending;return Response.json({ok:true,trackingReady:true,placements:[{clicks:74}]});},cache);
 assert.equal((await response.json()).placements[0].clicks,73);assert.equal(tasks.length,1);
 finish();await tasks[0];assert.equal(cache.value().data.placements[0].clicks,74);
});
test('failed refresh keeps the last verified snapshot',async()=>{
 const initial={savedAt:0,data:{ok:true,placements:[{clicks:73}]}},cache=storage(initial);
 const response=await cachedReport('test',new Request(request.url+'?refresh=1'),{},async()=>Response.json({ok:false},{status:503}),cache);
 assert.equal((await response.json()).placements[0].clicks,73);assert.deepEqual(cache.value(),initial);
});
test('an unverified click outage never overwrites cached figures',async()=>{
 const initial={savedAt:0,data:{ok:true,placements:[{clicks:73}]}},cache=storage(initial);
 const response=await cachedReport('test',new Request(request.url+'?refresh=1'),{},async()=>Response.json({ok:true,trackingReady:false,placements:[{clicks:null}]}),cache);
 assert.equal((await response.json()).placements[0].clicks,73);
 assert.deepEqual(cache.value(),initial);
});
test('an expired cache revalidates when background execution is unavailable',async()=>{
 const cache=storage({savedAt:0,data:{ok:true,placements:[{cost:10}]}});let loads=0;
 const response=await cachedReport('test',request,undefined,async()=>{loads++;return Response.json({ok:true,placements:[{cost:25}]});},cache);
 assert.equal(loads,1);assert.equal((await response.json()).placements[0].cost,25);assert.equal(cache.value().data.placements[0].cost,25);
});
test('a failed synchronous cache revalidation keeps its timestamp and verified data',async()=>{
 const cache=storage({savedAt:0,data:{ok:true,placements:[{cost:10}]}});
 const response=await cachedReport('test',request,undefined,async()=>{throw Error('offline');},cache);
 const data=await response.json();assert.equal(data.placements[0].cost,10);assert.equal(data.cachedAt,'1970-01-01T00:00:00.000Z');assert.match(data.warning,/failed/);
});

for(const mode of ['network','http','invalid-json','unsuccessful']){
 test(`manual and expired refresh preserve verified data after ${mode} failure`,async()=>{
  for(const suffix of ['', '?refresh=1']){
   const initial={savedAt:0,data:{ok:true,placements:[{clicks:73}]}},cache=storage(initial);
   const response=await cachedReport('test',new Request(request.url+suffix),undefined,async()=>{
    if(mode==='network')throw Error('offline');
    if(mode==='http')return Response.json({ok:false},{status:503});
    if(mode==='invalid-json')return new Response('not JSON');
    return Response.json({ok:false,placements:[]});
   },cache);
   const data=await response.json();
   assert.equal(data.placements[0].clicks,73);assert.equal(data.cached,true);
   assert.equal(data.cachedAt,'1970-01-01T00:00:00.000Z');assert.match(data.warning,/failed/);
   assert.deepEqual(cache.value(),initial);
  }
 });
}

test('invalid saved snapshots do not prevent a successful source load',async()=>{
 for(const initial of [{savedAt:'invalid',data:{ok:true}},{savedAt:0},{savedAt:0,data:{ok:false}}]){
  const cache=storage(initial);
  const response=await cachedReport('test',request,undefined,async()=>Response.json({ok:true,placements:[{clicks:5}]}),cache);
  assert.equal((await response.json()).placements[0].clicks,5);
  assert.equal(cache.value().data.placements[0].clicks,5);
 }
});

test('failure without a verified snapshot remains a failure',async()=>{
 await assert.rejects(cachedReport('test',request,undefined,async()=>{throw Error('offline');},storage(null)),/offline/);
 const response=await cachedReport('test',request,undefined,async()=>Response.json({ok:false},{status:503}),storage(null));
 assert.equal(response.status,503);
});
