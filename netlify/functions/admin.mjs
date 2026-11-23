import { json,feedURL,feedKey,adminKey as readAdminKey } from '../lib/shared.mjs';
import {mutateBoost,BoostInputError} from '../lib/boosts.mjs';
import { timingSafeEqual } from 'node:crypto';

const allowed = new Set(['check','createCampaign','updateCampaign','createPlacement','updatePlacement','bulkUpdate','recordMetrics']);
function auth(request,secret){
  const supplied=String(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
  const a=Buffer.from(supplied);const b=Buffer.from(secret);
  return a.length===b.length && a.length>0 && timingSafeEqual(a,b);
}
export default async function handler(request){
  if(request.method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
  const adminKey=readAdminKey();
  if(!adminKey)return json({ok:false,error:'ADMIN_SETUP_REQUIRED: Set ADMIN_KEY or reuse existing API_TOKEN in Netlify.'},503);
  if(!auth(request,adminKey))return json({ok:false,error:'UNAUTHORISED'},401);
  let action;
  try {
    action=await request.json();
    if(JSON.stringify(action).length>15000)return json({ok:false,error:'REQUEST_TOO_LARGE'},413);
    if(action?.type==='check')return json({ok:true,result:{authenticated:true}});
    if(String(action?.type||'').startsWith('boost'))return json({ok:true,result:await mutateBoost(action)});
  } catch(e) {return json({ok:false,error:e instanceof BoostInputError?e.message:'Invalid request or unavailable storage'},422);}
  const feedUrl=feedURL(), feedKeyValue=feedKey();
  if(!feedUrl||!feedKeyValue)return json({ok:false,error:'SETUP_REQUIRED: Set APP_SCRIPT_URL and APP_SCRIPT_TOKEN (or SHEET_FEED_URL and SHEET_FEED_KEY) in Netlify.'},503);
  try{
    if(!action||!allowed.has(action.type))return json({ok:false,error:'INVALID_ACTION'},400);
    if(JSON.stringify(action).length>15000)return json({ok:false,error:'REQUEST_TOO_LARGE'},413);
    const target=new URL(feedUrl);
    if(!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(target.origin+target.pathname))
      return json({ok:false,error:'INVALID_SHEET_FEED_URL'},503);
    target.searchParams.set('key',feedKeyValue);
    const response=await fetch(target.href,{
      method:'POST',redirect:'follow',headers:{'content-type':'text/plain;charset=utf-8'},
      body:JSON.stringify(action),signal:AbortSignal.timeout(20000)
    });
    if(!response.ok)throw new Error('Google Apps Script HTTP '+response.status);
    const raw=await response.text();
    let result;try{result=JSON.parse(raw);}catch{return json({ok:false,error:'The Google Apps Script editing bridge needs to be updated. Use the source spreadsheet until its authenticated deployment is repaired.'},503);}
    if(result.error==='Unauthorised'||result.error==='unauthorised')return json({ok:false,error:'The Google Apps Script editing bridge has not been upgraded. Sheet reads and X refreshes are operational; spreadsheet editing needs Google Apps Script authorisation.'},503);
    if(!result.ok)return json({ok:false,error:String(result.error||'Edit failed')},422);
    // Cached read-only dashboard results are invalidated by short cache TTL or refresh requests.
    return json({ok:true,result:result.result||{},updatedAt:new Date().toISOString()});
  }catch(e){return json({ok:false,error:'Campaign update failed: '+String(e.message||e)},503)}
}
