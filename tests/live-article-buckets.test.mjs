import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/styles.css',import.meta.url),'utf8');
const backend=readFileSync(new URL('../netlify/functions/dashboard.mjs',import.meta.url),'utf8');
const shared=readFileSync(new URL('../netlify/lib/shared.mjs',import.meta.url),'utf8');
const sheet=readFileSync(new URL('../netlify/lib/sheet-source.mjs',import.meta.url),'utf8');
const index=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const clickBaseline=readFileSync(new URL('../netlify/lib/click-baseline.mjs',import.meta.url),'utf8');
const cookiePage=readFileSync(new URL('../public/click-preferences.html',import.meta.url),'utf8');
const source=(start,end)=>{const a=app.indexOf(start),b=app.indexOf(end,a);assert(a>=0&&b>a,`source missing ${start}`);return app.slice(a,b);};
const now=Date.parse('2026-10-17T12:00:00Z');
class FixedDate extends Date{static now(){return now;}}
const live=(code,ageDays=0,paid=true)=>({code,publisher:code,active:true,paid,posted:true,postUrl:'https://x.com/creator/status/2111442075753582651',postedAt:new Date(now-ageDays*86400000).toISOString(),countVerified:true,clicks:1});
const upcoming=(code,paid)=>({code,publisher:code,active:true,paid,posted:false,countVerified:true,clicks:0});
const context={Date:FixedDate,postDate:p=>p.postedAt?new Date(p.postedAt):null,isLive:p=>p.posted&&p.postUrl?.includes('/status/'),};
runInNewContext(source('const isNew=p=>','const pubDate=p=>')+'\nthis.__isNewForTest=p=>isNew(p);',context);
const recent=p=>context.__isNewForTest(p);
test('seven-day NEW timer requires actual posted X URL and respects boundaries',()=>{
  assert.equal(recent(live('CURRENT',0)),true);assert.equal(recent(live('RECENT',6.99)),true);
  assert.equal(recent(live('EXPIRED',7)),false);assert.equal(recent(live('OLD',11)),false);
  assert.equal(recent(upcoming('UPCOMING',true)),false);
  assert.equal(recent({...live('INVALID'),postUrl:'https://x.com/creator'}),false);
  assert.equal(recent({...live('FUTURE'),postedAt:new Date(now+3600000).toISOString()}),false);
});
test('published placements stay above upcoming and unpaid even with selected filters',()=>{
  const entries=[upcoming('UPCOMING-PAID',true), live('OLD-LIVE',11), upcoming('UNPAID',false),live('RECENT-LIVE',2)];
  const ids={trackerList:{innerHTML:''},resultCount:{textContent:''},placementsOverview:{innerHTML:''},trackerFilterSummary:{textContent:''}};
  const ctx={el:id=>ids[id],filteredPlacements:()=>entries,state:{selected:new Set(),placements:entries},eligible:()=>entries,
    currentMetrics:()=>({allClicks:2,totalPaid:0}),fmt:n=>String(n),display:n=>String(n),money:n=>'$'+n,
    isLive:context.isLive,isNew:recent,esc:s=>String(s),placementCard:p=>`<span data-code="${p.code}"></span>`,renderBulk:()=>{}};
  runInNewContext(source('function renderTracker(){','function renderBulk(){'),ctx);
  ctx.renderTracker();const output=ids.trackerList.innerHTML;
  assert(output.indexOf('data-code="RECENT-LIVE"')<output.indexOf('data-code="UPCOMING-PAID"'));
  assert(output.indexOf('data-code="OLD-LIVE"')<output.indexOf('data-code="UPCOMING-PAID"'));
  assert(output.indexOf('data-code="UPCOMING-PAID"')<output.indexOf('data-code="UNPAID"'));
  assert(output.includes('tracker-group-live')&&output.includes('tracker-group-upcoming')&&output.includes('tracker-group-unpaid'));
  assert.equal(ids.trackerFilterSummary.textContent,'');
  assert(css.includes('#page-placements .placement-shell.is-live'));
  assert(css.includes('#page-placements .placement-shell:not(.is-live)'));
});
test('backend, HTML and frontend versions match without changing existing tracking baseline',()=>{
  assert(app.includes("const APP_VERSION='4.9.1'"));assert(backend.includes("uiVersion:'4.9.1'"));
  assert(index.includes('/app.js?v=4.9.1')&&index.includes('/styles.css?v=4.9.1'));
  assert(cookiePage.includes('/?app=4.9.1#dashboard'));
  assert(clickBaseline.includes('2026-10-17T00:32:36.000Z'));
  assert(shared.includes("getStore({name,consistency:'strong'})"));
});
test('website continues reading Google Sheets automatically without additional ZIP uploads',()=>{
  assert(sheet.includes('https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=xlsx'));
  assert(shared.includes('Date.now()-Date.parse(cached.fetchedAt)<45000'));
  assert(app.includes('setInterval(()=>{if(!document.hidden)load();},60000)'));
  assert(app.includes("document.addEventListener('visibilitychange'"));
  assert(app.includes("fetch('/.netlify/functions/dashboard'"));
});
