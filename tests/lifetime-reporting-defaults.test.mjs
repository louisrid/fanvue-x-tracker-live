import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync('public/index.html','utf8');
const app=readFileSync('public/app.js','utf8');
const reporting=readFileSync('public/campaign-reporting.js','utf8');
const css=readFileSync('public/stats-discord-ui.css','utf8');
const between=(source,a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));

test('Main dashboard headline is lifetime, not a hidden saved-week selection',()=>{
 assert.match(html,/LIFETIME · X ARTICLES/);
 assert.match(html,/id="dashboardLiveSummaryTitle">Lifetime overview/);
 assert.match(html,/class="dashboard-week-toolbar" hidden aria-hidden="true"/);
 assert.match(css,/\.dashboard-week-toolbar\[hidden\]\s*\{[\s\S]*?display:none!important/);
 assert.match(app,/const placements=state\.placements\.filter\(p=>p\.active!==false\)/);
 assert.match(app,/label:'Paid spend · all time'/);
 assert.match(app,/label:'UTM clicks · all time'/);
 assert.match(app,/label:'X views · all time'/);
 assert.match(app,/label:'Published posts · all time'/);
 assert.match(app,/state\.dashboardWeek='all'/);
 const kpis=between(app,'function renderKpis(){','function notify(');
 assert.doesNotMatch(kpis,/homePlacements\(|homeClickTotal\(|selectedDashboardWeek\(/);
});

test('OF Terms lifetime spend includes paid pending placements and all recorded clicks',()=>{
 const of=between(app,'function renderOfReport(){','async function loadGtaReport(');
 assert.match(of,/const paid=allPublishers\.filter\(p=>p\.paid===true\)/);
 assert.match(of,/knownClicks\.reduce\(\(sum,p\)=>sum\+number\(p\.clicks\),0\)/);
 assert.match(of,/Paid spend · all time/);
 assert.match(of,/UTM clicks · all time/);
 assert.match(of,/Published posts · all time/);
 assert.doesNotMatch(of,/This week's UTM clicks|Week UTM clicks|Week [0-9]/);
 assert.match(html,/id="ofWeekLabel">Lifetime campaign totals/);
});

test('Other campaign sources remain lifetime; history graphs are separate',()=>{
 assert.match(reporting,/lifetime campaign reporting/);
 assert.match(reporting,/all-time across every tracked X Article placement/i);
 assert.match(app,/Lifetime campaign performance/);
 assert.match(html,/id="gtaTabQrts"/);
 assert.match(html,/id="gtaTabOriginals"/);
 assert.doesNotMatch(html,/id="gtaTabQuoted"/);
 assert.match(html,/Course clicks/);
});
