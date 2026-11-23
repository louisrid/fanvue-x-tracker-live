import {CLICK_COUNT_START_AT} from '../lib/click-baseline.mjs';
import {readMetricState,readMetricHistory,applyMetrics} from '../lib/metrics.mjs';
import {homePaidCodes} from '../lib/home-scope.mjs';
import {json,readFeed,readEvents,getCounts,buildDestination,SITE_URL,FANVUE_SITE_URL,adminKey} from '../lib/shared.mjs';
import {cachedReport} from '../lib/report-cache.mjs';
import metricsHandler from './metrics.mjs';

function ukDay(when){
  const date=new Date(when);if(Number.isNaN(date.getTime()))return '';
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function summariseClickActivity(events){
  const groups=new Map();
  for(const e of events){const date=ukDay(e.timestamp);if(!date||!/^A\d{2}-P\d{2,3}$/.test(String(e.code||'')))continue;
    const key=date+'|'+e.code,existing=groups.get(key)||{date,code:e.code,clicks:0};existing.clicks++;groups.set(key,existing);}
  return [...groups.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.code.localeCompare(b.code));
}
async function dashboard(req){
  if(req.method==='POST'){
    const origin=new URL(req.url).origin;
    if(req.headers.get('origin')!==origin||!['same-origin','none',null].includes(req.headers.get('sec-fetch-site')))
      return json({ok:false,error:'Refresh must be started from this dashboard.'},403);
    const secret=process.env.TRACKER_WORKER_KEY||adminKey();
    if(!secret)return json({ok:false,error:'Server refresh authentication is not configured.'},503);
    const internal=new Request(req.url,{method:'POST',headers:{authorization:'Bearer '+secret}});
    return metricsHandler(internal);
  }
  if(req.method!=='GET'&&req.method!=='HEAD')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
  try{
    const u=new URL(req.url);
    const [{feed,status,warning},eventResult,metricResult,historyResult]=await Promise.all([
      readFeed({force:u.searchParams.has('refresh')}),
      readEvents({includeOf:false}).then(events=>({events}),()=>({events:[],error:'Verified click storage is temporarily unavailable.'})),
      readMetricState().catch(()=>({metrics:{},errors:[],lastSuccessfulAt:'',lastAttemptAt:''})),
      readMetricHistory().catch(()=>[])
    ]);
    const {events}=eventResult,clickError=eventResult.error||'',counts=getCounts(events);
    const metricState=metricResult,metricHistory=historyResult;
    const placements=applyMetrics(feed.placements,metricState).map(p=>{
      const clicks=counts[p.code]||{};
      return {...p,trackingUrl:`${SITE_URL}/r/${p.code}`,fanvueTrackingUrl:`${FANVUE_SITE_URL}/s/${p.code}`,
        destinationUrl:buildDestination(p.code,'FANVUE'),
        clicks:clickError?null:(clicks.clicks||0),redirectClicks:clickError?null:(clicks.clicks||0),
        legacyClicks:clicks.prismClicks||0,fanvueClicks:clicks.signupClicks||0,
        firstClick:clicks.firstClick||'',lastClick:clicks.lastClick||'',countVerified:!clickError};
    });
    return json({ok:true,version:'4.0',clickCountStartAt:CLICK_COUNT_START_AT,uiVersion:'5.0.40',placements,hourlyEvents:clickError?null:events.map(({timestamp,code})=>({timestamp,code})),
      homePaidCodes:homePaidCodes(placements,status),homeVerified:['SHEET_LIVE','SHEET_FRESH','SHEET_CACHED'].includes(status),
      campaigns:Array.isArray(feed.campaigns)?feed.campaigns:[],
      metricHistory:[...(Array.isArray(feed.metricHistory)?feed.metricHistory:[]),...metricHistory],
      metricAutomation:{intervalHours:2,lastSuccessfulAt:metricState.lastSuccessfulAt,lastAttemptAt:metricState.lastAttemptAt,errors:metricState.errors},
      sourceStatus:status,sheetVerifiedAt:feed.fetchedAt,checkedAt:new Date().toISOString(),
      trackingReady:!clickError,trackingStatus:clickError?'REDIRECT_STORAGE_ERROR':'REDIRECT_STORAGE_CONNECTED',
      totalEventsStored:clickError?null:events.length,
      clickActivity:clickError?null:summariseClickActivity(events),
      adminConfigured:!!adminKey(),
      warning:[warning,clickError].filter(Boolean).join(' ')});
  }catch(e){return json({ok:false,error:'Dashboard data is temporarily unavailable. Please retry.',placements:[]},503)}
};

export default (req,context)=>req.method==='GET'?cachedReport('dashboard-v1',req,context,()=>dashboard(req)):dashboard(req);
