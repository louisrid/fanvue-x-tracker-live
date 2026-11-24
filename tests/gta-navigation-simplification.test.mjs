import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {summariseQuotedOriginals} from '../netlify/lib/quoted-originals.mjs';

const html=readFileSync('public/index.html','utf8');
const app=readFileSync('public/app.js','utf8');
const reporting=readFileSync('public/campaign-reporting.js','utf8');

test('GTA VI has exactly two actual campaign tabs and no phantom Boosted articles tab',()=>{
  const tabs=[...html.matchAll(/data-gta-tab="([^"]+)"/g)].map(match=>match[1]);
  assert.deepEqual(tabs,['qrts','originals']);
  assert.doesNotMatch(html,/id="gtaTabQuoted"|>Boosted articles<\/button>/);
  assert.doesNotMatch(app,/renderGtaQuotedArticles|gtaTabQuoted|ARTICLES BOOSTED BY QRTS/);
  assert.match(html,/data-gta-tab="qrts">Paid QRTs<\/button>/);
  assert.match(html,/data-gta-tab="originals">Standalone posts<\/button>/);
  assert.match(html,/id="gtaQuotedSources"/);
});

test('Quoted original X sources appear as an expandable section within paid QRTs',()=>{
  assert.match(app,/function renderGtaQuotedSources\(\)/);
  assert.match(app,/gtaState\.tab==='qrts'/);
  assert.match(app,/renderGtaQuotedSources\(\);/);
  assert.match(app,/class="gta-quoted-collapse"/);
  assert.match(app,/Original and QRT views are separate/);
  assert.match(app,/qrt\.trackingUrl/);
  assert.match(app,/qrt\.profileUrl/);
  assert.ok(html.indexOf('id="gtaQuotedSources"')<html.indexOf('id="gtaPublishers"'));
});

test('The real X Article Boosts campaign remains separate from GTA VI',()=>{
  assert.match(html,/dashboard-campaign-pill is-boosts/);
  assert.match(html,/dashboard-pill-copy"><strong>X Article Boosts<\/strong>/);
  assert.match(html,/QRTs · Posts/);
  assert.doesNotMatch(reporting,/function articleSources\(\)/);
});

test('Quote-link aggregation keeps the source post unique, two QRTs, spend and real URLs',()=>{
  const original='https://x.com/viral/status/2122020050635043050';
  const make=(publisher,id,cost,views)=>({
    campaign:'GTAQ',posted:true,paid:true,publisher,
    profileUrl:'https://x.com/'+publisher,
    trackingUrl:'https://irxc49.s.gy/'+publisher,
    postUrl:'https://x.com/'+publisher+'/status/'+id,
    cost,views,likes:10,reposts:2,replies:3,clicks:5,allTimeClicks:7
  });
  const a=make('publisherA','2123818034578194532',50,120);
  const b=make('publisherB','2123842850194706834',60,230);
  const quotedPost={id:'2122020050635043050',url:original,handle:'viral',
    at:'2026-11-24T11:00:00.000Z',views:3200,likes:100,reposts:20,replies:10};
  const metrics={
    '2123818034578194532':{quotedPost},
    '2123842850194706834':{quotedPost}
  };
  const result=summariseQuotedOriginals([a,b],metrics);
  assert.equal(result.summary.originalPosts,1);
  assert.equal(result.summary.matchedQrts,2);
  assert.equal(result.summary.publishedQrts,2);
  assert.equal(result.summary.quotedPostViews,3200);
  assert.equal(result.summary.qrtViews,350);
  assert.equal(result.summary.allocatedPaidSpend,110);
  assert.equal(result.rows[0].originalUrl,original);
  assert.equal(result.rows[0].qrts[0].profileUrl,'https://x.com/publisherA');
  assert.equal(result.rows[0].qrts[1].trackingUrl,'https://irxc49.s.gy/publisherB');
});
