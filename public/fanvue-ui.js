/* Fanvue dashboard UI: the one shared implementation of icons, metric strip,
   chart panel, results table, data states and tooltips (DESIGN §2-3, §5-6).
   Pages describe what to show; this file decides how it looks and behaves. */
(function(){
  'use strict';
  const C=window.FanvueCore;
  const esc=C.escapeHtml;

  /* 16px stroke icon family (lucide-style geometry, drawn for this product). */
  const P={
    home:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h5v-6h4v6h5V9.5"/>',
    discord:'<path d="M8.5 7.5c-1.4.3-2.6.8-3.7 1.5C3.6 11.2 3 13.6 3 16.4c1.2 1 2.6 1.7 4.3 2.1l1-1.6"/><path d="M15.5 7.5c1.4.3 2.6.8 3.7 1.5 1.2 2.2 1.8 4.6 1.8 7.4-1.2 1-2.6 1.7-4.3 2.1l-1-1.6"/><path d="M7.5 16.5c3 1.3 6 1.3 9 0"/><path d="M9 7.2c2-.5 4-.5 6 0"/><circle cx="9.2" cy="12.6" r="1.1"/><circle cx="14.8" cy="12.6" r="1.1"/>',
    x:'<path d="M4 4l16 16"/><path d="M20 4 4 20"/>',
    xmark:'<path d="M4 4h4.2l11.8 16h-4.2z"/><path d="M19.6 4 13.3 11M10.7 13 4.4 20"/>',
    gamepad:'<path d="M7.5 7h9a4.5 4.5 0 0 1 4.4 3.6l.9 4.6a2.6 2.6 0 0 1-4.5 2.2L15 15H9l-2.3 2.4a2.6 2.6 0 0 1-4.5-2.2l.9-4.6A4.5 4.5 0 0 1 7.5 7Z"/><path d="M8 10v3M6.5 11.5h3"/><circle cx="15.5" cy="11" r=".6"/><circle cx="17.3" cy="12.8" r=".6"/>',
    layers:'<path d="m12 3 9 4.8-9 4.8-9-4.8z"/><path d="m3 12.2 9 4.8 9-4.8"/><path d="m3 16.4 9 4.6 9-4.6"/>',
    sparkles:'<path d="M12 3.5c.5 3.9 2.6 6 6.5 6.5-3.9.5-6 2.6-6.5 6.5-.5-3.9-2.6-6-6.5-6.5 3.9-.5 6-2.6 6.5-6.5Z"/><path d="M19 15.5v4M17 17.5h4"/>',
    megaphone:'<path d="M3.5 10v4a1 1 0 0 0 1 1H7l7 4V5L7 9H4.5a1 1 0 0 0-1 1Z"/><path d="M7 15l1.5 5h2.5L10 15.6"/><path d="M17.5 9a4 4 0 0 1 0 6"/>',
    wallet:'<path d="M4 7.5V18a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1v-3"/><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H17v2.5"/><path d="M20 11h-4a2 2 0 0 0 0 4h4z"/><path d="M4 7.5h15a1 1 0 0 1 1 1V11"/>',
    eye:'<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/>',
    cursor:'<path d="m5 4 13.5 6.2-5.8 1.9-2 5.9z"/><path d="m13 13 5 5"/>',
    user:'<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
    shield:'<path d="M12 3 5 6v5.5c0 4.3 2.9 7.7 7 9.5 4.1-1.8 7-5.2 7-9.5V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
    check:'<circle cx="12" cy="12" r="8.5"/><path d="m8.5 12.2 2.4 2.4 4.6-5"/>',
    calendar:'<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
    refresh:'<path d="M20 11a8 8 0 0 0-14.3-4.6L4 8.5"/><path d="M4 4v4.5h4.5"/><path d="M4 13a8 8 0 0 0 14.3 4.6l1.7-2.1"/><path d="M20 20v-4.5h-4.5"/>',
    down:'<path d="m6.5 9.5 5.5 5.5 5.5-5.5"/>',
    right:'<path d="m9.5 6 6 6-6 6"/>',
    back:'<path d="m14.5 6-6 6 6 6"/>',
    left:'<path d="m14.5 6-6 6 6 6"/>',
    up:'<path d="m6.5 14.5 5.5-5.5 5.5 5.5"/>',
    users:'<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M15.5 5.2a3.5 3.5 0 0 1 0 6.6"/><path d="M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
    trend:'<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    minus:'<path d="M5 12h14"/>',
    target:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
    bars:'<path d="M5 20V12M10 20V5M15 20v-9M20 20v-5"/>',
    line:'<path d="m3.5 16 5-5 4 3.5 7.5-8"/><path d="M3.5 20.5h17"/>',
    table:'<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M3.5 14.5h17M10 9.5v10"/>',
    search:'<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    external:'<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
    menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
    grid:'<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
    close:'<path d="m6 6 12 12M18 6 6 18"/>',
    info:'<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.1"/>',
    alert:'<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.2v.1"/>',
    doc:'<path d="M6.5 3h8l4 4v13a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M14 3v4.5h4.5M9 12h6M9 16h6"/>',
    clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    link:'<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/>',
    graduation:'<path d="m2 9.5 10-5 10 5-10 5z"/><path d="M6 11.5V16c3.6 2.6 8.4 2.6 12 0v-4.5"/><path d="M22 9.5v5"/>',
    archive:'<rect x="3" y="4" width="18" height="4.5" rx="1"/><path d="M5 8.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5M10 12.5h4"/>',
    rocket:'<path d="M5 15c-1.5 1.3-2 4-2 4s2.7-.5 4-2"/><path d="M9.5 14.5 7 12c1-3.8 4.6-8 11.5-8.5C18 10.4 13.8 14 10 15z"/><circle cx="14.5" cy="9.5" r="1.5"/>',
    video:'<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10.5 5-3v9l-5-3"/>',
    image:'<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m20.5 16-5-5-8 8.5"/>',
    mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
    music:'<path d="M9 18V5.5l11-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
    star:'<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>',
    heart:'<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z"/>',
    gift:'<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v8h14v-8M12 8v12"/><path d="M12 8C10.5 4.5 7 4.5 7 6.5S10 8 12 8c2 0 5 .5 5-1.5S13.5 4.5 12 8Z"/>',
    tag:'<path d="M3.5 12.3V4.5a1 1 0 0 1 1-1h7.8l8.2 8.2-8.8 8.8z"/><circle cx="8" cy="8" r="1.3"/>',
    userplus:'<circle cx="10" cy="8" r="3.6"/><path d="M3 20a7 7 0 0 1 12.2-4.7M18.5 13v6M15.5 16h6"/>',
    globe:'<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.2 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.2-3.5-8.5s1.1-6.1 3.5-8.5Z"/>',
    newspaper:'<path d="M5 4.5h12.5v15H6.5A1.5 1.5 0 0 1 5 18z"/><path d="M17.5 8.5h2v10a1 1 0 0 1-2 0M8 8h6.5M8 11.5h6.5M8 15h4"/>',
    book:'<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3"/>',
    zap:'<path d="M13 3 4.5 13.5H12L11 21l8.5-10.5H12z"/>',
    flag:'<path d="M5 21V4M5 4.5h11.5l-2 4 2 4H5"/>'
  };
  const icon=(name,size=16)=>'<svg class="fv-icon" viewBox="0 0 24 24" width="'+size+'" height="'+size+'" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+(P[name]||P.doc)+'</svg>';

  /* ---------- states ---------- */
  const STATE_LABEL={na:'Not available',notConnected:'Not connected',notTracked:'Not tracked',loading:'Loading'};
  let reasonSeq=0;
  // Creator outcomes (signups, KYC, earning creators, cost per signup) are not connected yet.
  const isOutcome=reason=>reason===C.OUTCOME_REASON||/connected creator signups/i.test(String(reason||''));
  const unavailableState=m=>Boolean(m)&&m.state!=='loading'&&(m.value===null||!['value','partial','stale'].includes(m.state));
  function reasonButton(label,reason,cls=''){
    if(isOutcome(reason))cls+=' is-outcome';
    if(/^Not (available|recorded|tracked|connected)/.test(label))cls+=' is-na';
    if(!reason)return '<span class="fv-state '+cls+'">'+esc(label)+'</span>';
    const id='fvr'+(++reasonSeq);
    return '<button type="button" class="fv-state fv-reason '+cls+'" data-reason="'+esc(reason)+'" aria-describedby="'+id+'">'+esc(label)+
      '<span class="fv-sr" id="'+id+'">'+esc(reason)+'</span></button>';
  }
  /* One type tag per row, one colour per type, so each row is clear at a glance. */
  const TYPES={
    article:{label:'Article',reason:'X Article promotion: publishers post the article.'},
    post:{label:'Post',reason:'The publisher’s own X post.'},
    qrt:{label:'QRT',reason:'Quote post: the publisher quotes another post with their own comment.'},
    rt:{label:'RT',reason:'Paid repost (RT) of an original post.'},
    story:{label:'Story',reason:'Instagram story.'},
    mixed:{label:'Mixed',reason:'More than one format. Open the campaign for the breakdown.'}
  };
  const typeTag=k=>TYPES[k]?'<span class="fv-types">'+reasonButton(TYPES[k].label,TYPES[k].reason,'fv-type is-'+k)+'</span>':'';
  const formatValue=(v,format)=>format==='money'?C.money(v):format==='money0'?C.money(v,0):format==='moneyShort'?C.moneyShort(v):
    format==='compact'?C.compact(v):format==='signed'?C.signed(v):format==='rate'?C.rate(v):C.full(v);
  /* Render a metric descriptor: a value (with optional partial/stale chip) or a
     labelled state whose reason is available on hover, focus and tap. */
  function value(m,format='count',{chipText}={}){
    if(!m||m.state==='loading')return '<span class="fv-skel" aria-label="Loading"></span>';
    if(m.value===null||!['value','partial','stale'].includes(m.state))
      return reasonButton(STATE_LABEL[m.state]||'Not available',m.reason,'is-'+m.state);
    const text=esc(formatValue(m.value,format));
    if(m.reason&&m.state!=='value')return '<span class="fv-num" tabindex="0" data-reason="'+esc(m.reason)+'">'+text+'</span>';
    return '<span class="fv-num">'+text+'</span>';
  }
  function chipFor(m,note){
    if(!m)return '';
    if(m.state==='partial')return reasonButton(m.chip||'Partial',m.reason,'fv-chip is-warn');
    if(m.state==='stale')return reasonButton('Stale',m.reason,'fv-chip is-warn');
    const label=note||m.chip;
    if(!label)return '';
    // A note only carries the reason when the value itself is shown.
    return m.state==='value'&&m.reason?reasonButton(label,m.reason,'fv-chip'):'<span class="fv-chip">'+esc(label)+'</span>';
  }
  /* ---------- page header ---------- */
  function chipIcon(name,cls=''){return '<span class="fv-chipicon '+cls+'">'+icon(name,16)+'</span>';}

  /* ---------- metric strip (DESIGN §3, §4.1) ---------- */
  function stripCell(it){
    const m=it.metric,unavailable=!m||m.value===null||!['value','partial','stale'].includes(m.state);
    // Rounded figures (1.61M, $4,441) show the exact value on hover and to screen readers.
    const shown=unavailable?'':formatValue(m.value,it.format||'count');
    const exact=unavailable?'':formatValue(m.value,/^money/.test(it.format||'')?'money':'count');
    // No notes under the numbers: scope and coverage (e.g. partial, includes planned) are in the hover text.
    const tip=[!unavailable&&exact!==shown?'Exact: '+exact:'',!unavailable&&m.state==='partial'?'Partial: '+(m.reason||''):!unavailable&&m.state==='stale'?'Last verified: '+(m.reason||''):(!unavailable&&m.reason)||'',
      !unavailable&&it.note?it.note:''].filter(Boolean).join(' · ');
    const precise=tip?' data-reason="'+esc(tip)+'"':'';
    return '<div class="fv-metric">'+
      '<div class="fv-metric-label">'+chipIcon(it.icon)+'<span>'+esc(it.label)+'</span></div>'+
      '<div class="fv-metric-value'+(unavailable&&m?.state!=='loading'?' is-state':'')+'"'+precise+'>'+(unavailable&&m?.state!=='loading'?dashCell(m?.reason):value(m,it.format||'count'))+
        (precise?'<span class="fv-sr"> (exact '+esc(exact)+')</span>':'')+'</div>'+

    '</div>';
  }
  /* Only figures that exist are shown; slots without data are left out. */
  function strip(items,{cls=''}={}){
    const shown=items;
    if(!shown.length)return '';
    return '<section class="fv-panel fv-strip'+(cls?' '+esc(cls):'')+'" style="--n:'+shown.length+'" data-n="'+shown.length+'" aria-label="Key metrics">'+shown.map(stripCell).join('')+'</section>';
  }

  /* ---------- panel heads ---------- */
  const panelHead=(title,iconName,tools='',id='')=>'<div class="fv-panel-head"><h2'+(id?' id="'+esc(id)+'"':'')+'>'+chipIcon(iconName)+'<span>'+esc(title)+'</span></h2>'+(tools?'<div class="fv-tools">'+tools+'</div>':'')+'</div>';

  /* ---------- chart panel ---------- */
  /* opts: {id,title,icon,measures:[{key,label,title,format,series:[...]|categories:[...],kinds:['line','bar']}],
     selected,type,empty:{title,reason,links}} */
  const measureRegistry=new Map();
  const getMeasure=(id,key)=>measureRegistry.get(id+'|'+key)||null;
  function chartPanel(opts,state){
    const measures=(opts.measures||[]).filter(m=>(m.series&&new Set(m.series.filter(p=>C.num(p.value)!==null).map(p=>p.week)).size>=1)||(m.categories&&m.categories.length));
    for(const m of measures)measureRegistry.set(opts.id+'|'+m.key,m);
    if(!measures.length)return '';
    const sel=measures.find(m=>m.key===state.measure)||measures[0];
    const type='bar';
    const select=measures.length>1?'<label class="fv-select"><span class="fv-sr">Chart metric</span><select data-chart-measure="'+esc(opts.id)+'">'+
      measures.map(m=>'<option value="'+esc(m.key)+'"'+(m.key===sel.key?' selected':'')+'>'+esc(m.label)+'</option>').join('')+'</select>'+icon('down',14)+'</label>':'';
    return '<section class="fv-panel fv-chart-panel" aria-labelledby="'+esc(opts.id)+'-t">'+panelHead(sel.title,'trend',select,opts.id+'-t')+
      '<div class="fv-chart" id="'+esc(opts.id)+'" data-type="'+type+'" data-measure="'+esc(sel.key)+'">'+chartBody(sel,type)+'</div>'+
      '</section>';
  }
  function chartBody(m,type){
    if(type==='table'){
      const rows=m.series||m.categories;
      return '<div class="fv-table-wrap fv-chart-table"><table data-no-sort><thead><tr><th scope="col" class="is-left">'+(m.series?(m.period||'Week'):'Group')+'</th><th scope="col">'+esc(m.unit||m.label)+'</th></tr></thead><tbody>'+
        rows.map(p=>'<tr><td class="is-left">'+esc(m.series?p.range+(p.incomplete?' (incomplete)':''):p.label)+'</td><td>'+(p.value===null||p.value===undefined?reasonButton(p.state||'Not available',p.reason):esc(formatValue(p.value,m.format)))+'</td></tr>').join('')+'</tbody></table></div>';
    }
    return '<div class="fv-plot" role="img" aria-label="'+esc(m.title)+'. Focus or hover on a point for exact values."></div>';
  }
  function niceMax(max){
    if(!(max>0))return 1;
    const raw=max/4,pow=10**Math.floor(Math.log10(raw)),step=[1,2,2.5,5,10].map(x=>x*pow).find(x=>x>=raw)||pow*10;
    return {step,max:Math.ceil(max/step)*step};
  }
  const tickText=(v,format)=>{const s=C.compact(v);return format&&format.startsWith('money')?'$'+s:s;};
  /* Draw SVG into a .fv-plot using its real width. Called after render and on resize. */
  function drawChart(host,m,type){
    const plot=host.querySelector('.fv-plot');if(!plot)return;
    const W=Math.max(260,plot.clientWidth||600),H=plot.clientHeight||190;
    const allPoints=m.series||m.categories,pts=m.period==='Day'?allPoints.slice(W<480?-7:-14):allPoints,cat=!m.series;
    const vals=pts.map(p=>C.num(p.value)).filter(v=>v!==null);
    let lo=Math.min(0,...vals),hi=Math.max(0,...vals);
    const nm=niceMax(Math.max(Math.abs(lo),Math.abs(hi)));
    hi=hi>0?nm.max:0;lo=lo<0?-nm.max:0;if(hi===lo)hi=1;
    const n=pts.length,bar=type==='bar'||cat;
    const L=W<480?12:48,R=W<480?10:18,T=W<480?12:20,iw=W-L-R;
    // Category names that do not fit their slot wrap onto two lines.
    const wrap=cat&&pts.some(p=>String(p.label||'').length*7.4>iw/n-8);
    const B=wrap?46:32,ih=H-T-B;
    const twoLines=t=>{const w=String(t).split(' ');if(w.length<2)return [String(t)];let best=1,score=1e9;
      for(let k=1;k<w.length;k++){const d=Math.max(w.slice(0,k).join(' ').length,w.slice(k).join(' ').length);if(d<score){score=d;best=k;}}
      return [w.slice(0,best).join(' '),w.slice(best).join(' ')];};
    const X=i=>L+(bar?iw*(i+.5)/n:(n===1?iw/2:iw*i/(n-1)));
    const Y=v=>T+ih-(v-lo)/(hi-lo)*ih;
    let s='<svg viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" aria-hidden="true" focusable="false">';
    const steps=Math.round((hi-lo)/nm.step);
    for(let i=0;i<=steps;i++){const v=lo+i*nm.step,y=Y(v);if(W<480&&v!==0)continue;s+='<line class="fv-grid'+(v===0?' is-zero':'')+'" x1="'+L+'" x2="'+(W-R)+'" y1="'+y+'" y2="'+y+'"/><text class="fv-axis" x="'+(L-8)+'" y="'+(y+4)+'" text-anchor="end">'+esc(tickText(v,m.format))+'</text>';}
    const every=Math.max(1,Math.ceil(n/(W<480?4:W<800?6:10)));
    // Every few labels, always the last; a label too close to the last one is skipped so they never overlap.
    pts.forEach((p,i)=>{if(i!==n-1&&(i%every!==0||n-1-i<every))return;
      const lines=wrap?twoLines(p.label):[p.label];
      s+='<text class="fv-axis'+(p.incomplete?' is-incomplete':'')+'" x="'+X(i)+'" y="'+(H-6-(lines.length-1)*15)+'" text-anchor="middle">'+lines.map((t,j)=>'<tspan x="'+X(i)+'"'+(j?' dy="15"':'')+'>'+esc(t)+'</tspan>').join('')+'</text>';});
    if(bar){
      const bw=Math.max(6,Math.min(52,iw/n*.68));
      pts.forEach((p,i)=>{const v=C.num(p.value);if(v===null){if(cat)s+='<text class="fv-axis is-muted" x="'+X(i)+'" y="'+(Y(0)-8)+'" text-anchor="middle">'+esc(p.state||'Not available')+'</text>';return;}const y0=Y(0),y=Y(v);s+='<rect data-bar="'+i+'" class="fv-bar'+(p.incomplete?' is-incomplete':'')+'" x="'+(X(i)-bw/2)+'" y="'+Math.min(y,y0)+'" width="'+bw+'" height="'+Math.max(1,Math.abs(y0-y))+'" rx="8"/>';if(W>=480&&n<=10)s+='<text class="fv-bar-value" x="'+X(i)+'" y="'+(v>=0?Math.max(12,y-7):y+15)+'" text-anchor="middle">'+esc(formatValue(v,m.format==='compact'?'compact':m.format||'count'))+'</text>';});
    }else{
      const seg=[];pts.forEach((p,i)=>{const v=C.num(p.value);if(v!==null)seg.push([X(i),Y(v),p]);});
      if(seg.length){
        const complete=seg.filter(x=>!x[2].incomplete),last=seg.at(-1);
        s+='<polygon class="fv-area" points="'+seg[0][0]+','+Y(0)+' '+seg.map(x=>x[0]+','+x[1]).join(' ')+' '+last[0]+','+Y(0)+'"/>';
        const solid=complete.length?complete:seg;
        s+='<polyline class="fv-line" points="'+solid.map(x=>x[0]+','+x[1]).join(' ')+'"/>';
        if(last[2].incomplete&&complete.length)s+='<polyline class="fv-line is-dashed" points="'+complete.at(-1)[0]+','+complete.at(-1)[1]+' '+last[0]+','+last[1]+'"/>';
        seg.forEach(x=>{s+='<circle class="fv-dot'+(x[2].incomplete?' is-incomplete':'')+'" cx="'+x[0]+'" cy="'+x[1]+'" r="4"/>';});
      }
    }
    s+='</svg>';
    // Focusable hit targets for keyboard, mouse and touch tooltips.
    const hits=pts.map((p,i)=>{const v=C.num(p.value);const w=bar?iw/n:(n===1?iw:iw/(n-1)),left=Math.max(L,X(i)-w/2),right=Math.min(W-R,X(i)+w/2);
      const tip=(p.range||p.label)+(p.incomplete?' (incomplete '+(m.period||'Week').toLowerCase()+')':'')+'\n'+(m.unit||m.label)+': '+(v===null?(p.state||'Not available'):formatValue(v,m.tipFormat||(m.format==='moneyShort'?'money':m.format)))+(p.extra?'\n'+p.extra:'');
      return '<button type="button" class="fv-hit" data-index="'+i+'" style="left:'+left+'px;width:'+Math.max(1,right-left)+'px" data-tip="'+esc(tip)+'" data-x="'+X(i)+'" data-y="'+(v===null?T+ih/2:Y(v))+'" aria-label="'+esc(tip.replace(/\n/g,'. '))+'"></button>';}).join('');
    plot.innerHTML=s+'<div class="fv-hits">'+hits+'</div>';
  }

  /* ---------- results table ---------- */
  /* cfg: {id,title,icon,views:[{key,label}],view,search,columns:[{key,label,type:'name'|'money'|'count'|'text'|'status'|'link'|'metric',get,sort,html,format,align}],
     rows,rowKey,expand(row)->html,empty,countLabel,aligned} ; st: {sort:{key,dir},q,expanded:Set} */
  function cellValue(col,row){
    const v=col.get?col.get(row):row[col.key];
    // Missing data shows one restrained dash (never zero); the reason is available on hover and focus.
    if(v&&typeof v==='object'&&'state' in v&&unavailableState(v))return dashCell(v.reason);
    if(col.html)return col.html(row,v);
    if(v&&typeof v==='object'&&'state' in v)return unavailableState(v)?dashCell(v.reason):value(v,col.format||'count');
    if(v===null||v===undefined||v==='')return dashCell('');
    if(col.type==='money')return esc(C.money(v));
    if(col.type==='count')return esc(C.full(v));
    return esc(v);
  }
  const dashCell=reason=>'<span class="fv-dash" tabindex="0" data-reason="'+esc(reason||'Not available.')+'" aria-label="'+esc('No data. '+(reason||''))+'">–</span>';
  function sortValue(col,row){
    if(col.sort)return col.sort(row);
    const v=col.get?col.get(row):row[col.key];
    if(v&&typeof v==='object'&&'state' in v)return ['value','partial','stale'].includes(v.state)?v.value:null;
    return v;
  }
  // Publication age is separate from payment and metric refresh dates. Date-only sources
  // are deliberately displayed in days, not invented hours or seconds.
  function ageText(at,dayOnly=false,now=Date.now()){
    if(!Number.isFinite(at)||at<=0||at>now)return '–';
    if(dayOnly){
      const today=Date.parse(C.londonDay(now)+'T00:00:00Z');
      const days=Math.max(0,Math.floor((today-at)/86400000));
      return days===0?'Today':days+'d ago';
    }
    const s=Math.floor((now-at)/1000),m=Math.floor(s/60),h=Math.floor(m/60),d=Math.floor(h/24);
    if(d)return d+'d ago';
    if(h)return h+'h'+(m%60?' '+m%60+'m':'')+' ago';
    if(m)return m+'m ago';
    return s+'s ago';
  }
  function ageCell(row,get){
    const v=get(row);
    if(!v||!Number.isFinite(v.at)||v.at<=0||v.at>Date.now())return dashCell('No verified publication timestamp.');
    const exact=v.dayOnly?new Date(v.at).toISOString().slice(0,10):new Date(v.at).toLocaleString('en-GB',{timeZone:'Europe/London'})+' UK time';
    return '<time class="fv-age" datetime="'+new Date(v.at).toISOString()+'" data-age-at="'+v.at+'" data-age-day="'+(v.dayOnly?1:0)+'" title="'+esc(exact)+'">'+esc(ageText(v.at,v.dayOnly))+'</time>';
  }
  function refreshAges(root){
    if(document.hidden)return;
    const now=Date.now();
    for(const t of root.querySelectorAll('[data-age-at]')){
      const label=ageText(Number(t.dataset.ageAt),t.dataset.ageDay==='1',now);
      if(t.textContent!==label)t.textContent=label;
    }
  }
  // Widths are derived from the schema, never from visible row contents or sort direction.
  function columnWidth(c){
    if(c.key==='age')return 106;
    if(c.key==='headline')return 240;
    if(c.key==='campaigns')return 170;
    if(c.type==='name')return 170;
    if(c.type==='link')return 62;
    if(c.key==='type'||c.key==='platform'||c.type==='status')return 84;
    return c.type==='text'?126:98;
  }
  function tablePanel(cfg,st){
    if(cfg.age)cfg={...cfg,columns:[{key:'age',label:'Posted',type:'text',keep:true,sort:r=>cfg.age(r)?.at??null,html:r=>ageCell(r,cfg.age)},...cfg.columns],widths:undefined};
    const q=(st.q||'').trim().toLowerCase();
    let rows=cfg.rows||[];
    const sortCol=st.sort&&cfg.columns.find(c=>c.key===st.sort.key);
    const views=cfg.views&&cfg.views.length>1?'<div class="fv-segments" role="group" aria-label="Table view">'+cfg.views.map(v=>'<button type="button" data-view="'+esc(v.key)+'" data-table="'+esc(cfg.id)+'" aria-pressed="'+(v.key===cfg.view)+'">'+esc(v.label)+'</button>').join('')+'</div>':'';
    const search=cfg.search?'<label class="fv-search">'+icon('search',15)+'<span class="fv-sr">Search</span><input type="search" placeholder="Search" autocomplete="off" data-search="'+esc(cfg.id)+'" value="'+esc(st.q||'')+'"></label>':'';
    const filters=cfg.filters||'';
    const tools=views||search||filters?'<div class="fv-table-tools">'+search+views+filters+'</div>':'';
    // Columns with no data for any record are hidden and listed once above the table.
    const hidden=[];
    const cols=(cfg.rows||[]).length&&cfg.hideEmpty!==false?cfg.columns.filter(c=>{
      if(!c.get||c.keep)return true;
      const vals=cfg.rows.map(r=>c.get(r));
      if(!vals.every(v=>v&&typeof v==='object'&&'state' in v&&unavailableState(v)))return true;
      hidden.push({label:c.label,reason:vals[0]?.reason||''});return false;
    }):cfg.columns;
    // Summary tables can drop rows that have no data at all (e.g. a source not connected yet).
    if(cfg.dropEmptyRows)rows=rows.filter(r=>cols.filter(c=>c.get).some(c=>{const v=c.get(r);return !(v&&typeof v==='object'&&'state' in v&&unavailableState(v));}));
    // A table with no data at all is left out, unless its view tabs are needed to switch back.
    const all=rows;
    if(!all.length&&!views&&cfg.title!=='Listings')return '';
    // Search and filter only narrow what is shown; the panel and its controls always stay.
    if(q)rows=rows.filter(r=>(cfg.searchText?cfg.searchText(r):JSON.stringify(r)).toLowerCase().includes(q));
    if(cfg.filter)rows=rows.filter(cfg.filter);
    if(sortCol)rows=C.sortRows(rows,r=>sortValue(sortCol,r),st.sort.dir);
    const head='<tr>'+cols.map(c=>{
      const sorted=st.sort?.key===c.key,dir=sorted?(st.sort.dir>0?'ascending':'descending'):'none';
      const left=['name','text','status','link'].includes(c.type)||c.align==='left';
      if(c.type==='link'||c.nosort)return '<th scope="col" class="'+(left?'is-left':'')+(c.type==='link'?' is-link':'')+'">'+esc(c.label)+'</th>';
      return '<th scope="col" class="'+(left?'is-left':'')+'" data-column="'+esc(c.key)+'" aria-sort="'+dir+'"><button type="button" data-sort="'+esc(c.key)+'" data-table="'+esc(cfg.id)+'">'+esc(c.label)+'<span class="fv-sort" aria-hidden="true">'+(sorted?icon(st.sort.dir>0?'up':'down',12):'')+'</span></button></th>';
    }).join('')+(cfg.expand?'<th scope="col" class="fv-x-col"><span class="fv-sr">Details</span></th>':'')+'</tr>';
    // Optional grouping: rows stay in their sorted order inside each group, groups in order of first appearance.
    if(cfg.groupBy){const order=[],by=new Map();for(const r of rows){const k=cfg.groupBy(r);if(!by.has(k)){by.set(k,[]);order.push(k);}by.get(k).push(r);}rows=order.flatMap(k=>by.get(k));}
    // Long lists show the first few rows with a Show all button (owner, 26 Nov).
    const total=rows.length,limited=cfg.limit&&!st.showAll&&rows.length>cfg.limit;
    if(limited)rows=rows.slice(0,cfg.limit);
    let lastGroup=null;
    const body=rows.map(r=>{
      const g=cfg.groupBy?cfg.groupBy(r):null;
      const head=cfg.groupBy&&g!==lastGroup?'<tr class="fv-group-row"><td colspan="'+(cols.length+(cfg.expand?1:0))+'"><div class="fv-group-head">'+cfg.groupHeader(g,rows.filter(x=>cfg.groupBy(x)===g))+'</div></td></tr>':'';
      lastGroup=g;
      const key=String(cfg.rowKey(r)),open=st.expanded?.has(key);
      const detailId='fvd-'+cfg.id+'-'+key.replace(/[^A-Za-z0-9_-]/g,'_');
      const cells=cols.map(c=>{
        const left=['name','text','status','link'].includes(c.type)||c.align==='left';
        // data-label lets a row read as a labelled card on phones.
        return '<td class="'+(left?'is-left':'')+(c.type==='name'?' is-name':'')+(c.type==='link'?' is-link':'')+(st.sort?.key===c.key?' is-sorted':'')+'" data-column="'+esc(c.key)+'" data-label="'+esc(c.label)+'">'+cellValue(c,r)+'</td>';
      });
      const tr='<tr class="fv-row'+(open?' is-open':'')+(cfg.rowClass?' '+esc(cfg.rowClass(r)||''):'')+'">'+cells.join('')+
        (cfg.expand?'<td class="fv-x-col"><button type="button" class="fv-expand" data-expand="'+esc(key)+'" data-table="'+esc(cfg.id)+'" aria-expanded="'+open+'" aria-controls="'+esc(detailId)+'" aria-label="'+(open?'Hide':'Show')+' details for '+esc(cfg.rowLabel?cfg.rowLabel(r):key)+'">'+icon(open?'down':'right',15)+'</button></td>':'')+'</tr>';
      return head+tr+(cfg.expand&&open?'<tr class="fv-detail" id="'+esc(detailId)+'"><td colspan="'+(cols.length+1)+'"><div class="fv-detail-inner">'+cfg.expand(r)+'</div></td></tr>':'');
    }).join('');
    const empty=rows.length?'':all.length?
      '<div class="fv-empty"><p>No Listings</p><button type="button" class="fv-link-button" data-reset="'+esc(cfg.id)+'">Reset Filters</button></div>':
      '<div class="fv-empty fv-nosource">'+icon('info',16)+'<p>'+(cfg.empty||'No records.')+'</p></div>';
    const explicit=!!cfg.widths&&!hidden.length&&cfg.widths.length===cols.length+(cfg.expand?1:0);
    const placement=String(cfg.cls||'').includes('is-placement-list');
    const weights=placement?[112,206,78,100,100,102,96,60,44]:cols.map(columnWidth).concat(cfg.expand?[44]:[]);
    const totalWidth=weights.reduce((a,b)=>a+b,0);
    const widths=explicit?cfg.widths:weights.map(w=>(100*w/Math.max(1,totalWidth)).toFixed(3)+'%');
    const colgroup='<colgroup>'+widths.map(w=>'<col style="width:'+w+'">').join('')+'</colgroup>';
    const minWidth=placement?898:Math.max(cfg.minWidth||0,Math.round(totalWidth*.9));
    const sortOptions=cols.filter(c=>c.type!=='link'&&!c.nosort).flatMap(c=>[1,-1].map(dir=>{
      const v=c.key+':'+dir,selected=st.sort?.key===c.key&&st.sort.dir===dir;
      const order=c.key==='age'?(dir===-1?'Newest':'Oldest'):(dir===-1?'Descending':'Ascending');
      return '<option value="'+esc(v)+'"'+(selected?' selected':'')+'>'+esc(c.label+' · '+order)+'</option>';
    })).join('');
    const mobileSort=sortOptions?'<label class="fv-select fv-mobile-sort"><span class="fv-sr">Sort listings</span><select data-mobile-sort="'+esc(cfg.id)+'"><option value="">Sort listings</option>'+sortOptions+'</select>'+icon('down',14)+'</label>':'';
    const table=(rows.length||cfg.title==='Listings')?'<div class="fv-table-wrap" tabindex="0" role="region" aria-label="'+esc(cfg.title)+' table"><table data-no-sort class="fv-table is-aligned" style="--min-w:'+minWidth+'px;--cols:'+cols.length+'">'+colgroup+'<thead>'+head+'</thead><tbody>'+ (rows.length?body:'<tr class="fv-empty-row"><td colspan="'+(cols.length+(cfg.expand?1:0))+'">'+empty+'</td></tr>')+'</tbody></table></div>':empty;
    // Only a Show all button when the list is cut short; no record counts (owner, 26 Nov).
    const count=limited?'<div class="fv-count"><button type="button" class="fv-show-all" data-show-all="'+esc(cfg.id)+'">Show all '+C.full(total)+'</button></div>':'';
    return '<section class="fv-panel fv-table-panel'+(cfg.cls?' '+esc(cfg.cls):'')+'" id="'+esc(cfg.id)+'" aria-labelledby="'+esc(cfg.id)+'-t">'+panelHead(cfg.title,cfg.icon||'layers','',cfg.id+'-t')+tools+mobileSort+table+count+'</section>';
  }

  /* Detail grid used inside expanded rows. items: [[label, html]] */
  const hasData=([,v])=>v!==''&&v!==undefined&&v!==null&&!/class="[^"]*\bis-(na|outcome|notTracked|notConnected)\b/.test(String(v));
  const detailGrid=items=>'<dl class="fv-detail-grid">'+items.filter(Boolean).filter(hasData).map(([k,v])=>'<div><dt>'+esc(k)+'</dt><dd>'+v+'</dd></div>').join('')+'</dl>';
  const status=(text,tone='')=>'<span class="fv-status'+(tone?' is-'+tone:'')+'">'+esc(text)+'</span>';
  function extLink(url,label,{iconOnly=false}={}){
    const href=C.safeUrl(url);
    if(!href)return '';
    return '<a class="fv-ext'+(iconOnly?' is-icon':'')+'" href="'+esc(href)+'" target="_blank" rel="noopener noreferrer" aria-label="'+esc(label)+' (opens in a new tab)">'+(iconOnly?'':esc(label))+icon('external',14)+'</a>';
  }
  const marker=(iconName,colorKey,{plain=false}={})=>{
    const pal=C.PALETTE[colorKey]||C.PALETTE.slate;
    return plain?'<span class="fv-marker is-plain">'+icon(iconName,15)+'</span>':'<span class="fv-marker" style="background:'+pal.fill+'">'+icon(iconName,15)+'</span>';
  };
  /* Supporting blocks */
  const inlineMetrics=items=>{const shown=items.filter(Boolean).filter(hasData);return '<div class="fv-inline-metrics" style="--cols:'+Math.max(4,shown.length)+'">'+shown.map(([label,html])=>'<div><span>'+esc(label)+'</span><b>'+html+'</b></div>').join('')+'</div>'}
  const supportLine=(left,right='')=>'<div class="fv-support-line"><span>'+left+'</span>'+(right?'<span class="fv-support-right">'+right+'</span>':'')+'</div>';
  const supportPanel=(title,iconName,body,tools='')=>'<section class="fv-panel fv-support">'+panelHead(title,iconName,tools)+body+'</section>';

  /* ---------- shared tooltip (reasons and chart points) ---------- */
  let tip,tipTimer,activeBar;
  function ensureTip(){if(!tip){tip=document.createElement('div');tip.className='fv-tooltip';tip.setAttribute('role','tooltip');tip.hidden=true;document.body.appendChild(tip);}return tip;}
  function showTip(target,text){
    clearTimeout(tipTimer);if(activeBar){activeBar.classList.remove('is-hovered');activeBar=null;}
    const t=ensureTip(),chart=target.classList.contains('fv-hit'),lines=String(text||'').split('\n');t.textContent='';t.classList.toggle('is-chart',chart);
    lines.forEach((line,i)=>{const d=document.createElement(i?'span':'b');d.className=i===1&&chart?'fv-tip-result':'';const parts=i===1&&chart?line.match(/^(.+?): (.+)$/):null;d.textContent=parts?parts[2]+' '+parts[1].toLowerCase():line;t.appendChild(d);});
    t.hidden=false;
    const r=target.getBoundingClientRect(),tw=t.offsetWidth,th=t.offsetHeight;
    let x=r.left+r.width/2-tw/2,y=r.top-th-8;
    if(chart){const plot=target.closest('.fv-plot'),host=plot.getBoundingClientRect();activeBar=plot.querySelector('[data-bar="'+target.dataset.index+'"]');activeBar?.classList.add('is-hovered');x=host.left+Number(target.dataset.x)-tw/2;y=host.top+Number(target.dataset.y)-th-12;}
    x=Math.max(8,Math.min(window.innerWidth-tw-8,x));if(y<8)y=Math.min(window.innerHeight-th-8,r.bottom+8);
    t.style.left=x+'px';t.style.top=y+'px';
  }
  function hideTip(){clearTimeout(tipTimer);if(tip)tip.hidden=true;if(activeBar){activeBar.classList.remove('is-hovered');activeBar=null;}}
  function bindTips(root){
    const target=e=>e.target.closest?.('[data-reason],.fv-hit');
    root.addEventListener('mouseover',e=>{const t=target(e);if(t)showTip(t,t.dataset.reason||t.dataset.tip);});
    root.addEventListener('mouseout',e=>{const t=target(e);if(t&&!t.contains(e.relatedTarget))tipTimer=setTimeout(hideTip,180);});
    root.addEventListener('focusin',e=>{const t=target(e);if(t)showTip(t,t.dataset.reason||t.dataset.tip);});
    root.addEventListener('focusout',e=>{if(target(e))hideTip();});
    root.addEventListener('click',e=>{const t=target(e);if(t){e.preventDefault();showTip(t,t.dataset.reason||t.dataset.tip);if(t.classList.contains('fv-hit'))tipTimer=setTimeout(hideTip,3500);}});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')hideTip();});
    window.addEventListener('scroll',hideTip,{passive:true});
  }

  window.FanvueUI=Object.freeze({icon,value,chipFor,reasonButton,strip,panelHead,chipIcon,chartPanel,chartBody,drawChart,getMeasure,tablePanel,detailGrid,status,extLink,marker,
    inlineMetrics,supportLine,supportPanel,typeTag,bindTips,hideTip,formatValue,ageText,refreshAges,ICONS:Object.keys(P)});
})();
