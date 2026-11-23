// One read-only, lifetime reporting feed for the existing Fanvue X Tracker.
// It composes the *existing* independently tracked campaigns, never redirects tracking URLs,
// never writes to operational sheets and never represents missing conversions as zero.
import ExcelJS from 'exceljs';
import {getStore} from '@netlify/blobs';
const SHEET='1D8rI3BuuFHIemYZY92QFiHDMkj876F8oiwpDR6sMiTE';
const ARTICLE_RTS='X Accounts 11 (Article RTs)';
const blank=v=>v===null||v===undefined||v==='';
const num=v=>blank(v)?null:Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null;
const yes=v=>v===true||String(v).trim().toUpperCase()==='TRUE';
const xPost=url=>String(url||'').match(/^https:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/[A-Za-z0-9_]{1,15}\/status\/(\d+)(?:[/?#]|$)/i)?.[1]||null;
const goodUrl=url=>{try{const u=new URL(String(url||''));return u.protocol==='https:'?u.href:'';}catch{return ''}};
const sum=(rows,key)=>{const found=rows.map(key).map(num).filter(v=>v!==null);return found.length?found.reduce((a,b)=>a+b,0):null};
const uniqueSum=(rows,key)=>{const seen=new Set();return sum(rows.filter(p=>{const id=xPost(p.postUrl);if(!id||seen.has(id))return false;seen.add(id);return true;}),key)};
const moneyRows=rows=>{const paid=rows.filter(r=>r.paid),known=paid.map(p=>num(p.cost)).filter(v=>v!==null);return {known:known.length?known.reduce((n,v)=>n+v,0):null,unknown:paid.length-known.length,paidCount:paid.length};};
const stamped=(o,...paths)=>paths.map(k=>o?.[k]).filter(Boolean)[0]||null;
const diagnostic=(x)=>x instanceof Error?x.message:String(x||'Unknown source failure');
const cellValue=c=>{let v=c?.value;if(v==null)return '';if(typeof v!=='object')return v;if(v instanceof Date)return v.toISOString();if('result' in v)return v.result??'';return v.text??v.richText?.map(x=>x.text).join('')??'';};
const cellText=c=>String(cellValue(c)).trim();
const cellLink=c=>String(c?.hyperlink||c?.value?.hyperlink||c?.value?.formula?.match(/^HYPERLINK\(\s*"([^"]+)"/i)?.[1]||cellText(c)).trim();

export function parseArticleRtWorkbook(workbook){
  const sheet=workbook.getWorksheet(ARTICLE_RTS);
  if(!sheet)throw Error('Article RT tab missing');
  const cols={};
  sheet.getRow(7).eachCell((c,i)=>{const k=cellText(c).toUpperCase();if(k&&(!cols[k]||k==='LINK'))cols[k]=i;});
  for(const k of ['ACCOUNT','ACCOUNT SUM','PAID?','POSTED?','LINK'])if(!cols[k])throw Error('Article RT sheet column missing: '+k);
  const rows=[];
  for(let i=8;i<=sheet.rowCount;i++){
    const get=k=>sheet.getRow(i).getCell(cols[k]);
    const publisher=cellText(get('ACCOUNT'));
    if(!publisher||publisher.length>100)continue;
    const postUrl=goodUrl(cellLink(get('LINK')));
    const profile=goodUrl(cellLink(sheet.getRow(i).getCell(cols['ACCOUNT']+1)));
    rows.push({
      id:'ARTICLERT-'+i,sourceRow:i,publisher,profileUrl:profile,
      postUrl:xPost(postUrl)?postUrl:'',trackingUrl:goodUrl(cols['UTM LINK']?cellLink(get('UTM LINK')):''),
      cost:num(cellText(get('ACCOUNT SUM')).replace(/[$,\s]/g,'')),
      paid:yes(cellValue(get('PAID?'))),posted:yes(cellValue(get('POSTED?'))),
      views:null,likes:null,reposts:null,replies:null,clicks:null,signups:null,kyc:null,earningCreators:null
    });
  }
  return rows;
}
export async function readArticleRts({fetcher=fetch,store=getStore({name:'fanvue-campaign-reporting-v1',consistency:'strong'}),now=Date.now()}={}){
  let saved=null;
  try{saved=await store.get('article-rts-last-good',{type:'json'});}catch{}
  if(Array.isArray(saved?.rows)&&now-Date.parse(saved.at)<120_000)return {...saved,cached:true,stale:false};
  try{
    const url='https://docs.google.com/spreadsheets/d/'+SHEET+'/export?format=xlsx';
    const res=await fetcher(url,{cache:'no-store',signal:AbortSignal.timeout(19000)});
    if(!res.ok)throw Error('Article RT sheet export HTTP '+res.status);
    const bytes=await res.arrayBuffer();
    if(bytes.byteLength>13_000_000)throw Error('Article RT workbook exceeds size limit');
    const book=new ExcelJS.Workbook();await book.xlsx.load(Buffer.from(bytes));
    const result={rows:parseArticleRtWorkbook(book),at:new Date(now).toISOString(),source:'GOOGLE_SHEETS_LIVE'};
    try{await store.setJSON('article-rts-last-good',result);}catch{}
    return {...result,cached:false,stale:false};
  }catch(e){
    if(Array.isArray(saved?.rows))return {...saved,cached:true,stale:true,warning:'Article RT source temporarily unavailable; last verified rows retained.'};
    return {rows:[],at:null,stale:true,error:diagnostic(e),source:'UNAVAILABLE'};
  }
}
const converted=()=>({signups:null,kyc:null,earningCreators:null,conversionSource:'NOT_CONNECTED'});
function normalCampaign(id,name,kind,rows,sourceStatus={},extra={}){
  const paid=moneyRows(rows),posted=rows.filter(p=>p.posted===true),
    linked=posted.filter(p=>!!xPost(p.postUrl)),
    reported=linked.filter(p=>num(p.views)!==null),
    views=uniqueSum(linked,p=>p.views),
    likes=uniqueSum(linked,p=>p.likes),
    reposts=uniqueSum(linked,p=>p.reposts),
    replies=uniqueSum(linked,p=>p.replies);
  const coverage={withPostUrl:linked.length,withXMetrics:reported.length,published:posted.length};
  return {
    id,name,kind,source:sourceStatus.source||'CONNECTED',sourceVerifiedAt:sourceStatus.at||null,
    dataWarning:sourceStatus.warning||null,unavailable:sourceStatus.error||null,
    placements:rows.length,published:posted.length,paidCount:paid.paidCount,
    paidSpendKnown:paid.known,unknownPaidCosts:paid.unknown,
    views,likes,reposts,replies,coverage,rows,
    allTimeHumanClicks:null,postPublicationClicks:null,...converted(),...extra
  };
}
function gtaCampaign(data,original=false){
  const entry=original?data?.originals:data;
  if(!entry?.ready)return {...normalCampaign(original?'gta-originals':'gta-qrts',original?'GTA VI Originals':'GTA VI QRTs',original?'original':'qrt',[],{source:'UNAVAILABLE',error:'GTA report unavailable'}),unavailable:true};
  const rows=(entry.publishers||[]).filter(p=>original?p.campaign==='GTA1'||p.campaign==='GTA2':p.campaign==='GTAQ');
  const report=normalCampaign(original?'gta-originals':'gta-qrts',original?'GTA VI Originals':'GTA VI QRTs',original?'original':'qrt',rows,{
    source:entry.source,at:entry.sourceVerifiedAt,warning:entry.warning
  },{
    allTimeHumanClicks:num(entry.shortIo?.total),
    postPublicationClicks:num(entry.shortIo?.postPublicationTotal),
    sourceStale:!!entry.sourceStale,
    xMetricErrors:(entry.xStatus?.errors||[]).length,
    quotedOriginals:original?null:data.quotedOriginals||null
  });
  return report;
}
function ofCampaign(data){
  if(!data?.ready)return {...normalCampaign('of-terms','OF Terms','article',[],{source:'UNAVAILABLE',error:'OF Terms report unavailable'}),unavailable:true};
  const rows=(data.publishers||[]).map(p=>({...p,views:num(p.xViews??p.views),likes:num(p.xLikes??p.likes),
    reposts:num(p.xShares??p.reposts),replies:num(p.xComments??p.replies),clicks:num(p.clicks)}));
  const d=normalCampaign('of-terms','OF Terms','article',rows,{source:'OF_REPORT',at:data.checkedAt},{
    trackedClicks:sum(rows,p=>p.clicks),
    sourceNote:'OF Terms post clicks are recorded by the existing OF reporting feed. Do not mix them with Short.io click counts.'
  });
  return d;
}
function boostsCampaign(data){
  if(!data?.ok||!Array.isArray(data.tweets))return {...normalCampaign('guru-rts','Guru RTs / X Boosts','boost',[],{source:'UNAVAILABLE',error:'X RT boosts feed unavailable'}),unavailable:true};
  const rows=data.tweets.map(t=>({...t,publisher:t.name||t.handle,postUrl:'https://x.com/'+t.handle+'/status/'+t.id,
    posted:true,paid:t.spend!==null&&t.spend!==undefined,cost:num(t.spend),views:num(t.views),likes:num(t.likes),
    reposts:num(t.reposts),replies:num(t.replies),metricAt:t.at||null}));
  return {...normalCampaign('guru-rts','Guru RTs / X Boosts','boost',rows,{source:'X_RTS',at:rows.map(t=>t.metricAt).filter(Boolean).sort().at(-1)||null}),classificationNote:'Currently showing the existing X RT boosts source; individual tweets are not tagged as Guru/non-Guru.'};
}
function dashboardCampaigns(data){
  if(!data?.ok||!Array.isArray(data.placements))return [{...normalCampaign('x-articles','X Articles','article',[],{source:'UNAVAILABLE',error:'Article tracker unavailable'}),unavailable:true}];
  const rows=data.placements.map(p=>({...p,views:num(p.xViews),likes:num(p.xLikes),
    reposts:num(p.xShares),replies:num(p.xComments),clicks:num(p.clicks)}));
  const general=normalCampaign('x-articles','X Articles','article',rows,{source:'ARTICLE_TRACKER',at:data.sheetVerifiedAt},{
    trackedClicks:sum(rows,p=>p.clicks)
  });
  const knownCampaigns=(data.campaigns||[]).filter(c=>c&&c.id).map(c=>{
    const relevant=rows.filter(p=>p.campaignId===c.id),cost=moneyRows(relevant);
    return {id:c.id,name:c.name||c.id,status:c.status||null,
      placements:relevant.length,published:relevant.filter(p=>p.posted).length,
      paidSpendKnown:cost.known,unknownPaidCosts:cost.unknown,
      xViews:uniqueSum(relevant.filter(p=>p.posted),p=>p.views),
      trackedClicks:sum(relevant,p=>p.clicks)};
  }).filter(c=>c.placements||c.status);
  general.sourceCampaigns=knownCampaigns;
  return [general];
}
export function assembleCampaignOverview(sources){
  const src=sources||{},errors=[];
  for(const [name,v] of Object.entries(src))if(v?.error)errors.push(name+': '+diagnostic(v.error));
  const gta=src.gta?.data,of=src.of?.data,boosts=src.boosts?.data,dashboard=src.dashboard?.data,article=src.articleRts?.data;
  const campaigns=[
    gtaCampaign(gta,false),gtaCampaign(gta,true),ofCampaign(of),boostsCampaign(boosts),
    normalCampaign('article-rts','Article RTs','rt',article?.rows||[],{source:article?.source||'UNAVAILABLE',at:article?.at,warning:article?.warning,error:article?.error},{
      trackingWarning:(article?.rows||[]).some(p=>p.posted&&!p.postUrl)?'Some posted RTs have no live X link in the operations sheet. X views cannot be independently verified.':null
    }),
    ...dashboardCampaigns(dashboard),
    {...normalCampaign('ai-harness','AI Harness','planned',[],{source:'NOT_CONNECTED',error:'No live campaign-specific feed linked'}),unavailable:true},
    {...normalCampaign('discord','Discord First Earnings','planned',[],{source:'NOT_CONNECTED',error:'Discord growth, KYC and earning-creator source not connected'}),unavailable:true}
  ];
  // No overall spend/view sum. Some data feeds overlap, and platform views are not deduplicated reach.
  return {ok:true,scope:'lifetime-campaign-reporting-v1',checkedAt:new Date().toISOString(),
    campaigns,errors,sourceHealth:Object.fromEntries(Object.entries(src).map(([k,v])=>[k,{ok:!!v?.data&&!v.error,error:v?.error?diagnostic(v.error):null}])),
    note:'Lifetime campaign counters; no mandatory date windows. Published, paid, spend, X views and attributed clicks are separate. Missing sign-up, KYC and first-earnings integrations are unknown, never zero.'};
}
export async function readReportParts(origin,{fetcher=fetch,readRts=readArticleRts}={}){
  const paths={gta:'gta-report',of:'of-report',boosts:'boosts',dashboard:'dashboard'};
  const names=Object.keys(paths);
  const tasks=names.map(async name=>{
    const url=new URL('/.netlify/functions/'+paths[name],origin);
    const response=await fetcher(url,{cache:'no-store',signal:AbortSignal.timeout(24000)});
    if(!response.ok)throw Error(paths[name]+' HTTP '+response.status);
    const value=await response.json();
    if(!value?.ok)throw Error(value?.error||paths[name]+' returned no verified data');
    return value;
  });
  const outcomes=await Promise.allSettled([...tasks,readRts()]);
  return Object.fromEntries([...names,'articleRts'].map((name,i)=>[name,outcomes[i].status==='fulfilled'?{data:outcomes[i].value}:{error:diagnostic(outcomes[i].reason)}]));
}
export default async function handler(request){
  if(!['GET','HEAD'].includes(request.method))return Response.json({ok:false,error:'METHOD_NOT_ALLOWED'},{status:405});
  try{
    const parts=await readReportParts(request.url);
    const result=assembleCampaignOverview(parts);
    return Response.json(result,{headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
  }catch{return Response.json({ok:false,error:'Reporting feed unavailable; existing campaigns remain accessible.'},{status:503});}
}
