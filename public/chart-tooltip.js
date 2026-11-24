(()=>{
  'use strict';
  if(window.XTrackerChartTooltip)return;

  const style=document.createElement('style');
  style.id='xtracker-chart-tooltip-style';
  style.textContent=`
    .xtracker-chart-tooltip{
      position:fixed;z-index:10050;display:none;min-width:190px;max-width:min(280px,calc(100vw - 24px));
      padding:13px 14px 12px;border:1px solid #3c424b;border-radius:13px;
      background:#24282f;color:#fff;box-shadow:0 14px 34px rgba(7,10,15,.28);
      font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      pointer-events:none;transform:translateZ(0);
    }
    .xtracker-chart-tooltip.is-visible{display:block}
    .xtracker-chart-tooltip.is-pinned{pointer-events:auto}
    .xtracker-chart-tooltip-kicker{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:4px}
    .xtracker-chart-tooltip-title{min-width:0;color:#f3f5f8;font-size:10px;line-height:1.15;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
    .xtracker-chart-tooltip-pin{display:none;color:#aeb6c3;font-size:9px;font-weight:850;letter-spacing:.05em;text-transform:uppercase}
    .xtracker-chart-tooltip.is-pinned .xtracker-chart-tooltip-pin{display:inline}
    .xtracker-chart-tooltip-date{margin:0 0 10px;color:#fff;font-size:15px;line-height:1.15;font-weight:950;letter-spacing:-.025em}
    .xtracker-chart-tooltip-grid{display:grid;gap:8px}
    .xtracker-chart-tooltip-metric{display:flex;align-items:baseline;justify-content:space-between;gap:16px;min-width:0}
    .xtracker-chart-tooltip-metric span{color:#d1d5dd;font-size:13px;line-height:1.2;font-weight:700}
    .xtracker-chart-tooltip-metric strong{overflow:hidden;text-overflow:ellipsis;color:#fff;font-size:15px;line-height:1.2;font-weight:900;font-variant-numeric:tabular-nums}
    [data-chart-point]{cursor:pointer;outline:none;transition:r .12s ease,filter .12s ease,stroke-width .12s ease}
    [data-chart-point]:hover,[data-chart-point]:focus{filter:brightness(1.05)}
    @media(max-width:460px){.xtracker-chart-tooltip{min-width:180px;padding:12px}}
  `;
  document.head.append(style);

  const tooltip=document.createElement('div');
  tooltip.className='xtracker-chart-tooltip';
  tooltip.setAttribute('role','dialog');
  tooltip.setAttribute('aria-live','polite');
  tooltip.innerHTML='<div class="xtracker-chart-tooltip-kicker"><span class="xtracker-chart-tooltip-title"></span><span class="xtracker-chart-tooltip-pin">Pinned</span></div><div class="xtracker-chart-tooltip-date"></div><div class="xtracker-chart-tooltip-grid"></div>';
  document.body.append(tooltip);

  let active=null,pinned=false,hideTimer=null;
  const HIDE_DELAY=2000;

  const safeMetrics=el=>{
    try{
      const raw=decodeURIComponent(el.dataset.chartMetrics||'');
      const parsed=JSON.parse(raw);
      return Array.isArray(parsed)?parsed.filter(x=>x&&x.label&&x.value!==undefined&&x.value!==null&&String(x.value)!==''): [];
    }catch{return []}
  };
  const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function summaryMetrics(el){
    const metrics=safeMetrics(el);
    if(metrics.length<2)return metrics;
    const secondary=metrics.slice(1);
    const detail=secondary.find(m=>/change/i.test(m.label))
      ||secondary.find(m=>/engagement|clicks/i.test(m.label))||secondary[0];
    return [metrics[0],detail];
  }
  function cancelHide(){
    clearTimeout(hideTimer);hideTimer=null;
  }
  function scheduleHide(){
    if(pinned)return;
    cancelHide();
    hideTimer=setTimeout(()=>hide(),HIDE_DELAY);
  }

  function position(){
    if(!active||!tooltip.classList.contains('is-visible'))return;
    const rect=active.getBoundingClientRect();
    const tw=tooltip.offsetWidth,th=tooltip.offsetHeight,gap=12,pad=10;
    let left=rect.left+rect.width/2-tw/2;
    left=Math.max(pad,Math.min(window.innerWidth-tw-pad,left));
    let top=rect.top-th-gap;
    if(top<pad)top=rect.bottom+gap;
    if(top+th>window.innerHeight-pad)top=Math.max(pad,window.innerHeight-th-pad);
    tooltip.style.left=Math.round(left)+'px';
    tooltip.style.top=Math.round(top)+'px';
  }
  function show(el,{pin=false}={}){
    if(!el)return;
    cancelHide();
    pinned=pin||(pinned&&active===el);active=el;
    const metrics=summaryMetrics(el);
    tooltip.querySelector('.xtracker-chart-tooltip-title').textContent=el.dataset.chartTitle||'Chart point';
    tooltip.querySelector('.xtracker-chart-tooltip-date').textContent=el.dataset.chartDate||'';
    tooltip.querySelector('.xtracker-chart-tooltip-grid').innerHTML=metrics.map(m=>
      '<div class="xtracker-chart-tooltip-metric"><span>'+escapeHtml(m.label)+'</span><strong>'+escapeHtml(m.value)+'</strong></div>'
    ).join('');
    tooltip.classList.add('is-visible');
    tooltip.classList.toggle('is-pinned',pinned);
    requestAnimationFrame(position);
  }
  function hide(force=false){
    if(pinned&&!force)return;
    cancelHide();
    active=null;pinned=false;
    tooltip.classList.remove('is-visible','is-pinned');
  }
  function pointFromEvent(e){return e.target?.closest?.('[data-chart-point]')||null}

  document.addEventListener('pointerover',e=>{
    if(e.pointerType==='touch')return;
    const el=pointFromEvent(e);if(!el||pinned)return;
    show(el);
  });
  document.addEventListener('pointerout',e=>{
    if(e.pointerType==='touch'||pinned)return;
    const el=pointFromEvent(e);if(!el)return;
    if(e.relatedTarget&&el.contains(e.relatedTarget))return;
    scheduleHide();
  });
  document.addEventListener('focusin',e=>{const el=pointFromEvent(e);if(el&&!pinned)show(el)});
  document.addEventListener('focusout',e=>{if(pointFromEvent(e)&&!pinned)scheduleHide()});
  document.addEventListener('click',e=>{
    const el=pointFromEvent(e);
    if(el){
      e.stopPropagation();
      if(pinned&&active===el)hide(true);
      else{pinned=true;show(el,{pin:true})}
      return;
    }
    if(pinned&&!tooltip.contains(e.target))hide(true);
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape')hide(true)});
  window.addEventListener('resize',position,{passive:true});
  window.addEventListener('hashchange',()=>hide(true));
  window.addEventListener('scroll',()=>{if(pinned)position();else hide(true)},{passive:true,capture:true});

  window.XTrackerChartTooltip={show,hide,position};
})();
