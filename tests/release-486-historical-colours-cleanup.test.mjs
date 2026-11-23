import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import vm from 'node:vm';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const app=read('public/app.js'),css=read('public/styles.css'),html=read('public/index.html'),prefs=read('public/click-preferences.html');
const block=(from,to)=>{const a=app.indexOf(from),b=app.indexOf(to,a);assert(a>=0&&b>a,`missing ${from} -> ${to}`);return app.slice(a,b)};
const weeks=block('const STATS_WEEK_ONE=', 'function renderClickChart(scope){');
const historical=block('// Historical keeps complete source-week cohorts.', 'function renderBulk(){');
function fixture(){
 const instant=Date.parse('2026-10-19T18:00:00.000Z');
 class MockDate extends Date { constructor(...args){super(...(args.length?args:[instant]));} static now(){return instant;} }
 const rows=[
 {code:'A01-P14',publisher:'Brook',sourceTab:'WEEK 1 - LOUIS',cost:100,paid:true,posted:true,postedAt:'2026-10-13T15:00:00Z',xViews:9876,xLikes:922,active:false},
 {code:'A01-P18',publisher:'Seph',sourceTab:'WEEK 1 - CONNOR',cost:130,paid:true,posted:true,postedAt:'2026-10-14T15:00:00Z',xViews:9892,xLikes:921,active:true},
 {code:'A01-P19',publisher:'Planned',sourceTab:'WEEK 1 - LOUIS',cost:175,paid:false,posted:false,xViews:null,xLikes:null,active:true},
 {code:'A02-P01',publisher:'Next',sourceTab:'WEEK 2 - LOUIS',cost:230,paid:true,posted:true,postedAt:'2026-10-19T10:00:00Z',xViews:300,xLikes:20,active:true}
 ];
 const clicks=[
 {date:'2026-10-17',code:'A01-P14',clicks:9},
 {date:'2026-10-17',code:'A01-P18',clicks:5},
 {date:'2026-10-18',code:'A01-P14',clicks:3},
 {date:'2026-10-19',code:'A01-P14',clicks:99},
 {date:'2026-10-19',code:'A02-P01',clicks:8}];
 const snapshots=[
 {code:'A01-P14',at:'2026-10-17T13:00:00Z',views:400,likes:40},
 {code:'A01-P18',at:'2026-10-17T13:00:00Z',views:600,likes:60},
 {code:'A01-P14',at:'2026-10-19T13:00:00Z',views:9000,likes:900}];
 const root={innerHTML:'',querySelectorAll:()=>[]};
 const state={placements:rows,owner:'ALL',activity:clicks,activityReady:true,history:snapshots,trackingReady:true,initialLoadSettled:true,loadError:false,campaigns:[],statsWeek:'current'};
 const ctx={Date:MockDate,Map,Set,state,el:id=>id==='historicalWeeks'?root:null,
  shift:(d,n)=>{const k=new MockDate(d+'T12:00:00Z');k.setUTCDate(k.getUTCDate()+n);return k.toISOString().slice(0,10)},
  day:d=>d.toISOString().slice(0,10),weekStart:d=>{const a=new MockDate(d);a.setUTCDate(a.getUTCDate()-(a.getUTCDay()+6)%7);return a.toISOString().slice(0,10)},
  isLive:p=>!!p.posted,postDate:p=>p.postedAt?new MockDate(p.postedAt):null,validDate:x=>x?new MockDate(x):null,
  number:x=>x===null||x===undefined||x===''?null:Number(x),fmt:x=>String(x),money:x=>x===null?'N/A':'$'+Number(x).toLocaleString('en-GB'),
  clicks:p=>p.paid?1000:0,display:x=>x===null?'N/A':String(x),esc:x=>String(x),
  campaignTag:p=>`<span>${p.code.slice(0,3)}</span>`,compareUTMClicks:(a,b)=>b.cost-a.cost};
 vm.runInNewContext(weeks+'\n'+historical+'\nthis.fns={renderHistorical,statsWeekKpis,selectedStatsWeek,historicalScope};',ctx);
 return {ctx,root,rows,fns:ctx.fns};
}
test('Historical Week 1 summaries use dated week clicks and cutoff X snapshots after Week 2 begins',()=>{
 const {root,fns,ctx}=fixture();fns.renderHistorical();
 assert.match(root.innerHTML,/Week summary/);
 assert.match(root.innerHTML,/Articles/);
 assert.match(root.innerHTML,/data-week="1"/);
 const w1=root.innerHTML.slice(root.innerHTML.indexOf('data-week="1"'),root.innerHTML.indexOf('data-week="2"'));
 assert.match(w1,/17 clicks/);
 assert.match(w1,/>17<\/strong>/);
 assert.match(w1,/>1000<\/strong>/);
 assert.match(w1,/>100<\/strong>/);
 assert.match(w1,/>\$230<\/strong>/);
 assert(!w1.includes('9000'),'present-day lifetime snapshots must not overwrite a closed week');
 assert(!w1.includes('>99<'),'week 2 clicks must never leak into week 1');
 assert.equal((w1.match(/historical-is-paid/g)||[]).length,2);
 assert(!w1.includes('>Planned<'),'unpaid unposted articles must be absent from Historical');
 assert.equal((w1.match(/class="historical-card /g)||[]).length,2);
 assert(w1.indexOf('Brook')<w1.indexOf('Seph'),'weekly click sort, 12 before 5');
 assert(!w1.includes('data-week="1" open'),'week closed by default');
 ctx.state.activityReady=false;fns.renderHistorical();assert.match(root.innerHTML,/N\/A<\/strong>/,'unavailable history is not fabricated as zero');
});
test('Week 2 summary is independent from Week 1; historical expansion persists after refresh',()=>{
 const {root,fns}=fixture();fns.renderHistorical();
 const w2=root.innerHTML.slice(root.innerHTML.indexOf('data-week="2"'));
 assert.match(w2,/>8<\/strong>/);assert.match(w2,/>\$230<\/strong>/);
 assert(!w2.includes('>17<\/strong>'));
 root.querySelectorAll=()=>[{dataset:{week:'1'}}];fns.renderHistorical();
 assert.match(root.innerHTML,/data-week="1" open/);assert(!root.innerHTML.includes('data-week="2" open'));
});
test('Views purple and Likes yellow with accessible text; uniform sparkle layer retained',()=>{
 const tail=css.slice(css.indexOf('/* v4.8.6 - unique purple/yellow stats'));
 assert.match(tail,/--xtracker-views-gradient:linear-gradient\(125deg,#a84afa/);
 assert.match(tail,/--xtracker-likes-gradient:linear-gradient\(123deg,#ffe77a/);
 assert.match(tail,/nth-child\(4\)[\s\S]*?background:var\(--xtracker-views-gradient\)/);
 assert.match(tail,/nth-child\(5\)[\s\S]*?background:var\(--xtracker-likes-gradient\)/);
 assert.match(tail,/nth-child\(5\) \.kpi-value[\s\S]*?-webkit-text-fill-color:#2d2416!important/);
 assert.match(tail,/background-image:var\(--xtracker-sparkle-tile\)/);
 assert.match(tail,/opacity:var\(--xtracker-sparkle-opacity\)/);
});
test('Self-click protection is still functional but hidden from public navigation',()=>{
 assert(!html.includes('href="/click-preferences.html"'));
 assert(!html.includes('>Exclude my clicks</a>'));
 assert.match(prefs,/fanvue_exclude_clicks=1/);
 assert.match(prefs,/Back to X Tracker/);
 assert.match(prefs,/class="back"/);
});
test('Comparing accounts is no longer reachable; campaigns and navigation are preserved',()=>{
 assert(!html.includes('>Compare accounts<'));
 assert(!app.includes("['dashboard','accounts','campaigns','stats','historical']"));
 assert(app.includes("['dashboard','campaigns','stats','historical']"));
 assert.match(html,/id="page-accounts"[^>]*hidden inert aria-hidden="true" data-retired="true"/);
 assert.match(html,/data-page="campaigns"/);
});
test('Page back arrows are real padded controls and all release versions align',()=>{
 assert.equal((html.match(/class="page-back-button"/g)||[]).length,2);
 assert.match(css,/\.site-page \.page-back-button \{[\s\S]*?padding:7px 12px;[\s\S]*?margin:13px 0 2px/);
 assert.match(prefs,/<svg viewBox="0 0 24 24" aria-hidden="true"/);
 assert(!html.includes('← Key Stats'));
 assert.match(app,/APP_VERSION='4\.9\.1'/);
 assert.match(html,/app\.js\?v=4\.9\.1/);
 assert.match(read('netlify/functions/dashboard.mjs'),/uiVersion:'4\.9\.1'/);
 assert.equal(readdirSync(new URL('../netlify/functions/',import.meta.url)).filter(f=>f.endsWith('.mjs')).length,8);
 assert.match(read('netlify/lib/click-baseline.mjs'),/2026-10-17T00:32:36/);
 assert.match(app,/setInterval\(\(\)=>\{if\(!document.hidden\)load\(\);\},60000\)/);
});
