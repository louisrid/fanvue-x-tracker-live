import {getStore} from '@netlify/blobs';

// 11:00 and 12:00 UTC cover midday in both BST and GMT.
// Only the run whose local hour is 12 records a snapshot.
export const config={schedule:'0 11,12 * * *'};
const STORE='fanvue-discord-member-history-v1';
// Confirm the exact Academy guild for every public invite response.
// Older valid Fanvue invite codes are fallbacks; an override is supported.
const INVITES=[process.env.DISCORD_ACADEMY_INVITE_CODE,'u4Ds98zhDX','NWdzrN7Se','J7dNpYCeQ']
  .filter(code=>typeof code==='string'&&/^[A-Za-z0-9_-]{2,32}$/.test(code))
  .filter((code,i,all)=>all.indexOf(code)===i);
const EXPECTED_GUILD_ID='1427337798104383694';
export function londonParts(instant){
  const values=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{
    timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'
  }).formatToParts(instant).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  return {date:`${values.year}-${values.month}-${values.day}`,hour:Number(values.hour)};
}
export function validateInvite(response){
  if(String(response?.guild?.id||'')!==EXPECTED_GUILD_ID)throw Error('Discord invite does not match Fanvue Academy server');
  const count=response?.approximate_member_count;
  if(!Number.isSafeInteger(count)||count<0)throw Error('Discord invite did not provide member count');
  return count;
}
export async function captureMemberCount({
  now=new Date(),storage=getStore({name:STORE,consistency:'strong'}),fetcher=fetch
}={}){
  const {date,hour}=londonParts(now);
  if(hour!==12)return {ok:true,skipped:'outside-uk-midday',date};
  const key='day-'+date;
  const old=await storage.get(key,{type:'json'});
  if(old?.date===date&&Number.isSafeInteger(old.memberCount))return {ok:true,skipped:'already-recorded',date};
  let memberCount=null;
  for(const code of INVITES){
    try{
      const request=await fetcher('https://discord.com/api/v10/invites/'+code+'?with_counts=true',{
        headers:{accept:'application/json','user-agent':'Fanvue-Tracker/1.0 (daily member count)'},
        signal:AbortSignal.timeout(9000),cache:'no-store'
      });
      if(request.status===429)throw Error('Discord API rate limited');
      if(!request.ok)continue;
      memberCount=validateInvite(await request.json());
      break;
    }catch(error){
      if(error.message==='Discord API rate limited')throw error;
      // A revoked invite or invite for a different guild must not create a false reading.
    }
  }
  if(memberCount===null)throw Error('No verified Fanvue Academy invite returned member counts');
  const value={date,memberCount,source:'DISCORD_INVITE_APPROXIMATE',capturedAt:now.toISOString()};
  await storage.setJSON(key,value);
  return {ok:true,...value};
}
export default async function discordMemberSnapshot(){
  try{return await captureMemberCount();}
  catch(error){console.error('Daily Fanvue Discord member snapshot failed:',error);return {ok:false,error:'Discord member count unavailable'};}
}
