import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {parseWorkbook,columns,metricDate,resolveCampaignId} from '../netlify/lib/sheet-source.mjs';
import {parseXResponse,applyMetrics,refreshMetrics,postIdentity} from '../netlify/lib/metrics.mjs';
import {buildDestination} from '../netlify/lib/shared.mjs';
function fixture(){
 const w=new ExcelJS.Workbook();
 for(const [name,louis] of [['WEEK 1 - LOUIS',true],['WEEK 1 - CONNOR',false],['WEEK X - TEMP',false]]){
  const s=w.addWorksheet(name),head=['ACCOUNT','LINK','IMAGE','ARTICLE LINK',...(louis?['UTM']:[]),'ARTICLE',1,'ACCOUNT SUM','METHOD','PAYMENT DETAILS','PAID?','POSTED?','LINK','UTM ID',...(!louis?['UTM LINK']:[]),'TRACKED CLICKS','LAST CLICK','LINK IN','X POST VIEWS','X POST LIKES','X UPDATED (UK)'];
  head.forEach((v,i)=>s.getCell(7,i+2).value=v);
  if(name.includes('TEMP'))continue;
  const m=columns(s),r=s.getRow(8);r.getCell(m.publisher).value=louis?'LouisPublisher':'ConnorPublisher';r.getCell(m.profile).value='https://x.com/publisher';
  r.getCell(m.code).value={formula:'"A01-P01"',result:louis?'A01-P01':'A01-P06'};r.getCell(m.cost).value=louis?170:250;r.getCell(m.active).value=true;r.getCell(m.paid).value=louis;r.getCell(m.posted).value=true;
  r.getCell(m.post).value='https://x.com/publisher/status/'+(louis?'123':'456');r.getCell(m.article).value={formula:'HYPERLINK("https://docs.google.com/document/d/example/edit","ARTICLE 2.1")',result:'ARTICLE 2.1'};
  r.getCell(m.views).value=100;r.getCell(m.likes).value=10;r.getCell(m.updated).value='16 Oct 2026 10:11 BST';
  r.getCell(louis?11:10).value='PRIVATE_PAYMENT_DETAILS';
 }
 return w;
}
test('both source layouts preserve cost, paid flags, IDs, metrics and linked Docs',()=>{
 const data=parseWorkbook(fixture(),Date.parse('2026-10-16T10:00:00Z'));assert.equal(data.placements.length,2);
 const [l,c]=data.placements;assert.deepEqual([l.cost,l.paid,l.code],[170,true,'A01-P01']);assert.deepEqual([c.cost,c.paid,c.code],[250,false,'A01-P06']);
 assert.equal(l.articleUrl,'https://docs.google.com/document/d/example/edit');assert.equal(c.xViews,100);assert.equal(c.xLikes,10);assert.equal(l.xUpdated,'2026-10-16T09:11:00.000Z');
 assert.ok(!JSON.stringify(data).includes('PRIVATE_PAYMENT_DETAILS'));assert.equal(c.campaignId,'UNASSIGNED');
});
test('campaign membership always follows the source assignment',()=>{
 assert.equal(resolveCampaignId('@Meetyoshi','C003'),'C003');
 assert.equal(resolveCampaignId('  meetyoshi ','UNASSIGNED'),'UNASSIGNED');
 assert.equal(resolveCampaignId('Other Publisher','C003'),'C003');
 assert.equal(resolveCampaignId('Other Publisher',''),'UNASSIGNED');
});
test('workbook parsing preserves source campaign membership',()=>{
 const w=fixture(),sheet=w.getWorksheet('WEEK 1 - LOUIS');
 sheet.getRow(7).getCell(23).value='CAMPAIGN';
 sheet.getRow(8).getCell(columns(sheet).publisher).value='@Meetyoshi';
 sheet.getRow(8).getCell(23).value='C003';
 const row=parseWorkbook(w).placements.find(p=>p.publisher==='@Meetyoshi');
 assert.equal(row.campaignId,'C003');
});
test('duplicate IDs and missing headers fail rather than silently merging records',()=>{
 const w=fixture(),s=w.getWorksheet('WEEK 1 - CONNOR');s.getCell('N8').value='A01-P01';assert.throws(()=>parseWorkbook(w),/Duplicate/);
 s.getCell('N7').value='WRONG';assert.throws(()=>parseWorkbook(w),/Missing/);
});
test('Fanvue and Prism routes preserve the same placement attribution',()=>{
 assert.equal(buildDestination('A01-P19','FANVUE'),'https://fanvue.com/pages/affiliates?utm_source=X&utm_medium=ART&utm_campaign=A01&utm_content=P19');
 assert.equal(new URL(buildDestination('A01-P14','PRISM')).hostname,'prism-builder.com');assert.throws(()=>buildDestination('bad','FANVUE'));
});
test('metrics accept genuine matching post data and reject missing or wrong values',()=>{
 assert.equal(postIdentity('https://x.com/user/status/123?s=46').id,'123');assert.equal(postIdentity('https://x.com/user'),null);
 const m=parseXResponse({tweet:{id:'123',views:100,likes:5,replies:3,retweets:2}},'123');assert.equal(m.engagementRate,10);
 assert.throws(()=>parseXResponse({tweet:{id:'other',views:100,likes:5}},'123'),/different/);
 assert.throws(()=>parseXResponse({tweet:{id:'123',views:null,likes:5}},'123'),/all four metrics/);
});
test('provider failure preserves last successful metrics and marks them stale',async()=>{
 const data={metrics:{'A01-P01':{code:'A01-P01',postId:'123',views:100,likes:5,at:'2026-10-16T09:00:00Z'}}};
 const storage={async get(){return data;},async setJSON(key,v){if(key==='latest')Object.assign(data,v);}};
 const state=await refreshMetrics([{code:'A01-P01',posted:true,platform:'X',postUrl:'https://x.com/user/status/123'}],{storage,fetcher:async()=>({ok:false,status:429})});
 assert.equal(state.updated,0);assert.equal(state.metrics['A01-P01'].views,100);assert.equal(state.errors.length,1);
 const p=applyMetrics([{code:'A01-P01',postUrl:'https://x.com/user/status/123'}],state)[0];assert.equal(p.metricStatus,'last-known-good');assert.equal(p.xViews,100);
 const changed=applyMetrics([{code:'A01-P01',postUrl:'https://x.com/user/status/456'}],state)[0];assert.equal(changed.xViews,undefined);
});
test('UK metric timestamps handle daylight saving explicitly',()=>{
 assert.equal(metricDate('16 Oct 2026 10:11 BST'),'2026-10-16T09:11:00.000Z');assert.equal(metricDate('16 Dec 2026 10:11 GMT'),'2026-12-16T10:11:00.000Z');assert.equal(metricDate('nonsense'),'');
});
