/** X Tracker v4. Private Google Sheets feed, campaign edits and historical metrics.
 * Requires authenticated Google Apps Script access before deployment.
 * Inspect and disable obsolete onTrackerEdit/syncFromTracker/refreshReports triggers first.
 * Current setup validates layouts and never regenerates existing tracking IDs.
 * The web app runs as its owner and accepts only a long private key.
 */
const SPREADSHEET_ID='1iaKTKoGf58i9uH5sT23r6vxX5XYVx3VfS8fLp-8xRbM';
// The secret is stored privately in Google Apps Script Project Settings > Script properties.
// Never put it in this file or upload it to a GitHub repository.
function feedSecret_(){
  const props=PropertiesService.getScriptProperties();
  const key=props.getProperty('FEED_SECRET')||props.getProperty('APP_SCRIPT_TOKEN')||props.getProperty('API_TOKEN')||'';
  return key.length>=32?key:'';
}
function ensureFeedSecret_(){
  const props=PropertiesService.getScriptProperties();
  let key=props.getProperty('FEED_SECRET')||props.getProperty('APP_SCRIPT_TOKEN')||props.getProperty('API_TOKEN')||'';
  if(!key){
    key=(Utilities.getUuid()+Utilities.getUuid()).replace(/-/g,'');
    props.setProperty('FEED_SECRET',key);
  }
  if(key.length<32)throw new Error('Feed token must be at least 32 characters. Set FEED_SECRET to match the saved Netlify APP_SCRIPT_TOKEN in Apps Script Project Settings > Script properties.');
  props.setProperty('FEED_SECRET',key);
  return key;
}
const OWNER_TABS=[{name:'WEEK 1 - LOUIS',owner:'LOUIS'}, {name:'WEEK 1 - CONNOR',owner:'CONNOR'}, {name:'WEEK X - TEMP',owner:'TEMP'}];
const META_TAB='PROMO META', CAMPAIGN_TAB='PROMO CAMPAIGNS', EXTRA_TAB='PROMO PLACEMENTS', HISTORY_TAB='PROMO METRIC HISTORY';
const META_HEADERS=['Code','Campaign ID','Stage','Platform','Posted At','Booked At','Paid At','Notes','Unavailable','Failure Checks','Comments','Shares','Engagement Rate','Updated At'];
const CAMPAIGN_HEADERS=['ID','Name','Brief','Budget','Status','Start Date','End Date','Created At','Updated At'];
const EXTRA_HEADERS=['Code','Publisher','Owner','Profile URL','Platform','Campaign ID','Price','Stage','Paid','Posted','Post URL','Posted At','Booked At','Paid At','Article URL','Notes','Views','Likes','Comments','Shares','Last Metric Update','Unavailable','Failure Checks'];
const HISTORY_HEADERS=['At','Code','Platform','Views','Likes','Comments','Shares','Engagement Rate','Availability'];
const VALID_STAGES=['planned','contacted','booked','published'];
const MAX_SNAPSHOTS=4500;

function systemSheet_(ss,name,head){
  let sh=ss.getSheetByName(name);
  if(!sh)sh=ss.insertSheet(name);
  if(sh.getMaxColumns()<head.length)sh.insertColumnsAfter(sh.getMaxColumns(),head.length-sh.getMaxColumns());
  const old=sh.getRange(1,1,1,head.length).getValues()[0];
  if(old.some((x,i)=>x!==head[i]))sh.getRange(1,1,1,head.length).setValues([head]);
  if(!sh.isSheetHidden())sh.hideSheet();
  return sh;
}
function getSystem_(ss){return {
  meta:systemSheet_(ss,META_TAB,META_HEADERS), campaigns:systemSheet_(ss,CAMPAIGN_TAB,CAMPAIGN_HEADERS),
  extra:systemSheet_(ss,EXTRA_TAB,EXTRA_HEADERS), history:systemSheet_(ss,HISTORY_TAB,HISTORY_HEADERS)
};}
function rows_(sh,head){if(!sh)return [];const n=sh.getLastRow();return n<2?[]:sh.getRange(2,1,n-1,head.length).getValues();}
function index_(rows){return Object.fromEntries(rows.map((r,i)=>[String(r[0]||'').trim(),i]));}
function iso_(value){if(value instanceof Date){return Number.isNaN(value.getTime())?'':value.toISOString();}if(!value)return '';const d=new Date(value);return Number.isNaN(d.getTime())?'':d.toISOString();}
function optionalDate_(value){if(value===''||value===null||value===undefined)return '';const x=iso_(value);if(!x)throw new Error('Invalid date');return x;}
function n_(value){if(value===''||value===null||value===undefined)return null;const n=Number(value);return Number.isFinite(n)&&n>=0?n:null;}
function safeText_(v,max){return String(v===undefined||v===null?'':v).trim().slice(0,max||500);}
function validCode_(code){return /^A\d{2}-P\d{2,3}$/.test(code);}
function validCampaign_(id){return /^(?:A\d{2}|C\d{3}|UNASSIGNED)$/.test(id);}
function validUrl_(url){if(!url)return '';if(!/^https:\/\//i.test(url))throw new Error('Only HTTPS URLs are allowed');return url.slice(0,900);}
function platformFor_(url){return /instagram\.com/i.test(url)?'Instagram':/(?:x\.com|twitter\.com)/i.test(url)?'X':'';}
function normalPost_(url){return String(url||'').split('?')[0].replace(/\/$/,'').toLowerCase();}
function sourceColumns_(sh){
  const h=sh.getRange(7,2,1,20).getDisplayValues()[0].map(v=>String(v).trim().toUpperCase());
  const at=n=>{const i=h.indexOf(n);if(i<0)throw new Error('Missing '+n+' header in '+sh.getName());return i;};
  const cost=at('ARTICLE'),code=at('UTM ID');
  return {code,cost,active:cost+1,paid:at('PAID?'),posted:at('POSTED?'),post:code-1,views:at('X POST VIEWS'),likes:at('X POST LIKES'),updated:at('X UPDATED (UK)')};
}
function companyRows_(ss){
  const meta=rows_(ss.getSheetByName(META_TAB),META_HEADERS),mi=index_(meta),res=[];
  OWNER_TABS.forEach(tab=>{
    const sh=ss.getSheetByName(tab.name);if(!sh)return;
    const end=Math.min(sh.getLastRow(),998);if(end<8)return;
    const m=sourceColumns_(sh);
    const data=sh.getRange(8,2,end-7,20).getValues();
    const display=sh.getRange(8,2,end-7,20).getDisplayValues();
    const rich=sh.getRange(8,5,end-7,1).getRichTextValues();
    data.forEach((r,i)=>{
      const code=safeText_(r[m.code],24).toUpperCase(),pub=safeText_(r[0],80);if(!pub||!validCode_(code))return;
      const x=mi[code]!==undefined?meta[mi[code]]:[],url=safeText_(r[m.post],900);
      let articleUrl=rich[i]?.[0]?.getLinkUrl()||'';
      if(!articleUrl&&rich[i]?.[0])for(const run of rich[i][0].getRuns()){const link=run.getLinkUrl();if(link){articleUrl=link;break;}}
      res.push({code,publisher:pub,owner:tab.owner,sourceTab:tab.name,sourceRow:i+8,
        profileUrl:safeText_(r[1],900),cost:n_(r[m.cost]),active:r[m.active]===true,paid:r[m.paid]===true,posted:r[m.posted]===true,
        postUrl:url,articleUrl:/^https:\/\//.test(articleUrl)?articleUrl:'',articleLabel:safeText_(display[i][3],160),
        linkPlacement:safeText_(display[i][16],60),campaignId:safeText_(x[1]||code.slice(0,3),15),
        stage:safeText_(x[2]||(r[m.posted]?'published':r[m.paid]?'booked':r[m.active]?'planned':'planned'),30),
        platform:safeText_(x[3]||platformFor_(url)||platformFor_(r[1])||'X',30),
        postedAt:iso_(x[4]),bookedAt:iso_(x[5]),paidAt:iso_(x[6]),
        xViews:n_(r[m.views]),xLikes:n_(r[m.likes]),xComments:n_(x[10]),xShares:n_(x[11]),
        engagementRate:n_(x[12]),xUpdated:safeText_(display[i][m.updated],65),
        unavailable:x[8]===true,metricStatus:x[8]===true?'unavailable':n_(r[m.views])!==null?'ok':'unverified'});
    });
  });
  const more=rows_(ss.getSheetByName(EXTRA_TAB),EXTRA_HEADERS);
  more.forEach(r=>{
    const code=safeText_(r[0],24),publisher=safeText_(r[1],80);if(!validCode_(code)||!publisher)return;
    res.push({code,publisher,owner:safeText_(r[2],20),sourceTab:EXTRA_TAB,sourceRow:0,
      profileUrl:safeText_(r[3],900),platform:safeText_(r[4],30),campaignId:safeText_(r[5],15)||code.slice(0,3),
      cost:n_(r[6]),stage:safeText_(r[7],30),paid:r[8]===true,posted:r[9]===true,active:true,
      postUrl:safeText_(r[10],900),postedAt:iso_(r[11]),bookedAt:iso_(r[12]),paidAt:iso_(r[13]),
      articleUrl:safeText_(r[14],900),articleLabel:'',linkPlacement:'',
      xViews:n_(r[16]),xLikes:n_(r[17]),xComments:n_(r[18]),xShares:n_(r[19]),
      engagementRate:(n_(r[16])>0&&n_(r[17])!==null)?Math.round(10000*((n_(r[17])||0)+(n_(r[18])||0)+(n_(r[19])||0))/n_(r[16]))/100:null,
      xUpdated:iso_(r[20]),unavailable:r[21]===true,
      metricStatus:r[21]===true?'unavailable':n_(r[16])!==null?'ok':'unverified'});
  });
  const seen=new Set(),urls=new Set();
  res.forEach(p=>{
    if(seen.has(p.code))throw new Error('Duplicate placement ID: '+p.code);seen.add(p.code);
    const url=normalPost_(p.postUrl);
    if(url){if(urls.has(url))throw new Error('Duplicate post URL: '+url);urls.add(url);}
  });
  return res;
}
function feedHistory_(sh){
  const end=sh.getLastRow();if(end<2)return [];
  const length=Math.min(MAX_SNAPSHOTS,end-1);
  const data=sh.getRange(end-length+1,1,length,HISTORY_HEADERS.length).getValues();
  const grouped=new Map();
  data.forEach(r=>{
    const at=iso_(r[0]),code=safeText_(r[1],24),day=at.slice(0,10);if(!day||!validCode_(code))return;
    const key=code+'|'+day;
    grouped.set(key,{at,date:day,code,platform:safeText_(r[2],24),views:n_(r[3]),likes:n_(r[4]),
      comments:n_(r[5]),shares:n_(r[6]),engagementRate:n_(r[7]),availability:safeText_(r[8],30)});
  });
  return [...grouped.values()].sort((a,b)=>a.at.localeCompare(b.at)).slice(-1500);
}
function doGet(e){
  if(!feedSecret_()||!e?.parameter||e.parameter.key!==feedSecret_())return output_({ok:false,error:'unauthorised'});
  try{
    const ss=SpreadsheetApp.openById(SPREADSHEET_ID);
    for(const tab of [META_TAB,CAMPAIGN_TAB,EXTRA_TAB,HISTORY_TAB])require_(ss.getSheetByName(tab),'Run Apps Script setup before using dashboard');
    const placements=companyRows_(ss);
    const explicit=rows_(ss.getSheetByName(CAMPAIGN_TAB),CAMPAIGN_HEADERS).filter(r=>validCampaign_(String(r[0]||'')))
      .map(r=>({id:String(r[0]),name:String(r[1]||r[0]),brief:String(r[2]||''),budget:n_(r[3]),
        status:String(r[4]||'active'),startDate:iso_(r[5]),endDate:iso_(r[6]),createdAt:iso_(r[7])}));
    const ids=new Set(explicit.map(c=>c.id));
    for(const p of placements){const id=p.campaignId;
      if(validCampaign_(id)&&!ids.has(id)){explicit.push({id,name:'Campaign '+id,brief:'',budget:null,status:'active',legacy:true});ids.add(id);}}
    return output_({ok:true,version:'4.0',placements,campaigns:explicit,metricHistory:feedHistory_(ss.getSheetByName(HISTORY_TAB)),generatedAt:new Date().toISOString()});
  }catch(e){return output_({ok:false,error:String(e.message||e)})}
}
function output_(data){return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);}
function require_(condition,message){if(!condition)throw new Error(message);}
function indexCode_(arr,code){return arr.findIndex(row=>String(row[0]||'')===code);}
function storeMeta_(ss,code,updates){
  const sh=ss.getSheetByName(META_TAB),rows=rows_(sh,META_HEADERS),i=indexCode_(rows,code);
  const row=i<0?[code,'','planned','','','','','',false,0,'','','','']:rows[i].slice();
  for(const [idx,val] of Object.entries(updates))row[Number(idx)]=val;
  row[13]=new Date().toISOString();
  if(i<0)sh.appendRow(row);else sh.getRange(i+2,1,1,META_HEADERS.length).setValues([row]);
}
function sourceRow_(ss,code){
  for(const t of OWNER_TABS){const sh=ss.getSheetByName(t.name);if(!sh)continue;
    const stop=Math.min(sh.getLastRow(),998);if(stop<8)continue;
    const m=sourceColumns_(sh);const range=sh.getRange(8,m.code+2,stop-7,1).getValues();
    for(let i=0;i<range.length;i++)if(String(range[i][0])===code)return {sh,row:i+8,columns:m};
  }
  return null;
}
function safeStage_(v){const stage=safeText_(v,24).toLowerCase();require_(VALID_STAGES.includes(stage),'Invalid placement stage');return stage;}
function validatePost_(url){const str=validUrl_(safeText_(url,900));if(str)require_(
  /^https:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/[\w]+\/status\/\d+/i.test(str)||
  /^https:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/[\w-]+/i.test(str),'Post must be an X or Instagram post URL');return str;}
function assertUniquePost_(records,url,code){if(!url)return;
  require_(!records.some(p=>p.code!==code&&normalPost_(p.postUrl)===normalPost_(url)),'Post URL is already tracked');}
function campaignExists_(ss,id){
  if(!id)return;require_(validCampaign_(id),'Invalid campaign ID');
  const ids=rows_(ss.getSheetByName(CAMPAIGN_TAB),CAMPAIGN_HEADERS).map(r=>String(r[0]));
  const main=ss.getSheetByName('CAMPAIGNS');
  if(main&&main.getLastRow()>=5)ids.push(...main.getRange(5,1,main.getLastRow()-4,1).getDisplayValues().map(r=>r[0]));
  if(id==='A01'||id==='UNASSIGNED')return;require_(ids.includes(id),'Unknown campaign');
}
function updatePlacement_(ss,data){
  const code=safeText_(data.code,24),p=companyRows_(ss).find(x=>x.code===code);require_(p,'Placement not found');
  const changes=data.changes||{},allowed=['stage','campaignId','postedAt','bookedAt','paidAt','notes','price','paid','posted','postUrl','platform'];
  Object.keys(changes).forEach(k=>require_(allowed.includes(k),'Unsupported placement change'));
  const meta={};
  if('stage' in changes)meta[2]=safeStage_(changes.stage);
  if('campaignId' in changes){const id=safeText_(changes.campaignId,12);campaignExists_(ss,id);meta[1]=id;}
  for(const [key,idx] of [['postedAt',4],['bookedAt',5],['paidAt',6]])if(key in changes)meta[idx]=optionalDate_(changes[key]);
  if('notes' in changes)meta[7]=safeText_(changes.notes,350);
  if('platform' in changes){require_(['X','Instagram'].includes(changes.platform),'Invalid platform');meta[3]=changes.platform;}
  const post='postUrl' in changes?validatePost_(changes.postUrl):null;
  if(post!==null)assertUniquePost_(companyRows_(ss),post,code);
  let price=null;if('price' in changes){price=n_(changes.price);require_(price!==null&&price<=1000000,'Invalid agreed price');}
  if(p.sourceTab===EXTRA_TAB){
    const sh=ss.getSheetByName(EXTRA_TAB),rows=rows_(sh,EXTRA_HEADERS),idx=indexCode_(rows,code),row=rows[idx].slice();
    if('stage' in changes)row[7]=meta[2];if('campaignId' in changes)row[5]=meta[1];
    if('postedAt' in changes)row[11]=meta[4];if('bookedAt' in changes)row[12]=meta[5];
    if('paidAt' in changes)row[13]=meta[6];if('notes' in changes)row[15]=meta[7];
    if('platform' in changes)row[4]=meta[3];if(post!==null)row[10]=post;
    if(price!==null)row[6]=price;if('paid' in changes)row[8]=changes.paid===true;
    if('posted' in changes)row[9]=changes.posted===true;
    sh.getRange(idx+2,1,1,EXTRA_HEADERS.length).setValues([row]);
  }else{
    const found=sourceRow_(ss,code);require_(found,'Publisher row not found');const {sh,row,columns:m}=found;
    if(price!==null)sh.getRange(row,m.cost+2).setValue(price);
    if(post!==null)sh.getRange(row,m.post+2).setValue(post);
    if('paid' in changes)sh.getRange(row,m.paid+2).setValue(changes.paid===true);
    if('posted' in changes)sh.getRange(row,m.posted+2).setValue(changes.posted===true);
    if(Object.keys(meta).length)storeMeta_(ss,code,meta);
  }
  return {code};
}
function doPost(e){
  if(!feedSecret_()||!e?.parameter||e.parameter.key!==feedSecret_())return output_({ok:false,error:'unauthorised'});
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(8000))return output_({ok:false,error:'Another campaign edit is running'});
  try{
    const ss=SpreadsheetApp.openById(SPREADSHEET_ID);getSystem_(ss);
    const cmd=JSON.parse(e.postData?.contents||'{}');let result={};
    if(cmd.type==='createCampaign'){
      const name=safeText_(cmd.name,100),brief=safeText_(cmd.brief,700),budget=n_(cmd.budget);
      require_(name.length>=2,'Campaign name required');require_(budget!==null&&budget<=100000000,'Valid budget required');
      const current=rows_(ss.getSheetByName(CAMPAIGN_TAB),CAMPAIGN_HEADERS);
      require_(!current.some(r=>String(r[1]).toLowerCase()===name.toLowerCase()),'Campaign already exists');
      const used=new Set(companyRows_(ss).map(p=>p.code.slice(0,3)).concat(current.map(r=>String(r[0]))));
      let id='';for(let i=2;i<=99;i++){const test='A'+String(i).padStart(2,'0');if(!used.has(test)){id=test;break;}}
      require_(id,'Campaign limit reached');const now=new Date().toISOString();
      ss.getSheetByName(CAMPAIGN_TAB).appendRow([id,name,brief,budget,'active',optionalDate_(cmd.startDate),optionalDate_(cmd.endDate),now,now]);result={id};
    }else if(cmd.type==='updateCampaign'){
      const id=safeText_(cmd.id,12),sh=ss.getSheetByName(CAMPAIGN_TAB),rows=rows_(sh,CAMPAIGN_HEADERS),idx=indexCode_(rows,id);
      require_(idx>=0,'Campaign not found or read-only legacy campaign');
      const fields=cmd.changes||{},row=rows[idx].slice();
      const schema={name:1,brief:2,budget:3,status:4,startDate:5,endDate:6};
      for(const [key,val] of Object.entries(fields)){
        require_(key in schema,'Unsupported campaign field');
        row[schema[key]]=key==='budget'?(n_(val)??0):['startDate','endDate'].includes(key)?optionalDate_(val):safeText_(val,key==='brief'?700:100);
      }
      require_(row[1]&&n_(row[3])!==null,'Invalid campaign');row[8]=new Date().toISOString();
      sh.getRange(idx+2,1,1,CAMPAIGN_HEADERS.length).setValues([row]);result={id};
    }else if(cmd.type==='createPlacement'){
      const records=companyRows_(ss),name=safeText_(cmd.publisher,80),existing=records.find(p=>p.publisher.toLowerCase()===name.toLowerCase());
      require_(existing,'Select an existing tracked account');
      const campaignId=safeText_(cmd.campaignId||'A01',12);campaignExists_(ss,campaignId);
      const price=n_(cmd.price);require_(price!==null&&price<=1000000,'Valid price required');
      const platform=safeText_(cmd.platform||existing.platform||'X',30);
      require_(['X','Instagram'].includes(platform),'Invalid platform');
      require_(platform===existing.platform||cmd.profileUrl,'Provide the profile URL for this platform');
      const profile=validUrl_(safeText_(cmd.profileUrl||existing.profileUrl,900));
      const post=validatePost_(cmd.postUrl||'');assertUniquePost_(records,post,'');
      const used=new Set(records.map(p=>p.code));let code='';
      for(let i=500;i<=999;i++){const v='A01-P'+i;if(!used.has(v)){code=v;break;}}
      require_(code,'No free tracking IDs');
      const stage=cmd.stage?safeStage_(cmd.stage):'planned';const now=new Date().toISOString();
      ss.getSheetByName(EXTRA_TAB).appendRow([code,existing.publisher,existing.owner,profile,
        platform,campaignId,price,stage,false,!!post,post,
        optionalDate_(cmd.postedAt),'','','','', '', '', '', '', '', false,0]);
      result={code,createdAt:now};
    }else if(cmd.type==='updatePlacement'){result=updatePlacement_(ss,cmd);
    }else if(cmd.type==='bulkUpdate'){
      const codes=Array.isArray(cmd.codes)?[...new Set(cmd.codes.map(x=>safeText_(x,24)))]:[];
      require_(codes.length>0&&codes.length<=30,'Select up to 30 placements');
      const changes=cmd.changes||{};require_(Object.keys(changes).length>0,'No changes');
      require_(Object.keys(changes).every(k=>['stage','campaignId'].includes(k)),'Bulk editing is limited to stage and campaign');
      codes.forEach(code=>updatePlacement_(ss,{code,changes}));result={count:codes.length};
    }else if(cmd.type==='recordMetrics'){
      const code=safeText_(cmd.code,24),p=companyRows_(ss).find(x=>x.code===code);require_(p,'Placement not found');
      const views=n_(cmd.views),likes=n_(cmd.likes),comments=n_(cmd.comments),shares=n_(cmd.shares);
      require_(views!==null||likes!==null||comments!==null||shares!==null,'No metrics supplied');
      const at=new Date().toISOString();saveMetrics_(ss,p,{views,likes,comments,shares,at,available:true});result={code};
    }else throw new Error('Unknown action');
    SpreadsheetApp.flush();return output_({ok:true,result});
  }catch(err){return output_({ok:false,error:String(err.message||err)})}
  finally{lock.releaseLock();}
}
function saveMetrics_(ss,p,m){
  const views=m.views,likes=m.likes,comments=m.comments,shares=m.shares;
  const engagement=(views!==null&&views>0&&likes!==null&&comments!==null&&shares!==null)
    ?Math.round(10000*(likes+comments+shares)/views)/100:null;
  const available=m.available!==false,at=m.at||new Date().toISOString();
  if(p.sourceTab===EXTRA_TAB){
    const sh=ss.getSheetByName(EXTRA_TAB),data=rows_(sh,EXTRA_HEADERS),idx=indexCode_(data,p.code);
    if(idx>=0){const row=data[idx].slice();if(views!==null)row[16]=views;if(likes!==null)row[17]=likes;
      if(comments!==null)row[18]=comments;if(shares!==null)row[19]=shares;
      if(available)row[20]=at;row[21]=!available;row[22]=available?0:(Number(row[22])||0)+1;
      sh.getRange(idx+2,1,1,EXTRA_HEADERS.length).setValues([row]);}
  }else{
    const found=sourceRow_(ss,p.code);require_(found,'Source row missing');const {sh,row,columns:m}=found;
    if(sh&&views!==null&&likes!==null){sh.getRange(row,m.views+2,1,3).setValues([[views,likes,Utilities.formatDate(new Date(at),'Europe/London','dd MMM yyyy HH:mm z')]]);}
    const updates={};if(available){updates[8]=false;updates[9]=0}else{updates[8]=true;updates[9]=2;}
    if(comments!==null)updates[10]=comments;if(shares!==null)updates[11]=shares;
    if(engagement!==null)updates[12]=engagement;
    storeMeta_(ss,p.code,updates);
  }
  if(available&&views!==null&&likes!==null){
    ss.getSheetByName(HISTORY_TAB).appendRow([at,p.code,p.platform,views,likes,comments===null?'':comments,
      shares===null?'':shares,engagement===null?'':engagement,'available']);
  }else if(!available){
    ss.getSheetByName(HISTORY_TAB).appendRow([at,p.code,p.platform,'','','','','','unavailable']);
  }
}
function setupReporting_(ss){
  // Existing UTM INDEX, UTM EVENTS and UTM SUMMARY formulas are authoritative.
  // Validate source schemas only. Never regenerate IDs or replace reporting cells.
  OWNER_TABS.forEach(t=>{const sh=ss.getSheetByName(t.name);if(sh)sourceColumns_(sh);});
}
function setup(){
  ensureFeedSecret_();
  const ss=SpreadsheetApp.openById(SPREADSHEET_ID);require_(ss.getSheetByName('WEEK 1 - LOUIS'),'Incorrect workbook');getSystem_(ss);setupReporting_(ss);
  ScriptApp.getProjectTriggers().filter(t=>['refreshXMetrics','onTrackerEdit','syncFromTracker','refreshReports'].includes(t.getHandlerFunction())).forEach(t=>ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('refreshXMetrics').timeBased().everyHours(2).create();
  refreshXMetrics();Logger.log('Ready. Redeploy existing web app: Manage deployments > Edit > New version.');
}
function refreshXMetrics(){
  const lock=LockService.getScriptLock();if(!lock.tryLock(5000))return;
  try{
    const ss=SpreadsheetApp.openById(SPREADSHEET_ID);getSystem_(ss);
    const records=companyRows_(ss),failed=[];let updated=0;
    records.forEach(p=>{
      if(!p.posted||p.platform!=='X'||!p.postUrl)return;
      const m=p.postUrl.match(/^https:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/([\w]+)\/status\/(\d+)/i);
      if(!m)return;
      try{
        const resp=UrlFetchApp.fetch('https://api.fxtwitter.com/'+encodeURIComponent(m[1])+'/status/'+m[2],
          {muteHttpExceptions:true,followRedirects:true,headers:{Accept:'application/json'}});
        const status=resp.getResponseCode();if(status!==200){
          if([404,410].includes(status)){
            unavailableCheck_(ss,p);
            failed.push(p.code+': X provider HTTP '+status);
            return;
          }
          throw new Error('HTTP '+status);
        }
        const parsed=JSON.parse(resp.getContentText()),tweet=parsed.tweet||parsed;
        require_(String(tweet.id||tweet.id_str||'')===m[2],'Post ID mismatch');
        const views=n_(tweet.views),likes=n_(tweet.likes),comments=n_(tweet.replies),shares=n_(tweet.retweets);
        require_(views!==null&&likes!==null,'Incomplete public metrics');
        saveMetrics_(ss,p,{views,likes,comments,shares,at:new Date().toISOString(),available:true});updated++;
      }catch(err){failed.push(p.code+': '+String(err.message||err));}
    });
    Logger.log('X refresh: '+updated+' updated / '+failed.length+' temporary failures');
    failed.forEach(x=>Logger.log(x));
  }finally{lock.releaseLock();}
}
function unavailableCheck_(ss,p){
  // Provider 404/410 is a temporary lookup failure, not proof that the
  // article is gone. Keep its availability, values, and verified history.
  if(p.sourceTab===EXTRA_TAB){
    const sh=ss.getSheetByName(EXTRA_TAB),data=rows_(sh,EXTRA_HEADERS),idx=indexCode_(data,p.code);
    if(idx<0)return;const r=data[idx],failed=(Number(r[22])||0)+1;sh.getRange(idx+2,23).setValue(failed);
  }else{
    const old=rows_(ss.getSheetByName(META_TAB),META_HEADERS).find(x=>x[0]===p.code)||[];
    const failed=(Number(old[9])||0)+1;storeMeta_(ss,p.code,{9:failed});
  }
}
