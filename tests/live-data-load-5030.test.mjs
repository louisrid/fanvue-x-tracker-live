import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const js=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const begin=js.indexOf('function applyDashboard('),end=js.indexOf('\nfunction renderOfReport(',begin);
assert(begin>0&&end>begin,'live dashboard loading function exists');
const snippet=js.slice(begin,end);
function fixture({hourlyNeverResolves=false,dashboardOk=true}={}) {
  const state={loading:false,placements:[],campaigns:[],history:[],homeVerified:false,homePaidCodes:new Set(),trackingReady:false,activity:[],activityReady:false,initialLoadSettled:false,loadError:false};
  let rendered=0, hourlyStarted=0, statusCalls=0;
  const payload={ok:true,uiVersion:'5.0.27',homeVerified:true,homePaidCodes:['A01-P01'],trackingReady:true,sourceStatus:'SHEET_LIVE',placements:[{code:'A01-P01',owner:'louis',paid:true,posted:true,cost:180}],hourlyEvents:[{timestamp:'2026-10-19T12:00:00Z',code:'A01-P01'}],clickActivity:[{date:'2026-10-19',code:'A01-P01',clicks:75}],campaigns:[],metricHistory:[]};
  const context={state,Set,Array,Date,Number,console:{info() {},error() {}},
    APP_VERSION:'5.0.30',preserveReadingPosition:update=>update(),el:()=>({innerHTML:''}),AbortSignal,storage:{set(){}},showXRefreshTime(){},renderOfReport(){},refreshGbpRate() {},render(){rendered++},renderDailyOverview() {rendered++},
    updateStatus(){statusCalls++},normaliseActivity:rows=>rows,
    fallbackActivity:async()=>[],refreshHourlyEvents(){hourlyStarted++;return hourlyNeverResolves?new Promise(()=>{}):Promise.resolve()},
    renderWeekly(){},renderKpis(){},renderCharts(){},
    fetch:async()=>({ok:dashboardOk,json:async()=>dashboardOk?payload:{error:'Feed failed'}})
  };
  vm.createContext(context);
  vm.runInContext(js.slice(js.indexOf('function validReport('),js.indexOf('const ICONS=')),context);
  vm.runInContext(snippet,context);
  return {context,state,get rendered(){return rendered},get hourlyStarted(){return hourlyStarted},get statusCalls(){return statusCalls}};
}
test('old live API 5.0.27 does not cause reload loop against client 5.0.30',async()=>{
 const f=fixture();await vm.runInContext('load(true)',f.context);
 assert.equal(f.state.placements.length,1);
 assert.equal(f.state.activity[0].clicks,75);
 assert.equal(f.state.initialLoadSettled,true);
 assert.equal(f.state.loadError,false);
 assert.equal(f.state.loading,false);
 assert(f.rendered>=1);
});
test('hourly timestamps are reused without a second event request',async()=>{
 const f=fixture({hourlyNeverResolves:true});
 await vm.runInContext('load(true)',f.context);
 assert.equal(f.hourlyStarted,0);
 assert.equal(f.state.hourlyEvents.length,1);
 assert.equal(f.state.activityReady,true);
 assert.equal(f.rendered,1);
 assert.equal(f.state.loading,false);
});
test('API failure reports unavailable, never creates fake click counts',async()=>{
 const f=fixture({dashboardOk:false});
 await vm.runInContext('load(true)',f.context);
 assert.equal(f.state.loadError,true);
 assert.equal(f.state.placements.length,0);
 assert(f.statusCalls>=1);
});
