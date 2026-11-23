const ofCode=code=>/^OF[1-9]\d*$/.test(String(code||''));
let database;
export async function readOfEvents(){
  const {getDatabase}=await import('@netlify/database');
  database ||= getDatabase();
  let timer;
  const query=database.sql`SELECT id, account, clicked_at FROM of_terms_clicks WHERE is_test = false ORDER BY clicked_at, id`;
  let rows;
  try{rows=await Promise.race([query,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('OF event storage timeout')),8000);})]);}
  finally{clearTimeout(timer);}
  return rows.filter(r=>ofCode(r.account)).map(r=>({id:r.id,code:r.account,timestamp:new Date(r.clicked_at).toISOString(),cta:'FANVUE'}));
}
export function mergeOfEvents(existing,ofEvents){
  const keys=new Set(ofEvents.map(e=>[e.timestamp,e.code,e.cta].join('|')));
  // The database remains authoritative. A mirrored legacy record must not add a second click.
  return [...existing.filter(e=>!keys.has([e.timestamp,e.code,e.cta].join('|'))),...ofEvents].sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
}
