import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {parseRows} from '../netlify/functions/gta-report.mjs';
import {readClicks,mergeClicks,clickSummary,publicationTime,trackingLink} from '../netlify/lib/gta-shortio.mjs';
const post='https://x.com/iluv_papi/status/2122351628162641990';
const placement={campaign:'GTAQ',publisher:'Test publisher',posted:true,postUrl:post,trackingUrl:'https://irxc49.s.gy/creators',paid:true,cost:50};
const memory=()=>{const data=new Map();return {get:async k=>data.get(k),setJSON:async(k,v)=>data.set(k,structuredClone(v))};};
function provider(clicks=31){const calls=[];return {calls,fetcher:async(url,options)=>{calls.push(String(url));assert.equal(options.redirect,'error');const u=new URL(url);if(u.hostname==='api.short.io')return Response.json({idString:'link_test'});assert.equal(u.hostname,'statistics.short.io');assert.equal(u.searchParams.get('period'),'custom');return Response.json({totalClicks:clicks+900,humanClicks:clicks,interval:{startDate:u.searchParams.get('startDate'),endDate:u.searchParams.get('endDate')}});}};}
test('publication timestamp is exact and tracking links are never visited',async()=>{
 assert.equal(publicationTime(post),'2026-11-16T15:30:34.197Z');assert.equal(trackingLink('javascript:alert(1)'),null);
 const api=provider(),store=memory(),r=await readClicks(placement,{...api,store,key:'test-key'});assert.equal(r.clicks,31);assert.equal(api.calls.length,2);
 const again=await readClicks(placement,{store,key:'test-key',fetcher:()=>{throw Error('should use cache');}});assert.equal(again.clicks,31);
});
test('provider failure, decreasing counts and invalid intervals preserve verified readings',async()=>{
 const store=memory();await readClicks(placement,{...provider(),store,key:'test-key'});
 for(const fetcher of [async()=>{throw Error('offline');},provider(0).fetcher,async u=>String(u).includes('/expand')?Response.json({idString:'link_test'}):Response.json({totalClicks:900,interval:{startDate:'2026-01-01'}})]){
  const r=await readClicks(placement,{store,key:'test-key',force:true,fetcher});assert.equal(r.clicks,31);assert.ok(r.clickError);assert.ok(r.clickAt);
 }
});
test('unpublished and shared links are excluded; confirmed spend produces CPC',async()=>{
 const api=provider();const opts={...api,store:memory(),key:'test-key'};
 const rows=await mergeClicks([placement,{...placement,postUrl:'',posted:false,trackingUrl:'https://irxc49.s.gy/ana'}],opts);
 assert.equal(rows[0].cpc,50/31);assert.equal(rows[1].clicks,null);assert.deepEqual(clickSummary(rows),{total:31,verified:1,totalPublishers:1,stale:false});
 const dupe=await mergeClicks([placement,{...placement,publisher:'Other'}],{fetcher:()=>{throw Error('must not request shared link');}});assert.equal(clickSummary(dupe).total,null);assert.ok(dupe.every(p=>p.clickTracked===false));
 const unpaid=await mergeClicks([{...placement,paid:false}],{...provider(),store:memory(),key:'test-key'});assert.equal(unpaid[0].cpc,null);
});
test('unavailable first reading and zero clicks remain distinct',async()=>{
 const missing=await readClicks(placement,{store:memory(),key:'',force:true});assert.equal(missing.clicks,null);
 const zero=await mergeClicks([placement],{...provider(0),store:memory(),key:'test-key'});assert.equal(clickSummary(zero).total,0);assert.equal(zero[0].cpc,null);
});
test('sheet parser retains source financial rows, display names and column D',()=>{
 const w=new ExcelJS.Workbook();
 for(const name of ['X Accounts 12 (GTA)','X Accounts 14 (GTA VI V2)','X Accounts 15 (GTA VI QRTs)']){
  const s=w.addWorksheet(name);s.getRow(7).values=['ACCOUNT','LINK',null,'UTM LINK','ACCOUNT SUM','PAID?','POSTED?','LINK'];
 }
 const q=w.getWorksheet(3);q.getRow(8).values=['Aaliyah | AI','https://x.com/The_Kremlinn',null,placement.trackingUrl,80,true,true,post];
 q.getRow(9).values=['Duplicate','https://x.com/The_Kremlinn',null,placement.trackingUrl,80,true,true,post];
 q.getRow(10).values=['Ana | The AI Girl','',null,'https://irxc49.s.gy/ana',100,true,false,''];
 q.getRow(11).values=['Flag without post','',null,'https://irxc49.s.gy/not-live',70,true,true,''];
 const rows=parseRows(w);assert.equal(rows.length,4);assert.equal(rows[0].publisher,'Aaliyah | AI');assert.equal(rows[0].trackingUrl,placement.trackingUrl);assert.equal(rows[2].posted,false);assert.equal(rows[3].posted,true);
});

test('campaign tables share column order with source-specific click labels',async()=>{
 const {readFileSync}=await import('node:fs'),{default:vm}=await import('node:vm');
 const source=readFileSync('public/xtracker-tables.js','utf8').replace("  if(document.readyState==='loading')", "  globalThis.parsePromo=parsePromo;globalThis.schemas=schemas;\n  if(document.readyState==='loading')");
 const context=vm.createContext({window:{},document:{readyState:'loading',addEventListener(){}},location:{href:'https://example.com'},URL,Intl});vm.runInContext(source,context);
 const card={dataset:{placementCode:'GTAQ-R8',shortioClicks:'31',shortioCpc:String(50/31)},getAttribute:()=>'',querySelector:()=>null,querySelectorAll:()=>[]};
 const wrapper={querySelector:()=>card,querySelectorAll:()=>[]};
 const row=context.parsePromo(wrapper,'gta',0,new Map([['GTAQ-R8',{...placement,allTimeClicks:31,clicks:7,cpc:50/7}]]));
 assert.equal(row.subtitle,'QRT');assert.equal(row.clicks,31);assert.equal(row.cpc,50/7);
 assert.ok(context.schemas.gta.some(c=>c.key==='clicks'));assert.deepEqual(Array.from(context.schemas.of,c=>c.key),Array.from(context.schemas.gta,c=>c.key));assert.equal(context.schemas.of.find(c=>c.key==='clicks').title,'UTM clicks');
 const pending=context.parsePromo(wrapper,'gta',0,new Map([['GTAQ-R8',{...placement,posted:false,clicks:31,cpc:50/31}]]));assert.equal(pending.clicks,null);assert.equal(pending.cpc,null);
 const untracked=context.parsePromo(wrapper,'gta',0,new Map([['GTAQ-R8',{...placement,trackingUrl:'',clickTracked:false,clicks:null,cpc:null}]]));assert.equal(untracked.tracked,false);
});

test('an overlapping failed refresh cannot erase a successful verified response',async()=>{
 const store=memory();let rejectRequest,markStarted;const started=new Promise(r=>markStarted=r);
 const pending=readClicks(placement,{store,key:'test-key',force:true,fetcher:()=>rejectRequest?Promise.reject(Error('temporary outage')):new Promise((_,reject)=>{rejectRequest=reject;markStarted();})});
 await started;await readClicks(placement,{...provider(),store,key:'test-key',force:true});rejectRequest(Error('temporary outage'));
 assert.equal((await pending).clicks,31);
 const cached=await readClicks(placement,{store,key:'test-key',fetcher:()=>{throw Error('should retain verified cache');}});assert.equal(cached.clicks,31);
});

test('an unpublished row cannot suppress a live post sharing its tracking link',async()=>{
 const rows=await mergeClicks([placement,{...placement,posted:false,postUrl:''}],{...provider(),store:memory(),key:'test-key'});
 assert.equal(rows[0].clicks,31);assert.equal(rows[1].clicks,null);
 assert.equal(clickSummary(rows).total,31);
});

test('tracked original and V2 posts contribute while untracked posts do not dilute coverage',async()=>{
 const rows=await mergeClicks([{...placement,campaign:'GTA2'},{...placement,campaign:'GTA1',trackingUrl:''}],{...provider(),store:memory(),key:'test-key'});
 assert.deepEqual(clickSummary(rows),{total:31,verified:1,totalPublishers:1,stale:false});
});

test('tracking links are read by each tab header and campaign rows stay separate',()=>{
 const w=new ExcelJS.Workbook();
 for(const name of ['X Accounts 12 (GTA)','X Accounts 14 (GTA VI V2)','X Accounts 15 (GTA VI QRTs)']){
  const s=w.addWorksheet(name);s.getRow(7).values=['ACCOUNT','LINK','ACCOUNT SUM','PAID?','POSTED?','LINK','UTM LINK'];
  s.getRow(8).values=['publisher','https://x.com/publisher',50,true,true,post,placement.trackingUrl];
 }
 const rows=parseRows(w);assert.equal(rows.length,3);assert.equal(rows[0].campaign,'GTAQ');assert.equal(rows[0].trackingUrl,placement.trackingUrl);
});

test('GTA reports render live posts and include pending paid spend',async()=>{
 const {readFileSync}=await import('node:fs'),{default:vm}=await import('node:vm');
 const app=readFileSync('public/app.js','utf8');
 const render=app.slice(app.indexOf('function gtaSourceStatus('),app.indexOf('function renderGtaReport('))+app.slice(app.indexOf('function renderGtaReport(){'),app.indexOf('async function loadGtaReport('));
 const nodes=new Map();const el=id=>{assert.notEqual(id,'gtaChart');if(!nodes.has(id))nodes.set(id,{textContent:'',innerHTML:'',classList:{toggle(){}},querySelector:()=>null});return nodes.get(id);};
 const live={...placement,code:'GTAQ-R8',publisher:'Live publisher',views:100,likes:3,reposts:2,replies:1,clicks:31,cpc:50/31};
 const pending={...live,code:'GTAQ-R9',publisher:'Scheduled publisher',posted:false,postUrl:'',cost:1000};
 const context=vm.createContext({document:{querySelectorAll:()=>[]},gtaState:{report:{ready:true,publishers:[live,pending],shortIo:{total:31,verified:1,totalPublishers:1}}},el,
  weekStart:()=> '2026-11-16',shift:()=> '2026-11-22',gtaDate:String,safeUrl:v=>v||'',gtaNumber:String,gtaMoney:v=>'$'+v,gtaCpc:String,fmt:String,esc:String,
  interactionSummary:()=>({total:6,note:''}),renderEngagement(){},articleCardContent:p=>p.publisher,gtaSafeLink:()=>'',Date});
 vm.runInContext(render+'\nrenderGtaReport();',context);
 assert.match(el('gtaPublishers').innerHTML,/Live publisher/);
 assert.doesNotMatch(el('gtaPublishers').innerHTML,/Scheduled publisher|Awaiting publication/);
 assert.match(el('gtaMetrics').innerHTML,/\$1050/);
 // Five generated cards plus the existing engagement button make exactly six.
 // A complete financial summary must not append additional financial cards.
 context.gtaState.report.summary={paidSpend:1050,totalSpend:1100,publishedSpend:50,pendingPaidSpend:1000,unpaidCount:1};
 context.gtaState.report.originals={...context.gtaState.report,publishers:[{...live,campaign:'GTA1'},{...pending,campaign:'GTA2'}]};
 for(const tab of ['qrts','originals']){
  context.gtaState.tab=tab;vm.runInContext('renderGtaReport();',context);
  const html=el('gtaMetrics').innerHTML;
  assert.equal((html.match(/class="daily-metric daily-metric-/g)||[]).length,5);
  assert.match(html,/\$1050/);
  assert.match(html,tab==='qrts'?/Paid QRT Spend/:/Paid Post Spend/);
  assert.doesNotMatch(html,/Total placement spend|Published spend|Pending paid spend|Unpaid placements/);
 }
 context.gtaState.tab='qrts';
 context.gtaState.report=null;vm.runInContext('renderGtaReport();',context);
 assert.match(el('gtaMetrics').innerHTML,/daily-metric-spend/);
 assert.match(el('gtaMetrics').innerHTML,/daily-metric-shortio/);
 assert.doesNotMatch(el('gtaMetrics').innerHTML,/GTA VI report unavailable/);
});

test('legacy total-click cache cannot contaminate human-click readings or fallback',async()=>{
 const {createHash}=await import('node:crypto');
 const store=memory();
 const legacyKey=createHash('sha256').update(placement.trackingUrl+'|'+post.match(/status\/(\d+)/)[1]).digest('hex');
 await store.setJSON(legacyKey,{clicks:999,attemptAt:new Date().toISOString()});
 const missing=await readClicks(placement,{store,key:'test-key',fetcher:async()=>{throw Error('offline');}});
 assert.equal(missing.clicks,null);
 const human=await readClicks(placement,{...provider(7),store,key:'test-key',force:true});
 assert.equal(human.clicks,7);
 assert.equal((await store.get(legacyKey)).clicks,999);
});

test('a missing or invalid humanClicks field never falls back to totalClicks',async()=>{
 for(const humanClicks of [undefined,null,-1,1.5,'31']){
  const result=await readClicks(placement,{store:memory(),key:'test-key',fetcher:async url=>{
   const u=new URL(url);
   return Response.json(u.hostname==='api.short.io'?{idString:'link_test'}:{humanClicks,totalClicks:931,interval:{startDate:u.searchParams.get('startDate'),endDate:u.searchParams.get('endDate')}});
  }});
  assert.equal(result.clicks,null);assert.ok(result.clickError);
 }
});

test('previous mixed campaign cache is not restored on the QRT-only page',async()=>{
 const {readFileSync}=await import('node:fs'),{default:vm}=await import('node:vm');
 const app=readFileSync('public/app.js','utf8');
 const source=app.slice(app.indexOf('function validReport('),app.indexOf('function saveReportCache('))+app.slice(app.indexOf('function restoreGtaReport(){'),app.indexOf('const gtaNumber='));
 const old={ready:true,publishers:[{...placement,views:1234,clicks:931,cpc:0.05,clickAt:'2026-11-16T20:00:00Z'}],shortIo:{total:931}};
 const context=vm.createContext({gtaState:{},storage:{get:key=>key==='xtracker-gta-report-cache-v1'?JSON.stringify(old):null}});
 vm.runInContext(source,context);
 assert.equal(context.gtaState.report,null);
});

test('all nine links use human clicks while only published placements contribute to performance',async()=>{
 const {campaignLinkClicks}=await import('../netlify/lib/gta-shortio.mjs');
 const paths=['insomnia','alinaai','create','ana','creators','signup','zak','fvhowto','fanvue'];
 const counts=[18,3,11,2,25,5,5,5,4];
 const rows=paths.map((path,i)=>({...placement,trackingUrl:'https://irxc49.s.gy/'+path,posted:i<3,postUrl:i<3?post:''}));
 const store=memory();const calls=[];
 const fetcher=async url=>{const u=new URL(url);calls.push(u.hostname);assert.notEqual(u.hostname,'irxc49.s.gy');
  if(u.hostname==='api.short.io')return Response.json({idString:u.searchParams.get('path')});
  assert.ok(['total','custom'].includes(u.searchParams.get('period')));assert.equal(u.searchParams.has('startDate'),u.searchParams.get('period')==='custom');
  return Response.json({totalClicks:999,humanClicks:counts[paths.indexOf(u.pathname.split('/').at(-1))],interval:{startDate:u.searchParams.get('startDate'),endDate:u.searchParams.get('endDate')}});
 };
 const report=await campaignLinkClicks([...rows,rows[0]],{fetcher,key:'test-key',store});
 assert.equal(report.total,32);assert.equal(report.verified,3);assert.equal(report.links.length,9);assert.equal(report.metric,'humanClicks');assert.equal(calls.length,24);
 const saved=await campaignLinkClicks(rows,{store,key:'test-key',force:true,fetcher:async()=>{throw Error('offline');}});
 assert.equal(saved.total,32);assert.equal(saved.stale,true);
});

test('source parser includes tracking links with no payment or live post',()=>{
 const w=new ExcelJS.Workbook();
 for(const name of ['X Accounts 12 (GTA)','X Accounts 14 (GTA VI V2)','X Accounts 15 (GTA VI QRTs)']){
  const sheet=w.addWorksheet(name);sheet.getRow(7).values=['ACCOUNT','LINK',null,'UTM LINK','ACCOUNT SUM','PAID?','POSTED?','LINK'];
 }
 w.getWorksheet(3).getRow(8).values=['Planned publisher','',null,'https://irxc49.s.gy/signup',null,false,false,''];
 const rows=parseRows(w);assert.equal(rows.length,1);assert.equal(rows[0].posted,false);assert.equal(rows[0].trackingUrl,'https://irxc49.s.gy/signup');
});

test('existing Refresh button posts once and renders fresh human clicks without navigation',async()=>{
 const {readFileSync}=await import('node:fs'),{default:vm}=await import('node:vm');
 const app=readFileSync('public/app.js','utf8');
 const code=app.slice(app.indexOf('function gtaSourceStatus('),app.indexOf('function renderGtaReport('))+app.slice(app.indexOf('async function refreshGtaReport('),app.indexOf('function initGtaUi(){'));
 const nodes=new Map(),el=id=>{if(!nodes.has(id))nodes.set(id,{classList:{add(){},remove(){}},setAttribute(){},removeAttribute(){}});return nodes.get(id);};
 let finish,calls=0,renders=0;
 const data={ready:true,xStatus:{updated:3,total:3,retained:0,unverified:0,errors:[]},publishers:[{...placement,clicks:46}],shortIo:{metric:'humanClicks',total:46,refreshed:9,linkCount:9,errors:0,lastSuccessfulAt:'2026-11-17T03:29:00Z'},updated:3,total:3,errors:[]};
 const context=vm.createContext({el,gtaState:{report:{publishers:[{...placement,clicks:1}]}},fetch:async(url,opts)=>{calls++;assert.equal(opts.method,'POST');return new Promise(r=>{finish=()=>r({ok:true,json:async()=>data});});},AbortSignal,validReport:()=>true,retainCachedStats:d=>d,saveReportCache(){},renderGtaReport(){renders++;},gtaUKDate:String});
 vm.runInContext(code,context);const first=context.refreshGtaReport();await context.refreshGtaReport();assert.equal(calls,1);finish();await first;
 assert.equal(renders,1);assert.equal(context.gtaState.report.shortIo.total,46);assert.match(el('gtaRefreshStatus').textContent,/Latest available readings verified/);assert.match(el('gtaRefreshStatus').title,/last successful/);assert.equal(el('gtaRefreshButton').disabled,false);
 context.fetch=async()=>{throw Error('API offline');};await context.refreshGtaReport();assert.equal(context.gtaState.report.shortIo.total,46);assert.equal(el('gtaRefreshStatus').className,'x-refresh-status is-error');
});

test('dashboard human totals ignore bot-inclusive cache and accept provider corrections',async()=>{
 const {createHash}=await import('node:crypto');const {campaignLinkClicks}=await import('../netlify/lib/gta-shortio.mjs');
 const store=memory();const old=createHash('sha256').update('link-total-v1|'+placement.trackingUrl).digest('hex');
 await store.setJSON(old,{clicks:900,attemptAt:new Date().toISOString()});
 const fetcher=n=>async url=>Response.json(String(url).includes('/expand')?{idString:'link'}:{humanClicks:n,totalClicks:999});
 assert.equal((await campaignLinkClicks([placement],{store,key:'test-key',fetcher:fetcher(25)})).total,25);
 assert.equal((await campaignLinkClicks([placement],{store,key:'test-key',force:true,fetcher:fetcher(24)})).total,24);
 const cached=await campaignLinkClicks([placement],{store,cacheOnly:true,fetcher:()=>{throw Error('cooldown must not fetch');}});assert.equal(cached.total,24);
 const shared=await campaignLinkClicks([placement,{...placement,postUrl:'https://x.com/other/status/2122351628162641991'}],{store,cacheOnly:true});assert.equal(shared.total,24);assert.equal(shared.postPublicationTotal,null);
});
