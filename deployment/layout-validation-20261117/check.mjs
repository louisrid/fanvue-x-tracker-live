const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const base=process.env.CHECK_BASE||'http://localhost:8889';
const page=await browser.newPage();
const cache=new Map();
await page.route('**/.netlify/functions/**',async route=>{
 const req=route.request(),u=new URL(req.url());
 if(req.method()!=='GET'||u.search){return route.fulfill({status:503,body:'{}'});}
 if(!cache.has(u.pathname)){
  const res=await fetch('https://elegant-swan-98c20a.netlify.app'+u.pathname);
  cache.set(u.pathname,{status:res.status,contentType:'application/json',body:await res.text()});
 }
 await route.fulfill(cache.get(u.pathname));
});
for(const width of [1440,1360,1024,390,320]){
 await page.setViewportSize({width,height:1000});
 for(const campaign of ['gta-vi','of']){
 await page.goto(base+'/#'+campaign);
 await page.waitForSelector(`#page-${campaign} .xt-record-row`,{timeout:60000});
 await page.locator(`[data-${campaign==='of'?'of':'gta'}-clicks]`).click();
 await page.waitForTimeout(1300);
 const result=await page.evaluate(campaign=>{
  const root=document.querySelector(campaign==='of'?'#ofPublishers':'#gtaPublishers');
  const table=root.querySelector('.xt-data-table'),scroll=table.parentElement;
  const heading=root.querySelector('h2'),nav=document.querySelector('.app-header');
  return {width:innerWidth,campaign,pageWidth:document.documentElement.scrollWidth,navBottom:nav.getBoundingClientRect().bottom,headingTop:heading.getBoundingClientRect().top,columns:[...table.querySelectorAll('th')].map(e=>e.textContent),tableWidth:table.getBoundingClientRect().width,scrollWidth:scroll.clientWidth,rows:table.tBodies[0].rows.length,sort:table.querySelector('th:nth-child(5)').getAttribute('aria-sort'),clippedCells:[...table.querySelectorAll('td,th')].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.textContent)};
 },campaign);
 console.log(JSON.stringify(result));
 if(result.pageWidth>width||result.headingTop<result.navBottom+20||result.columns.length!==9||result.sort!=='descending'||result.clippedCells.length||(width>=1024&&result.tableWidth>result.scrollWidth+1))throw Error('Layout failed');
 const search=page.locator(`#page-${campaign} .xt-search input`).first();
 await search.fill('zzzznonexistent');await page.waitForSelector(`#page-${campaign} .xt-no-results`);await search.fill('');
 for(let index=0;index<9;index++){
  for(let click=0;click<2;click++)await page.locator(`#page-${campaign} .xt-data-table`).first().locator('th button').nth(index).click();
 }
 const scroll=page.locator(`#page-${campaign} .xt-table-scroll`).first();
 await scroll.evaluate(el=>{el.scrollLeft=el.scrollWidth;});
 const reachable=await scroll.evaluate(el=>el.querySelector('th:last-child').getBoundingClientRect().right<=el.getBoundingClientRect().right+1);
 if(!reachable)throw Error('Last column unreachable');
 await page.locator(`[data-${campaign==='of'?'of':'gta'}-clicks]`).click();
 await page.waitForTimeout(1100);
 const repeat=await page.evaluate(campaign=>{
  const root=document.querySelector(campaign==='of'?'#ofPublishers':'#gtaPublishers');
  const header=document.querySelector('.app-header');
  const position=getComputedStyle(header).position;
  const bottom=['sticky','fixed'].includes(position)?header.getBoundingClientRect().bottom:0;
  return root.querySelector('h2').getBoundingClientRect().top>=bottom+20&&root.querySelector('.xt-table-scroll').scrollLeft===0;
 },campaign);
 if(!repeat)throw Error('Repeated KPI jump failed');
 await page.screenshot({path:`/tmp/xtracker-${campaign}-${width}.png`,fullPage:true});
 }
}
await browser.close();
