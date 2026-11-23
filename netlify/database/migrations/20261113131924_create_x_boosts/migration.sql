CREATE TABLE "x_boost_samples" (
	"tweet_id" text,
	"at" timestamp with time zone,
	"views" bigint,
	"likes" bigint,
	"reposts" bigint,
	"replies" bigint,
	CONSTRAINT "x_boost_samples_pkey" PRIMARY KEY("tweet_id","at")
);
--> statement-breakpoint
CREATE TABLE "x_boost_tweets" (
	"id" text PRIMARY KEY,
	"handle" text NOT NULL,
	"name" text NOT NULL,
	"spend" numeric(14,2),
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	"tweet_text" text,
	"last_attempt_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "x_boost_samples" ADD CONSTRAINT "x_boost_samples_tweet_id_x_boost_tweets_id_fkey" FOREIGN KEY ("tweet_id") REFERENCES "x_boost_tweets"("id");
INSERT INTO x_boost_tweets (id,handle,name) VALUES
('2112984438376104125','tommybradshaw0','Tommy Bradshaw'),
('2114713856811352299','scottyaiofm','Scotty'),
('2115081383827698033','Tristanvdvn','Tristan'),
('2117354088690245907','ArdzAI0','ArdzAI');

INSERT INTO x_boost_samples (tweet_id,at,views,likes,reposts,replies) VALUES ('2112984438376104125','2026-11-13T13:21:16.303Z',14768,57,16,11);
UPDATE x_boost_tweets SET last_attempt_at='2026-11-13T13:21:16.303Z',tweet_text='https://x.com/i/article/2112975050727157760' WHERE id='2112984438376104125';

INSERT INTO x_boost_samples (tweet_id,at,views,likes,reposts,replies) VALUES ('2114713856811352299','2026-11-13T13:21:16.437Z',27767,35,21,23);
UPDATE x_boost_tweets SET last_attempt_at='2026-11-13T13:21:16.437Z',tweet_text='https://x.com/i/article/2114695662856011776' WHERE id='2114713856811352299';

INSERT INTO x_boost_samples (tweet_id,at,views,likes,reposts,replies) VALUES ('2115081383827698033','2026-11-13T13:21:16.570Z',18443,77,67,19);
UPDATE x_boost_tweets SET last_attempt_at='2026-11-13T13:21:16.570Z',tweet_text='McDonald''s at 17. $700k on Fanvue last month with AI creators.

Every step in between: the jobs, the mistakes, the exact tools and prices we use. https://x.com/i/article/2115021297700708352' WHERE id='2115081383827698033';

INSERT INTO x_boost_samples (tweet_id,at,views,likes,reposts,replies) VALUES ('2117354088690245907','2026-11-13T13:21:16.683Z',39202,74,12,3);
UPDATE x_boost_tweets SET last_attempt_at='2026-11-13T13:21:16.683Z',tweet_text='Started 11 October.
$4,173 in October.
$650 in the first 2 days of November.

One AI Uncensored Skool student''s dashboard, from $0 three weeks ago.

Same method we teach inside. Full breakdown in the replies ↓' WHERE id='2117354088690245907';
