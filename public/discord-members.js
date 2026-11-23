/* Daily Discord server member count, independent of paid X campaign analytics. */
(()=>{
  'use strict';
  const box=document.getElementById('discordMemberHistory');
  if(!box)return;
  const amount=box.querySelector('[data-discord-members]');
  const change=box.querySelector('[data-discord-members-change]');
  const status=box.querySelector('[data-discord-members-status]');
  let active=null,verified=false;
  async function refresh(){
    if(active)return active;
    active=(async()=>{
      try{
        const r=await fetch('/.netlify/functions/discord-members',{cache:'no-store',signal:AbortSignal.timeout(12000)});
        const result=await r.json();
        if(!r.ok||!result.ok)throw new Error('Unavailable');
        const latest=result.latest;
        if(!latest){
          status.textContent='First reading scheduled for 12:00 UK time';
          amount.textContent='—';change.textContent='—';return;
        }
        if(!Number.isSafeInteger(latest.memberCount)||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(latest.date))throw new Error('Invalid');
        amount.textContent=latest.memberCount.toLocaleString('en-GB');
        change.textContent=Number.isSafeInteger(result.dailyChange)
          ?(result.dailyChange>0?'+':'')+result.dailyChange.toLocaleString('en-GB'):'—';
        status.textContent='Approximate count · midday UK · '+latest.date.split('-').reverse().join('/');
        verified=true;
      }catch{
        if(!verified){amount.textContent='—';change.textContent='—';}
        status.textContent=verified?'Saved reading · update unavailable':'Member history temporarily unavailable';
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
