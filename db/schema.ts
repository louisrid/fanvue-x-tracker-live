import { pgTable, uuid, text, timestamp, boolean, index, numeric, bigint, primaryKey } from 'drizzle-orm/pg-core';

// Deliberately independent of the article tracker and its stores.
export const ofClicks = pgTable('of_terms_clicks', {
  id: uuid('id').defaultRandom().primaryKey(),
  account: text('account').notNull(),
  clickedAt: timestamp('clicked_at', { withTimezone: true }).defaultNow().notNull(),
  isTest: boolean('is_test').default(false).notNull(),
}, table => [index('of_terms_account_date_idx').on(table.account, table.clickedAt)]);

export const boostTweets = pgTable('x_boost_tweets', {
  id: text('id').primaryKey(), handle: text('handle').notNull(), name: text('name').notNull(),
  spend: numeric('spend', {precision:14, scale:2}), addedAt: timestamp('added_at', {withTimezone:true}).defaultNow().notNull(),
  removedAt: timestamp('removed_at', {withTimezone:true}), tweetText: text('tweet_text'),
  lastAttemptAt: timestamp('last_attempt_at', {withTimezone:true}), error: text('error'),
});
export const boostSamples = pgTable('x_boost_samples', {
  tweetId: text('tweet_id').notNull().references(()=>boostTweets.id),
  at: timestamp('at', {withTimezone:true}).notNull(),
  views: bigint('views',{mode:'number'}), likes: bigint('likes',{mode:'number'}),
  reposts: bigint('reposts',{mode:'number'}), replies: bigint('replies',{mode:'number'}),
}, t=>[primaryKey({columns:[t.tweetId,t.at]})]);
