import { pgTable, text, timestamp, boolean, json, varchar, integer, uuid, real } from 'drizzle-orm/pg-core';
import { generateId } from 'ai';
import { InferSelectModel } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull(),
  image: text('image'),
  username: text('username').unique(),
  walletAddress: text('wallet_address').unique(),
  referralCode: text('referral_code').unique(),
  referredBy: text('referred_by'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
});

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
});

export const chat = pgTable('chat', {
  id: text('id')
    .primaryKey()
    .notNull()
    .$defaultFn(() => uuidv4()),
  userId: text('userId')
    .notNull()
    .references(() => user.id),
  title: text('title').notNull().default('New Chat'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  visibility: varchar('visibility', { enum: ['public', 'private'] })
    .notNull()
    .default('private'),
});

export const message = pgTable('message', {
  id: text('id')
    .primaryKey()
    .notNull()
    .$defaultFn(() => generateId()),
  chatId: text('chat_id')
    .notNull()
    .references(() => chat.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // user, assistant, or tool
  parts: json('parts').notNull(), // Store parts as JSON in the database
  attachments: json('attachments').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  model: text('model'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  totalTokens: integer('total_tokens'),
  completionTime: real('completion_time'),
});

export const stream = pgTable('stream', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => generateId()),
  chatId: text('chatId')
    .notNull()
    .references(() => chat.id, { onDelete: 'cascade' }),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
});

// Extreme search usage tracking table
export const extremeSearchUsage = pgTable('extreme_search_usage', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => generateId()),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  searchCount: integer('search_count').notNull().default(0),
  date: timestamp('date').notNull().defaultNow(),
  resetAt: timestamp('reset_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Message usage tracking table
export const messageUsage = pgTable('message_usage', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => generateId()),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  messageCount: integer('message_count').notNull().default(0),
  date: timestamp('date').notNull().defaultNow(),
  resetAt: timestamp('reset_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Custom instructions table
export const customInstructions = pgTable('custom_instructions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => generateId()),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Lookout table for scheduled searches
export const lookout = pgTable('lookout', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => generateId()),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  prompt: text('prompt').notNull(),
  frequency: text('frequency').notNull(), // 'once', 'daily', 'weekly', 'monthly', 'yearly'
  cronSchedule: text('cron_schedule').notNull(),
  timezone: text('timezone').notNull().default('UTC'),
  nextRunAt: timestamp('next_run_at').notNull(),
  qstashScheduleId: text('qstash_schedule_id'),
  status: text('status').notNull().default('active'), // 'active', 'paused', 'archived', 'running'
  lastRunAt: timestamp('last_run_at'),
  lastRunChatId: text('last_run_chat_id'),
  // Store all run history as JSON
  runHistory: json('run_history')
    .$type<
      Array<{
        runAt: string; // ISO date string
        chatId: string;
        status: 'success' | 'error' | 'timeout';
        error?: string;
        duration?: number; // milliseconds
        tokensUsed?: number;
        searchesPerformed?: number;
      }>
    >()
    .default([]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Referral tracking table
export const referral = pgTable('referral', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => generateId()),
  referrerId: text('referrer_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  refereeId: text('referee_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  referralCode: text('referral_code').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ============================================
// AI Agent Economy Tables
// ============================================

// API Key management for agent/user API access
export const apiKey = pgTable('api_key', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => generateId()),
  userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  permissions: json('permissions').$type<string[]>().default([]),
  walletAddress: text('wallet_address'),
  chainId: integer('chain_id'),
  rateLimit: integer('rate_limit').default(100),
  totalQueries: integer('total_queries').default(0),
  totalSpent: text('total_spent').default('0'),
  creditBalance: text('credit_balance').default('0'),
  status: text('status').default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastUsedAt: timestamp('last_used_at'),
});

// Agent registry (on-chain mirror)
export const agent = pgTable('agent', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => generateId()),
  ownerId: text('owner_id').references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  capabilities: json('capabilities').$type<string[]>().notNull(),
  systemPrompt: text('system_prompt'),
  tools: json('tools').$type<string[]>().notNull(),
  pricePerQuery: text('price_per_query').default('0'),
  nftTokenId: integer('nft_token_id'),
  chainId: integer('chain_id'),
  txHash: text('tx_hash'),
  totalExecutions: integer('total_executions').default(0),
  totalRevenue: text('total_revenue').default('0'),
  rating: real('rating').default(0),
  status: text('status').default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Tool usage log (API call tracking + on-chain mirror)
export const toolUsage = pgTable('tool_usage', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => generateId()),
  apiKeyId: text('api_key_id').references(() => apiKey.id),
  agentId: text('agent_id').references(() => agent.id),
  toolName: text('tool_name').notNull(),
  inputParams: json('input_params'),
  outputSummary: text('output_summary'),
  tokensUsed: integer('tokens_used'),
  cost: text('cost').default('0'),
  paymentTxHash: text('payment_tx_hash'),
  chainId: integer('chain_id'),
  latencyMs: integer('latency_ms'),
  status: text('status').default('success'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Arena matches
export const arenaMatch = pgTable('arena_match', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => generateId()),
  topic: text('topic').notNull(),
  matchType: text('match_type').notNull(),
  agents: json('agents').$type<string[]>().notNull(),
  winnerId: text('winner_id'),
  rounds: json('rounds').$type<
    Array<{
      agentId: string;
      response: string;
      toolsUsed: string[];
      score: number;
      timestamp: string;
    }>
  >(),
  totalVotes: integer('total_votes').default(0),
  resultTxHash: text('result_tx_hash'),
  prizePool: text('prize_pool').default('0'),
  status: text('status').default('pending'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

// On-chain transaction log
export const onchainTx = pgTable('onchain_tx', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => generateId()),
  txHash: text('tx_hash').notNull().unique(),
  chainId: integer('chain_id').notNull(),
  txType: text('tx_type').notNull(),
  fromAddress: text('from_address').notNull(),
  toAddress: text('to_address'),
  amount: text('amount'),
  tokenSymbol: text('token_symbol'),
  relatedId: text('related_id'),
  status: text('status').default('pending'),
  blockNumber: integer('block_number'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  confirmedAt: timestamp('confirmed_at'),
});

// Prompt Template marketplace (AI-generated prompts sold as agents)
export const promptTemplate = pgTable('prompt_template', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => generateId()),
  creatorId: text('creator_id').references(() => user.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  systemPrompt: text('system_prompt').notNull(),
  category: text('category').notNull().default('general'), // general, coding, research, finance, creative, marketing
  tags: json('tags').$type<string[]>().default([]),
  previewMessages: json('preview_messages').$type<Array<{ role: string; content: string }>>().default([]),
  tools: json('tools').$type<string[]>().default([]),
  price: text('price').notNull().default('50'), // BBAI tokens
  totalSales: integer('total_sales').default(0),
  totalRevenue: text('total_revenue').default('0'),
  rating: real('rating').default(0),
  ratingCount: integer('rating_count').default(0),
  sourceChatId: text('source_chat_id'), // original chat it was created from
  status: text('status').default('active'), // draft, active, paused, archived
  featured: boolean('featured').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Prompt purchase records
export const promptPurchase = pgTable('prompt_purchase', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => generateId()),
  promptId: text('prompt_id')
    .notNull()
    .references(() => promptTemplate.id, { onDelete: 'cascade' }),
  buyerId: text('buyer_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  price: text('price').notNull(),
  txHash: text('tx_hash'),
  chainId: integer('chain_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================
// Type exports
// ============================================

export type User = InferSelectModel<typeof user>;
export type Session = InferSelectModel<typeof session>;
export type Account = InferSelectModel<typeof account>;
export type Verification = InferSelectModel<typeof verification>;
export type Chat = InferSelectModel<typeof chat>;
export type Message = InferSelectModel<typeof message>;
export type Stream = InferSelectModel<typeof stream>;
export type ExtremeSearchUsage = InferSelectModel<typeof extremeSearchUsage>;
export type MessageUsage = InferSelectModel<typeof messageUsage>;
export type CustomInstructions = InferSelectModel<typeof customInstructions>;
export type Lookout = InferSelectModel<typeof lookout>;
export type Referral = InferSelectModel<typeof referral>;
export type ApiKey = InferSelectModel<typeof apiKey>;
export type Agent = InferSelectModel<typeof agent>;
export type ToolUsage = InferSelectModel<typeof toolUsage>;
export type ArenaMatch = InferSelectModel<typeof arenaMatch>;
export type OnchainTx = InferSelectModel<typeof onchainTx>;
export type PromptTemplate = InferSelectModel<typeof promptTemplate>;
export type PromptPurchase = InferSelectModel<typeof promptPurchase>;
