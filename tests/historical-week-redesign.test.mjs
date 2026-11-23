import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {summariseClickActivity} from '../netlify/functions/dashboard.mjs';

const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const start=app.indexOf('function renderHistorical(){');
const end=app.indexOf('\nfunction renderBulk(){',start);
assert(start>=0&&end>start);
const renderSource=app.slice(start,end);
const weekLogic=app.slice(app.indexOf('const STATS_WEEK_ONE='),app.indexOf('function selectedStatsWeek(){'));

const shift=(date,n)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
test('current campaign week comes from the fixed London start, including the DST change',()=>{
  for(const [instant,expected] of [
    ['2026-10-19T00:00:00Z',1],['2026-10-25T23:59:59Z',1],
    ['2026-10-27T12:00:00Z',2],['2026-11-02T00:00:00Z',3]
  ]){
    class MockDate extends Date {constructor(...args){super(...(args.length?args:[instant]));}static now(){return Date.parse(instant);}}
    const ctx={Date:MockDate,Intl,Math,Number,String,shift,
      day:d=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(d).replace(/(\d{2})\/(\d{2})\/(\d{4})/,'$3-$1-$2'),
      weekStart:d=>{const fmt=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);const p=Object.fromEntries(fmt.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));const local=`${p.year}-${p.month}-${p.day}`;return shift(local,-(new Date(local+'T12:00:00Z').getUTCDay()+6)%7);}
    };
    vm.runInNewContext(weekLogic+'\nthis.current=currentStatsWeekNumber;',ctx);
    assert.equal(ctx.current(),expected,instant);
  }
});
function fixture(activity,current=2){
  const root={innerHTML:''};
  const tabs={innerHTML:'',dataset:{},querySelector:()=>null};
  const state={historicalWeek:'current',owner:'ALL',placements:[{code:'A01-P14',sourceTab:'WEEK 1 - LOUIS',paid:true,posted:true,cost:100}],activity,activityReady:true,trackingReady:true};
  const ctx={Date,Intl,Map,Set,Math,Number,String,Array,state,STATS_WEEK_ONE:'2026-10-19',shift,
    el:id=>id==='historicalWeeks'?root:id==='historicalWeekTabs'?tabs:id==='page-historical'?{hidden:true}:id==='historicalSort'?{value:'recent'}:null,
    weeklyTabNumber:p=>Number(p.sourceTab.match(/WEEK (\d+)/)?.[1])||null,
    currentStatsWeekNumber:()=>current,
    historicalScope:(key,entries)=>key==='other'?null:{number:Number(key),from:shift('2026-10-19',(Number(key)-1)*7),to:shift('2026-10-19',(Number(key)-1)*7+6),today:current===2?'2026-10-27':'2026-11-03',isCurrent:key===String(current),placements:entries},
    isLive:p=>p.posted,weeklyCodeClicks:()=>new Map(),scopeEvents:scope=>activity.filter(e=>e.date>=scope.from&&e.date<=scope.to&&scope.placements.some(p=>p.code===e.code)),compareArticles:()=>0,clicks:()=>0,
    statsWeekKpis:()=>[{id:'articles',label:'Live articles',value:'0'},{id:'money',label:'Paid total',value:'$0'},{id:'clicks',label:'UTM clicks',value:'0'}],
    historicalCard:()=>'<button class="historical-card">Article</button>',
    fmt:n=>String(n),money:n=>'$'+n,number:n=>Number(n),display:n=>n===null?'N/A':String(n),esc:n=>String(n)
  };
  vm.runInNewContext(renderSource+'\nthis.renderHistorical=renderHistorical;',ctx);
  return {ctx,state,root,tabs};
}

test('campaign weeks follow the Sheet tabs and real UK click dates',()=>{
  const activity=summariseClickActivity([
    {timestamp:'2026-10-18T22:59:59.999Z',code:'A01-P14'},
    {timestamp:'2026-10-18T23:00:00.000Z',code:'A01-P14'},
    {timestamp:'2026-10-19T10:00:00.000Z',code:'A01-P14'},
    {timestamp:'2026-10-25T23:59:59.000Z',code:'A01-P14'},
    {timestamp:'2026-10-26T00:00:00.000Z',code:'A01-P14'},
    {timestamp:'2026-10-27T12:00:00.000Z',code:'A01-P14'}
  ]);
  const {ctx,root,tabs,state}=fixture(activity);
  ctx.renderHistorical();
  assert.match(tabs.innerHTML,/Week 1/);
  assert.match(tabs.innerHTML,/Week 2/);
  assert.match(tabs.innerHTML,/Week 3/);
  assert.match(tabs.innerHTML,/19 Oct – 25 Oct/);
  assert.match(tabs.innerHTML,/26 Oct – 1 Nov/);
  assert.match(tabs.innerHTML,/2 Nov – 8 Nov/);
  assert.doesNotMatch(tabs.innerHTML,/12 Oct – 18 Oct/);
  assert.match(tabs.innerHTML,/Week 2<\/strong><em class="historical-live">LIVE/);
  assert.match(root.innerHTML,/data-week="2" open/);
  const week1=root.innerHTML.split('data-week="1"')[1].split('data-week="2"')[0];
  const week2=root.innerHTML.split('data-week="2"')[1].split('data-week="3"')[0];
  assert.match(week1,/>3<\/strong>/);
  assert.match(week2,/>0<\/strong>/);
  assert.match(week2,/No placements recorded for Week 2 yet/);
  state.historicalWeek='1';ctx.renderHistorical();
  assert.match(root.innerHTML,/data-week="1" open/);
  assert.doesNotMatch(root.innerHTML,/data-week="2" open/);
});

test('future weeks appear automatically and the UK DST change keeps the boundary correct',()=>{
  const activity=summariseClickActivity([
    {timestamp:'2026-10-25T23:59:59.000Z',code:'A01-P14'},
    {timestamp:'2026-10-26T00:00:00.000Z',code:'A01-P14'}
  ]);
  assert.deepEqual(activity.map(row=>row.date),['2026-10-25','2026-10-26']);
  const {ctx,root,tabs}=fixture(activity,3);
  ctx.renderHistorical();
  assert.match(tabs.innerHTML,/Week 3<\/strong><em class="historical-live">LIVE/);
  assert.match(root.innerHTML,/data-week="3" open/);
  assert.match(tabs.innerHTML,/Week 4/);
  assert.match(tabs.innerHTML,/2 Nov – 8 Nov/);
  assert.match(root.innerHTML.split('data-week="3"')[1].split('data-week="4"')[0],/>0<\/strong>/);
});
