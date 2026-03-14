-- Migration: Add economy system columns
-- Date: 2026-03-13

-- Polymarket integration columns on topic_debate
ALTER TABLE topic_debate ADD COLUMN IF NOT EXISTS polymarket_event_id TEXT;
ALTER TABLE topic_debate ADD COLUMN IF NOT EXISTS resolved_outcome TEXT;
ALTER TABLE topic_debate ADD COLUMN IF NOT EXISTS total_pool INTEGER DEFAULT 0;
ALTER TABLE topic_debate ADD COLUMN IF NOT EXISTS market_id UUID;

-- BP Purchase table (one-time top-up via Polar)
CREATE TABLE IF NOT EXISTS bp_purchase (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  package_id TEXT NOT NULL,
  bp_amount INTEGER NOT NULL,
  usd_amount INTEGER NOT NULL,
  polar_checkout_id TEXT,
  polar_order_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMP
);
