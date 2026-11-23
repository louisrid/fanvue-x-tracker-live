# Fanvue X Tracker: maintained direct-deployment source

Existing production URL: https://elegant-swan-98c20a.netlify.app
Existing Netlify project ID: `3cfe75c9-5913-46a0-953f-eeae1a288a52`

This project deploys directly through Netlify's authenticated Build API. GitHub is not used. The API stores each source archive with its deploy, so future ChatGPT work can recover the actual published source without asking Louis to upload another ZIP.

## Future updates

1. Obtain authorised Netlify access in the working session. The deployment script reads `NETLIFY_AUTH_TOKEN` from the environment; credentials are not stored in this source.
2. Read the existing site and its published deploy through the Netlify API. Request `/api/v1/deploys/{published_deploy_id}/download` and download the returned archive URL. Preserve a backup of that source and the current click feed before editing.
3. Edit the recovered project, run `npm ci` and `npm test`, and check affected behaviour.
4. Run `python3 scripts/deploy.py --production --title "Describe the change"`. The script runs tests, verifies the existing project URL, sends the source to the existing project's Build API and waits for its result. Omitting `--production` creates a branch build on the same project.
5. Test the permanent production URL, dashboard, health, redirects, events and affected controls. Do not infer health from a successful build alone.

The source can be recovered again from the new deploy. ChatGPT does not acquire permanent Netlify access automatically; later sessions still need authorised credentials. Preview deployments currently require Netlify team login, while the permanent production URL is public.

## Data and refreshes

- The ordinary Google Sheets publisher tabs are the operational source of truth. `sheet-source.mjs` reads the existing public workbook export server-side, recognises the actual row-seven headers, extracts linked Docs and validates unique permanent tracking IDs. It exposes only a whitelist of dashboard fields. Payment details and secrets are never returned or cached in the dashboard feed.
- The source export is cached for 45 seconds; the open frontend refreshes about every 60 seconds. Sheet outage fallback displays the last successful copy and its actual check time.
- Louis has cost in G, paid in L, posted in M, post URL in N and tracking ID in O. Connor has cost in F, paid in K, posted in L, post URL in M and tracking ID in N. Both currently have views, likes and metric timestamp in S:U. Headers are resolved separately for every tab.
- A valid published X URL is discovered automatically by the metrics job. It queries FxTwitter, verifies the returned post ID and numeric views/likes, and stores the last successful metrics plus raw historical refresh snapshots in Netlify Blobs. Provider errors retain successful values and identify stale data.
- `refresh-x-metrics` runs on the Netlify schedule `0 */2 * * *` (UTC). The dashboard and `/.netlify/functions/metrics` report its actual last successful refresh. A schedule is not evidence of successful future runs.
- A recurring ChatGPT task named **Sync X tracker metrics** is configured to mirror successful measurements into the matching S:U cells through the connected Google Sheets tools. The initial write was read back successfully; future scheduled executions must still be monitored. An alternative native Google-side writer can use the prepared Apps Script bridge. The optional Apps Script bridge in `apps-script/Code.gs` has corrected layout mapping, accepts the existing token property names and validates source layouts without regenerating IDs or replacing UTM reporting formulas. Its installation and the audit of existing Google triggers require authenticated Apps Script access.
- The existing UTM LIVE FEED imports the real events endpoint. UTM EVENTS and UTM SUMMARY retain their existing linked formulas and historical rows. Google controls IMPORTDATA recalculation timing; the site itself reads click events directly.

## Links and verification

- `/r/A01-P##` and `/s/A01-P##` go to the Fanvue Partner Programme with the corresponding uppercase UTMs.
- `/p/A01-P##` is explicitly reserved for Prism demos. The older article Docs currently have separate direct Prism and Fanvue URLs; their visible labels and destinations are preserved.
- `/.netlify/functions/resolve?code=A01-P19` checks the current placement and returns its destination without logging a click.
- Use the read-only `resolve` endpoint to check destinations without logging. Netlify can normalise HEAD requests to GET, so HEAD tracking requests must not be used for non-logging checks.
- A controlled GET with `test=1` and an authorised worker Bearer credential exercises logging in the isolated `fanvue-x-test-events` store. These events never enter live campaign totals.
- Real GET redirects append unique events to the existing `fanvue-x-click-events-v2` store. Historical legacy events are deduplicated. Clicks are traffic, not verified signups or revenue.

## Administration

The admin endpoint still requires a server-side, constant-time Bearer credential check. Existing `API_TOKEN`/`ADMIN_KEY` values remain supported. Frontend assets contain no feed or admin secrets. `TRACKER_WORKER_KEY` authorises controlled metrics refreshes and isolated logging tests; it does not authorise deployments.

The existing editing interface depends on the Google Apps Script bridge. Its old deployed version currently rejects the new request format. The endpoint returns an explicit upgrade error instead of claiming an edit succeeded. Updating that Google deployment and inspecting obsolete triggers remain separate authenticated Google tasks. Do not run the old legacy setup or reporting functions.

Historical views or spend trends are shown only where measured snapshots or source dates exist. Missing history and missing payment dates remain N/A. Campaign assignments are not inferred from tracking IDs; unassigned placements stay unassigned.

## Home layout

Home shows selected paid placements only. Published cards use an orange and yellow gradient and open the current live X post. Unpaid placements remain in Placements, Accounts, Campaigns and analytics. The large main navigation sits in a sticky top header beside a text-only X Tracker logo. Previous header actions and the owner bar have been removed; the interface opens with all owners, without a hidden stored owner filter. Automatic refresh and source-error warnings remain active. Home uses compact cards and normal scrolling when needed so content is not clipped. Small screens retain normal scrolling for readable content.

## Selected placements and analytics

All main views now include only publisher rows whose selection checkbox is ticked. Unticked research rows remain intact in Google Sheets and the source feed. Paid placement rows have a yellow treatment. Analytics is a named top-navigation page and a Home shortcut, with current views/click comparisons, live/paid-upcoming/payment-pending counts and the existing measured history charts. No historic values are inferred.

## Redirect availability

The public redirect handler is independent of Google Sheets and frontend JavaScript. Fixed Fanvue/Prism destinations are derived only from a validated permanent code, with path identity taking precedence over extra query parameters. In production, click writes use Netlify context.waitUntil so storage latency cannot delay navigation. Authenticated isolated tests wait for their actual storage write. Local runtimes without waitUntil have a bounded logging wait. The redirect response also contains an ordinary HTML link for clients that do not automatically follow redirects. All existing public URLs, permanent IDs and fixed destination UTMs remain unchanged. A provider outage, ISP/domain filtering, country restrictions at the destination, site usage suspension or old TLS clients can still prevent access; universal availability is not promised. Production has no password and no custom traffic rules were returned by the site API. Preview protection is preserved.

## Strict paid-only Home revision

Home uses a server-verified list of active rows whose paid flag is the boolean true. Cached/unverified source status fails closed for Home. Cards, paid spend, click totals and the Views/Clicks chart use that same paid-only scope; Analytics continues to show all selected placements. Paid is explicit on every Home card, alongside Live or Upcoming and the article label. Live gradients run from saturated yellow to orange; paid upcoming cards and paid placement rows are saturated yellow. Home combines two headline KPIs with separate live and upcoming sections and a real-data live article chart.

The dashboard publishes uiVersion, checked against the frontend APP_VERSION. Open tabs running this version reload on a later version change. When changing frontend versions, update dashboard uiVersion, app APP_VERSION and the HTML asset version together. Existing tabs opened before this mechanism was installed require one normal browser refresh. All existing tracking URLs and redirect logic are unchanged by this Home revision.


## Verified production revision 4.6.0 - 17 October 2026

Production deploy: 6ad3746cd4e0397f41bc1df4. Main navigation is Dashboard, Article Tracker and Key Stats; account/campaign comparisons remain within Key Stats. Home has two paid live placements and two paid upcoming placements, with saturated yellow-to-orange gradients. Live cards require both the posted flag and a valid X post URL.

Click reporting uses the existing cutoff 2026-10-17T00:32:36.000Z. Eight earlier events remain archived, and all 18 post-cutoff events were preserved. Raw event storage was not deleted. All 19 permanent /r routes plus /s and /p compatibility examples returned the expected destinations with browser exclusion enabled; event totals stayed at 18. The Google Sheet reports matching 11 and 7 clicks.

23 automated tests passed. Live health/dashboard/metrics/events endpoints and browser Home, Key Stats and Published filter were verified. Physical iPhone testing was not available. The two-hour metrics job remains enabled; latest successful measurement at verification was 2026-10-17T12:01:09.189Z.

Monthly spend remains N/A until genuine payment dates are supplied. The separate paid total is $590; do not treat this as monthly spending. Authenticated Apps Script editing is not verified: automatic approval review rejected retrieving environment secrets for that test. Existing sheet reads, redirects and metrics reads work independently.

Personal click exclusion: open /click-preferences and enable it in each actual device/browser. It survives reload; clearing cookies or private browsing requires enabling it again. Shared iCloud Private Relay IP ranges are not blocked.
