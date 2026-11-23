import {readEvents} from '../lib/shared.mjs';
const esc=x=>'"'+String(x??'').replaceAll('"','""')+'"';
export default async ()=>{
  try{
    const events=await readEvents();
    const csv=['TIMESTAMP,CODE,CTA',...events.map(e=>[e.timestamp,e.code,e.cta].map(esc).join(','))].join('\r\n')+'\r\n';
    return new Response(csv,{status:200,headers:{'content-type':'text/csv; charset=utf-8',
      'cache-control':'no-store','access-control-allow-origin':'*','x-content-type-options':'nosniff'}});
  }catch(e){return new Response('EVENT_STORAGE_UNAVAILABLE',{status:503,headers:{'content-type':'text/plain'}})}
};
