# Executive marketing reporting

Preserves the existing eight-page navigation, black shell, campaign colours, Netlify project, tracking routes, operational sheets, databases and metric stores.

Campaign pages lead with Clicks, Views, Spend and matched CPC. Instagram, RT amplification, Guru exposure and Discord use the metrics their sources support. A single Dashboard period selector applies to both promotion/community figures and campaign comparisons; Viral QRTs explicitly references the same GTA records. Accounts is a searchable publisher table with platform, campaign and type filters and expandable purchases.

## Accounting and attribution

- Paid means the source paid flag. The former tab 16/17 override that treated unpaid planned rows as paid has been removed, including handling of legacy synthetic cache flags. Planned and committed reservations remain separate in the GTA budget. Remaining is budget less paid, committed and planned amounts.
- CPC excludes unposted, unpriced, unpaid, planned and shared-link placements. Clicks/$ uses the same matched traffic and cost. Money retains cents.
- Weekly spend requires a payment date. Publication dates determine live posts, never payment dates. Undated costs remain in all-time spend; they are not silently assigned to a week.
- Dashboard Clicks is recorded link activity across disjoint campaign URL sets, with source counts and filtering definitions available on hover. It is not presented as unique visitors or human-only clicks. The Viral alias is excluded from the sum; Discord course clicks remain separate. Missing dated sources make a period figure a known subtotal, never an estimated complete total.
- Original viral views and promoted original-post views are exposure, including organic views. They are not purchased QRT views or paid-only impressions. Source publications are deduplicated by X status ID.
- Missing snapshots do not become zero growth. Negative net growth is retained; missing weekly boundaries are labelled partial. View gains require actual consecutive dated readings or same-day publication; multi-day changes are not allocated to a fabricated day.

## Source limitations retained visibly

Some paid placements have no payment date, preventing complete weekly spend reporting. Short.io lifetime totals cannot supply weekly clicks. Some article RT rows lack original-post links; their costs remain visible in an unmatched group, with expandable publisher costs.

Publisher Directory uses a read-only endpoint and retains a verified snapshot of 342 public publisher identities read on 26 November 2026. It attempts the existing Google export route and uses the dated snapshot when unavailable. Only public handles, platforms and profile URLs leave the server. No rates, payment details or private contacts are included. Snapshot use is labelled in Accounts.

No operational spreadsheet rows, provider keys, redirect URLs, historical data or production clicks were changed for testing.

## Validation

- Reporting CI: 135 tests passed, including fifteen new financial, date, privacy and alias regression cases.
- Standard suite: 142/170 passed; all 28 failures also existed in the untouched production baseline, with no new failing test names. These legacy layout/version assertions are not represented as passing.
- Chromium at 1440px and 390px: 30 route/subsection cases, table expansion and account search; no JavaScript errors or document overflow. Fixtures use captured read-only reporting responses plus isolated Discord cases. Charts and missing-history cases are exercised without opening tracking links.

Live preview verification also exercised missing directory storage configuration. The directory uses the modern Netlify handler and returns the safe dated snapshot if either storage or source loading fails.

Final live sidebar checks caught overflowing chart hover targets on short series. Hit areas are now bounded to the plot, with regression coverage for one, two, three and twenty points.

The subsequent visual review replaces the repeated Dashboard periods with a single selector, removes visible source/coverage labels, omits sparse graphs, and uses compact non-cumulative period bars. Published article headlines are verified against post IDs, then retained through the existing metrics refresh. See VISUAL_REVIEW_20261126.md.
