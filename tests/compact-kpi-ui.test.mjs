import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const js=read('../public/app.js');
const css=read('../public/styles.css');
const html=read('../public/index.html');
const dashboard=read('../netlify/functions/dashboard.mjs');

test('homepage headline cards use vivid pink and blue gradients, white figures and subtle sparkles',()=>{
  const s=css.slice(css.indexOf('/* X Tracker v4.7.4: smaller, brighter campaign KPI bar'));
  assert(s.includes('background:var(--xtracker-live-gradient)'));
  assert(s.includes('background:var(--xtracker-money-gradient)'));
  assert(s.includes('background:none!important'));
  assert(s.includes('-webkit-text-fill-color:#fff!important'));
  assert(s.includes('radial-gradient(circle'));
  assert(s.includes('height:110px'));
  assert(s.includes('height:108px'));
  assert(s.includes('font-size:clamp(48px,4vw,56px)'));
  assert(js.includes('monthPaidCount')&&js.includes('paid ${v.monthPaidCount===1?'));
});

test('wordmark has larger top than bottom padding and navigation is centred',()=>{
  // v3.1 redesign: the sidebar wordmark sits at the navigation inset with more space
  // above than below, and the mobile layout keeps navigation in a drawer.
  const fv=read('../public/fanvue.css');
  assert(fv.includes('.fv-sidebar{width:var(--fv-side-w);flex-shrink:0;background:var(--fv-sidebar);color:var(--fv-sidebar-text);padding:26px 13px 22px}'));
  assert(fv.includes('.fv-wordmark{display:block;margin:2px 11px 31px;line-height:0}'));
  assert(html.includes('id="fvMenu"'));
  assert(html.includes('alt="Fanvue"'));
});

test('mobile home filters are compact scrollable and the placement advanced filters are accessible',()=>{
  assert(html.includes('class="tracker-filter-strip"'));
  assert(html.includes('class="tracker-filter-extras"'));
  for(const id of ['homeArticleSearch','homeArticleSort','homeArticleScope','trackerSearch','trackerSort','trackerPaid','trackerAdvanced','resetTrackerFilters']) {
    assert.equal((html.match(new RegExp(`id="${id}"`,'g'))||[]).length,1,`${id} duplicated`);
  }
  assert(css.includes('#page-dashboard .home-filter-toolbar::-webkit-scrollbar'));
  assert(css.includes('#page-placements .tracker-filter-strip::-webkit-scrollbar'));
  assert(css.includes('overflow-x:auto'));
});

test('missing paidAt dates are guarded; partial dated payments avoid false monthly attribution',()=>{
  assert(js.includes("const validDate=s=>{if(s===null||s===undefined||s==='')return null;"));
  assert(js.includes('paidFallback')&&js.includes('Paid total'));
  assert(!js.includes("v.monthSpendBasis==='partEstimated'"));
});

test('existing backend function set, route aliases and UI version are preserved',()=>{
  const files=readdirSync(new URL('../netlify/functions/',import.meta.url)).filter(x=>x.endsWith('.mjs')).sort();
  assert.deepEqual(files,['admin.mjs','dashboard.mjs','events.mjs','health.mjs','metrics.mjs','redirect.mjs','refresh-x-metrics.mjs','resolve.mjs']);
  const config=read('../netlify.toml');
  assert(config.includes('from = "/r/:code"')&&config.includes('from = "/s/:code"')&&config.includes('from = "/p/:code"'));
  assert(js.includes("const APP_VERSION='4.9.1'"));
  assert(dashboard.includes("uiVersion:'4.9.1'"));
  assert(html.includes('/app.js?v=4.9.1')&&html.includes('/styles.css?v=4.9.1'));
});
