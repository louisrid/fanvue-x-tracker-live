import {getStore} from '@netlify/blobs';

// Reuse the GET/HEAD beacon already sent by the Academy's tracked Discord button.
// This is separate from X placements, Short.io reports and paid campaign clicks.
const SOURCE='discord-free-course';
const NAME='fanvue-discord-course-beacons-v1';
const TRUSTED_AGENT=/^Fanvue-Academy-Course-Tracker\/\d+(?:\.\d+)*$/i;
const WEEK=7*24*60*60*1000;
const BOT_HEALTH='https://fanvue-academy-invite-bot.onrender.com/healthz';
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
      if(req.method!=='GET'&&req.method!=='HEAD')return new Response(null,{status:405,headers:responseHeaders});
      // Netlify may surface the bot's rewritten HEAD beacon as GET, so trust the
      // bot user-agent rather than the rewritten method. Normal browser/API GETs
      // never increment the counter.
      if(!isTrustedCourseBeacon(req))return new Response(null,{status:200,headers:responseHeaders});
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
      const stored=summariseCourseBeaconKeys(keys,clock());

      let live=null;
      try{
        const response=await fetch(BOT_HEALTH,{headers:{accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(7000)});
        const data=await response.json();
        if(response.ok&&data?.ok===true&&Number.isSafeInteger(data.courseClicks)&&data.courseClicks>=0){
          live={
            total:data.courseClicks,
            last7Days:Number.isSafeInteger(data.courseClicksLast7Days)&&data.courseClicksLast7Days>=0
              ?data.courseClicksLast7Days:null,
            lastCourseClickAt:data.lastCourseClickAt||null
          };
        }
      }catch(error){
        console.warn('Live Discord course counter unavailable; using Netlify fallback:',error?.message||error);
      }

      const total=live?Math.max(live.total,stored.total):stored.total;
      const last7Days=live?.last7Days!==null&&live?.last7Days!==undefined
        ?Math.min(total,live.last7Days)
        :Math.min(total,stored.last7Days);

      return Response.json({
        ok:true,
        source:live?'DISCORD_BOT_LIVE':'DISCORD_COURSE_BEACON_FALLBACK',
        period:'since-counter-enabled',
        total,
        last7Days,
        lastCourseClickAt:live?.lastCourseClickAt||null,
        checkedAt:new Date(clock()).toISOString()
      },{headers:responseHeaders});
    }catch(error){
      console.error('Discord course clicks could not be loaded:',error);
      return Response.json({ok:false,error:'Discord course click data is temporarily unavailable.'},
        {status:503,headers:responseHeaders});
    }
  };
}

export default makeCourseClicksHandler();
