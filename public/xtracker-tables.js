/* XTRACKER table view v1. Data is read from the existing app, not invented or saved.
   No redirects are fetched. All original controls and modal triggers remain in the DOM. */
(() => {
  'use strict';
  if (window.__xtTableViewInstalled) return;
  window.__xtTableViewInstalled = true;

  const roots = new WeakMap();
  const savedViews = new Map();
  const nativeTables = new WeakMap();
  const integer = new Intl.NumberFormat('en-GB', {maximumFractionDigits: 0});
  const usdNumber = new Intl.NumberFormat('en-GB', {minimumFractionDigits: 0, maximumFractionDigits: 2});
  const unknown = /^(?:n\/?a|unknown|not recorded|pending|unavailable|—|-|)$/i;
  const text = el => (el && el.textContent || '').replace(/\s+/g, ' ').trim();
  const safe = url => {
    if (typeof url !== 'string' || !url.trim()) return '';
    try { const u = new URL(url, location.href); return ['https:', 'http:'].includes(u.protocol) ? u.href : ''; }
    catch { return ''; }
  };
  const numeric = value => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const s = String(value ?? '').trim();
    if (unknown.test(s)) return null;
    const match = s.replace(/,/g, '').match(/^-?\$?\s*(-?\d+(?:\.\d+)?)\s*(?:%|views|clicks)?$/i);
    return match && Number.isFinite(Number(match[1])) ? Number(match[1]) : null;
  };
  const formatNum = value => value == null || !Number.isFinite(value) ? '—' : integer.format(value);
  const formatUSD = value => value == null || !Number.isFinite(value) ? '—' : '$' + usdNumber.format(value);
  const formatCPC = value => value == null || !Number.isFinite(value) ? '—' : '$' + value.toFixed(2);
  const formatCPI = value => value == null || !Number.isFinite(value) ? '—' : '$' + value.toFixed(value > 0 && value < 0.0001 ? 6 : 4);
  const elem = (tag, cls, label) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (label !== undefined) el.textContent = String(label);
    return el;
  };
  const getMetric = (card, wanted) => {
    const labels = Array.from(card.querySelectorAll('.article-kpi'));
    const item = labels.find(el => wanted.some(name => text(el.querySelector('.article-kpi-label')).toLowerCase() === name.toLowerCase()));
    return item ? numeric(text(item.querySelector('.article-kpi-value'))) : null;
  };
  const getMeta = card => Array.from(card.querySelectorAll('.article-card-meta > span')).map(text);
  const postStatus = card => text(card.querySelector('.state-pill')) || '—';
  const findPrice = card => {
    const price = getMeta(card).find(val => /^\$\s*[\d,]+(?:\.\d+)?$/.test(val));
    return numeric(price);
  };
  const findArticleLabel = card => getMeta(card).find(v => /^(?:ARTICLE\s+[\d.]+|X post|GTA VI(?: V2)? post)$/i.test(v)) || 'Article';
  const fromCode = card => card.dataset.placementCode || card.dataset.detail || card.dataset.homeCode || getMeta(card).find(val => /^(?:GTA[12]-R\d+|A\d{2}-P\d+|OF\d+)$/i.test(val)) || '';
  const firstLink = (source, match) => {
    const a = Array.from(source.querySelectorAll('a[href]')).find(el => match(text(el)));
    return a ? safe(a.getAttribute('href')) : '';
  };

  // The existing dashboard GET response contains verified profile and post URLs.
  // One read-only request is reused across the table views. Never call /r/ or /of/.
  let lookups = new Map(), profiles = new Map(), lookupVersion = 0, lookupLoading = null, lookedUp = false;
  function loadLookups() {
    if (lookupLoading || lookedUp) return lookupLoading;
    lookedUp = true;
    lookupLoading = fetch('/.netlify/functions/dashboard', {method: 'GET', cache: 'no-store', headers: {accept: 'application/json'}})
      .then(r => r.ok ? r.json() : null).then(data => {
        if (!Array.isArray(data?.placements)) return;
        const codes = new Map(), pubs = new Map();
        for (const p of data.placements) {
          if (p?.code) codes.set(p.code, p);
          if (p?.publisher && p.profileUrl) pubs.set(String(p.publisher).toLowerCase(), p.profileUrl);
        }
        lookups = codes; profiles = pubs; lookupVersion++;
        queueRefresh();
      }).catch(() => { /* Keep the original detail modal as the safe fallback. */ })
      .finally(() => { lookupLoading = null; });
    return lookupLoading;
  }
  const cachedGta = () => {
    try {
      const obj = JSON.parse(localStorage.getItem('xtracker-gta-report-qrts-v1') || 'null');
      return obj?.ready && Array.isArray(obj.publishers) ? new Map(obj.publishers.map(p => [p.code, p])) : new Map();
    } catch { return new Map(); }
  };

  function parseArticle(card, source, idx) {
    const code = fromCode(card), p = lookups.get(code) || {};
    const pub = text(card.querySelector('.article-publisher')) || p.publisher || 'Unknown account';
    const clicks = getMetric(card, ['UTM clicks', 'Week UTM clicks', 'Weekly clicks', 'Clicks']);
    const views = getMetric(card, ['Views', 'X views']);
    const likes = getMetric(card, ['Likes']);
    const cost = numeric(p.cost) ?? findPrice(card);
    const label = findArticleLabel(card);
    const campaign = text(card.querySelector('.article-campaign-chip'));
    const status = postStatus(card);
    const payment = typeof p.paid === 'boolean' ? (p.paid ? 'Paid' : 'Unpaid') :
      /\bpaid\b/i.test(status) && !/unpaid/i.test(status) || card.classList.contains('paid-article') || source.classList.contains('is-paid') ? 'Paid' :
      /unpaid/i.test(status) || card.classList.contains('unpaid-article') ? 'Unpaid' : '—';
    const originalCheckbox = source.querySelector(`input[data-select-placement="${CSS.escape(code)}"]`);
    return {key:code || 'card-' + idx, kind:'article', account:pub, subtitle:campaign, label, code, clicks, views, likes, price:cost,
      cpc: clicks != null && clicks > 0 && cost != null ? cost / clicks : null,
      status,payment, accountUrl:safe(p.profileUrl) || firstLink(source,t => /profile/i.test(t)),
      postUrl:card.dataset.postUrl !== undefined ? safe(card.dataset.postUrl) : safe(p.postUrl) || (card.tagName === 'A' && /x\.com|twitter\.com/i.test(card.href) ? safe(card.getAttribute('href')) : '') || firstLink(source,t => /post/i.test(t)),
      draftUrl:safe(p.articleUrl) || (card.tagName === 'A' && /docs\.google\.com/i.test(card.href) ? safe(card.getAttribute('href')) : ''),
      source:card, checkbox:originalCheckbox || null};
  }
  function parsePromo(wrapper, kind, idx, gtaByCode) {
    const card = wrapper.querySelector('.article-card');
    if (!card) return null;
    const code = fromCode(card), measured = lookups.get(code) || {}, source = gtaByCode?.get(code) || {...measured, views:measured.xViews, likes:measured.xLikes, reposts:measured.xShares, replies:measured.xComments};
    const account = source.publisher || text(card.querySelector('.article-publisher')) || 'Unknown account';
    const price = numeric(source.cost) ?? findPrice(card);
    const posted = source.posted === true || (!Object.prototype.hasOwnProperty.call(source, 'posted') && /posted/i.test(postStatus(card)));
    const accountUrl = safe(source.profileUrl) || firstLink(wrapper, t => /profile/i.test(t));
    const postUrl = card.dataset.postUrl !== undefined ? safe(card.dataset.postUrl) : safe(source.postUrl) || firstLink(wrapper, t => /view post|post on x/i.test(t)) || safe(card.getAttribute('href'));
    const base = {key: code || String(idx), account, price, posted, status: posted ? 'Posted' : '—', accountUrl,
       postUrl, source: card, campaign:source.campaign || (code.startsWith('GTA2') ? 'V2' : 'Original'), code};
    if (kind === 'gta' || kind === 'of') {
      const views = numeric(source.views) ?? getMetric(card, ['X views', 'Views']);
      const likes = numeric(source.likes) ?? getMetric(card, ['Likes']);
      const rts = numeric(source.reposts); // No guessed RTs. Source must supply them.
      const replies = numeric(source.replies);
      const complete = [likes,rts,replies].every(Number.isFinite);
      const total = complete ? likes + rts + replies : null;
      return {...base, kind, views, likes, rts, replies, interactions:total,
         ...(kind==='gta'?{tracked:source.clickTracked!==false&&(!!source.trackingUrl||card.dataset.shortioTracked==='true'),clicks:posted?(numeric(source.allTimeClicks)):null,cpc:posted?(numeric(source.cpc)??numeric(card.dataset.shortioCpc)):null,clickNote:source.clickError||card.dataset.shortioNote||(source.clickAt?'All-time human clicks · verified '+source.clickAt:'No verified Short.io reading')} : {clicks:getMetric(card, ['Week UTM clicks', 'Weekly clicks'])}),
         cpi:total != null && total > 0 && price != null ? price / total : null,
         subtitle:kind==='of'?'OF Terms':source.campaign==='GTAQ'||code.startsWith('GTAQ')?'QRT':source.campaign === 'GTA2' || code.startsWith('GTA2') ? 'V2' : 'Original'};
    }
    const clicks = getMetric(card, ['UTM clicks']);
    const weekClicks = getMetric(card, ['Week UTM clicks', 'Weekly clicks']);
    return {...base,kind,clicks,weekClicks,cpc:clicks != null && clicks > 0 && price != null ? price / clicks : null};
  }
  function parseCampaign(details, idx) {
    const summary = details.matches('.campaign-summary') ? details : details.querySelector('.campaign-summary');
    const name = text(summary?.querySelector('.campaign-name-heading')).replace(/\.$/, '');
    const values = new Map();
    details.querySelectorAll('.campaign-summary-metrics > span').forEach(el => values.set(text(el.querySelector('small')).toLowerCase(), numeric(text(el.querySelector('strong')))));
    const clicks = values.get('utm clicks') ?? numeric(text(summary?.querySelector('.campaign-summary-clicks strong')));
    const price = values.get('paid total') ?? null;
    const views = values.get('views recorded') ?? null;
    const posted = values.get('posted') ?? null;
    const placements = details.querySelectorAll('.campaign-entry').length;
    const cost = clicks != null && clicks > 0 && price != null ? price / clicks : null;
    const href = details.tagName === 'A' ? details.getAttribute('href') : '';
    return {key:details.dataset.campaignKey || 'campaign-' + idx,kind:'campaign',name,posted,placements,clicks,views,price,cpc:cost,source:details,href};
  }
  function collect(root, kind) {
    if (kind === 'campaign') return Array.from(root.querySelectorAll(':scope > .campaign-accordion')).map(parseCampaign);
    if (kind === 'article') return Array.from(root.querySelectorAll('.article-card')).map((card,i) => parseArticle(card,card.closest('.placement-shell') || card,i));
    const gtaByCode = kind === 'gta' ? cachedGta() : null;
    return Array.from(root.querySelectorAll(':scope > .of-publisher-entry')).map((e,i)=>parsePromo(e,kind,i,gtaByCode)).filter(Boolean);
  }
  function signature(root, kind) {
    // Production re-renders source containers. Keep overlay in sync without touching the feed.
    const html = root.innerHTML;
    let hash = 2166136261;
    for (let i = 0; i < html.length; i++) hash = Math.imul(hash ^ html.charCodeAt(i), 16777619);
    return `${kind}|${html.length}|${hash >>> 0}|${kind === 'article' || kind === 'of' ? lookupVersion : ''}`;
  }
  const schemas = {
    article:[
      {key:'account', title:'Account'}, {key:'label',title:'Article'}, {key:'postUrl',title:'Post'},
      {key:'clicks',title:'UTM clicks'}, {key:'cpc',title:'CPC'}, {key:'views',title:'Views'},
      {key:'likes',title:'Likes'}, {key:'price',title:'Price'}, {key:'payment',title:'Payment'}, {key:'status',title:'Status'}
    ],
    gta:[
      {key:'account',title:'Account'}, {key:'postUrl',title:'Post'}, {key:'price',title:'Spend'},
      {key:'views',title:'Views'}, {key:'clicks',title:'All-time clicks'}, {key:'interactions',title:'Total interactions'},
      {key:'likes',title:'Likes'}, {key:'rts',title:'RTs'}, {key:'replies',title:'Replies'}
    ],
    of:[
      {key:'account',title:'Account'}, {key:'postUrl',title:'Post'}, {key:'price',title:'Spend'},
      {key:'views',title:'Views'}, {key:'clicks',title:'UTM clicks'}, {key:'interactions',title:'Total interactions'},
      {key:'likes',title:'Likes'}, {key:'rts',title:'RTs'}, {key:'replies',title:'Replies'}
    ],
    campaign:[
      {key:'name',title:'Campaign'}, {key:'posted',title:'Posted'}, {key:'placements',title:'Placements'},
      {key:'clicks',title:'UTM clicks'}, {key:'views',title:'Views'}, {key:'price',title:'Spend'}, {key:'cpc',title:'CPC'}
    ]
  };
  function isNumberKey(key) {return ['clicks','weekClicks','views','likes','rts','replies','interactions','price','cpi','cpc','posted','placements'].includes(key);}
  function sortRows(rows, view) {
    if (!view.sortKey) return rows;
    const key = view.sortKey, dir = view.sortDir;
    return rows.map((row,index)=>({row,index})).sort((a,b)=>{
      const av=a.row[key],bv=b.row[key], missingA=av === null || av === undefined || av === '',missingB=bv===null||bv===undefined||bv==='';
      if (missingA!==missingB) return missingA ? 1 : -1;
      if (missingA && missingB) return a.index-b.index;
      const cmp = isNumberKey(key) ? Number(av)-Number(bv) : String(av).localeCompare(String(bv),'en-GB',{numeric:true,sensitivity:'base'});
      return (cmp * dir) || a.index-b.index;
    }).map(x=>x.row);
  }
  function link(url, label, extraClass) {
    const href=safe(url);if(!href)return elem('span','xt-missing','—');
    const a=elem('a','xt-cell-link '+(extraClass||''),label);
    a.href=href;a.target='_blank';a.rel='noopener noreferrer';
    a.addEventListener('click', e=>e.stopPropagation());
    return a;
  }
  function makeCell(row, col, kind) {
    const td = elem('td', isNumberKey(col.key) ? 'xt-number' : 'xt-text');
    const key=col.key,value=row[key];
    if(kind==='gta'&&(key==='clicks'||key==='cpc'))td.title=row.clickNote||'No verified Short.io reading';
    if(kind==='gta'&&(key==='clicks'||key==='cpc')&&value==null){
      td.textContent='—';
      if(!row.tracked)td.title='No tracking link in the source sheet for this post.';
      return td;
    }
    if (key==='account') {
      td.appendChild(row.accountUrl ? link(row.accountUrl,row.account,'xt-account-link') : elem('strong','xt-account-name',row.account));
      if (row.subtitle) td.appendChild(elem('small','xt-account-subtitle',row.subtitle));
      return td;
    }
    if (key==='name') {
      if(row.href){const a=elem('a','xt-row-name',row.name || 'Campaign');a.href=row.href;td.appendChild(a);return td;}
      const label=elem('button','xt-row-name',row.name || 'Campaign');label.type='button';label.addEventListener('click',e=>{e.stopPropagation();toggleCampaign(row,td.closest('.xt-table-wrap'));});td.appendChild(label);return td;
    }
    if (key==='label') {td.appendChild(elem('span','xt-title-cell',value || '—'));return td;}
    if (key==='postUrl') {
      if(row.postUrl) td.appendChild(link(row.postUrl,'View post'));
      else if(row.draftUrl) td.appendChild(link(row.draftUrl,'View draft'));
      else td.appendChild(elem('span','xt-missing','—'));
      return td;
    }
    if (key==='status' || key==='payment') {
      const status=elem('span','xt-state '+(/posted|published/i.test(value)?'xt-state-posted':'xt-state-pending'),value || '—');td.appendChild(status);return td;
    }
    if (key==='cpc') td.textContent=formatCPC(value);
    else if (key==='cpi') td.textContent=formatCPI(value);
    else if (key==='price') td.textContent=formatUSD(value);
    else td.textContent=formatNum(value);
    return td;
  }
  function openArticleDetails(row) {
    const original = row.code ? document.querySelector('#trackerList [data-detail=\"' + CSS.escape(row.code) + '\"]') : null;
    if (original) original.click();
    else row.source?.click();
  }
  function addSelectCell(row, tr) {
    const td=elem('td','xt-select-cell');
    if(row.checkbox){
      const input=elem('input');input.type='checkbox';input.className='xt-row-select';input.checked=row.checkbox.checked;
      input.setAttribute('aria-label','Select '+row.account);
      input.addEventListener('click',e=>e.stopPropagation());
      input.addEventListener('change',()=>{if(row.checkbox.checked!==input.checked)row.checkbox.click();input.checked=row.checkbox.checked;});
      td.appendChild(input);
    }
    tr.appendChild(td);
  }
  function makeTable(view, root, rows, kind) {
    const table=elem('table','xt-data-table');table.setAttribute('aria-label',kind==='gta'?'GTA VI publisher performance':kind==='of'?'OF Terms publisher performance':kind==='campaign'?'Campaign performance':'Article performance');
    if(kind==='gta'||kind==='of'){
      const columns=elem('colgroup');
      for(const width of [22,10,10,11,12,12,8,7,8]){
        const column=elem('col');column.style.width=width+'%';columns.appendChild(column);
      }
      table.appendChild(columns);
    }
    const thead=elem('thead'),headRow=elem('tr');
    if (kind==='article' && root.id==='trackerList') {
      const th=elem('th','xt-select-col','');th.scope='col';th.title='Select placements';headRow.appendChild(th);
    }
    for(const col of schemas[kind]){
      const th=elem('th','xt-sort-th'+(isNumberKey(col.key)?' xt-numeric-th':''));th.scope='col';
      th.setAttribute('aria-sort',view.sortKey===col.key ? (view.sortDir>0?'ascending':'descending'):'none');
      const button=elem('button','xt-sort-button',col.title);button.type='button';
      button.title='Sort by '+col.title;
      button.addEventListener('click',()=>{view.sortDir=view.sortKey===col.key?-view.sortDir:(isNumberKey(col.key)?-1:1);view.sortKey=col.key;renderView(root,kind,true);});
      th.appendChild(button);headRow.appendChild(th);
    }
    thead.appendChild(headRow);table.appendChild(thead);
    const tbody=elem('tbody');let shown=0;
    const query=view.search.toLowerCase();
    for (const row of sortRows(rows,view)) {
      if (query && ![row.account,row.subtitle,row.label,row.name,row.code,row.status,row.campaign].join(' ').toLowerCase().includes(query)) continue;
      shown++;
      const tr=elem('tr','xt-record-row');tr.dataset.key=row.key;
      if(row.source && kind==='article') {
        tr.classList.add('xt-row-open');tr.tabIndex=0;tr.setAttribute('role','button');tr.setAttribute('aria-label','View '+row.account+' details');
        tr.addEventListener('click',e=>{if(e.target.closest('a,button,input,label'))return;openArticleDetails(row);});
        tr.addEventListener('keydown',e=>{if(e.target===tr&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openArticleDetails(row);}});
      }
      if(kind==='campaign') {
        tr.classList.add('xt-row-open');tr.tabIndex=0;tr.setAttribute('role','button');
        tr.setAttribute('aria-expanded',view.expanded===row.key?'true':'false');
        tr.addEventListener('click',e=>{if(e.target.closest('a,button,input'))return;toggleCampaign(row,view.mount);});
        tr.addEventListener('keydown',e=>{if(e.target===tr&&(e.key==='Enter'||e.key===' ')){e.preventDefault();toggleCampaign(row,view.mount);}});
      }
      if(kind==='article' && root.id==='trackerList')addSelectCell(row,tr);
      for(const col of schemas[kind]) tr.appendChild(makeCell(row,col,kind));
      tbody.appendChild(tr);
      if(kind==='campaign' && view.expanded===row.key){
        const detailTr=elem('tr','xt-detail-row'),td=elem('td');td.colSpan=schemas[kind].length;
        const expansion=row.source.querySelector('.campaign-expanded');
        if (expansion) {
          const clone=expansion.cloneNode(true);clone.classList.add('xt-cloned-expansion');
          clone.querySelectorAll('[data-detail]').forEach(btn=>{
            const original=row.source.querySelector(`[data-detail="${CSS.escape(btn.dataset.detail||'')}"]`);
            btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();original?.click();});
          });
          td.appendChild(clone);
        }
        detailTr.appendChild(td);tbody.appendChild(detailTr);
      }
    }
    if(!shown){
      const row=elem('tr','xt-no-results'),cell=elem('td','xt-empty',query?'No matching records':'No records available');
      cell.colSpan=schemas[kind].length+(kind==='article'&&root.id==='trackerList'?1:0);row.appendChild(cell);tbody.appendChild(row);
    }
    table.appendChild(tbody);
    return table;
  }
  function toggleCampaign(row, mount) {
    if(row.href){row.source.click();return;}
    const view=mount && mount.__xtView;
    if(!view)return;
    view.expanded=view.expanded===row.key?'':row.key;
    renderView(view.root,'campaign',true);
  }
  function renderView(root,kind,force=false) {
    if(!root || !root.isConnected)return;
    const key=root.id || (kind==='article' ? 'historical-'+root.closest('[data-week]')?.dataset.week : kind+'-'+text(root.closest('.of-publisher-section')?.querySelector('h2')));
    const hash=signature(root,kind);let view=roots.get(root);
    if (!force && view && view.signature===hash)return;
    const rows=collect(root,kind);
    if (!rows.length) {
      if(view?.mount)view.mount.remove();
      root.classList.remove('xt-source-hidden');roots.delete(root);return;
    }
    if (!view) {
      const mount=elem('div','xt-table-wrap');
      mount.setAttribute('role','region');mount.setAttribute('aria-label',kind==='article'?'Article table':kind==='gta'?'GTA VI table':kind==='of'?'OF Terms table':'Campaign table');
      mount.tabIndex=0;root.insertAdjacentElement('afterend',mount);
      view={sortKey:'',sortDir:1,search:'',expanded:'',scrollLeft:0,...savedViews.get(key),root,mount,signature:''};roots.set(root,view);savedViews.set(key,view);mount.__xtView=view;mount.dataset.viewKey=key;
    }
    view.signature=hash;
    const mount=view.mount;
    const oldScroll=mount.querySelector('.xt-table-scroll')?.scrollLeft ?? view.scrollLeft;
    const fragment=document.createDocumentFragment();
    if(['gta','of','campaign'].includes(kind) || (kind==='article'&&root.id==='trackerList')) {
      const search=elem('label','xt-search');
      search.appendChild(elem('span','xt-visually-hidden','Search table'));
      const input=elem('input');input.type='search';input.autocomplete='off';input.placeholder=kind==='campaign'?'Search campaigns':kind==='article'?'Search articles or accounts':'Search accounts';
      input.value=view.search;
      input.addEventListener('input',e=>{view.search=e.target.value;renderView(root,kind,true);const el=mount.querySelector('.xt-search input');el?.focus();if(el)el.setSelectionRange(view.search.length,view.search.length);});
      search.appendChild(input);fragment.appendChild(search);
    }
    const scroll=elem('div','xt-table-scroll');scroll.addEventListener('scroll',()=>{view.scrollLeft=scroll.scrollLeft;},{passive:true});scroll.appendChild(makeTable(view,root,rows,kind));fragment.appendChild(scroll);
    mount.replaceChildren(fragment);scroll.scrollLeft=oldScroll;
    root.classList.add('xt-source-hidden');
  }
  function checkMounts() {
    const specs=[
      ['#trackerList','article'],['#weeklyGrid','article'],['#upcomingGrid','article'],['#page-historical .historical-cards','article'],
      ['#ofPublishers .of-publisher-grid','of'],['#gtaPublishers .of-publisher-grid','gta'],
      ['#campaignGrid','campaign']
    ];
    for(const [selector,kind] of specs){
      for(const root of document.querySelectorAll(selector)) renderView(root,kind);
    }
  }
  function addSourceLinks() {
    for(const tr of document.querySelectorAll('#boostRows tr[data-boost]')){
      const cell=tr.querySelector('td:first-child');if(!cell||cell.querySelector('.xt-original-links'))continue;
      const id=tr.dataset.boost,handle=text(cell.querySelector('small')).replace(/^@/,'').trim();
      if(!/^\d+$/.test(id)||!/^[\w]{1,15}$/.test(handle))continue;
      const group=elem('div','xt-original-links');
      group.appendChild(link('https://x.com/'+handle,'X profile'));
      group.appendChild(link('https://x.com/'+handle+'/status/'+id,'View post'));
      cell.appendChild(group);
    }
  }
  function compareCell(a,b,direction) {
    const x=text(a),y=text(b),nx=numeric(x),ny=numeric(y);
    if(nx!==null||ny!==null){if(nx===null)return 1;if(ny===null)return -1;return (nx-ny)*direction;}
    const dx=Date.parse(x),dy=Date.parse(y);
    if(Number.isFinite(dx)&&Number.isFinite(dy))return(dx-dy)*direction;
    return x.localeCompare(y,'en-GB',{numeric:true,sensitivity:'base'})*direction;
  }
  function applyNativeSort(table) {
    const state=nativeTables.get(table);if(!state?.key && state?.key!==0)return;
    const tbody=table.tBodies[0],tr=tbody?Array.from(tbody.rows):[];
    if(!tbody||tr.length<2)return;
    const sorted=tr.map((row,i)=>({row,i})).sort((a,b)=>compareCell(a.row.cells[state.key],b.row.cells[state.key],state.direction)||a.i-b.i).map(x=>x.row);
    if(sorted.every((row,i)=>row===tr[i]))return;
    for(const row of sorted)tbody.appendChild(row);
  }
  function nativeTable(table) {
    if(!table||!table.tHead||nativeTables.has(table))return;
    const ths=Array.from(table.tHead.querySelectorAll('th'));
    if(ths.length<2)return;
    const state={key:null,direction:1};nativeTables.set(table,state);
    ths.forEach((th,i)=>{
      const name=text(th);if(!name)return;
      th.classList.add('xt-sort-th');th.setAttribute('aria-sort','none');
      const btn=elem('button','xt-sort-button',name);btn.type='button';th.replaceChildren(btn);
      btn.addEventListener('click',()=>{
        state.direction=state.key===i?-state.direction:(/views|likes|repost|clicks|spent|spend|rate|cost|engagement|total/i.test(name)?-1:1);
        state.key=i;
        ths.forEach((header,index)=>header.setAttribute('aria-sort',index===i?(state.direction>0?'ascending':'descending'):'none'));
        applyNativeSort(table);
      });
    });
  }
  function enhanceNativeTables() {
    for(const el of document.querySelectorAll('#page-accounts .account-table, #page-x-rts .account-table, #page-of .of-daily-table .account-table, #page-gta-vi .of-daily-table .account-table, #page-stats .daily-totals-table')){
      nativeTable(el);applyNativeSort(el);
    }
    addSourceLinks();
  }
  const arrow='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19 12H5m7-7-7 7 7 7"></path></svg>';
  function fixBackArrows() {
    for(const btn of document.querySelectorAll('.site-page .page-back-button')){
      if(!btn.querySelector('svg'))btn.innerHTML=arrow;
    }
  }
  let frame=0;
  function refresh() {
    frame=0;
    fixBackArrows();checkMounts();enhanceNativeTables();
  }
  function queueRefresh() {if(frame)return;frame=requestAnimationFrame(refresh);}
  function start() {
    if(!document.getElementById('mainContent'))return;
    refresh();loadLookups();
    new MutationObserver(queueRefresh).observe(document.getElementById('mainContent'),{subtree:true,childList:true,characterData:true});
    window.addEventListener('hashchange',queueRefresh);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
