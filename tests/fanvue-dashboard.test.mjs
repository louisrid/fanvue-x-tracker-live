// Final v3.1 dashboard: shared core rules, components, routes and shell.
// All fixtures here are synthetic; no production data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

await import('../public/fanvue-core.js');
const C=globalThis.FanvueCore;
const html=readFileSync('public/index.html','utf8');
const appJs=readFileSync('public/fanvue-app.js','utf8');
const uiJs=readFileSync('public/fanvue-ui.js','utf8');
const css=readFileSync('public/fanvue.css','utf8');
const legacyApp=readFileSync('public/app.js','utf8');

const ctx=vm.createContext({window:{FanvueCore:C},Intl,Date,Math,Number,String,Object,Array,Map,Set,JSON,RegExp,URL});
vm.runInContext(uiJs,ctx);
const U=ctx.window.FanvueUI;

const row=(o)=>({posted:true,paid:true,cost:100,views:1000,...o});
const overview=(over={})=>({ok:true,checkedAt:'2026-11-24T12:00:00Z',campaigns:[
  {id:'gta-qrts',source:'GOOGLE_SHEETS_LIVE',paidCount:2,paidSpendKnown:200,unknownPaidCosts:0,published:2,postPublicationClicks:40,allTimeHumanClicks:55,
    rows:[row({sourceTab:'GTA Q',sourceRow:8,postUrl:'https://x.com/a/status/1'}),row({sourceTab:'GTA Q',sourceRow:9,postUrl:'https://x.com/b/status/2',views:null})],signups:null,conversionSource:'NOT_CONNECTED'},
  {id:'gta-originals',source:'GOOGLE_SHEETS_LIVE',paidCount:1,paidSpendKnown:50,unknownPaidCosts:0,published:1,postPublicationClicks:null,allTimeHumanClicks:null,
    rows:[row({cost:50,sourceTab:'GTA O',sourceRow:8,postUrl:'https://x.com/c/status/3',views:500})],conversionSource:'NOT_CONNECTED'},
  {id:'of-terms',source:'OF_REPORT',paidCount:1,paidSpendKnown:80,unknownPaidCosts:0,published:1,trackedClicks:12,
    rows:[row({sourceTab:'OF',sourceRow:8,postUrl:'https://x.com/d/status/4',views:300,clicks:12})],conversionSource:'NOT_CONNECTED'},
  {id:'guru-rts',source:'X_RTS',paidCount:0,paidSpendKnown:null,unknownPaidCosts:0,published:1,rows:[{id:'9',posted:true,paid:false,cost:null,views:700,postUrl:'https://x.com/e/status/9'}]},
  {id:'article-rts',source:'GOOGLE_SHEETS_LIVE',paidCount:1,paidSpendKnown:25,unknownPaidCosts:0,published:0,views:700,viewScope:'ORIGINAL_X_POSTS',
    rows:[{id:'ARTICLERT-8',sourceTab:'RT',sourceRow:8,paid:true,posted:false,cost:25,postUrl:'https://x.com/e/status/9',sourcePostUrl:'https://x.com/e/status/9'}]},
  {id:'x-articles',source:'ARTICLE_TRACKER',paidCount:1,paidSpendKnown:150,unknownPaidCosts:0,published:1,trackedClicks:30,
    rows:[row({code:'A01-P01',sourceTab:'WEEK 1',sourceRow:8,cost:150,postUrl:'https://x.com/f/status/5',views:2000,clicks:30})]},
  {id:'ai-harness',source:'NOT_CONNECTED',unavailable:true,rows:[]},
  ...(over.extra||[])
]});

test('formatting uses UK English, tabular-friendly compact figures and explicit currency',()=>{
  assert.equal(C.compact(1611537),'1.6M'); // owner (26 Nov): one decimal max
  assert.equal(C.compact(10000),'10K');
  assert.equal(C.compact(24168),'24.2K');
  assert.equal(C.compact(9999),'9,999');
  assert.equal(C.money(2830),'$2,830'); // owner (26 Nov): max one decimal, no trailing .0
  assert.equal(C.money(6.26),'$6.26');
  assert.equal(C.moneyShort(10225.85),'$10,226');
  assert.equal(C.signed(-12),'−12');
  assert.equal(C.weekLabel('2026-10-26'),'26 Oct – 1 Nov 2026');
  assert.equal(C.dayLong('2026-11-24'),'24 Nov 2026');
});

test('weeks run Monday to Sunday in Europe/London and the current week is marked incomplete',()=>{
  assert.equal(C.weekStart('2026-11-29'),'2026-11-23');
  assert.equal(C.weekStart('2026-11-23'),'2026-11-23');
  // 23:30 UTC on Sunday 29 March 2026 is already Monday in London (BST).
  assert.equal(C.londonDay('2026-03-29T23:30:00Z'),'2026-03-30');
  const now=Date.parse('2026-11-25T12:00:00Z');
  const s=C.eventSeries([{date:'2026-11-10',clicks:3},{date:'2026-11-24',clicks:2}],{now});
  assert.deepEqual(s.map(p=>[p.week,p.value,p.incomplete]),[['2026-11-09',3,false],['2026-11-16',0,false],['2026-11-23',2,true]]);
});

test('weekly view history comes only from dated snapshots, never from a lifetime total',()=>{
  const now=Date.parse('2026-11-25T12:00:00Z');
  const rows=[{id:'1',at:'2026-11-10T10:00:00Z',views:100},{id:'1',at:'2026-11-18T10:00:00Z',views:150},{id:'2',at:'2026-11-19T10:00:00Z',views:40}];
  const s=C.snapshotSeries(rows,{now});
  assert.deepEqual(s.map(p=>[p.week,p.value,p.count]),[['2026-11-09',100,1],['2026-11-16',190,2],['2026-11-23',190,2]]);
  assert.deepEqual(C.snapshotSeries([],{now}),[]);
});

test('Discord member counts are point-in-time: never summed, net growth needs two snapshots',()=>{
  const now=Date.parse('2026-11-25T12:00:00Z');
  const one=C.memberWeeks([{date:'2026-11-24',memberCount:500}],now);
  assert.equal(one.length,1);assert.equal(one[0].value,null);assert.equal(one[0].end,500);
  const two=C.memberWeeks([{date:'2026-11-12',memberCount:480},{date:'2026-11-14',memberCount:490},{date:'2026-11-24',memberCount:500}],now);
  assert.deepEqual(two.map(w=>[w.week,w.start,w.end,w.value]),[['2026-11-09',null,490,null],['2026-11-16',490,null,null],['2026-11-23',null,500,null]]);
});

test('Home spend is a known subtotal from proven-disjoint payments and GTA allocations',()=>{
  const ov=overview();
  const S=C.CAMPAIGNS.map(c=>C.campaignSummary(ov,c.key));
  const T=C.homeTotals(ov,S);
  assert.equal(T.spend.state,'partial');
  assert.equal(T.spend.value,150+25+200+50+80);
  // CIS page removed on owner request (25 Nov): it no longer appears as a spend gap.
  assert.doesNotMatch(T.spend.reason,/CIS/);assert.match(T.spend.reason,/Guru RTs/);
  // A paid row appearing in two campaign objects must block the total.
  const dup=overview();dup.campaigns.find(c=>c.id==='of-terms').rows[0]={...dup.campaigns.find(c=>c.id==='gta-qrts').rows[0]};
  const T2=C.homeTotals(dup,C.CAMPAIGNS.map(c=>C.campaignSummary(dup,c.key)));
  assert.equal(T2.spend.state,'na');assert.equal(T2.spend.value,null);
});

test('Home exposure includes distinct Guru originals without counting external viral originals',()=>{
  const ov=overview();
  const T=C.homeTotals(ov,C.CAMPAIGNS.map(c=>C.campaignSummary(ov,c.key)));
  // x-articles 2000 + gta 1000 (+ one unmeasured) + 500 + of 300; Guru 700 excluded.
  assert.equal(T.views.value,4500);
  assert.equal(T.views.state,'partial');
  assert.match(T.views.reason,/Includes organic exposure/);
});

test('click providers are never combined and missing outcomes are never zero',()=>{
  const ov=overview();
  const S=C.CAMPAIGNS.map(c=>C.campaignSummary(ov,c.key));
  const T=C.homeTotals(ov,S);
  assert.equal(T.clicks.state,'na');assert.equal(T.clicks.value,null);
  const gta=S.find(s=>s.key==='gta-vi');
  assert.equal(gta.clicks.value,40);assert.equal(gta.clicks.allTime,55);
  for(const s of S){assert.equal(s.signups.value,null);assert.equal(s.kyc.value,null);assert.equal(s.earning.value,null);assert.equal(s.cps.value,null);}
  assert.equal(S.find(s=>s.key==='guru-promotion').clicks.state,'notTracked');
  // CIS page removed on owner request (25 Nov).
  assert.equal(S.find(s=>s.key==='cis'),undefined);
});

test('paid reposts are counted once under X Articles and Guru boost spend stays unavailable',()=>{
  const ov=overview();
  const xa=C.campaignSummary(ov,'x-articles'),guru=C.campaignSummary(ov,'guru-promotion');
  assert.equal(xa.spend.value,175);
  assert.equal(xa.views.value,2000,'original-post views of reposts are not added to article views');
  // Owner direction (25 Nov): Guru spend is its own paid RTs; none are in this fixture, and X boost spend stays separate.
  assert.equal(guru.spend.state,'na');assert.match(guru.spend.reason,/No paid RTs are recorded/);
  assert.equal(guru.views.scope,'original');
});

test('unknown costs make spend partial and a verified zero stays zero',()=>{
  const m=C.spendOf({source:'X',paidCount:3,paidSpendKnown:90,unknownPaidCosts:1});
  assert.equal(m.state,'partial');assert.equal(m.value,90);
  const z=C.campaignSummary({campaigns:[{id:'of-terms',source:'OF_REPORT',paidCount:0,paidSpendKnown:null,trackedClicks:0,rows:[]}]},'of-terms');
  assert.equal(z.clicks.state,'value');assert.equal(z.clicks.value,0);
});

test('sorting is explicit and unavailable values sort last in both directions',()=>{
  const rows=[{v:null},{v:5},{v:1}];
  assert.deepEqual(C.sortRows(rows,r=>r.v,1).map(r=>r.v),[1,5,null]);
  assert.deepEqual(C.sortRows(rows,r=>r.v,-1).map(r=>r.v),[5,1,null]);
});

test('components escape every value and give unavailable states a reason on demand',()=>{
  const evil='<img src=x onerror=alert(1)>';
  const out=U.tablePanel({id:'t',title:evil,rows:[{name:evil}],rowKey:()=>'k',columns:[{key:'name',label:evil,type:'text'}]},{expanded:new Set()});
  assert.doesNotMatch(out,/<img/);
  assert.match(out,/&lt;img/);
  const na=U.value(C.M.na('Reason "quoted" <b>'));
  assert.match(na,/Not available/);assert.match(na,/data-reason="Reason &quot;quoted&quot; &lt;b&gt;"/);
  assert.equal(U.value(C.M.value(0)).includes('>0<'),true);
  assert.match(U.value(C.M.notConnected('x')),/Not connected/);
  assert.match(U.value(C.M.loading()),/fv-skel/);
});

test('unavailable data is shown once: empty columns hide and neighbouring empty slots merge',()=>{
  // Owner direction: slots, columns, rows and cells without data are left out, never padded with labels.
  const na=C.M.na(C.OUTCOME_REASON);
  const rows=[{n:'A',v:1},{n:'B',v:null}];
  const html=U.tablePanel({id:'t2',title:'T',rows,rowKey:r=>r.n,columns:[
    {key:'n',label:'Name',type:'name'},{key:'v',label:'Value',get:r=>r.v===null?C.M.na('No source.'):C.M.value(r.v)},{key:'s',label:'Creator signups',get:()=>na}]},{expanded:new Set()});
  assert.doesNotMatch(html,/Creator signups/);
  assert.doesNotMatch(html,/Not available|Not shown/);
  // Site recommendations: an unavailable cell shows one restrained dash with its reason on demand.
  assert.match(html,/class="fv-dash"[^>]*data-reason="No source\."/);
  assert.match(html,/>1</);
  const dropped=U.tablePanel({id:'t3',title:'T',rows,rowKey:r=>r.n,dropEmptyRows:true,columns:[{key:'n',label:'Name',type:'name'},{key:'v',label:'Value',get:r=>r.v===null?C.M.na('No source.'):C.M.value(r.v)}]},{expanded:new Set()});
  assert.equal((dropped.match(/class="fv-row/g)||[]).length,1);
  assert.equal(U.tablePanel({id:'t4',title:'T',rows:[],rowKey:r=>r,columns:[]},{expanded:new Set()}),'');
  const strip=U.strip([{label:'Paid spend',icon:'wallet',metric:C.M.value(5)},{label:'Creator signups',icon:'user',metric:na},{label:'KYC completions',icon:'shield',metric:na}]);
  assert.equal((strip.match(/class="fv-metric"/g)||[]).length,3);
  assert.match(strip,/Creator signups/);assert.match(strip,/fv-dash/);
  assert.match(U.strip([{label:'X',icon:'wallet',metric:na}]),/fv-dash/);
  assert.equal(U.chartPanel({id:'c1',measures:[]},{}),'');
  assert.equal(U.detailGrid([['KYC completions',U.value(na)],['Owner',U.reasonButton('Not recorded','x')],['Paid',C.money(5)]]).includes('KYC completions'),false);
  assert.ok(U.detailGrid([['Paid',C.money(5)]]).includes('$5<')); // owner (26 Nov): no trailing .00
});

test('six-slot strip keeps fixed metric order on every paid campaign page',()=>{
  for(const label of ['Spend','Views','Clicks','CPC','Signups','KYC','Earning Creators','Live Posts','Members','Net Growth','Start Members','Clicks'])  // owner (26 Nov, style 74): short labels
    assert.ok(appJs.includes("'"+label+"'"),label);
  assert.match(css,/\.fv-strip\{display:grid;grid-template-columns:repeat\(var\(--n,6\)/);
});

test('every legacy hash maps to a new page, view or retained record list',()=>{
  const legacy=vm.runInNewContext('('+appJs.slice(appJs.indexOf('const LEGACY=')+13,appJs.indexOf('};',appJs.indexOf('const LEGACY='))+1)+')');
  const expected={dashboard:'home','':'home',stats:'home',historical:'home','report-all':'home',reporting:'home','report-other':'home',
    'report-discord':'discord','report-articles':'x-articles','report-article-rt':'x-articles/paid-reposts',articles:'x-articles/original-posts',
    upcoming:'x-articles/original-posts','report-gta':'gta-vi','campaign-C001':'of-terms','report-of':'of-terms',of:'of-terms',
    'report-harness':'home','report-guru':'guru-promotion','boosted-tweets':'x-rts'};
  for(const [from,to] of Object.entries(expected))assert.equal(legacy[from],to,from);
  for(const page of ['placements','accounts','campaigns','x-rts'])assert.match(appJs,new RegExp("'?"+page+"'?:\\{title:"));
  assert.match(legacyApp,/const RECORD_PAGES=\['placements','accounts','campaigns','x-rts'\]/);
});

test('shell: official wordmark, Inter only, flat seven-page navigation and noindex',()=>{
  assert.match(html,/<meta name="robots" content="noindex,nofollow">/);
  // Owner (26 Nov, style 74): "Fanvue" as text in the display font replaces the wordmark image.
  assert.equal((html.match(/<span class="fv-logo-text">Fanvue<\/span>/g)||[]).length,2);
  assert.match(html,/family=Montserrat:wght@700;800;900/);
  assert.doesNotMatch(html,/Unbounded/);
  assert.match(html,/family=Inter:wght@400\.\.900/);
  const order=C.CAMPAIGNS.map(c=>c.name);
  assert.deepEqual(order,['X Articles','GTA VI','OF Terms','Guru RTs']); // CIS removed (25 Nov); OF Terms and Guru RTs renamed (26 Nov)
  // Owner (26 Nov): Home is named Dashboard; Discord sits under Community.
  assert.match(appJs,/\{key:'home',title:'Dashboard',icon:'home',group:'general'\}/);
  assert.match(appJs,/\{key:'discord',title:'Discord',icon:'discord',group:'community'\}/);
  assert.match(appJs,/>Campaigns<\/span>/);
  assert.match(css,/--fv-sidebar:#000000/);
  assert.match(css,/\.fv-nav-item\[aria-current="page"\]\{background:var\(--fv-nav-active\)/);
  assert.match(css,/--fv-nav-active:#212121/);
  assert.match(css,/font-variant-numeric:tabular-nums/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});

test('both shared stylesheets are present and use the same small scale',()=>{
  const records=readFileSync('public/fanvue-records.css','utf8');
  // Guards against a stylesheet being emptied: the record views, modals and editor depend on it.
  assert.ok(records.length>10000,'fanvue-records.css has content');
  for(const rule of ['.fv-records .xt-data-table','.modal-shade{','.article-modal .form-grid','.fv-records .account-table'])assert.ok(records.includes(rule),rule);
  for(const sheet of [css,records]){
    // Owner (26 Nov, style 74) adds four steps to the scale: tile label (m), period title, tile number, logo; and a 900 weight.
    assert.deepEqual([...new Set([...sheet.matchAll(/font-size:([^;}]+)/g)].map(m=>m[1]))].filter(v=>!/^var\(--fv-fs-(s|m|l|xl|hero|title|num|logo)\)$/.test(v)),[]);
    // Owner (26 Nov): added --fv-w-light, a thinner weight used only for the small back button.
    assert.deepEqual([...new Set([...sheet.matchAll(/font-weight:([^;}]+)/g)].map(m=>m[1]))].filter(v=>!/^var\(--fv-w(-light|-strong|-black)?\)$/.test(v)),[]);
  }
  assert.match(css,/--fv-fs-s:12px;--fv-fs-l:18px;--fv-fs-xl:28px;/);
  // The big key-number size is used only by the key-numbers strip.
  assert.ok([...css.matchAll(/font-size:var\(--fv-fs-hero\)/g)].length>=1);
  assert.match(css,/\.fv-strip \.fv-metric-value\{font-size:var\(--fv-fs-hero\)/);
  assert.match(css,/--fv-bw:1px;/);
});

test('presentation layer only: the shell reads existing adapters and never posts data',()=>{
  for(const src of [appJs,uiJs,readFileSync('public/fanvue-core.js','utf8')]){
    assert.doesNotMatch(src,/method:\s*['"]POST['"]/);
    assert.doesNotMatch(src,/fetch\(/);
    assert.doesNotMatch(src,/localStorage/);
  }
  assert.match(legacyApp,/window\.XTrackerApp=Object\.freeze\(/);
  assert.match(readFileSync('public/campaign-reporting.js','utf8'),/getData:\(\)=>state\.data/);
});

test('daily views: gains count only posts read the day before; totals use each post\'s latest reading',()=>{
  const now=Date.parse('2026-11-25T12:00:00Z');
  const rows=[
    {id:'a',at:'2026-11-23T10:00:00Z',views:100},{id:'a',at:'2026-11-24T10:00:00Z',views:150},{id:'a',at:'2026-11-25T10:00:00Z',views:170},
    {id:'b',at:'2026-11-24T09:00:00Z',views:5000},{id:'b',at:'2026-11-25T09:00:00Z',views:5100}
  ];
  const d=C.dailySeries(rows,{now});
  assert.deepEqual(d.total.map(p=>[p.week,p.value]),[['2026-11-23',100],['2026-11-24',5150],['2026-11-25',5270]]);
  // Post b's first reading (5,000) is never counted as a day's gain; a post first read on a day
  // gains from that first reading (owner, 25 Nov: graphs show from the first day of data).
  assert.deepEqual(d.gained.map(p=>[p.week,p.value]),[['2026-11-23',null],['2026-11-24',50],['2026-11-25',120]]);
  const sameDay=C.dailySeries([{id:'m',at:'2026-11-25T08:00:00Z',views:900},{id:'m',at:'2026-11-25T11:00:00Z',views:960}],{now});
  assert.deepEqual(sameDay.gained.map(p=>[p.week,p.value]),[['2026-11-25',null]]);
  assert.equal(d.gained.at(-1).incomplete,true);
  assert.deepEqual(C.dailySeries([],{now}),{total:[],gained:[]});
});

test('daily views: a post published that day counts from 0; an older post first read late does not spike',()=>{
  // Synthetic readings only.
  const now=Date.parse('2026-11-26T01:00:00Z');
  const pub=Date.parse('2026-11-25T15:00:00Z'),old=Date.parse('2026-11-10T12:00:00Z');
  const rows=[
    {id:'new',at:'2026-11-25T18:00:00Z',views:1000},{id:'new',at:'2026-11-25T22:00:00Z',views:1200},{id:'new',at:'2026-11-26T00:00:00Z',views:1250},
    {id:'old',at:'2026-11-25T18:00:00Z',views:50000},{id:'old',at:'2026-11-25T22:00:00Z',views:50100}
  ];
  const d=C.dailySeries(rows,{now,born:k=>k==='new'?pub:old});
  // 25 Nov: the new post's 1,200 views since publication, plus 100 on the older post (its first reading is its baseline).
  assert.deepEqual(d.gained.map(p=>[p.week,p.value,p.fresh]),[['2026-11-25',1200,1],['2026-11-26',50,0]]);
});


test('all 27 listings appear immediately, even with a legacy row limit; search and sorting still apply',()=>{
 const rows=Array.from({length:27},(_,i)=>({id:i+1,name:'Publisher '+String(i+1).padStart(2,'0'),spend:i+1}));
 const cfg={id:'all-listings-test',title:'Listings',rows,rowKey:r=>r.id,search:true,searchText:r=>r.name,columns:[{key:'name',label:'Account',type:'name',get:r=>r.name},{key:'spend',label:'Spend',get:r=>C.M.value(r.spend)}],limit:10};
 const full=U.tablePanel(cfg,{});assert.equal((full.match(/class="fv-row"/g)||[]).length,27);assert.doesNotMatch(full,/data-show-all|Show all/);assert.match(full,/Publisher 27/);
 const filtered=U.tablePanel(cfg,{q:'Publisher 2'});assert.equal((filtered.match(/class="fv-row"/g)||[]).length,8);
 const sorted=U.tablePanel(cfg,{sort:{key:'spend',dir:-1,user:true}});assert.ok(sorted.indexOf('Publisher 27')<sorted.indexOf('Publisher 01'));assert.equal((sorted.match(/class="fv-row"/g)||[]).length,27);
});


test('all date-bearing listings default to newest first without overriding manual sorting',()=>{const rows=[{id:'old',at:1,name:'Old'},{id:'unknown',at:null,name:'Unknown'},{id:'new',at:3,name:'New'}];const cfg={id:'newest',title:'Listings',rows,rowKey:r=>r.id,age:r=>r.at==null?null:{at:r.at},columns:[{key:'name',label:'Account',type:'name',get:r=>r.name}]};const st={};const out=U.tablePanel(cfg,st);assert.equal(st.sort.key,'age');assert.equal(st.sort.dir,-1);assert.ok(out.indexOf('>New<')<out.indexOf('>Old<')&&out.indexOf('>Old<')<out.indexOf('>Unknown<'));const manual=U.tablePanel(cfg,{sort:{key:'name',dir:1,user:true}});assert.ok(manual.indexOf('>New<')<manual.indexOf('>Old<'));});
