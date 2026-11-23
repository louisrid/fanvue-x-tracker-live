// Reporting baseline approved on 17 October 2026 at 01:32:36 BST.
// Old Netlify Blob records remain intact for audit; none are counted or exposed
// by the click-reporting endpoints after this filter is applied.
export const CLICK_COUNT_START_AT = '2026-10-17T00:32:36.000Z';
export const CLICK_COUNT_START_MS = Date.parse(CLICK_COUNT_START_AT);
export function isCurrentClick(event) {
  const time = Date.parse(String(event?.timestamp || ''));
  return Number.isFinite(time) && time >= CLICK_COUNT_START_MS;
}
