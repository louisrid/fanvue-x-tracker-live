// Browser-level regression checks with synthetic data only; no live campaign data or secrets.
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFileSync,mkdirSync,existsSync} from 'node:fs';
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
const template=readFileSync(path.join(publicDir,'index.html'),'utf8').replace(/<script src="[^"]+" defer><\/script>/g,match=>/\/fanvue-(core|ui|app|campaigns)\.js/.test(match)?match:'').replace('</head>','<script>'+fixture+'</script></head>');
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
function close(a,b,label){for(let i=0;i<a.length;i++)assert.ok(Math.abs(a[i]-b[i])<=1.1,label+': '+a+' vs '+b);}
try{
 for(const viewport of [{width:1440,height:900},{width:1024,height:768},{width:430,height:932},{width:390,height:844},{width:320,height:740}]){
  const page=await browser.newPage({viewport,deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
  await page.goto(base+'/#gta-vi');await page.waitForFunction(()=>window.FanvueCampaigns?.state?.loaded);
  const open=async(route,title)=>{
   await page.evaluate(route=>{location.hash=route;},route);
   await page.waitForFunction(({route,title})=>location.hash.slice(1)===route&&document.getElementById('fvTitle')?.textContent===title&&document.querySelector('#fvPage .fv-chart .fv-hit'),{route,title});
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  };
  const geometry=()=>page.evaluate(()=>{
   const box=el=>{const r=el.getBoundingClientRect();return [r.x,r.y+scrollY,r.width,r.height].map(n=>Math.round(n*10)/10);};
   const q=s=>document.querySelector(s);
   const top='#fvPage > ';
   const chart=q(top+'.fv-chart-panel'),table=q(top+'.fv-table-panel'),strip=q(top+'.fv-strip');
   const contained=(el,outer)=>{const a=el.getBoundingClientRect(),b=outer.getBoundingClientRect();return a.left>=b.left-1&&a.top>=b.top-1&&a.right<=b.right+1&&a.bottom<=b.bottom+1;};
   const heads=[chart,table].every(panel=>{const header=panel.querySelector('.fv-panel-head'),title=header.querySelector('h2');return contained(header,panel)&&contained(title,header)&&title.getBoundingClientRect().left>=panel.getBoundingClientRect().left+10;});
   return {heads,title:box(q('#fvTitle')).slice(0,2),header:box(q('#fvHeader')),strip:box(strip),card:box(strip.querySelector('.fv-metric')),chart:box(chart),plot:box(chart.querySelector('.fv-plot')),list:box(table).slice(0,3),toolbar:box(table.querySelector('.fv-table-tools')),cols:[...table.querySelectorAll('thead th')].map(e=>box(e)[2]),overflow:document.documentElement.scrollWidth>innerWidth+1,slots:chart.querySelectorAll('.fv-hit').length,bars:chart.querySelectorAll('[data-bar]').length,labels:chart.querySelectorAll('.fv-bar-value').length,cards:strip.querySelectorAll('.fv-metric').length};
  });
  let reference,cols;
  for(const [route,title] of routes){
   await open(route,title);const g=await geometry();
   const visual=await page.evaluate(()=>{const panel=document.querySelector('#fvPage>.fv-table-panel'),rows=[...panel.querySelectorAll('tbody>tr.fv-row')],bounds=panel.getBoundingClientRect();return {yellow:panel.querySelectorAll('th.is-user-sorted,td.is-sorted,[data-user-sort]').length,clipped:rows.some(row=>{const r=row.getBoundingClientRect();return r.left<bounds.left-1||r.right>bounds.right+1||[...row.children].some(cell=>{const b=cell.getBoundingClientRect();return getComputedStyle(cell).display!=='none'&&(b.right>r.right+1||b.left<r.left-1);});})};});
   assert.equal(visual.yellow,0,route+' default sort must be neutral');
   assert.equal(await page.locator('#fvPage .fv-list-headline').count(),0,'no captions in listings');
   if(viewport.width<768)assert.equal(visual.clipped,false,route+' mobile rows must fit');
   const finish=await page.evaluate(()=>{const card=document.querySelector('#fvPage>.fv-strip>.fv-metric'),label=card.querySelector('.fv-metric-label'),value=card.querySelector('.fv-metric-value'),s=getComputedStyle(card),v=getComputedStyle(value),rect=card.getBoundingClientRect(),a=label.getBoundingClientRect(),z=value.getBoundingClientRect();return {background:s.backgroundColor,gradient:s.backgroundImage,radius:parseFloat(s.borderTopLeftRadius),weight:Number(v.fontWeight),center:Math.abs((a.top+z.bottom)/2-(rect.top+rect.bottom)/2),aligned:s.alignItems,justify:s.justifyContent};});
   assert.equal(finish.background,'rgb(8, 8, 8)',route+' neutral card');assert.equal(finish.gradient,'none');assert.ok(finish.radius<=4);assert.ok(finish.weight<=700);assert.equal(finish.aligned,'center');assert.equal(finish.justify,'center');assert.ok(finish.center<=5,route+' centred card contents');
   assert.equal(g.heads,true,route+' headings must stay inside panels');assert.equal(g.cards,4,route+' four cards');assert.equal(g.slots,7,route+' seven dates');assert.ok(g.bars<=7);assert.equal(g.labels,0);assert.equal(g.overflow,false,route+' document overflow');
   if(!reference)reference=g;
   for(const k of ['title','header','strip','card','chart','plot','list','toolbar'])close(g[k],reference[k],viewport.width+' '+route+' '+k);
   if(route!=='discord'&&viewport.width>=768){if(!cols)cols=g.cols;close(g.cols,cols,route+' column widths');}
   if(['of-terms','x-articles','discord'].includes(route))await page.screenshot({path:dir+'/'+viewport.width+'-'+route+'.png'});
  }
  await open('gta-vi','GTA VI');
  const before=await geometry();
  await page.evaluate(()=>{window.__qaChart=document.querySelector('#fvPage .fv-chart');window.__qaCard=document.querySelector('#fvPage .fv-metric');});
  if(viewport.width>=768)await page.locator('#gta-overview [data-sort="views"]').click();
  else await page.locator('#gta-overview [data-mobile-sort]').selectOption('views:-1');
  const after=await geometry();
  assert.equal(await page.locator('#gta-overview td.is-sorted').count(),0,'sorting never colours data cells');
  assert.equal(await page.locator(viewport.width>=768?'#gta-overview th.is-user-sorted':'#gta-overview [data-user-sort]').count(),1,'only explicit sort indicated');
  for(const k of ['strip','chart','plot','list','toolbar','cols'])close(after[k],before[k],viewport.width+' sort '+k);
  assert.equal(await page.evaluate(()=>window.__qaChart===document.querySelector('#fvPage .fv-chart')&&window.__qaCard===document.querySelector('#fvPage .fv-metric')),true,'sort preserves chart and cards');
  const type=page.locator('#gta-overview [data-xfilter="type"]');
  if(await type.count()){await type.selectOption('QRT');const filtered=await geometry();for(const k of ['strip','chart','plot','list','toolbar','cols'])close(filtered[k],before[k],viewport.width+' filter '+k);}
  await page.evaluate(()=>location.hash='all-accounts');
  await page.waitForFunction(()=>document.querySelector('#acc-table .fv-account-plain'));
  assert.equal(await page.locator('#acc-table .fv-account-tag,#acc-table .fv-value-badge,#acc-table .is-best-value').count(),0);
  const accountBounds=await page.evaluate(()=>{const panel=document.querySelector('#acc-table'),head=panel.querySelector('.fv-panel-head'),title=head.querySelector('h2'),a=panel.getBoundingClientRect(),b=head.getBoundingClientRect(),c=title.getBoundingClientRect();return {contained:b.left>=a.left-1&&b.top>=a.top-1&&b.right<=a.right+1&&c.left>=a.left+10&&c.top>=b.top-1&&c.bottom<=b.bottom+1,title:[document.querySelector('#fvTitle').getBoundingClientRect().x,document.querySelector('#fvTitle').getBoundingClientRect().y+scrollY],header:[...['x','y','width','height'].map(k=>document.querySelector('#fvHeader').getBoundingClientRect()[k])]};});
  assert.ok(accountBounds.contained,'Accounts heading must stay inside its panel');
  assert.ok(await page.locator('#acc-table .fv-account-mark').count()>0,'account initials are present');
  assert.equal(await page.locator('#acc-table .fv-account-tag,#acc-table .fv-value-badge').count(),0,'no account tags');
  if(viewport.width<768){
   const cards=await page.evaluate(()=>[...document.querySelectorAll('#acc-table tbody>tr.fv-row')].map(r=>({width:r.getBoundingClientRect().width,clipped:[...r.querySelectorAll('td[data-column]')].some(c=>getComputedStyle(c).display==='none'||c.getBoundingClientRect().right>r.getBoundingClientRect().right+1)})));
   assert.ok(cards.every(r=>r.width<=viewport.width-20&&!r.clipped),'mobile Accounts fits its panel');
  }
  close(accountBounds.title,reference.title,viewport.width+' Accounts title');
  const accountHeader=await page.locator('#acc-table thead').innerText().catch(()=> '');
  if(viewport.width>=768)assert.match(accountHeader,/Last Post/);
  await page.locator('#acc-table [data-search]').fill('unused');assert.equal(await page.locator('#acc-table .fv-account-plain').innerText(),'@unused');
  await page.locator('#acc-table [data-xfilter="scope"]').selectOption('used');assert.equal(await page.locator('#acc-table .fv-account-plain').count(),0);
  await page.locator('#acc-table [data-xfilter="scope"]').selectOption('');await page.locator('#acc-table [data-search]').fill('');
  await page.screenshot({path:dir+'/'+viewport.width+'-accounts.png',fullPage:true});
  const usedRow=page.locator('#acc-table .fv-row').filter({hasText:'@qa'}).first();
  if(await usedRow.count()){
   await usedRow.locator('[data-expand]').click();
   assert.ok(await page.locator('#acc-table .fv-account-history-row').count()>0,'account details contain actual placement history');
   assert.equal(await page.locator('#acc-table .fv-detail-grid,#acc-table .fv-publisher-costs').count(),0,'no duplicate detail cards');
   await usedRow.locator('[data-expand]').click();
  }
  await open('home','Dashboard');
  let homeReference;
  for(const period of ['all-time','this-week','last-week','all-time']){
   await page.locator('[data-view="'+period+'"]').click();
   await page.waitForFunction(period=>{const C=window.FanvueCore,m=window.FanvueUI.getMeasure('home-chart','clicks'),week=C.weekStart(C.londonDay(Date.now()));return document.querySelector('[data-view="'+period+'"]')?.getAttribute('aria-current')==='page'&&m&&m.weekFrom===(period==='all-time'?undefined:period==='this-week'?week:C.addDays(week,-7));},period);
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const g=await geometry();assert.equal(g.heads,true,'Dashboard headings are contained');assert.equal(g.cards,4);assert.equal(g.slots,7);assert.ok(g.bars<=7);assert.equal(g.labels,0);assert.equal(g.overflow,false);
   for(const k of ['title','header','strip','card','chart','plot','list','toolbar'])close(g[k],reference[k],viewport.width+' dashboard '+period+' '+k);
   if(!homeReference)homeReference=g;else for(const k of ['strip','chart','plot','list','toolbar','cols'])close(g[k],homeReference[k],viewport.width+' dashboard period '+period+' '+k);
   assert.equal(await page.locator('#home-comparison .fv-row').count(),5);
   assert.equal(await page.locator('.fv-home-discord .fv-community-summary>div').count(),3);
   await page.screenshot({path:dir+'/'+viewport.width+'-dashboard-'+period+'.png'});
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
  assert.deepEqual(errors,[],'browser errors at '+viewport.width);
  console.log('PASS '+viewport.width+'px: '+routes.length+' campaign/community views, Accounts, Dashboard, sorting, filters, seven-day charts');
  await page.close();
 }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
