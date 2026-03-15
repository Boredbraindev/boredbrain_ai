#!/usr/bin/env node

/**
 * Activity Runner — Autonomous BBAI Ecosystem Driver
 *
 * Runs ~20 agents through diverse ecosystem activities using Ollama (local LLM).
 * Zero API cost. Designed to run every 10 min via crontab on a dev server.
 *
 * Enhanced with direct DB writes for billing, wallet transactions, point awards,
 * and arena match creation via @neondatabase/serverless.
 *
 * Usage:
 *   DATABASE_URL=xxx CRON_SECRET=xxx node scripts/activity-runner.mjs
 *
 * Requires: Ollama running locally with llama3.2:3b pulled.
 */

import { neon } from '@neondatabase/serverless';

const OLLAMA_URL = 'http://localhost:11434/v1/chat/completions';
const OLLAMA_MODEL = 'llama3.2:3b';
const API_BASE = 'https://boredbrain.app';
const CRON_SECRET = process.env.CRON_SECRET || '';
const DATABASE_URL = process.env.DATABASE_URL || '';
const TIMEOUT_MS = 15_000;

// ---------------------------------------------------------------------------
// DB setup
// ---------------------------------------------------------------------------

let _sql = null;

function getSQL() {
  if (!_sql && DATABASE_URL) {
    _sql = neon(DATABASE_URL);
  }
  return _sql;
}

// ---------------------------------------------------------------------------
// Agent pools
// ---------------------------------------------------------------------------

// Agent IDs are fetched from the live API at startup
let ALL_AGENTS = [];

async function loadAgentIds() {
  try {
    const res = await fetchWithTimeout(
      `${API_BASE}/api/agents/discover?limit=50`,
      { method: 'GET', headers: authHeaders() },
    );
    if (res.ok) {
      const data = await res.json();
      const agents = data.agents || data.data?.agents || [];
      ALL_AGENTS = agents.map((a) => a.id).filter(Boolean);
    }
  } catch {}

  if (ALL_AGENTS.length === 0) {
    log('INIT', 'Could not load agent IDs from API — using discover endpoint for each activity');
  } else {
    log('INIT', `Loaded ${ALL_AGENTS.length} agent IDs from API`);
  }
}

const ARENA_TOPICS_SEED = [
  'DeFi yield optimization',
  'Layer 2 scaling solutions',
  'NFT market trends',
  'Cross-chain bridging security',
  'MEV protection strategies',
  'On-chain governance models',
  'Tokenomics design',
  'AI agent collaboration',
  'Prediction market accuracy',
  'Wallet security best practices',
];

// Simulated wallet addresses for point activities
const SIMULATED_WALLETS = [
  '0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
  '0x2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c',
  '0x3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d',
  '0x4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e',
  '0x5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f',
  '0x6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a',
  '0x7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b',
  '0x8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c',
];

const POINT_REASONS = [
  'daily_login',
  'forecast_entry',
  'arena_watch',
  'agent_invoke',
  'streak_bonus',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function ts() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function log(tag, msg) {
  console.log(`[${ts()}] [${tag}] ${msg}`);
}

function logErr(tag, msg) {
  console.error(`[${ts()}] [${tag}] ERROR: ${msg}`);
}

function authHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (CRON_SECRET) {
    headers['Authorization'] = `Bearer ${CRON_SECRET}`;
  } else {
    headers['x-vercel-cron'] = '1';
  }
  return headers;
}

function generateId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 16; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

async function fetchWithTimeout(url, opts = {}, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Ollama helper — ask local LLM for creative content
// ---------------------------------------------------------------------------

async function askOllama(prompt) {
  try {
    const res = await fetchWithTimeout(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You are a creative assistant for a Web3 AI agent ecosystem called BoredBrain. Keep answers short (1-2 sentences max). No markdown.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 80,
        temperature: 0.9,
      }),
    }, 10_000);

    if (!res.ok) {
      throw new Error(`Ollama ${res.status}`);
    }
    const data = await res.json();
    return (data.choices?.[0]?.message?.content || '').trim();
  } catch (err) {
    // Fallback: return a pre-made string so the runner never blocks on Ollama
    return null;
  }
}

// ---------------------------------------------------------------------------
// Activity executors (original — API-based)
// ---------------------------------------------------------------------------

async function activityAgentInvoke() {
  if (ALL_AGENTS.length < 2) {
    log('INVOKE', 'Skipped — not enough agent IDs loaded');
    return;
  }
  const caller = pick(ALL_AGENTS);
  let target = pick(ALL_AGENTS);
  while (target === caller) target = pick(ALL_AGENTS);

  // Generate query via Ollama
  const seedTopic = pick(ARENA_TOPICS_SEED);
  let query = await askOllama(
    `Write a short question one AI agent would ask another about: ${seedTopic}`,
  );
  if (!query) {
    query = `Analyze the current state of ${seedTopic} and provide actionable insights for BBAI holders.`;
  }

  const res = await fetchWithTimeout(`${API_BASE}/api/network/invoke`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      callerNodeId: caller,
      targetNodeId: target,
      query,
      maxBudget: 50,
    }),
  });

  const data = await res.json();
  if (data.success) {
    log('INVOKE', `${caller} -> ${target} | cost: ${data.result?.cost ?? '?'} BBAI`);
  } else {
    log('INVOKE', `${caller} -> ${target} | ${data.error || res.status}`);
  }
  return data;
}

async function activityArenaBattle() {
  const [challenger, defender] = pickN(ALL_AGENTS, 2);

  let topic = await askOllama(
    `Suggest a debate topic for two AI agents competing in a crypto arena. One sentence.`,
  );
  if (!topic) {
    topic = pick(ARENA_TOPICS_SEED);
  }

  // Step 1: create the match
  const createRes = await fetchWithTimeout(`${API_BASE}/api/arena`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      topic,
      matchType: pick(['debate', 'search_race', 'research']),
      prizePool: `${Math.floor(Math.random() * 400 + 100)} BBAI`,
    }),
  });

  const createData = await createRes.json();
  const matchId = createData.match?.id || createData.id;

  if (matchId) {
    // Step 2: start battle
    const battleRes = await fetchWithTimeout(`${API_BASE}/api/arena/battle`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        matchId,
        topic,
        agentIds: [challenger, defender],
      }),
    });
    const battleData = await battleRes.json();
    log('ARENA', `${challenger} vs ${defender} | match: ${matchId} | topic: "${topic.slice(0, 60)}"`);
    return battleData;
  } else {
    log('ARENA', `Match creation returned: ${JSON.stringify(createData).slice(0, 120)}`);
    return createData;
  }
}

async function activityPredictFeed() {
  const count = Math.floor(Math.random() * 6) + 3; // 3-8

  const res = await fetchWithTimeout(`${API_BASE}/api/predict/feed`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ count }),
  });

  const data = await res.json();
  log('PREDICT', `Generated ${data.generated ?? count} prediction bets`);
  return data;
}

async function activityHeartbeat() {
  const res = await fetchWithTimeout(`${API_BASE}/api/agents/heartbeat`, {
    method: 'GET',
    headers: authHeaders(),
  });

  const data = await res.json();
  log(
    'HEARTBEAT',
    `scenarios: ${data.scenariosRun ?? '?'} | billed: ${data.totalBilled ?? '?'} BBAI | rebalanced: ${data.rebalanced ?? '?'}`,
  );
  return data;
}

async function activityDiscover() {
  const specializations = ['defi', 'trading', 'research', 'security', 'nft', 'analytics'];
  const spec = pick(specializations);

  const res = await fetchWithTimeout(
    `${API_BASE}/api/agents/discover?specialization=${spec}&limit=10`,
    { method: 'GET', headers: authHeaders() },
  );

  const data = await res.json();
  log('DISCOVER', `specialization=${spec} | found ${data.totalAgents ?? data.returned ?? '?'} agents`);
  return data;
}

// ---------------------------------------------------------------------------
// New activity executors (direct DB writes via @neondatabase/serverless)
// ---------------------------------------------------------------------------

async function activityBilling() {
  const db = getSQL();
  if (!db) {
    log('BILLING', 'Skipped — no DATABASE_URL');
    return;
  }
  if (ALL_AGENTS.length < 2) {
    log('BILLING', 'Skipped — not enough agents');
    return;
  }

  const caller = pick(ALL_AGENTS);
  let provider = pick(ALL_AGENTS);
  while (provider === caller) provider = pick(ALL_AGENTS);

  const totalCost = parseFloat((Math.random() * 29 + 1).toFixed(2)); // 1-30 BBAI
  const platformFee = parseFloat((totalCost * 0.15).toFixed(2));
  const providerEarning = parseFloat((totalCost - platformFee).toFixed(2));
  const toolsUsed = pickN(
    ['web_search', 'coin_data', 'code_interpreter', 'text_translate', 'weather', 'retrieve'],
    Math.floor(Math.random() * 3) + 1,
  );
  const id = generateId();

  await db`INSERT INTO billing_record (id, caller_agent_id, provider_agent_id, tools_used, total_cost, platform_fee, provider_earning, status)
           VALUES (${id}, ${caller}, ${provider}, ${JSON.stringify(toolsUsed)}, ${totalCost}, ${platformFee}, ${providerEarning}, 'completed')`;

  log('BILLING', `${caller} -> ${provider} | cost: ${totalCost} BBAI | fee: ${platformFee} | earned: ${providerEarning}`);
}

async function activityWalletTx() {
  const db = getSQL();
  if (!db) {
    log('WALLET_TX', 'Skipped — no DATABASE_URL');
    return;
  }
  if (ALL_AGENTS.length === 0) {
    log('WALLET_TX', 'Skipped — no agents');
    return;
  }

  const agentId = pick(ALL_AGENTS);
  const isCredit = Math.random() > 0.4; // 60% credit, 40% debit
  const amount = parseFloat((Math.random() * 25 + 1).toFixed(2));
  const type = isCredit ? 'credit' : 'debit';
  const reasons = isCredit
    ? ['provider_earning', 'arena_win', 'referral_bonus', 'rebalance_topup']
    : ['invoke_cost', 'arena_entry', 'skill_purchase', 'platform_fee'];
  const reason = pick(reasons);
  const balanceAfter = parseFloat((Math.random() * 500 + 50).toFixed(2));
  const id = generateId();

  await db`INSERT INTO wallet_transaction (id, agent_id, amount, type, reason, balance_after)
           VALUES (${id}, ${agentId}, ${amount}, ${type}, ${reason}, ${balanceAfter})`;

  log('WALLET_TX', `${agentId} | ${type} ${amount} BBAI | reason: ${reason} | balance: ${balanceAfter}`);
}

async function activityUserPoints() {
  const db = getSQL();
  if (!db) {
    log('USER_PTS', 'Skipped — no DATABASE_URL');
    return;
  }

  const wallet = pick(SIMULATED_WALLETS);
  const reason = pick(POINT_REASONS);

  // Amount based on reason
  let amount;
  switch (reason) {
    case 'daily_login': amount = 10; break;
    case 'forecast_entry': amount = 25; break;
    case 'arena_watch': amount = 15; break;
    case 'agent_invoke': amount = 15; break;
    case 'streak_bonus': amount = Math.random() > 0.5 ? 100 : 30; break;
    default: amount = 10;
  }

  // Ensure user_points row exists (upsert)
  await db`INSERT INTO user_points (wallet_address, total_bp, level, streak_days, season)
           VALUES (${wallet}, ${amount}, 1, 0, 1)
           ON CONFLICT (wallet_address)
           DO UPDATE SET total_bp = user_points.total_bp + ${amount}`;

  // Insert point transaction
  await db`INSERT INTO point_transaction (wallet_address, amount, reason, season)
           VALUES (${wallet}, ${amount}, ${reason}, 1)`;

  log('USER_PTS', `${wallet.slice(0, 10)}... | +${amount} BP | reason: ${reason}`);
}

async function activityArenaCreate() {
  const db = getSQL();
  if (!db) {
    log('ARENA_DB', 'Skipped — no DATABASE_URL');
    return;
  }
  if (ALL_AGENTS.length < 2) {
    log('ARENA_DB', 'Skipped — not enough agents');
    return;
  }

  const [agent1, agent2] = pickN(ALL_AGENTS, 2);
  let topic = await askOllama(
    'Suggest a short debate topic for two AI agents about crypto or DeFi. One sentence.',
  );
  if (!topic) {
    topic = pick(ARENA_TOPICS_SEED);
  }

  const matchType = pick(['debate', 'search_race', 'research']);
  const prizePool = (Math.floor(Math.random() * 400) + 100).toString();
  const id = generateId();

  await db`INSERT INTO arena_match (id, topic, match_type, agents, prize_pool, status)
           VALUES (${id}, ${topic}, ${matchType}, ${JSON.stringify([agent1, agent2])}, ${prizePool}, 'pending')`;

  log('ARENA_DB', `Created match ${id} | ${agent1} vs ${agent2} | ${matchType} | pool: ${prizePool} BBAI`);
  log('ARENA_DB', `Topic: "${topic.slice(0, 80)}"`);
}

// ---------------------------------------------------------------------------
// Activity registry
// ---------------------------------------------------------------------------

const ACTIVITIES = [
  { name: 'agent-invoke', fn: activityAgentInvoke, weight: 5 },
  { name: 'arena-battle', fn: activityArenaBattle, weight: 2 },
  { name: 'predict-feed', fn: activityPredictFeed, weight: 3 },
  { name: 'heartbeat', fn: activityHeartbeat, weight: 1 },
  { name: 'discover', fn: activityDiscover, weight: 2 },
  // New DB-direct activities
  { name: 'billing', fn: activityBilling, weight: 4 },
  { name: 'wallet-tx', fn: activityWalletTx, weight: 3 },
  { name: 'user-points', fn: activityUserPoints, weight: 3 },
  { name: 'arena-create', fn: activityArenaCreate, weight: 2 },
];

function pickWeightedActivities(count) {
  // Build weighted pool
  const pool = [];
  for (const act of ACTIVITIES) {
    for (let i = 0; i < act.weight; i++) pool.push(act);
  }
  // Pick unique activities up to count
  const selected = new Map();
  while (selected.size < count && selected.size < ACTIVITIES.length) {
    const act = pick(pool);
    selected.set(act.name, act);
  }
  // Fill remaining slots with duplicates (weighted agent invokes)
  const result = [...selected.values()];
  while (result.length < count) {
    result.push(pick(pool));
  }
  return result;
}

// ---------------------------------------------------------------------------
// Main runner
// ---------------------------------------------------------------------------

async function main() {
  const startTime = Date.now();
  log('RUNNER', '=== Activity Runner starting ===');
  log('RUNNER', `API: ${API_BASE} | Ollama: ${OLLAMA_URL} | Model: ${OLLAMA_MODEL}`);
  log('RUNNER', `Auth: ${CRON_SECRET ? 'Bearer token' : 'x-vercel-cron fallback'}`);
  log('RUNNER', `DB: ${DATABASE_URL ? 'connected' : 'not configured (DB activities will be skipped)'}`);

  // Load real agent IDs from the API
  await loadAgentIds();

  // Check Ollama availability
  let ollamaOk = false;
  try {
    const check = await fetchWithTimeout('http://localhost:11434/api/tags', {}, 3000);
    ollamaOk = check.ok;
  } catch {}
  log('RUNNER', `Ollama: ${ollamaOk ? 'online' : 'offline (will use fallback queries)'}`);

  // Pick 4-7 activities per run (increased from 3-5 to cover new activity types)
  const activityCount = Math.floor(Math.random() * 4) + 4;
  const activities = pickWeightedActivities(activityCount);

  log('RUNNER', `Running ${activities.length} activities: ${activities.map((a) => a.name).join(', ')}`);

  let successes = 0;
  let failures = 0;

  for (const activity of activities) {
    // Guard: abort if we're approaching 60s
    if (Date.now() - startTime > 50_000) {
      log('RUNNER', 'Approaching 60s limit, stopping early.');
      break;
    }

    try {
      await activity.fn();
      successes++;
    } catch (err) {
      failures++;
      logErr(activity.name, err.message || String(err));
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log('RUNNER', `=== Done in ${elapsed}s | ${successes} ok, ${failures} failed ===`);
}

main().catch((err) => {
  logErr('FATAL', err.message || String(err));
  process.exit(1);
});
