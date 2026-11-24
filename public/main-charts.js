/* Shared presentation for verified campaign and Discord history. */
(()=>{
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const format=v=>new Intl.NumberFormat('en-GB',{maximumFractionDigits:0}).format(v);
  const validDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'T12:00:00Z'));
  const stamp=d=>Date.parse(d+'T12:00:00Z');
  const day=d=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',timeZone:'UTC'}).format(stamp(d));
  const signed=v=>(v>0?'+':'')+format(v);
  function markup({rows=[],title,context,metric='Views',unit='views',note='',headingId='',days=5}={}){
    const unique=new Map();
    for(const row of rows){
      if(!row||!validDate(String(row.date))||row.value===null||row.value===undefined||row.value===''||!Number.isFinite(Number(row.value))||Number(row.value)<0)continue;
      unique.set(row.date,{...row,value:Number(row.value)});
    }
    const data=[...unique.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-days);
    if(data.length<2)return '';
    const first=data[0],last=data.at(-1);
    const compact=window.innerWidth<=640;
    const W=compact?520:900,H=238,L=compact?104:86,R=30,T=18,B=40,pw=W-L-R,ph=H-T-B;
    const lo=Math.min(...data.map(d=>d.value)),hi=Math.max(...data.map(d=>d.value));
    const span=Math.max(1,hi-lo),rawStep=span*1.3/3;
    const power=10**Math.floor(Math.log10(rawStep)),fraction=rawStep/power;
    const step=Math.max(1,(fraction<=1?1:fraction<=2?2:fraction<=5?5:10)*power);
    const floor=Math.max(0,Math.floor((lo-span*.15)/step)*step);
    const ceil=Math.max(floor+step,Math.ceil((hi+span*.15)/step)*step);
    const from=stamp(first.date),to=stamp(last.date);
    const x=d=>L+(stamp(d.date)-from)/(to-from)*pw;
    const y=v=>T+ph-(v-floor)/(ceil-floor)*ph;
    const grid=[];
    for(let v=floor;v<=ceil;v+=step){
      grid.push('<line class="xt-chart-grid" x1="'+L+'" x2="'+(W-R)+'" y1="'+y(v)+'" y2="'+y(v)+'"/>'+
        '<text class="xt-chart-axis" x="'+(L-12)+'" y="'+(y(v)+5)+'" text-anchor="end">'+esc(format(v))+'</text>');
    }
    const dates=data.filter((_,i)=>data.length<=5||i===0||i===data.length-1||i%Math.ceil(data.length/4)===0)
      .map(d=>'<text class="xt-chart-axis" x="'+x(d)+'" y="'+(H-10)+'" text-anchor="middle">'+esc(day(d.date))+'</text>').join('');
    const path=data.map((d,i)=>(i?'L':'M')+x(d).toFixed(1)+' '+y(d.value).toFixed(1)).join(' ');
    const points=data.map((d,i)=>{
      const previous=data[i-1];
      const delta=previous&&(!d.series||d.series===previous.series)?d.value-previous.value:null;
      const metrics=[{label:metric,value:format(d.value)},...(delta===null?[]:[{label:'Since previous reading',value:signed(delta)}])];
      const attrs=' tabindex="0" role="button" data-chart-point data-chart-title="'+esc(context||title)+'" data-chart-date="'+esc(day(d.date))+'" data-chart-metrics="'+encodeURIComponent(JSON.stringify(metrics))+'" aria-label="'+esc(day(d.date)+': '+format(d.value)+' '+unit)+'"';
      return '<g'+attrs+'><circle class="xt-chart-hit" cx="'+x(d)+'" cy="'+y(d.value)+'" r="'+(compact?42:16)+'"/>'+
        '<circle class="xt-chart-dot" cx="'+x(d)+'" cy="'+y(d.value)+'" r="4.5"/></g>';
    }).join('');
    const stable=!first.series||data.every(d=>d.series===first.series);
    const change=stable?signed(last.value-first.value)+' '+unit+(/daily/i.test(metric)?' vs ':' since ')+day(first.date):'Post coverage varies by date';
    return '<div class="xt-chart-head"><div class="xt-chart-copy"><span class="xt-chart-context">'+esc(context)+'</span><h2'+(headingId?' id="'+esc(headingId)+'"':'')+'>'+esc(title)+'</h2><p>'+esc(day(first.date)+' – '+day(last.date)+' · UK time')+'</p></div>'+
      '<div class="xt-chart-summary"><span>'+esc(metric)+'</span><strong>'+esc(format(last.value))+'</strong><small>'+esc(change)+'</small></div></div>'+
      '<div class="xt-chart-plot"><svg viewBox="0 0 '+W+' '+H+'" role="group" aria-label="'+esc(title+' · '+day(first.date)+' to '+day(last.date))+'">'+grid.join('')+
      '<path class="xt-chart-line" d="'+path+'"/>'+points+dates+'</svg></div>'+
      '<p class="xt-chart-note">'+esc(note)+'</p>';
  }
  function fitCharts(){
    const compact=window.innerWidth<=640,W=compact?520:900,L=compact?104:86,R=30;
    for(const svg of document.querySelectorAll('.xt-main-chart .xt-chart-plot svg')){
      const box=svg.getAttribute('viewBox').split(/\s+/),oldW=Number(box[2]);
      if(oldW===W||![520,900].includes(oldW))continue;
      const oldL=oldW===520?104:86;
      const project=value=>L+(Number(value)-oldL)/(oldW-oldL-R)*(W-L-R);
      for(const line of svg.querySelectorAll('.xt-chart-grid')){
        line.setAttribute('x1',L);line.setAttribute('x2',W-R);
      }
      for(const axis of svg.querySelectorAll('.xt-chart-axis'))
        axis.setAttribute('x',axis.getAttribute('text-anchor')==='end'?L-12:project(axis.getAttribute('x')));
      for(const point of svg.querySelectorAll('.xt-chart-dot,.xt-chart-hit')){
        point.setAttribute('cx',project(point.getAttribute('cx')));
        if(point.classList.contains('xt-chart-hit'))point.setAttribute('r',compact?42:16);
      }
      const dots=[...svg.querySelectorAll('.xt-chart-dot')];
      svg.querySelector('.xt-chart-line').setAttribute('d',dots.map((p,i)=>(i?'L':'M')+
        Number(p.getAttribute('cx')).toFixed(1)+' '+Number(p.getAttribute('cy')).toFixed(1)).join(' '));
      svg.setAttribute('viewBox','0 0 '+W+' '+box[3]);
    }
    window.XTrackerChartTooltip?.hide(true);
  }
  if(typeof window.matchMedia==='function')
    window.matchMedia('(max-width:640px)').addEventListener('change',fitCharts);
  window.XTrackerMainChart={markup};
})();
