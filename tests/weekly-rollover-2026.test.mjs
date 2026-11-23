import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
function fixture(instant){
 class Clock extends Date{constructor(...args){super(...(args.length?args:[instant]));}static now(){return Date.parse(instant);}}
 const ctx={Date:Clock,Intl,setTimeout:(fn,ms)=>{ctx.timer={fn,ms};return 1;},clearTimeout(){},render(){ctx.renders=(ctx.renders||0)+1;}};
 vm.createContext(ctx);
 vm.runInContext(app.slice(app.indexOf("'use strict';"),app.indexOf('const FX_STORAGE_KEY='))+app.slice(app.indexOf('const STATS_WEEK_ONE='),app.indexOf('function renderStatsWeekSelector('))+app.slice(app.indexOf('function publishedCampaignGroups(){'),app.indexOf('function renderCampaigns(){'))+'\nthis.api={state,currentStatsWeekNumber,reportingWeekStart,selectedStatsWeek,homePlacements,homeEvents,homeClickTotal,statsWeekKpis,ukMidnight,scheduleWeekRollover,publishedCampaignGroups};',ctx);
 return ctx;
}
test('explicit Week 3 anchor and subsequent UK Monday boundaries',()=>{
 for(const [instant,w] of [['2026-11-08T23:59:59.999Z',2],['2026-11-09T00:00:00Z',3],['2026-11-15T23:59:59.999Z',3],['2026-11-16T00:00:00Z',4],['2026-11-23T00:00:00Z',5],['2027-03-28T22:59:59Z',22],['2027-03-28T23:00:00Z',23]])assert.equal(fixture(instant).api.currentStatsWeekNumber(),w,instant);
});
test('current empty week excludes old paid articles and their clicks; historical rows survive',()=>{
 const {api}=fixture('2026-11-09T12:00:00Z');const {state}=api;
 state.placements=[{code:'old',sourceTab:'WEEK 2 - LOUIS',paid:true,cost:500,owner:'LOUIS',campaignId:'C005'}];
 state.activity=[{code:'old',date:'2026-11-09',clicks:12}];state.activityReady=true;
 assert.equal(api.homePlacements().length,0);assert.equal(api.homeClickTotal(),0);
 assert.equal(api.statsWeekKpis(api.selectedStatsWeek()).find(x=>x.id==='money').value,'$0');
 state.statsWeek='2';assert.equal(api.selectedStatsWeek().placements.length,1);assert.equal(api.selectedStatsWeek().from,'2026-10-26');
 state.statsWeek='1';assert.equal(api.selectedStatsWeek().from,'2026-10-19');
 state.statsWeek='current';state.placements.push({code:'new',sourceTab:'WEEK 3 - LOUIS',paid:true,cost:40,owner:'LOUIS'});
 assert.equal(api.homePlacements().length,1);assert.equal(api.statsWeekKpis(api.selectedStatsWeek()).find(x=>x.id==='money').value,'$40');
});
test('open-page timer targets exactly UK midnight in winter and summer',()=>{
 for(const [instant,delay] of [['2026-11-15T23:59:59Z',1000],['2027-03-28T22:59:59Z',1000],['2027-10-31T23:59:59Z',1000]]){
 const ctx=fixture(instant);ctx.api.scheduleWeekRollover();assert.equal(ctx.timer.ms,delay);ctx.timer.fn();assert.equal(ctx.renders,1);
 }
});
test('C001 navigation bypasses current-week and active-row filters using actual IDs',()=>{
 const ctx=fixture('2026-11-09T12:00:00Z');const {api}=ctx;
 ctx.document={getElementById:()=>({value:'recent'})};api.state.campaignFocus='C001';api.state.trackingReady=true;
 api.state.campaigns=[{id:'C001',name:'OF Terms Change Campaign'}];
 api.state.placements=[{code:'of',campaignId:'C001',active:false,sourceTab:'WEEK 1 - LOUIS'},{code:'grok',campaignId:'C005',sourceTab:'WEEK 3 - LOUIS'}];
 const groups=api.publishedCampaignGroups();assert.equal(groups.length,1);assert.equal(groups[0].id,'C001');assert.equal(groups[0].rows[0].code,'of');assert.equal(groups[0].name,'OF Terms Change Campaign');
});
