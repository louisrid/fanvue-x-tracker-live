The repair retained the existing Netlify application, two-hour refresh schedule, pages, CSS, tracking routes, databases and historical metric stores.

Confirmed findings

The GTA report discarded unposted source rows before the frontend calculated paid spend. Publication status therefore incorrectly controlled payment totals. Source parsing also deduplicated financial rows by X status across campaigns, and placement display IDs depended on spreadsheet row numbers. The report GET handler ignored the frontend's refresh parameter. A hardcoded publisher alias and a separate hardcoded article campaign assignment overrode source edits. Browser metric fallback could restore an intentionally removed price. The shared report cache did not synchronously revalidate an expired response when no background execution context was provided.

The deployed Short.io cache contained generic request failures while retaining historical readings. Read-only checks returned HTTP 200 for authenticated link expansion and both total and custom statistics endpoints, with valid human-click fields and exact custom intervals. No authentication, permission or endpoint-format defect was reproduced. The precise cause of the earlier network failures remained unconfirmed. Requests previously had no retry and a nine-second timeout.

Changes and operation

`netlify/functions/gta-report.mjs` retained account rows for finance independently of publication eligibility, resolved each tab's actual headers, preserved formula results, generated row-order-independent identifiers, and added financial summaries. It retained separate QRT and original-post boundaries. Post metrics remained keyed by X status ID; click caches remained keyed by tracking URL and publication ID. Shared links across those boundaries were marked ineligible for individual publication attribution. No historical cache keys were deleted. Manual refresh bypassed the Sheet cache; normal source refresh retained its 90-second TTL. Failed source reads retained the existing fallback with a warning and verification timestamp.

`netlify/lib/placement-reporting.mjs` calculated total, paid, published and pending paid costs independently, counted published rows only with valid X status URLs, and exposed unpaid and missing-cost counts. Every account row remained eligible for unpaid reporting, including unbooked source accounts. `netlify/lib/sheet-source.mjs` stopped overriding campaign assignments by publisher name. `netlify/lib/report-cache.mjs` added expired-cache revalidation without a background context.

`netlify/lib/gta-shortio.mjs` added up to three attempts for network errors, HTTP 429 and server errors, 15-second request timeouts, bounded Retry-After handling, and reduced parallelism. Authentication and permission errors were not retried. Provider-loading responses, invalid human-click readings, invalid custom intervals and suspicious zero resets were rejected. Failures retained successful historical values and were recorded separately. All-time and post-publication readings retained separate cache keys, timestamps and stale/error states. Tracking redirect URLs were never fetched. The latest successful verification timestamp remained visible even with partial coverage.

`public/app.js` used complete financial summaries while retaining published-only performance tables, displayed fractional dollar amounts accurately, exposed financial categories using the existing card styling, showed source/cache timestamps, and stopped restoring missing financial fields from browser cache. Tests and the standard test command were updated for the source-authoritative behavior.

Read-only reconciliation on 20 November 2026

Independent workbook-cell calculations matched the local Netlify HTTP response. GTA QRT totals were $1,940 total placement cost, $1,840 paid, $1,170 paid and posted, $670 pending paid, 26 paid rows, one unpaid row, and 13 posted rows with valid X status URLs. Original posts and V2 remained separate from QRTs; their combined paid cost was $2,600.85, including $133.85 pending paid, and 22 published posts. These were observations, never implementation constants. The deployed production response before changes included only $1,170 of QRT paid costs.

Validation and recovery

The focused suite passed 51 tests covering independent checkboxes, formula results, row additions/removals/reordering, source campaign membership, separated campaigns, link attribution, retries, HTTP 403/429, provider outages, historical readings, and report caches. Chromium checks at 1440px and 390px confirmed correct QRT and original-post totals, working sub-tabs, no JavaScript errors and no horizontal overflow. Live source records were never edited for testing.

The existing standard suite had 25 failing tests before the repair. The updated standard run had 103 passing and 24 failing tests; none of the failing names were new. The broader legacy run had 178 passing and 97 failing tests, versus 166 passing and 99 failing before the repair; no new failing names were introduced. These historical suites were not presented as fully passing. Many assertions described superseded releases or calendar-dependent states.

The recovery archive and checksum manifest are in `deployment/backups/fanvue-reporting-repair/`. The production app.js fetched before edits matched the saved source exactly. Restore the archive into an isolated checkout for review and use the existing deployment workflow; do not roll back or delete site analytics stores. The archive did not contain environment configuration or downloaded workbook payment details.

Deployment remained pending the Agent Runner's automatic preview build, preview review and authorized production promotion. No build command, direct deploy, new project, commit or pull request was created during this repair. Production after publishing could not be verified before that workflow completed.

The isolated local background refresh completed with verified all-time readings for all 26 QRT tracking links and zero Short.io errors. Its 13 published links totalled 161 all-time human clicks and 137 verified post-publication clicks, with the last successful verification at 19:47:22 UTC on 20 November 2026. Of 35 X post lookups across QRTs and originals, 32 refreshed and three original-post lookups returned HTTP 404. Those provider limitations remained visible; the refresh did not replace existing successful readings with zero. Reconciliation evidence and desktop/mobile screenshots were retained in `deployment/fanvue-reporting-repair/`.

Navigation smoke checks also confirmed that dashboard, campaigns, statistics, historical, accounts, placements, OF, X RTs and GTA VI routes rendered their existing page containers without JavaScript errors. These checks did not assert every external integration or historical widget.
