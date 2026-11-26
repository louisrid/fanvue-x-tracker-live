import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
const src=(file)=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const html=src('public/index.html'), css=src('public/styles.css'), app=src('public/app.js');
test('all-caps centred enlarged logo with soft blur and webfont fallback',()=>{
 // v3.1 redesign: no blurred text logo or Unbounded display font. The wordmark is the
 // supplied image, Inter is the only web font and no font files are bundled.
 assert.doesNotMatch(html,/brand-name|Unbounded/);
 // Owner (26 Nov, style 74): the logo is now the word "Fanvue" as text, not the wordmark image.
 assert.match(html,/<span class="fv-logo-text">Fanvue<\/span>/);
 assert.match(html,/family=Inter:wght@400\.\.900/);
 assert(!readdirSync(new URL('../public/',import.meta.url)).some(f=>/\.(woff2?|otf|ttf)$/i.test(f)),'No font files are bundled');
});
test('all page and interface versions match, and no font assets bundled',()=>{
 for(const term of ["const APP_VERSION='4.9.1'",'setInterval(()=>{if(!document.hidden)load();},60000)'])assert(app.includes(term));
 for(const term of ['/styles.css?v=4.9.1','/app.js?v=4.9.1'])assert(html.includes(term));
 assert(src('netlify/functions/dashboard.mjs').includes("uiVersion:'4.9.1'"));
 assert(src('public/click-preferences.html').includes('app=4.9.1'));
 assert.equal(readdirSync(new URL('../public/',import.meta.url)).filter(n=>/\.(woff2?|otf|ttf)$/i.test(n)).length,0);
 assert.equal(readdirSync(new URL('../netlify/functions/',import.meta.url)).filter(n=>n.endsWith('.mjs')).length,8);
});
