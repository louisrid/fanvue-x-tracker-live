import {startRefresh} from './gta-report.mjs';
export default async request=>{await startRefresh(request);return new Response('OK');};
export const config={schedule:'0 */2 * * *'};
