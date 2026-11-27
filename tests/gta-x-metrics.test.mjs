import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {readGtaXMetric,gtaMetricStatus} from '../netlify/lib/gta-x-metrics.mjs';
import {refreshGtaMetrics,groupReport} from '../netlify/functions/gta-report.mjs';
const post={handle:'publisher',id:'1234'};
const valid=()=>Response.json({tweet:{id:post.id,views:123,likes:10,retweets:2,replies:1}});
const row={campaign:'GTA1',sourceTab:'X Accounts 12 (GTA)',publisher:'Publisher',posted:true,postUrl:'https://x.com/publisher/status/1234'};
const saved={views:100,likes:8,reposts:2,replies:1,at:'2026-11-19T10:00:00.000Z'};
const state={metrics:{1234:saved},history:[{id:'1234',bucket:1,at:'2025-11-19T10:00:00.000Z',views:100}],lastSuccessfulAt:saved.at};
const storage=initial=>{let data=structuredClone(initial);return {get:async()=>data,setJSON:async(k,v)=>{data=v;},value:()=>data};};
test('404 and 403 stay classified failures without repeated requests',async()=>{
 for(const [status,category] of [[404,'not_found'],[403,'access_denied']]){let calls=0;await assert.rejects(readGtaXMetric(post,{fetcher:async()=>{calls++;return new Response('',{status});}}),e=>e.category===category);assert.equal(calls,1);}
});
test('retries timeout and 503 with bounded backoff, then verifies all metrics',async()=>{
 let calls=0;const waits=[];const m=await readGtaXMetric(post,{fetcher:async()=>{calls++;if(calls===1)throw new DOMException('timeout','TimeoutError');if(calls===2)return new Response('',{status:503});return valid();},sleep:async ms=>waits.push(ms)});
 assert.equal(m.views,123);assert.equal(calls,3);assert.deepEqual(waits,[300,600]);
});
test('honours short rate limits and stops on long cooldowns',async()=>{
 for(const delay of [1,60]){let calls=0;const waits=[];const pending=readGtaXMetric(post,{fetcher:async()=>++calls===1?new Response('',{status:429,headers:{'retry-after':String(delay)}}):valid(),sleep:async ms=>waits.push(ms)});
 if(delay===1){await pending;assert.deepEqual(waits,[1000]);assert.equal(calls,2);}else{await assert.rejects(pending,e=>e.category==='rate_limit');assert.equal(calls,1);assert.deepEqual(waits,[]);}}
});
test('missing fields and mismatched post identities cannot become successful readings',async()=>{
 for(const tweet of [{id:'999',views:10},{id:post.id,views:10,likes:1,replies:0}])await assert.rejects(readGtaXMetric(post,{fetcher:async()=>Response.json({tweet})}),e=>e.category==='missing_data');
});
test('refresh retains verified metrics, timestamps and history on 404; deduplicates Sheet posts',async()=>{
 const store=storage(state);let calls=0;
 const result=await refreshGtaMetrics({storage:store,readSource:async()=>({rows:[row,{...row,publisher:'Second placement'}]}),fetcher:async()=>{calls++;return new Response('',{status:404});},readReport:async()=>({shortIo:{errors:0},originals:{shortIo:{errors:0}}})});
 assert.equal(calls,1);assert.equal(result.total,1);assert.equal(result.updated,0);assert.equal(result.refreshed,false);
 assert.equal(store.value().metrics['1234'].views,100);assert.equal(store.value().metrics['1234'].at,saved.at);assert.equal(store.value().lastSuccessfulAt,saved.at);assert.deepEqual(store.value().history,state.history);assert.equal(store.value().errors[0].category,'not_found');
});
test('suspicious zeros preserve previous readings and remain errors',async()=>{
 const store=storage(state);await refreshGtaMetrics({storage:store,readSource:async()=>({rows:[row]}),fetcher:async()=>Response.json({tweet:{id:post.id,views:0,likes:0,retweets:0,replies:0}}),readReport:async()=>({shortIo:{errors:0},originals:{shortIo:{errors:0}}})});assert.equal(store.value().metrics['1234'].views,100);assert.equal(store.value().errors[0].category,'suspect_regression');
});
test('tab statuses exclude other tabs and removed records, retain errors without saved values',async()=>{
 const metric={metrics:{1234:{...saved,error:'HTTP 404'},5678:{error:'HTTP 404',errorCategory:'not_found'},removed:{error:'old error'}}};
 const rows=[row,{...row,postUrl:'https://x.com/other/status/5678'}];const status=gtaMetricStatus(rows,metric);
 assert.deepEqual([status.total,status.updated,status.verified,status.retained,status.unverified,status.errors.length],[2,0,1,1,1,2]);assert.equal(gtaMetricStatus([],metric).errors.length,0);
 const report=await groupReport({rows,source:'GOOGLE_SHEETS_LIVE'},metric,{clickOptions:{store:storage(null)}});
 assert.equal(report.publishers[1].metricAt,null);assert.equal(report.publishers[1].metricError,'HTTP 404');assert.equal(report.publishers[0].views,100);
});
test('browser reports the selected tab counts and shows unresolved source failures',()=>{
 const app=readFileSync('public/app.js','utf8'),context=vm.createContext({});vm.runInContext(app.slice(app.indexOf('function gtaSourceStatus('),app.indexOf('function renderGtaReport(')),context);
 const result=context.gtaSourceStatus({xStatus:{updated:18,total:22,retained:1,unverified:3,errors:[{}]},shortIo:{refreshed:0,linkCount:0}});assert.equal(result.failed,true);assert.match(result.text,/18 of 22 posts/);assert.match(result.text,/1 saved X readings retained; 3 X posts unverified/);
});

test('cache read failures abort without requesting providers or writing an empty snapshot',async()=>{
 let writes=0,calls=0;
 await assert.rejects(refreshGtaMetrics({storage:{get:async()=>{throw Error('storage unavailable');},setJSON:async()=>writes++},fetcher:async()=>{calls++;return valid();}}),/storage unavailable/);
 assert.equal(writes,0);assert.equal(calls,0);
});

test('shared Short.io attribution exclusions do not trigger a refresh failure',async()=>{
 const {readFileSync}=await import('node:fs'),{default:vm}=await import('node:vm');
 const app=readFileSync('public/app.js','utf8');
 const context=vm.createContext({});
 vm.runInContext(app.slice(app.indexOf('function gtaSourceStatus('),app.indexOf('function renderGtaQuotedSources(')),context);
 const xStatus={updated:1,total:1,retained:0,unverified:0,errors:[]};
 const shared={attributed:false,attributionError:'Shared Short.io link; publisher attribution excluded.',clickError:'',stale:false};
 const report={xStatus,shortIo:{links:[shared],errors:1,stale:true}};
 assert.equal(context.gtaSourceStatus(report).failed,false);
 assert.equal(context.gtaSourceStatus({...report,shortIo:{links:[{...shared,clickError:'Provider unavailable'}]}}).failed,true);
});
test('GTA refresh polls status only, retries a transient GET, and fetches final report once',async()=>{
 const {readFileSync}=await import('node:fs'),{default:vm}=await import('node:vm');
 const app=readFileSync('public/app.js','utf8'),nodes=new Map();
 const el=id=>{if(!nodes.has(id))nodes.set(id,{classList:{add(){},remove(){}},setAttribute(){},removeAttribute(){}});return nodes.get(id);};
 const fresh={ready:true,publishers:[{views:42}],xStatus:{updated:1,total:1,retained:0,unverified:0,errors:[]},shortIo:{errors:0}};
 let polls=0,posts=0,reads=0;
 const context=vm.createContext({el,Date,AbortSignal,setTimeout:fn=>fn(),gtaState:{report:{ready:true,publishers:[{views:20}]}},validReport:d=>d.ready===true,saveReportCache(){},renderGtaReport(){},gtaUKDate:String,
 fetch:async(url,opts)=>{
  if(opts.method==='POST'){posts++;return Response.json({refresh:{id:'job',state:'queued'}});}
  if(url.endsWith('?status=1')){polls++;if(polls===1)throw Error('temporary network failure');return Response.json({refresh:{id:'job',state:'complete',updated:1,total:1}});}
  reads++;return Response.json(fresh);
 }});
 vm.runInContext(app.slice(app.indexOf('function gtaSourceStatus('),app.indexOf('function renderGtaQuotedSources('))+app.slice(app.indexOf('async function refreshGtaReport('),app.indexOf('function initGtaUi(){')),context);
 assert.equal(await context.refreshGtaReport(),true);
 assert.deepEqual([posts,polls,reads],[1,2,1]);
 assert.equal(context.gtaState.report.publishers[0].views,42);
 assert.equal(el('gtaRefreshButton').disabled,false);
});

test('dashboard refresh progress counts actual settled source operations and preserves failure state',async()=>{
 const {readFileSync}=await import('node:fs'),{default:vm}=await import('node:vm');
 const app=readFileSync('public/app.js','utf8'),nodes=new Map(),events=[];
 const el=id=>{if(!nodes.has(id))nodes.set(id,{dataset:{},classList:{add(){},remove(){}},setAttribute(){},removeAttribute(){}});return nodes.get(id);};
 const context=vm.createContext({el,gtaState:{report:{},refreshing:false},gtaSourceStatus:()=>null,refreshXStats:async()=>({ok:true}),refreshGtaReport:async()=>true,load:async()=>true,loadOfReport:async()=>true,loadBoosts:async()=>true,state:{},boostsState:{},window:{XTrackerCampaignReporting:{reload:async()=>true},XTrackerDiscordMembers:{refresh:async()=>true},XTrackerDiscordCourse:{refresh:async()=>true}}});
 vm.runInContext(app.slice(app.indexOf('async function reloadAllData('),app.indexOf('function applyDashboard(')),context);
 assert.equal(await context.reloadAllData(p=>events.push(p.completed)),true);
 assert.deepEqual(events,[0,1,2,3,4,5,6,7,8]);
 assert.equal(el('reloadAllButton').disabled,false);
 events.length=0;context.load=async()=>false;
 assert.equal(await context.reloadAllData(p=>events.push(p.completed)),false);
 assert.deepEqual(events,[0,1,2,3,4,5,6,7,8]);
 assert.equal(el('reloadAllStatus').dataset.summary,'Latest available data');
});
