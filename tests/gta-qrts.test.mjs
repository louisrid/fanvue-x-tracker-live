import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {parseRows,publishedQrts,publishedOriginals} from '../netlify/functions/gta-report.mjs';
import {campaignLinkClicks} from '../netlify/lib/gta-shortio.mjs';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const tab='X Accounts 15 (GTA VI QRTs)';
const qrt={campaign:'GTAQ',sourceTab:tab,posted:true,paid:true,cost:50,publisher:'QRT publisher',postUrl:'https://x.com/publisher/status/2122351628162641990',trackingUrl:'https://example.s.gy/qrt',views:1000,likes:20,reposts:5,replies:5};
test('live parser needs only tab 15; source boundary excludes originals, drafts; published rows can lack X URLs',()=>{
 const workbook=new ExcelJS.Workbook(),sheet=workbook.addWorksheet(tab);
 sheet.getRow(7).values=['ACCOUNT','LINK',null,'UTM LINK','ACCOUNT SUM','PAID?','POSTED?','LINK'];
 sheet.getRow(8).values=['QRT publisher','',null,qrt.trackingUrl,50,true,true,qrt.postUrl];
 const live=publishedQrts(parseRows(workbook));assert.equal(live.length,1);
 const mixed=[...live,{...qrt,campaign:'GTA1'},{...qrt,campaign:'GTA2'},{...qrt,sourceTab:'Other'},{...qrt,posted:false},{...qrt,postUrl:''}];
 assert.deepEqual(publishedQrts(mixed),[...live,mixed.at(-1)]);assert.equal(mixed.length,6);
 sheet.getRow(9).values=['New QRT','',null,'https://example.s.gy/new',30,true,true,'https://x.com/new/status/2122351628162641991'];
 assert.equal(publishedQrts(parseRows(workbook)).length,2);
 sheet.getRow(8).values=[];sheet.getRow(9).values=[];assert.deepEqual(publishedQrts(parseRows(workbook)),[]);
});
test('QRT-only source drives spend, views, interactions, human clicks and CPC',async()=>{
 const rows=publishedQrts([qrt,{...qrt,campaign:'GTA1',cost:900,views:999999},{...qrt,posted:false,cost:800}]);
 const data=new Map(),store={get:async k=>data.get(k),setJSON:async(k,v)=>data.set(k,v)};
 const report=await campaignLinkClicks(rows,{store,key:'test-key',fetcher:async url=>Response.json(String(url).includes('/expand')?{idString:'qrt'}:{humanClicks:25,totalClicks:999})});
 assert.equal(report.total,25);assert.equal(report.links.length,1);
 assert.equal(rows.reduce((n,p)=>n+p.cost,0),50);assert.equal(rows.reduce((n,p)=>n+p.views,0),1000);
 assert.equal(rows.reduce((n,p)=>n+p.likes+p.reposts+p.replies,0),30);assert.equal(rows[0].cost/report.total,2);
});
test('browser ignores legacy mixed caches and restores only the isolated QRT cache',()=>{
 const app=readFileSync('public/app.js','utf8'),start=app.indexOf('function restoreGtaReport()'),end=app.indexOf('gtaState.report=restoreGtaReport()',start);
 let key;const context=vm.createContext({readReportCache:k=>{key=k;return {ready:true,publishers:[qrt],scope:'mixed'};}});
 vm.runInContext(app.slice(start,end),context);assert.equal(context.restoreGtaReport(),null);assert.equal(key,'xtracker-gta-report-qrts-v1');
 context.readReportCache=()=>({ready:true,publishers:[qrt],scope:'published-qrts-v1'});assert.equal(context.restoreGtaReport().publishers.length,1);
 assert.match(app,/setInterval\(.*state.page==='gta-vi'.*loadGtaReport/);
});

test('ten published sheet placements retain nine links without column X and expose missing tracking URL',async()=>{
 const workbook=new ExcelJS.Workbook(),sheet=workbook.addWorksheet(tab);
 sheet.getRow(7).values=['ACCOUNT','LINK',null,'UTM LINK','ACCOUNT SUM','PAID?','POSTED?','LINK'];
 for(let i=0;i<10;i++)sheet.getRow(i+8).values=['Publisher '+i,'',null,i<9?'https://example.s.gy/link'+i:'',null,false,true,''];
 const rows=publishedQrts(parseRows(workbook));assert.equal(rows.length,10);assert.equal(rows.filter(p=>p.trackingUrl).length,9);
 const data=new Map(),store={get:async k=>data.get(k),setJSON:async(k,v)=>data.set(k,v)};
 const calls=[];const fetcher=async url=>{calls.push(url);return Response.json(String(url).includes('/expand')?{idString:'resolved'}:{humanClicks:7});};
 const report=await campaignLinkClicks(rows,{store,fetcher,key:'test-key'});
 assert.equal(report.linkCount,9);assert.equal(report.total,63);assert.equal(report.postPublicationTotal,null);assert.equal(calls.length,18);
 assert.ok(report.links.every(p=>p.publicationAt===null&&p.postPublicationClicks===null));
});

test('corrected live sheet keeps nine distinct QRTs, five posts and $350 paid spend',()=>{
 const w=new ExcelJS.Workbook(),s=w.addWorksheet(tab);
 s.getRow(7).values=['ACCOUNT','LINK',null,'UTM LINK','ACCOUNT SUM','PAID?','POSTED?','LINK'];
 const names=['iluv_papi','WealthEmpireHQ','Aaliyah | AI','AlinaDavy20','insomnia_vip','arkavx','Obsrvate','zak','Spider profile (TBC)'];
 const paths=['creators','ana','create','alinaai','insomnia','fanvue','fvhowto','zak','signup'];
 const posts=['iluv_papi/status/2122351628162641990','WealthEmpireHQ/status/2122666821631508763','The_Kremlinn/status/2122350539254214936','AlinaDavy20/status/2122353250980729203','insomnia_vip/status/2122403810693787713'];
 const costs=[50,100,80,50,70];
 names.forEach((name,i)=>{s.getRow(i+8).values=[name,'',null,'https://irxc49.s.gy/'+paths[i],costs[i]??null,i<5,true,posts[i]?'https://x.com/'+posts[i]:''];});
 const rows=publishedQrts(parseRows(w));assert.equal(rows.length,9);assert.equal(new Set(rows.map(p=>p.trackingUrl)).size,9);assert.equal(rows.filter(p=>p.postUrl).length,5);assert.equal(rows.filter(p=>p.paid).reduce((n,p)=>n+p.cost,0),350);
 assert.equal(rows[1].publisher,names[1]);assert.equal(rows[1].cost,100);assert.equal(rows[4].cost,70);assert.equal(rows[8].publisher,'Spider profile');
 // An accidental repeat of a verified status cannot duplicate a placement or its spend.
 s.getRow(17).values=s.getRow(9).values;assert.equal(publishedQrts(parseRows(w)).length,10);
});


test('original and V2 posts remain separate from QRT totals',()=>{
 const workbook=new ExcelJS.Workbook();
 for(const [name,publisher] of [[tab,'QRT'],['X Accounts 12 (GTA)','Original'],['X Accounts 14 (GTA VI V2)','Version2']]){
  const sheet=workbook.addWorksheet(name);
  sheet.getRow(7).values=['ACCOUNT','LINK',null,'UTM LINK','ACCOUNT SUM','PAID?','POSTED?','LINK'];
  sheet.getRow(8).values=[publisher,'',null,'',100,true,true,''];
  sheet.getRow(9).values=[publisher+'Draft','',null,'',900,true,false,''];
 }
 const rows=parseRows(workbook);
 assert.deepEqual(publishedOriginals(rows).map(p=>p.campaign),['GTA1','GTA2']);
 assert.equal(publishedOriginals(rows).reduce((sum,p)=>sum+p.cost,0),200);
 assert.equal(publishedQrts(rows).reduce((sum,p)=>sum+p.cost,0),100);
});
