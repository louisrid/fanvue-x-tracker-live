import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCoordinator,scopes} from '../netlify/lib/durable-refresh.mjs';
function memory(){
 let data=null,version=0;
 return {get:async()=>structuredClone(data),getWithMetadata:async()=>data?{data:structuredClone(data),etag:String(version)}:null,
 setJSON:async(key,value,options)=>{if(options?.onlyIfNew&&data||options?.onlyIfMatch!==undefined&&options.onlyIfMatch!==String(version))return {modified:false};data=structuredClone(value);version++;return {modified:true};}};
}
test('durable job survives loss of its initiating client, joins concurrent requests and runs each source once',async()=>{
 const store=memory(),dispatches=[],seen=[];
 const starter=makeCoordinator({store,uuid:()=>crypto.randomUUID(),dispatch:async id=>{dispatches.push(id);}});
 const [a,b]=await Promise.all([starter.start('all'),starter.start('gta')]);
 assert.equal(a.id,b.id);assert.equal(dispatches.length,1);assert.equal(a.scope,'all');
 const worker=makeCoordinator({store,execute:async(name)=>{seen.push(name);if(name==='overview')assert.ok(['x','gta','discord','of-read','boosts-read'].every(n=>seen.includes(n)));return {ok:true,...(name==='discord'?{snapshot:{members:{ok:true},clicks:{ok:true}}}:{})};}});
 await Promise.all([worker.run(a.id),worker.run(a.id)]);
 const reopened=makeCoordinator({store,dispatch:async()=>{throw Error('must not redispatch');}});
 const finished=await reopened.status();assert.equal(finished.id,a.id);assert.equal(finished.state,'complete');assert.equal(finished.completed,6);assert.equal(new Set(seen).size,6);assert.equal(seen.length,6);assert.ok(finished.snapshot.members.ok);
});
test('every refresh scope is executable, partial failures preserve successful Discord snapshot',async()=>{
 const store=memory();let count=0;
 for(const scope of scopes){
  const c=makeCoordinator({store,uuid:()=>String(++count),dispatch:async()=>{},execute:async name=>name==='discord-clicks'?{ok:false,issue:'clicks unavailable'}:{ok:true,...(name==='discord-members'?{snapshot:{members:{ok:true}}}:{})}});
  const job=await c.start(scope);await c.run(job.id);const result=await c.status();assert.equal(result.completed,result.total);assert.equal(result.scope,scope);assert.equal(result.state,scope==='discord'?'failed':'complete');if(scope==='discord')assert.ok(result.snapshot.members.ok);
 }
});
test('expired jobs cannot execute and a new refresh may start',async()=>{
 const store=memory();let now=1000,ids=0,executed=0;
 const c=makeCoordinator({store,clock:()=>now,uuid:()=>String(++ids),dispatch:async()=>{},execute:async()=>{executed++;return {ok:true};}});
 const old=await c.start('gta');now+=17*60_000;assert.equal((await c.status()).state,'failed');await c.run(old.id);assert.equal(executed,0);
 const fresh=await c.start('discord');assert.notEqual(fresh.id,old.id);await c.run(fresh.id);assert.equal(executed,2);
});

test('finished and expired jobs age out without deleting saved data, and old fully settled jobs never remain busy',async()=>{
 const store=memory();let now=1000,ids=0;
 const c=makeCoordinator({store,clock:()=>now,uuid:()=>String(++ids),dispatch:async()=>{},execute:async()=>({ok:true})});
 const job=await c.start('all');await c.run(job.id);
 const done=await c.status();assert.equal(done.state,'complete');assert.equal(done.completed,done.total);
 now+=5*60_000;assert.equal(await c.status(),null);assert.equal((await store.get()).id,job.id);
 const next=await c.start('gta');
 await store.setJSON('latest-v1',{...next,state:'running',completed:2,done:['gta','overview'],issues:[],lastProgressAt:new Date(now).toISOString()});
 assert.equal((await c.status()).state,'complete');
 const another=await c.start('discord');assert.notEqual(another.id,next.id);
 now=another.expiresAt+1000;const expired=await c.status();assert.equal(expired.state,'failed');
 now+=5*60_000;assert.equal(await c.status(),null);
});
