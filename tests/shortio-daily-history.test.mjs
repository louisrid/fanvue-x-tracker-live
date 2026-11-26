import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyHumanClicks,readClicks,campaignLinkClicks} from '../netlify/lib/gta-shortio.mjs';
const memory=()=>{const m=new Map();return {get:async k=>m.get(k),setJSON:async(k,v)=>m.set(k,structuredClone(v))};};
test('Short.io daily counts use exact post-publication day intervals and human counts only',async()=>{
 const cache=memory(),calls=[];const end='2026-11-26T15:00:00.000Z';
 const rows=await dailyHumanClicks('test-link','2026-11-25T17:00:00.000Z',end,{key:'test-key',cache,now:Date.parse(end),fetcher:async u=>{
  const url=new URL(u);calls.push(url);assert.equal(url.hostname,'statistics.short.io');
  return Response.json({humanClicks:calls.length===1?10:64,totalClicks:999,interval:{startDate:url.searchParams.get('startDate'),endDate:url.searchParams.get('endDate')}});
 }});
 assert.deepEqual(rows.map(r=>r.clicks),[10,64]);assert.equal(rows[0].start,'2026-11-25T17:00:00.000Z');assert.equal(rows[0].end,'2026-11-25T23:59:59.999Z');assert.equal(rows[1].start,'2026-11-26T00:00:00.000Z');assert.equal(rows[1].end,end);
});
test('daily history retains verified readings on failure and never invents zero or accepts an ignored interval',async()=>{
 const cache=memory(),end='2026-11-26T15:00:00.000Z',options={key:'test-key',cache,now:Date.parse(end)};
 const good=async u=>{const q=new URL(u).searchParams;return Response.json({humanClicks:7,interval:{startDate:q.get('startDate'),endDate:q.get('endDate')}});};
 await dailyHumanClicks('test','2026-11-26T01:00:00Z',end,{...options,fetcher:good});
 const malformed=async()=>Response.json({humanClicks:0,totalClicks:800,interval:{startDate:'2020-01-01',endDate:'2020-01-02'}});
 const retained=await dailyHumanClicks('test','2026-11-26T01:00:00Z',end,{...options,now:options.now+120000,fetcher:malformed});assert.equal(retained[0].clicks,7);assert.equal(retained[0].stale,true);
 const missing=await dailyHumanClicks('missing','2026-11-26T01:00:00Z',end,{...options,fetcher:malformed});assert.deepEqual(missing,[]);
});
test('UK summer-time daily boundaries are midnight in London',async()=>{
 const rows=await dailyHumanClicks('summer','2026-06-25T14:00:00Z','2026-06-26T12:00:00Z',{key:'test-key',cache:memory(),now:Date.parse('2026-06-26T12:00:00Z'),fetcher:async u=>{const q=new URL(u).searchParams;return Response.json({humanClicks:1,interval:{startDate:q.get('startDate'),endDate:q.get('endDate')}});}});
 assert.equal(rows[0].end,'2026-06-25T22:59:59.999Z');assert.equal(rows[1].start,'2026-06-25T23:00:00.000Z');
});

test('all GTA groups can collect daily clicks through the existing refresh without duplicate links',async()=>{
 const end=Date.parse('2026-11-26T15:00:00Z'),row={code:'GTA1-A',campaign:'GTA1',posted:true,postUrl:'https://x.com/publisher/status/2125636187897610404',trackingUrl:'https://example.com/a'};
 const report=await campaignLinkClicks([row,{...row,code:'duplicate'}],{dailyHistory:true,key:'test-key',store:memory(),now:end,force:true,fetcher:async u=>{const url=new URL(u),q=url.searchParams;if(url.hostname==='api.short.io')return Response.json({idString:'one-link'});return Response.json({humanClicks:74,interval:{startDate:q.get('startDate'),endDate:q.get('endDate')}});}});
 assert.equal(report.links.length,1);assert.ok(report.links[0].dailyClicks.length>=1);assert.equal(report.links[0].postPublicationClicks,74);
});
