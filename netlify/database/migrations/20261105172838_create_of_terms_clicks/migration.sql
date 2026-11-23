CREATE TABLE "of_terms_clicks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"account" text NOT NULL,
	"clicked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_test" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX "of_terms_account_date_idx" ON "of_terms_clicks" ("account","clicked_at");