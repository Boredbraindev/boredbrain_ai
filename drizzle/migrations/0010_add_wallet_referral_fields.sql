-- Add wallet and referral fields to user table
ALTER TABLE "user" ADD COLUMN "wallet_address" text;
ALTER TABLE "user" ADD COLUMN "referral_code" text;
ALTER TABLE "user" ADD COLUMN "referred_by" text;

-- Add unique constraints
CREATE UNIQUE INDEX "user_wallet_address_unique" ON "user" ("wallet_address");
CREATE UNIQUE INDEX "user_referral_code_unique" ON "user" ("referral_code");

-- Add foreign key constraint for referred_by
ALTER TABLE "user" ADD CONSTRAINT "user_referred_by_user_id_fk" FOREIGN KEY ("referred_by") REFERENCES "user"("id") ON DELETE no action ON UPDATE no action;

-- Create referral table
CREATE TABLE "referral" (
	"id" text PRIMARY KEY NOT NULL,
	"referrer_id" text NOT NULL,
	"referee_id" text NOT NULL,
	"referral_code" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraints for referral table
DO $$ BEGIN
 ALTER TABLE "referral" ADD CONSTRAINT "referral_referrer_id_user_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "referral" ADD CONSTRAINT "referral_referee_id_user_id_fk" FOREIGN KEY ("referee_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
