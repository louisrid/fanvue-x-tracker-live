import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../apps-script/Code.gs',import.meta.url),'utf8');
test('prepared Apps Script editing bridge resolves both real column layouts without writing',()=>{
 for(const louis of [true,false]){
  const headers=['ACCOUNT','LINK','IMAGE','ARTICLE LINK',...(louis?['UTM']:[]),'ARTICLE',1,'ACCOUNT SUM','METHOD','PAYMENT DETAILS','PAID?','POSTED?','LINK','UTM ID',...(!louis?['UTM LINK']:[]),'TRACKED CLICKS','LAST CLICK','LINK IN','X POST VIEWS','X POST LIKES','X UPDATED (UK)'];
  let writes=0;const sheet={getName:()=>louis?'WEEK 1 - LOUIS':'WEEK 1 - CONNOR',getRange:()=>({getDisplayValues:()=>[headers],setValues:()=>{writes++;}})};
  const context=vm.createContext({sheet});vm.runInContext(source,context);const m=vm.runInContext('sourceColumns_(sheet)',context);
  assert.equal(m.code+2,louis?15:14);assert.equal(m.cost+2,louis?7:6);assert.equal(m.paid+2,louis?12:11);assert.equal(m.posted+2,louis?13:12);assert.equal(m.views+2,19);assert.equal(m.updated+2,21);assert.equal(writes,0);
 }
});
