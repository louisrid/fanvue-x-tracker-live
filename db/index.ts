import { drizzle } from 'drizzle-orm/netlify-db';
import * as schema from './schema';
export function campaignDatabase() { return drizzle({ schema }); }
