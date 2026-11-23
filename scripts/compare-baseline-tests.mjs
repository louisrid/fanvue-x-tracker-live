// Only new regressions should block migration. Untouched main is the baseline.
import {readFileSync} from 'node:fs';
const [basePath,changedPath]=process.argv.slice(2);
if(!basePath||!changedPath)throw Error('Usage: node compare-baseline-tests.mjs BASE_LOG FEATURE_LOG');
const fails=file=>{
  const text=readFileSync(file,'utf8');
  const names=[...text.matchAll(/^not ok \d+ - (.+)$/gm)].map(m=>m[1].trim());
  const completed=/^# tests \d+/m.test(text)&&/^# fail \d+/m.test(text);
  if(!completed)throw Error('Full test suite did not complete: '+file);
  return names;
};
const original=fails(basePath),candidate=fails(changedPath),counts=new Map();
for(const item of original)counts.set(item,(counts.get(item)||0)+1);
const introduced=[];
for(const item of candidate){const available=counts.get(item)||0;if(available)counts.set(item,available-1);else introduced.push(item);}
console.log('Untouched main baseline failing tests:',original.length);
console.log('Reporting branch failing tests:',candidate.length);
console.log('New failures compared with original main:',introduced.length);
if(original.length)console.log('The existing repository has stale or failing legacy tests. Those are not ignored as new regressions.');
if(introduced.length){for(const name of introduced)console.error('NEW REGRESSION:',name);process.exitCode=1;}
