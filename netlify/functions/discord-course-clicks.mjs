import {getStore} from '@netlify/blobs';

// Reuse the GET/HEAD beacon already sent by the Academy's tracked Discord button.
// This is separate from X placements, Short.io reports and paid campaign clicks.
const SOURCE='discord-free-course';
const NAME='fanvue-discord-course-beacons-v1';
const TRUSTED_AGENT=/^Fanvue-Academy-Course-Tracker\/\d+(?:\.\d+)*$/i;
const WEEK=7*24*60*60*1000;
const responseHeaders={'cache-control':'no-store, max-age=0'};

export const isCourseBeacon=req=>new URL(req.url).searchParams.get('source')===SOURCE;
export const isTrustedCourseBeacon=req=>
  req.method==='HEAD'&&TRUSTED_AGENT.test(req.headers.get('user-agent')||'');

export function summariseCourseBeaconKeys(keys,now=Date.now()){
  let total=0,last7Days=0;
  for(const key of keys){
    const match=/^click-(\d{13})-[a-f0-9-]{36}$/i.exec(String(key||''));
    if(!match)continue;
    const timestamp=Number(match[1]);
    if(!Number.isFinite(timestamp)||timestamp>now+60_000)continue;
    total++;
    if(timestamp>=now-WEEK)last7Days++;
  }
  return {total,last7Days};
}

export function makeCourseClicksHandler({
  storage=()=>getStore({name:NAME,consistency:'strong'}),
  clock=()=>Date.now(),
  randomId=()=>crypto.randomUUID()
}={}){
  return async req=>{
    if(isCourseBeacon(req)){
      if(req.method!=='HEAD')return Response.redirect(new URL('/',req.url),302);
      // Do not treat a browser visit, crawler, or API stats request as a click.
      if(!isTrustedCourseBeacon(req))return Response.redirect(new URL('/',req.url),302);
      try{
        await storage().set('click-'+clock()+'-'+randomId(),'1');
        return new Response(null,{status:200,headers:responseHeaders});
      }catch(error){
        console.error('Discord course beacon could not be stored:',error);
        return new Response(null,{status:503,headers:responseHeaders});
      }
    }

    if(req.method!=='GET')return new Response(null,{status:405,headers:responseHeaders});
    try{
      const keys=[];
      for await(const page of storage().list({paginate:true})){
        for(const blob of page.blobs||[])keys.push(blob.key);
      }
      return Response.json({ok:true,source:'DISCORD_COURSE_HEAD_BEACON',period:'since-counter-enabled',
        ...summariseCourseBeaconKeys(keys,clock()),checkedAt:new Date(clock()).toISOString()},
        {headers:responseHeaders});
    }catch(error){
      console.error('Discord course clicks could not be loaded:',error);
      return Response.json({ok:false,error:'Discord course click data is temporarily unavailable.'},
        {status:503,headers:responseHeaders});
    }
  };
}

export default makeCourseClicksHandler();
