import {getStore} from '@netlify/blobs';

// 11:00 and 12:00 UTC cover midday in both BST and GMT.
// Only the run whose local hour is 12 records a snapshot.
export const config={schedule:'0 11,12 * * *'};
const STORE='fanvue-discord-member-history-v1';
const INVITE='fanvue';
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
  const request=await fetcher('https://discord.com/api/v10/invites/'+INVITE+'?with_counts=true',{
    headers:{accept:'application/json','user-agent':'Fanvue-Tracker/1.0 (daily member count)'},
    signal:AbortSignal.timeout(10000),cache:'no-store'
  });
  if(!request.ok)throw Error('Discord invite API returned HTTP '+request.status);
  const data=await request.json();
  const memberCount=validateInvite(data);
  const value={date,memberCount,source:'DISCORD_INVITE_APPROXIMATE',capturedAt:now.toISOString()};
  await storage.setJSON(key,value);
  return {ok:true,...value};
}
export default async function discordMemberSnapshot(){
  try{return await captureMemberCount();}
  catch(error){console.error('Daily Fanvue Discord member snapshot failed:',error);return {ok:false,error:'Discord member count unavailable'};}
}
