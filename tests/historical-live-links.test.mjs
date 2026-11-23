import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const cardSource=app.slice(app.indexOf('function historicalCard('),app.indexOf('function renderHistorical('));

test('Historical published cards open their live post; scheduled cards keep details',()=>{
  const context={
    URL,esc:value=>String(value),isLive:p=>p.posted===true,
    isAged:()=>true,clicks:()=>3,weeklyClicksFor:()=>3,
    articleCardContent:()=>'<span>Article</span>'
  };
  vm.runInNewContext(`const safeUrl=s=>{try{const u=new URL(String(s));return u.protocol==='https:'?u.href:'';}catch{return '';}};${cardSource}this.card=historicalCard;`,context);
  const live=context.card({code:'A01-P01',publisher:'Published',posted:true,paid:true,postUrl:'https://x.com/example/status/123'},null,null);
  assert.match(live,/^<a href="https:\/\/x\.com\/example\/status\/123" target="_blank" rel="noopener noreferrer"/);
  assert.doesNotMatch(live,/data-detail=/);
  assert.match(live,/<\/a>$/);

  const scheduled=context.card({code:'A01-P02',publisher:'Scheduled',posted:false,paid:true},null,null);
  assert.match(scheduled,/^<button type="button" data-detail="A01-P02"/);
  assert.match(scheduled,/<\/button>$/);

  const invalid=context.card({code:'A01-P03',publisher:'No valid link',posted:true,postUrl:'javascript:alert(1)'},null,null);
  assert.match(invalid,/^<button type="button" data-detail="A01-P03"/);
});
