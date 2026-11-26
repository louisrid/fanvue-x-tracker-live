/** Verified Short.io response cache. Never requests a publisher's redirect URL. */
import {createHash} from 'node:crypto';
import {getStore} from '@netlify/blobs';

const TTL=60*1000;
export function trackingLink(value){
  try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port||!u.pathname.slice(1)||u.search||u.hash)return null;
    return {url:u.href,domain:u.hostname,path:decodeURIComponent(u.pathname.slice(1))};
  }catch{return null;}
}
export function publicationTime(postUrl){
  const m=String(postUrl).match(/^https:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/\w+\/status\/(\d+)(?:[/?#]|$)/i);
  if(!m)return null;
  try{const ms=Number((BigInt(m[1])>>22n)+1288834974657n);return ms>=1288834974657&&ms<=Date.now()?new Date(ms).toISOString():null;}catch{return null;}
}
const count=v=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
async function api(url,key,fetcher){
  for(let attempt=0;attempt<3;attempt++){
    let r;
    try{r=await fetcher(url,{headers:{authorization:key,accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(15000)});}
    catch(e){if(attempt===2)throw Error(e.name==='TimeoutError'?'Short.io request timed out':'Short.io network request failed');await new Promise(resolve=>setTimeout(resolve,250*2**attempt));continue;}
    if(r.ok)return r.json();
    const retryable=r.status===429||r.status>=500;
    const retry=r.headers.get('retry-after');
    const delay=retry?(Number.isFinite(Number(retry))?Number(retry)*1000:Date.parse(retry)-Date.now()):250*2**attempt;
    if(!retryable||attempt===2||delay>3000)throw Error('Short.io API HTTP '+r.status);
    await new Promise(resolve=>setTimeout(resolve,Math.max(0,delay)));
  }
}
// Daily custom intervals use the same human-click counter as the headline.
// Counts are read through the statistics API; redirect URLs are never requested.
const londonDay=at=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));
const nextDay=day=>new Date(Date.parse(day+'T12:00:00Z')+86400000).toISOString().slice(0,10);
function midnight(day){
  const utc=Date.parse(day+'T00:00:00Z');
  const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',hourCycle:'h23'}).format(new Date(utc)));
  return utc-hour*3600000;
}
export async function dailyHumanClicks(id,start,end,{key,fetcher,cache,now=Date.now()}={}){
  const first=londonDay(Math.max(Date.parse(start),Date.parse(end)-13*86400000)),last=londonDay(end),out=[];
  for(let date=first;date<=last;date=nextDay(date)){
    const from=new Date(Math.max(midnight(date),Date.parse(start))).toISOString();
    const to=new Date(Math.min(midnight(nextDay(date))-1,Date.parse(end))).toISOString();
    const cacheKey=createHash('sha256').update('daily-human-v1|'+id+'|'+from+'|'+date).digest('hex');
    let prior;try{prior=await cache.get(cacheKey,{type:'json'});}catch{}
    if(prior&&count(prior.clicks)&&now-Date.parse(prior.at)<(date===last?60000:86400000)){out.push({...prior,stale:false});continue;}
    try{
      const data=await api('https://statistics.short.io/statistics/link/'+encodeURIComponent(id)+'?'+new URLSearchParams({period:'custom',startDate:from,endDate:to,tz:'Europe/London',skipTops:'true'}),key,fetcher);
      if(data.loading===true||!count(data.humanClicks)||Date.parse(data.interval?.startDate)!==Date.parse(from)||Date.parse(data.interval?.endDate)!==Date.parse(to))throw Error('Unverified Short.io daily interval');
      const reading={date,clicks:data.humanClicks,start:from,end:to,at:new Date(now).toISOString()};
      try{await cache.setJSON(cacheKey,reading);}catch{}
      out.push(reading);
    }catch{if(prior&&count(prior.clicks))out.push({...prior,stale:true});}
  }
  return out;
}
export async function readClicks(p,{key=globalThis.Netlify?.env?.get('SHORT_IO_API_KEY')??process.env.SHORT_IO_API_KEY,fetcher=fetch,store,force=false,now=Date.now(),linkTotals=false,cacheOnly=false,dailyHistory=false}={}){
  const link=trackingLink(p.trackingUrl),start=linkTotals?null:publicationTime(p.postUrl);
  if(!link||(!linkTotals&&(!p.posted||!start)))return {clicks:null,clickAt:null,clickStartAt:start,clickError:p.posted?'Short.io link or live post unavailable.':'Awaiting publication; clicks excluded.'};
  const cache=store||getStore({name:'fanvue-gta-shortio-v1',consistency:'strong'});
  const cacheKey=createHash('sha256').update(linkTotals?'link-human-v2|'+link.url:'humanClicks-v1|'+link.url+'|'+p.postUrl.match(/status\/(\d+)/)[1]).digest('hex');
  let prior=null;try{
    const [verified,attempt]=await Promise.all([cache.get(cacheKey,{type:'json'}),cache.get(cacheKey+'-attempt',{type:'json'})]);
    prior=verified;
    if(attempt?.error&&Date.parse(attempt.attemptAt)>Date.parse(verified?.attemptAt||'1970-01-01'))prior={...verified,...attempt};
  }catch{}
  if(cacheOnly)return prior?{...prior,stale:!!prior.error||now-Date.parse(prior.clickAt)>3*3600000,clickError:prior.error||''}:{clicks:null,clickAt:null,stale:true,clickError:'Short.io reading not yet verified.'};
  if(!force&&prior&&now-Date.parse(prior.attemptAt)<(prior.error?300_000:TTL))return {...prior,clickError:prior.error||''};
  try{
    if(!key)throw Error('Short.io not configured');
    const expanded=await api('https://api.short.io/links/expand?'+new URLSearchParams({domain:link.domain,path:link.path}),key,fetcher);
    const id=expanded.idString;
    if(typeof id!=='string'||!id)throw Error('Short.io link unavailable');
    const end=new Date(now).toISOString();
    const data=await api('https://statistics.short.io/statistics/link/'+encodeURIComponent(id)+'?'+new URLSearchParams(linkTotals?{period:'total',tz:'UTC'}:{period:'custom',startDate:start,endDate:end,tz:'UTC'}),key,fetcher);
    // Human-click cache keys are isolated from legacy total-click readings.
    // Reject an ignored date filter or a malformed/reset reading instead of inventing campaign performance.
    const measured=data.humanClicks;
    if(data.loading===true||!count(measured)||(!linkTotals&&(Date.parse(data.interval?.startDate)!==Date.parse(start)||Date.parse(data.interval?.endDate)!==Date.parse(end))))throw Error('Unverified Short.io interval');
    if(count(prior?.clicks)&&prior.clicks>0&&measured===0)throw Error('Short.io count decreased');
    const daily=dailyHistory&&!linkTotals?await dailyHumanClicks(id,start,end,{key,fetcher,cache,now}):undefined;
    const result={clicks:measured,clickAt:end,clickStartAt:start,attemptAt:end,error:'',clickError:'',stale:false,...(daily?{dailyClicks:daily}:{})};
    await cache.setJSON(cacheKey,result);return result;
  }catch(e){
    const detail=/^Short.io |^Unverified Short.io/.test(e.message)?e.message:'Short.io provider request failed';
    const error=key?detail+'; retaining the last verified reading.':'Short.io API key unavailable; retaining the last verified reading.';
    // Failures use a separate key so a concurrent outage cannot overwrite a verified response.
    try{const latest=await cache.get(cacheKey,{type:'json'});if(count(latest?.clicks)&&(!count(prior?.clicks)||latest.clicks>=prior.clicks))prior=latest;}catch{}
    const result={clicks:count(prior?.clicks)?prior.clicks:null,clickAt:prior?.clickAt||null,clickStartAt:start,attemptAt:new Date(now).toISOString(),error,clickError:error,stale:true,...(Array.isArray(prior?.dailyClicks)?{dailyClicks:prior.dailyClicks.map(d=>({...d,stale:true}))}:{})};
    try{await cache.setJSON(cacheKey+'-attempt',{attemptAt:result.attemptAt,error});}catch{}
    return result;
  }
}
export async function mergeClicks(rows,options={}){
  const usage=new Map();for(const p of rows){if(!p.posted)continue;const u=trackingLink(p.trackingUrl)?.url;if(u)usage.set(u,(usage.get(u)||0)+1);}
  const result=[];
  for(let i=0;i<rows.length;i+=2)result.push(...await Promise.all(rows.slice(i,i+2).map(async p=>{
    if(!p.trackingUrl)return {...p,clickTracked:false,clicks:null,cpc:null};
    const duplicate=usage.get(trackingLink(p.trackingUrl)?.url)>1;
    const reading=duplicate?{clicks:null,clickError:'Shared Short.io link; publisher attribution excluded.'}:await readClicks(p,options);
    return {...p,...reading,clickTracked:!duplicate,cpc:p.paid&&typeof p.cost==='number'&&reading.clicks>0?p.cost/reading.clicks:null};
  })));
  return result;
}
export function clickSummary(rows){
  const live=rows.filter(p=>p.posted&&trackingLink(p.trackingUrl)),verified=live.filter(p=>count(p.clicks));
  return {total:verified.length?verified.reduce((n,p)=>n+p.clicks,0):null,verified:verified.length,totalPublishers:live.length,stale:verified.some(p=>!!p.clickError)};
}

// Dashboard-compatible all-time human clicks, with performance scoped to published placements.
export async function campaignLinkClicks(rows,options={}){
  const grouped=new Map();
  for(const p of rows){const url=trackingLink(p.trackingUrl)?.url;if(url)grouped.set(url,[...(grouped.get(url)||[]),p]);}
  const unique=[...grouped.values()].map(group=>{
    const live=[...new Map(group.filter(p=>p.posted).map(p=>[p.postUrl,p])).values()];
    return {...(live[0]||group[0]),attributed:live.length===1&&!live[0]?.sharedTracking,attributionError:live.length>1||live[0]?.sharedTracking?'Shared Short.io link; publisher attribution excluded.':''};
  });
  const links=[];
  for(let i=0;i<unique.length;i+=2)links.push(...await Promise.all(unique.slice(i,i+2).map(async p=>({...p,...await readClicks(p,{...options,linkTotals:true}),...await (async()=>{if(!p.attributed||!publicationTime(p.postUrl))return {postPublicationClicks:null,publicationAt:null};const r=await readClicks(p,{...options,dailyHistory:p.campaign==='GTAM'||p.viral===true});return {postPublicationClicks:r.clicks,publicationAt:r.clickStartAt,publicationVerifiedAt:r.clickAt,publicationStale:r.stale,attributionError:r.clickError,dailyClicks:r.dailyClicks||[]};})()}))));
  const eligible=links.filter(p=>p.posted),verified=eligible.filter(p=>count(p.clicks));
  const successful=links.filter(p=>count(p.clicks)&&!p.clickError&&!p.stale);
  return {links,postPublicationTotal:links.some(p=>count(p.postPublicationClicks))?links.reduce((n,p)=>n+(p.postPublicationClicks??0),0):null,total:verified.length?verified.reduce((sum,p)=>sum+p.clicks,0):null,verified:verified.length,totalPublishers:eligible.length,
    stale:links.some(p=>p.stale||p.publicationStale||p.clickError||p.attributionError),errors:links.filter(p=>p.clickError||p.attributionError).length,
    refreshed:successful.length,linkCount:links.length,
    lastSuccessfulAt:links.filter(p=>p.clickAt).map(p=>p.clickAt).sort().at(-1)||null,
    oldestVerifiedAt:links.length&&links.every(p=>p.clickAt)?links.map(p=>p.clickAt).sort()[0]:null,
    metric:'humanClicks',scope:'published-links-all-time'};
}
