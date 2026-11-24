/* Discord Academy free-course clicks: independent of X campaign and Short.io totals. */
(()=>{
  'use strict';
  const output=document.getElementById('discordCourseClicks');
  if(!output)return;
  const total=output.querySelector('[data-discord-course-total]');
  const week=output.querySelector('[data-discord-course-week]');
  const info=output.querySelector('[data-discord-course-status]');
  const cardTotal=document.querySelector('[data-discord-card-total]');
  const cardWeek=document.querySelector('[data-discord-card-week]');
  const dashboardClicks=document.querySelector('[data-discord-pill-clicks]');
  const courseNote=document.querySelector('[data-discord-course-note]');
  function syncDisplays(){
    if(cardTotal)cardTotal.textContent=total.textContent;
    if(cardWeek)cardWeek.textContent=week.textContent;
    if(courseNote)courseNote.textContent=info.textContent;
    if(dashboardClicks)dashboardClicks.textContent=total.textContent==='—'?'Clicks unavailable':total.textContent+' course clicks';
  }
  const validClicks=data=>data?.ok===true&&Number.isSafeInteger(data.total)&&data.total>=0&&
    Number.isSafeInteger(data.last7Days)&&data.last7Days>=0&&data.last7Days<=data.total;
  let last=window.XTrackerLastGood?.read('discord-course-clicks',validClicks)?.payload||null;
  let pending=null;
  function display(saved){
    total.textContent=saved.total.toLocaleString('en-GB');
    week.textContent=saved.last7Days.toLocaleString('en-GB');
    info.textContent='';
    output.dataset.source='ready';
    syncDisplays();
  }
  if(last)display(last);
  syncDisplays();
  async function refresh(){
    if(pending)return pending;
    pending=(async()=>{
      try{
        const response=await fetch('/.netlify/functions/discord-course-clicks',{cache:'no-store',signal:AbortSignal.timeout(12000)});
        const data=await response.json();
        if(!response.ok||!validClicks(data))throw Error('Unavailable');
        // The total is append-only for this source. A lower reading is not a valid replacement.
        if(last?.source===data.source&&data.total<last.total)throw Error('Incomplete source total');
        last=data;
        window.XTrackerLastGood?.write('discord-course-clicks',data,validClicks);
        display(data);
        info.textContent='';
        syncDisplays();
        return true;
      }catch(error){
        // Never replace an unavailable measurement with a made-up zero.
        if(output.dataset.source!=='ready'){
          total.textContent='—';week.textContent='—';
        }
        info.textContent=output.dataset.source==='ready'?'Last verified count · refresh unavailable':'Click data temporarily unavailable';
        syncDisplays();
        return false;
      }
    })();
    try{return await pending;}finally{pending=null;}
  }
  document.addEventListener('click',event=>{
    if(event.target.closest('#reloadAllButton,#refreshXStats,[data-refresh],[data-reload-all]'))void refresh();
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
  setInterval(()=>{if(!document.hidden)void refresh();},60000);
  window.XTrackerDiscordCourse={refresh};
  void refresh();
})();
