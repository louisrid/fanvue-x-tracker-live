// Read only public publisher identities. Payment/contact columns are never returned.
import ExcelJS from 'exceljs';
import {getStore} from '@netlify/blobs';
import snapshot from '../lib/publisher-directory-snapshot.mjs';
const SHEET='1NYULTB2NwUhMZvEBBbR6COy2tCHoZihcTwwJsGdkmrY';
const text=c=>{const v=c?.value;return String(v?.text??v?.result??(typeof v==='object'?'':v)??'').trim();};
export function parseDirectory(book){
  const accounts=new Map();
  for(const tab of book.worksheets){
    if(!/^(X|IG)(?:\s*[:_-]|\s)/.test(tab.name))continue;
    const platform=tab.name.startsWith('IG')?'Instagram':'X';
    for(let i=5;i<=tab.rowCount;i++){
      const cell=tab.getRow(i).getCell(1),label=text(cell);
      const raw=cell.hyperlink||cell.value?.hyperlink||label;
      const handle=String(raw).match(/(?:x\.com|twitter\.com|instagram\.com)\/([\w.]+)/i)?.[1]||label.match(/@([\w.]+)/)?.[1];
      if(!handle)continue;
      const key=platform+'|'+handle.toLowerCase();
      if(!accounts.has(key))accounts.set(key,{key,handle:'@'+handle,platform,profileUrl:'https://'+(platform==='X'?'x.com/':'www.instagram.com/')+handle});
    }
  }
  return [...accounts.values()];
}
export function createDirectoryHandler({storeFactory=()=>getStore({name:'fanvue-publisher-directory-v1',consistency:'strong'}),fetcher=fetch}={}){return async()=>{
  let store=null,saved=null;
  try{store=storeFactory();saved=await store.get('last-good',{type:'json'});}catch{}
  if(saved&&Date.now()-Date.parse(saved.checkedAt)<7_200_000)return Response.json(saved);
  try{
    const res=await fetcher('https://docs.google.com/spreadsheets/d/'+SHEET+'/export?format=xlsx',{signal:AbortSignal.timeout(10000)});
    if(!res.ok)throw Error('Directory unavailable');
    const bytes=await res.arrayBuffer();if(bytes.byteLength>8_000_000)throw Error('Directory exceeds size limit');
    const book=new ExcelJS.Workbook();await book.xlsx.load(Buffer.from(bytes));
    const accounts=parseDirectory(book);if(!accounts.length)throw Error('Directory has no verifiable identities');
    const data={ok:true,checkedAt:new Date().toISOString(),accounts};
    try{await store?.setJSON('last-good',data);}catch{}
    return Response.json(data);
  }catch{
    return Response.json({...snapshot,...saved,ok:true,stale:true});
  }
};}
export default createDirectoryHandler();
