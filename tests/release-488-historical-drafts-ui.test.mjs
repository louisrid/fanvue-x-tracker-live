import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const app=read('public/app.js'),css=read('public/styles.css');
const take=(begin,end)=>{const a=app.indexOf(begin),b=app.indexOf(end,a);assert(a>=0&&b>a,`Missing ${begin}`);return app.slice(a,b);};
function historicalFixture(){
 const instant=Date.parse('2026-10-19T20:00:00Z');
 class MockDate extends Date {constructor(...args){super(...(args.length?args:[instant]));}static now(){return instant;}}
 const placements=[
  {code:'A01-P14',publisher:'PaidLive',sourceTab:'WEEK 1 - LOUIS',paid:true,posted:true,cost:100,postedAt:'2026-10-13T14:00:00Z',active:true},
  {code:'A01-P15',publisher:'UnpaidLive',sourceTab:'WEEK 1 - LOUIS',paid:false,posted:true,cost:50,postedAt:'2026-10-15T14:00:00Z',active:true},
  {code:'A01-P16',publisher:'UnpaidDraft',sourceTab:'WEEK 1 - LOUIS',paid:false,posted:false,cost:70,active:true},
  {code:'A01-P17',publisher:'ScheduledPaid',sourceTab:'WEEK 1 - LOUIS',paid:true,posted:false,cost:150,active:true},
  {code:'A02-P01',publisher:'FutureDraft',sourceTab:'WEEK 2 - LOUIS',paid:false,posted:false,cost:200,active:true},
  {code:'A03-P01',publisher:'OldInactivePaidLive',sourceTab:'WEEK 3 - LOUIS',paid:true,posted:true,postedAt:'2026-10-27T12:00:00Z',cost:240,active:false}
 ];
 const root={innerHTML:'',querySelectorAll:()=>[]};
 const state={placements,owner:'ALL',history:[],activity:[],activityReady:true,trackingReady:true,loadError:false,initialLoadSettled:true,campaigns:[]};
 const ctx={Date:MockDate,Map,Set,state,el:id=>id==='historicalWeeks'?root:null,
  fmt:n=>String(n),money:n=>n===null?'N/A':'$'+Number(n),display:n=>n===null?'N/A':String(n),esc:s=>String(s),number:v=>v===null||v===undefined||v===''?null:Number(v),
  validDate:s=>s?new MockDate(s):null,isLive:p=>p.posted===true,postDate:p=>p.postedAt?new MockDate(p.postedAt):null,
  day:d=>d.toISOString().slice(0,10),shift:(d,n)=>{const t=new MockDate(d+'T12:00:00Z');t.setUTCDate(t.getUTCDate()+n);return t.toISOString().slice(0,10)},
  weekStart:d=>{const t=new MockDate(d);t.setUTCDate(t.getUTCDate()-(t.getUTCDay()+6)%7);return t.toISOString().slice(0,10)},
  campaignTag:p=>`<span>${p.code.slice(0,3)}</span>`,clicks:p=>0,compareUTMClicks:(a,b)=>a.code.localeCompare(b.code)};
 vm.runInNewContext(take('const STATS_WEEK_ONE=','function renderClickChart(scope){')+'\n'+take('// Historical keeps complete source-week cohorts.','function renderBulk(){')+'\nthis.run=renderHistorical;',ctx);
 return {ctx,root,run:ctx.run};
}
test('Historical excludes unpaid, unposted planned articles and empty draft-only weeks',()=>{
 const {root,run}=historicalFixture();run();const s=root.innerHTML;
 assert(!s.includes('UnpaidDraft')&&!s.includes('FutureDraft'));
 assert(!s.includes('data-week="2"'), 'a week containing only drafts must not show as an empty section');
 assert(s.includes('data-week="1"')&&s.includes('data-week="3"'));
 assert(s.includes('PaidLive')&&s.includes('ScheduledPaid')&&s.includes('UnpaidLive'));
 assert(s.includes('OldInactivePaidLive'), 'already published articles remain after the publisher is inactive');
 assert(s.includes('>Articles<span class="heading-accent">.</span></h3>'));
 const week1=s.slice(s.indexOf('data-week="1"'),s.indexOf('data-week="3"'));
 assert(week1.includes('3 placements'));
 assert.equal((week1.match(/class="historical-card /g)||[]).length,3);
 assert.equal((week1.match(/historical-is-paid/g)||[]).length,2);
});
test('Historical week summary colours reuse Dashboard colour variables and faded sparkle pattern',()=>{
 assert.match(css,/#page-historical \.historical-week-kpi\.historical-metric-articles\s*\{[\s\S]*?background:var\(--xtracker-live-gradient\)/);
 assert.match(css,/#page-historical \.historical-week-kpi\.historical-metric-money\s*\{[\s\S]*?background:var\(--xtracker-money-gradient\)/);
 assert.match(css,/#page-historical \.historical-week-kpi\.historical-metric-money::after\s*\{[\s\S]*?background-image:var\(--xtracker-sparkle-tile\)/);
 assert.match(css,/#page-historical \.historical-week-kpi\.historical-metric-articles > \*,[\s\S]*?color:#fff/);
});
test('UTM click chart dates have axis spacing and responsive panel room',()=>{
 assert.match(css,/#page-stats #clickChart\.click-chart \{ margin-bottom:27px; \}/);
 assert.match(css, /#page-stats #clickChart \.click-bar-label \{[\s\S]*?top:calc\(100% \+ 16px\)/);
});
test('All user-facing site source is free of em dashes, en dashes and encoded forms',()=>{
 for(const file of ['public/index.html','public/app.js','public/styles.css','public/click-preferences.html','netlify/functions/dashboard.mjs']){
  const s=read(file);
  for(const str of [String.fromCodePoint(8211),String.fromCodePoint(8212),'\\u2013','\\u2014','&mdash;','&ndash;','&#8212;','&#8211;'])
   assert(!s.includes(str),`${file} contains a typographical dash`);
 }
});
test('Version and all backend tracking safeguards survive unchanged',()=>{
 assert.match(app,/APP_VERSION='4\.9\.1'/);
 assert.match(read('public/index.html'),/app\.js\?v=4\.9\.1/);
 assert.match(read('netlify/functions/dashboard.mjs'),/uiVersion:'4\.9\.1'/);
 assert.equal(readdirSync(new URL('../netlify/functions/',import.meta.url)).filter(x=>x.endsWith('.mjs')).length,8);
 assert.match(read('netlify/lib/click-baseline.mjs'),/2026-10-17T00:32:36/);
 assert.match(app,/setInterval\(\(\)=>\{if\(!document\.hidden\)load\(\);\},60000\)/);
});
