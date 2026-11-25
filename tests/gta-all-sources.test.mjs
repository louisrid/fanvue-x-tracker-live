import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseRows,inGroup,publishedQrts,excludedCopies,GTA_BUDGET} from '../netlify/functions/gta-report.mjs';
import {summarisePlacements} from '../netlify/lib/placement-reporting.mjs';
import {assembleCampaignOverview} from '../netlify/functions/campaign-overview.mjs';

// Synthetic fixtures only: publishers, links and prices below are invented.
const Q15='X Accounts 15 (GTA VI QRTs)',Q16='X Accounts 16 (GTA VI QRTs)',O12='X Accounts 12 (GTA)',O14='X Accounts 14 (GTA VI V2)',IG='IG Accounts 3 (GTA VI)';
const X_HEAD=['ACCOUNT','LINK',null,'UTM LINK','ACCOUNT SUM','PAID?','POSTED?','LINK'];
const IG_HEAD=['ACCOUNT','LINK',null,'UTM LINK','POST','STORY','BOTH','ACCOUNT SUM','PAID?','UP?'];
const post=n=>'https://x.com/pub'+n+'/status/21223516281626419'+String(n).padStart(2,'0');
function book({tab16=true,instagram=true}={}){
  const w=new ExcelJS.Workbook();
  const x=(name,rows)=>{const s=w.addWorksheet(name);s.getRow(7).values=X_HEAD;rows.forEach((r,i)=>{s.getRow(8+i).values=r;});return s;};
  x(Q15,[
    ['Alpha','https://x.com/alpha',null,'https://ex.s.gy/a',50,true,true,post(1)],
    ['Beta','https://x.com/beta',null,'https://ex.s.gy/b',100,true,false,''],
    ['Gamma','https://x.com/gamma',null,'https://ex.s.gy/g',40,false,false,'']
  ]);
  x(O12,[['Orig','https://x.com/orig',null,'',70,true,true,post(2)]]);
  x(O14,[['Orig2','https://x.com/orig2',null,'',30,true,false,'']]);
  if(tab16)x(Q16,[
    ['Alpha','https://x.com/alpha',null,'https://ex.s.gy/a',50,false,false,''],      // copy of a tab 15 booking
    ['Beta','https://x.com/beta',null,'https://ex.s.gy/b',100,true,false,''],        // marked paid in tab 16: repeat booking
    ['Gamma','https://x.com/gamma',null,'https://ex.s.gy/g',40,false,true,post(3)],  // own live post: repeat booking
    ['Delta','https://x.com/delta',null,'https://ex.s.gy/d',60,false,false,'']       // no tab 15 match: new booking
  ]);
  if(instagram){const s=w.addWorksheet(IG);s.getRow(7).values=IG_HEAD;
    s.getRow(8).values=['storyacct','https://www.instagram.com/storyacct/',null,'',null,250,null,250,true,false];
    s.getRow(9).values=['freepost','https://www.instagram.com/freepost/',null,'',0,null,null,null,true,false];
    s.getRow(10).values=['prospect','https://www.instagram.com/prospect/',null,'',null,null,null,null,false,false];
    s.getRow(11).values=['liveone','https://www.instagram.com/liveone/',null,'',null,90,null,90,true,true];}
  return w;
}

test('tab 16 rows that copy a tab 15 booking are excluded; repeat bookings with evidence are kept',()=>{
  const rows=parseRows(book());
  const t16=rows.filter(p=>p.sourceTab===Q16);
  assert.deepEqual(t16.map(p=>[p.publisher,!!p.duplicateOf]),[['Alpha',true],['Beta',false],['Gamma',false],['Delta',false]]);
  assert.deepEqual(t16[0].duplicateOf,{tab:Q15,row:8});
  assert.deepEqual(excludedCopies(rows),{count:1,recordedCost:50,tabs:[Q16]});
  // Copies never reach the QRT group, its spend or its published posts.
  const qrts=rows.filter(p=>inGroup(p,'qrts'));
  assert.equal(qrts.length,6);
  assert.ok(qrts.every(p=>!p.duplicateOf));
  assert.equal(summarisePlacements(qrts).paidSpend,250);
  assert.deepEqual(publishedQrts(rows).map(p=>p.publisher),['Alpha','Gamma']);
});

test('Instagram rows count towards GTA VI spend, including paid placements not yet up',()=>{
  const rows=parseRows(book()),ig=rows.filter(p=>inGroup(p,'instagram'));
  assert.equal(ig.length,4);
  assert.ok(ig.every(p=>p.platform==='instagram'&&p.postUrl===''&&p.profileUrl.startsWith('https://www.instagram.com/')));
  assert.deepEqual(ig.map(p=>p.format),['story','post',null,'story']);
  // A blank total with a single $0 price is a known zero, not an unknown cost.
  assert.equal(ig[1].cost,0);
  assert.equal(ig[2].cost,null);
  const s=summarisePlacements(ig);
  assert.equal(s.paidSpend,340);
  assert.equal(s.pendingPaidSpend,250);
  assert.equal(ig.filter(p=>p.posted).length,1);
});

test('tab 16 and Instagram are optional; the original tabs still parse without them',()=>{
  const rows=parseRows(book({tab16:false,instagram:false}));
  assert.equal(rows.filter(p=>p.campaign==='GTAQ2'||p.campaign==='GTAIG').length,0);
  assert.equal(summarisePlacements(rows.filter(p=>inGroup(p,'qrts'))).paidSpend,150);
});

test('campaign feed adds an Instagram group, committed spend and the GTA VI budget',()=>{
  const rows=parseRows(book()).filter(p=>!p.duplicateOf);
  const group=(ids)=>({ok:true,ready:true,source:'GOOGLE_SHEETS_LIVE',sourceVerifiedAt:'2026-11-24T12:00:00Z',publishers:rows.filter(p=>ids.includes(p.campaign)),shortIo:{total:null,postPublicationTotal:null},xStatus:{errors:[]}});
  const gta={...group(['GTAQ','GTAQ2']),originals:group(['GTA1','GTA2']),instagram:group(['GTAIG']),budget:GTA_BUDGET,excludedCopies:{count:1,recordedCost:50,tabs:[Q16]},missingTabs:[]};
  const ov=assembleCampaignOverview({gta:{data:gta},of:{error:'x'},boosts:{error:'x'},dashboard:{error:'x'},articleRts:{error:'x'}});
  const find=id=>ov.campaigns.find(c=>c.id===id);
  assert.deepEqual(['gta-qrts','gta-originals','gta-instagram'].map(id=>find(id).paidSpendKnown),[250,100,340]);
  // Committed = agreed price, not yet paid (Gamma 40 + Gamma repeat 40 + Delta 60).
  assert.equal(find('gta-qrts').committedUnpaidKnown,140);
  assert.equal(find('gta-instagram').committedUnpaidKnown,0);
  assert.deepEqual(find('gta-qrts').budget,{amount:10000,currency:'USD'});
  assert.equal(find('gta-qrts').excludedCopies.count,1);
});

const ctx={console};ctx.globalThis=ctx;ctx.window=ctx;
vm.runInNewContext(readFileSync('public/fanvue-core.js','utf8'),ctx);
const C=ctx.FanvueCore;
const row=(o)=>({paid:true,posted:true,cost:100,trackingUrl:'https://ex.s.gy/'+o.k,postUrl:post(o.n),clicks:10,views:20000,...o});

test('CPC and CPM use matched spend and results; untracked clicks are never zero',()=>{
  const rows=[
    row({k:'a',n:11,cost:100,clicks:50,views:40000}),
    row({k:'b',n:12,cost:200,clicks:null,views:null}),            // untracked: left out of both sides
    row({k:'c',n:13,cost:300,clicks:0,views:10000}),              // genuine zero clicks: counted
    row({k:'d',n:14,cost:400,posted:false,clicks:30}),            // not published: left out
    row({k:'e',n:15,cost:500,paid:false,clicks:30}),              // not paid: left out
    row({k:'s',n:16,cost:60,clicks:5}),row({k:'s',n:17,cost:60,clicks:5}) // shared link: left out of CPC
  ];
  const {cpc,cpm}=C.efficiency([{rows}]);
  assert.equal(cpc.state,'value');
  assert.equal(cpc.value,(100+300)/(50+0));
  // CPM: posts a, c and both shared-link posts have views; each post counted once.
  assert.equal(cpm.value,(100+300+60+60)/(40000+10000+20000+20000)*1000);
  const none=C.efficiency([{rows:[row({k:'z',n:18,clicks:null,views:null})]}]);
  assert.equal(none.cpc.state,'na');
  assert.equal(none.cpm.state,'na');
  assert.equal(none.cpc.value??null,null);
});

test('placement CPC and CPM are blank without their own reading, never infinite or zero',()=>{
  const a=row({k:'a',n:21,cost:100,clicks:40,views:50000}),z=row({k:'z',n:22,cost:100,clicks:0,views:0}),u=row({k:'u',n:23,cost:80,clicks:null,views:null});
  const p1=row({k:'p',n:24,cost:50,clicks:5,views:9000}),p2={...row({k:'q',n:25,cost:50,clicks:5}),postUrl:post(24)};
  const m=C.placementEfficiency([a,z,u,p1,p2]);
  assert.equal(m.get(a).cpc.value,2.5);
  assert.equal(m.get(a).cpm.value,2);
  for(const r of [z,u])for(const k of ['cpc','cpm'])assert.equal(m.get(r)[k].state,'na');
  // Two placements on one post cannot each claim its views.
  assert.equal(m.get(p1).cpm.state,'na');
});

test('GTA VI totals include Instagram; budget shows spend, committed and remaining',()=>{
  const obj=(id,paid,committed,extra={})=>({id,source:'GOOGLE_SHEETS_LIVE',paidSpendKnown:paid,unknownPaidCosts:0,paidCount:1,committedUnpaidKnown:committed,published:0,rows:[],...extra});
  const ov={campaigns:[obj('gta-qrts',1840,100,{budget:{amount:10000,currency:'USD'}}),obj('gta-originals',2600.85,0),obj('gta-instagram',1140,0)]};
  const s=C.campaignSummary(ov,'gta-vi');
  assert.equal(Math.round(s.spend.value*100)/100,5580.85);
  assert.equal(s.committed,100);
  assert.equal(s.budget.budget.value,10000);
  assert.equal(Math.round(s.budget.remaining.value*100)/100,4319.15);
  assert.ok(C.CAMPAIGNS.find(c=>c.key==='gta-vi').ids.includes('gta-instagram'));
});

test('Discord shows member count and net growth for the last four weeks with snapshots only',()=>{
  const now=Date.parse('2026-11-25T12:00:00Z');
  const hist=[['2026-10-14',400],['2026-10-21',410],['2026-10-28',420],['2026-11-04',430],['2026-11-11',440],['2026-11-24',460]].map(([date,memberCount])=>({date,memberCount}));
  const weeks=C.recentWeeks(hist,4,now);
  // Only weeks that have a snapshot; the gap week of 16 Nov is not invented.
  assert.deepEqual(JSON.parse(JSON.stringify(weeks.map(w=>[w.week,w.end]))),[['2026-10-26',420],['2026-11-02',430],['2026-11-09',440],['2026-11-23',460]]);
  assert.equal(weeks[0].value,10);
  assert.equal(C.recentWeeks([],4,now).length,0);
  const shell=readFileSync('public/fanvue-app.js','utf8');
  assert.match(shell,/const weeks=C\.recentWeeks\(members\?\.history,4\)/);
  assert.match(shell,/\{key:'end',label:'Members'/);
  assert.match(shell,/\{key:'net',label:'Net growth'/);
});

test('an unreadable optional tab is skipped and reported; required tabs still parse',()=>{
  const w=book();
  w.getWorksheet(Q16).getRow(7).values=['ACCOUNT','LINK',null,'UTM LINK','ACCOUNT SUM','PAID?','LINK'];   // POSTED? removed
  const report={read:[],skipped:[]};
  const rows=parseRows(w,report);
  assert.deepEqual(report.skipped,[Q16]);
  assert.ok(report.read.includes(Q15)&&report.read.includes(IG));
  assert.equal(rows.filter(p=>p.sourceTab===Q16).length,0);
  // A required tab with a missing column still fails loudly.
  const bad=book();bad.getWorksheet(Q15).getRow(7).values=['ACCOUNT','LINK',null,'UTM LINK','ACCOUNT SUM','PAID?','LINK'];
  assert.throws(()=>parseRows(bad),/GTA column missing POSTED\? in X Accounts 15/);
});

test('Instagram needs no link or tracking columns; two priced formats are "both" with no guessed cost',()=>{
  const w=book({tab16:false}),s=w.getWorksheet(IG);
  s.getRow(7).values=['ACCOUNT',null,null,null,'POST','STORY','BOTH','ACCOUNT SUM','PAID?','UP?'];
  s.getRow(12).values=['mixed',null,null,null,100,150,null,null,true,false];
  const ig=parseRows(w).filter(p=>inGroup(p,'instagram'));
  assert.equal(ig.length,5);
  const mixed=ig.find(p=>p.publisher==='mixed');
  assert.equal(mixed.format,'both');
  assert.equal(mixed.cost,null);
  assert.ok(ig.every(p=>p.trackingUrl===''));
});

test('each tab 15 booking explains at most one tab 16 row; blank rows are never matched',()=>{
  const w=book(),s=w.getWorksheet(Q16);
  s.getRow(12).values=['Alpha','https://x.com/alpha',null,'https://ex.s.gy/a',50,false,false,''];   // second copy-like row
  s.getRow(13).values=['Blank','',null,'',null,false,false,''];
  const rows=parseRows(w),t16=rows.filter(p=>p.sourceTab===Q16);
  assert.equal(t16.filter(p=>p.publisher==='Alpha'&&p.duplicateOf).length,1);
  assert.equal(t16.filter(p=>p.publisher==='Alpha'&&!p.duplicateOf).length,1);
  assert.equal(t16.find(p=>p.publisher==='Blank').duplicateOf,undefined);
});

test('a GTA report from before Instagram, or a group with no paid rows, never makes spend partial',()=>{
  const rows=parseRows(book({instagram:false})).filter(p=>!p.duplicateOf);
  const group=(ids)=>({ok:true,ready:true,source:'GOOGLE_SHEETS_LIVE',sourceVerifiedAt:'2026-11-24T12:00:00Z',publishers:rows.filter(p=>ids.includes(p.campaign)),shortIo:{total:null,postPublicationTotal:null},xStatus:{errors:[]}});
  const old={...group(['GTAQ','GTAQ2']),originals:group(['GTA1','GTA2'])};
  const ov=assembleCampaignOverview({gta:{data:old},of:{error:'x'},boosts:{error:'x'},dashboard:{error:'x'},articleRts:{error:'x'}});
  assert.equal(ov.campaigns.some(c=>c.id==='gta-instagram'),false);
  const s=C.campaignSummary(ov,'gta-vi');
  assert.equal(s.spend.state,'value');
  assert.equal(s.spend.value,350);
  // A connected Instagram group with nothing paid adds $0 rather than a gap.
  const withEmpty=assembleCampaignOverview({gta:{data:{...old,instagram:group(['GTAIG'])}},of:{error:'x'},boosts:{error:'x'},dashboard:{error:'x'},articleRts:{error:'x'}});
  const s2=C.campaignSummary(withEmpty,'gta-vi');
  assert.equal(s2.spend.state,'value');
  assert.equal(s2.spend.value,350);
});

const uctx=vm.createContext({window:{FanvueCore:C},Intl,Date,Math,Number,String,Object,Array,Map,Set,JSON,RegExp,URL});
vm.runInContext(readFileSync('public/fanvue-ui.js','utf8'),uctx);
const U=uctx.window.FanvueUI;

test('a search or filter with no matches keeps the table and its controls',()=>{
  const cfg={id:'t',title:'T',rows:[{n:'A',paid:true},{n:'B',paid:false}],rowKey:r=>r.n,views:[{key:'a',label:'A'},{key:'b',label:'B'}],view:'a',
    filters:'<select data-filter="t"></select>',filter:r=>r.paid===null,columns:[{key:'n',label:'Name',type:'name'}]};
  const html=U.tablePanel(cfg,{expanded:new Set()});
  assert.match(html,/data-filter="t"/);
  assert.match(html,/data-view="b"/);
  assert.match(html,/No matching records\./);
  assert.match(html,/data-reset="t"/);
  // No data at all: a plain table is left out, a table with view tabs keeps them.
  assert.equal(U.tablePanel({...cfg,views:null,rows:[]},{expanded:new Set()}),'');
  assert.match(U.tablePanel({...cfg,rows:[],empty:'No records.'},{expanded:new Set()}),/data-view="b"[\s\S]*No records\./);
});

test('each row carries exactly one type tag, each type with its own colour',()=>{
  const shell=readFileSync('public/fanvue-app.js','utf8'),css=readFileSync('public/fanvue.css','utf8');
  assert.match(shell,/const CAMPAIGN_TYPES=\{'x-articles':'article','gta-vi':'mixed','of-terms':'post','guru-promotion':'rt'\}/);
  assert.match(shell,/type:'post'\},\{key:'x-quote-posts',name:'X quote posts',c:qr,type:'qrt'\},\{key:'instagram',name:'Instagram',c:ig,type:'story'\}/);
  const colours=new Set();
  for(const [k,l] of [['article','Article'],['post','Post'],['qrt','QRT'],['rt','RT'],['story','Story'],['mixed','Mixed']]){
    const tag=U.typeTag(k);
    assert.equal((tag.match(/fv-type is-/g)||[]).length,1);
    assert.match(tag,new RegExp('fv-type is-'+k+'[^>]*>'+l));
    const m=css.match(new RegExp('\\.fv-state\\.fv-type\\.is-'+k+'\\{background:(#[0-9A-F]{6})\\}'));
    assert.ok(m,k);colours.add(m[1]);
  }
  assert.equal(colours.size,6);
  assert.equal(U.typeTag(undefined),'');
  assert.doesNotMatch(shell,/Needs attention|'Delivery'|typeTags/);
});

test('paid RTs of a Guru account are Guru Promotion spend; the rest stay with X Articles; each counted once',()=>{
  const rt=(publisher,cost,original,row)=>({publisher,cost,paid:true,posted:false,sourcePostUrl:original,postUrl:'',sourceTab:'X Accounts 11 (Article RTs)',sourceRow:row});
  const rows=[rt('A',30,'https://x.com/GuruOne/status/2117354088690245907',8),rt('B',20,'https://x.com/guruone/status/2114682794160824473',9),
    rt('C',15,'https://x.com/someoneelse/status/2110000000000000000',10),rt('D',10,'',11)];
  const tweets=[{id:'2117354088690245907',handle:'GuruOne',name:'Guru One',views:1000,likes:1,reposts:1,replies:1,at:'2026-11-24T10:00:00Z'}];
  const ov=assembleCampaignOverview({boosts:{data:{ok:true,tweets}},articleRts:{data:{source:'GOOGLE_SHEETS_LIVE',rows,at:'2026-11-24T10:00:00Z'}},gta:{error:'x'},of:{error:'x'},dashboard:{error:'x'}});
  const guru=ov.campaigns.find(c=>c.id==='guru-rts'),art=ov.campaigns.find(c=>c.id==='article-rts');
  assert.equal(guru.paidSpendKnown,50);assert.equal(guru.paidCount,2);
  assert.deepEqual(guru.paidReposts.map(r=>r.publisher),['A','B']);
  // A second post by the same account appears as its own promoted post with its RT spend.
  const extra=guru.rows.find(r=>r.id==='2114682794160824473');
  assert.equal(extra.publisher,'Guru One');assert.equal(extra.linkedRtPaidSpend,20);
  assert.equal(art.paidSpendKnown,25);
  assert.deepEqual(art.rows.map(r=>r.publisher),['C','D']);
  // Without the boosts feed nothing is reassigned, so no RT is lost or double counted.
  const down=assembleCampaignOverview({boosts:{error:'x'},articleRts:{data:{source:'GOOGLE_SHEETS_LIVE',rows,at:'2026-11-24T10:00:00Z'}},gta:{error:'x'},of:{error:'x'},dashboard:{error:'x'}});
  assert.equal(down.campaigns.find(c=>c.id==='article-rts').paidSpendKnown,75);
  // Home sees Guru spend and still proves every paid row is unique.
  const sum=C.campaignSummary(ov,'guru-promotion');
  assert.equal(sum.spend.value,50);
  const shell=readFileSync('public/fanvue-app.js','utf8');
  assert.doesNotMatch(shell,/Records and editing/);
  assert.match(shell,/const rows=g\?\.paidReposts\|\|\[\];/);
});

test('"Spend" replaces "Paid spend" in every visible label',()=>{
  for(const f of ['public/fanvue-app.js','public/fanvue-core.js','public/fanvue-campaigns.js','public/campaign-reporting.js','public/app.js'])
    assert.doesNotMatch(readFileSync(f,'utf8'),/Paid spend/,f);
});
