import {getStore} from '@netlify/blobs';
const STORE='fanvue-discord-member-history-v1';
const BOT_HEALTH='https://fanvue-academy-invite-bot.onrender.com/healthz';

const londonDate=()=>new Intl.DateTimeFormat('en-CA',{
  timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'
}).format(new Date());

export default async req=>{
  if(req.method!=='GET'&&req.method!=='HEAD')return Response.json({ok:false,error:'Method not allowed'},{status:405});
  try{
    const store=getStore({name:STORE,consistency:'strong'});
    const keys=[];
    for await(const page of store.list({paginate:true})){
      for(const blob of page.blobs||[])if(/^day-\d{4}-\d{2}-\d{2}$/.test(blob.key))keys.push(blob.key);
    }
    const latestKeys=keys.sort().slice(-60);
    const items=await Promise.all(latestKeys.map(key=>store.get(key,{type:'json'})));
    const history=items.filter(row=>row&&/^\d{4}-\d{2}-\d{2}$/.test(row.date)&&Number.isSafeInteger(row.memberCount)&&row.memberCount>=0)
      .sort((a,b)=>a.date.localeCompare(b.date));

    let liveCount=null;
    try{
      const response=await fetch(BOT_HEALTH,{headers:{accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(7000)});
      const data=await response.json();
      if(response.ok&&data?.ok===true&&Number.isSafeInteger(data.memberCount)&&data.memberCount>=0)liveCount=data.memberCount;
    }catch(error){
      console.warn('Live Discord member count unavailable; using snapshots:',error?.message||error);
    }

    const historyLatest=history.at(-1)||null;
    const latest=liveCount!==null
      ?{date:londonDate(),memberCount:liveCount,source:'DISCORD_BOT_LIVE',capturedAt:new Date().toISOString()}
      :historyLatest;
    const previous=historyLatest;
    const dailyChange=latest&&previous&&latest.date!==previous.date
      ?latest.memberCount-previous.memberCount
      :history.length>1&&liveCount===null
        ?history.at(-1).memberCount-history.at(-2).memberCount
        :null;

    return Response.json({
      ok:true,
      source:liveCount!==null?'DISCORD_BOT_LIVE':'DISCORD_INVITE_APPROXIMATE',
      latest,
      previous,
      dailyChange,
      history,
      checkedAt:new Date().toISOString()
    },{headers:{'cache-control':'no-store'}});
  }catch(error){
    console.error('Discord member history unavailable:',error);
    return Response.json({ok:false,error:'Discord member history temporarily unavailable'},{status:503});
  }
};
