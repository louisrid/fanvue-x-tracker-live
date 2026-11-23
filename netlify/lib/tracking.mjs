export const validCode = code => /^A\d{2}-P\d{2,3}$/.test(String(code||''));
export function trackingRequest(input){
  const u=new globalThis.URL(input);
  const route=u.pathname.match(/^\/(r|s|p)\/([^/]+)\/?$/i);
  const code=String(route?.[2]||u.searchParams.get('code')||'').toUpperCase();
  const cta=route?route[1].toLowerCase()==='p'?'PRISM':'FANVUE':u.searchParams.get('cta')==='PRISM'?'PRISM':'FANVUE';
  return {u,code,cta};
}
export function buildDestination(code,cta) {
  if(!validCode(code)) throw new Error('Invalid tracking ID');
  const u = new globalThis.URL(cta==='PRISM'?'https://prism-builder.com/':'https://fanvue.com/pages/affiliates');
  u.searchParams.set('utm_source','X');
  u.searchParams.set('utm_medium','ART');
  u.searchParams.set('utm_campaign',code.split('-')[0]);
  u.searchParams.set('utm_content',code.split('-')[1]);
  return u.href;
}
