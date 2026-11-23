/* Fanvue X Tracker: lifetime campaign reporting, additive to existing pages. */
(() => {
  'use strict';
  const tabs = [['article-rt','X Article Boosts'],['guru','Guru X RTs'],['articles','X Articles']];
  // Paint the last verified report immediately, then refresh without clearing it.
  const validOverview=data=>data?.ok===true&&Array.isArray(data.campaigns)&&data.campaigns.length>0&&
    data.campaigns.every(c=>c&&typeof c==='object'&&typeof c.id==='string');
  const cachedOverview=window.XTrackerLastGood?.read('campaign-overview',validOverview);
  const validClicks=d=>d?.ok===true&&Number.isSafeInteger(d.total)&&d.total>=0&&Number.isSafeInteger(d.last7Days)&&d.last7Days>=0&&d.last7Days<=d.total;
  const validMembers=d=>d?.ok===true&&Array.isArray(d.history)&&d.latest&&Number.isSafeInteger(d.latest.memberCount)&&d.latest.memberCount>=0;
  const state={tab:'article-rt',data:cachedOverview?.payload||null,loading:null,error:'',lastLoadAt:0,
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
  function header(title){
    return '<div class="rpt-section-title"><h2>'+esc(title)+'</h2></div>';
  }
  function totals(c){
    if(!c)return '';
    return '<dl class="rpt-stats">'+[
      metric('Spend',usd(c.paidSpendKnown)),
      metric('Live posts',hasFeed(c)?format(c.published):'—'),
      metric('Views',format(c.views)),
      metric('Clicks',format(clicks(c)))
    ].join('')+'</dl>';
  }
  function campaignRows(c){
    const rows=c?.rows||[];
    if(!rows.length)return empty(c?.unavailable?'This campaign has no connected, verified placement feed yet.':'No placements found in the connected source.');
    const view=r=>r.views??r.xViews;
    const sourceLink=r=>r.postUrl?link(r.postUrl,'X post'):r.profileUrl?link(r.profileUrl,'X profile'):link('', 'X');
    const linkCell=r=>'<span class="rpt-links">'+sourceLink(r)+(r.trackingUrl?' · '+link(r.trackingUrl,'Tracking'): '')+'</span>';
    return grid(['Publisher','Status','Spend','Views','Clicks','Links'],rows.map(r=>[
      '<strong>'+esc(r.publisher||r.name||r.handle||'Unnamed')+'</strong>',
      r.posted?'Live':r.paid?'Pending':'Unconfirmed',
      r.paid?usd(r.cost):'—',esc(format(view(r))),
      esc(format(r.allTimeClicks??r.clicks??null)),linkCell(r)
    ]));
  }
  function campaignPanel(id,sub){
    const c=item(id);
    if(!c)return empty('Campaign feed unavailable.');
    return '<section class="rpt-campaign-panel">'+
      (viewStatus(c)==='Connected'?'':badge(c))+
      totals(c)+(c.unavailable?empty('Source unavailable'):campaignRows(c))+
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
    return header('Campaigns')+
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
    const summary=(viewStatus(c)==='Connected'?'':badge(c))+totals(c);
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
    );
  }
  function discordContent(){
    const course=state.discordClicks,members=state.discordMembers;
    const latest=members?.latest||null;
    const snapshot=latest&&Number.isSafeInteger(latest.memberCount)?format(latest.memberCount):'—';
    const daily=members&&Number.isSafeInteger(members.dailyChange)?
      (members.dailyChange>0?'+':'')+format(members.dailyChange):'—';
    const counters='<dl class="rpt-stats">'+[
      metric('Free-course button clicks',course?format(course.total):'—',course?'Recorded since click tracking began':'Waiting for verified click data'),
      metric('Course clicks · 7 days',course?format(course.last7Days):'—','Same tracked Discord button'),
      metric('Approx. server members',snapshot,latest?'Midday '+esc(latest.date)+' · UK time':'First midday snapshot not yet available'),
      metric('Daily member change',daily,'Compared with previous midday reading')
    ].join('')+'</dl>';
    const connection='<p class="rpt-note"><strong>Discord First Earnings:</strong> no verified campaign posts linked. '+
      'The creator sign-up, KYC and first-earnings feeds are not connected. This does not prove no posts exist.</p>';
    return header('Fanvue AI Creator Academy','Verified Discord button clicks and daily server snapshots')+
      counters+'<p class="rpt-note">Member counts are approximate. The daily history graph is on the Dashboard and starts after two recorded midday snapshots.</p>'+
      connection;
  }
  async function refreshDiscordMetrics(force=false){
    if(state.discordLoading)return state.discordLoading;
    if(!force&&state.discordLastLoadAt&&Date.now()-state.discordLastLoadAt<60000)return true;
    state.discordVisited=true;
    state.discordLoading=(async()=>{
      const endpoints=[
        ['discord-course-clicks','discordClicks','discord-course-clicks',validClicks],
        ['discord-members','discordMembers','discord-members',validMembers]
      ];
      const results=await Promise.allSettled(endpoints.map(async ([endpoint,field,key,valid])=>{
        const res=await fetch('/.netlify/functions/'+endpoint,{cache:'no-store',signal:AbortSignal.timeout(12000)});
        if(!res.ok)throw Error('Discord source unavailable');
        const data=await res.json();
        if(!valid(data))throw Error('Incomplete Discord source');
        if(field==='discordMembers'&&state.discordMembers?.latest?.date&&
           data.latest.date<state.discordMembers.latest.date)throw Error('Older member snapshot');
        if(field==='discordClicks'&&state.discordClicks?.source===data.source&&
           data.total<state.discordClicks.total)throw Error('Older click total');
        state[field]=data;
        window.XTrackerLastGood?.write(key,data,valid);
      }));
      state.discordLastLoadAt=Date.now();
      if(state.tab==='discord')render();
      return results.some(x=>x.status==='fulfilled');
    })();
    try{return await state.discordLoading;}finally{state.discordLoading=null;}
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
      case 'article-rt':return campaignPanel('article-rts');
      case 'guru':return guruContent();
      case 'articles':return renderArticleGroups()+campaignPanel('x-articles');
      default:return empty('No report selected');
    }
  }
  function syncCampaignPillStatus(){
    const feeds={guru:'guru-rts','article-rt':'article-rts',articles:'x-articles'};
    for(const [tab,id] of Object.entries(feeds)){
      const link=document.querySelector('[data-campaign-report="'+tab+'"]');
      if(!link)continue;
      const data=item(id);
      const label=link.textContent.trim();
      const detail=data&&!hasFeed(data)?'Source unavailable':
        data&&hasFeed(data)&&Number.isSafeInteger(data.published)?format(data.published)+' live posts':'Updating';
      link.title=label+': '+detail;
      link.setAttribute('aria-label',label+'. '+detail);
    }
    const other=document.querySelector('[data-campaign-report="other"]');
    if(other){other.title='Other is a grouping, not a separate post feed';other.setAttribute('aria-label','Other Campaigns. Grouping only; no separate post feed');}
  }
  function render(){
    const panel=el('reportingPanel'),status=el('reportingStatus'),heading=el('reportingTitle');
    if(!panel||!status)return;
    if(heading)heading.innerHTML=esc(tabs.find(([key])=>key===state.tab)?.[1]||'All Campaigns')+'<span class="heading-accent">.</span>';
    syncCampaignPillStatus();

    if(state.loading&&!state.data){status.textContent='Loading…';panel.innerHTML=empty('Loading…');return;}
    status.textContent=state.error?(state.data?'Saved · refresh failed':'Unavailable'):
      state.data?'Updated '+date(state.data.checkedAt):'';
    panel.innerHTML=state.data?content():empty(state.error||'Loading…');
  }
  async function load(force=false){
    if(state.loading)return state.loading;
    if(!force&&state.data&&Date.now()-state.lastLoadAt<45000){render();return true;}
    state.loading=(async()=>{
      try{
        const res=await fetch('/.netlify/functions/campaign-overview'+(force?'?refresh=1':''),{cache:'no-store',signal:AbortSignal.timeout(45000)});
        const data=await res.json();
        if(!res.ok||!validOverview(data))throw Error(data.error||'Campaign reporting temporarily unavailable');
        // When a source fails, preserve that campaign's last verified rows.
        // Successful source updates, including legitimate removals, remain authoritative.
        const prior=new Map((state.data?.campaigns||[]).map(c=>[c.id,c]));
        const safe={...data,campaigns:data.campaigns.map(current=>{
          const saved=prior.get(current.id);
          const failure=current.unavailable||current.sourceStale||current.dataWarning||current.source==='UNAVAILABLE';
          if(failure&&hasFeed(saved)&&saved.rows?.length&&!current.rows?.length){
            return {...saved,sourceStale:true,dataWarning:'Source unavailable; showing last verified campaign posts'};
          }
          return current;
        })};
        state.data=safe;state.error='';state.lastLoadAt=Date.now();
        window.XTrackerLastGood?.write('campaign-overview',safe,validOverview);
        return Object.values(data.sourceHealth||{}).every(source=>source.ok)&&!safe.campaigns.some(c=>c.dataWarning||c.sourceStale);
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
    el('reportingRefreshButton')?.addEventListener('click',()=>{void window.XTrackerCampaignReporting?.reload?.();});
    document.addEventListener('visibilitychange',()=>{
      if(document.hidden)return;
      if(state.data||location.hash==='#reporting'||location.hash.startsWith('#report-'))void load();
      if(state.discordVisited)void refreshDiscordMetrics();
    });
    // Refresh all previously loaded campaign results, not just the visible category.
    // GET only; the live providers and paid refresh actions are not invoked.
    setInterval(()=>{
      if(document.hidden)return;
      if(state.data||location.hash==='#reporting'||location.hash.startsWith('#report-'))void load();
      if(state.discordVisited)void refreshDiscordMetrics();
    },90000);
    // app.js runs before this deferred module, so deep links need a first render here.
    // Without this, direct campaign URLs can remain stuck on the loading placeholder.
    const direct=location.hash.match(/^#report-(article-rt|guru|articles)$/);
    if(direct)window.XTrackerCampaignReporting?.show(direct[1]);
  }
  window.XTrackerCampaignReporting={
    show:(selected='article-rt')=>{
      state.tab=tabs.some(([key])=>key===selected)?selected:'article-rt';
      render();
      void load();
    },
    reload:()=>load(true)
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
