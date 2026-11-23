import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const js=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const begin=js.indexOf('function dailySeries('),end=js.indexOf('\nfunction niceTop(',begin);
assert(begin>0&&end>begin,'equivalised spend calculation source available');
const core=js.slice(begin,end);
const day=d=>d.toISOString().slice(0,10);
const shift=(str,n)=>new Date(Date.parse(str+'T12:00:00Z')+n*864e5).toISOString().slice(0,10);
function ctxWith(placements=[],fxRateGbp=0.8){
 const state={placements,owner:'ALL',fxRateGbp,fxRateDate:'2026-10-19',fxCheckedAt:0,fxLoading:false,initialLoadSettled:true,loadError:false,activityReady:true,activity:[]};
 const cache={};let renders=0;
 const ctx={state,day,shift,Date,Intl,Math,Number,AbortSignal,
    STATS_WEEK_ONE:'2026-10-19',homePlacements:()=>state.placements.filter(p=>p.owner==='LOUIS'&&p.sourceTab==='WEEK 2 - LOUIS'&&p.campaignId==='C005'),
    postDate:p=>p.postedAt?new Date(p.postedAt):null,
    number:x=>x===''||x===null||x===undefined?null:Number.isFinite(Number(x))?Number(x):null,
    validDate:x=>x?new Date(x):null,
    storage:{get:k=>cache[k]||null,set:(k,v)=>{cache[k]=v}},
    renderDailyOverview:()=>{renders++},
    fetch:async()=>({ok:true,json:async()=>({base:'USD',date:'2026-10-19',rates:{GBP:0.78}})})};
 vm.createContext(ctx);vm.runInContext(core,ctx);
 return {ctx,state,cache,get renders(){return renders}};
}
const p=(id,cost,date,extra={})=>({code:id,paid:true,posted:true,cost,postedAt:date,owner:'LOUIS',sourceTab:'WEEK 2 - LOUIS',campaignId:'C005',...extra});

test('Equivalised Spend totals only Paid and Posted Week 2 articles',()=>{
 const rows=[
  p('A02-P01',140,'2026-10-26T09:00:00Z',{paidAt:''}),
  p('A02-P02',210,'2026-10-27T15:00:00Z',{paidAt:''}),
  p('A02-P03',900,'2026-10-25T11:00:00Z'),
  p('A02-P04',600,'2026-10-26T09:00:00Z',{paid:false}),
  p('A02-P05',500,'2026-10-26T09:00:00Z',{posted:false}),
  p('A02-P06',400,'2026-10-26T09:00:00Z',{cost:null}),
  p('A02-P07',360,'2026-10-28T09:00:00Z'),
  p('A02-P08',100,''),
 ];
 const {ctx}=ctxWith(rows);
 const out=vm.runInContext('equivalisedSpendUsd(new Date("2026-10-27T20:00:00Z"))',ctx);
 assert.equal(out.totalUsd,350);
 assert.equal(out.articles,2);
 assert.equal(out.start,'2026-10-26');
 assert.equal(out.today,'2026-10-27');
 assert.equal(out.totalUsd*0.8/7,40);
});

test('Equivalised Spend divides total costs by SEVEN days, not by article count',()=>{
 const {ctx}=ctxWith([p('A02-P01',210,'2026-10-26T09:00:00Z')]);
 const out=vm.runInContext('equivalisedSpendUsd(new Date("2026-10-27T12:00:00Z"))',ctx);
 assert.equal(out.totalUsd/7,30);
 assert.equal(out.articles,1);
});

test('Equivalised Spend counts scoped publishers and shows zero with no eligible articles',()=>{
 const {ctx,state}=ctxWith([p('A02-P01',210,'2026-10-26T09:00:00Z'),p('A02-P02',140,'2026-10-26T09:00:00Z',{owner:'CONNOR'})]);
 state.owner='LOUIS';
 assert.equal(vm.runInContext('equivalisedSpendUsd(new Date("2026-10-27T12:00:00Z")).totalUsd',ctx),210);
 state.owner='ALL';
 assert.equal(vm.runInContext('equivalisedSpendUsd(new Date("2026-10-27T12:00:00Z")).totalUsd',ctx),210);
 state.placements=[];
 assert.equal(vm.runInContext('equivalisedSpendUsd(new Date("2026-10-27T12:00:00Z")).totalUsd',ctx),0);
});

test('Live GBP rate is validated, cached and refreshes independently of tracking code',async()=>{
 const {ctx,state,cache,getRenders}=ctxWith([]);
 await vm.runInContext('refreshGbpRate()',ctx);
 assert.equal(state.fxRateGbp,0.78);
 assert.equal(state.fxRateDate,'2026-10-19');
 assert.equal(JSON.parse(cache['xtracker-usd-gbp-fx-v1']).rate,0.78);
});

test('On unavailable FX rates, retain last confirmed rate rather than invent USD to GBP',async()=>{
 const {ctx,state}=ctxWith([]);
 ctx.fetch=async()=>{throw Error('FX offline')};
 await vm.runInContext('refreshGbpRate()',ctx);
 assert.equal(state.fxRateGbp,0.8);
 assert(state.fxCheckedAt>0);
});

test('Label cleanup removes excluded payment warning, legacy dated spend KPI',()=>{
 assert(!js.includes(['Excludes','undated payments'].join(' ')));
 assert(!js.includes(['Dated spend','· 7 days'].join(' ')));
 assert(js.includes("label:'Equivalised Spend'"));
 assert(js.includes('spend.totalUsd*fx/7'));
 assert(js.includes('refreshGbpRate();'));
});
