import {runRefreshJob} from './gta-report.mjs';
export default async request=>{const {id}=await request.json();await runRefreshJob(id);};
export const config={background:true};
