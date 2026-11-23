import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {parseRows,groupReport} from '../netlify/functions/gta-report.mjs';
import {summarisePlacements} from '../netlify/lib/placement-reporting.mjs';
import {readClicks,campaignLinkClicks} from '../netlify/lib/gta-shortio.mjs';
const tab='X Accounts 15 (GTA VI QRTs)';
const post='https://x.com/publisher/status/2122351628162641990';
const memory=()=>{const data=new Map();return {get:async k=>structuredClone(data.get(k)),setJSON:async(k,v)=>data.set(k,structuredClone(v))};};
function fixture(){const w=new ExcelJS.Workbook(),s=w.addWorksheet(tab);s.getRow(7).values=['ACCOUNT','LINK','ACCOUNT SUM','PAID?','POSTED?','LINK','UTM LINK'];s.getRow(8).values=['One','https://x.com/one',{formula:'10*2',result:20},true,true,post,'https://example.s.gy/one'];s.getRow(9).values=['Two','https://x.com/two',30,true,false,'','https://example.s.gy/two'];s.getRow(10).values=['Three','',40,false,true,'','https://example.s.gy/three'];return {w,s};}
test('financial categories follow Paid and Posted independently using formula results',()=>{
 const {w,s}=fixture();assert.deepEqual(summarisePlacements(parseRows(w)),{totalSpend:90,paidSpend:50,publishedSpend:20,pendingPaidSpend:30,publishedPosts:1,paidCount:2,unpaidCount:1,missingPaidCosts:0});
 s.getRow(9).getCell(4).value=false;assert.equal(summarisePlacements(parseRows(w)).paidSpend,20);
 s.getRow(9).getCell(4).value=true;s.getRow(9).getCell(5).value=true;
 assert.equal(summarisePlacements(parseRows(w)).publishedSpend,50);assert.equal(summarisePlacements(parseRows(w)).publishedPosts,1);
 s.getRow(9).getCell(6).value=post.replace('1990','1991');assert.equal(summarisePlacements(parseRows(w)).publishedPosts,2);
});
test('inserted, removed and reordered rows preserve existing placement identities and link attribution',()=>{
 const {w,s}=fixture(),before=parseRows(w),ids=new Map(before.map(p=>[p.publisher,p.code]));
 const one=s.getRow(8).values,two=s.getRow(9).values;s.getRow(8).values=two;s.getRow(9).values=one;
 s.spliceRows(8,0,['New','',15,true,false,'','https://example.s.gy/new']);
 for(const p of parseRows(w).filter(p=>ids.has(p.publisher)))assert.equal(p.code,ids.get(p.publisher));
 s.spliceRows(8,1);assert.equal(summarisePlacements(parseRows(w)).paidSpend,50);
 s.getRow(8).values=[];assert.equal(summarisePlacements(parseRows(w)).paidSpend,20);
});
test('report keeps pending financial rows and distinct source names without requesting redirects',async()=>{
 const {w}=fixture();const rows=parseRows(w);
 const report=await groupReport({rows,at:new Date().toISOString(),source:'GOOGLE_SHEETS_LIVE',cached:false},{metrics:{}},{clickOptions:{store:memory()}});
 assert.equal(report.summary.paidSpend,50);assert.equal(report.publishers.length,3);assert.equal(report.publishers.find(p=>p.publisher==='Two').clicks,null);
});
test('same X post in different campaigns retains separate finances',()=>{
 const {w,s}=fixture(),other=w.addWorksheet('X Accounts 12 (GTA)');other.getRow(7).values=s.getRow(7).values;other.getRow(8).values=s.getRow(8).values;
 const rows=parseRows(w);assert.equal(rows.filter(p=>p.postUrl===post).length,2);
});
test('transient provider failures retry; authentication failures do not; zero reset preserves verified totals',async()=>{
 const p={posted:true,postUrl:post,trackingUrl:'https://example.s.gy/one'},store=memory();let calls=0;
 const r=await readClicks(p,{store,key:'test',linkTotals:true,fetcher:async url=>{calls++;if(calls===1)return new Response('',{status:503});return Response.json(String(url).includes('/expand')?{idString:'one'}:{humanClicks:12});}});
 assert.equal(r.clicks,12);assert.equal(calls,3);
 calls=0;const denied=await readClicks(p,{store,key:'test',linkTotals:true,force:true,fetcher:async()=>{calls++;return new Response('',{status:403});}});
 assert.equal(calls,1);assert.equal(denied.clicks,12);assert.match(denied.clickError,/403/);
 const zero=await readClicks(p,{store,key:'test',linkTotals:true,force:true,fetcher:async url=>Response.json(String(url).includes('/expand')?{idString:'one'}:{humanClicks:0})});assert.equal(zero.clicks,12);
});
test('long provider Retry-After stops requests and keeps saved readings',async()=>{
 let calls=0;const r=await readClicks({trackingUrl:'https://example.s.gy/one'},{store:memory(),key:'test',linkTotals:true,fetcher:async()=>{calls++;return new Response('',{status:429,headers:{'retry-after':'60'}});}});assert.equal(calls,1);assert.equal(r.clicks,null);assert.match(r.clickError,/429/);
});
test('cross-campaign shared links expose totals but never publisher publication attribution',async()=>{
 const report=await campaignLinkClicks([{posted:true,postUrl:post,trackingUrl:'https://example.s.gy/shared',sharedTracking:true}],{store:memory(),key:'test',fetcher:async url=>Response.json(String(url).includes('/expand')?{idString:'shared'}:{humanClicks:9})});
 assert.equal(report.total,9);assert.equal(report.postPublicationTotal,null);assert.match(report.links[0].attributionError,/Shared/);
});
