import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync('public/index.html','utf8');
const app=readFileSync('public/app.js','utf8');
const reporting=readFileSync('public/campaign-reporting.js','utf8');
const css=readFileSync('public/stats-discord-ui.css','utf8');
const between=(source,a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));

test('Main dashboard headline is lifetime, not a hidden saved-week selection',()=>{
 // v3.1 redesign: the shared header defaults to Lifetime and offers no saved-week selector.
 // Site recommendations: a plain All Time label, not a period selector.
 assert.match(html,/id="fvRange"[^>]*>All Time</);
 assert.match(html,/the sources report lifetime figures/);
 assert.doesNotMatch(html,/dashboardWeekSelect|Reporting week/);
 assert.match(app,/const placements=state\.placements;/);
 assert.doesNotMatch(between(app,'function renderKpis(){','function notify('),/\.filter\(p=>p\.active!==false\)/);
 assert.match(app,/label:'Spend · all time'/);
 assert.match(app,/label:'UTM clicks · all time'/);
 assert.match(app,/label:'X views · all time'/);
 assert.match(app,/label:'Published posts · all time'/);
 assert.match(app,/state\.dashboardWeek='all'/);
 const kpis=between(app,'function renderKpis(){','function notify(');
 assert.doesNotMatch(kpis,/homePlacements\(|homeClickTotal\(|selectedDashboardWeek\(/);
});

test('OF Terms lifetime spend includes paid pending placements and all recorded clicks',async ()=>{
 const of=between(app,'function renderOfReport(){','async function loadGtaReport(');
 assert.match(of,/const paid=allPublishers\.filter\(p=>p\.paid===true\)/);
 assert.match(of,/knownClicks\.reduce\(\(sum,p\)=>sum\+number\(p\.clicks\),0\)/);
 assert.match(of,/Spend · all time/);
 assert.match(of,/UTM clicks · all time/);
 assert.match(of,/Published posts · all time/);
 assert.doesNotMatch(of,/This week's UTM clicks|Week UTM clicks|Week [0-9]/);
 // v3.1 redesign: the OF Terms page shows the lifetime overview figures, so paid but
 // unpublished placements count in spend and every recorded click is included.
 await import('../public/fanvue-core.js');
 const C=globalThis.FanvueCore;
 const s=C.campaignSummary({campaigns:[{id:'of-terms',source:'OF_REPORT',paidCount:2,paidSpendKnown:300,unknownPaidCosts:0,trackedClicks:7,published:1,
   rows:[{posted:true,paid:true,cost:200,postUrl:'https://x.com/a/status/1',views:10,clicks:5},{posted:false,paid:true,cost:100,clicks:2}]}]},'of-terms');
 assert.equal(s.spend.value,300);
 assert.equal(s.clicks.value,7);
});

test('Other campaign sources remain lifetime; history graphs are separate',()=>{
 assert.match(reporting,/lifetime campaign reporting/);
 assert.match(reporting,/All-time totals · 5-day chart/);
 assert.match(app,/el\('gtaWeekLabel'\)\.textContent='All-time stats'/);
 // v3.1 redesign: GTA VI keeps its two X groups, Discord course clicks stay their own
 // metric, and weekly charts are labelled history, separate from lifetime totals.
 const shell=readFileSync('public/fanvue-app.js','utf8');
 assert.match(shell,/'x-original-posts':\{type:'Post'\},'x-quote-posts':\{type:'QRT'\}/);
 assert.doesNotMatch(shell,/key:'quoted'/);
 // Owner (26 Nov, style 74): short label "Clicks" for Discord course clicks.
 assert.match(shell,/metric\('Course Clicks','graduation'/);
 // Owner (25 Nov): graphs show per-period figures only; cumulative totals stay as numbers.
 assert.doesNotMatch(shell,/unit:'Cumulative Views'/);assert.match(shell,/unit:'Views Gained'/);
});
