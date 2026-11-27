// Finance date ingestion: calendar dates are UK day labels, not inferred publication dates.
export function paymentDay(value){
 if(value===null||value===undefined||value==='')return '';
 let y,m,d;
 if(value instanceof Date){if(!Number.isFinite(value.getTime()))return '';return value.toISOString().slice(0,10);}
 if(typeof value==='number'&&Number.isFinite(value)&&value>=35000&&value<=80000){return new Date(Date.UTC(1899,11,30)+Math.floor(value)*86400000).toISOString().slice(0,10);}
 const s=String(value).trim();let match=s.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
 if(match){[,y,m,d]=match.map(Number);}else{match=s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);if(!match)return '';[,d,m,y]=match.map(Number);}
 const date=new Date(Date.UTC(y,m-1,d));if(date.getUTCFullYear()!==y||date.getUTCMonth()!==m-1||date.getUTCDate()!==d)return '';
 return date.toISOString().slice(0,10);
}
// Explicit owner payment confirmations (not post publication dates).
// 25 Nov: all six unpaid at 16:38 UTC, then confirmed paid at 16:53 UTC.
// 16 Nov: separate AlinaDavy20 $50 QRT payment, not her earlier original post.
// The source sheet remains authoritative for total cost; changed amounts retain an undated remainder.
const confirmed={
 'GTAM|kyronis_talks':['2026-11-25',180],
 'GTAM|doctoramna11':['2026-11-25',50],
 'GTAM|insomnia_vip':['2026-11-25',100],
 'GTAM|aiwithaman':['2026-11-25',30],
 'GTAM|nekt_0':['2026-11-25',70],
 'GTAM|_yashalali':['2026-11-25',50],
 'GTAQ|alinadavy20':['2026-11-16',50]
};
export function confirmedPayment(row){
 if(row.paid!==true||row.planned===true||paymentDay(row.paidAt))return row;
 const key=row.campaign+'|'+String(row.publisher||'').trim().replace(/^@/,'').toLowerCase(),p=confirmed[key];
 if(!p||row.identityAmbiguous||typeof row.cost!=='number'||row.cost<p[1])return row;
 return {...row,paidAt:p[0],datedPaidAmount:p[1],paymentDateSource:'Owner-confirmed payment'};
}
