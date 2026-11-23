/* Fanvue X Tracker: lifetime campaign reporting, additive to existing pages. */
(() => {
  'use strict';
  const tabs = [
    ['all','Overview'],['gta','GTA VI'],['of','OF Terms'],['article-rt','X Article Boosts'],
    ['guru','Guru RTs'],['articles','X Articles'],['harness','AI Harness'],
    ['discord','Discord'],['other','Other']
  ];
  const state={tab:'all',data:null,loading:null,error:'',lastLoadAt:0};
  const el=id=>document.getElementById(id);
  const txt=v=>String(v??'');
  const esc=v=>txt(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
  const format=v=>num(v)===null?'—':new Intl.NumberFormat('en-GB',{maximumFractionDigits:0}).format(Number(v));
  const usd=v=>num(v)===null?'—':'$'+new Intl.NumberFormat('en-GB',{minimumFractionDigits:0,maximumFractionDigits:2}).format(Number(v));
  const date=v=>{if(!v)return 'Not yet verified';const t=Date.parse(v);return Number.isNaN(t)?'Not yet verified':new Date(t).toLocaleString('en-GB',{timeZone:'Europe/London',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hour12:false})+' UK';};
  const url=value=>{try{const u=new URL(txt(value));return u.protocol==='https:'?u.href:'';}catch{return '';}};
  const link=(u,label)=>{const href=url(u);return href?'<a href="'+esc(href)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+'</a>':'<span class="rpt-missing">Not supplied</span>';};
  const item=id=>state.data?.campaigns?.find(c=>c.id===id);
  const list=()=>state.data?.campaigns||[];
  const viewStatus=c=>c?.source==='NOT_CONNECTED'?'Not connected':c?.unavailable||c?.source==='UNAVAILABLE'?'Unavailable':c?.sourceStale||c?.dataWarning?'Saved data':'Connected';
  const badge=c=>'<span class="rpt-source rpt-source-'+(viewStatus(c)==='Connected'?'ok':viewStatus(c)==='Saved data'?'saved':'missing')+'">'+esc(viewStatus(c))+'</span>';
  const metric=(label,value,sub='')=>'<div class="rpt-stat"><dt>'+esc(label)+'</dt><dd>'+esc(value)+'</dd>'+(sub?'<small>'+esc(sub)+'</small>':'')+'</div>';
  const clicks=c=>c?.allTimeHumanClicks??c?.trackedClicks??null;
  const note='<p class="rpt-note">All-time X counters, not unique reach. Clicks come from their named tracking source and are not interchangeable. Missing sign-ups, KYC and earning-creator metrics are shown as unavailable, never zero.</p>';
  function grid(columns,rows,classname='rpt-table'){
    return '<div class="rpt-scroll"><table class="'+classname+'"><thead><tr>'+columns.map(c=>'<th scope="col">'+esc(c)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(cell=>'<td>'+cell+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
  }
  function empty(message){return '<div class="rpt-empty">'+esc(message)+'</div>';}
  function header(title,sub){
    return '<div class="rpt-section-title"><div><h2>'+esc(title)+'<span class="heading-accent">.</span></h2><p>'+esc(sub||'Lifetime campaign reporting')+'</p></div></div>';
  }
  function totals(c){
    if(!c)return '';
    return '<dl class="rpt-stats">'+[
      metric('Paid spend',usd(c.paidSpendKnown),c.unknownPaidCosts?'Excludes '+c.unknownPaidCosts+' unknown cost(s)':c.paidCount?'Known paid rows':'No confirmed spend'),
      metric('Published',format(c.published),'Of '+format(c.placements)+' listed'),
      metric('X views',format(c.views),format(c.coverage?.withXMetrics)+' posts with readings'),
      metric('Tracked clicks',format(clicks(c)),c.id.startsWith('gta-')?'Short.io human clicks':'Source-specific'),
      metric('Sign-ups','—','Not connected'),
      metric('KYC','—','Not connected'),
      metric('Earning creators','—','Not connected')
    ].join('')+'</dl>';
  }
  function campaignRows(c){
    const rows=c?.rows||[];
    if(!rows.length)return empty(c?.unavailable?'This campaign has no connected, verified placement feed yet.':'No placements found in the connected source.');
    const view=r=>r.views??r.xViews;
    const sourceLink=r=>r.postUrl?link(r.postUrl,'X post'):r.profileUrl?link(r.profileUrl,'X profile'):link('', 'X');
    const linkCell=r=>'<span class="rpt-links">'+sourceLink(r)+(r.trackingUrl?' · '+link(r.trackingUrl,'Tracking'): '')+'</span>';
    return grid(['Publisher / activity','Paid?','Posted?','Paid cost','X views','Tracked clicks','Post-publication clicks','Last X update','Links'],rows.map(r=>[
      '<strong>'+esc(r.publisher||r.name||r.handle||'Unnamed')+'</strong><small class="rpt-rowmeta">'+esc(r.sourceTab||r.campaign||'')+'</small>',
      r.paid?'<strong>Paid</strong>':'—',
      r.posted?'<strong>Posted</strong>':r.paid?'Pending':'Not confirmed',
      r.paid?usd(r.cost):'—',esc(format(view(r))),
      esc(format(r.allTimeClicks??r.clicks??null)),esc(format(r.allTimeClicks!==undefined?r.clicks:null)),esc(date(r.metricAt||r.xUpdated||r.metricLastVerifiedAt||null)),linkCell(r)
    ]));
  }
  function campaignPanel(id,sub){
    const c=item(id);
    if(!c)return empty('Campaign feed unavailable.');
    return '<section class="rpt-campaign-panel">'+header(c.name,sub||'Lifetime results · '+viewStatus(c)+' · Source updated '+date(c.sourceVerifiedAt))+
      badge(c)+totals(c)+(c.unavailable?empty(c.unavailable===true?'No verified live source is connected.':txt(c.unavailable)):campaignRows(c))+
      (c.trackingWarning?'<p class="rpt-warning">'+esc(c.trackingWarning)+'</p>':'')+
      (c.classificationNote?'<p class="rpt-note">'+esc(c.classificationNote)+'</p>':'')+
      (c.dataWarning?'<p class="rpt-warning">'+esc(c.dataWarning)+'</p>':'')+'</section>';
  }
  function articleSources(){
    const quoted=item('gta-qrts')?.quotedOriginals;
    if(!quoted)return header('Quoted originals','Awaiting verified X quote relationships')+empty('No linked original-post report has been returned yet. Refreshing the existing X metrics may populate it.');
    const records=quoted.rows||[];
    const summary=quoted.summary||{};
    const intro=header('Original posts boosted by QRTs','Each source article is listed once, with its linked paid promotions.');
    const stats='<dl class="rpt-stats">'+[
      metric('Original posts',format(summary.originalPosts),'Provider-verified links'),
      metric('Original views',format(summary.quotedPostViews),'Separate from QRT views'),
      metric('QRT views',format(summary.qrtViews),'On matched QRTs only'),
      metric('Matched QRTs',format(summary.matchedQrts),'Of '+format(summary.publishedQrts)+' published')
    ].join('')+'</dl>';
    const warning=summary.unmatchedQrts?'<p class="rpt-warning">'+esc(format(summary.unmatchedQrts)+' QRTs are not yet linked to a verified original post. Their views are not assigned to an article.')+'</p>':'';
    if(!records.length)return intro+stats+warning+empty('No source-post relationships are verified yet. QRT metrics will remain available separately.');
    const rows=records.map(r=>[
      '<strong>'+esc('@'+r.handle)+'</strong><small class="rpt-rowmeta">'+link(r.originalUrl,'Original X post')+'</small>',
      esc(format(r.views)),esc(format(r.qrtCount)),esc(format(r.qrtViews)),
      esc(usd(r.paidSpendKnown))+(r.unknownPaidCosts?' <small>Partial</small>':''),
      esc(format(r.allTimeHumanClicks)),esc(date(r.metricAt))
    ]);
    const details=records.map(r=>
      '<details class="rpt-expander"><summary><strong>'+esc('@'+r.handle)+'</strong><span>'+esc(format(r.qrtCount))+' linked QRTs · '+esc(format(r.qrtViews))+' QRT views</span></summary>'+
      grid(['Paid QRT publisher','X views','Paid cost','Human clicks','Post-publication clicks','Live QRT'],
      (r.qrts||[]).map(q=>[
        '<strong>'+esc(q.publisher)+'</strong>',esc(format(q.views)),q.paid?esc(usd(q.cost)):'—',
        esc(format(q.allTimeHumanClicks)),esc(format(q.postPublicationClicks)),link(q.postUrl,'View QRT')
      ]))+'</details>').join('');
    return intro+stats+warning+grid(['Original post','Original views','QRTs','QRT views','Known paid spend','Human clicks','Last X reading'],rows)+
      '<div class="rpt-expanders">'+details+'</div>'+
      '<p class="rpt-note">Original-post views include organic exposure. QRT views reflect only the separate posts quoted by each publisher. They must not be added together as unique reach.</p>';
  }
  function renderOverview(){
    return header('Campaign overview','All available campaigns · lifetime totals without date filters')+
      '<p class="rpt-note">Each source is shown separately to avoid double-counting shared campaigns and article views.</p>'+
      grid(['Campaign','Data source','Paid spend','Published','X views','Tracked clicks','Conversions'],list().map(c=>[
        '<button class="rpt-rowbutton" data-report-jump="'+esc(c.id.startsWith('gta-')?'gta':c.id==='of-terms'?'of':c.id==='article-rts'?'article-rt':c.id==='guru-rts'?'guru':c.id==='ai-harness'?'harness':c.id==='discord'?'discord':'articles')+'">'+esc(c.name)+'</button>',
        badge(c),usd(c.paidSpendKnown),format(c.published),format(c.views),format(clicks(c)),'<span class="rpt-missing">Not connected</span>'
      ]))+note;
  }
  function renderArticleGroups(){
    const campaign=item('x-articles'),groups=campaign?.sourceCampaigns||[];
    if(!groups.length)return empty('No historical article campaign groups returned.');
    return header('Source campaign breakdown','Reported by the main Google Sheet, with lifetime totals.')+
      grid(['Campaign','Status','Placements','Published','Paid spend','X views','Tracked clicks'],groups.map(c=>[
        '<strong>'+esc(c.name)+'</strong><small class="rpt-rowmeta">'+esc(c.id)+'</small>',
        esc(c.status||'Recorded'),format(c.placements),format(c.published),
        usd(c.paidSpendKnown),format(c.xViews),format(c.trackedClicks)
      ]));
  }
  function guruContent(){
    const c=item('guru-rts');
    if(!c)return empty('X RT boost feed is unavailable.');
    const rows=c.rows||[];
    const percent=v=>num(v)===null?'—':new Intl.NumberFormat('en-GB',{minimumFractionDigits:1,maximumFractionDigits:2}).format(Number(v))+'%';
    const summary=header('Guru X RTs and boosts','Current original-tweet performance · lifetime spend and exposure')+badge(c)+totals(c);
    if(!rows.length)return summary+empty('No verified boosted X tweets currently recorded.');
    return summary+grid(
      ['Original tweet','Known spend','X views','Interactions','Engagement','Cost / 1K views','Views gained 24h','Live X link'],
      rows.map(r=>[
        '<strong>'+esc(r.name||r.publisher||r.handle)+'</strong><small class="rpt-rowmeta">@'+esc(r.handle||'')+'</small>',
        usd(r.spend),esc(format(r.views)),
        esc(format([r.likes,r.reposts,r.replies].every(v=>num(v)!==null)?
          Number(r.likes)+Number(r.reposts)+Number(r.replies):null)),
        esc(percent(r.engagement)),usd(r.efficiency),esc(format(r.growth24)),
        link(r.postUrl,'Open post')
      ])
    )+'<p class="rpt-note">X post views include organic traffic. Effective cost per 1,000 is based on the full visible post views, not verified incremental paid reach. X RTs is the existing feed; Guru classification needs a confirmed campaign mapping.</p>';
  }
  function unconnectedContent(id,fields,reason){
    const c=item(id);
    if(!c)return empty('No campaign data source is connected.');
    return header(c.name,'Dedicated campaign reporting · source connection required')+badge(c)+
      '<div class="rpt-unconnected"><strong>Metrics not yet connected</strong><p>'+
      esc(fields.join(' · '))+'</p><small>'+esc(reason)+'</small></div>'+
      '<p class="rpt-note">The dashboard will not show fabricated figures, zero conversions or assumed placements. Existing campaign pages continue to work.</p>';
  }
  function content(){
    switch(state.tab){
      case 'all': return renderOverview();
      case 'gta': return articleSources()+campaignPanel('gta-qrts','Published paid QRT promotions · lifetime')+
                          campaignPanel('gta-originals','Original and V2 posts · separate from paid QRTs');
      case 'of':return campaignPanel('of-terms');
      case 'article-rt':return campaignPanel('article-rts')+'<p class="rpt-note">Where the operations sheet supplies an original X status URL, its views are pulled from matching verified posts already tracked by this website. Each original post is counted once, even if several paid accounts reposted it. A repost by itself has no separate measurable view counter in this report.</p>';
      case 'guru':return guruContent();
      case 'articles':return renderArticleGroups()+campaignPanel('x-articles');
      case 'harness':return unconnectedContent('ai-harness',['Angles and concepts','Spend by angle','Views and clicks','Sign-ups','KYC','Earning creators','Winning creative'],'Live creative-level campaign data and verified attribution are required to compare angles fairly.');
      case 'discord':return unconnectedContent('discord',['Active creators','Weekly growth','Competitions','Prism credits','Sign-ups','KYC','First earning creators'],'The Discord membership and Fanvue creator conversion feeds are not yet linked.');
      case 'other':return header('Other activity','Cross-campaign status and source coverage')+
                        renderArticleGroups()+
                        '<p class="rpt-note">New campaign results appear here when their verified source is connected. Existing article reporting, redirect tracking and historic pages remain available unchanged.</p>';
      default:return renderOverview();
    }
  }
  function render(){
    const nav=el('reportingTabs'),panel=el('reportingPanel'),status=el('reportingStatus');
    if(!nav||!panel||!status)return;
    nav.innerHTML=tabs.map(([key,label])=>
      '<button type="button" class="rpt-tab'+(state.tab===key?' is-active':'')+'" data-report-tab="'+key+'" role="tab" aria-selected="'+String(state.tab===key)+'">'+esc(label)+'</button>').join('');
    if(state.loading&&!state.data){status.textContent='Loading verified campaign feeds…';panel.innerHTML=empty('Loading data.');return;}
    status.textContent=state.error?(state.data?'Saved readings · '+state.error:'Feed unavailable · '+state.error):
      state.data?'Last checked '+date(state.data.checkedAt)+' · '+Object.values(state.data.sourceHealth||{}).filter(s=>s.ok).length+' connected feeds':'Not loaded';
    panel.innerHTML=state.data?content():empty(state.error||'Campaign report not loaded.');
  }
  async function load(force=false){
    if(state.loading)return state.loading;
    if(!force&&state.data&&Date.now()-state.lastLoadAt<45000){render();return true;}
    state.loading=(async()=>{
      render();
      try{
        const res=await fetch('/.netlify/functions/campaign-overview'+(force?'?refresh=1':''),{cache:'no-store',signal:AbortSignal.timeout(45000)});
        const data=await res.json();
        if(!res.ok||!data.ok||!Array.isArray(data.campaigns))throw Error(data.error||'Campaign reporting unavailable');
        state.data=data;state.error='';state.lastLoadAt=Date.now();
        return Object.values(data.sourceHealth||{}).every(source=>source.ok)&&!data.campaigns.some(c=>c.dataWarning||c.sourceStale);
      }catch(e){state.error=txt(e.message||e);return false;}
      finally{state.loading=null;render();}
    })();
    return state.loading;
  }
  function changeTab(next){
    if(!tabs.some(([key])=>key===next))return;
    state.tab=next;render();
  }
  function init(){
    el('reportingTabs')?.addEventListener('click',event=>{
      const btn=event.target.closest('[data-report-tab]');if(btn)changeTab(btn.dataset.reportTab);
    });
    el('reportingPanel')?.addEventListener('click',event=>{
      const btn=event.target.closest('[data-report-jump]');if(btn)changeTab(btn.dataset.reportJump);
    });
    el('reportingRefreshButton')?.addEventListener('click',()=>{void load(true);});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&location.hash==='#reporting')void load();});
    setInterval(()=>{if(!document.hidden&&location.hash==='#reporting')void load();},120000);
  }
  window.XTrackerCampaignReporting={show:()=>{render();void load();},reload:()=>load(true)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
