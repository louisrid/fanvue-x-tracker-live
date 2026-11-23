import {store,json} from './shared.mjs';
// Only successful, verified responses are retained; refresh failures never erase them.
export async function cachedReport(key,request,context,load,cacheOverride){
  const cache=cacheOverride||store('x-tracker-report-cache');
  let previous;try{previous=await cache.get(key,{type:'json'});}catch{}
  if(!previous?.data||previous.data.ok!==true||!Number.isFinite(previous.savedAt))previous=null;
  const fallback=()=>json({...previous.data,cached:true,refreshing:false,
    warning:'Source refresh failed; showing the last verified report.',cachedAt:new Date(previous.savedAt).toISOString()});
  const refresh=async()=>{
    try{
      const response=await load();
      if(response.ok){
        const data=await response.clone().json();
        if(!data||data.ok!==true||data.trackingReady===false||data.ready===false)return previous?fallback():response;
        try{await cache.setJSON(key,{data,savedAt:Date.now()});}catch{}
      }
      return !response.ok&&previous?fallback():response;
    }catch(error){if(previous)return fallback();throw error;}
  };
  if(previous&&!new URL(request.url).searchParams.has('refresh')){
    const stale=Date.now()-previous.savedAt>45000;
    if(stale&&!context?.waitUntil)return refresh();
    if(stale&&context?.waitUntil)context.waitUntil(refresh().catch(()=>{}));
    return json({...previous.data,cached:true,refreshing:stale,cachedAt:new Date(previous.savedAt).toISOString()});
  }
  return refresh();
}
