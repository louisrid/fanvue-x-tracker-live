import {validCode,buildDestination,trackingRequest} from './tracking.mjs';

// Navigation never needs Sheets, cookies or client-side JavaScript.
export function createRedirectHandler({recordClick,authorise,logWaitMs=750}){
  return async (req,context={})=>{
    if(!['GET','HEAD'].includes(req.method))return new Response('Method not allowed',{status:405});
    const {u,code,cta}=trackingRequest(req.url);
    if(!validCode(code))return new Response('Invalid tracking ID',{status:404});
    const test=u.searchParams.get('test')==='1';
    if(test&&!authorise(req))return new Response('Unauthorised',{status:401});
    const excluded=(req.headers.get('cookie')||'').split(';').some(v=>v.trim()==='fanvue_exclude_clicks=1');
    let status=excluded?'excluded-browser':'not-recorded-head';
    if(req.method==='GET'&&!excluded){
      const event={timestamp:new Date().toISOString(),code,cta,...(test?{test:true}:{})};
      const persist=async()=>{
        try{await recordClick(event,test);return true;}
        catch{console.error('Click event storage unavailable');return false;}
      };
      const task=persist();
      if(!test&&typeof context.waitUntil==='function'){
        context.waitUntil(task);status='queued';
      }else{
        // Explicit isolated tests wait for their write; local fallback is bounded.
        let timer;
        const result=test?await task:await Promise.race([task,new Promise(resolve=>{timer=setTimeout(()=>resolve(null),logWaitMs);})]);
        if(timer)clearTimeout(timer);
        status=result===true?(test?'test-recorded':'recorded'):result===null?'storage-pending':'storage-error';
      }
    }
    const destination=buildDestination(code,cta);
    const body=req.method==='HEAD'?null:`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Continue</title><p><a href="${destination.replaceAll('&','&amp;')}">Continue to ${cta==='PRISM'?'Prism':'Fanvue'}</a></p></html>`;
    return new Response(body,{status:302,headers:{location:destination,'cache-control':'no-store','content-type':'text/html; charset=utf-8',
      'referrer-policy':'no-referrer','x-robots-tag':'noindex','x-tracker-event-status':status}});
  };
}
