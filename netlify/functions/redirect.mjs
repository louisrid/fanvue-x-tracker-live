import {getStore} from '@netlify/blobs';
import {workerAuth} from '../lib/metrics.mjs';
import {createRedirectHandler} from '../lib/redirect-handler.mjs';

export default createRedirectHandler({
  authorise:workerAuth,
  recordClick:async(event,test)=>{
    const storage=getStore({name:test?'fanvue-x-test-events':'fanvue-x-click-events-v2',consistency:'strong'});
    await storage.setJSON(`${Date.now()}-${crypto.randomUUID()}`,event);
  }
});
