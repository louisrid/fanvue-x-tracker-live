import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const js=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../public/styles.css',import.meta.url),'utf8');
function dailyContext(placements=[],activity=[],hourly=[],ready=true){
 const begin=js.indexOf('function dailySeries('),end=js.indexOf('\nfunction renderHomeChart(',begin);
 assert(begin>0&&end>begin,'daily chart source exists');
 const ids=['dailyTrendChart','dailyOverviewMetrics','dailyTrendNote','dailyLiveStatus','dailyLiveLabel','dailyOverviewTable'];
 const elements=Object.fromEntries(ids.map(id=>[id,{clientWidth:id==='dailyTrendChart'?780:0,innerHTML:'',textContent:'',querySelectorAll:()=>[],classList:{toggle(){}}}]));
 const ctx={
   state:{placements,owner:'ALL',fxRateGbp:0.75,fxRateDate:'2026-10-19',activity,activityReady:ready,hourlyEvents:hourly,hourlyReady:true,trackingReady:true,initialLoadSettled:true,loadError:false},
   homePlacements:()=>placements,postDate:p=>p.postedAt?new Date(p.postedAt):null,
   number:x=>x===null||x===undefined||x===''?null:Number(x),
   validDate:x=>x?new Date(x):null,
   day:d=>d.toISOString().slice(0,10),
   shift:(date,n)=>new Date(new Date(date+'T00:00:00Z').getTime()+n*864e5).toISOString().slice(0,10),
   fmt:x=>String(x),money:x=>'$'+x,gbp:x=>'£'+Number(x).toFixed(2),esc:x=>String(x),fixed:x=>Number(x).toFixed(2),
   Intl,Date,Math,TZ:'Europe/London',STATS_WEEK_ONE:'2026-10-19',el:id=>elements[id]
 };
 vm.createContext(ctx);vm.runInContext(js.slice(begin,end),ctx);
 return {ctx,elements};
}
test('Dashboard starts with This week and original headline KPI cards; old Performance is gone',()=>{
 // v3.1 redesign: Home renders its title before the metric strip; the old
 // Performance blocks stay removed.
 const shell=fs.readFileSync(new URL('../public/fanvue-app.js',import.meta.url),'utf8');
 assert(html.includes('id="fvTitle"'));
 assert(html.indexOf('id="fvTitle"')<html.indexOf('id="fvPage"'));
 assert(!html.includes('id="dailyOverview"'));
 assert(!html.includes('id="statsSection"'));
 assert(!html.includes('id="homeChart"'));
 // Owner direction (25 Nov): the Needs attention panel is removed from Home.
 assert(shell.includes('body:overviewNotice()+strip+chart+table+discord};'));
 assert(!shell.includes('Needs attention'));
 assert(js.includes("valid=['summary','articles','upcoming']"));
});
test('Key Stats contains the Daily Breakdown, KPI row and graph without a daily table or spacer',()=>{
 const stats=html.split('id="page-stats"')[1].split('id="page-historical"')[0];
 for(const id of ['statsTitle','dailyOverview','dailyOverviewMetrics','dailyTrendChart','dailyTrendNote'])
   assert(stats.includes('id="'+id+'"'),id);
 for(const removed of ['dailyOverviewTable','detailedKpis','statsWeekSelect','statsArticleSort','statsWeeklyBreakdown','clickChart','viewsChart','engagementChart','spendChart'])
   assert(!stats.includes('id="'+removed+'"'),removed);
 assert(!stats.includes('class="key-stats-bottom-space"'));
 assert.match(css,/#mainContent #page-stats \.daily-overview-metrics\s*\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
});
test('Week 2 daily totals use only selected placement codes from 26 October',()=>{
 const {ctx}=dailyContext([{code:'A02-P29',paid:true,cost:170,paidAt:''}],
 [{date:'2026-10-27',code:'A02-P29',clicks:2},{date:'2026-10-27',code:'A01-P14',clicks:900},{date:'2026-10-26',code:'A02-P29',clicks:1}]);
 const output=vm.runInContext('dailySeries(new Date("2026-10-27T12:00:00Z"))',ctx);
 assert.equal(output.daily.at(-1).clicks,2);
 assert.equal(output.daily.at(-2).clicks,1);
 assert.equal(output.daily.length,2);
});
test('Week 2 hourly buckets count genuine timestamps from 26 October',()=>{
 const now=new Date('2026-10-26T14:00:00Z');
 const events=[
  {timestamp:'2026-10-26T14:05:00Z',code:'A02-P29'},
  {timestamp:'2026-10-26T14:36:00Z',code:'A02-P29'},
  {timestamp:'2026-10-26T09:00:00Z',code:'A02-P29'},
  {timestamp:'2026-10-26T14:00:00Z',code:'A01-P14'},
  {timestamp:'2026-10-25T14:00:00Z',code:'A02-P29'},
 ];
 const {ctx}=dailyContext([{code:'A02-P29'}],[],events);
 const result=vm.runInContext('hourlyWindow(new Date("2026-10-26T14:00:00Z"))',ctx);
 assert.equal(result.ready,true);
 assert.equal(result.buckets.length,15);
 assert.equal(result.buckets.at(-1).clicks,2);
 assert.equal(result.buckets.reduce((s,b)=>s+b.clicks,0),3);
 assert.equal(result.buckets.at(-1).time,now.getTime());
});
test('Without timestamped event history, never invent hourly clicks from daily totals',()=>{
 const {ctx}=dailyContext([{code:'A01-P14'}],[{date:'2026-10-19',code:'A01-P14',clicks:900}],[]);
 ctx.state.hourlyReady=false;
 const output=vm.runInContext('hourlyWindow(new Date("2026-10-19T14:00:00Z"))',ctx);
 assert.equal(output.ready,false);
 assert(output.buckets.every(b=>b.clicks===0));
});
test('Graph is a smooth red–orange SVG, uses hourly buckets and renders sharply at mobile widths',()=>{
 const {ctx,elements}=dailyContext([{code:'A01-P14',paid:true,cost:120,paidAt:'2026-10-19T12:00:00Z'}],
 [{date:'2026-10-19',code:'A01-P14',clicks:2}],
 [{timestamp:'2026-10-19T14:00:00Z',code:'A01-P14'}]);
 vm.runInContext('renderDailyOverview()',ctx);
 assert.match(elements.dailyTrendChart.innerHTML,/Week 2 UTM clicks/);
 assert.match(elements.dailyTrendChart.innerHTML,/weeklyClicksLine/);
 assert.match(elements.dailyTrendChart.innerHTML,/ C\d+(?:\.\d+)? /);
 assert.match(elements.dailyOverviewMetrics.innerHTML,/UTM clicks today/);
 assert.match(elements.dailyOverviewMetrics.innerHTML,/Equivalised Spend/);
 assert.match(elements.dailyOverviewTable.innerHTML,/<tr>/);
 elements.dailyTrendChart.clientWidth=320;
 vm.runInContext('renderDailyOverview()',ctx);
 assert.match(elements.dailyTrendChart.innerHTML,/viewBox="0 0 320 230"/);
 assert.match(css,/#page-stats svg\.daily-trend-svg text\s*\{[^}]*stroke:none!important/);
 assert.match(css,/#page-stats \.daily-utm-line\s*\{[^}]*stroke-width:6\.5/);
});
test('Chart reuses dashboard event timestamps without modifying tracking redirects',()=>{
 assert(!js.includes("fetch('/.netlify/functions/events"));
 assert(js.includes('state.hourlyEvents=data.hourlyEvents'));
 assert(js.includes('state.hourlyReady=false'));
 assert(fs.readFileSync(new URL('../netlify/functions/redirect.mjs',import.meta.url),'utf8').includes('createRedirectHandler'));
});
