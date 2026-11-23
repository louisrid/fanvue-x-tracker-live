/* XTRACKER | Presentation-only polish. Does not fetch, post, track or modify data. */
(() => {
  'use strict';
  const arrow = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19 12H5m7-7-7 7 7 7"></path></svg>';
  const singleText = new Map([
    ['Refresh X Stats', 'Refresh stats'],
    ['Daily breakdown', 'Daily performance'],
    ['Tweet performance', 'Tweet performance'],
    ['Article placements', 'Article placements'],
    ['Account performance', 'Account performance'],
    ['Published X posts', 'Published posts'],
    ['Campaign paid total', 'Spend'],
    ['Combined X views', 'X views'],
    ['Combined X Views', 'X views'],
    ['Known Boost Spend ($)', 'Recorded spend'],
    ['Effective Cost / 1K Views', 'Cost / 1K views'],
    ['Actual boost spend ($)', 'Spend'],
    ['Effective cost / 1K views', 'Cost / 1K views'],
    ['Views gained · 24h', '24h views'],
    ['Original tweet / @handle', 'Tweet / account'],
    ['X views', 'X views'],
    ['X Views', 'X views'],
    ['Paid total', 'Spend'],
    ['Paid total.', 'Spend'],
    ['Live articles.', 'Live articles'],
    ['UTM clicks.', 'UTM clicks'],
    ['Views recorded.', 'X views'],
    ['Likes recorded.', 'Likes'],
    ['Week UTM clicks', 'Weekly clicks'],
    ['This week\'s UTM clicks', 'Weekly clicks'],
    ['UTM Clicks', 'UTM clicks'],
    ['Sort By', 'Sort'],
    ['Most Recent', 'Newest first'],
    ['Most recently added', 'Newest first'],
    ['Price: High to Low', 'Highest spend'],
    ['Price: Low to High', 'Lowest spend'],
    ['Unknown', 'Not recorded']
  ]);
  const wordsSelectors = [
    '.site-page .x-refresh-button > span',
    '.site-page .daily-metric-label',
    '.site-page .article-kpi-label',
    '.site-page .result-line h2',
    '.site-page .daily-overview h2',
    '.site-page .daily-overview h3',
    '.site-page .account-table thead th',
    '.site-page .daily-totals-table thead th',
    '.site-page .select-control > span',
    '.site-page select option',
    '.site-page .account-mobile-card span',
    '.site-page .account-mobile-card strong',
    '.site-page .daily-overview-metrics small',
    '.site-page .kpi-label',
    '.site-page .historical-week-kpi span'
  ].join(',');
  let queued = false;
  function improveText(el) {
    for (const node of el.childNodes) {
      if (node.nodeType !== Node.TEXT_NODE) continue;
      const before = node.nodeValue;
      const key = before.trim();
      if (singleText.has(key) && key !== singleText.get(key)) {
        node.nodeValue = before.replace(key, singleText.get(key));
      }
    }
  }
  function polish() {
    // The newer GTA VI page has an empty back button in the live source.
    for (const button of document.querySelectorAll('.site-page .page-back-button')) {
      if (!button.querySelector('svg')) button.innerHTML = arrow;
      button.setAttribute('aria-label', 'Back');
    }
    // Keep all existing handlers, values, status colours and destinations.
    document.querySelectorAll(wordsSelectors).forEach(improveText);
    // Remove only visible developer-facing placement codes. Values remain in DOM.
    document.querySelectorAll('.site-page .article-card-meta > span').forEach(span => {
      const label = span.textContent.trim();
      if (/^(?:GTA[12]-R\d+|A\d{2}-P\d+|OF\d+)$/i.test(label)) {
        span.classList.add('xt-internal-code');
      }
      if ((span.closest('#page-of,#page-gta-vi')) &&
          (label === 'X post' || label === 'GTA VI post' || label === 'GTA VI V2 post')) {
        span.classList.add('xt-internal-code');
      }
    });
    // Preserve the useful original vs V2 campaign label, remove verbose timestamp.
    document.querySelectorAll('#page-gta-vi .of-last-click').forEach(node => {
      const text = node.textContent;
      const shortened = text.replace(/\s*·\s*X updated\s+.*$/i, '').trim();
      if (shortened !== text) node.textContent = shortened;
    });
    // A blank spend is a deliberate unknown, not a failure or a zero.
    document.querySelectorAll('#page-x-rts #boostRows td:nth-child(2)').forEach(cell => {
      if (cell.textContent.trim() === 'Unknown') cell.textContent = 'Not recorded';
    });
    const boostStatus = document.getElementById('boostStatus');
    if (boostStatus && boostStatus.textContent.includes('Views include organic traffic')) {
      boostStatus.textContent = 'Includes organic views';
    }
  }
  function requestPolish() {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(() => { queued = false; polish(); });
  }
  function start() {
    polish();
    const main = document.getElementById('mainContent');
    if (main) {
      new MutationObserver(requestPolish).observe(main, {subtree:true, childList:true, characterData:true});
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
