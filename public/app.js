(() => {
'use strict';
const TZ='Europe/London',el=id=>document.getElementById(id);
const APP_VERSION='5.0.40';
const fmt=n=>new Intl.NumberFormat('en-GB',{maximumFractionDigits:0}).format(Number(n));
const money=n=>n===null||n===undefined?'—':'$'+fmt(n);
const gbp=n=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
const display=n=>n===null||n===undefined||n===''?'—':fmt(n);
const fixed=(n,places=2)=>n===null||n===undefined||!Number.isFinite(Number(n))?'—':Number(n).toFixed(places);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=s=>{try{const u=new URL(String(s));return u.protocol==='https:'?u.href:'';}catch{return '';}};
const number=x=>x===null||x===undefined||x===''?null:Number.isFinite(Number(x))?Number(x):null;
const storage={get(k){try{return localStorage.getItem(k);}catch{return null;}},set(k,v){try{localStorage.setItem(k,v);}catch{}}};
// Stable report keys survive UI releases. Metric-definition changes require an explicit migration.
function validReport(data,field,flag){
  return !!data&&data[flag]===true&&Array.isArray(data[field])&&data[field].every(row=>row&&typeof row==='object'&&!Array.isArray(row))&&
    (field!=='publishers'||data.activity===undefined||Array.isArray(data.activity)&&data.activity.every(row=>row&&typeof row==='object'));
}
function readReportCache(key,field,flag){
  for(const candidate of [key,key+'-last-good']){
    try{const data=JSON.parse(storage.get(candidate));if(validReport(data,field,flag))return data;}catch{}
  }
  return null;
}
// Merge missing measurements only; live status, scope and explicit zero remain authoritative.
function retainCachedStats(data,previous){
  if(!previous)return data;
  let reused=false;
  const metricKeys=['views','likes','reposts','replies','clicks','xViews','xLikes','xShares','xComments','engagementRate','utmPerDollar'];
  const identity=row=>row.code||row.id||row.postUrl||row.trackingUrl;
  function rows(next,old){
    const lookup=new Map((old||[]).filter(r=>identity(r)).map(r=>[identity(r),r]));
    return next.map(row=>{
      const prior=lookup.get(identity(row));if(!prior)return row;
      // Never transfer post readings to a replacement post or clicks to a different link.
      const samePost=!!row.postUrl&&row.postUrl===prior.postUrl;
      const sameLink=!!row.trackingUrl&&row.trackingUrl===prior.trackingUrl&&data.shortIo?.metric===previous.shortIo?.metric;
      const result={...row};let saved=false;
      for(const key of metricKeys){
        if(key==='clicks'){if(!sameLink||((row.postUrl||prior.postUrl)&&!samePost))continue;}else if(!samePost)continue;
        if((row[key]===null||row[key]===undefined||row[key]==='')&&typeof prior[key]==='number'&&Number.isFinite(prior[key])){result[key]=prior[key];saved=true;}
      }
      if(saved){reused=true;result.statsCached=true;
        if(result.clicks>0&&result.paid&&typeof result.cost==='number')result.cpc=result.cost/result.clicks;
        for(const key of ['metricAt','xUpdated','clickAt','clickStartAt'])if(!result[key]&&prior[key])result[key]=prior[key];
      }
      return result;
    });
  }
  const result={...data};
  for(const field of ['placements','publishers','tweets'])if(Array.isArray(data[field]))result[field]=rows(data[field],previous[field]);
  // Click totals from different definitions cannot be mixed.
  if(data.shortIo?.metric&&data.shortIo.metric===previous.shortIo?.metric){
    result.shortIo={...data.shortIo};
    if(Array.isArray(data.shortIo.links)){
      result.shortIo.links=rows(data.shortIo.links,previous.shortIo.links);
      const measured=result.shortIo.links.filter(p=>(data.shortIo.metric!=='humanClicks'||p.attributed)&&typeof p.clicks==='number'&&Number.isFinite(p.clicks));
      result.shortIo.total=measured.length?measured.reduce((sum,p)=>sum+p.clicks,0):null;
      result.shortIo.verified=measured.length;
      result.shortIo.stale=!!data.shortIo.stale||result.shortIo.links.some(p=>p.statsCached);
    }
  }
  if(reused){result.cached=true;result.statsCached=true;}
  return result;
}
function saveReportCache(key,data){
  // Each write is independent: an unavailable/quota-limited browser store must not break rendering.
  const value=JSON.stringify(data);
  storage.set(key+'-last-good',value);
  storage.set(key,value);
}

const ICONS={articles:'<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 8h6m-6 4h6"/></svg>',
  placements:'<svg viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/></svg>',
  money:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.75" y="5" width="18.5" height="15" rx="2.5"/><path d="M2.75 9h18.5M15.5 13h5.75v4H15.5a2 2 0 0 1 0-4Z"/></svg>', 
  clicks:'<svg viewBox="0 0 24 24"><path d="m10 14 4-4M8 17H7a5 5 0 0 1 0-10h4m5 0h1a5 5 0 0 1 0 10h-4"/></svg>',
  views:'<svg viewBox="0 0 24 24"><path d="M2 12s3-6 10-6 10 6 10 6-3 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="3"/></svg>',
  likes:'<svg viewBox="0 0 24 24"><path d="M20 8c0 5-8 11-8 11S4 13 4 8a4.5 4.5 0 0 1 8-2 4.5 4.5 0 0 1 8 2Z"/></svg>'};
const state={placements:[],campaigns:[],history:[],activity:[],activityReady:false,trackingReady:false,
  hourlyEvents:[],hourlyReady:false,owner:'ALL',page:'dashboard',modalCode:'',accountCode:'',modalType:'',lastFocus:null,
  loading:false,initialLoadSettled:false,loadError:false,chartPeriod:30,lastLoadedAt:0,toastTimeout:0,adminKey:'',adminConfigured:false,
  selected:new Set(),pendingEditor:null,homePaidCodes:new Set(),homeVerified:false,homeChart:'clicks',dashboardWeek:'current',statsWeek:'current',historicalWeek:'current',fxRateGbp:null,fxRateDate:'',fxCheckedAt:0,fxLoading:false};
// Keep deliberate week selections across reloads; default to latest active week when current week has no rows.
const WEEK_CHOICE_KEYS={dashboardWeek:'xtracker-dashboard-week-choice-v1',historicalWeek:'xtracker-history-week-choice-v1'};
for(const [field,key] of Object.entries(WEEK_CHOICE_KEYS)){
  const choice=storage.get(key);
  if(choice==='current'||choice==='other'||(/^\d{1,3}$/.test(choice||'')&&Number(choice)>0))state[field]=choice;
}
function selectLatestNonemptyWeek(){
  const current=currentStatsWeekNumber();
  const recent=state.placements.filter(p=>isLive(p)).map(p=>weeklyTabNumber(p))
    .filter(n=>Number.isInteger(n)&&n>0&&n<=current);
  if(!recent.length)return;
  const last=Math.max(...recent);
  const hasCurrent=recent.includes(current);
  if(!hasCurrent){
    for(const field of ['dashboardWeek','historicalWeek','statsWeek']){
      if(field!=='statsWeek'&&storage.get(WEEK_CHOICE_KEYS[field])!==null)continue;
      if(state[field]==='current')state[field]=String(last);
    }
  }else{
    if(state.dashboardWeek==='current')state.statsWeek='current';
  }
}
const dparts=d=>Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
const day=d=>{if(!(d instanceof Date)||Number.isNaN(d.getTime()))return '';const p=dparts(d);return p.year+'-'+p.month+'-'+p.day;};
const shift=(str,n)=>{const [y,m,d]=str.split('-').map(Number);return new Date(Date.UTC(y,m-1,d+n)).toISOString().slice(0,10);};
const weekStart=d=>{const str=day(d),[y,m,a]=str.split('-').map(Number);return shift(str,-((new Date(Date.UTC(y,m-1,a)).getUTCDay()+6)%7));};
const monthStart=d=>day(d).slice(0,7)+'-01';
const validDate=s=>{if(s===null||s===undefined||s==='')return null;const d=new Date(s);return Number.isNaN(d.getTime())?null:d;};
const isBetween=(date,from,to)=>{const d=date?day(date):'';return !from&&!to||Boolean(d&&(!from||d>=from)&&(!to||d<=to));};
function postDate(p){
  if(p.postedAt){const d=validDate(p.postedAt);if(d)return d;}
  const m=String(p.postUrl||'').match(/\/(?:status|statuses)\/(\d{15,22})/i);
  if(!m)return null;
  try{const n=Number((BigInt(m[1])>>22n)+1288834974657n),d=new Date(n);return Number.isFinite(n)&&n>=1262304000000&&n<=Date.now()+86400000?d:null;}catch{return null;}
}
const isLive=p=>p.posted===true&&/^https:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/[^/]+\/status\/\d+/.test(String(p.postUrl||''));
const ARTICLE_NEW_MS=48*60*60*1000;
// Only a precise, trustworthy publication instant qualifies for NEW!.
// X status IDs encode an exact creation timestamp; date-only spreadsheet
// strings are not a reliable timestamp. Keep postDate for existing reports.
function publicationInstant(p){
  if(!isLive(p))return null;
  const m=String(p.postUrl||'').match(/\/(?:status|statuses)\/(\d{15,22})(?:[/?#]|$)/i);
  if(m){try{const n=Number((BigInt(m[1])>>22n)+1288834974657n);
    if(Number.isSafeInteger(n)&&n>=1262304000000&&n<=Date.now()+60000)return n;
  }catch{} }
  const raw=p.postedAt;
  if(typeof raw!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/.test(raw))return null;
  const d=validDate(raw);return d&&d.getTime()<=Date.now()+60000?d.getTime():null;
}
const isNew=(p,now=Date.now())=>{const n=publicationInstant(p);return n!==null&&now>=n&&now-n<ARTICLE_NEW_MS;};
const isAged=p=>isLive(p)&&!isNew(p);
const latestPlacementTime=p=>publicationInstant(p)??(isLive(p)?postDate(p)?.getTime()??null:validDate(p.bookedAt)?.getTime()??validDate(p.paidAt)?.getTime()??null);
const articleSortOptions=['recent','clicks','views','priceHigh','priceLow'];
function compareArticles(a,b,mode='recent'){
  const score=(p)=>mode==='recent'?latestPlacementTime(p):mode==='clicks'?clicks(p):mode==='views'?number(p.xViews):number(p.cost);
  const x=score(a),y=score(b);
  if(x===null)return y===null?String(a.code||a.publisher||'').localeCompare(String(b.code||b.publisher||'')):1;
  if(y===null)return -1;
  const direction=mode==='priceLow'?1:-1;
  return (x-y)*direction || (latestPlacementTime(b)??0)-(latestPlacementTime(a)??0) || String(a.code||a.publisher||'').localeCompare(String(b.code||b.publisher||''));
}
const sortedArticles=(rows,mode='recent')=>[...rows].sort((a,b)=>compareArticles(a,b,mode));
const pubDate=p=>{const d=postDate(p);return d?new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:TZ}).format(d):'';};
function liveAge(d){if(!d)return '';const n=Math.max(0,Math.floor((Date.now()-d.getTime())/1000));if(n<60)return 'Just live';if(n<3600)return Math.floor(n/60)+'m live';if(n<86400)return Math.floor(n/3600)+'h '+Math.floor(n%3600/60)+'m live';return Math.floor(n/86400)+'d '+Math.floor(n%86400/3600)+'h live';}
const ageMarkup=p=>{const d=postDate(p);return d?`<span data-post-age="${d.getTime()}">${liveAge(d)}</span>`:'';};
const metricTime=p=>{const d=validDate(p.xUpdated);return d?new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:TZ,timeZoneName:'short'}).format(d):'';};
const metricFullTime=p=>{const d=validDate(p.metricLastVerifiedAt||p.xUpdated);return d?new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:TZ,timeZoneName:'short'}).format(d):'';};
const metricBadge=p=>p.metricError&&p.metricLastVerifiedAt?
  `<span class="metric-last-known-note" title="X stats temporarily unavailable. Showing last recorded figures. ${esc(p.metricError)} · Last verified ${esc(metricFullTime(p))}">Saved reading</span>`:'';
const placementPublished=p=>{const d=postDate(p);return d?`Posted ${pubDate(p)}`:(isLive(p)?'Live':'');};
const eligible=()=>state.placements.filter(p=>p.active&&(state.owner==='ALL'||p.owner===state.owner));
const selected=()=>eligible().filter(p=>p.active);
// Dashboard rows follow the selected reporting week from the Sheet.
const selectedDashboardWeek=()=>selectedStatsWeek(state.dashboardWeek);
const homePlacements=()=>{
  const scope=selectedDashboardWeek();
  if(scope.isCurrent)return scope.placements;
  const map=weeklyCodeClicks(scope);
  return scope.placements.map(p=>({...p,posted:weeklyLive(p,scope),postUrl:weeklyLive(p,scope)?p.postUrl:'',
    xViews:recordedMetricFor(p,'xViews',scope),xLikes:recordedMetricFor(p,'xLikes',scope),
    clicks:weeklyClicksFor(p,map),countVerified:state.activityReady}));
};
const homeEvents=()=>{const codes=new Set(homePlacements().map(p=>p.code));const {from,to}=selectedDashboardWeek();return state.activity.filter(e=>codes.has(e.code)&&e.date>=from&&e.date<=to);};
const homeClickTotal=()=>state.activityReady?homeEvents().reduce((n,e)=>n+(number(e.clicks)||0),0):null;
const available=p=>p.countVerified===true&&number(p.clicks)!==null;
const clicks=p=>available(p)?number(p.clicks):null;
const ratio=p=>{const c=clicks(p),cost=number(p.cost);return c!==null&&cost!==null&&cost>0&&p.paid?c/cost:null;};
// Shared default across published articles, upcoming placements and modal histories.
// Unknown click counts follow verified zero-click placements; recency is the tie-breaker.
const compareUTMClicks=(a,b)=>{
  const x=clicks(a),y=clicks(b);
  if(x===null)return y===null?String(a.publisher||'').localeCompare(String(b.publisher||'')):1;
  if(y===null)return -1;
  return y-x||(postDate(b)?.getTime()||0)-(postDate(a)?.getTime()||0)||String(a.publisher||'').localeCompare(String(b.publisher||''));
};
const accountKey=p=>[String(p.platform||'X').toLowerCase(),String(p.publisher||'').toLowerCase().replace(/^@/,'')].join('::');
const accountSet=()=>new Set(eligible().map(p=>p.code));
const activity=()=>{const codes=accountSet();return state.activity.filter(e=>codes.has(e.code));};
const countActivity=(start,end,rows=activity())=>rows.reduce((a,x)=>a+(x.date>=start&&x.date<=end?Number(x.clicks)||0:0),0);
// Exact 168-hour rolling count.  Daily click aggregations cannot accurately
// identify a moving 168-hour cutoff; use individual verified event timestamps.
const rollingClicks=(records=eligible(),now=Date.now())=>{
  if(!state.hourlyReady)return null;
  const codes=new Set(records.map(p=>p.code));
  const start=now-168*60*60*1000;
  return state.hourlyEvents.reduce((total,event)=>{
    const ms=Date.parse(event.timestamp);
    return total+(codes.has(event.code)&&Number.isFinite(ms)&&ms>start&&ms<=now?1:0);
  },0);
};
const snapshots=()=>{const codes=accountSet();return state.history.filter(x=>codes.has(x.code)&&x.at);};
const metricNumber=(p,key)=>number(p?.[key]);
function currentMetrics(all=eligible()){
  const now=new Date(),today=day(now),month=monthStart(now),monthPrefix=month.slice(0,7),codes=new Set(all.map(p=>p.code)),rows=activity().filter(e=>codes.has(e.code));
  const cutoff=now.getTime()-168*60*60*1000;
  const thisWeek=all.filter(p=>{const dt=postDate(p);return isLive(p)&&dt&&dt.getTime()>cutoff&&dt.getTime()<=now.getTime();});
  const published=all.filter(p=>isLive(p));
  const views=thisWeek.filter(p=>number(p.xViews)!==null),likes=thisWeek.filter(p=>number(p.xLikes)!==null);
  const paidRows=all.filter(p=>p.paid&&number(p.cost)!==null);
  const currentPaid=paidRows.filter(p=>p.active!==false);
  const datedCurrent=[],undatedCurrent=[];
  for(const p of currentPaid){
    const paidDate=validDate(p.paidAt);
    if(!paidDate){undatedCurrent.push(p);continue;}
    if(day(paidDate).slice(0,7)===monthPrefix)datedCurrent.push(p);
  }
  // A partial set of payment dates cannot verify a monthly total.
  const spendRows=undatedCurrent.length?currentPaid:datedCurrent;
  const monthDollars=spendRows.reduce((sum,p)=>sum+(number(p.cost)||0),0);
  const monthSpendBasis=undatedCurrent.length?'paidFallback':'paidAt';
  return {articles:thisWeek.length,placements:all.length,monthDollars,monthSpendBasis,monthPaidCount:spendRows.length,undatedPaidCount:undatedCurrent.length,
    totalBooked:all.filter(p=>p.active).reduce((s,p)=>s+(number(p.cost)||0),0),
    totalPaid:paidRows.reduce((s,p)=>s+(number(p.cost)||0),0),
    weekClicks:rollingClicks(all,now.getTime()),
    monthClicks:state.activityReady?countActivity(month,today,rows):null,
    allClicks:state.trackingReady?all.reduce((s,p)=>s+(clicks(p)||0),0):null,
    views:views.length?views.reduce((s,p)=>s+Number(p.xViews),0):(thisWeek.length?null:0),
    likes:likes.length?likes.reduce((s,p)=>s+Number(p.xLikes),0):(thisWeek.length?null:0),liveCount:published.length};
}
const metricDefs=(extra,records=eligible())=>{
  const v=currentMetrics(records);return [
    {id:'articles',label:'Articles · last 7 days',value:fmt(v.articles)},
    {id:'money',label:extra?(v.monthSpendBasis==='paidAt'?'Spend this month':'Paid total'):'Paid total',value:money(extra?v.monthDollars:v.totalPaid),badge:`${fmt(extra?v.monthPaidCount:records.filter(p=>p.paid).length)} paid articles`},
    {id:'clicks',label:'UTM clicks · last 7 days',value:display(v.weekClicks),support:'This month',suppValue:display(v.monthClicks)},
    {id:'views',label:'Views · last 7 days',value:display(v.views)},
    ...(extra?[{id:'likes',label:'Likes · last 7 days',value:display(v.likes)},
      {id:'money',label:'Total $ booked',value:money(v.totalBooked)},
      {id:'clicks',label:'Total UTM clicks',value:display(v.allClicks)}]:[])
  ];
};
function kpiCard(k){
  // Only the first pending request gets a spinner. Missing/unavailable metrics
  // return to an honest dash after the request settles; never spin forever.
  const value=state.initialLoadSettled?esc(k.value):'<span class="metric-spinner" role="status" aria-label="Loading statistic"></span>';
  const title=String(k.label||'').trim();
  const punctuatedTitle=/[.!?]$/.test(title)?title:title+'.';
  return `<div class="kpi-card metric-${k.id}"><div class="kpi-top"><span class="kpi-label">${esc(punctuatedTitle)}</span><span class="kpi-icon" aria-hidden="true">${ICONS[k.id]}</span></div><div class="kpi-value">${value}</div><div class="kpi-bottom">${state.initialLoadSettled&&k.badge?`<span class="kpi-support-badge">${esc(k.badge)}</span>`:''}${k.support?`<span class="kpi-support-note">${esc(k.support)}</span>${state.initialLoadSettled&&k.suppValue?`<strong>${esc(k.suppValue)}</strong>`:''}`:''}</div></div>`;
}
// Correct the known Fanvue Partners publisher assignment without changing
// unrelated explicit campaign IDs or future campaign mappings.
const publisherCampaignOverrides=new Map([['meetyoshi','C002']]);
const publisherKey=publisher=>String(publisher||'').trim().replace(/^@+/,'').toLowerCase();
function effectiveCampaignId(p){
  return publisherCampaignOverrides.get(publisherKey(p.publisher))||String(p.campaignId||'').trim();
}
// Display the explicit campaign mapping, falling back only to the campaign
// code embedded in this placement's tracking ID when no assignment exists.
function campaignLabel(p){
  if(/^OF\d+$/.test(String(p.code||''))&&p.campaignId==='C001')return 'OF Terms X Promo';
  const id=effectiveCampaignId(p);
  if(id&&id!=='UNASSIGNED'){
    const row=state.campaigns.find(c=>String(c.id||'')===id);
    return row&&row.name?String(row.name):id==='C002'?'Fanvue Partners':id;
  }
  const utm=String(p.code||'').match(/^(A\d{2,})-P\d{2,3}$/i);
  return utm?'Campaign '+utm[1].toUpperCase():'Unassigned';
}
// Unified punctuation for dynamic labels: exactly one blue full stop.
const headingHTML=value=>esc(String(value??'').trim().replace(/[.!?]+\s*$/,'').trim())+'<span class="heading-accent">.</span>';
const campaignTag=p=>`<span class="article-campaign-chip">${esc(campaignLabel(p))}</span>`;
const articleUrl=p=>safeUrl(p.articleUrl)||safeUrl(p.postUrl);
// One presentation for Dashboard, Historical and Tracker article cards.
function articleCardContent(p,{live=isLive(p),value=clicks(p),scope=null,tracker=false,promo=false,metricsOverride=null}={}){
  const views=scope?recordedMetricFor(p,'xViews',scope):p.xViews;
  const likes=scope?recordedMetricFor(p,'xLikes',scope):p.xLikes;
  const metrics=metricsOverride||[['clicks',scope?'Week UTM clicks':'UTM Clicks',value],
    ...(live?[['views','Views',views],['likes','Likes',likes]]:[])];
  return `<span class="article-card-header"><strong class="article-publisher" title="${esc(p.publisher)}">${esc(p.publisher)}</strong><span class="article-card-tags">${live?'<span class="state-pill is-live">POSTED</span>'+(!promo&&isNew(p)?'<span class="new-badge">NEW!</span>':''):`<span class="state-pill">${p.paid?'Paid · Scheduled':'Unpaid · Planned'}</span>`}</span></span>
    <span class="article-card-meta">${campaignTag(p)}${metricBadge(p)}${p.articleLabel&&p.articleLabel!==p.code?`<span title="${esc(p.articleLabel)}">${esc(p.articleLabel)}</span>`:''}<span>${esc(p.code)}</span>${postDate(p)?`<span>${esc(pubDate(p))}</span>`:''}<span>${money(p.cost)}</span>${tracker?`<span>UTM/$ ${fixed(ratio(p))}</span>${p.platform&&p.platform!=='X'?`<span>${esc(p.platform)}</span>`:''}${p.unavailable?'<span class="state-pill is-error">Unavailable</span>':''}`:''}</span>
    <span class="article-kpis">${metrics.map(([kind,label,n])=>`<span class="article-kpi article-kpi-${kind}"><span class="article-kpi-label">${label}</span><strong class="article-kpi-value">${promo&&kind==='spend'?esc(n):display(n)}</strong></span>`).join('')}</span>`;
}
function weeklyCard(p){
  const live=isLive(p),url=live?safeUrl(p.postUrl):articleUrl(p),name=esc(p.publisher);
  const start=url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer"`:`<button type="button" data-detail="${esc(p.code)}"`;
  const end=url?'a':'button';
  return `${start} data-placement-code="${esc(p.code)}" data-post-url="${esc(safeUrl(p.postUrl))}" class="article-card week-card ${p.paid?'paid-article':'unpaid-article'} ${live?'live-article':''} ${isNew(p)?'new-article':live?'is-aged':''}" data-home-code="${esc(p.code)}" aria-label="Open ${name} ${live?'live post':'article'}">
    ${articleCardContent(p,{live})}
  </${end}>`;
}
function renderDashboardWeekSelector(){
  const select=el('dashboardWeekSelect'),scope=selectedDashboardWeek();
  const current=currentStatsWeekNumber();
  select.innerHTML=`<option value="current">This week (Week ${current})</option>`+
    Array.from({length:current-1},(_,i)=>`<option value="${current-i-1}">Week ${current-i-1}</option>`).join('');
  select.value=state.dashboardWeek==='current'?'current':String(scope.number);
  const label=d=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(d+'T12:00:00Z'));
  el('dashboardWeekRange').textContent=`${label(scope.from)} – ${label(scope.to)}`;
}
function renderWeekLabels(){
  renderDashboardWeekSelector();
  const n=selectedDashboardWeek().number;
  el('dashboardTitle').innerHTML=`Week ${n}<span class="heading-accent">.</span>`;
  document.querySelector('.daily-eyebrow').textContent=`CAMPAIGN REPORT · WEEK ${n}`;
  document.querySelector('.daily-graph-head h3').innerHTML=`Week ${n} UTM clicks<span class="heading-accent">.</span>`;
  document.querySelector('.daily-graph-head p').textContent=`Verified hourly clicks · UK time · since ${weekStart(new Date())}`;
  el('dailyTrendChart').setAttribute('aria-label',`Week ${n} placement clicks by hour`);
}
function renderWeekly(){
  const verified=state.homeVerified,placements=homePlacements(),sort=el('homeArticleSort').value;
  const live=sortedArticles(placements.filter(isLive),sort);
  const upcoming=sortedArticles(placements.filter(p=>!isLive(p)),sort);
  el('weeklyCount').textContent=verified?fmt(live.length):'—';
  el('weeklyCount').title=`Published Week ${selectedDashboardWeek().number} articles`;
  el('weeklyGrid').innerHTML=live.length?live.map(weeklyCard).join(''):`<div class="empty-state">${verified?'No live articles yet.':'Live data unavailable.'}</div>`;
  el('upcomingCount').textContent=verified?fmt(upcoming.length):'—';
  el('upcomingGrid').innerHTML=upcoming.length?upcoming.map(weeklyCard).join(''):`<div class="empty-state">${verified?'No scheduled articles.':'Live data unavailable.'}</div>`;
  el('upcomingSection').hidden=true;
}
// Daily click totals are verified event counts, never estimated from post lifetime counts.
function dailySeries(now=new Date()){
  const today=day(now),start=weekStart(now),home=homePlacements();
  const codes=new Set(home.map(p=>p.code));
  const daily=Array.from({length:7},(_,i)=>{
    const date=shift(start,i);
    const clicks=state.activityReady?state.activity.filter(e=>codes.has(e.code)&&e.date===date).reduce((sum,e)=>sum+(number(e.clicks)||0),0):null;
    return {date,clicks};
  });
  return {daily:daily.filter(x=>x.date<=today),hasClicks:state.activityReady};
}
// Article cost is recorded in USD in the source Sheet. Equivalised Spend
// measures the average GBP per day over the seven UK calendar days ending today:
// sum(price in USD for paid + published articles in that window) × USD/GBP ÷ 7.
// Payment dates are not required: the user-defined criterion is Paid status
// AND Posted status, with a verified publication date in the window.
function equivalisedSpendUsd(now=new Date()){
  const today=day(now),start=weekStart(now);
  const qualifying=homePlacements().filter(p=>{
    if(p.paid!==true||p.posted!==true||number(p.cost)===null)return false;
    const published=postDate(p);
    return published&&day(published)>=start&&day(published)<=today;
  });
  return {totalUsd:qualifying.reduce((sum,p)=>sum+number(p.cost),0),articles:qualifying.length,start,today};
}
const FX_STORAGE_KEY='xtracker-usd-gbp-fx-v1';
const FX_UPDATE_MS=24*60*60*1000;
function restoreGbpRate(){
  try{
    const cached=JSON.parse(storage.get(FX_STORAGE_KEY)||'null');
    if(cached&&Number.isFinite(cached.rate)&&cached.rate>0.4&&cached.rate<1.5&&/^\d{4}-\d{2}-\d{2}$/.test(cached.date)){
      state.fxRateGbp=cached.rate;
      state.fxRateDate=cached.date;
      state.fxCheckedAt=Number(cached.checkedAt)||0;
    }
  }catch{}
}
async function refreshGbpRate(){
  if(state.fxLoading||Date.now()-state.fxCheckedAt<FX_UPDATE_MS)return;
  state.fxLoading=true;
  state.fxCheckedAt=Date.now();
  // Both public sources provide a dated, verifiable USD -> GBP rate.
  // A backup avoids leaving the GBP KPI empty when only one FX API is down.
  const sources=[
    {url:'https://api.frankfurter.dev/v1/latest?base=USD&symbols=GBP',
     rate:d=>d?.base==='USD'?Number(d.rates?.GBP):NaN,date:d=>String(d.date||'')},
    {url:'https://open.er-api.com/v6/latest/USD',
     rate:d=>d?.result==='success'?Number(d.rates?.GBP):NaN,
     date:d=>{const v=String(d.time_last_update_utc||'');
       const t=Date.parse(v);return Number.isFinite(t)?new Date(t).toISOString().slice(0,10):''}}
  ];
  try{
    let quote=null;
    for(const source of sources){
      try{
        const options={cache:'no-store'};
        if(typeof AbortSignal!=='undefined'&&typeof AbortSignal.timeout==='function')options.signal=AbortSignal.timeout(7000);
        const res=await fetch(source.url,options);
        if(!res.ok)continue;
        const data=await res.json(),rate=source.rate(data),date=source.date(data);
        if(!Number.isFinite(rate)||rate<=0.4||rate>=1.5||!/^\d{4}-\d{2}-\d{2}$/.test(date))continue;
        quote={rate,date};break;
      }catch{ /* Move to the other live, dated exchange-rate source. */ }
    }
    if(!quote)throw new Error('No verified rate available');
    state.fxRateGbp=quote.rate;state.fxRateDate=quote.date;
    storage.set(FX_STORAGE_KEY,JSON.stringify({...quote,checkedAt:state.fxCheckedAt}));
    if(state.initialLoadSettled)renderDailyOverview();
  }catch{
    // Never mislabel USD as GBP. Retain a previously verified cached rate.
    state.fxCheckedAt=Date.now()-FX_UPDATE_MS+60*60*1000;
  }finally{state.fxLoading=false;}
}
function niceTop(value){
  if(value<=0)return 4;
  const raw=value/4,p=Math.pow(10,Math.floor(Math.log10(raw))),step=[1,2,2.5,5,10].map(n=>n*p).find(n=>n>=raw)||10*p;
  return step*4;
}
let lastDailyChartWidth=0;
function hourlyWindow(now=new Date()){
  // Use UK midnight, including summer time, and only this week’s placement IDs.
  const end=Math.floor(now.getTime()/3600000)*3600000;
  const start=Math.min(end,ukMidnight(weekStart(now)));
  const codes=new Set(homePlacements().map(p=>p.code));
  const buckets=Array.from({length:Math.floor((end-start)/3600000)+1},(_,i)=>({time:start+i*3600000,clicks:0}));
  if(!state.hourlyReady)return {buckets,ready:false};
  for(const ev of state.hourlyEvents){
    if(!codes.has(ev.code))continue;
    const t=Date.parse(ev.timestamp);
    if(!Number.isFinite(t)||t<start||t>=end+3600000)continue;
    const i=Math.floor((t-start)/3600000);
    if(i>=0&&i<buckets.length)buckets[i].clicks++;
  }
  return {buckets,ready:true};
}
function hourlyCurve(pts){
  if(pts.length<2)return '';
  // Monotone-tangent cubic Bezier avoids artificial overshoot below zero.
  const slopes=pts.slice(1).map((p,i)=>(p.y-pts[i].y)/(p.x-pts[i].x));
  const tangents=pts.map((p,i)=>i===0?slopes[0]:i===pts.length-1?slopes.at(-1):slopes[i-1]*slopes[i]<=0?0:2*slopes[i-1]*slopes[i]/(slopes[i-1]+slopes[i]));
  let path=`M${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for(let i=1;i<pts.length;i++){
    const a=pts[i-1],b=pts[i],dx=b.x-a.x;
    path+=` C${(a.x+dx/3).toFixed(2)} ${(a.y+tangents[i-1]*dx/3).toFixed(2)} ${(b.x-dx/3).toFixed(2)} ${(b.y-tangents[i]*dx/3).toFixed(2)} ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
  }
  return path;
}
function renderDailyOverview(){
  const panel=el('dailyTrendChart'),metrics=el('dailyOverviewMetrics'),note=el('dailyTrendNote'),status=el('dailyLiveStatus');
  if(!panel||!metrics||!note||!status)return;
  const {daily,hasClicks}=dailySeries(),today=daily.at(-1);
  const totalClicks=hasClicks?daily.reduce((s,d)=>s+d.clicks,0):null;
  const spend=equivalisedSpendUsd(),fx=state.fxRateGbp;
  const spendGbp=fx!==null?spend.totalUsd*fx/7:null;
  const connected=state.initialLoadSettled&&state.trackingReady&&hasClicks;
  status.classList.toggle('is-live',connected);
  el('dailyLiveLabel').textContent=connected?'LIVE DATA':'DATA UNAVAILABLE';
  const defs=[
    {kind:'click',label:'UTM clicks today',value:hasClicks?fmt(today.clicks):'—',sub:`Week ${currentStatsWeekNumber()} placements`},
    {kind:'seven',label:`Week ${currentStatsWeekNumber()} clicks`,value:hasClicks?fmt(totalClicks):'—',sub:''},
    {kind:'spend',label:'Equivalised Spend',value:state.initialLoadSettled&&(!state.loadError||state.placements.length)?(spend.totalUsd===0?gbp(0):spendGbp!==null?gbp(spendGbp):'£—'):'£—',sub:state.initialLoadSettled&&(!state.loadError||state.placements.length)?`${spend.articles} paid & published ${spend.articles===1?'article':'articles'} · 7-day daily average${fx!==null?' · FX '+state.fxRateDate:''}`:'Waiting for verified article data'}
  ];
  // Projected weekly clicks are an extrapolation, not recorded clicks.
  // Keep it visually attached to the seven-day KPI and make it strictly
  // contingent on verified daily click totals (never fabricate a value).
  const projectedClicks=hasClicks?fmt(today.clicks*7):'—';
  metrics.innerHTML=defs.map(x=>{
    const card=`<div class="daily-metric daily-metric-${x.kind}"><span class="daily-metric-label">${esc(x.label)}</span><strong>${esc(x.value)}</strong>${x.sub?`<small>${esc(x.sub)}</small>`:''}</div>`;
    return x.kind==='seven'?`<div class="daily-metric-middle" aria-label="Clicks and seven-day projection"><div class="daily-projection" title="Today's verified UTM clicks multiplied by seven"><span>Projected</span><strong>${esc(projectedClicks)}</strong></div>${card}</div>`:card;
  }).join('');
  fitDailyMetricNumbers(metrics);
  const {buckets,ready}=hourlyWindow();
  if(!ready){panel.innerHTML='<div class="daily-hourly-unavailable">Hourly click history unavailable.</div>';
    note.textContent='';
    return;
  }
  const actualWidth=panel.clientWidth||panel.getBoundingClientRect?.().width||780;
  const W=Math.max(280,Math.round(actualWidth)),mobile=W<600,H=mobile?230:285,L=mobile?35:48,R=mobile?11:18,T=17,B=mobile?44:43;
  lastDailyChartWidth=W;
  const cw=W-L-R,ch=H-T-B;
  const high=Math.max(4,niceTop(Math.max(...buckets.map(b=>b.clicks))));
  const X=i=>L+i*cw/Math.max(1,buckets.length-1),Y=v=>T+ch-(v/high)*ch;
  const pts=buckets.map((b,i)=>({x:X(i),y:Y(b.clicks)}));
  const line=hourlyCurve(pts),fill=`${line} L${X(buckets.length-1)} ${Y(0)} L${X(0)} ${Y(0)} Z`;
  const axes=[0,1,2,3,4].map(i=>{const y=T+ch*i/4;
    return `<line x1="${L}" y1="${y}" x2="${W-R}" y2="${y}" class="daily-grid-line"/><text x="${L-9}" y="${y+4}" text-anchor="end" class="daily-axis-label">${fmt(high*(4-i)/4)}</text>`;
  }).join('');
  const tzLabel=new Intl.DateTimeFormat('en-GB',{timeZone:TZ,weekday:'short'});
  const tzDate=new Intl.DateTimeFormat('en-GB',{timeZone:TZ,month:'short',day:'numeric'});
  const dayRanges=[];
  let section=null;
  buckets.forEach((b,i)=>{const date=day(new Date(b.time));if(!section||section.date!==date){section={date,from:i,to:i,time:b.time};dayRanges.push(section);}else section.to=i;});
  const todayLocal=day(new Date());
  const xlabels=dayRanges.slice(Math.max(0,dayRanges.length-7)).map(d=>{
    const x=X((d.from+d.to)/2),label=d.date===todayLocal?'Today':tzLabel.format(new Date(d.time));
    const sep=d.from>0?`<line x1="${X(d.from)}" y1="${T}" x2="${X(d.from)}" y2="${T+ch}" class="daily-day-divider"/>`:'';
    return `${sep}<text x="${x}" y="${H-17}" text-anchor="middle" class="daily-axis-label daily-x-label">${esc(label)}</text>`;
  }).join('');
  panel.innerHTML=`<svg class="daily-trend-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Verified Week ${currentStatsWeekNumber()} UTM clicks each hour, with the current hour on the far right">${axes}${xlabels}<path d="${fill}" fill="#0055ff" fill-opacity=".12"/><path d="${line}" class="daily-utm-line" stroke="#0055ff"/><circle cx="${X(buckets.length-1)}" cy="${Y(buckets.at(-1).clicks)}" r="${mobile?4.5:5.8}" class="daily-latest-dot"/></svg>`;
  const total=buckets.reduce((s,b)=>s+b.clicks,0);
  note.textContent=`${fmt(total)} verified Week ${currentStatsWeekNumber()} clicks · UK time · updated approximately every minute`;
}
function fitDailyMetricNumbers(root=el('dailyOverviewMetrics')){
  if(!root)return;
  root.querySelectorAll('.daily-metric strong,.daily-projection strong').forEach(value=>{
    value.style.fontSize='';
    let size=parseFloat(getComputedStyle(value).fontSize);
    const available=value.clientWidth;
    if(!size||!available)return;
    for(let attempt=0;attempt<4&&value.scrollWidth>available+1;attempt++){
      size=Math.max(11,size*(available/value.scrollWidth)*.94);
      value.style.fontSize=size+'px';
    }
  });
}

function renderHomeChart(){
  if(!el('homeChart')||!el('homeChartTotal'))return;
  const key=state.homeChart,rows=homePlacements().filter(isLive).map(p=>({p,value:key==='views'?number(p.xViews):clicks(p)})).filter(x=>x.value!==null).sort((a,b)=>b.value-a.value||compareUTMClicks(a.p,b.p)),max=Math.max(1,...rows.map(x=>x.value));
  el('homeChart').innerHTML=rows.length?rows.map(({p,value})=>`<button type="button" class="home-chart-row" data-detail="${esc(p.code)}" title="${esc(p.metricNote||p.publisher)}"><span>${esc(p.publisher)}</span><span class="home-chart-track"><i style="width:${value/max*100}%"></i></span><strong>${fmt(value)}</strong></button>`).join(''):'<div class="home-chart-empty">Waiting for measured results</div>';
  el('homeChartTotal').textContent=rows.length?fmt(rows.reduce((sum,x)=>sum+x.value,0))+' '+(key==='views'?'views':'clicks'):'—';
  document.querySelectorAll('[data-home-chart]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.homeChart===key)));
}
function renderKpis(){
  const placements=homePlacements(),paid=placements.filter(p=>p.paid===true);
  const totalPaid=paid.reduce((sum,p)=>sum+(number(p.cost)||0),0);
  const weekClicks=homeClickTotal();
  const headline=[
    {id:'money',label:'Paid total',value:state.homeVerified?money(totalPaid):'—'},
    {id:'clicks',label:'UTM clicks',value:weekClicks===null?'—':display(weekClicks)},
    {id:'articles',label:'Live articles',value:state.homeVerified?fmt(placements.filter(isLive).length):'—'}
  ];
  el('dashboardKpis').innerHTML=headline.map(kpiCard).join('');
  // Dashboard deliberately no longer hosts the Performance comparison or Daily Breakdown.
}
function notify(s){const t=el('toast');t.textContent=s;t.hidden=false;clearTimeout(state.toastTimeout);state.toastTimeout=setTimeout(()=>t.hidden=true,2800);}
function optionList(records,selected='ALL',allLabel='All campaigns'){
  return `<option value="ALL">${allLabel}</option>`+records.map(x=>`<option value="${esc(x.id)}" ${x.id===selected?'selected':''}>${esc(x.name)}</option>`).join('');
}
function renderCampaignSelectors(){
  for(const id of ['trackerCampaign']){const e=el(id);if(!e)continue;const old=e.value;e.innerHTML=optionList(state.campaigns,old);if([...e.options].some(o=>o.value===old))e.value=old;}
  const e=el('bulkCampaign');if(e){const old=e.value;e.innerHTML='<option value="">Assign campaign</option>'+state.campaigns.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');if([...e.options].some(o=>o.value===old))e.value=old;}
}
function filteredPlacements(){
  const q='',stage=el('trackerStatus').value,
    payment=el('trackerPaid').value,article='ALL',platform=el('trackerPlatform').value,campaign=el('trackerCampaign').value;
  const from=el('trackerFrom').value,to=el('trackerTo').value,
    minClicks=number(el('trackerMinClicks').value),minViews=number(el('trackerMinViews').value),maxCost=number(el('trackerMaxCost').value);
  const list=state.placements.filter(p=>(state.owner==='ALL'||p.owner===state.owner)).filter(p=>{
    if(q&&![p.publisher,p.code,p.articleLabel,p.owner,p.platform,p.campaignId].some(x=>String(x||'').toLocaleLowerCase('en-GB').includes(q)))return false;
    if(stage==='LIVE'&&!isLive(p))return false;
    if(stage==='PLANNED'&&isLive(p))return false;
    if(stage==='UNAVAILABLE'&&!p.unavailable)return false;
    if(payment==='PAID'&&p.paid!==true)return false;
    if(payment==='UNPAID'&&p.paid===true)return false;
    if(article!=='ALL'&&String(p.articleLabel||'')!==article)return false;
    if(platform!=='ALL'&&p.platform!==platform)return false;
    if(campaign!=='ALL'&&effectiveCampaignId(p)!==campaign)return false;
    if(minClicks!==null&&(clicks(p)===null||clicks(p)<minClicks))return false;
    if(minViews!==null&&(number(p.xViews)===null||number(p.xViews)<minViews))return false;
    if(maxCost!==null&&(number(p.cost)===null||number(p.cost)>maxCost))return false;
    if((from||to)&&!isBetween(postDate(p),from,to))return false;
    return true;
  });
  return sortedArticles(list,el('trackerSort').value);
}
function placementCard(p){
  const checked=state.selected.has(p.code),live=isLive(p);
  return `<div class="placement-shell ${live?'is-live':''} ${isNew(p)?'is-new':live?'is-aged':''} ${p.paid?'is-paid':''} ${checked?'is-marked':''}"><label class="placement-select" aria-label="Select ${esc(p.publisher)}"><input type="checkbox" data-select-placement="${esc(p.code)}" ${checked?'checked':''}></label>
    <button type="button" data-placement-code="${esc(p.code)}" data-post-url="${esc(safeUrl(p.postUrl))}" class="article-card tracker-article" data-detail="${esc(p.code)}" aria-label="View ${esc(p.publisher)} placement">${articleCardContent(p,{live,tracker:true})}</button></div>`;
}
function renderTracker(){const list=filteredPlacements(),chosen=state.placements.filter(p=>state.owner==='ALL'||p.owner===state.owner);el('resultCount').textContent=fmt(list.length);
  const paid=chosen.filter(p=>p.paid).reduce((sum,p)=>sum+(number(p.cost)||0),0);
  el('placementsOverview').innerHTML=`<span><strong>${fmt(chosen.length)}</strong> placements</span><span><strong>${display(state.trackingReady?chosen.reduce((sum,p)=>sum+(clicks(p)||0),0):null)}</strong> UTM clicks</span><span><strong>${money(paid)}</strong> paid</span>`;
  const live=list.filter(isLive),upcomingPaid=list.filter(p=>!isLive(p)&&p.paid===true),unpaid=list.filter(p=>!isLive(p)&&p.paid!==true);
  const group=(label,rows,kind)=>rows.length?`<section class="tracker-group tracker-group-${kind}" aria-label="${esc(label)}"><div class="tracker-group-heading"><h3>${esc(label)}<span class="heading-accent">.</span></h3><span class="section-count">${fmt(rows.length)}</span></div><div class="tracker-group-list">${rows.map(placementCard).join('')}</div></section>`:'';
  el('trackerFilterSummary').textContent=list.length===chosen.length?'':`${fmt(list.length)} of ${fmt(chosen.length)} placements`;
  el('trackerFilterSummary').hidden=list.length===chosen.length;
  el('trackerList').innerHTML=list.length?[
    group('Live articles',live,'live'),
    group('Scheduled',upcomingPaid,'upcoming'),
    group('Unpaid · Planned',unpaid,'unpaid')
  ].join(''):'<div class="empty-state">No matching placements.</div>';renderBulk();}
// Historical keeps complete source-week cohorts. Clicks are scoped to the
// recorded UK week; past-week X figures use snapshots at that week's cutoff.
// Never substitute present-day lifetime X counts for a completed week's data.
function historicalScope(key,entries){
  if(key==='other')return null;
  const number=Number(key),from=reportingWeekStart(number),to=shift(from,6);
  const today=day(new Date());
  return {number,from,to,today,isCurrent:number===currentStatsWeekNumber(),placements:entries};
}
function historicalCard(p,scope,weekClickMap){
  const live=isLive(p);
  const url=live?safeUrl(p.postUrl):'';
  const value=scope?weeklyClicksFor(p,weekClickMap):clicks(p);
  const paid=p.paid===true;
  const start=url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer"`:`<button type="button" data-detail="${esc(p.code)}"`;
  const end=url?'a':'button';
  return `${start} data-placement-code="${esc(p.code)}" data-post-url="${esc(safeUrl(p.postUrl))}" class="article-card historical-card ${paid?'historical-is-paid':''} ${live?'historical-is-live':''} ${live&&isAged(p)?'is-aged':''}" aria-label="${url?'Open':'View'} ${esc(p.publisher)} ${url?'live post':'article details'}">
    ${articleCardContent(p,{live,value,scope})}
  </${end}>`;
}
function renderHistorical(){
  const root=el('historicalWeeks');if(!root)return;
  const rows=state.placements.filter(p=>(state.owner==='ALL'||p.owner===state.owner)&&isLive(p));
  const groups=new Map();
  for(const p of rows){
    const week=weeklyTabNumber(p);
    const key=week?String(week):'other';
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(p);
  }
  const current=currentStatsWeekNumber();
  const lastVisible=current+1;
  const selected=state.historicalWeek==='other'?'other':state.historicalWeek==='current'||!state.historicalWeek?current:Math.max(1,Math.min(lastVisible,Number(state.historicalWeek)||current));
  const dateLabel=d=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(d+'T12:00:00Z'));
  const fullDateLabel=d=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(d+'T12:00:00Z'));
  const tabs=el('historicalWeekTabs');
  if(tabs){
    tabs.innerHTML=Array.from({length:lastVisible},(_,i)=>{
      const n=i+1,from=reportingWeekStart(n),to=shift(from,6),active=n===selected;
      return `<button type="button" class="historical-tab ${active?'is-active':''}" role="tab" id="historical-tab-${n}" aria-controls="historical-panel-${n}" aria-selected="${active}" tabindex="${active?'0':'-1'}" data-historical-week="${n}"><span class="historical-tab-top"><strong>Week ${n}</strong>${n===current?'<em class="historical-live">LIVE</em>':''}</span><small>${dateLabel(from)} – ${dateLabel(to)}</small></button>`;
    }).join('')+(groups.has('other')?`<button type="button" class="historical-tab ${selected==='other'?'is-active':''}" role="tab" id="historical-tab-other" aria-controls="historical-panel-other" aria-selected="${selected==='other'}" tabindex="${selected==='other'?'0':'-1'}" data-historical-week="other"><span class="historical-tab-top"><strong>Other</strong></span><small>Unassigned placements</small></button>`:'');
    const active=tabs.querySelector('.is-active');
    if(active&&!el('page-historical')?.hidden&&tabs.dataset.lastSelected!==String(selected)){
      active.scrollIntoView?.({block:'nearest',inline:'nearest'});
      tabs.dataset.lastSelected=String(selected);
    }
  }
  const ordered=Array.from({length:lastVisible},(_,i)=>String(i+1));
  if(groups.has('other'))ordered.push('other');
  root.innerHTML=ordered.map(key=>{
    const entries=[...(groups.get(key)||[])];
    const scope=historicalScope(key,entries),clickMap=scope?weeklyCodeClicks(scope):new Map();
    const knownClicks=p=>scope?(state.activityReady?(clickMap.get(p.code)||0):null):clicks(p);
    const sortMode=el('historicalSort')?.value||'recent';
    entries.sort((a,b)=>sortMode==='clicks'?(function(){
      const av=knownClicks(a),bv=knownClicks(b);
      if(av===null)return bv===null?compareArticles(a,b,'recent'):1;
      if(bv===null)return -1;
      return bv-av||compareArticles(a,b,'recent');
    })():compareArticles(a,b,sortMode));
    const label=scope?`Week ${key}`:'Other placements';
    const weeklyEvents=scope&&state.activityReady?(scope.number===2?scopeEvents(scope):state.activity.filter(e=>e.date>=scope.from&&e.date<=scope.to&&e.date<=scope.today)):[];
    const allClicks=scope?(state.activityReady?weeklyEvents.reduce((sum,e)=>sum+(Number(e.clicks)||0),0):null):null;
    const summaries=scope?statsWeekKpis(scope):[
      {id:'articles',label:'Placements',value:fmt(entries.length)},
      {id:'money',label:'Paid total',value:money(entries.filter(p=>p.paid).reduce((n,p)=>n+(number(p.cost)||0),0))},
      {id:'clicks',label:'UTM clicks',value:state.trackingReady?display(entries.reduce((n,p)=>n+(clicks(p)||0),0)):'—'}
    ];
    if(scope)summaries.find(k=>k.id==='clicks').value=display(allClicks);
    const weekDays=scope?Array.from({length:7},(_,i)=>{
      const date=shift(scope.from,i);
      return {date,clicks:weeklyEvents.reduce((sum,e)=>sum+(e.date===date?Number(e.clicks)||0:0),0)};
    }):[];
    const peak=Math.max(1,...weekDays.map(d=>d.clicks));
    const chart=scope?`<div class="historical-chart" aria-label="Daily verified clicks in Week ${key}"><div class="historical-chart-heading"><div><span class="historical-control-label">WEEKLY ACTIVITY</span><h3>Clicks by day<span class="heading-accent">.</span></h3></div><span>UK time · Mon–Sun</span></div><div class="historical-chart-bars">${weekDays.map(d=>`<div class="historical-chart-day" title="${esc(dateLabel(d.date))}: ${state.activityReady?fmt(d.clicks):'—'} clicks"><strong>${state.activityReady?fmt(d.clicks):'—'}</strong><span class="historical-chart-track"><i style="height:${state.activityReady&&d.clicks?Math.max(6,d.clicks/peak*100):0}%"></i></span><small>${esc(new Intl.DateTimeFormat('en-GB',{weekday:'short',timeZone:'UTC'}).format(new Date(d.date+'T12:00:00Z')))}</small></div>`).join('')}</div><p>All recorded tracked clicks during this UK calendar week, including clicks on articles from earlier weeks.</p></div>`:'';
    const active=key===String(selected);
    return `<details class="historical-week" id="historical-panel-${esc(key)}" role="tabpanel" aria-labelledby="${scope?'historical-tab-'+key:'historical-other-label'}" data-week="${esc(key)}" ${active?'open':''}>
      <summary class="historical-week-toggle"><span class="historical-week-name" id="${scope?'historical-week-'+key:'historical-other-label'}">${esc(label)}<span class="heading-accent">.</span></span><span class="historical-week-summary">${fmt(entries.length)} ${entries.length===1?'placement':'placements'}</span><svg class="historical-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 9 5 5 5-5"/></svg></summary>
      <div class="historical-week-body">
        <div class="historical-panel-heading"><div><span class="historical-control-label">${scope?'CAMPAIGN REPORT':'ARCHIVE'}</span><h2>${esc(label)}<span class="heading-accent">.</span></h2><p>${scope?`${fullDateLabel(scope.from)} – ${fullDateLabel(scope.to)} · Europe/London`:'Placements without a recorded source week'}</p></div>${scope&&scope.isCurrent?'<span class="historical-panel-live"><i></i> CURRENT WEEK</span>':''}</div>
        <h3 class="historical-subtitle">Week summary<span class="heading-accent">.</span></h3>
        <div class="historical-week-kpis" aria-label="${esc(label)} summary">${summaries.map(k=>`<div class="historical-week-kpi historical-metric-${esc(k.id)}"><span>${esc(/[.!?]$/.test(k.label)?k.label:k.label+'.')}</span><strong>${esc(k.value)}</strong></div>`).join('')}</div>
        ${chart}
        <div class="historical-placements-heading"><div><h3 class="historical-subtitle">Articles<span class="heading-accent">.</span></h3></div><span class="section-count">${fmt(entries.length)}</span></div>
        <div class="historical-cards">${entries.length?entries.map(p=>historicalCard(p,scope,clickMap)).join(''):`<div class="historical-empty"><strong>No placements recorded for ${esc(label)} yet.</strong><span>Weekly click tracking is already active. Articles appear here when the campaign feed records them.</span></div>`}</div>
      </div>
    </details>`;
  }).join('');
}

function renderBulk(){for(const code of [...state.selected])if(!state.placements.some(p=>p.code===code))state.selected.delete(code);
  const n=state.selected.size,bar=el('bulkBar');bar.hidden=n===0;el('bulkCount').textContent=n+' selected';}
function buildAccounts(){
  const records=state.placements;const grouped=new Map();
  const from=el('filterAccountFrom').value,to=el('filterAccountTo').value;
  for(const p of records){
    if((from||to)&&!isBetween(postDate(p),from,to))continue;
    const key=accountKey(p),account=grouped.get(key)||{
      key,publisher:p.publisher,platform:p.platform,owner:p.owner,profileUrl:p.profileUrl,
      items:[],clicks:0,clicksKnown:0,spent:0,views:0,viewsKnown:0,likes:0,likesKnown:0,
      comments:0,shares:0,posts:0,lastUsed:null};
    account.items.push(p);if(clicks(p)!==null){account.clicks+=clicks(p);account.clicksKnown++;}
    if(p.paid&&number(p.cost)!==null)account.spent+=Number(p.cost);
    if(isLive(p)){
      account.posts++;if(number(p.xViews)!==null){account.views+=Number(p.xViews);account.viewsKnown++;}
      if(number(p.xLikes)!==null){account.likes+=Number(p.xLikes);account.likesKnown++;}
      account.comments+=number(p.xComments)||0;account.shares+=number(p.xShares)||0;
      const posted=postDate(p);if(posted&&(!account.lastUsed||posted>account.lastUsed))account.lastUsed=posted;
    }
    grouped.set(key,account);
  }
  for(const a of grouped.values()){
    a.clicks=a.clicksKnown?a.clicks:(state.trackingReady?0:null);
    a.utmPerDollar=a.clicks!==null&&a.spent>0?a.clicks/a.spent:null;
    a.views=a.viewsKnown?a.views:(a.posts?null:0);
    a.likes=a.likesKnown?a.likes:(a.posts?null:0);
    a.engagement=a.views!==null&&a.views>0&&a.likes!==null&&a.items.filter(isLive).every(p=>number(p.xComments)!==null&&number(p.xShares)!==null)?100*(a.likes+a.comments+a.shares)/a.views:null;
  }
  return [...grouped.values()];
}
const accountScore=(a,k)=>k==='recent'?a.lastUsed?.getTime()??null:k==='clicks'?a.clicks:k==='views'?a.views:a.spent;
function filteredAccounts(){const q=el('accountSearch').value.trim().toLowerCase(),sort=el('accountSort').value;
  const fields={clicks:'filterClicks',utmPerDollar:'filterUtmDollar',spent:'filterSpent',views:'filterViews',likes:'filterLikes',engagement:'filterEngagement',posts:'filterPosts'};
  const from=el('filterLastUsed').value,to=el('filterLastUsedTo').value;
  return buildAccounts().filter(a=>{
    if(q&&!a.publisher.toLowerCase().includes(q)&&!a.items.some(p=>p.code.toLowerCase().includes(q)))return false;
    if((from||to)&&(!a.lastUsed||!isBetween(a.lastUsed,from,to)))return false;
    return Object.entries(fields).every(([key,id])=>{const v=el(id).value.trim();const n=key==='clicks'?a.clicks:key==='utmPerDollar'?a.utmPerDollar:key==='spent'?a.spent:key==='views'?a.views:key==='likes'?a.likes:key==='engagement'?a.engagement:a.posts;
      return v===''||(n!==null&&Number(n)>=Number(v));});
  }).sort((a,b)=>{const x=accountScore(a,sort),y=accountScore(b,sort);
    if(x===null)return y===null?a.publisher.localeCompare(b.publisher):1;
    if(y===null)return -1;
    return (x-y)*(sort==='priceLow'?1:-1)||(b.lastUsed?.getTime()??0)-(a.lastUsed?.getTime()??0)||a.publisher.localeCompare(b.publisher);
  });
}
function accountCell(a){return [a.publisher,display(a.clicks),fixed(a.utmPerDollar),money(a.spent),display(a.views),display(a.likes),a.engagement===null?'—':fixed(a.engagement)+'%',fmt(a.posts),a.lastUsed?pubDate({postedAt:a.lastUsed.toISOString()}):'—'];}
function renderAccounts(){const all=filteredAccounts();el('accountCount').textContent=fmt(all.length);
  el('accountTableBody').innerHTML=all.length?all.map(a=>{const v=accountCell(a);return `<tr class="account-row" data-account="${esc(a.key)}" tabindex="0" role="button" aria-label="View ${esc(a.publisher)} history">${v.map((s,i)=>`<td${i===1?' class="account-utm"':''}>${esc(s)}</td>`).join('')}</tr>`;}).join(''):'<tr><td colspan="9">No matching accounts</td></tr>';
  el('accountMobileList').innerHTML=all.map(a=>`<button type="button" class="account-mobile-card" data-account="${esc(a.key)}"><span class="account-mobile-top"><strong>${esc(a.publisher)}</strong>${a.platform&&a.platform!=='X'?`<small>${esc(a.platform)}</small>`:''}</span>
    <span class="account-mobile-metrics"><span><strong>${display(a.clicks)}</strong>UTM</span><span><strong>${fixed(a.utmPerDollar)}</strong>UTM/$</span><span><strong>${money(a.spent)}</strong>$</span></span>
    <span class="account-mobile-more"><span>${display(a.views)} views</span><span>${fmt(a.posts)} published</span><span>${a.lastUsed?esc(pubDate({postedAt:a.lastUsed.toISOString()})):'—'}</span></span></button>`).join('')||'<div class="empty-state">No matching accounts.</div>';
}
function summariseCampaign(c){const list=homePlacements().filter(p=>(effectiveCampaignId(p)||p.code.slice(0,3))===c.id);
  const paid=list.filter(p=>p.paid).reduce((n,p)=>n+(number(p.cost)||0),0),booked=list.filter(p=>p.active).reduce((n,p)=>n+(number(p.cost)||0),0);
  const views=list.filter(p=>isLive(p)&&number(p.xViews)!==null),clk=state.trackingReady?list.reduce((n,p)=>n+(clicks(p)||0),0):null;
  return {list,paid,booked,views:views.length?views.reduce((n,p)=>n+Number(p.xViews),0):(list.some(isLive)?null:0),clicks:clk,published:list.filter(isLive).length};
}
// The direct C001 page uses all of its existing placements, across reporting weeks.
function publishedCampaignGroups(){
  const byId=new Map(state.campaigns.filter(c=>c.id!=='C001'&&c.id!=='UNASSIGNED').map(c=>[c.id,{...c,rows:[],clicks:null,paid:0,views:null,recent:0}]));
  const records=state.placements;
  for(const p of records){
    const explicit=effectiveCampaignId(p);
    const utm=String(p.code||'').match(/^([A-Z]\d{2,})-P\d{2,3}$/i);
    const key=explicit&&explicit!=='UNASSIGNED'?explicit:(utm?utm[1].toUpperCase():'UNASSIGNED');
    if(key==='UNASSIGNED')continue; // No trustworthy campaign ID to group by.
    const defined=state.campaigns.find(c=>String(c.id||'')===key);
    const group=byId.get(key)||{id:key,name:defined?.name||'Campaign '+key,brief:defined?.brief||'',rows:[],clicks:null,paid:0,views:null,recent:0};
    group.rows.push(p);
    byId.set(key,group);
  }
  for(const group of byId.values()){
    group.rows.sort((a,b)=>compareArticles(a,b,el('campaignSort').value));
    group.paid=group.rows.filter(p=>p.paid).reduce((sum,p)=>sum+(number(p.cost)||0),0);
    group.clicks=state.trackingReady?group.rows.reduce((sum,p)=>sum+(clicks(p)||0),0):null;
    const views=group.rows.map(p=>number(p.xViews)).filter(n=>n!==null);
    group.views=views.length?views.reduce((sum,n)=>sum+n,0):null;
    group.published=group.rows.filter(isLive).length;
    group.recent=group.rows.reduce((max,p)=>Math.max(max,postDate(p)?.getTime()||0),0);
  }
  return [...byId.values()];
}
function renderCampaigns(){
  const root=el('campaignGrid');
  const opened=new Set([...root.querySelectorAll('details.campaign-accordion[open]')].map(x=>x.dataset.campaignKey));
  const q=el('campaignSearch').value.trim().toLowerCase(),sort=el('campaignSort').value;
  const groups=publishedCampaignGroups().filter(c=>!q||
    [c.id,c.name,...c.rows.flatMap(p=>[p.publisher,p.code,p.articleLabel])].some(x=>String(x||'').toLowerCase().includes(q)));
  const sorter=c=>sort==='recent'?c.recent:sort==='priceHigh'||sort==='priceLow'?c.paid:sort==='views'?c.views:c.clicks;
  groups.sort((a,b)=>{const x=sorter(a),y=sorter(b);
    if(x===null)return y===null?a.name.localeCompare(b.name):1;
    if(y===null)return -1;
    return (x-y)*(sort==='priceLow'?1:-1)||b.recent-a.recent||a.name.localeCompare(b.name);
  });
  if(state.campaignFocus==='C001'&&!groups.length){const c=state.campaigns.find(c=>c.id==='C001');if(c)groups.push({...c,rows:[],paid:0,clicks:state.trackingReady?0:null,views:null,published:0,recent:0});}
  const of=state.ofCampaign;
  if(of?.ready&&(!q||'of terms x promo c001'.includes(q)))groups.push({id:'C001',name:'OF Terms X Promo',rows:of.publishers,paid:of.publishers.filter(p=>p.paid).some(p=>p.cost===null)?null:of.publishers.filter(p=>p.paid).reduce((sum,p)=>sum+p.cost,0),clicks:of.publishers.reduce((sum,p)=>sum+p.clicks,0),of:true});
  const paid=groups.some(c=>c.paid===null)?null:groups.reduce((total,c)=>total+c.paid,0);
  el('campaignsOverview').innerHTML=`<span><strong>${fmt(groups.length)}</strong> ${groups.length===1?'campaign':'campaigns'}</span><span><strong>${money(paid)}</strong> paid ${state.campaignFocus?'in this campaign':'across campaigns'}</span>`;
  root.innerHTML=groups.length?groups.map(c=>c.of?`<a class="campaign-accordion campaign-summary of-campaign-summary" href="#campaign-C001"><span class="campaign-summary-heading"><small>C001 · ${fmt(c.rows.length)} publishers</small><strong class="campaign-name-heading">OF Terms X Promo<span class="heading-accent">.</span></strong></span><span class="campaign-summary-clicks"><strong>${display(c.clicks)}</strong><small>Verified clicks to date</small></span></a>`:`<details class="campaign-accordion" data-campaign-key="${esc(c.id)}" ${opened.has(c.id)||state.campaignFocus===c.id?'open':''}>
    <summary class="campaign-summary" aria-label="${esc(c.name)}, ${fmt(c.rows.length)} placements, expand for details">
      <span class="campaign-summary-heading"><small>${esc(c.id)} <span class="campaign-dot" aria-hidden="true"></span> ${fmt(c.rows.length)} placements</small><strong class="campaign-name-heading">${headingHTML(c.name)}</strong></span>
      <span class="campaign-summary-clicks"><strong>${display(c.clicks)}</strong><small>UTM clicks</small></span>
      <svg class="campaign-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 9 5 5 5-5"/></svg>
    </summary>
    <div class="campaign-expanded">
      ${c.brief&&c.brief!=='No brief yet.'?`<p>${esc(c.brief)}</p>`:''}
      <div class="campaign-summary-metrics" aria-label="${esc(c.name)} performance">
        <span><small>Posted</small><strong>${fmt(c.published)}</strong></span>
        <span><small>Paid total</small><strong>${money(c.paid)}</strong></span>
        <span><small>UTM clicks</small><strong>${display(c.clicks)}</strong></span>
        <span><small>Views recorded</small><strong>${display(c.views)}</strong></span>
      </div>
      <div class="campaign-entries-heading"><h3>Placements<span class="heading-accent">.</span></h3><span class="section-count">${fmt(c.rows.length)}</span></div>
      ${!c.rows.length?'<div class="empty-state">No articles are currently assigned to this campaign.</div>':''}
      <div class="campaign-entries">${c.rows.map(p=>`<button type="button" class="campaign-entry ${isLive(p)?'is-posted':''}" data-detail="${esc(p.code)}" aria-label="View ${esc(p.publisher)} article details">
        <span class="campaign-entry-main"><strong>${esc(p.publisher)}</strong><small>${metricBadge(p)} ${p.articleLabel&&p.articleLabel!==p.code?esc(p.articleLabel)+' · ':''}${esc(p.code)}</small><span class="state-pill ${isLive(p)?'is-live':''}">${isLive(p)?'POSTED':p.paid?'Scheduled':'Planned'}</span></span>
        <span class="campaign-entry-stats"><span><strong>${display(clicks(p))}</strong><small>UTM clicks</small></span><span><strong>${p.paid?money(p.cost):'Unpaid'}</strong><small>${p.paid?'Paid':'Planned'}</small></span></span>
        <svg class="campaign-entry-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>
      </button>`).join('')}</div>
    </div>
  </details>`).join(''):'<div class="campaign-empty">No campaigns match.</div>';
}
function newestSnapshotByDay(){
  const list=snapshots().sort((a,b)=>String(a.at).localeCompare(String(b.at))),perDay=new Map();
  for(const x of list){const d=day(validDate(x.at)),k=d+'|'+x.code;if(!d)continue;
    if(x.availability!=='unavailable')perDay.set(k,{...x,date:d,engagements:[x.likes,x.comments,x.shares].every(v=>number(v)!==null)?Number(x.likes)+Number(x.comments)+Number(x.shares):null});
  }return [...perDay.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
function metricHistorySeries(period,key){
  const rows=newestSnapshotByDay(),today=day(new Date()),start=shift(today,-period+1),byCode=new Map();
  for(const row of rows){if(row.date>today)continue;const arr=byCode.get(row.code)||[];arr.push(row);byCode.set(row.code,arr);}
  const daily=[];
  for(let n=period-1;n>=0;n--){const date=shift(today,-n);let total=0,known=0;
    for(const arr of byCode.values()){
      const vals=arr.filter(x=>x.date===date&&number(x[key])!==null);
      if(!vals.length)continue;
      const last=vals.at(-1);total+=Number(last[key]);known++;
    }
    daily.push({date,value:known?total:null});
  }
  // Values are cumulative measured post totals, not incremental daily audience numbers.
  return daily;
}
function bookedHistory(period){const today=day(new Date());const vals=[];
  const undated=eligible().some(p=>p.paid&&!p.paidAt&&!p.bookedAt);
  if(undated)return Array.from({length:period},(_,i)=>({date:shift(today,i-period+1),value:null}));
  for(let n=period-1;n>=0;n--){const d=shift(today,-n);let known=0,total=0;
    for(const p of eligible()){
      if(!p.paid||number(p.cost)===null)continue;
      const when=validDate(p.paidAt);
      if(when&&day(when)===d){total+=Number(p.cost);known++;}
    }
    vals.push({date:d,value:known?total:0});
  }
  return vals;
}
function trendCard(target,records,label){
  const n=records.length;const points=records.filter(x=>x.value!==null);if(points.length<2){el(target).innerHTML='<div class="no-history">History not yet available</div>';return;}
  const max=Math.max(1,...points.map(x=>x.value)),min=Math.min(0,...points.map(x=>x.value));
  const coords=records.map((r,i)=>r.value===null?null:[14+i*(600/(n-1)),185-(r.value-min)/Math.max(max-min,1)*153]);
  let segments=[],last=[];for(const pt of coords){if(pt)last.push(pt);else if(last.length){segments.push(last);last=[];}}if(last.length)segments.push(last);
  const paths=segments.map(seg=>`<path d="${seg.map(([x,y],i)=>(i?'L':'M')+x.toFixed(1)+' '+y.toFixed(1)).join(' ')}" fill="none" stroke="${label==='Views'?'#2b6cff':label==='Engagement'?'#9658e7':'#2cb8b0'}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
  const first=points[0],latest=points.at(-1);
  el(target).innerHTML=`<div class="trend-value">${label==='$'?'$':''}${fmt(latest.value)}</div><svg class="line-svg" viewBox="0 0 630 200" preserveAspectRatio="none" role="img" aria-label="${esc(label)} history"><path d="M14 185H614M14 95H614M14 32H614" fill="none" stroke="var(--line)" stroke-width="1"/>${paths}</svg><div class="trend-dates"><span>${esc(first.date)}</span><span>${esc(latest.date)}</span></div>`;
}
function growthChange(key,element){
  const now=new Date(),day7=shift(day(now),-7),list=metricHistorySeries(90,key);
  const a=list.find(x=>x.date===day7)?.value,b=list.at(-1)?.value;
  const node=el(element);if(!node)return;
  node.textContent=a===null||b===null||a===undefined||b===undefined?'':(b-a>=0?'+':'')+fmt(b-a)+' / 7d';
}
function renderClickChart(){const chart=el('clickChart'),n=state.chartPeriod,today=day(new Date());
  if(!state.activityReady){chart.innerHTML='<div class="no-history">Click history unavailable</div>';return;}
  const rows=activity(),first=rows.map(x=>x.date).sort()[0]||today,arr=[];for(let i=n-1;i>=0;i--){const date=shift(today,-i);arr.push({date,value:date<first?null:rows.reduce((a,x)=>a+(x.date===date?Number(x.clicks)||0:0),0)});}
  const max=Math.max(1,...arr.map(x=>x.value)),stride=n<=7?1:n<=30?5:15;
  chart.style.setProperty('--bars',n);
  chart.innerHTML=arr.map((x,i)=>{const h=x.value?Math.max(4,x.value/max*87):1;
    const lbl=i%stride===0||i===n-1?new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(x.date+'T12:00:00Z')):'';
    return `<div class="click-chart-column" title="${esc(x.date)}: ${x.value===null?'No recorded history':x.value}"><div class="click-bar ${x.value?'':'is-zero'}" style="--bar-height:${h}%;${x.value===null?'opacity:0':''}"></div><span class="click-bar-label">${esc(lbl)}</span></div>`;
  }).join('');
}
// Preserve the original historical Week 1 and Week 2 date ranges.
// Keep week numbering calendar-based so the selector rolls over even before
// a new WEEK 2 / WEEK 3 source tab has been created in Google Sheets.
const STATS_WEEK_ONE='2026-10-19';
const weeklyTabNumber=p=>{const m=String(p?.sourceTab||'').match(/^WEEK\s+([1-9]\d*)\s*(?:-|$)/i);return m?Number(m[1]):null;};
// Week 3 is explicitly anchored to 9 November; historical ranges stay intact.
function reportingWeekStart(n){return n<=2?shift(STATS_WEEK_ONE,(n-1)*7):shift('2026-11-09',(n-3)*7);}
function currentStatsWeekNumber(now=new Date()){
  const start=weekStart(now);
  if(start<'2026-11-09')return start<'2026-10-26'?1:2;
  return 3+Math.floor((Date.parse(start+'T12:00:00Z')-Date.parse('2026-11-09T12:00:00Z'))/604800000);
}
function ukMidnight(date){
  const utc=Date.parse(date+'T00:00:00Z');
  return day(new Date(utc-3600000))===date?utc-3600000:utc;
}
let rolloverTimer;
function scheduleWeekRollover(){
  clearTimeout(rolloverTimer);
  const now=new Date(),next=ukMidnight(shift(weekStart(now),7));
  rolloverTimer=setTimeout(()=>{render();scheduleWeekRollover();},Math.min(2147483647,Math.max(1,next-now)));
}
function selectedStatsWeek(selection=state.statsWeek){
  const current=currentStatsWeekNumber();
  const requested=selection==='current'?current:Math.max(1,Math.min(current,Number(selection)||current));
  const from=reportingWeekStart(requested),to=shift(from,6);
  const today=day(new Date());
  return {number:requested,from,to,today,isCurrent:requested===current,
    placements:state.placements.filter(p=>(state.owner==='ALL'||p.owner===state.owner)&&weeklyTabNumber(p)===requested&&isLive(p))};
}
const scopeEvents=s=>state.activity.filter(e=>e.date>=s.from&&e.date<=s.to&&e.date<=s.today&&s.placements.some(p=>p.code===e.code));
function weeklyCodeClicks(scope){
  const out=new Map();
  if(!state.activityReady)return out;
  for(const e of scopeEvents(scope))out.set(e.code,(out.get(e.code)||0)+(Number(e.clicks)||0));
  return out;
}
const weeklyClicksFor=(p,map)=>state.activityReady?(map.get(p.code)||0):null;
function recordedMetricFor(p,key,scope){
  // The current week can use the latest available live X metric. For a
  // previous week use only a snapshot dated on/before that week ended.
  // During a provider failure the article displays its last verified reading
  // consistently in each report; the attached note identifies the fallback.
  if(p.metricStatus==='last-known-good')return number(p[key]);
  if(scope.isCurrent)return number(p[key]);
  const snapshotKey=key==='xViews'?'views':key==='xLikes'?'likes':key;
  const rows=state.history.filter(x=>x.code===p.code&&x.availability!=='unavailable'&&validDate(x.at)&&day(validDate(x.at))<=scope.to&&number(x[snapshotKey])!==null)
    .sort((a,b)=>String(a.at).localeCompare(String(b.at)));
  return rows.length?number(rows.at(-1)[snapshotKey]):null;
}
const weeklyLive=(p,scope)=>isLive(p)&&Boolean(postDate(p)&&day(postDate(p))<=scope.to&&day(postDate(p))<=scope.today);
function statsWeekKpis(scope){
  // A failed initial request is not evidence of zero articles or zero spend.
  if(state.loadError&&!state.placements.length)return [
    {id:'articles',label:'Live articles',value:'—'},
    {id:'money',label:'Paid total',value:'—'},
    {id:'clicks',label:'UTM clicks',value:'—'},
    {id:'views',label:'Views recorded',value:'—'},
    {id:'likes',label:'Likes recorded',value:'—'}
  ];
  const rows=scope.placements,live=rows.filter(p=>weeklyLive(p,scope));
  const paid=rows.filter(p=>p.paid&&number(p.cost)!==null),map=weeklyCodeClicks(scope);
  const paidTotal=paid.reduce((n,p)=>n+number(p.cost),0);
  const totalClicks=state.activityReady?rows.reduce((n,p)=>n+(map.get(p.code)||0),0):null;
  const views=live.map(p=>recordedMetricFor(p,'xViews',scope)).filter(v=>v!==null);
  const likes=live.map(p=>recordedMetricFor(p,'xLikes',scope)).filter(v=>v!==null);
  return [
    {id:'articles',label:'Live articles',value:fmt(live.length)},
    {id:'money',label:'Paid total',value:money(paidTotal),badge:`${fmt(paid.length)} paid ${paid.length===1?'article':'articles'}`},
    {id:'clicks',label:'UTM clicks',value:display(totalClicks)},
    {id:'views',label:'Views recorded',value:views.length?fmt(views.reduce((n,v)=>n+v,0)):'—'},
    {id:'likes',label:'Likes recorded',value:likes.length?fmt(likes.reduce((n,v)=>n+v,0)):'—'}
  ];
}
function renderStatsWeekSelector(scope){
  const select=el('statsWeekSelect');if(!select)return;
  const current=currentStatsWeekNumber();
  const options=[`<option value="current">This Week (Week ${current})</option>`];
  for(let n=current-1;n>=1;n--)options.push(`<option value="${n}">Week ${n}</option>`);
  const chosen=state.statsWeek==='current'?'current':String(scope.number);
  select.innerHTML=options.join('');select.value=chosen;
  const label=d=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(d+'T12:00:00Z'));
  el('statsWeekRange').textContent=`${label(scope.from)} to ${label(scope.to)}`;
  el('statsChartRange').textContent=`Week ${scope.number} · ${label(scope.from)} to ${label(scope.to)}`;
}
function renderWeeklyBreakdown(scope){
  const list=el('statsWeeklyBreakdown');if(!list)return;
  if(!state.initialLoadSettled){list.innerHTML='<div class="stats-week-empty stats-loading-row" role="status"><span class="metric-spinner" aria-label="Loading article ranking"></span></div>';return;}
  if(state.loadError&&!state.placements.length){list.innerHTML='<div class="stats-week-empty">Statistics unavailable</div>';return;}
  const map=weeklyCodeClicks(scope);
  // Key Stats is a ranking, not a second copy of the complete placements page.
  // Complete released and paid Scheduled placement records live in Historical; unpaid drafts do not.
  const live=scope.placements.filter(p=>weeklyLive(p,scope));
  const sortMode=el('statsArticleSort').value;
  const rows=[...live].sort((a,b)=>sortMode==='clicks'?(function(){
    const av=weeklyClicksFor(a,map),bv=weeklyClicksFor(b,map);
    if(av===null)return bv===null?compareArticles(a,b,'recent'):1;
    if(bv===null)return -1;
    return bv-av||compareArticles(a,b,'recent');
  })():sortMode==='views'?(function(){
    const av=recordedMetricFor(a,'xViews',scope),bv=recordedMetricFor(b,'xViews',scope);
    if(av===null)return bv===null?compareArticles(a,b,'recent'):1;
    if(bv===null)return -1;
    return bv-av||compareArticles(a,b,'recent');
  })():compareArticles(a,b,sortMode)).slice(0,5);
  el('statsArticleCount').textContent=rows.length?`${rows.length} shown`:'';
  el('statsBreakdownHeading').innerHTML='Top articles<span class="heading-accent">.</span>'; 
  const history=el('statsViewHistory');
  history.hidden=scope.placements.length===0;
  history.textContent=`View Week ${scope.number} in Historical →`;
  list.innerHTML=rows.length?rows.map((p,i)=>{
    const clickValue=weeklyClicksFor(p,map),views=recordedMetricFor(p,'xViews',scope);
    return `<button type="button" class="stats-breakdown-row ${isLive(p)?'is-posted':''}" data-detail="${esc(p.code)}" aria-label="${esc(p.publisher)} performance for Week ${scope.number}">
      <span class="stats-breakdown-account"><strong><span class="stats-rank">${i+1}.</span> ${esc(p.publisher)}</strong><small>${campaignTag(p)} ${metricBadge(p)} <span>${esc(p.articleLabel||p.code)}</span></small><span class="state-pill is-live">POSTED</span></span>
      <span class="stats-breakdown-metric"><strong>${display(clickValue)}</strong><small>UTM clicks</small></span>
      <span class="stats-breakdown-metric"><strong>${display(views)}</strong><small>Views</small></span>
    </button>`;
  }).join(''):`<div class="stats-week-empty">${scope.placements.length?`No live articles for Week ${scope.number}.`:`No placements recorded for Week ${scope.number} yet.`}</div>`;
}
function viewStatsWeekHistory(){
  const scope=selectedStatsWeek();
  state.historicalWeek=String(scope.number);
  route('historical');
  renderHistorical();
  el('historical-panel-'+scope.number)?.scrollIntoView({block:'start',behavior:'instant'});
}
function weeklySnapshotSeries(scope,key){
  const codes=new Set(scope.placements.map(p=>p.code));
  return Array.from({length:7},(_,i)=>{
    const d=shift(scope.from,i),dayRows=state.history.filter(x=>d<=scope.today&&codes.has(x.code)&&x.availability!=='unavailable'&&validDate(x.at)&&day(validDate(x.at))===d);
    const byCode=new Map();
    const getValue=r=>key==='engagements'?[r.likes,r.comments,r.shares].every(x=>number(x)!==null)?Number(r.likes)+Number(r.comments)+Number(r.shares):null:number(r[key]);
    for(const r of dayRows){if(getValue(r)===null)continue;const prev=byCode.get(r.code);if(!prev||String(prev.at)<String(r.at))byCode.set(r.code,r);}
    return {date:d,value:byCode.size?[...byCode.values()].reduce((sum,r)=>sum+getValue(r),0):null};
  });
}
function weeklyPaidSeries(scope){
  // Undated paid placements appear in the paid-total KPI, but must not be
  // assigned arbitrarily to a particular day in the spend chart.
  const dated=scope.placements.filter(p=>p.paid&&number(p.cost)!==null&&validDate(p.paidAt));
  return Array.from({length:7},(_,i)=>{const d=shift(scope.from,i);
    return {date:d,value:dated.length&&d<=scope.today?dated.reduce((sum,p)=>sum+(day(validDate(p.paidAt))===d?number(p.cost):0),0):null};
  });
}
function weeklyGrowthLabel(series,id){
  const a=series.filter(x=>x.value!==null),node=el(id);
  node.textContent=a.length<2?'':`${a.at(-1).value-a[0].value>=0?'+':''}${fmt(a.at(-1).value-a[0].value)} / week`;
}
function renderClickChart(scope){
  const chart=el('clickChart');
  if(!state.initialLoadSettled){chart.innerHTML='<div class="no-history chart-loading" role="status"><span class="metric-spinner" aria-label="Loading click history"></span></div>';return;}
  if(state.loadError&&!state.placements.length){chart.innerHTML='<div class="no-history">Click data unavailable</div>';return;}
  if(!scope.placements.length){chart.innerHTML=`<div class="no-history">No Week ${scope.number} articles yet</div>`;return;}
  if(!state.activityReady){chart.innerHTML='<div class="no-history">Click history unavailable</div>';return;}
  const rows=scopeEvents(scope),first=state.activity.map(x=>x.date).sort()[0]||scope.today;
  const arr=Array.from({length:7},(_,i)=>{const date=shift(scope.from,i);
    return {date,value:date>scope.today||date<first?null:rows.reduce((sum,x)=>sum+(x.date===date?Number(x.clicks)||0:0),0)};
  });
  const max=Math.max(1,...arr.filter(x=>x.value!==null).map(x=>x.value));chart.style.setProperty('--bars',7);
  chart.innerHTML=arr.map(x=>{const h=x.value?Math.max(4,x.value/max*87):1;
    const label=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(x.date+'T12:00:00Z'));
    return `<div class="click-chart-column" title="${esc(x.date)}: ${x.value===null?'No recorded history':x.value}"><div class="click-bar ${x.value?'':'is-zero'}" style="--bar-height:${h}%;${x.value===null?'opacity:0':''}"></div><span class="click-bar-label">${esc(label)}</span></div>`;
  }).join('');
}
function renderCharts(){renderDailyOverview();}

const ageStates=new Map();
function tickAges(){
  document.querySelectorAll('[data-post-age]').forEach(t=>{const n=Number(t.dataset.postAge);if(Number.isFinite(n))t.textContent=liveAge(new Date(n));});
  const now=Date.now();let changed=false;
  for(const p of state.placements){const code=String(p.code||''),fresh=isNew(p,now);
    if(!ageStates.has(code)){ageStates.set(code,fresh);continue;}
    if(ageStates.get(code)!==fresh){ageStates.set(code,fresh);changed=true;}
  }
  if(changed){renderWeekly();renderTracker();renderHistorical();renderCampaigns();const scope=selectedStatsWeek();renderWeeklyBreakdown(scope);}
}
// Background updates can replace tables before their observer rebuilds them.
// Restore after that frame, provided the reader has not navigated or interacted.
function preserveReadingPosition(update){
  const x=window.scrollX,y=window.scrollY,page=state.page;
  const active=document.activeElement;
  const tableKey=active?.closest('.xt-table-wrap')?.dataset.viewKey;
  const search=active?.matches('.xt-search input')?{key:tableKey,start:active.selectionStart,end:active.selectionEnd}:null;
  let cancelled=false;
  const cancel=()=>{cancelled=true;};
  const events=['wheel','touchstart','pointerdown','keydown'];
  events.forEach(name=>window.addEventListener(name,cancel,{once:true,passive:true}));
  update();
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    events.forEach(name=>window.removeEventListener(name,cancel));
    if(cancelled||state.page!==page)return;
    if(search){
      const input=Array.from(document.querySelectorAll('.xt-table-wrap')).find(node=>node.dataset.viewKey===search.key)?.querySelector('.xt-search input');
      if(input){input.focus({preventScroll:true});input.setSelectionRange(search.start,search.end);}
    }
    window.scrollTo({left:x,top:y,behavior:'instant'});
  }));
}
function render(){renderOfReport();renderWeekLabels();renderCampaignSelectors();renderWeekly();renderKpis();renderTracker();renderAccounts();renderCampaigns();renderHistorical();renderCharts();tickAges();if(state.modalCode)refreshDetails();}
function closeDetails(){if(el('articleModal').hidden)return;el('articleModal').hidden=true;document.body.classList.remove('modal-open');state.modalCode='';state.modalType='';if(state.lastFocus?.isConnected)state.lastFocus.focus();}
function detailsAction(url,label,copy=false){const link=safeUrl(url);if(!link)return '';
  return copy?`<button type="button" class="modal-link" data-copy="${esc(link)}">${esc(label)}</button>`:
    `<a href="${esc(link)}" target="_blank" rel="noopener noreferrer" class="modal-link">${esc(label)} ↗</a>`;
}
function changeSince7(code,key){const rows=state.history.filter(x=>x.code===code&&number(x[key])!==null).sort((a,b)=>String(a.at).localeCompare(String(b.at)));
  const latest=rows.at(-1),cutoff=Date.now()-7*86400000,prior=[...rows].reverse().find(x=>Date.parse(x.at)<=cutoff);
  return !latest||!prior?null:Number(latest[key])-Number(prior[key]);
}
function openDetails(kind,id){state.modalType=kind;state.modalCode=id;state.lastFocus=document.activeElement;
  refreshDetails();el('articleModal').hidden=false;document.body.classList.add('modal-open');el('modalClose').focus();}
function refreshDetails(){
  if(state.modalType==='boost'){showBoostDetails(state.modalCode,false);return;}const id=state.modalCode,kind=state.modalType,body=el('modalBody');
  if(kind==='placement'){
    const p=state.placements.find(p=>p.code===id);if(!p)return;
    el('modalOwner').textContent=esc(p.owner)+' · '+esc(p.code);
    el('articleModal').classList.toggle('modal-is-posted',isLive(p));
    el('articleModal').classList.toggle('modal-is-unposted',!isLive(p));
    const delta=changeSince7(p.code,'views');
    body.innerHTML=`<h2 id="modalTitle" class="modal-title">${headingHTML(p.publisher)}</h2>
      <div class="modal-summary">${campaignTag(p)}<span class="state-pill ${isLive(p)?'is-live':''}">${isLive(p)?'POSTED':p.paid?'Scheduled':'Planned'}</span><span>${esc(p.platform||'X')}</span>${postDate(p)?`<span>${esc(pubDate(p))}</span>`:''}${p.unavailable?'<span class="state-pill is-error">Unavailable</span>':''}${metricBadge(p)}${!p.metricError&&metricTime(p)?`<span>Updated ${esc(metricTime(p))}</span>`:''}</div>
      <div class="modal-primary"><div class="modal-primary-label">UTM clicks</div><div class="modal-primary-number">${display(clicks(p))}</div></div>
      <div class="modal-metrics"><div class="modal-metric"><span>Views</span><strong>${display(p.xViews)}</strong></div><div class="modal-metric"><span>Likes</span><strong>${display(p.xLikes)}</strong></div><div class="modal-metric"><span>Engagement</span><strong>${number(p.engagementRate)===null?'—':fixed(p.engagementRate)+'%'}</strong></div><div class="modal-metric"><span>UTM/$</span><strong>${fixed(ratio(p))}</strong></div><div class="modal-metric"><span>Price</span><strong>${money(p.cost)}</strong></div><div class="modal-metric"><span>Views Δ7d</span><strong>${delta===null?'—':(delta>=0?'+':'')+fmt(delta)}</strong></div></div>
      <div class="modal-links">${detailsAction(articleUrl(p),'Read article')}${detailsAction(p.postUrl,'View post')}${detailsAction(p.trackingUrl,'Copy UTM link',true)}${detailsAction(p.profileUrl,'Profile')}<button type="button" class="modal-link main-link" data-edit-placement="${esc(p.code)}">Edit</button><button type="button" class="modal-link" data-record-metrics="${esc(p.code)}">Metrics</button></div>`;
  }else if(kind==='account'){
    const a=buildAccounts().find(x=>x.key===id);if(!a)return;
    el('articleModal').classList.remove('modal-is-posted','modal-is-unposted');
    el('modalOwner').textContent=esc(a.platform)+' · '+fmt(a.items.length)+' placements';
    const prices=a.items.filter(x=>number(x.cost)!==null&&(x.paid||x.stage==='booked')).map(x=>Number(x.cost)).sort((a,b)=>a-b);
    const typical=prices.length>=2?money((prices[Math.floor((prices.length-1)/2)]+prices[Math.floor(prices.length/2)])/2):'—';
    const rows=[...a.items].sort(compareUTMClicks);
    body.innerHTML=`<h2 id="modalTitle" class="modal-title">${headingHTML(a.publisher)}</h2><div class="modal-summary">${esc(a.owner)} · ${esc(a.platform)}</div>
      <div class="modal-primary"><div class="modal-primary-label">UTM clicks</div><div class="modal-primary-number">${display(a.clicks)}</div></div>
      <div class="modal-metrics"><div class="modal-metric"><span>UTM/$</span><strong>${fixed(a.utmPerDollar)}</strong></div><div class="modal-metric"><span>Paid $</span><strong>${money(a.spent)}</strong></div><div class="modal-metric"><span>Views</span><strong>${display(a.views)}</strong></div><div class="modal-metric"><span>Likes</span><strong>${display(a.likes)}</strong></div><div class="modal-metric"><span>Engagement</span><strong>${a.engagement===null?'—':fixed(a.engagement)+'%'}</strong></div><div class="modal-metric"><span>Typical rate</span><strong>${typical}</strong></div></div>
      <h3 class="modal-list-heading">Promotion history<span class="heading-accent">.</span></h3><div class="mini-history">${rows.map(p=>`<button type="button" class="history-row ${isLive(p)?'is-posted':''}" data-detail="${esc(p.code)}"><span>${esc(pubDate(p))}</span><strong>${display(clicks(p))} UTM</strong><span>${money(p.cost)}</span><span>${esc(p.code)}</span><span class="state-pill ${isLive(p)?'is-live':''}">${isLive(p)?'POSTED':p.paid?'Scheduled':'Planned'}</span></button>`).join('')}</div>
      <div class="modal-links">${detailsAction(a.profileUrl,'Open profile')}</div>`;
  }else if(kind==='campaign'){
    const c=state.campaigns.find(c=>c.id===id);if(!c)return;const s=summariseCampaign(c);
    el('articleModal').classList.remove('modal-is-posted','modal-is-unposted');
    el('modalOwner').textContent=esc(c.id)+' · '+fmt(s.list.length)+' placements';
    body.innerHTML=`<h2 id="modalTitle" class="modal-title">${headingHTML(c.name)}</h2><div class="modal-summary"><span>Budget ${money(number(c.budget))}</span>${c.status?`<span>${esc(c.status)}</span>`:''}</div>
      ${c.brief?`<p class="modal-brief">${esc(c.brief)}</p>`:''}
      <div class="modal-primary"><div class="modal-primary-label">UTM clicks</div><div class="modal-primary-number">${display(s.clicks)}</div></div>
      <div class="modal-metrics"><div class="modal-metric"><span>Paid $</span><strong>${money(s.paid)}</strong></div><div class="modal-metric"><span>Booked $</span><strong>${money(s.booked)}</strong></div><div class="modal-metric"><span>Views</span><strong>${display(s.views)}</strong></div></div>
      <div class="modal-links"><button type="button" class="modal-link main-link" data-new-placement-campaign="${esc(c.id)}">+ Placement</button>${!c.legacy?`<button type="button" class="modal-link" data-edit-campaign="${esc(c.id)}">Edit campaign</button>`:''}</div>
      <h3 class="modal-list-heading">Placements<span class="heading-accent">.</span></h3><div class="mini-history">${[...s.list].sort(compareUTMClicks).map(p=>`<button type="button" class="history-row ${isLive(p)?'is-posted':''}" data-detail="${esc(p.code)}"><span>${esc(p.publisher)}</span><strong>${display(clicks(p))} UTM</strong><span>${money(p.cost)}</span><span>${esc(p.stage||'planned')}</span><span class="state-pill ${isLive(p)?'is-live':''}">${isLive(p)?'POSTED':p.paid?'Scheduled':'Planned'}</span></button>`).join('')||'<div class="empty-state">No placements assigned.</div>'}</div>`;
  }
  tickAges();
}
function closeEditor(){el('editModal').hidden=true;document.body.classList.remove('modal-open');state.pendingEditor=null;}
function editField(label,name,type='text',value='',extra=''){return `<label class="form-field"><span>${esc(label)}</span><input name="${esc(name)}" type="${type}" value="${esc(value??'')}" ${extra}></label>`;}
function editSelect(label,name,options,selected){return `<label class="form-field"><span>${esc(label)}</span><select name="${esc(name)}">${options.map(([value,text])=>`<option value="${esc(value)}" ${value===selected?'selected':''}>${esc(text)}</option>`).join('')}</select></label>`;}
const stages=[['planned','Planned'],['contacted','Contacted'],['booked','Booked'],['published','Published']];
const isoForInput=x=>{const d=validDate(x);return d?new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16):'';};
const toISO=x=>x?new Date(x).toISOString():'';
function editorHtml(kind,id){
  if(kind==='boost')return boostEditorHtml(id);
  if(kind==='newCampaign')return `<h2 id="editModalTitle" class="modal-title">New campaign<span class="heading-accent">.</span></h2><form id="entityForm" class="edit-form" data-action="newCampaign"><div class="form-grid">${editField('Name','name','text','', 'required maxlength="100"')}${editField('Budget ($)','budget','number','', 'required min="0" step="0.01"')}${editField('Start','startDate','date')}${editField('End','endDate','date')}</div><label class="form-field"><span>Brief</span><textarea name="brief" rows="3" maxlength="700"></textarea></label><button class="button button-primary submit-button" type="submit">Create campaign</button></form>`;
  if(kind==='editCampaign'){
    const c=state.campaigns.find(x=>x.id===id);if(!c)return '';
    return `<h2 id="editModalTitle" class="modal-title">${headingHTML("Edit "+c.name)}</h2><form id="entityForm" class="edit-form" data-action="editCampaign" data-id="${esc(id)}"><div class="form-grid">${editField('Name','name','text',c.name,'required')}${editField('Budget ($)','budget','number',number(c.budget)??'','min="0" step="0.01"')}${editSelect('Status','status',[['active','Active'],['paused','Paused'],['complete','Complete']],c.status||'active')}${editField('Start','startDate','date',c.startDate?.slice(0,10)||'')}${editField('End','endDate','date',c.endDate?.slice(0,10)||'')}</div><label class="form-field"><span>Brief</span><textarea name="brief" rows="3">${esc(c.brief||'')}</textarea></label><button class="button button-primary submit-button" type="submit">Save campaign</button></form>`;
  }
  if(kind==='newPlacement'){
    const names=[...new Map(state.placements.map(p=>[p.publisher.toLowerCase(),p.publisher])).values()].sort((a,b)=>a.localeCompare(b));
    const camps=state.campaigns.map(c=>[c.id,c.name]);
    return `<h2 id="editModalTitle" class="modal-title">New placement<span class="heading-accent">.</span></h2><form id="entityForm" class="edit-form" data-action="newPlacement"><div class="form-grid">${editSelect('Existing account','publisher',names.map(s=>[s,s]),names[0]||'')}${editSelect('Campaign','campaignId',camps,id||camps[0]?.[0]||'A01')}${editField('Agreed price ($)','price','number','','required min="0" step="0.01"')}${editSelect('Platform','platform',[['X','X'],['Instagram','Instagram']],'X')}${editSelect('Stage','stage',stages,'planned')}${editField('Profile URL','profileUrl','url','','placeholder="https://x.com/..."')}${editField('Post URL (optional)','postUrl','url','','placeholder="https://..."')}${editField('Live date (optional)','postedAt','datetime-local')}</div><button class="button button-primary submit-button" type="submit">Add placement</button></form>`;
  }
  if(kind==='editPlacement'){
    const p=state.placements.find(x=>x.code===id);if(!p)return '';
    const camps=state.campaigns.map(c=>[c.id,c.name]);
    return `<h2 id="editModalTitle" class="modal-title">${headingHTML("Edit "+p.publisher)}</h2><form id="entityForm" class="edit-form" data-action="editPlacement" data-id="${esc(p.code)}"><div class="form-grid">${editSelect('Stage','stage',stages,p.stage||'planned')}${editSelect('Campaign','campaignId',camps,effectiveCampaignId(p)||p.code.slice(0,3))}${editSelect('Platform','platform',[['X','X'],['Instagram','Instagram']],p.platform||'X')}${editField('Agreed price ($)','price','number',number(p.cost)??'','required min="0" step="0.01"')}${editField('Post URL','postUrl','url',p.postUrl||'')}${editField('Live date','postedAt','datetime-local',isoForInput(p.postedAt))}${editField('Booked date','bookedAt','datetime-local',isoForInput(p.bookedAt))}${editField('Paid date','paidAt','datetime-local',isoForInput(p.paidAt))}</div><div class="edit-checkboxes"><label><input type="checkbox" name="paid" ${p.paid?'checked':''}> Paid</label><label><input type="checkbox" name="posted" ${p.posted?'checked':''}> Published</label></div><button class="button button-primary submit-button" type="submit">Save placement</button></form>`;
  }
  if(kind==='metrics'){
    const p=state.placements.find(x=>x.code===id);if(!p)return '';
    return `<h2 id="editModalTitle" class="modal-title">${headingHTML("Metrics · "+p.publisher)}</h2><form id="entityForm" class="edit-form" data-action="metrics" data-id="${esc(p.code)}"><div class="form-grid">${editField('Views','views','number',number(p.xViews)??'','min="0" step="1"')}${editField('Likes','likes','number',number(p.xLikes)??'','min="0" step="1"')}${editField('Comments','comments','number',number(p.xComments)??'','min="0" step="1"')}${editField('Shares','shares','number',number(p.xShares)??'','min="0" step="1"')}</div><button class="button button-primary submit-button" type="submit">Save metrics</button></form>`;
  }
  return '';
}
function openEditor(kind,id=''){
  if(!state.adminConfigured){notify('Admin access not configured');return;}
  closeDetails();state.pendingEditor={kind,id};el('editModal').hidden=false;document.body.classList.add('modal-open');
  if(!state.adminKey){el('editModalBody').innerHTML=`<h2 id="editModalTitle" class="modal-title">Unlock editing<span class="heading-accent">.</span></h2><form class="edit-form" id="unlockForm"><label class="form-field"><span>Admin key</span><input type="password" name="key" autocomplete="off" required></label><button type="submit" class="button button-primary submit-button">Unlock</button></form>`;}
  else el('editModalBody').innerHTML=editorHtml(kind,id);
  el('editClose').focus();
}
async function adminSend(body,key=state.adminKey){
  const res=await fetch('/.netlify/functions/admin',{method:'POST',cache:'no-store',headers:{'content-type':'application/json','authorization':'Bearer '+key},body:JSON.stringify(body)});
  const data=await res.json().catch(()=>({ok:false,error:'Unrecognised response'}));
  if(!res.ok||!data.ok)throw new Error(data.error||'Admin request failed');return data.result||{};
}
async function onUnlock(form){const key=form.elements.key.value.trim();if(!key)return;
  const button=form.querySelector('button');button.disabled=true;
  try{await adminSend({type:'check'},key);state.adminKey=key;const {kind,id}=state.pendingEditor;el('editModalBody').innerHTML=editorHtml(kind,id);notify('Editing unlocked');}
  catch(e){notify(String(e.message||e));}
  finally{button.disabled=false;}
}
async function onEntity(form){const kind=form.dataset.action,id=form.dataset.id;
  const raw=Object.fromEntries(new FormData(form).entries()),checkbox=(n)=>form.elements[n]?.checked===true;
  const iso=n=>raw[n]?toISO(raw[n]):'';
  let body;
  if(kind==='newCampaign')body={type:'createCampaign',name:raw.name,brief:raw.brief,budget:raw.budget,startDate:raw.startDate,endDate:raw.endDate};
  else if(kind==='editCampaign')body={type:'updateCampaign',id,changes:{name:raw.name,brief:raw.brief,budget:raw.budget,status:raw.status,startDate:raw.startDate,endDate:raw.endDate}};
  else if(kind==='newPlacement')body={type:'createPlacement',publisher:raw.publisher,campaignId:raw.campaignId,price:raw.price,platform:raw.platform,profileUrl:raw.profileUrl,stage:raw.stage,postUrl:raw.postUrl,postedAt:iso('postedAt')};
  else if(kind==='editPlacement')body={type:'updatePlacement',code:id,changes:{stage:raw.stage,campaignId:raw.campaignId,price:raw.price,platform:raw.platform,postUrl:raw.postUrl,paid:checkbox('paid'),posted:checkbox('posted'),postedAt:iso('postedAt'),bookedAt:iso('bookedAt'),paidAt:iso('paidAt')}};
  else if(kind==='metrics')body={type:'recordMetrics',code:id,...Object.fromEntries(['views','likes','comments','shares'].map(k=>[k,raw[k]===''?null:Number(raw[k])]))};
  else return;
  const btn=form.querySelector('[type="submit"]');btn.disabled=true;btn.textContent='Saving…';
  try{await adminSend(body);closeEditor();state.selected.clear();notify('Saved to Google Sheets');await load(true);}
  catch(e){notify(String(e.message||e));btn.disabled=false;btn.textContent='Try again';}
}
async function saveBulk(){const codes=[...state.selected];const changes={};if(el('bulkStage').value)changes.stage=el('bulkStage').value;if(el('bulkCampaign').value)changes.campaignId=el('bulkCampaign').value;
  if(!codes.length||!Object.keys(changes).length){notify('Select a change');return;}
  if(!state.adminConfigured){notify('Admin access not configured');return;}
  if(!state.adminKey){openEditor('newPlacement');notify('Unlock editing, then apply again');return;}
  const btn=el('bulkSave');btn.disabled=true;
  try{await adminSend({type:'bulkUpdate',codes,changes});state.selected.clear();el('bulkStage').value='';el('bulkCampaign').value='';notify('Placements updated');await load(true);}
  catch(e){notify(String(e.message||e));}finally{btn.disabled=false;}
}
function activityFromCsv(text){
  const lines=String(text||'').trim().split(/\r?\n/);
  if(lines[0]?.replaceAll('"','')!=='TIMESTAMP,CODE,CTA')throw new Error('Invalid click feed');
  const map=new Map();for(const line of lines.slice(1)){
    if(!line.trim())continue;
    const fields=line.match(/^"([^"]*)","([^"]*)","([^"]*)"$/)?.slice(1)||line.split(',');
    if(fields.length!==3||!/^A\d{2}-P\d{2,3}$/.test(fields[1]))continue;
    const date=day(validDate(fields[0]));if(!date)continue;
    const key=date+'|'+fields[1],old=map.get(key)||{date,code:fields[1],clicks:0};old.clicks++;map.set(key,old);
  }return [...map.values()];
}
function normaliseActivity(rows){if(!Array.isArray(rows))return [];
  return rows.filter(x=>x&&/^\d{4}-\d{2}-\d{2}$/.test(x.date)&&/^A\d{2}-P\d{2,3}$/.test(x.code)&&number(x.clicks)!==null&&number(x.clicks)>=0)
    .map(x=>({date:x.date,code:x.code,clicks:Number(x.clicks)}));
}
function updateStatus(data=null,error=null){
  const bar=el('feedWarning');
  const unavailable=Boolean(error)||data?.trackingReady===false;
  bar.hidden=!unavailable;
  bar.textContent=unavailable?(state.trackingReady?'Reporting is temporarily unavailable. Last recorded figures remain visible.':'Reporting is temporarily unavailable. Please try again shortly.'):'';
}
function showXRefreshTime(iso){
  const date=validDate(iso);
  document.querySelectorAll('#xRefreshTime,[data-x-refresh-time]').forEach(node=>node.textContent=date?'Updated: '+new Intl.DateTimeFormat('en-GB',{timeZone:TZ,dateStyle:'medium',timeStyle:'short'}).format(date)+' UK':'Updated: not yet available');
}
function syncXRefreshControls(){
  const source=el('refreshXStats'),status=el('xRefreshStatus');
  document.querySelectorAll('[data-refresh="x"]').forEach(button=>{
    button.disabled=source.disabled;
    button.classList.toggle('is-refreshing',source.disabled);
    if(source.disabled)button.setAttribute('aria-busy','true');else button.removeAttribute('aria-busy');
  });
  document.querySelectorAll('[data-x-refresh-status]').forEach(node=>{node.className=status.className;node.textContent=status.textContent;});
}
async function refreshOfReport(){
  const button=document.querySelector('[data-refresh="of"]'),status=el('ofRefreshStatus');
  if(button.disabled)return;
  button.disabled=true;button.classList.add('is-refreshing');button.setAttribute('aria-busy','true');
  status.className='x-refresh-status';status.textContent='Refreshing X and Short.io stats…';
  try{
    while(state.ofLoading)await new Promise(resolve=>setTimeout(resolve,100));
    if(!await loadOfReport(true,true))throw new Error('Campaign report could not refresh. Last recorded figures remain visible. Please try again.');
    const result=state.ofCampaign;
    status.className='x-refresh-status'+(result.updated>0?' is-success':'');
    status.textContent=result.skipped?'Latest verified X stats shown':result.updated?`Updated ${result.updated} of ${result.total} X posts${result.errors?.length?' · other saved readings retained':''}`:result.total?'X stats unavailable · last verified readings retained':'No published X posts to refresh';
  }catch(error){status.className='x-refresh-status is-error';status.textContent=String(error.message||error);}
  finally{button.disabled=false;button.classList.remove('is-refreshing');button.removeAttribute('aria-busy');}
}
async function refreshXStats(){
  const button=el('refreshXStats'),status=el('xRefreshStatus');
  if(button.disabled)return;
  button.disabled=true;button.classList.add('is-refreshing');button.setAttribute('aria-busy','true');
  status.className='x-refresh-status';status.textContent='Refreshing X and Short.io stats…';syncXRefreshControls();
  try{
    const response=await fetch('/.netlify/functions/dashboard',{method:'POST',cache:'no-store',headers:{accept:'application/json'},signal:AbortSignal.timeout(65000)});
    const result=await response.json().catch(()=>({error:'The refresh service returned an invalid response.'}));
    if(!response.ok)throw new Error(result.error||'X stats refresh failed.');
    while(state.loading)await new Promise(resolve=>setTimeout(resolve,100));
    if(!await load(true))throw new Error('X stats were fetched, but the dashboard could not reload. Please try again.');
    showXRefreshTime(result.lastSuccessfulAt);
    if(result.ok){status.className='x-refresh-status is-success';status.textContent=`Updated ${result.updated} of ${result.total} articles`;}
    else{status.className='x-refresh-status is-error';status.textContent=`Updated ${result.updated} of ${result.total} articles. ${result.errors?.length||0} could not be refreshed; last verified figures remain visible.`;}
    return result;
  }catch(error){status.className='x-refresh-status is-error';status.textContent=error.name==='TimeoutError'?'X stats refresh timed out. Please try again.':String(error.message||error);return {ok:false,error:String(error.message||error)};}
  finally{button.disabled=false;button.classList.remove('is-refreshing');button.removeAttribute('aria-busy');syncXRefreshControls();}
}
async function reloadAllData(){
  const button=el('reloadAllButton'),status=el('reloadAllStatus');
  if(!button||button.disabled||el('refreshXStats').disabled||gtaState.refreshing)return;
  button.disabled=true;button.classList.add('is-refreshing');button.setAttribute('aria-busy','true');
  const issues=new Set();
  const progress=message=>{status.className='x-refresh-status';status.textContent=message;};
  try{
    // The existing dashboard refresh coordinates X Articles, OF Terms and X RTs
    // as one server job. Reuse it instead of issuing duplicate provider POSTs.
    progress('1/3 · Reloading X articles, OF Terms and X RTs…');
    const x=await refreshXStats();
    if(!x?.ok)issues.add('X article metrics');
    if(!x||x.of?.error)issues.add('OF Terms X metrics');
    if(!x||x.boosts?.error)issues.add('X RT metrics');
    progress('2/3 · Reloading GTA VI, QRTs and boosted article views…');
    await refreshGtaReport();
    if(gtaState.error||el('gtaRefreshStatus').classList.contains('is-error'))issues.add('GTA VI metrics');
    progress('3/3 · Reloading all campaign pages and saved totals…');
    // These are GETs only. The X data providers were already refreshed above.
    const results=await Promise.allSettled([
      load(true),
      loadOfReport(true,false),
      loadBoosts(true),
      window.XTrackerCampaignReporting?.reload?.()
    ]);
    if(results[0].status!=='fulfilled'||results[0].value!==true)issues.add('Dashboard');
    if(results[1].status!=='fulfilled'||results[1].value!==true||state.ofError)issues.add('OF Terms');
    if(results[2].status!=='fulfilled'||boostsState.error)issues.add('X RTs');
    if(results[3].status!=='fulfilled'||results[3].value!==true)issues.add('Campaigns');
    status.className='x-refresh-status '+(issues.size?'is-error':'is-success');
    status.textContent=issues.size
      ? 'Reload finished with partial or unavailable sources: '+[...issues].join(', ')+'. Last verified figures are preserved.'
      : 'All connected sources reloaded. Latest available X views, clicks and campaign data are shown.';
  }catch(error){
    status.className='x-refresh-status is-error';
    status.textContent='Reload could not finish: '+String(error?.message||error)+'. Previously verified figures are preserved.';
  }finally{
    button.disabled=false;button.classList.remove('is-refreshing');button.removeAttribute('aria-busy');
  }
}
function applyDashboard(data){
    const signature=JSON.stringify([data.placements,data.campaigns,data.metricHistory,data.clickActivity,data.hourlyEvents,data.homePaidCodes,data.homeVerified,data.trackingReady]);
    const changed=state.dashboardSignature!==signature||state.loadError;state.dashboardSignature=signature;
    state.homeVerified=data.homeVerified===true;
    state.homePaidCodes=new Set(state.homeVerified&&Array.isArray(data.homePaidCodes)?data.homePaidCodes:[]);
    state.placements=data.placements.map(p=>({...p,owner:String(p.owner||'').toUpperCase(),platform:p.platform||'X',
      profileUrl:p.profileUrl||(p.platform==='Instagram'?'https://instagram.com/'+p.publisher:'https://x.com/'+p.publisher)}));
    if(!state.ofCampaign?.ready&&data.ofCampaign?.ready)state.ofCampaign=data.ofCampaign;
    selectLatestNonemptyWeek();
    state.campaigns=Array.isArray(data.campaigns)?data.campaigns:[];
    state.history=Array.isArray(data.metricHistory)?data.metricHistory:[];
    state.trackingReady=data.trackingReady===true;
    state.adminConfigured=data.adminConfigured===true;
    if(Array.isArray(data.clickActivity)&&state.trackingReady){state.activity=normaliseActivity(data.clickActivity);state.activityReady=true;}
    else if(state.trackingReady){state.activityReady=false;}
    else{state.activity=[];state.activityReady=false;}
    // Reuse the verified timestamps already loaded by the dashboard API.
    if(Array.isArray(data.hourlyEvents)){state.hourlyEvents=data.hourlyEvents;state.hourlyReady=state.trackingReady;}

    state.lastLoadedAt=Date.now();state.initialLoadSettled=true;state.loadError=false;updateStatus(data);showXRefreshTime(data.metricAutomation?.lastSuccessfulAt);if(changed)preserveReadingPosition(render);else tickAges();
}
async function loadOfReport(force=false,refreshMetrics=false){
  if(state.ofLoading)return;state.ofLoading=true;
  try{
    const response=await fetch('/.netlify/functions/of-report'+(force?'?refresh=1':''),{method:refreshMetrics?'POST':'GET',cache:'no-store',signal:AbortSignal.timeout(refreshMetrics?65000:30000)});
    const data=await response.json();if(!response.ok||!validReport(data,'publishers','ready'))throw new Error(data.error||'Campaign report unavailable');
    if(!force&&state.ofCampaign?.publishers?.length&&data.publishers.length===0)
      throw new Error('Source temporarily empty; preserving saved OF Terms publishers');
    state.ofError='';state.ofCampaign=retainCachedStats(data,state.ofCampaign);saveReportCache('xtracker-of-cache-v1',state.ofCampaign);
    const verifiedAt=validDate(data.checkedAt||data.cachedAt);
    el('ofRefreshTime').textContent='Updated: '+(verifiedAt?new Intl.DateTimeFormat('en-GB',{timeZone:TZ,dateStyle:'medium',timeStyle:'short'}).format(verifiedAt)+' UK':'not yet available');return true;
  }catch(error){state.ofError='New readings are temporarily unavailable; showing saved figures when available.';if(!state.ofLastLoadedAt)el('ofRefreshTime').textContent='Updated: not yet available';if(!state.ofCampaign?.ready)state.ofCampaign={ready:false,error:'Campaign data temporarily unavailable. Please try again shortly.'};return false;}
  finally{state.ofLoading=false;state.ofSettled=true;state.ofLastLoadedAt=Date.now();preserveReadingPosition(()=>{renderOfReport();if(state.page==='campaigns')renderCampaigns();});}
}
async function load(force=false){if(state.loading)return false;
  refreshGbpRate();
  state.loading=true;state.lastRefreshAttemptAt=Date.now();
  try{
    const response=await fetch('/.netlify/functions/dashboard'+(force?'?refresh='+Date.now():''),{cache:'no-store',signal:AbortSignal.timeout(30000)});
    const data=await response.json();if(!response.ok||!validReport(data,'placements','ok'))throw new Error(data.error||'Dashboard unavailable');
    // The backend and frontend can briefly have different release numbers after a
    // manual Netlify publish. A forced reload here previously trapped the entire
    // site in a loop and prevented otherwise valid data from rendering.
    if(data.uiVersion&&data.uiVersion!==APP_VERSION){
      console.info('X Tracker frontend/backend versions differ; using compatible live data',APP_VERSION,data.uiVersion);
    }
    if(state.trackingReady&&data.trackingReady===false)throw new Error('Reporting temporarily unavailable');
    // A transiently blank response must not erase the last verified source records.
    const lastGood=readReportCache('xtracker-dashboard-cache-v1','placements','ok');
    if(lastGood?.placements?.length&&data.placements.length===0&&
       (data.homeVerified!==true||data.trackingReady!==true||data.warning||data.sourceStale)){
      throw new Error('Source incomplete; preserving previous dashboard data');
    }
    const merged=retainCachedStats(data,readReportCache('xtracker-dashboard-cache-v1','placements','ok'));applyDashboard(merged);saveReportCache('xtracker-dashboard-cache-v1',merged);return true;
  }catch(e){state.initialLoadSettled=true;state.loadError=true;console.error('Tracker refresh:',String(e.message||e));updateStatus(null,e);
    if(!state.placements.length&&!state.homeVerified)state.hourlyReady=false;
    render();
    if(!state.placements.length&&!state.homeVerified){for(const id of ['weeklyGrid','upcomingGrid','trackerList','accountMobileList','campaignGrid','historicalWeeks'])el(id).innerHTML='<div class="empty-state">Reporting is temporarily unavailable. Please try again shortly.</div>';}return false;}
  finally{state.loading=false;}
}
function renderOfReport(){
  const report=state.ofCampaign,ready=report?.ready===true;
  const from=weekStart(new Date()),to=shift(from,6),today=day(new Date());
  const dateLabel=date=>new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',day:'numeric',month:'short',year:'numeric'}).format(new Date(date+'T12:00:00Z'));
  el('ofWeekLabel').textContent=`${dateLabel(from)} – ${dateLabel(to)} · UK time`;
  el('ofLiveStatus').textContent=ready?'Campaign report':state.ofSettled?'Report unavailable':'Loading report…';
  el('ofLiveStatus').classList.toggle('is-live',ready);
  el('ofReportError').hidden=ready?!(report.warning||state.ofError):!state.ofSettled;
  el('ofReportError').textContent=report?.warning||state.ofError||'Campaign data temporarily unavailable. Please try again shortly.';
  const rows=(ready?report.publishers:[]).filter(p=>p.posted===true).map(ofPublisherMetrics),activity=ready?(report.activity||[]):[];
  const daily=Array.from({length:7},(_,i)=>{const date=shift(from,i);return {date,clicks:activity.filter(e=>e.date===date).reduce((sum,e)=>sum+e.clicks,0)};});
  const paid=rows.filter(p=>p.paid),posted=rows.filter(p=>p.posted===true),weekly=daily.reduce((sum,d)=>sum+d.clicks,0);
  const paidTotal=paid.some(p=>p.cost===null)?null:paid.reduce((sum,p)=>sum+p.cost,0);
  const defs=[['spend','Campaign paid total',ready?money(paidTotal):'—',ready?`${paid.length} paid ${paid.length===1?'publisher':'publishers'} · campaign to date`:'Waiting for verified campaign data'],['seven','Combined X views',gtaNumber(posted.some(p=>number(p.xViews)!==null)?posted.reduce((sum,p)=>sum+(number(p.xViews)??0),0):null),`${posted.filter(p=>number(p.xViews)!==null).length} of ${posted.length} live posts with verified views`],['published','Published X posts',ready?fmt(posted.length):'—','Campaign to date · 5-post X threads']];
  const interactions=interactionSummary(posted);
  defs.push(['interactions','Total interactions',gtaNumber(interactions.total),interactions.note]);
  renderEngagement('of',ready?posted:[]);
  defs.push(['shortio',"This week's UTM clicks",ready?fmt(weekly):'—','Verified OF click events · Mon–Sun · tap for breakdown']);
  el('ofMetrics').innerHTML=defs.map(([kind,label,value,sub])=>`<${kind==='shortio'?'button type="button" aria-controls="ofPublishers" data-of-clicks':'div'} class="daily-metric daily-metric-${kind}"><span class="daily-metric-label">${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(sub)}</small></${kind==='shortio'?'button':'div'}>`).join('');
  el('ofMetrics').querySelector('[data-of-clicks]')?.addEventListener('click',()=>focusPromoClicks('ofPublishers','UTM clicks'));

  if(ready){
    const W=Math.max(280,el('ofChart').clientWidth||700),H=240,L=24,T=20,B=40,cw=W-L-15,ch=H-T-B,max=Math.max(1,...daily.map(d=>d.clicks));
    const bars=daily.map((d,i)=>{const x=L+(i+.5)*cw/7,y=T+ch-d.clicks/max*ch;return `<g><title>${esc(d.date)}: ${d.date>today?'upcoming':d.clicks+' verified clicks'}</title><rect x="${x-Math.min(17,cw/7*.28)}" y="${y}" width="${Math.min(34,cw/7*.56)}" height="${d.clicks/max*ch}" rx="5" fill="#0055ff"/><text x="${x}" y="${Math.max(13,y-7)}" text-anchor="middle" class="daily-axis-label">${d.date>today?'':d.clicks}</text><text x="${x}" y="${H-13}" text-anchor="middle" class="daily-axis-label">${esc(new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',weekday:'short'}).format(new Date(d.date+'T12:00:00Z')))}</text></g>`;}).join('');
    el('ofChart').innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily verified OF clicks for the current UK week."><line x1="${L}" y1="${T+ch}" x2="${W-15}" y2="${T+ch}" class="daily-axis-line"/>${bars}</svg>`;
  }else el('ofChart').innerHTML=state.ofSettled?'<div class="empty-state">Click history is temporarily unavailable.</div>':'<div class="loading-card" role="status">Loading click history…</div>';
  const link=(url,label)=>safeUrl(url)?`<a class="button" href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${label}</a>`:'';
  const section=(title,publishers)=>`<section class="of-publisher-section"><div class="result-line"><h2>${title}<span class="heading-accent">.</span></h2><span class="section-count">${publishers.length}</span></div><div class="of-publisher-grid">${publishers.map(p=>{
    const wc=activity.filter(e=>e.code===p.code&&e.date>=from&&e.date<=to).reduce((sum,e)=>sum+e.clicks,0);
    const live=p.posted===true,url=live?safeUrl(p.postUrl):safeUrl(p.profileUrl);
    const tag=url?'a':'div';
    const attributes=url?` href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${esc(p.publisher)} ${live?'live X post':'X profile'}"`:'';
    const content=articleCardContent({...p,articleLabel:'X post'},{live,promo:true,metricsOverride:[['clicks','UTM Clicks',ready?p.clicks:null],['week','Week UTM clicks',ready?wc:null],['spend','Paid total',p.paid?money(p.cost):'Unpaid']]});
    return `<article class="of-publisher-entry"><${tag}${attributes} data-placement-code="${esc(p.code)}" data-post-url="${esc(safeUrl(p.postUrl))}" class="article-card of-post-card ${live?'live-article of-is-posted':''}">${content}</${tag}><p class="of-last-click">Last click: ${p.lastClick?esc(new Intl.DateTimeFormat('en-GB',{timeZone:TZ,dateStyle:'medium',timeStyle:'short'}).format(new Date(p.lastClick)))+' UK':'None recorded'}</p><div class="of-publisher-links">${link(p.profileUrl,'X profile')}${link(p.postUrl,'View post')}</div></article>`;
  }).join('')||'<div class="empty-state">No posts in this group.</div>'}</div></section>`;
  el('ofPublishers').innerHTML=ready?section('Published X posts',posted):'';
}
// Only entries visited in this document are eligible for the in-app back control.
// A fresh load (including reload) deliberately starts a new safe history boundary.
const navigationSession=crypto.randomUUID();
let navigationIndex=0;
const navigationEntries=[];
function recordNavigation(hash,updateUrl){
  if(!navigationEntries.length){
    navigationEntries.push(hash);
  }else if(updateUrl&&location.hash!=='#'+hash){
    navigationIndex++;
    navigationEntries.splice(navigationIndex,Infinity,hash);
    history.pushState(null,'','#'+hash);
  }else if(!updateUrl){
    const entry=history.state?.xtrackerNavigation;
    if(entry?.session===navigationSession&&navigationEntries[entry.index]===hash){
      navigationIndex=entry.index;
    }else{
      navigationIndex++;
      navigationEntries.splice(navigationIndex,Infinity,hash);
    }
  }
  history.replaceState({...history.state,xtrackerNavigation:{session:navigationSession,index:navigationIndex}},'','#'+hash);
}
function navigateBack(){
  const entry=history.state?.xtrackerNavigation;
  if(entry?.session===navigationSession&&entry.index===navigationIndex&&navigationIndex>0)history.back();
  else route('dashboard');
}
const defaultPageTitle=document.title;
// XTRACKER_GTA_V1
// GTA VI, reusing the OF Terms report's existing components and styling.
const gtaState={tab:'qrts',report:null,loading:null,lastLoadAt:0,error:'',refreshing:false};
function restoreGtaReport(){
  const saved=readReportCache('xtracker-gta-report-qrts-v1','publishers','ready');
  if(saved?.scope==='published-qrts-v1')return {...saved,cached:true};
  return null;
}
gtaState.report=restoreGtaReport();
const gtaNumber=v=>v===null||v===undefined?'—':fmt(v);
const gtaMoney=v=>v===null||v===undefined?'—':'$'+new Intl.NumberFormat('en-GB',{maximumFractionDigits:2}).format(Number(v));
const gtaCpc=v=>v===null||v===undefined?'—':'$'+Number(v).toFixed(2);
const gtaUKDate=at=>new Intl.DateTimeFormat('en-GB',{timeZone:TZ,dateStyle:'medium',timeStyle:'short'}).format(new Date(at))+' UK';
const gtaSafeLink=(url,label)=>safeUrl(url)?`<a class="button" href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`:'';
function gtaDate(day){return new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',day:'numeric',month:'short',year:'numeric'}).format(new Date(day+'T12:00:00Z'));}
// Sum only complete readings: missing engagement metrics are not zero.
function interactionSummary(rows){
  const measured=rows.filter(p=>['likes','reposts','replies'].every(key=>Number.isFinite(p[key])&&p[key]>=0));
  return {total:measured.length?measured.reduce((sum,p)=>sum+p.likes+p.reposts+p.replies,0):null,
    note:`Likes + reposts + replies · ${measured.length} of ${rows.length} posts with complete data`};
}
function ofPublisherMetrics(p){
  const measured=state.placements.find(row=>row.code===p.code || (p.postUrl && row.postUrl===p.postUrl))||{};
  return {...measured,...p,views:p.views??measured.xViews,likes:p.likes??measured.xLikes,
    reposts:p.reposts??measured.xShares,replies:p.replies??measured.xComments,
    xViews:p.views??p.xViews??measured.xViews,xLikes:p.likes??p.xLikes??measured.xLikes,
    xShares:p.reposts??p.xShares??measured.xShares,xComments:p.replies??p.xComments??measured.xComments};
}
function engagementSummary(rows){
  const measured=rows.filter(p=>['views','likes','reposts','replies'].every(key=>Number.isFinite(p[key])&&p[key]>=0)&&p.views>0);
  const views=measured.reduce((sum,p)=>sum+p.views,0);
  const interactions=measured.reduce((sum,p)=>sum+p.likes+p.reposts+p.replies,0);
  return {rate:views?interactions/views*100:null,count:measured.length,total:rows.length};
}
function renderEngagement(prefix,rows){
  const summary=engagementSummary(rows);
  el(prefix+'EngagementRate').textContent=summary.rate===null?'—':summary.rate.toFixed(2)+'%';
  el(prefix+'EngagementDetails').textContent=`(Likes + reposts + replies) ÷ views × 100. ${summary.count} of ${summary.total} published posts have complete readings and positive views. ${summary.rate===null?'The rate appears when verified engagement and view counts are available. ':''}Uses the latest available readings; updates with the campaign report. Use Refresh X Stats to request updated figures.`;
}
// Measure the complete sticky navigation, including wrapped mobile rows.
function updatePromoScrollOffset(){
  const header=document.querySelector('.app-header');
  const style=header&&getComputedStyle(header);
  const pinned=style&&(style.position==='sticky'||style.position==='fixed');
  const height=pinned?Math.max(0,header.getBoundingClientRect().height+(parseFloat(style.top)||0)):0;
  const root=document.documentElement;
  root.style.setProperty('--promo-nav-height',`${Math.ceil(height)}px`);
  root.style.setProperty('--promo-scroll-padding',`${parseFloat(getComputedStyle(root).scrollPaddingTop)||0}px`);
  return Math.ceil(height);
}
const promoHeader=document.querySelector('.app-header');
if(promoHeader){
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(updatePromoScrollOffset).observe(promoHeader);
  window.addEventListener('resize',updatePromoScrollOffset,{passive:true});
  updatePromoScrollOffset();
}
function focusPromoClicks(id,label){
  updatePromoScrollOffset();
  const target=el(id),sort=target.querySelector(`button[title="Sort by ${label}"]`);
  if(sort&&sort.closest('th').getAttribute('aria-sort')!=='descending')sort.click();
  for(const table of target.querySelectorAll('.xt-table-scroll'))table.scrollLeft=0;
  // Use document coordinates so root scroll-padding cannot change KPI clearance.
  const top=window.scrollY+target.getBoundingClientRect().top-updatePromoScrollOffset()-24;
  window.scrollTo({top:Math.max(0,top),behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  target.focus({preventScroll:true});
}
function gtaSourceStatus(report){
  const x=report?.xStatus,short=report?.shortIo;
  if(!x)return null;
  const issues=[];
  if(x.errors?.length||x.unverified)issues.push(`${x.retained} saved X readings retained; ${x.unverified} X posts unverified`);
  if(short?.errors||short?.stale)issues.push('Short.io has saved or incomplete readings');
  if(report?.warning)issues.push('Sheet source unavailable; saved records retained');
  const failed=issues.length>0;
  const text=`X: ${x.updated} of ${x.total} posts · Short.io: ${short?.refreshed||0} of ${short?.linkCount||0} links`+(failed?' · '+issues.join(' · '):' · Latest available readings verified');
  return {failed,text};
}
function renderGtaQuotedArticles(){
  const report=gtaState.report;
  const linked=report?.quotedOriginals;
  const summaries=linked?.summary||{};
  const rows=Array.isArray(linked?.rows)?linked.rows:[];
  document.querySelectorAll('[data-gta-tab]').forEach(button=>{
    const active=button.dataset.gtaTab==='quoted';
    button.classList.toggle('is-active',active);
    button.setAttribute('aria-selected',String(active));
    button.tabIndex=active?0:-1;
  });
  el('gtaReportPanel').setAttribute('aria-labelledby','gtaTabQuoted');
  el('gtaScopeLabel').textContent='GTA VI · ARTICLES BOOSTED BY QRTS';
  el('gtaWeekLabel').textContent='Lifetime campaign performance';
  const status=el('gtaLiveStatus');
  status.textContent=report?.ready?(report.warning?'Saved campaign data · '+gtaUKDate(report.sourceVerifiedAt):
    'Quote-linked articles · X metrics updated '+gtaUKDate(report.metricLastSuccessfulAt)):'Loading verified X data';
  status.classList.toggle('is-live',!!report?.ready);
  const diag=el('gtaReportError'),problems=report?.warning?[report.warning]:[];
  diag.hidden=!problems.length;diag.innerHTML=problems.length?'<summary>Source details</summary><p>'+esc(problems.join(' · '))+'</p>':'';
  const defs=[
    ['spend','Known Paid QRT Spend',gtaMoney(summaries.allocatedPaidSpend),summaries.unknownPaidCosts?'Some payment amounts unknown':'Allocated to verified original posts'],
    ['seven','Original Post Views',gtaNumber(summaries.quotedPostViews),'Views on quoted source X posts'],
    ['published','Linked Source Posts',gtaNumber(summaries.originalPosts),'One count per original X post'],
    ['interactions','Paid QRT Views',gtaNumber(summaries.qrtViews),'Separate from original X views']
  ];
  el('gtaMetrics').innerHTML=defs.map(([kind,title,value,sub])=>
    '<div class="daily-metric daily-metric-'+kind+'"><span class="daily-metric-label">'+esc(title)+
    '</span><strong>'+esc(value)+'</strong><small>'+esc(sub)+'</small></div>').join('');
  el('gtaEngagementRate').textContent='—';
  el('gtaEngagementDetails').textContent='Original posts and QRTs have different X engagement measures; they cannot be combined as unique reach.';
  el('gtaEngagementButton').setAttribute('aria-expanded','false');
  el('gtaEngagementDetails').hidden=true;
  const safeLink=(value,label)=>{
    const u=safeUrl(value);
    return u?'<a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+'</a>':'<span>Link missing</span>';
  };
  const articles=rows.map(row=>{
    const children=(row.qrts||[]).map(qrt=>
      '<li><strong>'+esc(qrt.publisher)+'</strong> · '+esc(gtaNumber(qrt.views))+
      ' QRT views · '+(qrt.paid?esc(gtaMoney(qrt.cost)):'Payment unverified')+
      ' · '+safeLink(qrt.postUrl,'Live QRT')+'</li>').join('');
    return '<article class="rpt-quoted-card"><div class="rpt-quoted-card-head"><div><h3>'+esc('@'+row.handle)+
      '</h3><p>'+safeLink(row.originalUrl,'Open original article post')+'</p></div><span class="rpt-quoted-counter">'+
      esc(gtaNumber(row.qrtCount))+' QRTs</span></div><dl><div><dt>Original views</dt><dd>'+
      esc(gtaNumber(row.views))+'</dd></div><div><dt>QRT views</dt><dd>'+esc(gtaNumber(row.qrtViews))+
      '</dd></div><div><dt>Known paid spend</dt><dd>'+esc(gtaMoney(row.paidSpendKnown))+
      '</dd></div><div><dt>Human clicks</dt><dd>'+esc(gtaNumber(row.allTimeHumanClicks))+
      '</dd></div></dl><details><summary>Show linked paid QRTs</summary><ul>'+children+
      '</ul></details><p class="rpt-quoted-updated">X updated '+esc(gtaUKDate(row.metricAt))+
      '</p></article>';
  });
  const missing=summaries.unmatchedQrts||0;
  el('gtaPublishers').innerHTML=
    '<p class="rpt-quoted-note">Lifetime views on the original X articles quoted by paid promotions. Source views include organic exposure and must not be added to QRT views as unique reach.</p>'+
    (missing?'<p class="rpt-quoted-warning">'+esc(gtaNumber(missing))+
      ' published QRTs are not yet matched to their original X posts. Their views remain in the QRT tab.</p>':'')+
    (articles.length?'<div class="rpt-quoted-list">'+articles.join('')+'</div>':
      '<div class="empty-state">No original article links verified yet. Refresh X Stats to retrieve the quoted-post relationships. Existing QRT metrics remain available.</div>');
}

function renderGtaReport(){
  if(gtaState.tab==='quoted'){renderGtaQuotedArticles();return;}
  const originals=gtaState.tab==='originals';
  const report=originals?gtaState.report?.originals:gtaState.report,ready=report?.ready===true;
  const placements=ready?(report.publishers||[]).filter(p=>originals?['GTA1','GTA2'].includes(p.campaign):p.campaign==='GTAQ'):[];
  const rows=placements.filter(p=>p.posted===true);
  el('gtaScopeLabel').textContent=originals?'GTA VI · ORIGINAL POSTS & V2':'GTA VI · QRT PROMOTIONS';
  document.querySelectorAll('[data-gta-tab]').forEach(button=>{
    const active=button.dataset.gtaTab===gtaState.tab;
    button.classList.toggle('is-active',active);button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;
    if(active)el('gtaReportPanel').setAttribute('aria-labelledby',button.id);
  });
  el('gtaWeekLabel').textContent='Lifetime campaign performance';
  const status=el('gtaLiveStatus');status.textContent=ready?(report.warning?'Saved campaign data · '+gtaUKDate(report.sourceVerifiedAt):report.statsCached?'Saved stats · refreshing when available':report.source==='GOOGLE_SHEETS_LIVE'?((report.cached?'Cached sheet · ':'Sheet verified · ')+gtaUKDate(report.sourceVerifiedAt)):'Verified snapshot'):gtaState.error?'Report unavailable':'Loading report…';
  status.classList.toggle('is-live',ready);
  if(!gtaState.refreshing){const sourceStatus=gtaSourceStatus(report);if(sourceStatus){el('gtaRefreshStatus').textContent=sourceStatus.text;el('gtaRefreshStatus').className='x-refresh-status '+(sourceStatus.failed?'is-error':'is-success');el('gtaRefreshStatus').title=[report.shortIo?.lastSuccessfulAt?'Short.io last successful: '+gtaUKDate(report.shortIo.lastSuccessfulAt):'',report.metricLastSuccessfulAt?'X last verified: '+gtaUKDate(report.metricLastSuccessfulAt):''].filter(Boolean).join(' · ');}}
  const error=el('gtaReportError');const issues=rows.flatMap(p=>[p.clickError,p.metricError].filter(Boolean).map(message=>p.publisher+': '+message));const diagnostics=[gtaState.error,report?.warning,...issues].filter(Boolean);error.hidden=!diagnostics.length;error.innerHTML='<summary>Source details</summary><p>'+esc(diagnostics.join(' · '))+'</p>';
  const paid=placements.filter(p=>p.paid),posted=rows.filter(p=>p.posted===true&&safeUrl(p.postUrl));
  const knownPaid=paid.filter(p=>p.cost!==null&&Number.isFinite(Number(p.cost)));
  const spend=report?.summary?.paidSpend??(ready?knownPaid.reduce((n,p)=>n+Number(p.cost),0):null);
  const seen=posted.filter(p=>p.views!==null&&p.views!==undefined),views=seen.length?seen.reduce((n,p)=>n+Number(p.views),0):null;
  const defs=[['spend',originals?'Paid Post Spend':'Paid QRT Spend',gtaMoney(spend),`${knownPaid.length} paid ${originals?'posts':'QRTs'}`],['seven','X Views',gtaNumber(views),`${seen.length} of ${posted.length} live posts with verified views`],['published','Published Posts',ready?fmt(report?.summary?.publishedPosts??posted.length):'—',originals?'GTA VI · original posts & V2':'GTA VI · published QRT promotions']];
  const interactions=interactionSummary(posted);
  defs.push(['interactions','Total Interactions',gtaNumber(interactions.total),interactions.note]);
  renderEngagement('gta',ready?posted:[]);
  const shortIo=report?.shortIo?.metric==='humanClicks'?report.shortIo:null;
  defs.push(['shortio','Short.io Clicks',gtaNumber(shortIo?.total),`${shortIo?.verified||0} of ${shortIo?.totalPublishers||0} published links verified · ${shortIo?.linkCount||0} source links · all-time, not publication-attributed${shortIo?.stale?' · saved readings':''}${shortIo&&shortIo.verified<shortIo.totalPublishers?' · partial total':''}`]);
  el('gtaMetrics').innerHTML=defs.map(([kind,label,value,sub])=>`<${kind==='shortio'?'button type="button" aria-controls="gtaPublishers" data-gta-clicks':'div'} class="daily-metric daily-metric-${kind}"><span class="daily-metric-label">${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(sub)}</small></${kind==='shortio'?'button':'div'}>`).join('');
  el('gtaMetrics').querySelector('[data-gta-clicks]')?.addEventListener('click',()=>focusPromoClicks('gtaPublishers','All-time clicks'));
  const section=(title,publishers)=>`<section class="of-publisher-section"><div class="result-line"><h2>${esc(title)}<span class="heading-accent">.</span></h2><span class="section-count">${publishers.length}</span></div><div class="of-publisher-grid">${publishers.map(p=>{
    const live=p.posted===true,link=live?safeUrl(p.postUrl):safeUrl(p.profileUrl);
    const tag=link?'a':'div',attributes=link?` href="${esc(link)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${esc(p.publisher)} ${live?'live X post':'X profile'}"`:'';
    const prepared={...p,articleLabel:p.campaign==='GTAQ'?'GTA VI QRT':p.campaign==='GTA2'?'GTA VI V2 post':'GTA VI post',xViews:p.views,xLikes:p.likes,xComments:p.replies,xShares:p.reposts,xUpdated:p.metricAt||'',metricStatus:p.metricAt?(p.metricError?'last-known-good':'ok'):'unverified',campaignId:p.campaign,platform:'X',active:true};
    const info=articleCardContent(prepared,{live,promo:true,metricsOverride:[['views','X Views',p.views],['likes','Likes',p.likes],['spend','Paid total',p.paid?gtaMoney(p.cost):'Unpaid']]});
    const subtitle=p.campaign==='GTAQ'?'GTA VI QRT':p.campaign==='GTA2'?'GTA VI V2':'GTA VI original';
    const clickNote=' · Post-publication clicks: '+gtaNumber(p.clicks)+' · All-time human clicks: '+gtaNumber(p.allTimeClicks);

    return `<article class="of-publisher-entry"><${tag}${attributes} data-shortio-tracked="${Boolean(p.trackingUrl&&p.clickTracked!==false)}" data-shortio-clicks="${esc(p.clicks??'')}" data-shortio-cpc="${esc(p.cpc??'')}" data-shortio-note="${esc(p.clickError||clickNote)}" data-placement-code="${esc(p.code)}" data-post-url="${esc(safeUrl(p.postUrl))}" class="article-card of-post-card ${live?'live-article of-is-posted':''}">${info}</${tag}><p class="of-last-click">${esc(subtitle)}${esc(clickNote)}${p.metricAt?' · X updated '+esc(gtaUKDate(p.metricAt)):''}</p><div class="of-publisher-links">${gtaSafeLink(p.profileUrl,'X profile')}${gtaSafeLink(p.postUrl,'View post')}</div></article>`;
  }).join('')||'<div class="empty-state">No posts in this group.</div>'}</div></section>`;
  el('gtaPublishers').innerHTML=ready?section('Published X posts',posted):'<div class="empty-state">GTA VI data is temporarily unavailable.</div>';
}
async function loadGtaReport(force=false){
  if(gtaState.loading)return gtaState.loading;
  if(!force&&Date.now()-gtaState.lastLoadAt<45000&&gtaState.report?.ready)return;
  gtaState.lastLoadAt=Date.now();
  gtaState.loading=(async()=>{
    try{const response=await fetch('/.netlify/functions/gta-report'+(force?'?refresh=1':''),{cache:'no-store',signal:AbortSignal.timeout(30000)}),data=await response.json();
      if(!response.ok||!validReport(data,'publishers','ready'))throw new Error(data.error||'GTA VI report unavailable');
      if(!force&&gtaState.report?.publishers?.length&&data.publishers.length===0)
        throw new Error('Source temporarily empty; preserving saved GTA VI publishers');
      gtaState.report=data;gtaState.error='';saveReportCache('xtracker-gta-report-qrts-v1',gtaState.report);
    }catch(e){gtaState.error=String(e.message||e);}
    finally{gtaState.loading=null;preserveReadingPosition(renderGtaReport);}
  })();return gtaState.loading;
}
async function refreshGtaReport(){
  const button=el('gtaRefreshButton'),status=el('gtaRefreshStatus');if(gtaState.refreshing)return;
  gtaState.refreshing=true;button.disabled=true;button.setAttribute('aria-busy','true');button.classList.add('is-refreshing');
  status.className='x-refresh-status';status.textContent='Refreshing X and Short.io stats…';
  try{let response=await fetch('/.netlify/functions/gta-report',{method:'POST',cache:'no-store',signal:AbortSignal.timeout(20000)}),data=await response.json();
    if(!response.ok)throw new Error(data.error||'Refresh could not start');
    if(data.refresh){
      const jobId=data.refresh.id;
      while(['queued','running'].includes(data.refresh?.state)){
        status.textContent='Refreshing X and Short.io stats…';
        await new Promise(resolve=>setTimeout(resolve,2500));
        response=await fetch('/.netlify/functions/gta-report',{cache:'no-store',signal:AbortSignal.timeout(20000)});data=await response.json();
        if(!response.ok)throw new Error(data.error||'Refresh status unavailable; job continues on server');
        if(data.refresh?.id!==jobId)break;
        gtaState.report=data;saveReportCache('xtracker-gta-report-qrts-v1',data);renderGtaReport();
      }
      if(data.refresh?.state==='failed')throw new Error(data.refresh.error);
      if(!data.ready){response=await fetch('/.netlify/functions/gta-report',{cache:'no-store'});data=await response.json();}
      data.updated=data.refresh?.updated??0;data.total=data.refresh?.total??0;
    }
    if(!response.ok||!validReport(data,'publishers','ready'))throw new Error(data.error||'GTA VI metrics unavailable');
    gtaState.report=data;gtaState.error='';saveReportCache('xtracker-gta-report-qrts-v1',gtaState.report);renderGtaReport();
    const active=gtaState.tab==='originals'?data.originals:data,sourceStatus=gtaSourceStatus(active);
    if(sourceStatus){status.className='x-refresh-status '+(sourceStatus.failed?'is-error':'is-success');status.textContent=sourceStatus.text;}
    if(active?.shortIo?.lastSuccessfulAt)status.title='Short.io last successful: '+gtaUKDate(active.shortIo.lastSuccessfulAt);

  }catch(e){status.className='x-refresh-status is-error';status.textContent=String(e.message||e);}
  finally{gtaState.refreshing=false;button.disabled=false;button.removeAttribute('aria-busy');button.classList.remove('is-refreshing');}
}

function initGtaUi(){
  for(const prefix of ['of','gta'])el(prefix+'EngagementButton').addEventListener('click',()=>{
    const button=el(prefix+'EngagementButton'),expanded=button.getAttribute('aria-expanded')==='true';
    button.setAttribute('aria-expanded',String(!expanded));el(prefix+'EngagementDetails').hidden=expanded;
  });
  setInterval(()=>{if(!document.hidden&&(state.page==='gta-vi'||gtaState.report?.ready))void loadGtaReport();},60000);
  el('gtaRefreshButton').addEventListener('click',refreshGtaReport);
  const gtaTabs=[...document.querySelectorAll('[data-gta-tab]')];
  gtaTabs.forEach((button,index)=>{
    button.addEventListener('click',()=>{gtaState.tab=button.dataset.gtaTab;renderGtaReport();});
    button.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();
      const next=event.key==='Home'?0:event.key==='End'?gtaTabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+gtaTabs.length)%gtaTabs.length;
      gtaTabs[next].click();gtaTabs[next].focus();
    });
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&(state.page==='gta-vi'||gtaState.report?.ready))void loadGtaReport();});
}

function route(page,updateUrl=true){if(page==='boosted-tweets')page='x-rts';if(['report-all','report-harness','report-other','report-discord','report-gta','report-of','reporting'].includes(page)){page='dashboard';updateUrl=true;}closeDetails();closeEditor();const campaignRoute=page==='campaign-C001';const reportCode=String(page||'').match(/^report-(article-rt|guru|articles)$/)?.[1]||null;state.campaignFocus=campaignRoute?'C001':null;if(campaignRoute)el('campaignSearch').value='';const pg=reportCode?'reporting':campaignRoute?'of':['dashboard','campaigns','stats','historical','accounts','placements','of','x-rts','gta-vi','reporting'].includes(page)?page:'dashboard';state.page=pg;const reportNames={'article-rt':'X Article Boosts',guru:'Guru X RTs',articles:'X Articles'};document.title=pg==='gta-vi'?'GTA VI · '+defaultPageTitle:pg==='reporting'?(reportNames[reportCode]||'X Article Boosts')+' · '+defaultPageTitle:pg==='x-rts'?'X RTs · '+defaultPageTitle:defaultPageTitle;
  document.body.classList.toggle('is-home',pg==='dashboard');
  document.querySelectorAll('.site-page').forEach(e=>e.hidden=e.id!=='page-'+pg);
  document.querySelectorAll('[data-page]').forEach(e=>{const is=e.dataset.page===pg||(e.closest('.mobile-nav')&&e.dataset.page==='stats'&&pg==='campaigns');e.classList.toggle('is-active',is);e.setAttribute('aria-current',is?'page':'false');});
  const hash=campaignRoute?'campaign-C001':reportCode?'report-'+reportCode:pg;recordNavigation(hash,updateUrl);
  document.querySelectorAll('[data-campaign-report]').forEach(link=>link.setAttribute('aria-current',reportCode===link.dataset.campaignReport?'page':'false'));
  const promo=document.querySelector('.of-promo-button');promo.href=pg==='of'?'#dashboard':'#campaign-C001';promo.setAttribute('aria-label',pg==='of'?'OF Terms X Promo · Return to Dashboard':'OF Terms X Promo');
  const gtaCTA=el('gtaButton');if(gtaCTA){gtaCTA.href=pg==='gta-vi'?'#dashboard':'#gta-vi';gtaCTA.setAttribute('aria-current',pg==='gta-vi'?'page':'false');}
  if(pg==='x-rts'){renderBoosts();void loadBoosts();}
  if(pg==='gta-vi'){renderGtaReport();void loadGtaReport();}
  if(pg==='reporting')window.XTrackerCampaignReporting?.show(reportCode||'article-rt');
  if(pg==='dashboard'){renderWeekLabels();renderWeekly();renderKpis();}if(pg==='campaigns')renderCampaigns();
  if(pg==='of'){renderOfReport();if(!state.ofLoading&&Date.now()-(state.ofLastLoadedAt||0)>45000)void loadOfReport();}if(pg==='stats')renderCharts();window.scrollTo({top:0,behavior:'instant'});
}
function owner(next){state.owner=next;storage.set('xtracker-owner-v4',next);
  document.querySelectorAll('[data-owner]').forEach(b=>{const yes=b.dataset.owner===next;b.classList.toggle('is-selected',yes);b.setAttribute('aria-pressed',String(yes));});render();}
async function copyLink(url){if(!safeUrl(url)){notify('Link unavailable');return;}
  try{await navigator.clipboard.writeText(url);notify('Link copied');}catch{notify('Clipboard unavailable');}
}
function initReorder(){
  const wrap=el('dashboardSections'),valid=['summary','articles','upcoming'];let saved=[];
  try{saved=JSON.parse(storage.get('xtracker-section-order-v5')||'[]');if(!saved.length){const old=JSON.parse(storage.get('xtracker-section-order-v4')||storage.get('xtracker-section-order-v3')||'[]');if(old.length)saved=['summary',...old.filter(x=>x==='articles').flatMap(()=>['articles','upcoming'])];}}catch{}
  for(const name of ['summary',...(valid.every(x=>saved.includes(x))?saved.filter(x=>valid.includes(x)&&x!=='summary'):valid.filter(x=>x!=='summary'))]){const e=wrap.querySelector(`[data-section="${name}"]`);if(e)wrap.appendChild(e);}
  const persist=()=>storage.set('xtracker-section-order-v5',JSON.stringify([...wrap.children].map(x=>x.dataset.section)));
  for(const handle of wrap.querySelectorAll('[data-drag]')){
    const section=handle.closest('[data-section]');let drag=null;
    const begin=()=>{if(!drag)return;drag.active=true;section.classList.add('is-dragging');handle.setAttribute('aria-grabbed','true');};
    const finish=()=>{if(!drag)return;clearTimeout(drag.timer);if(drag.active){section.classList.remove('is-dragging');handle.setAttribute('aria-grabbed','false');persist();}drag=null;};
    handle.addEventListener('pointerdown',e=>{if(e.button!==0||drag)return;drag={id:e.pointerId,startX:e.clientX,startY:e.clientY,active:false,isTouch:e.pointerType==='touch',timer:0};try{handle.setPointerCapture(e.pointerId);}catch{};if(drag.isTouch)drag.timer=setTimeout(begin,340);});
    handle.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;
      const distance=Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY);
      if(!drag.active){if(drag.isTouch){if(distance>12)finish();return;}if(distance>5)begin();else return;}
      e.preventDefault();const pointed=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-section]');if(!pointed||pointed===section||pointed.parentElement!==wrap)return;
      const center=pointed.getBoundingClientRect().top+pointed.getBoundingClientRect().height/2;
      if(e.clientY<center)wrap.insertBefore(section,pointed);else wrap.insertBefore(section,pointed.nextSibling);
    });
    handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',finish);handle.addEventListener('lostpointercapture',finish);
    handle.addEventListener('keydown',e=>{if(!['ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const other=e.key==='ArrowUp'?section.previousElementSibling:section.nextElementSibling;
      if(other?.matches('[data-section]')){if(e.key==='ArrowUp')wrap.insertBefore(section,other);else wrap.insertBefore(other,section);persist();notify('Order saved');}});
  }
}
function events(){
  document.querySelector('.of-promo-button').addEventListener('click',event=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();route(state.page==='of'?'dashboard':'campaign-C001');});
  el('refreshXStats').addEventListener('click',refreshXStats);
  el('reloadAllButton').addEventListener('click',reloadAllData);
  document.querySelectorAll('[data-refresh]').forEach(button=>button.addEventListener('click',button.dataset.refresh==='boosts'?refreshBoostStats:button.dataset.refresh==='of'?refreshOfReport:refreshXStats));
  document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>route(b.dataset.page)));
  document.querySelectorAll('[data-owner]').forEach(b=>b.addEventListener('click',()=>owner(b.dataset.owner)));
  el('homeArticleSort').addEventListener('change',renderWeekly);
  el('dashboardWeekSelect').addEventListener('change',e=>{
    state.dashboardWeek=e.target.value;
    storage.set(WEEK_CHOICE_KEYS.dashboardWeek,state.dashboardWeek);
    renderWeekLabels();renderWeekly();renderKpis();
  });
  for(const id of ['trackerStatus','trackerPaid','trackerPlatform','trackerCampaign','trackerSort','trackerFrom','trackerTo','trackerMinClicks','trackerMinViews','trackerMaxCost'])
    el(id).addEventListener(['trackerMinClicks','trackerMinViews','trackerMaxCost'].includes(id)?'input':'change',renderTracker);
  el('resetTrackerFilters').addEventListener('click',()=>{
    for(const id of ['trackerFrom','trackerTo','trackerMinClicks','trackerMinViews','trackerMaxCost'])el(id).value='';
    for(const id of ['trackerStatus','trackerPaid','trackerPlatform','trackerCampaign'])el(id).value='ALL';
    el('trackerSort').value='recent';renderTracker();
  });
  for(const id of ['accountSearch','accountSort','filterClicks','filterUtmDollar','filterSpent','filterViews','filterLikes','filterEngagement','filterPosts','filterLastUsed','filterLastUsedTo','filterAccountFrom','filterAccountTo']){
    const node=el(id);node.addEventListener(node.tagName==='SELECT'?'change':'input',renderAccounts);
  }
  for(const id of ['campaignSearch','campaignSort'])el(id).addEventListener(id==='campaignSearch'?'input':'change',renderCampaigns);
  el('resetAccountFilters').addEventListener('click',()=>{
    document.querySelectorAll('#accountFilters input').forEach(n=>n.value='');
    el('accountSearch').value='';el('accountSort').value='recent';
    renderAccounts();
  });
  el('historicalSort').addEventListener('change',renderHistorical);
  el('historicalWeekTabs').addEventListener('click',e=>{
    const tab=e.target.closest('[data-historical-week]');if(!tab)return;
    state.historicalWeek=tab.dataset.historicalWeek;
    storage.set(WEEK_CHOICE_KEYS.historicalWeek,state.historicalWeek);
    renderHistorical();
  });
  el('historicalWeekTabs').addEventListener('keydown',e=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
    const tabs=[...el('historicalWeekTabs').querySelectorAll('[data-historical-week]')];
    const index=tabs.indexOf(document.activeElement);if(index<0)return;
    e.preventDefault();
    const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(index+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
    state.historicalWeek=tabs[next].dataset.historicalWeek;
    storage.set(WEEK_CHOICE_KEYS.historicalWeek,state.historicalWeek);
    renderHistorical();el('historical-tab-'+state.historicalWeek)?.focus();
  });
  el('newCampaignButton').addEventListener('click',()=>openEditor('newCampaign'));
  el('newPlacementButton').addEventListener('click',()=>openEditor('newPlacement'));
  el('bulkSave').addEventListener('click',saveBulk);
  document.body.addEventListener('click',e=>{
    const copy=e.target.closest('[data-copy]');if(copy){copyLink(copy.dataset.copy);return;}
    const detail=e.target.closest('[data-detail]');if(detail){openDetails('placement',detail.dataset.detail);return;}
    const account=e.target.closest('[data-account]');if(account){openDetails('account',account.dataset.account);return;}
    const campaign=e.target.closest('[data-campaign-detail]');if(campaign){openDetails('campaign',campaign.dataset.campaignDetail);return;}
    const editPlacement=e.target.closest('[data-edit-placement]');if(editPlacement){openEditor('editPlacement',editPlacement.dataset.editPlacement);return;}
    const editCampaign=e.target.closest('[data-edit-campaign]');if(editCampaign){openEditor('editCampaign',editCampaign.dataset.editCampaign);return;}
    const place=e.target.closest('[data-new-placement-campaign]');if(place){openEditor('newPlacement',place.dataset.newPlacementCampaign);return;}
    const metrics=e.target.closest('[data-record-metrics]');if(metrics){openEditor('metrics',metrics.dataset.recordMetrics);return;}
  });
  document.body.addEventListener('change',e=>{const ch=e.target.closest('[data-select-placement]');if(!ch)return;
    if(ch.checked)state.selected.add(ch.dataset.selectPlacement);else state.selected.delete(ch.dataset.selectPlacement);renderTracker();});
  document.body.addEventListener('submit',e=>{if(e.target.id==='unlockForm'){e.preventDefault();onUnlock(e.target);}else if(e.target.id==='entityForm'){e.preventDefault();onEntity(e.target);}});
  document.body.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('.account-row[data-account]')){e.preventDefault();openDetails('account',e.target.dataset.account);}});
  el('modalClose').addEventListener('click',closeDetails);el('editClose').addEventListener('click',closeEditor);
  el('articleModal').addEventListener('click',e=>{if(e.target===el('articleModal'))closeDetails();});
  el('editModal').addEventListener('click',e=>{if(e.target===el('editModal'))closeEditor();});
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){if(!el('editModal').hidden)closeEditor();else if(!el('articleModal').hidden)closeDetails();}
    if(e.key==='Tab'){const shade=!el('editModal').hidden?el('editModal'):!el('articleModal').hidden?el('articleModal'):null;if(!shade)return;
      const items=[...shade.querySelectorAll('a[href],input,select,textarea,button:not([disabled])')].filter(x=>x.getClientRects().length>0);
      if(!items.length)return;const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
  });
  document.querySelectorAll('[data-back]').forEach(button=>button.addEventListener('click',navigateBack));
  window.addEventListener('hashchange',()=>route(location.hash.slice(1),false));
  window.addEventListener('resize',()=>requestAnimationFrame(()=>fitDailyMetricNumbers()),{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){scheduleWeekRollover();tickAges();if(Date.now()-(state.lastRefreshAttemptAt||0)>45000)load();if(Date.now()-(state.ofLastLoadedAt||0)>45000)loadOfReport();}});
  setInterval(()=>{if(!document.hidden)tickAges();},15000);
  setInterval(()=>{if(!document.hidden){if(Date.now()-(state.lastRefreshAttemptAt||0)>45000)load();if(Date.now()-(state.ofLastLoadedAt||0)>45000)loadOfReport();}},60000);
}
// The live graph redraws when its available width changes (phone rotation,
// split-screen resizing, returning to the Dashboard), without scaling labels.
if(typeof ResizeObserver!=='undefined'){
  let pendingDailyResize=false;
  new ResizeObserver(()=>{
    if(pendingDailyResize)return;
    pendingDailyResize=true;
    requestAnimationFrame(()=>{
      pendingDailyResize=false;
      const graph=el('dailyTrendChart');
      if(graph&&graph.clientWidth&&Math.abs(graph.clientWidth-lastDailyChartWidth)>2)renderDailyOverview();
    });
  }).observe(el('dailyTrendChart'));
}else{
  window.addEventListener('resize',()=>{
    const graph=el('dailyTrendChart');
    if(graph&&graph.clientWidth&&Math.abs(graph.clientWidth-lastDailyChartWidth)>2)renderDailyOverview();
  },{passive:true});
}
// Fit presentation text after rendering, route changes, fonts loading and resizing.
// Values remain complete and retain their original formatting and precision.
const fittedTextSelector=[
  '.article-kpi-value','.kpi-value','.primary-number','.mini-metric strong','.tracker-metric strong',
  '.historical-week-kpi strong','.historical-card-numbers strong',
  '.campaign-summary-clicks strong','.campaign-entry-stats strong',
  '.campaign-summary-metrics strong','.account-mobile-metrics strong',
  '.daily-metric strong','.daily-projection strong','.modal-primary-number',
  '.modal-metric strong','.kpi-label','.daily-metric-label',
  '.historical-week-kpi > span','.article-campaign-chip','.article-kpi-label'
].join(',');
let textFitPending=false;
function scheduleTextFit(){
  if(textFitPending)return;
  textFitPending=true;
  requestAnimationFrame(()=>{
    textFitPending=false;
    document.querySelectorAll(fittedTextSelector).forEach(value=>{
      if(!value.getClientRects().length)return;
      value.style.removeProperty('font-size');
      const base=parseFloat(getComputedStyle(value).fontSize);
      const available=value.clientWidth;
      if(!base||!available)return;
      let size=base;
      for(let attempt=0;attempt<4&&value.scrollWidth>available+1;attempt++){
        size=Math.max(9,size*available/value.scrollWidth*.94);
        value.style.setProperty('font-size',size+'px','important');
      }
    });
  });
}
new MutationObserver(scheduleTextFit).observe(document.body,{
  subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden']
});
window.addEventListener('resize',scheduleTextFit,{passive:true});
window.addEventListener('resize',()=>{if(state.page==='of')renderOfReport();},{passive:true});
if(document.fonts?.ready)document.fonts.ready.then(scheduleTextFit);
scheduleTextFit();
const boostsState={tweets:[],loaded:false,loading:null,lastLoad:0,error:''};
try{const saved=readReportCache('xtracker-boosts-v1','tweets','ok');if(saved){boostsState.tweets=saved.tweets;boostsState.loaded=true;}}catch{}
const boostNumber=v=>v===null||v===undefined?'—':fmt(v);
const boostMoney=v=>v===null||v===undefined?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(v);
const boostPercent=v=>v===null||v===undefined?'—':Number(v).toFixed(2)+'%';
const boostDate=at=>new Intl.DateTimeFormat('en-GB',{timeZone:TZ,dateStyle:'medium',timeStyle:'short'}).format(new Date(at))+' UK';
const boostURL=t=>'https://x.com/'+t.handle+'/status/'+t.id;
// XTRACKER_RT_REFRESH_FIX_V1
function updateBoostCooldown(data){
  if(data){
    const epoch=v=>typeof v==='string'?Date.parse(v):Number(v);
    const next=epoch(data.nextRefreshAt),remoteNow=epoch(data.serverNow);
    const remaining=Number.isFinite(next)&&Number.isFinite(remoteNow)?next-remoteNow:Number(data.retryAfter)*1000;
    if(Number.isFinite(remaining))boostsState.refreshAvailableAt=Date.now()+Math.max(0,remaining);
  }
  clearTimeout(boostsState.cooldownTimer);
  const secs=Math.max(0,Math.ceil(((boostsState.refreshAvailableAt||0)-Date.now())/1000));
  const button=document.querySelector('[data-refresh="boosts"]');
  if(button)button.disabled=Boolean(boostsState.refreshing);
  const cooldown=el('boostRefreshCooldown');
  if(cooldown)cooldown.textContent=secs?`New X readings available in ${Math.floor(secs/60)}:${String(secs%60).padStart(2,'0')}`:'';
  if(secs)boostsState.cooldownTimer=setTimeout(()=>updateBoostCooldown(),1000);
}
async function refreshBoostStats(){
  const button=document.querySelector('[data-refresh="boosts"]'),status=el('boostRefreshStatus');
  if(!button||!status||boostsState.refreshing)return;
  boostsState.refreshing=true;button.disabled=true;button.classList.add('is-refreshing');button.setAttribute('aria-busy','true');
  status.className='x-refresh-status';status.textContent='Checking X stats…';
  try{
    if(boostsState.loading)await boostsState.loading;
    // This branch deliberately makes a safe GET only, never an unnecessary paid provider request.
    if(Date.now()<(boostsState.refreshAvailableAt||0)){
      await loadBoosts(true);
      status.className='x-refresh-status';status.textContent='Latest saved X readings shown';
      return;
    }
    const response=await fetch('/.netlify/functions/boosts',{method:'POST',cache:'no-store',signal:AbortSignal.timeout(45000)});
    const result=await response.json().catch(()=>({error:'Invalid refresh response'}));
    updateBoostCooldown(result);
    if(response.status===429||result.skipped===true||result.refreshReason==='cooldown'){
      // A recent successful server refresh is not an error. Do not claim a new fetch occurred.
      await loadBoosts(true);
      status.className='x-refresh-status';status.textContent='Latest saved X readings shown';
      return;
    }
    if(!response.ok&&!(Number(result.updated)>0&&Array.isArray(result.tweets)))throw new Error(result.error||'X provider refresh failed');
    if(!Array.isArray(result.tweets)&&!(Number(result.updated)>0))throw new Error(result.error||'X provider returned no new measurements');
    // Reload from the actual server source of truth so all KPI, table and modal state agrees.
    await loadBoosts(true);
    const updated=Number(result.updated)||0,total=Number(result.total)||boostsState.tweets.length;
    if(!updated){status.className='x-refresh-status';status.textContent='No new readings available';}
    else if(total&&updated<total){status.className='x-refresh-status';status.textContent=`Updated ${updated} of ${total} tweets · other saved readings retained`;}
    else{status.className='x-refresh-status is-success';status.textContent='X stats updated';}
  }catch(e){
    // Always retain cached metrics and show an accurate failure only when a real request failed.
    status.className='x-refresh-status is-error';
    status.textContent=e?.name==='TimeoutError'?'Refresh timed out · saved X stats preserved':String(e.message||e);
    try{await loadBoosts(true);}catch{}
  }finally{
    boostsState.refreshing=false;button.classList.remove('is-refreshing');button.removeAttribute('aria-busy');
    updateBoostCooldown();
  }
}

async function loadBoosts(force=false){
  if(boostsState.loading){if(!force)return boostsState.loading;await boostsState.loading;}
  if(!force&&Date.now()-boostsState.lastLoad<60000)return;
  boostsState.lastLoad=Date.now();
  boostsState.loading=(async()=>{try{
    const r=await fetch('/.netlify/functions/boosts',{cache:'no-store',signal:AbortSignal.timeout(15000)}),data=await r.json();
    if(!r.ok||!validReport(data,'tweets','ok'))throw new Error('Saved readings are temporarily unavailable');
    if(!force&&boostsState.loaded&&boostsState.tweets.length&&data.tweets.length===0)
      throw new Error('Source temporarily empty; preserving saved X boost records');
    updateBoostCooldown(data);
    const changed=JSON.stringify(boostsState.tweets)!==JSON.stringify(data.tweets)||!boostsState.loaded||Boolean(boostsState.error);
    const merged=retainCachedStats(data,{tweets:boostsState.tweets});boostsState.tweets=merged.tweets;boostsState.loaded=true;boostsState.error='';saveReportCache('xtracker-boosts-v1',merged);
    if(changed){renderBoosts();if(state.modalType==='boost')showBoostDetails(state.modalCode,false);}
  }catch{if(!boostsState.error){boostsState.error='Saved readings are temporarily unavailable';renderBoosts();}}
  finally{boostsState.loading=null;}})();
  return boostsState.loading;
}
function renderBoosts(){
  const rows=[...boostsState.tweets],known=rows.filter(t=>Number.isFinite(t.spend)),seen=rows.filter(t=>t.views!==null&&t.views!==undefined),spend=known.length?known.reduce((s,t)=>s+t.spend,0):null;
  const views=seen.length?seen.reduce((s,t)=>s+t.views,0):null;
  const matched=known.filter(t=>t.views>0),eff=known.length&&matched.length===known.length?1000*matched.reduce((s,t)=>s+t.spend,0)/matched.reduce((s,t)=>s+t.views,0):null;
  const interactions=interactionSummary(rows);
  el('boostKpis').innerHTML=[['Known Boost Spend ($)',boostMoney(spend),`${known.length} of ${rows.length} with verified spend`],['Combined X Views',boostNumber(views),`${seen.length} of ${rows.length} with views`],['Effective Cost / 1K Views',eff===null?'—':boostMoney(eff),'Known spend + available views'],['Total interactions',boostNumber(interactions.total),interactions.note]].map(([label,value,note],i)=>`<div class="daily-metric daily-metric-${['spend','seven','click','interactions'][i]}"><span class="daily-metric-label">${label}</span><strong>${value}</strong><small>${note}</small></div>`).join('');
  el('boostStatus').textContent=(boostsState.error?(boostsState.loaded?'Showing saved figures. New readings are temporarily unavailable.':'X RTs is temporarily unavailable.'):null)||(boostsState.loaded?'Views include organic traffic · Refreshes every 2h':'Loading saved tweet records…');
  const sort=el('boostSort').value,field={spend:'spend',views:'views',engagement:'engagement',efficiency:'efficiency'}[sort];
  rows.sort((a,b)=>{if(!field)return new Date(b.added_at)-new Date(a.added_at)||b.id.localeCompare(a.id);const x=a[field],y=b[field];return x==null?(y==null?0:1):y==null?-1:sort==='efficiency'?x-y:y-x;});
  const values=t=>[boostMoney(t.spend),boostNumber(t.views),boostNumber(t.likes),boostNumber(t.reposts),boostNumber(t.replies),boostPercent(t.engagement),t.efficiency==null?'—':boostMoney(t.efficiency),t.growth24==null?'Not enough history':boostNumber(t.growth24)];
  el('boostRows').innerHTML=rows.map(t=>`<tr class="account-row" data-boost="${esc(t.id)}" tabindex="0" role="button" aria-label="View ${esc(t.name)} tweet"><td><strong>${esc(t.name)}</strong><br><small>@${esc(t.handle)}</small></td>${values(t).map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="9">${boostsState.loaded?'No boosted tweets.':boostsState.error?'Saved records could not be loaded.':'Loading saved tweets…'}</td></tr>`;
  const labels=['Actual boost spend','X views','Likes','Reposts','Replies','Engagement rate','Cost / 1K views','Views gained · 24h'];
  el('boostMobile').innerHTML=rows.map(t=>`<button class="account-mobile-card" data-boost="${esc(t.id)}"><span class="account-mobile-top"><strong>${esc(t.name)}</strong><small>@${esc(t.handle)}</small></span><span class="boost-card-metrics">${values(t).map((v,i)=>`<span><strong>${esc(v)}</strong><small>${labels[i]}</small></span>`).join('')}</span></button>`).join('');
}
function boostChart(t){
  const samples=(t.history||[]).filter(s=>s.views!=null);if(samples.length<2)return '<p class="empty-state">Not enough history</p>';
  const times=samples.map(s=>new Date(s.at).getTime()),vals=samples.map(s=>s.views),min=Math.min(...vals),range=Math.max(...vals)-min||1,span=times.at(-1)-times[0]||1;
  const points=samples.map((s,i)=>`${30+640*(times[i]-times[0])/span},${180-150*(s.views-min)/range}`).join(' ');
  return `<svg class="boost-chart" viewBox="0 0 700 210" role="img" aria-label="Public X views over time"><polyline points="${points}" fill="none" stroke="var(--blue)" stroke-width="3"/>${samples.map((s,i)=>`<circle cx="${30+640*(times[i]-times[0])/span}" cy="${180-150*(s.views-min)/range}" r="3" fill="var(--blue)"><title>${esc(boostDate(s.at))}: ${fmt(s.views)} views</title></circle>`).join('')}</svg><p>${esc(boostDate(samples[0].at))} — ${esc(boostDate(samples.at(-1).at))}</p>`;
}
function showBoostDetails(id,focus=true){
  const t=boostsState.tweets.find(t=>t.id===id);if(!t)return;
  const signature=JSON.stringify(t);
  if(!focus&&boostsState.detailSignature===signature&&!el('articleModal').hidden)return;
  boostsState.detailSignature=signature;
  if(focus)state.lastFocus=document.activeElement;
  state.modalType='boost';state.modalCode=id;
  el('modalOwner').textContent='Original X tweet';el('articleModal').classList.remove('modal-is-posted','modal-is-unposted');
  const metrics=[['Actual boost spend',boostMoney(t.spend)],['X views',boostNumber(t.views)],['Likes',boostNumber(t.likes)],['Reposts',boostNumber(t.reposts)],['Replies',boostNumber(t.replies)],['Engagement rate',boostPercent(t.engagement)],['Effective cost / 1K total views',t.efficiency==null?'—':boostMoney(t.efficiency)],['24-hour view growth',t.growth24==null?'Not enough history':boostNumber(t.growth24)],['7-day view growth',t.growth7==null?'Not enough history':boostNumber(t.growth7)]];
  el('modalBody').innerHTML=`<h2 class="modal-title" id="modalTitle">${esc(t.name)}<span class="heading-accent">.</span></h2><p>@${esc(t.handle)}</p><div class="modal-links"><a class="button" href="${esc(boostURL(t))}" target="_blank" rel="noopener noreferrer">Original X post</a><button class="button" data-boost-edit="${esc(id)}">Edit tweet / spend</button></div><p class="boost-text">${esc(t.tweet_text||'Tweet text is currently unavailable.')}</p><div class="modal-metrics">${metrics.map(([label,val])=>`<div class="modal-metric"><span>${label}</span><strong>${esc(val)}</strong></div>`).join('')}</div><p>X metrics updated: ${t.at?esc(boostDate(t.at)):'—'}</p>${t.error?`<p role="status">${esc(t.error)}</p>`:''}<h3>Views over time</h3>${boostChart(t)}<p>Public views include organic traffic. Unknown costs are excluded from spending totals.</p>`;
  el('articleModal').hidden=false;document.body.classList.add('modal-open');if(focus)el('modalClose').focus();
}
function boostEditorHtml(id){
  const t=boostsState.tweets.find(t=>t.id===id);
  return `<h2 class="modal-title" id="editModalTitle">${t?'Edit tweet':'Add original tweet'}<span class="heading-accent">.</span></h2><form class="edit-form" id="boostForm" data-id="${esc(id||'')}">${t?`${editField('Original account name','name','text',t.name,'required maxlength="100"')}${editField('Total actual boost spend (USD)','spend','number',t.spend??'','min="0" max="999999999999.99" step="0.01"')}<p>Leave blank when unknown. Enter the combined amount actually paid to amplify this tweet.</p>`:editField('Original X status URL','url','url','','required placeholder="https://x.com/handle/status/…"')}<button class="button button-primary" type="submit">${t?'Save changes':'Add Tweet'}</button>${t?'<button class="button" type="button" id="boostRemove">Remove tweet</button><label id="boostRemoveConfirm" hidden><input name="confirmRemoval" type="checkbox"> Confirm removal from X RTs</label>':''}<p id="boostFormStatus" role="status"></p></form>`;
}
async function saveBoostForm(form,remove=false){
  const raw=Object.fromEntries(new FormData(form)),id=form.dataset.id,btn=form.querySelector('[type="submit"]');btn.disabled=true;
  try{await adminSend(remove?{type:'boostRemove',id}:id?{type:'boostUpdate',id,name:raw.name,spend:raw.spend}:{type:'boostAdd',url:raw.url});closeEditor();await loadBoosts(true);notify('X RTs saved');}
  catch(e){const status=el('boostFormStatus');if(status)status.textContent=e.message;else notify('Changes saved; showing last loaded figures.');}finally{btn.disabled=false;}
}
function initBoosts(){
  el('boostSort').addEventListener('change',renderBoosts);
  el('boostAdd').addEventListener('click',()=>openEditor('boost',''));
  document.addEventListener('click',e=>{const row=e.target.closest('[data-boost]');if(row)showBoostDetails(row.dataset.boost);const edit=e.target.closest('[data-boost-edit]');if(edit)openEditor('boost',edit.dataset.boostEdit);if(e.target.id==='boostRemove'){const label=el('boostRemoveConfirm');label.hidden=false;if(label.querySelector('input').checked)void saveBoostForm(el('boostForm'),true);else el('boostFormStatus').textContent='Confirm removal, then press Remove tweet again.';}});
  document.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)&&e.target.matches('tr[data-boost]')){e.preventDefault();showBoostDetails(e.target.dataset.boost);}});
  document.addEventListener('submit',e=>{if(e.target.id==='boostForm'){e.preventDefault();void saveBoostForm(e.target);}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&(state.page==='x-rts'||boostsState.loaded))void loadBoosts();});
  setInterval(()=>{if(!document.hidden&&(state.page==='x-rts'||boostsState.loaded))void loadBoosts();},60000);
  renderBoosts();
}

restoreGbpRate();
initReorder();events();initBoosts();initGtaUi();
renderWeekLabels();scheduleWeekRollover();renderKpis();
try{const cached=readReportCache('xtracker-dashboard-cache-v1','placements','ok');if(cached?.ok&&Array.isArray(cached.placements))applyDashboard({...cached,cached:true});}catch{}
try{const cached=readReportCache('xtracker-of-cache-v1','publishers','ready');if(cached?.ready)state.ofCampaign={...cached,cached:true};}catch{}
route(location.hash.slice(1),false);load();if(!state.ofLoading)loadOfReport();
})();

