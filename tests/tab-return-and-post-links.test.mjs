import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const tables=readFileSync('public/xtracker-tables.js','utf8');
const app=readFileSync('public/app.js','utf8');
function parsers(){
  const context=vm.createContext({window:{},document:{readyState:'loading',addEventListener(){}},location:{href:'https://example.com'},URL,Intl,CSS:{escape:x=>x}});
  vm.runInContext(tables.replace("  if(document.readyState==='loading')",'  globalThis.api={parseArticle,parsePromo,lookups};\n  if(document.readyState===\'loading\')'),context);
  return context.api;
}
const card=(code,url)=>({dataset:{placementCode:code,postUrl:url},tagName:'A',href:url,querySelector(){return null;},querySelectorAll(){return [];},classList:{contains(){return false;}},getAttribute(){return url;}});

test('two posts by the same account retain separate current URLs despite stale lookup data',()=>{
  const api=parsers();
  const old='https://x.com/account/status/111';
  for(const code of ['A01-P01','A02-P01'])api.lookups.set(code,{publisher:'Same account',postUrl:old});
  const first=card('A01-P01','https://x.com/account/status/222');
  const second=card('A02-P01','https://x.com/account/status/333');
  assert.equal(api.parseArticle(first,first,0).postUrl,first.href);
  assert.equal(api.parseArticle(second,second,1).postUrl,second.href);
  first.dataset.postUrl='';
  assert.equal(api.parseArticle(first,first,0).postUrl,'');
});

test('promo links use current placement URL even when cached report differs or clears it',()=>{
  const api=parsers();
  const current=card('GTA1-R8','https://x.com/account/status/222');
  const wrapper={querySelector:()=>current,querySelectorAll:()=>[]};
  const cache=new Map([['GTA1-R8',{postUrl:'https://x.com/account/status/111'}]]);
  assert.equal(api.parsePromo(wrapper,'gta',0,cache).postUrl,current.href);
  current.dataset.postUrl='';
  assert.equal(api.parsePromo(wrapper,'gta',0,cache).postUrl,'');
});

function node(cls=''){
  return {cls,dataset:{},children:[],classList:{add(){},remove(){}},setAttribute(){},addEventListener(){},appendChild(child){this.children.push(child);},replaceChildren(child){this.children=child.children;},querySelector(selector){const cls=selector.slice(1);return this.children.find(child=>child.cls===cls)||null;}};
}
test('search, sort and horizontal position survive replacing a publisher grid and stay separate by section',()=>{
  const roots=new WeakMap(),savedViews=new Map();
  const context={roots,savedViews,signature:()=> 'data',collect:()=>[{}],text:e=>e?.textContent||'',elem:(_tag,cls)=>node(cls),document:{createDocumentFragment:()=>node()},makeTable:()=>node()};
  vm.runInNewContext(tables.slice(tables.indexOf('  function renderView('),tables.indexOf('  function checkMounts('))+';this.renderView=renderView;',context);
  const root=title=>({isConnected:true,closest:()=>({querySelector:()=>({textContent:title})}),classList:{add(){}},insertAdjacentElement(){}});
  const original=root('Published X posts');
  context.renderView(original,'gta');
  Object.assign(roots.get(original),{search:'account',sortKey:'views',sortDir:-1,scrollLeft:175});
  const replacement=root('Published X posts');
  context.renderView(replacement,'gta');
  const restored=roots.get(replacement);
  assert.equal(restored.search,'account');assert.equal(restored.sortKey,'views');assert.equal(restored.sortDir,-1);
  assert.equal(restored.mount.querySelector('.xt-table-scroll').scrollLeft,175);
  const pending=root('Awaiting publication');context.renderView(pending,'gta');
  assert.equal(roots.get(pending).search,'');
});

test('background redraw restores scroll after table rendering and respects user navigation or interaction',()=>{
  for(const action of ['none','navigate','interact']){
    const frames=[],listeners=new Map(),scrolls=[];
    const state={page:'gta-vi'};
    const context={state,document:{activeElement:null},requestAnimationFrame:fn=>frames.push(fn),window:{scrollX:15,scrollY:900,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name),scrollTo:position=>scrolls.push(position)}};
    vm.runInNewContext(app.slice(app.indexOf('function preserveReadingPosition('),app.indexOf('function render(){'))+'this.preserve=preserveReadingPosition;',context);
    context.preserve(()=>{});
    assert.equal(scrolls.length,0);
    if(action==='navigate')state.page='dashboard';
    if(action==='interact')listeners.get('wheel')();
    while(frames.length)frames.shift()();
    assert.equal(scrolls.length,action==='none'?1:0);
    if(scrolls.length)assert.equal(scrolls[0].top,900);
    assert.equal(listeners.size,0);
  }
});
