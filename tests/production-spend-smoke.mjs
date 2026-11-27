// Production-only smoke: aggregate financial figures only. No redirect or tracking link requests.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base='https://elegant-swan-98c20a.netlify.app';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let ready=false;
for(let i=0;i<25;i++){
 try{const r=await fetch(base+'/?qa='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(12000)});ready=r.ok&&(await r.text()).includes('20261127-unified-kpis-v53');if(ready)break;}catch{}
 await sleep(3000);
}
assert.ok(ready,'Latest production HTML must be published before checking spend');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||undefined,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{const u=new URL(r.request().url());return u.origin===base||u.hostname.endsWith('gstatic.com')||u.hostname==='fonts.googleapis.com'?r.continue():r.abort();});
 await page.goto(base+'/#home',{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>window.FanvueApp?.reporting&&window.XTrackerCampaignReporting?.getData?.()?.campaigns?.length,{},{timeout:100000});
 const read=async(period)=>{
  await page.locator('[data-view="'+period+'"]').click();
  await page.waitForFunction(p=>document.querySelector('[data-view="'+p+'"]')?.getAttribute('aria-pressed')==='true',period);
  return page.locator('#fvPage>.fv-strip .fv-metric').filter({has:page.locator('.fv-metric-label',{hasText:'Spend'})}).locator('.fv-metric-value .fv-num').innerText({timeout:15000});
 };
 const check=async(label)=>{
  const data=await page.evaluate(()=>{const a=window.FanvueApp.reporting;return {week:a.periodTotals('2026-11-23','2026-11-29').spend.value,last:a.periodTotals('2026-11-16','2026-11-22').spend.value};});
  assert.ok(data.week>=2180,label+' this week confirmed payments plus separate $1,700 planned allocation');assert.ok(data.last>=805,label+' last week confirmed paid subtotal');
  const week=await read('this-week'),last=await read('last-week'),all=await read('all-time');
  assert.equal(week,await page.evaluate(v=>window.FanvueCore.moneyShort(v),data.week));
  assert.equal(last,await page.evaluate(v=>window.FanvueCore.moneyShort(v),data.last));
  assert.match(all,/^\$[\d,.]+[KM]?$/);
  const gta=await page.evaluate(()=>{const ov=window.FanvuePaymentDates.applyPaymentDates(window.XTrackerCampaignReporting.getData());const s=window.FanvueCore.campaignSummary(ov,'gta-vi');return {allocated:s.spend.value,paid:s.paidSpend.value,planned:s.planned,committed:s.committed};});
  assert.ok(gta.planned>=1700,label+' tab 16 reserved allocation included');
  assert.ok(Math.abs(gta.allocated-gta.paid-gta.planned-gta.committed)<.011,label+' GTA VI allocation reconciliation');
  console.log('LIVE '+label+' | This Week '+week+' | Last Week '+last+' | All Time '+all+' | GTA VI '+JSON.stringify(gta));
  return {week,last,all};
 };
 await check('before refresh');
 await page.locator('[data-view="this-week"]').click();
 await page.locator('#fvRefresh').click();
 await page.waitForFunction(()=>document.querySelector('#fvPage').classList.contains('is-kpi-refreshing'),{},{timeout:15000});
 console.log('Actual Refresh All request started');
 await page.waitForFunction(()=>document.querySelector('#fvRefreshProgress').hidden&&!document.querySelector('#fvRefresh').disabled,{},{timeout:240000});
 await check('after Refresh All');
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
