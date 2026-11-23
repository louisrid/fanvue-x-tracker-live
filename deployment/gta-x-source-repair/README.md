The GTA VI warning was investigated against a fresh Google Sheets XLSX export and the production reporting endpoint on 20 November 2026. The source contained 13 eligible QRT posts, five original GTA posts and 17 V2 posts. Paid spend reconciled to $1,840 for QRTs and $2,600.85 for original/V2 placements, including paid unpublished rows.

All four unsuccessful posts were in `X Accounts 12 (GTA)`:

| Sheet row | Publisher | Post ID | FxTwitter handle route / ID route | X public embed | Retained reading |
| --- | --- | --- | --- | --- | --- |
| 8 | TheGTABase | 2115927144836776030 | 404 / 404 | 404 | No verified cache value |
| 10 | GTA_OOC | 2116154928033087526 | 404 / 404 | 403 | 58,567 views, verified 2026-11-20T19:56:10.891Z |
| 11 | arkavx | 2116146620580647228 | 404 / 404 | 404 | No verified cache value |
| 13 | billsyliamgta | 2116219158211829872 | 404 / 404 | 404 | No verified cache value |

The Sheet publication URLs were syntactically valid, Posted was true and all four remained eligible. Public retrieval was unavailable. These responses did not distinguish deleted posts, protected content, account restrictions or provider coverage failures, so no posts were classified as conclusively deleted or invalid. No timeout or rate-limit response occurred for these four during the investigation. The GTA_OOC failure had also previously succeeded, demonstrating why a failed lookup must not invalidate a Sheet record or reset a saved reading.

The new provider reader was exercised against all 35 eligible live posts without writing production metrics. It obtained 31 successful readings and the same four 404s. It checked the returned post identity and required all four numeric metrics. Timeouts, network failures, invalid JSON, 429s and 5xx responses received at most three attempts with bounded waits. Retry-After cooldowns longer than five seconds stopped the attempt rather than retrying early. Permanent 403/404 responses and missing metrics did not trigger repeated immediate requests. Failures retained the original verified metrics and timestamps; unknown metrics stayed null.

Confirmed tracking/reporting defects were corrected. Errors disappeared from publisher details when a post had no prior successful reading. Both tabs also inherited the combined campaign error list, so successful QRTs appeared affected by original-post failures. The new per-tab status used the Sheet-eligible post IDs and exposed current successful readings, retained readings, unverified posts, errors and verification timestamps. The refresh result no longer reported success after partial X failures. The browser showed source-specific warnings and retained the existing Source details disclosure.

Cache handling was tightened: a failed metrics-cache read aborted refresh before provider requests or writes, and refresh retained existing history rather than trimming samples older than 30 days. Existing Blob namespaces, Sheet caches, historical metric keys, Short.io caches and refresh-job locking were preserved. The two-hour schedule and background refresh worker remained unchanged. `refresh-x-metrics` was inspected: it refreshed article, OF and boost metrics using separate stores (`fanvue-x-metrics-v1`, `fanvue-of-metrics-v1` and boost storage); it did not populate GTA's `fanvue-gta-metrics-v1` cache. Its request cache lasted only for that invocation and did not explain the four GTA 404s. No change to that independent workflow was necessary.

All 72 focused tests passed, including nine new source/cache/status regression tests. Existing Short.io browser fixtures were updated to include the shared status formatter and its response fields. Browser checks used Netlify Dev on port 8889, the edited frontend and intercepted read-only report responses assembled from real Sheet-reconciled provider results. Both tabs passed at 1440px and 390px with six original cards, reference colours, working engagement controls, source details, no JavaScript page errors and no document overflow. This was local validation, not hosted-preview or production validation. Screenshots and browser results were retained here.

Short.io was not changed or redirected during validation. Its production report cache showed all 26 QRT links verified with no errors; original/V2 records had no Short.io links. This run did not claim a fresh direct Short.io provider refresh.

No production data, payment flags, publication records, migration files or tracking links were edited. Production was not deployed. The CLI reported NOT_LOGGED_IN, so it could not create a hosted preview. The existing automatic Agent Runner preview workflow remained required, followed by validation of that preview before any production promotion. No hosted-preview URL was available in this run.
