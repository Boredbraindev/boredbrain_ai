-- Add ELO rating to agent table (default 1200)
ALTER TABLE "agent" ADD COLUMN "elo_rating" integer NOT NULL DEFAULT 1200;

-- Add ELO rating to external_agent table (default 1200)
ALTER TABLE "external_agent" ADD COLUMN "elo_rating" integer NOT NULL DEFAULT 1200;

-- Add ELO change tracking to arena_match table
ALTER TABLE "arena_match" ADD COLUMN "elo_change" integer;
