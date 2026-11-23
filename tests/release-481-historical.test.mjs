import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const js=read('public/app.js'),css=read('public/styles.css'),html=read('public/index.html');
const block=(begin,end)=>{const a=js.indexOf(begin),b=js.indexOf(end,a);assert(a>=0&&b>a);return js.slice(a,b);};

test('navigation contains Dashboard, Key Stats, Historical but not Article Tracker',()=>{
 const nav=html.match(/<nav class="mobile-nav"[\s\S]*?<\/nav>/)?.[0]||'';
 assert.deepEqual([...nav.matchAll(/data-page="([^"]+)"/g)].map(x=>x[1]),['dashboard','stats','historical']);
 assert(html.includes('id="page-placements" aria-labelledby="placementsTitle" hidden inert aria-hidden="true" data-retired="true"'));
 assert(html.includes('id="page-historical"'));
 assert(js.includes("['dashboard','campaigns','stats','historical']"));
 assert(css.slice(css.indexOf('/* X Tracker v4.8.1:')).includes('grid-template-columns:repeat(3,minmax(0,1fr))'));
});

test('campaign badges preserve source assignments and correct Meetyoshi to Fanvue Partners',()=>{
 const ctx={state:{campaigns:[{id:'C002',name:'Fanvue Partners'}]},esc:s=>String(s)};
 const code=block('// Correct the known Fanvue Partners publisher assignment','const articleUrl=')+'\nthis.campaignLabel=campaignLabel; this.campaignTag=campaignTag;';
 vm.runInNewContext(code,ctx);
 assert.equal(ctx.campaignLabel({code:'A01-P01',campaignId:'UNASSIGNED'}),'Campaign A01');
 assert.equal(ctx.campaignLabel({code:'A01-P01',campaignId:'C002'}),'Fanvue Partners');
 assert.equal(ctx.campaignLabel({code:'A01-P01',publisher:'@Meetyoshi',campaignId:'C003'}),'Fanvue Partners');
 assert.equal(ctx.campaignLabel({code:'A02-P01',campaignId:'NONEXISTENT'}),'NONEXISTENT');
 assert.equal(ctx.campaignLabel({code:'A02-P01',campaignId:''}),'Campaign A02');
 assert(ctx.campaignTag({code:'A01-P01'}).includes('Campaign A01'));
 assert(js.includes('${campaignTag(p)}<span>${esc(p.articleLabel'));
 assert(js.includes('${campaignTag(p)}<span>${esc(p.platform||\'X\')}'));
});

test('Historical dynamically groups actual source weeks, collapsed initially, sorted by UTM clicks',()=>{
 const root={innerHTML:'',querySelectorAll:()=>[]};
 const ctx={
   state:{placements:[
     {code:'A01-P14',sourceTab:'WEEK 1 - LOUIS',publisher:'Brook',campaignId:'UNASSIGNED',paid:true,cost:100,posted:true,clicks:4},
     {code:'A01-P18',sourceTab:'WEEK 1 - CONNOR',publisher:'Seph',campaignId:'UNASSIGNED',paid:true,cost:130,posted:true,clicks:12},
     {code:'A02-P01',sourceTab:'WEEK 2 - LOUIS',publisher:'Future',campaignId:'C002',paid:true,cost:140,posted:false,clicks:5}
   ],owner:'ALL',campaigns:[{id:'C002',name:'Fanvue Partners'}]},
   el:id=>id==='historicalWeeks'?root:id==='historicalSort'?{value:'clicks'}:null,esc:s=>String(s),fmt:n=>String(n),
   clicks:p=>p.clicks,display:n=>String(n),money:n=>'$'+n,
   isLive:p=>p.posted,isAged:()=>false,isNew:()=>false,compareUTMClicks:(a,b)=>b.clicks-a.clicks,compareArticles:(a,b)=>b.clicks-a.clicks,
   STATS_WEEK_ONE:'2026-10-12',day:d=>d.toISOString().slice(0,10),
   shift:(d,n)=>{const x=new Date(d+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10);},
   currentStatsWeekNumber:()=>1,
   stateSnapshotClickMap:new Map(),
   weeklyCodeClicks:scope=>new Map(scope.placements.map(p=>[p.code,p.clicks])),
   weeklyClicksFor:(p,map)=>map.get(p.code),
   weeklyLive:p=>p.posted,
   statsWeekKpis:scope=>[
     {id:'articles',label:'Live articles',value:String(scope.placements.filter(p=>p.posted).length)},
     {id:'money',label:'Paid total',value:'$230'},
     {id:'clicks',label:'UTM clicks',value:String(scope.placements.reduce((n,p)=>n+p.clicks,0))},
     {id:'views',label:'Views recorded',value:'N/A'},
     {id:'likes',label:'Likes recorded',value:'N/A'}]
 };
 vm.runInNewContext(block('// Correct the known Fanvue Partners publisher assignment','const articleUrl=')+block('// Historical keeps complete source-week cohorts.','function renderBulk(){')+'\nthis.renderHistorical=renderHistorical;',ctx);
 ctx.renderHistorical();
 const s=root.innerHTML;
 assert.match(s,/data-week="1"/);
 assert.match(s,/data-week="2"/);
 assert(!s.includes(' data-week="3"'));
 assert(!s.includes(' data-week="1" open'));
 assert(s.indexOf('Week 2')<s.indexOf('Week 1'));
 assert(s.indexOf('Seph')<s.indexOf('Brook'));
 assert(s.includes('Campaign A01'));
 assert(s.includes('Fanvue Partners'));
 assert(s.includes('2 placements'));
 assert(s.includes('Week summary'));
 assert(s.includes('Articles'));
 assert(s.includes('historical-is-paid'));
 assert(s.includes('Week UTM clicks'));
 // Re-render after a Sheet update must preserve the expanded state.
 root.querySelectorAll=()=>[{dataset:{week:'1'}}];
 ctx.renderHistorical();
 assert.match(root.innerHTML,/data-week="1" open/);
 assert(!/data-week="2" open/.test(root.innerHTML));
});

test('new compatible Week 2+ source tabs are included, without requiring incomplete drafts',()=>{
 const src=read('netlify/lib/sheet-source.mjs').replace(/^import ExcelJS from 'exceljs';\n/,'').replace(/^export /gm,'');
 const {parseWorkbook}=vm.runInNewContext(src+'\n({parseWorkbook})',{URL,Buffer,Date,console});
 class Cell {constructor(value=null){this.value=value;}}
 class Row {constructor(values={}){this.values=values;}getCell(n){return new Cell(this.values[n]??null);}eachCell(fn){for(const [i,val] of Object.entries(this.values))if(val!==null)fn(new Cell(val),Number(i));}}
 class Sheet {constructor(name,code,campaign='',valid=true){this.name=name;this.rows={};this.rowCount=8;
  if(valid){const headers={2:'ACCOUNT',3:'LINK',5:'ARTICLE LINK',6:'UTM',7:'ARTICLE',8:1,12:'PAID?',13:'POSTED?',14:'LINK',15:'UTM ID',19:'X POST VIEWS',20:'X POST LIKES',21:'X UPDATED (UK)',22:'CAMPAIGN'};
   this.rows[7]=new Row(headers);
   if(code)this.rows[8]=new Row({2:'acct',3:'https://x.com/acct',5:'ARTICLE 2.1',7:150,8:true,12:true,13:false,15:code,19:100,20:10,21:'17 Oct 2026 10:00 BST',22:campaign});
  }
 }getRow(n){return this.rows[n]||new Row();}}
 const sheets=[
   new Sheet('WEEK 1 - LOUIS','A01-P19'),new Sheet('WEEK 1 - CONNOR','A01-P06'),
   new Sheet('WEEK X - TEMP',''),new Sheet('WEEK 2 - LOUIS','A02-P01','Fanvue Partners'),
   new Sheet('WEEK 3 - CONNOR','A03-P01'),new Sheet('WEEK 4 - LOUIS','', '',false),
 ];
 const campaigns=new Sheet('CAMPAIGNS','');campaigns.rowCount=5;campaigns.rows[5]=new Row({1:'C002',2:'Fanvue Partners'});sheets.push(campaigns);
 const book={worksheets:sheets,getWorksheet:name=>sheets.find(s=>s.name===name)};
 const out=parseWorkbook(book,Date.parse('2026-10-17T20:00:00Z'));
 assert.equal(out.placements.length,4);
 assert.deepEqual([...new Set(out.placements.map(p=>p.sourceTab))].sort(),['WEEK 1 - CONNOR','WEEK 1 - LOUIS','WEEK 2 - LOUIS','WEEK 3 - CONNOR']);
 const w2=out.placements.find(p=>p.sourceTab==='WEEK 2 - LOUIS');
 assert.equal(w2.owner,'LOUIS');assert.equal(w2.campaignId,'C002');
 assert.equal(out.placements.find(p=>p.sourceTab==='WEEK 3 - CONNOR').owner,'CONNOR');
});

test('all tracking functions, original click cutoff and no Sheet write changes',()=>{
 assert(js.includes('setInterval(()=>{if(!document.hidden)load();},60000)'));
 assert(read('netlify/lib/click-baseline.mjs').includes('2026-10-17T00:32:36'));
 for(const part of ['/r/:code','/s/:code','/p/:code'])assert(read('netlify.toml').includes(part));
 assert(read('netlify/functions/dashboard.mjs').includes("uiVersion:'5.0.37'"));
 assert(!read('netlify/lib/sheet-source.mjs').includes('setValues('));
});
