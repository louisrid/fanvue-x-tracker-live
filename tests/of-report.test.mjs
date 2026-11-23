import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {parseOfWorkbook,OF_TAB} from '../netlify/lib/of-report.mjs';
import {mergeOfEvents} from '../netlify/lib/of-events.mjs';
import {createOfRedirect} from '../netlify/lib/of-campaign.mjs';
function workbook(){
 const w=new ExcelJS.Workbook(),s=w.addWorksheet(OF_TAB);
 const r=s.getRow(8);for(const [n,v] of [[2,'Publisher'],[3,'https://x.com/publisher'],[4,{text:'Doc',hyperlink:'https://docs.google.com/document/d/example/edit'}],[5,'https://elegant-swan-98c20a.netlify.app/of/OF1'],[7,'https://x.com/publisher/status/123'],[19,250],[21,true],[22,false]])r.getCell(n).value=v;
 return w;
}
test('OF source uses specified columns; payment and live URL never imply posted',()=>{
 const w=workbook(),[p]=parseOfWorkbook(w);assert.equal(p.code,'OF1');assert.equal(p.campaignId,'C001');assert.equal(p.cost,250);assert.equal(p.paid,true);assert.equal(p.posted,false);assert.match(p.articleUrl,/docs.google.com/);
 w.getWorksheet(OF_TAB).getRow(8).getCell(22).value=true;assert.equal(parseOfWorkbook(w)[0].posted,true);
 w.getWorksheet(OF_TAB).getRow(8).getCell(21).value=false;assert.equal(parseOfWorkbook(w)[0].paid,false);
});
test('invalid identity and duplicate publisher code fail instead of inventing attribution',()=>{
 const w=workbook(),s=w.getWorksheet(OF_TAB);s.getRow(9).values=s.getRow(8).values;assert.throws(()=>parseOfWorkbook(w),/duplicate/);
 const v=workbook();v.getWorksheet(OF_TAB).getRow(8).getCell(5).value='https://example.com/of/OF1';assert.throws(()=>parseOfWorkbook(v),/Invalid/);
});
test('shared event merge preserves database identities, chronology, and existing article events without mirrored duplicates',()=>{
 const a={timestamp:'2026-11-09T10:00:00.000Z',code:'OF1',cta:'FANVUE'},b={...a,id:'event-1'},c={...a,id:'event-2'},article={...a,code:'A01-P14'};
 const merged=mergeOfEvents([article,a],[b,c]);assert.equal(merged.length,3);assert.equal(merged.filter(e=>e.code==='OF1').length,2);assert.deepEqual(mergeOfEvents(merged,[b,c]),merged);
});
test('safe browser exclusion never records OF clicks while preserving all ten exact redirects',async()=>{
 let writes=0;const handler=createOfRedirect({record:async()=>writes++,authorise:()=>false});
 for(let i=1;i<=10;i++){const r=await handler(new Request(`https://fixture.test/of/OF${i}`,{headers:{cookie:'fanvue_exclude_clicks=1'}}));assert.equal(r.status,302);const d=new URL(r.headers.get('location'));assert.equal(d.searchParams.get('utm_content'),'OF'+i);assert.equal(d.searchParams.get('utm_campaign'),'of_terms_2026');assert.equal(r.headers.get('x-of-event-status'),'excluded-browser');}
 assert.equal(writes,0);
});
