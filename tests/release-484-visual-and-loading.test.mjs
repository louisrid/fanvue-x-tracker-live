import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../public/styles.css',import.meta.url),'utf8');
const js=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
test('more saturated live palette is shared across cards',()=>{
  assert.match(css,/--xtracker-live-gradient:linear-gradient\(118deg,/);
  assert.match(css,/#ff0b9e 0%/);
  assert.match(css,/background:var\(--xtracker-live-gradient\)/);
});
test('Views recorded uses the same exact blue as Paid total',()=>{
  assert.match(css,/#page-stats #detailedKpis \.kpi-card:nth-child\(4\) \{\s*background:var\(--xtracker-money-gradient\)/);
});
test('sparkle overlay uses same tiling/density/opacity for all coloured cards',()=>{
  assert.match(css,/--xtracker-sparkle-opacity:\.25/);
  assert.match(css,/--xtracker-sparkle-size:178px 146px/);
  const start=css.indexOf('/* All gradient cards use one shared');
  const finish=css.indexOf('/* Place interactive',start);
  const block=css.slice(start,finish);
  for(const text of ['body.is-home #dashboardKpis.home-top-kpis .kpi-card::after','#page-stats #detailedKpis .kpi-card::after','#page-dashboard .week-card.live-article::after','#page-placements .placement-shell.is-live::after'])assert.ok(block.includes(text));
  assert.match(block,/background-image:var\(--xtracker-sparkle-tile\)/);
  assert.match(block,/opacity:var\(--xtracker-sparkle-opacity\)/);
});
test('only initial loading renders spinners, then preserves unavailable dash',()=>{
  assert.match(js,/initialLoadSettled:false/);
  assert.match(js,/state.initialLoadSettled\?esc\(k.value\)/);
  assert.match(js,/state.initialLoadSettled=true;state.loadError=false;updateStatus\(data\);render\(\)/);
  assert.match(js,/catch\(e\)\{state.initialLoadSettled=true;state.loadError=true;/);
  assert.match(js,/role="status" aria-label="Loading statistic"/);
});
