import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const js=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../public/styles.css',import.meta.url),'utf8');
test('all primary pages share one narrow desktop max width',()=>{
  assert.match(css,/--xtracker-content-width:1120px/);
  for(const token of ['#mainContent.page-shell','#page-dashboard #weeklyGrid','#page-dashboard #dashboardKpis','#page-stats .daily-graph-card','#page-historical .historical-list','#page-campaigns .campaign-grid','#weeklySection > .section-heading']) assert(css.includes(token),token);
});
// Exercise the shared renderer so status, number formatting and historical
// snapshots remain correct when the presentation is reused across views.
const {default:vm}=await import('node:vm');
const renderer=js.slice(js.indexOf('function articleCardContent('),js.indexOf('function weeklyCard('));
const context={
  isLive:p=>p.live,clicks:p=>p.clicks,isNew:p=>p.fresh,
  esc:v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),
  display:v=>v==null?'N/A':Number(v).toLocaleString('en-GB'),
  campaignTag:()=>'<span class="article-campaign-chip">Campaign</span>',
  metricBadge:()=>'',
  postDate:()=>null,money:v=>'$'+v,fixed:v=>String(v),ratio:()=>2,
  recordedMetricFor:(p,key,scope)=>scope[key]
};
vm.createContext(context);
vm.runInContext(renderer+';this.render=articleCardContent;',context);
const article={publisher:'Example <Publisher>',code:'A01-P01',paid:true,cost:24,clicks:4520,xViews:123456,xLikes:987,live:true,fresh:true};
test('all article views share a renderer, retaining NEW and Scheduled statuses',()=>{
  for(const fn of ['weeklyCard','historicalCard','placementCard']){
    const body=js.slice(js.indexOf('function '+fn+'('));
    assert.match(body.slice(0,body.indexOf('\n}')),/articleCardContent\(p/);
  }
  const live=context.render(article);
  assert.match(live,/NEW!/);
  assert.match(live,/>POSTED</);
  assert.match(live,/Example &lt;Publisher>/);
  const scheduled=context.render({...article,live:false});
  assert.match(scheduled,/>Paid · Scheduled</);
  assert.equal((scheduled.match(/class="article-kpi article-kpi-/g)||[]).length,1);
});
test('live cards show complete UTM, Views and Likes values in order',()=>{
  const live=context.render(article);
  assert.equal((live.match(/class="article-kpi article-kpi-/g)||[]).length,3);
  assert(live.indexOf('article-kpi-clicks')<live.indexOf('article-kpi-views'));
  assert(live.indexOf('article-kpi-views')<live.indexOf('article-kpi-likes'));
  for(const number of ['4,520','123,456','987'])assert(live.includes(number));
  assert.match(context.render({...article,xLikes:null}),/>N\/A</);
});
test('Historical cards use scoped clicks and recorded snapshots instead of current metrics',()=>{
  const card=context.render(article,{live:true,value:123,scope:{xViews:456,xLikes:789}});
  // Site recommendations: UTM Clicks is shown as Clicks.
  assert.match(card,/Week Clicks/);
  for(const number of [123,456,789])assert(card.includes('>'+number+'<'));
  assert(!card.includes('123,456'));
});
