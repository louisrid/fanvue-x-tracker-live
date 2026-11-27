# Current visual rules — 27 November 2026

This is a presentation-only addendum to the original DESIGN.md and SPECS.md and the 26 November visual review. The latest owner instructions supersede older light-theme tokens and outdated page names. Do not change reporting logic, source data, routes, navigation, branding or deployment architecture as part of styling.

- Pure black canvas; use restrained rose/pink accents and Discord purple. Do not introduce blue-grey fills, arbitrary gradients, or unrelated accent colours.
- Same shared components and consistent page alignment. Preserve the approved current desktop layout and the compact mobile structure. No nested outlines around mobile listings.
- Visible single-layer outlines: 2px rose #B56791 on dark surfaces, #DC6DA3 on KPI cards and #AA97E7 on Discord cards. Slightly rounder corners; 2px subdued grey table rules. Preserve frameless mobile listing sections and avoid nested outlines.
- Owner correction: measured numbers use plain white text, without coloured rounded backgrounds or badge padding. Preserve the existing rose KPI cards, Discord purple panels and explicit-sort yellow text.
- Hover: use a dark-grey background for the entire hovered table column, with a slightly brighter hovered cell. Cards, panels, controls and modal surfaces respond without obscuring white or yellow text; hover is pointer-only to prevent sticky touch interactions. 
- Selected-column numeric text is yellow only after explicit user sorting. Never highlight the default Clicks sort, unrelated values or missing data.
- Keep existing typography, bold headline numbers, white readable labels and clear hierarchy. Preserve long full values, fit exceptional lengths without clipping, and keep focus/tooltips accessible. Use the standard three-line menu with fast, smooth motion; remain open until deliberately dismissed.
- Keep seven daily chart slots, chronological order, no numeric labels above bars and no invented history. Preserve the scope/attribution on hover.
- Maintain the site-wide no-tag rule, concise visible terminology, no article captions in main rows, and no unnecessary arrows or duplicated details. Instagram stays hidden from navigation and rows while its authorised spend remains in totals.

Acceptance: check every campaign/subpage, all three Dashboard periods, Accounts, Discord, and custom campaign at 320, 375, 390, 430, 1024 and 1440px using synthetic fixtures. Check actual computed contrast, plain numeric text containment and selected-sort behaviour in addition to layout, controls, seven-day charts and reporting regression tests. Do not visit tracking links or change live data.

Dashboard comparison: ?layout=1 through ?layout=8 provides eight opt-in layouts using existing reporting components. Layout 1 remains the default.
