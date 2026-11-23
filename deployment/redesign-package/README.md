# XTRACKER: UNIFIED ANALYTICS TABLE REDESIGN

## Existing website only
- Live site: https://elegant-swan-98c20a.netlify.app/
- Existing Netlify site ID: `3cfe75c9-5913-46a0-953f-eeae1a288a52`
- Last verified production deployment before preparing this patch: `6afafd9312cd6d1a5bba89ae` (16 Nov 2026).
- Source patch, **not** a standalone deployment. Never deploy these files alone as a replacement site.

## What's implemented

**Design**: A site-wide high-contrast white/black typographic system, 15-20% smaller KPI boxes, consistent spacing, vivid existing blue cards, fine blue-grey borders, visible rounded back arrow, standard button styling and concise captions. The global logo, logo font and header navigation are untouched.

**Sortable tables**: Live article placements, scheduled articles, Article Tracker, historical weekly article results, OF Terms X Promo, GTA VI and the Campaigns summary use compact sortable tables in place of visually oversized cards. Accounts, X RTs and daily breakdown tables gain sortable headers and fine bordered rows. Tables scroll horizontally on iPhone; no whole-page overflow is intended.

**Existing actions preserved**: Source cards and their event handlers remain in the DOM, hidden only visually once a table is ready. Row clicks forward to the existing article detail action. Article Tracker bulk-selection checkboxes forward clicks to the originals. Campaign rows expand to show their existing details and forward placement detail actions. Separate X profile and original-post links are preserved or read from the existing dashboard report.

**GTA VI exact columns**: Account | Post | Views | Likes | RTs | Total interactions | Price | Cost / interaction. Total interactions = views + likes + reposts, as requested. Missing inputs remain unavailable, not zero. Costs use source-recorded prices whenever available. Original and V2 placements remain marked within the Account column. No GTA UTM clicks are invented.

**Ratios**: Article/OF CPC where verified click and spend data exist, GTA cost per requested interaction, campaign CPC. If a denominator is unavailable or zero, show `—`.

**Data**: Does not change a single Netlify Function, OAuth credential, redirect, UTM, historical record, Sheets tab, metric refresh or environment variable. One read-only GET to the existing Dashboard function retrieves article profile and post URLs. GTA details reuse the cache already written by the existing GTA report. Source data stays authoritative and refreshed by the existing application.

## Apply to the LATEST actual Netlify project source

1. Check the current production deployment ID; back up the FULL latest production project/source and keep that backup safely. Confirm the existing 14 functions, current env configuration and tracking histories before touching code.
2. Extract ZIP. In the **current existing project root**, run:

   `python3 path/to/xtracker-redesign/install.py .`

3. This installer refuses to operate if the expected X Tracker page IDs are missing, makes a backup of the original index and any previous UI overlay, then adds three static UI files to the existing site. It does not replace `app.js`, `netlify.toml`, Functions or data.
4. Run `node --check` on both JS files. Run `python3 path/to/xtracker-redesign/tests/installer_test.py` and `python3 path/to/xtracker-redesign/tests/browser_test.py` (the latter needs Python Playwright and Chromium). The supplied local tests passed at 1440px and 390px when authored.
5. Test against the ACTUAL existing source/build as a Netlify deploy preview before publishing. On desktop and iPhone verify Dashboard, Key Stats, Historical, Article Tracker, Accounts, Campaigns, OF Terms X Promo, X RTs, GTA VI; test full source counts vs tables, sorting in both directions, search, original article modals, bulk select, back arrow, real account/post links, campaigns expansion, missing-value handling and no horizontal page overflow.
6. Verify that read-only `/.netlify/functions/health`, `dashboard`, `gta-report`, `of-report`, and `boosts` endpoints still work and display their last-known-good numbers. Ensure all Netlify Functions, background refresh schedules, and original UTM / clicks records are preserved. **Never open or test `/r/*` or `/of/*` redirects**, which log actual clicks.
7. Publish **only** if preview and regression tests pass, to the same existing site. Confirm the new production deploy ID and live version. If any test fails, do not publish a partial or older project.

## No changes to campaign operations

No new sources, publisher payments, campaign statuses or metrics are created. Original OF and GTA remain separate. Four original tweets remain the entire X RTs list; the excluded ArdzAI tweet is never added. Existing spending gaps are not filled with guesses.

## Test evidence and limits

The packaged Python browser test uses representative HTML and read-only mocked report data to verify sorting, click forwarding, known vs unknown values, GTA formula, native tweet links, dynamic refreshes, mobile scrolling and logo preservation. Those tests are not a substitute for testing against the connected production website after installation. The ZIP does not include the user's live Netlify Functions or env values, deliberately: installing it against the CURRENT source avoids replacing production with an old ZIP.
