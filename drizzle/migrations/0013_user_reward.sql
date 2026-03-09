CREATE TABLE IF NOT EXISTS "user_reward" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL UNIQUE,
  "balance" integer DEFAULT 0 NOT NULL,
  "streak" integer DEFAULT 0 NOT NULL,
  "current_day" integer DEFAULT 1 NOT NULL,
  "last_claim_date" text,
  "weekly_streaks_completed" integer DEFAULT 0 NOT NULL,
  "claimed_days" json DEFAULT '[]'::json,
  "missions" json DEFAULT '{}'::json,
  "history" json DEFAULT '[]'::json,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "user_reward_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
);
