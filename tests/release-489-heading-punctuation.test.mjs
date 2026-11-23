import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';

const read=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=read('public/index.html');
const js=read('public/app.js');
const css=read('public/styles.css');

test('Every static page/section/chart heading ends with a full stop',()=>{
  const headings=[...html.matchAll(/<h([123])\b[^>]*>([\s\S]*?)<\/h\1>/g)];
  assert(headings.length>=16);
  for(const [,level,inner] of headings){
    const text=inner.replace(/<[^>]*>/g,'').trim();
    assert(/[.!?]$/.test(text),`h${level} missing punctuation: ${text}`);
  }
});

test('Historical, campaign, weekly, and modal headings include punctuation when rendered',()=>{
  for(const token of [
    'Week summary<span class="heading-accent">.</span>',
    'Articles<span class="heading-accent">.</span>',
    'historical-week-name">${esc(label)}<span class="heading-accent">.</span>',
    'Published articles<span class="heading-accent">.</span>',
    "el('statsBreakdownHeading').textContent='Top articles.'",
    'Promotion history<span class="heading-accent">.</span>',
    'Placements<span class="heading-accent">.</span>'
  ])assert(js.includes(token),token);
  assert(js.includes('const punctuatedTitle='));
  assert(js.includes('<span class="kpi-label">${esc(punctuatedTitle)}</span>'));
});

test('White-page heading text and punctuation remain pure black, gradient cards preserve contrast',()=>{
  const custom=css.slice(css.indexOf('/* v4.8.9 |'));
  assert(custom.length>400);
  for(const token of ['.page-intro h1 .heading-accent','.chart-panel-head h2','.historical-subtitle','.historical-week-name','.stats-breakdown-heading h2','.campaign-entries-heading h3']){
    assert(custom.includes(token),token);
  }
  assert(custom.includes('color:#000!important'));
  assert(css.includes('.kpi-card:nth-child(5)'));
  assert(!custom.includes('.kpi-label'));
  assert(read('public/click-preferences.html').includes('<h1>Exclude my clicks.</h1>'));
});

test('Versions agree and all eight functions and automatic Sheet polling remain preserved',()=>{
  assert(js.includes("APP_VERSION='4.9.1'"));
  assert(read('public/index.html').includes('/app.js?v=4.9.1'));
  assert(read('netlify/functions/dashboard.mjs').includes("uiVersion:'4.9.1'"));
  assert.equal(readdirSync(new URL('../netlify/functions/',import.meta.url)).filter(x=>x.endsWith('.mjs')).length,8);
  assert(js.includes('setInterval(()=>{if(!document.hidden)load();},60000)'));
  assert(read('netlify/lib/click-baseline.mjs').includes('2026-10-17T00:32:36'));
});
