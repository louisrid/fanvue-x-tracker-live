import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const js=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/styles.css',import.meta.url),'utf8');
const fn=(start,end)=>{const i=js.indexOf(start),j=js.indexOf(end,i);assert(i!==-1&&j>i,'missing '+start);return js.slice(i,j);};
const today=Date.parse('2026-10-17T12:00:00.000Z');
class DateNow extends Date{static now(){return today;}}
const live=(code,days=1,overrides={})=>({code,publisher:code,articleLabel:'ARTICLE 2.1',active:true,paid:true,posted:true,postUrl:'https://x.com/test/status/2111442075753582651',postedAt:new Date(today-days*86400000).toISOString(),countVerified:true,clicks:3,xViews:300,xLikes:10,cost:100,...overrides});
const pending=(code,overrides={})=>({code,publisher:code,articleLabel:'ARTICLE 2.2',active:true,paid:true,posted:false,countVerified:true,clicks:0,cost:170,...overrides});
const records=[live('A01-P14',2,{cost:100,clicks:7,xViews:400}),live('A01-P18',2,{articleLabel:'ARTICLE 2.2',cost:130,clicks:2,xViews:null}),live('A01-P19',1,{cost:170,clicks:11,xViews:100}),live('A01-P13',10,{cost:120,clicks:18,xViews:1200}),pending('A01-P01',{cost:190}),pending('A01-P20',{cost:150}),pending('UNPAID',{paid:false,cost:200})];
function context(){
  const ids=Object.fromEntries(['homeArticleSearch','homeArticleScope','homeArticleArticle','homeArticleSort','weeklyCount','weeklyGrid','homeFilterSummary','upcomingCount','upcomingGrid','upcomingSection'].map(id=>[id,{value:'',textContent:'',innerHTML:'',hidden:false,title:''}]));
  ids.homeArticleScope.value='recent';ids.homeArticleArticle.value='ALL';ids.homeArticleSort.value='clicks';
  const c={Date:DateNow,el:id=>ids[id],state:{homeVerified:true},homePlacements:()=>records.filter(p=>p.paid),
    fmt:n=>String(n),esc:s=>String(s),isLive:p=>p.posted===true,isNew:p=>p.posted===true&&today-new Date(p.postedAt).getTime()<7*86400000,
    postDate:p=>p.postedAt?new Date(p.postedAt):null,number:x=>x===null||x===undefined||x===''?null:Number(x),clicks:p=>p.clicks,
    weeklyCard:p=>`<article data-code="${p.code}"></article>`};
  runInNewContext(fn('const compareUTMClicks=','const accountKey=')+fn('const homeFilterQuery=','function renderHomeChart(){'),c);
  return {c,ids};
}
test('homepage filter defaults to recent paid live articles; upcoming remains separate',()=>{
  const {c,ids}=context();c.renderWeekly();
  assert.equal(ids.weeklyCount.textContent,'3');assert.equal(ids.upcomingCount.textContent,'2');
  assert(!ids.weeklyGrid.innerHTML.includes('A01-P13'));assert(!ids.upcomingGrid.innerHTML.includes('UNPAID'));
  assert.equal(ids.homeFilterSummary.textContent,'');
});
test('show all live and filter by article or publisher, including upcoming filters',()=>{
  const {c,ids}=context();ids.homeArticleScope.value='all';c.renderWeekly();assert.equal(ids.weeklyCount.textContent,'4');
  ids.homeArticleArticle.value='ARTICLE 2.2';c.renderWeekly();assert.equal(ids.weeklyCount.textContent,'1');assert.equal(ids.upcomingCount.textContent,'2');
  ids.homeArticleArticle.value='ALL';ids.homeArticleSearch.value='A01-P14';c.renderWeekly();
  assert.equal(ids.weeklyCount.textContent,'1');assert.equal(ids.upcomingCount.textContent,'0');
  assert(ids.weeklyGrid.innerHTML.includes('A01-P14'));
});
test('sorting respects measured clicks, views and unavailable values without inventing zeroes',()=>{
  const {c,ids}=context();ids.homeArticleScope.value='all';ids.homeArticleSort.value='clicks';c.renderWeekly();
  assert(ids.weeklyGrid.innerHTML.indexOf('A01-P13')<ids.weeklyGrid.innerHTML.indexOf('A01-P19'));
  ids.homeArticleSort.value='views';c.renderWeekly();
  assert(ids.weeklyGrid.innerHTML.indexOf('A01-P13')<ids.weeklyGrid.innerHTML.indexOf('A01-P18'));
  ids.homeArticleSort.value='name';c.renderWeekly();
  assert(ids.weeklyGrid.innerHTML.indexOf('A01-P13')<ids.weeklyGrid.innerHTML.indexOf('A01-P14'));
});
test('home article filters are mobile-sized, keyboard accessible and offer reset',()=>{
  for(const id of ['homeArticleSearch','homeArticleScope','homeArticleArticle','homeArticleSort','homeArticleReset','homeFilterSummary','resetTrackerFilters','trackerPaid','trackerArticle'])
    assert(html.includes(`id="${id}"`),'Missing '+id);
  assert(!html.includes('data-page="placements"')); // removed from visible navigation
  assert(css.includes('/* X Tracker compact article filters (ui3) */'));
  assert(css.includes('@media(max-width:760px)'));
});
test('spend icon is an outlined wallet not a hand-drawn currency symbol',()=>{
  assert(js.includes('money:\'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"'));
  assert(js.includes('kpi-support-badge'));
  assert(css.includes('#dashboardKpis .kpi-support-badge'));
});
test('homepage and backend deploy versions match 4.7.8 and no Netlify HUD is embedded',()=>{
  assert(js.includes("const APP_VERSION='4.9.1'"));
  assert(html.includes('/app.js?v=4.9.1')&&html.includes('/styles.css?v=4.9.1'));
  assert(!html.includes('src="/.netlify/scripts/hud?'));
});
