# X Tracker v5.0.29 | Equivalised Spend | NOT DEPLOYED

**Site:** https://elegant-swan-98c20a.netlify.app/  
**Site ID:** `3cfe75c9-5913-46a0-953f-eeae1a288a52`  
**Master filename:** `X_Tracker_MASTER_2026-10-17_v4.7.0.zip`

## Key Stats changes

- The last Key Stats tile now reads **Equivalised Spend**, not Dated Spend. The removed warning about missing payment dates no longer appears in the web application.
- Definition: total USD cost of all articles explicitly marked **Paid** and **Posted**, with a real posting date in **the last seven UK calendar days (today plus six prior days)**, converted to GBP, **divided by seven**. This is *average spend per calendar day*, not mean price per article.
- No `paidAt` field is required, so articles already paid and posted are not omitted just because their payment date was not entered. Incomplete cost or posting-date records cannot contribute a numerical spend.
- The original spreadsheet keeps article costs in **USD**. The client fetches the daily USD→GBP mid-market/reference FX rate from `https://api.frankfurter.dev/v1/latest?base=USD&symbols=GBP` (no API key required). The latest verified rate is cached locally and refreshed every 24 hours while the site is in use. A GBP total is rounded to two decimals for display.
- For a verified empty seven-day window the tile shows **£0.00**. If valid costs exist but neither a current nor cached FX rate is available, it temporarily displays **£—** rather than fabricating a GBP conversion. The FX source date appears in the tile's descriptive caption.
- If the owner filter is active, only placements for that owner are included. Older paid articles, unpaid articles, unpublished articles, and future publications are excluded.
- Rolling seven-day data updates with the normal one-minute dashboard refresh, including when midnight changes the seven-day window. FX is checked at least every 24 hours, with an hour retry after provider failure.

## Unchanged

- Dashboard, Historical, campaign and publisher pages, navigation, hourly UTM graph, daily clicks and table, mobile and desktop styling, all tracking and attribution functions, Google Sheets data, click cutoff, and scheduled metrics refresh are untouched.
- One Netlify Function (`netlify/functions/dashboard.mjs`) changed its **UI version string only** to 5.0.29 to match the frontend; no backend data, tracking or redirect logic changed. Original eight Functions are still present in full source.

## Validation

- `npm test`: **35/35 maintained tests passed**, including six added tests specifically for Equivalised Spend eligibility, seven-day divisor, currency conversion and cached FX handling.
- Chromium desktop (1440px) and mobile (390px) with synthetic USD records and mock FX API: both displayed **£40.00** from $350 spend × 0.8 / 7; zero horizontal overflow and no runtime errors. These test values are illustrative, **not live campaign numbers**.
- Node syntax and ZIP integrity checks performed.

## Deployment warning

**NOT DEPLOYED.** The source bundle incorporates recovered earlier production code and may be older than the currently published backend. Before using the existing Netlify project's drag-and-drop Deploys interface, download and compare current complete production source and merge any newer functionality. Do not publish static-only files. All eight Netlify Functions and their schedules, environment settings and events must be retained. Do not visit `/r/`, `/s/` or `/p/` redirects for testing; those generate click events. Do not create a new Netlify project.
