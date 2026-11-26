import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ExcelJS from 'exceljs';
import {countPlannedAsPaid} from '../netlify/functions/gta-report.mjs';
import {assembleCampaignOverview} from '../netlify/functions/campaign-overview.mjs';
import {parseDirectory,createDirectoryHandler} from '../netlify/functions/publisher-directory.mjs';
await import('../public/fanvue-core.js');
const C=globalThis.FanvueCore;
const url=n=>'https://x.com/publisher/status/'+n;
const campaign=(id,rows,extra={})=>({id,source:'CONNECTED',rows,paidCount:rows.filter(r=>r.paid&&!r.planned).length,paidSpendKnown:rows.filter(r=>r.paid&&!r.planned).reduce((n,r)=>n+(r.cost||0),0),unknownPaidCosts:0,...extra});
function app(overview,extras={}){
  const window={FanvueCore:C,FanvueDirectory:{state:{accounts:[]},load(){}},XTrackerCampaignReporting:{getData:()=>overview,status:()=>({}),ensure(){},discord:()=>extras.discord||{},refreshDiscord(){}},XTrackerApp:{dashboard:()=>extras.dashboard||null,gta:()=>({report:null}),of:()=>({report:extras.of}),loadGta(){},loadOf(){}}};
  const context=vm.createContext({window,location:{hash:'#home'},document:{readyState:'loading',addEventListener(){}},URL,Intl,Date,Math,Map,Set,Number,String,Array,Object,JSON,console,setTimeout,clearTimeout});
  vm.runInContext(readFileSync('public/fanvue-ui.js','utf8'),context);
  vm.runInContext(readFileSync('public/fanvue-app.js','utf8'),context);
  return window.FanvueApp.reporting;
}
test('planned bookings never become paid; legacy synthetic flags are removed idempotently',()=>{
  const input=[{campaign:'GTAQ2',paid:false,cost:100},{campaign:'GTAM',paid:true,planned:true,cost:50},{campaign:'GTAM',paid:true,cost:180}];
  const rows=countPlannedAsPaid(input);
  assert.deepEqual(rows.map(r=>r.paid),[false,false,true]);
  assert.deepEqual(countPlannedAsPaid(rows),rows);
  assert.equal(input[1].paid,true,'source objects must not be mutated');
});
test('paid, committed, planned and remaining are separate amounts in the reporting feed',()=>{
  const rows=countPlannedAsPaid([{campaign:'GTAQ2',paid:false,cost:100},{campaign:'GTAQ',paid:false,cost:40},{campaign:'GTAQ',paid:true,cost:180}]);
  const group={ready:true,source:'CONNECTED',publishers:rows,shortIo:{}};
  const ov=assembleCampaignOverview({gta:{data:{...group,budget:{amount:1000,currency:'USD'},originals:{...group,publishers:[]},instagram:{...group,publishers:[]},mandy:{...group,publishers:[]}}}});
  const s=C.campaignSummary(ov,'gta-vi');
  assert.equal(s.spend.value,180);assert.equal(s.committed,40);assert.equal(s.planned,100);assert.equal(s.budget.remaining.value,680);
});
test('CPC and clicks per dollar use matched paid traffic and exclude planned and shared counters',()=>{
  const rows=[{paid:true,posted:true,cost:100,clicks:25,trackingUrl:'https://example.com/a',postUrl:url(1)},{paid:true,planned:true,posted:true,cost:500,clicks:1000,trackingUrl:'https://example.com/b',postUrl:url(2)},{paid:true,posted:true,cost:1000,clicks:500,sharedTracking:true,trackingUrl:'https://example.com/c',postUrl:url(3)}];
  assert.equal(C.efficiency([{rows}]).cpc.value,4);
  assert.equal(1/C.efficiency([{rows}]).cpc.value,.25);
});
test('weekly spend follows payment date independently of post date; undated payments are partial',()=>{
  const ov={campaigns:[campaign('x-articles',[{code:'A1',paid:true,posted:true,cost:100,paidAt:'2026-11-24T12:00:00Z',postUrl:url(1)},{code:'A2',paid:true,posted:true,cost:250,postUrl:url(2)}])]};
  const r=app(ov).periodTotals('2026-11-23','2026-11-29');
  assert.equal(r.spend.value,100);assert.equal(r.spend.state,'partial');
  const missing=app({campaigns:[campaign('x-articles',[{code:'A3',paid:true,cost:50}])]}).periodTotals('2026-11-23','2026-11-29');
  assert.equal(missing.spend.value,null);
});
test('views never fabricate zero gain on a day with no reading or assign multi-day gains to a single day',()=>{
  const d=C.dailySeries([{id:'old',at:'2026-11-23T12:00:00Z',views:100},{id:'old',at:'2026-11-26T12:00:00Z',views:400}],{now:Date.parse('2026-11-26T15:00:00Z')});
  assert.ok(d.gained.every(p=>p.value===null));
});
test('Discord periods before snapshots remain unknown and net growth can be negative',()=>{
  const a=app({campaigns:[]},{discord:{members:{history:[{date:'2026-11-25',memberCount:100},{date:'2026-11-26',memberCount:90}],latest:{date:'2026-11-26',memberCount:90}},clicks:{total:10,daysTotal:10,days:{'2026-11-26':10}}}});
  const d=a.discordStats('2026-11-23','2026-11-26','2026-11-16','2026-11-22');
  assert.equal(d.last.growth.value,null);assert.equal(d.last.members.value,null);assert.equal(d.last.clicks.value,null);assert.equal(d.all.growth.value,-10);
});
test('Viral QRTs is a view of the same placement, not another global cost or original-view total',()=>{
  const row={code:'M1',campaign:'GTAM',sourceTab:'Mandy',sourceRow:8,publisher:'P',paid:true,posted:true,cost:50,clicks:10,views:100,trackingUrl:'https://example.com/a',postUrl:url(1)};
  const ov={campaigns:[campaign('gta-mandy',[row],{postPublicationClicks:10,quotedOriginals:{rows:[{originalPostId:'99',originalUrl:url(99),handle:'original',views:1000000,qrts:[{postUrl:url(1)}]}]}})]};
  const a=app(ov);const html=a.pages['viral-qrts']({}).body;
  assert.match(html,/1,000,000/);assert.match(html,/Excluded from our QRT results/);
  assert.equal(a.xKpis([{raw:row,paid:true,type:'QRT',clicks:C.M.value(10)}]).views.value,100);
  assert.ok(!C.CAMPAIGNS.some(c=>c.key==='viral-qrts'));
});
test('publisher directory exposes only identities and merges duplicate platform handles',()=>{
  const b=new ExcelJS.Workbook();for(const name of ['X_ AI','X_ News']){const s=b.addWorksheet(name);s.getRow(5).values=['X · @SameUser',10000,50,null,null,null,'PRIVATE PAYMENT DETAILS'];}
  const rows=parseDirectory(b);assert.equal(rows.length,1);assert.deepEqual(Object.keys(rows[0]).sort(),['handle','key','platform','profileUrl']);assert.ok(!JSON.stringify(rows).includes('PRIVATE'));
});
test('OF Terms has one publisher results page; Accounts has history, filters and no graph',()=>{
  const a=app({campaigns:[campaign('of-terms',[])]});
  const of=a.pages['of-terms']({}).body,accounts=a.pages['all-accounts']({}).body;
  assert.doesNotMatch(of,/fv-subnav/);assert.doesNotMatch(accounts,/acc-chart/);
});

test('directory returns a safe dated snapshot even when storage and source are unavailable',async()=>{
  const handler=createDirectoryHandler({storeFactory:()=>{throw Error('private environment error')},fetcher:async()=>{throw Error('source offline')}});
  const response=await handler();assert.equal(response.status,200);const data=await response.json();assert.equal(data.ok,true);assert.equal(data.stale,true);assert.equal(data.accounts.length,342);assert.ok(data.checkedAt);assert.ok(!JSON.stringify(data).includes('private environment error'));
});

test('chart hover targets remain inside the plot and cannot cover sidebar navigation',()=>{
  const context=vm.createContext({window:{FanvueCore:C},URL,Intl,Date,Math,Number,String,Array,Object,Map,Set,JSON});
  vm.runInContext(readFileSync('public/fanvue-ui.js','utf8'),context);
  const plot={clientWidth:600,clientHeight:230,innerHTML:''};
  for(const n of [1,2,3,20]){
    const series=Array.from({length:n},(_,i)=>({week:'2026-11-'+String(i+1).padStart(2,'0'),label:String(i+1),value:i+1}));
    context.window.FanvueUI.drawChart({querySelector:()=>plot},{series,title:'Views'},'line');
    const targets=[...plot.innerHTML.matchAll(/class="fv-hit" style="left:([0-9.-]+)px;width:([0-9.-]+)px/g)];
    assert.equal(targets.length,n);for(const hit of targets){assert.ok(Number(hit[1])>=0);assert.ok(Number(hit[1])+Number(hit[2])<=600);}
  }
});
