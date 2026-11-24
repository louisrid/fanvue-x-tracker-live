// Campaign registry API. GET returns the non-archived registry for rendering.
// Every write requires the existing ADMIN_KEY bearer token (timing-safe, as admin.mjs).
// Uses only its own Blobs store; it never reads or writes any other store, sheet or feed.
import {getStore} from '@netlify/blobs';
import {json,adminKey} from '../lib/shared.mjs';
import {REGISTRY_STORE,REGISTRY_KEY,MAX_BODY_BYTES,RegistryInputError,applyAction,publicView,fullView,authorised} from '../lib/campaign-registry.mjs';

export function makeRegistryHandler({storage=()=>getStore({name:REGISTRY_STORE,consistency:'strong'}),secret=adminKey,clock=()=>new Date()}={}){
  return async request=>{
    if(request.method==='GET'||request.method==='HEAD'){
      try{
        const saved=await storage().get(REGISTRY_KEY,{type:'json'});
        return json({ok:true,...publicView(saved)});
      }catch{return json({ok:false,error:'Campaign registry temporarily unavailable.'},503);}
    }
    if(request.method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
    const key=secret();
    if(!key)return json({ok:false,error:'ADMIN_SETUP_REQUIRED'},503);
    if(!authorised(request,key))return json({ok:false,error:'UNAUTHORISED'},401);
    let action;
    try{
      const raw=await request.text();
      if(Buffer.byteLength(raw)>MAX_BODY_BYTES)return json({ok:false,error:'REQUEST_TOO_LARGE'},413);
      action=JSON.parse(raw);
    }catch{return json({ok:false,error:'INVALID_JSON'},400);}
    try{
      const store=storage();
      if(action?.action==='list'){
        return json({ok:true,...fullView(await store.get(REGISTRY_KEY,{type:'json'}))});
      }
      // Optimistic concurrency: a write only lands on the version it was computed from.
      for(let attempt=0;attempt<3;attempt++){
        const current=await store.getWithMetadata(REGISTRY_KEY,{type:'json'});
        const next=applyAction(current?.data,action,clock());
        const result=await store.setJSON(REGISTRY_KEY,next,current?{onlyIfMatch:current.etag}:{onlyIfNew:true});
        if(result?.modified!==false)return json({ok:true,...fullView(next),...(action.action==='create'?{slug:next.campaigns.at(-1).slug}:{})});
      }
      return json({ok:false,error:'The registry changed while saving. Please try again.'},409);
    }catch(error){
      if(error instanceof RegistryInputError)return json({ok:false,error:error.message,field:error.field},422);
      return json({ok:false,error:'Campaign registry temporarily unavailable.'},503);
    }
  };
}

export default makeRegistryHandler();
