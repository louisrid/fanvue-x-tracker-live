/* Fanvue Academy members, daily 12:00 UK snapshots and growth history. */
(()=>{
  'use strict';
  const box=document.getElementById('discordMemberHistory');
  const chart=document.getElementById('discordMemberGrowth');
  if(!box||!chart)return;
  const amount=box.querySelector('[data-discord-members]');
  const change=box.querySelector('[data-discord-members-change]');
  const status=box.querySelector('[data-discord-members-status]');
  const cardMembers=document.querySelector('[data-discord-card-members]');
  const cardChange=document.querySelector('[data-discord-card-change]');
  const dashboardMembers=document.querySelector('[data-discord-pill-count]');
  const memberNote=document.querySelector('[data-discord-member-note]');
  function syncDisplays(){
    if(cardMembers)cardMembers.textContent=amount.textContent;
    if(cardChange)cardChange.textContent=change.textContent;
    if(memberNote)memberNote.textContent=status.textContent;
    if(dashboardMembers)dashboardMembers.textContent=amount.textContent==='—'?'Members unavailable':amount.textContent+' members';
  }
  const canvas=chart.querySelector('[data-discord-chart]');
  const note=chart.querySelector('[data-discord-chart-note]');
  const tip=chart.querySelector('[data-discord-chart-tip]');
  const format=n=>new Intl.NumberFormat('en-GB',{maximumFractionDigits:0}).format(n);
  const label=d=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',timeZone:'UTC'})
    .format(new Date(d+'T12:00:00Z'));
  const validMembers=data=>data?.ok===true&&Array.isArray(data.history)&&
    data.latest&&Number.isSafeInteger(data.latest.memberCount)&&data.latest.memberCount>=0&&
    /^\d{4}-\d{2}-\d{2}$/.test(data.latest.date);
  let saved=window.XTrackerLastGood?.read('discord-members',validMembers)?.payload||null;
  let active=null,verified=false;
  function renderGrowth(history){
    const values=(Array.isArray(history)?history:[])
      .filter(p=>p&&/^\d{4}-\d{2}-\d{2}$/.test(p.date)&&Number.isSafeInteger(p.memberCount)&&p.memberCount>=0)
      .sort((a,b)=>a.date.localeCompare(b.date)).slice(-5);
    const html=window.XTrackerMainChart.markup({rows:values.map(p=>({date:p.date,value:p.memberCount})),
      title:'Discord members over time',context:'Fanvue AI Creator Academy',metric:'Total members',unit:'members',
      headingId:'discordGrowthTitle',note:'Approximate member totals. Daily snapshots at 12:00 UK.'});
    chart.classList.add('xt-main-chart');chart.classList.toggle('is-pending',!html);
    // Keep source hooks stable while giving the graph the same card as campaigns.
    for(const child of [...chart.children])if(child!==canvas)child.hidden=true;
    chart.querySelector('.discord-growth-heading h2')?.removeAttribute('id');
    canvas.className='';canvas.innerHTML=html;
    if(!html){
      chart.hidden=true;
      note.textContent=values.length?'First snapshot recorded. Waiting for a second daily reading.':'Waiting for two daily member snapshots';
    }else chart.hidden=false;
    tip.textContent='Daily snapshots at 12:00 UK';
  }

  function display(data,fromCache=false){
    renderGrowth(data.history);
    const latest=data.latest;
    if(!latest){
      if(verified)return;
      amount.textContent='—';change.textContent='—';
      status.textContent='First reading scheduled for 12:00 UK time';
      syncDisplays();
      return;
    }
    amount.textContent=format(latest.memberCount);
    change.textContent=Number.isSafeInteger(data.dailyChange)
      ?(data.dailyChange>0?'+':'')+format(data.dailyChange):'—';
    status.textContent=fromCache?'Saved Discord count · checking for updates':
      data.source==='DISCORD_BOT_LIVE'?`Live Discord count · ${label(latest.date)}`:`Midday snapshot · ${label(latest.date)}`;
    verified=true;
    syncDisplays();
  }
  if(saved)display(saved,true);
  else renderGrowth([]);
  syncDisplays();
  async function refresh(){
    if(active)return active;
    active=(async()=>{
      try{
        const response=await fetch('/.netlify/functions/discord-members',{cache:'no-store',signal:AbortSignal.timeout(12000)});
        const data=await response.json();
        if(!response.ok||data.ok!==true||!Array.isArray(data.history))throw Error('Unavailable');
        if(!data.latest){
          if(saved)throw Error('Latest snapshot unavailable');
          display(data);
          return false;
        }
        if(!validMembers(data))throw Error('Incomplete snapshot');
        if(saved?.latest?.date&&data.latest.date<saved.latest.date)throw Error('Older snapshot');
        saved=data;
        window.XTrackerLastGood?.write('discord-members',data,validMembers);
        display(data);
        return true;
      }catch{
        if(!verified){amount.textContent='—';change.textContent='—';}
        status.textContent=verified?'Last recorded value · refresh unavailable':'Member history temporarily unavailable';
        if(!verified)note.textContent='Graph temporarily unavailable';
        syncDisplays();
        return false;
      }
    })();
    try{return await active;}finally{active=null;}
  }
  document.addEventListener('click',event=>{
    if(event.target.closest('#reloadAllButton,#refreshXStats,[data-refresh],[data-reload-all]'))void refresh();
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
  setInterval(()=>{if(!document.hidden)void refresh();},60000);
  window.XTrackerDiscordMembers={refresh};
  void refresh();
})();
