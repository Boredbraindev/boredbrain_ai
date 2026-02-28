-- Add Telegram fields to user table
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "telegram_id" TEXT UNIQUE;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "telegram_username" TEXT;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "telegram_first_name" TEXT;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "telegram_last_name" TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS "telegram_id_idx" ON "user"("telegram_id");
