import { pgTable, text, timestamp, boolean, json, jsonb, varchar, integer, uuid, real } from 'drizzle-orm/pg-core';
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

// Polar subscription table (mirrors migration 0004_modern_ironclad.sql)
export const subscription = pgTable('subscription', {
  id: text('id').primaryKey().notNull(),
  createdAt: timestamp('createdAt').notNull(),
  modifiedAt: timestamp('modifiedAt'),
  amount: integer('amount').notNull(),
  currency: text('currency').notNull(),
  recurringInterval: text('recurringInterval').notNull(),
  status: text('status').notNull(),
  currentPeriodStart: timestamp('currentPeriodStart').notNull(),
  currentPeriodEnd: timestamp('currentPeriodEnd').notNull(),
  cancelAtPeriodEnd: boolean('cancelAtPeriodEnd').notNull().default(false),
  canceledAt: timestamp('canceledAt'),
  startedAt: timestamp('startedAt').notNull(),
  endsAt: timestamp('endsAt'),
  endedAt: timestamp('endedAt'),
  customerId: text('customerId').notNull(),
  productId: text('productId').notNull(),
  discountId: text('discountId'),
  checkoutId: text('checkoutId').notNull(),
  customerCancellationReason: text('customerCancellationReason'),
  customerCancellationComment: text('customerCancellationComment'),
  metadata: text('metadata'),
  customFieldData: text('customFieldData'),
  userId: text('userId').references(() => user.id),
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
  eloRating: integer('elo_rating').notNull().default(1200),
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
  eloChange: integer('elo_change'),
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
  price: text('price').notNull().default('50'), // BBAI
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
// Agent Economy - Persistent Tables
// ============================================

// Agent wallets (BBAI balances)
export const agentWallet = pgTable('agent_wallet', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  agentId: text('agent_id').notNull().unique(),
  address: text('address').notNull(),
  balance: real('balance').notNull().default(0),
  dailyLimit: real('daily_limit').notNull().default(500),
  totalSpent: real('total_spent').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Wallet transaction log
export const walletTransaction = pgTable('wallet_transaction', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  agentId: text('agent_id').notNull(),
  amount: real('amount').notNull(),
  type: text('type').notNull(), // 'debit' | 'credit'
  reason: text('reason').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  balanceAfter: real('balance_after').notNull(),
});

// Inter-agent billing records
export const billingRecord = pgTable('billing_record', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  callerAgentId: text('caller_agent_id').notNull(),
  providerAgentId: text('provider_agent_id').notNull(),
  toolsUsed: json('tools_used').$type<string[]>().notNull().default([]),
  totalCost: real('total_cost').notNull(),
  platformFee: real('platform_fee').notNull(),
  providerEarning: real('provider_earning').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  status: text('status').notNull().default('completed'), // 'completed' | 'failed' | 'refunded'
});

// External agent registry
export const externalAgent = pgTable('external_agent', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  name: text('name').notNull(),
  description: text('description'),
  ownerAddress: text('owner_address').notNull(),
  agentCardUrl: text('agent_card_url'),
  endpoint: text('endpoint').notNull(),
  tools: json('tools').$type<string[]>().notNull().default([]),
  specialization: text('specialization').notNull().default('general'),
  stakingAmount: real('staking_amount').notNull().default(0),
  status: text('status').notNull().default('pending'), // 'pending' | 'verified' | 'active' | 'suspended'
  rating: real('rating').notNull().default(0),
  eloRating: integer('elo_rating').notNull().default(1200),
  totalCalls: integer('total_calls').notNull().default(0),
  totalEarned: real('total_earned').notNull().default(0),
  registeredAt: timestamp('registered_at').defaultNow().notNull(),
  verifiedAt: timestamp('verified_at'),
  metadata: json('metadata').$type<Record<string, any>>(),
});

// Marketplace listings
export const marketplaceListing = pgTable('marketplace_listing', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  agentId: text('agent_id').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  longDescription: text('long_description'),
  specialization: text('specialization').notNull(),
  tools: json('tools').$type<string[]>().notNull().default([]),
  pricing: json('pricing').$type<{ perCall: number; subscription: number }>().notNull(),
  rating: real('rating').notNull().default(0),
  reviewCount: integer('review_count').notNull().default(0),
  totalCalls: integer('total_calls').notNull().default(0),
  successRate: real('success_rate').notNull().default(100),
  avgResponseTime: integer('avg_response_time').notNull().default(0),
  featured: boolean('featured').notNull().default(false),
  verified: boolean('verified').notNull().default(false),
  tags: json('tags').$type<string[]>().notNull().default([]),
  developer: json('developer').$type<{ address: string; name: string; agentCount: number }>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Agent reviews
export const agentReview = pgTable('agent_review', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  agentId: text('agent_id').notNull(),
  reviewerAddress: text('reviewer_address').notNull(),
  reviewerName: text('reviewer_name').notNull(),
  rating: integer('rating').notNull(),
  title: text('title').notNull(),
  comment: text('comment').notNull(),
  helpful: integer('helpful').notNull().default(0),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

// Cross-platform network nodes
export const networkNode = pgTable('network_node', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  name: text('name').notNull(),
  platform: text('platform').notNull(), // 'boredbrain' | 'claude' | 'openai' | 'gemini' | 'custom'
  endpoint: text('endpoint').notNull(),
  agentCardUrl: text('agent_card_url'),
  capabilities: json('capabilities').$type<string[]>().notNull().default([]),
  tools: json('tools').$type<string[]>().notNull().default([]),
  status: text('status').notNull().default('online'), // 'online' | 'offline' | 'degraded'
  lastSeen: timestamp('last_seen').defaultNow().notNull(),
  latency: integer('latency').notNull().default(0),
  totalInteractions: integer('total_interactions').notNull().default(0),
  trustScore: integer('trust_score').notNull().default(50),
  chain: text('chain'),
  walletAddress: text('wallet_address'),
});

// Network messages between nodes
export const networkMessage = pgTable('network_message', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  fromNodeId: text('from_node_id').notNull(),
  toNodeId: text('to_node_id').notNull(),
  type: text('type').notNull(), // 'discovery' | 'invoke' | 'response' | 'billing' | 'heartbeat'
  payload: json('payload').$type<any>(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  latency: integer('latency'),
  status: text('status').notNull().default('sent'), // 'sent' | 'delivered' | 'processed' | 'failed'
});

// Payment transactions (all types)
export const paymentTransaction = pgTable('payment_transaction', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  type: text('type').notNull(), // 'tool_call' | 'agent_invoke' | 'prompt_purchase' | 'arena_entry' | 'staking'
  fromAgentId: text('from_agent_id').notNull(),
  toAgentId: text('to_agent_id'),
  amount: real('amount').notNull(),
  platformFee: real('platform_fee').notNull().default(0),
  providerShare: real('provider_share').notNull().default(0),
  chain: text('chain').notNull().default('base'),
  txHash: text('tx_hash'),
  status: text('status').notNull().default('pending'), // 'pending' | 'confirmed' | 'failed'
  toolName: text('tool_name'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  blockNumber: integer('block_number'),
});

// ERC-4337 Smart wallets
export const smartWallet = pgTable('smart_wallet', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  agentId: text('agent_id').notNull().unique(),
  smartWalletAddress: text('smart_wallet_address').notNull(),
  ownerAddress: text('owner_address').notNull(),
  chain: text('chain').notNull().default('base'),
  isDeployed: boolean('is_deployed').notNull().default(false),
  nonce: integer('nonce').notNull().default(0),
  guardians: json('guardians').$type<string[]>().notNull().default([]),
  spendingLimits: json('spending_limits').$type<{ daily: number; perTransaction: number }>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Arena Wager / Escrow
export const arenaWager = pgTable('arena_wager', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  matchId: text('match_id').notNull(),
  bettorId: text('bettor_id').notNull(), // user or agent ID
  bettorType: text('bettor_type').notNull().default('user'), // 'user' | 'agent' | 'spectator'
  agentId: text('agent_id').notNull(), // who they bet on
  amount: real('amount').notNull(),
  odds: real('odds').notNull().default(1),
  status: text('status').notNull().default('escrowed'), // 'escrowed' | 'won' | 'lost' | 'refunded'
  payout: real('payout').default(0),
  txHash: text('tx_hash'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  settledAt: timestamp('settled_at'),
});

// Arena Escrow Pool
export const arenaEscrow = pgTable('arena_escrow', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  matchId: text('match_id').notNull().unique(),
  totalPool: real('total_pool').notNull().default(0),
  platformRake: real('platform_rake').notNull().default(0), // 10% rake
  winnerPayout: real('winner_payout').notNull().default(0),
  status: text('status').notNull().default('open'), // 'open' | 'locked' | 'settled' | 'refunded'
  settledAt: timestamp('settled_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================
// Agent Tokenization (Virtuals Protocol model)
// ============================================

export const agentToken = pgTable('agent_token', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  agentId: text('agent_id').notNull().unique(),
  tokenSymbol: text('token_symbol').notNull().unique(),
  tokenName: text('token_name').notNull(),
  totalSupply: real('total_supply').notNull().default(1_000_000_000), // 1B tokens
  circulatingSupply: real('circulating_supply').notNull().default(0),
  price: real('price').notNull().default(0.001), // price in BBAI
  marketCap: real('market_cap').notNull().default(0),
  totalVolume: real('total_volume').notNull().default(0),
  holders: integer('holders').notNull().default(0),
  buybackPool: real('buyback_pool').notNull().default(0), // accumulated from agent usage
  tokenizationFee: real('tokenization_fee').notNull().default(500), // 500 BBAI to tokenize
  chain: text('chain').notNull().default('base'),
  txHash: text('tx_hash'),
  status: text('status').notNull().default('active'), // 'pending' | 'active' | 'paused'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Agent token trades
export const agentTokenTrade = pgTable('agent_token_trade', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  tokenId: text('token_id').notNull(),
  traderId: text('trader_id').notNull(),
  type: text('type').notNull(), // 'buy' | 'sell' | 'buyback'
  amount: real('amount').notNull(), // token amount
  price: real('price').notNull(), // price per token in BBAI
  totalCost: real('total_cost').notNull(), // total BBAI cost
  platformFee: real('platform_fee').notNull().default(0), // 1% trade fee
  txHash: text('tx_hash'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

// Playbook marketplace (winning agent strategies)
export const playbook = pgTable('playbook', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  creatorId: text('creator_id').notNull(),
  agentId: text('agent_id'), // source agent
  matchId: text('match_id'), // source match (if from arena win)
  title: text('title').notNull(),
  description: text('description'),
  systemPrompt: text('system_prompt').notNull(),
  toolConfig: json('tool_config').$type<string[]>().notNull().default([]),
  matchType: text('match_type'), // debate, search_race, research
  winRate: real('win_rate').notNull().default(0),
  totalUses: integer('total_uses').notNull().default(0),
  price: real('price').notNull().default(50), // BBAI
  totalSales: integer('total_sales').notNull().default(0),
  totalRevenue: real('total_revenue').notNull().default(0),
  rating: real('rating').notNull().default(0),
  featured: boolean('featured').notNull().default(false),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Playbook purchases
export const playbookPurchase = pgTable('playbook_purchase', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  playbookId: text('playbook_id').notNull(),
  buyerId: text('buyer_id').notNull(),
  price: real('price').notNull(),
  txHash: text('tx_hash'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================
// Skills Marketplace Tables
// ============================================

// Skill registry (marketplace catalog)
export const skill = pgTable('skill', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  price: real('price').notNull().default(0), // BBAI per call
  category: text('category').notNull().default('data'), // 'data' | 'analysis' | 'blockchain' | 'ai'
  version: text('version').notNull().default('1.0.0'),
  author: text('author').notNull().default('BoredBrain'),
  totalCalls: integer('total_calls').notNull().default(0),
  totalRevenue: real('total_revenue').notNull().default(0),
  rating: real('rating').notNull().default(0),
  status: text('status').notNull().default('active'), // 'active' | 'deprecated'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Skill installations (agent ↔ skill binding)
export const skillInstallation = pgTable('skill_installation', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  skillId: text('skill_id').notNull(),
  agentId: text('agent_id').notNull(),
  installedAt: timestamp('installed_at').defaultNow().notNull(),
  usageCount: integer('usage_count').notNull().default(0),
  totalBilled: real('total_billed').notNull().default(0),
  status: text('status').notNull().default('active'), // 'active' | 'suspended' | 'expired'
});

// ============================================
// User Rewards (daily check-in / BBAI tokens)
// ============================================

export const userReward = pgTable('user_reward', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => generateId()),
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: 'cascade' }),
  balance: integer('balance').notNull().default(0),
  streak: integer('streak').notNull().default(0),
  currentDay: integer('current_day').notNull().default(1),
  lastClaimDate: text('last_claim_date'),
  weeklyStreaksCompleted: integer('weekly_streaks_completed').notNull().default(0),
  claimedDays: json('claimed_days').$type<number[]>().default([]),
  missions: json('missions').$type<Record<string, { progress: number; completed: boolean }>>().default({}),
  history: json('history')
    .$type<Array<{ id: string; date: string; amount: number; type: string }>>()
    .default([]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// DAO Governance Tables
// ============================================

// DAO proposals
export const daoProposal = pgTable('dao_proposal', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  title: text('title').notNull(),
  description: text('description').notNull(),
  proposer: text('proposer').notNull(),
  type: text('type').notNull().default('parameter_change'), // 'parameter_change' | 'treasury_spend' | 'skill_approval' | 'agent_ban' | 'protocol_upgrade' | 'fee_adjustment'
  options: json('options').$type<Array<{ label: string; votes: number }>>().notNull().default([]),
  status: text('status').notNull().default('active'), // 'active' | 'passed' | 'rejected' | 'executed'
  totalVotes: integer('total_votes').notNull().default(0),
  quorum: integer('quorum').notNull().default(1000),
  category: text('category'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  endsAt: timestamp('ends_at').notNull(),
  executedAt: timestamp('executed_at'),
});

// DAO votes (one per voter per proposal)
export const daoVote = pgTable('dao_vote', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  proposalId: text('proposal_id').notNull(),
  voter: text('voter').notNull(),
  optionIndex: integer('option_index').notNull(),
  weight: integer('weight').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================
// BBAI Points (BP) System
// ============================================

// User points balance & level
export const userPoints = pgTable('user_points', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletAddress: text('wallet_address').notNull().unique(),
  totalBp: integer('total_bp').notNull().default(0),
  level: integer('level').notNull().default(1),
  streakDays: integer('streak_days').notNull().default(0),
  lastLoginDate: text('last_login_date'), // YYYY-MM-DD to track daily login
  season: integer('season').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow(),
});

// Point transaction log
export const pointTransaction = pgTable('point_transaction', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletAddress: text('wallet_address').notNull(),
  amount: integer('amount').notNull(),
  reason: text('reason').notNull(), // 'prediction_bet', 'arena_watch', 'agent_invoke', 'daily_login', 'streak_bonus', 'agent_register'
  referenceId: text('reference_id'), // related bet/agent/match ID
  season: integer('season').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow(),
});

// User badges
export const userBadge = pgTable('user_badge', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletAddress: text('wallet_address').notNull(),
  badgeId: text('badge_id').notNull(), // 'first_blood', 'agent_whisperer', 'arena_champion', 'diamond_hands', 'fleet_commander'
  earnedAt: timestamp('earned_at').defaultNow(),
});

// ============================================
// Agent Memory & Relationships
// ============================================

// Agent memory — episodic (past interactions), semantic (facts), procedural (learned patterns)
export const agentMemory = pgTable('agent_memory', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  agentId: text('agent_id').notNull(),
  type: text('type').notNull(), // 'episodic' | 'semantic' | 'procedural'
  content: text('content').notNull(),
  importance: integer('importance').default(5), // 1-10
  tags: jsonb('tags').$type<string[]>().default([]),
  accessCount: integer('access_count').default(0),
  lastAccessed: timestamp('last_accessed'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Agent relationships — trust scores with other agents
export const agentRelationship = pgTable('agent_relationship', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  agentId: text('agent_id').notNull(),
  targetAgentId: text('target_agent_id').notNull(),
  trustScore: integer('trust_score').default(50), // 0-100
  interactionCount: integer('interaction_count').default(0),
  lastInteraction: timestamp('last_interaction'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================
// Agent Self-Replication & Evolution
// ============================================

// Agent lineage — tracks parent/child relationships for self-replication
export const agentLineage = pgTable('agent_lineage', {
  id: text('id').primaryKey(),
  parentId: text('parent_id').notNull(),
  childId: text('child_id').notNull(),
  generation: integer('generation').default(1),
  fundingAmount: text('funding_amount').notNull(),
  genesisPrompt: text('genesis_prompt'),
  spawnedAt: timestamp('spawned_at').defaultNow(),
});

// Agent evolution — tracks performance events and self-improvement
export const agentEvolution = pgTable('agent_evolution', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull(),
  eventType: text('event_type').notNull(), // 'battle_win' | 'battle_loss' | 'invocation' | 'evolution' | 'spawn'
  data: jsonb('data').$type<Record<string, unknown>>(),
  performanceScore: integer('performance_score'), // 0-100
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================
// Agent Referral Network (MLM)
// ============================================

// Agent referral relationships (2-level max)
export const agentReferral = pgTable('agent_referral', {
  id: text('id').primaryKey(),
  recruiterId: text('recruiter_id').notNull(),
  recruitedId: text('recruited_id').notNull(),
  level: integer('level').notNull().default(1), // 1 = direct, 2 = second-level
  createdAt: timestamp('created_at').defaultNow(),
});

// Referral commission payout log
export const referralPayout = pgTable('referral_payout', {
  id: text('id').primaryKey(),
  recruiterId: text('recruiter_id').notNull(),
  earningAgentId: text('earning_agent_id').notNull(),
  level: integer('level').notNull(), // 1 or 2
  amount: text('amount').notNull(), // BBAI amount
  source: text('source').notNull(), // 'invocation' | 'debate' | 'arena'
  createdAt: timestamp('created_at').defaultNow(),
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
export type Subscription = InferSelectModel<typeof subscription>;
export type ApiKey = InferSelectModel<typeof apiKey>;
export type Agent = InferSelectModel<typeof agent>;
export type ToolUsage = InferSelectModel<typeof toolUsage>;
export type ArenaMatch = InferSelectModel<typeof arenaMatch>;
export type OnchainTx = InferSelectModel<typeof onchainTx>;
export type PromptTemplate = InferSelectModel<typeof promptTemplate>;
export type PromptPurchase = InferSelectModel<typeof promptPurchase>;
export type AgentWallet = InferSelectModel<typeof agentWallet>;
export type WalletTransaction = InferSelectModel<typeof walletTransaction>;
export type BillingRecord = InferSelectModel<typeof billingRecord>;
export type ExternalAgent = InferSelectModel<typeof externalAgent>;
export type MarketplaceListing = InferSelectModel<typeof marketplaceListing>;
export type AgentReview = InferSelectModel<typeof agentReview>;
export type NetworkNode = InferSelectModel<typeof networkNode>;
export type NetworkMessage = InferSelectModel<typeof networkMessage>;
export type PaymentTransaction = InferSelectModel<typeof paymentTransaction>;
export type SmartWallet = InferSelectModel<typeof smartWallet>;
export type ArenaWager = InferSelectModel<typeof arenaWager>;
export type ArenaEscrow = InferSelectModel<typeof arenaEscrow>;
export type AgentToken = InferSelectModel<typeof agentToken>;
export type AgentTokenTrade = InferSelectModel<typeof agentTokenTrade>;
export type Playbook = InferSelectModel<typeof playbook>;
export type PlaybookPurchase = InferSelectModel<typeof playbookPurchase>;
export type Skill = InferSelectModel<typeof skill>;
export type SkillInstallation = InferSelectModel<typeof skillInstallation>;
export type UserReward = InferSelectModel<typeof userReward>;
export type DaoProposal = InferSelectModel<typeof daoProposal>;
export type DaoVote = InferSelectModel<typeof daoVote>;
export type UserPoints = InferSelectModel<typeof userPoints>;
export type PointTransaction = InferSelectModel<typeof pointTransaction>;
export type UserBadge = InferSelectModel<typeof userBadge>;
export type AgentMemory = InferSelectModel<typeof agentMemory>;
export type AgentRelationship = InferSelectModel<typeof agentRelationship>;
export type AgentLineage = InferSelectModel<typeof agentLineage>;
export type AgentEvolution = InferSelectModel<typeof agentEvolution>;
export type AgentReferral = InferSelectModel<typeof agentReferral>;
export type ReferralPayout = InferSelectModel<typeof referralPayout>;

// ============================================
// P2P Betting Marketplace
// ============================================

// Markets — each market is a question that can be bet on
export const bettingMarket = pgTable('betting_market', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(), // "BTC above $70k by Friday?"
  description: text('description'),
  category: text('category').notNull(), // 'crypto_price', 'agent_performance', 'ecosystem', 'defi', 'nft', 'custom'
  outcomes: text('outcomes').array().notNull(), // ['Yes', 'No'] or ['Team A', 'Team B', 'Draw']
  resolvedOutcome: text('resolved_outcome'), // null until resolved
  status: text('status').notNull().default('open'), // open, locked, resolved, cancelled
  creatorAddress: text('creator_address').notNull(),
  creatorType: text('creator_type').notNull().default('user'), // 'user' | 'agent' | 'platform'
  totalVolume: integer('total_volume').notNull().default(0),
  totalOrders: integer('total_orders').notNull().default(0),
  resolvesAt: timestamp('resolves_at'), // when the market auto-resolves
  resolvedAt: timestamp('resolved_at'),
  tags: text('tags').array(),
  metadata: jsonb('metadata'), // extra data (price targets, agent IDs, etc.)
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Orders — limit orders in the order book
export const bettingOrder = pgTable('betting_order', {
  id: uuid('id').primaryKey().defaultRandom(),
  marketId: uuid('market_id').notNull().references(() => bettingMarket.id),
  userAddress: text('user_address').notNull(),
  userType: text('user_type').notNull().default('user'), // 'user' | 'agent'
  side: text('side').notNull(), // 'YES' | 'NO' (or outcome name)
  price: integer('price').notNull(), // 1-99 (cents, like Polymarket) — probability in %
  amount: integer('amount').notNull(), // number of shares (each share pays 100 if correct)
  filled: integer('filled').notNull().default(0), // shares filled
  status: text('status').notNull().default('open'), // open, partial, filled, cancelled
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Trades — matched orders
export const bettingTrade = pgTable('betting_trade', {
  id: uuid('id').primaryKey().defaultRandom(),
  marketId: uuid('market_id').notNull().references(() => bettingMarket.id),
  buyOrderId: uuid('buy_order_id').notNull().references(() => bettingOrder.id),
  sellOrderId: uuid('sell_order_id').notNull().references(() => bettingOrder.id),
  buyerAddress: text('buyer_address').notNull(),
  sellerAddress: text('seller_address').notNull(),
  outcome: text('outcome').notNull(), // which outcome was traded
  price: integer('price').notNull(), // executed price
  shares: integer('shares').notNull(), // number of shares traded
  bbaiAmount: integer('bbai_amount').notNull(), // total BBAI exchanged
  createdAt: timestamp('created_at').defaultNow(),
});

// Positions — user's net position per market per outcome
export const bettingPosition = pgTable('betting_position', {
  id: uuid('id').primaryKey().defaultRandom(),
  marketId: uuid('market_id').notNull().references(() => bettingMarket.id),
  userAddress: text('user_address').notNull(),
  outcome: text('outcome').notNull(),
  shares: integer('shares').notNull().default(0), // net shares held
  avgPrice: integer('avg_price').notNull().default(0), // average entry price
  realizedPnl: integer('realized_pnl').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Topic Debates (multi-agent open debates)
// ============================================

// Topic debate — open-participation debates where any agent can submit an opinion
export const topicDebate = pgTable('topic_debate', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  topic: text('topic').notNull(),
  category: text('category').notNull().default('general'), // 'crypto', 'defi', 'ai', 'governance', 'culture', 'general'
  status: text('status').notNull().default('open'), // 'open' | 'scoring' | 'completed'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  closesAt: timestamp('closes_at').notNull(),
  totalParticipants: integer('total_participants').notNull().default(0),
  topScore: integer('top_score').default(0),
  topAgentId: text('top_agent_id'),
});

// Debate opinion — an agent's submitted take on a topic debate
export const debateOpinion = pgTable('debate_opinion', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  debateId: text('debate_id').notNull(),
  agentId: text('agent_id').notNull(),
  opinion: text('opinion').notNull(),
  score: integer('score').default(0),
  scoreBreakdown: jsonb('score_breakdown').$type<{
    relevance: number;
    insight: number;
    accuracy: number;
    creativity: number;
  }>(),
  position: text('position').notNull().default('neutral'), // 'for' | 'against' | 'neutral'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type TopicDebate = InferSelectModel<typeof topicDebate>;
export type DebateOpinion = InferSelectModel<typeof debateOpinion>;

export type BettingMarket = InferSelectModel<typeof bettingMarket>;
export type BettingOrder = InferSelectModel<typeof bettingOrder>;
export type BettingTrade = InferSelectModel<typeof bettingTrade>;
export type BettingPosition = InferSelectModel<typeof bettingPosition>;
