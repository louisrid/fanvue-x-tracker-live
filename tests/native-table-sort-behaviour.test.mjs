import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Exercise the exact sorting functions shipped in the browser, using small
// DOM-like cell fixtures. No separate 'test implementation' of the comparator.
const src=readFileSync('public/xtracker-tables.js','utf8');
const start=src.indexOf('  function nativeCellSortText(');
const end=src.indexOf('  function applyNativeSort(',start);
assert.ok(start>=0&&end>start,'Browser sorting helper is available');
const text=cell=>(cell?.textContent||'').replace(/\s+/g,' ').trim();
const unknown=/^(?:n\/?a|unknown|not recorded|not tracked|not entered|not supplied|not linked|not available|no tracking link|click feed unavailable|x reading unavailable|original url missing|original x post not supplied|no matched paid rts|needs ad spend|needs spend|pending|unavailable|—|-|)$/i;
const numeric=value=>{
 const s=String(value??'').trim();
 if(unknown.test(s))return null;
 const m=s.replace(/,/g,'').match(/^-?\$?\s*(-?\d+(?:\.\d+)?)\s*(?:%|views|clicks)?$/i);
 return m&&Number.isFinite(Number(m[1]))?Number(m[1]):null;
};
const {nativeCellSortText,compareCell}=new Function('text','numeric','unknown',
 src.slice(start,end)+'return {nativeCellSortText,compareCell};')(text,numeric,unknown);
const cell=(label,href=null)=>({
 textContent:label,
 dataset:{},
 querySelector:selector=>selector==='a[href]'&&href?{href}:null
});

test('Link-only table columns sort by the actual X post URL, not repeated labels',()=>{
 const a=cell('View source post','https://x.com/user/status/101');
 const b=cell('View source post','https://x.com/user/status/102');
 assert.equal(nativeCellSortText(a),'https://x.com/user/status/101');
 assert.ok(compareCell(a,b,1)<0);
 assert.ok(compareCell(a,b,-1)>0);
});

test('Publisher profile links sort consistently despite identical link text',()=>{
 const a=cell('Publisher profile','https://x.com/Alpha');
 const b=cell('Publisher profile','https://x.com/Zeta');
 assert.ok(compareCell(a,b,1)<0);
 assert.ok(compareCell(a,b,-1)>0);
});

test('Paid spend with a Partial tag remains numeric',()=>{
 const paid=cell('$50 Partial');
 assert.equal(nativeCellSortText(paid),'$50');
 assert.ok(compareCell(paid,cell('$200'),1)<0);
 assert.ok(compareCell(paid,cell('$200'),-1)>0);
});

test('Unavailable measurements always sort last in both directions',()=>{
 assert.ok(compareCell(cell('—'),cell('999'),1)>0);
 assert.ok(compareCell(cell('—'),cell('999'),-1)>0);
});
