// Route the existing Academy HEAD beacon to Netlify's persistent click function.
// GET health checks and ordinary page views continue unchanged.
export default function discordCourseBeacon(request){
  const url=new URL(request.url);
  if(request.method!=='HEAD'||url.searchParams.get('source')!=='discord-free-course')return;
  if(!/^Fanvue-Academy-Course-Tracker\/\d+(?:\.\d+)*$/i.test(request.headers.get('user-agent')||''))return;
  return new URL('/.netlify/functions/discord-course-clicks?source=discord-free-course',url);
}
export const config={path:'/',method:'HEAD'};
