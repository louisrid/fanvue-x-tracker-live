import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const js=read('../public/app.js'),html=read('../public/index.html'),css=read('../public/styles.css');
const start=js.indexOf('function currentMetrics('),end=js.indexOf('const metricDefs=',start);
const fromKpi=js.indexOf('function renderKpis(){'),toKpi=js.indexOf('function notify(',fromKpi);
assert(start>=0&&end>start&&fromKpi>=0&&toKpi>fromKpi);
const source=js.slice(start,end)+'\n'+js.slice(fromKpi,toKpi);
const now=Date.parse('2026-10-17T16:00:00Z');
class Clock extends Date {
  constructor(...args){super(...(args.length?args:['2026-10-17T16:00:00Z']));}
  static now(){return now;}
}
const p=(code,opts={})=>({code,active:true,paid:true,posted:true,cost:100,postedAt:'2026-10-16T12:00:00Z',postUrl:'https://x.com/test/status/2111442075753582651',...opts});
function mock(ready=true){
 const ps=[p('A01-P14'),p('A01-P18'),p('A01-P77',{paid:false,posted:false}),p('A01-P90',{active:false})];
 const act=[{date:'2026-10-17',code:'A01-P14',clicks:7},{date:'2026-10-16',code:'A01-P18',clicks:8},{date:'2026-10-17',code:'A01-P77',clicks:3},{date:'2026-10-17',code:'A01-P90',clicks:200},{date:'2026-10-10',code:'A01-P14',clicks:99}];
 const nodes={dashboardKpis:{innerHTML:''},detailedKpis:{innerHTML:''}};
 const state={activityReady:ready,trackingReady:true,homeVerified:true};
 const c={Date:Clock,state,
   el:id=>nodes[id],eligible:()=>ps.filter(x=>x.active),homePlacements:()=>ps.filter(x=>x.active&&x.paid),
   activity:()=>act,clicks:()=>0,countActivity:(from,to,rows)=>rows.reduce((n,r)=>n+(r.date>=from&&r.date<=to?r.clicks:0),0),
   day:d=>d.toISOString().slice(0,10),weekStart:()=> '2026-10-12',monthStart:()=> '2026-10-01',
   number:x=>x===null||x===undefined||x===''?null:Number(x),validDate:x=>x?new Date(x):null,
   postDate:x=>x.postedAt?new Date(x.postedAt):null,isLive:x=>x.posted,isNew:x=>x.posted,
   money:n=>'$'+n,display:x=>x===null?'\N/A':String(x),fmt:x=>String(x),
   kpiCard:k=>`<div data-id="${k.id}"><span>${k.label}</span><b>${k.value}</b></div>`,
   metricDefs:()=>[],renderHomeChart:()=>{}}
 runInNewContext(source,c);
 return {c,ps,nodes};
}
test('requested homepage labels and new asset versions are consistent',()=>{
 assert(html.includes('id="dashboardTitle">This week<span class="heading-accent">.</span>'));
 assert(html.includes('id="weeklyHeading">Live articles<span class="heading-accent">.</span>'));
 assert(js.includes("const APP_VERSION='4.9.1'"));
 assert(read('../netlify/functions/dashboard.mjs').includes("uiVersion:'4.9.1'"));
 assert(html.includes('/app.js?v=4.9.1')&&html.includes('/styles.css?v=4.9.1'));
});
test('weekly clicks include all ACTIVE placements, not last week or lifetime totals',()=>{
 const {c,ps,nodes}=mock();const v=c.currentMetrics(ps.filter(x=>x.active));
 assert.equal(v.weekClicks,18);
 c.renderKpis();
 assert.match(nodes.dashboardKpis.innerHTML,/data-id="clicks".*?UTM clicks this week.*?<b>18<\/b>/);
 assert.match(nodes.dashboardKpis.innerHTML,/data-id="money"/);
 assert.match(nodes.dashboardKpis.innerHTML,/data-id="articles"/);
 const ids=[...nodes.dashboardKpis.innerHTML.matchAll(/data-id="(\w+)"/g)].map(m=>m[1]);
 assert.deepEqual(ids,['money','articles','clicks']);
});
test('no click activity available is shown as unavailable, never invented zero',()=>{
 const {c,nodes}=mock(false);c.renderKpis();
 assert(nodes.dashboardKpis.innerHTML.includes('<b>\N/A</b>'));
 assert.equal(c.currentMetrics(c.eligible()).weekClicks,null);
});
test('tall blue spend left, compact pink and charcoal on right with sparkles',()=>{
 const latest=css.slice(css.indexOf('/* X Tracker v4.8.0:'));
 assert(latest.includes('"spend live"')&&latest.includes('"spend clicks"'));
 assert(latest.includes('grid-area:spend')&&latest.includes('grid-area:clicks')&&latest.includes('grid-area:live'));
 assert(latest.includes('background:var(--xtracker-money-gradient)'));
 assert(latest.includes('linear-gradient(126deg,#050506 0%,#15161b 46%,#383940 100%)'));
 assert(latest.includes('background:var(--xtracker-live-gradient)'));
 assert(latest.includes('keep the existing shared sparkle overlay'));
 assert(css.includes('radial-gradient(circle at 8% 26%'));
 assert(css.includes('height:196px')&&css.includes('height:198px')); 
});
test('tracked redirects, reset cutoff, click exclusions and Sheet polling are unchanged',()=>{
 const funcs=readdirSync(new URL('../netlify/functions/',import.meta.url)).filter(x=>x.endsWith('.mjs')).sort();
 assert.deepEqual(funcs,['admin.mjs','dashboard.mjs','events.mjs','health.mjs','metrics.mjs','redirect.mjs','refresh-x-metrics.mjs','resolve.mjs']);
 const toml=read('../netlify.toml');
 for(const path of ['/r/:code','/s/:code','/p/:code'])assert(toml.includes(path));
 assert(read('../netlify/lib/click-baseline.mjs').includes('2026-10-17T00:32:36'));
 assert(read('../public/click-preferences.html').includes('fanvue_exclude_clicks=1'));
 assert(js.includes('setInterval(()=>{if(!document.hidden)load();},60000)'));
});
