import asyncio,time,json,datetime, pathlib
from playwright.async_api import async_playwright
path='/mnt/data/xtracker_key_stats_v5028/public'
html=pathlib.Path(path+'/index.html').read_text()
css=pathlib.Path(path+'/styles.css').read_text()
js_code=pathlib.Path(path+'/app.js').read_text()
import re
html=re.sub(r'<link[^>]*href="/styles\.css[^>]*>', '', html)
html=re.sub(r'<script[^>]*src="/app\.js[^>]*></script>', '', html)
async def main():
 now=datetime.datetime.now(datetime.timezone.utc)
 ts=lambda hrs:(now-datetime.timedelta(hours=hrs)).isoformat().replace('+00:00','Z')
 rows='TIMESTAMP,CODE,CTA\r\n'+''.join('"%s","A01-P14","FANVUE"\r\n'%ts(h) for h in [0,1,2,4,8,10,24,25,26,27,48,60,72,100,101,102,135,136,155,166])
 sample={'code':'A01-P14','publisher':'testing-account','owner':'LOUIS','active':True,'paid':True,'posted':True,'platform':'X','postUrl':'https://x.com/testing_account/status/2112070999772402067','paidAt':ts(6),'cost':150,'countVerified':True,'clicks':20,'xViews':12000,'xLikes':150,'sourceTab':'WEEK 1 - LOUIS','campaign':'A01','campaignId':'A01'}
 payload={'ok':True,'uiVersion':'5.0.28','placements':[sample],'homeVerified':True,'homePaidCodes':['A01-P14'],'campaigns':[],'metricHistory':[],'trackingReady':True,'clickActivity':[{'date':now.date().isoformat(),'code':'A01-P14','clicks':20}], 'sourceStatus':'SHEET_LIVE','checkedAt':ts(0)}
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
  results=[]
  for width in [320,390,768,1440]:
   page=await browser.new_page(viewport={'width':width,'height':880},device_scale_factor=1)
   errors=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   await page.set_content(html,wait_until='domcontentloaded')
   await page.add_style_tag(content=css)
   await page.evaluate("({payload,rows})=>{window.fetch=async(u)=>{const url=String(u);if(url.includes('/.netlify/functions/dashboard'))return new Response(JSON.stringify(payload),{status:200,headers:{'content-type':'application/json'}});if(url.includes('/.netlify/functions/events'))return new Response(rows,{status:200,headers:{'content-type':'text/csv'}});return new Response('',{status:404});};location.hash='#stats';}",{ 'payload':payload,'rows':rows})
   await page.add_script_tag(content=js_code)
   await page.wait_for_timeout(250)
   js=await page.evaluate('''() => ({
    chart:!!document.querySelector('#dailyTrendChart svg'),
    tiles:document.querySelectorAll('#page-stats .daily-metric').length,
    rows:document.querySelectorAll('#page-stats #dailyOverviewTable tr').length,
    oldStats:!!document.querySelector('#statsWeekSelect'),
    overflow:document.documentElement.scrollWidth>window.innerWidth,
    chartWidth:document.querySelector('#dailyTrendChart').clientWidth,
    chartHtml:document.querySelector('#dailyTrendChart').textContent.slice(0,160),
    statsVisible:!document.querySelector('#page-stats').hidden,
    title:document.querySelector('#page-stats .page-intro').textContent,
    stacked:getComputedStyle(document.querySelector('#page-stats .daily-overview-metrics')).gridTemplateColumns,
    tableRows:document.querySelector('#dailyOverviewTable').textContent.slice(0,130)
   })''')
   if width in [390,1440]:
    await page.screenshot(path=f'/mnt/data/xtracker_key_stats_v5028/deployment/KEY_STATS_5028_{width}.png',full_page=True)
   await page.locator('[data-page="dashboard"]').first.click()
   dash=await page.evaluate('''() => ({dashboardVisible:!document.querySelector('#page-dashboard').hidden,statsRemoved:!document.querySelector('#statsSection'),dailyRemoved:!document.querySelector('#page-dashboard #dailyOverview'),firstSection:document.querySelector('#dashboardSections').firstElementChild.id,overflow:document.documentElement.scrollWidth>innerWidth})''')
   if width==390:
    await page.screenshot(path='/mnt/data/xtracker_key_stats_v5028/deployment/DASHBOARD_5028_390.png',full_page=True)
   results.append({'width':width,'stats':js,'dashboard':dash,'errors':errors})
   await page.close()
  await browser.close()
  return results
try:
 time.sleep(.5)
 results=asyncio.run(main())
 print(json.dumps(results,indent=2))
except Exception as e:
 print('BROWSER_TEST_ERROR:',str(e))
 raise
finally:
 pass
