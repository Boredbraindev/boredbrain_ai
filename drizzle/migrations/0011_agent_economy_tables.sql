-- Agent Economy Tables Migration
-- Adds all missing tables for the BoredBrain Agent Economy platform

-- Add wallet_address, referral_code, referred_by to user table (if not already present)
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "wallet_address" text UNIQUE;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "referral_code" text UNIQUE;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "referred_by" text;

--> statement-breakpoint

-- API Key management
CREATE TABLE IF NOT EXISTS "api_key" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text REFERENCES "user"("id") ON DELETE cascade,
	"key" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"permissions" json DEFAULT '[]'::json,
	"wallet_address" text,
	"chain_id" integer,
	"rate_limit" integer DEFAULT 100,
	"total_queries" integer DEFAULT 0,
	"total_spent" text DEFAULT '0',
	"credit_balance" text DEFAULT '0',
	"status" text DEFAULT 'active',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp
);

--> statement-breakpoint

-- Agent registry
CREATE TABLE IF NOT EXISTS "agent" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text REFERENCES "user"("id") ON DELETE cascade,
	"name" text NOT NULL,
	"description" text,
	"capabilities" json NOT NULL,
	"system_prompt" text,
	"tools" json NOT NULL,
	"price_per_query" text DEFAULT '0',
	"nft_token_id" integer,
	"chain_id" integer,
	"tx_hash" text,
	"total_executions" integer DEFAULT 0,
	"total_revenue" text DEFAULT '0',
	"rating" real DEFAULT 0,
	"status" text DEFAULT 'active',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint

-- Tool usage log
CREATE TABLE IF NOT EXISTS "tool_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"api_key_id" text REFERENCES "api_key"("id"),
	"agent_id" text REFERENCES "agent"("id"),
	"tool_name" text NOT NULL,
	"input_params" json,
	"output_summary" text,
	"tokens_used" integer,
	"cost" text DEFAULT '0',
	"payment_tx_hash" text,
	"chain_id" integer,
	"latency_ms" integer,
	"status" text DEFAULT 'success',
	"created_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint

-- Arena matches
CREATE TABLE IF NOT EXISTS "arena_match" (
	"id" text PRIMARY KEY NOT NULL,
	"topic" text NOT NULL,
	"match_type" text NOT NULL,
	"agents" json NOT NULL,
	"winner_id" text,
	"rounds" json,
	"total_votes" integer DEFAULT 0,
	"result_tx_hash" text,
	"prize_pool" text DEFAULT '0',
	"status" text DEFAULT 'pending',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);

--> statement-breakpoint

-- On-chain transaction log
CREATE TABLE IF NOT EXISTS "onchain_tx" (
	"id" text PRIMARY KEY NOT NULL,
	"tx_hash" text NOT NULL UNIQUE,
	"chain_id" integer NOT NULL,
	"tx_type" text NOT NULL,
	"from_address" text NOT NULL,
	"to_address" text,
	"amount" text,
	"token_symbol" text,
	"related_id" text,
	"status" text DEFAULT 'pending',
	"block_number" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"confirmed_at" timestamp
);

--> statement-breakpoint

-- Prompt template marketplace
CREATE TABLE IF NOT EXISTS "prompt_template" (
	"id" text PRIMARY KEY NOT NULL,
	"creator_id" text REFERENCES "user"("id") ON DELETE cascade,
	"title" text NOT NULL,
	"description" text,
	"system_prompt" text NOT NULL,
	"category" text NOT NULL DEFAULT 'general',
	"tags" json DEFAULT '[]'::json,
	"preview_messages" json DEFAULT '[]'::json,
	"tools" json DEFAULT '[]'::json,
	"price" text NOT NULL DEFAULT '50',
	"total_sales" integer DEFAULT 0,
	"total_revenue" text DEFAULT '0',
	"rating" real DEFAULT 0,
	"rating_count" integer DEFAULT 0,
	"source_chat_id" text,
	"status" text DEFAULT 'active',
	"featured" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint

-- Prompt purchase records
CREATE TABLE IF NOT EXISTS "prompt_purchase" (
	"id" text PRIMARY KEY NOT NULL,
	"prompt_id" text NOT NULL REFERENCES "prompt_template"("id") ON DELETE cascade,
	"buyer_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
	"price" text NOT NULL,
	"tx_hash" text,
	"chain_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint

-- Agent wallets (BBAI token balances)
CREATE TABLE IF NOT EXISTS "agent_wallet" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL UNIQUE,
	"address" text NOT NULL,
	"balance" real NOT NULL DEFAULT 0,
	"daily_limit" real NOT NULL DEFAULT 500,
	"total_spent" real NOT NULL DEFAULT 0,
	"is_active" boolean NOT NULL DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint

-- Wallet transaction log
CREATE TABLE IF NOT EXISTS "wallet_transaction" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"amount" real NOT NULL,
	"type" text NOT NULL,
	"reason" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"balance_after" real NOT NULL
);

--> statement-breakpoint

-- Inter-agent billing records
CREATE TABLE IF NOT EXISTS "billing_record" (
	"id" text PRIMARY KEY NOT NULL,
	"caller_agent_id" text NOT NULL,
	"provider_agent_id" text NOT NULL,
	"tools_used" json NOT NULL DEFAULT '[]'::json,
	"total_cost" real NOT NULL,
	"platform_fee" real NOT NULL,
	"provider_earning" real NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"status" text NOT NULL DEFAULT 'completed'
);

--> statement-breakpoint

-- External agent registry
CREATE TABLE IF NOT EXISTS "external_agent" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"owner_address" text NOT NULL,
	"agent_card_url" text,
	"endpoint" text NOT NULL,
	"tools" json NOT NULL DEFAULT '[]'::json,
	"specialization" text NOT NULL DEFAULT 'general',
	"staking_amount" real NOT NULL DEFAULT 0,
	"status" text NOT NULL DEFAULT 'pending',
	"rating" real NOT NULL DEFAULT 0,
	"total_calls" integer NOT NULL DEFAULT 0,
	"total_earned" real NOT NULL DEFAULT 0,
	"registered_at" timestamp DEFAULT now() NOT NULL,
	"verified_at" timestamp,
	"metadata" json
);

--> statement-breakpoint

-- Marketplace listings
CREATE TABLE IF NOT EXISTS "marketplace_listing" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"long_description" text,
	"specialization" text NOT NULL,
	"tools" json NOT NULL DEFAULT '[]'::json,
	"pricing" json NOT NULL,
	"rating" real NOT NULL DEFAULT 0,
	"review_count" integer NOT NULL DEFAULT 0,
	"total_calls" integer NOT NULL DEFAULT 0,
	"success_rate" real NOT NULL DEFAULT 100,
	"avg_response_time" integer NOT NULL DEFAULT 0,
	"featured" boolean NOT NULL DEFAULT false,
	"verified" boolean NOT NULL DEFAULT false,
	"tags" json NOT NULL DEFAULT '[]'::json,
	"developer" json NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint

-- Agent reviews
CREATE TABLE IF NOT EXISTS "agent_review" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"reviewer_address" text NOT NULL,
	"reviewer_name" text NOT NULL,
	"rating" integer NOT NULL,
	"title" text NOT NULL,
	"comment" text NOT NULL,
	"helpful" integer NOT NULL DEFAULT 0,
	"timestamp" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint

-- Cross-platform network nodes
CREATE TABLE IF NOT EXISTS "network_node" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"platform" text NOT NULL,
	"endpoint" text NOT NULL,
	"agent_card_url" text,
	"capabilities" json NOT NULL DEFAULT '[]'::json,
	"tools" json NOT NULL DEFAULT '[]'::json,
	"status" text NOT NULL DEFAULT 'online',
	"last_seen" timestamp DEFAULT now() NOT NULL,
	"latency" integer NOT NULL DEFAULT 0,
	"total_interactions" integer NOT NULL DEFAULT 0,
	"trust_score" integer NOT NULL DEFAULT 50,
	"chain" text,
	"wallet_address" text
);

--> statement-breakpoint

-- Network messages between nodes
CREATE TABLE IF NOT EXISTS "network_message" (
	"id" text PRIMARY KEY NOT NULL,
	"from_node_id" text NOT NULL,
	"to_node_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" json,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"latency" integer,
	"status" text NOT NULL DEFAULT 'sent'
);

--> statement-breakpoint

-- Payment transactions (all types)
CREATE TABLE IF NOT EXISTS "payment_transaction" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"from_agent_id" text NOT NULL,
	"to_agent_id" text,
	"amount" real NOT NULL,
	"platform_fee" real NOT NULL DEFAULT 0,
	"provider_share" real NOT NULL DEFAULT 0,
	"chain" text NOT NULL DEFAULT 'base',
	"tx_hash" text,
	"status" text NOT NULL DEFAULT 'pending',
	"tool_name" text,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"block_number" integer
);

--> statement-breakpoint

-- ERC-4337 Smart wallets
CREATE TABLE IF NOT EXISTS "smart_wallet" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL UNIQUE,
	"smart_wallet_address" text NOT NULL,
	"owner_address" text NOT NULL,
	"chain" text NOT NULL DEFAULT 'base',
	"is_deployed" boolean NOT NULL DEFAULT false,
	"nonce" integer NOT NULL DEFAULT 0,
	"guardians" json NOT NULL DEFAULT '[]'::json,
	"spending_limits" json NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint

-- Arena Wager records
CREATE TABLE IF NOT EXISTS "arena_wager" (
	"id" text PRIMARY KEY NOT NULL,
	"match_id" text NOT NULL,
	"bettor_id" text NOT NULL,
	"bettor_type" text NOT NULL DEFAULT 'user',
	"agent_id" text NOT NULL,
	"amount" real NOT NULL,
	"odds" real NOT NULL DEFAULT 1,
	"status" text NOT NULL DEFAULT 'escrowed',
	"payout" real DEFAULT 0,
	"tx_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"settled_at" timestamp
);

--> statement-breakpoint

-- Arena Escrow Pool
CREATE TABLE IF NOT EXISTS "arena_escrow" (
	"id" text PRIMARY KEY NOT NULL,
	"match_id" text NOT NULL UNIQUE,
	"total_pool" real NOT NULL DEFAULT 0,
	"platform_rake" real NOT NULL DEFAULT 0,
	"winner_payout" real NOT NULL DEFAULT 0,
	"status" text NOT NULL DEFAULT 'open',
	"settled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint

-- Agent Token (Virtuals Protocol model)
CREATE TABLE IF NOT EXISTS "agent_token" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL UNIQUE,
	"token_symbol" text NOT NULL UNIQUE,
	"token_name" text NOT NULL,
	"total_supply" real NOT NULL DEFAULT 1000000000,
	"circulating_supply" real NOT NULL DEFAULT 0,
	"price" real NOT NULL DEFAULT 0.001,
	"market_cap" real NOT NULL DEFAULT 0,
	"total_volume" real NOT NULL DEFAULT 0,
	"holders" integer NOT NULL DEFAULT 0,
	"buyback_pool" real NOT NULL DEFAULT 0,
	"tokenization_fee" real NOT NULL DEFAULT 500,
	"chain" text NOT NULL DEFAULT 'base',
	"tx_hash" text,
	"status" text NOT NULL DEFAULT 'active',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint

-- Agent token trades
CREATE TABLE IF NOT EXISTS "agent_token_trade" (
	"id" text PRIMARY KEY NOT NULL,
	"token_id" text NOT NULL,
	"trader_id" text NOT NULL,
	"type" text NOT NULL,
	"amount" real NOT NULL,
	"price" real NOT NULL,
	"total_cost" real NOT NULL,
	"platform_fee" real NOT NULL DEFAULT 0,
	"tx_hash" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint

-- Playbook marketplace (winning agent strategies)
CREATE TABLE IF NOT EXISTS "playbook" (
	"id" text PRIMARY KEY NOT NULL,
	"creator_id" text NOT NULL,
	"agent_id" text,
	"match_id" text,
	"title" text NOT NULL,
	"description" text,
	"system_prompt" text NOT NULL,
	"tool_config" json NOT NULL DEFAULT '[]'::json,
	"match_type" text,
	"win_rate" real NOT NULL DEFAULT 0,
	"total_uses" integer NOT NULL DEFAULT 0,
	"price" real NOT NULL DEFAULT 50,
	"total_sales" integer NOT NULL DEFAULT 0,
	"total_revenue" real NOT NULL DEFAULT 0,
	"rating" real NOT NULL DEFAULT 0,
	"featured" boolean NOT NULL DEFAULT false,
	"status" text NOT NULL DEFAULT 'active',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint

-- Playbook purchases
CREATE TABLE IF NOT EXISTS "playbook_purchase" (
	"id" text PRIMARY KEY NOT NULL,
	"playbook_id" text NOT NULL,
	"buyer_id" text NOT NULL,
	"price" real NOT NULL,
	"tx_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
