import ExcelJS from 'exceljs';
import {paymentDay} from './payment-dates.mjs';
import {value,link} from './sheet-source.mjs';
export const OF_SHEET_ID='1D8rI3BuuFHIemYZY92QFiHDMkj876F8oiwpDR6sMiTE';
export const OF_TAB='X Accounts 13 (OF Terms)';
export const ofCode=code=>/^OF[1-9]\d*$/.test(String(code||''));
export function parseOfWorkbook(workbook){
  const sheet=workbook.getWorksheet(OF_TAB);
  if(!sheet)throw new Error('OF campaign source tab missing');
  const publishers=[],seen=new Set();
  let paymentColumn=0;sheet.getRow(7).eachCell((c,i)=>{if(/^(PAID DATE|PAYMENT DATE|PAID AT)$/i.test(String(value(c)).trim()))paymentColumn=i;});
  for(let row=8;row<=sheet.rowCount;row++){
    const r=sheet.getRow(row),c=n=>r.getCell(n),publisher=String(value(c(2))).trim();
    if(!publisher)continue;
    const trackingUrl=link(c(5));let url;try{url=new URL(trackingUrl);}catch{throw new Error('Missing OF tracking URL at row '+row);}
    const code=url.pathname.match(/^\/of\/(OF[1-9]\d*)\/?$/)?.[1];
    if(url.hostname!=='elegant-swan-98c20a.netlify.app'||!code||seen.has(code))throw new Error('Invalid or duplicate OF tracking URL at row '+row);
    seen.add(code);
    const amount=value(c(19));const cost=amount===''?null:Number(amount);
    if(cost!==null&&(!Number.isFinite(cost)||cost<0))throw new Error('Invalid OF amount at row '+row);
    const truth=n=>value(c(n))===true||String(value(c(n))).trim().toUpperCase()==='TRUE';
    publishers.push({code,publisher,campaignId:'C001',sourceRow:row,sourceTab:OF_TAB,profileUrl:link(c(3)),articleUrl:link(c(4)),trackingUrl,postUrl:link(c(7)),cost,paid:truth(21),posted:truth(22),paidAt:paymentDay(paymentColumn?value(c(paymentColumn)):null)});
  }
  return publishers;
}
export async function readOfPublishers(fetcher=fetch){
  const response=await fetcher(`https://docs.google.com/spreadsheets/d/${OF_SHEET_ID}/export?format=xlsx`,{cache:'no-store',signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error('OF Google Sheets export unavailable');
  const bytes=await response.arrayBuffer();if(bytes.byteLength>12000000)throw new Error('OF workbook too large');
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(Buffer.from(bytes));return parseOfWorkbook(workbook);
}
export {readOfEvents,mergeOfEvents} from './of-events.mjs';
