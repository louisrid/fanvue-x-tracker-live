import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=x=>readFileSync(new URL('../'+x,import.meta.url),'utf8');
const css=read('public/styles.css'),html=read('public/index.html'),js=read('public/app.js');
const v485=css.slice(css.indexOf('/* X Tracker v4.8.5:'));

test('v4.8.6 retains the saturated pink forward gradient on live cards and live KPI',()=>{
  assert.match(v485,/#ff0b9e 0%/);
  assert.match(v485,/#ff3494 55%/);
  assert.match(v485,/#ff576d 89%/);
  assert.match(v485,/#ff9746 100%/);
  assert.ok(v485.indexOf('#ff3494 55%')<v485.indexOf('#ff9746 100%'));
  assert.match(css,/body\.is-home #dashboardKpis\.home-top-kpis \.metric-articles,\s*#page-dashboard \.week-card\.live-article/);
  assert.match(css,/#page-dashboard \.week-card\.live-article,/);
  assert.match(css,/background:var\(--xtracker-live-gradient\)/);
});

test('desktop live and scheduled article cards use one centred wide column',()=>{
  assert.match(v485,/@media \(min-width:761px\)/);
  assert.match(v485,/body\.is-home #weeklyGrid,\s*body\.is-home #upcomingGrid \{[\s\S]*?grid-template-columns:minmax\(0,1fr\)/);
  assert.match(v485,/width:min\(100%,960px\)/);
  assert.match(v485,/body\.is-home #weeklyGrid > \.week-card[\s\S]*?grid-column:1 \/ -1/);
  assert.match(v485,/body\.is-home #upcomingGrid > \.week-card \{[\s\S]*?grid-column:1 \/ -1/);
  assert.match(v485,/#page-historical \.historical-cards \{[\s\S]*?grid-template-columns:minmax\(0,1fr\)/);
});

test('upcoming section and home badges now read Scheduled',()=>{
  assert.match(html,/<h2 id="upcomingHeading">Scheduled<span class="heading-accent">\.<\/span><\/h2>/);
  assert.match(js,/\$\{live\?'Live':'Scheduled'\}/);
  assert.match(js,/group\('Scheduled',upcomingPaid,'upcoming'\)/);
  assert.ok(!html.includes('Paid · Upcoming'));
});

test('version and production backend contract stay in sync',()=>{
  assert.match(js,/const APP_VERSION='4\.9\.1'/);
  assert.match(html,/app\.js\?v=4\.9\.1/);
  assert.match(html,/styles\.css\?v=4\.9\.1/);
  assert.match(read('netlify/functions/dashboard.mjs'),/uiVersion:'4\.9\.1'/);
  assert.ok(read('netlify.toml').includes('/r/:code'));
  assert.ok(js.includes('setInterval(()=>{if(!document.hidden)load();},60000)'));
  assert.ok(js.includes("const spendLabel='Paid total'"));
});
