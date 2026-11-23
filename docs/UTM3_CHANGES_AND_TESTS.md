# UTM3 full source update

The change is based on the **actual user-attached, complete v4.9.1 source**, not a rebuilt project. The pre-update exact bytes are provided as a separate original source backup. Four principal runtime files changed: `public/index.html`, `public/app.js`, `public/styles.css`, `netlify/functions/dashboard.mjs` (backend version literal only). Auxiliary files were updated for cache/version, test and release documentation. Apps Script and all redirect, click and Google Sheets runtime parsing code remained unchanged.

## Sorting contract

The shared modes are `recent`, `clicks`, `views`, `priceHigh`, and `priceLow`, corresponding to the requested visible option labels. Live articles use actual X post timestamps extracted from snowflake post IDs, or exact trustworthy `postedAt` timestamps. Unpublished records may fall back to actual booked/paid timestamps for deterministic recency. Missing sort data sorts last, even in ascending price mode. Each affected page includes a sort selector first, using the appropriate recorded metrics.

## Age boundary

The 48-hour limit uses timestamp differences in milliseconds. Below 48h is new. At 48h is old. Missing/untrustworthy timestamps are never new. Cards update on the 15s client age refresh cycle, on visibility return, and on data refresh.

## Safety

The approved click reset cutoff `2026-10-17T00:32:36Z` remains unchanged. Preserve the eight archived older click records and later genuine clicks. Never use production tracking redirect links to test. Do not clear Netlify Blobs, modify redirects or UTM identities, migrate the website, use GitHub, or touch source-of-truth Sheet entries without approval.

## Test history

Old tests are retained unmodified and exposed as `npm run test:legacy`; many cover superseded filters, old clicks-first defaults and previous version literals. `npm test` runs the newly maintained 10 UTM3 tests plus 8 unaffected source integrity/click-baseline regression tests. Isolated browser smoke tests ran outside the ZIP from the actual HTML/JS/CSS and simulated live-shaped data; no browser test was run on production. Running the new default suite does not establish compatibility of all historical tests.

## 19 October 2026 | v5.0.25 latest UI

Older articles now use a 9px (desktop) / 7px (mobile) red-to-orange rounded gradient border with a white interior and border-masked sparkle detail. New articles retain full vibrant red-orange fills and NEW! badges. Views and likes numbers/labels increased for prominence on desktop/mobile. Global sparkle opacity reduced from 0.25 to 0.225. The preceding daily overview update includes 7-day dual-axis red-orange click / blue dated-spend SVG chart. 27 maintained tests passed, and isolated Chromium visual checks ran at 390px and 1440px. No live deploy. The target currently publishes v5.0.23 (deploy 6ad60245a1510eb8c8b012d0); compare and merge complete production sources prior to upload.


## 19 October 2026 | v5.0.26 typography and spacing

The daily SVG now sizes its own viewBox to the actual chart container width rather than shrinking a 920px drawing. Axis text uses regular system Arial, with `stroke:none` to prevent inherited icon strokes from smearing glyphs. Reactive ResizeObserver handles orientation/desktop resizing. Desktop chart capped at 990px, daily KPI headings and site width scaled down. Top-weighted padding/vertical rhythm increased throughout active pages and phone sizes. 28 maintained tests and five-width browser layout checks passed. No backend click/UTM logic modified.
