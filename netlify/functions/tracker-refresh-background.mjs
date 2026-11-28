import {getStore} from '@netlify/blobs';
import {workerAuth} from '../lib/metrics.mjs';
import {makeCoordinator,active} from '../lib/durable-refresh.mjs';
import {runXRefresh} from './refresh-x-metrics.mjs';
import {startRefresh,refreshStatus} from './gta-report.mjs';
import {refreshBoosts} from '../lib/boosts.mjs';
import dashboard from './dashboard.mjs';
import ofReport from './of-report.mjs';
import overview from './campaign-overview.mjs';
import discordMembers from './discord-members.mjs';
import discordClicks from './discord-course-clicks.mjs';
import directory from './publisher-directory.mjs';
import registry from './campaign-registry.mjs';
const gone=e=>/not_found|HTTP 404/i.test(String(e?.category||'')+' '+String(e?.error||''));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function healthyGta(report){
  return [report,report.originals,report.mandy,report.instagram].filter(Boolean).every(r=>{
    const x=r.xStatus,short=r.shortIo,deleted=(x?.errors||[]).filter(gone).length;
    return !r.sourceStale&&!r.warning&&!(x?.errors||[]).some(e=>!gone(e))&&!(x?.unverified>deleted)&&
      !(Array.isArray(short?.links)&&short.links.length?short.links.some(p=>p.clickError||p.stale||p.publicationStale||(p.attributed&&p.attributionError)):short?.errors||short?.stale);
  });
}
export default async function handler(req){
  if(req.method!=='POST'||!workerAuth(req))return new Response(null,{status:401});
  const {id}=await req.json().catch(()=>({}));if(typeof id!=='string'||!(/^[a-f0-9-]{36}$/i.test(id)))return new Response(null,{status:400});
  const origin=new URL(req.url).origin;
  const request=(path,method='GET')=>new Request(new URL('/.netlify/functions/'+path,origin),{method});
  const read=async(handler,path,method='GET')=>{
    const res=await handler(request(path,method)),data=await res.json();
    if(!res.ok||data?.ok!==true)throw Error('Source unavailable');
    return data;
  };
  const discord=async(name,handler,key)=>{
    try{const data=await read(handler,name);return {ok:true,snapshot:{[key]:data}};}catch{return {ok:false,issue:name+' unavailable'};}
  };
  const execute=async(name,{deadline})=>{
    if(name==='x'){
      let status;try{status=await runXRefresh();}finally{await read(dashboard,'dashboard?refresh=1');}
      const ok=(status?.ok||(status?.errors?.length&&status.errors.every(gone)))&&!status?.of?.error&&!status?.boosts?.error;
      return {ok:!!ok,issue:'Some X, OF or Guru readings remain unverified'};
    }
    if(name==='gta'){
      const started=await startRefresh(request('gta-report','POST'));let job=started.refresh;
      if(!job?.id)throw Error('GTA worker unavailable');
      const id=job.id;
      while(active(job)&&Date.now()<deadline){
        await pause(2500);job=await refreshStatus();
        if(job?.id!==id)throw Error('GTA refresh status changed');
      }
      if(job?.state!=='complete')return {ok:false,issue:'GTA refresh incomplete; saved readings retained'};
      const res=await fetch(request('gta-report?job='+encodeURIComponent(id)),{signal:AbortSignal.timeout(30000),cache:'no-store'});
      const report=await res.json();return {ok:res.ok&&report.ready===true&&healthyGta(report),issue:'Some GTA VI readings remain unverified'};
    }
    if(name==='of'||name==='of-read'){
      const data=await read(ofReport,'of-report?refresh=1',name==='of'?'POST':'GET');
      return {ok:data.ready===true&&!data.warning&&!(data.errors||[]).some(e=>!gone(e)),issue:'OF Terms readings remain unverified'};
    }
    if(name==='boosts'){const result=await refreshBoosts({manual:true});return {ok:!(result.errors||[]).length,issue:'Guru RT readings remain unverified'};}
    if(name==='boosts-read'){
      const res=await fetch(request('boosts'),{signal:AbortSignal.timeout(20000),cache:'no-store'}),data=await res.json();
      return {ok:res.ok&&data.ok===true&&Array.isArray(data.tweets)};
    }
    if(name==='discord-members')return discord(name,discordMembers,'members');
    if(name==='discord-clicks')return discord('discord-course-clicks',discordClicks,'clicks');
    if(name==='discord'){
      const results=await Promise.all([discord('discord-members',discordMembers,'members'),discord('discord-course-clicks',discordClicks,'clicks')]);
      return {ok:results.every(r=>r.ok),issue:results.filter(r=>!r.ok).map(r=>r.issue).join('; '),snapshot:Object.assign({},...results.map(r=>r.snapshot||{}))};
    }
    if(name==='directory'){const data=await read(directory,'publisher-directory');return {ok:!data.stale};}
    if(name==='registry'){await read(registry,'campaign-registry');return {ok:true};}
    if(name==='overview'){
      const data=await read(overview,'campaign-overview?refresh=1&reuse=1');
      return {ok:!data.stale&&Object.values(data.sourceHealth||{}).every(s=>s.ok)&&!(data.campaigns||[]).some(c=>c.sourceStale||c.dataWarning),issue:'Campaign summary uses saved or incomplete readings'};
    }
    throw Error('Unknown refresh source');
  };
  await makeCoordinator({store:getStore({name:'fanvue-durable-refresh-v1',consistency:'strong'}),execute}).run(id);
  return new Response(null,{status:204});
}
export const config={background:true};
