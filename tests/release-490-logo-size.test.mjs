import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url);
const get = (file) => readFileSync(new URL(file, root), 'utf8');
const html = get('public/index.html');
const css = get('public/styles.css');

function versionOf(s) { return s.match(/(?:APP_VERSION|uiVersion)\s*[:=]\s*'([0-9.]+)'/)?.[1]; }

test('wordmark is centred and all caps without requiring a font download from user',()=>{
  // v3.1 redesign: the wordmark is the official PNG, so no display-font download is needed.
  assert.match(html,/src="\/brand\/fanvue-wordmark-white-240w\.png"/);
  assert.doesNotMatch(html,/Unbounded|brand-name/);
  assert.ok(readdirSync(new URL('public/brand/',root)).includes('fanvue-wordmark-white.png'));
});

test('all logo font sizes remain at most ten percent above the previous live size', () => {
  const rules = css.slice(css.lastIndexOf('/* v4.9.0 |'));
  const top = rules.split('@media(max-width:760px)')[0];
  const mobile = rules.split('@media(max-width:760px)')[1]?.split('@media(max-width:335px)')[0] ?? '';
  const narrow = rules.split('@media(max-width:335px)')[1]?.split('@media(prefers-reduced-transparency:reduce)')[0] ?? '';
  const size = s => Number(s.match(/font-size:([0-9]+)px/)?.[1]);
  assert.ok(size(top) > 0 && size(top) <= 32 * 1.1, 'desktop logo must grow by no more than 10%');
  assert.ok(size(mobile) > 0 && size(mobile) <= 30 * 1.1, 'mobile logo must grow by no more than 10%');
  assert.ok(size(narrow) > 0 && size(narrow) <= 29 * 1.1, 'narrow iPhone logo must grow by no more than 10%');
});

test('frontend and dashboard remain on the same Netlify UI version', () => {
  assert.match(get('public/app.js'), /const APP_VERSION='4\.9\.1'/);
  assert.equal(versionOf(get('netlify/functions/dashboard.mjs')), '4.9.1');
  assert.match(html, /\/styles\.css\?v=4\.9\.1/);
  assert.match(html, /\/app\.js\?v=4\.9\.1/);
  assert.equal(readdirSync(new URL('netlify/functions/', root)).filter(f => f.endsWith('.mjs')).length, 8);
});
