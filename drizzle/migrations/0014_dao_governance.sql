CREATE TABLE IF NOT EXISTS "dao_proposal" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"proposer" text NOT NULL,
	"type" text DEFAULT 'parameter_change' NOT NULL,
	"options" json DEFAULT '[]'::json NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"total_votes" integer DEFAULT 0 NOT NULL,
	"quorum" integer DEFAULT 1000 NOT NULL,
	"category" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"ends_at" timestamp NOT NULL,
	"executed_at" timestamp
);

CREATE TABLE IF NOT EXISTS "dao_vote" (
	"id" text PRIMARY KEY NOT NULL,
	"proposal_id" text NOT NULL,
	"voter" text NOT NULL,
	"option_index" integer NOT NULL,
	"weight" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
