import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {postIdentity} from '../netlify/lib/metrics.mjs';
import {boostIdentity,boostCalculations} from '../netlify/lib/boosts.mjs';
const migration=readFileSync(new URL('../netlify/database/migrations/20261113131924_create_x_boosts/migration.sql',import.meta.url),'utf8');
test('only the four authorised originals are seeded, each with one genuine sample',()=>{
  const tweets=[...migration.matchAll(/\('(\d+)','([A-Za-z0-9_]+)'/g)].map(m=>m[1]);
  assert.deepEqual(tweets,['2112984438376104125','2114713856811352299','2115081383827698033','2117354088690245907']);
  assert(!migration.includes('2114682794160824473'));
  assert.equal((migration.match(/INSERT INTO x_boost_samples/g)||[]).length,4);
  assert(!/INSERT INTO x_boost_tweets[^;]*spend/s.test(migration));
});
test('original post URLs validate by ID and reject spoofed hosts and excluded post',()=>{
  assert.deepEqual(boostIdentity('https://x.com/scottyaiofm/status/2114713856811352299?s=20'),{handle:'scottyaiofm',id:'2114713856811352299'});
  for(const url of ['https://x.com.evil.test/scotty/status/123','https://x.com/scotty/status/123/other','http://x.com/scotty/status/123','https://x.com/ArdzAI0/status/2114682794160824473'])assert.throws(()=>boostIdentity(url));
});
test('efficiency and engagement require genuine operands and never coerce unknown spend',()=>{
  assert.deepEqual(boostCalculations({spend:600,views:20000,likes:100,reposts:20,replies:30}),{engagement:.75,efficiency:30});
  assert.equal(boostCalculations({spend:null,views:100,likes:1,reposts:1,replies:1}).efficiency,null);
  assert.equal(boostCalculations({spend:10,views:0,likes:0,reposts:0,replies:0}).engagement,null);
  assert.equal(boostCalculations({spend:0,views:100,likes:null,reposts:1,replies:1}).engagement,null);
  assert.equal(boostCalculations({spend:0,views:100,likes:0,reposts:0,replies:0}).efficiency,0);
});
test('boost refresh shares the existing cadence with an atomic lease and bounded history',()=>{
  const job=readFileSync(new URL('../netlify/functions/refresh-x-metrics.mjs',import.meta.url),'utf8');
  const source=readFileSync(new URL('../netlify/lib/boosts.mjs',import.meta.url),'utf8');
  assert.match(job,/schedule:'0 \*\/2 \* \* \*'/);assert.match(job,/refreshBoosts\(\{fetcher\}\)/);
  assert.match(source,/UPDATE x_boost_tweets SET last_attempt_at=now\(\).*115 minutes/);
  assert.match(source,/ON CONFLICT DO NOTHING/);assert.match(source,/DELETE FROM x_boost_samples.*91 days/);
});

import vm from 'node:vm';
const boostSource=readFileSync(new URL('../netlify/lib/boosts.mjs',import.meta.url),'utf8').replace(/^import .*;$/gm,'').replace(/\bexport /g,'');
function boostHarness(sql){return vm.runInNewContext(boostSource+'\n({refreshBoosts,readBoosts,mutateBoost})',{getDatabase:()=>({sql}),postIdentity,parseXResponse:(raw,id)=>({postId:id,views:raw.tweet.views,likes:raw.tweet.likes,comments:raw.tweet.replies,shares:raw.tweet.retweets,at:new Date().toISOString()}),AbortSignal,Date,URL});}
test('provider failure preserves the saved metrics and never inserts a zero snapshot',async()=>{
 const calls=[];
 const {refreshBoosts}=boostHarness(async(strings,...values)=>{const query=strings.join('?');calls.push({query,values});if(query.startsWith('SELECT * FROM x_boost_tweets'))return [{id:'123',handle:'original'}];if(query.startsWith('UPDATE x_boost_tweets SET last_attempt_at'))return [{id:'123'}];return [];});
 const result=await refreshBoosts({fetcher:async()=>({ok:false,status:503})});
 assert.equal(result.updated,0);assert.equal(result.errors.length,1);
 assert(!calls.some(c=>c.query.startsWith('INSERT INTO x_boost_samples')));
 assert(calls.some(c=>c.query.includes("SET error='X metrics temporarily unavailable")));
});
test('an already-claimed refresh makes no additional provider requests',async()=>{
 let fetches=0;const {refreshBoosts}=boostHarness(async strings=>strings.join('?').startsWith('SELECT * FROM x_boost_tweets')?[{id:'123',handle:'original'}]:[]);
 const result=await refreshBoosts({fetcher:async()=>{fetches++;}});assert.equal(fetches,0);assert.equal(result.updated,0);
});
test('successful snapshots use the actual observation timestamp and verified values',async()=>{
 const calls=[];const {refreshBoosts}=boostHarness(async(strings,...values)=>{const query=strings.join('?');calls.push({query,values});if(query.startsWith('SELECT * FROM x_boost_tweets')||query.startsWith('UPDATE x_boost_tweets SET last_attempt_at'))return [{id:'123',handle:'original'}];return [];});
 const result=await refreshBoosts({fetcher:async()=>({ok:true,json:async()=>({tweet:{id:'123',text:'Original content',views:12345,likes:73,replies:12,retweets:8}})})});
 assert.equal(result.updated,1);const sample=calls.find(c=>c.query.startsWith('INSERT INTO x_boost_samples'));
 assert.equal(sample.values[0],'123');assert(Math.abs(Date.now()-Date.parse(sample.values[1]))<1000);
 assert.deepEqual(Array.from(sample.values.slice(2)),[12345,73,8,12]);
});
test('saved spend is read from persistent records, while insufficient history stays unavailable',async()=>{
 const at='2026-11-13T13:00:00Z';const {readBoosts}=boostHarness(async strings=>strings.join('?').startsWith('SELECT * FROM x_boost_tweets')?[{id:'123',spend:'87.50'}]:[{tweet_id:'123',at,views:'25000',likes:'100',reposts:'20',replies:'5'}]);
 const [row]=await readBoosts();assert.equal(row.spend,87.5);assert.equal(row.efficiency,3.5);assert.equal(row.engagement,.5);assert.equal(row.growth24,null);assert.equal(row.growth7,null);
});

test('canonical post IDs reject excluded and duplicate variants',()=>{
 assert.equal(boostIdentity('https://x.com/scottyaiofm/status/02114713856811352299').id,'2114713856811352299');
 assert.throws(()=>boostIdentity('https://x.com/ArdzAI0/status/02114682794160824473'));
 assert.throws(()=>boostIdentity('https://x.com/a/status/0'));
 assert.throws(()=>boostIdentity('https://x.com/a/status/18446744073709551616'));
});
test('spend rejects booleans and structured inputs rather than coercing them to zero',async()=>{
 const {mutateBoost}=boostHarness(async()=>[]);
 for(const spend of [false,true,[],{},undefined])await assert.rejects(()=>mutateBoost({type:'boostUpdate',id:'123',name:'Original',spend}));
 assert.equal(boostCalculations({views:100,spend:'',likes:0,reposts:0,replies:0}).efficiency,null);
});
test('editing and removal target only the selected ID and keep unknown spending null',async()=>{
 const calls=[];const {mutateBoost}=boostHarness(async(strings,...values)=>{calls.push({query:strings.join('?'),values});return [{id:'selected'}];});
 await mutateBoost({type:'boostUpdate',id:'selected',name:'Original',spend:'12.75'});
 assert.deepEqual(Array.from(calls[0].values),[12.75,'Original','selected']);
 await mutateBoost({type:'boostUpdate',id:'selected',name:'Original',spend:'  '});assert.equal(calls[1].values[0],null);
 await mutateBoost({type:'boostRemove',id:'selected'});assert.deepEqual(Array.from(calls[2].values),['selected']);
});
test('24-hour and seven-day growth use only genuine, sufficiently close observations',async()=>{
 const latest=new Date('2026-11-13T13:00:00Z');
 const samples=[{tweet_id:'123',at:'2026-11-06T13:00:00Z',views:100},{tweet_id:'123',at:'2026-11-12T13:00:00Z',views:900},{tweet_id:'123',at:latest.toISOString(),views:1200}];
 const {readBoosts}=boostHarness(async strings=>strings.join('?').startsWith('SELECT * FROM x_boost_tweets')?[{id:'123',spend:null}]:samples);
 const [row]=await readBoosts();assert.equal(row.growth24,300);assert.equal(row.growth7,1100);
 samples[1].at='2026-11-12T08:00:00Z';const [missing]=await readBoosts();assert.equal(missing.growth24,null);
});
test('scheduled article and boost refreshes share one provider lookup per original ID',async()=>{
 let calls=0;
 const source=readFileSync(new URL('../netlify/functions/refresh-x-metrics.mjs',import.meta.url),'utf8').replace(/^import .*;$/gm,'').replace(/export default async[\s\S]*$/,'').replace(/\bexport /g,'');
 const {runXRefresh}=vm.runInNewContext(source+'\n({runXRefresh})',{
  URL,console:{log(){}},fetch:async()=>{calls++;return new Response(JSON.stringify({tweet:{id:'123'}}));},
  readFeed:async()=>({feed:{placements:[]},status:'SHEET_LIVE'}),
  refreshBoosts:async({fetcher})=>{const r=await fetcher('https://api.fxtwitter.com/original/status/123');await r.json();return {updated:1};},
  refreshMetrics:async(rows,{fetcher})=>{const r=await fetcher('https://api.fxtwitter.com/renamed/status/123');await r.json();return {updated:1,total:1,errors:[]};},
 });
 const result=await runXRefresh();assert.equal(calls,1);assert.equal(result.boosts.updated,1);
});

import {timingSafeEqual} from 'node:crypto';
test('boost writes require existing admin authentication and unlock is independent of Sheets',async()=>{
 const calls=[];const raw=readFileSync(new URL('../netlify/functions/admin.mjs',import.meta.url),'utf8').replace(/^import .*;$/gm,'').replace('export default ','');
 const handler=vm.runInNewContext(raw+'\nhandler',{Buffer,timingSafeEqual,BoostInputError:Error,readAdminKey:()=> 'audit-fixture',feedURL:()=>{throw new Error('Unrelated Sheets service must not be consulted');},mutateBoost:async body=>{calls.push(body);return {saved:true};},json:(data,status=200)=>Response.json(data,{status})});
 const request=(body,authenticated=false)=>new Request('https://example.test/admin',{method:'POST',headers:{'content-type':'application/json',...(authenticated?{authorization:'Bearer audit-fixture'}:{})},body:JSON.stringify(body)});
 const denied=await handler(request({type:'boostUpdate',id:'selected',name:'Original',spend:12}));assert.equal(denied.status,401);assert.equal(calls.length,0);
 const unlocked=await handler(request({type:'check'},true));assert.equal(unlocked.status,200);
 const saved=await handler(request({type:'boostUpdate',id:'selected',name:'Original',spend:12},true));assert.equal(saved.status,200);assert.equal(calls.length,1);assert.equal(calls[0].id,'selected');
});

test('adding original tweets canonicalises IDs and rejects duplicate or excluded records',async()=>{
 const ids=new Set(),calls=[];
 const {mutateBoost}=boostHarness(async(strings,...values)=>{calls.push(values);const id=values[0];if(ids.has(id))return [];ids.add(id);return [{id}];});
 await mutateBoost({type:'boostAdd',url:'https://x.com/original/status/2112984438376104125'});
 await assert.rejects(()=>mutateBoost({type:'boostAdd',url:'https://x.com/renamed/status/02112984438376104125'}));
 await assert.rejects(()=>mutateBoost({type:'boostAdd',url:'https://x.com/ArdzAI0/status/2114682794160824473'}));
 assert.equal(ids.size,1);assert.equal(calls.length,2);assert.equal(calls[0][0],calls[1][0]);
});

test('manual refresh bypasses two-hour cadence, saves all four originals and deduplicates concurrent requests',async()=>{
 const ids=['2112984438376104125','2114713856811352299','2115081383827698033','2117354088690245907'];
 const claimed=new Set(),samples=[],queries=[];let fetches=0;
 const {refreshBoosts}=boostHarness(async(strings,...values)=>{
  const q=strings.join('?');queries.push(q);
  if(q.startsWith('SELECT * FROM x_boost_tweets'))return ids.map(id=>({id,handle:'original'}));
  if(q.startsWith('UPDATE x_boost_tweets SET last_attempt_at')){if(claimed.has(values[0]))return [];claimed.add(values[0]);return [{id:values[0]}];}
  if(q.startsWith('INSERT INTO x_boost_samples'))samples.push(values);
  return [];
 });
 const fetcher=async url=>{fetches++;return {ok:true,json:async()=>({tweet:{id:url.split('/').at(-1),text:'Original',views:12345,likes:73,replies:12,retweets:8}})};};
 const results=await Promise.all([refreshBoosts({manual:true,fetcher}),refreshBoosts({manual:true,fetcher})]);
 assert.equal(fetches,4);assert.equal(samples.length,4);
 assert.deepEqual(samples.map(s=>s[0]).sort(),ids.sort());
 assert.equal(results.reduce((n,r)=>n+r.updated,0),4);
 assert.equal(results.reduce((n,r)=>n+r.skipped,0),4);
 assert(queries.filter(q=>q.startsWith('UPDATE x_boost_tweets SET last_attempt_at')).every(q=>q.includes("interval '5 minutes'")));
 assert(!queries.some(q=>/SET spend|removed_at=|DELETE FROM x_boost_tweets/.test(q)));
});

test('manual refresh rejects provider zeros without replacing a verified sample',async()=>{
 const writes=[];
 const {refreshBoosts}=boostHarness(async(strings,...values)=>{
  const q=strings.join('?');
  if(q.startsWith('SELECT * FROM x_boost_tweets')||q.startsWith('UPDATE x_boost_tweets SET last_attempt_at'))return [{id:'123',handle:'original'}];
  if(q.startsWith('SELECT * FROM x_boost_samples'))return [{views:100,likes:20,replies:2,reposts:3}];
  writes.push(q);return [];
 });
 const result=await refreshBoosts({manual:true,fetcher:async()=>({ok:true,json:async()=>({tweet:{id:'123',views:0,likes:0,replies:0,retweets:0}})})});
 assert.equal(result.updated,0);assert.equal(result.errors.length,1);
 assert(!writes.some(q=>q.startsWith('INSERT INTO x_boost_samples')));
});

test('refresh endpoint refuses cross-origin requests and never calls cached readings a success',async()=>{
 const raw=readFileSync(new URL('../netlify/functions/boosts.mts',import.meta.url),'utf8').replace(/^import .*;$/gm,'').replace('export default async (req: Request)=>','const handler=async (req)=>');
 let calls=0,result={updated:0,total:4,errors:[],skipped:4};
 const handler=vm.runInNewContext(raw+'\nhandler',{
  process:{env:{TRACKER_WORKER_KEY:'fixture'}},URL,workerAuth:()=>false,adminKey:()=>'',
  refreshBoosts:async()=>{calls++;return result;},readBoosts:async()=>[{id:'original',last_attempt_at:'2026-11-16T12:09:48.000Z'}],json:(data,status=200)=>({data,status}),
 });
 assert.equal((await handler(new Request('https://site.test/.netlify/functions/boosts',{method:'POST',headers:{origin:'https://evil.test'}}))).status,403);assert.equal(calls,0);
 const request=()=>new Request('https://site.test/.netlify/functions/boosts',{method:'POST',headers:{origin:'https://site.test'}});
 const cached=await handler(request());assert.equal(cached.status,429);assert.equal(cached.data.ok,false);assert.equal(cached.data.nextRefreshAt,Date.parse('2026-11-16T12:14:48.000Z'));assert.equal(cached.data.retryAfter,Math.max(0,Math.ceil((cached.data.nextRefreshAt-cached.data.serverNow)/1000)));
 result={updated:4,total:4,errors:[],skipped:0};const fresh=await handler(request());assert.equal(fresh.status,200);assert.equal(fresh.data.ok,true);
 result={updated:3,total:4,errors:['original'],skipped:0};const failed=await handler(request());assert.equal(failed.status,502);assert.equal(failed.data.ok,false);assert.equal(failed.data.tweets.length,1);
});

test('refresh button suppresses duplicate clicks and updates rows, KPIs, cache and an open modal',async()=>{
 const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const fn=source.slice(source.indexOf('function updateBoostCooldown(data){'),source.indexOf('async function loadBoosts('));
 const button={disabled:false,classList:{add(){},remove(){}},setAttribute(){},removeAttribute(){}},status={};
 let release,requests=0,renders=0,modals=0;
 const pending=new Promise(resolve=>{release=resolve;});
 const context={document:{querySelector:()=>button},el:id=>id==='boostRefreshStatus'?status:{},boostsState:{tweets:[]},state:{modalType:'boost',modalCode:'123'},storage:{set(){}},AbortSignal,Date,setTimeout:()=>1,clearTimeout(){},
  fetch:async(url,options)=>{assert.equal(options.method,'POST');requests++;await pending;return {ok:true,json:async()=>({ok:true,total:4,updated:4,serverNow:Date.now(),nextRefreshAt:Date.now()+300000,tweets:[{id:'123',views:100}]})};},
  renderBoosts:()=>{renders++;},showBoostDetails:()=>{modals++;},
  loadBoosts:async()=>{context.boostsState.tweets=[{id:'123',views:100}];renders++;modals++;},
 };
 const refresh=vm.runInNewContext(fn+'\nrefreshBoostStats',context);
 const first=refresh();assert.equal(button.disabled,true);await refresh();assert.equal(requests,1);
 release();await first;await refresh();assert.equal(requests,1);assert.equal(button.disabled,false);assert.equal(renders,2);assert.equal(modals,2);assert.equal(context.boostsState.tweets[0].views,100);assert.equal(status.textContent,'Latest saved X readings shown');
});

function refreshUIHarness(response){
 const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const fn=source.slice(source.indexOf('function updateBoostCooldown(data){'),source.indexOf('async function loadBoosts('));
 let now=1000000,requests=0,tick;
 class Clock extends Date {static now(){return now;}}
 const button={disabled:false,classList:{add(){},remove(){}},setAttribute(){},removeAttribute(){}},status={},cooldown={};
 const context={document:{querySelector:()=>button},el:id=>id==='boostRefreshCooldown'?cooldown:status,
  boostsState:{tweets:[{id:'saved',views:42}]},state:{},storage:{set(){}},AbortSignal,Date:Clock,
  setTimeout:fn=>{tick=fn;return 1;},clearTimeout(){},renderBoosts(){},loadBoosts:async()=>{},
  fetch:async()=>{requests++;return response;}};
 const ui=vm.runInNewContext(fn+'\n({refreshBoostStats,updateBoostCooldown})',context);
 return {...ui,context,button,status,cooldown,requests:()=>requests,advance:ms=>{now+=ms;tick?.();}};
}
test('server cooldown blocks POSTs, counts down and allows safe saved-data reads',async()=>{
 const ui=refreshUIHarness();
 ui.updateBoostCooldown({serverNow:5000,nextRefreshAt:277000});
 assert.equal(ui.cooldown.textContent,'New X readings available in 4:32');
 await ui.refreshBoostStats();await ui.refreshBoostStats();assert.equal(ui.requests(),0);
 ui.advance(272000);assert.equal(ui.button.disabled,false);assert.equal(ui.cooldown.textContent,'');
});
test('a cooldown response is neutral and confirms saved readings',async()=>{
 const response={status:429,ok:false,json:async()=>({ok:false,retryAfter:272})};
 for(const succeeded of [false,true]){
  const ui=refreshUIHarness(response);ui.context.boostsState.refreshSucceeded=succeeded;
  await ui.refreshBoostStats();await ui.refreshBoostStats();
  assert.equal(ui.requests(),1);assert(!ui.status.className.includes('is-error'));
  assert.equal(ui.status.textContent,'Latest saved X readings shown');
  assert.equal(ui.cooldown.textContent,'New X readings available in 4:32');assert.equal(ui.button.disabled,false);
 }
});
test('provider failure remains red, preserves saved metrics and respects the actual cooldown',async()=>{
 const ui=refreshUIHarness({status:502,ok:false,json:async()=>({ok:false,error:'Provider unavailable',retryAfter:120})});
 await ui.refreshBoostStats();
 assert.equal(ui.requests(),1);assert.equal(ui.status.className,'x-refresh-status is-error');
 assert.equal(ui.context.boostsState.tweets[0].views,42);assert.equal(ui.button.disabled,false);
 ui.advance(120000);assert.equal(ui.button.disabled,false);
});
