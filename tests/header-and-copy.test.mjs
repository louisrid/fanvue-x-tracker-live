import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/styles.css',import.meta.url),'utf8');
const js=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const backend=readFileSync(new URL('../netlify/functions/dashboard.mjs',import.meta.url),'utf8');

test('X Tracker wordmark remains on all pages, bigger, bold and visually centred',()=>{
  assert(html.includes('<a class="brand" href="#dashboard"'));
  assert(html.includes('<span class="brand-name">X TRACKER</span>'));
  assert(css.includes('/* X Tracker v4.7.3 - centred wordmark and full-height segmented navigation. */'));
  const tail=css.slice(css.indexOf('/* X Tracker v4.7.3'));
  assert(tail.includes('font-size:32px'));
  assert(tail.includes('font-weight:900'));
  assert(tail.includes('align-self:center'));
  assert(css.includes('padding-top:27px'));
  assert(tail.includes('text-align:center'));
});
test('header navigation has three equally sized tabs with full-height dividers',()=>{
  const nav=html.match(/<nav class="mobile-nav".*?<\/nav>/s)?.[0]||'';
  assert.equal((nav.match(/data-page=/g)||[]).length,3);
  for(const label of ['Dashboard','Key Stats','Historical'])assert(nav.includes(label));
  assert(!nav.includes('Article Tracker'));
  const tail=css.slice(css.indexOf('/* X Tracker v4.7.3'));
  assert(css.slice(css.indexOf('/* X Tracker v4.8.1:')).includes('grid-template-columns:repeat(3,minmax(0,1fr))'));
  assert(tail.includes('.mobile-nav-item:not(:last-child)'));
  assert(tail.includes('border-right:1px solid var(--line-strong)'));
  assert(tail.includes('align-items:stretch'));
  assert(tail.includes('@media (max-width:760px)'));
});
test('all pages retain a clean spend fallback without false monthly figures or long payment disclaimers',()=>{
  assert(!html.includes('Paid articles only · latest measured totals'));
  assert(!js.includes('Payment dates incomplete'));
  assert(!js.includes('Paid total estimate · dates missing'));
  assert(!js.includes('Includes ${fmt(v.undatedPaidCount)} without payment dates'));
  assert(js.includes("v.monthSpendBasis==='paidAt'?'Spend this month'"));
  assert(js.includes("const spendLabel='Paid total'"));
  assert(js.includes('kpi-support-badge'));
});
test('frontend and backend versions match, while legacy tracker is hidden and data retained',()=>{
  for(const text of ["const APP_VERSION='4.9.1'",'homeArticleSearch','trackerSort',"setInterval(()=>{if(!document.hidden)load();},60000)"])
    assert(js.includes(text),text);
  assert(backend.includes("uiVersion:'4.9.1'"));
  assert(html.includes('/app.js?v=4.9.1')&&html.includes('/styles.css?v=4.9.1'));
  assert(html.includes('id="page-dashboard"')&&html.includes('id="page-placements"')&&html.includes('id="page-stats"'));
  assert(html.includes('id="page-placements" aria-labelledby="placementsTitle" hidden inert aria-hidden="true" data-retired="true"'));
  assert(!html.includes('data-page="placements"'));
});
