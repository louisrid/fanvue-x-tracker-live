/* Fanvue Marketing Dashboard: shell, router and the seven pages (DESIGN §4).
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
  const ensured=new Set();
  function ensure(name){
    if(ensured.has(name))return;ensured.add(name);
    try{
      if(name==='overview')void D.rep()?.ensure?.();
      if(name==='discord')void D.rep()?.refreshDiscord?.(false);
      if(name==='gta')void D.app()?.loadGta?.(false);
      if(name==='of')void D.app()?.loadOf?.(false);
    }catch(e){console.warn('Source load failed',name,e);}
  }

  /* ---------- routes ---------- */
  const PAGES=[
    {key:'home',title:'Home',icon:'home',group:'general'},
    {key:'discord',title:'Discord',icon:'discord',group:'general'},
    ...C.CAMPAIGNS.map(c=>({key:c.key,title:c.name,icon:c.icon,group:'paid',color:c.color}))
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
    'report-harness':'cis',
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
  const pageState=key=>ui[key]||(ui[key]={chart:{},tables:{},view:''});
  const tableState=(page,id)=>{const s=pageState(page);return s.tables[id]||(s.tables[id]={sort:null,q:'',expanded:new Set(),filter:''});};

  /* ---------- shared formatting helpers ---------- */
  const metric=(label,iconName,m,format='count',note)=>({label,icon:iconName,metric:m,format,note});
  const outcomeItems=(c)=>[
    metric('Creator signups','user',c?.signups||M.na(C.OUTCOME_REASON)),
    metric('KYC completions','shield',c?.kyc||M.na(C.OUTCOME_REASON)),
    metric('Earning creators','check',c?.earning||M.na(C.OUTCOME_REASON))
  ];
  const feedDown=()=>Boolean(D.overviewStatus().error)&&!D.overview();
  const FEED_DOWN='The reporting feed is unavailable and this browser has no saved copy yet. Retry shortly.';
  const loadingStrip=labels=>U.strip(labels.map(([l,i])=>metric(l,i,feedDown()?M.na(FEED_DOWN):M.loading())));
  const waiting=text=>feedDown()?'Data is temporarily unavailable. Last verified figures will show once the feed responds.':text;
  const money=v=>C.num(v)===null?U.reasonButton('Not available','No cost recorded in the source.'):esc(C.money(v));
  const count=v=>C.num(v)===null?U.reasonButton('Not available',''):esc(C.full(v));
  const when=v=>v?esc(C.stamp(v)):U.reasonButton('Not available','No timestamp recorded.');
  const pubStatus=r=>r.posted===true?U.status('Published','good'):r.stage==='booked'?U.status('Booked'):r.stage==='planned'?U.status('Planned'):r.paid?U.status('Awaiting publication','warn'):U.status('Not published');
  const payStatus=r=>r.paid===true?U.status('Paid','good'):C.num(r.cost)!==null?U.status('Unpaid'):U.status('No cost recorded');
  const placementSpend=r=>r.paid===true?(C.num(r.cost)===null?M.na('Paid, but no cost is recorded.'):M.value(r.cost)):
    M.na(C.num(r.cost)!==null?'Not paid yet. Agreed cost '+C.money(r.cost)+'.':'Not paid and no cost recorded.');
  const viewsOfRow=r=>{const v=C.num(r.views??r.xViews);if(v!==null)return M.value(v);
    if(r.posted!==true)return M.na('Not published yet.');
    if(!C.postId(r.postUrl))return M.na('No X post link recorded.');
    return M.na(r.metricError||'No verified X reading yet.');};
  const accountName=(r,iconName='user')=>'<span class="fv-name">'+U.marker(iconName,'',{plain:true})+'<span>'+esc(r.publisher||r.name||r.handle||'Unnamed account')+'</span></span>';
  const liveLink=r=>r.posted===true&&C.safeUrl(r.postUrl)?U.extLink(r.postUrl,'Open live post by '+(r.publisher||'publisher'),{iconOnly:true}):
    U.reasonButton('Not available',r.posted===true?'No live post link recorded.':'Not published yet.');
  const trackingText=url=>url?'<span class="fv-mono">'+esc(url)+'</span>':U.reasonButton('Not available','No tracking link recorded.');
  const engagement=r=>{const l=C.num(r.likes??r.xLikes),rp=C.num(r.reposts??r.xShares),re=C.num(r.replies??r.xComments),v=C.num(r.views??r.xViews);
    if([l,rp,re].some(x=>x===null))return U.reasonButton('Not available','Some engagement counters are missing.');
    return esc(C.full(l)+' likes · '+C.full(rp)+' reposts · '+C.full(re)+' replies'+(v>0?' · '+((l+rp+re)/v*100).toFixed(2)+'%':''));};
  const ALIGNED=['24%','12.5%','12.5%','12.5%','12.5%','11.5%','11.5%','3%'];

  /* Placement view columns: the canonical order, then status and live post. */
  function placementColumns({relationship,clicks}={}){
    const cols=[
      {key:'account',label:'Account',type:'name',html:r=>accountName(r),sort:r=>String(r.publisher||'').toLowerCase()},
      {key:'spend',label:'Paid spend',format:'money',get:placementSpend},
      {key:'views',label:'Post views',get:viewsOfRow},
      {key:'clicks',label:'Tracked clicks',get:clicks||(()=>M.notTracked('No tracked link for this placement.'))},
      {key:'signups',label:'Creator signups',get:()=>M.na(C.OUTCOME_REASON)},
      {key:'status',label:'Publication status',type:'status',html:pubStatus,sort:r=>r.posted===true?2:r.paid?1:0},
      {key:'live',label:'Live post',type:'link',html:liveLink}
    ];
    if(relationship)cols.push(relationship);
    return cols;
  }
  const placementFilter=(page,id)=>{
    const st=tableState(page,id);
    const opts=[['','All records'],['paid','Paid'],['published','Published'],['pending','Paid, awaiting publication'],['unpaid','Not paid']];
    return '<label class="fv-select fv-filter"><span class="fv-sr">Filter records</span><select data-filter="'+esc(id)+'">'+opts.map(([v,l])=>'<option value="'+v+'"'+(st.filter===v?' selected':'')+'>'+l+'</option>').join('')+'</select>'+U.icon('down',14)+'</label>';
  };
  const applyFilter=f=>r=>!f||(f==='paid'&&r.paid===true)||(f==='published'&&r.posted===true)||(f==='pending'&&r.paid===true&&r.posted!==true)||(f==='unpaid'&&r.paid!==true);

  /* ---------- pages ---------- */
  function overviewNotice(){
    const st=D.overviewStatus(),ov=D.overview();
    if(st.error&&ov)return '<div class="fv-notice" role="status">'+U.icon('alert',15)+'<span>Latest refresh failed; showing the last verified data from '+esc(C.stamp(ov.checkedAt))+'.</span><button type="button" data-retry>Retry</button></div>';
    if(st.error&&!ov)return '<div class="fv-notice is-error" role="alert">'+U.icon('alert',15)+'<span>Reporting data is temporarily unavailable.</span><button type="button" data-retry>Retry</button></div>';
    if(ov?.stale)return '<div class="fv-notice" role="status">'+U.icon('alert',15)+'<span>The reporting feed is showing its last verified snapshot.</span></div>';
    return '';
  }
  const summaries=()=>{const ov=D.overview();return ov?C.CAMPAIGNS.map(c=>C.campaignSummary(ov,c.key,{gtaReport:D.gta().report})):null;};

  function homePage(st){
    ensure('overview');ensure('discord');ensure('gta');
    const ov=D.overview(),S=summaries();
    const strip=!S?loadingStrip([['Paid spend','wallet'],['Post views','eye'],['Tracked clicks','cursor'],['Creator signups','user'],['KYC completions','shield'],['Earning creators','check']]):(()=>{
      const T=C.homeTotals(ov,S);
      return U.strip([metric('Paid spend','wallet',T.spend,'moneyShort'),metric('Post views','eye',T.views,'compact'),metric('Tracked clicks','cursor',T.clicks),...outcomeItems(null)]);
    })();
    const chart=U.chartPanel({id:'home-chart',empty:{title:'Post views by week',
      reason:'No combined weekly series is shown: campaign feeds start on different dates and partly overlap, so adding them would create false jumps. Weekly charts are on',
      links:' <a href="#x-articles">X Articles</a>, <a href="#of-terms">OF Terms</a> and <a href="#guru-promotion">Guru Promotion</a>.'}},{});
    const rows=S?S.map(s=>({...s,def:C.CAMPAIGNS.find(c=>c.key===s.key)})):[];
    const table=U.tablePanel({id:'home-results',title:'Campaign results',icon:'layers',rows,rowKey:r=>r.key,rowLabel:r=>r.def.name,widths:ALIGNED,
      empty:S?'No campaigns.':waiting('Loading campaign results…'),countLabel:n=>n===1?'campaign':'campaigns',
      columns:[
        {key:'name',label:'Campaign',type:'name',html:r=>'<a class="fv-name" href="#'+esc(r.key)+'">'+U.marker(r.def.icon==='x'?'xmark':r.def.icon,r.def.color)+'<span>'+esc(r.def.name)+'</span></a>',sort:r=>r.def.name},
        {key:'spend',label:'Paid spend',format:'money',get:r=>r.spend},
        {key:'views',label:'Post views',get:r=>r.views,html:r=>(r.key==='guru-promotion'&&C.hasValue(r.views)?U.reasonButton('Original','Original-post views, not paid repost views.','fv-chip fv-cell-chip')+' ':'')+U.value(r.views)},
        {key:'clicks',label:'Tracked clicks',get:r=>r.clicks,html:r=>(r.clicks?.state==='stale'?U.reasonButton('Stale',r.clicks.reason,'fv-chip is-warn fv-cell-chip')+' ':'')+U.value(r.clicks)},
        {key:'signups',label:'Creator signups',get:r=>r.signups},
        {key:'earning',label:'Earning creators',get:r=>r.earning},
        {key:'cps',label:'Cost per signup',format:'money',get:r=>r.cps}
      ],
      expand:r=>homeDetail(r)},tableState('home','home-results'));
    const dd=D.discord(),members=dd.members,clicks=dd.clicks;
    const net=netGrowth(members);
    const discord=U.supportPanel('Discord','discord',U.inlineMetrics([
      ['Members',members?.latest?U.value(M.value(members.latest.memberCount))+(members.source==='DISCORD_INVITE_APPROXIMATE'?' '+U.reasonButton('Approximate','Discord bot unavailable; approximate invite count.','fv-chip is-warn'):''):U.value(dd.error&&!members?M.na('Discord member count is temporarily unavailable.'):M.loading())],
      ['Net growth',U.value(net,'signed')],
      ['Course clicks',clicks?U.value(M.value(clicks.total)):U.value(dd.error?M.na('Course click counter is temporarily unavailable.'):M.loading())],
      ['Creator signups',U.value(M.na(C.OUTCOME_REASON))]
    ]),'<a class="fv-control" href="#discord">View Discord'+U.icon('right',14)+'</a>');
    const attention=S?needsAttention(ov,S):[];
    const attn=attention.length?U.supportPanel('Needs attention','alert',attention.slice(0,5).map(a=>U.supportLine(U.status(a.tag,a.tone||'warn')+' '+esc(a.text),'<a href="#'+esc(a.href)+'">Review'+'</a>')).join('')):'';
    return {title:'Home',refreshLabel:'Refresh all',updated:ov?.checkedAt,stale:!!(D.overviewStatus().error||ov?.stale),
      body:overviewNotice()+strip+chart+table+discord+attn};
  }
  function homeDetail(r){
    const parts=r.spend?.parts;
    const items=[
      ['Paid placements',r.paidCount===null?U.reasonButton('Not available','Not connected.'):count(r.paidCount)],
      ['Published posts',r.published===null?U.reasonButton('Not available','Not connected.'):count(r.published)],
      ['KYC completions',U.value(r.kyc)],
      ['Approved budget',U.reasonButton('Not available','No approved budget is recorded in a connected source.')],
      parts?['Spend breakdown',esc('Articles '+(C.hasValue(parts.articles)?C.money(parts.articles.value):'n/a')+' · paid reposts '+(C.hasValue(parts.reposts)?C.money(parts.reposts.value):'n/a'))]:null,
      ['Click definition',r.clicks?.provider?esc(r.clicks.provider):U.value(r.clicks)],
      r.key==='gta-vi'&&r.clicks?.allTime!==undefined?['All-time human clicks',esc(C.full(r.clicks.allTime))]:null,
      ['Views coverage',r.views?.posts?esc(C.full(r.views.measured)+' of '+C.full(r.views.posts)+' published posts measured'):U.value(r.views)],
      ['Source verified',r.verifiedAt?esc(C.stamp(r.verifiedAt)):U.reasonButton('Not available','Not connected.')],
      ['Earning creators',U.value(r.earning)],
      ['Cost per signup',U.value(r.cps,'money')],
      ['Next step','<a href="#'+esc(r.key)+'">Open '+esc(r.def.name)+'</a>']
    ];
    const warn=r.warnings.length?'<p class="fv-detail-note">'+r.warnings.map(esc).join(' ')+'</p>':'';
    return U.detailGrid(items)+warn;
  }
  function needsAttention(ov,S){
    const out=[],find=id=>ov.campaigns.find(c=>c.id===id);
    const pend=(id,label,href)=>{const c=find(id);if(!c||c.unavailable)return;const n=(c.rows||[]).filter(r=>r.paid===true&&r.posted!==true).length;
      if(n)out.push({tag:'Pending',text:label+': '+n+' paid '+(n===1?'placement':'placements')+' awaiting publication',href,weight:n});};
    const rt=find('article-rts');
    if(rt?.articleRtSummary?.unlinkedPaidCount)out.push({tag:'Missing link',text:'X Articles: '+rt.articleRtSummary.unlinkedPaidCount+' paid reposts ('+C.money(rt.articleRtSummary.unlinkedPaidSpendKnown)+') have no original post link',href:'x-articles/paid-reposts',weight:100});
    const gta=S.find(s=>s.key==='gta-vi');
    if(gta?.clicks?.state==='stale')out.push({tag:'Stale',text:'GTA VI: Short.io clicks are showing the last verified reading',href:'gta-vi',weight:90});
    pend('gta-qrts','GTA VI quote posts','gta-vi/x-quote-posts');pend('gta-originals','GTA VI original posts','gta-vi/x-original-posts');
    pend('x-articles','X Articles','x-articles/original-posts');pend('of-terms','OF Terms','of-terms');
    if(rt&&!rt.unavailable){const n=(rt.rows||[]).filter(r=>r.paid===true&&r.posted!==true).length;if(n)out.push({tag:'Pending',text:'X Articles: '+n+' paid reposts not marked published',href:'x-articles/paid-reposts',weight:n});}
    for(const s of S)if(s.views?.state==='partial'&&s.key!=='home')out.push({tag:'Coverage',tone:'',text:C.CAMPAIGNS.find(c=>c.key===s.key).name+': '+s.views.reason,href:s.key,weight:5});
    return out.sort((a,b)=>b.weight-a.weight);
  }
  function netGrowth(members){
    const h=(members?.history||[]).filter(x=>Number.isSafeInteger(x?.memberCount)).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    if(!members)return M.loading();
    if(h.length<2||h[0].date===h.at(-1).date)return M.na('Net growth needs two dated daily snapshots. '+(h.length?'Snapshots began '+C.dayLong(h[0].date)+'.':'No snapshot recorded yet.'));
    return M.value(h.at(-1).memberCount-h[0].memberCount,{chip:'Since '+C.dayShort(h[0].date),reason:'Difference between the daily snapshots of '+C.dayLong(h[0].date)+' and '+C.dayLong(h.at(-1).date)+'. Joins and departures are not tracked separately.'});
  }

  function discordPage(st){
    ensure('discord');
    const dd=D.discord(),members=dd.members,clicks=dd.clicks;
    const approx=members?.source==='DISCORD_INVITE_APPROXIMATE';
    const mm=members?.latest?M.value(members.latest.memberCount,{chip:approx?'Approximate':'Live count',
      reason:approx?'The Discord bot was unavailable, so this is the approximate invite count.':'Live member count from the Academy bot. A point-in-time figure, never summed.'}):dd.loading||(!members&&!dd.error)?M.loading():M.na('Discord member count is temporarily unavailable.');
    if(approx&&mm.state==='value')mm.state='partial';
    const net=netGrowth(members);
    const cc=clicks?M.value(clicks.total,{chip:C.full(clicks.last7Days)+' in last 7 days',reason:'Clicks on the Discord free-course button since the counter was enabled ('+(clicks.source==='DISCORD_BOT_LIVE'?'live bot count':'tracking fallback')+'). Not enrolments or signups.'}):dd.loading||!dd.error?M.loading():M.na('Course click counter temporarily unavailable.');
    const strip=U.strip([
      metric('Members','users',mm,'count'),metric('Net growth','trend',net,'signed'),metric('Course clicks','graduation',cc),
      metric('Creator signups','user',M.na(C.OUTCOME_REASON)),
      metric('Joins','plus',M.notTracked('The member endpoint reports totals only; joins cannot be derived from net growth.')),
      metric('Departures','minus',M.notTracked('The member endpoint reports totals only; departures cannot be derived from net growth.'))
    ]);
    const weeks=C.memberWeeks(members?.history);
    const netSeries=weeks.filter(w=>w.value!==null);
    const endSeries=weeks.filter(w=>w.end!==null).map(w=>({...w,value:w.end}));
    const first=(members?.history||[]).map(h=>h.date).sort()[0];
    const chart=U.chartPanel({id:'discord-chart',measures:[
      netSeries.length>=1?{key:'net',label:'Net membership growth',title:'Net membership growth by week',series:netSeries,format:'signed',unit:'Net growth',kinds:['bar','line','table']}:null,
      endSeries.length>=2?{key:'members',label:'Total members',title:'Members at week end',series:endSeries,unit:'Members',kinds:['line','bar','table']}:null
    ].filter(Boolean),empty:{title:'Net membership growth by week',reason:first?'Weekly growth needs daily snapshots across two weeks. Snapshots began '+C.dayLong(first)+'.':'No dated membership snapshots are available yet.'}},pageState('discord').chart);
    const view=st.view==='growth-sources'?'growth-sources':'weekly-history';
    const table=view==='weekly-history'?U.tablePanel({id:'discord-table',title:'Weekly history',icon:'users',view,views:[{key:'growth-sources',label:'Growth sources'},{key:'weekly-history',label:'Weekly history'}],
      rows:weeks.filter(w=>w.snapshots).slice().reverse(),rowKey:r=>r.week,
      empty:members?'No dated snapshots yet.':waiting('Loading membership history…'),
      columns:[
        {key:'week',label:'Week',type:'name',html:r=>esc(r.range)+(r.incomplete?' '+U.status('In progress'):''),sort:r=>r.week},
        {key:'start',label:'Start members',get:r=>r.start===null?M.na('No snapshot from the previous week.'):M.value(r.start)},
        {key:'joins',label:'Joins',get:()=>M.notTracked('Not tracked by the member endpoint.')},
        {key:'departures',label:'Departures',get:()=>M.notTracked('Not tracked by the member endpoint.')},
        {key:'net',label:'Net growth',format:'signed',get:r=>r.value===null?M.na('Needs the previous week’s snapshot.'):M.value(r.value)},
        {key:'end',label:'End members',get:r=>M.value(r.end)}
      ]},tableState('discord','discord-table')):
      U.tablePanel({id:'discord-table',title:'Growth sources',icon:'users',view,views:[{key:'growth-sources',label:'Growth sources'},{key:'weekly-history',label:'Weekly history'}],rows:[],rowKey:r=>r.key,
        empty:'No growth-source data is connected. Joins, valid referrals and attribution need a source; no sources are shown until one exists.',columns:[]},tableState('discord','discord-table'));
    return {title:'Discord',chip:'discord',refreshLabel:'Refresh',updated:members?.checkedAt||clicks?.checkedAt,stale:!!dd.error,body:strip+chart+table};
  }

  function xArticlesPage(st){
    ensure('overview');
    const ov=D.overview(),s=ov?C.campaignSummary(ov,'x-articles'):null,xa=D.campaign('x-articles'),rt=D.campaign('article-rts'),dash=D.dashboard();
    const parts=s?.spend?.parts;
    const strip=!s?loadingStrip([['Paid spend','wallet'],['Post views','eye'],['Tracked clicks','cursor'],['Creator signups','user'],['KYC completions','shield'],['Earning creators','check']]):U.strip([
      metric('Paid spend','wallet',s.spend,'moneyShort',parts?'Incl. paid reposts':undefined),
      metric('Post views','eye',s.views,'compact'),
      metric('Tracked clicks','cursor',s.clicks,'count','Site redirects'),
      ...outcomeItems(s)
    ]);
    if(parts&&s.spend)s.spend.reason='Articles '+(C.hasValue(parts.articles)?C.money(parts.articles.value):'n/a')+' + paid reposts '+(C.hasValue(parts.reposts)?C.money(parts.reposts.value):'n/a')+'. Each payment row counted once.';
    if(s?.clicks?.state==='value'){
      const off=(xa?.rows||[]).filter(r=>(r.posted!==true||r.campaignId==='UNASSIGNED')&&C.num(r.clicks)>0).reduce((a,r)=>a+C.num(r.clicks),0);
      s.clicks.reason='Clicks on the site’s /r/ and /s/ tracking links'+(dash?.raw?.clickCountStartAt?' since '+C.dayLong(C.londonDay(dash.raw.clickCountStartAt)):'')+'.'+(off?' Includes '+C.full(off)+' clicks on placements that are unpublished or unassigned.':'');
    }
    const codes=new Set((xa?.rows||[]).map(r=>String(r.code||'')));
    const viewsSeries=dash?C.snapshotSeries(dash.history,{id:r=>r.postId||r.code,at:r=>r.at,value:r=>r.views}).map(p=>({...p,extra:p.count+' posts with a reading'})):[];
    const clickSeries=dash&&dash.activityReady?C.eventSeries(dash.activity,{include:r=>codes.has(String(r.code))}):[];
    const chart=U.chartPanel({id:'xa-chart',measures:[
      viewsSeries.length?{key:'views',label:'Post views (cumulative)',title:'Post views by week',series:viewsSeries,format:'compact',tipFormat:'count',unit:'Cumulative views at week end'}:null,
      clickSeries.length?{key:'clicks',label:'Tracked clicks',title:'Tracked clicks by week',series:clickSeries,unit:'Tracked clicks',defaultType:'line'}:null
    ].filter(Boolean),empty:{title:'Post views by week',reason:dash?'No dated readings are available yet.':waiting('Loading weekly history…')}},pageState('x-articles').chart);
    const view=['original-posts','paid-reposts'].includes(st.view)?st.view:'articles';
    const views=[{key:'articles',label:'Articles'},{key:'original-posts',label:'Original posts'},{key:'paid-reposts',label:'Paid reposts'}];
    let table;
    if(view==='articles'){
      const names=new Map((dash?.campaigns||[]).map(c=>[c.id,c.name]));
      const rows=(xa?.sourceCampaigns||[]).filter(c=>c.placements>0).map(c=>({...c,name:names.get(c.id)||c.name}));
      table=U.tablePanel({id:'xa-table',title:'Article results',icon:'layers',view,views,search:true,rows,rowKey:r=>r.id,rowLabel:r=>r.name,widths:ALIGNED,
        empty:xa?'No article placements recorded.':waiting('Loading article results…'),searchText:r=>r.name,
        columns:[
          {key:'name',label:'Article',type:'name',html:r=>'<span class="fv-name">'+U.marker('doc','',{plain:true})+'<span>'+esc(r.name)+'</span></span>',sort:r=>r.name},
          {key:'spend',label:'Paid spend',format:'money',get:r=>C.num(r.paidSpendKnown)===null?M.na('No paid placements recorded.'):r.unknownPaidCosts?M.partial(r.paidSpendKnown,r.unknownPaidCosts+' paid placements have no cost.'):M.value(r.paidSpendKnown)},
          {key:'views',label:'Post views',get:r=>C.num(r.xViews)===null?M.na(r.published?'No verified X reading yet.':'No published posts yet.'):M.value(r.xViews)},
          {key:'clicks',label:'Tracked clicks',get:r=>C.num(r.trackedClicks)===null?M.na('No tracked clicks recorded.'):M.value(r.trackedClicks)},
          {key:'signups',label:'Creator signups',get:()=>M.na(C.OUTCOME_REASON)},
          {key:'published',label:'Published posts',get:r=>M.value(r.published)},
          {key:'cps',label:'Cost per signup',format:'money',get:()=>M.na('Needs connected creator signups and matched spend.')}
        ],expand:r=>articleDetail(r,xa)},tableState('x-articles','xa-table'));
    }else if(view==='original-posts'){
      const names=new Map((dash?.campaigns||[]).map(c=>[c.id,c.name]));
      const ts=tableState('x-articles','xa-orig');
      table=U.tablePanel({id:'xa-orig',title:'Original posts',icon:'doc',view,views,search:true,filters:placementFilter('x-articles','xa-orig'),filter:applyFilter(ts.filter),
        rows:xa?.rows||[],rowKey:r=>r.code,rowLabel:r=>r.publisher,minWidth:900,searchText:r=>[r.publisher,names.get(r.campaignId),r.articleLabel].join(' '),
        empty:xa?'No article placements recorded.':waiting('Loading placements…'),
        columns:placementColumns({clicks:r=>C.num(r.clicks)===null?M.na('Click storage unavailable.'):M.value(r.clicks),
          relationship:{key:'article',label:'Article',type:'text',html:r=>esc(names.get(r.campaignId)||r.articleLabel||'Unassigned'),sort:r=>names.get(r.campaignId)||''}}),
        expand:r=>U.detailGrid([
          ['Payment status',payStatus(r)],['Agreed cost',money(r.cost)],['Paid date',r.paidAt?when(r.paidAt):U.reasonButton('Not available','No paid date recorded.')],
          ['Published',r.postedAt?when(r.postedAt):U.reasonButton('Not available','No publication date recorded.')],
          ['Engagement',engagement(r)],['X reading',r.xUpdated?when(r.xUpdated):U.reasonButton('Not available',r.metricError||'No reading yet.')],
          ['Tracking link',trackingText(r.trackingUrl)],['Profile',U.extLink(r.profileUrl,'Profile')||U.reasonButton('Not available','No profile link.')],
          ['Article',U.extLink(r.articleUrl,'Article')||U.reasonButton('Not available','No article link recorded.')],
          ['KYC completions',U.value(M.na(C.OUTCOME_REASON))],['Earning creators',U.value(M.na(C.OUTCOME_REASON))],['Source row',esc((r.sourceTab||'')+(r.sourceRow?' · row '+r.sourceRow:''))]
        ])},ts);
    }else{
      const ts=tableState('x-articles','xa-rt');
      table=U.tablePanel({id:'xa-rt',title:'Paid reposts',icon:'refresh',view,views,search:true,filters:placementFilter('x-articles','xa-rt'),filter:applyFilter(ts.filter),
        rows:rt?.rows||[],rowKey:r=>r.id||r.sourceRow,rowLabel:r=>r.publisher,minWidth:900,searchText:r=>r.publisher,
        empty:rt?(rt.unavailable?'Paid repost source unavailable.':'No paid reposts recorded.'):waiting('Loading paid reposts…'),
        notice:rt?.trackingWarning?'<div class="fv-notice" role="note">'+U.icon('alert',15)+'<span>'+esc(rt.trackingWarning)+'</span></div>':'',
        columns:repostColumns(),expand:r=>repostDetail(r)},ts);
    }
    const pending=(xa?.rows||[]).filter(r=>r.paid===true&&r.posted!==true).length,rtPending=(rt?.rows||[]).filter(r=>r.paid===true&&r.posted!==true).length,unl=rt?.articleRtSummary;
    const delivery=[
      pending?U.supportLine(U.status('Pending','warn')+' '+esc(pending+' paid article '+(pending===1?'placement':'placements')+' awaiting publication'),'<a href="#x-articles/original-posts">Review</a>'):'',
      rtPending?U.supportLine(U.status('Pending','warn')+' '+esc(rtPending+' paid reposts not marked published in the sheet'),'<a href="#x-articles/paid-reposts">Review</a>'):'',
      unl?.unlinkedPaidCount?U.supportLine(U.status('Missing link','warn')+' '+esc(unl.unlinkedPaidCount+' paid reposts ('+C.money(unl.unlinkedPaidSpendKnown)+') have no original post link; costs are kept'),'<a href="#x-articles/paid-reposts">Review</a>'):''
    ].join('');
    const support=(delivery?U.supportPanel('Delivery','check',delivery+U.supportLine('','Original-post and paid repost metrics are kept separate')):'')+
      U.supportPanel('Records and editing','edit','<div class="fv-records-links"><a class="fv-control" href="#placements">'+U.icon('doc',15)+'Article tracker</a><a class="fv-control" href="#accounts">'+U.icon('users',15)+'Accounts</a><a class="fv-control" href="#campaigns">'+U.icon('layers',15)+'Campaigns</a></div>');
    return {title:'X Articles',chip:'x-articles',refreshLabel:'Refresh',updated:ov?.checkedAt,stale:!!(D.overviewStatus().error||xa?.sourceStale||xa?.dataWarning),body:overviewNotice()+strip+chart+table+support};
  }
  function articleDetail(r,xa){
    const rows=(xa?.rows||[]).filter(p=>p.campaignId===r.id);
    const list=rows.length?'<div class="fv-detail-list"><h3>Placements</h3><div class="fv-table-wrap"><table data-no-sort><thead><tr><th class="is-left">Account</th><th class="is-left">Publication</th><th class="is-left">Payment</th><th>Paid spend</th><th>Post views</th><th>Tracked clicks</th><th>Live post</th></tr></thead><tbody>'+
      rows.map(p=>'<tr><td class="is-left">'+esc(p.publisher)+'</td><td class="is-left">'+pubStatus(p)+'</td><td class="is-left">'+payStatus(p)+'</td><td>'+U.value(placementSpend(p),'money')+'</td><td>'+U.value(viewsOfRow(p))+'</td><td>'+count(p.clicks)+'</td><td>'+liveLink(p)+'</td></tr>').join('')+'</tbody></table></div></div>':'';
    return U.detailGrid([
      ['Placements',count(r.placements)],['Published posts',count(r.published)],['Unknown costs',count(r.unknownPaidCosts)],['Status',esc(r.status||'Not recorded')],
      ['KYC completions',U.value(M.na(C.OUTCOME_REASON))],['Earning creators',U.value(M.na(C.OUTCOME_REASON))],['Paid reposts','<a href="#x-articles/paid-reposts">See Paid reposts view</a>'],['Records','<a href="#campaigns">Open in Campaigns</a>']
    ])+list;
  }
  function repostColumns(){
    return placementColumns({clicks:()=>M.notTracked('Paid reposts have no tracked link.'),
      relationship:{key:'original',label:'Original post',type:'link',html:r=>C.safeUrl(r.sourcePostUrl||r.postUrl)?U.extLink(r.sourcePostUrl||r.postUrl,'Original'):U.status('Link missing','warn')}})
      .map(c=>c.key==='views'?{...c,get:()=>M.notTracked('Paid repost impressions are not measured. The original post’s views are in the details.')}:
        c.key==='live'?{...c,html:()=>U.reasonButton('Not tracked','No repost URL is recorded; the original post link is not evidence of a repost.')}:c);
  }
  function repostDetail(r){
    return U.detailGrid([
      ['Payment status',payStatus(r)],['Agreed cost',money(r.cost)],['Sheet status',r.posted?esc('Marked published'):esc('Not marked published')],
      ['Original-post views',C.num(r.sourceOriginalViews)!==null?esc(C.full(r.sourceOriginalViews))+' '+U.reasonButton('Original post','Views of the original post being reposted, including organic views. Not repost impressions.','fv-chip'):U.reasonButton('Not available',C.postId(r.sourcePostUrl||r.postUrl)?'No verified reading for the original post.':'Original post link missing.')],
      ['Original reading',r.metricAt?when(r.metricAt):U.reasonButton('Not available','No reading time.')],
      ['Profile',U.extLink(r.profileUrl,'Profile')||U.reasonButton('Not available','No profile link.')],
      ['Source row',esc((r.sourceTab||'')+(r.sourceRow?' · row '+r.sourceRow:''))],['Creator signups',U.value(M.na(C.OUTCOME_REASON))]
    ]);
  }

  function gtaPage(st){
    ensure('overview');ensure('gta');
    const ov=D.overview(),gr=D.gta().report,s=ov?C.campaignSummary(ov,'gta-vi',{gtaReport:gr}):null,qr=D.campaign('gta-qrts'),og=D.campaign('gta-originals');
    const clicksChip=s?.clicks&&C.hasValue(s.clicks)&&s.clicks.state!=='stale'&&s.clicks.allTime!==undefined?U.reasonButton(C.full(s.clicks.allTime)+' all-time',s.clicks.reason,'fv-chip'):undefined;
    const strip=!s?loadingStrip([['Paid spend','wallet'],['Post views','eye'],['Tracked clicks','cursor'],['Creator signups','user'],['Approved budget','wallet'],['Remaining budget','wallet']]):U.strip([
      metric('Paid spend','wallet',s.spend,'moneyShort'),metric('Post views','eye',s.views,'compact'),
      {...metric('Tracked clicks','cursor',s.clicks),chip:clicksChip!==undefined?clicksChip:undefined},
      metric('Creator signups','user',s.signups),
      metric('Approved budget','wallet',M.na('No approved programme budget is recorded in a connected source.'),'money0','Programme lifetime'),
      metric('Remaining budget','wallet',M.na('Needs an approved budget and reconciled payments and commitments; not published until reconciled.'),'money0','Programme lifetime')
    ]);
    const IG='Not connected: the GTA report reads the X tabs only. Instagram (IG Accounts 3) needs a separate approved adapter.';
    const fmt=[{label:'X original posts',c:og},{label:'X quote posts',c:qr}];
    const spendCats=s?[...fmt.map(f=>{const m=C.spendOf(f.c);return {label:f.label,value:C.hasValue(m)?m.value:null,reason:m.reason};}),{label:'Instagram',value:null,state:'Not connected',reason:IG}]:[];
    const viewCats=s?[...fmt.map(f=>{const m=C.viewsOf([f.c]);return {label:f.label,value:C.hasValue(m)?m.value:null,reason:m.reason};}),{label:'Instagram',value:null,state:'Not connected',reason:IG}]:[];
    const weekly=gr?C.snapshotSeries([...(gr.history||[]),...(gr.originals?.history||[])]).map(p=>({...p,extra:p.count+' posts with a reading'})):[];
    const ms=[
      spendCats.length?{key:'spend-format',label:'Paid spend by format',title:'Paid spend by format',categories:spendCats,format:'moneyShort',tipFormat:'money',unit:'Paid spend'}:null,
      viewCats.length?{key:'views-format',label:'Post views by format',title:'Post views by format',categories:viewCats,format:'compact',tipFormat:'count',unit:'Post views'}:null,
      weekly.length>=2?{key:'views-week',label:'Post views by week',title:'Post views by week',series:weekly,format:'compact',tipFormat:'count',unit:'Cumulative views at week end',note:'X readings are retained for the last six days, so earlier weeks are not shown.'}:null
    ].filter(Boolean);
    if(weekly.length>=3)ms.unshift(ms.pop());
    const chart=U.chartPanel({id:'gta-chart',measures:ms,empty:{title:'Paid spend by format',reason:waiting('Loading GTA VI results…')}},pageState('gta-vi').chart);
    const view=['x-original-posts','x-quote-posts','instagram'].includes(st.view)?st.view:'all-formats';
    const views=[{key:'all-formats',label:'All formats'},{key:'x-original-posts',label:'X original posts'},{key:'x-quote-posts',label:'X quote posts'},{key:'instagram',label:'Instagram'}];
    let table;
    if(view==='all-formats'){
      const rows=s?[{key:'x-original-posts',name:'X original posts',c:og},{key:'x-quote-posts',name:'X quote posts',c:qr},{key:'instagram',name:'Instagram',c:null}]:[];
      table=U.tablePanel({id:'gta-table',title:'Promotion results',icon:'layers',view,views,rows,rowKey:r=>r.key,rowLabel:r=>r.name,widths:ALIGNED,empty:waiting('Loading promotion results…'),
        columns:[
          {key:'name',label:'Promotion type',type:'name',html:r=>'<a class="fv-name" href="#gta-vi/'+esc(r.key)+'">'+U.marker('gamepad','',{plain:true})+'<span>'+esc(r.name)+'</span></a>',sort:r=>r.name},
          {key:'spend',label:'Paid spend',format:'money',get:r=>r.c?C.spendOf(r.c):M.na(IG)},
          {key:'views',label:'Post views',get:r=>r.c?C.viewsOf([r.c]):M.na(IG)},
          {key:'clicks',label:'Tracked clicks',get:r=>{if(!r.c)return M.na(IG);const v=C.num(r.c.postPublicationClicks);return v===null?M.na(C.num(r.c.allTimeHumanClicks)===null?'No Short.io tracking links on these posts.':'No post-publication reading yet.'):M.value(v);}},
          {key:'signups',label:'Creator signups',get:()=>M.na(C.OUTCOME_REASON)},
          {key:'published',label:'Published posts',get:r=>r.c&&!r.c.unavailable?M.value(r.c.published):M.na(r.c?'Source unavailable.':IG)},
          {key:'paid',label:'Paid placements',get:r=>r.c&&!r.c.unavailable?M.value(r.c.paidCount):M.na(r.c?'Source unavailable.':IG)}
        ],expand:r=>gtaFormatDetail(r,gr)},tableState('gta-vi','gta-table'));
    }else if(view==='instagram'){
      table=U.tablePanel({id:'gta-ig',title:'Instagram',icon:'image',view,views,rows:[],rowKey:r=>r,empty:esc(IG),columns:[]},tableState('gta-vi','gta-ig'));
    }else{
      const c=view==='x-quote-posts'?qr:og,id='gta-'+view,ts=tableState('gta-vi',id);
      table=U.tablePanel({id,title:view==='x-quote-posts'?'X quote posts':'X original posts',icon:'gamepad',view,views,search:true,filters:placementFilter('gta-vi',id),filter:applyFilter(ts.filter),
        rows:c?.rows||[],rowKey:r=>r.code||r.sourceRow,rowLabel:r=>r.publisher,minWidth:860,searchText:r=>r.publisher,
        empty:c?(c.unavailable?'GTA VI source unavailable.':'No records.'):waiting('Loading records…'),
        columns:placementColumns({clicks:r=>{const v=C.num(r.clicks);if(v!==null)return M.value(v);return M.na(r.clickError||(r.trackingUrl?(r.posted?'No post-publication reading yet.':'Not published yet.'):'No tracking link in the source sheet.'));}}),
        expand:r=>U.detailGrid([
          ['Payment status',payStatus(r)],['Agreed cost',money(r.cost)],['All-time human clicks',count(r.allTimeClicks)+(r.clickStale?' '+U.status('Stale','warn'):'')],
          ['Clicks verified',r.postPublicationVerifiedAt||r.clickAt?when(r.postPublicationVerifiedAt||r.clickAt):U.reasonButton('Not available','No Short.io reading.')],
          ['Engagement',engagement(r)],['X reading',r.metricAt?when(r.metricAt):U.reasonButton('Not available',r.metricError||'No reading yet.')],
          ['Tracking link',trackingText(r.trackingUrl)],['Profile',U.extLink(r.profileUrl,'Profile')||U.reasonButton('Not available','No profile link.')],
          ['KYC completions',U.value(M.na(C.OUTCOME_REASON))],['Earning creators',U.value(M.na(C.OUTCOME_REASON))],['Source row',esc((r.sourceTab||'')+(r.sourceRow?' · row '+r.sourceRow:''))]
        ])},ts);
    }
    const pend=[qr,og].reduce((n,c)=>n+(c?.rows||[]).filter(r=>r.paid===true&&r.posted!==true).length,0);
    const budget=s?U.supportPanel('Budget and delivery','wallet',U.inlineMetrics([
      ['Approved budget',U.reasonButton('Not available','No approved programme budget is recorded in a connected source.')],
      ['Paid spend',U.value(s.spend,'money')],
      ['Unpaid commitments',U.reasonButton('Not available','Not reconciled: the source records payment per row, not committed amounts.')],
      ['Remaining budget',U.reasonButton('Not available','Needs an approved budget and reconciled commitments.')]
    ])+(pend?U.supportLine(U.status('Pending','warn')+' '+esc(pend+' paid '+(pend===1?'placement':'placements')+' awaiting publication'),'Programme lifetime · review before further allocation'):U.supportLine('','Programme lifetime'))):'';
    return {title:'GTA VI',chip:'gta-vi',refreshLabel:'Refresh',updated:ov?.checkedAt,stale:!!(D.overviewStatus().error||qr?.sourceStale||og?.sourceStale),body:overviewNotice()+strip+chart+table+budget};
  }
  function gtaFormatDetail(r,gr){
    if(!r.c)return '<p class="fv-detail-note">Not connected: the GTA report reads the X tabs only. Instagram records need a separate approved adapter; no Instagram clicks or views are shown.</p>';
    const c=r.c,isQ=r.key==='x-quote-posts',io=isQ?gr?.shortIo:gr?.originals?.shortIo,q=isQ?c.quotedOriginals:null;
    const grid=U.detailGrid([
      ['Records in source',count(c.placements)],['Paid placements',count(c.paidCount)],['Published posts',count(c.published)],
      ['Views coverage',esc(C.full(c.coverage?.withXMetrics)+' of '+C.full(c.coverage?.withPostUrl)+' published posts measured')],
      ['Clicks since publication',count(c.postPublicationClicks)],['All-time human clicks',count(c.allTimeHumanClicks)],
      ['Short.io status',io?(io.stale?U.status('Stale','warn'):U.status('Current','good'))+(io.lastSuccessfulAt?' '+esc(C.stamp(io.lastSuccessfulAt)):''):U.reasonButton('Not available','GTA report not loaded yet.')],
      ['Sheet verified',c.sourceVerifiedAt?when(c.sourceVerifiedAt):U.reasonButton('Not available','')],
      ['KYC completions',U.value(M.na(C.OUTCOME_REASON))],['Earning creators',U.value(M.na(C.OUTCOME_REASON))]
    ]);
    const quoted=q?.rows?.length?'<div class="fv-detail-list"><h3>Quoted original posts ('+esc(C.full(q.rows.length))+') · original and quote-post views are separate</h3><div class="fv-table-wrap"><table data-no-sort><thead><tr><th class="is-left">Original post</th><th>Original views</th><th>Quote posts</th><th>Quote-post views</th><th>Link</th></tr></thead><tbody>'+
      q.rows.slice(0,25).map(o=>'<tr><td class="is-left">'+esc(o.handle?'@'+o.handle:'Original post')+'</td><td>'+count(o.views)+'</td><td>'+count(o.qrtCount)+'</td><td>'+count(o.qrtViews)+'</td><td>'+(U.extLink(o.originalUrl,'Original',{iconOnly:true})||'')+'</td></tr>').join('')+'</tbody></table></div></div>':'';
    return grid+quoted;
  }

  function ofPage(st){
    ensure('overview');ensure('of');
    const ov=D.overview(),s=ov?C.campaignSummary(ov,'of-terms'):null,c=D.campaign('of-terms'),rep=D.of().report;
    const strip=!s?loadingStrip([['Paid spend','wallet'],['Post views','eye'],['Tracked clicks','cursor'],['Creator signups','user'],['KYC completions','shield'],['Earning creators','check']]):U.strip([
      metric('Paid spend','wallet',s.spend,'moneyShort'),metric('Post views','eye',s.views,'compact'),metric('Tracked clicks','cursor',s.clicks,'count','OF link events'),...outcomeItems(s)]);
    const codes=new Set((c?.rows||[]).map(r=>String(r.code)));
    const series=rep?.ready&&Array.isArray(rep.activity)?C.eventSeries(rep.activity,{include:r=>codes.has(String(r.code))}):[];
    const chart=U.chartPanel({id:'of-chart',measures:series.length?[{key:'clicks',label:'Tracked clicks',title:'Tracked clicks by week',series,unit:'OF link events',note:'OF link events by week from the OF report'+(rep?.checkedAt?' checked '+esc(C.stamp(rep.checkedAt)):'')+'. Not comparable with Short.io clicks.'}]:[],
      empty:{title:'Tracked clicks by week',reason:rep?'No dated OF click events are recorded yet.':waiting('Loading OF click history…')}},pageState('of-terms').chart);
    const ts=tableState('of-terms','of-table');
    const table=U.tablePanel({id:'of-table',title:'Publisher results',icon:'users',search:true,filters:placementFilter('of-terms','of-table'),filter:applyFilter(ts.filter),
      rows:c?.rows||[],rowKey:r=>r.code,rowLabel:r=>r.publisher,minWidth:820,searchText:r=>r.publisher,
      empty:c?(c.unavailable?'OF Terms source unavailable.':'No publishers recorded.'):waiting('Loading publisher results…'),
      columns:placementColumns({clicks:r=>C.num(r.clicks)===null?M.na('No OF click events recorded.'):M.value(r.clicks)}),
      expand:r=>{const cost=r.paid?C.num(r.cost):null,cl=C.num(r.clicks),v=C.num(r.views??r.xViews);
        return U.detailGrid([
          ['Payment status',payStatus(r)],['Agreed cost',money(r.cost)],
          ['Cost per tracked click',cost!==null&&cl>0?esc(C.money(cost/cl)):U.reasonButton('Not available','Needs a paid cost and at least one OF link event.')],
          ['Cost per 1,000 views',cost!==null&&v>0?esc(C.money(cost/v*1000)):U.reasonButton('Not available','Needs a paid cost and a view reading.')],
          ['Cost per signup',U.reasonButton('Not available','Needs connected creator signups.')],
          ['Engagement',engagement(r)],['X reading',r.xUpdated||r.metricLastVerifiedAt?when(r.xUpdated||r.metricLastVerifiedAt):U.reasonButton('Not available',r.metricError||'No reading yet.')],
          ['Last OF click',r.lastClick?when(r.lastClick):U.reasonButton('Not available','No click recorded.')],
          ['Tracking link',trackingText(r.trackingUrl)],['Profile',U.extLink(r.profileUrl,'Profile')||U.reasonButton('Not available','No profile link.')],
          ['KYC completions',U.value(M.na(C.OUTCOME_REASON))],['Earning creators',U.value(M.na(C.OUTCOME_REASON))]
        ]);}},ts);
    return {title:'OF Terms',chip:'of-terms',refreshLabel:'Refresh',updated:ov?.checkedAt,stale:!!(D.overviewStatus().error||c?.sourceStale),body:overviewNotice()+strip+chart+table};
  }

  function cisPage(st){
    ensure('overview');
    const reason='Not connected: no dedicated CIS spend or placement source is linked yet.';
    const strip=U.strip([
      metric('Paid spend','wallet',M.na(reason),'money0','Dedicated CIS'),metric('Post views','eye',M.na(reason)),
      metric('Tracked clicks','cursor',M.na('Not connected: no CIS click definition is connected. Amplitude sessions would be labelled separately.')),
      metric('Creator signups','user',M.na(C.OUTCOME_REASON)),metric('CIS registrations','doc',M.na('Not connected: the Amplitude CIS project is not connected yet.')),
      metric('Earning creators','check',M.na(C.OUTCOME_REASON))]);
    const chart=U.chartPanel({id:'cis-chart',empty:{title:'Tracked clicks by week',reason:'No CIS source is connected yet, so there is no measured history. Planned tests are not shown as activity.'}},{});
    const view=st.view==='publishers'?'publishers':'angles';
    const table=U.tablePanel({id:'cis-table',title:view==='angles'?'Promotional angle results':'Publisher results',icon:'target',view,views:[{key:'angles',label:'Angles'},{key:'publishers',label:'Publishers'}],rows:[],rowKey:r=>r,
      empty:'No connected source yet. Promotional angles and publisher placements appear here once a dedicated CIS placement register is connected; no sample angles or amounts are shown.',columns:[]},tableState('cis','cis-table'));
    return {title:'CIS',chip:'cis',refreshLabel:'Refresh',updated:D.overview()?.checkedAt,body:strip+chart+table};
  }

  function guruPage(st){
    ensure('overview');
    const ov=D.overview(),s=ov?C.campaignSummary(ov,'guru-promotion'):null,g=D.campaign('guru-rts'),rt=D.campaign('article-rts');
    const strip=!s?loadingStrip([['Paid spend','wallet'],['Original-post views','eye'],['Tracked clicks','cursor'],['Creator signups','user'],['KYC completions','shield'],['Earning creators','check']]):U.strip([
      metric('Paid spend','wallet',s.spend,'moneyShort'),metric('Original-post views','eye',s.views,'compact'),metric('Tracked clicks','cursor',s.clicks),...outcomeItems(s)]);
    const series=g?C.snapshotSeries((g.rows||[]).flatMap(r=>(r.history||[]).map(h=>({...h,id:r.id})))).map(p=>({...p,extra:p.count+' original posts with a reading'})):[];
    const chart=U.chartPanel({id:'guru-chart',measures:series.length?[{key:'views',label:'Original-post views (cumulative)',title:'Original-post views by week',series,format:'compact',tipFormat:'count',unit:'Cumulative original-post views at week end',
      note:'Observed views of the original posts, including organic views. Not attributed paid lift.'}]:[],
      empty:{title:'Original-post views by week',reason:g?'No dated readings yet.':waiting('Loading original-post history…')}},pageState('guru-promotion').chart);
    const ids=new Set((g?.rows||[]).map(r=>String(r.id)));
    const groups=new Map((rt?.articleRtGroups||g?.articleRtGroups||[]).map(x=>[String(x.postId),x]));
    const view=st.view==='paid-reposts'?'paid-reposts':'promoted-posts';
    const views=[{key:'promoted-posts',label:'Promoted posts'},{key:'paid-reposts',label:'Paid reposts'}];
    let table;
    if(view==='promoted-posts'){
      table=U.tablePanel({id:'guru-table',title:'Promoted posts',icon:'megaphone',view,views,search:true,rows:g?.rows||[],rowKey:r=>r.id,rowLabel:r=>r.publisher,widths:ALIGNED,searchText:r=>[r.publisher,r.handle].join(' '),
        empty:g?(g.unavailable?'Promoted posts feed unavailable.':'No promoted posts.'):waiting('Loading promoted posts…'),
        columns:[
          {key:'name',label:'Original post',type:'name',html:r=>'<span class="fv-name">'+U.marker('megaphone','',{plain:true})+'<span>'+esc(r.publisher||r.handle)+'</span></span>',sort:r=>String(r.publisher||'')},
          {key:'spend',label:'Paid spend',format:'money',get:r=>C.num(r.cost)===null?M.na('Platform boost spend is not recorded for this post.'):M.value(r.cost)},
          {key:'views',label:'Original-post views',get:r=>C.num(r.views)===null?M.na('No verified reading yet.'):M.value(r.views)},
          {key:'clicks',label:'Tracked clicks',get:()=>M.notTracked('Promoted original posts have no tracked link.')},
          {key:'signups',label:'Creator signups',get:()=>M.na(C.OUTCOME_REASON)},
          {key:'paid',label:'Paid placements',get:r=>M.value(r.linkedRtPaidCount||0,{reason:'Paid reposts linked to this original post by post ID.'})},
          {key:'live',label:'Live post',type:'link',html:r=>U.extLink(r.postUrl,'Open original post by '+(r.publisher||r.handle),{iconOnly:true})||U.reasonButton('Not available','No post link.')}
        ],expand:r=>guruDetail(r,groups.get(String(r.id)))},tableState('guru-promotion','guru-table'));
    }else{
      const rows=(rt?.rows||[]).filter(r=>ids.has(String(C.postId(r.sourcePostUrl||r.postUrl))));
      const ts=tableState('guru-promotion','guru-rt');
      const byId=new Map((g?.rows||[]).map(r=>[String(r.id),r]));
      table=U.tablePanel({id:'guru-rt',title:'Paid reposts',icon:'refresh',view,views,search:true,filters:placementFilter('guru-promotion','guru-rt'),filter:applyFilter(ts.filter),
        rows,rowKey:r=>r.id||r.sourceRow,rowLabel:r=>r.publisher,minWidth:900,searchText:r=>r.publisher,
        empty:rt?'No paid reposts are linked to these original posts.':waiting('Loading paid reposts…'),
        notice:'<p class="fv-chart-note">Paid repost costs are counted once, under X Articles. Listed here for their original-post relationship.</p>',
        columns:repostColumns().map(c=>c.key==='original'?{...c,html:r=>{const o=byId.get(String(C.postId(r.sourcePostUrl||r.postUrl)));return U.extLink(r.sourcePostUrl||r.postUrl,o?.publisher||'Original');}}:c),
        expand:r=>repostDetail(r)},ts);
    }
    const missing=(g?.rows||[]).filter(r=>C.num(r.cost)===null).length;
    const support=U.supportPanel('Records and editing','edit',(missing?U.supportLine(U.status('Missing cost','warn')+' '+esc('Platform boost spend is not recorded for '+missing+' of '+(g?.rows||[]).length+' promoted posts'),''):'')+
      '<div class="fv-records-links"><a class="fv-control" href="#x-rts">'+U.icon('megaphone',15)+'Manage promoted posts</a></div>');
    return {title:'Guru Promotion',chip:'guru-promotion',refreshLabel:'Refresh',updated:ov?.checkedAt,stale:!!(D.overviewStatus().error||g?.sourceStale),body:overviewNotice()+strip+chart+table+support};
  }
  function guruDetail(r,group){
    const list=group?.placements?.length?'<div class="fv-detail-list"><h3>Linked paid reposts · counted under X Articles</h3><div class="fv-table-wrap"><table data-no-sort><thead><tr><th class="is-left">Account</th><th class="is-left">Payment</th><th class="is-left">Sheet status</th><th>Cost</th></tr></thead><tbody>'+
      group.placements.map(p=>'<tr><td class="is-left">'+esc(p.publisher)+'</td><td class="is-left">'+payStatus(p)+'</td><td class="is-left">'+(p.posted?U.status('Marked published','good'):U.status('Not marked published'))+'</td><td>'+money(p.cost)+'</td></tr>').join('')+'</tbody></table></div></div>':'';
    return U.detailGrid([
      ['Account','@'+esc(r.handle||'')],['Added',r.added_at?when(r.added_at):U.reasonButton('Not available','')],
      ['Engagement',engagement(r)],['Last reading',r.metricAt||r.at?when(r.metricAt||r.at):U.reasonButton('Not available',r.error||'No reading yet.')],
      ['Views gained · 24h',C.num(r.growth24)===null?U.reasonButton('Not available','Needs readings 24 hours apart.'):esc(C.signed(r.growth24))],
      ['Views gained · 7 days',C.num(r.growth7)===null?U.reasonButton('Not available','Needs readings 7 days apart.'):esc(C.signed(r.growth7))],
      ['Platform boost spend',C.num(r.cost)===null?U.reasonButton('Not available','Not recorded in the boosts feed.'):money(r.cost)],
      ['Linked paid reposts',group?esc(C.full(group.paidCount)+' · '+C.money(group.paidSpendKnown))+(group.unknownPaidCosts?' · '+esc(group.unknownPaidCosts+' without cost'):''):esc('None linked')],
      ['KYC completions',U.value(M.na(C.OUTCOME_REASON))],['Earning creators',U.value(M.na(C.OUTCOME_REASON))]
    ])+list;
  }

  const RENDER={home:homePage,discord:discordPage,'x-articles':xArticlesPage,'gta-vi':gtaPage,'of-terms':ofPage,cis:cisPage,'guru-promotion':guruPage};

  /* ---------- shell rendering ---------- */
  let current=parseHash(),recordsShown=false;
  const hooks={addedRoute:null,navExtra:null,headerExtra:null};  // extension points (campaign manager)
  function navHtml(active){
    const item=p=>{
      const color=p.color?C.PALETTE[p.color]?.icon:p.key==='discord'?'var(--fv-discord)':'#FFFFFF';
      return '<a class="fv-nav-item" href="#'+esc(p.key)+'" style="--fv-icon:'+esc(color)+'"'+(p.key===active?' aria-current="page"':'')+'>'+U.icon(p.icon==='x'?'xmark':p.icon,17)+'<span>'+esc(p.title)+'</span></a>';
    };
    return '<div class="fv-nav" role="group" aria-label="General">'+PAGES.filter(p=>p.group==='general').map(item).join('')+'</div>'+
      '<div class="fv-nav-group"><span class="fv-nav-group-label" id="fvPaidLabel">Paid campaigns</span>'+(hooks.navAddButton?hooks.navAddButton():'')+'</div>'+
      '<div class="fv-nav" role="group" aria-labelledby="fvPaidLabel">'+PAGES.filter(p=>p.group==='paid').map(item).join('')+(hooks.navExtra?hooks.navExtra(active):'')+'</div>';
  }
  function setNav(active){$('fvNav').innerHTML=navHtml(active);}
  function setTitle(text){document.title=text+' · '+APP_NAME;}

  function captureFocus(){
    const a=document.activeElement;if(!a||!$('fvPage').contains(a))return null;
    const attrs=['data-search','data-sort','data-expand','data-view','data-chart-type','data-chart-measure','data-filter','data-reset'];
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
      if(!page)page={title:'Campaign not found',refreshLabel:'',body:'<section class="fv-panel fv-notfound"><h2>Campaign not found</h2><p>This campaign does not exist or has been archived.</p><a class="fv-control" href="#home">'+U.icon('home',15)+'Go to Home</a></section>'};
      setNav(page.navKey||'');
    }else{
      page=RENDER[r.key]({view:r.view});
      setNav(r.key);
    }
    setTitle(page.title);
    const chipDef=C.CAMPAIGNS.find(c=>c.key===page.chip);
    $('fvTitleChip').innerHTML=page.chipHtml||(chipDef?'<span class="fv-campaign-chip" style="background:'+C.PALETTE[chipDef.color].fill+'" aria-hidden="true">'+U.icon(chipDef.icon==='x'?'xmark':chipDef.icon,15)+'</span>':'');
    $('fvTitle').textContent=page.title;
    const upd=$('fvUpdated');
    upd.textContent=page.updated?(page.stale?'Last verified ':'Updated ')+C.stamp(page.updated):'';
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
  function drawCharts(){
    for(const host of $('fvPage').querySelectorAll('.fv-chart')){
      if(host.dataset.type==='table')continue;
      const m=U.getMeasure(host.id,host.dataset.measure);if(m)U.drawChart(host,m,host.dataset.type);
    }
  }
  function rerender(){if(current.kind==='records')return;render();}

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
    let message='',error=false;
    try{
      const k=current.kind==='page'?current.key:'';
      if(k==='home'){await app?.refresh?.all?.();const s=app?.status?.('reloadAllStatus');message=s?.text||'Refreshed';error=!!s?.error;}
      else if(k==='discord'){const ok=await rep?.refreshDiscord?.(true);message=ok?'Discord sources checked':'Discord sources unavailable; last verified figures kept';error=!ok;}
      else{
        const fn={'x-articles':'x','gta-vi':'gta','of-terms':'of','guru-promotion':'boosts'}[k];
        const ids={'x-articles':'xRefreshStatus','gta-vi':'gtaRefreshStatus','of-terms':'ofRefreshStatus','guru-promotion':'boostRefreshStatus'};
        if(fn){await app?.refresh?.[fn]?.();const s=app?.status?.(ids[k]);message=s?.text||'';error=!!s?.error;}
        const ok=await rep?.reload?.();
        if(!message)message=ok?'Refreshed':'Some sources could not refresh; last verified figures kept';
        if(ok===false&&!error){error=true;message+=' · campaign summary kept from last verified data';}
      }
    }catch(e){error=true;message='Refresh failed; last verified figures kept.';}
    finally{btn.disabled=false;btn.classList.remove('is-busy');btn.removeAttribute('aria-busy');}
    status.className='fv-refresh-status '+(error?'is-error':'is-ok');status.textContent=message;
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
    if(ct){const st=pageState(pageKey()).chart;st.type=ct.dataset.chartType;rerender();return;}
    const reset=t.closest('[data-reset]');
    if(reset){const st=tableState(pageKey(),reset.dataset.reset);st.q='';st.filter='';rerender();return;}
    if(t.closest('[data-retry]')){void D.rep()?.reload?.();return;}
  }
  const pageKey=()=>current.kind==='page'?current.key:'added:'+current.key;
  const defaultView=k=>({'x-articles':'articles','gta-vi':'all-formats',discord:'weekly-history',cis:'angles','guru-promotion':'promoted-posts'}[k]||'');
  function onInput(e){
    const s=e.target.closest('[data-search]');
    if(s){tableState(pageKey(),s.dataset.search).q=s.value;rerender();}
  }
  function onChange(e){
    const m=e.target.closest('[data-chart-measure]');
    if(m){const st=pageState(pageKey()).chart;st.measure=m.value;st.type='';rerender();return;}
    const f=e.target.closest('[data-filter]');
    if(f){tableState(pageKey(),f.dataset.filter).filter=f.value;rerender();}
  }

  /* Range selector: Lifetime is the only truthful option for these totals. */
  function toggleRange(open){
    const b=$('fvRange'),p=$('fvRangePop');const next=open??p.hidden;
    p.hidden=!next;b.setAttribute('aria-expanded',String(next));
  }

  let rerenderQueued=false;
  function queueRerender(){if(rerenderQueued)return;rerenderQueued=true;requestAnimationFrame(()=>{rerenderQueued=false;rerender();});}

  function init(){
    // Header icons are injected so static HTML stays text-only.
    $('fvRange').insertAdjacentHTML('afterbegin',U.icon('calendar',15));$('fvRange').insertAdjacentHTML('beforeend',U.icon('down',14));
    $('fvRefresh').insertAdjacentHTML('afterbegin',U.icon('refresh',15));
    $('fvMenu').innerHTML=U.icon('menu',22);$('fvDrawerClose').innerHTML=U.icon('close',20);
    U.bindTips(document.body);
    const page=$('fvPage');
    page.addEventListener('click',onClick);page.addEventListener('input',onInput);page.addEventListener('change',onChange);
    $('fvRefresh').addEventListener('click',onRefresh);
    $('fvRange').addEventListener('click',()=>toggleRange());
    document.addEventListener('click',e=>{if(!e.target.closest('.fv-range'))toggleRange(false);});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){toggleRange(false);if($('fvShell').classList.contains('is-nav-open')){$('fvShell').classList.remove('is-nav-open');$('fvMenu').focus();}}});
    $('fvMenu').addEventListener('click',()=>{$('fvShell').classList.add('is-nav-open');$('fvMenu').setAttribute('aria-expanded','true');setTimeout(()=>$('fvNav').querySelector('a')?.focus(),50);});
    const close=()=>{$('fvShell').classList.remove('is-nav-open');$('fvMenu').setAttribute('aria-expanded','false');};
    $('fvDrawerClose').addEventListener('click',close);$('fvScrim').addEventListener('click',close);
    $('fvNav').addEventListener('click',e=>{if(e.target.closest('a'))close();});
    window.addEventListener('hashchange',onHash);
    window.addEventListener('xtracker:campaign-overview',queueRerender);
    window.addEventListener('xtracker:data',queueRerender);
    window.addEventListener('xtracker:discord',queueRerender);
    let w=window.innerWidth;
    window.addEventListener('resize',()=>{if(Math.abs(window.innerWidth-w)<2)return;w=window.innerWidth;U.hideTip();if(current.kind!=='records')drawCharts();},{passive:true});
    // Reload-all reports Discord status through these hooks; they reuse the
    // validated Discord adapter instead of the superseded standalone scripts.
    window.XTrackerDiscordMembers={refresh:()=>D.rep()?.refreshDiscord?.(true)};
    window.XTrackerDiscordCourse={refresh:()=>D.rep()?.refreshDiscord?.(true)};
    onHash();
  }
  window.FanvueApp=Object.freeze({hooks,rerender,go,parseHash,RECORDS,LEGACY,PAGES,data:D,state:pageState,tableState,
    placementColumns,metric,outcomeItems});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
