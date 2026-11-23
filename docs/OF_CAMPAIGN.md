# OF Terms X Promo · C001

`#campaign-C001` opens a dedicated Key Stats style report. It reads the `X Accounts 13 (OF Terms)` tab in `NEW LOUIS X FANVUE PROMO` directly. Publisher identity comes from column B; profile, Doc, tracking, and post links come from C, D, E, and G. Amounts, paid status, and posted status come from S, U, and V. Only a true posted status gives a green POSTED badge. Unposted publishers appear separately.

Paid spending and publisher posting totals cover the campaign to date. Weekly clicks and daily buckets use the current Monday–Sunday week in Europe/London, including daylight saving changes. Payment dates are absent, so the report does not present campaign spending as weekly spending. There is no Total Placements KPI.

`/of/OF1` through `/of/OF10` retain the original 302 Fanvue signup destination and the original `utm_source=x`, `utm_medium=paid_social`, `utm_campaign=of_terms_2026`, and matching `utm_content=OFn`. Positive future OF account codes continue to work. The redirect still records to the original `of_terms_clicks` table. No new database, migration, or parallel event store was introduced.

The existing `events` CSV endpoint now combines article events with non-test OF database events. Database events retain their original IDs and timestamps. Matching legacy mirror records do not add a second click, and distinct database records remain distinct even when timestamps match. OF events are not subject to the article campaign's historic reporting reset. Existing article code validation and destinations remain unchanged. Article reporting retains its original scope.

The authenticated `/api/private/of-results` endpoint is retained. Authenticated `?test=1` redirect requests remain isolated test records, excluded from the public feed and report. HEAD and requests with the exact `fanvue_exclude_clicks=1` cookie do not create OF records. Never open production `/of/` or `/r/` URLs during testing, even with exclusion enabled; use local handlers or an isolated preview.

The campaign report and article dashboard load independently within the existing dashboard response. If OF storage or its sheet is unavailable, its report shows unavailable values rather than fabricated zero totals, while article reporting stays available.

See [OF_SHEETS_CONNECTION.md](OF_SHEETS_CONNECTION.md) for the existing IMPORTDATA feed connection and per-code counts/last-click formulas. Formula installation requires Google Sheets edit access. The shared export provides read access only; application deployment does not install spreadsheet formulas.

Focused verification: `node --test tests/of-report.test.mjs tests/of-campaign.test.mjs tests/redirect-reliability.test.mjs tests/home-scope.test.mjs`. No test converts Netlify request counts into clicks, clears data, or calls production tracking links.
