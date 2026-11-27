// Browser-level regression checks with synthetic data only; no live campaign data or secrets.
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFileSync,mkdirSync,existsSync,copyFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
const publicDir=path.resolve('public');
const fixture=String.raw`
const qaToday=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const qaNow=Date.now(),qaPost=(i)=>String((BigInt(qaNow-86400000-i*3600000-1288834974657)<<22n)+BigInt(i));
const qaRow=(i,c,type='post')=>({code:'QA'+i,campaign:c,campaignId:'qa-linked',type,publisher:'@qa'+i,paid:true,posted:true,cost:30+i,clicks:8+i*3,views:1000+i*500,sourceTab:c,sourceRow:i+5,trackingUrl:'https://example.com/qa'+i,postUrl:'https://x.com/qa'+i+'/status/'+qaPost(i),postedAt:qaToday,paidAt:qaToday,articleLabel:'Synthetic headline '+i,articleTitle:'Synthetic headline '+i});
const qaA=qaRow(1,'XA','article'),qaB=qaRow(2,'XA','article'),qaO=qaRow(3,'GTAQ'),qaQ=qaRow(4,'GTAQ','qrt'),qaM=qaRow(5,'GTAM','qrt'),qaF=qaRow(6,'OF'),qaR={...qaRow(7,'XA','rt'),sourcePostUrl:qaA.postUrl},qaG={...qaRow(8,'GURU','rt'),sourcePostUrl:qaB.postUrl};
const qaCampaign=(id,name,rows,extra={})=>({id,name,source:'CONNECTED',rows,paidSpendKnown:rows.reduce((s,r)=>s+r.cost,0),paidCount:rows.length,unknownPaidCosts:0,...extra});
const qaOverview={checkedAt:new Date().toISOString(),campaigns:[
 qaCampaign('x-articles','X Articles',[qaA,qaB],{sourceCampaigns:[{id:'qa-linked',name:'QA source',placements:2,paidSpendKnown:63,xViews:3500,trackedClicks:25}]}),
 qaCampaign('article-rts','Paid RTs',[qaR]),
 qaCampaign('gta-originals','Original Posts',[qaO]),
 qaCampaign('gta-qrts','GTA QRTs',[qaQ]),
 qaCampaign('gta-mandy','Mandy',[qaM],{quotedOriginals:{rows:[{originalPostId:qaPost(20),originalUrl:'https://x.com/qa/status/'+qaPost(20),handle:'qa',views:1000000,qrts:[{postUrl:qaM.postUrl}]}]}}),
 qaCampaign('gta-instagram','Hidden',[],{paidSpendKnown:99}),
 qaCampaign('of-terms','OF Terms',[qaF]),
 qaCampaign('guru-rts','Guru RTs',[],{paidReposts:[qaG],rows:[{id:qaPost(2),publisher:'@qa2',postUrl:qaB.postUrl,views:2000,history:[]}]})
]};
const qaActivity=(rows)=>rows.map(r=>({code:r.code,date:qaToday,clicks:r.clicks}));
const qaMembers={latest:{date:qaToday,memberCount:24400},history:[{date:qaToday,memberCount:24400}],checkedAt:qaOverview.checkedAt};
window.XTrackerCampaignReporting={getData:()=>qaOverview,status:()=>({}),ensure(){},refreshDiscord(){},discord:()=>({members:qaMembers,clicks:{total:100,last7Days:25,days:{[qaToday]:25},checkedAt:qaOverview.checkedAt}})};
window.XTrackerApp={dashboard:()=>({activityReady:true,activity:qaActivity([qaA,qaB]),history:[]}),gta:()=>({report:{activity:qaActivity([qaQ]),originals:{activity:qaActivity([qaO])},mandy:{activity:qaActivity([qaM])}}}),of:()=>({report:{ready:true,activity:qaActivity([qaF])}}),loadGta(){},loadOf(){},showRecords(){},isUnlocked:()=>false};
window.FanvueDirectory={state:{accounts:[{key:'X|unused',handle:'@unused',platform:'X'},{key:'Instagram|hidden',handle:'@hidden',platform:'Instagram'}],loaded:true},load(){}};
`;
const custom={slug:'qa-campaign',name:'QA Campaign',icon:'megaphone',color:'blue',status:'Live',dataLink:'qa-linked',links:[]};
const template=readFileSync(path.join(publicDir,'index.html'),'utf8').replace(/<script src="[^"]+" defer><\/script>/g,match=>/\/fanvue-(core|ui|app|campaigns|payment-dates)\.js/.test(match)?match:'').replace('</head>','<script>'+fixture+'</script></head>');
const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json'};
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');
 if(url.pathname==='/.netlify/functions/campaign-registry'){res.writeHead(200,{'content-type':'application/json'});return res.end(JSON.stringify({ok:true,campaigns:[custom],builtIns:{}}));}
 if(url.pathname==='/'){res.writeHead(200,{'content-type':'text/html'});return res.end(template);}
 const p=path.resolve(publicDir,'.'+url.pathname);
 if(!p.startsWith(publicDir+path.sep)||!existsSync(p)){res.writeHead(404);return res.end();}
 res.writeHead(200,{'content-type':types[path.extname(p)]||'application/octet-stream'});res.end(readFileSync(p));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||undefined,args:['--no-sandbox']});
const routes=[['gta-vi','GTA VI'],['gta-vi/lucia','GTA VI'],['gta-vi/mandy','GTA VI'],['viral-qrts','Viral QRTs'],['x-articles','X Articles'],['x-articles/articles','X Articles'],['x-articles/rts','X Articles'],['of-terms','OF Terms'],['guru-promotion','Guru RTs'],['discord','Discord'],['campaign/qa-campaign','QA Campaign']];
const dir='artifacts/browser-layout';mkdirSync(dir,{recursive:true});
const preview=dir+'/preview';mkdirSync(preview,{recursive:true});
for(const name of ['fanvue.css','fanvue-records.css','fanvue-core.js','fanvue-ui.js','fanvue-app.js','fanvue-campaigns.js'])copyFileSync(path.join(publicDir,name),path.join(preview,name));
writeFileSync(path.join(preview,'index.html'),template);writeFileSync(path.join(preview,'registry.json'),JSON.stringify({ok:true,campaigns:[custom],builtIns:{}}));
function close(a,b,label){for(let i=0;i<a.length;i++)assert.ok(Math.abs(a[i]-b[i])<=1.1,label+': '+a+' vs '+b);}
try{
 for(const viewport of [{width:430,height:932},{width:390,height:844},{width:375,height:812},{width:320,height:740},{width:1440,height:900},{width:1024,height:768}]){
  const page=await browser.newPage({viewport,deviceScaleFactor:1,isMobile:viewport.width<768,hasTouch:viewport.width<768});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>/^(https:\/\/fonts\.(googleapis|gstatic)\.com\/)/.test(route.request().url())||route.request().url().startsWith(base)?route.continue():route.abort());
  await page.goto(base+'/#gta-vi');await page.waitForFunction(()=>window.FanvueCampaigns?.state?.loaded);
  const open=async(route,title)=>{
   await page.mouse.move(0,0);
   await page.evaluate(route=>{location.hash=route;},route);
   await page.waitForFunction(({route,title})=>location.hash.slice(1)===route&&document.getElementById('fvTitle')?.textContent===title&&document.querySelector('#fvPage .fv-chart .fv-hit'),{route,title});
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   assert.equal(await page.locator('#fvTitleChip svg').count(),0,route+' no page-title icon');
   assert.ok(await page.locator('#fvTitle').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=(innerWidth<768?30:44)),route+' larger title');
  };
  // Manual refresh: test the real UI against a deliberately controlled asynchronous source.
  await open('home','Dashboard');
  const geometryBefore=await page.locator('#fvPage>.fv-strip .fv-metric').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height]}));
  await page.evaluate(()=>{
   window.qaRefreshCalls=0;window.qaRefreshError=false;
   window.XTrackerApp.refresh={all:cb=>{window.qaRefreshCalls++;cb({completed:0,total:6,label:'Refreshing sources…'});window.qaRefreshProgress=cb;return new Promise(resolve=>window.qaRefreshFinish=()=>resolve(!window.qaRefreshError));}};
   window.XTrackerApp.status=()=>({error:window.qaRefreshError,text:window.qaRefreshError?'Saved readings retained':'All sources updated'});
  });
  await page.locator('#fvRefresh').click();
  await page.waitForFunction(()=>document.querySelector('#fvPage').classList.contains('is-kpi-refreshing')&&!document.querySelector('#fvRefreshProgress').hidden);
  assert.equal(await page.locator('#fvRefreshTrack').getAttribute('aria-valuenow'),'0');
  assert.equal(await page.locator('#fvRefreshTrack').getAttribute('aria-valuemax'),'6');
  assert.ok(await page.locator('#fvPage>.fv-strip .fv-metric-value').evaluateAll(es=>es.length>0&&es.every(e=>getComputedStyle(e,'::after').animationName==='fv-spin'&&[...e.children].every(c=>getComputedStyle(c).visibility==='hidden'))),'only KPI values show loading wheels');
  assert.ok(await page.locator('#fvPage>.fv-strip .fv-metric-label').first().isVisible());
  assert.ok(await page.locator('#home-comparison tbody .fv-row').first().isVisible());
  assert.deepEqual(await page.locator('#fvPage>.fv-strip .fv-metric').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height]})),geometryBefore,'refresh preserves KPI geometry');
  await page.evaluate(()=>window.qaRefreshProgress({completed:3,total:6,label:'Updating sources…'}));
  assert.equal(await page.locator('#fvRefreshTrack').getAttribute('aria-valuenow'),'3');
  assert.equal(await page.locator('#fvRefreshFill').evaluate(e=>e.style.width),'50%');
  await page.screenshot({path:dir+'/refresh-'+viewport.width+'.png',fullPage:true});
  if(viewport.width===430||viewport.width===1440){
   await open('gta-vi','GTA VI');assert.equal(await page.locator('#fvRefreshProgress').isVisible(),false);assert.equal(await page.locator('#fvRefresh').isDisabled(),true);
   await open('home','Dashboard');assert.equal(await page.locator('#fvRefreshTrack').getAttribute('aria-valuenow'),'3');
  }
  await page.evaluate(()=>window.qaRefreshFinish());
  await page.waitForFunction(()=>document.querySelector('#fvRefreshProgress').hidden&&!document.querySelector('#fvRefresh').disabled);
  assert.equal(await page.locator('#fvPage').evaluate(e=>e.classList.contains('is-kpi-refreshing')),false);
  assert.equal(await page.locator('#fvRefreshTrack').getAttribute('aria-valuenow'),'0');
  assert.equal(await page.locator('#fvRefreshStatus').innerText(),'Updated');
  await page.evaluate(()=>{window.qaRefreshError=true;});
  await page.locator('#fvRefresh').click();
  await page.waitForFunction(()=>document.querySelector('#fvPage').classList.contains('is-kpi-refreshing'));
  assert.equal(await page.locator('#fvRefreshTrack').getAttribute('aria-valuenow'),'0','second refresh starts from zero');
  await page.evaluate(()=>window.qaRefreshFinish());
  await page.waitForFunction(()=>document.querySelector('#fvRefreshProgress').hidden&&!document.querySelector('#fvRefresh').disabled);
  assert.equal(await page.locator('#fvRefreshStatus').innerText(),'Latest available data');
  assert.equal(await page.locator('#fvPage').evaluate(e=>e.classList.contains('is-kpi-refreshing')),false,'failure restores numbers');
  assert.equal(await page.evaluate(()=>window.qaRefreshCalls),2);
  await open('gta-vi','GTA VI');
  // Period controls on every KPI page use real period state without altering the listing scope.
  for(const [route,title] of routes){
    await open(route,title);
    const controls=page.locator('#fvPage>.fv-kpi-periods button');
    assert.deepEqual(await controls.evaluateAll(es=>es.map(e=>e.dataset.period)),['this-week','last-week','all-time'],route+' period order');
    for(const period of ['last-week','all-time','this-week']){
      await page.locator('#fvPage>.fv-kpi-periods [data-period="'+period+'"]').click();
      assert.equal(await page.locator('#fvPage>.fv-kpi-periods [aria-pressed="true"]').getAttribute('data-period'),period);
      assert.equal(await page.locator('#fvPage>.fv-strip .fv-metric').count(),4);
      assert.ok(await page.locator('#fvPage>.fv-kpi-periods').evaluate(e=>e.scrollWidth<=e.clientWidth+1),route+' period controls fit');
    }
  }
  await open('gta-vi','GTA VI');
  // Capture every page at every tested width before detailed assertions, even if later QA fails.
  {
   await page.evaluate(()=>Promise.race([document.fonts?.ready||Promise.resolve(),new Promise(r=>setTimeout(r,2000))]));
   for(const [route,title] of routes){
    await open(route,title);
    await page.screenshot({path:dir+'/sweep-'+viewport.width+'-'+route.replaceAll('/','-')+'.png',fullPage:true});
   }
   await page.evaluate(()=>location.hash='all-accounts');
   await page.waitForFunction(()=>document.querySelector('#acc-table .fv-account-plain'));
   await page.screenshot({path:dir+'/sweep-'+viewport.width+'-accounts.png',fullPage:true});
   await open('home','Dashboard');
   for(const period of ['this-week','last-week','all-time']){
    await page.locator('[data-view="'+period+'"]').click();
    await page.waitForFunction(p=>document.querySelector('[data-view="'+p+'"]')?.getAttribute('aria-current')==='page',period);
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    await page.screenshot({path:dir+'/sweep-'+viewport.width+'-dashboard-'+period+'.png',fullPage:true});
   }
   await open('gta-vi','GTA VI');
  }
  if(viewport.width<768){
   const menu=page.locator('#fvMenu'),sidebar=page.locator('#fvSidebar');
   assert.equal(await menu.locator('svg path').getAttribute('d'),'M4 7h16M4 12h16M4 17h16','standard hamburger');
   await menu.click();
   await page.waitForFunction(()=>getComputedStyle(document.querySelector('#fvSidebar')).opacity==='1');
   assert.equal(await menu.getAttribute('aria-expanded'),'true');
   const animation=await sidebar.evaluate(e=>({duration:getComputedStyle(e).transitionDuration,timing:getComputedStyle(e).transitionTimingFunction}));
   assert.ok(animation.duration.split(',').every(v=>parseFloat(v)<=.2),'short dropdown animation');
   await page.evaluate(()=>window.dispatchEvent(new Event('xtracker:data')));
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   assert.equal(await menu.getAttribute('aria-expanded'),'true','menu stays open during feed refresh');
   assert.equal(await sidebar.evaluate(e=>getComputedStyle(e).visibility),'visible');
   await page.locator('#fvNav a[href="#home"]').click();
   await page.waitForFunction(()=>document.querySelector('#fvTitle').textContent==='Dashboard');
   assert.equal(await menu.getAttribute('aria-expanded'),'false','menu closes on destination selection');
   await page.waitForFunction(()=>getComputedStyle(document.querySelector('#fvSidebar')).visibility==='hidden');
   assert.ok(await sidebar.evaluate(e=>!e.closest('#fvShell').classList.contains('is-nav-open')));
   await menu.click();await page.screenshot({path:dir+'/'+viewport.width+'-menu-open.png'});
   await menu.click();await page.waitForFunction(()=>getComputedStyle(document.querySelector('#fvSidebar')).visibility==='hidden');
   await menu.click();await page.keyboard.press('Escape');
   assert.equal(await menu.getAttribute('aria-label'),'Open menu');
   await page.waitForFunction(()=>getComputedStyle(document.querySelector('#fvSidebar')).visibility==='hidden');
   await page.emulateMedia({reducedMotion:'reduce'});
   await menu.click();
   assert.ok((await sidebar.evaluate(e=>getComputedStyle(e).transitionDuration)).split(',').every(v=>parseFloat(v)<=.001),'respect reduced motion');
   await menu.click();await page.emulateMedia({reducedMotion:'no-preference'});
   await open('gta-vi','GTA VI');
  }
  // Back is an explicit Dashboard destination, even after visiting a different page.
  await open('x-articles','X Articles');
  assert.equal(await page.locator('#fvTitleChip svg').count(),0,'no X title logo');
  await open('viral-qrts','Viral QRTs');
  assert.equal(await page.locator('#fvBack svg path').getAttribute('d'),'M19 12H5m6-6-6 6 6 6');
  await page.locator('#fvBack').click();
  await page.waitForFunction(()=>location.hash==='#home'&&document.querySelector('#fvTitle')?.textContent==='Dashboard');
  assert.equal(await page.locator('#fvBack').isVisible(),false,'Back hidden on Dashboard');
  await open('gta-vi','GTA VI');
  // The sidebar must never become a scroll container or shift during route changes.
  const sidebarState=()=>page.evaluate(()=>{
   const s=document.querySelector('#fvSidebar'),r=s.getBoundingClientRect(),c=getComputedStyle(s);
   return {x:r.x,y:r.y,width:r.width,position:c.position,overflow:c.overflowY,scroll:s.scrollTop,fits:s.scrollHeight<=s.clientHeight+1,main:document.querySelector('#mainContent').getBoundingClientRect().left};
  });
  const navBefore=await sidebarState();
  assert.equal(navBefore.position,'fixed');assert.equal(navBefore.overflow,'clip');assert.equal(navBefore.scroll,0);assert.ok(navBefore.fits,'all navigation links fit or paginate');
  await page.evaluate(()=>{window.__stableNav=document.querySelector('#fvNav a.fv-nav-item');window.dispatchEvent(new Event('xtracker:data'));});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal(await page.evaluate(()=>window.__stableNav===document.querySelector('#fvNav a.fv-nav-item')),true,'refresh must preserve navigation nodes');
  if(viewport.width>=768){
   assert.ok(navBefore.main>=navBefore.width-1,'content stays outside fixed sidebar');
   await page.evaluate(()=>{document.body.style.minHeight='2400px';window.scrollTo(0,600);});
   const afterScroll=await sidebarState();close([navBefore.x,navBefore.y],[afterScroll.x,afterScroll.y],'sidebar fixed while content scrolls');assert.equal(afterScroll.scroll,0);
   await page.evaluate(()=>{document.body.style.minHeight='';window.scrollTo(0,0);});
  }
  const geometry=()=>page.evaluate(()=>{
   const box=el=>{const r=el.getBoundingClientRect();return [r.x,r.y+scrollY,r.width,r.height].map(n=>Math.round(n*10)/10);};
   const q=s=>document.querySelector(s);
   const top='#fvPage > ';
   const chart=q(top+'.fv-chart-panel'),table=q(top+'.fv-table-panel'),strip=q(top+'.fv-strip');
   const contained=(el,outer)=>{const a=el.getBoundingClientRect(),b=outer.getBoundingClientRect();return a.left>=b.left-1&&a.top>=b.top-1&&a.right<=b.right+1&&a.bottom<=b.bottom+1;};
   const heads=[chart,table].every(panel=>{const header=panel.querySelector('.fv-panel-head'),title=header.querySelector('h2');return contained(header,panel)&&contained(title,header)&&title.getBoundingClientRect().left>=panel.getBoundingClientRect().left+(innerWidth<768&&panel.classList.contains('fv-table-panel')?0:10);});
   return {heads,title:box(q('#fvHeader .fv-title')).slice(0,2),header:box(q('#fvHeader')),strip:box(strip),card:box(strip.querySelector('.fv-metric')),chart:box(chart),plot:box(chart.querySelector('.fv-plot')),list:box(table).slice(0,3),toolbar:box(table.querySelector('.fv-table-tools')),cols:[...table.querySelectorAll('thead th')].map(e=>box(e)[2]),overflow:document.documentElement.scrollWidth>innerWidth+1,slots:chart.querySelectorAll('.fv-hit').length,bars:chart.querySelectorAll('[data-bar]').length,labels:chart.querySelectorAll('.fv-bar-value').length,cards:strip.querySelectorAll('.fv-metric').length};
  });
  const auditContrast=async(route)=>{
   const violations=await page.evaluate(()=>{
    const mobile=innerWidth<768,all=s=>[...document.querySelectorAll(s)],css=e=>getComputedStyle(e),rect=e=>e.getBoundingClientRect();
    const lum=color=>{const x=color.match(/[0-9.]+/g).slice(0,3).map(n=>{const v=Number(n)/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return x.reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);};
    const ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
    const cards=all('#fvPage>.fv-strip>.fv-metric,#fvPage>.fv-chart-panel,#fvPage>.fv-home-discord,#fvPage>.fv-support'+(mobile?',#fvPage .fv-table-panel tbody>tr.fv-row':',#fvPage>.fv-table-panel'));
    const nums=all('#fvPage :is(.fv-metric-value,.fv-tile-value,.fv-inline-metrics,.fv-detail-grid,.fv-original-context) .fv-num'+(mobile?',#fvPage .fv-table-panel tbody>tr.fv-row .fv-num':''));
    const bad=[];
    for(const e of cards){const s=css(e),width=parseFloat(s.borderTopWidth),key=e.classList.contains('fv-metric');if(key?(width!==3||ratio(s.borderTopColor,s.backgroundColor)<3):(width>0&&(!mobile&&e.classList.contains('fv-table-panel')?(width!==1||!['rgb(53, 53, 53)','rgb(64, 64, 64)'].includes(s.borderTopColor)):(width!==2||!['rgb(73, 73, 73)','rgb(90, 90, 90)'].includes(s.borderTopColor)))))bad.push({border:e.className,width,color:s.borderTopColor,bg:s.backgroundColor});}
    for(const e of nums){const s=css(e),p=rect(e.parentElement),r=rect(e);if(s.backgroundColor!=='rgba(0, 0, 0, 0)'||parseFloat(s.borderTopLeftRadius)!==0||e.scrollWidth>e.clientWidth+1||r.width>p.width+1)bad.push({number:e.textContent,bg:s.backgroundColor,radius:s.borderTopLeftRadius,width:e.clientWidth,scroll:e.scrollWidth,parent:p.width});}
    if(!mobile)for(const e of all('#fvPage .fv-table-panel tr.fv-row .fv-num'))if(css(e).backgroundColor!=='rgba(0, 0, 0, 0)')bad.push({desktopTablePill:e.textContent});
    return bad;
   });
   assert.equal(violations.length,0,route+' contrast / plain numeric text contract '+JSON.stringify(violations));
  };
  const auditPhone=async(route)=>{
   await auditContrast(route);
   if(viewport.width>=768)return;
   const result=await page.evaluate(()=>{
    const home=document.querySelector('#fvPage').classList.contains('fv-dashboard-layout');
    const q=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)],rect=e=>e.getBoundingClientRect(),style=e=>getComputedStyle(e);
    const white=e=>style(e).color==='rgb(255, 255, 255)',visible=e=>style(e).display!=='none'&&rect(e).width>0&&rect(e).height>0;
    const accent=e=>{const v=style(e).getPropertyValue('--fv-hover-outline').trim();return /^#[\da-f]{6}$/i.test(v)?'rgb('+[1,3,5].map(i=>parseInt(v.slice(i,i+2),16)).join(', ')+')':v;};
    const title=q('#fvTitle'),head=q('#fvHeader'),top=q('.fv-mobile-top'),body=q('#fvPage');
    const panels=all('#fvPage>.fv-panel:not(.fv-strip),#fvPage>.fv-strip>.fv-metric');
    const nums=all('#fvPage>.fv-strip .fv-metric-value .fv-num'),labels=all('#fvPage>.fv-strip .fv-metric-label');
    const cells=all('#fvPage .fv-table tbody>tr.fv-row>td[data-column]');
    const filters=all('#fvPage .fv-table-tools .fv-select select,#fvPage .fv-table-tools .fv-search,#fvPage .fv-mobile-sort select');
    const rows=all('#fvPage .fv-table tbody>tr.fv-row');
    const inside=(e,o)=>rect(e).left>=rect(o).left-1&&rect(e).right<=rect(o).right+1;
    return {
     titleGap:rect(title).top-rect(top).bottom,belowTitle:rect(q('.fv-head-tools')).top-rect(title).bottom,
     afterHeader:rect(body).top-rect(head).bottom,sideMargins:[rect(body).left,innerWidth-rect(body).right],
     borders:panels.every(e=>e.classList.contains('fv-table-panel')?parseFloat(style(e).borderTopWidth)===0:parseFloat(style(e).borderTopWidth)===(e.classList.contains('fv-metric')?3:2)&&parseFloat(style(e).borderTopLeftRadius)>=10),
     labelTheme:labels.every(e=>style(e.lastElementChild).color===accent(e)),valueWhite:nums.every(white),heavy:nums.every(e=>Number(style(e).fontWeight)>=850),
     numericSizes:nums.filter(e=>e.textContent.trim().length<=5).map(e=>parseFloat(style(e).fontSize)),
     tableNumbers:all('#fvPage .fv-table tbody>tr.fv-row .fv-num').every(e=>Number(style(e).fontWeight)>=850&&parseFloat(style(e).fontSize)>=(e.hasAttribute('data-num-length')?12:14)),
     rowBorders:rows.every(e=>parseFloat(style(e).borderTopWidth)===2&&parseFloat(style(e).borderTopLeftRadius)>=10&&inside(e,e.closest('.fv-table-panel'))),
     cellVisible:cells.every(e=>visible(e)&&inside(e,e.closest('tr'))),
     cellWhite:cells.every(e=>white(e)||e.classList.contains('is-highlighted-number')),
     labelsTheme:cells.filter(e=>!e.classList.contains('is-name')&&e.dataset.column!=='age').every(e=>getComputedStyle(e,'::before').color===(e.dataset.column==='campaign'?'rgb(255, 255, 255)':accent(e))),
     filtersVisible:filters.every(e=>visible(e)&&inside(e,e.closest('.fv-table-panel'))&&rect(e).height>=44),
     noOverflow:document.documentElement.scrollWidth<=innerWidth+1
    };
   });
   assert.ok(result.titleGap>=0&&result.titleGap<=50,route+' compact title spacing '+JSON.stringify(result));
   assert.ok(result.belowTitle>=10&&Math.abs(result.afterHeader-32)<=1,route+' space below title and header');
   assert.ok(Math.abs(result.sideMargins[0]-result.sideMargins[1])<=2,route+' balanced page margins');
   assert.ok(result.borders&&result.labelTheme&&result.valueWhite&&result.heavy,route+' bold white metrics and stronger borders '+JSON.stringify(result));
   assert.ok(result.numericSizes.every(n=>n>=(viewport.width>=360?28:24)),route+' large short KPI figures '+result.numericSizes);
   assert.ok(result.tableNumbers&&result.rowBorders&&result.cellVisible&&result.cellWhite&&result.labelsTheme&&result.filtersVisible&&result.noOverflow,route+' readable full-width listings '+JSON.stringify(result));
   const hierarchy=await page.evaluate(()=>{
    const nodes=[...document.querySelectorAll('#fvPage .fv-table tbody>tr.fv-row td[data-column]:not(.is-name):not([data-column="age"])')];
    return nodes.filter(e=>{const s=getComputedStyle(e),l=getComputedStyle(e,'::before'),v=e.querySelector('.fv-num');return s.boxShadow!=='none'||parseFloat(s.borderBottomWidth)!==0||(v&&!(Number(l.fontWeight)<Number(getComputedStyle(v).fontWeight)&&(v.hasAttribute('data-num-length')?parseFloat(l.fontSize)<=parseFloat(getComputedStyle(v).fontSize):parseFloat(l.fontSize)<parseFloat(getComputedStyle(v).fontSize))));}).map(e=>({column:e.dataset.column,shadow:getComputedStyle(e).boxShadow,border:getComputedStyle(e).borderBottomWidth,label:getComputedStyle(e,'::before').fontWeight,value:e.querySelector('.fv-num')?getComputedStyle(e.querySelector('.fv-num')).fontWeight:null}));
   });
   assert.equal(hierarchy.length,0,route+' quiet labels and single-layer cards '+JSON.stringify(hierarchy));
  };
  const kpiStyle=()=>page.evaluate(()=>{const card=document.querySelector('#fvPage>.fv-strip>.fv-metric'),label=card.querySelector('.fv-metric-label'),tag=label.lastElementChild,value=card.querySelector('.fv-metric-value'),style=e=>getComputedStyle(e),rect=e=>e.getBoundingClientRect();return {height:rect(card).height,radius:style(card).borderTopLeftRadius,padding:style(card).padding,align:style(card).alignItems,justify:style(card).justifyContent,labelFont:style(label).fontSize,labelAlign:style(label).justifyContent,tagPadding:style(tag).padding,tagRadius:style(tag).borderTopLeftRadius,tagBackground:style(tag).backgroundColor,valueAlign:style(value).justifyContent,valueTextAlign:style(value).textAlign,valueWeight:style(value).fontWeight};});
   let reference,cols,kpiReference;
  for(const [route,title] of routes){
   await open(route,title);await page.screenshot({path:dir+'/'+viewport.width+'-'+route.replaceAll('/','-')+'.png',fullPage:true});const g=await geometry();
   const visual=await page.evaluate(()=>{const panel=document.querySelector('#fvPage>.fv-table-panel'),rows=[...panel.querySelectorAll('tbody>tr.fv-row')],bounds=panel.getBoundingClientRect();return {yellow:panel.querySelectorAll('th.is-user-sorted,td.is-highlighted-number,[data-user-sort]').length,clipped:rows.some(row=>{const r=row.getBoundingClientRect();return r.left<bounds.left-1||r.right>bounds.right+1||[...row.children].some(cell=>{const b=cell.getBoundingClientRect();return getComputedStyle(cell).display!=='none'&&(b.right>r.right+1||b.left<r.left-1);});})};});
   assert.equal(visual.yellow,0,route+' default sort must be neutral');
   if(route==='viral-qrts'){
    assert.equal(await page.locator('#fvPage h2').filter({hasText:/^Viral Posts$/}).count(),0,'Viral Posts summary removed');
    const expand=page.locator('#viral-results [data-expand]').first();
    await expand.click();
    assert.match(await page.locator('#viral-results .fv-detail-inner').innerText(),/Quoted post views/,'quoted original context remains in the expanded record');
    assert.match(await page.locator('#viral-results .fv-detail-inner').innerText(),/1,000,000|1M/);
    await page.locator('#viral-results [data-expand]').first().click();
    await page.mouse.move(0,0);
    await page.evaluate(()=>window.scrollTo(0,0));
   }
   if(viewport.width>=768)assert.ok(await page.locator('#fvPage>.fv-table-panel tbody>tr.fv-row').evaluateAll(rows=>rows.every(r=>r.getBoundingClientRect().height<=40)),'compact desktop campaign rows');
   assert.equal(await page.locator('#fvPage .fv-list-headline').count(),0,'no captions in listings');
   if(viewport.width<768)assert.equal(visual.clipped,false,route+' mobile rows must fit');
   const inset=await page.evaluate(()=>[...document.querySelectorAll('#fvPage>.fv-chart-panel>.fv-panel-head select[data-chart-measure],#fvPage>.fv-panel>.fv-panel-head .fv-control')].filter(e=>e.getBoundingClientRect().width>0).every(e=>{const a=e.getBoundingClientRect(),b=e.closest('.fv-panel-head').getBoundingClientRect(),p=e.closest('.fv-panel').getBoundingClientRect();return a.top-b.top>=6&&b.bottom-a.bottom>=6&&a.left-p.left>=8&&p.right-a.right>=8;}));
   assert.ok(inset,route+' nested controls have breathing room');
   const finish=await page.evaluate(()=>{const card=document.querySelector('#fvPage>.fv-strip>.fv-metric'),label=card.querySelector('.fv-metric-label'),value=card.querySelector('.fv-metric-value'),s=getComputedStyle(card),v=getComputedStyle(value),rect=card.getBoundingClientRect(),a=label.getBoundingClientRect(),z=value.getBoundingClientRect();return {background:s.backgroundColor,gradient:s.backgroundImage,radius:parseFloat(s.borderTopLeftRadius),weight:Number(v.fontWeight),center:Math.abs((a.top+z.bottom)/2-(rect.top+rect.bottom)/2),aligned:s.alignItems,justify:s.justifyContent};});
   if(viewport.width<768){
    assert.ok(["rgb(53, 23, 37)","rgb(38, 27, 61)","rgb(51, 35, 15)","rgb(34, 37, 42)","rgb(25, 43, 67)","rgb(33, 26, 61)","rgb(32, 40, 52)","rgb(18, 49, 58)","rgb(21, 52, 46)","rgb(24, 51, 34)"].includes(finish.background),route+' campaign-tinted KPI card '+JSON.stringify(finish));
    assert.equal(finish.radius,14);assert.ok(['flex-start','start','flow-start'].includes(finish.aligned),'left aligned card '+JSON.stringify(finish));assert.equal(finish.justify,'space-between');assert.ok(finish.weight>=850);
   }else{assert.ok(["rgb(53, 23, 37)","rgb(38, 27, 61)","rgb(51, 35, 15)","rgb(34, 37, 42)","rgb(25, 43, 67)","rgb(33, 26, 61)","rgb(32, 40, 52)","rgb(18, 49, 58)","rgb(21, 52, 46)","rgb(24, 51, 34)"].includes(finish.background),route+' campaign-tinted card');assert.equal(finish.gradient,'none');assert.equal(finish.radius,12);assert.ok(finish.weight>=850);const surfaces=await page.evaluate(()=>[...document.querySelectorAll('#fvPage>.fv-chart-panel,#fvPage>.fv-chart-panel>.fv-chart,#fvPage>.fv-table-panel,#fvPage>.fv-table-panel>.fv-table-tools,#fvPage .fv-table th,#fvPage .fv-table tbody tr.fv-row td')].every(e=>['rgb(0, 0, 0)','rgba(0, 0, 0, 0)'].includes(getComputedStyle(e).backgroundColor)));assert.equal(surfaces,true,route+' black surfaces');assert.ok(['flex-start','start','flow-start'].includes(finish.aligned),route+' left aligned card');assert.equal(finish.justify,'space-between');}
   assert.equal(g.heads,true,route+' headings must stay inside panels');assert.equal(g.cards,4,route+' four cards');assert.equal(g.slots,7,route+' seven dates');assert.ok(g.bars<=7);assert.equal(g.labels,0);assert.equal(g.overflow,false,route+' document overflow');
   const signature=await kpiStyle();if(!kpiReference)kpiReference=signature;else assert.deepEqual(signature,kpiReference,route+' shared KPI styling');
    if(!reference)reference=g;
   for(const k of ['title','header','strip','card','chart','plot','list','toolbar'])close(k==='toolbar'&&viewport.width<768?g[k].slice(0,3):g[k],k==='toolbar'&&viewport.width<768?reference[k].slice(0,3):reference[k],viewport.width+' '+route+' '+k);
   if(route!=='discord'&&viewport.width>=768){if(!cols)cols=g.cols;close(g.cols,cols,route+' column widths');}
   await auditPhone(route);
   await page.screenshot({path:dir+'/'+viewport.width+'-'+route.replaceAll('/','-')+'.png',fullPage:true});
  }
  await open('gta-vi','GTA VI');
  const before=await geometry();
  await page.evaluate(()=>{window.__qaChart=document.querySelector('#fvPage .fv-chart');window.__qaCard=document.querySelector('#fvPage .fv-metric');});
  if(viewport.width>=768)await page.locator('#gta-overview [data-sort="views"]').click();
  else await page.locator('#gta-overview [data-mobile-sort]').selectOption('views:-1');
  const after=await geometry();
  const highlight=await page.evaluate(()=>{
    const table=document.querySelector('#gta-overview'),cells=[...table.querySelectorAll('tbody>tr.fv-row td[data-column="views"] .fv-num')];
    const yellow=el=>getComputedStyle(el).color==='rgb(199, 181, 255)';
    return {numeric:cells.length,selected:cells.every(yellow),others:[...table.querySelectorAll('tbody>tr.fv-row td:not([data-column="views"]) .fv-num')].some(yellow),missing:[...table.querySelectorAll('tbody>tr.fv-row td.is-highlighted-number .fv-dash')].length,
      wrongColumn:table.querySelectorAll('td.is-highlighted-number:not([data-column="views"])').length,
      dividers:[...table.querySelectorAll('tbody>tr.fv-row td:not(:last-child)')].every(td=>getComputedStyle(td).borderRightWidth==='1px'&&getComputedStyle(td).borderRightColor==='rgb(37, 37, 37)')};
  });
  assert.ok(highlight.numeric>0&&highlight.selected&&!highlight.others&&!highlight.missing&&!highlight.wrongColumn,'only explicitly selected numeric values use the campaign colour');
  if(viewport.width>=768)assert.ok(highlight.dividers,'subtle vertical cell dividers');
  assert.equal(await page.locator(viewport.width>=768?'#gta-overview th.is-user-sorted':'#gta-overview [data-user-sort]').count(),1,'only explicit sort indicated');
  for(const k of ['strip','chart','plot','list','toolbar','cols'])close(after[k],before[k],viewport.width+' sort '+k);
  assert.equal(await page.evaluate(()=>window.__qaChart===document.querySelector('#fvPage .fv-chart')&&window.__qaCard===document.querySelector('#fvPage .fv-metric')),true,'sort preserves chart and cards');
  const type=page.locator('#gta-overview [data-xfilter="type"]');
  if(await type.count()){await type.selectOption('QRT');const filtered=await geometry();for(const k of ['strip','chart','plot','list','toolbar','cols'])close(filtered[k],before[k],viewport.width+' filter '+k);}
  await page.evaluate(()=>location.hash='all-accounts');
  await page.waitForFunction(()=>document.querySelector('#acc-table .fv-account-plain'));
  assert.equal(await page.locator('#acc-table .fv-account-tag,#acc-table .fv-value-badge,#acc-table .is-best-value').count(),0);
  const accountBounds=await page.evaluate(()=>{const panel=document.querySelector('#acc-table'),head=panel.querySelector('.fv-panel-head'),title=head.querySelector('h2'),a=panel.getBoundingClientRect(),b=head.getBoundingClientRect(),c=title.getBoundingClientRect();return {contained:b.left>=a.left-1&&b.top>=a.top-1&&b.right<=a.right+1&&c.left>=a.left+(innerWidth<768?0:10)&&c.top>=b.top-1&&c.bottom<=b.bottom+1,title:[document.querySelector('#fvHeader .fv-title').getBoundingClientRect().x,document.querySelector('#fvHeader .fv-title').getBoundingClientRect().y+scrollY],header:[...['x','y','width','height'].map(k=>document.querySelector('#fvHeader').getBoundingClientRect()[k])]};});
  assert.ok(accountBounds.contained,'Accounts heading must stay inside its panel');
  assert.ok(await page.locator('#acc-table .fv-account-mark').count()>0,'account initials are present');
  assert.equal(await page.locator('#acc-table .fv-account-tag,#acc-table .fv-value-badge').count(),0,'no account tags');
  if(viewport.width<768){
   const cards=await page.evaluate(()=>[...document.querySelectorAll('#acc-table tbody>tr.fv-row')].map(r=>({width:r.getBoundingClientRect().width,clipped:[...r.querySelectorAll('td[data-column]')].some(c=>getComputedStyle(c).display==='none'||c.getBoundingClientRect().right>r.getBoundingClientRect().right+1)})));
   assert.ok(cards.every(r=>r.width<=viewport.width-20&&!r.clipped),'mobile Accounts fits its panel');
  }
  close(accountBounds.title,reference.title,viewport.width+' Accounts title');
  await auditPhone('Accounts');
  const accountHeader=await page.locator('#acc-table thead').innerText().catch(()=> '');
  if(viewport.width>=768)assert.match(accountHeader,/Last Post/);
  await page.locator('#acc-table [data-search]').fill('unused');assert.equal(await page.locator('#acc-table .fv-account-plain').innerText(),'@unused');
  assert.equal(await page.locator('#acc-table .fv-filter,#acc-table [data-xfilter],#acc-table [data-filter]').count(),0,'no separate Accounts filters');
  await page.locator('#acc-table [data-search]').fill('');
  assert.equal(await page.locator('#acc-table th.is-user-sorted,#acc-table td.is-highlighted-number,#acc-table th[aria-sort="ascending"],#acc-table th[aria-sort="descending"]').count(),0,'neutral default Accounts order');
  if(viewport.width>=768)await page.locator('#acc-table [data-sort="clicks"]').click();
  else await page.locator('#acc-table [data-mobile-sort]').selectOption('clicks:-1');
  const accountSort=await page.evaluate(()=>{
   const t=document.querySelector('#acc-table'),cells=[...t.querySelectorAll('td.is-highlighted-number')],selected=getComputedStyle(t).getPropertyValue('--fv-selection').trim();
   const rgb='rgb('+[1,3,5].map(i=>parseInt(selected.slice(i,i+2),16)).join(', ')+')';
   return cells.length>0&&cells.every(e=>e.dataset.column==='clicks'&&e.querySelector('.fv-num')&&getComputedStyle(e.querySelector('.fv-num')).color===rgb);
  });
  assert.ok(accountSort,'Accounts uses shared explicit metric sort colour');
  await page.screenshot({path:dir+'/'+viewport.width+'-accounts.png',fullPage:true});
  const usedRow=page.locator('#acc-table .fv-row').filter({hasText:'@qa'}).first();
  if(await usedRow.count()){
   await usedRow.locator('[data-expand]').click();
   assert.ok(await page.locator('#acc-table .fv-account-history-row').count()>0,'account details contain actual placement history');
   assert.equal(await page.locator('#acc-table .fv-detail-grid,#acc-table .fv-publisher-costs').count(),0,'no duplicate detail cards');
   await usedRow.locator('[data-expand]').click();
  }
  await open('home','Dashboard');
  assert.deepEqual(await page.locator('#fvPage>.fv-subnav [data-view]').evaluateAll(buttons=>buttons.map(b=>b.dataset.view)),['this-week','last-week','all-time'],'period order');
  assert.equal(await page.locator('#fvPage>.fv-subnav [aria-current="page"]').getAttribute('data-view'),'this-week','Dashboard defaults to This Week');
  let homeReference;
  for(const period of ['this-week','last-week','all-time','this-week','all-time']){
   await page.locator('[data-view="'+period+'"]').click();
   await page.waitForFunction(period=>location.hash===(period==='this-week'?'#home':'#home/'+period),period);
   await page.waitForFunction(period=>{const C=window.FanvueCore,m=window.FanvueUI.getMeasure('home-chart','clicks'),week=C.weekStart(C.londonDay(Date.now()));return document.querySelector('[data-view="'+period+'"]')?.getAttribute('aria-current')==='page'&&m&&m.weekFrom===(period==='all-time'?undefined:period==='this-week'?week:C.addDays(week,-7));},period);
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   await page.screenshot({path:dir+'/'+viewport.width+'-dashboard-'+period+'.png',fullPage:true});const g=await geometry();assert.equal(g.heads,true,'Dashboard headings are contained');assert.equal(g.cards,4);assert.equal(g.slots,7);assert.ok(g.bars<=7);assert.equal(g.labels,0);assert.equal(g.overflow,false);
   for(const k of ['title','header'])close(g[k],reference[k],viewport.width+' dashboard '+period+' '+k);
   assert.deepEqual(await kpiStyle(),kpiReference,'Dashboard and campaign headline card styling match');
    // Dashboard retains the common page alignment, but restores its compact card and chart sizes.
   for(const k of ['strip','chart','list','toolbar'])close([g[k][0],g[k][2]],[reference[k][0],reference[k][2]],viewport.width+' Dashboard '+k+' width');
   if(viewport.width<768){assert.equal(g.card[3],92);assert.equal(g.chart[3],216);}else{assert.equal(g.card[3],104);assert.equal(g.chart[3],310);}
   await auditPhone('Dashboard '+period);
   if(!homeReference)homeReference=g;else for(const k of ['strip','chart','plot','list','toolbar','cols'])close(g[k],homeReference[k],viewport.width+' dashboard period '+period+' '+k);
   assert.equal(await page.locator('#home-comparison .fv-row').count(),5);
   if(viewport.width>=768)assert.equal(await page.locator('#home-comparison th[data-column="name"] button').evaluate(e=>getComputedStyle(e).color),'rgb(255, 255, 255)','Campaign header stays white');
   assert.equal(await page.locator('.fv-home-discord .fv-home-community-strip>.fv-metric').count(),3);
   const expectedDiscordLabel=period==='last-week'?'Last Week':period==='all-time'?'All Time':'This Week';
   assert.ok((await page.locator('.fv-discord-scope').innerText()).startsWith(expectedDiscordLabel));
   assert.equal(await page.locator('.fv-home-discord-link').getAttribute('href'),'#discord/'+period);
   assert.ok((await page.locator('.fv-home-community-strip').innerText()).includes('Net Growth'));
   const flat=await page.evaluate(()=>{
    const p=document.querySelector('.fv-home-discord'),strip=p.querySelector('.fv-home-community-strip'),cards=[...strip.children],s=e=>getComputedStyle(e);
    const markers=[...document.querySelectorAll('#home-comparison .fv-campaign-row-name')].map(e=>getComputedStyle(e,'::before').backgroundColor);
    return {outer:s(p).borderTopWidth==='2px'&&s(p).boxShadow==='none',inner:s(strip).borderTopWidth==='0px'&&cards.every(e=>s(e).borderTopWidth==='0px'&&s(e).borderRightWidth==='0px'&&s(e).boxShadow==='none'),markers:markers.length===5&&new Set(markers).size===5};
   });
   assert.ok(flat.outer&&flat.inner&&flat.markers,'single Discord frame and distinct campaign markers '+JSON.stringify(flat));
   const homeVisual=await page.evaluate(()=>{
    const q=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)],rect=e=>e.getBoundingClientRect(),css=e=>getComputedStyle(e);
    const nav=q('#fvPage>.fv-subnav'),active=nav.querySelector('[aria-current="page"]'),summary=q('.fv-home-community-strip'),cards=[...summary.children],main=q('#fvPage>.fv-strip>.fv-metric');
    const row=q('#home-comparison .fv-row'),metrics=[...row.querySelectorAll('td[data-column]:not(.is-name)')];
    return {singleRow:!q('#fvPage>.fv-executive-controls')&&all('#fvPage>.fv-subnav button').every(e=>Math.abs(rect(e).top-rect(active).top)<1),active:css(active).backgroundColor==='rgb(199, 22, 103)',tabFit:nav.scrollWidth<=nav.clientWidth+1,scope:q('#home-chart-t')?.parentElement.querySelector('.fv-chart-scope')?.textContent,restored:['rgb(55, 24, 40)','rgb(53, 23, 37)'].includes(css(main).backgroundColor)&&parseFloat(css(main).borderTopLeftRadius)===(innerWidth<768?14:12)&&['flex-start','start','flow-start'].includes(css(main).alignItems)&&parseFloat(css(main).borderLeftWidth)===3,restoredDetails:{bg:css(main).backgroundColor,radius:css(main).borderTopLeftRadius,align:css(main).alignItems,left:css(main).borderLeftWidth},compactCommunity:cards.every(e=>rect(e).height<=100)&&cards.every(e=>Math.abs(rect(e).top-rect(cards[0]).top)<1),compactRows:all('#home-comparison tbody>tr.fv-row').every(e=>rect(e).height<=160),rowHeights:all('#home-comparison tbody>tr.fv-row').map(e=>rect(e).height),grid:css(row).gridTemplateColumns,metricPairs:metrics.length===4&&Math.abs(rect(metrics[0]).top-rect(metrics[1]).top)<1&&Math.abs(rect(metrics[2]).top-rect(metrics[3]).top)<1&&rect(metrics[2]).top>rect(metrics[0]).top,
     summaryFits:cards.every(e=>rect(e).right<=rect(summary).right+1&&rect(e).left>=rect(summary).left-1)};
   });
   assert.ok(homeVisual.singleRow&&homeVisual.active&&homeVisual.tabFit, 'Home period row matches campaign layout '+JSON.stringify(homeVisual));
   assert.equal(homeVisual.scope,period==='last-week'?'Last Week':'This Week','visible chart scope');
   assert.ok(homeVisual.restored&&homeVisual.compactCommunity&&homeVisual.summaryFits,'Restored rounded rose KPI cards and compact Discord strip '+JSON.stringify(homeVisual));
   if(viewport.width<768)assert.ok(homeVisual.compactRows,'Dashboard campaign rows are compact '+JSON.stringify(homeVisual.rowHeights));
   if(viewport.width<768)assert.ok(homeVisual.metricPairs,'Home campaign values occupy a balanced 2x2 grid');
   await page.screenshot({path:dir+'/'+viewport.width+'-dashboard-'+period+'.png',fullPage:true});
   if(viewport.width<768){
    const realistic=await page.evaluate(()=>{
     const row=document.querySelector('#home-comparison tbody>tr.fv-row'),saved=[];
     for(const [key,value] of [['clicks','787'],['views','1,612,090'],['spend','$6,110.85'],['cpc','$3.19']]){
      const td=row.querySelector('[data-column="'+key+'"]');const old=td.innerHTML;saved.push([td,old]);td.innerHTML='<span class="fv-num">'+value+'</span>';
     }
     const fit=saved.every(([td])=>{const span=td.firstElementChild,s=getComputedStyle(span),box=span.getBoundingClientRect(),pad=parseFloat(s.paddingTop)+parseFloat(s.paddingBottom)+parseFloat(s.borderTopWidth)+parseFloat(s.borderBottomWidth);return box.width<=td.getBoundingClientRect().width+1&&box.height-pad<=parseFloat(s.lineHeight)+1&&span.scrollWidth<=span.clientWidth+1;});
     for(const [td,old] of saved)td.innerHTML=old;return fit;
    });
    assert.ok(realistic,'live-sized campaign values fit on a single line');
   }
  }
  await page.evaluate(()=>{window.__qaChart=document.querySelector('#home-chart');window.__qaCard=document.querySelector('#fvPage .fv-metric');});
  if(viewport.width>=768)await page.locator('#home-comparison [data-sort="spend"]').click();
  else await page.locator('#home-comparison [data-mobile-sort]').selectOption('spend:-1');
  const sorted=await geometry();for(const k of ['strip','chart','plot','list','toolbar','cols'])close(sorted[k],homeReference[k],viewport.width+' Dashboard sort '+k);
  assert.equal(await page.evaluate(()=>window.__qaChart===document.querySelector('#home-chart')&&window.__qaCard===document.querySelector('#fvPage .fv-metric')),true);
  await page.locator('#home-comparison [data-search]').fill('GTA');
  assert.equal(await page.locator('#home-comparison .fv-row').count(),1);
  const filteredHome=await geometry();for(const k of ['strip','chart','plot','list','toolbar','cols'])close(filteredHome[k],homeReference[k],viewport.width+' Dashboard search '+k);
  await page.locator('#home-comparison [data-search]').fill('');
  if(viewport.width>=768){
   const cell=page.locator('#home-comparison tbody tr.fv-row td[data-column="spend"]').first();
   await cell.hover();
   const hover=await page.evaluate(()=>{
    const cells=[...document.querySelectorAll('#home-comparison tbody tr.fv-row td[data-column="spend"]')];
    const others=[...document.querySelectorAll('#home-comparison tbody tr.fv-row td[data-column="views"]')];
    return {column:cells.every(e=>getComputedStyle(e).backgroundColor===(e.matches(':hover')?'rgb(33, 18, 25)':'rgb(8, 6, 8)')),
     other:others.every(e=>getComputedStyle(e).backgroundColor==='rgb(0, 0, 0)'),
     yellow:cells.filter(e=>e.classList.contains('is-highlighted-number')).every(e=>getComputedStyle(e.querySelector('.fv-num')||e).color==='rgb(255, 154, 200)')};
   });
   assert.ok(hover.column&&hover.other&&hover.yellow,'hover highlights only the column and preserves sorted text '+JSON.stringify(hover));
   await page.mouse.move(0,0);
   assert.equal(await cell.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(0, 0, 0)','column highlight clears on mouse exit');
   const nameCell=page.locator('#home-comparison tbody tr.fv-row td.is-name').first();
   await nameCell.hover();
   assert.ok(await nameCell.evaluate(e=>[...e.closest('tr').cells].filter(x=>x!==e).every(x=>getComputedStyle(x).backgroundColor==='rgb(8, 6, 8)')),'campaign name highlights its row subtly');
   await page.mouse.move(0,0);
   await page.evaluate(()=>location.hash='all-accounts');
   const accountCell=page.locator('#acc-table tbody tr.fv-row td[data-column="clicks"]').first();
   await accountCell.hover();
   assert.ok(await accountCell.evaluate(e=>{const t=e.closest('table'),col=[...t.querySelectorAll('tbody>tr.fv-row td[data-column="clicks"]')],other=[...t.querySelectorAll('tbody>tr.fv-row td[data-column="views"]')];return col.every(x=>getComputedStyle(x).backgroundColor===(x===e?'rgb(25, 31, 39)':'rgb(7, 8, 9)'))&&other.every(x=>getComputedStyle(x).backgroundColor==='rgb(0, 0, 0)');}),'Accounts metric hover matches shared column rule');
   await page.mouse.move(0,0);
   for(const route of ['discord']){
    await page.evaluate(r=>{location.hash=r},route);
    const panel=route==='discord'?'#discord-table':'#acc-table';
    const recordCell=page.locator(panel+' tbody tr.fv-row td:not(.is-left):not(.fv-x-col)').first();
    await recordCell.hover();
    const rowHover=await recordCell.evaluate(e=>{
     const table=e.closest('table'),row=e.closest('tr'),bg=x=>getComputedStyle(x).backgroundColor;
     const discord=!!e.closest('#discord-table');return bg(e)===(discord?'rgb(25, 24, 46)':'rgb(25, 31, 39)')&&[...row.cells].filter(x=>x!==e).every(x=>bg(x)===(discord?'rgb(6, 6, 9)':'rgb(7, 8, 9)'))&&[...table.querySelectorAll('tbody tr.fv-row')].filter(r=>r!==row).every(r=>[...r.cells].every(x=>bg(x)==='rgb(0, 0, 0)'));
    });
    assert.ok(rowHover,route+' record-oriented row hover');
    await page.mouse.move(0,0);
   }
  }
  assert.deepEqual(errors,[],'browser errors at '+viewport.width);
  console.log('PASS '+viewport.width+'px: '+routes.length+' campaign/community views, Accounts, Dashboard, sorting, filters, seven-day charts');
  await page.close();
 }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
