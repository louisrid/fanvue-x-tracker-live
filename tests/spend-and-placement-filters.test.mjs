import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const s=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const part=(a,b)=>{const i=s.indexOf(a),j=s.indexOf(b,i);assert(i!==-1&&j>i,`Missing ${a}`);return s.slice(i,j);};
const today=new Date('2026-10-17T15:30:00Z');
const p=(code,cost,paid=true,posted=true,extra={})=>({code,publisher:code,articleLabel:'ARTICLE 2.1',campaignId:'UNASSIGNED',platform:'X',owner:'LOUIS',active:true,paid,posted,postUrl:posted?'https://x.com/test/status/2111442075753582651':'',postedAt:posted?'2026-10-17T13:00:00Z':'',cost,clicks:10,xViews:100,xLikes:7,countVerified:true,...extra});
const items=[p('A01-P19',170),p('A01-P14',100),p('A01-P18',130),p('A01-P01',190),p('A01-P20',150,true,false),p('A01-P17',250,false,false)];
const tzDay=x=>x.toISOString().slice(0,10);
function metricCtx(list=items){
  const ctx={Date,day:tzDay,weekStart:()=> '2026-10-12',monthStart:()=> '2026-10-01',
    state:{activityReady:false,trackingReady:true},postDate:x=>x.postedAt?new Date(x.postedAt):null,isLive:x=>x.posted,
    number:x=>x===undefined||x===null||x===''?null:Number(x),validDate:x=>x?new Date(x):null,
    activity:()=>[],countActivity:()=>0,clicks:x=>x.clicks,
    eligible:()=>list};
  runInNewContext(part('function currentMetrics(','const metricDefs='),ctx);
  return ctx;
}
test('missing Sheet payment dates show a labelled paid total with the matching article count',()=>{
  const ctx=metricCtx();const v=ctx.currentMetrics(items.filter(x=>x.paid));
  assert.equal(v.monthDollars,740);assert.equal(v.monthPaidCount,5);
  assert.equal(v.monthSpendBasis,'paidFallback');assert.equal(v.undatedPaidCount,5);
});
test('complete dated months exclude old costs; undated spend shows the current paid total as an estimate',()=>{
  const list=[p('THIS-MONTH',50,true,true,{paidAt:'2026-10-15'}),p('LAST-MONTH',75,true,true,{paidAt:'2026-09-11'}),p('NO-DATE',100)];
  const v=metricCtx(list).currentMetrics(list);
  assert.equal(v.monthDollars,225);assert.equal(v.monthPaidCount,3);
  assert.equal(v.monthSpendBasis,'paidFallback');assert.equal(v.undatedPaidCount,1);
  const known=list.slice(0,2);const vk=metricCtx(known).currentMetrics(known);
  assert.equal(vk.monthDollars,50);assert.equal(vk.monthPaidCount,1);assert.equal(vk.monthSpendBasis,'paidAt');
});
test('article tracker filters payment, article, campaign, publisher and numeric bounds independently',()=>{
  const nodes=Object.fromEntries(['trackerSearch','trackerStatus','trackerPaid','trackerArticle','trackerPlatform','trackerCampaign','trackerFrom','trackerTo','trackerMinClicks','trackerMinViews','trackerMaxCost','trackerSort','trackerDirection'].map(x=>[x,{value:''}]));
  for(const x of ['trackerStatus','trackerPaid','trackerArticle','trackerPlatform','trackerCampaign'])nodes[x].value='ALL';
  nodes.trackerSort.value='clicks';nodes.trackerDirection.value='desc';
  const ctx={el:id=>nodes[id],eligible:()=>items,number:x=>x===undefined||x===null||x===''?null:Number(x),
    clicks:x=>x.clicks,ratio:x=>x.clicks/x.cost,postDate:x=>x.postedAt?new Date(x.postedAt):null,isLive:x=>x.posted,
    isBetween:(date,from,to)=>!from&&!to||(date&&date.toISOString().slice(0,10)>=from&&date.toISOString().slice(0,10)<=to)};
  runInNewContext(part('const compareUTMClicks=','const accountKey=')+part('function filteredPlacements(){','function placementCard(p){'),ctx);
  nodes.trackerPaid.value='PAID';assert.equal(ctx.filteredPlacements().length,5);
  nodes.trackerPaid.value='UNPAID';assert.equal(ctx.filteredPlacements().length,1);
  nodes.trackerPaid.value='ALL';nodes.trackerStatus.value='LIVE';assert.equal(ctx.filteredPlacements().length,4);
  nodes.trackerStatus.value='ALL';nodes.trackerMinClicks.value='11';assert.equal(ctx.filteredPlacements().length,0);
  nodes.trackerMinClicks.value='';nodes.trackerMaxCost.value='125';assert.equal(ctx.filteredPlacements().length,1);
  nodes.trackerMaxCost.value='';nodes.trackerSearch.value='A01-P20';assert.equal(ctx.filteredPlacements()[0].code,'A01-P20');
  nodes.trackerSearch.value='';nodes.trackerArticle.value='OTHER';assert.equal(ctx.filteredPlacements().length,0);
});
test('all existing essential tracking functions remain present',()=>{
  const base=new URL('../netlify/functions/',import.meta.url);
  const fs=['admin','dashboard','events','health','metrics','redirect','refresh-x-metrics','resolve'];
  for(const name of fs){const content=readFileSync(new URL(name+'.mjs',base),'utf8');assert(content.includes('export'),'Missing exported function '+name);}
  const toml=readFileSync(new URL('../netlify.toml',import.meta.url),'utf8');
  for(const route of ['/r/:code','/s/:code','/p/:code'])assert(toml.includes(route));
});
