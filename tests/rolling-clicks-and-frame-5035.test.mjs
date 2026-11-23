import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const js=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/styles.css',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');

test('dashboard rolling clicks uses exact 168-hour event timestamps, not Monday start',()=>{
 const start=js.indexOf('const rollingClicks=');
 const end=js.indexOf('\n};',start)+3;
 assert(start>0&&end>start);
 const script=js.slice(start,end);
 const now=Date.parse('2026-10-19T16:00:00.000Z');
 const cutoff=now-168*60*60*1000;
 const iso=t=>new Date(t).toISOString();
 const state={hourlyReady:true,hourlyEvents:[
  {timestamp:iso(cutoff-1),code:'A01-P01'},
  {timestamp:iso(cutoff),code:'A01-P01'},
  {timestamp:iso(cutoff+1),code:'A01-P01'},
  {timestamp:iso(now-1),code:'A01-P01'},
  {timestamp:iso(now),code:'A01-P01'},
  {timestamp:iso(now+1),code:'A01-P01'},
  {timestamp:iso(now-1),code:'A01-P17'}
 ]};
 const run=new Function('state','eligible',script+';return rollingClicks;')(state,()=>[{code:'A01-P01'}]);
 assert.equal(run([{code:'A01-P01'}],now),3);
 assert.equal(run([{code:'A01-P17'}],now),1);
 state.hourlyReady=false;
 assert.equal(run([{code:'A01-P01'}],now),null);
 assert.match(js,/renderKpis\(\);renderDailyOverview\(\)/);
 assert.match(html,/Week 2<span class="heading-accent">/);
 assert.match(js,/label:'UTM clicks'/);
});

test('article cards use one gradient border and keep the NEW badge legible',()=>{
 assert.match(css,/background:linear-gradient\(#fff,#fff\) padding-box,var\(--xtracker-card-border-gradient\) border-box!important/);
 assert.match(css,/border:var\(--xtracker-article-outline-width\) solid transparent!important/);
 assert.doesNotMatch(css,/outline:2px solid #fa207f!important/);
 assert.doesNotMatch(css,/outline-color:#(?:3679dd|1f62ec)!important/);
 assert.match(css,/--xtracker-article-outline:var\(--xtracker-accent-gradient\)/);
 assert.match(css,/visibility:visible!important/);
 assert.match(css,/-webkit-text-fill-color:#fff!important/);
 assert.match(html,/styles\.css\?v=5\.0\.44-unified-frames/);
 assert.match(html,/app\.js\?v=5\.0\.40-x-refresh/);
});

test('headline KPI cards have no thin border or shadow rim',()=>{
 assert.match(css,/:root body\.is-home #page-dashboard #dashboardKpis\.home-top-kpis \.kpi-card \{\s*border:0!important;\s*box-shadow:none!important;/);
});
