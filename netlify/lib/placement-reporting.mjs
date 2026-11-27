// Financial source rows remain independent of publication/analytics eligibility.
export function summarisePlacements(rows=[]){
  const valid=p=>typeof p.cost==='number'&&Number.isFinite(p.cost)&&p.cost>=0;
  const sum=items=>Math.round(items.filter(valid).reduce((n,p)=>n+p.cost,0)*100)/100;
  const paid=rows.filter(p=>p.paid===true&&p.planned!==true);
  const publication=p=>/^https:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/\w+\/status\/\d+(?:[/?#]|$)/i.test(p.postUrl||'');
  return {totalSpend:sum(rows),spend:sum(rows),paidSpend:sum(paid),publishedSpend:sum(paid.filter(p=>p.posted===true)),
    pendingPaidSpend:sum(paid.filter(p=>p.posted!==true)),publishedPosts:rows.filter(p=>p.posted===true&&publication(p)).length,
    paidCount:paid.length,unpaidCount:rows.filter(p=>p.paid!==true).length,
    missingPaidCosts:paid.filter(p=>!valid(p)).length};
}
