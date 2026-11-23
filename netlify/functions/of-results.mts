import { eq, sql } from 'drizzle-orm';
import { campaignDatabase } from '../../db/index';
import { ofClicks } from '../../db/schema';
import { authorised, createOfResults } from '../lib/of-campaign.mjs';

export default async (request) => createOfResults({
  authorise: req => authorised(req, Netlify.env.get('ADMIN_KEY') || Netlify.env.get('API_TOKEN')),
  load: async isTest => {
    return await campaignDatabase().select({
      account: ofClicks.account,
      date: sql<string>`to_char(${ofClicks.clickedAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`.as('date'),
      clicks: sql<number>`count(*)::integer`.as('clicks'),
    }).from(ofClicks).where(eq(ofClicks.isTest, isTest))
      .groupBy(ofClicks.account, sql`to_char(${ofClicks.clickedAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`)
      .orderBy(ofClicks.account, sql`date`);
  },
})(request);
export const config = { path: ['/api/private/of-results', '/.netlify/functions/of-results'] };
