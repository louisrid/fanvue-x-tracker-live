import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const js=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'public/styles.css'),'utf8');
test('dashboard headline shows Week 2 figures without Total Placements',()=>{
  const start=js.indexOf('function renderKpis(){');
  const block=js.slice(start,js.indexOf('function renderCampaignSelectors(){',start));
  assert.match(block,/label:'Paid total'/);
  assert.doesNotMatch(block,/label:'Total placements'/);
  assert.match(block,/homePlacements\(\)/);
  assert.doesNotMatch(block,/badge:/);
  assert.doesNotMatch(block,/Paid total · estimate/);
});
test('all three headline numbers use scoped larger desktop and mobile font rules',()=>{
  assert.match(css,/v5\.0\.33 - Dramatic home headline numbers/);
  assert.match(css,/font-size:clamp\(80px,7\.7vw,110px\)/);
  assert.match(css,/font-size:clamp\(65px,5\.7vw,76px\)/);
  assert.match(css,/font-size:clamp\(43px,12\.3vw,60px\)/);
});
