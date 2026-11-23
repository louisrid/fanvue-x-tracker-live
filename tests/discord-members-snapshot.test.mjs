import test from 'node:test';
import assert from 'node:assert/strict';
import {londonParts,validateInvite,captureMemberCount} from '../netlify/functions/discord-members-snapshot.mjs';
const GUILD='1427337798104383694';
test('12:00 in London follows GMT and BST',()=>{
  assert.equal(londonParts(new Date('2026-11-23T12:00:00Z')).hour,12);
  assert.equal(londonParts(new Date('2026-06-23T11:00:00Z')).hour,12);
  assert.equal(londonParts(new Date('2026-06-23T12:00:00Z')).hour,13);
});
test('only actual Academy server counts are accepted',()=>{
  assert.equal(validateInvite({guild:{id:GUILD},approximate_member_count:24500}),24500);
  assert.throws(()=>validateInvite({guild:{id:'wrong'},approximate_member_count:24500}));
  assert.throws(()=>validateInvite({guild:{id:GUILD},approximate_member_count:null}));
});
test('records once per UK noon and preserves history',async()=>{
  const values=new Map,storage={
    async get(k){return values.get(k)||null},
    async setJSON(k,v){values.set(k,v)}
  };
  let calls=0;
  const fetcher=async()=>{
    calls++;
    return calls===1?{ok:false,status:404}:{ok:true,json:async()=>({guild:{id:GUILD},approximate_member_count:24500})};
  };
  const now=new Date('2026-11-23T12:00:00Z');
  const first=await captureMemberCount({now,storage,fetcher});
  assert.equal(first.memberCount,24500);
  assert.equal(calls,2);
  assert.equal(values.get('day-2026-11-23').memberCount,24500);
  const second=await captureMemberCount({now,storage,fetcher});
  assert.equal(second.skipped,'already-recorded');
  assert.equal(calls,2);
  const early=await captureMemberCount({now:new Date('2026-11-23T11:00:00Z'),storage,fetcher});
  assert.equal(early.skipped,'outside-uk-midday');
});
