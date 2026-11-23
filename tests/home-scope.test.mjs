import test from 'node:test';
import assert from 'node:assert/strict';
import {homePaidCodes} from '../netlify/lib/home-scope.mjs';
test('Home only accepts verified selected rows with a genuine paid boolean',()=>{
 const rows=[{code:'PAID',active:true,paid:true},{code:'UNPAID',active:true,paid:false},{code:'STRING_FALSE',active:true,paid:'FALSE'},{code:'NOT_SELECTED',active:false,paid:true}];
 assert.deepEqual(homePaidCodes(rows,'SHEET_LIVE'),['PAID']);assert.deepEqual(homePaidCodes(rows,'SHEET_FRESH'),['PAID']);assert.deepEqual(homePaidCodes(rows,'SHEET_CACHED'),['PAID']);
});
