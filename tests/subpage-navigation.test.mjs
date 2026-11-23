import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const navigation=source.slice(source.indexOf('const navigationSession='),source.indexOf('function route(page,'));
function session(){
  const entries=[{hash:'#of',state:null}],calls=[];let index=0;
  const location={get hash(){return entries[index].hash;}};
  const history={get state(){return entries[index].state;},replaceState(state,_,hash){entries[index]={state,hash};},pushState(state,_,hash){entries.splice(++index,Infinity,{state,hash});},back(){index--;calls.push('back');}};
  const context=vm.createContext({crypto:{randomUUID:()=> 'current-document'},location,history,route:p=>calls.push(p)});
  vm.runInContext(navigation,context);
  return {run:code=>vm.runInContext(code,context),calls,entries,go(i){index=i;},index:()=>index};
}
test('direct links and reload boundaries fall back to Dashboard',()=>{
  const s=session();s.run("recordNavigation('of',false);navigateBack()");assert.deepEqual(s.calls,['dashboard']);
});
test('back follows actual internal entries and preserves forward entries',()=>{
  const s=session();s.run("recordNavigation('dashboard',false);recordNavigation('stats',true);recordNavigation('campaign-C001',true);navigateBack()");
  assert.equal(s.index(),1);assert.deepEqual(s.calls,['back']);
  s.run("recordNavigation('stats',false)");s.go(2);s.run("recordNavigation('campaign-C001',false);navigateBack()");assert.equal(s.index(),1);
});
test('branching after Back discards the old forward route',()=>{
  const s=session();s.run("recordNavigation('dashboard',false);recordNavigation('stats',true);recordNavigation('of',true);navigateBack();recordNavigation('stats',false);recordNavigation('boosted-tweets',true);navigateBack()");
  assert.equal(s.index(),1);assert.deepEqual(s.entries.map(e=>e.hash),['#dashboard','#stats','#boosted-tweets']);
});
test('foreign history state cannot authorize browser back',()=>{
 const s=session();s.run("recordNavigation('dashboard',false);recordNavigation('of',true);history.replaceState({xtrackerNavigation:{session:'other-document',index:1}},'','#of');navigateBack()");assert.deepEqual(s.calls,['dashboard']);
});
