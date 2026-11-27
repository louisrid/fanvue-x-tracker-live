/* Shared by the report backend and cached browser rendering. No estimated dates. */
(function(root){
'use strict';
// Finance date ingestion: calendar dates are UK day labels, not inferred publication dates.
function paymentDay(value){
 if(value===null||value===undefined||value==='')return '';
 let y,m,d;
 if(value instanceof Date){if(!Number.isFinite(value.getTime()))return '';return value.toISOString().slice(0,10);}
 if(typeof value==='number'&&Number.isFinite(value)&&value>=35000&&value<=80000){return new Date(Date.UTC(1899,11,30)+Math.floor(value)*86400000).toISOString().slice(0,10);}
 const s=String(value).trim();let match=s.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
 if(match){[,y,m,d]=match.map(Number);}else{match=s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);if(!match)return '';[,d,m,y]=match.map(Number);}
 const date=new Date(Date.UTC(y,m-1,d));if(date.getUTCFullYear()!==y||date.getUTCMonth()!==m-1||date.getUTCDate()!==d)return '';
 return date.toISOString().slice(0,10);
}
// Explicit dates from ordinary spreadsheet cells, never cell pop-up notes.
function paymentDetailsDate(value,cost){
 const text=String(value??'');
 const months={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
 const dates=[...text.matchAll(/\bpaid\s+(?:on\s+)?(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})\b/gi)].map(m=>{const month=months[m[2].slice(0,3).toLowerCase()];return month?paymentDay(m[3]+'-'+String(month).padStart(2,'0')+'-'+m[1].padStart(2,'0')):'';}).filter(Boolean);
 dates.push(...[...text.matchAll(/\bpaid\s+(?:on\s+)?(\d{4}-\d{2}-\d{2}|\d{1,2}[/.\-]\d{1,2}[/.\-]\d{4})\b/gi)].map(m=>paymentDay(m[1])).filter(Boolean));
 if(new Set(dates).size!==1)return {};
 const paidAt=dates[0],out={paidAt,paymentDateSource:'Spreadsheet Payment Details'};
 const explicit=[...text.matchAll(/\$([\d,]+(?:\.\d{1,2})?)\s*(?:USD\s*)?(?:crypto\s+|PayPal\s+|USDT\s+)?paid\s+(?:on\s+)?(?:\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}[/.\-]\d{1,2}[/.\-]\d{4})\b/gi)];
 if(explicit.length===1&&typeof cost==='number'){const amount=Number(explicit[0][1].replace(/,/g,''));if(Number.isFinite(amount)&&amount>=0&&amount<cost)out.datedPaidAmount=amount;}
 return out;
}
// Explicit owner payment confirmations (not post publication dates).
// 25 Nov: all six unpaid at 16:38 UTC, then confirmed paid at 16:53 UTC.
// 16 Nov 15:19–15:39 UTC: explicit Aaliyah $80, Insomnia $70 and Alina $50 QRT payments.
// 20 Nov 16:35 UTC: exact payment confirmations for Quam, Yashal, AI Doctor, Zoey, Arkav, NetKlips, Zoraiz and Elise; ambiguous Obsrvate amount excluded.
// The source sheet remains authoritative for total cost; changed amounts retain an undated remainder.
const confirmed={
 'GTAM|kyronis_talks':['2026-11-25',180],
 'GTAM|doctoramna11':['2026-11-25',50],
 'GTAM|insomnia_vip':['2026-11-25',100],
 'GTAM|aiwithaman':['2026-11-25',30],
 'GTAM|nekt_0':['2026-11-25',70],
 'GTAM|_yashalali':['2026-11-25',50],
 'GTAQ|alinadavy20':['2026-11-16',50],
 'GTAQ|iluv_papi':['2026-11-16',50],
 'GTAQ|aaliyah | ai':['2026-11-16',80],
 'GTAQ|insomnia_vip':['2026-11-16',70],
 'GTAQ|quam':['2026-11-20',75],
 'GTAQ|yashal ai':['2026-11-20',50],
 'GTAQ|ai doctor':['2026-11-20',50],
 'GTAQ|zoey bennett':['2026-11-20',100],
 'GTAQ|arkavx':['2026-11-20',100],
 'GTAQ|netklips':['2026-11-20',120],
 'GTAQ|zoraiz ai':['2026-11-20',40],
 'GTAQ|elise perry':['2026-11-20',70]
};
function confirmedPayment(row){
 if(row.paid!==true||row.planned===true||paymentDay(row.paidAt))return row;
 const key=row.campaign+'|'+String(row.publisher||'').trim().replace(/^@/,'').toLowerCase(),p=confirmed[key];
 if(!p||row.identityAmbiguous||typeof row.cost!=='number'||row.cost<p[1])return row;
 return {...row,paidAt:p[0],datedPaidAmount:p[1],paymentDateSource:'Owner-confirmed payment'};
}

// Owner confirmed the separate $1,700 tab-16 allocation on 24 November 2026.
 // The rows are a reservation, not an additional completed payment. Match the
 // exact recorded batch, not arbitrary future rows or their publication dates.
const approvedQrtPlan=Object.freeze({"yashal ai":50,"elise perry":100,"iluv_papi":50,"inshrah_ali_":40,"ai doctor":50,"alexa_cooper3":40,"seharshinwari":40,"obsrvate":100,"alzina3691":40,"zahra4sure":40,"alinadavy20":50,"heytoha":150,"zoraiz ai":100,"quam":100,"netklips":120,"theepicstreamer":50,"nusratsid1":40,"wealthempirehq":100,"lexibamo":40,"arkavx":150,"insomnia_vip":70,"riley11_ai":40,"itx_hazel_":40,"aaliyah | ai":100});
function confirmedPlan(row){
 if(row.campaign!=='GTAQ2'||(row.paid===true&&row.planned!==true)||paymentDay(row.plannedAt)||paymentDay(row.bookedAt)||row.identityAmbiguous)return row;
 const key=String(row.publisher||'').trim().replace(/^@/,'').toLowerCase(),amount=approvedQrtPlan[key];
 if(!Object.prototype.hasOwnProperty.call(approvedQrtPlan,key)||typeof row.cost!=='number'||row.cost<amount)return row;
 return {...row,plannedAt:'2026-11-24',datedPlannedAmount:amount,planDateSource:'Owner-confirmed separate QRT allocation'};
}
const reconcileRow=row=>confirmedPlan(confirmedPayment(row));
function applyPaymentDates(overview){
 if(!overview||!Array.isArray(overview.campaigns))return overview;
 return {...overview,campaigns:overview.campaigns.map(c=>({...c,...(Array.isArray(c.rows)?{rows:c.rows.map(reconcileRow)}:{}),...(Array.isArray(c.paidReposts)?{paidReposts:c.paidReposts.map(reconcileRow)}:{})}))};
}
root.FanvuePaymentDates=Object.freeze({paymentDay,paymentDetailsDate,confirmedPayment,confirmedPlan,applyPaymentDates});
})(globalThis);
