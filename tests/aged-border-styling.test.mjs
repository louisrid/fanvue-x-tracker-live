import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const css=fs.readFileSync(new URL('../public/styles.css',import.meta.url),'utf8');
const js=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
test('older published articles use thick red orange gradient frames with white centres on every page',()=>{
 assert(css.includes('--xtracker-aged-border-gradient:var(--xtracker-accent-gradient)'));
 assert(css.includes('--xtracker-aged-border-width:9px'));
 assert(css.includes('linear-gradient(#fff,#fff) padding-box,var(--xtracker-aged-border-gradient) border-box!important'));
 for(const selector of ['.week-card.live-article.is-aged','.placement-shell.is-live.is-aged','.historical-card.historical-is-live.is-aged.historical-is-paid'])assert(css.includes(selector),selector);
 assert(css.includes('--xtracker-aged-border-width:7px'));
 assert(css.includes('-webkit-mask-composite:xor'));
 assert(css.includes('mask-composite:exclude'));
});
test('sparkles have a globally shared 10 percent relative opacity reduction',()=>{
 assert(css.includes('--xtracker-sparkle-opacity:.225;'));
 assert(!css.includes('--xtracker-sparkle-opacity:.25;'));
 assert(css.includes('opacity:var(--xtracker-sparkle-opacity)'));
});
test('views and likes are more visible on desktop and mobile',()=>{
 assert(css.includes('.week-card.live-article .mini-metric strong {'));
 assert(css.includes('font-size:clamp(23px,2.45vw,31px)!important;'));
 assert(css.includes('.placement-shell.is-live .tracker-metric strong {'));
 assert(css.includes('font-size:21px!important;'));
 assert(css.includes('.mini-metric span {font-size:12px!important;'));
});
test('article status logic retains NEW before 48 hours and aged after',()=>{
 assert(js.includes('const ARTICLE_NEW_MS=48*60*60*1000'));
 assert(js.includes('now-n<ARTICLE_NEW_MS'));
 assert(js.includes("${isNew(p)?'new-article':live?'is-aged':''}"));
 assert(js.includes("${live&&isAged(p)?'is-aged':''}"));
 assert(html.includes('v=5.0.38'));
 assert(js.includes("const APP_VERSION='5.0.38'"));
});
