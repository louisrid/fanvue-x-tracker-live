import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(process.env.XTRACKER_ROOT||'.');
const app=readFileSync(resolve(root,'public/app.js'),'utf8');
const dashboard=readFileSync(resolve(root,'netlify/functions/dashboard.mjs'),'utf8');
const stylesheet=readFileSync(resolve(root,'public/styles.css'),'utf8');
const sheetScript=readFileSync(resolve(root,'apps-script/Code.gs'),'utf8');

test('fallback note is available on Dashboard, placements, Historical, This Week and modal',()=>{
 assert.ok(app.includes('X stats temporarily unavailable. Showing last recorded figures.'));
 assert.ok(app.includes("${campaignTag(p)}${metricBadge(p)}"));
 assert.ok(app.includes('articleCardContent(p,{live})'));
 assert.ok(app.includes('articleCardContent(p,{live,tracker:true})'));
 assert.ok(app.includes('articleCardContent(p,{live,value,scope})'));
 assert.ok(app.includes('${campaignTag(p)} ${metricBadge(p)} <span>'));
 assert.ok(app.includes("${metricBadge(p)}${!p.metricError&&metricTime(p)?"));
 assert.ok(app.includes("if(p.metricStatus==='last-known-good')return number(p[key])"));
 assert.ok(stylesheet.includes('.metric-last-known-note'));
});
test('global warning no longer treats retained article data as a full-system failure',()=>{
 assert.ok(!dashboard.includes('Some X metrics are stale; see their last successful refresh.'));
 assert.ok(dashboard.includes('warning:[warning,clickError].filter(Boolean)'));
});
test('Google Sheets refresh records provider 404 without marking the article unavailable',()=>{
 const failureHandler=sheetScript.slice(sheetScript.indexOf('function unavailableCheck_('));
 assert.ok(failureHandler.includes('storeMeta_(ss,p.code,{9:failed})'));
 assert.ok(!failureHandler.includes('setValue(true)'));
 assert.ok(!failureHandler.includes("'unavailable'])"));
 assert.ok(sheetScript.includes("failed.push(p.code+': X provider HTTP '+status)"));
});
