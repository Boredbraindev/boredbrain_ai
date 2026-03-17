-- Add source column to topic_debate for tracking which market the topic came from
ALTER TABLE topic_debate ADD COLUMN IF NOT EXISTS source text DEFAULT 'polymarket';
