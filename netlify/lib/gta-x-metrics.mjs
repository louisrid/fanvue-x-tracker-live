// Provider failures never establish that a Sheet placement should be removed.
const number=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null;
const failure=(category,message,extra={})=>Object.assign(new Error(message),{category,...extra});
export async function readGtaXMetric(post,{fetcher=fetch,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
  for(let attempt=0;attempt<3;attempt++){
    try{
      const response=await fetcher(`https://api.fxtwitter.com/${encodeURIComponent(post.handle)}/status/${post.id}`,{headers:{accept:'application/json'},signal:AbortSignal.timeout(9000)});
      if(!response.ok){
        const status=response.status;
        const retryAfter=response.headers.get('retry-after');
        const seconds=retryAfter===null?NaN:Number(retryAfter);
        const wait=Number.isFinite(seconds)?seconds*1000:Date.parse(retryAfter)-Date.now();
        throw failure(status===404?'not_found':status===429?'rate_limit':status===403||status===401?'access_denied':'api_failure',`X provider HTTP ${status}`,{status,retryAfter:Number.isFinite(wait)?Math.max(0,wait):null});
      }
      let data;try{data=await response.json();}catch{throw failure('api_failure','X provider returned invalid JSON');}
      const tweet=data?.tweet;
      if(String(tweet?.id??tweet?.id_str??'')!==post.id)throw failure('missing_data','Provider returned no matching X post');
      const metric={views:number(tweet.views),likes:number(tweet.likes),reposts:number(tweet.retweets),replies:number(tweet.replies)};
      if(Object.values(metric).some(v=>v===null))throw failure('missing_data','X provider did not return all four metrics');
      return {...metric,at:new Date().toISOString(),error:'',lastAttemptAt:new Date().toISOString()};
    }catch(error){
      if(!error.category)error=failure(['TimeoutError','AbortError'].includes(error.name)?'timeout':'api_failure','X provider '+(['TimeoutError','AbortError'].includes(error.name)?'timeout':'network failure'));
      const transient=error.category==='timeout'||error.category==='rate_limit'||(error.category==='api_failure'&&(!error.status||error.status>=500));
      // Do not ignore long provider cooldowns or retry permanent/missing-data responses.
      if(!transient||attempt===2||error.retryAfter>5000)throw error;
      await sleep(Math.max(300*2**attempt,error.retryAfter||0));
    }
  }
}
export function gtaMetricStatus(rows,state){
  const ids=[...new Set(rows.filter(p=>p.posted&&p.postUrl).map(p=>p.postUrl.match(/\/status\/(\d+)/)?.[1]).filter(Boolean))];
  const errors=ids.filter(id=>state.metrics?.[id]?.error).map(id=>({postId:id,error:state.metrics[id].error,category:state.metrics[id].errorCategory||'unknown',lastAttemptAt:state.metrics[id].lastAttemptAt||state.lastAttemptAt||null}));
  const verified=ids.filter(id=>state.metrics?.[id]?.at).length;
  const updated=ids.filter(id=>state.metrics?.[id]?.at&&!state.metrics[id].error).length;
  const lastSuccessfulAt=ids.map(id=>state.metrics?.[id]?.at).filter(Boolean).sort().at(-1)||null;
  const lastAttemptAt=ids.map(id=>state.metrics?.[id]?.lastAttemptAt||state.metrics?.[id]?.at).filter(Boolean).sort().at(-1)||null;
  return {total:ids.length,updated,verified,retained:ids.filter(id=>state.metrics?.[id]?.at&&state.metrics[id].error).length,unverified:ids.length-verified,errors,lastAttemptAt,lastSuccessfulAt};
}
