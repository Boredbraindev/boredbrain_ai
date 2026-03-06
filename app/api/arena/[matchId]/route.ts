import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { arenaMatch, agent } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { getTool } from '@/lib/agent-api/tool-registry';
import { MOCK_ARENA_MATCHES, MOCK_AGENTS } from '@/lib/mock-data';
import { dynamicMatchStore } from '@/lib/arena-store';

/**
 * GET /api/arena/[matchId] - Get match details
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params;

  // Try database first
  try {
    const [match] = await Promise.race([
      db.select().from(arenaMatch).where(eq(arenaMatch.id, matchId)).limit(1),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
    ]);

    if (match) {
      return NextResponse.json({ match });
    }
  } catch {
    // DB failed or timed out — fall through to mock data
  }

  // Fallback to mock data (static + dynamic)
  const mockMatch =
    MOCK_ARENA_MATCHES.find((m) => m.id === matchId) ??
    dynamicMatchStore.get(matchId);
  if (mockMatch) {
    return NextResponse.json({ match: mockMatch });
  }

  return NextResponse.json({ error: 'Match not found' }, { status: 404 });
}

// ---------------------------------------------------------------------------
// Mock execution helpers
// ---------------------------------------------------------------------------

/** Random delay between min and max milliseconds */
function randomDelay(min = 200, max = 800): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Generate a mock tool result snippet based on the tool name and topic */
function generateMockToolResult(toolName: string, topic: string): string {
  const snippets: Record<string, (t: string) => string> = {
    web_search: (t) =>
      `[Web Search] Found 12 relevant results for "${t}". Top sources include industry reports, recent news articles, and expert analyses from leading publications.`,
    x_search: (t) =>
      `[X/Twitter] Trending discussion around "${t}" with 2.4K posts in the last 24h. Key voices include industry leaders and analysts sharing divergent perspectives.`,
    coin_data: (t) =>
      `[Coin Data] Current market data retrieved. BTC $67,450 (+2.3%), ETH $3,820 (+1.8%). Correlation analysis with "${t}" shows moderate positive signal.`,
    coin_ohlc: (t) =>
      `[OHLC Data] 30-day candlestick data retrieved. Identified bullish reversal pattern relevant to "${t}" thesis.`,
    wallet_analyzer: (t) =>
      `[Wallet Analysis] Scanned top 50 wallets. Net inflow of $14.2M in past 7 days. Activity patterns suggest institutional interest in "${t}".`,
    stock_chart: (t) =>
      `[Stock Chart] Retrieved OHLC data for major indices. S&P 500 up 0.8%, NASDAQ up 1.2%. Macro trend supports "${t}" outlook.`,
    academic_search: (t) =>
      `[Academic] Found 8 peer-reviewed papers on "${t}". Most cited: "Comprehensive Analysis of ${t}" (2025, 142 citations).`,
    reddit_search: (t) =>
      `[Reddit] r/technology and related subs show 340 posts discussing "${t}" this week. Sentiment: 62% positive, 28% neutral, 10% negative.`,
    youtube_search: (t) =>
      `[YouTube] Top videos on "${t}": 3 expert analyses (avg 45K views), 2 tutorials, 1 debate with 120K views.`,
    code_interpreter: (t) =>
      `[Code] Executed analysis script. Statistical model shows 78% confidence for hypothesis related to "${t}". Key factors: data quality, sample size, methodology.`,
    retrieve: (t) =>
      `[Retrieve] Extracted 2,400 words of relevant content about "${t}" from authoritative source. Key findings synthesized.`,
    text_translate: (t) =>
      `[Translate] Cross-referenced "${t}" across 5 languages. Found additional context in non-English sources expanding the analysis.`,
    currency_converter: () =>
      `[Currency] Real-time rates: USD/EUR 0.92, USD/GBP 0.79, USD/JPY 154.3. Cross-border financial impact assessed.`,
    token_retrieval: (t) =>
      `[Token Data] Retrieved on-chain metrics for tokens related to "${t}". Top movers: +15.4%, +8.2%, -3.1% in 24h.`,
    nft_retrieval: (t) =>
      `[NFT Data] NFT market activity related to "${t}": floor price trends, volume analysis, and whale holdings identified.`,
    movie_or_tv_search: (t) =>
      `[Movies/TV] Found 6 titles related to "${t}". Top rated: 8.4/10 with 12K reviews.`,
    trending_movies: () =>
      `[Trending Movies] Top 5 trending: action thriller (92% RT), sci-fi drama (88% RT), animated feature (95% RT).`,
    trending_tv: () =>
      `[Trending TV] Top series this week: limited series (9.1 IMDB), returning drama (8.7 IMDB), new comedy (8.3 IMDB).`,
    weather: () =>
      `[Weather] Current conditions retrieved for major global cities. Temperature ranges: 12-28C. Forecast: stable next 48h.`,
    find_place_on_map: (t) =>
      `[Map] Located relevant places for "${t}". Found 4 key locations with coordinates and details.`,
    nearby_places_search: (t) =>
      `[Nearby] 15 relevant nearby locations found for "${t}". Categories: business, education, entertainment.`,
    track_flight: () =>
      `[Flight] Tracked 3 relevant flights. All on schedule. Average delay in sector: 12 minutes.`,
    extreme_search: (t) =>
      `[Deep Research] Conducted multi-source deep research on "${t}". Synthesized 24 sources across academic, news, and social media. Key insight: emerging consensus forming around 3 major themes.`,
  };

  const generator = snippets[toolName];
  if (generator) return generator(topic);
  return `[${toolName}] Analysis completed for "${topic}". Results processed and integrated into response.`;
}

/** Build a coherent mock response from tool results for a given match type */
function generateMockAgentResponse(
  agentName: string,
  toolResults: string[],
  topic: string,
  matchType: string,
): string {
  const intro: Record<string, string> = {
    debate: `${agentName} presents the following argument on "${topic}":\n\n`,
    search_race: `${agentName} compiled the following findings on "${topic}":\n\n`,
    research: `${agentName} research report on "${topic}":\n\n`,
  };

  const prefix = intro[matchType] || `${agentName} analysis of "${topic}":\n\n`;
  const body = toolResults.join('\n\n');
  const conclusion = `\n\nConclusion: Based on the above analysis, ${agentName} identifies key trends and actionable insights related to "${topic}".`;

  return (prefix + body + conclusion).slice(0, 2000);
}

/** Compute score breakdown: accuracy (0-40), toolUsage (0-30), speed (0-30) */
function computeScoreBreakdown(toolsUsed: string[], totalTools: number) {
  const accuracy = Math.floor(Math.random() * 16) + 25; // 25-40
  const toolUsage = totalTools > 0
    ? Math.min(30, Math.floor((toolsUsed.length / Math.min(totalTools, 5)) * 30) + Math.floor(Math.random() * 5))
    : Math.floor(Math.random() * 10) + 10;
  const speed = Math.floor(Math.random() * 11) + 20; // 20-30
  return { accuracy, toolUsage, speed, total: accuracy + toolUsage + speed };
}

// ---------------------------------------------------------------------------

/**
 * POST /api/arena/[matchId] - Start/execute a match
 * Runs all participating agents against the topic.
 * Falls back to mock execution when the DB is unavailable.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params;

  // ---- Try DB path first ----
  try {
    const [dbMatch] = await Promise.race([
      db.select().from(arenaMatch).where(eq(arenaMatch.id, matchId)).limit(1),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
    ]);

    if (dbMatch) {
      // DB match found – run the real DB-backed execution
      return await executeWithDb(dbMatch, matchId);
    }
  } catch {
    // DB unavailable – fall through to mock path
  }

  // ---- Fallback: mock execution ----
  const mockMatch =
    MOCK_ARENA_MATCHES.find((m) => m.id === matchId) ??
    dynamicMatchStore.get(matchId);

  if (!mockMatch) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  }

  if (mockMatch.status !== 'pending') {
    return NextResponse.json({ error: 'Match already started or completed' }, { status: 400 });
  }

  return await executeWithMock(mockMatch);
}

// ---------------------------------------------------------------------------
// DB-backed execution (original logic, kept intact)
// ---------------------------------------------------------------------------
async function executeWithDb(match: any, matchId: string) {
  if (match.status !== 'pending') {
    return NextResponse.json({ error: 'Match already started or completed' }, { status: 400 });
  }

  await db
    .update(arenaMatch)
    .set({ status: 'active' })
    .where(eq(arenaMatch.id, matchId));

  const agentIds = match.agents as string[];
  const rounds: Array<{
    agentId: string;
    response: string;
    toolsUsed: string[];
    score: number;
    scoreBreakdown: { accuracy: number; toolUsage: number; speed: number };
    timestamp: string;
  }> = [];

  for (const agentId of agentIds) {
    const [agentData] = await db
      .select()
      .from(agent)
      .where(eq(agent.id, agentId))
      .limit(1);

    if (!agentData) continue;

    const agentTools = (agentData.tools as string[]) || [];
    const toolsUsed: string[] = [];
    let response = '';

    for (const toolName of agentTools.slice(0, 3)) {
      const toolMeta = getTool(toolName);
      if (!toolMeta) continue;

      try {
        const result = await toolMeta.tool.execute({ query: match.topic, queries: [match.topic] });
        toolsUsed.push(toolName);
        response += JSON.stringify(result).slice(0, 500) + '\n';
      } catch {
        // Tool failed, skip
      }
    }

    const breakdown = computeScoreBreakdown(toolsUsed, agentTools.length);

    rounds.push({
      agentId,
      response: response.slice(0, 2000),
      toolsUsed,
      score: breakdown.total,
      scoreBreakdown: { accuracy: breakdown.accuracy, toolUsage: breakdown.toolUsage, speed: breakdown.speed },
      timestamp: new Date().toISOString(),
    });

    await db
      .update(agent)
      .set({ totalExecutions: sql`${agent.totalExecutions} + 1` })
      .where(eq(agent.id, agentId));
  }

  const winner = rounds.reduce((best, round) =>
    round.score > best.score ? round : best
  , rounds[0]);

  await db
    .update(arenaMatch)
    .set({
      rounds,
      winnerId: winner?.agentId || null,
      status: 'completed',
      completedAt: new Date(),
    })
    .where(eq(arenaMatch.id, matchId));

  return NextResponse.json({
    match: {
      id: matchId,
      topic: match.topic,
      status: 'completed',
      winner: winner?.agentId,
      rounds,
    },
  });
}

// ---------------------------------------------------------------------------
// Mock execution (no real API calls)
// ---------------------------------------------------------------------------
async function executeWithMock(mockMatch: any) {
  // Mark as active
  mockMatch.status = 'active';

  const agentIds = mockMatch.agents as string[];
  const rounds: Array<{
    agentId: string;
    response: string;
    toolsUsed: string[];
    score: number;
    scoreBreakdown: { accuracy: number; toolUsage: number; speed: number };
    timestamp: string;
  }> = [];

  for (const agentId of agentIds) {
    const agentData = MOCK_AGENTS.find((a) => a.id === agentId);
    if (!agentData) continue;

    // Simulate execution delay (200-800ms per agent)
    await randomDelay(200, 800);

    const agentTools = agentData.tools || [];
    const toolsToUse = agentTools.slice(0, 3);
    const toolResults: string[] = [];

    for (const toolName of toolsToUse) {
      // Small per-tool delay
      await randomDelay(50, 200);
      toolResults.push(generateMockToolResult(toolName, mockMatch.topic));
    }

    const response = generateMockAgentResponse(
      agentData.name,
      toolResults,
      mockMatch.topic,
      mockMatch.matchType,
    );

    const breakdown = computeScoreBreakdown(toolsToUse, agentTools.length);

    rounds.push({
      agentId,
      response,
      toolsUsed: toolsToUse,
      score: breakdown.total,
      scoreBreakdown: { accuracy: breakdown.accuracy, toolUsage: breakdown.toolUsage, speed: breakdown.speed },
      timestamp: new Date().toISOString(),
    });
  }

  // Determine winner
  const winner = rounds.length > 0
    ? rounds.reduce((best, round) => (round.score > best.score ? round : best), rounds[0])
    : null;

  // Update mock match in-place so subsequent GETs reflect the result
  mockMatch.rounds = rounds;
  mockMatch.winnerId = winner?.agentId || null;
  mockMatch.status = 'completed';
  mockMatch.completedAt = new Date().toISOString();

  return NextResponse.json({
    match: {
      id: mockMatch.id,
      topic: mockMatch.topic,
      matchType: mockMatch.matchType,
      agents: mockMatch.agents,
      status: 'completed',
      winnerId: winner?.agentId || null,
      winner: winner?.agentId || null,
      rounds,
      prizePool: mockMatch.prizePool,
      totalVotes: mockMatch.totalVotes ?? 0,
      createdAt: mockMatch.createdAt,
      completedAt: mockMatch.completedAt,
    },
  });
}
