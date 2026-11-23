import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ExcelJS from 'exceljs';
import {parseQuotedPost} from '../netlify/lib/gta-x-metrics.mjs';
import {summariseQuotedOriginals} from '../netlify/lib/quoted-originals.mjs';
import {parseArticleRtWorkbook,assembleCampaignOverview,enrichArticleRtMetrics} from '../netlify/functions/campaign-overview.mjs';

const original={id:'2122103967551295552',url:'https://x.com/iluv_papi/status/2122103967551295552',
  author:{screen_name:'iluv_papi'},views:19906,likes:430,retweets:80,replies:12};
const metric=(v,quoted)=>({views:v,likes:10,reposts:3,replies:2,at:'2026-11-23T17:00:00Z',
  quotedPost:quoted?{...original,handle:'iluv_papi',url:original.url,views:original.views,
    likes:original.likes,reposts:original.retweets,replies:original.replies,at:'2026-11-23T17:00:00Z'}:null});
const qrt=(id,price,views)=>({
  publisher:'Publisher '+id,campaign:'GTAQ',posted:true,paid:true,cost:price,
  postUrl:'https://x.com/publisher/status/'+id,views,likes:10,reposts:3,replies:2,
  allTimeClicks:31,clicks:11,metricAt:'2026-11-23T17:00:00Z'
});

test('X quote data parses provider-confirmed original post and ignores incomplete or mismatched links',()=>{
  const parsed=parseQuotedPost({quote:original},'2026-11-23T17:00:00Z');
  assert.equal(parsed.id,original.id);
  assert.equal(parsed.handle,'iluv_papi');
  assert.equal(parsed.views,19906);
  assert.equal(parsed.url,original.url);
  assert.equal(parseQuotedPost({quote:{...original,id:'99'}},'2026-11-23T17:00:00Z'),null);
  assert.equal(parseQuotedPost({quote:{id:original.id,url:'https://untrusted.example/status/1'}},'2026-11-23T17:00:00Z'),null);
  assert.equal(parseQuotedPost({quote:null},'2026-11-23T17:00:00Z'),null);
});

test('QRTs group under one quoted original without doubling original view count',()=>{
  const a=qrt('2122351628162641990',70,5000),b=qrt('2122351628162641991',50,9000),u=qrt('2122351628162641992',80,400);
  const source={metrics:null};
  const state={'2122351628162641990':metric(5000,true),'2122351628162641991':metric(9000,true)};
  const result=summariseQuotedOriginals([a,b,u],state);
  assert.equal(result.rows.length,1);
  assert.equal(result.summary.publishedQrts,3);
  assert.equal(result.summary.matchedQrts,2);
  assert.equal(result.summary.unmatchedQrts,1);
  assert.equal(result.summary.quotedPostViews,19906);
  assert.equal(result.summary.qrtViews,14000);
  assert.equal(result.summary.allocatedPaidSpend,120);
  assert.equal(result.rows[0].paidQrtCount,2);
  assert.equal(result.rows[0].allTimeHumanClicks,62);
  assert.equal(result.rows[0].postPublicationClicks,22);
  // Repeated references to the same X QRT must not increase views or spend.
  assert.deepEqual(summariseQuotedOriginals([a,a,b,u],state).summary,result.summary);
  // Never silently treat a non-GTA QRT placement as part of this campaign.
  assert.deepEqual(summariseQuotedOriginals([{...a,campaign:'GTA1'}],state).rows,[]);
});

test('unknown spend and shared tracking links remain partial and never become invented clicks',()=>{
  const a={...qrt('2122351628162641990',null,null),allTimeClicks:null,clicks:null,sharedTracking:true};
  const r=summariseQuotedOriginals([a],{'2122351628162641990':metric(100,true)});
  assert.equal(r.rows[0].paidSpendKnown,0);
  assert.equal(r.rows[0].unknownPaidCosts,1);
  assert.equal(r.rows[0].allTimeHumanClicks,null);
  assert.equal(r.rows[0].qrtViews,null);
});

test('Article RT workbook preserves separate paid, posted and missing-post-link statuses',()=>{
  const book=new ExcelJS.Workbook(),tab=book.addWorksheet('X Accounts 11 (Article RTs)');
  tab.getRow(7).values=['ACCOUNT','LINK','UTM LINK','TYPE','FOLLOWERS','NOTES','MESSAGED?','RT','QRT','ARTICLE','POST','CUSTOM','1','2','3','4','5','ACCOUNT SUM','METHOD','PAYMENT DETAILS','PAID?','POSTED?','LINK'];
  tab.getRow(8).values=['0xKiyoro','https://x.com/0xKiyoro','','AI','','','FALSE','$15','','','','','TRUE','FALSE','FALSE','FALSE','FALSE','$15','Crypto','','TRUE','TRUE',''];
  tab.getRow(9).values=['Pending','https://x.com/pending','','AI','','','FALSE','$30','','','','','TRUE','FALSE','FALSE','FALSE','FALSE','$30','Crypto','','TRUE','FALSE',''];
  const rows=parseArticleRtWorkbook(book);
  assert.equal(rows.length,2);
  assert.equal(rows[0].publisher,'0xKiyoro');
  assert.equal(rows[0].paid,true);
  assert.equal(rows[0].posted,true);
  assert.equal(rows[0].postUrl,'');
  assert.equal(rows[0].cost,15);
  assert.equal(rows[0].profileUrl,'https://x.com/0xKiyoro');
  assert.equal(rows[0].views,null);
  assert.equal(rows[1].paid,true);
  assert.equal(rows[1].posted,false);
});

test('Unified lifetime report preserves separate campaign totals without invented conversions',()=>{
  const sources={
    gta:{data:{ok:true,ready:true,source:'GOOGLE_SHEETS_LIVE',sourceVerifiedAt:'2026-11-23T17:00:00Z',
      publishers:[{...qrt('2122351628162641990',70,5000),sourceTab:'X Accounts 15 (GTA VI QRTs)'}],
      shortIo:{total:40},originals:{ok:true,ready:true,publishers:[],shortIo:{total:null}},
      quotedOriginals:{scope:'verified-quoted-original-posts-v1',rows:[],summary:{originalPosts:0}}}},
    of:{data:{ok:true,ready:true,checkedAt:'2026-11-23T17:00:00Z',publishers:[]}},
    boosts:{data:{ok:true,tweets:[]}},
    dashboard:{data:{ok:true,placements:[],campaigns:[]}},
    articleRts:{data:{source:'GOOGLE_SHEETS_LIVE',at:'2026-11-23T17:00:00Z',
      rows:[{publisher:'0xKiyoro',cost:15,paid:true,posted:true,postUrl:'',views:null}]}}
  };
  const result=assembleCampaignOverview(sources);
  assert.equal(result.scope,'lifetime-campaign-reporting-v1');
  const gta=result.campaigns.find(c=>c.id==='gta-qrts');
  const rts=result.campaigns.find(c=>c.id==='article-rts');
  const discord=result.campaigns.find(c=>c.id==='discord');
  assert.equal(gta.paidSpendKnown,70);
  assert.equal(gta.views,5000);
  assert.equal(gta.allTimeHumanClicks,40);
  assert.equal(gta.earningCreators,null);
  assert.equal(gta.signups,null);
  assert.equal(gta.kyc,null);
  assert.equal(rts.paidSpendKnown,15);
  assert.equal(rts.published,1);
  assert.equal(rts.coverage.withXMetrics,0);
  assert.equal(rts.views,null);
  assert.match(rts.trackingWarning,/no original X post URL/);
  assert.equal(discord.source,'NOT_CONNECTED');
  assert.equal(discord.earningCreators,null);
  assert.ok(!('totalReach' in result));
  assert.ok(!('totalPaidSpend' in result));
});

test('Reporting UI and original GTA tab exist without altering historic campaign routes',()=>{
  const html=readFileSync('public/index.html','utf8');
  const app=readFileSync('public/app.js','utf8');
  const ui=readFileSync('public/campaign-reporting.js','utf8');
  assert.match(html,/id="page-reporting"/);
  assert.match(html,/campaign-reporting\.js/);
  assert.match(html,/data-gta-tab="quoted"/);
  assert.match(app,/window\.XTrackerCampaignReporting\?\.show\(\)/);
  assert.match(app,/Lifetime campaign performance/);
  assert.match(app,/data-page/);
  assert.match(ui,/postPublicationClicks/);
  assert.match(ui,/Not connected/);
  assert.match(ui,/sourceCampaigns/);
  assert.match(app,/xtracker-gta-report-qrts-v1/);
});

test('Article RT views reuse only an exact verified original X post and never duplicate source views',()=>{
  const rows=[
    {publisher:'Reposter A',postUrl:'https://x.com/original/status/2121000000000000000',paid:true,posted:true,cost:30},
    {publisher:'Reposter B',postUrl:'https://x.com/original/status/2121000000000000000',paid:true,posted:true,cost:50},
    {publisher:'Reposter C',postUrl:'https://x.com/other/status/999',paid:true,posted:true,cost:20}
  ];
  const feeds={boosts:{tweets:[{id:'2121000000000000000',handle:'original',views:15000,likes:200,
    reposts:45,replies:10,at:'2026-11-23T17:00:00Z'}]}};
  const linked=enrichArticleRtMetrics(rows,feeds);
  assert.equal(linked[0].views,15000);
  assert.equal(linked[1].views,15000);
  assert.equal(linked[2].views,undefined);
  assert.equal(linked[0].metricSource,'X_RTS');
  const assembled=assembleCampaignOverview({
    articleRts:{data:{rows,at:'2026-11-23T17:00:00Z',source:'GOOGLE_SHEETS_LIVE'}},
    boosts:{data:{ok:true,tweets:feeds.boosts.tweets}}
  });
  const rts=assembled.campaigns.find(c=>c.id==='article-rts');
  assert.equal(rts.paidSpendKnown,100);
  assert.equal(rts.views,15000);
  assert.equal(rts.coverage.withXMetrics,2);
});
