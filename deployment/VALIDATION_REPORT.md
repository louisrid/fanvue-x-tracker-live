# X Tracker 5.0.26 | Local validation | 19 October 2026

## Implementation

1. Recovered latest publicly served frontend v5.0.23 with the existing daily breakdown, daily axes, clicks/spend series, red live indicator and expanded article panel. Earlier source backend, Apps Script and configuration retained as starting point, with UI version advanced for cache refresh.
2. Added visible daily UTM clicks line in thick red-to-orange gradient, daily spend in blue, distinct axes, date labels, grid lines and tooltips. Spend uses only payments with known payment timestamps; undated transactions do not produce guessed per-day expenditure.
3. Added saturated daily metrics and red live pulse, keeping existing placement/analysis controls.
4. Aged published articles now have white fills + extra-wide rounded red/orange gradient frames with sparkle limited to borders on Dashboard, Accounts/Placements and Historical. Fresh articles keep the vivid solid gradient + NEW! badge.
5. Increased Views/Likes typographic weight, size and contrast on the article cards and mobile.
6. Shared sparkle opacity reduced by exactly 10% relative, `.25` -> `.225`, across all uses of shared variable.
7. All eight Netlify Function source files and the three redirect rules remain present. No changes to redirect destinations, click events, cutoff or Google Sheet.

## Local test results

- `npm test`: **27/27 maintained tests passed**, covering daily event aggregation, date-specific spend, unknown dates, labelled axes, sort/filter integrity, 48h boundary, redirect safety, click baseline and aged border styling.
- `node --check public/app.js` and each `netlify/functions/*.mjs`: passed.
- Isolated Chromium visuals at **390px and 1440px**, using the actual stylesheet and matching card markup: 7/9px wide rounded gradient borders, white interiors, visible rich red/orange gradient, larger views/likes, sparkle opacity `.225`, and **no horizontal scrolling**. Fresh article stays full gradient and NEW! badge.
- No production tracking URL was opened in the implementation/tests.

## Required checks before production deploy

- Full current production source was **not** available through connected Netlify tools. Current production deploy: `6ad60245a1510eb8c8b012d0`; frontend version 5.0.23. The latest deployed backend may contain changes absent from this archived source. **Compare and merge before uploading**, and preserve any newer changes.
- Full dependency-backed Netlify deployment build and live site integration/browser regressions were not completed here.
- Existing Sheet integration, scheduled X metrics function, all eight Functions and genuine clicks must be verified after deployment without calling `/r/`, `/s/` or `/p/`.
- Production was **not** changed or deployed by this source update.


## v5.0.26 | Chart font and universal spacing patch

- Root cause of blurred chart: global `svg {stroke:currentColor;stroke-width:1.9}` was inherited by text; disabled SVG glyph stroke specifically on the daily plot. The former 920px viewBox was also rendered at ~272-328px on phones, shrinking axis labels below readable size; the chart now draws at its actual CSS-pixel width, with a width observer for rotation/resizing. Text uses standard Arial/Helvetica, not the wordmark font.
- Desktop trend panel capped at 990px, graph height reduced to 268px, metric numerals scaled down and layout maximum page width narrowed to 1360px. Mobile graph height 238px, labels >=10.5px, day names shortened only on very small widths and Y ticks compacted at thousands.
- Extra top-weighted page intros, roomier header, headings and section separation on Dashboard, Key Stats, Historical and Campaigns, with phone-specific padding.
- `npm test`: 28/28 maintained tests passed. Chromium DOM/render checks on widths 320, 390, 768, 1440 and 1920 found no horizontal overflow across Dashboard, Key Stats, Historical and Campaigns; visible SVG labels >=12px rendered height on Dashboard. Additional screenshots reviewed at 390 and 1440px.
- This is a source-only package. Full production backend has not been byte-comparison merged. Do not drag/drop until newest live deployed source is backed up and compared to avoid discarding newer changes. No production tracking routes were opened or changed.


## v5.0.27 | Compact graph and true lightweight axis text

- X/Y labels use explicit Arial/Helvetica 400 with SVG text strokes set to none; axis titles 600. The wordmark font is isolated to the logo.
- Desktop chart card width is at most 780px and chart height 230px; mobile height 222px with a width-responsive chart.
- Smooth monotone cubic Bezier curves for both daily series prevent invented negative dips or excessive peaks. Click stroke 9px desktop / 7px mobile, spend 6px / 5px.
- Maintained tests: 29/29 pass. Chromium rendered the actual source using mock activity (NOT production metrics) at 320, 390, 768, 1440 and 1920 pixels; all axis labels computed font-weight 400, no glyph stroke; curves include six Bezier segments; no horizontal scrolling.
- Production was not deployed or modified. Back up and compare the latest live full source and preserve all eight deployed functions and env vars before any manual deploy.
