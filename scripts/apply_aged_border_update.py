from pathlib import Path
p=Path(__file__).resolve().parents[1]
css=p/'public/styles.css'
text=css.read_text()
assert '--xtracker-sparkle-opacity:.25;' in text
text=text.replace('--xtracker-sparkle-opacity:.25;', '--xtracker-sparkle-opacity:.225;', 1)
# Update all aging treatment selectors with an appended, high-specificity rule:
# white inside, visibly wide red/orange gradient BORDER. Keep original card geometries.
addition='''

/* X Tracker 5.0.25 - aged live articles: pure white fill and bold rounded
   red/orange gradient BORDER. New (<48h) articles retain vivid full fills. */
:root {
  --xtracker-aged-border-gradient:linear-gradient(118deg,#c90c38 0%,#eb2040 27%,#fa4530 57%,#fe8126 82%,#db381f 100%);
  --xtracker-aged-border-width:9px;
  --xtracker-aged-ink:#192136;
}
:root #page-dashboard .week-card.live-article.is-aged,
:root #page-placements .placement-shell.is-live.is-aged,
:root #page-historical .historical-card.historical-is-live.is-aged.historical-is-paid {
  background:linear-gradient(#fff,#fff) padding-box,var(--xtracker-aged-border-gradient) border-box!important;
  border:var(--xtracker-aged-border-width) solid transparent!important;
  color:var(--xtracker-aged-ink)!important;
  box-shadow:0 10px 28px rgba(225,54,76,.14)!important;
  overflow:hidden;
  isolation:isolate;
}
:root #page-dashboard .week-card.live-article.is-aged {border-radius:24px!important;}
:root #page-placements .placement-shell.is-live.is-aged {border-radius:23px!important;}
:root #page-historical .historical-card.historical-is-live.is-aged.historical-is-paid {border-radius:19px!important;}
:root #page-dashboard .week-card.live-article.is-aged:hover,
:root #page-placements .placement-shell.is-live.is-aged:hover,
:root #page-historical .historical-card.historical-is-live.is-aged.historical-is-paid:hover {
  background:linear-gradient(#fff,#fff) padding-box,var(--xtracker-aged-border-gradient) border-box!important;
  box-shadow:0 14px 32px rgba(225,54,76,.2)!important;
  filter:none;
}
/* Sparkle texture sits ON THE GRADIENT FRAME, never washing out the white centre. */
:root #page-dashboard .week-card.live-article.is-aged::after,
:root #page-placements .placement-shell.is-live.is-aged::after,
:root #page-historical .historical-card.historical-is-live.is-aged.historical-is-paid::after {
  content:"";
  position:absolute;
  inset:0;
  display:block;
  padding:var(--xtracker-aged-border-width);
  border-radius:inherit;
  box-sizing:border-box;
  pointer-events:none;
  z-index:0;
  background-image:var(--xtracker-sparkle-tile);
  background-size:var(--xtracker-sparkle-size);
  background-repeat:repeat;
  opacity:var(--xtracker-sparkle-opacity);
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
  -webkit-mask-composite:xor;
  mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
  mask-composite:exclude;
}
/* White-surface article text stays ink-dark; remove legacy white text shadows. */
:root #page-dashboard .week-card.live-article.is-aged :is(.publisher-name,.week-meta,.week-meta span,.primary-number-label,.primary-number,.mini-metric strong,.mini-metric span,.article-campaign-chip,.state-pill),
:root #page-placements .placement-shell.is-live.is-aged :is(.tracker-name,.tracker-name strong,.tracker-info,.tracker-metric strong,.tracker-metric span,.tracker-chevron),
:root #page-historical .historical-card.historical-is-live.is-aged.historical-is-paid :is(.historical-card-name,.historical-card-meta,.historical-card-numbers strong,.historical-card-numbers small,.historical-state,.article-campaign-chip) {
  color:var(--xtracker-aged-ink)!important;
  -webkit-text-fill-color:var(--xtracker-aged-ink)!important;
  text-shadow:none!important;
  opacity:1;
}
:root #page-dashboard .week-card.live-article.is-aged :is(.state-pill,.article-campaign-chip),
:root #page-historical .historical-card.historical-is-live.is-aged.historical-is-paid :is(.historical-state,.article-campaign-chip) {
  background:#fff3f4!important;
  border:1px solid #ffd2cf!important;
  border-radius:999px;
  color:#8a2941!important;
  -webkit-text-fill-color:#8a2941!important;
}
:root #page-historical .historical-card.historical-is-live.is-aged.historical-is-paid .historical-card-numbers {
  border-top-color:#e7eaf0!important;
}
:root #page-placements .placement-shell.is-live.is-aged .tracker-metric {
  background:#f7f9fd!important;
  border:1px solid #e9edf5;
}
/* Make X views + likes legible at a glance across NEW and aged cards. */
:root #page-dashboard .week-card.live-article .week-secondary {gap:20px;align-items:center;}
:root #page-dashboard .week-card.live-article .mini-metric {gap:5px;}
:root #page-dashboard .week-card.live-article .mini-metric strong {
  font-size:clamp(23px,2.45vw,31px)!important;
  line-height:1.04;
  letter-spacing:-.06em;
  font-weight:900;
}
:root #page-dashboard .week-card.live-article .mini-metric span {
  font-size:13px!important;
  font-weight:800!important;
  line-height:1.1;
  opacity:1;
}
:root #page-placements .placement-shell.is-live .tracker-metric strong {
  font-size:clamp(22px,2vw,28px)!important;
  font-weight:900!important;
  line-height:1.1;
}
:root #page-placements .placement-shell.is-live .tracker-metric span {
  font-size:12px!important;
  font-weight:800!important;
  opacity:1;
}
/* Slight emphasis for measured Views and Likes in existing stats panels. */
:root #page-historical .historical-week-kpi.historical-metric-views strong,
:root #page-historical .historical-week-kpi.historical-metric-likes strong,
:root #page-stats #detailedKpis .kpi-card.metric-views .kpi-value,
:root #page-stats #detailedKpis .kpi-card.metric-likes .kpi-value {
  font-weight:900!important;
  letter-spacing:-.055em;
}
@media(max-width:760px) {
  :root {--xtracker-aged-border-width:7px;}
  :root #page-dashboard .week-card.live-article .week-secondary {gap:13px;}
  :root #page-dashboard .week-card.live-article .mini-metric strong {font-size:23px!important;}
  :root #page-dashboard .week-card.live-article .mini-metric span {font-size:12px!important;}
  :root #page-placements .placement-shell.is-live .tracker-metric strong {font-size:21px!important;}
  :root #page-placements .placement-shell.is-live .tracker-metric span {font-size:11px!important;}
}
@media(max-width:360px) {
  :root #page-dashboard .week-card.live-article .week-secondary {gap:9px;}
  :root #page-dashboard .week-card.live-article .mini-metric strong {font-size:20px!important;}
}
'''
assert not text.rstrip().endswith('/* X Tracker 5.0.25')
css.write_text(text.rstrip()+addition)
for name in ['public/index.html','public/app.js','netlify/functions/dashboard.mjs','package.json']:
    f=p/name
    content=f.read_text()
    assert '5.0.24' in content, (name,'missing version')
    f.write_text(content.replace('5.0.24','5.0.25'))
