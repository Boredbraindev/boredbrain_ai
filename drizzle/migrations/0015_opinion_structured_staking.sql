-- Add structured opinion columns + auto-staking to debate_opinion
ALTER TABLE "debate_opinion" ADD COLUMN IF NOT EXISTS "reasoning" text;
ALTER TABLE "debate_opinion" ADD COLUMN IF NOT EXISTS "prediction" text;
ALTER TABLE "debate_opinion" ADD COLUMN IF NOT EXISTS "confidence" integer;
ALTER TABLE "debate_opinion" ADD COLUMN IF NOT EXISTS "stake_amount" real DEFAULT 0;
ALTER TABLE "debate_opinion" ADD COLUMN IF NOT EXISTS "stake_outcome" text;
