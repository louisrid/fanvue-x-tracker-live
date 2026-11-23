"""Checks real managed-preview assets and reports without opening tracking links or making writes."""
import asyncio,sys
from pathlib import Path
from urllib.parse import urlparse
from playwright.async_api import async_playwright
async def run(base):
 out=Path('deployment/redesign-validation');out.mkdir(exist_ok=True)
 async with async_playwright() as p:
  for device in ['desktop','iphone']:
   browser=await (p.chromium if device=='desktop' else p.webkit).launch()
   context=await browser.new_context(**({'viewport':{'width':1440,'height':1000}} if device=='desktop' else p.devices['iPhone 13']))
   errors=[];blocked=[];responses={}
   async def guard(route):
    req=route.request;u=urlparse(req.url)
    if (u.hostname==urlparse(base).hostname and u.path.startswith(('/r/','/of/','/s/','/p/'))) or req.method not in ['GET','HEAD']:
     blocked.append(u.path);await route.abort()
    else:await route.continue_()
   await context.route('**/*',guard)
   page=await context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
   page.on('response',lambda r:responses.update({urlparse(r.url).path:r.status}) if '/.netlify/functions/' in r.url else None)
   await page.goto(base,wait_until='domcontentloaded')
   await page.locator('#trackerList + .xt-table-wrap .xt-record-row').first.wait_for(state='attached',timeout=60000)
   for name,hash in [('dashboard','dashboard'),('stats','stats'),('historical','historical'),('placements','placements'),('accounts','accounts'),('campaigns','campaigns'),('of','campaign-C001'),('x-rts','x-rts'),('gta-vi','gta-vi')]:
    await page.evaluate('(h)=>location.hash=h',hash);section=page.locator('#page-'+name);await section.wait_for(state='visible');await page.wait_for_timeout(650)
    if name in ['of','gta-vi']:await section.locator('.xt-record-row').first.wait_for(timeout=45000)
    if name=='x-rts':await page.locator('#boostRows tr[data-boost]').first.wait_for(timeout=45000)
    assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+2'),(device,name,'overflow')
    assert await page.locator('.brand-name').inner_text()=='X TRACKER'
    for root in await section.locator('.xt-source-hidden').all():
     count=await root.locator(':scope > .campaign-accordion' if await root.get_attribute('id')=='campaignGrid' else '.article-card').count()
     assert count==await root.evaluate('(e)=>e.nextElementSibling.querySelectorAll(".xt-record-row").length'),(device,name,'missing rows')
    mount=section.locator('.xt-table-wrap:visible').first
    if await mount.count():
     await mount.locator('thead button').first.click();a=await mount.locator('th[aria-sort]:not([aria-sort=none])').get_attribute('aria-sort')
     await mount.locator('thead button').first.click();b=await mount.locator('th[aria-sort]:not([aria-sort=none])').get_attribute('aria-sort');assert a!=b
     search=mount.locator('input[type=search]')
     if await search.count():
      count=await mount.locator('.xt-record-row').count();await search.fill('__no_matching_account__');assert await mount.locator('.xt-record-row').count()==0
      await mount.locator('input[type=search]').fill('');assert await mount.locator('.xt-record-row').count()==count
    if name in ['dashboard','historical']:
     for week in ['1','2','3']:
      if name=='dashboard':await page.locator('#dashboardWeekSelect').select_option(week)
      else:await page.locator('[data-historical-week="'+week+'"]').click()
      await page.wait_for_timeout(150);rows=section.locator('.xt-record-row:visible')
      if await rows.count():break
     assert await rows.count()>0
     await rows.first.locator('td').nth(1).click();await page.locator('#articleModal').wait_for(state='visible');await page.locator('#modalClose').click()
    if name=='placements':
     m=page.locator('#trackerList + .xt-table-wrap');boxes=m.locator('.xt-row-select')
     await boxes.nth(0).check();await boxes.nth(1).check();assert await page.locator('#trackerList input:checked').count()==2
     assert '2 selected' in await page.locator('#bulkCount').inner_text()
     await boxes.nth(0).uncheck();await boxes.nth(1).uncheck()
     await m.locator('tbody tr').first.locator('td').nth(2).click();await page.locator('#articleModal').wait_for(state='visible');assert await page.locator('#modalTitle').inner_text();await page.locator('#modalClose').click()
    if name=='accounts':
     count=await page.locator('#accountTableBody tr[data-account]').count();await page.locator('#accountSearch').fill('__no_match__');assert await page.locator('#accountTableBody tr[data-account]').count()==0
     await page.locator('#accountSearch').fill('');assert await page.locator('#accountTableBody tr[data-account]').count()==count
     for _ in range(2):await page.locator('#accountTableWrap thead button').nth(1).click()
    if name=='campaigns':
     await section.locator('.xt-row-name').filter(has_text='GrokBot').click();await section.locator('.xt-detail-row [data-detail]').first.click();await page.locator('#articleModal').wait_for(state='visible');await page.locator('#modalClose').click()
     await section.locator('a.xt-row-name').filter(has_text='OF Terms X Promo').click();await page.locator('#page-of').wait_for(state='visible')
     await page.evaluate('location.hash="campaigns"');await section.wait_for(state='visible')
    if name=='x-rts':
     assert await page.locator('#boostRows tr[data-boost]').count()==4
     assert await page.locator('#boostRows .xt-original-links a').count()==8
     assert await page.locator('#boostRows a[href*="2114682794160824473"]').count()==0
    for href in await section.locator('.xt-cell-link').evaluate_all('(els)=>els.map(e=>e.href)'):
     assert urlparse(href).scheme=='https'
     assert not urlparse(href).path.startswith(('/r/','/of/'))
    await page.screenshot(path=str(out/(device+'-'+name+'.png')),full_page=True)
    print('PASS',device,name,flush=True)
   assert not errors,errors
   assert not blocked,blocked
   assert all(code==200 for code in responses.values()),responses
   print('PASS',device,'all nine pages; real preview reports',responses,flush=True)
   await context.close();await browser.close()
asyncio.run(run(sys.argv[1]))
