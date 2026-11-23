import { timingSafeEqual } from 'node:crypto';

export function authorised(request, secret) {
  const match = /^Bearer (.+)$/i.exec(request.headers.get('authorization') || '');
  if (!secret || !match) return false;
  const a = Buffer.from(match[1]), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function privateHeaders() {
  return { 'Cache-Control': 'private, no-store', 'Netlify-CDN-Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };
}

export function createOfRedirect({ record, authorise }) {
  return async (request, context = {}) => {
    const url = new URL(request.url);
    const match = /^\/of\/(OF[1-9][0-9]*)\/?$/.exec(url.pathname);
    if (!match) return new Response('Not found', { status: 404, headers: privateHeaders() });
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers: { ...privateHeaders(), Allow: 'GET, HEAD' } });
    const isTest = url.searchParams.has('test');
    if (isTest && !authorise(request)) return new Response('Unauthorized', { status: 401, headers: privateHeaders() });
    const destination = new URL('https://www.fanvue.com/signup?type=creator');
    for (const [key, value] of Object.entries({ utm_source: 'x', utm_medium: 'paid_social', utm_campaign: 'of_terms_2026', utm_content: match[1] })) destination.searchParams.set(key, value);
    const headers = { ...privateHeaders(), Location: destination.href };
    const excluded=(request.headers.get('cookie')||'').split(';').some(v=>v.trim()==='fanvue_exclude_clicks=1');
    if(excluded)headers['X-OF-Event-Status']='excluded-browser';
    if (request.method === 'GET' && !excluded) {
      const write = Promise.resolve().then(() => record({ account: match[1], isTest })).then(() => true, () => {
        console.error('OF campaign click persistence failed');
        return false;
      });
      // Tests wait for durable storage so deployment verification can detect failures.
      if (isTest || !context.waitUntil) {
        headers['X-OF-Event-Status'] = await write ? (isTest ? 'test-recorded' : 'recorded') : 'storage-error';
      } else {
        context.waitUntil(write);
      }
    }
    return new Response(null, { status: 302, headers });
  };
}

export function createOfResults({ authorise, load }) {
  return async request => {
    const headers = privateHeaders();
    if (!authorise(request)) return new Response('Unauthorized', { status: 401, headers });
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: { ...headers, Allow: 'GET' } });
    const isTest = new URL(request.url).searchParams.get('test') === '1';
    try {
      const rows = await load(isTest);
      return Response.json({ campaign: 'of_terms_2026', timezone: 'UTC', test: isTest, total: rows.reduce((sum, row) => sum + row.clicks, 0), rows }, { headers });
    } catch {
      return Response.json({ error: 'Campaign results temporarily unavailable' }, { status: 503, headers });
    }
  };
}
