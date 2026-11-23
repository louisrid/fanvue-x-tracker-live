import test from 'node:test';
import assert from 'node:assert/strict';
import {createRedirectHandler} from '../netlify/lib/redirect-handler.mjs';
const origin='https://elegant-swan-98c20a.netlify.app';

test('a delayed analytics write does not delay the production redirect',async()=>{
  let finish,recorded,task;
  const pending=new Promise(resolve=>{finish=resolve;});
  const handler=createRedirectHandler({authorise:()=>false,recordClick:async e=>{recorded=e;await pending;}});
  const response=await handler(new Request(origin+'/r/A01-P14'),{waitUntil:p=>{task=p;}});
  assert.equal(response.status,302);assert.equal(response.headers.get('x-tracker-event-status'),'queued');
  assert.equal(recorded.code,'A01-P14');assert.ok(task);finish();assert.equal(await task,true);
});

test('analytics failure keeps the destination accessible and isolated writes stay verifiable',async()=>{
  const handler=createRedirectHandler({authorise:r=>r.headers.get('authorization')==='Bearer test-only',recordClick:async()=>{throw Error('Unavailable');}});
  let task;
  const response=await handler(new Request(origin+'/r/A01-P14'),{waitUntil:p=>{task=p;}});
  assert.equal(response.status,302);assert.equal(await task,false);
  assert.equal((await handler(new Request(origin+'/r/A01-P14?test=1'))).status,401);
  const isolated=await handler(new Request(origin+'/r/A01-P14?test=1',{headers:{authorization:'Bearer test-only'}}));
  assert.equal(isolated.status,302);assert.equal(isolated.headers.get('x-tracker-event-status'),'storage-error');
});

test('permanent path identity wins over extra query parameters and no browser features are needed',async()=>{
  let writes=0;
  const handler=createRedirectHandler({authorise:()=>true,recordClick:async()=>{writes++;}});
  const response=await handler(new Request(origin+'/r/a01-p14/?code=A01-P19&lang=ar&test=1',{headers:{'user-agent':'LegacyBrowser','accept-language':'ar'}}));
  assert.equal(new URL(response.headers.get('location')).searchParams.get('utm_content'),'P14');
  assert.equal(response.headers.get('x-tracker-event-status'),'test-recorded');assert.equal(writes,1);
  assert.equal((await handler(new Request(origin+'/r/not-valid'))).status,404);
  assert.equal((await handler(new Request(origin+'/r/A01-P14',{method:'POST'}))).status,405);
  assert.equal((await handler(new Request(origin+'/r/A01-P14',{method:'HEAD'}))).status,302);
  assert.equal(writes,1);
});

test('browser exclusion preserves destinations without writing any click, with exact cookie matching',async()=>{
  let writes=0;const handler=createRedirectHandler({authorise:()=>true,recordClick:async()=>{writes++;}});
  for(const path of ['/r/A01-P14','/s/A01-P18','/p/A01-P01']){
    const response=await handler(new Request(origin+path,{headers:{cookie:'other=1; fanvue_exclude_clicks=1'}}));
    assert.equal(response.status,302);assert.equal(response.headers.get('x-tracker-event-status'),'excluded-browser');assert.ok(response.headers.get('location'));
  }
  assert.equal(writes,0);
  for(const cookie of ['fanvue_exclude_clicks=0','not_fanvue_exclude_clicks=1','fanvue_exclude_clicks=11'])await handler(new Request(origin+'/r/A01-P14?test=1',{headers:{cookie}}));
  assert.equal(writes,3);
});
