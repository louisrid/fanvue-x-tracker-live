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
  const metric=(label,value,sub='')=>{
    const colour=/^(Spend|Paid)/i.test(label)?'spend':/(Live|Published)/i.test(label)?'published':
      /Views/i.test(label)?'seven':/(Clicks)/i.test(label)?'shortio':'seven';
    return '<div class="daily-metric daily-metric-'+colour+' rpt-stat">'+
      '<span class="daily-metric-label">'+esc(label)+'</span><strong>'+esc(value)+'</strong>'+
      (sub?'<small>'+esc(sub)+'</small>':'')+'</div>';
  };
  const clicks=c=>c?.allTimeHumanClicks??c?.trackedClicks??null;
  const londonDay=value=>{
    const d=value instanceof Date?value:new Date(value);
    if(Number.isNaN(d.getTime()))return '';
    const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'})
      .formatToParts(d).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
    return p.year+'-'+p.month+'-'+p.day;
  };
  const shortDay=value=>new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',day:'numeric',month:'short'})
    .format(new Date(value+'T12:00:00Z'));
  function fiveDayViewSeries(campaign){
    const cutoff=londonDay(new Date(Date.now()-4*24*60*60*1000)),samples=[];
    const addSample=(series,h)=>{
      if(num(h.views)===null||!h.at)return;
      const date=londonDay(h.at);if(date<cutoff)return;
      samples.push({
        series,date,at:Date.parse(h.at),views:Number(h.views),
        likes:num(h.likes),
        reposts:num(h.reposts??h.shares),
        replies:num(h.replies??h.comments)
      });
    };
    if(campaign?.id==='guru-rts'){
      for(const row of campaign.rows||[])for(const h of row.history||[])
        addSample(String(row.id||row.handle||row.publisher),h);
    }else{
      for(const h of campaign?.history||[])
        addSample(String(h.code||h.postId||h.id||''),h);
    }
    const grouped=new Map();
    for(const s of samples){
      const key=s.date+'|'+s.series,prior=grouped.get(key);
      if(!prior||s.at>prior.at)grouped.set(key,s);
    }
    const days=new Map();
    const add=(row,key,value)=>{
      if(value===null||value===undefined)return;
      row[key]=(row[key]??0)+Number(value);
    };
    for(const s of grouped.values()){
      const row=days.get(s.date)||{date:s.date,views:0,likes:null,reposts:null,replies:null,series:0};
      row.views+=s.views;row.series++;
      add(row,'likes',s.likes);add(row,'reposts',s.reposts);add(row,'replies',s.replies);
      days.set(s.date,row);
    }
    const clickDays=new Map();
    for(const h of campaign?.clickHistory||[]){
      const date=String(h.date||'');if(date<cutoff||num(h.clicks)===null)continue;
      clickDays.set(date,(clickDays.get(date)||0)+Number(h.clicks));
    }
    for(const row of days.values()){
      if(clickDays.has(row.date))row.clicks=clickDays.get(row.date);
      const parts=[row.likes,row.reposts,row.replies].filter(v=>v!==null);
      row.interactions=parts.length?parts.reduce((a,b)=>a+b,0):null;
      row.engagement=row.views>0&&row.interactions!==null?row.interactions/row.views*100:null;
    }
    return [...days.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-5);
  }
  function trendChart(campaign){
    const rows=fiveDayViewSeries(campaign).map(d=>({...d,value:d.views}));
    const titles={'guru-rts':'Boosted post views over time','x-articles':'Article views over time','article-rts':'Article boost views over time'};
    const count=rows.at(-1)?.series||0;
    const html=window.XTrackerMainChart.markup({rows,title:titles[campaign.id]||'Post views over time',
      context:campaign.id==='guru-rts'?'Guru X RTs':campaign.name,metric:'Total X views',unit:'views',
      note:count+' posts with saved readings. Total views include organic exposure.'});
    return html?'<section class="rpt-main-trend rpt-main-trend-'+esc(campaign.id)+' xt-main-chart">'+html+'</section>':'';
  }
  const note='<p class="rpt-note">All-time X counters, not unique reach. Clicks come from their named tracking source and are not interchangeable. Missing sign-ups, KYC and earning-creator metrics are shown as unavailable, never zero.</p>';
  function grid(columns,rows,classname='rpt-table'){
    // The table enhancer adds accessible sortable column controls after every
    // render. Keep cell values as DOM text so it can sort numerically.
    return '<div class="rpt-scroll xt-table-scroll"><table class="'+classname+'"><thead><tr>'+
      columns.map(c=>'<th scope="col">'+esc(c)+'</th>').join('')+'</tr></thead><tbody>'+
      rows.map(row=>'<tr>'+row.map(cell=>'<td>'+cell+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
  }
  function empty(message){return '<div class="rpt-empty">'+esc(message)+'</div>';}
  function header(title){
    return '<div class="rpt-section-title"><h2>'+esc(title)+'</h2></div>';
  }
  function totals(c){
    if(!c)return '';
    const interactions=[c.likes,c.reposts,c.replies].every(v=>num(v)!==null)
      ?Number(c.likes)+Number(c.reposts)+Number(c.replies):null;
    const engagement=num(c.views)!==null&&Number(c.views)>0&&interactions!==null
      ?(interactions/Number(c.views))*100:null;
    const avgPaid=num(c.paidSpendKnown)!==null&&num(c.paidCount)!==null&&Number(c.paidCount)>0
      ?Number(c.paidSpendKnown)/Number(c.paidCount):null;

    let values;
    if(c.id==='guru-rts'){
      values=[
        metric('Live posts',format(c.published),'4 tracked boosted tweets'),
        metric('Views',format(c.views),'Combined X views'),
        metric('Interactions',format(interactions),'Likes + reposts + replies'),
        metric('Engagement',engagement===null?'Not available':engagement.toFixed(2)+'%','Interactions ÷ views')
      ];
    }else if(c.id==='article-rts'){
      values=[
        metric('Paid RT spend',usd(c.paidSpendKnown),'Verified from Article RTs Sheet'),
        metric('Paid RT placements',format(c.paidCount),'Paid accounts, independent of posting status'),
        metric('Marked published',format(c.published),'Source sheet POSTED? checkbox only'),
        metric('Original X views',format(c.views),
          format(c.originalsWithViews)+' of '+format(c.originalPosts)+' source posts measured'),
        metric('Original interactions',format(c.interactions),
          'Likes + reposts + replies on unique originals'),
        metric('Avg. paid RT cost',usd(avgPaid),'Spend ÷ paid placements')
      ];
    }else{
      values=[
        metric(c.id==='x-articles'?'Spend · all-time':'Spend',usd(c.paidSpendKnown),
          c.id==='x-articles'?(c.spendPeriod||'All tracked X Article placements'):''),
        metric('Live posts',hasFeed(c)?format(c.published):'Not connected'),
        metric('X views',num(c.views)===null?'No verified X reading':format(c.views)),
        metric('Tracked clicks',num(clicks(c))===null?'No connected click source':format(clicks(c)))
      ];
    }
    return '<div class="daily-overview-metrics campaign-metrics rpt-stats">'+values.join('')+'</div>';
  }
  function campaignRows(c){
    const rows=c?.rows||[];
    if(!rows.length)return empty(c?.unavailable?'This campaign has no connected, verified placement feed yet.':'No placements found in the connected source.');
    const isArticleRt=c.id==='article-rts';
    const view=r=>r.sourceOriginalViews??r.views??r.xViews;
    const sourceLink=r=>r.sourcePostUrl||r.postUrl?link(r.sourcePostUrl||r.postUrl,isArticleRt?'Original X post':'X post'):
      r.profileUrl?link(r.profileUrl,'Publisher profile'):'<span class="rpt-missing">Original X post not supplied</span>';
    const linkCell=r=>'<span class="rpt-links">'+sourceLink(r)+
      (r.profileUrl&&(r.sourcePostUrl||r.postUrl)?' · '+link(r.profileUrl,'Publisher'):'')+
      (r.trackingUrl?' · '+link(r.trackingUrl,'Tracking'):'')+'</span>';
    const cols=isArticleRt?
      ['Publisher','RT status','Paid RT spend','Original X views','Tracked clicks','Original X post / publisher']:
      ['Publisher','Status','Spend','X views','Clicks','Links'];
    const rendered=rows.map(r=>[
      '<strong>'+esc(r.publisher||r.name||r.handle||'Unnamed')+'</strong>'+
        (isArticleRt&&Number.isSafeInteger(r.sourceRow)?'<small class="rpt-rowmeta">Sheet row '+esc(r.sourceRow)+'</small>':''),
      isArticleRt?(r.posted?'Marked posted':r.paid?'Paid · not marked posted':'Unconfirmed'):
        (r.posted?'Live':r.paid?'Pending':'Unconfirmed'),
      r.paid?usd(r.cost):'<span class="rpt-missing">Unpaid</span>',
      num(view(r))===null?'<span class="rpt-missing">'+(r.sourcePostUrl||r.postUrl?'X reading unavailable':'Original URL missing')+'</span>':esc(format(view(r))),
      num(r.allTimeClicks??r.clicks??null)===null?'<span class="rpt-missing">'+(r.trackingUrl?'Click feed unavailable':'No tracking link')+'</span>':
        esc(format(r.allTimeClicks??r.clicks??null)),linkCell(r)
    ]);
    return (isArticleRt?'<p class="rpt-note"><strong>Original X views:</strong> unique source-post counters, not impressions attributable to paid RTs. Paid and posted statuses come directly from separate Sheet columns. Click tracking requires a per-placement UTM link.</p>':'')+
      '<div class="result-line rpt-posts-heading"><h2>Posts<span class="heading-accent">.</span></h2><span class="section-count">'+
      format(isArticleRt?rows.length:rows.filter(r=>r.posted).length)+'</span></div>'+
      grid(cols,rendered);
  }
  function campaignPanel(id,sub){
    const c=item(id);
    if(!c)return empty('Campaign feed unavailable.');
    const scope=id==='x-articles'
      ?'<p class="rpt-scope-note"><strong>Spend period:</strong> all-time across every tracked X Article placement currently in the tracker. It is not limited to the last 5 days shown in the graph.</p>'
      :id==='article-rts'
        ?'<p class="rpt-scope-note"><strong>Spend period:</strong> all paid article-retweet accounts recorded in the Sheet, not only those marked posted. Source-post statistics are the original X posts’ cumulative counters, not impressions caused by RT accounts.</p>'
        :'';
    return '<section class="rpt-campaign-panel">'+
      (viewStatus(c)==='Connected'?'':badge(c))+
      scope+trendChart(c)+totals(c)+(id==='article-rts'?paidArticleRtGroups(c,true):'')+
      (c.unavailable?empty('Source unavailable'):campaignRows(c))+
      (c.trackingWarning?'<p class="rpt-warning">'+esc(c.trackingWarning)+'</p>':'')+
      (c.dataWarning?'<p class="rpt-warning">'+esc(c.dataWarning)+'</p>':'')+'</section>';
  }
  function paidArticleRtGroups(c,compact=false){
    const groups=c?.articleRtGroups||[],unlinked=c?.articleRtUnlinked||[],
      summary=c?.articleRtSummary;
    if(!summary||num(summary.paidSpendKnown)===null)return '';
    const used=groups.filter(g=>num(g.paidCount)!==null&&g.paidCount>0);
    const percent=value=>num(value)===null?'—':
      Number(value).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';
    const stats=compact?'':'<div class="daily-overview-metrics campaign-metrics rpt-stats">'+[
      metric('Paid RT spend',usd(summary.paidSpendKnown),'Verified Sheet total; not ad boost spend'),
      metric('Paid RT accounts',format(summary.paidCount),'Paid source rows'),
      metric('Linked original posts',format(summary.originalPosts),'Grouped by original X status'),
      metric('Original X views',format(summary.originalViewsKnown),
        format(summary.originalsWithViews)+' source posts with verified readings'),
      metric('Original interactions',format(summary.originalInteractionsKnown),
        format(summary.originalsWithFullMetrics)+' source posts with complete engagement readings')
    ].join('')+'</div>';
    const top='<section class="rpt-rt-source-summary">'+
      header(compact?'Original X post performance':'Paid article retweets and their source posts')+
      stats+
      '<p class="rpt-note"><strong>Attribution:</strong> views, likes, reposts, replies and engagement below are recorded on the <strong>original X posts</strong> (organic reach included). They are NOT impressions or interactions generated by individual paid RTs. The paid RT account counts and spend are sourced separately from Google Sheets.</p>';
    const grouped=used.length?
      grid(['Original post','Paid RT accounts','Paid RT spend','Original views','Original likes',
        'Original reposts','Original replies','Original interactions','Original engagement','Last verified'],
        used.map(g=>[
          '<strong>'+esc(g.postUrl?.split('/')[3]||'Original post')+'</strong>'+
            '<small class="rpt-rowmeta">'+link(g.postUrl,'View source post')+'</small>',
          esc(format(g.paidCount)),
          esc(usd(g.paidSpendKnown))+
            (g.unknownPaidCosts?' <small class="rpt-rowmeta">Partial</small>':''),
          esc(format(g.views)),
          esc(format(g.likes)),
          esc(format(g.reposts)),
          esc(format(g.replies)),
          esc(format(g.interactions)),
          esc(percent(g.engagementRate)),
          esc(date(g.metricAt))
        ])):'<p class="rpt-note">No paid RT entries currently have a verified original-post URL.</p>';
    const details=used.map(g=>'<details class="rpt-expander"><summary><strong>'+
      esc(g.postUrl?.split('/')[3]||'Original post')+'</strong>'+
      '<span>'+esc(format(g.paidCount))+' paid accounts · '+esc(usd(g.paidSpendKnown))+
      ' · '+esc(format(g.views))+' original views</span></summary>'+
      '<p class="rpt-note"><strong>Source post:</strong> '+link(g.postUrl,'Open on X')+
      ' · <strong>Last measured:</strong> '+esc(date(g.metricAt))+
      ' · <strong>Source:</strong> '+esc(g.metricSource||'No verified X reading')+
      '. Per-account RT views cannot be inferred from these original-post counters.</p>'+
      grid(['Paid RT account','RT payment','Sheet posted status','Sheet row','Publisher profile'],
        (g.placements||[]).map(p=>[
          '<strong>'+esc(p.publisher)+'</strong>',
          esc(usd(p.cost)),
          p.posted?'Marked posted':'Paid · not marked posted',
          esc(format(p.sourceRow)),
          link(p.profileUrl,'Publisher profile')
        ]))+'</details>').join('');
    const unlinkedNote=unlinked.length?
      '<p class="rpt-warning"><strong>'+esc(format(unlinked.length))+' paid RT rows ('+
      esc(usd(summary.unlinkedPaidSpendKnown))+') have no original X post link.</strong> '+
      'Their verified payments are included in overall spend, but no original-post views are assigned to these accounts.</p>'+
      grid(['Paid RT account','RT payment','Source row','Publisher profile'],unlinked.map(p=>[
        '<strong>'+esc(p.publisher)+'</strong>',
        esc(usd(p.cost)),
        esc(format(p.sourceRow)),
        link(p.profileUrl,'Publisher profile')
      ])):'';
    return top+grouped+(details?'<div class="rpt-expanders">'+details+'</div>':'')+
      unlinkedNote+'</section>';
  }
  function guruContent(){
    const c=item('guru-rts');
    if(!c)return empty('X RT boost feed is unavailable.');
    const rows=c.rows||[];
    const percent=v=>num(v)===null?'Not available':new Intl.NumberFormat('en-GB',{minimumFractionDigits:1,maximumFractionDigits:2}).format(Number(v))+'%';
    const summary=(viewStatus(c)==='Connected'?'':badge(c))+trendChart(c)+totals(c);
    const related=paidArticleRtGroups(c);
    if(!rows.length)return summary+related+empty('No verified boosted original X tweets currently recorded.');
    const missingSpend=rows.filter(r=>num(r.spend)===null).length;
    const spendNote=missingSpend
      ?'<p class="rpt-note"><strong>Separate ad boost spend is not recorded for '+esc(format(missingSpend))+' of '+esc(format(rows.length))+' originals.</strong> Paid RT costs from Google Sheets are reported below, without confusing them with ad boost spend.</p>'
      :'';
    return summary+spendNote+
      '<div class="result-line rpt-posts-heading"><h2>Original X posts<span class="heading-accent">.</span></h2><span class="section-count">'+format(c.published)+'</span></div>'+
      grid(['Original tweet','Ad boost spend','Paid RT spend','Paid RT accounts','Original X views',
        'Original likes','Original reposts','Original replies','Original interactions',
        'Original engagement','Ad cost / 1K views','Views gained 24h','Live X link'],
        rows.map(r=>[
          '<strong>'+esc(r.name||r.publisher||r.handle)+'</strong><small class="rpt-rowmeta">@'+esc(r.handle||'')+'</small>',
          num(r.spend)===null?'<span class="rpt-missing">Not entered</span>':esc(usd(r.spend)),
          num(r.linkedRtPaidSpend)===null?'<span class="rpt-missing">No matched paid RTs</span>':esc(usd(r.linkedRtPaidSpend)),
          esc(format(r.linkedRtPaidCount)),
          esc(format(r.views)),
          esc(format(r.likes)),
          esc(format(r.reposts)),
          esc(format(r.replies)),
          esc(format([r.likes,r.reposts,r.replies].every(v=>num(v)!==null)?
            Number(r.likes)+Number(r.reposts)+Number(r.replies):null)),
          esc(percent(r.engagement)),
          num(r.efficiency)===null?'<span class="rpt-missing">Needs ad spend</span>':esc(usd(r.efficiency)),
          esc(format(r.growth24)),
          link(r.postUrl,'Open post')
        ]))+related;
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
      case 'articles':return campaignPanel('x-articles');
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
      finally{state.loading=null;render();window.dispatchEvent(new Event('xtracker:campaign-overview'));}
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
    el('reportingRefreshButton')?.addEventListener('click',async()=>{
      const button=el('reportingRefreshButton');
      if(!button||button.disabled)return;
      button.disabled=true;
      button.classList.add('is-refreshing');
      button.setAttribute('aria-busy','true');
      try{await window.XTrackerCampaignReporting?.reload?.();}
      finally{
        button.disabled=false;
        button.classList.remove('is-refreshing');
        button.removeAttribute('aria-busy');
      }
    });
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
    else if(location.hash==='#x-rts')void load();
  }
  window.XTrackerCampaignReporting={
    show:(selected='article-rt')=>{
      state.tab=tabs.some(([key])=>key===selected)?selected:'article-rt';
      render();
      void load();
    },
    reload:()=>load(true),
    ensure:()=>load(),
    getCampaign:id=>item(id)
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
