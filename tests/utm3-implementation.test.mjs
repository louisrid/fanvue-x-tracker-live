import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
const dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(dir,p),'utf8');
const html=read('public/index.html'),js=read('public/app.js'),css=read('public/styles.css');
const options=[['recent','Most Recent'],['clicks','UTM Clicks'],['views','Views'],['priceHigh','Price: High to Low'],['priceLow','Price: Low to High']];
const control=id=>{const m=html.match(new RegExp('<select id="'+id+'"[^>]*>([\\s\\S]*?)<\\/select>'));assert(m,`Missing ${id}`);return m[1];};
const controlOptions=id=>[...control(id).matchAll(/<option value="([^"]+)"[^>]*>([^<]+)<\/option>/g)].map(x=>[x[1],x[2]]);

test('original site, Sheet ID, eight backend functions and redirect routes retained',()=>{
 assert.equal(read('deployment/RELEASE_MANIFEST.json').includes('3cfe75c9-5913-46a0-953f-eeae1a288a52'),true);
 for(const f of ['admin','dashboard','events','health','metrics','redirect','refresh-x-metrics','resolve'])assert(fs.existsSync(path.join(dir,`netlify/functions/${f}.mjs`)));
 for(const prefix of ['/r/:code','/s/:code','/p/:code'])assert(read('netlify.toml').includes(prefix));
 assert(read('netlify/lib/click-baseline.mjs').includes('2026-10-17T00:32:36'));
 assert(read('netlify/lib/sheet-source.mjs').includes('CAMPAIGN'));
});
test('frontend API and package versions match',()=>{
 const version=JSON.parse(read('package.json')).version;
 assert(js.includes("const APP_VERSION='"+version+"'"));
 assert(read('netlify/functions/dashboard.mjs').includes("uiVersion:'"+version+"'"));
 assert(html.includes('/styles.css?v='+version)&&html.includes('/app.js?v='+version));
});
test('exact five sorts on each applicable page, default Most Recent',()=>{
 for(const id of ['homeArticleSort','trackerSort','accountSort','campaignSort','historicalSort']){
  assert.deepEqual(controlOptions(id),options,id);
  assert.match(control(id),/value="recent" selected/);
 }
});
test('sort controls are leftmost for Home, Accounts, Campaigns and legacy Tracker',()=>{
 for(const [start,id] of [['accounts-tools','accountSort'],['campaign-controls','campaignSort'],['tracker-filter-strip','trackerSort']]){
   const part=html.substring(html.indexOf(start),html.indexOf(start)+800);
   assert(part.indexOf(`id="${id}"`)!==-1,`${id} first control`);
 }
 // v3.1 redesign: Home's article list moved to X Articles, whose tables sort from
 // explicit header controls in the shared table component.
 const ui=read('public/fanvue-ui.js');
 assert.match(ui,/<button type="button" data-sort="'\+esc\(c\.key\)\+'"/);
});
test('unwanted home controls and legacy equivalent article/search controls removed',()=>{
 for(const id of ['homeArticleSearch','homeArticleScope','homeArticleArticle','homeArticleReset','trackerSearch','trackerArticle'])assert(!html.includes(`id="${id}"`),id);
 assert(!js.includes("el('homeArticleScope')")&&!js.includes("el('homeArticleSearch')"));
 assert(!html.includes('Recent · 7 days'));
});
test('Likes recorded cards exclusively use saturated green and white foreground',()=>{
 assert.match(css,/--xtracker-likes-gradient:linear-gradient\(120deg,#00b75d/);
 assert.match(css,/\.kpi-card\.metric-likes \*[,\s\S]*color:#fff!important/);
 assert.match(css,/\.historical-week-kpi\.historical-metric-likes/);
});
test('article ages use exact 48-hour boundary and no calendar-day rounding',()=>{
 assert.match(js,/ARTICLE_NEW_MS=48\*60\*60\*1000/);
 assert.match(js,/now-n<ARTICLE_NEW_MS/);
 assert.match(js,/function publicationInstant\(p\)/);
 assert.match(js,/BigInt\(m\[1\]\)>>22n/);
 assert.match(js,/if\(typeof raw!==\x27string\x27/);
 assert.match(js,/if\(changed\)\{renderWeekly\(\);/);
 assert.match(js,/setInterval\(\(\)=>\{if\(!document.hidden\)tickAges\(\);\},15000\)/);
});
test('article ageing never removes old live posts and keeps scheduled separate',()=>{
 assert(js.includes('const live=sortedArticles(placements.filter(isLive),sort);'));
 assert(js.includes('const upcoming=sortedArticles(placements.filter(p=>!isLive(p)),sort);'));
 assert(js.includes("'new-article':live?'is-aged':''"));
 assert.match(css,/--xtracker-aged-live-gradient/);
});
test('black headings with exactly blue heading accent styled across pages',()=>{
 for(const id of ['dashboardTitle','weeklyHeading','upcomingHeading','statsTitle','historicalTitle','campaignsTitle','accountsTitle','placementsTitle'])assert(new RegExp('id="'+id+'"[^>]*>[^<]*<span class="heading-accent">\\.<\\/span>').test(html),id);
 assert(css.includes(':root #mainContent .site-page .heading-accent'));
 assert(css.includes('color:#2469ff!important'));
 assert(js.includes('const headingHTML=value=>'));
});
test('all historic source records, payment statuses, and publisher tracking references remain external',()=>{
 assert(!js.includes('104.28.40.85'));
 assert(js.includes("const homePlacements=()=>state.placements.filter"));
 assert(read('netlify/lib/shared.mjs').includes('APP_SCRIPT_URL'));
 assert(read('netlify/functions/refresh-x-metrics.mjs').includes("0 */2 * * *"));
});
