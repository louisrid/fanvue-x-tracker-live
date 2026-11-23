import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const sourcePath=resolve(process.env.XTRACKER_SOURCE||'./netlify/lib/metrics.mjs');
const raw=readFileSync(sourcePath,'utf8');
const source=raw.replace(/^import .*?;\s*$/gm,'').replace(/\bexport\s+/g,'')+'\n({ refreshMetrics, applyMetrics })';
const ctx={Date,Number,String,Buffer,JSON,Map,Set,Array,AbortSignal,encodeURIComponent,process:{env:{}},
 getStore:()=>{throw new Error('inject mock storage')},timingSafeEqual:()=>true};
const {refreshMetrics,applyMetrics}=vm.runInNewContext(source,ctx,{filename:sourcePath});
const postId='2111466845593059445',code='A01-P01';
const at='2026-10-23T06:00:00.000Z';
const p={code,publisher:'insomnia_vip',sourceTab:'WEEK 1 - LOUIS',sourceRow:11,posted:true,platform:'X',postUrl:`https://x.com/insomnia_vip/status/${postId}`,xViews:6975,xLikes:50,xUpdated:at};
const fakeStore=metric=>{let state={metrics:{[code]:metric}};return {get:async()=>state,setJSON:async(k,value)=>{if(k==='latest')state=value},state:()=>state}};

test('HTTP 404 retains last successful views, likes, date and publisher',async()=>{
 const store=fakeStore({code,postId,views:6975,likes:50,at,error:''});
 const fetcher=async()=>({ok:false,status:404});
 const status=await refreshMetrics([p],{fetcher,storage:store});
 assert.equal(status.updated,0);assert.equal(status.errors.length,1);
 const out=applyMetrics([p],status,Date.parse('2026-10-23T16:20:00Z'))[0];
 assert.equal(out.xViews,6975);assert.equal(out.xLikes,50);assert.equal(out.xUpdated,at);
 assert.equal(out.metricStatus,'last-known-good');assert.ok(out.metricNote.includes('last recorded'));
 assert.equal(out.publisher,'insomnia_vip');assert.equal(out.code,code);assert.equal(out.sourceRow,11);
});
test('newer verified sheet numbers take priority over older Blob snapshot during failure',async()=>{
 const pNew={...p,xViews:7002,xLikes:56,xUpdated:'2026-10-23T07:00:00.000Z'};
 const store=fakeStore({code,postId,views:6975,likes:50,at,error:''});
 const state=await refreshMetrics([pNew],{fetcher:async()=>({ok:false,status:404}),storage:store});
 const out=applyMetrics([pNew],state)[0];
 assert.equal(out.xViews,7002);assert.equal(out.xLikes,56);assert.equal(out.xUpdated,pNew.xUpdated);
 assert.equal(out.metricStatus,'last-known-good');
});
test('metric from a different post ID must not leak into replacement post',async()=>{
 const store=fakeStore({code,postId,views:6975,likes:50,at,error:''});
 const changed={...p,postUrl:'https://x.com/insomnia_vip/status/2111466845593059446',xViews:null,xLikes:null,xUpdated:''};
 const state=await refreshMetrics([changed],{fetcher:async()=>({ok:false,status:404}),storage:store});
 const out=applyMetrics([changed],state)[0];
 assert.equal(out.xViews,null);assert.equal(out.xLikes,null);
 assert.equal(out.metricStatus,'unverified');
});
test('successful refresh replaces cached values and clears fallback note',async()=>{
 const store=fakeStore({code,postId,views:6975,likes:50,at,error:'X provider HTTP 404'});
 const fetcher=async()=>({ok:true,json:async()=>({tweet:{id:postId,views:7010,likes:52,replies:10,retweets:3}})});
 const state=await refreshMetrics([p],{fetcher,storage:store});
 const out=applyMetrics([p],state)[0];
 assert.equal(out.xViews,7010);assert.equal(out.xLikes,52);
 assert.equal(out.metricError,'');assert.equal(out.metricNote,'');
});
test('one failed provider lookup does not stop other posts from updating',async()=>{
 const next={...p,code:'A01-P02',postUrl:'https://x.com/another/status/2111466845593059446',xViews:10,xLikes:1};
 const store=fakeStore({code,postId,views:6975,likes:50,at,error:''});
 const fetcher=async url=>url.includes(postId)?{ok:false,status:404}:
   {ok:true,json:async()=>({tweet:{id:'2111466845593059446',views:125,likes:8,replies:1,retweets:0}})};
 const state=await refreshMetrics([p,next],{fetcher,storage:store});
 const [failed,updated]=applyMetrics([p,next],state);
 assert.equal(state.updated,1);assert.equal(state.errors.length,1);
 assert.equal(failed.xViews,6975);assert.equal(failed.xLikes,50);
 assert.equal(updated.xViews,125);assert.equal(updated.xLikes,8);
 assert.equal(updated.metricNote,'');
});
test('failed lookup keeps verified Sheet values even without a Blob snapshot',async()=>{
 const store=fakeStore({});
 const state=await refreshMetrics([p],{fetcher:async()=>({ok:false,status:404}),storage:store});
 const out=applyMetrics([p],state)[0];
 assert.equal(out.xViews,6975);assert.equal(out.xLikes,50);assert.equal(out.xUpdated,at);
 assert.equal(out.metricStatus,'last-known-good');
});
test('a failed lookup cannot replace a prior verified view count with zero',async()=>{
 const store=fakeStore({code,postId,views:6975,likes:50,at,error:''});
 const zeroed={...p,xViews:0,xLikes:0,xUpdated:'2026-10-23T07:00:00.000Z'};
 const state=await refreshMetrics([zeroed],{fetcher:async()=>({ok:false,status:404}),storage:store});
 const out=applyMetrics([zeroed],state)[0];
 assert.equal(out.xViews,6975);assert.equal(out.xLikes,50);assert.equal(out.xUpdated,at);
});
test('manual refresh covers every published week and ignores unposted rows',async()=>{
 const calls=[];
 const weekTwo={...p,code:'A02-P01',sourceTab:'WEEK 2 - LOUIS',postUrl:'https://x.com/new/status/2111466845593059446',xViews:null,xLikes:null,xUpdated:''};
 const unposted={...p,code:'A02-P02',posted:false,postUrl:'https://x.com/draft/status/2111466845593059447'};
 const store=fakeStore({});
 const state=await refreshMetrics([p,weekTwo,unposted],{storage:store,fetcher:async url=>{
   calls.push(url);return {ok:true,json:async()=>({tweet:{id:url.split('/').at(-1),views:120,likes:9,replies:2,retweets:1}})};
 }});
 assert.equal(state.total,2);assert.equal(state.updated,2);assert.equal(calls.length,2);
 assert.equal(state.metrics[weekTwo.code].views,120);
 assert.equal(state.metrics[unposted.code],undefined);
});
test('incomplete or zeroed provider data preserves verified figures',async()=>{
 const existing={code,postId,views:6975,likes:50,comments:8,shares:2,at,error:''};
 const store=fakeStore(existing);
 const state=await refreshMetrics([p],{storage:store,fetcher:async()=>({ok:true,json:async()=>({tweet:{id:postId,views:0,likes:0,replies:0,retweets:0}})})});
 assert.equal(state.updated,0);assert.equal(state.errors.length,1);
 assert.equal(applyMetrics([p],state)[0].xViews,6975);
});
