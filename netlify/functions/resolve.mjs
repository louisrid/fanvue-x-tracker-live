import {json,readFeed,validCode,buildDestination,SITE_URL} from '../lib/shared.mjs';
export default async req=>{
  const u=new globalThis.URL(req.url),code=String(u.searchParams.get('code')||'').toUpperCase();
  if(!validCode(code))return json({ok:false,error:'INVALID_CODE'},404);
  try{
    const {feed}=await readFeed();if(!feed.placements.some(p=>p.code===code))return json({ok:false,error:'UNKNOWN_CODE'},404);
    const cta=u.searchParams.get('cta')==='PRISM'?'PRISM':'FANVUE';
    return json({ok:true,code,cta,trackingUrl:SITE_URL+'/r/'+code,destination:buildDestination(code,cta),logsClick:false});
  }catch(e){return json({ok:false,error:'Sheet verification unavailable'},503);}
};
