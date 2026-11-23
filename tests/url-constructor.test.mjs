import test from 'node:test';import assert from 'node:assert/strict';import {buildDestination,trackingRequest} from '../netlify/lib/shared.mjs';
test('URL construction works with a string feed URL in the environment',()=>{process.env.APP_SCRIPT_URL='https://script.google.com/macros/s/example/exec';assert.equal(new URL(buildDestination('A01-P01','FANVUE')).searchParams.get('utm_content'),'P01');});
test('Netlify v2 original request paths resolve when rewritten query parameters are absent',()=>{
 for(const path of ['/r/A01-P19','/s/A01-P19']){const x=trackingRequest('https://elegant-swan-98c20a.netlify.app'+path);assert.equal(x.code,'A01-P19');assert.equal(x.cta,'FANVUE');}
 assert.equal(trackingRequest('https://elegant-swan-98c20a.netlify.app/p/A01-P14').cta,'PRISM');
 assert.equal(trackingRequest('https://elegant-swan-98c20a.netlify.app/.netlify/functions/redirect?code=A01-P14&cta=PRISM').cta,'PRISM');
});
