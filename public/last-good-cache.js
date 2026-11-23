/* Safe, persistent last-successful-read cache for all standalone X Tracker feeds.
   No failed, incomplete or unverified response may overwrite a usable saved record.
   Scoped to this browser; underlying Google Sheets and server records remain authoritative. */
(()=>{
  'use strict';
  const prefix='xtracker-last-good-v2:';
  const memory=new Map();
  function read(name,valid){
    if(!/^[a-z0-9-]{2,60}$/.test(name))return null;
    try{
      const raw=localStorage.getItem(prefix+name);
      const stored=raw?JSON.parse(raw):memory.get(name);
      const record=stored?.version===2?stored:null;
      if(!record||!Number.isFinite(record.savedAt)||record.savedAt>Date.now()+60000)return null;
      if(typeof valid==='function'&&!valid(record.payload))return null;
      return {payload:record.payload,savedAt:record.savedAt};
    }catch{return null;}
  }
  function write(name,data,valid){
    if(!/^[a-z0-9-]{2,60}$/.test(name)||typeof valid!=='function'||!valid(data))return false;
    const record={version:2,savedAt:Date.now(),payload:data};
    memory.set(name,record);
    try{localStorage.setItem(prefix+name,JSON.stringify(record));return true;}
    catch{return false;}
  }
  window.XTrackerLastGood=Object.freeze({read,write});
})();
