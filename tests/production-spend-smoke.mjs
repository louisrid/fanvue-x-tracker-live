// Production-only smoke: aggregate financial figures only. No redirect or tracking link requests.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import ExcelJS from 'exceljs';
const base='https://elegant-swan-98c20a.netlify.app';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let ready=false;
for(let i=0;i<25;i++){
 try{const r=await fetch(base+'/?qa='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(12000)});ready=r.ok&&(await r.text()).includes('20261127-discord-clean-v56');if(ready)break;}catch{}
 await sleep(3000);
}
assert.ok(ready,'Latest production HTML must be published before checking spend');
// Independently compare the source sheet's displayed row amounts and payment flags.
const source=await fetch('https://docs.google.com/spreadsheets/d/1D8rI3BuuFHIemYZY92QFiHDMkj876F8oiwpDR6sMiTE/export?format=xlsx',{cache:'no-store',signal:AbortSignal.timeout(30000)});
assert.ok(source.ok,'live spreadsheet export accessible');
const book=new ExcelJS.Workbook();await book.xlsx.load(Buffer.from(await source.arrayBuffer()));
const sheet=book.getWorksheet('X Accounts 17 (Mandy QRTs)');assert.ok(sheet);
const v=c=>{const x=c.value;return x&&typeof x==='object'?(x.result??x.text??x.hyperlink??''):x;};
const cols={};sheet.getRow(7).eachCell((c,i)=>{cols[String(v(c)).trim()]=i;});
for(const key of ['ACCOUNT SUM','PAID?','POSTED?','UTM LINK'])assert.ok(cols[key],key+' source column');
const expected={paid:0,total:0,pending:0,pendingCost:0,links:[]};
for(let i=8;i<=sheet.rowCount;i++){
 const c=k=>v(sheet.getRow(i).getCell(cols[k]));const amount=c('ACCOUNT SUM');if(amount===null||amount===undefined||amount==='')continue;
 const cost=Number(String(amount).replace(/[$,]/g,''));if(!Number.isFinite(cost))continue;
 expected.total+=cost;if(String(c('PAID?')).toLowerCase()!=='true')continue;
 expected.paid+=cost;const url=String(c('UTM LINK')||'');
 if(String(c('POSTED?')).toLowerCase()!=='true'&&url.startsWith('https://createmyai.app/')){expected.pending++;expected.pendingCost+=cost;expected.links.push(url);}
}
assert.equal(expected.pending,21);assert.equal(expected.pendingCost,820);assert.equal(expected.paid,Number(v(sheet.getCell('C4'))));assert.equal(expected.total,Number(v(sheet.getCell('C2'))));assert.equal(new Set(expected.links).size,21);
console.log('LIVE source sheet '+JSON.stringify({...expected,links:undefined}));
const groupTabs={'gta-qrts':['X Accounts 15 (GTA VI QRTs)','X Accounts 16 (GTA VI QRTs)'],'gta-originals':['X Accounts 12 (GTA)','X Accounts 14 (GTA VI V2)'],'gta-instagram':['IG Accounts 3 (GTA VI)'],'gta-mandy':['X Accounts 17 (Mandy QRTs)'],'of-terms':['X Accounts 13 (OF Terms)']};
const sheetPaid=name=>{const s=book.getWorksheet(name);assert.ok(s,name);const h={};s.getRow(7).eachCell((c,i)=>{h[String(v(c)).trim()]=i;});let total=0;
 for(let i=8;i<=s.rowCount;i++){const c=k=>v(s.getRow(i).getCell(h[k]));if(String(c('PAID?')).toLowerCase()!=='true')continue;const n=Number(String(c('ACCOUNT SUM')??'').replace(/[$,]/g,''));if(Number.isFinite(n))total+=n;}
 return Math.round(total*100)/100;
};
const expectedGroups=Object.fromEntries(Object.entries(groupTabs).map(([id,tabs])=>[id,tabs.reduce((n,t)=>n+sheetPaid(t),0)]));
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||undefined,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{const u=new URL(r.request().url());return (u.origin===base&&!/^\/(?:r|s|of)\//.test(u.pathname))||u.hostname.endsWith('gstatic.com')||u.hostname==='fonts.googleapis.com'?r.continue():r.abort();});
 await page.goto(base+'/#home',{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>window.FanvueApp?.reporting&&window.XTrackerCampaignReporting?.getData?.()?.campaigns?.length,{},{timeout:100000});
 const read=async(period)=>{
  await page.locator('[data-view="'+period+'"]').click();
  await page.waitForFunction(p=>document.querySelector('[data-view="'+p+'"]')?.getAttribute('aria-pressed')==='true',period);
  return page.locator('#fvPage>.fv-strip .fv-metric').filter({has:page.locator('.fv-metric-label',{hasText:'Spend'})}).locator('.fv-metric-value .fv-num').innerText({timeout:15000});
 };
 const check=async(label)=>{
  const data=await page.evaluate(()=>{const a=window.FanvueApp.reporting;return {week:a.periodTotals('2026-11-23','2026-11-29').spend.value,last:a.periodTotals('2026-11-16','2026-11-22').spend.value};});
  assert.ok(data.week>=expected.paid,label+' this week includes the source-confirmed Mandy payments');assert.ok(data.last>=805,label+' last week confirmed paid subtotal');
  const week=await read('this-week'),last=await read('last-week'),all=await read('all-time');
  assert.equal(week,await page.evaluate(v=>window.FanvueCore.moneyShort(v),data.week));
  assert.equal(last,await page.evaluate(v=>window.FanvueCore.moneyShort(v),data.last));
  assert.match(all,/^\$[\d,.]+[KM]?$/);
  const groups=await page.evaluate(()=>Object.fromEntries(window.XTrackerCampaignReporting.getData().campaigns.map(c=>[c.id,c.paidSpendKnown])));
  for(const [id,amount] of Object.entries(expectedGroups))assert.ok(Math.abs((groups[id]??0)-amount)<.011,label+' '+id+' paid matches spreadsheet: '+groups[id]+' vs '+amount);
  const summary=await page.evaluate(()=>{const ov=window.FanvuePaymentDates.applyPaymentDates(window.XTrackerCampaignReporting.getData()),C=window.FanvueCore,s=C.CAMPAIGNS.map(c=>C.campaignSummary(ov,c.key));return {total:C.homeTotals(ov,s).spend.value,parts:Object.fromEntries(s.map(c=>[c.key,c.spend.value]))};});
  assert.ok(Math.abs(summary.total-Object.values(summary.parts).reduce((n,x)=>n+(x||0),0))<.011,'dashboard totals count each canonical campaign once');
  assert.equal(all,await page.evaluate(v=>window.FanvueCore.moneyShort(v),summary.total));
  console.log('LIVE campaign paid '+JSON.stringify({groups,summary}));
  const gta=await page.evaluate(()=>{const ov=window.FanvuePaymentDates.applyPaymentDates(window.XTrackerCampaignReporting.getData());const s=window.FanvueCore.campaignSummary(ov,'gta-vi');return {allocated:s.allocatedSpend.value,paid:s.paidSpend.value,planned:s.planned,committed:s.committed};});
  assert.ok(gta.planned>=1700,label+' tab 16 reserved allocation included');
  assert.ok(Math.abs(gta.allocated-gta.paid-gta.planned-gta.committed)<.011,label+' GTA VI allocation reconciliation');
  const mandy=await page.evaluate(()=>{const c=window.XTrackerCampaignReporting.getData().campaigns.find(x=>x.id==='gta-mandy');const pending=c.rows.filter(r=>r.paid===true&&!r.posted&&r.trackingUrl?.startsWith('https://createmyai.app/'));return {paid:c.paidSpendKnown,planned:c.plannedSpendKnown,committed:c.committedUnpaidKnown,pending:pending.length,pendingCost:pending.reduce((n,r)=>n+r.cost,0),unique:new Set(pending.map(r=>r.code)).size,dated:pending.filter(r=>r.paidAt==='2026-11-27').length,links:pending.map(r=>r.trackingUrl).sort()};});
  assert.equal(mandy.paid,expected.paid,label+' Mandy paid');assert.equal(mandy.planned+mandy.committed,expected.total-expected.paid,label+' Mandy unpaid');assert.equal(mandy.pending,expected.pending);assert.equal(mandy.pendingCost,expected.pendingCost);assert.equal(mandy.unique,expected.pending);assert.equal(mandy.dated,expected.pending);assert.deepEqual(mandy.links,expected.links.slice().sort());
  console.log('LIVE Mandy '+label+' '+JSON.stringify({...mandy,links:undefined}));
  console.log('LIVE '+label+' | This Week '+week+' | Last Week '+last+' | All Time '+all+' | GTA VI '+JSON.stringify(gta));
  return {week,last,all};
 };
 await page.evaluate(async()=>{await fetch('/.netlify/functions/campaign-overview?refresh=1',{cache:'no-store'});});
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.XTrackerCampaignReporting?.getData?.()?.campaigns?.find(c=>c.id==='gta-mandy')?.rows?.filter(r=>r.paid&&r.trackingUrl?.startsWith('https://createmyai.app/')).length>=21,{},{timeout:100000});
 await check('before refresh');
 await page.locator('[data-view="this-week"]').click();
 await page.locator('#fvRefresh').click();
 await page.waitForFunction(()=>document.querySelector('#fvPage').classList.contains('is-kpi-refreshing'),{},{timeout:15000});
 console.log('Actual Refresh All request started');
 await page.waitForFunction(()=>document.querySelector('#fvRefreshProgress').hidden&&!document.querySelector('#fvRefresh').disabled,{},{timeout:240000});
 await check('after Refresh All');
 const short=await page.evaluate(async()=>{const r=await fetch('/.netlify/functions/gta-report',{cache:'no-store'});const d=await r.json();return (d.mandy?.shortIo?.links||[]).map(p=>({domain:new URL(p.trackingUrl).hostname,verified:Number.isInteger(p.clicks)&&!!p.clickAt&&!p.clickError,published:p.posted===true,attributed:p.attributed===true}));});
 const domains=Object.fromEntries(['createmyai.app','irxc49.s.gy'].map(domain=>[domain,{links:short.filter(p=>p.domain===domain).length,verified:short.filter(p=>p.domain===domain&&p.verified).length}]));
 assert.ok(domains['createmyai.app'].verified>=21,'new-domain links confirmed by Short.io API data');assert.ok(domains['irxc49.s.gy'].verified>=6,'legacy-domain links confirmed by Short.io API data');assert.equal(short.filter(p=>p.domain==='createmyai.app'&&!p.published&&p.attributed).length,0);
 console.log('LIVE Short.io domain verification '+JSON.stringify(domains));
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.FanvueApp?.reporting&&window.XTrackerCampaignReporting?.getData?.()?.campaigns?.length,{},{timeout:100000});
 await check('after browser reload');
 for(const route of ['gta-vi','viral-qrts','x-articles','of-terms','guru-promotion','discord']){
  await page.evaluate(route=>{location.hash=route;},route);
  await page.waitForFunction(()=>document.querySelectorAll('#fvPage>.fv-kpi-periods [data-period]').length===3);
  for(const period of ['this-week','last-week','all-time']){
   await page.locator('#fvPage>.fv-kpi-periods [data-period="'+period+'"]').click();
   assert.equal(await page.locator('#fvPage>.fv-kpi-periods [aria-pressed="true"]').getAttribute('data-period'),period);
  }
  console.log('LIVE KPI period controls '+route+' checked');
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
