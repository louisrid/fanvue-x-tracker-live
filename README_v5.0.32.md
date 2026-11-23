# X Tracker v5.0.32 — combined unapplied UI update

**Site:** https://elegant-swan-98c20a.netlify.app  
**Target ID:** `3cfe75c9-5913-46a0-953f-eeae1a288a52`  
**Status:** tested locally, not deployed by this release process.

One complete project source ZIP. Changes to the v5.0.31 base:

- Same exact pink/peach gradient on NEW! article cards and the top-right Live Articles KPI using one CSS variable.
- Major publisher-name and metric typography increases, metadata improved; new cards reduced from tall/sparse to about 158–166px on desktop and 172px on mobile.
- White, narrower/taller UTM pill with blue-gradient number; Views/Likes below. Aged cards retain existing white centre with thick red-orange sparkle border.
- The middle Key Stats column now contains a slim dark Projected KPI above a shortened purple 7-day click KPI, with a deliberate white gap. All three columns have identical height on desktop.
- Projected = **verified UTM clicks today x 7**; unavailable daily data shows N/A, not an invented number. Recomputed whenever Daily Breakdown rerenders.
- No direct changes to tracking, redirect routing, Netlify Blob storage, scheduled jobs, Google Sheets data or environment variables. Dashboard Netlify Function contains only the existing frontend API `uiVersion` string bump to 5.0.32.

**Verification:** `npm test`: maintained suite passed, plus headless Chromium viewport checks at 320/390/768/1100/1440/1920px using mock activity and GBP rate. No JavaScript errors or horizontal overflow. Because production may have changed since this source was prepared, compare the *latest full source* and preserve any newer changes and all eight functions before publishing. Do not test real `/r/`, `/s/` or `/p/` links.
