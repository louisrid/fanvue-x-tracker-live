import test from 'node:test';
import assert from 'node:assert/strict';
import {createOfReport} from '../netlify/functions/of-report.mjs';
import {refreshMetrics} from '../netlify/lib/metrics.mjs';

const publisher={code:'OF1',publisher:'campaign',posted:true,postUrl:'https://x.com/campaign/status/123',paid:true,cost:25};
function fixture(){
  const saved=new Map();let calls=0,fail=false;
  const storage={get:async key=>saved.get(key),setJSON:async(key,value)=>saved.set(key,structuredClone(value))};
  const handler=createOfReport({readPublishers:async()=>[publisher,{...publisher,code:'OF2',posted:false}],
    readEvents:async()=>[{code:'OF1',timestamp:'2026-11-16T10:00:00Z',cta:'FANVUE'}],
    metricsStore:()=>storage,cache:async(key,req,context,load)=>load(),
    refresh:(rows,options)=>refreshMetrics(rows,{...options,fetcher:async()=>{
      calls++;if(fail)throw new Error('Provider unavailable');
      return Response.json({tweet:{id:'123',views:120,likes:12,replies:3,retweets:5}});
    }})});
  const request=method=>handler(new Request('https://fixture.test/.netlify/functions/of-report',{method})).then(r=>r.json());
  return {request,saved,calls:()=>calls,fail:()=>{fail=true;}};
}
test('OF refresh fetches published posts and returns metrics, engagement inputs and verified clicks; GET reuses readings',async()=>{
  const f=fixture(),report=await f.request('POST');
  assert.equal(f.calls(),1);assert.equal(report.updated,1);assert.equal(report.total,1);
  assert.deepEqual([report.publishers[0].views,report.publishers[0].likes,report.publishers[0].replies,report.publishers[0].reposts],[120,12,3,5]);
  assert.equal(report.publishers[0].clicks,1);assert.equal(report.activity[0].clicks,1);
  assert.equal(report.publishers[1].views,null);
  assert.equal((await f.request('GET')).publishers[0].views,120);assert.equal(f.calls(),1);
  assert.equal((await f.request('POST')).skipped,true);assert.equal(f.calls(),1);
});
test('a failed provider refresh retains verified metrics and reports no successful update',async()=>{
  const f=fixture();await f.request('POST');f.fail();
  f.saved.get('latest').lastManualAt=0;
  const report=await f.request('POST');
  assert.equal(report.updated,0);assert.equal(report.errors.length,1);
  assert.equal(report.publishers[0].views,120);assert.equal(report.publishers[0].metricStatus,'last-known-good');
});
test('unsupported methods do not fetch or mutate reports',async()=>{
  const handler=createOfReport({readPublishers:()=>{throw new Error('Must not run');}});
  assert.equal((await handler(new Request('https://fixture.test',{method:'DELETE'}))).status,405);
});

test('OF browser refresh sends POST and renders returned readings with accurate status',async()=>{
  const {readFileSync}=await import('node:fs');const {default:vm}=await import('node:vm');
  const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const button={disabled:false,classList:{add(){},remove(){}},setAttribute(){},removeAttribute(){}};
  const status={},nodes={ofRefreshStatus:status,ofRefreshTime:{}};
  const report={ready:true,updated:1,total:2,errors:[{code:'OF2'}],publishers:[{...publisher,views:120,likes:12,replies:3,reposts:5}]};
  let rendered=0;
  const context={state:{page:'of'},document:{querySelector:()=>button},el:id=>nodes[id],
    fetch:async(url,options)=>{assert.match(url,/of-report/);assert.equal(options.method,'POST');return Response.json(report);},
    AbortSignal,storage:{set(){}},validDate:()=>null,preserveReadingPosition:fn=>fn(),
    renderOfReport:()=>rendered++,renderCampaigns(){},setTimeout};
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('async function refreshOfReport('),source.indexOf('async function refreshXStats('))+
    source.slice(source.indexOf('async function loadOfReport('),source.indexOf('async function load(force=')),context);
  await context.refreshOfReport();
  assert.equal(context.state.ofCampaign.publishers[0].views,120);assert.equal(rendered,1);
  assert.match(status.textContent,/Updated 1 of 2 X posts · other saved readings retained/);
  assert.equal(button.disabled,false);
  context.fetch=async()=>{throw new Error('Network unavailable');};
  await context.refreshOfReport();
  assert.equal(context.state.ofCampaign.publishers[0].views,120);
  assert.equal(status.className,'x-refresh-status is-error');assert.equal(button.disabled,false);
});

test('first GET populates missing engagement readings without a manual refresh',async()=>{
  const f=fixture(),report=await f.request('GET');
  assert.equal(f.calls(),1);
  assert.deepEqual([report.publishers[0].views,report.publishers[0].likes,report.publishers[0].replies,report.publishers[0].reposts],[120,12,3,5]);
  await f.request('GET');assert.equal(f.calls(),1);
});

test('failed automatic population is throttled and never fabricates counts',async()=>{
  const f=fixture();f.fail();
  const report=await f.request('GET');
  assert.equal(report.updated,0);assert.equal(report.publishers[0].views,null);
  await f.request('GET');assert.equal(f.calls(),1);
});
