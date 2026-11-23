# X Tracker v5.0.31 - UI Release

## Desktop
- One shared, centred content width, capped at 1120px, across Dashboard, Key Stats, Historical and remaining legacy pages.
- Dashboard article cards, headings and sort controls now align horizontally with the top KPI cards.

## Article cards
- Removed the redundant little Live status pill on published cards (and in Historical article tiles). Scheduled/Planned and NEW! markers remain.
- Added a prominent but compact black-to-charcoal rounded UTM Clicks strip above Views and Likes. Click count uses a crisp icy white-to-blue text gradient.
- Works on 320px and 390px phones; old red/orange article frame, NEW! full gradient and sparkle styling remain.

## Preservation and deployment
- Existing Netlify site: elegant-swan-98c20a, ID 3cfe75c9-5913-46a0-953f-eeae1a288a52.
- Complete original source, 8 Netlify Functions, existing redirect rules, env variable references, scheduled refresh and click baseline preserved.
- Only backend change: dashboard response uiVersion identifier incremented to 5.0.31 to match frontend and package. No feed, storage or tracking logic modified.
- IMPORTANT: Review production changes since this ZIP was created before uploading. Use the existing site's Deploys page. Do not create a new project.
- A static-only deployment of `public/` is unacceptable; Netlify Functions must be built and included in the published production deployment.
- Do not test production /r/, /s/, /p/ redirects; doing so records real clicks.
- This ZIP is SOURCE, not a precompiled drag-and-drop-only static distribution. Build it as a full Netlify project.
