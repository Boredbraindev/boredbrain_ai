export const runtime = 'edge';

import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

// Static skill definitions (previously from lib/openclaw)
const BOREDBRAIN_SKILLS = [
  {
    id: 'web_search',
    name: 'Web Search',
    description: 'Real-time web search across multiple engines with structured results, snippets, and metadata extraction.',
    version: '1.2.0',
    author: 'boredbrain',
    protocol: 'openclaw-v1',
    category: 'search',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query string' },
        limit: { type: 'number', description: 'Max results (default 10)' },
      },
      required: ['query'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        results: { type: 'array', description: 'Array of search result objects' },
        totalResults: { type: 'number', description: 'Total matches found' },
      },
      required: ['results'],
    },
  },
  {
    id: 'crypto_data',
    name: 'Crypto Data',
    description: 'Real-time cryptocurrency prices, OHLC charts, volume, and historical data for 10,000+ tokens.',
    version: '2.0.1',
    author: 'boredbrain',
    protocol: 'openclaw-v1',
    category: 'finance',
    inputSchema: {
      type: 'object',
      properties: {
        coin: { type: 'string', description: 'Coin ID or symbol (e.g. bitcoin, ETH)' },
        currency: { type: 'string', description: 'Quote currency (default USD)' },
      },
      required: ['coin'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        price: { type: 'number', description: 'Current price' },
        marketCap: { type: 'number', description: 'Market capitalisation' },
        change24h: { type: 'number', description: '24h price change percentage' },
      },
      required: ['price'],
    },
  },
  {
    id: 'wallet_analyzer',
    name: 'Wallet Analyzer',
    description: 'Deep on-chain wallet analysis including holdings, transaction history, PnL tracking, and whale behaviour detection.',
    version: '1.8.0',
    author: 'boredbrain',
    protocol: 'openclaw-v1',
    category: 'blockchain',
    inputSchema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'Wallet address (0x...) or ENS name' },
        chain: { type: 'string', description: 'Chain: ethereum, polygon, arbitrum' },
      },
      required: ['address'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        balance: { type: 'number', description: 'Total wallet value in USD' },
        tokens: { type: 'array', description: 'Token holdings breakdown' },
        riskScore: { type: 'number', description: 'Risk score 0-100' },
      },
      required: ['balance', 'tokens'],
    },
  },
  {
    id: 'agent_arena',
    name: 'Agent Arena',
    description: 'Create and monitor AI agent competition matches. Pit agents against each other in research, analysis, and advising tasks.',
    version: '2.1.0',
    author: 'boredbrain',
    protocol: 'openclaw-v1',
    category: 'agents',
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Research topic or challenge' },
        agents: { type: 'string', description: 'Comma-separated agent IDs' },
        matchType: { type: 'string', description: 'Type: research, analysis, advising' },
      },
      required: ['topic', 'agents'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        matchId: { type: 'string', description: 'Unique match identifier' },
        status: { type: 'string', description: 'Match status' },
        results: { type: 'array', description: 'Agent results and scores' },
      },
      required: ['matchId', 'status'],
    },
  },
  {
    id: 'sentiment_analysis',
    name: 'Sentiment Analysis',
    description: 'Multi-source sentiment analysis across X/Twitter, Reddit, and news. Tracks trending topics and community signals.',
    version: '1.5.0',
    author: 'boredbrain',
    protocol: 'openclaw-v1',
    category: 'social',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Topic or token to analyse sentiment for' },
        sources: { type: 'string', description: 'Comma-separated: twitter, reddit, news' },
      },
      required: ['query'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        score: { type: 'number', description: 'Sentiment score -1 to 1' },
        breakdown: { type: 'object', description: 'Per-source sentiment breakdown' },
        trending: { type: 'boolean', description: 'Whether topic is trending' },
      },
      required: ['score'],
    },
  },
  {
    id: 'code_audit',
    name: 'Code Audit',
    description: 'Automated smart contract and codebase security auditing. Detects vulnerabilities, gas optimisation issues, and best-practice violations.',
    version: '1.0.3',
    author: 'boredbrain',
    protocol: 'openclaw-v1',
    category: 'security',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Source code or contract address to audit' },
        language: { type: 'string', description: 'Language: solidity, rust, typescript' },
      },
      required: ['code'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        vulnerabilities: { type: 'array', description: 'List of found vulnerabilities' },
        severity: { type: 'string', description: 'Overall severity: low, medium, high, critical' },
        gasOptimisations: { type: 'array', description: 'Gas optimisation suggestions' },
      },
      required: ['vulnerabilities', 'severity'],
    },
  },
  {
    id: 'nft_metadata',
    name: 'NFT Metadata',
    description: 'Fetch and analyse NFT collection metadata, floor prices, rarity scores, and ownership distribution across chains.',
    version: '1.3.0',
    author: 'boredbrain',
    protocol: 'openclaw-v1',
    category: 'blockchain',
    inputSchema: {
      type: 'object',
      properties: {
        collection: { type: 'string', description: 'Collection address or slug' },
        tokenId: { type: 'string', description: 'Specific token ID (optional)' },
        chain: { type: 'string', description: 'Chain: ethereum, polygon, solana' },
      },
      required: ['collection'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Collection or token name' },
        floorPrice: { type: 'number', description: 'Current floor price in ETH' },
        rarityScore: { type: 'number', description: 'Rarity ranking score' },
        traits: { type: 'array', description: 'Token trait list' },
      },
      required: ['name'],
    },
  },
  {
    id: 'defi_yield',
    name: 'DeFi Yield',
    description: 'Aggregate DeFi yield farming opportunities across protocols. Compares APY, TVL, risk metrics, and impermanent loss estimates.',
    version: '1.1.0',
    author: 'boredbrain',
    protocol: 'openclaw-v1',
    category: 'defi',
    inputSchema: {
      type: 'object',
      properties: {
        protocol: { type: 'string', description: 'Protocol name or "all" for aggregation' },
        chain: { type: 'string', description: 'Chain filter: ethereum, arbitrum, all' },
        minTvl: { type: 'number', description: 'Minimum TVL in USD' },
      },
      required: ['protocol'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        pools: { type: 'array', description: 'Matching yield pools' },
        bestApy: { type: 'number', description: 'Highest APY found' },
        totalTvl: { type: 'number', description: 'Total TVL across results' },
      },
      required: ['pools'],
    },
  },
];

// GET /api/openclaw — Returns the full OpenClaw skill manifest + fleet stats from DB
export async function GET() {
  try {
    const dbUrl = process.env.DATABASE_URL;
    let fleetAgents: Array<{
      id: string;
      name: string;
      description: string;
      specialization: string;
      status: string;
      created_at: string;
      total_calls: number;
      rating: number;
    }> = [];

    if (dbUrl) {
      try {
        const sql = neon(dbUrl);
        const rows = await sql`
          SELECT id, name, description, specialization, status,
                 registered_at as created_at, total_calls, rating, elo_rating
          FROM external_agent
          WHERE owner_address = 'platform-fleet'
          ORDER BY total_calls DESC
          LIMIT 200
        `;
        fleetAgents = rows as typeof fleetAgents;
      } catch (dbErr) {
        console.error('[openclaw] DB error:', dbErr);
      }
    }

    const totalCalls = fleetAgents.reduce((sum, a) => sum + (Number(a.total_calls) || 0), 0);
    const totalEarnings = fleetAgents.reduce((sum, a) => sum + (Number(a.total_calls) || 0), 0);
    const avgRating =
      fleetAgents.length > 0
        ? Number(
            (
              fleetAgents.reduce((sum, a) => sum + (Number(a.rating) || 0), 0) /
              fleetAgents.length
            ).toFixed(1),
          )
        : 0;

    return NextResponse.json({
      success: true,
      manifest: {
        protocol: 'openclaw-v1',
        version: '2.1.0',
        package: '@boredbrain/mcp-skills',
        author: 'boredbrain',
        totalSkills: BOREDBRAIN_SKILLS.length,
        skills: BOREDBRAIN_SKILLS,
        registeredAt: '2025-11-15T00:00:00Z',
      },
      fleet: {
        total: fleetAgents.length,
        totalCalls,
        totalEarnings,
        avgRating,
        agents: fleetAgents.map((a) => ({
          id: a.id,
          name: a.name,
          description: a.description,
          specialization: a.specialization,
          status: a.status,
          eloRating: Number((a as any).elo_rating) || 1200,
          createdAt: a.created_at,
          totalCalls: Number(a.total_calls) || 0,
          totalEarnings: Number(a.total_calls) || 0,
          rating: Number(a.rating) || 0,
        })),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
