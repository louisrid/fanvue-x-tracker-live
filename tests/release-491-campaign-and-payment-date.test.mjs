import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../netlify/lib/sheet-source.mjs',import.meta.url),'utf8');
const code=source.replace(/^import ExcelJS from 'exceljs';\n/,'').replace(/^export /gm,'');
const {parseWorkbook,columns,metricDate}=vm.runInNewContext(code+'\n({parseWorkbook,columns,metricDate})',{URL,Date,Buffer,console});
class Cell {constructor(value){this.value=value;}}
class Row {constructor(cells={}){this.cells=cells;}getCell(n){return new Cell(this.cells[n]??null);}eachCell(cb){for(const [k,v] of Object.entries(this.cells))if(v!==null)cb(new Cell(v),Number(k));}}
class Sheet {constructor(name,headers={},record=null){this.name=name;this.rows={7:new Row(headers)};this.rowCount=record?8:7;if(record)this.rows[8]=new Row(record);}getRow(n){return this.rows[n]||new Row();}}
const heading={2:'ACCOUNT',3:'LINK',5:'ARTICLE LINK',6:'UTM',7:'ARTICLE',8:1,12:'PAID?',13:'POSTED?',14:'LINK',15:'UTM ID',19:'X POST VIEWS',20:'X POST LIKES',21:'X UPDATED (UK)',23:'CAMPAIGN',24:'PAID DATE'};
const record={2:'paidPublisher',3:'https://x.com/paidPublisher',5:'ARTICLE 2.1',7:150,8:true,12:true,13:true,14:'https://x.com/paidPublisher/status/2111442075753582651',15:'A01-P19',19:1200,20:40,21:'17 Oct 2026 10:00 BST',23:'C002',24:new Date('2026-10-15T00:00:00.000Z')};
function book(paidDate,includeDateHeader=true){
 const louis=new Sheet('WEEK 1 - LOUIS',{...heading,...(!includeDateHeader?{24:null}:{})},{...record,24:paidDate});
 const connor=new Sheet('WEEK 1 - CONNOR',{...heading,15:null},null);
 // Connor uses UTM ID at N (14), independent of optional new W/X source columns.
 connor.rows[7].cells[14]='UTM ID';connor.rows[7].cells[13]='LINK';connor.rows[7].cells[12]='POSTED?';connor.rows[7].cells[11]='PAID?';connor.rows[7].cells[6]='ARTICLE';connor.rows[7].cells[7]=1;connor.rows[7].cells[19]='X POST VIEWS';connor.rows[7].cells[20]='X POST LIKES';connor.rows[7].cells[21]='X UPDATED (UK)';
 const temp=new Sheet('WEEK X - TEMP',connor.rows[7].cells,null);
 const campaign=new Sheet('CAMPAIGNS',{},null);campaign.rowCount=5;campaign.rows[5]=new Row({1:'C002',2:'Fanvue Partners'});
 const worksheets=[louis,connor,temp,campaign];return {worksheets,getWorksheet:n=>worksheets.find(w=>w.name===n)};
}
test('campaign field populates existing campaign ID and verified weekly paid date',()=>{
 const result=parseWorkbook(book(new Date('2026-10-15T00:00:00.000Z')),Date.parse('2026-10-18T12:00:00Z'));
 assert.equal(result.placements.length,1);const p=result.placements[0];
 assert.equal(p.code,'A01-P19');assert.equal(p.campaignId,'C002');assert.equal(p.paidAt,'2026-10-15T00:00:00.000Z');
 assert.equal(result.campaigns.find(c=>c.id==='C002')?.name,'Fanvue Partners');
 assert.equal(p.cost,150);assert.equal(p.paid,true);assert.equal(p.posted,true);
 assert.ok(!JSON.stringify(result).includes('PAYMENT DETAILS'));
});
test('blank paid dates are not invented, including for already-paid placements',()=>{
 const data=parseWorkbook(book(null));assert.equal(data.placements[0].paid,true);assert.equal(data.placements[0].paidAt,'');
});
test('old workbook layouts without Paid Date remain supported',()=>{
 const data=parseWorkbook(book(null,false));assert.equal(data.placements[0].paidAt,'');assert.equal(data.placements[0].campaignId,'C002');
});
test('date strings safely parse and bad dates do not create false payment dates',()=>{
 const good=parseWorkbook(book('2026-10-16'));assert.equal(good.placements[0].paidAt,'2026-10-16T00:00:00.000Z');
 const bad=parseWorkbook(book('not a date'));assert.equal(bad.placements[0].paidAt,'');
});
test('explicit weekly campaign and paid date take precedence over legacy optional metadata',()=>{
 const w=book(new Date('2026-10-15T00:00:00.000Z'));
 const meta=new Sheet('PROMO META',{},null);
 meta.rowCount=2;meta.rows[2]=new Row({1:'A01-P19',2:'C003',7:'2026-09-10'});
 w.worksheets.push(meta);
 const row=parseWorkbook(w).placements[0];
 assert.equal(row.campaignId,'C002');
 assert.equal(row.paidAt,'2026-10-15T00:00:00.000Z');
});
