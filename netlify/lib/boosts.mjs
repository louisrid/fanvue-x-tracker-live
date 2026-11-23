import {getDatabase} from '@netlify/database';
import {postIdentity,parseXResponse} from './metrics.mjs';
let database;
const databaseClient=()=>database??=getDatabase();
export class BoostInputError extends Error {constructor(message){super(message);this.name='BoostInputError';}}
export function boostIdentity(url){
  const p=postIdentity(url);let u;try{u=new URL(url);}catch{}
  if(!p||!u||u.username||u.password||u.port||!/^\/[A-Za-z0-9_]{1,15}\/status\/\d+\/?$/.test(u.pathname)||p.id.length>20)throw new BoostInputError('Enter an allowed original X status URL');
  p.id=BigInt(p.id).toString();
  if(p.id==='0'||p.id==='2114682794160824473'||BigInt(p.id)>18446744073709551615n)throw new BoostInputError('Enter an allowed original X status URL');
  return p;
}
export function boostCalculations(row){
  const present=v=>(typeof v==='number'||typeof v==='string'&&v.trim()!=='')&&Number.isFinite(Number(v))&&Number(v)>=0;
  return {engagement:present(row.views)&&row.views>0&&['likes','reposts','replies'].every(k=>present(row[k]))?100*(Number(row.likes)+Number(row.reposts)+Number(row.replies))/row.views:null,
    efficiency:present(row.spend)&&present(row.views)&&row.views>0?1000*Number(row.spend)/row.views:null};
}
export async function readBoosts(){
  const db=databaseClient();
  const tweets=await db.sql`SELECT * FROM x_boost_tweets WHERE removed_at IS NULL ORDER BY added_at DESC,id DESC`;
  const samples=await db.sql`SELECT s.* FROM x_boost_samples s JOIN x_boost_tweets t ON t.id=s.tweet_id WHERE t.removed_at IS NULL AND (s.at > now()-interval '91 days' OR s.at=(SELECT max(latest.at) FROM x_boost_samples latest WHERE latest.tweet_id=s.tweet_id)) ORDER BY s.at`;
  return tweets.map(t=>{const history=samples.filter(s=>s.tweet_id===t.id).map(s=>({...s,views:s.views===null?null:Number(s.views),likes:s.likes===null?null:Number(s.likes),reposts:s.reposts===null?null:Number(s.reposts),replies:s.replies===null?null:Number(s.replies)}));const last=history.at(-1)||{};
    const growth=hours=>{if(!last.at||last.views===null)return null;const target=new Date(last.at).getTime()-hours*3600000;const prev=history.filter(s=>new Date(s.at).getTime()<=target&&new Date(s.at).getTime()>=target-4*3600000).at(-1);return prev?.views!=null?last.views-prev.views:null;};
    const row={...t,...last,id:t.id,spend:t.spend===null?null:Number(t.spend),history,growth24: growth(24),growth7: growth(168)};return {...row,...boostCalculations(row)};});
}
export async function mutateBoost(action){
  const db=databaseClient();
  if(action.type==='boostAdd'){
    const {id,handle}=boostIdentity(action.url);
    const rows=await db.sql`INSERT INTO x_boost_tweets (id,handle,name) VALUES (${id},${handle},${handle}) ON CONFLICT DO NOTHING RETURNING id`;
    if(!rows.length)throw new BoostInputError('This post ID already exists');
  }else if(action.type==='boostUpdate'){
    if(action.spend!==null&&typeof action.spend!=='number'&&typeof action.spend!=='string')throw new BoostInputError('Enter a valid USD spend or leave it unknown');
    const spend=action.spend===null||typeof action.spend==='string'&&action.spend.trim()===''?null:Number(action.spend);
    if(spend!==null&&(!Number.isFinite(spend)||spend<0||spend>999999999999.99))throw new BoostInputError('Enter a valid USD spend or leave it unknown');
    const name=String(action.name||'').trim().slice(0,100);if(!name)throw new BoostInputError('Account name is required');
    const rows=await db.sql`UPDATE x_boost_tweets SET spend=${spend},name=${name} WHERE id=${String(action.id)} AND removed_at IS NULL RETURNING id`;
    if(!rows.length)throw new BoostInputError('Tweet not found');
  }else if(action.type==='boostRemove'){
    const rows=await db.sql`UPDATE x_boost_tweets SET removed_at=now() WHERE id=${String(action.id)} AND removed_at IS NULL RETURNING id`;
    if(!rows.length)throw new BoostInputError('Tweet not found');
  }else throw new BoostInputError('Invalid action');
  return {saved:true};
}
export async function refreshBoosts({fetcher=fetch,manual=false}={}){
  const db=databaseClient(), tweets=await db.sql`SELECT * FROM x_boost_tweets WHERE removed_at IS NULL`;
  let updated=0,skipped=0;const errors=[];
  async function refreshOne(t){
    // Atomic lease prevents manual article refreshes and overlapping jobs from polling again.
    const claimed=manual?await db.sql`UPDATE x_boost_tweets SET last_attempt_at=now() WHERE id=${t.id} AND (last_attempt_at IS NULL OR last_attempt_at < now()-interval '5 minutes') RETURNING id`:await db.sql`UPDATE x_boost_tweets SET last_attempt_at=now() WHERE id=${t.id} AND (last_attempt_at IS NULL OR last_attempt_at < now()-interval '115 minutes') RETURNING id`;
    if(!claimed.length){skipped++;return;}
    try{
      const response=await fetcher('https://api.fxtwitter.com/'+encodeURIComponent(t.handle)+'/status/'+t.id,{signal:AbortSignal.timeout(10000),headers:{accept:'application/json'}});
      if(!response.ok)throw new BoostInputError('X provider HTTP '+response.status);
      const raw=await response.json(),m=parseXResponse(raw,t.id);
      const [prior]=await db.sql`SELECT * FROM x_boost_samples WHERE tweet_id=${t.id} ORDER BY at DESC LIMIT 1`;
      if(prior&&[['views','views'],['likes','likes'],['comments','replies'],['shares','reposts']].some(([a,b])=>m[a]===0&&Number(prior[b])>0))throw new BoostInputError('Provider returned zero for a verified metric');
      const slot=m.at;
      await db.sql`INSERT INTO x_boost_samples (tweet_id,at,views,likes,reposts,replies) VALUES (${t.id},${slot},${m.views},${m.likes},${m.shares},${m.comments}) ON CONFLICT DO NOTHING`;
      await db.sql`UPDATE x_boost_tweets SET tweet_text=COALESCE(${typeof raw.tweet.text==='string'&&raw.tweet.text.trim()?raw.tweet.text:null},tweet_text),error=NULL WHERE id=${t.id}`;updated++;
    }catch{errors.push(t.id);await db.sql`UPDATE x_boost_tweets SET error='X metrics temporarily unavailable; showing last successful readings.' WHERE id=${t.id}`;}
  }
  for(let i=0;i<tweets.length;i+=5)await Promise.all(tweets.slice(i,i+5).map(refreshOne));
  await db.sql`DELETE FROM x_boost_samples WHERE at < now()-interval '91 days' AND (tweet_id,at) NOT IN (SELECT tweet_id,max(at) FROM x_boost_samples GROUP BY tweet_id)`;
  return {updated,total:tweets.length,errors,skipped};
}
