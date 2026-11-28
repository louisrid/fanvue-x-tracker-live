import {getStore} from '@netlify/blobs';
import {adminKey,json} from '../lib/shared.mjs';
import {makeCoordinator,scopes} from '../lib/durable-refresh.mjs';
export default async function handler(req,context){
  const deployment=context?.deploy?.id||process.env.DEPLOY_ID||process.env.COMMIT_REF||'20261128-refresh-idle-v66';
  const secret=process.env.TRACKER_WORKER_KEY||adminKey();
  const origin=new URL(req.url).origin;
  const coordinator=makeCoordinator({
    store:getStore({name:'fanvue-durable-refresh-v1',consistency:'strong'}),
    dispatch:async id=>{
      const response=await fetch(new URL('/.netlify/functions/tracker-refresh-background',origin),{
        method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+secret},body:JSON.stringify({id}),signal:AbortSignal.timeout(10000)
      });
      if(!response.ok)throw Error('Background worker unavailable');
    }
  });
  try{
    if(req.method==='GET')return json({ok:true,deployment,refresh:await coordinator.status()});
    if(req.method!=='POST')return json({ok:false,error:'Method not allowed'},405);
    if(!secret)return json({ok:false,error:'Refresh service unavailable'},503);
    if(req.headers.get('origin')!==origin||!['same-origin','none',null].includes(req.headers.get('sec-fetch-site')))return json({ok:false,error:'Refresh must be started from this dashboard'},403);
    const raw=await req.text();if(raw.length>1024)return json({ok:false,error:'Invalid request'},400);
    let scope;try{scope=JSON.parse(raw).scope;}catch{return json({ok:false,error:'Invalid request'},400);}
    if(!scopes.includes(scope))return json({ok:false,error:'Invalid refresh scope'},400);
    return json({ok:true,deployment,refresh:await coordinator.start(scope)},202);
  }catch{return json({ok:false,error:'Refresh status temporarily unavailable'},503);}
}
