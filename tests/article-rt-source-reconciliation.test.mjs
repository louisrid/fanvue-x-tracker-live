import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ExcelJS from 'exceljs';
import {
  parseArticleRtWorkbook,groupArticleRtSpend,enrichArticleRtMetrics,
  assembleCampaignOverview,readArticleOriginalMetrics
} from '../netlify/functions/campaign-overview.mjs';

const originalA='https://x.com/ArdzAI0/status/2117354088690245907';
const originalB='https://x.com/ArdzAI0/status/2114682794160824473';

function fixture(){
  const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('X Accounts 11 (Article RTs)');
  for(const [col,head] of [[2,'ACCOUNT'],[3,'LINK'],[4,'UTM LINK'],
    [19,'ACCOUNT SUM'],[22,'PAID?'],[23,'POSTED?'],[24,'LINK']])
    sheet.getRow(7).getCell(col).value=head;
  for(const [n,name,cost,posted,original] of [
    [8,'RT Account A',30,false,originalA],
    [9,'RT Account B',50,true,originalA],
    [10,'RT Account C',20,false,originalB],
    [11,'RT Account D',10,false,'']
  ]){
    const r=sheet.getRow(n);
    r.getCell(2).value=name;
    r.getCell(3).value='https://x.com/'+name.replace(/[^a-z]/gi,'');
    r.getCell(19).value={formula:String(cost),result:cost};
    r.getCell(22).value=true;
    r.getCell(23).value=posted;
    r.getCell(24).value=original;
  }
  return book;
}

test('Article RT importer distinguishes publisher profiles from original X source posts',()=>{
  const rows=parseArticleRtWorkbook(fixture());
  assert.equal(rows.length,4);
  assert.equal(rows[0].publisher,'RT Account A');
  assert.equal(rows[0].profileUrl,'https://x.com/RTAccountA');
  assert.equal(rows[0].sourcePostUrl,originalA);
  assert.equal(rows[0].postUrl,originalA);
  assert.equal(rows[0].posted,false);
  assert.equal(rows[0].paid,true);
  assert.equal(rows[0].cost,30);
  assert.equal(rows[3].sourcePostUrl,'');
  assert.equal(rows[3].profileUrl,'https://x.com/RTAccountD');
});

test('Source-post metrics attach to pending RT entries but are never multiplied by reposter count',()=>{
  const rows=parseArticleRtWorkbook(fixture());
  const boosts={tweets:[{id:'2117354088690245907',handle:'ArdzAI0',views:39222,
    likes:32,reposts:12,replies:3,at:'2026-11-24T10:00:00Z'}]};
  const enriched=enrichArticleRtMetrics(rows,{boosts});
  assert.equal(enriched[0].posted,false);
  assert.equal(enriched[0].sourceOriginalViews,39222);
  assert.equal(enriched[1].sourceOriginalViews,39222);
  const grouped=groupArticleRtSpend(enriched);
  assert.equal(grouped.summary.paidCount,4);
  assert.equal(grouped.summary.paidSpendKnown,110);
  assert.equal(grouped.summary.linkedPaidSpendKnown,100);
  assert.equal(grouped.summary.unlinkedPaidSpendKnown,10);
  assert.equal(grouped.summary.originalPosts,2);
  assert.equal(grouped.summary.originalViewsKnown,39222);
  const overview=assembleCampaignOverview({
    boosts:{data:{ok:true,tweets:boosts.tweets}},
    articleRts:{data:{source:'GOOGLE_SHEETS_LIVE',rows,at:'2026-11-24T10:00:00Z'}}
  });
  const guru=overview.campaigns.find(c=>c.id==='guru-rts');
  const article=overview.campaigns.find(c=>c.id==='article-rts');
  assert.equal(guru.rows[0].linkedRtPaidSpend,80);
  assert.equal(guru.rows[0].linkedRtPaidCount,2);
  // Owner direction (25 Nov): paid RTs of a Guru account's posts (both ArdzAI0 posts) are
  // Guru Promotion spend; only the RT with no original-post link stays with X Articles.
  // Every RT is counted once and source views are never multiplied by reposter count.
  assert.equal(guru.paidSpendKnown,100);
  assert.equal(guru.paidCount,3);
  assert.equal(guru.rows.find(r=>r.id==='2114682794160824473').linkedRtPaidSpend,20);
  assert.equal(guru.views,39222);
  assert.equal(article.paidSpendKnown,10);
  assert.equal(guru.paidSpendKnown+article.paidSpendKnown,grouped.summary.paidSpendKnown);
  assert.equal(article.views,null);
  assert.equal(article.published,0);
  assert.equal(article.viewScope,'ORIGINAL_X_POSTS');
  assert.equal(article.trackingWarning.includes('no original X post URL'),true);
});

test('Unmonitored original X views are verified from provider and refreshed with backoff',async()=>{
  let memory=null,calls=0;
  const store={get:async()=>memory,setJSON:async(_,v)=>{memory=v;}};
  const fetcher=async()=>{calls++;return Response.json({tweet:{
    id:'2114682794160824473',views:32599,likes:167,retweets:72,replies:160
  }});};
  const rows=[{sourcePostUrl:originalB,paid:true,posted:false,cost:20}];
  const first=await readArticleOriginalMetrics(rows,{store,fetcher,now:Date.parse('2026-11-24T10:00:00Z')});
  assert.equal(first.metrics['2114682794160824473'].views,32599);
  assert.equal(calls,1);
  const second=await readArticleOriginalMetrics(rows,{store,fetcher,now:Date.parse('2026-11-24T10:20:00Z')});
  assert.equal(second.metrics['2114682794160824473'].views,32599);
  assert.equal(calls,1);
});

test('Every native report table can be sorted; stale weekly article drawer is removed',()=>{
  const tableJs=readFileSync('public/xtracker-tables.js','utf8');
  const html=readFileSync('public/index.html','utf8');
  const reporting=readFileSync('public/campaign-reporting.js','utf8');
  const ui=readFileSync('public/fanvue-ui.js','utf8');
  assert.match(tableJs,/#mainContent table:not\(\.xt-data-table\)/);
  assert.match(tableJs,/setAttribute\('aria-sort'/);
  assert.match(reporting,/Paid RT spend/);
  assert.match(reporting,/Original X views/);
  // v3.1 redesign: the stale weekly article drawer is removed entirely, and the new
  // results tables sort from explicit, accessible header controls.
  assert.doesNotMatch(html,/dashboard-article-drawer/);
  assert.match(ui,/aria-sort="'\+dir\+'"/);
  assert.match(ui,/data-sort="'\+esc\(c\.key\)\+'"/);
});
