import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
const src=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const css=src('../public/styles.css'), app=src('../public/app.js'),html=src('../public/index.html');
const prefs=src('../public/click-preferences.html'),api=src('../netlify/functions/dashboard.mjs');
const next=css.slice(css.indexOf('/* X Tracker v4.7.8'));
test('the page and click-exclusion background is solid white, including iPhone chrome',()=>{
 // v3.1 redesign: the dashboard uses the pale blue-white workspace with white panels and a
 // black mobile top bar; the click-exclusion page keeps its solid white background.
 const fv=src('../public/fanvue.css');
 assert(fv.includes('--fv-outer:#EBF3FC;--fv-canvas:#F5F8FC;--fv-surface:#FFFFFF;'));
 assert(html.includes('name="theme-color" content="#000000"'));
 assert(prefs.includes('name="theme-color" content="#ffffff"'));
 assert(prefs.includes('background:#ffffff'));
});
test('new vibrant pink red orange gradient is the same across all live surfaces',()=>{
 assert(next.includes('#fc2d9d 0%'));
 assert(next.includes('#ff46a2 26%'));
 assert(next.includes('#ff645f 66%'));
 assert(next.includes('#ff952a 100%'));
 for(const c of ['.metric-articles,','#page-dashboard .week-card.live-article,','#page-placements .placement-shell.is-live']) assert(next.includes(c));
 assert((next.match(/background:var\(--xtracker-live-gradient\);/g)||[]).length>=1);
 assert(next.includes('text-shadow:0 1px 2px rgba(77,14,38,.46)'));
});
test('all full stop accents and primary titles are black, with more space above Overview',()=>{
 assert(next.includes('.site-page .page-intro h1 .heading-accent'));
 assert(next.includes('.site-page .section-heading h2'));
 assert(next.includes('color:#000;'));
 assert(next.includes('body.is-home .dashboard-intro {padding-top:17px;}'));
 assert(next.includes('body.is-home .dashboard-intro {padding-top:15px;}'));
});
test('only approved frontend/version edits and original tracking remain',()=>{
 assert(app.includes("const APP_VERSION='4.9.1'"));
 assert(api.includes("uiVersion:'4.9.1'"));
 assert(html.includes('/app.js?v=4.9.1')&&html.includes('/styles.css?v=4.9.1'));
 assert(prefs.includes('/?app=4.9.1#dashboard'));
 assert(app.includes('setInterval(()=>{if(!document.hidden)load();},60000)'));
 assert(src('../netlify/lib/click-baseline.mjs').includes('2026-10-17T00:32:36'));
 assert.deepEqual(readdirSync(new URL('../netlify/functions/',import.meta.url)).filter(x=>x.endsWith('.mjs')).sort(),[
  'admin.mjs','dashboard.mjs','events.mjs','health.mjs','metrics.mjs','redirect.mjs','refresh-x-metrics.mjs','resolve.mjs']);
});
