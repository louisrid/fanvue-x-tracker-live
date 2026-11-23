import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../public/styles.css',import.meta.url),'utf8');
const js=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
test('Unposted cards retain pink border and posted cards receive green border',()=>{
  assert.match(css,/--xtracker-article-outline:var\(--xtracker-accent-gradient\)/);
  for(const selector of [':root #page-dashboard :is(#weeklyGrid,#upcomingGrid) > .week-card', ':root #page-placements .placement-shell', ':root #page-historical .historical-cards > .historical-card']) assert(css.includes(selector),selector);
  assert.match(css,/background:linear-gradient\(#fff,#fff\) padding-box,var\(--xtracker-article-outline\) border-box!important/);
  assert.match(css,/--xtracker-article-outline-width:8px/);
  assert.match(css,/--xtracker-article-outline-width:7px/);
  assert.match(css,/--xtracker-posted-outline:linear-gradient\(135deg,#16d875/);
  for(const selector of ['.week-card.live-article', '.placement-shell.is-live', '.historical-card.historical-is-live']) assert(css.includes(selector),selector);
  assert.match(js,/<span class="state-pill is-live">POSTED<\/span>/);
});
test('NEW! is a tiny accent only, while data and recency logic remain intact',()=>{
  assert.match(css,/padding:3px 6px!important/);
  assert.match(css,/font:800 9px\/1\.05 Inter/);
  assert.match(css,/background:var\(--xtracker-article-outline\)!important/);
  assert.match(js,/const ARTICLE_NEW_MS=48\*60\*60\*1000/);
 assert.match(js,/APP_VERSION='5\.0\.38'/);
});
test('Prior NEW white ink overridden and contrast remains dark',()=>{
 assert.match(css,/\.week-card\.live-article\.new-article :is\(\.publisher-name/);
 assert.match(css,/color:#192238!important/);
 assert.match(css,/mask-composite:exclude/);
});

