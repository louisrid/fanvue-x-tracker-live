#!/usr/bin/env python3
"""Test redesigned tables against representative DOM structures from production.
No network, Netlify Functions or tracking redirect is called during these tests.
"""
import asyncio
import tempfile
import threading
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from playwright.async_api import async_playwright

SRC = Path(__file__).resolve().parents[1] / 'source'
HTML = '''<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:white"><header id="brand-logo" style="height:120px;font-family:Georgia">XTRACKER</header>
<main id="mainContent" style="max-width:1100px;margin:auto;padding:0 14px">
<section class="site-page" id="page-dashboard"><div class="home-top-kpis"><div class="kpi-card"><span class="kpi-label">Paid total.</span><div class="kpi-value">$200</div></div></div><div id="weeklyGrid"><div class="empty-state">No live articles yet.</div></div></section>
<section class="site-page" id="page-placements"><div class="subpage-back-row"><button class="page-back-button"></button></div>
<div id="trackerList" class="tracker-list">
<div class="placement-shell"><label class="placement-select"><input id="original-select-1" type="checkbox" data-select-placement="A01-P1"></label><button class="article-card tracker-article" id="orig-article-1" data-detail="A01-P1"><span class="article-card-header"><strong class="article-publisher">creator_one</strong><span class="state-pill">POSTED</span></span><span class="article-card-meta"><span class="article-campaign-chip">Campaign 1</span><span>ARTICLE 1</span><span>A01-P1</span><span>$115</span></span><span class="article-kpis"><span class="article-kpi"><span class="article-kpi-label">UTM Clicks</span><strong class="article-kpi-value">10</strong></span><span class="article-kpi"><span class="article-kpi-label">Views</span><strong class="article-kpi-value">450</strong></span><span class="article-kpi"><span class="article-kpi-label">Likes</span><strong class="article-kpi-value">19</strong></span></span></button></div>
<div class="placement-shell"><button class="article-card tracker-article" data-detail="A01-P2"><span class="article-card-header"><strong class="article-publisher">creator_two</strong><span class="state-pill">Scheduled</span></span><span class="article-card-meta"><span class="article-campaign-chip">Campaign 2</span><span>ARTICLE 2</span><span>A01-P2</span><span>$55</span></span><span class="article-kpis"><span class="article-kpi"><span class="article-kpi-label">UTM Clicks</span><strong class="article-kpi-value">N/A</strong></span><span class="article-kpi"><span class="article-kpi-label">Views</span><strong class="article-kpi-value">N/A</strong></span></span></button></div>
</div></section>
<section class="site-page" id="page-of"><div id="ofPublishers"><section class="of-publisher-section"><div class="of-publisher-grid"><article class="of-publisher-entry"><a href="https://x.com/promo/status/123" class="article-card of-post-card"><span class="article-publisher">promo</span><span class="state-pill">POSTED</span><span class="article-card-meta"><span>OF1</span><span>$250</span></span><span class="article-kpis"><span class="article-kpi"><span class="article-kpi-label">UTM Clicks</span><strong class="article-kpi-value">25</strong></span><span class="article-kpi"><span class="article-kpi-label">Week UTM clicks</span><strong class="article-kpi-value">5</strong></span></span></a><div class="of-publisher-links"><a href="https://x.com/promo">X profile</a><a href="https://x.com/promo/status/123">View post</a></div></article></div></section></div></section>
<section class="site-page" id="page-gta-vi"><div class="subpage-back-row"><button class="page-back-button" id="gta-back"></button></div><div id="gtaPublishers"><section class="of-publisher-section"><div class="of-publisher-grid">
<article class="of-publisher-entry"><a href="https://x.com/GTA/status/111" class="article-card of-post-card"><span class="article-publisher">GTAfirst</span><span class="state-pill">POSTED</span><span class="article-card-meta"><span>GTA1</span><span>GTA1-R8</span><span>$115</span></span><span class="article-kpis"><span class="article-kpi"><span class="article-kpi-label">X Views</span><strong class="article-kpi-value">100</strong></span><span class="article-kpi"><span class="article-kpi-label">Likes</span><strong class="article-kpi-value">10</strong></span></span></a><div class="of-publisher-links"><a href="https://x.com/GTA">X profile</a><a href="https://x.com/GTA/status/111">View post</a></div></article>
<article class="of-publisher-entry"><a href="https://x.com/GTA2/status/222" class="article-card of-post-card"><span class="article-publisher">GTAsecond</span><span class="state-pill">POSTED</span><span class="article-card-meta"><span>GTA2</span><span>GTA2-R9</span><span>$200</span></span><span class="article-kpis"><span class="article-kpi"><span class="article-kpi-label">X Views</span><strong class="article-kpi-value">20</strong></span><span class="article-kpi"><span class="article-kpi-label">Likes</span><strong class="article-kpi-value">N/A</strong></span></span></a></article>
</div></section></div></section>
<section class="site-page" id="page-campaigns"><div id="campaignGrid" class="campaign-grid"><details class="campaign-accordion" data-campaign-key="C01"><summary class="campaign-summary"><strong class="campaign-name-heading">Campaign One.</strong><span class="campaign-summary-clicks"><strong>10</strong><small>UTM clicks</small></span></summary><div class="campaign-expanded"><div class="campaign-summary-metrics"><span><small>Posted</small><strong>1</strong></span><span><small>Paid total</small><strong>$115</strong></span><span><small>UTM clicks</small><strong>10</strong></span><span><small>Views recorded</small><strong>100</strong></span></div><div class="campaign-entries"><button class="campaign-entry" id="orig-campaign-action" data-detail="A01-P1"><strong>creator_one</strong> Details</button></div></div></details></div></section>
<section class="site-page" id="page-x-rts"><div class="account-table-wrap"><table class="account-table"><thead><tr><th>Original tweet / @handle</th><th>Actual boost spend ($)</th><th>X views</th></tr></thead><tbody id="boostRows"><tr class="account-row" data-boost="2117354088690245907"><td><strong>ArdzAI</strong><br><small>@ArdzAI0</small></td><td>Unknown</td><td>39,210</td></tr><tr class="account-row" data-boost="2115081383827698033"><td><strong>Tristan</strong><br><small>@Tristanvdvn</small></td><td>Unknown</td><td>18,916</td></tr></tbody></table></div><div id="boostMobile" class="account-mobile-list"></div></section>
<section class="site-page" id="page-accounts"><div id="accountTableWrap" class="account-table-wrap"><table class="account-table"><thead><tr><th>Account</th><th>UTM Clicks</th></tr></thead><tbody><tr><td>creator_one</td><td>10</td></tr><tr><td>creator_two</td><td>5</td></tr></tbody></table></div><div id="accountMobileList" class="account-mobile-list"></div></section>
<section class="site-page" id="page-stats"></section>
<section class="site-page" id="page-historical"><div class="historical-cards"><div class="article-card"><span class="article-publisher">creator_one</span><span class="article-card-meta"><span>ARTICLE 1</span><span>$115</span></span></div></div></section>
</main></body></html>'''

async def main():
    with tempfile.TemporaryDirectory() as tmp:
      tmp_path=Path(tmp)
      (tmp_path/'index.html').write_text(HTML)
      handler=partial(SimpleHTTPRequestHandler,directory=str(tmp_path))
      server=ThreadingHTTPServer(('127.0.0.1',0),handler)
      threading.Thread(target=server.serve_forever,daemon=True).start()
      async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
        for width in (1440, 390):
            page=await browser.new_page(viewport={'width':width, 'height':900})
            errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            await page.set_content(HTML)
            await page.evaluate("""() => {
              const cache=JSON.stringify({ready:true,publishers:[
                {code:'GTA1-R8',publisher:'GTAfirst',postUrl:'https://x.com/GTA/status/111',profileUrl:'https://x.com/GTA',posted:true,campaign:'GTA1',cost:115,views:100,likes:10,reposts:5,replies:8},
                {code:'GTA2-R9',publisher:'GTAsecond',posted:true,campaign:'GTA2',cost:200,views:20,likes:null,reposts:null}
              ]});
              Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>k==='xtracker-gta-report-cache-v1'?cache:null,setItem(){}}});
              window.fetch=async function(){return {ok:true,json:async()=>({placements:[
                {code:'A01-P1',publisher:'creator_one',profileUrl:'https://x.com/creator_one',postUrl:'https://x.com/creator_one/status/456',cost:115}]})}};
            }""")
            await page.add_style_tag(content=(SRC/'xtracker-polish.css').read_text())
            await page.add_script_tag(content=(SRC/'xtracker-polish.js').read_text())
            await page.add_script_tag(content=(SRC/'xtracker-tables.js').read_text())
            await page.wait_for_timeout(350)
            assert not errors,errors
            # Tables are visible; original controls remain in DOM and hidden from layout.
            assert await page.locator('#trackerList + .xt-table-wrap .xt-record-row').count()==2
            assert await page.locator('#ofPublishers .xt-data-table').count()==1
            assert await page.locator('#gtaPublishers .xt-data-table').count()==1
            assert await page.locator('#campaignGrid + .xt-table-wrap .xt-record-row').count()==1
            assert await page.locator('#gta-back svg').count()==1
            assert await page.locator('#brand-logo').evaluate('e=>getComputedStyle(e).fontFamily')=='Georgia'
            # Actual article modals: clicking the compact row triggers the untouched original button.
            await page.evaluate('''() => {window.testDetails=0;document.getElementById('orig-article-1').addEventListener('click',()=>window.testDetails++);}''')
            await page.locator('#trackerList + .xt-table-wrap tbody tr[data-key="A01-P1"] td:nth-child(3)').click()
            assert await page.evaluate('window.testDetails')==1
            # Bulk editing checkboxes forward to the untouched original input.
            await page.locator('#trackerList + .xt-table-wrap input.xt-row-select').click()
            assert await page.locator('#original-select-1').is_checked()
            # Missing data is a dash, not zero. Exact CPC for source row.
            assert '$11.50' in await page.locator('#trackerList + .xt-table-wrap tbody').inner_text()
            assert '—' in await page.locator('#trackerList + .xt-table-wrap tbody').inner_text()
            # Post URL links are independent of account links.
            a=page.locator('#gtaPublishers .xt-data-table tbody tr').first
            assert await a.locator('a[href="https://x.com/GTA"]').count()==1
            assert await a.locator('a[href="https://x.com/GTA/status/111"]').count()==1
            # Interactions exclude views: 10 likes + 5 reposts + 8 replies = 23.
            gtaRow = await a.inner_text()
            assert await a.locator('td').nth(6).inner_text()=='23',gtaRow
            assert '$5.0000' in gtaRow,gtaRow
            # Second post lacks likes/RTs: no fabricated total interactions or ratio.
            second=await page.locator('#gtaPublishers .xt-data-table tbody tr').nth(1).inner_text()
            assert '—' in second,second
            # Sorting numeric columns using header button, no page reload.
            await page.locator('#gtaPublishers .xt-data-table thead button').filter(has_text='Views').click()
            assert await page.locator('#gtaPublishers .xt-data-table tbody tr').first.get_attribute('data-key')=='GTA1-R8'
            await page.locator('#gtaPublishers .xt-data-table thead button').filter(has_text='Views').click()
            assert await page.locator('#gtaPublishers .xt-data-table tbody tr').first.get_attribute('data-key')=='GTA2-R9'
            # Campaign expand includes working detail button forwarded to original.
            await page.evaluate('''() => {window.campaignOpened=0;document.getElementById('orig-campaign-action').addEventListener('click',()=>window.campaignOpened++);}''')
            await page.locator('#campaignGrid + .xt-table-wrap tbody tr.xt-record-row').click()
            assert await page.locator('#campaignGrid + .xt-table-wrap tr.xt-detail-row').count()==1
            await page.locator('#campaignGrid + .xt-table-wrap .xt-cloned-expansion [data-detail]').click()
            assert await page.evaluate('window.campaignOpened')==1
            # Source table original tweets are still linked to their actual X posts.
            assert await page.locator('#boostRows .xt-original-links a').count()==4
            assert await page.locator('#boostRows a[href*="2114682794160824473"]').count()==0
            # Results can be filtered without changing source data or tracking.
            await page.locator('#gtaPublishers .xt-search input').fill('second')
            assert await page.locator('#gtaPublishers .xt-data-table tbody tr.xt-record-row').count()==1
            assert await page.locator('#gtaPublishers .xt-data-table tbody tr').first.get_attribute('data-key')=='GTA2-R9'
            # A live app re-render is reflected in the table without deleting source actions.
            await page.evaluate("""() => {
              const original=document.querySelector('#ofPublishers .of-publisher-grid .of-publisher-entry');
              const next=original.cloneNode(true);
              next.querySelector('.article-publisher').textContent='promo_new';
              next.querySelector('.article-card-meta span').textContent='OF2';
              document.querySelector('#ofPublishers .of-publisher-grid').appendChild(next);
            }""")
            await page.wait_for_timeout(120)
            assert await page.locator('#ofPublishers .xt-data-table tbody tr.xt-record-row').count()==2
            assert await page.locator('#ofPublishers .of-publisher-grid .of-publisher-entry').count()==2
            # iPhone scroll stays inside table wrappers, not on entire page.
            await page.wait_for_timeout(120)
            body=await page.evaluate('document.body.scrollWidth')
            assert body<=width+2,(width,body)
            if width==390:
                assert await page.locator('#page-accounts #accountTableWrap').evaluate('e=>getComputedStyle(e).display')=='block'
                assert await page.locator('#page-x-rts .account-table-wrap').evaluate('e=>getComputedStyle(e).display')=='block'
                table_width=await page.locator('#gtaPublishers .xt-table-scroll').evaluate('e=>e.scrollWidth')
                assert table_width>width,(width,table_width)
            await page.screenshot(path=str(Path(__file__).parent / f'qa_{width}.png'),full_page=False)
            print('PASS',width,'tables, GTA formula, sorting, filters, post/profile links, modals, bulk select, native RT links, no horizontal page overflow')
            await page.close()
        await browser.close()
      server.shutdown()

if __name__=='__main__':asyncio.run(main())
