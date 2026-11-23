import {json,readFeed,readEvents,adminKey} from '../lib/shared.mjs';
import {readMetricState} from '../lib/metrics.mjs';
export default async()=>{
  let feed='ERROR',events=null,metricState={},details=[],placements=0;
  try{const f=await readFeed({force:true});feed=f.status;placements=f.feed.placements.length;if(f.warning)details.push(f.warning);}catch{details.push('Google Sheets is unavailable');}
  try{events=(await readEvents()).length;}catch{details.push('Click storage is unavailable');}
  try{metricState=await readMetricState();}catch{details.push('Metric storage is unavailable');}
  const ok=feed==='SHEET_LIVE'&&events!==null;
  return json({version:'4.1',ok,feed,placements,events,sourceMode:'GOOGLE_SHEETS_DIRECT_EXPORT',adminConfigured:!!adminKey(),
    metrics:{intervalHours:2,lastSuccessfulAt:metricState.lastSuccessfulAt||'',lastAttemptAt:metricState.lastAttemptAt||'',errors:metricState.errors||[]},
    details,checkedAt:new Date().toISOString()},ok?200:503);
};
