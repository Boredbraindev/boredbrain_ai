export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, parseJsonBody, validateBody } from '@/lib/api-utils';
import { neon } from '@neondatabase/serverless';
import { MARKET_CATEGORIES } from '@/lib/betting/market-templates';

// ─── Mock Markets (fallback when DB unavailable) ────────────────────

const MOCK_MARKETS = [
  {
    id: 'mock-market-1',
    title: 'BTC above $100k by end of week?',
    description: 'Will Bitcoin close above $100,000 by the end of this week?',
    category: 'crypto_price',
    outcomes: ['Yes', 'No'],
    resolvedOutcome: null,
    status: 'open',
    creatorAddress: 'platform',
    creatorType: 'platform',
    totalVolume: 45200,
    totalOrders: 128,
    resolvesAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    resolvedAt: null,
    tags: ['btc', 'price'],
    metadata: { priceTarget: 100000 },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'mock-market-2',
    title: 'Top agent by calls this week: DeFi Oracle or Alpha Hunter?',
    description: 'Which agent will have the most invocations this week?',
    category: 'agent_performance',
    outcomes: ['DeFi Oracle', 'Alpha Hunter'],
    resolvedOutcome: null,
    status: 'open',
    creatorAddress: 'platform',
    creatorType: 'platform',
    totalVolume: 12800,
    totalOrders: 64,
    resolvesAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
    resolvedAt: null,
    tags: ['agents', 'performance'],
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'mock-market-3',
    title: 'ETH above $5,000 by end of month?',
    description: 'Will Ethereum close above $5,000 USD by month end?',
    category: 'crypto_price',
    outcomes: ['Yes', 'No'],
    resolvedOutcome: null,
    status: 'open',
    creatorAddress: 'platform',
    creatorType: 'platform',
    totalVolume: 89500,
    totalOrders: 312,
    resolvesAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
    resolvedAt: null,
    tags: ['eth', 'price'],
    metadata: { priceTarget: 5000 },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'mock-market-4',
    title: 'Arena battles completed this week: over 50?',
    description: 'Will there be more than 50 Arena battles completed this week?',
    category: 'ecosystem',
    outcomes: ['Yes', 'No'],
    resolvedOutcome: null,
    status: 'open',
    creatorAddress: 'platform',
    creatorType: 'platform',
    totalVolume: 6400,
    totalOrders: 45,
    resolvesAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
    resolvedAt: null,
    tags: ['arena', 'ecosystem'],
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'mock-market-5',
    title: 'Total DeFi TVL above $200B by month end?',
    description: 'Will Total Value Locked in DeFi exceed $200 billion by end of month?',
    category: 'defi',
    outcomes: ['Yes', 'No'],
    resolvedOutcome: null,
    status: 'open',
    creatorAddress: 'platform',
    creatorType: 'platform',
    totalVolume: 34100,
    totalOrders: 198,
    resolvesAt: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000),
    resolvedAt: null,
    tags: ['defi', 'tvl'],
    metadata: { tvlTarget: 200 },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// ─── GET /api/markets ───────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const status = searchParams.get('status') || 'open';
    const limit = Math.min(Number(searchParams.get('limit') || 50), 200);
    const offset = Number(searchParams.get('offset') || 0);

    // Try DB first with 3s timeout
    try {
      const sql = neon(process.env.DATABASE_URL!);

      let dbPromise;
      if (status !== 'all') {
        dbPromise = sql`
          SELECT * FROM betting_market
          WHERE status = ${status}
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
      } else {
        dbPromise = sql`
          SELECT * FROM betting_market
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
      }

      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 3000),
      );

      let markets = await Promise.race([dbPromise, timeout]);

      // Filter by category in-memory
      if (category) {
        markets = markets.filter((m: any) => m.category === category);
      }

      return apiSuccess({
        markets,
        total: markets.length,
        categories: Object.keys(MARKET_CATEGORIES),
      });
    } catch {
      // Fallback to mock data
      let filtered = MOCK_MARKETS;
      if (category) filtered = filtered.filter((m) => m.category === category);
      if (status !== 'all') filtered = filtered.filter((m) => m.status === status);
      filtered = filtered.slice(offset, offset + limit);

      return apiSuccess({
        markets: filtered,
        total: filtered.length,
        categories: Object.keys(MARKET_CATEGORIES),
        _source: 'mock',
      });
    }
  } catch (err: any) {
    return apiError(err.message || 'Failed to fetch markets', 500);
  }
}

// ─── POST /api/markets ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseJsonBody(request);
    if ('error' in parsed) return parsed.error;

    const { valid, errors, sanitized } = validateBody(
      parsed.data as Record<string, unknown>,
      {
        title: { type: 'string', required: true, maxLength: 200 },
        description: { type: 'string', maxLength: 1000 },
        category: {
          type: 'string',
          required: true,
          enum: Object.keys(MARKET_CATEGORIES),
        },
        outcomes: { type: 'array', required: true },
        creatorAddress: { type: 'string', required: true },
      },
    );

    if (!valid) return apiError(errors.join(', '));

    const body = sanitized as {
      title: string;
      description?: string;
      category: string;
      outcomes: string[];
      creatorAddress: string;
      creatorType?: string;
      resolvesAt?: string;
      tags?: string[];
      metadata?: Record<string, unknown>;
    };

    if (!Array.isArray(body.outcomes) || body.outcomes.length < 2) {
      return apiError('At least 2 outcomes are required');
    }

    const resolvesAt = body.resolvesAt
      ? new Date(body.resolvesAt)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    try {
      const sql = neon(process.env.DATABASE_URL!);
      const creatorType = (body.creatorType as string) || 'user';
      const tags = JSON.stringify(body.tags || []);
      const metadata = JSON.stringify(body.metadata || {});
      const outcomes = JSON.stringify(body.outcomes);

      const [market] = await sql`
        INSERT INTO betting_market (title, description, category, outcomes, creator_address, creator_type, resolves_at, tags, metadata)
        VALUES (${body.title}, ${body.description || null}, ${body.category}, ${outcomes}::jsonb, ${body.creatorAddress}, ${creatorType}, ${resolvesAt.toISOString()}::timestamptz, ${tags}::jsonb, ${metadata}::jsonb)
        RETURNING *
      `;

      return apiSuccess({ market }, 201);
    } catch {
      // Fallback: return a mock-created market
      const mockMarket = {
        id: `mock-${Date.now()}`,
        title: body.title,
        description: body.description || null,
        category: body.category,
        outcomes: body.outcomes,
        resolvedOutcome: null,
        status: 'open',
        creatorAddress: body.creatorAddress,
        creatorType: body.creatorType || 'user',
        totalVolume: 0,
        totalOrders: 0,
        resolvesAt,
        resolvedAt: null,
        tags: body.tags || [],
        metadata: body.metadata || {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return apiSuccess({ market: mockMarket, _source: 'mock' }, 201);
    }
  } catch (err: any) {
    return apiError(err.message || 'Failed to create market', 500);
  }
}
