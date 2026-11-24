/**
 * GTA VI campaign report, independent from OF Terms and article tracking.
 * Uses the existing promotion spreadsheet, ExcelJS and Netlify Blobs.
 * GET reads verified source/cached metrics; POST performs a throttled manual X fetch.
 * Historical metrics never reset on provider errors. No synthetic UTM clicks.
 */
import ExcelJS from 'exceljs';
import {createHash} from 'node:crypto';
import {summarisePlacements} from '../lib/placement-reporting.mjs';
import {getStore} from '@netlify/blobs';
import {campaignLinkClicks,trackingLink} from '../lib/gta-shortio.mjs';
import {readGtaXMetric,gtaMetricStatus} from '../lib/gta-x-metrics.mjs';
import {seed,seedVerifiedAt} from '../lib/gta-seed.mjs';
import {summariseQuotedOriginals} from '../lib/quoted-originals.mjs';

const SHEET_ID='1D8rI3BuuFHIemYZY92QFiHDMkj876F8oiwpDR6sMiTE';
const SOURCE_TABS=[['X Accounts 15 (GTA VI QRTs)','GTAQ'],['X Accounts 12 (GTA)','GTA1'],['X Accounts 14 (GTA VI V2)','GTA2']];
export const publishedOriginals=rows=>(rows||[]).filter(p=>SOURCE_TABS.slice(1).some(([tab,campaign])=>p.sourceTab===tab&&p.campaign===campaign)&&p.posted===true);
// Apply the same boundary to live sheets, legacy caches and the verified snapshot.
export const publishedQrts=rows=>(rows||[]).filter(p=>p.campaign==='GTAQ'&&p.sourceTab===SOURCE_TABS[0][0]&&p.posted===true);
const SHEET_TTL=90_000;

const sheetStore=()=>getStore({name:'fanvue-gta-report-v1',consistency:'strong'});
const metricStore=()=>getStore({name:'fanvue-gta-metrics-v1',consistency:'strong'});
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const val=c=>{const v=c?.value;if(v==null)return '';if(typeof v!=='object')return v;if(v instanceof Date)return v.toISOString();return v.result??v.text??v.richText?.map(x=>x.text).join('')??'';};
const txt=c=>String(val(c)).trim();
const link=c=>String(c?.hyperlink||c?.value?.hyperlink||c?.value?.formula?.match(/^HYPERLINK\(\s*"([^"]+)"/i)?.[1]||txt(c)).trim();
const yes=c=>val(c)===true||txt(c).toUpperCase()==='TRUE';
const usd=c=>{let v=String(val(c)).replace(/[$,\s]/g,'');return v!==''&&Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null;};
const safeUrl=(value,host)=>{try{const u=new URL(String(value));return u.protocol==='https:'&&(!host||host.some(x=>u.hostname===x))?u.href:'';}catch{return '';}};
const xPost=(url)=>{const m=String(url).match(/^https:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/([A-Za-z0-9_]+)\/status\/(\d+)(?:[/?#]|$)/i);return m?{handle:m[1],id:m[2]}:null;};

export function parseRows(workbook){
  const result=[];
  for(const [tab,campaign] of SOURCE_TABS){
    const sheet=workbook.getWorksheet(tab);
    if(!sheet){if(campaign==='GTAQ')throw new Error('GTA source tab missing: '+tab);continue;}
    const col={};sheet.getRow(7).eachCell((c,i)=>{const name=txt(c).toUpperCase();if(name&&(!col[name]||name==='LINK'))col[name]=i;});
    for(const key of ['ACCOUNT','ACCOUNT SUM','PAID?','POSTED?','LINK','UTM LINK'])if(!col[key])throw new Error('GTA column missing '+key+' in '+tab);
    for(let i=8;i<=sheet.rowCount;i++){
      const r=sheet.getRow(i),cell=key=>r.getCell(col[key]),publisher=txt(cell('ACCOUNT'));
      if(!publisher||publisher.length>100)continue;
      const cost=usd(cell('ACCOUNT SUM')),paid=yes(cell('PAID?')),posted=yes(cell('POSTED?'));
      // Retain every account row; finance, publication and click eligibility are separate.
      const candidate=link(cell('LINK'));
      const postUrl=safeUrl(candidate,['x.com','twitter.com']);
      const profileUrl=safeUrl(txt(cell('LINK')),['x.com','twitter.com']);
      const accountUrl=safeUrl(link(r.getCell(col['ACCOUNT']+1)),['x.com','twitter.com']);
      const trackingUrl=trackingLink(link(r.getCell(col['UTM LINK'])))?.url||'';
      const identity=trackingUrl||accountUrl||publisher.toLowerCase();
      const code=campaign+'-'+createHash('sha256').update(identity+'|'+publisher.toLowerCase()).digest('hex').slice(0,20);
      result.push({code,campaign,sourceRow:i,sourceTab:tab,
        publisher:publisher.replace(/\s*\((?:TBC|TBD)\)/gi,'').trim(),profileUrl:accountUrl||(/^\w{1,20}$/.test(publisher)?`https://x.com/${publisher}`:''),postUrl:xPost(postUrl)?postUrl:'',
        cost,paid,posted,trackingUrl,clicks:null});
    }
  }
  // Financial rows are authoritative, even when two placements share a post.
  // Analytics deduplicate links/posts separately and exclude ambiguous attribution.
  const counts=new Map();for(const p of result)counts.set(p.code,(counts.get(p.code)||0)+1);
  return result.map(p=>({...p,identityAmbiguous:counts.get(p.code)>1}));
}

async function readWorkbook(){
  const url=`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx`;
  const resp=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(19000)});
  if(!resp.ok)throw new Error('GTA spreadsheet export HTTP '+resp.status);
  const bytes=await resp.arrayBuffer();if(bytes.byteLength>13_000_000)throw new Error('GTA source workbook too large');
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(Buffer.from(bytes));
  for(const [tab] of SOURCE_TABS)if(!workbook.getWorksheet(tab))throw new Error('GTA source tab missing: '+tab);
  return parseRows(workbook);
}

async function readSourceRows(force=false){
  const store=sheetStore();let cache=null;
  try{cache=await store.get('last-good-groups-v2',{type:'json'});}catch{}
  if(!force&&Array.isArray(cache?.rows)&&Date.now()-Date.parse(cache.at)<SHEET_TTL)return {...cache,cached:true};
  try{const rows=await readWorkbook(),updated={rows,at:new Date().toISOString(),source:'GOOGLE_SHEETS_LIVE'};
    try{await store.setJSON('last-good-groups-v2',updated);}catch{}return {...updated,cached:false};
  }catch(e){
    if(!Array.isArray(cache?.rows))for(const key of ['last-good-groups-v1','last-good-shortio-v3','last-good']){
      try{cache=await store.get(key,{type:'json'});}catch{}
      if(Array.isArray(cache?.rows))break;
    }
    if(Array.isArray(cache?.rows))return {...cache,cached:true,warning:'Live GTA spreadsheet unavailable; displaying last verified data.'};
    return {rows:seed,at:seedVerifiedAt,source:'VERIFIED_SNAPSHOT',cached:true,warning:'Live GTA spreadsheet unavailable; showing verified 16 Nov snapshot. Check Google Sheets export access.'};
  }
}

async function sourceRows(force=false){
  const source=await readSourceRows(force);
  const usage=new Map();
  for(const p of source.rows){if(p.posted&&p.postUrl&&p.trackingUrl){const posts=usage.get(p.trackingUrl)||new Set();posts.add(p.postUrl);usage.set(p.trackingUrl,posts);}}
  return {...source,rows:source.rows.map(p=>({...p,sharedTracking:usage.get(p.trackingUrl)?.size>1}))};
}

const mergeMetrics=(rows,metrics)=>rows.map(p=>{
  const post=xPost(p.postUrl),m=post&&metrics?.[post.id];
  if(!m?.at)return {...p,views:null,likes:null,reposts:null,replies:null,metricAt:null,metricError:m?.error||'',metricErrorCategory:m?.errorCategory||'',metricLastAttemptAt:m?.lastAttemptAt||null};
  return {...p,views:m.views,likes:m.likes,reposts:m.reposts,replies:m.replies,metricAt:m.at,metricError:m.error||'',metricErrorCategory:m.errorCategory||'',metricLastAttemptAt:m.lastAttemptAt||null};
});

async function getMetrics(storage=metricStore()){try{return await storage.get('latest',{type:'json'})||{metrics:{},history:[],lastSuccessfulAt:null};}catch{return {metrics:{},history:[],lastSuccessfulAt:null};}}

export async function groupReport(source,metric,{force=false,refreshClicks=false,cacheOnly=true,clickOptions={}}={}){
  const shortIo=await campaignLinkClicks(source.rows,{force:refreshClicks||force,cacheOnly,...clickOptions});
  const byLink=new Map(shortIo.links.map(p=>[trackingLink(p.trackingUrl)?.url,p]));
  const publishers=mergeMetrics(source.rows,metric.metrics).map(p=>{
    const reading=byLink.get(trackingLink(p.trackingUrl)?.url);
    const attributed=p.posted&&p.postUrl?reading?.postPublicationClicks??null:null;
    const shared=p.sharedTracking||source.rows.filter(r=>r.posted&&r.trackingUrl&&r.trackingUrl===p.trackingUrl).length>1;
    return {...p,clicks:shared?null:attributed,allTimeClicks:reading?.clicks??null,clickAt:reading?.clickAt,postPublicationVerifiedAt:reading?.publicationVerifiedAt,clickStale:!!(reading?.stale||reading?.publicationStale),clickError:shared?'Shared link; see campaign link breakdown.':reading?.clickError||reading?.attributionError||'',clickTracked:!!reading&&!shared,cpc:!shared&&p.paid&&p.cost!==null&&attributed>0?p.cost/attributed:null};
  });
  const xStatus=gtaMetricStatus(source.rows,metric);
  const ids=new Set(source.rows.map(p=>xPost(p.postUrl)?.id).filter(Boolean).map(String));
  const cutoff=Date.now()-6*24*60*60*1000;
  const history=(Array.isArray(metric.history)?metric.history:[])
    .filter(h=>ids.has(String(h.id||''))&&Date.parse(h.at||'')>=cutoff&&Number.isFinite(Number(h.views)));
  return {ok:true,id:'GTA',name:'GTA VI',scope:'published-qrts-v1',ready:true,checkedAt:new Date().toISOString(),
    source:source.source,sourceVerifiedAt:source.at,sourceStale:!!source.warning,cached:source.cached,warning:source.warning||'',
    publishers,summary:summarisePlacements(source.rows),activity:[],history,clickTracking:true,shortIo,clickTrackingReason:'All-time human clicks are separate from verified post-publication clicks; each link is counted once.',
    metricLastSuccessfulAt:xStatus.lastSuccessfulAt,intervalHours:2,
    xStatus,metricErrors:xStatus.errors};
}

export async function getReport(options={}){
  const [source,metric]=await Promise.all([sourceRows(options.force),getMetrics()]);
  const [qrts,originals]=await Promise.all([
    groupReport({...source,rows:source.rows.filter(p=>p.campaign==='GTAQ'&&p.sourceTab===SOURCE_TABS[0][0])},metric,options),
    groupReport({...source,rows:source.rows.filter(p=>SOURCE_TABS.slice(1).some(([tab,id])=>p.sourceTab===tab&&p.campaign===id))},metric,options)
  ]);
  const quoteGroups=summariseQuotedOriginals(qrts.publishers,metric.metrics);
  const paidOriginals=new Set(originals.publishers.filter(p=>p.posted&&p.paid).map(p=>xPost(p.postUrl)?.id).filter(Boolean));
  quoteGroups.rows=quoteGroups.rows.map(row=>({...row,paidOriginalMatch:paidOriginals.has(row.originalPostId)}));
  return {...qrts,originals:{...originals,scope:'published-originals-v1'},quotedOriginals:quoteGroups};
}

export async function refreshGtaMetrics({manual=false,fetcher=fetch,storage=metricStore(),readSource=sourceRows,readReport=getReport}={}){
  // A cache read failure must abort rather than overwrite verified history with an empty state.
  const st=storage,last=await st.get('latest',{type:'json'})||{metrics:{},history:[]},now=Date.now();
  const source=await readSource(manual),posts=source.rows.filter(p=>p.posted).map(p=>({p,post:xPost(p.postUrl)})).filter(x=>x.post);
  const distinct=[...new Map(posts.map(x=>[x.post.id,x])).values()];
  const metrics={...last.metrics},errors=[];let updated=0;
  for(let i=0;i<distinct.length;i+=6){
    const batch=await Promise.all(distinct.slice(i,i+6).map(async ({post})=>{
      try{
        const metric=await readGtaXMetric(post,{fetcher}),prior=metrics[post.id];
        if(['views','likes','reposts','replies'].some(k=>prior?.[k]>0&&metric[k]===0))throw Object.assign(new Error('X provider returned zero for a previously verified metric'),{category:'suspect_regression'});
        return {id:post.id,metric};
      }catch(e){return {id:post.id,error:String(e.message||e),category:e.category||'api_failure'};}
    }));
    for(const item of batch){
      if(item.metric){
        // Preserve a verified QRT-to-original relationship if the X provider temporarily omits quote data.
        const oldQuote=metrics[item.id]?.quotedPost;
        if(oldQuote&&(!item.metric.quotedPost||item.metric.quotedPost.id!==oldQuote.id||['views','likes','reposts','replies'].some(k=>oldQuote[k]>0&&item.metric.quotedPost[k]===0)))item.metric.quotedPost=oldQuote;
        metrics[item.id]=item.metric;updated++;
      }
      else{metrics[item.id]={...(metrics[item.id]||{}),error:item.error,errorCategory:item.category,lastAttemptAt:new Date().toISOString()};errors.push({postId:item.id,error:item.error,category:item.category});}
    }
  }
  const at=new Date().toISOString();const history=Array.isArray(last.history)?last.history.slice():[];
  // Keep one sample per post per 2-hour bucket, not one per request. No fabricated history.
  for(const {post} of distinct){const m=metrics[post.id];if(!m?.at||m.error)continue;
    const bucket=Math.floor(Date.parse(m.at)/7_200_000);if(!history.some(x=>x.id===post.id&&x.bucket===bucket))history.push({id:post.id,bucket,at:m.at,views:m.views,likes:m.likes,reposts:m.reposts,replies:m.replies});
  }
  const next={metrics,history,lastSuccessfulAt:updated?at:last.lastSuccessfulAt||null,lastAttemptAt:at,
    lastManualAt:manual?now:Number(last.lastManualAt||0),updated,total:distinct.length,errors};
  await st.setJSON('latest',next);
  const report=await readReport({refreshClicks:true,cacheOnly:false});
  return {...report,refreshed:errors.length===0&&!report.sourceStale&&report.shortIo.errors===0&&report.originals.shortIo.errors===0,updated,total:distinct.length,errors,
    skipped:false,serverNow:Date.now(),nextRefreshAt:manual?now:Number(last.lastManualAt||0)};
}

export default async function handler(request){
  if(request.method==='GET'||request.method==='HEAD'){
    try{return json({...await getReport({force:new URL(request.url).searchParams.has('refresh')}),refresh:await refreshStatus()});}
    catch(e){return json({ok:false,ready:false,error:String(e.message||e)},503);}
  }
  if(request.method==='POST'){
    try{return json(await startRefresh(request),202);}
    catch{return json({ok:false,error:'GTA refresh could not start'},503);}
  }
  return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
}

export async function refreshStatus(){const job=await metricStore().get('refresh-job-v2',{type:'json'});return job&&['queued','running'].includes(job.state)&&job.expiresAt<Date.now()?{...job,state:'failed',error:'Refresh did not complete; retry to resume with saved readings.'}:job;}
export async function startRefresh(request){
  const st=metricStore(),now=Date.now(),prior=await st.getWithMetadata('refresh-job-v2',{type:'json'});
  if(prior?.data?.expiresAt>now&&['queued','running'].includes(prior.data.state))return {ok:true,refresh:prior.data};
  const job={id:crypto.randomUUID(),state:'queued',startedAt:new Date(now).toISOString(),expiresAt:now+16*60_000};
  const acquired=await st.setJSON('refresh-job-v2',job,prior?{onlyIfMatch:prior.etag}:{onlyIfNew:true});
  if(!acquired.modified)return {ok:true,refresh:await refreshStatus()};
  try{
    const response=await fetch(new URL('/.netlify/functions/gta-refresh-background',request.url),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:job.id})});
    if(!response.ok)throw Error('Worker unavailable');
  }catch(e){await st.setJSON('refresh-job-v2',{...job,state:'failed',expiresAt:0,error:'Refresh worker unavailable'});throw e;}
  return {ok:true,refresh:job};
}
export async function runRefreshJob(id){
 const st=metricStore(),prior=await st.getWithMetadata('refresh-job-v2',{type:'json'});
 if(prior?.data?.id!==id||prior.data.state!=='queued')return;
 const job={...prior.data,state:'running'};
 const claimed=await st.setJSON('refresh-job-v2',job,{onlyIfMatch:prior.etag});if(!claimed.modified)return;
 try{const report=await refreshGtaMetrics({manual:true});await st.setJSON('refresh-job-v2',{...job,state:'complete',expiresAt:0,completedAt:new Date().toISOString(),errors:report.shortIo.errors+report.originals.shortIo.errors+(report.errors?.length||0),updated:report.updated,total:report.total});}
 catch{await st.setJSON('refresh-job-v2',{...job,state:'failed',expiresAt:0,error:'Refresh failed; last verified readings retained',completedAt:new Date().toISOString()});}
}
