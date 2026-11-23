import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
const read=name=>readFileSync(new URL(name,import.meta.url),'utf8');
const css=read('../public/styles.css');
const latest=css.slice(css.indexOf('/* X Tracker v4.7.6: unified'));
const app=read('../public/app.js');
const html=read('../public/index.html');
const backend=read('../netlify/functions/dashboard.mjs');

test('one vivid gradient controls the live KPI, dashboard live cards and tracker live cards',()=>{
  assert.match(css,/--xtracker-live-gradient:linear-gradient\(118deg,\s*#fc2d9d 0%, #ff46a2 26%, #ff557c 48%, #ff645f 66%, #ff7850 80%, #ff952a 100%\)/);
  assert.match(latest,/\.metric-articles,\s*#page-dashboard \.week-card\.live-article,\s*#page-placements \.placement-shell\.is-live/);
  assert(latest.includes('background:var(--xtracker-live-gradient);'));
  assert(!latest.includes('--xtracker-live-summary-gradient'));
  assert(latest.includes('background:var(--xtracker-money-gradient);'));
  assert(css.includes('radial-gradient(circle'));
  assert(css.includes('-webkit-text-fill-color:#fff!important'));
});

test('Overview and all primary section titles share the same font size in each breakpoint',()=>{
  assert(latest.includes('--xtracker-section-title-size: 27px'));
  assert(latest.includes('--xtracker-section-title-size:23px'));
  for(const title of ['.page-intro h1','body.is-home .dashboard-intro h1','#page-dashboard .section-heading h2',
    '.site-page .result-line h2','#page-placements .tracker-group-heading h3'])assert(latest.includes(title),title);
  assert(latest.includes('font-size:var(--xtracker-section-title-size);'));
  for(const id of ['dashboardTitle','weeklyHeading','upcomingHeading','dashboardStatsHeading','placementsTitle','statsTitle'])assert(html.includes(`id="${id}"`),id);
});

test('overview heading and two KPI blocks are shorter but retain readable values and sparkles',()=>{
  assert(latest.includes('body.is-home .dashboard-intro {min-height:0;padding:8px 0 7px;}'));
  assert(latest.includes('min-height:102px'));
  assert(latest.includes('height:101px'));
  assert(latest.includes('font-size:44px'));
  assert(latest.includes('font-size:41px'));
  assert(latest.includes('font-size:39px'));
});

test('search placeholders, selects and filters are dark in the light theme, not grey',()=>{
  assert(latest.includes('input::placeholder'));
  assert(latest.includes('color:#111114!important;opacity:1;'));
  assert(latest.includes('home-filter-select > span'));
  assert(latest.includes('.search-control'));
  assert(latest.includes(':root:not([data-theme="dark"])'));
});

test('v4.7.8 frontend, API, opt-out and all tracking functions are preserved',()=>{
  assert(app.includes("const APP_VERSION='4.9.1'"));
  assert(backend.includes("uiVersion:'4.9.1'"));
  assert(html.includes('/app.js?v=4.9.1')&&html.includes('/styles.css?v=4.9.1'));
  assert(read('../public/click-preferences.html').includes('/?app=4.9.1#dashboard'));
  assert.deepEqual(readdirSync(new URL('../netlify/functions/',import.meta.url)).filter(x=>x.endsWith('.mjs')).sort(),[
    'admin.mjs','dashboard.mjs','events.mjs','health.mjs','metrics.mjs','redirect.mjs','refresh-x-metrics.mjs','resolve.mjs']);
  for(const u of ['/r/:code','/s/:code','/p/:code'])assert(read('../netlify.toml').includes(u));
  assert(app.includes('setInterval(()=>{if(!document.hidden)load();},60000)'));
  assert(read('../netlify/lib/click-baseline.mjs').includes('2026-10-17T00:32:36'));
});
