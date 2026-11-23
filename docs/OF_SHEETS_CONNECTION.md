# Connect the existing UTM feed to the OF campaign sheet

The existing public CSV endpoint now includes genuine OF events from the original database alongside article events. No new Apps Script, credentials, database, or tracking links are needed. Historical OF events retain their original timestamps. Test events are excluded.

In **NEW LOUIS X FANVUE PROMO**, create a tab named **OF UTM LIVE FEED**. In A1 enter the same import used by the article tracker:

```excel
=IMPORTDATA("https://elegant-swan-98c20a.netlify.app/.netlify/functions/events?source=sheet-v2")
```

Allow external data access if Google Sheets prompts, then hide the tab. In **X Accounts 13 (OF Terms)**, the previously empty columns W and X can show per-publisher results. Set W7 to **TRACKED CLICKS** and X7 to **LAST CLICK (UTC)**.

In W8 enter:

```excel
=IF(E8="","",COUNTIF('OF UTM LIVE FEED'!B$2:B,REGEXEXTRACT(E8,"/of/(OF[0-9]+)")))
```

In X8 enter:

```excel
=IF(E8="","",IFERROR(INDEX(SORT(FILTER('OF UTM LIVE FEED'!A$2:A,'OF UTM LIVE FEED'!B$2:B=REGEXEXTRACT(E8,"/of/(OF[0-9]+)")),1,FALSE),1),""))
```

Fill W8:X8 down through all publisher rows. Each formula uses the exact OF code from column E, so OF1 does not match OF10. The last-click cell retains the original ISO UTC timestamp. With no events, clicks are zero and last click is blank. Never copy aggregate Netlify request counts into these cells.

Google Sheets controls IMPORTDATA refresh timing. These formulas derive complete totals from the verified feed on each refresh; they never increment a stored counter or duplicate imported clicks. The report itself reads verified events directly, independently of Sheets import delays.

The application can read this workbook's shared export. This execution environment has no Google Sheets editing authorization, so the formulas must be installed by someone with edit access. Their installation and live refresh require separate verification; generating these instructions does not modify the workbook.
