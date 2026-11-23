import {json} from '../lib/shared.mjs';
import {workerAuth} from '../lib/metrics.mjs';
import {adminKey} from '../lib/shared.mjs';
import {readBoosts,refreshBoosts} from '../lib/boosts.mjs';
function refreshTiming(tweets){
  const serverNow=Date.now();
  const nextRefreshAt=Math.max(0,...tweets.map(t=>Date.parse(t.last_attempt_at)||0))+300000;
  return {serverNow,nextRefreshAt,retryAfter:Math.max(0,Math.ceil((nextRefreshAt-serverNow)/1000))};
}
export default async (req: Request)=>{
  if(req.method==='POST'){
    const secret=process.env.TRACKER_WORKER_KEY||adminKey();
    const sameOrigin=req.headers.get('origin')===new URL(req.url).origin&&['same-origin','none',null].includes(req.headers.get('sec-fetch-site'));
    if(!workerAuth(req)&&!(sameOrigin&&secret))return json({ok:false,error:'Refresh must be started from this dashboard.'},403);
    try{
      const result=await refreshBoosts({manual:true});
      const ok=result.total>0&&result.updated===result.total&&result.errors.length===0;
      const tweets=await readBoosts();
      return json({ok,...result,tweets,...refreshTiming(tweets),error:ok?undefined:result.errors.length?'X RTs could not fully refresh. Last verified readings are preserved.':result.skipped?'X RTs refreshed recently or a refresh is running. Please wait five minutes.':'No X RTs to refresh.'},ok?200:result.errors.length?502:429);
    }catch{return json({ok:false,error:'X RTs refresh unavailable. Last verified readings are preserved.'},503);}
  }
  if(req.method!=='GET')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
  try{const tweets=await readBoosts();return json({ok:true,tweets,...refreshTiming(tweets),intervalHours:2},200);}
  catch{return json({ok:false,error:'X RTs is temporarily unavailable. Previously loaded figures are preserved.'},503);}
};
