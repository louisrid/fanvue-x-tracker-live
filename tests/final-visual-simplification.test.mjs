import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync('public/index.html','utf8');
const app=readFileSync('public/app.js','utf8');
const reports=readFileSync('public/campaign-reporting.js','utf8');
const styles=readFileSync('public/refined-layout.css','utf8');
const members=readFileSync('public/discord-members.js','utf8');
const course=readFileSync('public/discord-course.js','utf8');

test('Landing page is concise while keeping six genuine campaign destinations',()=>{
  const shell=readFileSync('public/fanvue-app.js','utf8');
  const core=readFileSync('public/fanvue-core.js','utf8');
  assert.doesNotMatch(html,/Choose a campaign to open its report|Articles this week/);
  // v3.1 redesign: Home is the landing page; Discord and the five paid campaigns are the
  // six destinations, and every old destination link still opens its page.
  assert.match(shell,/\{key:'home',title:'Home'/);
  for(const [route,page] of [['gta-vi','gta-vi'],['campaign-C001','of-terms'],['report-guru','guru-promotion'],['report-article-rt','x-articles\\/paid-reposts'],['report-articles','x-articles'],['discord','discord']]){
    assert.match(shell,new RegExp("'?"+route+"'?:'"+page+"'"));
  }
  assert.equal((core.match(/\{key:'[a-z-]+',name:'[^']+',icon:/g)||[]).length,5);
  assert.ok(html.indexOf('fanvue-records.css')>html.indexOf('fanvue.css'));
});

test('Single shared visual override tightens desktop and mobile sizing without removing metrics',()=>{
  const css=readFileSync('public/fanvue.css','utf8');
  const shell=readFileSync('public/fanvue-app.js','utf8');
  // v3.1 redesign: one shared token stylesheet replaces the layered overrides.
  assert.equal((html.match(/rel="stylesheet" href="\/(?!fanvue)/g)||[]).length,0);
  assert.match(css,/\.fv-strip\{[^}]*min-height:116px/);
  assert.match(css,/--fv-row:39px/);
  assert.match(css,/@media \(max-width:767px\)/);
  assert.match(css,/@media \(max-width:359px\)/);
  assert.match(html,/id="fvHeader"/);
  assert.match(html,/id="fvPage"/);
  for(const label of ['Paid spend','Post views','Tracked clicks','Creator signups','KYC completions','Earning creators'])assert.ok(shell.includes("'"+label+"'"),label);
});

test('Routine status chatter is hidden but unavailable-source warnings remain',()=>{
  assert.match(members,/status\.textContent=fromCache\?'Checking member count':'';/);
  assert.match(course,/info\.textContent='';/);
  assert.match(members,/refresh unavailable/);
  assert.match(course,/temporarily unavailable/);
  assert.match(reports,/state\.error\?\(state\.data\?'Saved data · refresh failed':'Data unavailable'\):''/);
  assert.match(app,/status\.textContent=ready\?\(report\.warning\?'Saved data':''\)/);
  assert.match(styles,/discord-source-status:not\(:has\(span:not\(:empty\)\)\)/);
});

test('Campaign views, paid QRT evidence, details and links are retained',()=>{
  assert.match(app,/renderGtaQuotedSources\(\)/);
  assert.match(app,/sourceLink\(qrt\.postUrl,'Open QRT'\)/);
  assert.match(app,/qrt\.trackingUrl/);
  assert.match(app,/qrt\.profileUrl/);
  assert.match(reports,/class="rpt-source-detail"/);
  assert.match(reports,/sourceStale:true/);
  // v3.1 redesign: GTA quote-post and original-post records keep the live post,
  // tracking link and publisher profile in each row and its details.
  const shell=readFileSync('public/fanvue-app.js','utf8');
  assert.match(shell,/\['Tracking link',trackingText\(r\.trackingUrl\)\]/);
  assert.match(shell,/\['Profile',U\.extLink\(r\.profileUrl,'Profile'\)/);
  assert.match(shell,/key:'live',label:'Live post'/);
});


test('Campaign navigation is centred, icon-free and uses one coordinated dark palette',()=>{
  const shell=readFileSync('public/fanvue-app.js','utf8');
  const css=readFileSync('public/fanvue.css','utf8');
  const core=readFileSync('public/fanvue-core.js','utf8');
  // v3.1 redesign (DESIGN §2.3): one flat black sidebar with the official wordmark,
  // white labels, campaign-coloured icons and a neutral charcoal active row.
  // The static header markup carries no inline icons.
  const header=html.slice(html.indexOf('id="fvHeader"'),html.indexOf('id="fvPage"'));
  assert.doesNotMatch(header,/<svg\b/);
  assert.doesNotMatch(html,/dashboard-discord-icon|class="brandmark"/);
  assert.match(html,/alt="Fanvue"/);
  assert.match(css,/--fv-sidebar:#000000/);
  assert.match(css,/--fv-nav-active:#212121/);
  for(const colour of ['violet','blue','teal','pink'])assert.match(core,new RegExp(colour+":\\{icon:'#"));
  for(const text of ['X Articles','GTA VI','OF Terms','CIS','Guru Promotion'])assert.match(core,new RegExp("name:'"+text+"'"));
  assert.match(shell,/title:'Discord'/);
});
