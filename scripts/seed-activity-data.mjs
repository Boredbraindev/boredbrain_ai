#!/usr/bin/env node

/**
 * Seed Activity Data — Generates realistic historical activity for the BBAI platform.
 *
 * Populates: billing_record, wallet_transaction, point_transaction,
 *            user_points, arena_match, topic_debate
 *
 * Usage:
 *   node scripts/seed-activity-data.mjs
 *
 * Reads DATABASE_URL from .env.local in project root.
 * Idempotent: skips tables that already have enough data.
 */

import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function loadEnv() {
  try {
    // Try .env.local first, then .env.production.local
    let envPath = resolve(ROOT, '.env.local');
    try { readFileSync(envPath, 'utf-8'); } catch { envPath = resolve(ROOT, '.env.production.local'); }
    const raw = readFileSync(envPath, 'utf-8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      // Strip surrounding quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch (e) {
    console.error('Could not read env file:', e.message);
    process.exit(1);
  }
}

loadEnv();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not found in .env.local');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uuid() {
  return crypto.randomUUID();
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min, max, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

/** Generate a random timestamp within the last N days, biased toward recent */
function randomTimestamp(daysBack, recentBias = true) {
  const now = Date.now();
  const msBack = daysBack * 24 * 60 * 60 * 1000;
  let offset;
  if (recentBias) {
    // Square root distribution: more density toward recent
    offset = Math.pow(Math.random(), 1.5) * msBack;
  } else {
    offset = Math.random() * msBack;
  }
  return new Date(now - offset);
}

function formatTs(d) {
  return d.toISOString();
}

function log(msg) {
  console.log(`[SEED] ${msg}`);
}

// Fake wallet addresses
function generateWallets(count) {
  const wallets = [];
  for (let i = 0; i < count; i++) {
    const hex = crypto.randomBytes(20).toString('hex');
    wallets.push(`0x${hex}`);
  }
  return wallets;
}

// ---------------------------------------------------------------------------
// Data pools
// ---------------------------------------------------------------------------

const TOOLS = [
  'coin_data', 'web_search', 'sentiment_analysis', 'price_chart',
  'portfolio_analysis', 'news_feed', 'risk_assessment', 'whale_tracker',
  'defi_yield', 'nft_valuation', 'on_chain_analytics', 'social_trends',
  'technical_analysis', 'market_depth', 'gas_tracker', 'token_scanner',
];

const BILLING_DESCRIPTIONS = [
  'Tool call: coin_data', 'Tool call: web_search', 'Tool call: sentiment_analysis',
  'A2A billing: market analysis', 'A2A billing: portfolio review',
  'A2A billing: risk assessment', 'Tool call: price_chart',
  'A2A billing: defi yield scan', 'Tool call: whale_tracker',
  'A2A billing: nft valuation', 'Tool call: on_chain_analytics',
  'A2A billing: technical analysis', 'Tool call: social_trends',
  'Autonomous heartbeat call', 'A2A billing: token scanner',
  'Tool call: gas_tracker', 'A2A billing: market depth',
];

const ARENA_TOPICS = [
  'Will ETH surpass $10K by Q3 2026?',
  'Is DeFi lending safer than CeFi in 2026?',
  'Best L2 for institutional adoption: Arbitrum vs Base vs Optimism',
  'AI agents vs human traders: who generates better alpha?',
  'Will Bitcoin dominance stay above 50% this cycle?',
  'Restaking protocols: innovation or systemic risk?',
  'Cross-chain bridges: are they finally secure?',
  'NFT utility beyond art: real-world asset tokenization',
  'MEV protection: is it achievable on public chains?',
  'Stablecoin regulation impact on DeFi composability',
  'Zero-knowledge proofs: the next computing paradigm?',
  'DAO governance: token voting vs reputation-based models',
  'On-chain AI inference: hype or inevitable?',
  'GameFi 2.0: what went wrong and what comes next?',
  'Privacy chains in a regulatory world',
  'Modular blockchains vs monolithic: final verdict',
  'Agent-to-agent economies: the next frontier',
  'Prediction markets as information aggregators',
  'Real yield vs token emissions: sustainable DeFi',
  'Smart wallet adoption: will AA go mainstream?',
  'Solana vs Ethereum: developer experience in 2026',
  'Data availability layers: necessary or overhead?',
  'Decentralized social media: can it compete?',
  'Intent-based architectures: solving UX or adding complexity?',
  'LLM-powered trading bots: regulatory implications',
];

const DEBATE_TOPICS = [
  // crypto_price
  { topic: 'Bitcoin will reach $200K before end of 2026', category: 'crypto_price' },
  { topic: 'ETH/BTC ratio will recover above 0.06 this quarter', category: 'crypto_price' },
  { topic: 'SOL will flip BNB in market cap within 6 months', category: 'crypto_price' },
  { topic: 'Memecoins will outperform blue chips in Q2', category: 'crypto_price' },
  { topic: 'Altseason has already peaked for this cycle', category: 'crypto_price' },
  // defi
  { topic: 'Restaking will cause the next DeFi exploit cascade', category: 'defi' },
  { topic: 'DEX volume will permanently surpass CEX volume by 2027', category: 'defi' },
  { topic: 'RWA tokenization will be the biggest DeFi narrative', category: 'defi' },
  { topic: 'Lending protocol rates will normalize below 3% APY', category: 'defi' },
  { topic: 'Liquid staking derivatives are undervalued', category: 'defi' },
  // ai
  { topic: 'Autonomous AI agents will manage $1B+ in crypto assets', category: 'ai' },
  { topic: 'On-chain LLM inference will be commercially viable by 2027', category: 'ai' },
  { topic: 'AI-generated smart contracts will pass audits reliably', category: 'ai' },
  { topic: 'Agent-to-agent protocols will create a new economy layer', category: 'ai' },
  { topic: 'AI trading bots will be regulated like financial advisors', category: 'ai' },
  // governance
  { topic: 'Token-weighted voting should be replaced by quadratic voting', category: 'governance' },
  { topic: 'DAOs need professional management, not pure decentralization', category: 'governance' },
  { topic: 'Governance attacks will increase as DAO treasuries grow', category: 'governance' },
  { topic: 'On-chain governance can replace traditional corporate boards', category: 'governance' },
  // nft
  { topic: 'NFT market has bottomed and will recover significantly', category: 'nft' },
  { topic: 'Music NFTs will outperform art NFTs long term', category: 'nft' },
  { topic: 'Dynamic NFTs will be the dominant standard', category: 'nft' },
  // gaming
  { topic: 'AAA blockchain games will finally succeed in 2026', category: 'gaming' },
  { topic: 'Play-to-earn models are fundamentally unsustainable', category: 'gaming' },
  { topic: 'Gaming will drive more crypto adoption than DeFi', category: 'gaming' },
  // social
  { topic: 'Decentralized social media will capture 10% of Twitter users', category: 'social' },
  { topic: 'SocialFi tokens will have their moment this cycle', category: 'social' },
  { topic: 'Farcaster will become the dominant web3 social platform', category: 'social' },
  // general
  { topic: 'Crypto regulation clarity will be net positive for the industry', category: 'general' },
  { topic: 'The next bear market will be triggered by an AI black swan', category: 'general' },
  { topic: 'Multi-chain future is inevitable, maximalism is dead', category: 'general' },
  { topic: 'Privacy will become the most important blockchain feature', category: 'general' },
  { topic: 'Institutional adoption is overrated as a price driver', category: 'general' },
  { topic: 'Account abstraction will finally solve crypto UX', category: 'general' },
  { topic: 'The merge of AI and crypto will define the next decade', category: 'general' },
];

const POINT_REASONS = [
  { reason: 'daily_login', amount: 10 },
  { reason: 'agent_invoke', amount: 20 },
  { reason: 'arena_watch', amount: 15 },
  { reason: 'forecast_entry', amount: 25 },
  { reason: 'streak_3', amount: 30 },
  { reason: 'streak_7', amount: 100 },
  { reason: 'provider_called', amount: 15 },
  { reason: 'debate_vote', amount: 10 },
];

// ---------------------------------------------------------------------------
// Data generators
// ---------------------------------------------------------------------------

async function getAgentIds() {
  log('Loading agent IDs from external_agent table...');
  const rows = await sql`SELECT id FROM external_agent WHERE status IN ('active', 'verified') LIMIT 200`;
  const ids = rows.map(r => r.id);
  if (ids.length === 0) {
    throw new Error('No agents found in external_agent table. Seed agents first.');
  }
  log(`Found ${ids.length} agents`);
  return ids;
}

async function getExistingCount(table) {
  const rows = await sql`SELECT COUNT(*)::int as cnt FROM ${sql(table)}`;
  return rows[0]?.cnt || 0;
}

// ---------------------------------------------------------------------------
// Seeders
// ---------------------------------------------------------------------------

async function seedBillingRecords(agentIds, count = 220) {
  const existing = await getExistingCount('billing_record');
  if (existing >= 150) {
    log(`billing_record: already has ${existing} records, skipping`);
    return;
  }

  log(`Seeding ${count} billing_record entries...`);
  let inserted = 0;

  // Batch in groups of 20
  for (let batch = 0; batch < count; batch += 20) {
    const batchSize = Math.min(20, count - batch);
    const values = [];

    for (let i = 0; i < batchSize; i++) {
      const caller = pick(agentIds);
      let provider = pick(agentIds);
      while (provider === caller && agentIds.length > 1) provider = pick(agentIds);

      const toolsUsed = pickN(TOOLS, randInt(1, 3));
      const totalCost = randFloat(1, 50);
      const platformFee = parseFloat((totalCost * 0.15).toFixed(2));
      const providerEarning = parseFloat((totalCost * 0.85).toFixed(2));
      const ts = randomTimestamp(30);

      values.push({
        id: uuid(),
        caller,
        provider,
        toolsUsed: JSON.stringify(toolsUsed),
        totalCost,
        platformFee,
        providerEarning,
        ts: formatTs(ts),
      });
    }

    for (const v of values) {
      await sql`
        INSERT INTO billing_record (id, caller_agent_id, provider_agent_id, tools_used, total_cost, platform_fee, provider_earning, timestamp, status)
        VALUES (${v.id}, ${v.caller}, ${v.provider}, ${v.toolsUsed}::jsonb, ${v.totalCost}, ${v.platformFee}, ${v.providerEarning}, ${v.ts}::timestamp, 'completed')
      `;
    }

    inserted += batchSize;
    if (inserted % 50 === 0 || inserted === count) {
      log(`  billing_record: ${inserted}/${count}`);
    }
  }

  log(`billing_record: inserted ${inserted} records`);
}

async function seedWalletTransactions(agentIds, count = 320) {
  const existing = await getExistingCount('wallet_transaction');
  if (existing >= 200) {
    log(`wallet_transaction: already has ${existing} records, skipping`);
    return;
  }

  log(`Seeding ${count} wallet_transaction entries...`);
  let inserted = 0;

  const types = ['earning', 'spending', 'platform_fee', 'referral_bonus'];
  const typeWeights = [40, 35, 20, 5]; // percentage distribution

  // Track balances per agent for realistic balance_after values
  const balances = {};
  for (const id of agentIds) {
    balances[id] = randFloat(50, 500); // initial balance
  }

  // Generate all entries sorted by time (oldest first)
  const entries = [];
  for (let i = 0; i < count; i++) {
    entries.push({
      ts: randomTimestamp(30),
    });
  }
  entries.sort((a, b) => a.ts - b.ts);

  for (const entry of entries) {
    const agentId = pick(agentIds);

    // Pick type based on weights
    const roll = randInt(1, 100);
    let type;
    if (roll <= 40) type = 'earning';
    else if (roll <= 75) type = 'spending';
    else if (roll <= 95) type = 'platform_fee';
    else type = 'referral_bonus';

    let amount;
    let description;

    switch (type) {
      case 'earning':
        amount = randFloat(2, 40);
        description = pick([
          'Tool call: coin_data', 'Tool call: web_search', 'Tool call: sentiment_analysis',
          'A2A billing: market analysis', 'A2A billing: portfolio review',
          'Provider earning from agent call', 'A2A billing: risk assessment',
          'Tool call: whale_tracker', 'A2A billing: defi yield scan',
        ]);
        balances[agentId] = (balances[agentId] || 100) + amount;
        break;
      case 'spending':
        amount = -randFloat(1, 30);
        description = pick([
          'Agent invocation cost', 'Tool usage: web_search', 'A2A billing: analysis request',
          'Tool usage: price_chart', 'Agent call: sentiment check',
          'Tool usage: on_chain_analytics', 'A2A billing: nft valuation',
        ]);
        balances[agentId] = Math.max(0, (balances[agentId] || 100) + amount);
        break;
      case 'platform_fee':
        amount = -randFloat(0.5, 7);
        description = pick([
          'Platform fee: inter-agent billing', 'Platform fee: tool call',
          '15% platform commission', 'Platform fee: arena match',
        ]);
        balances[agentId] = Math.max(0, (balances[agentId] || 100) + amount);
        break;
      case 'referral_bonus':
        amount = randFloat(1, 10);
        description = pick([
          'Referral bonus: new agent signup', 'MLM referral tier 1 bonus',
          'Referral commission: agent activity', 'Referral bonus: downstream agent',
        ]);
        balances[agentId] = (balances[agentId] || 100) + amount;
        break;
    }

    const balanceAfter = parseFloat(balances[agentId].toFixed(2));
    const dbType = amount >= 0 ? 'credit' : 'debit';
    const absAmount = parseFloat(Math.abs(amount).toFixed(2));

    await sql`
      INSERT INTO wallet_transaction (id, agent_id, amount, type, reason, timestamp, balance_after)
      VALUES (${uuid()}, ${agentId}, ${absAmount}, ${dbType}, ${description}, ${formatTs(entry.ts)}::timestamp, ${balanceAfter})
    `;

    inserted++;
    if (inserted % 80 === 0 || inserted === count) {
      log(`  wallet_transaction: ${inserted}/${count}`);
    }
  }

  log(`wallet_transaction: inserted ${inserted} records`);
}

async function seedPointTransactions(wallets, count = 120) {
  const existing = await getExistingCount('point_transaction');
  if (existing >= 80) {
    log(`point_transaction: already has ${existing} records, skipping`);
    return;
  }

  log(`Seeding ${count} point_transaction entries...`);
  let inserted = 0;

  // Track totals per wallet for user_points
  const walletTotals = {};
  for (const w of wallets) walletTotals[w] = 0;

  for (let i = 0; i < count; i++) {
    const wallet = pick(wallets);
    const pointEntry = pick(POINT_REASONS);
    const ts = randomTimestamp(30);

    await sql`
      INSERT INTO point_transaction (id, wallet_address, amount, reason, season, created_at)
      VALUES (${uuid()}, ${wallet}, ${pointEntry.amount}, ${pointEntry.reason}, 1, ${formatTs(ts)}::timestamp)
    `;

    walletTotals[wallet] = (walletTotals[wallet] || 0) + pointEntry.amount;
    inserted++;
    if (inserted % 30 === 0 || inserted === count) {
      log(`  point_transaction: ${inserted}/${count}`);
    }
  }

  log(`point_transaction: inserted ${inserted} records`);
  return walletTotals;
}

async function seedUserPoints(wallets, walletTotals) {
  const existing = await getExistingCount('user_points');
  if (existing >= 10) {
    log(`user_points: already has ${existing} records, skipping`);
    return;
  }

  log(`Seeding ${wallets.length} user_points entries...`);

  for (const wallet of wallets) {
    // Add some base BP so totals look better
    const baseBp = randInt(100, 3000);
    const totalBp = (walletTotals[wallet] || 0) + baseBp;

    // Calculate level: Newbie(1)<500, Trader(2)<2000, Analyst(3)<10000, Strategist(4)<50000, Whale(5)<200000, OG(6)
    let level;
    if (totalBp < 500) level = 1;
    else if (totalBp < 2000) level = 2;
    else if (totalBp < 10000) level = 3;
    else if (totalBp < 50000) level = 4;
    else if (totalBp < 200000) level = 5;
    else level = 6;

    const streakDays = randInt(0, 15);
    const daysAgo = randInt(0, 5);
    const lastLogin = new Date(Date.now() - daysAgo * 86400000);
    const lastLoginDate = lastLogin.toISOString().slice(0, 10);

    await sql`
      INSERT INTO user_points (id, wallet_address, total_bp, level, streak_days, last_login_date, season, created_at)
      VALUES (${uuid()}, ${wallet}, ${totalBp}, ${level}, ${streakDays}, ${lastLoginDate}, 1, NOW())
      ON CONFLICT (wallet_address) DO NOTHING
    `;
  }

  log(`user_points: inserted ${wallets.length} records`);
}

async function seedArenaMatches(agentIds, count = 25) {
  const existing = await getExistingCount('arena_match');
  if (existing >= 15) {
    log(`arena_match: already has ${existing} records, skipping`);
    return;
  }

  log(`Seeding ${count} arena_match entries...`);

  for (let i = 0; i < count; i++) {
    const topic = pick(ARENA_TOPICS);
    const agentCount = randInt(2, 6);
    const agents = pickN(agentIds, agentCount);
    const status = pick(['completed', 'completed', 'completed', 'active', 'pending']); // 60% completed
    const totalVotes = status === 'completed' ? randInt(5, 50) : randInt(0, 10);
    const winnerId = status === 'completed' ? pick(agents) : null;
    const matchType = pick(['debate', 'search_race', 'research']);
    const prizePool = `${randInt(50, 500)} BBAI`;
    const eloChange = status === 'completed' ? randInt(5, 30) : null;
    const ts = randomTimestamp(14);
    const completedAt = status === 'completed' ? new Date(ts.getTime() + randInt(60, 600) * 1000) : null;

    // Build rounds for completed matches
    let rounds = null;
    if (status === 'completed') {
      rounds = agents.map(agentId => ({
        agentId,
        response: `Analysis of ${topic.slice(0, 30)}...`,
        toolsUsed: pickN(TOOLS, randInt(1, 3)),
        score: randInt(40, 100),
        timestamp: new Date(ts.getTime() + randInt(10, 300) * 1000).toISOString(),
      }));
    }

    await sql`
      INSERT INTO arena_match (id, topic, match_type, agents, winner_id, rounds, total_votes, prize_pool, elo_change, status, created_at, completed_at)
      VALUES (
        ${uuid()}, ${topic}, ${matchType}, ${JSON.stringify(agents)}::jsonb,
        ${winnerId}, ${rounds ? JSON.stringify(rounds) : null}::jsonb,
        ${totalVotes}, ${prizePool}, ${eloChange}, ${status},
        ${formatTs(ts)}::timestamp, ${completedAt ? formatTs(completedAt) : null}::timestamp
      )
    `;
  }

  log(`arena_match: inserted ${count} records`);
}

async function seedTopicDebates(agentIds, count = 32) {
  const existing = await getExistingCount('topic_debate');
  if (existing >= 20) {
    log(`topic_debate: already has ${existing} records, skipping`);
    return;
  }

  log(`Seeding ${count} topic_debate entries (adding to existing ${existing})...`);

  // Shuffle debate topics and pick enough
  const topics = [...DEBATE_TOPICS].sort(() => Math.random() - 0.5).slice(0, count);

  for (let i = 0; i < topics.length; i++) {
    const { topic, category } = topics[i];

    // Status distribution: 60% open, 30% completed, 10% settled
    const roll = Math.random();
    let status;
    if (roll < 0.6) status = 'open';
    else if (roll < 0.9) status = 'completed';
    else status = 'settled';

    const totalParticipants = randInt(2, 8);
    const totalPool = randInt(50, 500);
    const ts = randomTimestamp(21, false);
    const closesAt = new Date(ts.getTime() + randInt(3, 7) * 86400000);

    const topScore = status !== 'open' ? randInt(60, 100) : 0;
    const topAgentId = status !== 'open' ? pick(agentIds) : null;
    const resolvedOutcome = status === 'settled' ? pick(['yes', 'no']) : null;

    await sql`
      INSERT INTO topic_debate (id, topic, category, status, created_at, closes_at, total_participants, total_pool, top_score, top_agent_id, resolved_outcome)
      VALUES (
        ${uuid()}, ${topic}, ${category}, ${status},
        ${formatTs(ts)}::timestamp, ${formatTs(closesAt)}::timestamp,
        ${totalParticipants}, ${totalPool}, ${topScore}, ${topAgentId}, ${resolvedOutcome}
      )
    `;
  }

  log(`topic_debate: inserted ${topics.length} records`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('');
  log('=== BBAI Activity Data Seeder ===');
  log(`Database: ${DATABASE_URL.replace(/:[^@]+@/, ':***@').slice(0, 60)}...`);
  console.log('');

  try {
    // Verify DB connection
    const pingResult = await sql`SELECT 1 as ok`;
    if (!pingResult[0]?.ok) throw new Error('DB ping failed');
    log('Database connection OK');
  } catch (e) {
    console.error('Failed to connect to database:', e.message);
    process.exit(1);
  }

  // Load agent IDs
  const agentIds = await getAgentIds();

  // Generate fake wallets
  const wallets = generateWallets(18);
  log(`Generated ${wallets.length} fake wallet addresses`);
  console.log('');

  // Seed each table
  try {
    await seedBillingRecords(agentIds, 220);
    console.log('');

    await seedWalletTransactions(agentIds, 320);
    console.log('');

    const walletTotals = await seedPointTransactions(wallets, 120);
    console.log('');

    await seedUserPoints(wallets, walletTotals || {});
    console.log('');

    await seedArenaMatches(agentIds, 25);
    console.log('');

    await seedTopicDebates(agentIds, 32);
    console.log('');
  } catch (e) {
    console.error('');
    console.error(`[SEED] ERROR: ${e.message}`);
    console.error(e.stack);
    process.exit(1);
  }

  log('=== Seeding complete! ===');
  console.log('');
}

main().catch(e => {
  console.error('[SEED] Fatal:', e.message);
  process.exit(1);
});
