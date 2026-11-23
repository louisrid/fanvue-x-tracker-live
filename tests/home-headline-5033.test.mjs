import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const js=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'public/styles.css'),'utf8');
test('dashboard headline uses verified spend, clicks, live posts and measured views',()=>{
  const start=js.indexOf('function renderKpis(){');
  const block=js.slice(start,js.indexOf('function renderCampaignSelectors(){',start));
  assert.match(block,/label:'Known spend'/);
  assert.match(block,/label:'UTM clicks'/);
  assert.match(block,/label:'Live posts'/);
  assert.match(block,/label:'X views'/);
  assert.doesNotMatch(block,/label:'Total placements'/);
  assert.match(block,/homePlacements\(\)/);
  assert.match(block,/measuredViews/);
  assert.doesNotMatch(block,/badge:/);
  assert.doesNotMatch(block,/Paid total · estimate/);
});
test('all three headline numbers use scoped larger desktop and mobile font rules',()=>{
  assert.match(css,/v5\.0\.33 - Dramatic home headline numbers/);
  assert.match(css,/font-size:clamp\(80px,7\.7vw,110px\)/);
  assert.match(css,/font-size:clamp\(65px,5\.7vw,76px\)/);
  assert.match(css,/font-size:clamp\(43px,12\.3vw,60px\)/);
});
