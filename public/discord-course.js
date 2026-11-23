/* Discord Academy free-course clicks: independent of X campaign and Short.io totals. */
(()=>{
  'use strict';
  const output=document.getElementById('discordCourseClicks');
  if(!output)return;
  const total=output.querySelector('[data-discord-course-total]');
  const week=output.querySelector('[data-discord-course-week]');
  const info=output.querySelector('[data-discord-course-status]');
  let pending=null;
  async function refresh(){
    if(pending)return pending;
    pending=(async()=>{
      try{
        const response=await fetch('/.netlify/functions/discord-course-clicks',{cache:'no-store',signal:AbortSignal.timeout(12000)});
        const data=await response.json();
        if(!response.ok||!data.ok||!Number.isSafeInteger(data.total)||!Number.isSafeInteger(data.last7Days))throw Error('Unavailable');
        total.textContent=data.total.toLocaleString('en-GB');
        week.textContent=data.last7Days.toLocaleString('en-GB');
        info.textContent='Clicks recorded since dashboard tracking was connected';
        output.dataset.source='ready';
      }catch(error){
        // Never replace an unavailable measurement with a made-up zero.
        if(output.dataset.source!=='ready'){
          total.textContent='—';week.textContent='—';
        }
        info.textContent=output.dataset.source==='ready'?'Last verified count · refresh unavailable':'Click data temporarily unavailable';
      }
    })();
    try{await pending;}finally{pending=null;}
  }
  document.addEventListener('click',event=>{
    if(event.target.closest('#reloadAllButton,#refreshXStats,[data-refresh],[data-reload-all]'))void refresh();
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
  setInterval(()=>{if(!document.hidden)void refresh();},60000);
  void refresh();
})();
