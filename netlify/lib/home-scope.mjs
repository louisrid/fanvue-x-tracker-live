export const homePaidCodes=(placements,status)=>
  ['SHEET_LIVE','SHEET_FRESH','SHEET_CACHED'].includes(status)
    ? placements.filter(p=>p.active===true&&p.paid===true).map(p=>p.code)
    : [];
