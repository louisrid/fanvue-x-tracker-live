/* Campaign manager (SPECS §4.1, DESIGN §4.10): campaigns added from the dashboard,
   their sidebar rows and pages, and the right-side editor. Reads GET campaign-registry;
   writes go through the existing "Unlock editing" step and app.js, which keeps the
   admin key in memory only. Every user-entered value is escaped on render. */
(function(){
  'use strict';
  const C=window.FanvueCore,U=window.FanvueUI,esc=C.escapeHtml,M=C.M;
  const ENDPOINT='/.netlify/functions/campaign-registry';
  const ICONS=['megaphone','sparkles','layers','gamepad','rocket','target','trending-up','video','image','mic','music','star',
    'heart','gift','tag','users','user-plus','link','globe','newspaper','book','graduation-cap','zap','flag'];
  const ICON_GLYPH={'trending-up':'trend','user-plus':'userplus','graduation-cap':'graduation'};
  const COLORS=['slate','blue','cyan','teal','green','amber','pink','violet'];
  const STATUSES=['Planned','Live','Paused','Ended'];
  const CURRENCIES=['USD','GBP','EUR'];
  const NOTE='Campaign details are visible to anyone with the dashboard link.';
  const glyph=name=>ICON_GLYPH[name]||name;
  const palette=key=>C.PALETTE[key]||C.PALETTE.slate;
  const statusTone={Live:'good',Paused:'warn',Ended:'',Planned:''};

  /* ---------- pure renderers (also used by tests) ---------- */
  const render={
    navItem(c,active){
      return '<a class="fv-nav-item" href="#campaign/'+encodeURIComponent(c.slug)+'" style="--fv-icon:'+esc(palette(c.color).icon)+'"'+(active?' aria-current="page"':'')+'>'+
        U.icon(glyph(c.icon),17)+'<span>'+esc(c.name)+'</span></a>';
    },
    chip(c){return '<span class="fv-campaign-chip" style="background:'+esc(palette(c.color).fill)+'" aria-hidden="true">'+U.icon(glyph(c.icon),15)+'</span>';},
    preview(c){
      return '<div class="fv-editor-preview" aria-hidden="true"><span class="fv-nav-item" style="--fv-icon:'+esc(palette(c.color).icon)+'">'+U.icon(glyph(c.icon||'megaphone'),17)+
        '<span>'+esc(c.name||'Campaign name')+'</span></span></div>';
    },
    info(c){
      const na=reason=>U.reasonButton('Not recorded',reason);
      const date=d=>d?esc(C.dayLong(d)):'';
      const dates=c.startDate||c.endDate?(date(c.startDate)||'Not set')+' – '+(date(c.endDate)||'Not set'):na('No dates recorded.');
      const budget=c.budget&&C.num(c.budget.amount)!==null?esc(new Intl.NumberFormat('en-GB',{style:'currency',currency:c.budget.currency||'USD'}).format(c.budget.amount))+' '+U.status('Budget, not spend'):na('No approved budget recorded.');
      const links=(c.links||[]).map(l=>{const href=C.safeUrl(l.url);return href?'<a class="fv-ext" href="'+esc(href)+'" target="_blank" rel="noopener noreferrer" aria-label="'+esc(l.label)+' (opens in a new tab)">'+esc(l.label)+U.icon('external',14)+'</a>':'';}).filter(Boolean);
      return U.supportPanel('Campaign Details','info',
        U.detailGrid([
          ['Status',U.status(c.status||'Planned',statusTone[c.status]||'')],['Dates',dates],['Owner',c.owner?esc(c.owner):na('No owner recorded.')],['Budget',budget]
        ])+
        (c.objective?'<div class="fv-info-block"><h3>Objective</h3><p>'+esc(c.objective).replace(/\n/g,'<br>')+'</p></div>':'')+
        (links.length?'<div class="fv-info-block"><h3>Links</h3><div class="fv-info-links">'+links.join('')+'</div></div>':'')+
        (c.notes?'<div class="fv-info-block"><h3>Notes</h3><p>'+esc(c.notes).replace(/\n/g,'<br>')+'</p></div>':'')+
        '<p class="fv-detail-note">'+(c.updatedAt?'Last updated '+esc(C.stamp(c.updatedAt))+' · ':'')+esc(NOTE)+'</p>');
    }
  };

  /* ---------- registry state ---------- */
  const reg={campaigns:[],builtIns:{},archived:[],loaded:false,error:''};
  const valid=d=>d?.ok===true&&Array.isArray(d.campaigns)&&d.builtIns&&typeof d.builtIns==='object';
  const saved=window.XTrackerLastGood?.read('campaign-registry',valid);
  if(saved?.payload){Object.assign(reg,{campaigns:saved.payload.campaigns,builtIns:saved.payload.builtIns});}
  function apply(data){reg.campaigns=data.campaigns;reg.builtIns=data.builtIns||{};if(Array.isArray(data.archived))reg.archived=data.archived;reg.loaded=true;reg.error='';}
  async function load(){
    try{
      const res=await fetch(ENDPOINT,{cache:'no-store',signal:AbortSignal.timeout(12000)});
      const data=await res.json();
      if(!res.ok||!valid(data))throw new Error(data?.error||'Campaign registry unavailable');
      apply(data);window.XTrackerLastGood?.write('campaign-registry',{ok:true,campaigns:data.campaigns,builtIns:data.builtIns},valid);
    }catch(e){reg.error=String(e.message||e);reg.loaded=true;}
    window.FanvueApp?.rerender?.(true);
    return !reg.error;
  }
  const find=slug=>reg.campaigns.find(c=>c.slug===slug)||null;
  const app=()=>window.XTrackerApp;
  const unlocked=()=>Boolean(app()?.isUnlocked?.());

  /* ---------- added campaign page ---------- */
  function addedPage(slug){
    const c=find(slug);
    if(!c&&!reg.loaded)return {title:'Campaign',refreshLabel:'',body:U.strip(['Spend','Post views','Tracked clicks','Creator signups','KYC completions','Earning creators'].map(l=>({label:l,icon:'wallet',metric:M.loading()})))};
    if(!c)return null;
    const D=window.FanvueApp.data,ov=D.overview(),xa=D.campaign('x-articles');
    const linked=c.dataLink?(xa?.sourceCampaigns||[]).find(s=>s.id===c.dataLink):null;
    const nc=M.notConnected('Not connected: this campaign has no data source yet.');
    const linkNote=linked?'Linked: '+(linked.name||c.dataLink):undefined;
    const strip=U.strip([
      {label:'Spend',icon:'wallet',format:'moneyShort',metric:linked?(C.num(linked.paidSpendKnown)===null?M.na('No paid placements recorded.'):M.value(linked.paidSpendKnown)):nc,note:linkNote},
      {label:'Post views',icon:'eye',format:'compact',metric:linked?(C.num(linked.xViews)===null?M.na('No verified X reading yet.'):M.value(linked.xViews)):nc},
      {label:'Tracked clicks',icon:'cursor',metric:linked?(C.num(linked.trackedClicks)===null?M.na('No tracked clicks recorded.'):M.value(linked.trackedClicks,{reason:'Site redirect clicks for the linked article campaign.'})):nc},
      {label:'Creator signups',icon:'user',metric:M.notConnected(C.OUTCOME_REASON)},
      {label:'KYC completions',icon:'shield',metric:M.notConnected(C.OUTCOME_REASON)},
      {label:'Earning creators',icon:'check',metric:M.notConnected(C.OUTCOME_REASON)}
    ]);
    const chart=U.chartPanel({id:'added-chart',empty:{title:'History',reason:linked?'Weekly history for linked article campaigns is shown on X Articles.':'No data source connected yet, so there is no history.'}},{});
    const rows=linked?(xa?.rows||[]).filter(r=>r.campaignId===c.dataLink):[];
    const table=U.tablePanel({id:'added-placements',title:'Listings',icon:'layers',age:window.FanvueApp.publicationAge,hideEmpty:false,rows,rowKey:r=>r.code,rowLabel:r=>r.publisher,search:rows.length>8,minWidth:820,
      empty:linked?'No placements recorded for the linked campaign.':'No data source connected yet.',
      columns:window.FanvueApp.placementColumns({clicks:r=>C.num(r.clicks)===null?M.na('Click storage unavailable.'):M.value(r.clicks)})},
      window.FanvueApp.tableState('added:'+slug,'added-placements'));
    return {title:c.name,chipHtml:render.chip(c),refreshLabel:'Refresh',updated:ov?.checkedAt,navKey:'campaign/'+slug,
      body:strip+chart+table+render.info(c)};
  }

  /* ---------- editor panel ---------- */
  let panel=null,opener=null;
  const blank=()=>({name:'',icon:'megaphone',color:'blue',status:'Planned',startDate:'',endDate:'',owner:'',objective:'',budget:{amount:'',currency:'USD'},links:[],notes:'',dataLink:''});
  const fromCampaign=c=>({...blank(),...structuredClone(c),budget:c.budget?{amount:String(c.budget.amount),currency:c.budget.currency}:{amount:'',currency:'USD'},links:(c.links||[]).map(l=>({...l}))});
  const builtInDef=key=>C.CAMPAIGNS.find(c=>c.key===key);
  function openPanel(target){
    opener=document.activeElement;
    const draft=target.type==='added'?fromCampaign(find(target.slug)):target.type==='builtIn'?
      fromCampaign({...{icon:'megaphone',color:builtInDef(target.key).color==='white'?'slate':builtInDef(target.key).color},...(reg.builtIns[target.key]||{}),name:builtInDef(target.key).name}):blank();
    panel={mode:target.type==='manage'?'manage':'form',target,draft,errors:{},saving:false,confirmArchive:false,message:''};
    draw();
    requestAnimationFrame(()=>document.querySelector('#fvEditor [data-autofocus]')?.focus());
  }
  function closePanel(){
    panel=null;const host=document.getElementById('fvEditorHost');if(host)host.innerHTML='';
    document.body.classList.remove('fv-editor-open');
    if(opener?.isConnected)opener.focus();
  }
  const field=(label,id,control,help='')=>'<div class="fv-field" data-field="'+id+'"><label for="fve-'+id+'">'+esc(label)+'</label>'+control+
    (help?'<small>'+esc(help)+'</small>':'')+'<p class="fv-field-error" id="fve-'+id+'-error" role="alert">'+esc(panel.errors[id]||'')+'</p></div>';
  const input=(id,value,attrs='')=>'<input id="fve-'+id+'" data-input="'+id+'" value="'+esc(value??'')+'" aria-describedby="fve-'+id+'-error" '+attrs+'>';
  function formHtml(){
    const d=panel.draft,t=panel.target,builtIn=t.type==='builtIn',existing=t.type==='added';
    const title=builtIn?'Edit '+builtInDef(t.key).name:existing?'Edit campaign':'Add campaign';
    const dash=window.FanvueApp.data.campaign('x-articles');
    const sources=(dash?.sourceCampaigns||[]).filter(s=>s.placements>0);
    return '<div class="fv-editor-head"><h2 id="fvEditorTitle">'+esc(title)+'</h2><div class="fv-editor-head-tools">'+
      '<button type="button" class="fv-link-button" data-editor="manage">Manage Campaigns</button>'+
      '<button type="button" class="fv-icon-button" data-editor="close" aria-label="Close editor">'+U.icon('close',18)+'</button></div></div>'+
      '<div class="fv-editor-body">'+
      '<div id="fveePreview">'+render.preview(d)+'</div>'+
      (builtIn?'<p class="fv-editor-hint">Built-in campaigns keep their name, order and data. You can change the icon, colour and campaign info.</p>':
        field('Name','name',input('name',d.name,'type="text" maxlength="40" required autocomplete="off" data-autofocus'),'Up to 40 characters.'))+
      '<div class="fv-field" data-field="icon"><span class="fv-field-label" id="fve-icon-label">Icon</span><div class="fv-icon-grid" role="radiogroup" aria-labelledby="fve-icon-label">'+
        ICONS.map(i=>'<button type="button" role="radio" aria-checked="'+(d.icon===i)+'" data-choice="icon" data-value="'+i+'" aria-label="'+esc(i.replace(/-/g,' '))+'"'+(builtIn&&i===d.icon?' data-autofocus':'')+'>'+U.icon(glyph(i),17)+'</button>').join('')+'</div>'+
        '<p class="fv-field-error" role="alert">'+esc(panel.errors.icon||'')+'</p></div>'+
      '<div class="fv-field" data-field="color"><span class="fv-field-label" id="fve-color-label">Colour</span><div class="fv-swatches" role="radiogroup" aria-labelledby="fve-color-label">'+
        COLORS.map(k=>'<button type="button" role="radio" aria-checked="'+(d.color===k)+'" data-choice="color" data-value="'+k+'" style="--sw:'+palette(k).fill+'"><span class="fv-sr">'+palette(k).label+'</span></button>').join('')+'</div>'+
        '<p class="fv-field-error" role="alert">'+esc(panel.errors.color||'')+'</p></div>'+
      '<div class="fv-field" data-field="status"><span class="fv-field-label" id="fve-status-label">Status</span><div class="fv-segments" role="radiogroup" aria-labelledby="fve-status-label">'+
        STATUSES.map(s=>'<button type="button" role="radio" aria-checked="'+(d.status===s)+'" aria-pressed="'+(d.status===s)+'" data-choice="status" data-value="'+s+'">'+s+'</button>').join('')+'</div></div>'+
      '<div class="fv-field-row">'+field('Start date','startDate',input('startDate',d.startDate,'type="date"'))+field('End date','endDate',input('endDate',d.endDate,'type="date"'))+'</div>'+
      field('Owner','owner',input('owner',d.owner,'type="text" maxlength="80" autocomplete="off"'))+
      field('Objective','objective','<textarea id="fve-objective" data-input="objective" rows="3" maxlength="500" aria-describedby="fve-objective-error">'+esc(d.objective)+'</textarea>','Up to 500 characters.')+
      '<div class="fv-field-row">'+field('Budget','budget',input('budget',d.budget.amount,'type="text" inputmode="decimal" placeholder="Optional" autocomplete="off"'),'A budget, not spend.')+
        field('Currency','budgetCurrency','<select id="fve-budgetCurrency" data-input="budgetCurrency">'+CURRENCIES.map(c=>'<option'+(d.budget.currency===c?' selected':'')+'>'+c+'</option>').join('')+'</select>')+'</div>'+
      '<div class="fv-field" data-field="links"><span class="fv-field-label">Links</span><div class="fv-links-edit">'+
        d.links.map((l,i)=>'<div class="fv-link-row"><input aria-label="Link '+(i+1)+' label" data-link="'+i+'" data-part="label" value="'+esc(l.label)+'" maxlength="40" placeholder="Label">'+
          '<input aria-label="Link '+(i+1)+' address" data-link="'+i+'" data-part="url" value="'+esc(l.url)+'" maxlength="500" placeholder="https://" inputmode="url">'+
          '<button type="button" class="fv-icon-button" data-editor="remove-link" data-index="'+i+'" aria-label="Remove link '+(i+1)+'">'+U.icon('close',15)+'</button>'+
          '<p class="fv-field-error" role="alert">'+esc(panel.errors['links.'+i+'.label']||panel.errors['links.'+i+'.url']||'')+'</p></div>').join('')+
        (d.links.length<6?'<button type="button" class="fv-control" data-editor="add-link">'+U.icon('plus',14)+'Add link</button>':'')+'</div>'+
        '<p class="fv-field-error" role="alert">'+esc(panel.errors.links||'')+'</p></div>'+
      field('Notes','notes','<textarea id="fve-notes" data-input="notes" rows="3" maxlength="2000" aria-describedby="fve-notes-error">'+esc(d.notes)+'</textarea>')+
      (builtIn?'':field('Data Source','dataLink','<select id="fve-dataLink" data-input="dataLink"><option value="">None (not connected)</option>'+
        sources.map(s=>'<option value="'+esc(s.id)+'"'+(d.dataLink===s.id?' selected':'')+'>'+esc(s.name||s.id)+'</option>').join('')+'</select>',
        'Optional. Shows placements from an existing article campaign. Linked campaigns never change Home totals.'))+
      '<p class="fv-editor-note">'+U.icon('info',14)+esc(NOTE)+'</p>'+
      '<p class="fv-editor-message" role="status">'+esc(panel.message)+'</p>'+
      '</div><div class="fv-editor-foot">'+
      (existing?(panel.confirmArchive?'<span class="fv-confirm">Archive this campaign? It can be restored later. <button type="button" class="fv-link-button is-danger" data-editor="archive-confirm">Archive</button> <button type="button" class="fv-link-button" data-editor="archive-cancel">Keep</button></span>':
        '<button type="button" class="fv-link-button" data-editor="archive">Archive</button>'):'<span></span>')+
      '<span class="fv-foot-actions"><button type="button" class="fv-control" data-editor="close">Cancel</button><button type="button" class="fv-control is-primary" data-editor="save"'+(panel.saving?' disabled':'')+'>'+(panel.saving?'Saving…':'Save')+'</button></span></div>';
  }
  function manageHtml(){
    const row=(c,i,n)=>'<li class="fv-manage-row">'+render.chip(c)+'<span class="fv-manage-name">'+esc(c.name)+'</span>'+
      '<button type="button" class="fv-icon-button" data-editor="up" data-slug="'+esc(c.slug)+'" aria-label="Move '+esc(c.name)+' up"'+(i===0?' disabled':'')+'>'+U.icon('up',15)+'</button>'+
      '<button type="button" class="fv-icon-button" data-editor="down" data-slug="'+esc(c.slug)+'" aria-label="Move '+esc(c.name)+' down"'+(i===n-1?' disabled':'')+'>'+U.icon('down',15)+'</button>'+
      '<button type="button" class="fv-link-button" data-editor="edit" data-slug="'+esc(c.slug)+'">Edit</button></li>';
    const builtIns=C.CAMPAIGNS.map(b=>{const o=reg.builtIns[b.key]||{};return '<li class="fv-manage-row">'+render.chip({icon:o.icon||(b.icon==='x'?'xmark':b.icon),color:o.color||b.color})+
      '<span class="fv-manage-name">'+esc(b.name)+'</span><button type="button" class="fv-link-button" data-editor="edit-builtin" data-key="'+b.key+'">Edit</button></li>';}).join('');
    return '<div class="fv-editor-head"><h2 id="fvEditorTitle">Manage Campaigns</h2><div class="fv-editor-head-tools">'+
      '<button type="button" class="fv-icon-button" data-editor="close" aria-label="Close editor">'+U.icon('close',18)+'</button></div></div>'+
      '<div class="fv-editor-body"><button type="button" class="fv-control is-primary" data-editor="new" data-autofocus>'+U.icon('plus',14)+'Add campaign</button>'+
      '<h3 class="fv-manage-title">Added campaigns</h3>'+(reg.campaigns.length?'<ol class="fv-manage-list">'+reg.campaigns.map((c,i)=>row(c,i,reg.campaigns.length)).join('')+'</ol>':'<p class="fv-editor-hint">No campaigns added yet.</p>')+
      '<details class="fv-archived"'+(reg.archived.length?'':' hidden')+'><summary>Archived ('+reg.archived.length+')</summary><ul class="fv-manage-list">'+
        reg.archived.map(c=>'<li class="fv-manage-row">'+render.chip(c)+'<span class="fv-manage-name">'+esc(c.name)+'</span><button type="button" class="fv-link-button" data-editor="restore" data-slug="'+esc(c.slug)+'">Restore</button></li>').join('')+'</ul></details>'+
      '<h3 class="fv-manage-title">Built-in campaigns</h3><ul class="fv-manage-list">'+builtIns+'</ul>'+
      '<p class="fv-editor-note">'+U.icon('info',14)+esc(NOTE)+'</p><p class="fv-editor-message" role="status">'+esc(panel.message)+'</p></div>';
  }
  function draw(){
    let host=document.getElementById('fvEditorHost');
    if(!host){host=document.createElement('div');host.id='fvEditorHost';document.body.appendChild(host);}
    document.body.classList.add('fv-editor-open');
    host.innerHTML='<div class="fv-editor-scrim" data-editor="close"></div><aside class="fv-editor" id="fvEditor" role="dialog" aria-modal="true" aria-labelledby="fvEditorTitle">'+
      (panel.mode==='manage'?manageHtml():formHtml())+'</aside>';
  }
  function payload(){
    const d=panel.draft;
    return {name:d.name,icon:d.icon,color:d.color,status:d.status,startDate:d.startDate,endDate:d.endDate,owner:d.owner,objective:d.objective,
      budget:String(d.budget.amount).trim()===''?null:{amount:String(d.budget.amount).trim(),currency:d.budget.currency},
      links:d.links.filter(l=>l.label.trim()||l.url.trim()),notes:d.notes,dataLink:d.dataLink};
  }
  // Client-side checks mirror the server; the server remains the authority.
  function check(p,builtIn){
    const e={};
    if(!builtIn&&!p.name.trim())e.name='Required.';
    if(!builtIn&&p.name.trim().length>40)e.name='Use 40 characters or fewer.';
    if(p.startDate&&p.endDate&&p.endDate<p.startDate)e.endDate='End date is before the start date.';
    if(p.objective.length>500)e.objective='Use 500 characters or fewer.';
    if(p.budget&&!/^\d{1,10}(?:\.\d{1,2})?$/.test(p.budget.amount))e.budget='Enter a number with up to two decimals.';
    p.links.forEach((l,i)=>{if(!l.label.trim())e['links.'+i+'.label']='Add a label.';else if(!/^https:\/\/[^\s]+$/i.test(l.url.trim()))e['links.'+i+'.url']='Only https:// links are allowed.';});
    return e;
  }
  function showErrors(){
    for(const node of document.querySelectorAll('#fvEditor .fv-field'))node.classList.remove('has-error');
    for(const [k,msg] of Object.entries(panel.errors)){
      const id=k.startsWith('links.')?'links':k;
      const f=document.querySelector('#fvEditor [data-field="'+id+'"]');if(!f)continue;
      f.classList.add('has-error');
      const out=f.querySelector('#fve-'+id+'-error')||f.querySelector('.fv-field-error');if(out)out.textContent=msg;
    }
    const first=Object.keys(panel.errors)[0];
    if(first){
      const link=first.match(/^links\.(\d+)\.(label|url)$/);
      const n=link?document.querySelector('#fvEditor [data-link="'+link[1]+'"][data-part="'+link[2]+'"]'):
        document.getElementById('fve-'+first)||document.querySelector('#fvEditor [data-field="'+CSS.escape(first)+'"] button');
      n?.focus();
    }
  }
  async function send(body){
    const res=await app().registryWrite(body);
    if(res.status===401){panel.message='Editing is locked again. Unlock and try once more.';return null;}
    if(!res.ok){if(res.field){panel.errors={[res.field]:res.error};}panel.message=res.error||'Could not save.';return null;}
    apply(res);window.XTrackerLastGood?.write('campaign-registry',{ok:true,campaigns:res.campaigns,builtIns:res.builtIns},valid);
    window.FanvueApp?.rerender?.(true);
    return res;
  }
  async function save(){
    if(panel.saving)return;
    const t=panel.target,builtIn=t.type==='builtIn',p=payload();
    panel.errors=check(p,builtIn);panel.message='';
    if(Object.keys(panel.errors).length){draw();showErrors();return;}
    panel.saving=true;draw();
    const body=builtIn?{action:'updateBuiltIn',key:t.key,campaign:p}:t.type==='added'?{action:'update',slug:t.slug,campaign:p}:{action:'create',campaign:p};
    let res=null;
    try{res=await send(body);}catch{panel.message='The registry is unavailable. Your changes are still here; try again.';}
    if(!panel)return;
    panel.saving=false;
    if(!res){draw();showErrors();return;}
    closePanel();
    if(t.type==='new'&&res.slug)location.hash='campaign/'+res.slug;
  }
  async function act(body,message){
    try{const res=await send(body);if(res)panel.message=message;}catch{panel.message='The registry is unavailable. Try again.';}
    if(panel)draw();
  }
  async function ensureUnlocked(){
    if(unlocked())return true;
    try{return await app().requestUnlock();}catch{return false;}
  }
  async function begin(target){
    if(!await ensureUnlocked())return;
    if(target.type==='manage'||target.type==='new'){
      try{const full=await app().registryWrite({action:'list'});if(full.ok)apply(full);}catch{}
    }
    openPanel(target);
  }

  function bind(){
  document.addEventListener('click',e=>{
    const add=e.target.closest('[data-fv-add]');if(add){e.preventDefault();void begin({type:'new'});return;}
    const edit=e.target.closest('[data-fv-edit]');
    if(edit){const [type,key]=edit.dataset.fvEdit.split(':');void begin(type==='builtIn'?{type,key}:{type:'added',slug:key});return;}
    if(!panel)return;
    const choice=e.target.closest('#fvEditor [data-choice]');
    if(choice){const d=panel.draft;d[choice.dataset.choice]=choice.dataset.value;
      for(const s of choice.parentElement.querySelectorAll('[data-choice]')){const on=s===choice;s.setAttribute('aria-checked',String(on));if(s.hasAttribute('aria-pressed'))s.setAttribute('aria-pressed',String(on));}
      document.getElementById('fveePreview').innerHTML=render.preview(d);return;}
    const b=e.target.closest('[data-editor]');if(!b)return;
    const a=b.dataset.editor,d=panel.draft;
    if(a==='close'){closePanel();return;}
    if(a==='manage'){panel.mode='manage';panel.message='';draw();return;}
    if(a==='new'){openPanel({type:'new'});return;}
    if(a==='edit'){openPanel({type:'added',slug:b.dataset.slug});return;}
    if(a==='edit-builtin'){openPanel({type:'builtIn',key:b.dataset.key});return;}
    if(a==='save'){void save();return;}
    if(a==='add-link'&&d.links.length<6){d.links.push({label:'',url:''});draw();document.querySelector('#fvEditor [data-link="'+(d.links.length-1)+'"][data-part="label"]')?.focus();return;}
    if(a==='remove-link'){d.links.splice(Number(b.dataset.index),1);draw();return;}
    if(a==='archive'){panel.confirmArchive=true;draw();document.querySelector('#fvEditor [data-editor="archive-cancel"]')?.focus();return;}
    if(a==='archive-cancel'){panel.confirmArchive=false;draw();return;}
    if(a==='archive-confirm'){const slug=panel.target.slug;void send({action:'archive',slug}).then(res=>{if(res){closePanel();if(location.hash==='#campaign/'+slug)location.hash='home';}else if(panel)draw();});return;}
    if(a==='restore'){void act({action:'restore',slug:b.dataset.slug},'Campaign restored.');return;}
    if(a==='up'||a==='down'){
      const order=reg.campaigns.map(c=>c.slug),i=order.indexOf(b.dataset.slug),j=a==='up'?i-1:i+1;
      if(i<0||j<0||j>=order.length)return;[order[i],order[j]]=[order[j],order[i]];
      void act({action:'reorder',order},'Order saved.').then(()=>document.querySelector('#fvEditor [data-editor="'+a+'"][data-slug="'+CSS.escape(b.dataset.slug)+'"]:not([disabled])')?.focus());
      return;
    }
  });
  document.addEventListener('input',e=>{
    if(!panel)return;const d=panel.draft,t=e.target;
    if(t.dataset.input){const k=t.dataset.input;if(k==='budget')d.budget.amount=t.value;else if(k==='budgetCurrency')d.budget.currency=t.value;else d[k]=t.value;
      if(k==='name')document.getElementById('fveePreview').innerHTML=render.preview(d);}
    if(t.dataset.link!==undefined)d.links[Number(t.dataset.link)][t.dataset.part]=t.value;
  });
  document.addEventListener('change',e=>{if(panel&&e.target.dataset.input==='budgetCurrency')panel.draft.budget.currency=e.target.value;});
  // Navigating away closes the editor; it never edits a campaign the page no longer shows.
  window.addEventListener('hashchange',()=>{if(panel)closePanel();});
  document.addEventListener('keydown',e=>{
    if(!panel)return;
    const radio=e.target.closest?.('#fvEditor [data-choice]');
    if(radio&&['ArrowRight','ArrowDown','ArrowLeft','ArrowUp'].includes(e.key)){
      const all=[...radio.parentElement.querySelectorAll('[data-choice]')],i=all.indexOf(radio);
      const next=all[(i+(e.key==='ArrowRight'||e.key==='ArrowDown'?1:-1)+all.length)%all.length];
      e.preventDefault();next.click();next.focus();return;}
    if(e.key==='Escape'){e.preventDefault();closePanel();return;}
    if(e.key==='Tab'){const items=[...document.querySelectorAll('#fvEditor a[href],#fvEditor button:not([disabled]),#fvEditor input,#fvEditor select,#fvEditor textarea,#fvEditor summary')].filter(x=>x.getClientRects().length);
      if(!items.length)return;const first=items[0],last=items.at(-1);
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  });
  }

  /* ---------- shell hooks ---------- */
  function install(){
    const A=window.FanvueApp;if(!A)return;
    const h=A.hooks;
    h.navAddButton=()=>'<button type="button" class="fv-nav-add" data-fv-add aria-label="Add campaign">'+U.icon('plus',15)+'</button>';
    h.navExtra=active=>reg.campaigns.map(c=>render.navItem(c,active==='campaign/'+c.slug)).join('');
    h.addedRoute=slug=>addedPage(slug);
    h.override=key=>reg.builtIns[key]?{icon:reg.builtIns[key].icon,color:reg.builtIns[key].color}:null;
    h.extraBody=key=>{const o=reg.builtIns[key];return o&&(o.owner||o.objective||o.notes||o.links?.length||o.startDate||o.endDate||o.budget||o.status!=='Planned')?render.info(o):'';};
    h.headerExtra=(r,page)=>{
      if(!unlocked())return '';
      if(r.kind==='added'&&find(r.key))return '<button type="button" class="fv-control" data-fv-edit="added:'+esc(r.key)+'">'+U.icon('edit',14)+'Edit campaign</button>';
      if(r.kind==='page'&&C.CAMPAIGNS.some(c=>c.key===r.key))return '<button type="button" class="fv-control" data-fv-edit="builtIn:'+esc(r.key)+'">'+U.icon('edit',14)+'Edit campaign</button>';
      return '';
    };
    h.refresh=async r=>{const ok=await load();if(r.kind==='added'&&find(r.key)?.dataLink)await A.data.rep()?.reload?.();return ok;};
    window.addEventListener('xtracker:unlocked',()=>A.rerender(true));
    void load();
  }
  window.FanvueCampaigns=Object.freeze({render,load,state:reg,open:begin});
  if(typeof document!=='undefined'&&window.FanvueApp){bind();install();}
})();
