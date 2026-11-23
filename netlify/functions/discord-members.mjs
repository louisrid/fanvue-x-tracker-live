import {getStore} from '@netlify/blobs';
const STORE='fanvue-discord-member-history-v1';
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
    const latest=history.at(-1)||null,prior=history.at(-2)||null;
    return Response.json({ok:true,source:'DISCORD_INVITE_APPROXIMATE',latest,previous:prior,
      dailyChange:latest&&prior?latest.memberCount-prior.memberCount:null,
      history,checkedAt:new Date().toISOString()},
      {headers:{'cache-control':'no-store'}});
  }catch(error){
    console.error('Discord member history unavailable:',error);
    return Response.json({ok:false,error:'Discord member history temporarily unavailable'},{status:503});
  }
};
