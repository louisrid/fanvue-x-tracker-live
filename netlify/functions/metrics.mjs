import {json} from '../lib/shared.mjs';
import {readMetricState,workerAuth} from '../lib/metrics.mjs';
import {runXRefresh} from './refresh-x-metrics.mjs';
export default async req=>{
  if(req.method==='POST'){
    if(!workerAuth(req))return json({ok:false,error:'UNAUTHORISED'},401);
    try{return json(await runXRefresh());}
    catch(e){return json({ok:false,error:String(e.message||e)},503);}
  }
  if(req.method!=='GET'&&req.method!=='HEAD')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
  try{const state=await readMetricState();return json({ok:true,...state});}
  catch(e){return json({ok:false,error:'Metrics storage is unavailable'},503);}
};
