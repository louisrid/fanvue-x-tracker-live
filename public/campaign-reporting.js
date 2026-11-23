/* Fanvue X Tracker: lifetime campaign reporting, additive to existing pages. */
(() => {
  'use strict';
  const tabs = [
    ['all','All Campaigns'],['gta','GTA VI'],['of','OF Terms X Promo'],['article-rt','X Article Boosts'],
    ['guru','Guru X RTs'],['articles','X Articles'],['harness','AI Harness'],
    ['discord','Discord'],['other','Other Campaigns']
  ];
  // Paint the last verified report immediately, then refresh without clearing it.
  const validOverview=data=>data?.ok===true&&Array.isArray(data.campaigns)&&data.campaigns.length>0&&
    data.campaigns.every(c=>c&&typeof c==='object'&&typeof c.id==='string');
  const cachedOverview=window.XTrackerLastGood?.read('campaign-overview',validOverview);
  const validClicks=d=>d?.ok===true&&Number.isSafeInteger(d.total)&&d.total>=0&&Number.isSafeInteger(d.last7Days)&&d.last7Days>=0&&d.last7Days<=d.total;
  const validMembers=d=>d?.ok===true&&Array.isArray(d.history)&&d.latest&&Number.isSafeInteger(d.latest.memberCount)&&d.latest.memberCount>=0;
  const state={tab:'all',data:cachedOverview?.payload||null,loading:null,error:'',lastLoadAt:0,
    discordClicks:window.XTrackerLastGood?.read('discord-course-clicks',validClicks)?.payload||null,
    discordMembers:window.XTrackerLastGood?.read('discord-members',validMembers)?.payload||null,
    discordLoading:null,discordLastLoadAt:0,discordVisited:false};
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
  const hasFeed=c=>!!c&&c.source!=='NOT_CONNECTED'&&c.source!=='UNAVAILABLE'&&!c.unavailable;
  const published=c=>hasFeed(c)?format(c.published):'—';
  const viewStatus=c=>c?.source==='NOT_CONNECTED'?'No feed':c?.unavailable||c?.source==='UNAVAILABLE'?'Unavailable':c?.sourceStale||c?.dataWarning?'Saved data':'Connected';
  const badge=c=>'<span class="rpt-source rpt-source-'+(viewStatus(c)==='Connected'?'ok':viewStatus(c)==='Saved data'?'saved':'missing')+'">'+esc(viewStatus(c))+'</span>';
  const metric=(label,value,sub='')=>'<div class="rpt-stat"><dt>'+esc(label)+'</dt><dd>'+esc(value)+'</dd>'+(sub?'<small>'+esc(sub)+'</small>':'')+'</div>';
  const clicks=c=>c?.allTimeHumanClicks??c?.trackedClicks??null;
  const note='<p class="rpt-note">All-time X counters, not unique reach. Clicks come from their named tracking source and are not interchangeable. Missing sign-ups, KYC and earning-creator metrics are shown as unavailable, never zero.</p>';
  function grid(columns,rows,classname='rpt-table'){
    return '<div class="rpt-scroll"><table class="'+classname+'"><thead><tr>'+columns.map(c=>'<th scope="col">'+esc(c)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(cell=>'<td>'+cell+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
  }
  function empty(message){return '<div class="rpt-empty">'+esc(message)+'</div>';}
  function header(title,sub){
    return '<div class="rpt-section-title"><div><h2>'+esc(title)+'<span class="heading-accent">.</span></h2><p>'+esc(sub||'Lifetime campaign analytics')+'</p></div></div>';
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
    const unlinked=list().filter(c=>!hasFeed(c));
    const sourceNote=unlinked.length?'<p class="rpt-note"><strong>No verified campaign posts linked:</strong> '+
      esc(unlinked.map(c=>c.name).join(', '))+'. Their feeds are not connected; this does not prove that no posts exist. Other Campaigns is a grouping, not a separate post feed.</p>':'';
    return header('Campaign overview','All available campaigns · lifetime totals without date filters')+
      sourceNote+'<p class="rpt-note">Each source is shown separately to avoid double-counting shared campaigns and article views.</p>'+
      grid(['Campaign','Data source','Paid spend','Published','X views','Tracked clicks','Conversions'],list().map(c=>[
        '<button class="rpt-rowbutton" data-report-jump="'+esc(c.id.startsWith('gta-')?'gta':c.id==='of-terms'?'of':c.id==='article-rts'?'article-rt':c.id==='guru-rts'?'guru':c.id==='ai-harness'?'harness':c.id==='discord'?'discord':'articles')+'">'+esc(c.name)+'</button>',
        badge(c),usd(c.paidSpendKnown),published(c),hasFeed(c)?format(c.views):'—',hasFeed(c)?format(clicks(c)):'—','<span class="rpt-missing">Not connected</span>'
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
    return header(c.name,'No verified campaign posts linked · Source not connected')+badge(c)+
      '<div class="rpt-unconnected"><strong>No verified posts linked to this campaign</strong><p>'+
      esc(fields.join(' · '))+'</p><small>'+esc(reason)+'</small></div>'+
      '<p class="rpt-note">The source is not connected. This does not mean no posts exist. No estimated zeroes or fabricated figures are shown.</p>';
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
      case 'discord':return discordContent();
      case 'other':return header('Other activity','An overview category, not a separate post campaign')+
                        renderArticleGroups()+
                        '<p class="rpt-note">Other Campaigns has no dedicated post feed. Historical article groups above are sourced from the existing X Articles report. New campaigns appear once their verified source is connected.</p>';
      default:return renderOverview();
    }
  }
  function render(){
    const panel=el('reportingPanel'),status=el('reportingStatus'),heading=el('reportingTitle');
    if(!panel||!status)return;
    if(heading)heading.innerHTML=esc(tabs.find(([key])=>key===state.tab)?.[1]||'All Campaigns')+'<span class="heading-accent">.</span>';
    if(state.loading&&!state.data){status.textContent='Loading verified campaign feeds…';panel.innerHTML=empty('Loading data.');return;}
    status.textContent=state.error?(state.data?'Saved readings · '+state.error:'Feed unavailable · '+state.error):
      state.data?'Last checked '+date(state.data.checkedAt)+' · '+Object.values(state.data.sourceHealth||{}).filter(s=>s.ok).length+' connected feeds':'Not loaded';
    panel.innerHTML=state.data?content():empty(state.error||'Campaign report not loaded.');
  }
  async function load(force=false){
    if(state.loading)return state.loading;
    if(!force&&state.data&&Date.now()-state.lastLoadAt<45000){render();return true;}
    state.loading=(async()=>{
      try{
        const res=await fetch('/.netlify/functions/campaign-overview'+(force?'?refresh=1':''),{cache:'no-store',signal:AbortSignal.timeout(45000)});
        const data=await res.json();
        if(!res.ok||!validOverview(data))throw Error(data.error||'Campaign reporting temporarily unavailable');
        // A blank API response must never wipe a previously successful campaign report.
        state.data=data;state.error='';state.lastLoadAt=Date.now();
        window.XTrackerLastGood?.write('campaign-overview',data,validOverview);
        return Object.values(data.sourceHealth||{}).every(source=>source.ok)&&!data.campaigns.some(c=>c.dataWarning||c.sourceStale);
      }catch(e){state.error=txt(e.message||e);return false;}
      finally{state.loading=null;render();}
    })();
    // Render after state.loading is assigned, so direct links never say "Not loaded".
    queueMicrotask(render);
    return state.loading;
  }
  function changeTab(next){
    if(!tabs.some(([key])=>key===next))return;
    if(location.hash!=='#report-'+next){location.hash='report-'+next;return;}
    state.tab=next;render();
  }
  function init(){
    el('reportingPanel')?.addEventListener('click',event=>{
      const btn=event.target.closest('[data-report-jump]');if(btn)changeTab(btn.dataset.reportJump);
    });
    el('reportingRefreshButton')?.addEventListener('click',()=>{void load(true);});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&(location.hash==='#reporting'||location.hash.startsWith('#report-')))void load();});
    setInterval(()=>{if(!document.hidden&&(location.hash==='#reporting'||location.hash.startsWith('#report-')))void load();},120000);
    // app.js runs before this deferred module, so deep links need a first render here.
    // Without this, direct campaign URLs can remain stuck on the loading placeholder.
    const direct=location.hash.match(/^#report-(all|discord|gta|of|article-rt|guru|articles|harness|other)$/);
    if(direct||location.hash==='#reporting')window.XTrackerCampaignReporting?.show(direct?.[1]||'all');
  }
  window.XTrackerCampaignReporting={show:(selected='all')=>{state.tab=tabs.some(([key])=>key===selected)?selected:'all';render();void load();},reload:()=>load(true)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
