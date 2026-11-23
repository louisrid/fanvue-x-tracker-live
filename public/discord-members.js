/* Fanvue Academy members, daily 12:00 UK snapshots and growth history. */
(()=>{
  'use strict';
  const box=document.getElementById('discordMemberHistory');
  const chart=document.getElementById('discordMemberGrowth');
  if(!box||!chart)return;
  const amount=box.querySelector('[data-discord-members]');
  const change=box.querySelector('[data-discord-members-change]');
  const status=box.querySelector('[data-discord-members-status]');
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
      .sort((a,b)=>a.date.localeCompare(b.date)).slice(-60);
    chart.classList.toggle('is-pending',values.length<2);
    if(values.length<2){
      canvas.replaceChildren();
      canvas.setAttribute('aria-label','Waiting for two daily member count snapshots to draw the growth graph');
      note.textContent=values.length?'First snapshot recorded. Graph starts after tomorrow’s reading.':'Graph starts after two midday snapshots';
      tip.textContent='Daily snapshots at 12:00 UK';
      return;
    }
    const NS='http://www.w3.org/2000/svg',W=960,H=265,L=69,R=24,T=20,B=48;
    const lo=Math.min(...values.map(v=>v.memberCount)),hi=Math.max(...values.map(v=>v.memberCount));
    const range=Math.max(20,hi-lo),min=Math.max(0,lo-range*.22),max=hi+range*.22;
    const x=i=>L+(W-L-R)*i/(values.length-1);
    const y=n=>T+(H-T-B)*(max-n)/(max-min);
    const create=(tag,attrs={},textValue=null)=>{
      const el=document.createElementNS(NS,tag);
      for(const [name,value] of Object.entries(attrs))el.setAttribute(name,String(value));
      if(textValue!==null)el.textContent=String(textValue);
      return el;
    };
    const graph=create('svg',{viewBox:`0 0 ${W} ${H}`,role:'img',
      'aria-label':`Discord members, approximate counts, ${label(values[0].date)} to ${label(values.at(-1).date)}`});
    for(let i=0;i<4;i++){
      const val=min+(max-min)*i/3,yy=y(val);
      graph.append(create('line',{x1:L,x2:W-R,y1:yy,y2:yy,class:'discord-growth-grid'}));
      graph.append(create('text',{x:L-13,y:yy+4,'text-anchor':'end',class:'discord-growth-axis'},format(Math.round(val))));
    }
    const count=Math.min(values.length,5);
    const used=new Set();
    for(let k=0;k<count;k++){
      const i=Math.round(k*(values.length-1)/Math.max(1,count-1));
      if(used.has(i))continue;used.add(i);
      graph.append(create('text',{x:x(i),y:H-13,'text-anchor':i===0?'start':i===values.length-1?'end':'middle',class:'discord-growth-axis'},label(values[i].date)));
    }
    graph.append(create('polyline',{points:values.map((p,i)=>`${x(i)},${y(p.memberCount)}`).join(' '),
      class:'discord-growth-line',fill:'none'}));
    values.forEach((p,i)=>{
      const dot=create('circle',{cx:x(i),cy:y(p.memberCount),r:5,
        class:'discord-growth-dot',tabindex:'0',role:'img',
        'aria-label':`${label(p.date)}: ${format(p.memberCount)} approximate members`});
      dot.append(create('title',{},`${label(p.date)}: ${format(p.memberCount)} members`));
      const describe=()=>{tip.textContent=`${label(p.date)} · ${format(p.memberCount)} members`};
      dot.addEventListener('mouseenter',describe);
      dot.addEventListener('focus',describe);
      graph.append(dot);
    });
    canvas.replaceChildren(graph);
    tip.textContent=`${label(values.at(-1).date)} · ${format(values.at(-1).memberCount)} members`;
    note.textContent=`${values.length} daily snapshots · 12:00 UK · approximate Discord member counts`;
  }
  function display(data,fromCache=false){
    renderGrowth(data.history);
    const latest=data.latest;
    if(!latest){
      if(verified)return;
      amount.textContent='—';change.textContent='—';
      status.textContent='First reading scheduled for 12:00 UK time';
      return;
    }
    amount.textContent=format(latest.memberCount);
    change.textContent=Number.isSafeInteger(data.dailyChange)
      ?(data.dailyChange>0?'+':'')+format(data.dailyChange):'—';
    status.textContent=fromCache?'Saved midday reading · checking for updates':
      `Approximate · 12:00 UK · ${label(latest.date)}`;
    verified=true;
  }
  if(saved)display(saved,true);
  else renderGrowth([]);
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
          return;
        }
        if(!validMembers(data))throw Error('Incomplete snapshot');
        if(saved?.latest?.date&&data.latest.date<saved.latest.date)throw Error('Older snapshot');
        saved=data;
        window.XTrackerLastGood?.write('discord-members',data,validMembers);
        display(data);
      }catch{
        if(!verified){amount.textContent='—';change.textContent='—';}
        status.textContent=verified?'Last recorded value · refresh unavailable':'Member history temporarily unavailable';
        if(!verified)note.textContent='Graph temporarily unavailable';
      }
    })();
    try{await active;}finally{active=null;}
  }
  document.addEventListener('click',event=>{
    if(event.target.closest('#reloadAllButton,#refreshXStats,[data-refresh],[data-reload-all]'))void refresh();
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
  setInterval(()=>{if(!document.hidden)void refresh();},60000);
  void refresh();
})();
