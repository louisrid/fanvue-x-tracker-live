import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../public/styles.css',import.meta.url),'utf8');
const js=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
test('dashboard pink and charcoal KPI get more vertical breathing room',()=>{
 assert.match(css,/height:324px!important/);
 assert.match(css,/padding:24px 27px!important/);
 assert.match(css,/height:262px!important/);
 assert.match(css,/padding:17px 14px!important/);
 assert.match(css,/padding:14px 11px!important/);
});
test('small text uses opaque medium-bold contrast, not washed-out labels',()=>{
 assert.match(css,/font-weight:750;\s*opacity:1!important/);
 assert.match(css,/-webkit-text-fill-color:#fff!important;\s*font-weight:750!important;\s*opacity:1!important/);
 assert.match(css,/color:#26354b/);
});
test('release cache keys and server UI version match',()=>{
 assert.match(html,/styles\.css\?v=5\.0\.38/);
 assert.match(html,/app\.js\?v=5\.0\.38/);
 assert.match(js,/APP_VERSION='5\.0\.38'/);
});
