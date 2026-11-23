from pathlib import Path
root=Path(__file__).resolve().parents[1]
html=root/'public/index.html'; js=root/'public/app.js'; css=root/'public/styles.css'
s=html.read_text()
marker='    <section class="site-page" id="page-dashboard" aria-labelledby="dashboardTitle">'
assert marker in s
new=marker+'''
      <section class="daily-overview" id="dailyOverview" aria-labelledby="dailyOverviewTitle">
        <div class="daily-overview-head">
          <div><div class="daily-eyebrow">CAMPAIGN PULSE · LAST 7 DAYS</div><h2 id="dailyOverviewTitle">Daily breakdown<span class="heading-accent">.</span></h2></div>
          <span class="daily-live" id="dailyLiveStatus" role="status"><span class="daily-live-dot" aria-hidden="true"></span><span id="dailyLiveLabel">Checking data</span></span>
        </div>
        <div class="daily-overview-metrics" id="dailyOverviewMetrics" aria-live="polite"></div>
        <div class="daily-graph-card">
          <div class="daily-graph-head">
            <div><h3>Clicks vs spend<span class="heading-accent">.</span></h3><p>Day-by-day activity · UK time</p></div>
            <div class="daily-chart-legend" aria-label="Chart series"><span class="legend-clicks"><i></i>UTM clicks</span><span class="legend-spend"><i></i>Spend ($)</span></div>
          </div>
          <div class="daily-graph" id="dailyTrendChart" role="region" aria-label="Daily UTM clicks and payment-dated spend, each shown on its own labelled axis"></div>
          <div class="daily-graph-footnote" id="dailyTrendNote" aria-live="polite"></div>
        </div>
      </section>'''
s=s.replace(marker,new,1)
s=s.replace('/styles.css?v=4.9.2','/styles.css?v=5.0.24').replace('/app.js?v=4.9.2','/app.js?v=5.0.24')
html.write_text(s)
s=js.read_text()
s=s.replace("const APP_VERSION='4.9.2';","const APP_VERSION='5.0.24';")
anchor='function renderHomeChart(){'
assert anchor in s
newjs=r'''// Two clearly labelled Y-axes: measured UTM clicks on the left and
// payments with real paidAt dates on the right. NEVER distribute
// undated payments or lifetime post totals across arbitrary days.
function dailySeries(now=new Date()){
  const today=day(now),start=shift(today,-6),home=homePlacements();
  const codes=new Set(home.map(p=>p.code));
  const datedPayments=home.filter(p=>p.paid===true&&number(p.cost)!==null&&validDate(p.paidAt));
  const missingDates=home.filter(p=>p.paid===true&&number(p.cost)!==null&&!validDate(p.paidAt));
  const daily=Array.from({length:7},(_,i)=>{
    const date=shift(start,i);
    const clicks=state.activityReady?state.activity.filter(e=>codes.has(e.code)&&e.date===date).reduce((sum,e)=>sum+(number(e.clicks)||0),0):null;
    const spend=datedPayments.length?datedPayments.filter(p=>day(validDate(p.paidAt))===date).reduce((sum,p)=>sum+Number(p.cost),0):null;
    return {date,clicks,spend};
  });
  return {daily,missingDates:missingDates.length,hasSpend:datedPayments.length>0,hasClicks:state.activityReady};
}
function niceTop(value){
  if(value<=0)return 4;
  const raw=value/4,p=Math.pow(10,Math.floor(Math.log10(raw))),step=[1,2,2.5,5,10].map(n=>n*p).find(n=>n>=raw)||10*p;
  return step*4;
}
function renderDailyOverview(){
  const panel=el('dailyTrendChart'),metrics=el('dailyOverviewMetrics'),note=el('dailyTrendNote'),status=el('dailyLiveStatus');
  if(!panel||!metrics||!note||!status)return;
  const {daily,missingDates,hasSpend,hasClicks}=dailySeries(),today=daily.at(-1);
  const totalClicks=hasClicks?daily.reduce((s,d)=>s+d.clicks,0):null;
  const spend7=hasSpend?daily.reduce((s,d)=>s+(d.spend||0),0):null;
  const connected=state.initialLoadSettled&&!state.loadError&&state.trackingReady&&hasClicks;
  status.classList.toggle('is-live',connected);
  el('dailyLiveLabel').textContent=connected?'LIVE DATA':'DATA UNAVAILABLE';
  const defs=[
    {kind:'click',label:'UTM clicks today',value:hasClicks?fmt(today.clicks):'N/A',sub:'Recorded redirects · today'},
    {kind:'seven',label:'Clicks · 7 days',value:hasClicks?fmt(totalClicks):'N/A',sub:'Measured click events'},
    {kind:'spend',label:'Dated spend · 7 days',value:hasSpend?money(spend7):'N/A',sub:missingDates?'Excludes undated payments':'Known payment dates only'},
  ];
  metrics.innerHTML=defs.map(x=>`<div class="daily-metric daily-metric-${x.kind}"><span class="daily-metric-label">${esc(x.label)}</span><strong>${esc(x.value)}</strong><small>${esc(x.sub)}</small></div>`).join('');
  // Fixed viewBox ensures readable axes and line thickness at 390px.
  const W=920,H=314,L=60,R=70,T=28,B=56,cw=W-L-R,ch=H-T-B;
  const maxClick=niceTop(Math.max(0,...daily.map(d=>d.clicks??0))),maxSpend=niceTop(Math.max(0,...daily.map(d=>d.spend??0)));
  const X=i=>L+i*cw/6;
  const Y=(v,max)=>T+ch-(v/max)*ch;
  const path=(key,max)=>daily.every(d=>d[key]!==null)?daily.map((d,i)=>`${i?'L':'M'}${X(i).toFixed(1)} ${Y(d[key],max).toFixed(1)}`).join(' '):'';
  const clicksPath=hasClicks?path('clicks',maxClick):'',spendPath=hasSpend?path('spend',maxSpend):'';
  const area=clicksPath?clicksPath+` L${X(6)} ${Y(0,maxClick)} L${X(0)} ${Y(0,maxClick)} Z`:'';
  const axes=[0,1,2,3,4].map(i=>{
    const y=T+i*ch/4,cv=maxClick*(4-i)/4,sv=maxSpend*(4-i)/4;
    return `<g><line x1="${L}" y1="${y}" x2="${W-R}" y2="${y}" class="daily-grid-line"/><text x="${L-12}" y="${y+4}" class="daily-axis-label" text-anchor="end">${esc(fmt(cv))}</text><text x="${W-R+13}" y="${y+4}" class="daily-axis-label daily-axis-spend" text-anchor="start">$${esc(fmt(sv))}</text></g>`;
  }).join('');
  const labels=daily.map((d,i)=>{
    const date=validDate(d.date+'T12:00:00Z');
    const label=new Intl.DateTimeFormat('en-GB',{weekday:'short',timeZone:TZ}).format(date);
    return `<g><line x1="${X(i)}" x2="${X(i)}" y1="${T+ch}" y2="${T+ch+5}" stroke="#cad2e1"/><text x="${X(i)}" y="${H-27}" text-anchor="middle" class="daily-axis-label daily-x-label">${esc(label)}</text></g>`;
  }).join('');
  const markers=(key,max,klass)=>daily.map((d,i)=>d[key]===null?'':`<circle cx="${X(i)}" cy="${Y(d[key],max)}" r="5.5" class="${klass}"><title>${esc(d.date)}: ${key==='spend'?'$'+fixed(d.spend,2)+' spend':fmt(d.clicks)+' UTM clicks'}</title></circle>`).join('');
  panel.innerHTML=`<svg class="daily-trend-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="UTM clicks in red-orange and recorded daily spend in blue over seven days, with separate labelled Y axes"><defs><linearGradient id="dailyClicksLine" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#ff2e67"/><stop offset="55%" stop-color="#ff462b"/><stop offset="100%" stop-color="#ff8520"/></linearGradient><linearGradient id="dailyClicksFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ff4b50" stop-opacity=".23"/><stop offset="100%" stop-color="#ffb68a" stop-opacity=".012"/></linearGradient></defs><text x="${L}" y="15" class="daily-y-title" text-anchor="start">UTM CLICKS</text><text x="${W-R}" y="15" class="daily-y-title daily-y-spend" text-anchor="end">SPEND ($)</text>${axes}<line x1="${L}" y1="${T}" x2="${L}" y2="${T+ch}" class="daily-axis-line"/><line x1="${W-R}" y1="${T}" x2="${W-R}" y2="${T+ch}" class="daily-axis-line"/><line x1="${L}" y1="${T+ch}" x2="${W-R}" y2="${T+ch}" class="daily-axis-line"/>${labels}${area?`<path d="${area}" fill="url(#dailyClicksFill)"/>`:''}${clicksPath?`<path d="${clicksPath}" class="daily-utm-line" stroke="url(#dailyClicksLine)"/>`:''}${spendPath?`<path d="${spendPath}" class="daily-spend-line"/>`:''}${hasClicks?markers('clicks',maxClick,'daily-click-marker'):''}${hasSpend?markers('spend',maxSpend,'daily-spend-marker'):''}<text x="${W/2}" y="${H-2}" class="daily-x-title" text-anchor="middle">DATE · LAST 7 DAYS</text></svg>`;
  note.textContent=hasClicks?(hasSpend?(missingDates?`${missingDates} payment${missingDates===1?'':'s'} without dates excluded from the blue spend line.`:'Red/orange: verified daily redirects. Blue: spend on recorded payment dates.'):'Blue spend line unavailable until payment dates are recorded; no spend is assigned to invented dates.'):'UTM activity is unavailable; waiting for the verified event feed.';
}
''' + anchor
s=s.replace(anchor,newjs,1)
# Add chart render to existing dashboard render path without altering events handling
s=s.replace('  renderHomeChart();\n}\nfunction notify', '  renderHomeChart();\n  renderDailyOverview();\n}\nfunction notify',1)
js.write_text(s)
# Version sync with dashboard API and package
p=root/'netlify/functions/dashboard.mjs';p.write_text(p.read_text().replace("uiVersion:'4.9.2'","uiVersion:'5.0.24'"))
p=root/'package.json';p.write_text(p.read_text().replace('"version": "4.9.2"','"version": "5.0.24"'))
css.write_text(css.read_text()+r'''

/* UTM3 daily reporting enhancement. The existing sections and visual system remain intact. */
#page-dashboard .daily-overview {margin:6px 0 46px;max-width:100%;}
.daily-overview-head {display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:20px;}
.daily-eyebrow {color:#e13a58;letter-spacing:.12em;font-size:10px;font-weight:850;margin-bottom:7px;}
.daily-overview-head h2 {font-size:clamp(23px,2.7vw,33px);line-height:1.15;letter-spacing:-.058em;margin:0;font-weight:850;color:#111827;}
.daily-live {display:inline-flex;align-items:center;gap:10px;border:1px solid #ffb3bd;background:#fff0f1;padding:9px 13px;border-radius:99px;font-size:11px;font-weight:850;letter-spacing:.02em;color:#a82a42;white-space:nowrap;}
.daily-live-dot {display:inline-block;width:16px;height:16px;flex:none;background:#baadb2;border-radius:100%;}
.daily-live.is-live {color:#dc1238;background:#fff0f3;border-color:#ff9aaa;}
.daily-live.is-live .daily-live-dot {background:#ff003b;box-shadow:0 0 0 3px rgba(255,0,59,.19),0 0 16px rgba(255,0,59,.66);animation:daily-vivid-pulse 1.45s infinite;}
@keyframes daily-vivid-pulse {0%,100%{opacity:1;box-shadow:0 0 0 3px rgba(255,0,59,.2),0 0 16px rgba(255,0,59,.68)}50%{opacity:.72;box-shadow:0 0 0 9px rgba(255,0,59,.08),0 0 21px rgba(255,0,59,.82)}}
.daily-overview-metrics {display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:16px;}
.daily-metric {border-radius:19px;padding:19px 22px;min-height:124px;display:flex;flex-direction:column;justify-content:space-between;gap:6px;overflow:hidden;box-shadow:0 8px 23px rgba(17,24,39,.05);}
.daily-metric-label{font-weight:800;font-size:12px;letter-spacing:-.01em;opacity:.93;}
.daily-metric strong{font-size:clamp(29px,3.1vw,43px);line-height:1.05;font-weight:850;letter-spacing:-.065em;white-space:nowrap;font-variant-numeric:tabular-nums;}
.daily-metric small{font-size:10px;font-weight:700;opacity:.82;line-height:1.35;}
.daily-metric-click {background:linear-gradient(120deg,#e81853 0%,#ff4736 55%,#ff762d 100%);color:#fff;}
.daily-metric-seven {background:linear-gradient(120deg,#4a32ae 0%,#7951ed 60%,#9c6ff4 100%);color:#fff;}
.daily-metric-spend {background:linear-gradient(122deg,#1643b8 0%,#246bea 58%,#5599fb 100%);color:#fff;}
.daily-graph-card {background:#fff;border:1px solid #e7eaf2;border-radius:22px;padding:22px 24px 13px;box-shadow:0 8px 34px rgba(39,49,76,.04);min-width:0;}
.daily-graph-head {display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;}
.daily-graph-head h3 {font-size:17px;font-weight:850;letter-spacing:-.04em;color:#111827;margin:0 0 4px;}
.daily-graph-head p {font-size:12px;font-weight:650;color:#6a758a;margin:0;}
.daily-chart-legend {display:flex;gap:16px;align-items:center;flex-wrap:wrap;font-size:11px;font-weight:800;color:#455269;}
.daily-chart-legend span {display:inline-flex;align-items:center;gap:7px;}
.daily-chart-legend i {width:23px;height:5px;border-radius:9px;display:inline-block;}
.daily-chart-legend .legend-clicks i {background:linear-gradient(90deg,#ff2e67,#ff462b,#ff8520);}
.daily-chart-legend .legend-spend i {background:#2874ed;}
.daily-graph {width:100%;overflow:hidden;min-width:0;margin-top:12px;}
.daily-trend-svg {display:block;width:100%;height:auto;min-height:230px;overflow:visible;}
.daily-grid-line {stroke:#e9ecf2;stroke-width:1;stroke-dasharray:5 6;}
.daily-axis-line {stroke:#bac4d5;stroke-width:1.4;}
.daily-axis-label {fill:#68768d;font-size:12px;font-weight:750;font-family:Inter,system-ui,sans-serif;}
.daily-axis-spend,.daily-y-spend {fill:#2468d7;}
.daily-y-title,.daily-x-title {font-family:Inter,system-ui,sans-serif;font-weight:850;fill:#4b5871;font-size:11px;letter-spacing:.07em;}
.daily-utm-line {fill:none;stroke-width:6;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 2px 3px rgba(255,72,54,.28));}
.daily-spend-line {fill:none;stroke:#246ff0;stroke-width:4.5;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 2px 3px rgba(36,111,240,.16));}
.daily-click-marker {fill:#ff4938;stroke:#fff;stroke-width:3;}
.daily-spend-marker {fill:#2675ee;stroke:#fff;stroke-width:3;}
.daily-graph-footnote {padding:7px 1px 6px;color:#738098;font-size:10px;line-height:1.5;font-weight:650;}
#page-dashboard .move-section {margin-bottom:41px;}
#page-dashboard .week-card.live-article.new-article {background:linear-gradient(125deg,#d9114d 0%,#f82b48 51%,#fe7832 100%);}
#page-dashboard .week-card.live-article.is-aged {background:linear-gradient(125deg,#f36c88 0%,#f08a89 55%,#ffd4c8 100%);}
#page-dashboard .week-card {border-radius:24px;}
@media(max-width:760px){
  #page-dashboard .daily-overview {margin-top:4px;margin-bottom:36px;}
  .daily-overview-head {align-items:center;margin-bottom:14px;}
  .daily-live {padding:7px 9px;font-size:10px;gap:7px;}
  .daily-live-dot {width:14px;height:14px;}
  .daily-overview-metrics {gap:9px;grid-template-columns:repeat(2,minmax(0,1fr));}
  .daily-metric {min-height:101px;padding:15px 16px;border-radius:16px;}
  .daily-metric:last-child {grid-column:1/-1;min-height:94px;}
  .daily-metric strong {font-size:clamp(27px,7vw,36px);}
  .daily-graph-card {padding:17px 11px 12px;border-radius:19px;}
  .daily-chart-legend {gap:12px;font-size:10px;}
  .daily-trend-svg {min-height:210px;}
  .daily-axis-label {font-size:15px;}
  .daily-x-label {font-size:14px;}
}
@media(max-width:360px){.daily-overview-head h2{font-size:22px}.daily-live{font-size:9px}.daily-metric strong{font-size:27px}}
@media(prefers-reduced-motion:reduce){.daily-live.is-live .daily-live-dot{animation:none}}
''')
print('Changes applied to',root)
