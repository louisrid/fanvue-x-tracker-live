import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCourseClicksHandler,summariseCourseBeaconKeys,isTrustedCourseBeacon} from '../netlify/functions/discord-course-clicks.mjs';
const NOW=Date.parse('2026-11-23T18:00:00.000Z');
const uuid='11111111-1111-4111-8111-111111111111';
const key=t=>'click-'+t+'-'+uuid;
const beacon=(method='HEAD',ua='Fanvue-Academy-Course-Tracker/1.0')=>new Request('https://x.netlify.app/.netlify/functions/discord-course-clicks?source=discord-free-course',{method,headers:{'user-agent':ua}});
test('only HEAD from the Academy course tracker is a genuine click beacon',()=>{
  assert.equal(isTrustedCourseBeacon(beacon()),true);
  assert.equal(isTrustedCourseBeacon(beacon('GET')),false);
  assert.equal(isTrustedCourseBeacon(beacon('HEAD','Discordbot/1.0')),false);
});
test('click totals and rolling seven days are calculated from stored events',()=>{
  assert.deepEqual(summariseCourseBeaconKeys([
    key(NOW-3000),key(NOW-2*24*3600000),key(NOW-9*24*3600000),'garbage',key(NOW+200000)
  ],NOW),{total:3,last7Days:2});
});
test('tracked event writes to persistent store while HEAD monitoring is ignored',async()=>{
  const keys=[],store={async set(k,v){keys.push(k);assert.equal(v,'1')},
    async *list(){yield {blobs:keys.map(key=>({key}))}}};
  const handle=makeCourseClicksHandler({storage:()=>store,clock:()=>NOW,randomId:()=>uuid});
  const ping=await handle(beacon());
  assert.equal(ping.status,200);
  assert.equal(keys.length,1);
  const monitoring=await handle(beacon('GET'));
  assert.equal(monitoring.status,302);
  assert.equal(keys.length,1);
  const report=await handle(new Request('https://x.netlify.app/.netlify/functions/discord-course-clicks'));
  assert.equal(report.status,200);
  const d=await report.json();
  assert.deepEqual({total:d.total,last7Days:d.last7Days},{total:1,last7Days:1});
  assert.equal(d.period,'since-counter-enabled');
});
test('reports unavailable on storage errors; never invents zero',async()=>{
  const handler=makeCourseClicksHandler({storage:()=>({async *list(){throw Error('Offline')}})});
  const res=await handler(new Request('https://x.netlify.app/.netlify/functions/discord-course-clicks'));
  assert.equal(res.status,503);
  const json=await res.json();
  assert.equal(json.ok,false);
  assert.equal('total' in json,false);
});
