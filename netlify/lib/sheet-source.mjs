import ExcelJS from 'exceljs';

export const SPREADSHEET_ID='1iaKTKoGf58i9uH5sT23r6vxX5XYVx3VfS8fLp-8xRbM';
export const OWNER_TABS=[['WEEK 1 - LOUIS','LOUIS'],['WEEK 1 - CONNOR','CONNOR'],['WEEK X - TEMP','TEMP']];
export function value(cell){
  const v=cell?.value;
  if(v===null||v===undefined)return '';
  if(v instanceof Date)return v.toISOString();
  if(typeof v!=='object')return v;
  if('result' in v)return v.result??'';
  if(v.richText)return v.richText.map(x=>x.text).join('');
  return v.text??'';
}
const text=c=>String(value(c)).trim();
export function resolveCampaignId(publisher,campaignId=''){
  return String(campaignId||'').trim()||'UNASSIGNED';
}
const number=c=>{const v=value(c);return v===''||v===null?null:Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null;};
const bool=c=>value(c)===true||text(c).toUpperCase()==='TRUE';
export function link(cell){
  const v=cell?.value;
  const formula=v?.formula||'';
  const url=cell?.hyperlink||v?.hyperlink||formula.match(/^HYPERLINK\(\s*"([^"]+)"/i)?.[1]||text(cell);
  try{const u=new globalThis.URL(url);return u.protocol==='https:'?u.href:'';}catch{return '';}
}
export function metricDate(input){
  if(!input)return '';
  const s=String(input).replace(/\bBST\b/,'+0100').replace(/\bGMT\b/,'+0000');
  const d=new Date(s);return Number.isNaN(d.getTime())?'':d.toISOString();
}
export function columns(sheet){
  const map={};sheet.getRow(7).eachCell((c,i)=>{const s=text(c).toUpperCase();if(s&&!map[s])map[s]=i;});
  const cost=map.ARTICLE;
  const out={publisher:map.ACCOUNT,profile:3,article:map['ARTICLE LINK'],cost,active:cost+1,
    paid:map['PAID?'],posted:map['POSTED?'],code:map['UTM ID'],tracking:map.UTM||map['UTM LINK'],
    clicks:map['TRACKED CLICKS'],lastClick:map['LAST CLICK'],linkIn:map['LINK IN'],
    views:map['X POST VIEWS'],likes:map['X POST LIKES'],updated:map['X UPDATED (UK)'],campaign:map.CAMPAIGN,paidDate:map['PAID DATE']||map['PAYMENT DATE']};
  out.post=out.code-1;
  for(const k of ['publisher','article','cost','paid','posted','code','views','likes','updated'])
    if(!out[k])throw new Error('Missing '+k+' column in '+sheet.name);
  return out;
}
export function parseWorkbook(workbook,now=Date.now()){
  const placements=[],seen=new Set(),campaigns=[];
  const meta=new Map(),metaSheet=workbook.getWorksheet('PROMO META');
  if(metaSheet)for(let i=2;i<=metaSheet.rowCount;i++){
    const r=metaSheet.getRow(i);if(text(r.getCell(1)))meta.set(text(r.getCell(1)),r);
  }
  const campaignSheet=workbook.getWorksheet('CAMPAIGNS');
  if(campaignSheet)for(let i=5;i<=campaignSheet.rowCount;i++){
    const r=campaignSheet.getRow(i),id=text(r.getCell(1)),name=text(r.getCell(2));
    if(!id||!name)continue;campaigns.push({id,name,brief:text(r.getCell(4)),budget:null,status:'active'});
  }
  const extraCampaigns=workbook.getWorksheet('PROMO CAMPAIGNS');
  if(extraCampaigns)for(let i=2;i<=extraCampaigns.rowCount;i++){
    const r=extraCampaigns.getRow(i),id=text(r.getCell(1));if(!id||campaigns.some(c=>c.id===id))continue;
    campaigns.push({id,name:text(r.getCell(2)),brief:text(r.getCell(3)),budget:number(r.getCell(4)),status:text(r.getCell(5))||'active'});
  }
  const campaignByName=new Map(campaigns.map(c=>[c.name,c.id]));
  const requiredNames=new Set(OWNER_TABS.map(([name])=>name));
  const additionalTabs=workbook.worksheets
    .filter(s=>/^WEEK\s+[1-9]\d*\s*-\s*(?:LOUIS|CONNOR|TEMP)$/i.test(s.name)&&!requiredNames.has(s.name))
    .filter(s=>{
      // A newly created template may not yet have its row-7 headers.
      // Ignore incomplete optional sheets until their structure is ready.
      const values=[];s.getRow(7).eachCell(c=>values.push(text(c).toUpperCase()));
      return ['ACCOUNT','ARTICLE LINK','ARTICLE','PAID?','POSTED?','UTM ID'].every(h=>values.includes(h));
    })
    .map(s=>[s.name,s.name.replace(/^WEEK\s+\d+\s*-\s*/i,'').toUpperCase()]);
  for(const [name,owner] of [...OWNER_TABS,...additionalTabs]){
    const sheet=workbook.getWorksheet(name);if(!sheet)throw new Error('Source tab missing: '+name);
    const m=columns(sheet);
    for(let row=8;row<=sheet.rowCount;row++){
      const r=sheet.getRow(row),c=k=>r.getCell(m[k]),publisher=text(c('publisher')),code=text(c('code')).toUpperCase();
      if(!publisher)continue;
      if(!/^A\d{2}-P\d{2,3}$/.test(code))throw new Error('Invalid tracking ID for '+publisher+' in '+name);
      if(seen.has(code))throw new Error('Duplicate tracking ID: '+code);seen.add(code);
      const paid=bool(c('paid')),posted=bool(c('posted')),active=bool(c('active'));
      const xUpdated=metricDate(text(c('updated'))),xViews=number(c('views')),xLikes=number(c('likes'));
      // Optional source fields live in the original weekly tabs, so they are
      // available immediately on the next automatic Google Sheets refresh.
      const campaign=m.campaign?text(c('campaign')):'';
      const sheetPaidDate=m.paidDate?metricDate(text(c('paidDate'))):'';
      const metadata=meta.get(code),extra=n=>metadata?.getCell(n);
      placements.push({code,publisher,owner,sourceTab:name,sourceRow:row,
        profileUrl:link(c('profile')),articleUrl:link(c('article')),articleLabel:text(c('article')),
        cost:number(c('cost')),active,paid,posted,postUrl:link(c('post')),platform:'X',
        campaignId:resolveCampaignId(publisher,campaignByName.get(campaign)||campaign||text(extra(2))),
        stage:text(extra(3))||(posted?'published':paid||active?'booked':'planned'),
        postedAt:metricDate(text(extra(5))),bookedAt:metricDate(text(extra(6))),
        paidAt:sheetPaidDate||metricDate(text(extra(7))),
        linkPlacement:m.linkIn?text(c('linkIn')):'',xViews,xLikes,xComments:number(extra(11)),xShares:number(extra(12)),
        engagementRate:xViews>0&&xLikes!==null?Math.round(10000*xLikes/xViews)/100:null,
        xUpdated,metricStatus:!xUpdated||xViews===null?'unverified':now-Date.parse(xUpdated)>4*3600000?'stale':'ok',unavailable:false});
    }
  }
  const extraSheet=workbook.getWorksheet('PROMO PLACEMENTS');
  if(extraSheet)for(let i=2;i<=extraSheet.rowCount;i++){
    const r=extraSheet.getRow(i),c=n=>r.getCell(n),code=text(c(1)),publisher=text(c(2));
    if(!code||!publisher)continue;
    if(!/^A\d{2}-P\d{2,3}$/.test(code)||seen.has(code))throw new Error('Invalid or duplicate additional placement ID');seen.add(code);
    const at=metricDate(text(c(21)));
    placements.push({code,publisher,owner:text(c(3)).toUpperCase(),sourceTab:'PROMO PLACEMENTS',sourceRow:i,
      profileUrl:link(c(4)),platform:text(c(5))||'X',campaignId:resolveCampaignId(publisher,text(c(6))),cost:number(c(7)),stage:text(c(8))||'planned',
      active:true,paid:bool(c(9)),posted:bool(c(10)),postUrl:link(c(11)),postedAt:metricDate(text(c(12))),bookedAt:metricDate(text(c(13))),paidAt:metricDate(text(c(14))),
      articleUrl:link(c(15)),articleLabel:'',xViews:number(c(17)),xLikes:number(c(18)),xComments:number(c(19)),xShares:number(c(20)),xUpdated:at,
      unavailable:bool(c(22)),metricStatus:bool(c(22))?'unavailable':!at?'unverified':now-Date.parse(at)>4*3600000?'stale':'ok'});
  }
  const metricHistory=[],historySheet=workbook.getWorksheet('PROMO METRIC HISTORY');
  if(historySheet)for(let i=2;i<=historySheet.rowCount;i++){
    const r=historySheet.getRow(i),at=metricDate(text(r.getCell(1))),code=text(r.getCell(2));if(!at||!seen.has(code))continue;
    metricHistory.push({at,date:at.slice(0,10),code,platform:text(r.getCell(3)),views:number(r.getCell(4)),likes:number(r.getCell(5)),comments:number(r.getCell(6)),shares:number(r.getCell(7)),engagementRate:number(r.getCell(8)),availability:text(r.getCell(9))});
  }
  if(placements.some(p=>p.campaignId==='UNASSIGNED'))campaigns.push({id:'UNASSIGNED',name:'Unassigned placements',brief:'No campaign has been assigned in the source sheet.',budget:null,status:'active'});
  return {version:'4.0',placements,campaigns,metricHistory,fetchedAt:new Date(now).toISOString(),sourceUpdatedAt:'',source:'GOOGLE_SHEETS_EXPORT'};
}
export async function loadWorkbook(fetcher=fetch){
  const response=await fetcher(`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=xlsx`,{signal:AbortSignal.timeout(20000),cache:'no-store'});
  if(!response.ok)throw new Error('Google Sheets export HTTP '+response.status);
  const bytes=await response.arrayBuffer();if(bytes.byteLength>12000000)throw new Error('Workbook exceeds the safe size limit');
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(Buffer.from(bytes));return workbook;
}
export async function readWorkbook(){return parseWorkbook(await loadWorkbook());}
