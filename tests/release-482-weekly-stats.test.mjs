import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const app=read('public/app.js'),html=read('public/index.html'),css=read('public/styles.css');
const block=app.slice(app.indexOf('const STATS_WEEK_ONE='),app.indexOf('function renderClickChart(scope){'));

const fixtures=[
 {code:'A01-P01',sourceTab:'WEEK 1 - LOUIS',publisher:'First',articleLabel:'ARTICLE 2.2',paid:true,cost:120,posted:true,postedAt:'2026-10-17T12:00:00Z',xViews:500,xLikes:40,active:true},
 {code:'A01-P02',sourceTab:'WEEK 1 - CONNOR',publisher:'Second',articleLabel:'ARTICLE 2.1',paid:true,cost:100,posted:true,postedAt:'2026-10-16T12:00:00Z',xViews:50,xLikes:6,active:true},
 {code:'A02-P01',sourceTab:'WEEK 2 - LOUIS',publisher:'Next week',articleLabel:'ARTICLE 2.3',paid:true,cost:200,posted:true,postedAt:'2026-10-19T12:00:00Z',xViews:900,xLikes:90,active:true}
];
const activity=[
 {code:'A01-P01',date:'2026-10-17',clicks:7},
 {code:'A01-P02',date:'2026-10-16',clicks:9},
 {code:'A01-P01',date:'2026-10-19',clicks:100},
 {code:'A02-P01',date:'2026-10-19',clicks:5}
];
const history=[
 {code:'A01-P01',at:'2026-10-17T20:00:00Z',views:450,likes:34,comments:12,shares:5,availability:'available'},
 {code:'A01-P01',at:'2026-10-19T20:00:00Z',views:800,likes:71,comments:17,shares:10,availability:'available'},
 {code:'A01-P02',at:'2026-10-16T21:00:00Z',views:45,likes:5,comments:1,shares:1,availability:'available'}
];
function makeContext(iso){
 const instant=Date.parse(iso),DateMock=class extends Date{constructor(...args){super(...(args.length?args:[instant]));}static now(){return instant;}};
 const nodes={
  statsWeekSelect:{innerHTML:'',value:'',},
  statsWeekRange:{textContent:''},statsChartRange:{textContent:''},
  statsWeeklyBreakdown:{innerHTML:''},statsArticleCount:{textContent:''},statsBreakdownHeading:{textContent:''},statsViewHistory:{textContent:'',hidden:true}
 };
 const ctx={
   Date:DateMock,Map,Set,state:{statsWeek:'current',initialLoadSettled:true,placements:fixtures,activity,activityReady:true,history,campaigns:[]},
   el:id=>nodes[id],
   eligible:()=>fixtures,number:v=>v===''||v===null||v===undefined?null:Number(v),
   validDate:v=>v?new DateMock(v):null,
   day:d=>d.toISOString().slice(0,10),
   weekStart:d=>{const w=d.toISOString().slice(0,10);const day=d.getUTCDay();const s=new DateMock(w+'T12:00:00Z');s.setUTCDate(s.getUTCDate()-(day+6)%7);return s.toISOString().slice(0,10);},
   shift:(date,n)=>{const d=new DateMock(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);},
   fmt:n=>String(n),money:n=>'$'+n,display:n=>n===null?'N/A':String(n),fixed:n=>Number(n).toFixed(2),
   isLive:p=>p.posted,postDate:p=>new DateMock(p.postedAt),
   clicks:p=>p.clicks??0,
   esc:s=>String(s),campaignTag:()=>'<span class="article-campaign-chip">Campaign A01</span>',
   compareUTMClicks:(a,b)=>(b.clicks||0)-(a.clicks||0)
 };
 vm.runInNewContext(block+'\nthis.weekFns={currentStatsWeekNumber,selectedStatsWeek,weeklyCodeClicks,weeklyClicksFor,recordedMetricFor,statsWeekKpis,renderStatsWeekSelector,renderWeeklyBreakdown,weeklySnapshotSeries,weeklyPaidSeries,weeklyLive,viewStatsWeekHistory};',ctx);
 return {ctx,fn:ctx.weekFns,nodes};
}

test('week numbers roll over on Monday in UK: Week 1 on Oct 17, Week 2 Oct 19',()=>{
 const a=makeContext('2026-10-17T12:00:00Z'),b=makeContext('2026-10-19T12:00:00Z');
 assert.equal(a.fn.currentStatsWeekNumber(),1);assert.equal(b.fn.currentStatsWeekNumber(),2);
 assert.equal(a.fn.selectedStatsWeek().from,'2026-10-12');
 assert.equal(b.fn.selectedStatsWeek().from,'2026-10-19');
 b.fn.renderStatsWeekSelector(b.fn.selectedStatsWeek());
 assert.match(b.nodes.statsWeekSelect.innerHTML,/This Week \(Week 2\)/);
 assert.match(b.nodes.statsWeekSelect.innerHTML,/<option value="1">Week 1<\/option>/);
});
test('previous week selection excludes next-week source tabs and next-week clicks',()=>{
 const {ctx,fn,nodes}=makeContext('2026-10-19T22:00:00Z');
 ctx.state.statsWeek='1';const s=fn.selectedStatsWeek();
 assert.equal(s.number,1);assert.deepEqual(s.placements.map(p=>p.publisher),['First','Second']);
 const kpi=fn.statsWeekKpis(s);
 assert.equal(kpi[0].value,'2');assert.equal(kpi[1].value,'$220');assert.equal(kpi[2].value,'16');
 assert.equal(kpi[3].value,'495');assert.equal(kpi[4].value,'39');
 fn.renderStatsWeekSelector(s);assert.equal(nodes.statsWeekSelect.value,'1');
 fn.renderWeeklyBreakdown(s);assert.match(nodes.statsWeeklyBreakdown.innerHTML,/First/);assert.match(nodes.statsWeeklyBreakdown.innerHTML,/Second/);
 assert(!nodes.statsWeeklyBreakdown.innerHTML.includes('Next week'));
 assert(nodes.statsWeeklyBreakdown.innerHTML.indexOf('Second')<nodes.statsWeeklyBreakdown.innerHTML.indexOf('First'),'by weekly clicks: Second 9 then First 7');
});
test('Week 2 KPI and per-code breakdown do not include Week 1 cohort',()=>{
 const {fn}=makeContext('2026-10-19T22:00:00Z');const scope=fn.selectedStatsWeek();
 assert.equal(scope.number,2);assert.equal(scope.placements.length,1);
 assert.equal(fn.statsWeekKpis(scope)[2].value,'5');assert.equal(fn.statsWeekKpis(scope)[1].value,'$200');
});
test('past-week X views come from cutoff snapshots, not present-day lifetime totals',()=>{
 const {ctx,fn}=makeContext('2026-10-19T22:00:00Z');ctx.state.statsWeek='1';let scope=fn.selectedStatsWeek();
 assert.equal(fn.recordedMetricFor(fixtures[0],'xViews',scope),450);
 assert.equal(fn.recordedMetricFor(fixtures[1],'xLikes',scope),5);
 assert.equal(fn.weeklySnapshotSeries(scope,'engagements')[5].value,51);
 assert.equal(fn.weeklyPaidSeries(scope).every(x=>x.value===null),true,'missing payment dates never invented');
});
test('missing activity never becomes a fabricated zero and no-data Week 2 renders empty',()=>{
 const {ctx,fn,nodes}=makeContext('2026-10-19T12:00:00Z');ctx.state.activityReady=false;
 assert.equal(fn.statsWeekKpis(fn.selectedStatsWeek())[2].value,'N/A');
 ctx.state.placements=fixtures.filter(p=>p.sourceTab.startsWith('WEEK 1'));ctx.eligible=()=>ctx.state.placements;
 const s=fn.selectedStatsWeek();assert.equal(s.placements.length,0);
 assert.equal(fn.statsWeekKpis(s)[0].value,'0');fn.renderWeeklyBreakdown(s);
 assert.match(nodes.statsWeeklyBreakdown.innerHTML,/No placements recorded for Week 2 yet/);
});
test('stats selector is positioned above weekly cards and all charts are wired to selected scope',()=>{
 const sel=html.indexOf('id="statsWeekSelect"'),kpi=html.indexOf('id="detailedKpis"');
 assert(sel>0&&sel<kpi);
 assert(html.includes('id="statsWeeklyBreakdown"'));
 assert(!html.includes('id="chartPeriod"'));
 assert(app.includes("el('statsWeekSelect').addEventListener('change'"));
 assert(app.includes('renderWeeklyBreakdown(scope);'));
 assert(!app.includes('renderPerformanceOverview(scope);'));
 assert(!html.includes('id="placementViews"'));
 assert(html.includes('id="statsViewHistory"'));
 assert(app.includes('renderClickChart(scope);'));
 assert(app.includes('weeklySnapshotSeries(scope,'));
 assert(css.includes('/* v4.8.3 - Key Stats week filter'));
 assert(read('netlify/functions/dashboard.mjs').includes("uiVersion:'4.9.1'"));
 assert(read('public/index.html').includes('/app.js?v=4.9.1'));
 assert.equal(readdirSync(new URL('../netlify/functions/',import.meta.url)).filter(f=>f.endsWith('.mjs')).length,8);
});


test('Key Stats ranks only the top live five; full placement list belongs to Historical',()=>{
 const {ctx,fn,nodes}=makeContext('2026-10-17T22:00:00Z');
 const scope=fn.selectedStatsWeek();
 ctx.state.placements=[...fixtures.slice(0,2), ...Array.from({length:8},(_,i)=>({...fixtures[0],code:'A01-P'+String(i+10).padStart(2,'0'),publisher:'Extra'+i,clicks:i}))];
 ctx.state.activity=[...activity, ...Array.from({length:8},(_,i)=>({code:'A01-P'+String(i+10).padStart(2,'0'),date:'2026-10-17',clicks:10+i}))];
 const nextScope=fn.selectedStatsWeek();fn.renderWeeklyBreakdown(nextScope);
 assert.equal((nodes.statsWeeklyBreakdown.innerHTML.match(/class="stats-breakdown-row"/g)||[]).length,5);
 assert.match(nodes.statsWeeklyBreakdown.innerHTML,/Extra7/);
 assert(!nodes.statsWeeklyBreakdown.innerHTML.includes('Extra0'),'outside top 5 should not repeat in Key Stats');
 assert.equal(nodes.statsViewHistory.hidden,false);
 assert.equal(nodes.statsViewHistory.textContent,'View Week 1 in Historical →');
 assert(!html.includes('id="placementViews"'),'duplicate placement charts are removed');
 assert(!html.includes('id="placementClicks"'),'duplicate placement charts are removed');
 assert(html.includes('id="page-historical"'),'complete weekly list remains accessible');
});

test('weekly cohort reporting retains inactive historical placements and zero-observation protection',()=>{
 const {ctx,fn}=makeContext('2026-10-19T19:00:00Z');ctx.state.statsWeek='1';
 ctx.state.placements=[{...fixtures[0],active:false},fixtures[1],fixtures[2]];
 const scope=fn.selectedStatsWeek();
 assert.equal(scope.placements.length,2);
 assert.equal(fn.statsWeekKpis(scope).length,5);
 assert.equal(fn.statsWeekKpis(scope)[1].value,'$220');
 assert.equal(fn.statsWeekKpis(scope)[2].value,'16');
});

test('Key Stats history link opens only the selected week and retains default collapsed history otherwise',()=>{
 const {ctx,fn}=makeContext('2026-10-19T19:00:00Z');ctx.state.statsWeek='1';
 let moved='',scrolled=false;
 const week1={dataset:{week:'1'},open:false,scrollIntoView(){scrolled=true;}},week2={dataset:{week:'2'},open:true,scrollIntoView(){}};
 ctx.el=id=>id==='historicalWeeks'?{querySelectorAll:()=>[week1,week2]}:{};
 ctx.route=name=>moved=name;
 fn.viewStatsWeekHistory();
 assert.equal(moved,'historical');assert(week1.open);assert.equal(week2.open,false);assert(scrolled);
});
