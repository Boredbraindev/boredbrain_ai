/**
 * GET /api/predict/feed — Returns recent forecast entries (live feed)
 * POST /api/predict/feed — Auto-generate forecast entries (called by heartbeat)
 */

import { NextRequest } from 'next/server';
import { serverEnv } from '@/env/server';
import { apiSuccess, apiError } from '@/lib/api-utils';

// ─── In-memory forecast feed (persists across requests in serverless) ─────

interface PredictBet {
  id: string;
  user: string;
  direction: 'UP' | 'DOWN';
  amount: number;
  asset: string;
  roundId: number;
  timestamp: number;
  isAgent: boolean;
}

const MAX_FEED_SIZE = 200;
let predictFeed: PredictBet[] = [];
let betIdCounter = Date.now();

const AGENT_TRADERS = [
  { name: 'DeFi Oracle', isAgent: true },
  { name: 'Alpha Hunter', isAgent: true },
  { name: 'Whale Tracker', isAgent: true },
  { name: 'Neural Trader', isAgent: true },
  { name: 'Momentum Bot', isAgent: true },
  { name: 'Sentiment AI', isAgent: true },
  { name: 'Quant Engine', isAgent: true },
  { name: 'Chain Prophet', isAgent: true },
  { name: 'Volatility Sage', isAgent: true },
  { name: 'On-Chain Scout', isAgent: true },
];

const USER_TRADERS = [
  '0xd4e...f2a1', '0x8b3...c4d7', '0x1f9...a6b2', '0xe7c...d3f8',
  '0x5a2...b9e4', '0x3c6...f1a5', '0x9d8...e7c3', '0x2b4...a8f6',
  '0x6e1...c5d9', '0xf3a...b2e7', '0x7c5...d4a1', '0x4d9...e6b3',
  '0xa1b...c8d3', '0x2e4...f5a7', '0xb3c...d6e9', '0x4f5...a2b8',
];

const ASSETS = ['BTC', 'ETH', 'SOL'];
const AGENT_AMOUNTS = [50, 100, 150, 200, 250, 300, 500];
const USER_AMOUNTS = [10, 25, 50, 75, 100, 150, 200];

function generateEntry(roundId?: number): PredictBet {
  const isAgent = Math.random() > 0.35;
  const trader = isAgent
    ? AGENT_TRADERS[Math.floor(Math.random() * AGENT_TRADERS.length)]
    : null;
  const amounts = isAgent ? AGENT_AMOUNTS : USER_AMOUNTS;

  betIdCounter++;
  return {
    id: `pbet-${betIdCounter}`,
    user: isAgent ? trader!.name : USER_TRADERS[Math.floor(Math.random() * USER_TRADERS.length)],
    direction: Math.random() > 0.45 ? 'UP' : 'DOWN',
    amount: amounts[Math.floor(Math.random() * amounts.length)],
    asset: ASSETS[Math.floor(Math.random() * ASSETS.length)],
    roundId: roundId ?? Math.floor(Date.now() / 300000), // 5min rounds
    timestamp: Date.now(),
    isAgent,
  };
}

// Seed initial feed
if (predictFeed.length === 0) {
  const now = Date.now();
  for (let i = 0; i < 30; i++) {
    const entry = generateEntry();
    entry.timestamp = now - (30 - i) * (Math.random() * 4000 + 2000);
    predictFeed.push(entry);
  }
  predictFeed.sort((a, b) => b.timestamp - a.timestamp);
}

// ─── GET: Return recent entries ──────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(100, parseInt(searchParams.get('limit') || '50', 10));
  const since = parseInt(searchParams.get('since') || '0', 10);

  const entries = since > 0
    ? predictFeed.filter(b => b.timestamp > since).slice(0, limit)
    : predictFeed.slice(0, limit);

  // Stats
  const upEntries = predictFeed.filter(b => b.direction === 'UP');
  const downEntries = predictFeed.filter(b => b.direction === 'DOWN');
  const upVolume = upEntries.reduce((s, b) => s + b.amount, 0);
  const downVolume = downEntries.reduce((s, b) => s + b.amount, 0);

  return apiSuccess({
    entries,
    stats: {
      totalEntries: predictFeed.length,
      upCount: upEntries.length,
      downCount: downEntries.length,
      upVolume,
      downVolume,
      totalVolume: upVolume + downVolume,
    },
  });
}

// ─── POST: Generate new entries (called by heartbeat) ────────────────────────

function verifyCron(request: NextRequest): boolean {
  const secret = serverEnv.CRON_SECRET;
  if (!secret) return true;
  if (request.headers.get('x-vercel-cron') === '1') return true;
  if (request.headers.get('upstash-signature')) return true;
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (token === secret) return true;
  }
  const { searchParams } = new URL(request.url);
  if (searchParams.get('secret') === secret) return true;
  return false;
}

export async function POST(request: NextRequest) {
  if (!verifyCron(request)) {
    return apiError('Unauthorized', 401);
  }

  let count = 5;
  try {
    const body = await request.json();
    if (body?.count) count = Math.min(20, Math.max(1, body.count));
  } catch {
    // default count
  }

  const roundId = Math.floor(Date.now() / 300000);
  const newEntries: PredictBet[] = [];

  for (let i = 0; i < count; i++) {
    const entry = generateEntry(roundId);
    // Stagger timestamps slightly
    entry.timestamp = Date.now() - i * (Math.random() * 500 + 100);
    newEntries.push(entry);
    predictFeed.unshift(entry);
  }

  // Trim feed
  if (predictFeed.length > MAX_FEED_SIZE) {
    predictFeed = predictFeed.slice(0, MAX_FEED_SIZE);
  }

  return apiSuccess({
    generated: newEntries.length,
    totalFeed: predictFeed.length,
    entries: newEntries,
  });
}
