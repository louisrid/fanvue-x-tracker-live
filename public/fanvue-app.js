/* Fanvue Marketing Dashboard: shell, router and the eight pages (DESIGN §4).
   Presentation only. Data comes from the existing adapters: campaign-reporting.js
   (campaign-overview and Discord feeds) and app.js (dashboard, OF, GTA and boosts
   feeds, record views, editors and refresh logic). Nothing here writes data. */
(function(){
  'use strict';
  const C=window.FanvueCore,U=window.FanvueUI,esc=C.escapeHtml,M=C.M;
  const $=id=>document.getElementById(id);
  const APP_NAME='Fanvue Marketing Dashboard';

  /* ---------- data bridge (read-only) ---------- */
  const D={
    app:()=>window.XTrackerApp||null,
    rep:()=>window.XTrackerCampaignReporting||null,
    overview(){return this.rep()?.getData?.()||null;},
    overviewStatus(){return this.rep()?.status?.()||{};},
    discord(){return this.rep()?.discord?.()||{};},
    dashboard(){return this.app()?.dashboard?.()||null;},
    of(){return this.app()?.of?.()||{};},
    gta(){return this.app()?.gta?.()||{};},
    campaign(id){return this.overview()?.campaigns?.find(c=>c.id===id)||null;}
  };
  const directory=window.FanvueDirectory.state;
  const loadDirectory=()=>window.FanvueDirectory.load();
  const ensured=new Set();
  function ensure(name){
    if(ensured.has(name))return;ensured.add(name);
    try{
      if(name==='overview')void D.rep()?.ensure?.();
      if(name==='discord')void D.rep()?.refreshDiscord?.(false);
      if(name==='gta')void D.app()?.loadGta?.(false);
      if(name==='of')void D.app()?.loadOf?.(false);
      if(name==='directory')void loadDirectory();
    }catch(e){console.warn('Source load failed',name,e);}
  }

  /* ---------- routes ---------- */
  // Viral QRTs is a view of GTA VI's Mandy group (owner, 26 Nov): its own page, but counted once, inside GTA VI.
  const VIRAL={key:'viral-qrts',name:'Viral QRTs',icon:'zap',color:'amber'};
  // Menu order (owner, 26 Nov): Dashboard; campaigns by size and kind; community; Accounts last.
  const NAV_ORDER=['gta-vi','viral-qrts','x-articles','of-terms','guru-promotion'];
  const PAGES=[
    {key:'home',title:'Dashboard',icon:'home',group:'general'},
    ...NAV_ORDER.map(k=>k==='viral-qrts'?VIRAL:C.CAMPAIGNS.find(c=>c.key===k)).filter(Boolean).map(c=>({key:c.key,title:c.name,icon:c.icon,group:'paid',color:c.color})),
    {key:'discord',title:'Discord',icon:'discord',group:'community'},
    {key:'all-accounts',title:'Accounts',icon:'users',group:'more'}
  ];
  const RECORDS={
    placements:{title:'Article tracker',parent:'x-articles'},
    accounts:{title:'Accounts',parent:'x-articles'},
    campaigns:{title:'Campaigns',parent:'x-articles'},
    'x-rts':{title:'Promoted posts',parent:'guru-promotion'}
  };
  /* Every legacy hash keeps working: it opens the matching page, view or record list. */
  const LEGACY={
    '':'home',dashboard:'home',home:'home',stats:'home',historical:'home','report-all':'home',reporting:'home','report-other':'home',
    discord:'discord','report-discord':'discord',
    'report-articles':'x-articles','report-article-rt':'x-articles/paid-reposts',articles:'x-articles/original-posts',upcoming:'x-articles/original-posts',
    'gta-vi':'gta-vi','report-gta':'gta-vi',
    'campaign-C001':'of-terms','report-of':'of-terms',of:'of-terms',
    'report-harness':'home',
    'report-guru':'guru-promotion',
    'boosted-tweets':'x-rts'
  };
  function parseHash(raw=location.hash){
    let h=decodeURIComponent(String(raw||'').replace(/^#/,'')).trim();
    if(h in LEGACY)h=LEGACY[h];
    if(RECORDS[h])return {kind:'records',key:h,canonical:h};
    const [page,view]=h.split('/');
    if(PAGES.some(p=>p.key===page))return {kind:'page',key:page,view:view||'',canonical:view?page+'/'+view:page};
    if(page==='campaign'&&view)return {kind:'added',key:view,canonical:'campaign/'+view};
    return {kind:'page',key:'home',view:'',canonical:'home'};
  }

  /* ---------- per-page interface state ---------- */
  const ui={};
  const pageState=key=>ui[key]||(ui[key]={chart:{},charts:{},tables:{},view:''});
  // Each chart keeps its own metric and display choice (a page can show a bar card and a main chart).
  const chartState=(page,id)=>{const s=pageState(page);return s.charts[id]||(s.charts[id]={});};
  const tableState=(page,id)=>{const s=pageState(page);return s.tables[id]||(s.tables[id]={sort:null,q:'',expanded:new Set(),filter:''});};

  /* ---------- shared formatting helpers ---------- */
  const metric=(label,iconName,m,format='count',note)=>({label,icon:iconName,metric:m,format,note});
  const outcomeItems=(c)=>[
    metric('Signups','user',c?.signups||M.na(C.OUTCOME_REASON)),
    metric('KYC','shield',c?.kyc||M.na(C.OUTCOME_REASON)),
    metric('Earning Creators','check',c?.earning||M.na(C.OUTCOME_REASON))
  ];
  const feedDown=()=>Boolean(D.overviewStatus().error)&&!D.overview();
  const FEED_DOWN='Data unavailable. The reporting feed did not respond and this browser has no saved copy yet.';
  // Loading placeholders list only the figures each page can show, so the strip does not jump.
  const loadingStrip=labels=>U.strip(labels.map(([l,i])=>metric(l,i,feedDown()?M.na(FEED_DOWN):M.loading())));
  const waiting=text=>feedDown()?'Data Unavailable':text;
  const money=v=>C.num(v)===null?'':esc(C.money(v));
  const count=v=>C.num(v)===null?'':esc(C.full(v));
  const when=v=>v?esc(C.stamp(v)):'';
  // One restrained dash for an unavailable cell; the reason is available on hover, focus and to screen readers.
  const dash=reason=>U.reasonButton('–',reason||'Not available.','fv-dash');
  const section=title=>'<h2 class="fv-section-title">'+esc(title)+'</h2>';
  const payState=r=>r.planned===true?'Planned':r.paid===true?'Paid':C.num(r.cost)!==null?'Unpaid':'';
  const payStatus=r=>{const s=payState(r);return s==='Paid'?U.status('Paid','good'):s?U.status(s):'';};
  // A post X reports as not found (HTTP 404) was deleted or hidden by its publisher after going live.
  const isDeleted=r=>r?.posted===true&&(/not_found/i.test(String(r.metricErrorCategory||''))||/HTTP 404/.test(String(r.metricError||'')));
  const viewsOfRow=r=>{const v=C.num(r.views??r.xViews);if(v!==null)return M.value(v,isDeleted(r)?{reason:'Last verified views before the post was deleted on X.'}:{});
    if(isDeleted(r))return M.na('Deleted on X before a reading was taken.');
    if(r.posted!==true)return M.na('Not live yet.');
    if(!C.postId(r.postUrl))return M.na('No X post link recorded.');
    return M.na(r.metricError||'No verified X reading yet.');};
  const accountName=(r,iconName='user')=>'<span class="fv-name">'+U.marker(iconName,'',{plain:true})+'<span>'+esc(r.publisher||r.name||r.handle||'Unnamed account')+'</span></span>';
  const trackingText=url=>url?'<span class="fv-mono">'+esc(url)+'</span>':'';
  const engagement=r=>{const l=C.num(r.likes??r.xLikes),rp=C.num(r.reposts??r.xShares),re=C.num(r.replies??r.xComments),v=C.num(r.views??r.xViews);
    if([l,rp,re].some(x=>x===null))return '';
    return esc(C.full(l)+' likes · '+C.full(rp)+' reposts · '+C.full(re)+' replies'+(v>0?' · '+((l+rp+re)/v*100).toFixed(2)+'%':''));};
  const ALIGNED=['24%','12.5%','12.5%','12.5%','12.5%','11.5%','11.5%','3%'];
  const rowKeyOf=r=>(r.code||r.id||'')+'@'+(r.sourceTab||'')+'#'+(r.sourceRow||'');
  const sourceRow=r=>r.sourceTab?esc(r.sourceTab+(r.sourceRow?' · row '+r.sourceRow:'')):'';

  /* ---------- universal X records: one schema and nine columns for every X placement ---------- */
  // Type is one of Post, RT, QRT or Article; threads are posts.
  const TYPE_NAMES={post:'Post',thread:'Post',original:'Post',rt:'RT',qrt:'QRT',article:'Article',story:'Story'};
  const typeName=t=>TYPE_NAMES[String(t||'').toLowerCase()]||'Post';
  // A placement is a booking: it has a price, a payment, a live post, a planned stage or clicks. Contact-list rows are left out.
  const isBooking=r=>C.num(r.cost)!==null||r.paid===true||r.posted===true||!!r.stage||C.num(r.clicks)>0;
  function xRecord(r,{campaign,parent,platform='X',type,clicks,views,ownLink=true}){
    const deleted=isDeleted(r);
    const link=ownLink&&!deleted&&r.posted===true&&C.safeUrl(r.postUrl)&&C.postId(r.postUrl)?r.postUrl:'';
    return {raw:r,campaign,parent:parent||campaign,platform,type:typeName(type),account:r.publisher||r.handle||'',price:C.num(r.cost),
      live:deleted?false:r.posted===true?true:r.posted===false?false:null,deleted,link,paid:r.paid===true&&r.planned!==true,planned:r.planned===true,
      views:views?views(r):viewsOfRow(r),clicks:clicks?clicks(r):M.na('No tracked link for this placement.')};
  }
  const xState=(page,id)=>{const st=tableState(page,id);return st.xf||(st.xf={group:'',type:'',live:'',pay:''});};
  const xActive=f=>!!(f.group||f.type||f.live||f.pay);
  const xMatch=f=>x=>(!f.group||x.campaign===f.group)&&(!f.type||x.type===f.type)&&(!f.live||(f.live==='Yes'?x.live===true:f.live==='Deleted'?x.deleted:x.live!==true&&!x.deleted))&&
    (!f.pay||(f.pay==='Planned'?x.planned:f.pay==='Paid'?x.paid&&!x.planned:!x.paid));
  function xFilters(id,records,f,{groups=true}={}){
    const present=(key,order)=>order.filter(v=>records.some(x=>key(x)===v));
    const sel=(key,label,opts,min=2)=>opts.length<min&&!f[key]?'':'<label class="fv-select fv-filter"><span class="fv-sr">'+esc(label)+'</span><select data-xfilter="'+key+'" data-table="'+esc(id)+'">'+
      [['',label+': All'],...opts.map(o=>[o,label+': '+o])].map(([v,l])=>'<option value="'+esc(v)+'"'+(f[key]===v?' selected':'')+'>'+esc(l)+'</option>').join('')+'</select>'+U.icon('down',14)+'</label>';
    const groupOpts=groups?[...new Set(records.map(x=>x.campaign))].filter(g=>GROUPS_VERIFIED.has(g)):[];
    return (groupOpts.length>=1&&new Set(records.map(x=>x.campaign)).size>1?sel('group','Group',groupOpts,1):'')+
      sel('type','Type',present(x=>x.type,['Post','Article','RT','QRT']));
  }
  // Verified content groups only; unverified records stay under their parent campaign.
  const GROUPS_VERIFIED=new Set(['Mandy','Lucia','Partner Articles','Classic Articles']);
  const X_COLUMNS=[
    {key:'campaign',label:'Campaign',type:'text',keep:true,html:x=>esc(x.campaign),sort:x=>x.campaign},
    {key:'platform',label:'Platform',type:'text',keep:true,nosort:true,html:x=>esc(x.platform||'X')},
    {key:'type',label:'Type',type:'text',keep:true,html:x=>esc(x.type),sort:x=>x.type},
    {key:'account',label:'Account',type:'name',keep:true,html:x=>accountName(x.raw),sort:x=>x.account.toLowerCase()},
    {key:'price',label:'Price',format:'money',keep:true,get:x=>x.price===null?M.na('No price recorded.'):M.value(x.price)},
    {key:'live',label:'Live?',type:'status',keep:true,html:x=>x.deleted?U.reasonButton('Deleted','Marked posted in the sheet, but X reports this post as not found: the publisher deleted or hid it.','fv-status is-bad'):x.live===true?U.status('Yes','good'):x.live===false?U.status('No'):dash('Publication not recorded.'),sort:x=>x.live===true?1:x.deleted?-1:0},
    {key:'link',label:'Link',type:'link',keep:true,nosort:true,html:x=>x.link?U.extLink(x.link,'Open post by '+x.account,{iconOnly:true}):dash(x.deleted?'Deleted on X.':x.type==='RT'?'No repost link is recorded.':x.live?'No post link recorded.':'Not live yet.')},
    {key:'views',label:'Views',keep:true,get:x=>x.views},
    {key:'clicks',label:'Clicks',keep:true,get:x=>x.clicks}
  ];
  // Record details, in a fixed order: booking, publication, tracking, results, history. Empty fields are left out.
  function xDetail(x,eff,{source,extra=[]}={}){
    const r=x.raw,e=eff?.get(r)||{};
    return U.detailGrid([
      ['Payment',payStatus(r)],['Price',money(r.cost)],['Paid Date',r.paidAt?when(r.paidAt):''],['Quantity',C.num(r.purchasedPosts)!==null?count(r.purchasedPosts):''],
      ['Published',r.postedAt?when(r.postedAt):''],['Source Post',source||''],['Profile',U.extLink(r.profileUrl,'Profile')||''],
      ...(r.postUrls?.length>1?[['Posts',r.postUrls.map((u,i)=>U.extLink(u,'Post '+(i+1))).join(' ')]]:[]),
      ['Tracking Link',trackingText(r.trackingUrl)],
      ['Views',U.value(x.views)],['Clicks',U.value(x.clicks)],['CPC',e.cpc&&C.hasValue(e.cpc)?esc(C.money(e.cpc.value)):''],['CPM',e.cpm&&C.hasValue(e.cpm)?esc(C.money(e.cpm.value)):''],['Engagement',engagement(r)],
      ...extra,
      ['Updated',r.metricAt||r.xUpdated?when(r.metricAt||r.xUpdated):''],['Source Row',sourceRow(r)]
    ]);
  }
  function xTable(page,id,{title,icon='layers',records,f,expand,empty,groups=true,includeType=true}){
    const ts=tableState(page,id);if(!ts.sort)ts.sort={key:'clicks',dir:-1};
    return U.tablePanel({id,title,icon,search:records.length>10,filters:xFilters(id,records,f,{groups}),filter:xMatch(f),rows:records,rowKey:x=>rowKeyOf(x.raw),rowLabel:x=>x.account,
      minWidth:760,limit:10,cls:'is-list',searchText:x=>[x.account,x.campaign,x.raw.articleLabel||''].join(' '),empty,columns:records.length&&records.every(x=>x.platform==='Instagram')?[{key:'account',label:'Account',type:'name',html:x=>accountName(x.raw),sort:x=>x.account},{key:'type',label:'Format',type:'text',html:x=>esc(x.type),sort:x=>x.type},{key:'spend',label:'Spend',format:'money',get:x=>x.paid?M.value(x.price):M.na('Not paid.')},{key:'posted',label:'Posted',type:'text',html:x=>esc(x.live?'Yes':'No'),sort:x=>x.live?1:0}]:resultColumns(records,{includeType}),expand},ts);
  }
  const articleHeadline=r=>r.articleTitle||r.headline||(!/^ARTICLE\s*\d/i.test(r.articleLabel||'')?r.articleLabel:'')||'';
  function resultColumns(records,{article=false,includeType=true}={}){
    const eff=C.placementEfficiency(records.map(x=>x.raw));
    return [
      ...(article?[{key:'headline',label:'Headline',type:'text',html:x=>articleHeadline(x.raw)?'<span class="fv-article-headline">'+esc(articleHeadline(x.raw))+'</span>':dash('No verified headline. Source reference: '+(x.raw.articleLabel||x.raw.code||'unrecorded')),sort:x=>articleHeadline(x.raw)}]:[]),
      {key:'account',label:article?'Publisher':'Account',type:'name',html:x=>accountName(x.raw),sort:x=>x.account.toLowerCase()},
      ...(!article&&includeType?[{key:'type',label:'Type',type:'text',html:x=>esc(x.type),sort:x=>x.type}]:[]),
      {key:'clicks',label:'Clicks',keep:true,get:x=>x.clicks},
      {key:'views',label:'Views',keep:true,get:x=>x.views},
      {key:'spend',label:'Spend',format:'money',get:x=>x.paid?(x.price===null?M.na('Paid cost missing.'):M.value(x.price)):M.na(x.planned?'Planned, not paid.':'Not paid.')},
      {key:'cpc',label:'CPC',format:'money',keep:true,get:x=>eff.get(x.raw)?.cpc||M.na('No matched traffic cost.')},
      {key:'post',label:'Post',type:'link',html:x=>x.link?U.extLink(x.link,'Open post',{iconOnly:true}):dash('No live post link.')}
    ];
  }
  function rtCosts(records){
    return '<div class="fv-publisher-costs">'+records.map(x=>'<div><b>'+esc(x.account)+'</b><span>'+esc(x.paid?'Paid':x.planned?'Planned':'Unpaid')+'</span><strong>'+(x.price===null?dash('No cost recorded.'):money(x.price))+'</strong></div>').join('')+'</div>';
  }
  // The four core KPIs for a set of records. RT rows never contribute views: their only reading is the original post's.
  function xKpis(records){
    const raws=records.map(x=>x.raw),own=records.filter(x=>x.type!=='RT').map(x=>x.raw);
    const paid=raws.filter(r=>r.paid===true&&r.planned!==true),known=paid.filter(r=>C.num(r.cost)!==null);
    const total=known.reduce((n,r)=>n+C.num(r.cost),0);
    const spend=!paid.length?M.value(0,{reason:'No paid placements in this selection.'}):known.length<paid.length?M.partial(total,(paid.length-known.length)+' paid placements have no price.'):M.value(total);
    const views=C.viewsOf([{source:'FILTER',rows:own}]);
    const links=new Map();
    for(const x of records){if(!C.hasValue(x.clicks)||x.raw.sharedTracking||x.raw.identityAmbiguous)continue;const key=x.raw.trackingUrl||rowKeyOf(x.raw);links.set(key,Math.max(links.get(key)||0,x.clicks.value));}
    const clickValue=[...links.values()].reduce((n,v)=>n+v,0),missing=records.filter(x=>x.raw.trackingUrl&&x.live===true&&(!C.hasValue(x.clicks)||x.raw.sharedTracking||x.raw.identityAmbiguous)).length;
    const clicks=links.size?(missing?M.partial(clickValue,missing+' live tracking links have missing or shared readings.'):M.value(clickValue,{reason:'Verified clicks on distinct placement links. Shared counters are excluded.'})):M.na('No attributable tracked clicks in this selection.');
    return {spend,views,clicks,cpc:C.efficiency([{source:'FILTER',rows:own}]).cpc};
  }
  const kpiStrip=k=>U.strip([metric('Clicks','cursor',k.clicks),metric('Views','eye',k.views,'compact'),metric('Spend','wallet',k.spend,'moneyShort'),metric('CPC','cursor',k.cpc,'money')]);
  const KPI_LOADING=[['Clicks','cursor'],['Views','eye'],['Spend','wallet'],['CPC','cursor']];
  const filteredNote=f=>xActive(f)?'<p class="fv-filter-note">'+U.icon('info',14)+'<span>Figures show the selected records.</span></p>':'';
  // Old view URLs open the equivalent filter.
  function applyLegacyView(page,id,view){
    const f=xState(page,id),map={'x-original-posts':{type:'Post'},'x-quote-posts':{type:'QRT'},'mandy-qrts':{group:'Mandy'},
      'original-posts':{type:'Article'},'paid-reposts':{type:'RT'}}[view];
    const st=tableState(page,id);
    if(map&&st.legacyView!==view){Object.assign(f,{group:'',type:'',live:'',pay:''},map);}
    st.legacyView=view;
  }

  /* ---------- pages ---------- */
  function overviewNotice(){
    const st=D.overviewStatus(),ov=D.overview();
    if(st.error&&ov)return '<div class="fv-notice" role="status">'+U.icon('alert',15)+'<span>'+U.reasonButton('Last Verified '+C.stamp(ov.checkedAt),'The latest refresh failed; these are the last verified figures.','fv-notice-reason')+'</span><button type="button" data-retry>Retry</button></div>';
    if(st.error&&!ov)return '<div class="fv-notice is-error" role="alert">'+U.icon('alert',15)+'<span>Data Unavailable</span><button type="button" data-retry>Retry</button></div>';
    if(ov?.stale)return '<div class="fv-notice" role="status">'+U.icon('alert',15)+'<span>'+U.reasonButton('Cached Data','The reporting feed is showing its last verified snapshot.','fv-notice-reason')+'</span></div>';
    return '';
  }
  const summaries=()=>{const ov=D.overview();return ov?C.CAMPAIGNS.map(c=>C.campaignSummary(ov,c.key,{gtaReport:D.gta().report})):null;};
  // Live Posts: distinct verified paid promotional X publications (each post once, extra posts on a booking included).
  const LIVE_SOURCES={'x-articles':['x-articles'],'gta-vi':['gta-qrts','gta-originals','gta-mandy'],'of-terms':['of-terms']};
  function livePosts(ov,ids){
    const seen=new Set();
    for(const id of ids)for(const r of ov?.campaigns?.find(c=>c.id===id)?.rows||[]){
      if(r.paid!==true||r.posted!==true||isDeleted(r))continue;
      for(const u of r.postUrls?.length?r.postUrls:[r.postUrl]){const p=C.postId(u);if(p)seen.add(p);}
    }
    return seen.size;
  }

  /* One executive view at a time; the period applies to both totals and campaign rows. */
  function homePage(st){
    ensure('overview');ensure('discord');ensure('gta');ensure('of');
    const ov=D.overview(),S=summaries(),today=C.londonDay(Date.now()),ws=C.weekStart(today),lws=C.addDays(ws,-7),lwe=C.addDays(ws,-1);
    const tabs=[{key:'this-week',label:'This Week'},{key:'last-week',label:'Last Week'},{key:'all-time',label:'All Time'}];
    const active=tabs.some(t=>t.key===st.view)?st.view:'all-time';
    const period=active==='all-time'?null:active==='this-week'?{from:ws,to:today}:{from:lws,to:lwe};
    const dc=discordStats(ws,today,lws,lwe),community=active==='all-time'?dc.all:active==='this-week'?dc.week:dc.last;
    const load=M.loading();let paid={clicks:load,views:load,spend:load,posts:load};
    if(S){
      if(period)paid=periodTotals(period.from,period.to);
      else{const T=C.homeTotals(ov,S);paid={clicks:clickBreakdown(),views:T.views,spend:T.spend,posts:M.value(livePosts(ov,Object.values(LIVE_SOURCES).flat()))};}
    }
    const date=period?C.dayShort(period.from)+' – '+C.dayShort(period.to):'All recorded activity';
    const header='<div class="fv-executive-controls">'+subTabs(tabs,active)+'<span class="fv-executive-date">'+esc(date)+'</span></div>';
    const figures=U.strip([metric('Clicks','cursor',paid.clicks),metric('Views','eye',paid.views,'compact'),metric('Spend','wallet',paid.spend,'moneyShort'),metric('Live Posts','check',paid.posts)]);
    const discord='<section class="fv-community-summary" aria-label="Discord"><a href="#discord">Discord</a>'+[
      ['Members',community.members,'count'],['Growth',community.growth,'signed'],['Course Clicks',community.clicks,'count']
    ].map(([label,m,format])=>'<div><span>'+esc(label)+'</span><strong>'+(C.hasValue(m)?U.value(m,format):dash(m?.reason))+'</strong></div>').join('')+'</section>';
    return {title:'Dashboard',refreshLabel:'Refresh All',updated:ov?.checkedAt,stale:!!(D.overviewStatus().error||ov?.stale),body:overviewNotice()+header+figures+discord+dashboardChart()+campaignComparison(S,period)};
  }
  function dashboardChart(){
    const sources=[['Article links',D.dashboard()?.activity,D.dashboard()?.activityReady,xaRecords()],['OF links',D.of()?.report?.activity,D.of()?.report?.ready,ofRecords()]];
    const values=new Map();
    for(const [name,activity,ready,records] of sources){if(!ready)continue;const codes=new Set(records.map(x=>String(x.raw.code)));for(const p of C.dailyEventSeries(activity,{include:r=>codes.has(String(r.code))})){const d=values.get(p.week)||{value:0,sources:[]};d.value+=p.value;d.sources.push(name+': '+C.full(p.value));values.set(p.week,d);}}
    for(const p of shortIoDaily(gtaClickReport(D.gta()?.report),gtaRecords())){const d=values.get(p.week)||{value:0,sources:[]};d.value+=p.value;d.sources.push('GTA links: '+C.full(p.value));values.set(p.week,d);}
    const series=[...values].sort(([a],[b])=>a.localeCompare(b)).map(([date,d])=>({week:date,label:C.dayShort(date),range:C.dayLong(date),value:d.value,incomplete:date===C.londonDay(Date.now()),extra:d.sources.join(' · ')+'. Dated recorded clicks only; unavailable sources are excluded. Provider filtering differs.'}));
    return U.chartPanel({id:'home-chart',measures:[{key:'clicks',label:'Daily Clicks',title:'Daily Clicks',series,period:'Day',unit:'Clicks'}]},chartState('home','home-chart'));
  }
  function clickBreakdown(from,to){
    const s=summaries();if(!s)return M.loading();
    const eventMetric=(rows,ready)=>{
      if(!ready||!Array.isArray(rows))return M.na('Dated click activity unavailable.');
      const dated=rows.filter(r=>r.date>=from&&r.date<=to&&C.num(r.clicks)!==null);
      return dated.length?M.value(dated.reduce((n,r)=>n+C.num(r.clicks),0)):M.na('No verified dated clicks in this period.');
    };
    const get=k=>s.find(x=>x.key===k)?.clicks||M.na('Unavailable');
    const parts=from?[
      ['Short.io',M.na('Weekly Short.io click history is not available; lifetime clicks are never assigned to a week.')],
      ['Article links',eventMetric(D.dashboard()?.activity,D.dashboard()?.activityReady)],
      ['OF links',eventMetric(D.of()?.report?.activity,D.of()?.report?.ready)]
    ]:[['Short.io',get('gta-vi')],['Article links',get('x-articles')],['OF links',get('of-terms')]];
    const known=parts.filter(([,m])=>C.hasValue(m));
    if(!known.length)return M.na('No verified click readings for this period.');
    const total=known.reduce((n,[,m])=>n+m.value,0);
    const reason=parts.map(([name,m])=>name+': '+(C.hasValue(m)?C.full(m.value):'not available')).join(' · ')+'. Recorded clicks across separate campaign links; provider filtering differs. This is not unique visitors or a human-only total.';
    return known.length<parts.length?M.partial(total,reason+' Only dated, available readings are included.'):M.value(total,{reason});
  }
  function campaignComparison(S,period){
    if(!S)return '';
    const rows=NAV_ORDER.filter(k=>k!=='viral-qrts').map(k=>S.find(s=>s.key===k)).filter(Boolean).map(s=>({...s,name:C.CAMPAIGNS.find(c=>c.key===s.key).name}));
    const viral=xKpis(gtaRecords().filter(x=>x.campaign==='Mandy'));
    rows.splice(1,0,{...viral,key:'viral-qrts',name:'Viral QRTs',alias:true});
    if(period)for(const row of rows)Object.assign(row,periodCampaign(row.key,period));
    const ts=tableState('home','home-comparison');if(!ts.sort)ts.sort={key:'clicks',dir:-1};
    return U.tablePanel({id:'home-comparison',title:'Campaigns',rows,rowKey:r=>r.key,hideEmpty:false,cls:'is-list',minWidth:650,
      columns:[{key:'name',label:'Campaign',type:'name',html:r=>'<a href="#'+esc(r.key)+'">'+esc(r.name)+'</a>'+(r.alias?U.reasonButton('Shared','These placements are included in GTA VI and counted once in totals.','fv-alias-hint'):''),sort:r=>r.name},
      {key:'clicks',label:'Clicks',get:r=>r.clicks},{key:'views',label:'Views',get:r=>r.views},{key:'spend',label:'Spend',format:'money',get:r=>r.spend},{key:'cpc',label:'CPC',format:'money',get:r=>r.cpc}]},ts);
  }
  function periodCampaign(key,period){
    const records=key==='gta-vi'?gtaRecords():key==='viral-qrts'?gtaRecords().filter(x=>x.campaign==='Mandy'):key==='x-articles'?xaRecords():key==='of-terms'?ofRecords():guruRecords();
    const totals=periodTotals(period.from,period.to,records),codes=new Set(records.map(x=>String(x.raw.code||'')));
    const source=key==='x-articles'?D.dashboard():key==='of-terms'?D.of().report:null;
    const rows=source?.activity?.filter(r=>codes.has(String(r.code))&&r.date>=period.from&&r.date<=period.to&&C.num(r.clicks)!==null)||[];
    const clicks=rows.length?M.value(rows.reduce((n,r)=>n+C.num(r.clicks),0)):M.na('No dated campaign clicks available for this period.');
    return {...totals,clicks,cpc:M.na('Period CPC requires placement costs allocated to dated traffic. All-time CPC uses matched paid placements.')};
  }
  /* ---------- Home: This Week (owner, 26 Nov) ---------- */
  // UK week, Monday to today.
  const weekRange=ws=>{const we=C.addDays(ws,6);return C.dayShort(ws).split(' ')[0]+(ws.slice(5,7)===we.slice(5,7)?'':' '+C.dayShort(ws).split(' ')[1])+'–'+C.dayShort(we);};
  const postIdsOfRecord=x=>(x.raw.postUrls?.length?x.raw.postUrls:[x.raw.postUrl]).map(u=>C.postId(u)).filter(Boolean).map(String);
  // Period spend follows payment dates; view gains follow dated readings. Live posts follow publication dates.
  // Costs without payment dates are unavailable for a period, but retained in all-time reporting.
  function periodTotals(from,to,records){
    const all=records||[...xaRecords(),...gtaRecords(),...igRecords(),...ofRecords(),...guruRecords()];
    const seen=new Set(),posts=new Set();let spend=0,dated=0,undated=0;
    for(const x of all){
      if(!x.paid)continue;
      const k=rowKeyOf(x.raw);if(seen.has(k))continue;seen.add(k);
      const payment=C.londonDay(x.raw.paidAt);
      if(!payment||x.price===null)undated++;
      else{dated++;if(payment>=from&&payment<=to)spend+=x.price;}
      if(x.live===true)for(const id of postIdsOfRecord(x)){const t=postBorn(id),d=t?C.londonDay(t):'';if(d>=from&&d<=to)posts.add(id);}
    }
    const gained=C.dailySeries(xHistory(all),{born:postBorn,days:21}).gained.filter(p=>p.week>=from&&p.week<=to&&p.value!==null);
    return {clicks:clickBreakdown(from,to),
      spend:!dated?M.na('Payment dates are not recorded. Weekly spend cannot be inferred from publication dates.'):undated?M.partial(spend,undated+' paid placements have no payment date or cost and cannot be assigned to a week.'):M.value(spend),
      views:gained.length?M.partial(gained.reduce((n,p)=>n+p.value,0),'Measured increases on dated X post readings. Coverage is incomplete; lifetime views are not assigned to weeks.'):M.na('No dated view readings for this period.'),
      posts:M.value(posts.size,{reason:'Distinct paid X posts published in this period, based on verified post IDs.'})};
  }

  /* ---------- Home: Discord performance by period (This Week, Last Week, All Time) ---------- */
  function discordStats(ws,today,lws,lwe){
    const dd=D.discord(),members=dd.members,clicks=dd.clicks;
    const snaps=C.memberReadings(members);
    const first=snaps[0],latest=snaps.at(-1);
    const began=first?' Member tracking began '+C.dayLong(first.date)+'.':'';
    const lastOnOrBefore=d=>snaps.filter(h=>h.date<=d).at(-1);
    const waiting=dd.loading||(!members&&!dd.error);
    const naM=r=>waiting?M.loading():M.na(r);
    // Members at the end of a period, and the change from the previous period's last snapshot (or from the first snapshot, if tracking began inside the period).
    // A missing observation is unknown, including periods before tracking began.
    const growthFallback=reason=>waiting?M.loading():M.na(reason);
    const period=(from,to,isNow)=>{
      const end=isNow?latest:lastOnOrBefore(to);
      if(!end){
        if(!first)return {members:naM('No member snapshot in this period.'+began),growth:naM('No member snapshot in this period.'+began)};
        return {members:M.na('No member snapshot in this period.'),growth:growthFallback('No member snapshot in this period to measure change.'+began)};
      }
      const before=lastOnOrBefore(C.addDays(from,-1)),base=before||snaps.find(h=>h.date>=from&&h.date<=to);
      const growth=!base||base===end||(base.date===end.date&&!isNow)?growthFallback('Needs two member snapshots.'+began):
        M.value(end.memberCount-base.memberCount,{reason:before?'Change since the last snapshot before '+C.dayShort(from)+'.':'Change since tracking began on '+C.dayLong(base.date)+'.'});
      const gap=before&&before.date!==C.addDays(from,-1);
      const net=gap&&C.hasValue(growth)?M.partial(growth.value,'Change from '+C.dayLong(base.date)+' to '+C.dayLong(end.date)+'. The week boundary has no snapshot.'):growth;
      return {members:M.value(end.memberCount,{reason:isNow?'Current member count.':'Members at the last snapshot of the week ('+C.dayLong(end.date)+').'}),growth:net};
    };
    const days=clicks?.days&&typeof clicks.days==='object'?clicks.days:null;
    const clicksIn=(from,to)=>{
      if(!clicks)return dd.error?M.na('Course click counter is temporarily unavailable.'):M.loading();
      if(!days)return M.na('Daily course clicks are not available yet.');
      // Do not backfill the time before click tracking began.
      const firstDay=Object.keys(days).sort()[0];
      if(!firstDay||to<firstDay)return M.na('No dated course click history in this period.');
      const n=Object.entries(days).filter(([d])=>d>=from&&d<=to).reduce((a,[,v])=>a+(Number(v)||0),0);
      const covered=C.num(clicks.daysTotal),gap=covered!==null&&covered<clicks.total;
      return gap?M.partial(n,'Course button clicks with a recorded time ('+C.full(covered)+' of '+C.full(clicks.total)+' clicks have one).'):M.value(n,{reason:'Course button clicks recorded in this period.'});
    };
    const allGrowth=first&&latest&&latest.date!==first.date?M.value(latest.memberCount-first.memberCount,{reason:'Change since tracking began on '+C.dayLong(first.date)+'.'}):growthFallback('Needs two member snapshots.'+began);
    return {
      week:{...period(ws,today,true),clicks:clicksIn(ws,today)},
      last:{...period(lws,lwe,false),clicks:clicksIn(lws,lwe)},
      all:{members:latest?M.value(latest.memberCount,{reason:'Current member count.'}):naM('Member count unavailable.'),growth:allGrowth,
        clicks:clicks?M.value(clicks.total,{reason:'All course button clicks since the counter was enabled. Not signups or enrolments.'}):clicksIn('','')}
    };
  }
  function homeDetail(r){
    const b=r.budget;
    return U.detailGrid([
      b?['Budget',U.value(b.budget,'money')]:null,
      b?['Planned',U.value(M.value((r.planned||0)+(C.num(r.committed)||0)),'money')]:null,
      b?['Remaining',U.value(b.remaining,'money')]:null,
      ['CPM',C.hasValue(r.cpm)?esc(C.money(r.cpm.value)):''],
      ['Click Source',r.clicks?.provider?esc(r.clicks.provider):''],
      r.key==='gta-vi'&&r.clicks?.allTime!==undefined?['All-Time Clicks',esc(C.full(r.clicks.allTime))]:null,
      ['Coverage',r.views?.posts?esc(C.full(r.views.measured)+' of '+C.full(r.views.posts)+' live posts measured'):''],
      ['Source Updated',r.verifiedAt?esc(C.stamp(r.verifiedAt)):''],
      ['KYC',C.hasValue(r.kyc)?U.value(r.kyc):''],['Earning Creators',C.hasValue(r.earning)?U.value(r.earning):'']
    ].filter(Boolean))+(r.warnings.length?'<p class="fv-detail-note">'+r.warnings.map(esc).join(' ')+'</p>':'');
  }
  function netGrowth(members){
    const h=C.memberReadings(members);
    if(!members)return M.loading();
    if(h.length<2||h[0].date===h.at(-1).date)return M.na('Member Growth needs two dated daily snapshots. '+(h.length?'Snapshots began '+C.dayLong(h[0].date)+'.':'No snapshot recorded yet.'));
    return M.value(h.at(-1).memberCount-h[0].memberCount,{reason:'Change in members between the snapshots of '+C.dayLong(h[0].date)+' and '+C.dayLong(h.at(-1).date)+'. Not gross joins.'});
  }

  function discordPage(st){
    ensure('discord');
    const dd=D.discord(),members=dd.members,clicks=dd.clicks;
    const approx=members?.source==='DISCORD_INVITE_APPROXIMATE';
    const mm=members?.latest?M.value(members.latest.memberCount,{chip:approx?'Approximate':undefined,
      reason:approx?'The Discord bot was unavailable, so this is the approximate invite count.':'Live member count from the Academy bot.'}):dd.loading||(!members&&!dd.error)?M.loading():M.na('Discord member count is temporarily unavailable.');
    if(approx&&mm.state==='value')mm.state='partial';
    const net=netGrowth(members);
    const cc=clicks?M.value(clicks.total,{reason:'Clicks on the Discord course button since the counter was enabled'+(C.num(clicks.last7Days)!==null?'; '+C.full(clicks.last7Days)+' in the last 7 days':'')+'. Not signups or enrolments.'}):dd.loading||!dd.error?M.loading():M.na('Course click counter temporarily unavailable.');
    const strip=U.strip([metric('Members','users',mm,'count'),metric('Growth','trend',net,'signed'),metric('Course Clicks','graduation',cc)]);
    // The last four weeks that have snapshots. Earlier weeks are never back-filled.
    const readings=C.memberReadings(members),weeks=C.recentWeeks(readings,4);
    const netSeries=weeks.filter(w=>w.value!==null);
    // Daily member growth: change between snapshots on consecutive UK days (last 14 days). Negative days are real.
    const byDay=new Map(readings.map(h=>[h.date,h.memberCount]));
    const today=C.londonDay(Date.now());
    const dailyNet=[...byDay].filter(([d])=>byDay.has(C.addDays(d,-1))).map(([d,v])=>({week:d,label:C.dayShort(d),range:C.dayLong(d),value:v-byDay.get(C.addDays(d,-1)),incomplete:d===today})).slice(-14);
    const courseSeries=C.eventSeries(Object.entries(clicks?.days||{}).map(([date,clicks])=>({date,clicks})));
    const courseByWeek=new Map(courseSeries.map(p=>[p.week,p]));
    const dailyCourse=C.dailyEventSeries(Object.entries(clicks?.days||{}).map(([date,clicks])=>({date,clicks})));
    const chart=U.chartPanel({id:'discord-chart',measures:[
      dailyCourse.length?{key:'course',label:'Course Clicks',title:'Daily Course Clicks',series:dailyCourse,period:'Day',unit:'Course Clicks'}:null,
      dailyNet.length>=1?{key:'daily',label:'Daily Member Growth',title:'Daily Member Growth',series:dailyNet,period:'Day',format:'signed',unit:'Member Growth',kinds:['bar','line']}:null,
      // Owner (26 Nov): "Weekly X" naming, matching OF Terms' "Weekly Clicks"; no table view (line/bar only, per every other chart).

    ].filter(Boolean)},chartState('discord','discord-chart'));
    const table=U.tablePanel({id:'discord-table',title:'Weekly Results',icon:'users',dropEmptyRows:true,hideEmpty:false,
      rows:weeks.slice().reverse(),rowKey:r=>r.week,
      columns:[
        {key:'week',label:'Week',type:'name',html:r=>esc(r.range)+(r.incomplete?' '+U.status('In Progress'):''),sort:r=>r.week},
        {key:'end',label:'Members',get:r=>r.end===null?M.na('No snapshot this week.'):M.value(r.end)},
        {key:'net',label:'Growth',format:'signed',get:r=>r.value===null?M.na('Needs the previous week’s snapshot.'):M.value(r.value)},
        {key:'course',label:'Course Clicks',get:r=>courseByWeek.has(r.week)?M.value(courseByWeek.get(r.week).value):M.na('No dated course history in this week.')}
      ]},tableState('discord','discord-table'));
    // Owner (26 Nov): a short line saying what this page actually tracks, and the Weekly Stats table (previously built but never shown).
    const intro='<p class="fv-filter-note">'+U.icon('discord',14)+'<span>How the Fanvue Academy community is growing: member count, net new members, and clicks on the free course button.</span></p>';
    return {title:'Discord',chip:'discord',refreshLabel:'Refresh',updated:members?.checkedAt||clicks?.checkedAt,stale:!!dd.error,body:strip+chart+table};
  }

  /* X Articles: every article redirect leads to the Fanvue partner (affiliates) page, so all
     verified placements are Partner Articles. RTs without a matched original stay under X Articles. */
  const articleGroup=r=>/fanvue\.com\/pages\/affiliates/i.test(r.destinationUrl||'')||/\/[rs]\/A\d+/i.test(r.trackingUrl||'')?'Partner Articles':'X Articles';
  /* ---------- shared record builders (campaign pages and Accounts use the same records) ---------- */
  function xaRecords(){
    const xa=D.campaign('x-articles'),rt=D.campaign('article-rts');
    return [
      ...(xa?.rows||[]).filter(isBooking).map(r=>xRecord(r,{campaign:articleGroup(r),parent:'X Articles',type:'article',clicks:r=>C.num(r.clicks)===null?M.na('Click storage unavailable.'):M.value(r.clicks,{reason:'Site redirect clicks (/r/ and /s/ links).'})})),
      ...(rt?.rows||[]).filter(isBooking).map(r=>xRecord(r,{campaign:'X Articles',parent:'X Articles',type:'rt',ownLink:false,views:()=>M.na('Repost impressions are not measured; the original post’s views are in the details.'),clicks:()=>M.na('Paid RTs have no tracked link.')}))
    ];
  }
  const gtaClicks=r=>{const v=C.num(r.clicks);if(v!==null)return M.value(v,{reason:'Short.io human clicks since publication.'});return M.na(r.clickError||(r.trackingUrl?(r.posted?'No post-publication reading yet.':'Not live yet.'):'No tracking link in the source sheet.'));};
  function gtaRecords(){
    const qr=D.campaign('gta-qrts'),og=D.campaign('gta-originals'),mq=D.campaign('gta-mandy');
    return [
      ...(og?.rows||[]).filter(isBooking).map(r=>xRecord(r,{campaign:gtaGroup(r),parent:'GTA VI',type:'post',clicks:gtaClicks})),
      ...(qr?.rows||[]).filter(isBooking).map(r=>xRecord(r,{campaign:gtaGroup(r),parent:'GTA VI',type:'qrt',clicks:gtaClicks})),
      ...(mq?.rows||[]).filter(isBooking).map(r=>xRecord(r,{campaign:gtaGroup(r),parent:'GTA VI',type:'qrt',clicks:gtaClicks}))
    ];
  }
  function igRecords(){
    return (D.campaign('gta-instagram')?.rows||[]).filter(isBooking).map(r=>xRecord(r,{campaign:'GTA VI',parent:'GTA VI',platform:'Instagram',type:r.format==='post'?'post':'story',ownLink:false,
      views:()=>M.na('Instagram views are not measured.'),clicks:()=>M.na('No tracked link for this placement.')}));
  }
  const ofRecords=()=>(D.campaign('of-terms')?.rows||[]).filter(isBooking).map(r=>xRecord(r,{campaign:'OF Terms',parent:'OF Terms',type:r.type||r.format||'post',clicks:r=>C.num(r.clicks)===null?M.na('No /of/ link events recorded.'):M.value(r.clicks,{reason:'Events on the /of/ tracking link.'})}));
  const guruRecords=()=>(D.campaign('guru-rts')?.paidReposts||[]).map(r=>xRecord(r,{campaign:'Guru RTs',parent:'Guru RTs',type:'rt',ownLink:false,
    views:()=>M.na('Repost impressions are not measured. The original post’s views are in its group.'),clicks:()=>M.na('Paid RTs have no tracked link.')}));

  /* ---------- campaign subpages ---------- */
  // Each campaign page opens on an Overview (totals, chart and one summary row per group).
  // Every group has its own tab with its own KPIs, chart and placement table.
  function subTabs(tabs,active){
    return '<nav class="fv-segments fv-subnav" aria-label="Campaign sections">'+tabs.map(t=>'<button type="button" data-view="'+esc(t.key)+'" aria-pressed="'+(t.key===active)+'"'+(t.key===active?' aria-current="page"':'')+'>'+esc(t.label)+(t.n!==undefined?'<span class="fv-subnav-n">'+esc(C.full(t.n))+'</span>':'')+'</button>').join('')+'</nav>';
  }
  const pickTab=(view,tabs,alias={})=>{const v=alias[view]||view;return tabs.some(t=>t.key===v)?v:'overview';};
  const livePostCount=records=>{const ids=new Set();let noLink=0;
    for(const x of records){if(x.live!==true)continue;const l=(x.raw.postUrls?.length?x.raw.postUrls:[x.link]).map(u=>C.postId(u)).filter(Boolean);if(l.length)l.forEach(i=>ids.add(i));else noLink++;}
    return ids.size+noLink;};
  const summaryRow=(key,name,records,extra={})=>({key,name,view:key,records,placements:records.length,live:livePostCount(records),k:xKpis(records),...extra});
  // One row per group: the four KPIs plus placements and live posts. The name opens that group's tab.
  function summaryTable(page,id,{title,icon,nameLabel='Group',rows,empty}){
    return U.tablePanel({id,title,icon,rows,rowKey:r=>r.key,rowLabel:r=>r.name,minWidth:760,empty,hideEmpty:false,cls:'is-summary',
      columns:[
        {key:'name',label:nameLabel,type:'name',html:r=>'<span class="fv-name">'+U.marker(r.icon||icon,'',{plain:true})+(r.view?'<a class="fv-sub-link" href="#'+esc(page+'/'+r.view)+'">'+esc(r.name)+'</a>':'<span>'+esc(r.name)+'</span>')+'</span>',sort:r=>r.name.toLowerCase()},
        {key:'placements',label:'Placements',type:'count',get:r=>r.placements},
        {key:'live',label:'Live Posts',type:'count',get:r=>r.live},
        {key:'spend',label:'Spend',format:'money',get:r=>r.k.spend},
        {key:'views',label:'Views',get:r=>r.k.views},
        {key:'clicks',label:'Clicks',get:r=>r.k.clicks},
        {key:'cpc',label:'CPC',format:'money',get:r=>r.k.cpc}
      ]},tableState(page,id));
  }
  // Views chart from dated per-post readings (last 14 UK days): views gained each day.
  // Owner (25 Nov): graphs show per-period figures only; totals stay as numbers in the KPI strip.
  // A post's first reading is its starting point, never counted as one day's gain.
  function viewsChart(id,page,history,{idOf=r=>r.id,at=r=>r.at,value=r=>r.views,extra=[],noun='Views'}={}){
    const d=C.dailySeries(history,{id:idOf,at,value,born:postBorn}),tip=p=>({...p,extra:p.count+' posts with a reading'+(p.fresh?' · '+p.fresh+' new '+(p.fresh===1?'post':'posts')+' counted from publication':'')});
    const gained=d.gained.some(p=>p.value!==null)?d.gained.map(tip):[];
    return U.chartPanel({id,measures:[
      ...extra,
      gained.length?{key:'gained',label:'Daily '+noun,title:'Daily '+noun,series:gained,period:'Day',format:'compact',tipFormat:'count',unit:noun==='Views'?'Views Gained':noun+' Gained'}:null
    ].filter(Boolean)},chartState(page,id));
  }
  // Publication time of an X post, from its ID (X IDs carry their creation time).
  const postBorn=key=>{const m=String(key||'').match(/(\d{15,20})/);if(!m)return null;try{return Number((BigInt(m[1])>>22n)+1288834974657n);}catch{return null;}};
  // Dated view readings for a set of placement records (GTA VI and X Articles posts), one id per post.
  function xHistory(records){
    const gr=D.gta().report,dash=D.dashboard();
    const gta=records.filter(x=>x.parent==='GTA VI'&&x.platform==='X'),xa=records.filter(x=>x.parent==='X Articles'&&x.type!=='RT');
    const gIds=postIdsOf(gta),xIds=postIdsOf(xa),codes=new Set(xa.map(x=>String(x.raw.code||'')).filter(Boolean));
    return [...(gr&&gIds.size?[...(gr.history||[]),...(gr.originals?.history||[]),...(gr.mandy?.history||[])].filter(h=>gIds.has(String(h.id||''))):[]),
      ...(xa.length?(dash?.history||[]).filter(h=>codes.has(String(h.code||''))||xIds.has(String(h.postId||''))).map(h=>({id:'x:'+(h.postId||h.code),at:h.at,views:h.views})):[])];
  }
  const postIdsOf=records=>new Set(records.flatMap(x=>x.raw.postUrls?.length?x.raw.postUrls:[x.raw.postUrl]).map(u=>C.postId(u)).filter(Boolean).map(String));

  function xArticlesPage(st){
    ensure('overview');
    const ov=D.overview(),s=ov?C.campaignSummary(ov,'x-articles'):null,xa=D.campaign('x-articles'),dash=D.dashboard();
    const names=new Map((dash?.campaigns||[]).map(c=>[c.id,c.name]));
    const records=xaRecords();
    const arts=records.filter(x=>x.type!=='RT'),rts=records.filter(x=>x.type==='RT');
    const tabs=[{key:'overview',label:'Overview'},{key:'articles',label:'Original Articles',n:arts.length},{key:'rts',label:'Paid RTs',n:rts.length}].filter(t=>t.n!==0);
    const tab=pickTab(st.view,tabs,{'original-posts':'articles','paid-reposts':'rts'});
    const scoped=tab==='articles'?arts:tab==='rts'?rts:records,id='xa-'+tab;
    const f=xState('x-articles',id),shown=scoped.filter(xMatch(f));
    const k=!s?null:tab==='overview'?{spend:s.spend,views:s.views,clicks:s.clicks,cpc:s.cpc}:xKpis(shown);
    const strip=tab==='rts'&&s?U.strip([metric('Paid RTs','refresh',M.value(rts.filter(x=>x.paid).length)),metric('Spend','wallet',xKpis(shown).spend,'moneyShort')]):!k?loadingStrip(KPI_LOADING):kpiStrip(k);
    // Chart history is limited to the posts in this tab.
    // The Paid RTs tab charts the articles the RTs promote (RT impressions are not measured).
    const own=(tab==='rts'?arts:shown).filter(x=>x.type!=='RT'),codes=new Set(own.map(x=>String(x.raw.code||''))),ids=postIdsOf(own);
    const hist=dash?(dash.history||[]).filter(h=>codes.has(String(h.code||''))||ids.has(String(h.postId||''))):[];
    const clickSeries=dash&&dash.activityReady?C.dailyEventSeries(dash.activity,{include:r=>codes.has(String(r.code))}):[];
    // Owner (26 Nov): one chart name, "Daily Views", everywhere a views-over-time chart appears.
    const chart=viewsChart('xa-chart','x-articles',hist,{idOf:r=>r.postId||r.code,extra:[clickSeries.length?{key:'clicks',label:'Daily Clicks',title:'Daily Clicks',series:clickSeries,period:'Day',unit:'Clicks'}:null]});
    let body;
    if(tab==='overview'){
      const originals=arts.filter(x=>x.paid||x.live===true||C.hasValue(x.clicks)&&x.clicks.value>0),eff=C.placementEfficiency(originals.map(x=>x.raw));
      const ts=tableState('x-articles','xa-overview');if(!ts.sort)ts.sort={key:'clicks',dir:-1};
      body=chart+U.tablePanel({id:'xa-overview',title:'Article Results',icon:'doc',rows:originals,search:true,cls:'is-list',rowKey:x=>rowKeyOf(x.raw),rowLabel:x=>x.account,minWidth:850,limit:10,hideEmpty:false,columns:resultColumns(originals,{article:true}),expand:x=>xDetail(x,eff)},ts);
    }else if(tab==='rts'){
      const grouped=new Map();
      for(const x of shown){const key=C.postId(x.raw.sourcePostUrl||x.raw.postUrl)||'unlinked';if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(x);}
      const rows=[...grouped].map(([key,list])=>{
        const original=arts.find(x=>C.postId(x.raw.postUrl)===key);
        const g=D.campaign('article-rts')?.articleRtGroups?.find(g=>String(g.postId)===key);
        return {key,list,name:original?.raw.articleLabel||g?.handle||(key==='unlinked'?'Original not recorded':'Original article'),url:list[0].raw.sourcePostUrl||'',
          views:original?.views||(C.num(g?.views)!==null?M.value(g.views):M.na('Original views unavailable.')),k:xKpis(list)};
      });
      body=(D.campaign('article-rts')?.trackingWarning?'<p class="fv-filter-note">'+esc(D.campaign('article-rts').trackingWarning)+'</p>':'')+U.tablePanel({id:'xa-rts',title:'Article Amplification',icon:'refresh',rows,rowKey:r=>r.key,rowLabel:r=>r.name,minWidth:650,cls:'is-list',hideEmpty:false,
        columns:[{key:'name',label:'Original Article',type:'name',html:r=>esc(r.name)+' '+U.extLink(r.url,'Original post'),sort:r=>r.name},
          {key:'count',label:'Purchased RTs',get:r=>r.list.filter(x=>x.paid).reduce((n,x)=>n+(C.num(x.raw.purchasedPosts)||1),0)},
          {key:'spend',label:'Spend',format:'money',get:r=>r.k.spend},{key:'views',label:'Original Views',get:r=>r.views}],expand:r=>rtCosts(r.list)},tableState('x-articles','xa-rts'))+
        '<p class="fv-filter-note">Original article views include organic exposure. RT purchases have no separate click or impression reading.</p>';
    }else{
      const eff=C.placementEfficiency(shown.map(x=>x.raw));
      body=chart+U.tablePanel({id,title:'Original Articles',icon:'doc',records:scoped,rows:scoped,search:true,cls:'is-list',rowKey:x=>rowKeyOf(x.raw),rowLabel:x=>x.account,minWidth:850,limit:10,hideEmpty:false,
        columns:resultColumns(scoped,{article:true}),expand:x=>xDetail(x,eff,{extra:[['Headline',esc(x.raw.articleLabel||'')]]})},tableState('x-articles',id));
    }
    const label={overview:'Article Performance',articles:'Article Performance',rts:'Paid RT Performance'}[tab];
    return {title:'X Articles',chip:'x-articles',refreshLabel:'Refresh',updated:ov?.checkedAt,stale:!!(D.overviewStatus().error||xa?.sourceStale||xa?.dataWarning),
      body:overviewNotice()+subTabs(tabs,tab)+strip+body+(tab==='overview'&&s?'<div class="fv-cost-split"><span>Original articles <b>'+U.value(C.spendOf(xa),'money')+'</b></span><span>Paid RTs <b>'+U.value(C.spendOf(D.campaign('article-rts')),'money')+'</b></span></div>':'')};
  }

  // GTA VI content groups: Mandy is tab 17; the owner confirmed (25 Nov) that the earlier X tabs 12, 14, 15 and 16 are Lucia.
  const GTA_LUCIA=new Set(['GTA1','GTA2','GTAQ','GTAQ2']);
  const gtaGroup=r=>r.campaign==='GTAM'?'Mandy':GTA_LUCIA.has(r.campaign)?'Lucia':'GTA VI';
  function gtaPage(st){
    ensure('overview');ensure('gta');
    const ov=D.overview(),gr=D.gta().report,s=ov?C.campaignSummary(ov,'gta-vi',{gtaReport:gr}):null,qr=D.campaign('gta-qrts'),og=D.campaign('gta-originals'),ig=D.campaign('gta-instagram'),mq=D.campaign('gta-mandy');
    const records=gtaRecords();
    const igs=igRecords();
    const group=g=>records.filter(x=>x.campaign===g);
    const tabs=[{key:'overview',label:'Overview'},{key:'lucia',label:'Lucia',n:group('Lucia').length},{key:'mandy',label:'Mandy',n:group('Mandy').length},
      {key:'instagram',label:'Instagram',n:igs.length},{key:'other',label:'Other',n:group('GTA VI').length}].filter(t=>t.n!==0);
    const tab=pickTab(st.view,tabs,{'all-formats':'overview','x-original-posts':'lucia','x-quote-posts':'lucia','mandy-qrts':'mandy'});
    const scoped=tab==='instagram'?igs:tab==='lucia'?group('Lucia'):tab==='mandy'?group('Mandy'):tab==='other'?group('GTA VI'):records,id='gta-'+tab;
    const f=xState('gta-vi',id),shown=scoped.filter(xMatch(f));
    let strip;
    if(!s)strip=loadingStrip(KPI_LOADING);
    else if(tab==='overview'){
      const k={spend:s.spend,views:s.views,clicks:s.clicks,cpc:s.cpc,spendNote:undefined,
        clicksChip:s.clicks&&C.hasValue(s.clicks)&&s.clicks.state!=='stale'&&s.clicks.allTime!==undefined?U.reasonButton(C.full(s.clicks.allTime)+' All-Time',s.clicks.reason,'fv-chip'):undefined};

      strip=kpiStrip(k);
    }else if(tab==='instagram')strip=U.strip([metric('Spend','wallet',xKpis(shown).spend,'moneyShort'),metric('Posts','image',M.value(shown.filter(x=>x.live===true).length,{reason:'Instagram posts and stories marked up in the source sheet.'}))]);
    else strip=kpiStrip(xKpis(shown));
    // Compact, campaign-wide (All Time) budget and IG summary, on the Overview only.
    const b=s?.budget,live=c=>c&&!c.unavailable;
    const outstanding=s?(s.planned||0)+(C.num(s.committed)||0):0;
    const igSpend=live(ig)?C.spendOf(ig):null,igPosts=live(ig)?(ig.rows||[]).filter(r=>r.posted===true).length:null;
    const budget=tab==='overview'&&b?U.supportPanel('Budget','wallet',U.inlineMetrics([
      ['Budget',U.value(b.budget,'money')],
      ['Paid',U.value(s.spend,'money')],
      ['Committed',U.value(M.value(s.committed||0),'money')],
      ['Planned',U.value(M.value(s.planned||0),'money')],
      ['Remaining',U.value(b.remaining,'money')],

    ].filter(Boolean))):'';
    // Views chart for the posts in this tab (every post, including extra posts on a booking); Spend by group on the Overview.
    const ids=postIdsOf(shown);
    const history=gr&&tab!=='instagram'?[...(gr.history||[]),...(gr.originals?.history||[]),...(gr.mandy?.history||[])].filter(h=>ids.has(String(h.id||''))):[];
    const clickDays=tab==='instagram'?[]:shortIoDaily(gtaClickReport(gr),shown);
    const chart=viewsChart('gta-chart','gta-vi',history,{extra:clickDays.length?[{key:'clicks',label:'Daily Clicks',title:'Daily Clicks',series:clickDays,period:'Day',unit:'Clicks'}]:[]});
    let body;
    const eff=C.placementEfficiency(shown.map(x=>x.raw));
    const quoted=new Map([...(qr?.quotedOriginals?.rows||[]),...(mq?.quotedOriginals?.rows||[])].flatMap(o=>(o.qrts||[]).map(q=>[q.postUrl,o])));
    body=chart+filteredNote(f)+xTable('gta-vi',id,{title:tab==='overview'?'Results':tabs.find(t=>t.key===tab).label+' Results',icon:tab==='instagram'?'image':'gamepad',records:scoped,f,groups:tab==='overview',empty:s?'No results':waiting('Loading…'),expand:x=>{const o=quoted.get(x.raw.postUrl);return xDetail(x,eff,{source:o?U.extLink(o.originalUrl,o.handle?'@'+o.handle:'Source Post'):'',extra:[['Original Views',o&&C.num(o.views)!==null?esc(C.full(o.views)):'']]});}})+(tab==='overview'?budget:'');
    // Shown only when a spreadsheet tab could not be read, so its rows are missing from the totals.
    const tabWarning=(qr?.missingTabs||[]).map(t=>'<div class="fv-notice" role="status">'+U.icon('alert',15)+'<span>'+U.reasonButton('Missing Data',t+' could not be read from the spreadsheet, so its rows are not counted.','fv-notice-reason')+'</span></div>').join('');
    const label=tab==='overview'?'Campaign Performance':tabs.find(t=>t.key===tab).label+' Performance';
    return {title:'GTA VI',chip:'gta-vi',refreshLabel:'Refresh',updated:ov?.checkedAt,stale:!!(D.overviewStatus().error||qr?.sourceStale||og?.sourceStale),
      body:overviewNotice()+tabWarning+subTabs(tabs,tab)+strip+body};
  }

  // Viral campaigns reuse their canonical placement objects; never add a second finance record.
  const gtaClickReport=gr=>({activity:[...(gr?.activity||[]),...(gr?.originals?.activity||[]),...(gr?.mandy?.activity||[])]});
  function shortIoDaily(report,records){
    const links=new Map(records.filter(x=>x.live).map(x=>[String(x.raw.code),x]));
    const sums=new Map();
    for(const r of report?.activity||[]){if(!links.has(String(r.code))||C.num(r.clicks)===null)continue;const d=sums.get(r.date)||{value:0,codes:new Set(),stale:false};if(d.codes.has(String(r.code)))continue;d.codes.add(String(r.code));d.value+=r.clicks;d.stale||=r.stale===true;sums.set(r.date,d);}
    return [...sums].sort(([a],[b])=>a.localeCompare(b)).map(([date,d])=>{
      const expected=[...links.values()].filter(x=>{const born=C.londonDay(postBorn(x.raw.postUrl));return born&&born<=date;}).length;
      return {week:date,label:C.dayShort(date),range:C.dayLong(date),value:d.value,incomplete:date===C.londonDay(Date.now())||d.codes.size<expected||d.stale,extra:d.codes.size+' tracked links with a verified daily reading'+(d.codes.size<expected?' of '+expected:'')+'. Human clicks since each QRT was published.'};
    }).slice(-14);
  }
  function viralPage(st){
    ensure('overview');ensure('gta');
    const ov=D.overview(),gr=D.gta().report;
    const sources=(ov?.campaigns||[]).filter(c=>c.id==='gta-mandy'||c.viral===true);
    const quoted=sources.flatMap(c=>c.quotedOriginals?.rows||[]);
    const mapping=new Map(quoted.flatMap(o=>(o.qrts||[]).map(q=>[C.postId(q.postUrl),o])));
    const records=sources.flatMap(c=>(c.rows||[]).filter(isBooking).map(r=>xRecord(r,{campaign:c.name,parent:c.id==='gta-mandy'?'GTA VI':c.name,type:'qrt',clicks:gtaClicks})));
    const f=xState('viral-qrts','viral-results'),shown=records.filter(xMatch(f));
    const ids=postIdsOf(shown),daily=shortIoDaily(gr?.mandy,shown),chart=viewsChart('viral-chart','viral-qrts',gr?(gr.mandy?.history||[]).filter(h=>ids.has(String(h.id||''))):[],{extra:daily.length?[{key:'clicks',label:'Daily Clicks',title:'Daily Clicks',series:daily,period:'Day',unit:'Clicks'}]:[]});
    const groupKey=x=>mapping.get(C.postId(x.raw.postUrl))?.originalPostId||'unmatched';
    const eff=C.placementEfficiency(shown.map(x=>x.raw));
    const table=U.tablePanel({id:'viral-results',title:'Purchased QRTs',icon:'zap',records,rows:records,search:records.length>10,filter:xMatch(f),filters:xFilters('viral-results',records,f),rowKey:x=>rowKeyOf(x.raw),rowLabel:x=>x.account,
      minWidth:760,cls:'is-list',hideEmpty:false,columns:resultColumns(records,{includeType:false}),groupBy:groupKey,
      groupHeader:(key,list)=>{const o=mapping.get(C.postId(list[0].raw.postUrl));return o?'<b>Original viral post</b> '+U.extLink(o.originalUrl,'@'+o.handle)+'<span>Original views <b>'+count(o.views)+'</b></span><small>Excluded from our QRT results</small>':'<b>Original post not yet verified</b>';},
      expand:x=>xDetail(x,eff)},tableState('viral-qrts','viral-results'));
    const l=look(VIRAL.key);
    return {title:'Viral QRTs',chipHtml:'<span class="fv-campaign-chip" style="background:'+C.PALETTE[l.color].fill+'">'+U.icon(l.icon,15)+'</span>',refreshLabel:'Refresh',updated:ov?.checkedAt,
      body:overviewNotice()+(ov?kpiStrip(xKpis(shown)):loadingStrip(KPI_LOADING))+chart+table};
  }

  function ofPage(st){
    ensure('overview');ensure('of');
    const ov=D.overview(),s=ov?C.campaignSummary(ov,'of-terms'):null,c=D.campaign('of-terms'),rep=D.of().report;
    const records=ofRecords(),f=xState('of-terms','of-results'),shown=records.filter(xMatch(f));
    const k=s?(xActive(f)?xKpis(shown):s):null;
    const codes=new Set(shown.map(x=>String(x.raw.code)));
    const series=rep?.ready&&Array.isArray(rep.activity)?C.dailyEventSeries(rep.activity,{include:r=>codes.has(String(r.code))}):[];
    const chart=U.chartPanel({id:'of-chart',measures:series.length?[{key:'clicks',label:'Clicks',title:'Daily Clicks',series,period:'Day',unit:'Clicks'}]:[]},chartState('of-terms','of-chart'));
    const eff=C.placementEfficiency(shown.map(x=>x.raw));
    return {title:'OF Terms',chip:'of-terms',refreshLabel:'Refresh',updated:ov?.checkedAt,stale:!!c?.sourceStale,
      body:overviewNotice()+(!k?loadingStrip(KPI_LOADING):kpiStrip(k))+chart+xTable('of-terms','of-results',{title:'Publisher Results',icon:'users',records,f,groups:false,includeType:false,expand:x=>xDetail(x,eff)})};
  }

  function guruPage(st){
    ensure('overview');
    const ov=D.overview(),g=D.campaign('guru-rts'),s=ov?C.campaignSummary(ov,'guru-promotion'):null,records=guruRecords();
    const groups=new Map();for(const x of records){const key=C.postId(x.raw.sourcePostUrl||x.raw.postUrl)||'unlinked';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(x);}
    const rows=(g?.rows||[]).map(r=>{const list=groups.get(String(r.id))||[];groups.delete(String(r.id));return {key:String(r.id),r,list,name:guruName(r,g.rows),spend:xKpis(list).spend};});
    for(const [key,list] of groups)rows.push({key,r:{},list,name:'Unmatched original post',spend:xKpis(list).spend});
    const paidRTs=records.filter(x=>x.paid).reduce((n,x)=>n+(C.num(x.raw.purchasedPosts)||1),0);
    const table=U.tablePanel({id:'guru-summary',title:'Promoted Posts',icon:'megaphone',rows,rowKey:r=>r.key,rowLabel:r=>r.name,minWidth:660,cls:'is-list',hideEmpty:false,
      columns:[{key:'name',label:'Original Post',type:'name',html:r=>r.r.postUrl?'<a href="'+esc(C.safeUrl(r.r.postUrl))+'" target="_blank" rel="noopener noreferrer">'+esc(r.name)+'</a>':esc(r.name),sort:r=>r.name},
        {key:'views',label:'Original Views',get:r=>C.num(r.r.views)===null?M.na('No verified original view reading.'):M.value(r.r.views)},
        {key:'rts',label:'Paid RTs',get:r=>r.list.filter(x=>x.paid).reduce((n,x)=>n+(C.num(x.raw.purchasedPosts)||1),0)},
        {key:'spend',label:'RT Spend',format:'money',get:r=>r.spend}],expand:r=>rtCosts(r.list)},tableState('guru-promotion','guru-summary'));
    const adSpend=C.num(g?.boostSpendKnown);
    const chart=viewsChart('guru-chart','guru-promotion',(g?.rows||[]).flatMap(r=>(r.history||[]).map(h=>({...h,id:r.id}))),{noun:'Original Views'});
    return {title:'Guru RTs',chip:'guru-promotion',refreshLabel:'Refresh',updated:ov?.checkedAt,
      body:overviewNotice()+(s?U.strip([metric('Original Views','eye',{...s.views,reason:'Views of the original promoted posts, including organic exposure. These are not exclusively paid impressions.'},'compact'),metric('Spend','wallet',s.spend,'moneyShort'),metric('Paid RTs','refresh',M.value(paidRTs))]):loadingStrip([['Original Views','eye'],['Spend','wallet'],['Paid RTs','refresh']]))+
      chart+table+
      (adSpend!==null?U.supportPanel('Direct X Advertising','wallet',U.inlineMetrics([['X Ad Spend',U.value(M.value(adSpend),'money')]])+'<p class="fv-detail-note">Separate from publisher RT spend and excluded from the RT total above.</p>'):'')};
  }
  // Two promoted posts by the same account are told apart by their post date.
  const postDay=id=>{try{return C.dayShort(C.londonDay(Number((BigInt(String(id))>>22n)+1288834974657n)));}catch{return '';}};
  const guruName=(r,rows)=>{const n=r.publisher||r.handle||'Original post';return (rows||[]).filter(x=>(x.publisher||x.handle)===n).length>1?n+' · '+postDay(r.id):n;};

  /* Placement columns for custom linked campaigns: the same nine columns over raw rows. */
  function placementColumns({clicks}={}){
    return X_COLUMNS.map(c=>({...c,html:c.html?r=>c.html(r.__x||(r.__x=xRecord(r,{campaign:'',type:r.type||'post',clicks}))):undefined,
      get:c.get?r=>c.get(r.__x||(r.__x=xRecord(r,{campaign:'',type:r.type||'post',clicks}))):undefined,
      sort:c.sort?r=>c.sort(r.__x||(r.__x=xRecord(r,{campaign:'',type:r.type||'post',clicks}))):undefined}));
  }

  /* ---------- Accounts: every account across the site's own promotion and article sources ---------- */
  // One account = one platform + handle (from the profile link), else the recorded name.
  function accountKey(x){
    const u=String(x.raw.profileUrl||x.link||''),m=u.match(/^https:\/\/(?:www\.)?(x\.com|twitter\.com|instagram\.com)\/([A-Za-z0-9_.]+)/i);
    const handle=m?m[2]:String(x.raw.handle||x.account||'').match(/@([A-Za-z0-9_.]+)/)?.[1]||String(x.raw.handle||x.account||'').replace(/^@/,'').trim();
    return {key:x.platform+'|'+handle.toLowerCase().replace(/\s+/g,''),handle:m?'@'+m[2]:(x.account||handle)};
  }
  function accountRows(records){
    const by=new Map();
    for(const x of records){const k=accountKey(x);if(!by.has(k.key))by.set(k.key,{key:k.key,name:k.handle,platform:x.platform,records:[]});by.get(k.key).records.push(x);}
    return [...by.values()].map(a=>{
      // Each booking once (tab + row), each post once, each tracking link's clicks once.
      const seen=new Set(),recs=a.records.filter(x=>{const k=rowKeyOf(x.raw)+'|'+x.parent;if(seen.has(k))return false;seen.add(k);return true;});
      const own=recs.filter(x=>x.type!=='RT'&&x.platform==='X').map(x=>x.raw);
      const posts=new Set();let liveNoLink=0;
      for(const x of recs){if(x.live!==true)continue;const ids=(x.raw.postUrls?.length?x.raw.postUrls:[x.link]).map(u=>C.postId(u)).filter(Boolean);if(ids.length)ids.forEach(i=>posts.add(i));else liveNoLink++;}
      const paid=recs.filter(x=>x.paid&&!x.planned&&x.price!==null),links=new Map();
      for(const x of recs){if(!C.hasValue(x.clicks)||x.raw.sharedTracking||x.raw.identityAmbiguous)continue;const k=x.raw.trackingUrl||rowKeyOf(x.raw);links.set(k,Math.max(links.get(k)||0,x.clicks.value));}
      const e=C.efficiency([{source:'ACCOUNTS',rows:own}]);
      const totalPosts=posts.size+liveNoLink,totalClicks=links.size?[...links.values()].reduce((n,v)=>n+v,0):null;
      const clicks=totalClicks!==null?M.value(totalClicks,{reason:'All tracked clicks on this account’s links, ever.'}):M.na('No tracked clicks.');
      // Owner (26 Nov): clicks/post and clicks/$ alongside the existing (all-time) Clicks and CPC.
      const perPost=totalClicks!==null&&totalPosts>0?M.value(totalClicks/totalPosts,{reason:'Total clicks ÷ live posts.'}):M.na('Needs at least one tracked click and one live post.');
      const perDollar=C.hasValue(e.cpc)&&e.cpc.value>0?M.value(1/e.cpc.value,{reason:'The reciprocal of CPC: tracked clicks per dollar spent, from the same matched placements.'}):M.na('Needs a recorded cost and tracked clicks on a placement.');
      return {...a,records:recs,campaigns:[...new Set(recs.map(x=>x.parent))],posts:totalPosts,
        spend:paid.length?M.value(paid.reduce((n,x)=>n+x.price,0)):M.na('No paid placements.'),
        views:C.viewsOf([{source:'ACCOUNTS',rows:own}]),
        clicks,perPost,perDollar,cpc:e.cpc,cpm:e.cpm};
    });
  }
  function accountsPage(st){
    ensure('overview');ensure('gta');ensure('directory');
    const ov=D.overview();
    const all=ov?[...xaRecords(),...gtaRecords(),...igRecords(),...ofRecords(),...guruRecords()]:[];
    const ts=tableState('all-accounts','acc-table'),f=ts.xf||(ts.xf={camp:'',plat:'',type:''});
    if(!ts.sort)ts.sort={key:'clicks',dir:-1};  // biggest spenders first by default
    const shown=all.filter(x=>(!f.camp||x.parent===f.camp)&&(!f.plat||x.platform===f.plat)&&(!f.type||x.type===f.type));
    const sel=(key,label,opts)=>opts.length<2&&!f[key]?'':'<label class="fv-select fv-filter"><span class="fv-sr">'+esc(label)+'</span><select data-xfilter="'+key+'" data-table="acc-table">'+
      [['',label+': All'],...opts.map(o=>[o,label+': '+o])].map(([v,l])=>'<option value="'+esc(v)+'"'+(f[key]===v?' selected':'')+'>'+esc(l)+'</option>').join('')+'</select>'+U.icon('down',14)+'</label>';
    const present=(get,order)=>order.filter(v=>all.some(x=>get(x)===v));
    const filters=sel('camp','Campaign',present(x=>x.parent,C.CAMPAIGNS.map(c=>c.name)))+sel('plat','Platform',present(x=>x.platform,['X','Instagram']))+sel('type','Type',present(x=>x.type,['Post','Article','RT','QRT','Story']));
    const rows=accountRows(shown);
    if(!f.camp&&!f.type&&ts.q?.trim()){const keys=new Set(rows.map(a=>a.key));for(const a of directory.accounts){if(keys.has(a.key)||f.plat&&a.platform!==f.plat)continue;rows.push({key:a.key,name:a.handle,platform:a.platform,campaigns:[],posts:0,records:[],spend:M.na('No paid placement recorded.'),views:M.na('No measured post.'),clicks:M.na('No tracked placement.'),cpc:M.na('No matched traffic.'),perDollar:M.na('No matched traffic.')});}}
    const table=U.tablePanel({id:'acc-table',title:'Publisher Performance',icon:'users',search:true,filters,rows,limit:10,cls:'is-list is-accounts',rowKey:a=>a.key,rowLabel:a=>a.name,minWidth:940,
      searchText:a=>[a.name,...a.records.map(x=>x.account)].join(' '),empty:ov?'No Results':waiting('Loading…'),countLabel:n=>n===1?'account':'accounts',
      expand:a=>!a.records.length?'<p>No purchased placements recorded for this publisher.</p>':rtCosts(a.records)+U.detailGrid(a.records.map(x=>[x.campaign+' · '+x.type,(x.link?U.extLink(x.link,'Post'):'')+' · '+U.value(x.clicks)+' clicks'])),
      columns:[
        {key:'name',label:'Account',type:'name',html:a=>accountName({publisher:a.name},a.platform==='Instagram'?'image':'user'),sort:a=>a.name.toLowerCase()},
        {key:'platform',label:'Platform',type:'text',html:a=>esc(a.platform),sort:a=>a.platform},
        {key:'campaigns',label:'Campaigns',type:'text',html:a=>esc(a.campaigns.join(', ')),sort:a=>a.campaigns.length},
        {key:'posts',label:'Posts',get:a=>M.value(a.posts)},
        {key:'clicks',label:'Clicks',get:a=>a.clicks},
        {key:'views',label:'Views',get:a=>a.views},
        {key:'spend',label:'Spend',format:'money',get:a=>a.spend},
        {key:'cpc',label:'CPC',format:'money',get:a=>a.cpc},
        {key:'perDollar',label:'Clicks/$',format:'rate',get:a=>a.perDollar}
      ]},ts);
    return {title:'Accounts',refreshLabel:'Refresh All',updated:ov?.checkedAt,stale:!!(D.overviewStatus().error||ov?.stale),body:overviewNotice()+(directory.error||directory.stale?'<p class="fv-filter-note">Publisher directory '+(directory.stale?'is showing its last verified copy.':'is temporarily unavailable. Placement history remains available.')+'</p>':'')+table};
  }

  const RENDER={home:homePage,'all-accounts':accountsPage,discord:discordPage,'x-articles':xArticlesPage,'gta-vi':gtaPage,'viral-qrts':viralPage,'of-terms':ofPage,'guru-promotion':guruPage};

  /* ---------- shell rendering ---------- */
  let current=parseHash(),recordsShown=false;
  const hooks={addedRoute:null,navExtra:null,headerExtra:null};  // extension points (campaign manager)
  function navHtml(active){
    const item=p=>{
      const o=p.group==='paid'?look(p.key):null;
      const color=o?C.PALETTE[o.color]?.icon:p.key==='discord'?'var(--fv-discord)':'#FFFFFF';
      return '<a class="fv-nav-item" href="#'+esc(p.key)+'" style="--fv-icon:'+esc(color)+'"'+(p.key===active?' aria-current="page"':'')+'>'+U.icon(o?o.icon:p.icon,17)+'<span>'+esc(p.title)+'</span></a>';
    };
    return '<div class="fv-nav" role="group" aria-label="General">'+PAGES.filter(p=>p.group==='general').map(item).join('')+'</div>'+
      '<div class="fv-nav-group"><span class="fv-nav-group-label" id="fvPaidLabel">Campaigns</span>'+(hooks.navAddButton?hooks.navAddButton():'')+'</div>'+
      '<div class="fv-nav" role="group" aria-labelledby="fvPaidLabel">'+PAGES.filter(p=>p.group==='paid').map(item).join('')+(hooks.navExtra?hooks.navExtra(active):'')+'</div>'+
      '<div class="fv-nav-group"><span class="fv-nav-group-label" id="fvCommunityLabel">Extras</span></div>'+
      '<div class="fv-nav" role="group" aria-labelledby="fvCommunityLabel">'+PAGES.filter(p=>p.group==='community').map(item).join('')+'</div>'+
      '<div class="fv-nav fv-nav-more" role="group" aria-label="More">'+PAGES.filter(p=>p.group==='more').map(item).join('')+'</div>';
  }
  function setNav(active){$('fvNav').innerHTML=navHtml(active);}
  // Built-in campaign icon and colour, with any saved override from the campaign manager.
  function look(key){const d=C.CAMPAIGNS.find(c=>c.key===key)||(key===VIRAL.key?VIRAL:null);const o=hooks.override?.(key);return {icon:o?.icon?glyphName(o.icon):(d.icon==='x'?'xmark':d.icon),color:o?.color||d.color};}
  const glyphName=n=>({'trending-up':'trend','user-plus':'userplus','graduation-cap':'graduation'}[n]||n);
  function setTitle(text){document.title=text+' · '+APP_NAME;}

  function captureFocus(){
    const a=document.activeElement;if(!a||!$('fvPage').contains(a))return null;
    const attrs=['data-search','data-sort','data-expand','data-view','data-chart-type','data-chart-measure','data-filter','data-xfilter','data-reset'];
    const attr=attrs.find(x=>a.hasAttribute(x));if(!attr)return null;
    return {attr,value:a.getAttribute(attr),table:a.getAttribute('data-table'),start:a.selectionStart,end:a.selectionEnd};
  }
  function restoreFocus(f){
    if(!f)return;
    const sel='['+f.attr+'="'+CSS.escape(f.value)+'"]'+(f.table?'[data-table="'+CSS.escape(f.table)+'"]':'');
    const n=$('fvPage').querySelector(sel);if(!n)return;
    n.focus({preventScroll:true});if(f.attr==='data-search'&&typeof f.start==='number')try{n.setSelectionRange(f.start,f.end);}catch{}
  }

  let lastHeader='';
  function render(){
    U.hideTip();
    const r=current;
    const shell=$('fvShell');shell.classList.remove('is-nav-open');
    shell.classList.toggle('is-home',r.kind==='page'&&r.key==='home');
    // Owner (26 Nov): a small back control, top-left, above every page but the Dashboard itself.
    $('fvBack').hidden=r.kind==='page'&&r.key==='home';
    // Page colour for tiles, graphs and pills (owner, 26 Nov, style 74).
    shell.className=shell.className.replace(/\bpg-[\w-]+/g,'').trim()+' pg-'+(r.kind==='page'?r.key:r.kind);
    if(r.kind==='records'){
      const rec=RECORDS[r.key];
      setNav(rec.parent);setTitle(rec.title);
      $('fvHeader').hidden=true;$('fvPage').hidden=true;$('fvPage').innerHTML='';$('fvRecords').hidden=false;
      D.app()?.showRecords?.(r.key);recordsShown=true;
      return;
    }
    // Leave the record views only on navigation; re-renders must not close an open editor.
    if(recordsShown||!$('fvRecords').hidden){D.app()?.showRecords?.('');recordsShown=false;}
    $('fvRecords').hidden=true;
    $('fvHeader').hidden=false;$('fvPage').hidden=false;
    let page;
    if(r.kind==='added'){page=hooks.addedRoute?hooks.addedRoute(r.key):null;
      if(!page)page={title:'Campaign not found',refreshLabel:'',body:'<section class="fv-panel fv-notfound"><h2>Campaign not found</h2><p>This campaign does not exist or has been archived.</p><a class="fv-control" href="#home">'+U.icon('home',15)+'Go to Dashboard</a></section>'};
      setNav(page.navKey||'');
    }else{
      page=RENDER[r.key]({view:r.view});
      setNav(r.key);
    }
    setTitle(page.title);
    const chipDef=C.CAMPAIGNS.find(c=>c.key===page.chip),chipLook=chipDef?look(chipDef.key):null;
    $('fvTitleChip').innerHTML=page.chipHtml||(chipLook?'<span class="fv-campaign-chip" style="background:'+C.PALETTE[chipLook.color].fill+'" aria-hidden="true">'+U.icon(chipLook.icon,15)+'</span>':'');
    if(chipDef&&hooks.extraBody)page.body+=hooks.extraBody(chipDef.key)||'';
    $('fvTitle').textContent=page.title;
    const upd=$('fvUpdated');
    upd.textContent=page.updated?(page.stale?'Last Verified ':'Updated ')+C.stamp(page.updated):'';
    upd.classList.toggle('is-stale',!!page.stale);
    const refresh=$('fvRefresh');
    refresh.hidden=!page.refreshLabel;$('fvRefreshLabel').textContent=page.refreshLabel||'Refresh';
    refresh.setAttribute('aria-label',(page.refreshLabel||'Refresh')+' '+page.title+' data');
    $('fvHeaderExtra').innerHTML=hooks.headerExtra?hooks.headerExtra(r,page):'';
    const key=r.kind+':'+r.key;
    if(lastHeader!==key){$('fvRefreshStatus').textContent='';$('fvRefreshStatus').className='fv-refresh-status';lastHeader=key;}
    const focus=captureFocus();
    $('fvPage').innerHTML=page.body;
    drawCharts();
    restoreFocus(focus);
  }
  // Dashboard tiles: all figures share one size, shrunk just enough for the longest to fit on one line.
  // Figures shrink together until the longest fits on one line; labels keep the same proportion to the figures,
  // so every tile looks the same whatever its size. Dashboard tiles share one size; each key-number card has its own.
  function fitGroup(vals,labels){
    // Skip until laid out (a hidden or not-yet-sized tile would read as zero width).
    if(!vals.length||vals.some(v=>!v.clientWidth))return;
    const set=px=>{vals.forEach(v=>{v.style.fontSize=px?px+'px':'';v.querySelectorAll('*:not(.fv-coverage)').forEach(c=>c.style.fontSize=px?px+'px':'');});
      labels.forEach(l=>l.style.fontSize='');};
    set(0);
    let size=parseFloat(getComputedStyle(vals[0].firstElementChild||vals[0]).fontSize)||25;
    const over=()=>vals.some(v=>{const w=v.clientWidth;return [...v.children].some(c=>c.getBoundingClientRect().width>w+0.5)||v.scrollWidth>w+0.5;});
    set(size);
    for(let i=0;i<40&&over();i++){size-=0.5;set(size);}
  }
  function runFitTiles(){
    const page=$('fvPage');
    // Each period card sizes its own tiles (owner, 26 Nov): a short "Last Week" figure shouldn't be
    // shrunk to match a longer "All Time" one three cards away.
    const cards=[...page.querySelectorAll('.fv-period-card')];
    if(cards.length)cards.forEach(card=>fitGroup([...card.querySelectorAll('.fv-tile-value')],[...card.querySelectorAll('.fv-tile-label')]));
    else fitGroup([...page.querySelectorAll('.fv-tile-value')],[...page.querySelectorAll('.fv-tile-label')]);
    for(const strip of page.querySelectorAll('.fv-panel.fv-strip'))fitGroup([...strip.querySelectorAll('.fv-metric-value')],[...strip.querySelectorAll('.fv-metric-label')]);
  }
  // Several independent background refreshes (GTA, Discord, boosts) can all resolve within the
  // same tick after a tab regains focus, each calling fitTiles. Coalesce them into one pass so
  // they can't pile up redundant synchronous reflow work on the page (owner, 26 Nov: this was
  // making the site freeze after visiting Discord, switching tabs, then opening a campaign).
  let fitPending=false;
  function fitTiles(){
    if(fitPending)return;
    fitPending=true;
    requestAnimationFrame(()=>{fitPending=false;runFitTiles();});
  }
  function drawCharts(){
    fitTiles();setTimeout(fitTiles,400);
    for(const host of $('fvPage').querySelectorAll('.fv-chart')){
      if(host.dataset.type==='table')continue;
      const m=U.getMeasure(host.id,host.dataset.measure);if(m)U.drawChart(host,m,host.dataset.type);
    }
  }
  function rerender(){if(current.kind==='records'){setNav(RECORDS[current.key].parent);return;}render();}

  /* ---------- events ---------- */
  function go(hash){if(location.hash==='#'+hash)rerender();else location.hash=hash;}
  function onHash(){
    const next=parseHash();
    if(next.canonical!==decodeURIComponent(location.hash.replace(/^#/,'')))history.replaceState(history.state,'','#'+next.canonical);
    const changedPage=next.kind!==current.kind||next.key!==current.key;
    current=next;
    if(next.kind==='page')pageState(next.key).view=next.view;
    render();
    if(changedPage)window.scrollTo({top:0,behavior:'instant'in window?'instant':'auto'});
  }
  async function onRefresh(){
    const btn=$('fvRefresh'),status=$('fvRefreshStatus');
    if(btn.disabled)return;
    btn.disabled=true;btn.classList.add('is-busy');btn.setAttribute('aria-busy','true');
    status.className='fv-refresh-status';status.textContent='Refreshing…';
    const app=D.app(),rep=D.rep();
    let message='',error=false,summary='';
    try{
      const k=current.kind==='page'?current.key:'';
      if(current.kind==='added'){const ok=await hooks.refresh?.(current);message=ok?'':'Campaign registry unavailable; last saved details kept.';error=!ok;}
      else if(k==='all-accounts')await loadDirectory();
      if(k==='home'||k==='all-accounts'){await app?.refresh?.all?.();const s=app?.status?.('reloadAllStatus');message=s?.text||'';error=!!s?.error;summary=s?.summary||'';}
      else if(k==='discord'){const ok=await rep?.refreshDiscord?.(true);message=ok?'':'Discord sources unavailable; last verified figures kept.';error=!ok;}
      else{
        const fn={'x-articles':'x','gta-vi':'gta','viral-qrts':'gta','of-terms':'of','guru-promotion':'boosts'}[k];
        const ids={'x-articles':'xRefreshStatus','gta-vi':'gtaRefreshStatus','viral-qrts':'gtaRefreshStatus','of-terms':'ofRefreshStatus','guru-promotion':'boostRefreshStatus'};
        if(fn){await app?.refresh?.[fn]?.();const s=app?.status?.(ids[k]);message=s?.text||'';error=!!s?.error;}
        const ok=await rep?.reload?.();
        if(ok===false){error=true;message=(message?message+' ':'')+'Campaign summary kept from last verified data.';}
      }
    }catch(e){error=true;message='Refresh failed; last verified figures kept.';}
    finally{btn.disabled=false;btn.classList.remove('is-busy');btn.removeAttribute('aria-busy');}
    // Short visible state; the full source detail stays available on hover and to screen readers.
    const partial=error&&/partial|some|kept|unavailable/i.test(message)&&!/failed/i.test(message);
    // Visible, specific result: which sources were unavailable, or how many posts were deleted on X.
    const label=summary||(!error?'Updated':partial?'Partial Refresh':'Refresh Failed');
    status.className='fv-refresh-status '+(error?'is-error':'is-ok');status.title=message||label;status.textContent=label;
    status.setAttribute('aria-label',label+(message?': '+message:''));
    rerender();
  }
  function onClick(e){
    const t=e.target;
    const sort=t.closest('[data-sort]');
    if(sort){const st=tableState(pageKey(),sort.dataset.table),k=sort.dataset.sort;st.sort=st.sort?.key===k?{key:k,dir:-st.sort.dir}:{key:k,dir:k==='account'||k==='name'||k==='week'?1:-1};rerender();return;}
    const exp=t.closest('[data-expand]');
    if(exp){const st=tableState(pageKey(),exp.dataset.table),k=exp.dataset.expand;if(st.expanded.has(k))st.expanded.delete(k);else st.expanded.add(k);rerender();return;}
    const view=t.closest('[data-view]');
    if(view&&current.kind==='page'){const def=defaultView(current.key);go(current.key+(view.dataset.view===def?'':'/'+view.dataset.view));return;}
    const ct=t.closest('[data-chart-type]');
    if(ct){const st=chartState(pageKey(),ct.dataset.chart);st.type=ct.dataset.chartType;rerender();return;}
    const more=t.closest('[data-show-all]');
    if(more){tableState(pageKey(),more.dataset.showAll).showAll=true;rerender();return;}
    const reset=t.closest('[data-reset]');
    if(reset){const st=tableState(pageKey(),reset.dataset.reset);st.q='';st.filter='';if(st.xf)st.xf={group:'',type:'',live:'',pay:''};rerender();return;}
    if(t.closest('[data-retry]')){void D.rep()?.reload?.();return;}
  }
  const pageKey=()=>current.kind==='page'?current.key:'added:'+current.key;
  const defaultView=k=>({'home':'all-time','x-articles':'overview','gta-vi':'overview','of-terms':'overview',discord:'weekly-history','guru-promotion':'overview'}[k]||'');
  function onInput(e){
    const s=e.target.closest('[data-search]');
    if(s){tableState(pageKey(),s.dataset.search).q=s.value;rerender();}
  }
  function onChange(e){
    const m=e.target.closest('[data-chart-measure]');
    if(m){const st=chartState(pageKey(),m.dataset.chartMeasure);st.measure=m.value;st.type='';rerender();return;}
    const xf=e.target.closest('[data-xfilter]');
    if(xf){const st=tableState(pageKey(),xf.dataset.table);(st.xf||(st.xf={group:'',type:'',live:'',pay:''}))[xf.dataset.xfilter]=xf.value;rerender();return;}
    const f=e.target.closest('[data-filter]');
    if(f){tableState(pageKey(),f.dataset.filter).filter=f.value;rerender();}
  }


  let rerenderQueued=false;
  function queueRerender(){if(rerenderQueued)return;rerenderQueued=true;requestAnimationFrame(()=>{rerenderQueued=false;rerender();});}

  function init(){
    // Header icons are injected so static HTML stays text-only.
    $('fvRefresh').insertAdjacentHTML('afterbegin',U.icon('refresh',15));
    $('fvMenu').innerHTML=U.icon('grid',26);$('fvDrawerClose').innerHTML=U.icon('close',20);
    $('fvBack').innerHTML=U.icon('back',14)+'<span>Back</span>';
    $('fvBack').addEventListener('click',()=>history.back());
    U.bindTips(document.body);
    const page=$('fvPage');
    page.addEventListener('click',onClick);page.addEventListener('input',onInput);page.addEventListener('change',onChange);
    $('fvRefresh').addEventListener('click',onRefresh);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){if($('fvShell').classList.contains('is-nav-open')){$('fvShell').classList.remove('is-nav-open');$('fvMenu').setAttribute('aria-expanded','false');$('fvMenu').focus();}}});
    // The menu button opens the dropdown under the header and closes it again.
    const close=()=>{$('fvShell').classList.remove('is-nav-open');$('fvMenu').setAttribute('aria-expanded','false');$('fvMenu').setAttribute('aria-label','Open menu');};
    $('fvMenu').addEventListener('click',()=>{
      if($('fvShell').classList.contains('is-nav-open')){close();return;}
      $('fvShell').classList.add('is-nav-open');$('fvMenu').setAttribute('aria-expanded','true');$('fvMenu').setAttribute('aria-label','Close menu');
      setTimeout(()=>$('fvNav').querySelector('[aria-current="page"],a')?.focus({preventScroll:true}),60);});
    $('fvDrawerClose').addEventListener('click',close);$('fvScrim').addEventListener('click',close);
    $('fvNav').addEventListener('click',e=>{if(e.target.closest('a'))close();});
    window.addEventListener('hashchange',onHash);
    window.addEventListener('xtracker:campaign-overview',queueRerender);
    window.addEventListener('xtracker:data',queueRerender);
    window.addEventListener('xtracker:discord',queueRerender);
    // Tile figures are re-fitted once the display font has loaded (it is wider than the fallback).
    document.fonts?.ready?.then(()=>{if(current.kind!=='records')fitTiles();});document.fonts?.load?.('900 25px Montserrat').then(()=>{if(current.kind!=='records')fitTiles();}).catch(()=>{});document.fonts?.addEventListener?.('loadingdone',()=>{if(current.kind!=='records')fitTiles();});
    let w=window.innerWidth;
    window.addEventListener('resize',()=>{if(Math.abs(window.innerWidth-w)<2)return;w=window.innerWidth;U.hideTip();if(current.kind!=='records')drawCharts();},{passive:true});
    // Reload-all reports Discord status through these hooks; they reuse the
    // validated Discord adapter instead of the superseded standalone scripts.
    window.XTrackerDiscordMembers={refresh:()=>D.rep()?.refreshDiscord?.(true)};
    window.XTrackerDiscordCourse={refresh:()=>D.rep()?.refreshDiscord?.(true)};
    onHash();
  }
  window.FanvueApp=Object.freeze({hooks,rerender,go,parseHash,RECORDS,LEGACY,PAGES,data:D,state:pageState,tableState,
    placementColumns,metric,outcomeItems,reporting:Object.freeze({xKpis,periodTotals,accountRows,discordStats,pages:RENDER})});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
