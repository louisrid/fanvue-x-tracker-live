import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
const src=(file)=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const html=src('public/index.html'), css=src('public/styles.css'), app=src('public/app.js');
test('all-caps centred enlarged logo with soft blur and webfont fallback',()=>{
 assert.match(html,/<span class="brand-name">X TRACKER<\/span>/);
 assert.match(html,/family=Unbounded:wght@800;900/);
 assert.match(css,/\/\* v4\.9\.0 \| Bold blurred all-caps centred X Tracker wordmark/);
 const brand=css.slice(css.indexOf('/* v4.9.0 | Bold blurred all-caps'));
 assert.match(brand,/\.app-header \.brand-name \{/);
 for(const piece of ["font-family:'Demine Blur Demo','Regarn Blur Demo','Unbounded'",'text-transform:uppercase','justify-content:center','text-align:center','text-shadow:','@media(max-width:335px)']) assert(brand.includes(piece),piece);
 assert(!/\.woff\b|\.otf\b|\.ttf\b/.test(brand),'No restricted font files are bundled');
});
test('all page and interface versions match, and no font assets bundled',()=>{
 for(const term of ["const APP_VERSION='4.9.1'",'setInterval(()=>{if(!document.hidden)load();},60000)'])assert(app.includes(term));
 for(const term of ['/styles.css?v=4.9.1','/app.js?v=4.9.1'])assert(html.includes(term));
 assert(src('netlify/functions/dashboard.mjs').includes("uiVersion:'4.9.1'"));
 assert(src('public/click-preferences.html').includes('app=4.9.1'));
 assert.equal(readdirSync(new URL('../public/',import.meta.url)).filter(n=>/\.(woff2?|otf|ttf)$/i.test(n)).length,0);
 assert.equal(readdirSync(new URL('../netlify/functions/',import.meta.url)).filter(n=>n.endsWith('.mjs')).length,8);
});
