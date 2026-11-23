import test from 'node:test';
import assert from 'node:assert/strict';
import { createOfRedirect, authorised } from '../netlify/lib/of-campaign.mjs';
const origin = 'https://elegant-swan-98c20a.netlify.app';
const auth = { authorization: 'Bearer fixture-secret' };

test('ten account redirects have exact attribution and independent test writes', async () => {
  const events = [];
  const handler = createOfRedirect({ record: async event => events.push(event), authorise: request => authorised(request, 'fixture-secret') });
  for (let i = 1; i <= 10; i++) {
    const response = await handler(new Request(`${origin}/of/OF${i}?test=1&utm_content=wrong`, { headers: auth }));
    assert.equal(response.status, 302);
    const target = new URL(response.headers.get('location'));
    assert.equal(target.origin + target.pathname, 'https://www.fanvue.com/signup');
    assert.deepEqual(Object.fromEntries(target.searchParams), { type: 'creator', utm_source: 'x', utm_medium: 'paid_social', utm_campaign: 'of_terms_2026', utm_content: `OF${i}` });
    assert.equal(response.headers.get('x-of-event-status'), 'test-recorded');
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  }
  assert.equal(events.length, 10);
  assert.equal(new Set(events.map(event => event.account)).size, 10);
  assert.ok(events.every(event => event.isTest));
});

test('normal clicks are asynchronous; HEAD and invalid requests never record; future accounts work', async () => {
  let finish, task;
  const events = [];
  const handler = createOfRedirect({ record: event => { events.push(event); return new Promise(resolve => { finish = resolve; }); }, authorise: () => false });
  const response = await handler(new Request(origin + '/of/OF11'), { waitUntil: promise => { task = promise; } });
  assert.equal(response.status, 302);
  assert.deepEqual(events, [{ account: 'OF11', isTest: false }]);
  finish(); assert.equal(await task, true);
  assert.equal((await handler(new Request(origin + '/of/OF1', { method: 'HEAD' }))).status, 302);
  assert.equal((await handler(new Request(origin + '/of/OF1?test=1'))).status, 401);
  assert.equal((await handler(new Request(origin + '/of/OF0'))).status, 404);
  assert.equal((await handler(new Request(origin + '/of/OF1', { method: 'POST' }))).status, 405);
  assert.equal(events.length, 1);
});

test('storage failures preserve the destination and are detectable during verification', async () => {
  const handler = createOfRedirect({ record: async () => { throw Error('offline'); }, authorise: () => true });
  const response = await handler(new Request(origin + '/of/OF1?test=1'));
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('x-of-event-status'), 'storage-error');
  assert.equal(authorised(new Request(origin, { headers: auth }), ''), false);
  assert.equal(authorised(new Request(origin, { headers: auth }), 'wrong'), false);
});

test('results require authentication before querying and default to genuine clicks only', async () => {
  const { createOfResults } = await import('../netlify/lib/of-campaign.mjs');
  const loads = [];
  const handler = createOfResults({
    authorise: request => authorised(request, 'fixture-secret'),
    load: async isTest => { loads.push(isTest); return [{ account: 'OF1', date: '2026-11-05', clicks: isTest ? 1 : 5 }]; },
  });
  assert.equal((await handler(new Request(origin + '/api/private/of-results'))).status, 401);
  assert.equal(loads.length, 0);
  const normal = await handler(new Request(origin + '/api/private/of-results', { headers: auth }));
  assert.equal((await normal.json()).total, 5);
  assert.match(normal.headers.get('cache-control'), /no-store/);
  const isolated = await handler(new Request(origin + '/api/private/of-results?test=1', { headers: auth }));
  assert.equal((await isolated.json()).total, 1);
  assert.deepEqual(loads, [false, true]);
  assert.equal((await handler(new Request(origin + '/api/private/of-results', { method: 'POST', headers: auth }))).status, 405);
  assert.equal(loads.length, 2);
});
