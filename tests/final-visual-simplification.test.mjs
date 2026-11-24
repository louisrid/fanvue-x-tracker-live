import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync('public/index.html','utf8');
const app=readFileSync('public/app.js','utf8');
const reports=readFileSync('public/campaign-reporting.js','utf8');
const styles=readFileSync('public/refined-layout.css','utf8');
const members=readFileSync('public/discord-members.js','utf8');
const course=readFileSync('public/discord-course.js','utf8');

test('Landing page is concise while keeping six genuine campaign destinations',()=>{
  assert.doesNotMatch(html,/Choose a campaign to open its report|Articles this week/);
  assert.match(html,/All-time stats/);
  for(const route of ['gta-vi','campaign-C001','report-guru','report-article-rt','report-articles','discord']){
    assert.match(html,new RegExp('href="#'+route+'"'));
  }
  assert.equal((html.match(/class="dashboard-campaign-pill is-/g)||[]).length,6);
  assert.ok(html.indexOf('refined-layout.css')>html.indexOf('main-charts.css'));
});

test('Single shared visual override tightens desktop and mobile sizing without removing metrics',()=>{
  assert.match(styles,/Final visual pass/);
  assert.match(styles,/min-height:78px!important/);
  assert.match(styles,/min-height:73px!important/);
  assert.match(styles,/color:#233249!important/);
  assert.match(styles,/\.dashboard-campaign-pill:not\(\.is-discord\) \.dashboard-pill-meta/);
  assert.match(styles,/#page-discord \.discord-highlight-card\{/);
  assert.match(html,/id="dashboardKpis"/);
  assert.match(html,/id="gtaMetrics"/);
  assert.match(html,/id="ofMetrics"/);
});

test('Routine status chatter is hidden but unavailable-source warnings remain',()=>{
  assert.match(members,/status\.textContent=fromCache\?'Checking member count':'';/);
  assert.match(course,/info\.textContent='';/);
  assert.match(members,/refresh unavailable/);
  assert.match(course,/temporarily unavailable/);
  assert.match(reports,/state\.error\?\(state\.data\?'Saved data · refresh failed':'Data unavailable'\):''/);
  assert.match(app,/status\.textContent=ready\?\(report\.warning\?'Saved data':''\)/);
  assert.match(styles,/discord-source-status:not\(:has\(span:not\(:empty\)\)\)/);
});

test('Campaign views, paid QRT evidence, details and links are retained',()=>{
  assert.match(app,/renderGtaQuotedSources\(\)/);
  assert.match(app,/sourceLink\(qrt\.postUrl,'Open QRT'\)/);
  assert.match(app,/qrt\.trackingUrl/);
  assert.match(app,/qrt\.profileUrl/);
  assert.match(reports,/class="rpt-source-detail"/);
  assert.match(reports,/sourceStale:true/);
  assert.match(html,/id="gtaTabQrts"/);
  assert.match(html,/id="gtaTabOriginals"/);
});
