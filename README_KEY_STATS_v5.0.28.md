# X Tracker v5.0.28 | Key Stats reconstruction | NOT DEPLOYED

**Production destination:** https://elegant-swan-98c20a.netlify.app/
**Original Netlify site ID:** `3cfe75c9-5913-46a0-953f-eeae1a288a52`
**Distribution filename:** `X_Tracker_MASTER_2026-10-17_v4.7.0.zip` (unchanged by request).

## Visible changes

- Removed Dashboard Performance comparison section and previous Daily Breakdown panel from Dashboard entirely. Dashboard starts with **This week** and its original headline KPI cards with additional, top-heavy whitespace. An earlier saved drag order cannot put any other section above those KPI cards.
- Deleted all former Key Stats UI, including weekly dropdown, leaderboards, extra KPI set and older four graph panels. These old DOM elements and their event bindings are not executed. Other pages retained.
- Moved latest Daily Breakdown to **Key Stats** with coloured trio of KPIs, vivid live badge, new **wide rolling 168-hour chart of real tracked UTM clicks** (red/orange, latest hour at right) and a compact **seven calendar days daily-totals table**.
- Read-only hourly event CSV sourced from existing `/.netlify/functions/events`. Raw timestamps are bucketed into UTC hours; UK dates label X-axis. No per-hour values are guessed from daily totals; unavailable feed displays an unavailable message. Dashboard click-aggregation remains authoritative for the other KPI and table values.
- Extra empty white page space below the new Key Stats content. Mobile two-column metric tiles, final spend card spans full width.

## Validation

`npm test`: **29/29 maintained tests passed**. Node syntax checking completed. Real Chromium browser exercised actual app and stylesheet with synthetic fixture data in isolated execution for 320, 390, 768 and 1440px. Verified chart, three metrics, seven table rows, removed old Key Stats controls, restored Dashboard entry, no JS runtime errors, no horizontal overflow. **All screenshot/chart figures are synthetic, not actual campaign totals.**

## Production safety

Live site last checked on 19 October 2026: deploy `6ad61a3103957482d14f77f3` (original v5.0.26 agent deploy) with eight Functions. This package derives from the locally maintained v5.0.27 source, whose backend initially came from archived production source rather than the full live current deploy. **Do not blindly replace the latest production backend. Back up and compare actual full current source, and merge differences first.** The only backend file changed here is `netlify/functions/dashboard.mjs` UI version constant; event storage and UTM redirect behaviour are unchanged.

Use the existing Netlify project Deploys manual drag-and-drop area only if the complete source and all eight Functions are built/deployed. Never create a new site, click real `/r/`, `/s/` or `/p/` links, edit Google Sheets or expose tokens.
