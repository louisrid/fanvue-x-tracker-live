import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const app=read('public/app.js'),html=read('public/index.html'),css=read('public/styles.css');
const snippet=app.slice(app.indexOf('function publishedCampaignGroups(){'),app.indexOf('function newestSnapshotByDay(){'));
assert(snippet.startsWith('function publishedCampaignGroups(){'));

function setup(){
  const placements=[
    {code:'A01-P14',publisher:'Brook',sourceTab:'WEEK 1 - LOUIS',cost:100,paid:true,posted:true,active:true,postUrl:'https://x.com/brook/status/2110038336114983391',campaignId:'UNASSIGNED',clicks:20,xViews:600,articleLabel:'ARTICLE 0.1',postedAt:'2026-10-13T15:00:00Z'},
    {code:'A01-P18',publisher:'Seph',sourceTab:'WEEK 1 - LOUIS',cost:130,paid:true,posted:true,active:false,postUrl:'https://x.com/seph/status/2110049980861817178',campaignId:'UNASSIGNED',clicks:10,xViews:400,articleLabel:'ARTICLE 0.2',postedAt:'2026-10-13T17:00:00Z'},
    {code:'A01-P19',publisher:'UnpaidPost',cost:50,paid:false,posted:true,postUrl:'https://x.com/u/status/2111442075753582651',campaignId:'UNASSIGNED',clicks:19},
    {code:'A01-P20',publisher:'Scheduled',cost:150,paid:true,posted:false,postUrl:'',campaignId:'UNASSIGNED',clicks:5},
    {code:'A01-P24',publisher:'Named',cost:250,paid:true,posted:true,active:true,postUrl:'https://x.com/n/status/2111466845593059445',campaignId:'C002',clicks:42,xViews:null,articleLabel:'ARTICLE 2.4',postedAt:'2026-10-17T15:00:00Z'},
    {code:'A02-P01',publisher:'EmptyCampaign',cost:350,paid:false,posted:true,postUrl:'https://x.com/e/status/2111466845593059445',campaignId:'C003',clicks:88},
  ];
  const nodes={campaignGrid:{innerHTML:'',querySelectorAll:()=>[]},campaignSearch:{value:''},campaignSort:{value:'clicks'},campaignsOverview:{innerHTML:''}};
  const state={placements,owner:'ALL',campaigns:[{id:'C001',name:'Empty'}, {id:'C002',name:'Fanvue Partners'}, {id:'C003',name:'Not Yet Active'}],trackingReady:true};
  const context={state,Map,Set,Math,Number,String,el:id=>nodes[id],
    number:v=>v===null||v===undefined||v===''?null:Number(v),
    isLive:p=>!!p.posted&&/^https:\/\/x.com\/[^/]+\/status\/\d+/.test(p.postUrl||''),
    clicks:p=>p.clicks??null,compareUTMClicks:(a,b)=>(b.clicks??-1)-(a.clicks??-1),
    postDate:p=>p.postedAt?new Date(p.postedAt):null,
    fmt:n=>String(n),money:n=>n===null?'N/A':'$'+Number(n).toLocaleString('en-GB'),
    display:n=>n===null?'N/A':String(n),
    esc:x=>String(x??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'),
  };
  vm.runInNewContext(snippet+'\nthis.exports={renderCampaigns,publishedCampaignGroups};',context);
  return {nodes,state,...context.exports};
}
test('Only campaigns with paid PUBLISHED articles are shown; real A01 code groups unassigned Sheet placements',()=>{
  const f=setup(),groups=f.publishedCampaignGroups();
  assert.equal(groups.length,2);
  assert.equal(groups[0].id,'A01');assert.equal(groups[0].name,'Campaign A01');
  assert.equal(groups[0].rows.length,2);
  assert.equal(groups[0].paid,230);
  assert.equal(groups[0].clicks,30);
  assert.equal(groups[1].name,'Fanvue Partners');
  assert.equal(groups[1].rows.length,1);
  assert(!groups.some(x=>x.id==='C001'||x.id==='C003'));
  // Released paid entries remain in campaign history after an account becomes inactive.
  assert(groups[0].rows.some(p=>p.publisher==='Seph'));
});
test('Campaign cards start collapsed, are blue, and expand into per-publisher clickable details',()=>{
  const f=setup();f.renderCampaigns();const s=f.nodes.campaignGrid.innerHTML;
  assert.match(s,/<details class="campaign-accordion"/);
  assert.match(s,/<summary class="campaign-summary"/);
  assert.match(s,/Campaign A01/);assert.match(s,/Fanvue Partners/);
  assert(!s.includes('>UnpaidPost<'));assert(!s.includes('>Scheduled<'));
  assert(!s.includes('>Not Yet Active<'));assert(!s.includes('>Empty<'));
  assert.match(s,/data-detail="A01-P14"/);assert.match(s,/data-detail="A01-P18"/);
  assert.match(s,/data-detail="A01-P24"/);
  assert.equal((s.match(/class="campaign-accordion"/g)||[]).length,2);
  assert(!s.includes('data-campaign-key="A01" open'));
  f.nodes.campaignGrid.querySelectorAll=()=>[{dataset:{campaignKey:'A01'}}];
  f.renderCampaigns();assert.match(f.nodes.campaignGrid.innerHTML,/data-campaign-key="A01" open/);
  assert.match(css,/#page-campaigns \.campaign-summary\s*\{/);
  assert.match(css,/#page-campaigns \.campaign-summary::after\s*\{/);
  assert.match(css,/background-image:var\(--xtracker-sparkle-tile\)/);
});
test('Campaign search and clicks sort are useful, with honest missing-metric states',()=>{
  const f=setup();f.renderCampaigns();
  assert(f.nodes.campaignGrid.innerHTML.indexOf('Fanvue Partners')<f.nodes.campaignGrid.innerHTML.indexOf('Campaign A01'),'42 click campaign first');
  f.nodes.campaignSearch.value='Brook';f.renderCampaigns();
  assert.match(f.nodes.campaignGrid.innerHTML,/Campaign A01/);assert(!f.nodes.campaignGrid.innerHTML.includes('Fanvue Partners'));
  f.nodes.campaignSearch.value='NoSuchAccount';f.renderCampaigns();assert.match(f.nodes.campaignGrid.innerHTML,/No paid, published campaigns match/);
  f.nodes.campaignSearch.value='';f.state.trackingReady=false;f.renderCampaigns();assert.match(f.nodes.campaignGrid.innerHTML,/>N\/A<\/strong>/);
  f.state.owner='CONNOR';f.renderCampaigns();assert.match(f.nodes.campaignGrid.innerHTML,/No paid, published campaigns match/);
});
test('Historical keeps all weeks and placements, with matching white accordion and coloured paid cards',()=>{
  assert.match(app,/function renderHistorical\(\)/);
  assert.match(app,/historical-is-paid/);
  assert.match(app,/historical-week-kpis/);
  assert.match(app,/historical-cards/);
  assert.match(css,/#page-historical \.historical-week-toggle::before/);
  assert.match(css,/#page-historical \.historical-metric-views/);
  assert.match(css,/#page-historical \.historical-metric-likes/);
  assert.match(html,/id="page-historical"/);
});
test('No em dashes in the website UI, source copy or encoded JS strings',()=>{
  for(const f of ['public/app.js','public/index.html','public/styles.css','public/click-preferences.html']){
    const s=read(f);
    assert(!s.includes(String.fromCodePoint(0x2014)),f+' contains an em dash');
    assert(!s.includes('\\u'+'2014'),f+' contains escaped em dash');
    assert(!s.includes('&md'+'ash;')&&!s.includes('&#8212;'),f+' contains HTML encoded em dash');
  }
  assert(app.includes("const display=n=>n===null||n===undefined||n===''?'N/A'"));
});
test('Full tracking backend stays present while cache-busting UI versions agree',()=>{
  assert.match(app,/APP_VERSION='4\.9\.1'/);
  assert.match(html,/styles\.css\?v=4\.9\.1/);
  assert.match(html,/app\.js\?v=4\.9\.1/);
  assert.match(read('netlify/functions/dashboard.mjs'),/uiVersion:'4\.9\.1'/);
  for(const name of ['admin','dashboard','events','health','metrics','redirect','refresh-x-metrics','resolve'])
    assert(read('netlify/functions/'+name+'.mjs').length>50,name);
  assert.match(app,/setInterval\(\(\)=>\{if\(!document\.hidden\)load\(\);\},60000\)/);
});
