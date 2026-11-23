# X Tracker v5.0.30 – Key Stats live-data repair – NOT DEPLOYED

**Existing site:** https://elegant-swan-98c20a.netlify.app/  
**Site ID:** `3cfe75c9-5913-46a0-953f-eeae1a288a52`

## Root cause and correction

The live `/.netlify/functions/dashboard` endpoint returned real click and placement data with `uiVersion: 5.0.27` while the updated frontend identified itself as v5.0.29. The frontend treated the version string alone as a breaking compatibility failure and triggered `location.replace()` before updating the metrics. Repeated reloads left all tiles as N/A, the status as DATA UNAVAILABLE, and spend as an inaccurate pre-load count of zero paid/published articles.

- Removed unconditional browser navigation on a backend/frontend version mismatch; continue to process a valid compatible JSON payload and log the version discrepancy to the browser console.
- The page now loads verified clicks and placement/spend records without awaiting an independently slow `/events` hourly-data request. That request still updates the graph as soon as it finishes.
- While initial data are not verified, the spend card says it is waiting for data rather than claiming a real zero article count.
- Improved resilience of USD-to-GBP conversion: Frankfurter remains primary, with ExchangeRate-API open public endpoint as dated fallback. No fabricated exchange rate.
- Updated frontend asset query version and dashboard response version to 5.0.30. Other server-side algorithms are untouched.

## Live API diagnosis (read-only; not a production change)

At diagnosis the production dashboard endpoint was healthy (`ok: true`) and exposed `75` tracked click events and six qualifying paid and posted articles totalling **$890 USD** before any GBP conversion. These are observations from the live API at that time, not amounts embedded in the application. The data continue to come from the server.

## Testing

- `npm test`: 38/38 tests passed, including three new data-load regression tests for older API versions, slow hourly events and genuine backend failures.
- Chromium at 390px and 1440px, with isolated mock server data and deliberately older backend uiVersion 5.0.27, showed all three metric cards, LIVE DATA status, £101.71 from fixture cost $890 at *fictional* 0.8 GBP/USD, no JavaScript errors and no horizontal scrolling.
- No production URLs for redirect/click collection were visited.
- All eight Netlify Functions remain in the complete archive, unchanged except the dashboard UI-version string.

## Publishing

**NOT DEPLOYED.** Use the original site's manual Netlify Deploys drag-and-drop workflow only if it includes and deploys all eight Functions and all schedules. Back up/compare latest production source; retain production environment variables, Google Sheets, backend click storage, authentic tracked events and historical records. Do not create a second site. Never visit `/r/`, `/s/` or `/p/` to test; those generate genuine clicks.
