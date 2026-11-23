import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

for (const path of ['public/xtracker-tables.js', 'deployment/redesign-package/source/xtracker-tables.js']) {
  const source = readFileSync(path, 'utf8').replace("  if(document.readyState==='loading')", '  globalThis.parsePromo = parsePromo;\n  if(document.readyState===\'loading\')');
  const context = vm.createContext({
    window: {}, document: {readyState:'loading', addEventListener() {}},
    location: {href:'https://example.com'}, URL, Intl,
  });
  vm.runInContext(source, context);
  const card = {
    dataset: {detail:'GTA1-R8'}, getAttribute: () => '',
    querySelector: () => null, querySelectorAll: () => [],
  };
  const wrapper = {querySelector: () => card, querySelectorAll: () => []};
  const parse = metrics => context.parsePromo(wrapper, 'gta', 0, new Map([['GTA1-R8', {cost:115, ...metrics}]]));
  test(path + ': totals and cost count likes, reposts and replies only', () => {
    for (const views of [100, 1000000, null]) {
      const row = parse({views, likes:10, reposts:5, replies:8});
      assert.equal(row.interactions, 23);
      assert.equal(row.cpi, 5);
    }
  });
  test(path + ': missing metrics remain unknown and zero totals have no cost ratio', () => {
    for (const key of ['likes', 'reposts', 'replies']) {
      const row = parse({views:100, likes:10, reposts:5, replies:8, [key]:null});
      assert.equal(row.interactions, null);
      assert.equal(row.cpi, null);
    }
    const row = parse({views:100, likes:0, reposts:0, replies:0});
    assert.equal(row.interactions, 0);
    assert.equal(row.cpi, null);
  });
}
