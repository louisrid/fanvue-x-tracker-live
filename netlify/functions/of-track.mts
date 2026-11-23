import { campaignDatabase } from '../../db/index';
import { ofClicks } from '../../db/schema';
import { authorised, createOfRedirect } from '../lib/of-campaign.mjs';

export default async (request, context) => createOfRedirect({
  authorise: req => authorised(req, Netlify.env.get('ADMIN_KEY') || Netlify.env.get('API_TOKEN')),
  record: event => campaignDatabase().insert(ofClicks).values(event),
})(request, context);

export const config = { path: '/of/*' };
