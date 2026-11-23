import {getStore} from '@netlify/blobs';
import {readOfPublishers} from '../lib/of-report.mjs';
import {refreshBoosts} from '../lib/boosts.mjs';
import {readFeed} from '../lib/shared.mjs';
import {refreshMetrics} from '../lib/metrics.mjs';
export async function runXRefresh(){
  // Both reporting paths share one request cache, keyed by original post ID.
  const requests=new Map();
  const fetcher=(url,options)=>{const id=new URL(url).pathname.split('/').at(-1);
    if(!requests.has(id))requests.set(id,fetch(url,options));
    return requests.get(id).then(response=>response.clone());
  };
  // OF publishers live in a separate workbook tab, outside the article feed.
  const ofPending=(async()=>{
    const publishers=await readOfPublishers();
    return refreshMetrics(publishers.map(p=>({...p,platform:'X'})),{
      fetcher,storage:getStore({name:'fanvue-of-metrics-v1',consistency:'strong'})});
  })().catch(()=>({error:'OF metrics unavailable'}));
  const boostsPending=refreshBoosts({fetcher}).catch(()=>({error:'Boost metrics unavailable'}));
  const {feed,status:sheetStatus}=await readFeed({force:true});
  if(sheetStatus!=='SHEET_LIVE'){await Promise.all([boostsPending,ofPending]);throw new Error('Live Google Sheets data is unavailable. Article X stats were not refreshed.');}
  const status=await refreshMetrics(feed.placements,{fetcher});
  const [boosts,of]=await Promise.all([boostsPending,ofPending]);
  console.log(JSON.stringify({job:'refresh-x-metrics',updated:status.updated,total:status.total,errors:status.errors}));
  return {boosts,of,ok:status.errors.length===0,updated:status.updated,total:status.total,lastSuccessfulAt:status.lastSuccessfulAt,errors:status.errors};
}
export default async()=>{
  const status=await runXRefresh();
  return new Response(JSON.stringify(status),{status:200,headers:{'content-type':'application/json'}});
};
export const config={schedule:'0 */2 * * *'};
