// Campaign registry API and editor: synthetic data and an in-memory store only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import vm from 'node:vm';
import {makeRegistryHandler} from '../netlify/functions/campaign-registry.mjs';
import {REGISTRY_STORE,applyAction,validateCampaign,publicView,ICONS,COLORS} from '../netlify/lib/campaign-registry.mjs';

const KEY='test-admin-key-0123456789';
function memoryStore(){
  let value=null,etag=0;const calls=[];
  return {calls,
    async get(key,opts){calls.push(['get',key]);return value?structuredClone(value):null;},
    async getWithMetadata(key,opts){calls.push(['getWithMetadata',key]);return value?{data:structuredClone(value),etag:String(etag)}:null;},
    async setJSON(key,data,opts={}){calls.push(['setJSON',key]);
      if(opts.onlyIfNew&&value)return {modified:false};
      if(opts.onlyIfMatch&&opts.onlyIfMatch!==String(etag))return {modified:false};
      value=structuredClone(data);etag++;return {modified:true,etag:String(etag)};}};
}
const setup=()=>{const store=memoryStore();let t=Date.parse('2026-11-24T12:00:00Z');
  const handler=makeRegistryHandler({storage:()=>store,secret:()=>KEY,clock:()=>new Date(t+=1000)});return {store,handler};};
const post=(handler,body,key=KEY,raw)=>handler(new Request('https://example.test/.netlify/functions/campaign-registry',
  {method:'POST',headers:{'content-type':'application/json',...(key===null?{}:{authorization:'Bearer '+key})},body:raw??JSON.stringify(body)}));
const get=handler=>handler(new Request('https://example.test/.netlify/functions/campaign-registry'));
const sample=(o={})=>({name:'Spring Creators',icon:'rocket',color:'teal',status:'Planned',startDate:'2026-12-01',endDate:'2026-12-31',
  owner:'Marketing',objective:'Test a new angle.',budget:{amount:'1500.50',currency:'USD'},links:[{label:'Brief',url:'https://example.com/brief'}],notes:'Synthetic.',...o});

test('GET returns an empty registry by default: no seed, sample or demo entries',async()=>{
  const {handler}=setup();
  const res=await get(handler);const body=await res.json();
  assert.equal(res.status,200);
  assert.deepEqual(body,{ok:true,campaigns:[],builtIns:{},updatedAt:null});
});

test('every write is rejected without the admin key or with a wrong key',async()=>{
  const {handler,store}=setup();
  for(const key of [null,'','wrong',KEY+'x',KEY.slice(0,-1)]){
    const res=await post(handler,{action:'create',campaign:sample()},key);
    assert.equal(res.status,401,String(key));
  }
  assert.equal(store.calls.filter(c=>c[0]==='setJSON').length,0);
  const unconfigured=makeRegistryHandler({storage:()=>store,secret:()=>''});
  assert.equal((await post(unconfigured,{action:'create',campaign:sample()})).status,503);
  assert.equal((await unconfigured(new Request('https://example.test/x',{method:'PUT'}))).status,405);
  assert.equal((await handler(new Request('https://example.test/x',{method:'DELETE',headers:{authorization:'Bearer '+KEY}}))).status,405);
});

test('create stores validated fields with a generated slug and timestamps; GET shape is public-safe',async()=>{
  const {handler}=setup();
  const res=await post(handler,{action:'create',campaign:sample()});const body=await res.json();
  assert.equal(res.status,200);
  const c=body.campaigns[0];
  assert.equal(c.slug,'spring-creators');assert.equal(c.budget.amount,1500.5);assert.equal(c.links[0].url,'https://example.com/brief');
  assert.ok(c.createdAt&&c.updatedAt);
  const pub=await (await get(handler)).json();
  assert.deepEqual(Object.keys(pub).sort(),['builtIns','campaigns','ok','updatedAt']);
  assert.deepEqual(Object.keys(pub.campaigns[0]).sort(),['budget','color','createdAt','dataLink','endDate','icon','links','name','notes','objective','owner','slug','startDate','status','updatedAt']);
});

test('server-side validation: lengths, allowlists, https links, ISO dates, numeric budget, size cap',async()=>{
  const {handler}=setup();
  const bad=[
    [{name:''},'name'],[{name:'x'.repeat(41)},'name'],[{icon:'skull'},'icon'],[{color:'#ff0000'},'color'],[{status:'Done'},'status'],
    [{startDate:'2026-02-30'},'startDate'],[{startDate:'24/11/2026'},'startDate'],[{startDate:'2026-12-10',endDate:'2026-12-01'},'endDate'],
    [{objective:'y'.repeat(501)},'objective'],[{budget:{amount:'12abc'}},'budget'],[{budget:{amount:-5}},'budget'],[{budget:{amount:'10',currency:'BTC'}},'budgetCurrency'],
    [{links:[{label:'x',url:'http://example.com'}]},'links.0.url'],[{links:[{label:'x',url:'javascript:alert(1)'}]},'links.0.url'],
    [{links:Array.from({length:7},()=>({label:'a',url:'https://example.com'}))},'links'],[{dataLink:'../etc'},'dataLink'],[{name:'bad\u0007name'},'name']
  ];
  for(const [patch,field] of bad){
    const res=await post(handler,{action:'create',campaign:sample(patch)});
    assert.equal(res.status,422,JSON.stringify(patch));
    assert.equal((await res.json()).field,field,JSON.stringify(patch));
  }
  assert.equal((await post(handler,null,KEY,'{"action":"create","campaign":{"notes":"'+'z'.repeat(17000)+'"}}')).status,413);
  assert.equal((await post(handler,null,KEY,'{not json')).status,400);
  assert.equal((await post(handler,{action:'drop'})).status,422);
  assert.deepEqual((await (await get(handler)).json()).campaigns,[]);
  assert.equal(ICONS.length,24);assert.equal(COLORS.length,8);
});

test('slugs are generated once, never reuse archived slugs and never shadow page names',()=>{
  let r=null;const now=new Date('2026-11-24T00:00:00Z');
  r=applyAction(r,{action:'create',campaign:sample({name:'Home'})},now);
  assert.equal(r.campaigns[0].slug,'home-2');
  r=applyAction(r,{action:'create',campaign:sample({name:'Launch'})},now);
  r=applyAction(r,{action:'archive',slug:'launch'},now);
  r=applyAction(r,{action:'create',campaign:sample({name:'Launch'})},now);
  assert.deepEqual(r.campaigns.map(c=>c.slug),['home-2','launch','launch-2']);
  r=applyAction(r,{action:'update',slug:'launch-2',campaign:sample({name:'Renamed'})},now);
  assert.equal(r.campaigns[2].slug,'launch-2');assert.equal(r.campaigns[2].name,'Renamed');
});

test('archive is a soft delete, restore brings it back last, reorder needs every active campaign once',async()=>{
  const {handler}=setup();
  for(const name of ['One','Two','Three'])await post(handler,{action:'create',campaign:sample({name})});
  let body=await (await post(handler,{action:'reorder',order:['three','one','two']})).json();
  assert.deepEqual(body.campaigns.map(c=>c.slug),['three','one','two']);
  assert.equal((await post(handler,{action:'reorder',order:['three','one']})).status,422);
  assert.equal((await post(handler,{action:'reorder',order:['three','one','one']})).status,422);
  body=await (await post(handler,{action:'archive',slug:'one'})).json();
  assert.deepEqual(body.campaigns.map(c=>c.slug),['three','two']);
  assert.deepEqual(body.archived.map(c=>c.slug),['one']);
  const pub=await (await get(handler)).json();
  assert.deepEqual(pub.campaigns.map(c=>c.slug),['three','two']);
  assert.equal('archived' in pub,false);
  const list=await (await post(handler,{action:'list'})).json();
  assert.equal(list.archived[0].name,'One');
  body=await (await post(handler,{action:'restore',slug:'one'})).json();
  assert.deepEqual(body.campaigns.map(c=>c.slug),['three','two','one']);
  assert.equal((await post(handler,{action:'restore',slug:'one'})).status,422);
  assert.equal((await post(handler,{action:'archive',slug:'nope'})).status,422);
});

test('built-in campaigns accept only icon, colour and info; names and IDs stay fixed',async()=>{
  const {handler}=setup();
  const res=await post(handler,{action:'updateBuiltIn',key:'gta-vi',campaign:sample({name:'Renamed GTA',dataLink:'C002'})});
  const body=await res.json();
  assert.equal(res.status,200);
  assert.equal(body.builtIns['gta-vi'].icon,'rocket');
  assert.equal('name' in body.builtIns['gta-vi'],false);
  assert.equal('dataLink' in body.builtIns['gta-vi'],false);
  assert.equal((await post(handler,{action:'updateBuiltIn',key:'home',campaign:sample()})).status,422);
  assert.equal(validateCampaign(sample(),{builtIn:true}).name,undefined);
});

test('the registry is isolated: one dedicated store, no other store, sheet or feed',()=>{
  const lib=readFileSync('netlify/lib/campaign-registry.mjs','utf8');
  const fn=readFileSync('netlify/functions/campaign-registry.mjs','utf8');
  assert.equal(REGISTRY_STORE,'fanvue-campaign-registry-v1');
  assert.equal((fn.match(/getStore\(/g)||[]).length,1);
  assert.match(fn,/getStore\(\{name:REGISTRY_STORE,consistency:'strong'\}\)/);
  for(const src of [lib,fn]){
    assert.doesNotMatch(src,/fetch\(|docs\.google|short\.io|readFeed|readEvents|store\(/);
    for(const other of readdirSync('netlify/functions').filter(f=>f!=='campaign-registry.mjs'))
      assert.ok(!src.includes("'../functions/"+other),other);
  }
  assert.match(fn,/import \{json,adminKey\} from '\.\.\/lib\/shared\.mjs'/);
  assert.match(lib,/timingSafeEqual\(a,b\)/);
  assert.deepEqual(publicView(null).campaigns,[]);
});

test('editor and added pages escape every user-entered value and keep the key in memory',async()=>{
  await import('../public/fanvue-core.js');
  const C=globalThis.FanvueCore;
  const src=readFileSync('public/fanvue-campaigns.js','utf8');
  assert.doesNotMatch(src,/localStorage|sessionStorage|document\.cookie|[?&]key=/);
  assert.match(src,/Campaign details are visible to anyone with the dashboard link\./);
  const ctx=vm.createContext({window:{FanvueCore:C,FanvueUI:null},Intl,Date,Math,Number,String,Object,Array,Map,Set,JSON,RegExp,URL});
  vm.runInContext(readFileSync('public/fanvue-ui.js','utf8'),ctx);
  vm.runInContext(readFileSync('public/fanvue-campaigns.js','utf8'),ctx);
  const R=ctx.window.FanvueCampaigns.render;
  const evil='<img src=x onerror=alert(1)>"\'';
  const c={slug:'evil',name:evil,icon:'rocket',color:'teal',status:'Live',owner:evil,objective:evil,notes:evil,
    links:[{label:evil,url:'https://example.com/?q=<b>'}],budget:{amount:10,currency:'USD'},startDate:'',endDate:'',dataLink:'',updatedAt:'2026-11-24T12:00:00Z'};
  for(const html of [R.navItem(c,false),R.info(c),R.preview(c)]){
    assert.doesNotMatch(html,/<img/);assert.match(html,/&lt;img/);
  }
  assert.match(R.info(c),/href="https:\/\/example\.com\/\?q=%3Cb%3E"/);
  assert.doesNotMatch(R.info({...c,links:[{label:'x',url:'javascript:alert(1)'}]}),/javascript:/);
});
