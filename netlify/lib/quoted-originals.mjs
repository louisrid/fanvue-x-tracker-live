// Verified, lifetime attribution from paid QRTs to the X posts that they actually quote.
// A QRT view is different from a quoted-post view; neither is unique audience reach.
const amount=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null;
const idFromUrl=url=>String(url||'').match(/^https:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/[A-Za-z0-9_]+\/status\/(\d+)(?:[/?#]|$)/i)?.[1]||null;
const safeQuote=q=>q&&/^\d{1,20}$/.test(String(q.id||''))&&idFromUrl(q.url)===String(q.id);
const increment=(a,b)=>b==null?a:a==null?b:a+b;

export function summariseQuotedOriginals(publishers=[],metrics={}){
  const byOriginal=new Map(),seenPromos=new Set();
  let matched=0;
  for(const p of publishers){
    if(p.campaign!=='GTAQ'||p.posted!==true)continue;
    const qrtId=idFromUrl(p.postUrl);
    if(!qrtId||seenPromos.has(qrtId))continue;
    seenPromos.add(qrtId);
    const quoted=metrics?.[qrtId]?.quotedPost;
    if(!safeQuote(quoted))continue;
    matched++;
    const id=String(quoted.id);
    if(!byOriginal.has(id))byOriginal.set(id,{
      originalPostId:id,originalUrl:quoted.url,handle:quoted.handle,
      firstQuotedSnapshot:quoted,qrts:[],paidSpendKnown:0,
      unknownPaidCosts:0,paidQrtCount:0,qrtViews:null,qrtLikes:null,
      qrtReposts:null,qrtReplies:null,allTimeHumanClicks:null,
      postPublicationClicks:null
    });
    const group=byOriginal.get(id);
    if(Date.parse(quoted.at||'')>(Date.parse(group.firstQuotedSnapshot.at||'')||0))group.firstQuotedSnapshot=quoted;
    const qrt={
      publisher:p.publisher,profileUrl:p.profileUrl||'',trackingUrl:p.trackingUrl||'',
      postUrl:p.postUrl,views:amount(p.views),
      likes:amount(p.likes),reposts:amount(p.reposts),replies:amount(p.replies),
      paid:!!p.paid,cost:p.paid?amount(p.cost):null,
      allTimeHumanClicks:amount(p.allTimeClicks),postPublicationClicks:amount(p.clicks),
      metricAt:p.metricAt||null
    };
    group.qrts.push(qrt);
    if(qrt.paid){group.paidQrtCount++;if(qrt.cost===null)group.unknownPaidCosts++;else group.paidSpendKnown+=qrt.cost;}
    group.qrtViews=increment(group.qrtViews,qrt.views);
    group.qrtLikes=increment(group.qrtLikes,qrt.likes);
    group.qrtReposts=increment(group.qrtReposts,qrt.reposts);
    group.qrtReplies=increment(group.qrtReplies,qrt.replies);
    // Don't count clicks for a shared/ambiguous tracking link twice.
    if(!p.sharedTracking&&!p.identityAmbiguous){
      group.allTimeHumanClicks=increment(group.allTimeHumanClicks,qrt.allTimeHumanClicks);
      group.postPublicationClicks=increment(group.postPublicationClicks,qrt.postPublicationClicks);
    }
  }
  const rows=[...byOriginal.values()].map(g=>{
    const direct=metrics?.[g.originalPostId];
    const source=g.firstQuotedSnapshot;
    const directIsNewer=!!direct?.at&&Date.parse(direct.at)>=Date.parse(source.at||0);
    const get=k=>directIsNewer&&amount(direct?.[k])!=null?amount(direct[k]):amount(source[k])??amount(direct?.[k]);
    return {
      originalPostId:g.originalPostId,originalUrl:g.originalUrl,handle:g.handle,
      views:get('views'),likes:get('likes'),reposts:get('reposts'),replies:get('replies'),
      metricAt:directIsNewer?direct.at:source.at,
      qrtCount:g.qrts.length,paidQrtCount:g.paidQrtCount,
      paidSpendKnown:g.paidSpendKnown,unknownPaidCosts:g.unknownPaidCosts,
      qrtViews:g.qrtViews,qrtLikes:g.qrtLikes,qrtReposts:g.qrtReposts,qrtReplies:g.qrtReplies,
      allTimeHumanClicks:g.allTimeHumanClicks,postPublicationClicks:g.postPublicationClicks,
      qrts:g.qrts
    };
  }).sort((a,b)=>b.qrtCount-a.qrtCount||(b.qrtViews??-1)-(a.qrtViews??-1));
  return {
    scope:'verified-quoted-original-posts-v1',rows,
    summary:{
      originalPosts:rows.length,matchedQrts:matched,publishedQrts:seenPromos.size,
      unmatchedQrts:seenPromos.size-matched,
      quotedPostViews:rows.reduce((n,r)=>increment(n,r.views),null),
      qrtViews:rows.reduce((n,r)=>increment(n,r.qrtViews),null),
      allocatedPaidSpend:rows.length?rows.reduce((n,r)=>n+r.paidSpendKnown,0):null,
      unknownPaidCosts:rows.reduce((n,r)=>n+r.unknownPaidCosts,0)
    },
    note:'All-time current X post counters, not unique reach. Each original is counted once; each unique paid QRT is counted once. Spend comes from the operations sheet, not from verified payment transfers.'
  };
}
