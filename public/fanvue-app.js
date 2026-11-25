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
    {key:'all-accounts',title:'Accounts',icon:'users',group:'general'},
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
  const pageState=key=>ui[key]||(ui[key]={chart:{},tables:{},view:''});
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
  const viewsOfRow=r=>{const v=C.num(r.views??r.xViews);if(v!==null)return M.value(v);
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
    const link=ownLink&&r.posted===true&&C.safeUrl(r.postUrl)&&C.postId(r.postUrl)?r.postUrl:'';
    return {raw:r,campaign,parent:parent||campaign,platform,type:typeName(type),account:r.publisher||r.handle||'',price:C.num(r.cost),
      live:r.posted===true?true:r.posted===false?false:null,link,paid:r.paid===true,planned:r.planned===true,
      views:views?views(r):viewsOfRow(r),clicks:clicks?clicks(r):M.na('No tracked link for this placement.')};
  }
  const xState=(page,id)=>{const st=tableState(page,id);return st.xf||(st.xf={group:'',type:'',live:'',pay:''});};
  const xActive=f=>!!(f.group||f.type||f.live||f.pay);
  const xMatch=f=>x=>(!f.group||x.campaign===f.group)&&(!f.type||x.type===f.type)&&(!f.live||(f.live==='Yes'?x.live===true:x.live!==true))&&
    (!f.pay||(f.pay==='Planned'?x.planned:f.pay==='Paid'?x.paid&&!x.planned:!x.paid));
  function xFilters(id,records,f,{groups=true}={}){
    const present=(key,order)=>order.filter(v=>records.some(x=>key(x)===v));
    const sel=(key,label,opts,min=2)=>opts.length<min&&!f[key]?'':'<label class="fv-select fv-filter"><span class="fv-sr">'+esc(label)+'</span><select data-xfilter="'+key+'" data-table="'+esc(id)+'">'+
      [['',label+': All'],...opts.map(o=>[o,label+': '+o])].map(([v,l])=>'<option value="'+esc(v)+'"'+(f[key]===v?' selected':'')+'>'+esc(l)+'</option>').join('')+'</select>'+U.icon('down',14)+'</label>';
    const groupOpts=groups?[...new Set(records.map(x=>x.campaign))].filter(g=>GROUPS_VERIFIED.has(g)):[];
    return (groupOpts.length>=1&&new Set(records.map(x=>x.campaign)).size>1?sel('group','Group',groupOpts,1):'')+
      sel('type','Type',present(x=>x.type,['Post','Article','RT','QRT']))+
      sel('live','Live?',present(x=>x.live===true?'Yes':'No',['Yes','No']))+
      sel('pay','Payment',present(x=>x.planned?'Planned':x.paid?'Paid':'Unpaid',['Paid','Unpaid','Planned']));
  }
  // Verified content groups only; unverified records stay under their parent campaign.
  const GROUPS_VERIFIED=new Set(['Mandy','Lucia','Partner Articles','Classic Articles']);
  const X_COLUMNS=[
    {key:'campaign',label:'Campaign',type:'text',keep:true,html:x=>esc(x.campaign),sort:x=>x.campaign},
    {key:'platform',label:'Platform',type:'text',keep:true,nosort:true,html:x=>esc(x.platform||'X')},
    {key:'type',label:'Type',type:'text',keep:true,html:x=>esc(x.type),sort:x=>x.type},
    {key:'account',label:'Account',type:'name',keep:true,html:x=>accountName(x.raw),sort:x=>x.account.toLowerCase()},
    {key:'price',label:'Price',format:'money',keep:true,get:x=>x.price===null?M.na('No price recorded.'):M.value(x.price)},
    {key:'live',label:'Live?',type:'status',keep:true,html:x=>x.live===true?U.status('Yes','good'):x.live===false?U.status('No'):dash('Publication not recorded.'),sort:x=>x.live===true?1:0},
    {key:'link',label:'Link',type:'link',keep:true,nosort:true,html:x=>x.link?U.extLink(x.link,'Open post by '+x.account,{iconOnly:true}):dash(x.type==='RT'?'No repost link is recorded.':x.live?'No post link recorded.':'Not live yet.')},
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
  function xTable(page,id,{title,icon='layers',records,f,expand,empty,groups=true}){
    const ts=tableState(page,id);
    return U.tablePanel({id,title,icon,search:true,filters:xFilters(id,records,f,{groups}),filter:xMatch(f),rows:records,rowKey:x=>rowKeyOf(x.raw),rowLabel:x=>x.account,
      minWidth:900,searchText:x=>[x.account,x.campaign,x.raw.articleLabel||''].join(' '),empty,columns:X_COLUMNS,expand},ts);
  }
  // The four core KPIs for a set of records. RT rows never contribute views: their only reading is the original post's.
  function xKpis(records){
    const raws=records.map(x=>x.raw),own=records.filter(x=>x.type!=='RT').map(x=>x.raw);
    const paid=raws.filter(r=>r.paid===true),known=paid.filter(r=>C.num(r.cost)!==null);
    const total=known.reduce((n,r)=>n+C.num(r.cost),0);
    const spend=!paid.length?M.na('No paid placements in this selection.'):known.length<paid.length?M.partial(total,(paid.length-known.length)+' paid placements have no price.'):M.value(total);
    const views=C.viewsOf([{source:'FILTER',rows:own}]);
    const cl=records.map(x=>x.clicks).filter(C.hasValue);
    const clicks=cl.length?M.value(cl.reduce((n,m)=>n+m.value,0),{reason:'Clicks on the links of the selected placements.'}):M.na('No tracked clicks in this selection.');
    return {spend,views,clicks,cpc:C.efficiency([{source:'FILTER',rows:own}]).cpc};
  }
  const kpiStrip=k=>U.strip([metric('Spend','wallet',k.spend,'moneyShort',k.spendNote),metric('Views','eye',k.views,'compact'),
    {...metric('Clicks','cursor',k.clicks),chip:k.clicksChip},metric('CPC','cursor',k.cpc,'money')]);
  const KPI_LOADING=[['Spend','wallet'],['Views','eye'],['Clicks','cursor'],['CPC','cursor']];
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
      if(r.paid!==true||r.posted!==true)continue;
      for(const u of r.postUrls?.length?r.postUrls:[r.postUrl]){const p=C.postId(u);if(p)seen.add(p);}
    }
    return seen.size;
  }

  function homePage(st){
    ensure('overview');ensure('discord');ensure('gta');
    const ov=D.overview(),S=summaries();
    const strip=!S?loadingStrip([['Spend','wallet'],['Views','eye'],['Live Posts','check']]):(()=>{
      const T=C.homeTotals(ov,S),lp=livePosts(ov,Object.values(LIVE_SOURCES).flat());
      if(C.hasValue(T.views)){T.views.chip=undefined;}
      return U.strip([metric('Spend','wallet',T.spend,'moneyShort'),metric('Views','eye',T.views,'compact'),
        metric('Live Posts','check',M.value(lp,{reason:'Distinct paid X posts that are live, across X Articles, GTA VI and OnlyFans Terms.'}))]);
    })();
    const rows=S?S.map(s=>({...s,def:C.CAMPAIGNS.find(c=>c.key===s.key),live:LIVE_SOURCES[s.key]?livePosts(ov,LIVE_SOURCES[s.key]):null})):[];
    const table=U.tablePanel({id:'home-results',title:'Campaign Performance',icon:'layers',rows,dropEmptyRows:true,rowKey:r=>r.key,rowLabel:r=>r.def.name,
      empty:S?'No Results':waiting('Loading…'),countLabel:n=>n===1?'campaign':'campaigns',
      columns:[
        {key:'name',label:'Campaign',type:'name',html:r=>{const l=look(r.key);return '<a class="fv-name" href="#'+esc(r.key)+'">'+U.marker(l.icon,l.color)+'<span>'+esc(r.def.name)+'</span></a>';},sort:r=>r.def.name},
        {key:'spend',label:'Spend',format:'money',get:r=>r.spend},
        {key:'views',label:'Views',get:r=>r.key==='guru-promotion'&&C.hasValue(r.views)?{...r.views,reason:'Original Views: views of the promoted original posts, not of the paid RTs. Not included in the Home Views total.'}:r.views},
        {key:'clicks',label:'Clicks',get:r=>r.clicks},
        {key:'cpc',label:'CPC',format:'money',get:r=>r.cpc},
        {key:'live',label:'Live Posts',get:r=>r.live===null?M.na('No X placements.'):M.value(r.live)},
        {key:'signups',label:'Signups',get:r=>r.signups},
        {key:'cps',label:'CPS',format:'money',get:r=>r.cps}
      ],
      expand:r=>homeDetail(r)},tableState('home','home-results'));
    const dd=D.discord(),members=dd.members,clicks=dd.clicks;
    const net=netGrowth(members);
    const discord=U.supportPanel('Community Performance','discord',U.inlineMetrics([
      ['Members',members?.latest?U.value(M.value(members.latest.memberCount))+(members.source==='DISCORD_INVITE_APPROXIMATE'?' '+U.reasonButton('Approximate','Discord bot unavailable; approximate invite count.','fv-chip is-warn'):''):U.value(dd.error&&!members?M.na('Discord member count is temporarily unavailable.'):M.loading())],
      ['Member Growth',U.value(net,'signed')],
      ['Course Clicks',clicks?U.value(M.value(clicks.total)):U.value(dd.error?M.na('Course click counter is temporarily unavailable.'):M.loading())]
    ]),'<a class="fv-control" href="#discord">View Discord'+U.icon('right',14)+'</a>');
    return {title:'Home',refreshLabel:'Refresh All',updated:ov?.checkedAt,stale:!!(D.overviewStatus().error||ov?.stale),
      body:overviewNotice()+section('Overall Performance')+strip+table+discord};
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
    const h=(members?.history||[]).filter(x=>Number.isSafeInteger(x?.memberCount)).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
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
    const strip=U.strip([metric('Members','users',mm,'count'),metric('Member Growth','trend',net,'signed'),metric('Course Clicks','graduation',cc)]);
    // The last four weeks that have snapshots. Earlier weeks are never back-filled.
    const weeks=C.recentWeeks(members?.history,4);
    const netSeries=weeks.filter(w=>w.value!==null);
    // Daily member growth: change between snapshots on consecutive UK days (last 14 days). Negative days are real.
    const byDay=new Map((members?.history||[]).filter(h=>/^\d{4}-\d{2}-\d{2}$/.test(String(h?.date||''))&&Number.isSafeInteger(h.memberCount))
      .sort((x,y)=>x.date.localeCompare(y.date)).map(h=>[h.date,h.memberCount]));
    const today=C.londonDay(Date.now());
    const dailyNet=[...byDay].filter(([d])=>byDay.has(C.addDays(d,-1))).map(([d,v])=>({week:d,label:C.dayShort(d),range:C.dayLong(d),value:v-byDay.get(C.addDays(d,-1)),incomplete:d===today})).slice(-14);
    const chart=U.chartPanel({id:'discord-chart',measures:[
      dailyNet.length>=2?{key:'daily',label:'Daily Member Growth',title:'Daily Member Growth',series:dailyNet,period:'Day',format:'signed',unit:'Member Growth',kinds:['bar','line','table']}:null,
      netSeries.length>=1?{key:'net',label:'Member Growth',title:'Member Growth',series:netSeries,format:'signed',unit:'Member Growth',kinds:['bar','line','table']}:null,
    ].filter(Boolean)},pageState('discord').chart);
    const table=U.tablePanel({id:'discord-table',title:'Weekly Stats',icon:'users',dropEmptyRows:true,
      rows:weeks.slice().reverse(),rowKey:r=>r.week,
      columns:[
        {key:'week',label:'Week',type:'name',html:r=>esc(r.range)+(r.incomplete?' '+U.status('In Progress'):''),sort:r=>r.week},
        {key:'end',label:'Members',get:r=>r.end===null?M.na('No snapshot this week.'):M.value(r.end)},
        {key:'net',label:'Member Growth',format:'signed',get:r=>r.value===null?M.na('Needs the previous week’s snapshot.'):M.value(r.value)}
      ]},tableState('discord','discord-table'));
    return {title:'Discord',chip:'discord',refreshLabel:'Refresh',updated:members?.checkedAt||clicks?.checkedAt,stale:!!dd.error,body:section('Community Performance')+strip+chart+table};
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
  const ofRecords=()=>(D.campaign('of-terms')?.rows||[]).filter(isBooking).map(r=>xRecord(r,{campaign:'OnlyFans Terms',parent:'OnlyFans Terms',type:r.type||r.format||'post',clicks:r=>C.num(r.clicks)===null?M.na('No /of/ link events recorded.'):M.value(r.clicks,{reason:'Events on the /of/ tracking link.'})}));
  const guruRecords=()=>(D.campaign('guru-rts')?.paidReposts||[]).map(r=>xRecord(r,{campaign:'Guru X RTs',parent:'Guru X RTs',type:'rt',ownLink:false,
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
    return U.tablePanel({id,title,icon,rows,rowKey:r=>r.key,rowLabel:r=>r.name,minWidth:760,empty,hideEmpty:false,
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
    const d=C.dailySeries(history,{id:idOf,at,value}),tip=p=>({...p,extra:p.count+' posts with a reading'});
    const gained=d.gained.filter(p=>p.value!==null).length>=2?d.gained.map(tip):[];
    return U.chartPanel({id,measures:[
      gained.length?{key:'gained',label:'Daily '+noun,title:'Daily '+noun,series:gained,period:'Day',format:'compact',tipFormat:'count',unit:'Views Gained',defaultType:'bar'}:null,
      ...extra
    ].filter(Boolean)},pageState(page).chart);
  }
  const postIdsOf=records=>new Set(records.flatMap(x=>x.raw.postUrls?.length?x.raw.postUrls:[x.raw.postUrl]).map(u=>C.postId(u)).filter(Boolean).map(String));

  function xArticlesPage(st){
    ensure('overview');
    const ov=D.overview(),s=ov?C.campaignSummary(ov,'x-articles'):null,xa=D.campaign('x-articles'),dash=D.dashboard();
    const names=new Map((dash?.campaigns||[]).map(c=>[c.id,c.name]));
    const records=xaRecords();
    const arts=records.filter(x=>x.type!=='RT'),rts=records.filter(x=>x.type==='RT');
    const tabs=[{key:'overview',label:'Overview'},{key:'articles',label:'Articles',n:arts.length},{key:'rts',label:'Paid RTs',n:rts.length}].filter(t=>t.n!==0);
    const tab=pickTab(st.view,tabs,{'original-posts':'articles','paid-reposts':'rts'});
    const scoped=tab==='articles'?arts:tab==='rts'?rts:records,id='xa-'+tab;
    const f=xState('x-articles',id),shown=scoped.filter(xMatch(f));
    const k=!s?null:tab==='overview'?{spend:s.spend,views:s.views,clicks:s.clicks,cpc:s.cpc}:xKpis(shown);
    const strip=!k?loadingStrip(KPI_LOADING):kpiStrip(k);
    // Chart history is limited to the posts in this tab.
    const own=shown.filter(x=>x.type!=='RT'),codes=new Set(own.map(x=>String(x.raw.code||''))),ids=postIdsOf(own);
    const hist=dash?(dash.history||[]).filter(h=>codes.has(String(h.code||''))||ids.has(String(h.postId||''))):[];
    const clickSeries=dash&&dash.activityReady?C.eventSeries(dash.activity,{include:r=>codes.has(String(r.code))}):[];
    const chart=viewsChart('xa-chart','x-articles',hist,{idOf:r=>r.postId||r.code,extra:[clickSeries.length?{key:'clicks',label:'Weekly Clicks',title:'Weekly Clicks',series:clickSeries,unit:'Clicks',defaultType:'bar'}:null]});
    let body;
    if(tab==='overview'){
      const by=new Map();for(const x of arts){const cid=x.raw.campaignId||'UNASSIGNED';if(!by.has(cid))by.set(cid,[]);by.get(cid).push(x);}
      const rows=[...by].map(([cid,list])=>summaryRow('a-'+cid,cid==='UNASSIGNED'?'Unassigned Article':names.get(cid)||list[0].raw.articleLabel||cid,list,{view:'articles',icon:'doc'}));
      if(rts.length)rows.push(summaryRow('rts','Paid RTs',rts,{icon:'refresh'}));
      body=chart+summaryTable('x-articles','xa-summary',{title:'Articles',icon:'doc',nameLabel:'Article',rows,empty:xa?'No Results':waiting('Loading…')});
    }else{
      const eff=C.placementEfficiency(shown.map(x=>x.raw));
      body=chart+filteredNote(f)+xTable('x-articles',id,{title:tab==='rts'?'Paid RTs':'Original Articles',icon:tab==='rts'?'refresh':'doc',records:scoped,f,
        empty:xa?'No Results':waiting('Loading…'),
        expand:x=>xDetail(x,eff,{source:x.type==='RT'?(U.extLink(x.raw.sourcePostUrl||'','Source Post')||''):(U.extLink(x.raw.articleUrl,'Article')||''),
          extra:[['Article',x.type==='RT'?'':esc(names.get(x.raw.campaignId)||x.raw.articleLabel||'')],
            ['Original Views',x.type==='RT'&&C.num(x.raw.sourceOriginalViews)!==null?esc(C.full(x.raw.sourceOriginalViews)):''],
            ['Destination',x.raw.destinationUrl?esc(x.raw.destinationUrl.replace(/^https?:\/\//,'').split('?')[0]):''],['Click Source',x.type==='RT'?'':esc('Site redirects')]]})});
    }
    const label={overview:'Article Performance',articles:'Article Performance',rts:'Paid RT Performance'}[tab];
    return {title:'X Articles',chip:'x-articles',refreshLabel:'Refresh',updated:ov?.checkedAt,stale:!!(D.overviewStatus().error||xa?.sourceStale||xa?.dataWarning),
      body:overviewNotice()+subTabs(tabs,tab)+section(label)+strip+body};
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
      const k={spend:s.spend,views:s.views,clicks:s.clicks,cpc:s.cpc,spendNote:s.planned>0?'Includes Planned':undefined,
        clicksChip:s.clicks&&C.hasValue(s.clicks)&&s.clicks.state!=='stale'&&s.clicks.allTime!==undefined?U.reasonButton(C.full(s.clicks.allTime)+' All-Time',s.clicks.reason,'fv-chip'):undefined};
      if(s.planned>0&&C.hasValue(k.spend))k.spend={...k.spend,reason:'Includes '+C.money(s.planned)+' planned (not paid yet), counted as if paid. Includes IG spend.'};
      strip=kpiStrip(k);
    }else if(tab==='instagram')strip=U.strip([metric('Spend','wallet',xKpis(shown).spend,'moneyShort'),metric('Posts','image',M.value(shown.filter(x=>x.live===true).length,{reason:'Instagram posts and stories marked up in the source sheet.'}))]);
    else strip=kpiStrip(xKpis(shown));
    // Compact, campaign-wide (All Time) budget and IG summary, on the Overview only.
    const b=s?.budget,live=c=>c&&!c.unavailable;
    const outstanding=s?(s.planned||0)+(C.num(s.committed)||0):0;
    const igSpend=live(ig)?C.spendOf(ig):null,igPosts=live(ig)?(ig.rows||[]).filter(r=>r.posted===true).length:null;
    const budget=tab==='overview'&&b?U.supportPanel('Budget','wallet',U.inlineMetrics([
      ['Budget',U.value(b.budget,'money')],
      ['Planned',U.value(M.value(outstanding,{reason:'Not paid yet: '+C.money(s.planned||0)+' planned (counted as if paid) and '+C.money(C.num(s.committed)||0)+' agreed.'}),'money')],
      ['Remaining',U.value(b.remaining,'money')],
      igSpend?['IG Spend',U.value(igSpend,'money')]:null,
      igPosts!==null?['IG Posts',U.value(M.value(igPosts,{reason:'Instagram posts and stories marked up in the source sheet.'}),'count')]:null
    ].filter(Boolean))):'';
    // Views chart for the posts in this tab (every post, including extra posts on a booking); Spend by group on the Overview.
    const ids=postIdsOf(shown);
    const history=gr&&tab!=='instagram'?[...(gr.history||[]),...(gr.originals?.history||[]),...(gr.mandy?.history||[])].filter(h=>ids.has(String(h.id||''))):[];
    const spendCats=tab==='overview'?[['Lucia',group('Lucia')],['Mandy',group('Mandy')],['Instagram',igs]].filter(([,l])=>l.length).map(([label,l])=>{const m=xKpis(l).spend;return {label,value:C.hasValue(m)?m.value:null};}):[];
    const chart=viewsChart('gta-chart','gta-vi',history,{extra:[spendCats.length>1?{key:'spend',label:'Spend',title:'Spend by Group',categories:spendCats,format:'moneyShort',tipFormat:'money',unit:'Spend'}:null]});
    let body;
    if(tab==='overview'){
      const rows=[['lucia','Lucia','gamepad'],['mandy','Mandy','gamepad'],['other','Other','gamepad']].map(([key,name,icon])=>{const l=group(key==='other'?'GTA VI':name);return l.length?summaryRow(key,name,l,{icon}):null;}).filter(Boolean);
      if(igs.length)rows.push(summaryRow('instagram','Instagram',igs,{icon:'image'}));
      body=budget+chart+summaryTable('gta-vi','gta-summary',{title:'Groups',icon:'gamepad',rows,empty:s?'No Results':waiting('Loading…')});
    }else{
      const eff=C.placementEfficiency(shown.map(x=>x.raw));
      const quoted=new Map([...(qr?.quotedOriginals?.rows||[]),...(mq?.quotedOriginals?.rows||[])].flatMap(o=>(o.qrts||[]).map(q=>[q.postUrl,o])));
      body=chart+filteredNote(f)+xTable('gta-vi',id,{title:tabs.find(t=>t.key===tab).label+' Placements',icon:tab==='instagram'?'image':'gamepad',records:scoped,f,groups:false,empty:s?'No Results':waiting('Loading…'),
        expand:x=>{const o=quoted.get(x.raw.postUrl);return xDetail(x,eff,{source:o?U.extLink(o.originalUrl,o.handle?'@'+o.handle:'Source Post'):'',
          extra:[['Original Views',o&&C.num(o.views)!==null?esc(C.full(o.views)):''],
            ['All-Time Clicks',count(x.raw.allTimeClicks)],['Click Source',x.raw.trackingUrl?esc('Short.io human clicks'):'']]});}});
    }
    // Shown only when a spreadsheet tab could not be read, so its rows are missing from the totals.
    const tabWarning=(qr?.missingTabs||[]).map(t=>'<div class="fv-notice" role="status">'+U.icon('alert',15)+'<span>'+U.reasonButton('Missing Data',t+' could not be read from the spreadsheet, so its rows are not counted.','fv-notice-reason')+'</span></div>').join('');
    const label=tab==='overview'?'Campaign Performance':tabs.find(t=>t.key===tab).label+' Performance';
    return {title:'GTA VI',chip:'gta-vi',refreshLabel:'Refresh',updated:ov?.checkedAt,stale:!!(D.overviewStatus().error||qr?.sourceStale||og?.sourceStale),
      body:overviewNotice()+tabWarning+subTabs(tabs,tab)+section(label)+strip+body};
  }

  function ofPage(st){
    ensure('overview');ensure('of');
    const ov=D.overview(),s=ov?C.campaignSummary(ov,'of-terms'):null,c=D.campaign('of-terms'),rep=D.of().report;
    const records=ofRecords();
    const tabs=[{key:'overview',label:'Overview'},{key:'accounts',label:'Accounts',n:records.length}].filter(t=>t.n!==0);
    const tab=pickTab(st.view,tabs);
    const f=xState('of-terms','of-results'),shown=tab==='accounts'?records.filter(xMatch(f)):records;
    const k=!s?null:tab==='accounts'&&xActive(f)?xKpis(shown):{spend:s.spend,views:s.views,clicks:s.clicks,cpc:s.cpc};
    const strip=!k?loadingStrip(KPI_LOADING):kpiStrip(k);
    const codes=new Set(shown.map(x=>String(x.raw.code)));
    const series=rep?.ready&&Array.isArray(rep.activity)?C.eventSeries(rep.activity,{include:r=>codes.has(String(r.code))}):[];
    const chart=U.chartPanel({id:'of-chart',measures:series.length?[{key:'clicks',label:'Clicks',title:'Weekly Clicks',series,unit:'Clicks'}]:[]},pageState('of-terms').chart);
    let body;
    if(tab==='overview'){
      const live=records.filter(x=>x.live===true),waitingRows=records.filter(x=>x.live!==true);
      const rows=[live.length?summaryRow('live','Live',live,{view:'accounts',icon:'check'}):null,waitingRows.length?summaryRow('waiting','Not Live Yet',waitingRows,{view:'accounts',icon:'clock'}):null].filter(Boolean);
      body=chart+summaryTable('of-terms','of-summary',{title:'Status',icon:'users',nameLabel:'Status',rows,empty:c?'No Results':waiting('Loading…')});
    }else{
      const eff=C.placementEfficiency(shown.map(x=>x.raw));
      body=chart+filteredNote(f)+xTable('of-terms','of-results',{title:'Accounts',icon:'users',records,f,groups:false,empty:c?'No Results':waiting('Loading…'),
        expand:x=>xDetail(x,eff,{extra:[['Last Click',x.raw.lastClick?when(x.raw.lastClick):''],['Click Source',esc('/of/ link events')]]})});
    }
    return {title:'OnlyFans Terms',chip:'of-terms',refreshLabel:'Refresh',updated:ov?.checkedAt,stale:!!(D.overviewStatus().error||c?.sourceStale),
      body:overviewNotice()+subTabs(tabs,tab)+section('Campaign Performance')+strip+body};
  }

  function guruPage(st){
    ensure('overview');
    const ov=D.overview(),s=ov?C.campaignSummary(ov,'guru-promotion'):null,g=D.campaign('guru-rts');
    const originals=new Map((g?.rows||[]).map(r=>[String(r.id),r]));
    const records=guruRecords();
    const tabs=[{key:'overview',label:'Promoted Posts',n:(g?.rows||[]).length||undefined},{key:'rts',label:'Paid RTs',n:records.length}].filter(t=>t.n!==0);
    const tab=pickTab(st.view,tabs,{'promoted-posts':'overview','paid-reposts':'rts'});
    const f=xState('guru-promotion','guru-results'),shown=tab==='rts'?records.filter(xMatch(f)):records;
    const spend=!s?null:tab==='rts'&&xActive(f)?xKpis(shown).spend:s.spend;
    const ov2=s?.views;if(ov2&&C.hasValue(ov2))ov2.reason='Original Views: views of the promoted original posts, including organic views. Not RT impressions.';
    const strip=!s?loadingStrip([['Spend','wallet'],['Original Views','eye']]):U.strip([metric('Spend','wallet',spend,'moneyShort'),metric('Original Views','eye',s.views,'compact')]);
    // Original Views over time, from each promoted post's dated readings.
    const charted=(g?.rows||[]).filter(r=>C.num(r.views)!==null);
    const chart=viewsChart('guru-chart','guru-promotion',charted.flatMap(r=>(r.history||[]).map(h=>({...h,id:r.id}))),{noun:'Original Views'});
    const groupKey=x=>String(C.postId(x.raw.sourcePostUrl||x.raw.postUrl)||'');
    const groups=new Map((g?.articleRtGroups||[]).map(x=>[String(x.postId),x]));
    let body;
    if(tab==='overview'){
      const rtBy=new Map();for(const x of records){const k=groupKey(x);if(!rtBy.has(k))rtBy.set(k,[]);rtBy.get(k).push(x);}
      const rows=(g?.rows||[]).map(r=>{const rts=rtBy.get(String(r.id))||[];const paid=rts.filter(x=>x.paid&&x.price!==null);
        return {key:String(r.id),r,name:guruName(r,g.rows),rts:rts.length,views:C.num(r.views)!==null?M.value(r.views):M.na('No verified X reading yet.'),
          spend:paid.length?M.value(paid.reduce((n,x)=>n+x.price,0)):M.na('No paid RTs of this post.')};});
      body=chart+U.tablePanel({id:'guru-summary',title:'Promoted Posts',icon:'megaphone',rows,rowKey:r=>r.key,rowLabel:r=>r.name,minWidth:720,hideEmpty:false,
        empty:g?'No Results':waiting('Loading…'),
        columns:[
          {key:'name',label:'Original Post',type:'name',html:r=>accountName({publisher:r.name},'megaphone'),sort:r=>r.name.toLowerCase()},
          {key:'link',label:'Link',type:'link',nosort:true,html:r=>r.r.postUrl?U.extLink(r.r.postUrl,'Open post by '+r.name,{iconOnly:true}):dash('No post link recorded.')},
          {key:'views',label:'Original Views',get:r=>r.views},
          {key:'rts',label:'Paid RTs',type:'count',get:r=>r.rts},
          {key:'spend',label:'RT Spend',format:'money',get:r=>r.spend}
        ]},tableState('guru-promotion','guru-summary'));
    }else{
      const ts=tableState('guru-promotion','guru-results');
      body=chart+filteredNote(f)+U.tablePanel({id:'guru-results',title:'Paid RTs',icon:'megaphone',search:true,filters:xFilters('guru-results',records,f,{groups:false}),filter:xMatch(f),
        rows:records,rowKey:x=>rowKeyOf(x.raw),rowLabel:x=>x.account,minWidth:900,searchText:x=>[x.account,originals.get(groupKey(x))?.publisher||''].join(' '),
        empty:g?'No Results':waiting('Loading…'),columns:X_COLUMNS,groupBy:groupKey,
        groupHeader:(key,rows)=>{const o=originals.get(key),gp=groups.get(key);const total=rows.reduce((n,x)=>n+(x.paid&&x.price!==null?x.price:0),0);
          return '<span class="fv-group-title">'+U.marker('megaphone','',{plain:true})+'<b>'+esc(o?guruName(o,g.rows):'Source post')+'</b></span>'+
            (o?.postUrl||gp?.postUrl?U.extLink(o?.postUrl||gp.postUrl,'Source Post'):'')+
            (C.num(o?.views??gp?.views)!==null?'<span>Original Views <b>'+esc(C.full(o?.views??gp?.views))+'</b></span>':'')+
            '<span>RT Spend <b>'+esc(C.money(total))+'</b></span>';},
        expand:x=>xDetail(x,null,{source:U.extLink(x.raw.sourcePostUrl||x.raw.postUrl||'','Source Post')||'',
          extra:[['X Ad Spend',C.num(originals.get(groupKey(x))?.cost)!==null?money(originals.get(groupKey(x)).cost):'']]})},ts);
    }
    return {title:'Guru X RTs',chip:'guru-promotion',refreshLabel:'Refresh',updated:ov?.checkedAt,stale:!!(D.overviewStatus().error||g?.sourceStale),
      body:overviewNotice()+subTabs(tabs,tab)+section('Campaign Performance')+strip+body};
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
    const u=String(x.raw.profileUrl||''),m=u.match(/^https:\/\/(?:www\.)?(x\.com|twitter\.com|instagram\.com)\/([A-Za-z0-9_.]+)/i);
    const handle=m?m[2]:String(x.raw.handle||x.account||'').replace(/^@/,'').trim();
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
      const paid=recs.filter(x=>x.paid&&x.price!==null),links=new Map();
      for(const x of recs){if(!C.hasValue(x.clicks))continue;const k=x.raw.trackingUrl||rowKeyOf(x.raw);links.set(k,Math.max(links.get(k)||0,x.clicks.value));}
      const e=C.efficiency([{source:'ACCOUNTS',rows:own}]);
      return {...a,records:recs,campaigns:[...new Set(recs.map(x=>x.parent))],posts:posts.size+liveNoLink,
        spend:paid.length?M.value(paid.reduce((n,x)=>n+x.price,0)):M.na('No paid placements.'),
        views:C.viewsOf([{source:'ACCOUNTS',rows:own}]),
        clicks:links.size?M.value([...links.values()].reduce((n,v)=>n+v,0)):M.na('No tracked clicks.'),cpc:e.cpc,cpm:e.cpm};
    });
  }
  function accountsPage(st){
    ensure('overview');ensure('gta');
    const ov=D.overview();
    const all=ov?[...xaRecords(),...gtaRecords(),...igRecords(),...ofRecords(),...guruRecords()]:[];
    const ts=tableState('all-accounts','acc-table'),f=ts.xf||(ts.xf={camp:'',plat:'',type:''});
    if(!ts.sort)ts.sort={key:'spend',dir:-1};  // biggest spenders first by default
    const shown=all.filter(x=>(!f.camp||x.parent===f.camp)&&(!f.plat||x.platform===f.plat)&&(!f.type||x.type===f.type));
    const sel=(key,label,opts)=>opts.length<2&&!f[key]?'':'<label class="fv-select fv-filter"><span class="fv-sr">'+esc(label)+'</span><select data-xfilter="'+key+'" data-table="acc-table">'+
      [['',label+': All'],...opts.map(o=>[o,label+': '+o])].map(([v,l])=>'<option value="'+esc(v)+'"'+(f[key]===v?' selected':'')+'>'+esc(l)+'</option>').join('')+'</select>'+U.icon('down',14)+'</label>';
    const present=(get,order)=>order.filter(v=>all.some(x=>get(x)===v));
    const filters=sel('camp','Campaign',present(x=>x.parent,C.CAMPAIGNS.map(c=>c.name)))+sel('plat','Platform',present(x=>x.platform,['X','Instagram']))+sel('type','Type',present(x=>x.type,['Post','Article','RT','QRT','Story']));
    const rows=accountRows(shown);
    const table=U.tablePanel({id:'acc-table',title:'Accounts',icon:'users',search:true,filters,rows,rowKey:a=>a.key,rowLabel:a=>a.name,minWidth:900,
      searchText:a=>[a.name,...a.records.map(x=>x.account)].join(' '),empty:ov?'No Results':waiting('Loading…'),countLabel:n=>n===1?'account':'accounts',
      columns:[
        {key:'name',label:'Account',type:'name',html:a=>accountName({publisher:a.name},a.platform==='Instagram'?'image':'user'),sort:a=>a.name.toLowerCase()},
        {key:'platform',label:'Platform',type:'text',html:a=>esc(a.platform),sort:a=>a.platform},
        {key:'campaigns',label:'Campaigns',type:'text',html:a=>esc(a.campaigns.join(', ')),sort:a=>a.campaigns.length},
        {key:'posts',label:'Posts',get:a=>M.value(a.posts,{reason:'Live posts (each post counted once).'})},
        {key:'spend',label:'Spend',format:'money',get:a=>a.spend},
        {key:'views',label:'Views',get:a=>a.views},
        {key:'clicks',label:'Clicks',get:a=>a.clicks},
        {key:'cpc',label:'CPC',format:'money',get:a=>a.cpc},
        {key:'cpm',label:'CPM',format:'money',get:a=>a.cpm}
      ]},ts);
    return {title:'Accounts',refreshLabel:'Refresh All',updated:ov?.checkedAt,stale:!!(D.overviewStatus().error||ov?.stale),body:overviewNotice()+table};
  }

  const RENDER={home:homePage,'all-accounts':accountsPage,discord:discordPage,'x-articles':xArticlesPage,'gta-vi':gtaPage,'of-terms':ofPage,'guru-promotion':guruPage};

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
      '<div class="fv-nav" role="group" aria-labelledby="fvPaidLabel">'+PAGES.filter(p=>p.group==='paid').map(item).join('')+(hooks.navExtra?hooks.navExtra(active):'')+'</div>';
  }
  function setNav(active){$('fvNav').innerHTML=navHtml(active);}
  // Built-in campaign icon and colour, with any saved override from the campaign manager.
  function look(key){const d=C.CAMPAIGNS.find(c=>c.key===key);const o=hooks.override?.(key);return {icon:o?.icon?glyphName(o.icon):(d.icon==='x'?'xmark':d.icon),color:o?.color||d.color};}
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
  function drawCharts(){
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
      else if(k==='home'||k==='all-accounts'){await app?.refresh?.all?.();const s=app?.status?.('reloadAllStatus');message=s?.text||'';error=!!s?.error;summary=s?.summary||'';}
      else if(k==='discord'){const ok=await rep?.refreshDiscord?.(true);message=ok?'':'Discord sources unavailable; last verified figures kept.';error=!ok;}
      else{
        const fn={'x-articles':'x','gta-vi':'gta','of-terms':'of','guru-promotion':'boosts'}[k];
        const ids={'x-articles':'xRefreshStatus','gta-vi':'gtaRefreshStatus','of-terms':'ofRefreshStatus','guru-promotion':'boostRefreshStatus'};
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
    if(ct){const st=pageState(pageKey()).chart;st.type=ct.dataset.chartType;rerender();return;}
    const reset=t.closest('[data-reset]');
    if(reset){const st=tableState(pageKey(),reset.dataset.reset);st.q='';st.filter='';if(st.xf)st.xf={group:'',type:'',live:'',pay:''};rerender();return;}
    if(t.closest('[data-retry]')){void D.rep()?.reload?.();return;}
  }
  const pageKey=()=>current.kind==='page'?current.key:'added:'+current.key;
  const defaultView=k=>({'x-articles':'overview','gta-vi':'overview','of-terms':'overview',discord:'weekly-history','guru-promotion':'overview'}[k]||'');
  function onInput(e){
    const s=e.target.closest('[data-search]');
    if(s){tableState(pageKey(),s.dataset.search).q=s.value;rerender();}
  }
  function onChange(e){
    const m=e.target.closest('[data-chart-measure]');
    if(m){const st=pageState(pageKey()).chart;st.measure=m.value;st.type='';rerender();return;}
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
    $('fvMenu').innerHTML=U.icon('menu',22);$('fvDrawerClose').innerHTML=U.icon('close',20);
    U.bindTips(document.body);
    const page=$('fvPage');
    page.addEventListener('click',onClick);page.addEventListener('input',onInput);page.addEventListener('change',onChange);
    $('fvRefresh').addEventListener('click',onRefresh);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){if($('fvShell').classList.contains('is-nav-open')){$('fvShell').classList.remove('is-nav-open');$('fvMenu').focus();}}});
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
