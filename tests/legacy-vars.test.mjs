import test from 'node:test';import assert from 'node:assert/strict';
import {adminKey,feedURL,feedKey} from '../netlify/lib/shared.mjs';
test('existing Netlify variable names remain supported without changing their values',()=>{
 const old={...process.env};try{delete process.env.ADMIN_KEY;delete process.env.SHEET_FEED_URL;delete process.env.SHEET_FEED_KEY;process.env.API_TOKEN='existing-admin';process.env.APP_SCRIPT_URL='existing-feed';process.env.APP_SCRIPT_TOKEN='existing-secret';assert.equal(adminKey(),'existing-admin');assert.equal(feedURL(),'existing-feed');assert.equal(feedKey(),'existing-secret');}finally{process.env=old;}
});
