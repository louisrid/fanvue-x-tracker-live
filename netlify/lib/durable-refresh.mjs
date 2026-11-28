import {randomUUID} from 'node:crypto';
const KEY='latest-v1', TTL=16*60_000, RESULT_TTL=5*60_000;
export const active=job=>!!job&&['queued','running'].includes(job.state);
const tasks={
 all:['x','gta','discord','of-read','boosts-read','overview'],
 accounts:['directory','x','gta','discord','of-read','boosts-read','overview'],
 x:['x','overview'],gta:['gta','overview'],of:['of','overview'],
 boosts:['boosts','overview'],discord:['discord-members','discord-clicks'],
 registry:['registry','overview'],summary:['overview']
};
export const scopes=Object.keys(tasks);
const labels={x:'Refreshing X metrics…',gta:'Refreshing GTA VI and Viral QRTs…',discord:'Refreshing Discord sources…','discord-members':'Refreshing Discord members…','discord-clicks':'Refreshing course clicks…',of:'Refreshing OF Terms…','of-read':'Checking OF Terms…',boosts:'Refreshing Guru RTs…','boosts-read':'Checking Guru RTs…',overview:'Updating campaign summary…',directory:'Refreshing publisher directory…',registry:'Refreshing campaign details…'};
export function makeCoordinator({store,dispatch,execute,clock=Date.now,uuid=randomUUID}){
  const now=()=>new Date(clock()).toISOString();
  async function status(){
    let job=await store.get(KEY,{type:'json'});
    if(!job)return null;
    if(active(job)&&job.total>0&&job.completed>=job.total&&job.done?.length>=job.total)job={...job,state:job.issues?.length?'failed':'complete',label:job.issues?.length?'Latest available data':'Updated',finishedAt:job.lastProgressAt||job.startedAt};
    else if(active(job)&&job.expiresAt<=clock())job={...job,state:'failed',label:'Latest available data',issues:['Refresh expired; saved readings retained.'],finishedAt:new Date(job.expiresAt).toISOString()};
    if(!active(job)){const finished=Date.parse(job.finishedAt||job.startedAt||'');if(!Number.isFinite(finished)||clock()-finished>=RESULT_TTL)return null;}
    return job;
  }
  async function start(scope){
    if(!scopes.includes(scope))throw Error('Unsupported refresh scope');
    for(let attempt=0;attempt<4;attempt++){
      const prior=await store.getWithMetadata(KEY,{type:'json'});
      if(active(prior?.data)&&prior.data.expiresAt>clock()&&!(prior.data.total>0&&prior.data.completed>=prior.data.total&&prior.data.done?.length>=prior.data.total))return prior.data;
      const job={id:uuid(),scope,state:'queued',startedAt:now(),expiresAt:clock()+TTL,completed:0,total:tasks[scope].length,label:'Starting refresh…',issues:[],done:[]};
      const saved=await store.setJSON(KEY,job,prior?{onlyIfMatch:prior.etag}:{onlyIfNew:true});
      if(!saved.modified)continue;
      // The worker claims the durable record before doing any paid-provider work.
      // If dispatch acknowledgement is lost, do not start a second job.
      try{await dispatch(job.id);}catch(e){console.warn('Refresh dispatch acknowledgement unavailable:',String(e?.message||e));}
      return await status()||job;
    }
    throw Error('Refresh already being started; check status');
  }
  async function run(id){
    const prior=await store.getWithMetadata(KEY,{type:'json'});
    if(prior?.data?.id!==id||prior.data.state!=='queued'||prior.data.expiresAt<=clock())return;
    let job={...prior.data,state:'running',label:'Refreshing connected sources…'};
    if(!(await store.setJSON(KEY,job,{onlyIfMatch:prior.etag})).modified)return;
    let writes=Promise.resolve(),snapshot={};
    const update=fn=>{
      const next=writes.then(async()=>{
        const current=await store.getWithMetadata(KEY,{type:'json'});
        if(current?.data?.id!==id||current.data.state!=='running')throw Error('Refresh lease no longer current');
        const value=fn(job);
        if(!(await store.setJSON(KEY,value,{onlyIfMatch:current.etag})).modified)throw Error('Refresh status changed');
        job=value;
      });
      writes=next.catch(()=>{});
      return next;
    };
    const task=async name=>{
      await update(j=>({...j,label:labels[name]}));
      let issue='';
      try{
        const result=await execute(name,{scope:job.scope,id,deadline:job.expiresAt-90_000});
        if(result?.snapshot)Object.assign(snapshot,result.snapshot);
        if(result?.ok!==true)issue=result?.issue||labels[name].replace(/…$/,'')+' unavailable';
      }catch(e){console.warn('Refresh source failed:',name,String(e?.message||e));issue=labels[name].replace(/…$/,'')+' unavailable';}
      await update(j=>{
        const next={...j,completed:j.completed+1,done:[...j.done,name],issues:issue?[...j.issues,issue]:j.issues,lastProgressAt:now(),snapshot:{...snapshot}};
        if(next.completed===next.total){next.state=next.issues.length?'failed':'complete';next.label=next.issues.length?'Latest available data':'Updated';next.finishedAt=now();}
        return next;
      });
    };
    try{
      const plan=tasks[job.scope];
      // The overview must be assembled after provider writes and report caches finish.
      const first=plan.filter(n=>!['of-read','boosts-read','overview'].includes(n));
      await Promise.all(first.map(task));
      await Promise.all(plan.filter(n=>['of-read','boosts-read'].includes(n)).map(task));
      if(plan.includes('overview'))await task('overview');
      // Last task writes terminal state and final progress in one atomic update.
    }catch(e){
      console.warn('Refresh orchestration failed:',String(e?.message||e));
      try{await update(j=>({...j,state:'failed',label:'Latest available data',issues:[...j.issues,'Refresh interrupted; saved readings retained.'],finishedAt:now(),snapshot}));}catch{}
    }
  }
  return {status,start,run};
}
