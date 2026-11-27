# Current visual rules — 27 November 2026

This is a presentation-only addendum to the original DESIGN.md and SPECS.md and the 26 November visual review. The latest owner instructions supersede older light-theme tokens and outdated page names. Do not change reporting logic, source data, routes, navigation, branding or deployment architecture as part of styling.

- Pure black canvas; use the existing campaign palette for page-local accents. Do not introduce blue-grey fills, arbitrary gradients, or unrelated accent colours.
- Same shared components and consistent page alignment. Preserve the approved current desktop layout and the compact mobile structure. No nested outlines around mobile listings.
- Border hierarchy: consistent flat 2px outlines on key cards, buttons, panels, fields and mobile records. Use campaign colour for key elements and charcoal #494949 for secondary frames. Table dividers are subdued #303030, with a single thin separator inside Discord. No glow, shadow halos or nested frames.
- Owner correction: measured numbers use plain white text, without coloured rounded backgrounds or badge padding. Preserve the existing rose KPI cards, Discord purple panels and explicit-sort campaign-coloured text.
- Hover: supporting cells use an almost-black campaign tint; the actual cell uses a slightly stronger tint and a subtle campaign-coloured underline. Dashboard and campaign performance metrics highlight columns; names, text and action cells highlight their row. Accounts, Discord weekly listings and legacy record tables use row highlights. Keep other cells black, white/selected campaign-coloured numbers unchanged, and disable desktop column stripes on narrow or touch layouts.
- Even 40px black spacing below page headers, including Accounts. Sort and filter text uses bold 750 weight. Labels in cards use compact 4px-rounded 10% white background; account initials use 12%. No backgrounds on numeric values.
- Selected-column numeric text uses the campaign highlight colour only after explicit user sorting. Never highlight the default Clicks sort, unrelated values or missing data.
- Keep existing typography, bold headline numbers, readable labels in the brighter campaign border colour and clear hierarchy. Preserve long full values, fit exceptional lengths without clipping, and keep focus/tooltips accessible. Use the standard three-line menu with fast, smooth motion; remain open during background refreshes, close after choosing a destination or deliberate dismissal.
- Keep seven daily chart slots, chronological order, no numeric labels above bars and no invented history. Preserve the scope/attribution on hover.
- Maintain the site-wide no-tag rule, concise visible terminology, no article captions in main rows, and no unnecessary arrows or duplicated details. Instagram stays hidden from navigation and rows while its authorised spend remains in totals.

Acceptance: check every campaign/subpage, all three Dashboard periods, Accounts, Discord, and custom campaign at 320, 375, 390, 430, 1024 and 1440px using synthetic fixtures. Check actual computed contrast, plain numeric text containment and selected-sort behaviour in addition to layout, controls, seven-day charts and reporting regression tests. Do not visit tracking links or change live data.

Dashboard comparison: ?layout=1 through ?layout=8 provides eight opt-in layouts using existing reporting components. Layout 1 remains the default.

Campaign theme: Dashboard pink, GTA VI violet, Viral QRTs amber, X Articles silver, OF Terms blue, Guru RTs pink, Discord indigo, Accounts slate. Saved custom colours apply to added campaigns and built-in overrides. Header black padding is 56px desktop/36px mobile, and Back has 32px desktop separation from the title. Main KPI card height is reduced from 124px to 90px desktop and 108px to 78px mobile (approximately 28%).

Compact listing cards: full width, 39px desktop campaign rows / 36px dashboard and account rows; approximately 35% less height. Mobile record cards use slightly greater inner padding, a shared name/age row and condensed metrics, with Dashboard and Discord summaries adapted for their data. The Viral Posts summary is removed from Viral QRTs; quoted-original context stays inside expandable records. No tracking or reporting changes.

Page headers: larger 34px desktop / 27–32px phone title; no X icon beside X Articles. Back always navigates to Dashboard (#home), with a small white left arrow. Campaign column labels are white; other metric labels keep their page accent. Headline cards are now 104px desktop and 92px mobile, with greater top/bottom padding. Border colours are optically softened a further 2%; the later consistent 2px border rule supersedes the previous widths. Mobile listing dates do not intercept expand-button taps.

Dashboard campaign names carry a small coloured marker derived from the saved campaign identity, keeping names and Campaign headers white. Dashboard Discord has one outer frame, a clean header divider and three evenly spaced metrics without inner boxes. Chart hover uses colour, not glow. All preceding title, Back, compact listings and larger KPI card rules remain.
