import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const js=read('../public/app.js'),html=read('../public/index.html'),css=read('../public/styles.css');
const part=(start,end)=>{const a=js.indexOf(start),b=js.indexOf(end,a);assert(a>=0&&b>a,`${start} missing`);return js.slice(a,b);};
const base={clicks:p=>p.verified?p.clicks:null,postDate:p=>p.date?new Date(p.date):null};
test('all article-containing sections choose verified UTM clicks first by default',()=>{
 assert(html.includes('<option value="clicks" selected>Most UTM clicks</option>'));
 assert(html.includes('<option value="clicks" selected>Most clicks</option>'));
 assert(html.includes('<option value="clicks">UTM clicks</option>'));
 assert(html.includes('<option value="clicks">UTM Clicks</option>'));
 assert(js.includes("el('homeArticleSort').value='clicks'"));
 assert(js.includes("el('trackerSort').value='clicks'"));
 assert(js.includes("el('accountSort').value='clicks'"));
 assert(js.includes("homeChart:'clicks'"));
 assert(html.includes('data-home-chart="clicks" aria-pressed="true"'));
 assert(js.includes('const rows=[...a.items].sort(compareUTMClicks);'));
 assert(js.includes('[...s.list].sort(compareUTMClicks)'));
});
test('verified zero clicks precede missing counts and newest post breaks ties',()=>{
 const ctx={...base,Date};
 const compare=runInNewContext(part('const compareUTMClicks=','const accountKey=')+'\ncompareUTMClicks',ctx);
 const items=[
  {publisher:'B',verified:true,clicks:7,date:'2026-10-11T12:00:00Z'},
  {publisher:'U',verified:false,clicks:99,date:'2026-10-17T12:00:00Z'},
  {publisher:'A',verified:true,clicks:7,date:'2026-10-16T12:00:00Z'},
  {publisher:'Z',verified:true,clicks:0,date:'2026-10-16T12:00:00Z'},
 ];
 const names=items.sort(compare).map(x=>x.publisher);
 assert.deepEqual(names,['A','B','Z','U']);
});
test('planned cards show UTM clicks and price, not unposted views or likes',()=>{
 const ctx={state:{selected:new Set()},isLive:p=>p.live,isNew:()=>false,esc:s=>String(s),campaignTag:()=>'<span class="article-campaign-chip">Campaign A01</span>',
    display:n=>n===null?'N/A':String(n),clicks:p=>p.clicks,money:n=>'$'+n,
    number:n=>n,ratio:()=>1,fixed:()=> '1.00',postDate:()=>null,pubDate:()=>'',};
 runInNewContext(part('function placementCard(p){','function renderTracker(){'),ctx);
 const p={code:'A01-P05',publisher:'Test',live:false,cost:120,clicks:0,platform:'X',articleLabel:'ARTICLE 2.5',paid:true};
 const upcoming=ctx.placementCard(p);
 assert(upcoming.includes('metrics-planned'));
 assert(upcoming.includes('<span>Price</span><strong>$120</strong>'));
 assert(!upcoming.includes('<span>Views</span>'));
 assert(!upcoming.includes('<span>Likes</span>'));
 const published=ctx.placementCard({...p,live:true});
 assert(published.includes('metrics-live'));
 assert(published.includes('<span>Views</span>'));
 assert(published.includes('<span>Likes</span>'));
});
test('click-preferences redesign retains original cookie opt-out implementation',()=>{
 const prefs=read('../public/click-preferences.html');
 assert(prefs.includes("fanvue_exclude_clicks=1; Max-Age=31536000; Path=/; Secure; SameSite=Lax"));
 assert(prefs.includes("fanvue_exclude_clicks=; Max-Age=0; Path=/; Secure; SameSite=Lax"));
 assert(prefs.includes('id="status" role="status"'));
 assert(prefs.includes('/?app=4.9.1#dashboard'));
 assert(css.includes('grid-template-columns:repeat(5,minmax(0,1fr))'));
 assert(css.includes('grid-template-columns:repeat(3,minmax(0,1fr))'));
});
