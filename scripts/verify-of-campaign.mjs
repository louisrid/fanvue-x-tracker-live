// Run against a Preview first and repeat against production after publishing.
// Credentials are read from the environment and never included in output or URLs.
import assert from 'node:assert/strict';
const origin = new URL(process.argv[2] || 'https://elegant-swan-98c20a.netlify.app').origin;
const credential = process.env.ADMIN_KEY || process.env.API_TOKEN;
assert.ok(credential, 'Configure the existing administrator credential in the environment.');
const headers = { authorization: `Bearer ${credential}` };
const resultsPath = '/api/private/of-results';
async function results(test = false) {
  const response = await fetch(origin + resultsPath + (test ? '?test=1' : ''), { headers, redirect: 'manual' });
  assert.equal(response.status, 200, 'Authenticated results must be available');
  assert.match(response.headers.get('cache-control'), /no-store/);
  return response.json();
}
function accountTotal(result, account) {
  return result.rows.filter(row => row.account === account).reduce((sum, row) => sum + row.clicks, 0);
}
assert.equal((await fetch(origin + resultsPath, { redirect: 'manual' })).status, 401);
assert.equal((await fetch(origin + resultsPath, { headers: { authorization: 'Bearer invalid' }, redirect: 'manual' })).status, 401);
const genuineBefore = await results();
const testBefore = await results(true);
for (let i = 1; i <= 10; i++) {
  const account = `OF${i}`;
  const response = await fetch(`${origin}/of/${account}?test=1`, { headers, redirect: 'manual' });
  assert.equal(response.status, 302, `${account} must redirect`);
  assert.equal(response.headers.get('x-of-event-status'), 'test-recorded', `${account} must persist its test event`);
  const destination = new URL(response.headers.get('location'));
  assert.equal(destination.origin + destination.pathname, 'https://www.fanvue.com/signup');
  assert.deepEqual(Object.fromEntries(destination.searchParams), { type: 'creator', utm_source: 'x', utm_medium: 'paid_social', utm_campaign: 'of_terms_2026', utm_content: account });
}
const testAfter = await results(true);
for (let i = 1; i <= 10; i++) {
  assert.equal(accountTotal(testAfter, `OF${i}`), accountTotal(testBefore, `OF${i}`) + 1, `OF${i} must have an independent persisted increment`);
}
const genuineAfter = await results();
assert.equal(genuineAfter.total, genuineBefore.total, 'Test requests must leave genuine totals unchanged (run without concurrent campaign traffic)');
for (const path of ['/r/A01-P14', '/s/A01-P14', '/p/A01-P14']) {
  const response = await fetch(origin + path, { method: 'HEAD', headers: { cookie: 'fanvue_exclude_clicks=1' }, redirect: 'manual' });
  assert.equal(response.status, 302, 'Existing article links must redirect without recording verification clicks');
  assert.ok(response.headers.get('location'));
  assert.equal(response.headers.get('x-tracker-event-status'), 'excluded-browser', 'Article verification must use the existing click exclusion');
}
console.log(JSON.stringify({ origin, verifiedAccounts: 10, independentTestIncrements: true, genuineTotalsUnchanged: true, privateResults: true, articleRedirects: 3 }));
