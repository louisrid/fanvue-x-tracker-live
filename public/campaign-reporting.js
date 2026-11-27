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
    const titles={'guru-rts':'Boosted post views over time','x-articles':'Article views over time','article-rts':'Original X post views over time'};
    const count=rows.at(-1)?.series||0;
    const html=window.XTrackerMainChart.markup({rows,title:titles[campaign.id]||'Post views over time',
      context:campaign.id==='guru-rts'?'Guru X RTs':campaign.name,metric:'Total X views',unit:'views',
      note:count+' posts · organic views included'});
    return html?'<section class="rpt-main-trend rpt-main-trend-'+esc(campaign.id)+' xt-main-chart">'+html+'</section>':'';
  }
  const note='<p class="rpt-note">All-time X metrics. Missing readings stay unavailable.</p>';
  function grid(columns,rows,classname='rpt-table'){
    // The table enhancer adds accessible sortable column controls after every
    // render. Keep cell values as DOM text so it can sort numerically.
    return '<div class="rpt-scroll xt-table-scroll" tabindex="0" role="region" aria-label="Campaign data table"><table class="'+classname+'"><thead><tr>'+
      columns.map(c=>'<th scope="col"'+(c==='Details'?' data-no-sort-col="true"':'')+'>'+esc(c)+'</th>').join('')+'</tr></thead><tbody>'+
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
        metric('Boosted posts · all time',format(c.published)),
        metric('X views · all time',format(c.views)),
        metric('Interactions · all time',format(interactions),'Likes + RTs + replies'),
        metric('Engagement',engagement===null?'Not available':engagement.toFixed(2)+'%','Interactions ÷ views')
      ];
    }else if(c.id==='article-rts'){
      values=[
        metric('Paid RT spend · all time',usd(c.paidSpendKnown)),
        metric('Paid RT placements · all time',format(c.paidCount),'Includes pending'),
        metric('Published',format(c.published),'Sheet status'),
        metric('Original X views · all time',format(c.views),
          format(c.originalsWithViews)+' of '+format(c.originalPosts)+' source posts measured'),
        metric('Original interactions · all time',format(c.interactions),
          'Likes + RTs + replies'),
        metric('Avg. paid RT cost',usd(avgPaid),'Spend ÷ paid placements')
      ];
    }else{
      values=[
        metric('Spend · all time',usd(c.paidSpendKnown)),
        metric('Published posts · all time',hasFeed(c)?format(c.published):'Not connected'),
        metric('X views · all time',num(c.views)===null?'No verified X reading':format(c.views)),
        metric('Tracked clicks · all time',num(clicks(c))===null?'No connected click source':format(clicks(c)))
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
      '<strong>'+esc(r.publisher||r.name||r.handle||'Unnamed')+'</strong>',
      isArticleRt?(r.posted?'Marked posted':r.paid?'Paid · not marked posted':'Unconfirmed'):
        (r.posted?'Live':r.paid?'Pending':'Unconfirmed'),
      r.paid?usd(r.cost):'<span class="rpt-missing">Unpaid</span>',
      num(view(r))===null?'<span class="rpt-missing">'+(r.sourcePostUrl||r.postUrl?'X reading unavailable':'Original URL missing')+'</span>':esc(format(view(r))),
      num(r.allTimeClicks??r.clicks??null)===null?'<span class="rpt-missing">'+(r.trackingUrl?'Click feed unavailable':'No tracking link')+'</span>':
        esc(format(r.allTimeClicks??r.clicks??null)),linkCell(r)
    ]);
    return '<div class="result-line rpt-posts-heading"><h2>Posts<span class="heading-accent">.</span></h2><span class="section-count">'+
      format(isArticleRt?rows.length:rows.filter(r=>r.posted).length)+'</span></div>'+
      grid(cols,rendered);
  }
  function overview(c){
    return '<div class="rpt-overview">'+trendChart(c)+totals(c)+'</div>';
  }
  function campaignPanel(id,sub){
    const c=item(id);
    if(!c)return empty('Campaign feed unavailable.');
    const scope=id==='x-articles'
      ?'<p class="rpt-scope-note">All-time totals · 5-day chart</p>'
      :id==='article-rts'
        ?'<p class="rpt-scope-note">All paid RTs included. Source X views include organic traffic.</p>'
        :'';
    const rows=c.unavailable?empty('Source unavailable'):campaignRows(c);
    const content=id==='article-rts'?'<div class="rpt-data-layout">'+paidArticleRtGroups(c,true)+
      '<section class="rpt-post-list">'+rows+'</section></div>':rows;
    return '<section class="rpt-campaign-panel">'+
      (viewStatus(c)==='Connected'?'':badge(c))+
      scope+overview(c)+content+
      (c.trackingWarning?'<p class="rpt-warning">'+esc(c.trackingWarning)+'</p>':'')+
      (c.dataWarning?'<p class="rpt-warning">'+esc(c.dataWarning)+'</p>':'')+'</section>';
  }
  function paidArticleRtGroups(c,compact=false){
    const groups=c?.articleRtGroups||[],unlinked=c?.articleRtUnlinked||[],
      summary=c?.articleRtSummary;
    if(!summary||num(summary.paidSpendKnown)===null)return '';
    const used=groups.filter(g=>num(g.paidCount)!==null&&g.paidCount>0);
    const pct=v=>num(v)===null?'—':Number(v).toFixed(2)+'%';
    const title='Linked X posts';
    const linked=used.length?grid(
      ['Original X post','Original X views','Paid RTs','Paid RT spend','Interactions','Details'],
      used.map(g=>{
        const placements=(g.placements||[]).map(p=>
          '<li><strong>@'+esc(p.publisher)+'</strong><span>'+esc(usd(p.cost))+'</span>'+
          '<span>'+(p.posted?'Marked published':'Not marked published')+'</span>'+
          '<span>'+link(p.profileUrl,'Profile')+'</span></li>').join('');
        const detail='<details class="rpt-source-detail" title="Original X updated '+esc(date(g.metricAt))+'"><summary>Details</summary>'+
          '<div class="rpt-source-detail-body">'+
          '<dl><div><dt>Likes</dt><dd>'+esc(format(g.likes))+'</dd></div>'+
          '<div><dt>Reposts</dt><dd>'+esc(format(g.reposts))+'</dd></div>'+
          '<div><dt>Replies</dt><dd>'+esc(format(g.replies))+'</dd></div>'+
          '<div><dt>Engagement</dt><dd>'+esc(pct(g.engagementRate))+'</dd></div></dl>'+
          
          '<h4>Paid RT publishers</h4><ul>'+placements+'</ul></div></details>';
        return [
          '<strong>'+esc('@'+(g.postUrl?.split('/')[3]||'X post'))+'</strong>'+
            '<small class="rpt-rowmeta">'+link(g.postUrl,'View on X')+'</small>',
          esc(format(g.views)),esc(format(g.paidCount)),
          esc(usd(g.paidSpendKnown))+
            (g.unknownPaidCosts?' <small class="rpt-rowmeta">Partial</small>':''),
          esc(format(g.interactions)),detail
        ];
      })
    ):'<p class="rpt-note">No verified original X post links are available for paid RTs.</p>';
    const unmatched=unlinked.length?
      '<details class="rpt-unlinked-detail"><summary>'+esc(format(unlinked.length))+
      ' paid RTs still need original-post links · '+esc(usd(summary.unlinkedPaidSpendKnown))+
      '</summary>'+
      grid(['Paid RT publisher','Spend','Sheet row','Profile'],
        unlinked.map(p=>[
          '<strong>'+esc(p.publisher)+'</strong>',
          esc(usd(p.cost)),esc(format(p.sourceRow)),link(p.profileUrl,'View profile')
        ]))+'</details>':'';
    return '<section class="rpt-rt-source-summary rpt-source-compact">'+
      header(title)+
      '<p class="rpt-note">'+esc(format(summary.paidCount))+' paid RTs · '+
      esc(usd(summary.paidSpendKnown))+' spend · '+
      esc(format(used.length))+' linked posts. Source views include organic traffic.</p>'+
      linked+unmatched+'</section>';
  }
  function guruContent(){
    const c=item('guru-rts');
    if(!c)return empty('X RT boost feed is unavailable.');
    const rows=c.rows||[];
    const percent=v=>num(v)===null?'Not available':new Intl.NumberFormat('en-GB',{minimumFractionDigits:1,maximumFractionDigits:2}).format(Number(v))+'%';
    const summary=(viewStatus(c)==='Connected'?'':badge(c))+overview(c);
    const linked=paidArticleRtGroups(c);
    const related=linked?'<details class="rpt-related"><summary>Linked paid RTs</summary>'+linked+'</details>':'';
    if(!rows.length)return summary+related+empty('No verified boosted original X tweets currently recorded.');
    const missingSpend=rows.filter(r=>num(r.spend)===null).length;
    const spendNote=missingSpend
      ?'<p class="rpt-note">Ad boost spend missing for '+esc(format(missingSpend))+'/'+esc(format(rows.length))+' posts. RT payments are separate.</p>'
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
    const connection='<p class="rpt-note">Discord First Earnings has no connected campaign feed.</p>';
    return header('Fanvue AI Creator Academy','Verified Discord button clicks and daily server snapshots')+
      counters+'<p class="rpt-note">Member growth needs two daily snapshots.</p>'+
      connection;
  }
  async function refreshDiscordMetrics(force=false,onProgress){
    if(state.discordLoading)return state.discordLoading;
    if(!force&&state.discordLastLoadAt&&Date.now()-state.discordLastLoadAt<60000)return true;
    state.discordVisited=true;
    state.discordLoading=(async()=>{
      const endpoints=[
        ['discord-course-clicks','discordClicks','discord-course-clicks',validClicks],
        ['discord-members','discordMembers','discord-members',validMembers]
      ];
      let completed=0;
      const results=await Promise.allSettled(endpoints.map(([endpoint,field,key,valid])=>(async()=>{
        const res=await fetch('/.netlify/functions/'+endpoint,{cache:'no-store',signal:AbortSignal.timeout(12000)});
        if(!res.ok)throw Error('Discord source unavailable');
        const data=await res.json();
        if(!valid(data))throw Error('Incomplete Discord source');
        if(field==='discordMembers'&&state.discordMembers?.latest?.date&&
           data.latest.date<state.discordMembers.latest.date)throw Error('Older member snapshot');
        if(field==='discordClicks'&&state.discordClicks&&state.discordClicks.source===data.source&&
           data.total<state.discordClicks.total)throw Error('Older click total');
        state[field]=data;
        window.XTrackerLastGood?.write(key,data,valid);
      })().finally(()=>{completed++;if(typeof onProgress==='function')onProgress({completed,total:endpoints.length,label:'Refreshing Discord sources…'});})));
      state.discordLastLoadAt=Date.now();state.discordError=results.some(x=>x.status!=='fulfilled');
      if(state.tab==='discord')render();
      window.dispatchEvent(new Event('xtracker:discord'));
      return results.every(x=>x.status==='fulfilled');
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
    status.textContent=state.error?(state.data?'Saved data · refresh failed':'Data unavailable'):'';
    status.title=state.data?'Last checked '+date(state.data.checkedAt):'';
    panel.innerHTML=state.data?content():empty(state.error||'Loading…');
  }
  async function load(force=false,{reuseReports=false}={}){
    if(state.loading)return state.loading;
    if(!force&&state.data&&Date.now()-state.lastLoadAt<45000){render();return !state.error&&!state.data.stale&&Object.values(state.data.sourceHealth||{}).every(s=>s.ok)&&!state.data.campaigns.some(c=>c.dataWarning||c.sourceStale);}
    state.loading=(async()=>{
      try{
        let data;
        for(let attempt=0;attempt<2;attempt++){
          try{
            const res=await fetch('/.netlify/functions/campaign-overview'+(force&&!attempt?'?refresh=1'+(reuseReports?'&reuse=1':''):''),{cache:'no-store',signal:AbortSignal.timeout(45000)});
            data=await res.json();
            if(!res.ok||!validOverview(data))throw Object.assign(Error(data?.error||'Campaign reporting temporarily unavailable'),{permanent:!res.ok&&res.status<500&&![408,429].includes(res.status)});
            break;
          }catch(e){if(e.permanent||attempt===1)throw e;await new Promise(resolve=>setTimeout(resolve,500));}
        }
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
        return !data.stale&&Object.values(data.sourceHealth||{}).every(source=>source.ok)&&!safe.campaigns.some(c=>c.dataWarning||c.sourceStale);
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
    reload:options=>load(true,options),
    ensure:()=>load(),
    getCampaign:id=>item(id),
    // Read-only accessors for the redesigned shell (fanvue-app.js).
    getData:()=>state.data,
    status:()=>({loading:Boolean(state.loading),error:state.error,lastLoadAt:state.lastLoadAt}),
    discord:()=>({members:state.discordMembers,clicks:state.discordClicks,loading:Boolean(state.discordLoading),error:Boolean(state.discordError)}),
    refreshDiscord:(force=false,onProgress)=>refreshDiscordMetrics(force,onProgress)
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
