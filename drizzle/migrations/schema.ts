import { pgTable, foreignKey, text, json, integer, real, timestamp, unique, varchar, boolean } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const agent = pgTable("agent", {
	id: text().primaryKey().notNull(),
	ownerId: text("owner_id"),
	name: text().notNull(),
	description: text(),
	capabilities: json().notNull(),
	systemPrompt: text("system_prompt"),
	tools: json().notNull(),
	pricePerQuery: text("price_per_query").default('0'),
	nftTokenId: integer("nft_token_id"),
	chainId: integer("chain_id"),
	txHash: text("tx_hash"),
	totalExecutions: integer("total_executions").default(0),
	totalRevenue: text("total_revenue").default('0'),
	rating: real().default(0),
	status: text().default('active'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.ownerId],
			foreignColumns: [user.id],
			name: "agent_owner_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const apiKey = pgTable("api_key", {
	id: text().primaryKey().notNull(),
	userId: text("user_id"),
	key: text().notNull(),
	name: text().notNull(),
	permissions: json().default([]),
	walletAddress: text("wallet_address"),
	chainId: integer("chain_id"),
	rateLimit: integer("rate_limit").default(100),
	totalQueries: integer("total_queries").default(0),
	totalSpent: text("total_spent").default('0'),
	creditBalance: text("credit_balance").default('0'),
	status: text().default('active'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	lastUsedAt: timestamp("last_used_at", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "api_key_user_id_user_id_fk"
		}).onDelete("cascade"),
	unique("api_key_key_unique").on(table.key),
]);

export const chat = pgTable("chat", {
	id: text().primaryKey().notNull(),
	userId: text().notNull(),
	title: text().default('New Chat').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	visibility: varchar().default('private').notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "chat_userId_user_id_fk"
		}),
]);

export const arenaMatch = pgTable("arena_match", {
	id: text().primaryKey().notNull(),
	topic: text().notNull(),
	matchType: text("match_type").notNull(),
	agents: json().notNull(),
	winnerId: text("winner_id"),
	rounds: json(),
	totalVotes: integer("total_votes").default(0),
	resultTxHash: text("result_tx_hash"),
	prizePool: text("prize_pool").default('0'),
	status: text().default('pending'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	completedAt: timestamp("completed_at", { mode: 'string' }),
});

export const customInstructions = pgTable("custom_instructions", {
	id: text().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	content: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "custom_instructions_user_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const extremeSearchUsage = pgTable("extreme_search_usage", {
	id: text().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	searchCount: integer("search_count").default(0).notNull(),
	date: timestamp({ mode: 'string' }).defaultNow().notNull(),
	resetAt: timestamp("reset_at", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "extreme_search_usage_user_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const lookout = pgTable("lookout", {
	id: text().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	title: text().notNull(),
	prompt: text().notNull(),
	frequency: text().notNull(),
	cronSchedule: text("cron_schedule").notNull(),
	timezone: text().default('UTC').notNull(),
	nextRunAt: timestamp("next_run_at", { mode: 'string' }).notNull(),
	qstashScheduleId: text("qstash_schedule_id"),
	status: text().default('active').notNull(),
	lastRunAt: timestamp("last_run_at", { mode: 'string' }),
	lastRunChatId: text("last_run_chat_id"),
	runHistory: json("run_history").default([]),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "lookout_user_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const message = pgTable("message", {
	id: text().primaryKey().notNull(),
	chatId: text("chat_id").notNull(),
	role: text().notNull(),
	parts: json().notNull(),
	attachments: json().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	model: text(),
	inputTokens: integer("input_tokens"),
	outputTokens: integer("output_tokens"),
	totalTokens: integer("total_tokens"),
	completionTime: real("completion_time"),
}, (table) => [
	foreignKey({
			columns: [table.chatId],
			foreignColumns: [chat.id],
			name: "message_chat_id_chat_id_fk"
		}).onDelete("cascade"),
]);

export const messageUsage = pgTable("message_usage", {
	id: text().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	messageCount: integer("message_count").default(0).notNull(),
	date: timestamp({ mode: 'string' }).defaultNow().notNull(),
	resetAt: timestamp("reset_at", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "message_usage_user_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const account = pgTable("account", {
	id: text().primaryKey().notNull(),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	userId: text("user_id").notNull(),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	accessTokenExpiresAt: timestamp("access_token_expires_at", { mode: 'string' }),
	refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { mode: 'string' }),
	scope: text(),
	password: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "account_user_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const onchainTx = pgTable("onchain_tx", {
	id: text().primaryKey().notNull(),
	txHash: text("tx_hash").notNull(),
	chainId: integer("chain_id").notNull(),
	txType: text("tx_type").notNull(),
	fromAddress: text("from_address").notNull(),
	toAddress: text("to_address"),
	amount: text(),
	tokenSymbol: text("token_symbol"),
	relatedId: text("related_id"),
	status: text().default('pending'),
	blockNumber: integer("block_number"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	confirmedAt: timestamp("confirmed_at", { mode: 'string' }),
}, (table) => [
	unique("onchain_tx_tx_hash_unique").on(table.txHash),
]);

export const referral = pgTable("referral", {
	id: text().primaryKey().notNull(),
	referrerId: text("referrer_id").notNull(),
	refereeId: text("referee_id").notNull(),
	referralCode: text("referral_code").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.referrerId],
			foreignColumns: [user.id],
			name: "referral_referrer_id_user_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.refereeId],
			foreignColumns: [user.id],
			name: "referral_referee_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const promptTemplate = pgTable("prompt_template", {
	id: text().primaryKey().notNull(),
	creatorId: text("creator_id"),
	title: text().notNull(),
	description: text(),
	systemPrompt: text("system_prompt").notNull(),
	category: text().default('general').notNull(),
	tags: json().default([]),
	previewMessages: json("preview_messages").default([]),
	tools: json().default([]),
	price: text().default('50').notNull(),
	totalSales: integer("total_sales").default(0),
	totalRevenue: text("total_revenue").default('0'),
	rating: real().default(0),
	ratingCount: integer("rating_count").default(0),
	sourceChatId: text("source_chat_id"),
	status: text().default('active'),
	featured: boolean().default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.creatorId],
			foreignColumns: [user.id],
			name: "prompt_template_creator_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const session = pgTable("session", {
	id: text().primaryKey().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	token: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	userId: text("user_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "session_user_id_user_id_fk"
		}).onDelete("cascade"),
	unique("session_token_unique").on(table.token),
]);

export const verification = pgTable("verification", {
	id: text().primaryKey().notNull(),
	identifier: text().notNull(),
	value: text().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
});

export const user = pgTable("user", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	email: text().notNull(),
	emailVerified: boolean("email_verified").notNull(),
	image: text(),
	username: text(),
	walletAddress: text("wallet_address"),
	referralCode: text("referral_code"),
	referredBy: text("referred_by"),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
}, (table) => [
	unique("user_email_unique").on(table.email),
	unique("user_username_unique").on(table.username),
	unique("user_wallet_address_unique").on(table.walletAddress),
	unique("user_referral_code_unique").on(table.referralCode),
]);

export const promptPurchase = pgTable("prompt_purchase", {
	id: text().primaryKey().notNull(),
	promptId: text("prompt_id").notNull(),
	buyerId: text("buyer_id").notNull(),
	price: text().notNull(),
	txHash: text("tx_hash"),
	chainId: integer("chain_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.promptId],
			foreignColumns: [promptTemplate.id],
			name: "prompt_purchase_prompt_id_prompt_template_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.buyerId],
			foreignColumns: [user.id],
			name: "prompt_purchase_buyer_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const stream = pgTable("stream", {
	id: text().primaryKey().notNull(),
	chatId: text().notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.chatId],
			foreignColumns: [chat.id],
			name: "stream_chatId_chat_id_fk"
		}).onDelete("cascade"),
]);

export const toolUsage = pgTable("tool_usage", {
	id: text().primaryKey().notNull(),
	apiKeyId: text("api_key_id"),
	agentId: text("agent_id"),
	toolName: text("tool_name").notNull(),
	inputParams: json("input_params"),
	outputSummary: text("output_summary"),
	tokensUsed: integer("tokens_used"),
	cost: text().default('0'),
	paymentTxHash: text("payment_tx_hash"),
	chainId: integer("chain_id"),
	latencyMs: integer("latency_ms"),
	status: text().default('success'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.apiKeyId],
			foreignColumns: [apiKey.id],
			name: "tool_usage_api_key_id_api_key_id_fk"
		}),
	foreignKey({
			columns: [table.agentId],
			foreignColumns: [agent.id],
			name: "tool_usage_agent_id_agent_id_fk"
		}),
]);
