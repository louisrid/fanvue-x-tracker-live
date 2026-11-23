import {getStore} from '@netlify/blobs';

// This route runs only for the Academy bot's genuine HEAD click beacons.
// GET monitoring requests and normal dashboard visits never increment the count.
const STORE='fanvue-discord-course-beacons-v1';
export default async function academyCourseBeacon(request){
  const url=new URL(request.url);
  if(request.method!=='HEAD'||url.searchParams.get('source')!=='discord-free-course')return;
  if(!/^Fanvue-Academy-Course-Tracker\/\d+(?:\.\d+)*$/i.test(request.headers.get('user-agent')||''))return;
  try{
    await getStore({name:STORE,consistency:'strong'}).set(
      'click-'+Date.now()+'-'+crypto.randomUUID(),'1');
  }catch(error){
    // Tracking must never interrupt the Discord course button or homepage.
    console.error('Discord free course beacon could not be persisted:',error);
  }
  // Continue to the existing site. The Discord bot expects a successful HEAD.
}

export const config={
  path:'/',
  method:'HEAD',
  header:{'user-agent':'^Fanvue-Academy-Course-Tracker/\\d+'},
  onError:'bypass'
};
