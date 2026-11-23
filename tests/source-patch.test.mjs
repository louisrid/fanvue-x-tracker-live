import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ExcelJS from 'exceljs';
import {parseRows} from '../netlify/functions/gta-report.mjs';

function uiHarness(result={status:200,ok:true,body:{updated:4,total:4,tweets:[],nextRefreshAt:Date.now()+300000,serverNow:Date.now()}}){
 const source=readFileSync('public/app.js','utf8');
 const calls=[],status={},button={classList:{add(){},remove(){}},setAttribute(){},removeAttribute(){}};
 const context={Date,AbortSignal,clearTimeout(){},setTimeout(){},el:id=>id==='boostRefreshStatus'?status:{},document:{querySelector:()=>button},boostsState:{tweets:[{views:42}]},
 fetch:async(url,options)=>{calls.push(options?.method||'GET');return {...result,json:async()=>result.body};},
 loadBoosts:async()=>{calls.push('GET');context.boostsState.tweets=[{views:123}];}};
 const refresh=vm.runInNewContext(source.slice(source.indexOf('function updateBoostCooldown(data){'),source.indexOf('async function loadBoosts('))+'\nrefreshBoostStats',context);
 return {context,calls,status,button,refresh};
}
test('patched RT refresh makes one POST, reloads genuine saved values, then GET only during cooldown',async()=>{
 const h=uiHarness();await Promise.all([h.refresh(),h.refresh()]);assert.deepEqual(h.calls,['POST','GET']);assert.equal(h.context.boostsState.tweets[0].views,123);assert.equal(h.status.textContent,'X stats updated');await h.refresh();assert.deepEqual(h.calls,['POST','GET','GET']);assert.equal(h.button.disabled,false);
});
test('partial RT success reloads saved data and reports the actual updated count',async()=>{
 const h=uiHarness({status:502,ok:false,body:{updated:2,total:4,skipped:2,tweets:[]}});await h.refresh();assert.deepEqual(h.calls,['POST','GET']);assert.match(h.status.textContent,/Updated 2 of 4/);
});
test('server cooldown is neutral and reads saved RT values',async()=>{
 const h=uiHarness({status:429,ok:false,body:{retryAfter:300,skipped:4}});await h.refresh();assert.deepEqual(h.calls,['POST','GET']);assert.equal(h.status.textContent,'Latest saved X readings shown');
});
test('GTA parser uses real sheet flags, prices and original X links',()=>{
 const book=new ExcelJS.Workbook();for(const name of ['X Accounts 12 (GTA)','X Accounts 14 (GTA VI V2)']){const sheet=book.addWorksheet(name);sheet.getRow(7).values=['ACCOUNT','LINK','ACCOUNT SUM','PAID?','POSTED?','LINK'];sheet.getRow(8).values=['Publisher','https://x.com/Publisher',123,true,true,{text:'Post',hyperlink:'https://x.com/Publisher/status/123'}];sheet.getRow(9).values=['Awaiting','https://x.com/Awaiting',45,true,false,''];sheet.getRow(10).values=['Research','','','','',''];}
 const rows=parseRows(book);assert.equal(rows.length,4);assert.equal(rows[0].postUrl,'https://x.com/Publisher/status/123');assert.equal(rows[0].cost,123);assert.equal(rows[1].posted,false);assert.equal(rows[0].clicks,null);
});
function gtaHarness(){
 const raw=readFileSync('netlify/functions/gta-report.mjs','utf8').replace(/^import .*;$/gm,'').replace(/export default async function handler/,'async function handler').replace(/export /g,'');
 const stores=new Map();const seed=[{publisher:'Publisher',postUrl:'https://x.com/Publisher/status/123',paid:true,posted:true,cost:12}];let fail=false;
 const scope={ExcelJS,seed,seedVerifiedAt:'2026-11-16T00:00:00Z',Response,URL,AbortSignal,Buffer,Date,fetch:async()=>{throw new Error('Offline test');},getStore:({name})=>({get:async key=>structuredClone(stores.get(name+key)||null),setJSON:async(key,data)=>stores.set(name+key,structuredClone(data))})};
 const api=vm.runInNewContext(raw+'\n({getReport,refreshGtaMetrics})',scope);
 return {...api,stores,fetcher:async()=>({ok:true,json:async()=>({tweet:{id:'123',views:fail?0:123,likes:fail?0:12,retweets:2,replies:1}})}),fail:()=>{fail=true;}};
}
test('GTA metrics save genuine readings, keep last good on zero/error and throttle manual refresh',async()=>{
 const h=gtaHarness();let calls=0;const fetcher=async(...args)=>{calls++;return h.fetcher(...args);};const first=await h.refreshGtaMetrics({manual:true,fetcher});assert.equal(first.updated,1);assert.equal(first.publishers[0].views,123);assert.equal(first.metricHistory.length,1);
 const cooldown=await h.refreshGtaMetrics({manual:true,fetcher});assert.equal(cooldown.skipped,true);assert.equal(calls,1);
 h.fail();const failure=await h.refreshGtaMetrics({fetcher});assert.equal(failure.updated,0);assert.equal(failure.publishers[0].views,123);assert.equal(failure.metricHistory.length,1);
 const cache={rows:first.publishers,source:'GOOGLE_SHEETS_LIVE',at:'2026-11-15T00:00:00Z'};h.stores.set('fanvue-gta-report-v1last-good',cache);const fallback=await h.getReport({force:true});assert.equal(fallback.source,'GOOGLE_SHEETS_LIVE');assert.match(fallback.warning,/last verified/);assert.equal(fallback.publishers[0].views,123);
});
