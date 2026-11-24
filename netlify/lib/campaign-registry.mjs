// Campaign registry: campaigns added from the dashboard (SPECS §4.1, DESIGN §4.10).
// One dedicated Netlify Blobs store. No other store, sheet, function or data is read
// or written. Archive is a soft delete; nothing is hard-deleted and slugs are never reused.
import {timingSafeEqual} from 'node:crypto';

export const REGISTRY_STORE='fanvue-campaign-registry-v1';
export const REGISTRY_KEY='registry';
export const MAX_BODY_BYTES=16_384;
export const MAX_CAMPAIGNS=60;
export const ICONS=Object.freeze(['megaphone','sparkles','layers','gamepad','rocket','target','trending-up','video','image','mic','music','star',
  'heart','gift','tag','users','user-plus','link','globe','newspaper','book','graduation-cap','zap','flag']);
export const COLORS=Object.freeze(['slate','blue','cyan','teal','green','amber','pink','violet']);
export const STATUSES=Object.freeze(['Planned','Live','Paused','Ended']);
export const CURRENCIES=Object.freeze(['USD','GBP','EUR']);
export const BUILT_IN=Object.freeze(['x-articles','gta-vi','of-terms','cis','guru-promotion']);
// Slugs must never shadow an existing page or route name.
const RESERVED=new Set([...BUILT_IN,'home','discord','dashboard','new','edit','archived','campaign','campaigns','placements','accounts','x-rts']);
export const SLUG=/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

export class RegistryInputError extends Error{
  constructor(message,field=''){super(message);this.name='RegistryInputError';this.field=field;}
}
const fail=(field,message)=>{throw new RegistryInputError(message,field);};
const CONTROL=/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
function text(value,field,max,{required=false,multiline=false}={}){
  if(value===undefined||value===null)value='';
  if(typeof value!=='string')fail(field,'Must be text.');
  const v=multiline?value.replace(/\r\n?/g,'\n').trim():value.replace(/\s+/g,' ').trim();
  if(required&&!v)fail(field,'Required.');
  if(v.length>max)fail(field,'Use '+max+' characters or fewer.');
  if(CONTROL.test(v)||(!multiline&&/\n/.test(v)))fail(field,'Contains characters that are not allowed.');
  return v;
}
function isoDate(value,field){
  if(value===undefined||value===null||value==='')return '';
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))fail(field,'Use a date in YYYY-MM-DD format.');
  const d=new Date(value+'T00:00:00Z');
  if(Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==value)fail(field,'Not a real calendar date.');
  return value;
}
function httpsUrl(value,field){
  const v=text(value,field,500,{required:true});
  let u;try{u=new URL(v);}catch{fail(field,'Enter a full https:// link.');}
  if(u.protocol!=='https:'||!u.hostname||u.username||u.password)fail(field,'Only https:// links are allowed.');
  return u.href;
}
function budget(value){
  if(value===undefined||value===null||value==='')return null;
  if(typeof value!=='object'||Array.isArray(value))fail('budget','Invalid budget.');
  const raw=value.amount;
  if(raw===undefined||raw===null||raw==='')return null;
  const amount=typeof raw==='number'?raw:typeof raw==='string'&&/^\d{1,10}(?:\.\d{1,2})?$/.test(raw.trim())?Number(raw):NaN;
  if(!Number.isFinite(amount)||amount<0||amount>1e9||Math.round(amount*100)!==amount*100)fail('budget','Enter a number with up to two decimals.');
  const currency=value.currency===undefined?'USD':value.currency;
  if(!CURRENCIES.includes(currency))fail('budgetCurrency','Choose USD, GBP or EUR.');
  return {amount,currency};
}
function links(value){
  if(value===undefined||value===null)return [];
  if(!Array.isArray(value))fail('links','Invalid links.');
  if(value.length>6)fail('links','Add up to six links.');
  return value.map((l,i)=>{
    if(!l||typeof l!=='object')fail('links.'+i,'Invalid link.');
    return {label:text(l.label,'links.'+i+'.label',40,{required:true}),url:httpsUrl(l.url,'links.'+i+'.url')};
  });
}
/* Validate the editable fields. Built-ins accept only icon, colour and info fields. */
export function validateCampaign(input,{builtIn=false}={}){
  if(!input||typeof input!=='object'||Array.isArray(input))fail('campaign','Invalid campaign.');
  const out={};
  if(!builtIn)out.name=text(input.name,'name',40,{required:true});
  if(!ICONS.includes(input.icon))fail('icon','Choose an icon from the list.');
  if(!COLORS.includes(input.color))fail('color','Choose a colour from the palette.');
  out.icon=input.icon;out.color=input.color;
  const status=input.status===undefined||input.status===''?'Planned':input.status;
  if(!STATUSES.includes(status))fail('status','Choose Planned, Live, Paused or Ended.');
  out.status=status;
  out.startDate=isoDate(input.startDate,'startDate');
  out.endDate=isoDate(input.endDate,'endDate');
  if(out.startDate&&out.endDate&&out.endDate<out.startDate)fail('endDate','End date is before the start date.');
  out.owner=text(input.owner,'owner',80);
  out.objective=text(input.objective,'objective',500,{multiline:true});
  out.budget=budget(input.budget);
  out.links=links(input.links);
  out.notes=text(input.notes,'notes',2000,{multiline:true});
  if(!builtIn){
    const link=input.dataLink===undefined||input.dataLink===null?'':input.dataLink;
    if(typeof link!=='string'||(link&&!/^[A-Za-z0-9_-]{1,32}$/.test(link)))fail('dataLink','Invalid campaign ID.');
    out.dataLink=link;
  }
  return out;
}
export function slugFrom(name,taken){
  const base=String(name).normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase()
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,34).replace(/-+$/,'')||'campaign';
  let slug=base,n=2;
  while(taken.has(slug)||RESERVED.has(slug))slug=base+'-'+(n++);
  if(!SLUG.test(slug))fail('name','Could not create a link name for this campaign.');
  return slug;
}

const emptyRegistry=()=>({version:1,campaigns:[],builtIns:{},usedSlugs:[],updatedAt:null});
function normalise(saved){
  const r=saved&&typeof saved==='object'?saved:{};
  return {version:1,campaigns:Array.isArray(r.campaigns)?r.campaigns:[],builtIns:r.builtIns&&typeof r.builtIns==='object'?r.builtIns:{},
    usedSlugs:Array.isArray(r.usedSlugs)?r.usedSlugs:[],updatedAt:r.updatedAt||null};
}
const ordered=list=>list.slice().sort((a,b)=>a.order-b.order);
/* Public shape: non-archived campaigns in sidebar order plus built-in display overrides. */
export function publicView(registry){
  const r=normalise(registry);
  return {campaigns:ordered(r.campaigns.filter(c=>!c.archived)).map(({archived,archivedAt,order,...c})=>c),
    builtIns:r.builtIns,updatedAt:r.updatedAt};
}
export function fullView(registry){
  const r=normalise(registry);
  return {...publicView(r),archived:r.campaigns.filter(c=>c.archived).map(({order,...c})=>c)};
}

/* Apply one authenticated change and return the next registry. Pure. */
export function applyAction(registry,action,now=new Date()){
  const r=normalise(structuredClone(registry||emptyRegistry()));
  const at=now.toISOString();
  const find=slug=>{if(typeof slug!=='string'||!SLUG.test(slug))fail('slug','Unknown campaign.');
    const c=r.campaigns.find(x=>x.slug===slug);if(!c)fail('slug','Unknown campaign.');return c;};
  const live=()=>ordered(r.campaigns.filter(c=>!c.archived));
  const renumber=list=>list.forEach((c,i)=>{c.order=i;});
  switch(action?.action){
    case 'create':{
      if(r.campaigns.length>=MAX_CAMPAIGNS)fail('campaign','The registry is full.');
      const fields=validateCampaign(action.campaign);
      const slug=slugFrom(fields.name,new Set([...r.usedSlugs,...r.campaigns.map(c=>c.slug)]));
      const c={slug,...fields,archived:false,order:live().length,createdAt:at,updatedAt:at};
      r.campaigns.push(c);r.usedSlugs.push(slug);break;
    }
    case 'update':{
      const c=find(action.slug);
      Object.assign(c,validateCampaign(action.campaign),{updatedAt:at});break;
    }
    case 'updateBuiltIn':{
      if(!BUILT_IN.includes(action.key))fail('key','Unknown built-in campaign.');
      r.builtIns[action.key]={...validateCampaign(action.campaign,{builtIn:true}),updatedAt:at};break;
    }
    case 'reorder':{
      const order=action.order,current=live();
      if(!Array.isArray(order)||order.length!==current.length||new Set(order).size!==order.length||
         !order.every(s=>current.some(c=>c.slug===s)))fail('order','The order must list every active campaign once.');
      renumber(order.map(s=>current.find(c=>c.slug===s)));break;
    }
    case 'archive':{
      const c=find(action.slug);if(c.archived)fail('slug','Already archived.');
      c.archived=true;c.archivedAt=at;c.updatedAt=at;renumber(live());break;
    }
    case 'restore':{
      const c=find(action.slug);if(!c.archived)fail('slug','Not archived.');
      c.archived=false;delete c.archivedAt;c.updatedAt=at;c.order=live().length;renumber(live());break;
    }
    default:fail('action','Unknown action.');
  }
  r.updatedAt=at;
  return r;
}

export function authorised(request,secret){
  const supplied=String(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
  const a=Buffer.from(supplied),b=Buffer.from(String(secret||''));
  return a.length===b.length&&a.length>0&&timingSafeEqual(a,b);
}
