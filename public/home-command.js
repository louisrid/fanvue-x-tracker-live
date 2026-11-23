/* Home command centre: verified lifetime campaign pulse. Reads existing Netlify
   campaign reporting and the same last-good cache used by report pages. */
(()=>{
  'use strict';
  const root=document.getElementById('homeCampaignCards');
  const indicator=document.getElementById('homeCampaignStatus');
  if(!root||!indicator)return;
  const items=[
    {id:'gta-qrts',name:'GTA VI',scope:'QRTs',hash:'#gta-vi',colour:'gta'},
    {id:'of-terms',name:'OF Terms',scope:'',hash:'#campaign-C001',colour:'of'},
    {id:'guru-rts',name:'Guru X RTs',scope:'',hash:'#report-guru',colour:'guru'},
    {id:'article-rts',name:'X Article Boosts',scope:'',hash:'#report-article-rt',colour:'boosts'},
    {id:'x-articles',name:'X Articles',scope:'',hash:'#report-articles',colour:'articles'}
  ];
  const needed=new Set(items.map(x=>x.id));
  const number=new Intl.NumberFormat('en-GB',{maximumFractionDigits:0});
  const currency=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2,minimumFractionDigits:0});
  const validNumber=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>=0;
  const count=v=>validNumber(v)?number.format(Number(v)):'—';
  const money=v=>validNumber(v)?currency.format(Number(v)):'—';
  const valid=data=>data?.ok===true&&Array.isArray(data.campaigns)&&
    items.every(({id})=>data.campaigns.some(c=>c&&c.id===id&&typeof c==='object'));
  const cache=window.XTrackerLastGood;
  let last=cache?.read('campaign-overview',valid)?.payload||null;
  let checkedAt=0,inflight=null;
  const hasFeed=c=>c&&c.source!=='NOT_CONNECTED'&&c.source!=='UNAVAILABLE'&&c.unavailable!==true;
  function combine(next,previous){
    if(!valid(next)||!valid(previous))return next;
    const old=new Map(previous.campaigns.map(c=>[c.id,c]));
    let fromSaved=false;
    const campaigns=next.campaigns.map(c=>{
      const prev=old.get(c.id);
      if(prev&&hasFeed(prev)&&(!hasFeed(c)||c.sourceStale||c.dataWarning)&&
          (!Array.isArray(c.rows)||!c.rows.length)&&Array.isArray(prev.rows)&&prev.rows.length){
        fromSaved=true;
        return {...prev,sourceStale:true,dataWarning:'Using last verified metrics'};
      }
      return c;
    });
    return {...next,campaigns,fromSaved};
  }
  function render(data,saved=false){
    if(!valid(data))return;
    const campaigns=new Map(data.campaigns.map(c=>[c.id,c]));
    root.innerHTML=items.map(meta=>{
      const c=campaigns.get(meta.id);
      const connected=hasFeed(c);
      const live=connected&&validNumber(c.published)?count(c.published):'—';
      const listed=connected&&validNumber(c.placements)?Number(c.placements):0;
      const pct=listed&&validNumber(c.published)?Math.max(0,Math.min(100,Number(c.published)/listed*100)):0;
      const spend=connected?money(c.paidSpendKnown):'—';
      const views=connected?count(c.views):'—';
      return '<a href="'+meta.hash+'" class="home-campaign-card home-campaign-'+meta.colour+
        '" aria-label="Open '+meta.name+(meta.scope?' '+meta.scope:'')+'">'+
        '<span class="home-campaign-card-top"><span class="home-campaign-card-name">'+meta.name+
        (meta.scope?'<small>'+meta.scope+'</small>':'')+'</span><span class="home-campaign-go" aria-hidden="true">↗</span></span>'+
        '<span class="home-campaign-main"><strong>'+live+'</strong><span>LIVE POSTS</span></span>'+
        '<span class="home-campaign-progress" aria-hidden="true"><i style="width:'+pct.toFixed(2)+'%"></i></span>'+
        '<span class="home-campaign-bottom"><span><small>SPEND</small><strong>'+spend+'</strong></span>'+
        '<span><small>VIEWS</small><strong>'+views+'</strong></span></span></a>';
    }).join('');
    const fromSaved=saved||data.fromSaved||data.campaigns.some(c=>needed.has(c.id)&&(c.sourceStale||c.dataWarning));
    const timestamp=Date.parse(data.checkedAt||'');
    const time=Number.isFinite(timestamp)?new Intl.DateTimeFormat('en-GB',{
      timeZone:'Europe/London',hour:'2-digit',minute:'2-digit',hour12:false
    }).format(new Date(timestamp)):'';
    indicator.textContent=fromSaved?'Saved figures':time?'Updated '+time:'Connected';
    indicator.classList.toggle('is-saved',!!fromSaved);
  }
  if(last)render(last,true);
  async function refresh(force=false){
    if(inflight)return inflight;
    if(!force&&checkedAt&&Date.now()-checkedAt<60000)return true;
    inflight=(async()=>{
      try{
        const response=await fetch('/.netlify/functions/campaign-overview',{
          cache:'no-store',signal:AbortSignal.timeout(20000)
        });
        if(!response.ok)throw Error('Campaign data unavailable');
        const data=await response.json();
        if(!valid(data))throw Error('Incomplete campaign source');
        const merged=combine(data,last);
        last=merged;
        cache?.write('campaign-overview',merged,valid);
        checkedAt=Date.now();
        render(merged,false);
        return true;
      }catch{
        if(last){render(last,true);return false;}
        indicator.textContent='Unavailable';
        root.innerHTML='<p class="home-campaign-unavailable">Campaign figures unavailable</p>';
        return false;
      }
    })();
    try{return await inflight;}finally{inflight=null;}
  }
  window.XTrackerHomeOverview={refresh};
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden)void refresh();
  });
  window.addEventListener('focus',()=>{void refresh();},{passive:true});
  setInterval(()=>{if(!document.hidden)void refresh();},90000);
  void refresh();
})();
