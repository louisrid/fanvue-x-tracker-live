import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/styles.css',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
test('Projected is seven times VERIFIED today clicks and withholds unavailable estimates',()=>{
 assert.match(app,/const projectedClicks=hasClicks\?fmt\(today\.clicks\*7\):'N\/A'/);
 assert.match(app,/x\.kind==='seven'\?`<div class="daily-metric-middle"/);
 assert.match(app,/Today\'s verified UTM clicks multiplied by seven/);
 assert.match(css,/daily-metric-middle/);
 assert.match(css,/daily-projection/);
});
test('All article cards have white fill and a shared vivid pink-red border with white click badge',()=>{
 assert.match(css,/--xtracker-article-outline:var\(--xtracker-accent-gradient\)/);
 assert.match(css,/\.week-card\.live-article\.new-article :is\(\.publisher-name/);
 assert.match(css,/\.primary-click \{[^}]*background:#fff!important/s);
 assert.match(css,/\.primary-click \.primary-number[\s\S]*?background:linear-gradient\(110deg,#72bfff/);
 assert.match(css,/\.week-card\.live-article\.is-aged[\s\S]*?var\(--xtracker-aged-border-gradient\)/);
});
test('Larger publisher names and Views / Likes retain mobile protections',()=>{
 assert.match(css,/\.publisher-name \{[^}]*font-size:clamp\(25px,2\.25vw,30px\)!important/);
 assert.match(css,/\.mini-metric strong \{[^}]*font-size:clamp\(29px,2\.45vw,33px\)!important/);
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/grid-template-columns:minmax\(0,1fr\) minmax\(124px,43%\)/);
 assert.match(html,/app\.js\?v=5\.0\.38/);
});
test('live article cards grow on desktop and mobile and campaign chips use the shared accent gradient',()=>{
 assert.match(css,/min-height:205px!important/);
 assert.match(css,/min-height:224px!important/);
 assert.match(css,/grid-template-columns:minmax\(0,1fr\) minmax\(124px,37%\)!important/);
 assert.match(css,/background:var\(--xtracker-accent-gradient\)!important/);
 assert.match(css,/color:#FFFFFF!important;\s*-webkit-text-fill-color:#FFFFFF!important/);
});
