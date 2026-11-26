(function(){
  'use strict';
  const state={accounts:[],loaded:false,error:false,stale:false};
  async function load(){
    try{const res=await fetch('/.netlify/functions/publisher-directory',{cache:'no-store',signal:AbortSignal.timeout(20000)});const data=await res.json();if(!res.ok||!data.ok)throw Error();state.accounts=(data.accounts||[]).filter(a=>a.platform==='X');state.stale=!!data.stale;state.error=false;}catch{state.error=true;}state.loaded=true;window.FanvueApp?.rerender?.();
  }
  window.FanvueDirectory=Object.freeze({state,load});
})();
