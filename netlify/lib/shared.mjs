import { getStore } from '@netlify/blobs';
import {validCode} from './tracking.mjs';
import {readOfEvents,mergeOfEvents} from './of-events.mjs';
const ofCode=code=>/^OF[1-9]\d*$/.test(String(code||''));
import {isCurrentClick} from './click-baseline.mjs';
export {validCode,trackingRequest,buildDestination} from './tracking.mjs';

export const SITE_URL = 'https://elegant-swan-98c20a.netlify.app'; // Existing public /r/ links - never change
export const FANVUE_SITE_URL = SITE_URL; // All public click links use the original tracked domain
// Reuse previously stored Netlify environment variables without exposing their values.
// SHEET_FEED_* is supported for newer installations; APP_SCRIPT_* is supported
// for the existing site shown in Netlify.
export const feedURL = () => process.env.SHEET_FEED_URL || process.env.APP_SCRIPT_URL || '';
export const feedKey = () => process.env.SHEET_FEED_KEY || process.env.APP_SCRIPT_TOKEN || '';
export const adminKey = () => process.env.ADMIN_KEY || process.env.API_TOKEN || '';
export const missingFeedSettings = () => [
  ...(!feedURL() ? ['APP_SCRIPT_URL (or SHEET_FEED_URL)'] : []),
  ...(!feedKey() ? ['APP_SCRIPT_TOKEN (or SHEET_FEED_KEY)'] : []),
];
export const store = (name) => getStore({name,consistency:'strong'});
// BEGIN_LEGACY_EVENTS
export const legacyEvents = Object.freeze([
  { timestamp:'2026-10-15T16:39:36.921Z', code:'A01-P14', cta:'PRISM', legacy:true },
  { timestamp:'2026-10-15T17:45:26.331Z', code:'A01-P14', cta:'PRISM', legacy:true },
]);
// END_LEGACY_EVENTS

export const json = (body,status=200) => new Response(JSON.stringify(body),{
  status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',
  'x-content-type-options':'nosniff'}
});
// The redesigned preview site can display redirects still published on the
// original tracking domain. This keeps the old live URLs unchanged.
async function readUpstreamEvents(url){
  const target=new URL(url);
  if(target.protocol!=='https:' || !target.hostname.endsWith('.netlify.app') ||
      target.pathname!=='/.netlify/functions/events')throw new Error('Invalid upstream event source');
  const response=await fetch(target.href,{signal:AbortSignal.timeout(10000),headers:{accept:'text/csv'}});
  if(!response.ok)throw new Error('Upstream events HTTP '+response.status);
  const lines=(await response.text()).trim().split(/\r?\n/);
  if(lines[0]?.replaceAll('"','')!=='TIMESTAMP,CODE,CTA')throw new Error('Unrecognised upstream event feed');
  const out=[];
  for(const line of lines.slice(1)){
    if(!line.trim())continue;
    const parts=line.match(/^"([^"]*)","([^"]*)","([^"]*)"$/)?.slice(1)||line.split(',');
    if(parts.length!==3 || !(validCode(parts[1])||ofCode(parts[1])) || Number.isNaN(Date.parse(parts[0])))throw new Error('Invalid upstream event row');
    out.push({timestamp:parts[0],code:parts[1],cta:parts[2]});
  }
  return out;
}
export async function readEvents({includeOf=true}={}){
  const upstream=process.env.UPSTREAM_EVENTS_URL;
  // If an upstream domain is set, do NOT also count local legacy snapshots.
  const source=upstream?await readUpstreamEvents(upstream):legacyEvents;
  const s=store('fanvue-x-click-events-v2');
  const blobs=[]; for await(const page of s.list({paginate:true}))blobs.push(...page.blobs);
  // Cache the event documents, never counters. Listing remains authoritative and
  // changed/new objects are fetched, preserving every genuine stored click.
  const cache=store('x-tracker-report-cache');
  let snapshot={};try{snapshot=await cache.get('event-documents-v1',{type:'json'})||{};}catch{}
  const next={},batches=[];
  for(let i=0;i<blobs.length;i+=50){
    const group=await Promise.all(blobs.slice(i,i+50).map(async b=>{
      const old=snapshot[b.key];
      const event=old?.etag===b.etag?old.event:await s.get(b.key,{type:'json'});
      if(event)next[b.key]={etag:b.etag,event};
      return event;
    }));
    batches.push(...group.filter(x=>x && (validCode(x.code)||ofCode(x.code)) && x.test!==true));
  }
  try{await cache.setJSON('event-documents-v1',next);}catch{}
  const uniq=new Map();
  for(const e of [...source,...batches])uniq.set([e.timestamp,e.code,e.cta].join('|'),e);
  const articles=[...uniq.values()].filter(e=>validCode(e.code)&&isCurrentClick(e));
  if(!includeOf)return articles;
  return mergeOfEvents([...articles,...[...uniq.values()].filter(e=>ofCode(e.code))],await readOfEvents());
}
export function getCounts(events){
  const counts={};
  for(const e of events){
    const row=counts[e.code] ||= {clicks:0,prismClicks:0,signupClicks:0,lastClick:'',firstClick:''};
    row.clicks++;
    if(e.cta==='FANVUE')row.signupClicks++;
    else row.prismClicks++;
    if(!row.firstClick||e.timestamp<row.firstClick)row.firstClick=e.timestamp;
    if(!row.lastClick||e.timestamp>row.lastClick)row.lastClick=e.timestamp;
  }
  return counts;
}
export async function readFeed({force=false}={}){
  const cache=store('fanvue-x-private-sheet-cache');
  let cached=null;
  try{cached=await cache.get('last-sanitised-direct-v1',{type:'json'});}catch{}
  if(!force&&cached&&Date.now()-Date.parse(cached.fetchedAt)<45000)
    return {feed:cached,status:'SHEET_FRESH',warning:''};
  try{
    const {readWorkbook}=await import('./sheet-source.mjs');
    const clean=await readWorkbook();
    await cache.setJSON('last-sanitised-direct-v1',clean);
    return {feed:clean,status:'SHEET_LIVE',warning:''};
  }catch(e){
    if(cached)return {feed:cached,status:'SHEET_CACHED',warning:'Google Sheets is unavailable; showing the last verified copy from '+cached.fetchedAt};
    throw new Error('Google Sheets connection failed: '+String(e.message||e));
  }
}
export const ownerOf=x=>String(x||'').toUpperCase();
